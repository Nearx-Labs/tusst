import assert from "node:assert/strict";
import test from "node:test";
import { scanExploit } from "./guard";

const tokens = (src: string, forbid: string[] = []) =>
  scanExploit(src, forbid).map((v) => v.token);

test("a clean exploit passes", () => {
  const src = `use soroban_sdk::{Address, Env};
use crate::level::VaultClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let client = VaultClient::new(env, &vault);
    let amount = client.balance_of(&victim);
    client.withdraw(&victim, &attacker, &amount);
}`;
  assert.deepEqual(tokens(src), []);
});

test("the Env parameter named env is fine; env!() is not", () => {
  assert.deepEqual(tokens("fn f(env: &Env) { let _ = env.ledger(); }"), []);
  assert.deepEqual(tokens("fn f(env: &Env) { if env != 1 {} }"), []);
  assert.deepEqual(tokens('const X: &str = env!("HOME");'), ["env"]);
  assert.deepEqual(tokens('const X: Option<&str> = option_env!("HOME");'), ["option_env"]);
});

test("forging stdout is refused", () => {
  const src = `extern crate std;
fn f() { use std::io::Write; std::io::stdout().write_all(b"x").unwrap(); std::process::exit(0); }`;
  const found = tokens(src);
  assert.ok(found.includes("extern"));
  assert.ok(found.includes("std"));
});

test("reading the hidden harness is refused", () => {
  assert.deepEqual(tokens('const H: &str = include_str!("../tests/ctf.rs");'), ["include_str"]);
  assert.deepEqual(tokens('const H: &[u8] = include_bytes!("../tests/ctf.rs");'), ["include_bytes"]);
  assert.deepEqual(tokens("include!(x);"), ["include"]);
});

test("rewriting the test world is refused", () => {
  assert.deepEqual(tokens("env.register_at(&vault, Fake, ());"), ["register_at"]);
  assert.deepEqual(tokens("env.as_contract(&vault, || {});"), ["as_contract"]);
  assert.deepEqual(tokens("env.mock_all_auths();"), ["mock_all_auths"]);
  assert.deepEqual(tokens("env.set_auths(&[]);"), ["set_auths"]);
});

test("registering the player's own contract stays allowed", () => {
  assert.deepEqual(tokens("let id = env.register(Attacker, ());"), []);
});

test("unsafe, extern blocks and raw identifiers are refused", () => {
  assert.deepEqual(tokens("unsafe { core::hint::unreachable_unchecked() }"), ["unsafe"]);
  assert.deepEqual(tokens('extern "C" { fn write(); }'), ["extern"]);
  assert.deepEqual(tokens("use r#std::io;"), ["std"]);
});

test("attributes that load files or alter linkage are refused", () => {
  assert.deepEqual(tokens('#[path = "/project/tests/ctf.rs"] mod h;'), ["path"]);
  assert.deepEqual(tokens('#![cfg_attr(all(), path = "x")]'), ["cfg_attr", "path"]);
  assert.deepEqual(tokens("#[no_mangle] fn f() {}"), ["no_mangle"]);
  // `path` as a plain variable is fine.
  assert.deepEqual(tokens("let path = 1;"), []);
});

test("token-pass words inside comments and strings are not flagged", () => {
  const src = `// as_contract(register_at) mock_all_auths set_auths
/* register_at /* nested as_contract */ still a comment: set_auths */
fn f() {
    let a = "as_contract register_at set_auths";
    let b = r#"mock_all_auths "quoted" register_at"#;
    let c = r##"a "# as_contract"##;
    let d = b"register_at";
    let e = 'x';
    let g = '\\'';
    let _ = (a, b, c, d, e, g);
}`;
  assert.deepEqual(tokens(src), []);
});

