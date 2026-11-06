import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ctfLevelBySlug } from "@/content/ctf";
import { assembleRun } from "@/lib/ctf/assemble";
import { isWinOutput } from "@/lib/ctf/grade";
import { scanExploit } from "@/lib/ctf/guard";
import { runForge } from "@/lib/soroban/runner";
import { checkRateLimit, clientKeyFor } from "@/lib/soroban/rate-limit";
import { awardXp } from "@/lib/xp-award";
import { XP_CTF } from "@/lib/xp";

// One CTF run. The client sends only the level slug and the contents of
// src/exploit.rs; the server supplies every other file, including the hidden
// integration test. Nothing secret ever travels to the browser.
//
// The Docker sandbox contains the run, but the exploit shares a process with
// the grader, so three layers keep it from forging a win (details in
// src/lib/ctf/grade.ts): the source guard rejects it before it runs, the
// level's lib.rs forbids unsafe code, and a win needs a per-run nonce that
// only the hidden harness knows. The exit code is necessary (a crashed or
// timed-out run never wins) but never sufficient on its own.

export const maxDuration = 300;

const MAX_BODY_BYTES = 48 * 1024;
const MAX_EXPLOIT_BYTES = 32 * 1024;
// Grade on every captured line (the runner already caps at 2,000 lines /
// 512KB), but return only the tail: a noisy exploit must not push the win
// line out of the response, and a long compiler log is not worth shipping.
const MAX_RETURNED_LINES = 200;

/**
 * Read the body up to `max` bytes. Content-Length can be absent (chunked) or
 * wrong, so the cap is enforced on the bytes actually received. Returns null
 * once the cap is exceeded, without buffering the rest.
 */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const text = await readCapped(req, MAX_BODY_BYTES);
  if (text === null) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { slug, exploit } = (body ?? {}) as {
    slug?: unknown;
    exploit?: unknown;
  };
  if (typeof slug !== "string" || typeof exploit !== "string") {
    return NextResponse.json(
      { error: "Expected { slug: string, exploit: string }." },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(exploit, "utf8") > MAX_EXPLOIT_BYTES) {
    return NextResponse.json(
      { error: "The exploit is too large (32KB max)." },
      { status: 413 },
    );
  }

  const level = ctfLevelBySlug(slug);
  if (!level) {
    return NextResponse.json({ error: "Level not found." }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const retryIn = checkRateLimit(clientKeyFor(req, userId), userId !== null);
  if (retryIn !== null) {
    return NextResponse.json(
      { error: `The gauntlet needs to cool down — try again in ${retryIn}s.` },
      { status: 429, headers: { "retry-after": String(retryIn) } },
    );
  }

  // Count the attempt before the run. A lost race only costs a number, so a
  // database hiccup here must not block the sandbox run.
  if (userId) {
    await prisma.ctfProgress
      .upsert({
        where: { userId_levelSlug: { userId, levelSlug: slug } },
        create: { userId, levelSlug: slug, attempts: 1 },
        update: { attempts: { increment: 1 } },
      })
      .catch(() => {});
  }

  // Refuse exploits that reach for the host, the hidden harness or the test
  // world before spending a sandbox slot. Nothing ran, so there is no output.
  const rejected = scanExploit(exploit, level.forbid);
  if (rejected.length > 0) {
    return NextResponse.json({
      solved: false,
      rejected: rejected.slice(0, 5),
      output: [],
      xp: null,
    });
  }

  // The only user-controlled file is exploit.rs. Everything else comes from
  // the server-only level module; tests/ctf.rs is the hidden harness, with a
  // fresh nonce that only this run's grader knows.
  const { files, nonce } = assembleRun(level, exploit);

  // A client that navigates away must not keep a sandbox slot busy: abort
  // kills the container, exactly like the Forge stream does.
  const abort = new AbortController();
  // The client may already be gone (it disconnected during auth or the attempt
  // upsert), in which case the "abort" event will not fire again.
  if (req.signal.aborted) abort.abort();
  else req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const output: string[] = [];
  let doneOk = false;
  let timedOut = false;
  let infraError = false;

  try {
    for await (const event of runForge("ctf", files, abort.signal)) {
      if (event.t === "log") {
        output.push(event.line);
      } else if (event.t === "done") {
        doneOk = event.ok;
        timedOut = event.timedOut;
        infraError = event.infraError;
      }
    }
  } catch {
    infraError = true;
  }

  // The harness's nonce line, cargo's literal win line and its own clean
  // summary, on a run that also finished cleanly (doneOk): the exit code is
  // required but never enough by itself. See src/lib/ctf/grade.ts.
  const solved = doneOk && isWinOutput(output, level.winTest, nonce);
  // The nonce is the one secret in the output (the show-output block prints
  // it). A passing run reveals it only to the player who just won; a failed
  // run never printed it. Mask it anyway so it can't be replayed or shared.
  const tail = output
    .slice(-MAX_RETURNED_LINES)
    .map((line) => line.replaceAll(nonce, "<nonce>"));

  if (!solved) {
    return NextResponse.json({
      solved: false,
      output: tail,
      timedOut,
      infraError,
      xp: null,
    });
  }

  // Anonymous heroes can break the level and read the flag; only a signed-in
  // run persists progress and pays XP.
  if (!userId) {
    return NextResponse.json({
      solved: true,
      flag: level.flag,
      output: tail,
      xp: null,
    });
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await tx.ctfProgress.upsert({
        where: { userId_levelSlug: { userId, levelSlug: slug } },
        create: {
          userId,
          levelSlug: slug,
          attempts: 1,
          solved: true,
          solvedAt: new Date(),
        },
        update: { solved: true },
      });
      // The trophy shows when the level was FIRST cleared: only fill solvedAt
      // while it is still empty, so replays never move the date.
      await tx.ctfProgress.updateMany({
        where: { userId, levelSlug: slug, solvedAt: null },
        data: { solvedAt: new Date() },
      });
      return awardXp(tx, {
        userId,
        amount: XP_CTF[level.difficulty],
        source: "ctf",
        sourceKey: slug,
      });
    });
  } catch (e) {
    // Concurrent duplicate claim lost the race on the XpEvent unique
    // constraint, aborting the transaction (P2002 must be caught OUTSIDE
    // $transaction on Postgres — see src/lib/xp-award.ts). The winner
    // credited; answer this request as "already claimed".
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const character = await prisma.character.findUnique({
        where: { userId },
        select: { xp: true, level: true },
      });
      return NextResponse.json({
        solved: true,
        flag: level.flag,
        output: tail,
        already: true,
        xp: {
          awarded: false,
          earned: 0,
          total: character?.xp ?? 0,
          level: character?.level ?? 1,
          leveledUp: false,
        },
      });
    }
    throw e;
  }

  return NextResponse.json({
    solved: true,
    flag: level.flag,
    output: tail,
    already: !outcome.awarded,
    xp: outcome,
  });
}
