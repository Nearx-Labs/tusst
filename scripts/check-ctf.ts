// Verifies every Gauntlet level's promise, in the SAME hardened sandbox the
// player uses:
//
//   1. the reference exploit passes the hidden harness;
//   2. the starter (the code the player receives) does NOT;
//   3. the source guard accepts both of those, and refuses every known cheat
//      (src/lib/ctf/attacks.ts) — checked WITHOUT Docker, so it always runs;
//   4. with the guard bypassed, the sandbox-side layers still hold: a forged
//      win transcript is not graded a win and `unsafe` does not compile.
//
// A CTF level is easy to ship broken in either direction: a typo in the
// harness, a contract that no longer compiles, a win line that never prints —
// or, just as bad, a harness that passes without an exploit, so the level
// hands out a flag for pressing Run. The player cannot tell a broken level
// from a wrong answer, so both directions are checked here.
//
// Run: npm run check:ctf
//      npm run check:ctf -- --strict   (fail when Docker/image is missing)
//      npm run check:ctf -- --level=dust-mill   (one level only)
//
// Requires Docker and the runner image:
//   npm run runner:soroban:build
//
// The script is intentionally server-side: it imports the server-only level
// catalog (with --conditions=react-server) and never prints the harness.

import { spawnSync } from "node:child_process";
import { ctfLevels as allLevels } from "../src/content/ctf";
import { ctfTextFor } from "../src/content/ctf/i18n";
import { attacksFor } from "../src/lib/ctf/attacks";
import { assembleRun } from "../src/lib/ctf/assemble";
import { isWinOutput } from "../src/lib/ctf/grade";
import { scanExploit } from "../src/lib/ctf/guard";
import { runForge } from "../src/lib/soroban/runner";

const STRICT = process.argv.includes("--strict");
// --level=<slug> checks one level (faster while authoring a new one).
const levelArg = process.argv.findIndex((a) => a === "--level" || a.startsWith("--level="));
const ONLY =
  levelArg === -1
    ? undefined
    : process.argv[levelArg].startsWith("--level=")
      ? process.argv[levelArg].slice(8)
      : process.argv[levelArg + 1];
if (levelArg !== -1 && !ONLY) {
  console.error("✗ --level needs a slug (--level=<slug>)");
  process.exit(1);
}
const ctfLevels = ONLY ? allLevels.filter((l) => l.slug === ONLY) : allLevels;
if (ctfLevels.length === 0) {
  console.error(ONLY ? `✗ no level with slug "${ONLY}"` : "✗ the catalog has no levels");
  process.exit(1);
}
const IMAGE = "tusst-soroban-runner:latest";
const TAIL_LINES = 30;

type DockerState = "ready" | "skip" | "fail";

interface RunOutcome {
  solved: boolean;
  output: string[];
  doneOk: boolean;
  timedOut: boolean;
  infraError: boolean;
}

function missing(message: string): DockerState {
  if (STRICT) {
    console.error(`✗ ${message}`);
    return "fail";
  }
  console.warn(`! ${message} — skipping (use --strict to make this fatal)`);
  return "skip";
}

function dockerState(): DockerState {
  const info = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (info.status !== 0) {
    return missing("Docker is not available");
  }
  const image = spawnSync("docker", ["image", "inspect", IMAGE], {
    stdio: "ignore",
  });
  if (image.status !== 0) {
    return missing(
      `runner image ${IMAGE} is missing (run: npm run runner:soroban:build)`,
    );
  }
  return "ready";
}

async function runExploit(
  level: (typeof ctfLevels)[number],
  exploit: string,
): Promise<RunOutcome> {
  // Same assembly as the API route, including the per-run nonce. The guard is
  // deliberately not applied here: callers decide whether to test around it.
  const { files, nonce } = assembleRun(level, exploit);

  const output: string[] = [];
  let doneOk = false;
  let timedOut = false;
  let infraError = false;

  try {
    for await (const event of runForge("ctf", files)) {
      if (event.t === "log") output.push(event.line);
      else if (event.t === "done") {
        doneOk = event.ok;
        timedOut = event.timedOut;
        infraError = event.infraError;
      }
    }
  } catch {
    infraError = true;
  }

  return {
    solved: doneOk && isWinOutput(output, level.winTest, nonce),
    output,
    doneOk,
    timedOut,
    infraError,
  };
}

function reportFailure(
  label: string,
  level: (typeof ctfLevels)[number],
  run: RunOutcome,
): void {
  console.error(`✗ ${level.slug} — ${label}`);
  if (run.timedOut) console.error("  sandbox timed out");
  if (run.infraError) console.error("  sandbox infrastructure error");
  if (!run.doneOk && !run.timedOut && !run.infraError) {
    console.error("  cargo test exited non-zero");
  }
  console.error(`  expected line: ${level.winTest}`);
  console.error("  last output:");
  for (const line of run.output.slice(-TAIL_LINES)) {
    console.error(`  | ${line}`);
  }
}

const OVERLAY_LOCALES = ["pt", "es", "fr", "tr"] as const;

