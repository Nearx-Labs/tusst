export type ReadJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<ReadJsonResult> {
  const declared = req.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim())) {
    if (Number(declared) > maxBytes) return { ok: false, reason: "too_large" };
  }

  if (!req.body) return { ok: false, reason: "invalid_json" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (total === 0) return { ok: false, reason: "invalid_json" };

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8").decode(merged);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
