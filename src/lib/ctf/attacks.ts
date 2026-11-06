import type { CtfLevel } from "@/content/ctf/types";

// Known cheats, replayed by scripts/check-ctf.ts against every level.
//
// Each attack is the level's own starter with extra code injected at the top
// of `solve`, so it works for any level that keeps the fixed `pub fn solve(…)`
// signature. For every attack the checker proves two things:
//   1. the source guard refuses it (cheap, no Docker);
//   2. with the guard BYPASSED — calling the sandbox directly — the layers
//      behind it still hold: the run is not graded a win, and the attack's own
//      signature shows it really reached the point it was trying to exploit
//      (so a compile error cannot make "not a win" pass for the wrong reason).
//
// Cheats that only the guard can stop (rewriting the test world with
// register_at / as_contract / auth mocks, reading the harness with include_str)
// are covered by src/lib/ctf/guard.test.ts instead: past the guard they work,
// which is exactly why the guard is the first layer and not the only one.

export interface Attack {
  name: string;
  source: string;
  /** Output lines that must appear when the guard is bypassed (proof the attack ran). */
  bypassOutputMatches: RegExp;
}

const SOLVE_OPEN = /pub fn solve\s*\([^)]*\)\s*\{/;

function inject(level: CtfLevel, header: string, body: string): string {
  const m = SOLVE_OPEN.exec(level.starter);
  if (!m) {
    throw new Error(
      `level ${level.slug}: starter has no \`pub fn solve(…) {\` to inject attacks into`,
    );
  }
  const at = m.index + m[0].length;
  return `${header}\n${level.starter.slice(0, at)}\n${body}\n${level.starter.slice(at)}`;
}

export function attacksFor(level: CtfLevel): Attack[] {
  return [
    {
      // Print everything a win prints — except the per-run nonce, which an
      // exploit cannot know — then exit cleanly so the exit code is 0 too.
      name: "forged win output",
      // The WHOLE line, not a substring: when an attack fails to compile, rustc
      // echoes the offending source line, which contains the literal as well.
      bypassOutputMatches: new RegExp(
        `^\\s*${level.winTest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
      ),
      source: inject(
        level,
        "extern crate std;",
        `    {
        use std::io::Write;
        let mut out = std::io::stdout();
        let _ = out.write_all(b"CTF_WIN 00000000-0000-0000-0000-000000000000\\n");
        let _ = out.write_all(b"${level.winTest}\\n");
        let _ = out.write_all(b"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out\\n");
        let _ = out.flush();
        std::process::exit(0);
    }`,
      ),
    },
    {
      // #[forbid(unsafe_code)] on the exploit module turns this into a
      // compile error, so no unsafe trick ever runs.
      name: "unsafe block",
      // rustc's own diagnostic for a forbidden block, not the echoed source line.
      bypassOutputMatches: /usage of an `unsafe` block/,
      source: inject(
        level,
        "",
        `    let probe = 0u8;
    let _read = unsafe { core::ptr::read(&probe) };`,
      ),
    },
  ];
}
