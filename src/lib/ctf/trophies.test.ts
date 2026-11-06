import assert from "node:assert/strict";
import test from "node:test";
import { buildTrophies } from "./trophies";

const levels = [
  { slug: "a", title: "A", difficulty: "novice" as const, flag: "TUSST{a}" },
  { slug: "b", title: "B", difficulty: "adept" as const, flag: "TUSST{b}" },
];

test("only solved levels carry their flag", () => {
  const when = new Date("2026-11-06T10:00:00Z");
  const t = buildTrophies(levels, [{ levelSlug: "a", solvedAt: when }]);
  assert.equal(t[0].flag, "TUSST{a}");
  assert.equal(t[0].solvedAt, when);
  assert.equal(t[1].flag, null, "an unsolved level never exposes its flag");
  assert.equal(t[1].solvedAt, null);
});

test("a solved row without a date still unlocks the flag", () => {
  const t = buildTrophies(levels, [{ levelSlug: "b", solvedAt: null }]);
  assert.equal(t[1].flag, "TUSST{b}");
  assert.equal(t[1].solvedAt, null);
});

test("no progress means no flag anywhere, and extra rows are ignored", () => {
  const t = buildTrophies(levels, [{ levelSlug: "ghost", solvedAt: null }]);
  assert.deepEqual(t.map((x) => x.flag), [null, null]);
  assert.equal(t.length, 2);
});

test("the serialized trophies never contain an unsolved flag", () => {
  const t = buildTrophies(levels, [{ levelSlug: "a", solvedAt: null }]);
  assert.equal(JSON.stringify(t).includes("TUSST{b}"), false);
});
