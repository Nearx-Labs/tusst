import assert from "node:assert/strict";
import test from "node:test";
import { isWinOutput, winMarker } from "./grade";
import { NONCE_PLACEHOLDER, assembleRun } from "./assemble";
import type { CtfLevel } from "@/content/ctf/types";

const WIN = "test ctf_win ... ok";
const SUMMARY = "test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out";
const NONCE = "11111111-2222-3333-4444-555555555555";

const clean = (nonce = NONCE) => [
  "running 1 test",
  WIN,
  "---- ctf_win stdout ----",
  winMarker(nonce),
  SUMMARY,
];

test("a genuine run is a win", () => {
  assert.equal(isWinOutput(clean(), WIN, NONCE), true);
});

test("output forged without the nonce is not a win", () => {
  // what a std-using exploit can print: the win line and a full summary
  assert.equal(isWinOutput(["running 1 test", WIN, SUMMARY], WIN, NONCE), false);
});

test("a nonce from another run is not a win", () => {
  assert.equal(isWinOutput(clean("another-run"), WIN, NONCE), false);
});

test("an empty nonce can never win", () => {
  assert.equal(isWinOutput(["CTF_WIN ", WIN, SUMMARY], WIN, ""), false);
});

test("each of the three signals is required", () => {
  assert.equal(isWinOutput([winMarker(NONCE), SUMMARY], WIN, NONCE), false);
  assert.equal(isWinOutput([winMarker(NONCE), WIN], WIN, NONCE), false);
  assert.equal(isWinOutput([WIN, SUMMARY], WIN, NONCE), false);
});

test("a failed or empty test summary is not a win", () => {
  const failed = "test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out";
  assert.equal(isWinOutput([winMarker(NONCE), WIN, failed], WIN, NONCE), false);
  const none = "test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out";
  assert.equal(isWinOutput([winMarker(NONCE), WIN, none], WIN, NONCE), false);
  const mixed = "test result: ok. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out";
  assert.equal(isWinOutput([winMarker(NONCE), WIN, mixed], WIN, NONCE), false);
});

test("the marker must be the whole line", () => {
  assert.equal(
    isWinOutput([`x ${winMarker(NONCE)}`, WIN, SUMMARY], WIN, NONCE),
    false,
  );
  assert.equal(
    isWinOutput([`  ${winMarker(NONCE)}  `, WIN, SUMMARY], WIN, NONCE),
    true,
  );
});

const level = (harness: string): CtfLevel => ({
  slug: "t",
  title: "t",
  tagline: "t",
  difficulty: "novice",
  estMinutes: 1,
  story: "",
  brief: "",
  hints: [],
  files: { "Cargo.toml": "" },
  starter: "",
  harness,
  winTest: WIN,
  flag: "F",
  reference: "",
});

const GOOD = `#[test]
fn ctf_win() {
    assert_eq!(1, 1);
    println!("CTF_WIN ${NONCE_PLACEHOLDER}");
}`;

test("assembleRun injects a fresh nonce into the hidden harness only", () => {
  const lvl = level(GOOD);
  const a = assembleRun(lvl, "// exploit");
  const b = assembleRun(lvl, "// exploit");
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(a.files["tests/ctf.rs"], GOOD.replace(NONCE_PLACEHOLDER, a.nonce));
  assert.equal(a.files["src/exploit.rs"], "// exploit");
  assert.equal(lvl.harness.includes(a.nonce), false, "the level itself is not mutated");
});

test("assembleRun refuses a harness that cannot print the nonce", () => {
  assert.throws(() => assembleRun(level("fn main() {}"), ""), /no __CTF_NONCE__/);
});

test("assembleRun refuses a nonce that is only mentioned in a comment", () => {
  const h = `#[test]\nfn ctf_win() {\n    // ${NONCE_PLACEHOLDER}\n}`;
  assert.throws(() => assembleRun(level(h), ""), /println!/);
});

test("assembleRun refuses a nonce printed before the assertions", () => {
  const h = `#[test]\nfn ctf_win() {\n    println!("CTF_WIN ${NONCE_PLACEHOLDER}");\n    assert_eq!(1, 2);\n}`;
  assert.throws(() => assembleRun(level(h), ""), /after every assert/);
});

test("assembleRun refuses a placeholder used twice", () => {
  const h = `${GOOD}\n// ${NONCE_PLACEHOLDER}`;
  assert.throws(() => assembleRun(level(h), ""), /exactly once/);
});

test("assembleRun refuses a test name the runner will not run", () => {
  const renamed = GOOD.replace("fn ctf_win", "fn other");
  assert.throws(() => assembleRun(level(renamed), ""), /fn ctf_win/);
  const lvl = { ...level(GOOD), winTest: "test other ... ok" };
  assert.throws(() => assembleRun(lvl, ""), /fn ctf_win/);
});