/** Code spans outside fenced blocks, sorted: they must match the English source. */
function codeSpans(markdown: string): string[] {
  return (markdown.replace(/```[\s\S]*?```/g, "").match(/`[^`\n]+`/g) ?? []).sort();
}

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

/**
 * Translated prose must keep the English skeleton: an overlay per locale, the
 * same number of hints, headings and code fences, and the same code spans.
 * check-i18n does not cover CTF overlays, so a short or missing translation
 * would otherwise ship silently.
 */
function checkOverlays(level: (typeof ctfLevels)[number]): number {
  let problems = 0;
  const fail = (locale: string, what: string) => {
    problems++;
    console.error(`✗ ${level.slug} [${locale}] — ${what}`);
  };
  for (const locale of OVERLAY_LOCALES) {
    const o = ctfTextFor(locale, level.slug);
    if (!o) {
      fail(locale, "no translation overlay");
      continue;
    }
    if (!o.title || !o.tagline || !o.story || !o.brief) fail(locale, "empty field");
    if ((o.hints?.length ?? 0) !== level.hints.length) {
      fail(locale, `${o.hints?.length ?? 0} hints, expected ${level.hints.length}`);
    }
    if (o.brief) {
      if (count(o.brief, /^## /gm) !== count(level.brief, /^## /gm)) fail(locale, "brief headings differ");
      if (count(o.brief, /```/g) !== count(level.brief, /```/g)) fail(locale, "brief code fences differ");
      if (codeSpans(o.brief).join("|") !== codeSpans(level.brief).join("|")) fail(locale, "brief code spans differ");
    }
    if (o.story && count(o.story, /\n\n/g) !== count(level.story, /\n\n/g)) fail(locale, "story paragraphs differ");
    (o.hints ?? []).forEach((hint, i) => {
      if (level.hints[i] && codeSpans(hint).join("|") !== codeSpans(level.hints[i]).join("|")) {
        fail(locale, `hint ${i + 1} code spans differ`);
      }
    });
  }
  return problems;
}

/**
 * Layer 1, no Docker: the guard must let the level's own code through and stop
 * every known cheat. Returns the number of problems found.
 */
function checkGuard(level: (typeof ctfLevels)[number]): number {
  let problems = 0;
  for (const [label, code] of [
    ["reference", level.reference],
    ["starter", level.starter],
  ] as const) {
    const hits = scanExploit(code, level.forbid);
    if (hits.length > 0) {
      problems++;
      console.error(
        `✗ ${level.slug} — the guard refuses the ${label}: ${hits
          .map((h) => `${h.token}@${h.line}`)
          .join(", ")}`,
      );
    }
  }
  for (const attack of attacksFor(level)) {
    if (scanExploit(attack.source, level.forbid).length === 0) {
      problems++;
      console.error(`✗ ${level.slug} — the guard lets through: ${attack.name}`);
    }
  }
  return problems;
}

/**
 * Layers 2-3, in the sandbox: with the guard bypassed, each attack must still
 * not win, and its own signature must show it got as far as it claims to.
 */
async function checkAttacksBypassingGuard(
  level: (typeof ctfLevels)[number],
): Promise<number> {
  let problems = 0;
  for (const attack of attacksFor(level)) {
    const run = await runExploit(level, attack.source);
    if (run.timedOut || run.infraError) {
      problems++;
      reportFailure(`could not run attack "${attack.name}"`, level, run);
    } else if (run.solved) {
      problems++;
      console.error(`✗ ${level.slug} — attack "${attack.name}" is graded a WIN with the guard bypassed`);
    } else if (!run.output.some((line) => attack.bypassOutputMatches.test(line))) {
      problems++;
      console.error(
        `✗ ${level.slug} — attack "${attack.name}" did not reach what it tests (expected ${attack.bypassOutputMatches}); the check proves nothing`,
      );
      for (const line of run.output.slice(-TAIL_LINES)) console.error(`  | ${line}`);
    } else {
      console.log(`  ✓ ${level.slug} — "${attack.name}" refused by the guard and not a win without it`);
    }
  }
  return problems;
}

async function main(): Promise<void> {
  let guardProblems = 0;
  for (const level of ctfLevels) {
    guardProblems += checkGuard(level) + checkOverlays(level);
  }
  if (guardProblems > 0) {
    console.error(`\n${guardProblems} guard/translation problem(s).`);
    process.exit(1);
  }
  console.log(`✓ source guard: level code allowed, known cheats refused; translations match`);

  const docker = dockerState();
  if (docker === "fail") process.exit(1);
  if (docker === "skip") return;

  let failed = 0;

  for (const level of ctfLevels) {
    const reference = await runExploit(level, level.reference);
    if (!reference.solved) {
      failed++;
      reportFailure("reference exploit did not pass", level, reference);
      continue;
    }

    const starter = await runExploit(level, level.starter);
    if (starter.timedOut || starter.infraError) {
      failed++;
      reportFailure(
        "could not verify that the starter fails (sandbox trouble)",
        level,
        starter,
      );
      continue;
    }
    // "Does not win" is not enough: a starter that fails to COMPILE would also
    // not win. It must run and fail the hidden test's own assertions.
    if (
      !starter.solved &&
      !starter.output.some((line) => /^test ctf_win \.\.\. FAILED$/.test(line.trim()))
    ) {
      failed++;
      reportFailure(
        "the starter does not fail the hidden assertions (does it compile?)",
        level,
        starter,
      );
      continue;
    }
    if (starter.solved) {
      failed++;
      console.error(
        `✗ ${level.slug} — the starter already passes; the level gives away the flag`,
      );
      continue;
    }

    const attackProblems = await checkAttacksBypassingGuard(level);
    if (attackProblems > 0) {
      failed++;
      continue;
    }

    console.log(
      `✓ ${level.slug} — reference passes, starter does not, cheats held`,
    );
  }

  if (failed > 0) {
    console.error(`\n${failed} CTF level(s) failed verification.`);
    process.exit(1);
  }

  console.log(
    `\nCTF levels OK: ${ctfLevels.length} level(s) verified in both directions.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
