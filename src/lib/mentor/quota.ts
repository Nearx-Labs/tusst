import type { Prisma, PrismaClient } from "@prisma/client";

export const LESSON_DAILY_LIMIT = 3;
export const USER_DAILY_LIMIT = 10;
export const GLOBAL_DAILY_LIMIT = 120;

export const MENTOR_QUOTA_LOCK_KEY = 7_420_117_001;
export const STALE_RESERVATION_MS = 90_000;

export type MentorQuotaScope = "lesson" | "user" | "global";

export interface MentorReservationInput {
  userId: string;
  lessonId: string | null;
  kind: "lesson" | "forge" | "journey";
  locale: string;
  model: string;
  submissionId?: string | null;
}

export type MentorReservation =
  | { status: "reserved"; id: string; remaining: number }
  | { status: "limited"; scope: MentorQuotaScope }
  | { status: "duplicate"; hint: string | null };

export type MentorQuotaDb = Pick<PrismaClient, "$transaction" | "mentorHint">;

function utcDayStart(now: Date): Date {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

async function countUsage(
  tx: Pick<Prisma.TransactionClient, "mentorHint">,
  userId: string,
  lessonId: string | null,
  dayStart: Date,
) {
  const today = { createdAt: { gte: dayStart } };
  const [lessonCount, userCount, globalCount] = await Promise.all([
    lessonId
      ? tx.mentorHint.count({ where: { userId, lessonId, ...today } })
      : Promise.resolve(0),
    tx.mentorHint.count({ where: { userId, ...today } }),
    tx.mentorHint.count({ where: today }),
  ]);
  return { lessonCount, userCount, globalCount };
}

export async function reserveMentorQuota(
  db: MentorQuotaDb,
  input: MentorReservationInput,
  now: Date = new Date(),
): Promise<MentorReservation> {
  const { userId, lessonId, submissionId = null } = input;
  const dayStart = utcDayStart(now);

  return db.$transaction(
    async (tx): Promise<MentorReservation> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MENTOR_QUOTA_LOCK_KEY}::bigint)`;

      if (submissionId) {
        const existing = await tx.mentorHint.findUnique({
          where: { submissionId },
          select: { id: true, hint: true, createdAt: true },
        });
        if (existing) {
          if (existing.hint) return { status: "duplicate", hint: existing.hint };
          const age = now.getTime() - existing.createdAt.getTime();
          if (age < STALE_RESERVATION_MS) {
            return { status: "duplicate", hint: null };
          }
          await tx.mentorHint.update({
            where: { id: existing.id },
            data: { submissionId: null },
          });
        }
      }

      const { lessonCount, userCount, globalCount } = await countUsage(
        tx,
        userId,
        lessonId,
        dayStart,
      );

      if (globalCount >= GLOBAL_DAILY_LIMIT) {
        return { status: "limited", scope: "global" };
      }
      if (userCount >= USER_DAILY_LIMIT) {
        return { status: "limited", scope: "user" };
      }
      if (lessonId && lessonCount >= LESSON_DAILY_LIMIT) {
        return { status: "limited", scope: "lesson" };
      }

      const row = await tx.mentorHint.create({
        data: {
          userId,
          lessonId,
          kind: input.kind,
          submissionId,
          locale: input.locale,
          hint: "",
          model: input.model,
        },
        select: { id: true },
      });

      const userLeft = USER_DAILY_LIMIT - userCount - 1;
      return {
        status: "reserved",
        id: row.id,
        remaining: lessonId
          ? Math.min(LESSON_DAILY_LIMIT - lessonCount - 1, userLeft)
          : userLeft,
      };
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}

export async function peekMentorRemaining(
  db: Pick<PrismaClient, "mentorHint">,
  userId: string,
  lessonId: string | null,
  now: Date = new Date(),
): Promise<number> {
  const { lessonCount, userCount, globalCount } = await countUsage(
    db,
    userId,
    lessonId,
    utcDayStart(now),
  );
  if (globalCount >= GLOBAL_DAILY_LIMIT) return 0;
  const userLeft = Math.max(0, USER_DAILY_LIMIT - userCount);
  return lessonId
    ? Math.max(0, Math.min(LESSON_DAILY_LIMIT - lessonCount, userLeft))
    : userLeft;
}

export async function finalizeMentorReservation(
  db: Pick<PrismaClient, "mentorHint">,
  id: string,
  hint: string,
): Promise<void> {
  await db.mentorHint.update({ where: { id }, data: { hint } });
}

export async function releaseMentorReservation(
  db: Pick<PrismaClient, "mentorHint">,
  id: string,
): Promise<void> {
  await db.mentorHint.update({ where: { id }, data: { submissionId: null } });
}
