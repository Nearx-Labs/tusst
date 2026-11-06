import "server-only";

import { randomUUID } from "node:crypto";
import type { CtfLevel } from "@/content/ctf/types";
import type { SorobanFileMap } from "@/lib/soroban/types";

// Builds the project for one CTF run. The route, scripts/check-ctf.ts and the
// adversarial attacks all assemble through here, so what is verified offline
// is byte-for-byte what a player's run executes.

/** Placeholder a level's harness uses where the per-run nonce goes. */
export const NONCE_PLACEHOLDER = "__CTF_NONCE__";

/** The runner executes exactly this test, so every level uses this name. */
export const WIN_TEST = "test ctf_win ... ok";

export interface CtfRun {
  files: SorobanFileMap;
  nonce: string;
}

export function newNonce(): string {
  return randomUUID();
}

export function assembleRun(level: CtfLevel, exploit: string): CtfRun {
  if (!level.harness.includes(NONCE_PLACEHOLDER)) {
    // A harness that never prints the nonce could never be graded a win; fail
    // loudly instead of shipping a level nobody can solve.
    throw new Error(`level ${level.slug}: harness has no ${NONCE_PLACEHOLDER}`);
  }
  // The contract the runner and grader rely on, enforced instead of trusted.
  if (level.harness.split(NONCE_PLACEHOLDER).length !== 2) {
    throw new Error(
      `level ${level.slug}: ${NONCE_PLACEHOLDER} must appear exactly once in the harness`,
    );
  }
  if (!/\bfn ctf_win\s*\(/.test(level.harness) || level.winTest !== WIN_TEST) {
    throw new Error(
      `level ${level.slug}: the harness test must be fn ctf_win and winTest "${WIN_TEST}" (entrypoint.sh runs --exact ctf_win)`,
    );
  }
  const printAt = level.harness.search(
    /println!\(\s*"CTF_WIN __CTF_NONCE__"\s*\)\s*;/,
  );
  if (printAt === -1) {
    throw new Error(
      `level ${level.slug}: the nonce must be printed with println!("CTF_WIN ${NONCE_PLACEHOLDER}");`,
    );
  }
  if (printAt < level.harness.lastIndexOf("assert")) {
    throw new Error(
      `level ${level.slug}: the nonce line must come after every assert`,
    );
  }

  const nonce = newNonce();
  return {
    nonce,
    files: {
      ...level.files,
      "src/exploit.rs": exploit,
      "tests/ctf.rs": level.harness.replaceAll(NONCE_PLACEHOLDER, nonce),
    },
  };
}
