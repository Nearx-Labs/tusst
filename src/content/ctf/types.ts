// CTF / Gauntlet level DSL. A level is DATA: the fixed project the player
// reads, the starter exploit they edit, and the hidden integration test the
// server injects. The server assembles those pieces into one Soroban project
// and runs `cargo test --test ctf` inside the hardened Forge sandbox.
//
// SECURITY: modules in this folder import "server-only" because `harness`,
// `reference` and `flag` must never reach the browser. Pages pass only the
// safe fields (story, brief, hints, visible files, starter) to the client.

import type { SorobanFileMap } from "@/lib/soroban/types";

export type CtfDifficulty = "novice" | "adept" | "master";

export interface CtfLevel {
  slug: string;
  title: string;
  tagline: string;
  difficulty: CtfDifficulty;
  estMinutes: number;
  /** Markdown narrative shown above the brief. */
  story: string;
  /** Markdown objective, contract explanation and rules. */
  brief: string;
  /** Progressive hints, revealed one at a time by the player. */
  hints: string[];
  /**
   * Fixed project files the player may read but not edit. Always contains
   * Cargo.toml, src/lib.rs and the vulnerable contract module.
   */
  files: SorobanFileMap;
  /** Contents of the one editable file, src/exploit.rs. */
  starter: string;
  /**
   * Hidden integration test. Server-only: appended as tests/ctf.rs when the
   * run is assembled. It calls `exploit::solve` and asserts the win state.
   * It MUST print `CTF_WIN __CTF_NONCE__` (println!) as its last statement,
   * after every assertion; assembleRun swaps in a fresh per-run nonce.
   */
  harness: string;
  /**
   * Exact line cargo's test harness prints when the hidden test passes, e.g.
   * "test ctf_win ... ok". Grading requires this line, the harness's nonce
   * line AND cargo's own "test result: ok. N passed" summary
   * (src/lib/ctf/grade.ts), so a timeout, a compiler error or a hand-printed
   * line in a failed run grants nothing.
   */
  winTest: string;
  /**
   * Extra identifiers the source guard refuses for this level only, on top of
   * the global list in src/lib/ctf/guard.ts (e.g. "storage" for a level whose
   * solution never touches contract storage directly).
   */
  forbid?: string[];
  /** Revealed only after the win line is observed. */
  flag: string;
  /**
   * Server-side reference exploit. Used by scripts/check-ctf.ts to prove the
   * level is solvable; never shipped to the client.
   */
  reference: string;
}
