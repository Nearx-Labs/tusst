import "server-only";

// Source guard for the Gauntlet.
//
// The player's src/exploit.rs is compiled INTO the crate the hidden test links,
// so it shares a process with the grader. Two things follow, both verified in
// the sandbox:
//   - `extern crate std;` works even though lib.rs is #![no_std], so exploit
//     code can write the win lines to stdout itself and process::exit(0);
//   - include_str!("../tests/ctf.rs") reads the hidden harness at compile time.
// The same code can also rewrite the world the test asserts on: register a
// fake contract over the vault id, write storage via as_contract, or re-enable
// the authorization mocks the harness dropped.
//
// None of that is something a level asks the player to do, so we refuse it
// before the sandbox spends a slot. This is the first of three layers (see
// grade.ts for the per-run nonce and levels' `#[forbid(unsafe_code)]`).
//
// A lexer that disagrees with rustc about where code starts and ends can be
// walked around (a shebang line, Unicode whitespace, macro-built attributes
// were all found that way). So the guard works in two independent passes and
// reports the union:
//   1. a token pass: identifiers, macro calls and attribute contents, with
//      comments and strings skipped;
//   2. a RAW pass over the untouched text for the words that give access to the
//      host. It ignores comments and strings on purpose — a lexer bug cannot
//      hide a word from a regex — so even a comment that says "std" is refused.
// Anything the token pass cannot be trusted with is refused outright instead
// of interpreted: a leading `#!` that is not `#![`, and `macro_rules`.

export interface GuardViolation {
  token: string;
  line: number;
}

/** Identifiers refused anywhere in the exploit (token pass). */
const FORBIDDEN_IDENTS = new Set([
  // reaching the host: stdout, filesystem, environment, raw syscalls
  "std",
  "extern",
  "unsafe",
  "asm",
  "global_asm",
  "libc",
  "proc_macro",
  // reading the hidden harness at compile time
  "include",
  "include_str",
  "include_bytes",
  // rewriting the test world
  "register_at",
  "register_contract",
  "register_contract_wasm",
  "as_contract",
  "mock_all_auths",
  "mock_all_auths_allowing_non_root_auth",
  "mock_auths",
  "set_auths",
  // the Host behind Env, and testutils that print or touch files
  "host",
  "logs",
  "to_snapshot_file",
  "to_ledger_snapshot_file",
  "from_snapshot_file",
  "from_ledger_snapshot_file",
  // macros can rebuild attributes and identifiers the token pass would miss
  "macro_rules",
  "macro",
]);

/**
 * Refused only when invoked as a macro (`env!("X")`). `env` alone is the
 * conventional name of the Env parameter in every level's solve signature.
 */
const FORBIDDEN_MACROS = new Set([
  "env",
  "option_env",
  // printing: the runner treats lines it prints as protocol output
  "log",
  "print",
  "println",
  "eprint",
  "eprintln",
  "dbg",
]);

/** Refused only inside an attribute `#[ ... ]` / `#![ ... ]`. */
const FORBIDDEN_ATTR_IDENTS = new Set([
  "path",
  "link",
  "link_name",
  "link_section",
  "no_mangle",
  "export_name",
  "used",
  "ctor",
  "cfg_attr",
  "global_allocator",
  "panic_handler",
]);

/**
 * Raw pass: whole words refused anywhere in the text, comments and strings
 * included. Word boundaries use XID_Continue, so `unsafe_code` and `std_x` do
 * not match but `extern<U+200E>crate` (a Rust whitespace) does.
 */
const RAW_WORDS =
  /(?<![\p{XID_Continue}])(std|extern|unsafe|asm|global_asm|include|include_str|include_bytes|libc|proc_macro|macro_rules)(?![\p{XID_Continue}])/gu;

type Token =
  | { kind: "ident"; text: string; line: number; pos: number }
  | { kind: "punct"; text: string; line: number; pos: number };

const isIdentStart = (cp: number) =>
  cp === 95 ||
  (cp < 128
    ? (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)
    : /\p{XID_Start}/u.test(String.fromCodePoint(cp)));

const isIdentPart = (cp: number) =>
  cp < 128
    ? cp === 95 ||
      (cp >= 48 && cp <= 57) ||
      (cp >= 65 && cp <= 90) ||
      (cp >= 97 && cp <= 122)
    : /\p{XID_Continue}/u.test(String.fromCodePoint(cp));

/**
 * Tokenise just enough Rust: identifiers and `# ! [ ] ( )` punctuation.
 * Comments (block comments nest), strings, raw strings, byte/C strings and char
 * literals are skipped; `'a` lifetimes are not mistaken for char literals.
 * Characters that rustc treats as whitespace (U+200E, U+2028, ...) are not
 * identifier characters, so they split words exactly as rustc does.
 */
