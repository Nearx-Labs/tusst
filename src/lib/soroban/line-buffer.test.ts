import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLineSplitter } from "./line-buffer";

function setup(
  overrides: Partial<Parameters<typeof createLineSplitter>[0]> = {},
) {
  const lines: string[] = [];
  const state = { overlong: 0, exceeded: 0 };
  const splitter = createLineSplitter({
    maxLineBytes: 64,
    maxTotalBytes: 10_000,
    onLine: (l) => lines.push(l),
    onOverlongLine: () => state.overlong++,
    onTotalExceeded: () => state.exceeded++,
    ...overrides,
  });
  return { lines, state, splitter };
}

const buf = (s: string) => Buffer.from(s, "utf8");

describe("createLineSplitter", () => {
  it("splits normal lines", () => {
    const { lines, splitter } = setup();
    splitter.push(buf("one\ntwo\nthree\n"));
    assert.deepEqual(lines, ["one", "two", "three"]);
  });

  it("strips CRLF", () => {
    const { lines, splitter } = setup();
    splitter.push(buf("one\r\ntwo\r\n"));
    assert.deepEqual(lines, ["one", "two"]);
  });

  it("joins a line split across chunks", () => {
    const { lines, splitter } = setup();
    splitter.push(buf("hel"));
    splitter.push(buf("lo wor"));
    splitter.push(buf("ld\nnext\n"));
    assert.deepEqual(lines, ["hello world", "next"]);
  });

  it("keeps multibyte characters split across chunks intact", () => {
    const { lines, splitter } = setup();
    const bytes = buf("café ✓ 🚀\n");
    for (const b of bytes) splitter.push(Buffer.from([b]));
    assert.deepEqual(lines, ["café ✓ 🚀"]);
  });

  it("truncates an overlong line and warns once", () => {
    const { lines, state, splitter } = setup();
    splitter.push(buf("a".repeat(50)));
    splitter.push(buf("b".repeat(50)));
    splitter.push(buf("c".repeat(500)));
    splitter.push(buf("tail\nafter\n"));
    assert.equal(state.overlong, 1);
    assert.equal(lines.length, 2);
    assert.equal(Buffer.byteLength(lines[0]), 64);
    assert.equal(lines[0], "a".repeat(50) + "b".repeat(14));
    assert.equal(lines[1], "after");
  });

  it("warns once per overlong line", () => {
    const { lines, state, splitter } = setup();
    splitter.push(buf("x".repeat(200) + "\n" + "y".repeat(200) + "\nok\n"));
    assert.equal(state.overlong, 2);
    assert.equal(lines.length, 3);
    assert.equal(lines[2], "ok");
  });

  it("does not split a multibyte character when truncating", () => {
    const { lines, splitter } = setup({ maxLineBytes: 10 });
    splitter.push(buf("✓✓✓✓✓✓\n"));
    assert.equal(lines[0], "✓✓✓");
  });

  it("exempts lines from the cap when requested", () => {
    let exempt = false;
    const lines: string[] = [];
    const { state, splitter } = setup({
      isLineLimitExempt: () => exempt,
      onLine: (l) => {
        lines.push(l);
        if (l === "begin") exempt = true;
        if (l === "end") exempt = false;
      },
    });
    splitter.push(buf("begin\n" + "z".repeat(1000) + "\nend\n"));
    assert.equal(state.overlong, 0);
    assert.equal(lines[1].length, 1000);
    assert.deepEqual([lines[0], lines[2]], ["begin", "end"]);
  });

  it("stops after the total cap and calls the callback once", () => {
    const { lines, state, splitter } = setup({ maxTotalBytes: 20 });
    splitter.push(buf("0123456789\n"));
    splitter.push(buf("0123456789\n"));
    splitter.push(buf("more\n"));
    splitter.push(buf("more\n"));
    splitter.flush();
    assert.equal(state.exceeded, 1);
    assert.deepEqual(lines, ["0123456789"]);
  });

  it("flushes the trailing partial line", () => {
    const { lines, splitter } = setup();
    splitter.push(buf("done\npartial"));
    assert.deepEqual(lines, ["done"]);
    splitter.flush();
    assert.deepEqual(lines, ["done", "partial"]);
  });

  it("flush emits nothing when there is no remainder", () => {
    const { lines, splitter } = setup();
    splitter.push(buf("a\n"));
    splitter.flush();
    assert.deepEqual(lines, ["a"]);
  });
});