test("host-access words are refused even in comments and strings (raw pass)", () => {
  assert.deepEqual(tokens("// std::process::exit(0)"), ["std"]);
  assert.deepEqual(tokens('let a = "unsafe extern include_str";'), ["unsafe", "extern", "include_str"]);
  assert.deepEqual(tokens("/* x /* nested std */ y */"), ["std"]);
});

test("a shebang line cannot hide live code from the guard", () => {
  // rustc drops the first line when it starts with #! and then sees live code;
  // a lexer reading #!/* as a block comment would swallow it.
  const src = "#!/*\nextern crate std;\npub fn a(){ std::process::exit(7) }\n// */\npub fn solve() {}";
  assert.deepEqual(tokens(src), ["#!"]);
  assert.deepEqual(tokens("#!/usr/bin/env run\nfn f() {}"), ["#!"]);
  // an inner attribute is not a shebang
  assert.deepEqual(tokens("#![allow(dead_code)]\nfn f() {}"), []);
});

test("a BOM does not glue onto the first word", () => {
  assert.deepEqual(tokens("\uFEFFextern crate std;"), ["extern", "std"]);
  assert.deepEqual(tokens("\uFEFF#!/*\nstd\n// */"), ["#!"]);
});

test("Unicode whitespace splits words the way rustc does", () => {
  // U+200E, U+200F, U+2028, U+2029 and U+0085 are Rust whitespace
  for (const ws of ["\u200e", "\u200f", "\u2028", "\u2029", "\u0085"]) {
    const found = tokens(`extern${ws}crate${ws}std;\nunsafe${ws}{}`);
    assert.ok(found.includes("extern"), `extern with U+${ws.codePointAt(0)!.toString(16)}`);
    assert.ok(found.includes("std"));
    assert.ok(found.includes("unsafe"));
  }
});

test("a real non-ASCII identifier is one word", () => {
  assert.deepEqual(tokens("let café = 1; let ünsafe = 2;"), []);
});

test("macro_rules cannot rebuild attributes", () => {
  const src =
    'macro_rules! m { ($($t:tt)*) => { #[$($t)*] mod x; } }\nm!(path = "../tests/ctf.rs");';
  assert.ok(tokens(src).includes("macro_rules"));
});

test("printing and Host access are refused", () => {
  assert.deepEqual(tokens("env.logs().print();"), ["logs"]);
  assert.deepEqual(tokens('log!(&env, "x");'), ["log"]);
  assert.deepEqual(tokens('println!("x");'), ["println"]);
  assert.deepEqual(tokens("let h = env.host();"), ["host"]);
  assert.deepEqual(tokens('env.to_snapshot_file("/tmp/x");'), ["to_snapshot_file"]);
  // a variable that merely contains the word is fine
  assert.deepEqual(tokens("let logs_seen = 1; let hostile = 2; let printed = 3;"), []);
});

test("code after a string or comment is still scanned", () => {
  assert.deepEqual(tokens('let _ = "ok"; std::process::exit(0);'), ["std"]);
  assert.deepEqual(tokens("/* x */ unsafe {}"), ["unsafe"]);
  assert.deepEqual(tokens("fn f<'a>(x: &'a str) { std::process::exit(0); }"), ["std"]);
});

test("a lifetime does not swallow the code after it", () => {
  // 'a is a lifetime, not a char literal opening at 'a, ... '
  assert.deepEqual(tokens("fn f<'a, 'b>(x: &'a u8, y: &'b u8) { unsafe {} }"), ["unsafe"]);
});

test("level-specific forbidden tokens", () => {
  assert.deepEqual(tokens("let s = env.storage();", ["storage"]), ["storage"]);
  assert.deepEqual(tokens("let s = env.storage();"), []);
});

test("violations carry 1-based line numbers in source order", () => {
  const found = scanExploit("fn a() {}\n\n// comment\nunsafe {}\nlet _ = std::f32::MAX;");
  assert.deepEqual(found, [
    { token: "unsafe", line: 4 },
    { token: "std", line: 5 },
  ]);
});