function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  const skipString = () => {
    // src[i] is the opening quote
    i++;
    while (i < n && src[i] !== '"') {
      if (src[i] === "\\") i++;
      if (src[i] === "\n") line++;
      i++;
    }
    i++;
  };

  const skipRawString = (hashes: number) => {
    // src[i] is the opening quote
    i++;
    const close = '"' + "#".repeat(hashes);
    while (i < n && !src.startsWith(close, i)) {
      if (src[i] === "\n") line++;
      i++;
    }
    i += close.length;
  };

  const readIdent = (): string => {
    const start = i;
    while (i < n) {
      const cp = src.codePointAt(i) ?? 0;
      if (!isIdentPart(cp)) break;
      i += cp > 0xffff ? 2 : 1;
    }
    return src.slice(start, i).normalize("NFC");
  };

  while (i < n) {
    const c = src[i];

    if (c === "\n") {
      line++;
      i++;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (src[i] === "/" && src[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (src[i] === "*" && src[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          if (src[i] === "\n") line++;
          i++;
        }
      }
    } else if (c === '"') {
      skipString();
    } else if (c === "'") {
      // Char literal vs lifetime, the way rustc decides: an escape, or one
      // code point followed by a closing quote, is a literal.
      if (src[i + 1] === "\\") {
        // quote, backslash, then the escaped char (which may itself be a
        // quote); \x41 and \u{..} run on to the closing quote.
        i += 3;
        while (i < n && src[i] !== "'") i++;
        i++;
      } else {
        const cp = String.fromCodePoint(src.codePointAt(i + 1) ?? 0x20);
        if (src[i + 1 + cp.length] === "'") i += 2 + cp.length;
        else i++; // lifetime: the name after it lexes as an ident, harmlessly
      }
    } else if (isIdentStart(src.codePointAt(i) ?? 0)) {
      const pos = i;
      const word = readIdent();

      // String prefixes: r"..", r#".."#, br"..", cr"..", b"..", c"..", b'..'
      if ((word === "r" || word === "br" || word === "cr") && (src[i] === '"' || src[i] === "#")) {
        let hashes = 0;
        let j = i;
        while (src[j] === "#") {
          hashes++;
          j++;
        }
        if (src[j] === '"') {
          i = j;
          skipRawString(hashes);
          continue;
        }
        // r#ident — a raw identifier. Normalise so r#std is still `std`.
        if (word === "r" && hashes === 1 && isIdentStart(src.codePointAt(j) ?? 0)) {
          i = j;
          tokens.push({ kind: "ident", text: readIdent(), line, pos: j });
          continue;
        }
      }
      if ((word === "b" || word === "c") && src[i] === '"') {
        skipString();
        continue;
      }
      if (word === "b" && src[i] === "'") {
        // byte literal: b'x', b'\'', b'\x41'
        i += src[i + 1] === "\\" ? 3 : 2;
        while (i < n && src[i] !== "'") i++;
        i++;
        continue;
      }

      tokens.push({ kind: "ident", text: word, line, pos });
    } else {
      // `!=` is a comparison, not a macro bang.
      const isBang = c === "!" && src[i + 1] !== "=";
      if (c !== "!" ? "#[]()".includes(c) : isBang) {
        tokens.push({ kind: "punct", text: c, line, pos: i });
      }
      i++;
    }
  }
  return tokens;
}

/**
 * Returns every violation, in source order. Empty means the exploit may run.
 * `levelForbid` adds identifiers refused for one level only.
 */
export function scanExploit(
  raw: string,
  levelForbid: readonly string[] = [],
): GuardViolation[] {
  // rustc ignores a leading BOM, so the text it compiles starts after it.
  const source = raw.replace(/^﻿/, "");

  // rustc drops a first line that starts with `#!` unless it opens an inner
  // attribute — and what counts as "opens one" involves skipping comments, so
  // we do not model it: refuse the shape. (`#!/*` hid live code this way.)
  if (/^#!(?!\[)/.test(source)) return [{ token: "#!", line: 1 }];

  const tokens = tokenize(source);
  const extra = new Set(levelForbid);
  const found: (GuardViolation & { pos: number })[] = [];
  const add = (token: string, line: number, pos: number) =>
    found.push({ token, line, pos });

  // Depth of the innermost open `#[ ... ]` (0 = not inside an attribute).
  let attrDepth = 0;

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];

    if (t.kind === "punct") {
      if (t.text === "[") {
        const prev = tokens[k - 1];
        const prev2 = tokens[k - 2];
        const opensAttr =
          prev?.kind === "punct" &&
          (prev.text === "#" || (prev.text === "!" && prev2?.kind === "punct" && prev2.text === "#"));
        if (opensAttr || attrDepth > 0) attrDepth++;
      } else if (t.text === "]" && attrDepth > 0) {
        attrDepth--;
      }
      continue;
    }

    const next = tokens[k + 1];
    const isMacroCall = next?.kind === "punct" && next.text === "!";

    if (
      FORBIDDEN_IDENTS.has(t.text) ||
      extra.has(t.text) ||
      (isMacroCall && FORBIDDEN_MACROS.has(t.text)) ||
      (attrDepth > 0 && FORBIDDEN_ATTR_IDENTS.has(t.text))
    ) {
      add(t.text, t.line, t.pos);
    }
  }

  // Raw pass, independent of the lexer above.
  for (const m of source.matchAll(RAW_WORDS)) {
    const pos = m.index ?? 0;
    add(m[1], source.slice(0, pos).split("\n").length, pos);
  }

  // One entry per (token, line), in source order.
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.pos - b.pos)
    .filter((v) => {
      const key = `${v.token}@${v.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ token, line }) => ({ token, line }));
}
