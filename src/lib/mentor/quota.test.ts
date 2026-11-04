import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  finalizeMentorReservation,
  GLOBAL_DAILY_LIMIT,
  LESSON_DAILY_LIMIT,
  peekMentorRemaining,
  releaseMentorReservation,
  reserveMentorQuota,
  STALE_RESERVATION_MS,
  USER_DAILY_LIMIT,
  type MentorReservationInput,
} from "./quota";

const url = process.env.MENTOR_QUOTA_TEST_DATABASE_URL;
const PARALLEL = 20;
const MODEL = "test-model";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("reserveMentorQuota (real Postgres)", { skip: !url }, () => {
  let db: PrismaClient;
  const lessonIds: string[] = [];
  let seq = 0;

  const newUser = async () => {
    seq += 1;
    const u = await db.user.create({
      data: { email: `quota-${Date.now()}-${seq}@test.local` },
      select: { id: true },
    });
    return u.id;
  };

  const forge = (userId: string): MentorReservationInput => ({
    userId,
    lessonId: null,
    kind: "forge",
    locale: "en",
    model: MODEL,
  });

  const rows = () => db.mentorHint.count();

  before(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const track = await db.track.create({
      data: {
        slug: `quota-track-${Date.now()}`,
        title: "t",
        description: "t",
        level: "beginner",
        domain: "rust",
        order: 1,
      },
    });
    for (let i = 0; i < 3; i++) {
      const l = await db.lesson.create({
        data: { trackId: track.id, slug: `quota-lesson-${Date.now()}-${i}`, title: "l", order: i },
      });
      lessonIds.push(l.id);
    }
  });

  beforeEach(async () => {
    await db.mentorHint.deleteMany();
  });

  after(async () => {
    await db.$disconnect();
  });

  it("per-user fence: exactly USER_DAILY_LIMIT of 20 parallel reservations pass", async () => {
    const userId = await newUser();
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () => reserveMentorQuota(db, forge(userId))),
    );
    const ok = results.filter((r) => r.status === "reserved");
    const limited = results.filter((r) => r.status === "limited");
    assert.equal(ok.length, USER_DAILY_LIMIT);
    assert.equal(limited.length, PARALLEL - USER_DAILY_LIMIT);
    assert.ok(limited.every((r) => r.status === "limited" && r.scope === "user"));
    assert.equal(await rows(), USER_DAILY_LIMIT);
    const remainings = ok.map((r) => (r.status === "reserved" ? r.remaining : -1));
    assert.deepEqual(
      [...remainings].sort((a, b) => b - a),
      Array.from({ length: USER_DAILY_LIMIT }, (_, i) => USER_DAILY_LIMIT - 1 - i),
    );
  });

  it("per-lesson fence: exactly LESSON_DAILY_LIMIT of 20 parallel reservations pass", async () => {
    const userId = await newUser();
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        reserveMentorQuota(db, {
          userId,
          lessonId: lessonIds[0],
          kind: "lesson",
          locale: "en",
          model: MODEL,
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "reserved").length, LESSON_DAILY_LIMIT);
    assert.ok(
      results.every((r) => r.status === "reserved" || (r.status === "limited" && r.scope === "lesson")),
    );
    assert.equal(await rows(), LESSON_DAILY_LIMIT);
  });

  it("global fence: exactly k of 20 parallel reservations (distinct users) pass near the ceiling", async () => {
    const k = 7;
    const fillerUsers = await Promise.all(Array.from({ length: 20 }, newUser));
    const filler = GLOBAL_DAILY_LIMIT - k;
    await db.mentorHint.createMany({
      data: Array.from({ length: filler }, (_, i) => ({
        userId: fillerUsers[i % fillerUsers.length],
        kind: "forge",
        locale: "en",
        hint: "x",
        model: MODEL,
      })),
    });
    const racers = await Promise.all(Array.from({ length: PARALLEL }, newUser));
    const results = await Promise.all(racers.map((u) => reserveMentorQuota(db, forge(u))));
    assert.equal(results.filter((r) => r.status === "reserved").length, k);
    assert.ok(
      results.every((r) => r.status === "reserved" || (r.status === "limited" && r.scope === "global")),
    );
    assert.equal(await rows(), GLOBAL_DAILY_LIMIT);
  });

  it("same submissionId in parallel: one reservation, the rest are duplicates, one row", async () => {
    const userId = await newUser();
    const sub = await db.submission.create({
      data: { userId, lessonId: lessonIds[1], code: "x", status: "fail" },
      select: { id: true },
    });
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        reserveMentorQuota(db, {
          userId,
          lessonId: lessonIds[1],
          kind: "lesson",
          locale: "en",
          model: MODEL,
          submissionId: sub.id,
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "reserved").length, 1);
    assert.equal(results.filter((r) => r.status === "duplicate").length, PARALLEL - 1);
    assert.ok(results.every((r) => r.status !== "duplicate" || r.hint === null));
    assert.equal(await rows(), 1);
  });

  it("finalize makes later requests for the submission a free cache hit", async () => {
    const userId = await newUser();
    const sub = await db.submission.create({
      data: { userId, lessonId: lessonIds[1], code: "x", status: "fail" },
      select: { id: true },
    });
    const input: MentorReservationInput = {
      userId,
      lessonId: lessonIds[1],
      kind: "lesson",
      locale: "en",
      model: MODEL,
      submissionId: sub.id,
    };
    const first = await reserveMentorQuota(db, input);
    assert.equal(first.status, "reserved");
    if (first.status !== "reserved") return;
    await finalizeMentorReservation(db, first.id, "try borrowing");
    const again = await reserveMentorQuota(db, input);
    assert.deepEqual(again, { status: "duplicate", hint: "try borrowing" });
    assert.equal(await rows(), 1);
  });

  it("release keeps the quota spent but frees the submission for a retry", async () => {
    const userId = await newUser();
    const sub = await db.submission.create({
      data: { userId, lessonId: lessonIds[2], code: "x", status: "fail" },
      select: { id: true },
    });
    const input: MentorReservationInput = {
      userId,
      lessonId: lessonIds[2],
      kind: "lesson",
      locale: "en",
      model: MODEL,
      submissionId: sub.id,
    };
    const first = await reserveMentorQuota(db, input);
    assert.equal(first.status, "reserved");
    if (first.status !== "reserved") return;
    await releaseMentorReservation(db, first.id);
    const retry = await reserveMentorQuota(db, input);
    assert.equal(retry.status, "reserved");
    assert.equal(await rows(), 2);
    assert.equal(await peekMentorRemaining(db, userId, lessonIds[2]), LESSON_DAILY_LIMIT - 2);
  });

  it("a stale in-flight reservation (crashed request) is taken over without wedging the submission", async () => {
    const userId = await newUser();
    const sub = await db.submission.create({
      data: { userId, lessonId: lessonIds[2], code: "x", status: "fail" },
      select: { id: true },
    });
    const input: MentorReservationInput = {
      userId,
      lessonId: lessonIds[2],
      kind: "lesson",
      locale: "en",
      model: MODEL,
      submissionId: sub.id,
    };
    const first = await reserveMentorQuota(db, input);
    assert.equal(first.status, "reserved");
    const inflight = await reserveMentorQuota(db, input);
    assert.deepEqual(inflight, { status: "duplicate", hint: null });
    const later = new Date(Date.now() + STALE_RESERVATION_MS + 1_000);
    const takeover = await reserveMentorQuota(db, input, later);
    assert.equal(takeover.status, "reserved");
    assert.equal(await rows(), 2);
  });

  it("legacy check-then-insert-after-the-LLM-call overshoots (demonstration only)", async () => {
    const userId = await newUser();
    const legacy = async () => {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const userCount = await db.mentorHint.count({
        where: { userId, createdAt: { gte: dayStart } },
      });
      if (userCount >= USER_DAILY_LIMIT) return false;
      await sleep(50);
      await db.mentorHint.create({
        data: { userId, kind: "forge", locale: "en", hint: "x", model: MODEL },
      });
      return true;
    };
    const results = await Promise.all(Array.from({ length: PARALLEL }, legacy));
    const passed = results.filter(Boolean).length;
    console.log(`legacy: ${passed} of ${PARALLEL} parallel calls passed (limit ${USER_DAILY_LIMIT})`);
    assert.ok(passed > USER_DAILY_LIMIT);
  });
});
