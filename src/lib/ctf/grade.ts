import "server-only";

// Grading for the Gauntlet.
//
// Threat model. The player's exploit.rs is compiled into the same crate, and
// runs in the same process, as the hidden test. Anything the test can print,
// the exploit can print, and it can call process::exit(0) afterwards — so the
// exit code, the libtest win line and cargo's summary are all forgeable by
// in-process code. We verified this against the real sandbox (a forged
// exploit graded as a win before this predicate existed).
//
// Three layers, each cheap and each testable on its own:
//   1. src/lib/ctf/guard.ts refuses the exploit before it runs if it names
//      std, extern, unsafe, include*, as_contract, register_at, auth mocks...
//      (the APIs needed to forge output, read the harness or rewrite the world);
//   2. the level's lib.rs puts #[forbid(unsafe_code)] on the exploit module;
//   3. THIS predicate requires a per-run secret. The harness prints
//      `CTF_WIN <nonce>` only after every assertion passed, and the nonce is
//      a fresh UUID that exists only inside this run's tests/ctf.rs. Code that
//      cannot read the harness (layer 1) cannot print it; a transcript copied
//      from another run, or from a reference solution, carries the wrong one.
//
// A run is a win only when ALL of these hold:
//   - the harness printed its nonce line;
//   - cargo printed the level's literal win line ("test ctf_win ... ok");
//   - cargo printed its own clean summary ("test result: ok. N passed; 0 failed").
//
// In-process grading can never be perfect; the residual risk is a bypass of
// the guard, which costs the attacker a one-time XP award (paid once per
// user and level) and a flag that is worth nothing outside the game.
//
// The route, scripts/check-ctf.ts and the tests all import this, so the
// reference exploit is verified through exactly the predicate the player hits.

const SUMMARY = /^test result: ok\. (\d+) passed; 0 failed;/;

/** The marker line the hidden harness prints on success. */
export function winMarker(nonce: string): string {
  return `CTF_WIN ${nonce}`;
}

export function isWinOutput(
  lines: string[],
  winTest: string,
  nonce: string,
): boolean {
  if (!nonce) return false;
  const marker = winMarker(nonce);
  let sawNonce = false;
  let sawWinLine = false;
  let sawSummary = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === marker) {
      sawNonce = true;
      continue;
    }
    if (line === winTest) {
      sawWinLine = true;
      continue;
    }
    const summary = SUMMARY.exec(line);
    if (summary && Number(summary[1]) > 0) sawSummary = true;
  }
  return sawNonce && sawWinLine && sawSummary;
}
