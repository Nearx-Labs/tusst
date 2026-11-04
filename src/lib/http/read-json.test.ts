import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readJsonBody } from "./read-json";

const enc = new TextEncoder();

function streamOf(chunks: Uint8Array[], tracker?: { pulls: number }) {
  let i = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (tracker) tracker.pulls++;
        if (i < chunks.length) controller.enqueue(chunks[i++]);
        else controller.close();
      },
    },
    { highWaterMark: 0 },
  );
}

function streamRequest(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/x", {
    method: "POST",
    body: stream,
    headers,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function textRequest(text: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/x", {
    method: "POST",
    body: text,
    headers,
  });
}

describe("readJsonBody", () => {
  it("parses a valid body", async () => {
    const res = await readJsonBody(textRequest('{"a":1}'), 1024);
    assert.deepEqual(res, { ok: true, value: { a: 1 } });
  });

  it("parses multibyte content split across chunks", async () => {
    const bytes = enc.encode('{"a":"héllo ✓"}');
    const res = await readJsonBody(
      streamRequest(streamOf([bytes.slice(0, 9), bytes.slice(9)])),
      1024,
    );
    assert.deepEqual(res, { ok: true, value: { a: "héllo ✓" } });
  });

  it("rejects invalid JSON", async () => {
    const res = await readJsonBody(textRequest("{nope"), 1024);
    assert.deepEqual(res, { ok: false, reason: "invalid_json" });
  });

  it("rejects an empty body", async () => {
    const res = await readJsonBody(textRequest(""), 1024);
    assert.deepEqual(res, { ok: false, reason: "invalid_json" });
  });

  it("rejects a missing body", async () => {
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await readJsonBody(req, 1024);
    assert.deepEqual(res, { ok: false, reason: "invalid_json" });
  });

  it("rejects a chunked body over the cap without content-length", async () => {
    const tracker = { pulls: 0 };
    const chunk = enc.encode("x".repeat(100));
    const chunks = Array.from({ length: 50 }, () => chunk);
    const req = streamRequest(streamOf(chunks, tracker));
    assert.equal(req.headers.get("content-length"), null);
    const res = await readJsonBody(req, 1000);
    assert.deepEqual(res, { ok: false, reason: "too_large" });
    assert.ok(tracker.pulls < 50);
  });

  it("rejects when content-length lies low and the body is large", async () => {
    const big = enc.encode(JSON.stringify({ a: "x".repeat(5000) }));
    const req = streamRequest(streamOf([big]), { "content-length": "10" });
    assert.equal(req.headers.get("content-length"), "10");
    const res = await readJsonBody(req, 1000);
    assert.deepEqual(res, { ok: false, reason: "too_large" });
  });

  it("rejects a declared content-length over the cap without reading", async () => {
    const tracker = { pulls: 0 };
    const req = streamRequest(streamOf([enc.encode("{}")], tracker), {
      "content-length": "5000",
    });
    const res = await readJsonBody(req, 1000);
    assert.deepEqual(res, { ok: false, reason: "too_large" });
    assert.equal(tracker.pulls, 0);
    assert.equal(req.bodyUsed, false);
  });

  it("accepts a body exactly at the cap", async () => {
    const body = JSON.stringify({ a: "x".repeat(20) });
    const max = enc.encode(body).byteLength;
    const ok = await readJsonBody(textRequest(body), max);
    assert.deepEqual(ok, { ok: true, value: { a: "x".repeat(20) } });
    const over = await readJsonBody(textRequest(body), max - 1);
    assert.deepEqual(over, { ok: false, reason: "too_large" });
  });

  it("treats invalid utf-8 as invalid JSON when it breaks syntax", async () => {
    const res = await readJsonBody(
      streamRequest(streamOf([new Uint8Array([0xff, 0xfe, 0x7b])])),
      1024,
    );
    assert.deepEqual(res, { ok: false, reason: "invalid_json" });
  });
});
