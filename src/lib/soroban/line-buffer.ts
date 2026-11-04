import { StringDecoder } from "node:string_decoder";

export const MAX_LINE_BYTES = 64 * 1024;
export const MAX_RAW_OUTPUT_BYTES = 16 * 1024 * 1024;

export type LineSplitterOptions = {
  maxLineBytes: number;
  maxTotalBytes: number;
  onLine: (line: string) => void;
  onOverlongLine: () => void;
  onTotalExceeded: () => void;
  isLineLimitExempt?: () => boolean;
};

export function createLineSplitter(opts: LineSplitterOptions) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let pendingBytes = 0;
  let discarding = false;
  let total = 0;
  let stopped = false;

  const emit = (line: string) => {
    opts.onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
  };

  const append = (text: string) => {
    if (text.length === 0) return;
    const exempt = opts.isLineLimitExempt?.() === true;
    if (discarding && !exempt) return;
    const bytes = Buffer.byteLength(text, "utf8");
    if (!exempt && pendingBytes + bytes > opts.maxLineBytes) {
      const room = Math.max(0, opts.maxLineBytes - pendingBytes);
      const kept = Buffer.from(text, "utf8").subarray(0, room);
      const keptText = new StringDecoder("utf8").write(kept);
      pending += keptText;
      pendingBytes += Buffer.byteLength(keptText, "utf8");
      discarding = true;
      opts.onOverlongLine();
      return;
    }
    pending += text;
    pendingBytes += bytes;
  };

  const finishLine = () => {
    const line = pending;
    pending = "";
    pendingBytes = 0;
    discarding = false;
    emit(line);
  };

  const feed = (text: string) => {
    let start = 0;
    while (!stopped) {
      const nl = text.indexOf("\n", start);
      if (nl === -1) {
        append(text.slice(start));
        return;
      }
      append(text.slice(start, nl));
      if (stopped) return;
      finishLine();
      start = nl + 1;
    }
  };

  return {
    push(chunk: Buffer): void {
      if (stopped) return;
      total += chunk.length;
      if (total > opts.maxTotalBytes) {
        stopped = true;
        pending = "";
        pendingBytes = 0;
        opts.onTotalExceeded();
        return;
      }
      feed(decoder.write(chunk));
    },
    flush(): void {
      if (stopped) return;
      stopped = true;
      append(decoder.end());
      if (pending.length > 0) emit(pending);
      pending = "";
      pendingBytes = 0;
    },
  };
}
