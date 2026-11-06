"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Markdown } from "@/components/Markdown";
import { CopyFlagButton } from "@/components/ctf/CopyFlagButton";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { XpAwardOutcome } from "@/lib/xp";
import type { SorobanFileMap } from "@/lib/soroban/types";
import type { CtfDifficulty } from "@/content/ctf/types";

// The player for one CTF level. The browser only ever holds the visible
// project + the starter exploit; the hidden test is assembled server-side by
// /api/ctf/run and never travels down.

type RunStatus = "idle" | "running" | "solved" | "fail" | "error";

const EXPLOIT = "src/exploit.rs";
// Scales with the window so the toolbar, editor and output fit one screen.
const EDITOR_HEIGHT = "clamp(260px, 52dvh, 680px)";
const draftKey = (slug: string) => `tusst:ctf:${slug}`;

function languageFor(path: string): string {
  if (path.endsWith(".rs")) return "rust";
  if (path.endsWith(".toml")) return "ini";
  return "plaintext";
}

interface LevelStub {
  slug: string;
  title: string;
  solved: boolean;
}

interface CtfPlayerProps {
  slug: string;
  levels: LevelStub[];
  title: string;
  difficulty: CtfDifficulty;
  story: string;
  brief: string;
  hints: string[];
  files: SorobanFileMap;
  starter: string;
  xp: number;
}

/** Split the brief at its "## " headings so each section can fold. */
function briefSections(brief: string): { heading: string; body: string }[] {
  return brief
    .split(/^## /m)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [heading, ...rest] = chunk.split("\n");
      return { heading: heading.trim(), body: rest.join("\n").trim() };
    });
}

interface WinResult {
  flag: string;
  xp: XpAwardOutcome | null;
}

export function CtfPlayer({
  slug,
  levels,
  title,
  difficulty,
  story,
  brief,
  hints,
  files,
  starter,
  xp,
}: CtfPlayerProps) {
  const m = useMessages();
  const [code, setCode] = useState(() => {
    if (typeof window === "undefined") return starter;
    try {
      return window.localStorage.getItem(draftKey(slug)) ?? starter;
    } catch {
      return starter;
    }
  });
  const [activeFile, setActiveFile] = useState(EXPLOIT);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [output, setOutput] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<WinResult | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);

  const codeRef = useRef(code);
  const inFlightRef = useRef(false);
  const runIdRef = useRef(0);

  const fileOrder = useMemo(
    () => [EXPLOIT, ...Object.keys(files).filter((path) => path !== EXPLOIT)],
    [files],
  );
  const isExploit = activeFile === EXPLOIT;
  const editorValue = isExploit ? code : (files[activeFile] ?? "");

  const onChange = useCallback(
    (value: string) => {
      setCode(value);
      codeRef.current = value;
      try {
        window.localStorage.setItem(draftKey(slug), value);
      } catch {
        // private mode / quota — the draft is a convenience, not a promise
      }
    },
    [slug],
  );

  const run = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const runId = ++runIdRef.current;
    const fresh = () => runId === runIdRef.current;

    setStatus("running");
    setMessage("");
    setOutput([]);
    setResult(null);

    try {
      const res = await fetch("/api/ctf/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, exploit: codeRef.current }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        solved?: boolean;
        flag?: string;
        output?: unknown;
        rejected?: { token?: unknown; line?: unknown }[];
        timedOut?: boolean;
        infraError?: boolean;
        xp?: XpAwardOutcome | null;
      } | null;
      if (!fresh()) return;

      if (!res.ok || !data) {
        setStatus("error");
        setMessage(data?.error ?? m.ctf.player.infraError);
        return;
      }

      if (Array.isArray(data.output)) {
        setOutput(data.output.filter((line): line is string => typeof line === "string"));
      }

      if (data.solved) {
        setStatus("solved");
        setResult({
          flag: data.flag ?? "",
          xp: data.xp ?? null,
        });
        return;
      }

      const blocked = data.rejected?.[0];
      if (blocked && typeof blocked.token === "string") {
        // The guard stopped the run before the sandbox: nothing to read in the
        // output pane, so say exactly what to remove.
        setStatus("fail");
        setMessage(
          fmt(m.ctf.player.rejected, {
            token: blocked.token,
            line: typeof blocked.line === "number" ? blocked.line : "?",
          }),
        );
        return;
      }

      if (data.timedOut) {
        setStatus("error");
        setMessage(m.ctf.player.timedOut);
        return;
      }
      if (data.infraError) {
        setStatus("error");
        setMessage(m.ctf.player.infraError);
        return;
      }
      setStatus("fail");
      setMessage(m.ctf.player.failed);
    } catch {
      if (fresh()) {
        setStatus("error");
        setMessage(m.ctf.player.infraError);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [m, slug]);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const onMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme("tusst", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0d0d14",
        "editorGutter.background": "#0d0d14",
      },
    });
    monaco.editor.setTheme("tusst");
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      runRef.current(),
    );
  }, []);

  const reset = useCallback(() => {
    setCode(starter);
    codeRef.current = starter;
    try {
      window.localStorage.removeItem(draftKey(slug));
    } catch {
      // ignore
    }
    setStatus("idle");
    setOutput([]);
    setMessage("");
    setResult(null);
  }, [slug, starter]);

  const revealNextHint = () =>
    setRevealedHints((count) => Math.min(hints.length, count + 1));

  const solved = status === "solved" && result !== null;
  const cleared = solved || levels.some((l) => l.slug === slug && l.solved);
  const solvedCount = levels.filter(
    (l) => l.solved || (solved && l.slug === slug),
  ).length;
  const sections = briefSections(brief);

  const statusLabel =
    status === "running"
      ? m.ctf.player.running
      : status === "solved"
        ? m.ctf.player.solved
        : status === "error"
          ? m.ctf.player.error
          : "";
  const statusTone =
    status === "solved"
      ? "bg-pop"
      : status === "fail" || status === "error"
        ? "bg-red-400"
        : status === "running"
          ? "animate-pulse bg-accent2"
          : "bg-muted/40";

  return (
    <div className="mx-auto w-full max-w-[112rem] px-5 pb-24 pt-8 2xl:px-10">
      <Link
        href="/ctf"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition hover:text-fg"
      >
        ← {m.ctf.player.back}
      </Link>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1.15fr)] 2xl:grid-cols-[15rem_minmax(0,1.1fr)_minmax(0,1.2fr)]">
        {/* the gauntlet at a glance: progress and a jump list (wide screens) */}
        <aside className="sticky top-20 hidden xl:block">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-accent2">
            {m.ctf.kicker}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-pop transition-all"
              style={{ width: `${(solvedCount / Math.max(1, levels.length)) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.18em] text-muted">
            {solvedCount} / {levels.length}
          </p>
          <nav className="mt-4 flex flex-col gap-1">
            {levels.map((level) => {
              const current = level.slug === slug;
              const done = level.solved || (current && solved);
              return (
                <Link
                  key={level.slug}
                  href={`/ctf/${level.slug}`}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                    current
                      ? "bg-accent2/10 text-fg"
                      : "text-muted2 hover:bg-bg-elev hover:text-fg"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                      done
                        ? "border-pop/60 bg-pop/15 text-pop"
                        : current
                          ? "border-accent2/60 bg-accent2/15 text-accent2"
                          : "border-line text-transparent"
                    }`}
                  >
                    {done ? "✓" : current ? "▶" : "·"}
                  </span>
                  <span className="min-w-0 truncate">{level.title}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* story, brief and hints: one card, read top to bottom */}
        <section className="overflow-hidden rounded-2xl border border-line bg-bg/70 backdrop-blur">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${cleared ? "bg-pop" : "bg-accent2"}`}
            />
            <span className={cleared ? "text-pop" : "text-muted"}>
              {cleared ? m.ctf.player.solved : m.ctf.difficulty[difficulty]}
            </span>
          </div>

          <div className="p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
              <span aria-hidden>★</span>
              {fmt(m.ctf.card.xp, { xp })}
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-wide text-fg">
              {title}
            </h1>
            <div className="mt-3 text-muted2">
              <Markdown>{story}</Markdown>
            </div>
          </div>

          {sections.map((section, index) => (
            <details
              key={section.heading}
              open={index < 3}
              className="group border-t border-line px-5 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-[15px] font-bold tracking-wide text-accent2 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="text-xs transition-transform group-open:rotate-90"
                >
                  ›
                </span>
                {section.heading}
              </summary>
              <div className="mt-2 pl-4">
                <Markdown>{section.body}</Markdown>
              </div>
            </details>
          ))}

          {hints.length > 0 && (
            <details className="group border-t border-line px-5 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-line px-4 py-2.5 font-display text-[14px] font-bold tracking-wide text-fg [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden>💡</span>
                  {m.ctf.player.hints}
                  <span className="font-mono text-[11px] font-normal text-muted">
                    {revealedHints}/{hints.length}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-xs text-muted transition-transform group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              {revealedHints > 0 && (
                <ol className="mt-3 flex flex-col gap-3">
                  {hints.slice(0, revealedHints).map((hint, index) => (
                    <li
                      key={index}
                      className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                        {index + 1}
                      </span>
                      <Markdown>{hint}</Markdown>
                    </li>
                  ))}
                </ol>
              )}
              {revealedHints < hints.length && (
                <button
                  type="button"
                  onClick={revealNextHint}
                  className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-1.5 font-mono text-[11px] text-accent transition hover:bg-accent/20"
                >
                  {fmt(m.ctf.player.hint, { n: revealedHints + 1 })}
                </button>
              )}
            </details>
          )}
        </section>

        {/* editor + output: stays in view while the brief scrolls. Released
            once solved so the flag card below it is reachable. */}
        <div
          className={`flex flex-col gap-4 ${
            solved ? "" : "lg:sticky lg:top-20"
          }`}
        >
          <section className="overflow-hidden rounded-2xl border border-line bg-bg-elev">
            <div className="border-b border-line bg-bg/60 px-2 py-1.5">
              <div
                role="tablist"
                className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
              >
                {fileOrder.map((path) => {
                  const active = path === activeFile;
                  return (
                    <button
                      key={path}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveFile(path)}
                      className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[10.5px] transition ${
                        active
                          ? "bg-accent/15 text-accent"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      {path}
                      {path !== EXPLOIT && (
                        <span
                          title={m.ctf.player.locked}
                          className="ml-1.5 text-[9px] opacity-60"
                        >
                          <span aria-hidden>🔒</span>
                          <span className="sr-only">{m.ctf.player.locked}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Editor
              height={EDITOR_HEIGHT}
              path={activeFile}
              language={languageFor(activeFile)}
              value={editorValue}
              onChange={isExploit ? (value) => onChange(value ?? "") : undefined}
              onMount={onMount}
              theme="vs-dark"
              loading={
                <div
                  className="grid w-full place-items-center font-mono text-xs text-muted"
                  style={{ height: EDITOR_HEIGHT }}
                >
                  {m.lesson.loadingEditor}
                </div>
              }
              options={{
                readOnly: !isExploit,
                domReadOnly: !isExploit,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 22,
                scrollBeyondLastLine: false,
                tabSize: 4,
                padding: { top: 14 },
                automaticLayout: true,
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
              }}
            />
          </section>

          <section className="rounded-2xl border border-line bg-bg-elev">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2">
              <span
                aria-live="polite"
                className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted"
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${statusTone}`}
                />
                <span className="truncate uppercase tracking-wider">
                  {statusLabel || m.ctf.player.output}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={status === "running"}
                  className="rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:text-fg disabled:opacity-50"
                >
                  {m.ctf.player.reset}
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={status === "running"}
                  title="Ctrl/⌘ + Enter"
                  className="rounded-md border border-accent/40 bg-accent/10 px-4 py-1 font-mono text-[11px] text-accent transition hover:bg-accent/20 disabled:opacity-50"
                >
                  {status === "running" ? m.ctf.player.running : m.ctf.player.run}
                </button>
              </div>
            </div>
            {message && (
              <p
                role="status"
                className="border-b border-line px-4 py-2 font-mono text-[11.5px] text-red-300"
              >
                {message}
              </p>
            )}
            <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-muted2">
              {output.length > 0 ? output.join("\n") : m.ctf.player.noOutput}
            </pre>
          </section>

          {solved && result && (
            <section className="rounded-2xl border border-pop/50 bg-pop/10 p-5 shadow-[0_0_32px_-12px_var(--color-pop)]">
              <div className="flex items-center gap-4">
                <span className="text-4xl" aria-hidden>
                  🚩
                </span>
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold uppercase tracking-wide text-pop">
                    {m.ctf.player.solved}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted2">
                    {m.ctf.player.flagHint}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-pop/40 bg-bg/70 px-4 py-3">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                    {m.ctf.player.flagLabel}
                  </span>
                  <p className="mt-1 break-all font-mono text-sm text-pop">
                    {result.flag}
                  </p>
                </div>
                <CopyFlagButton
                  flag={result.flag}
                  label={m.ctf.player.copy}
                  copiedLabel={m.ctf.player.copied}
                />
              </div>

              {result.xp ? (
                <div className="mt-4 font-mono text-[12px] text-muted2">
                  <p className="text-gold">
                    {result.xp.awarded
                      ? fmt(m.ctf.player.xpEarned, { xp: result.xp.earned })
                      : m.ctf.player.already}
                  </p>
                  <p className="mt-1">
                    {fmt(m.ctf.player.xpTotal, { xp: result.xp.total })}
                  </p>
                  {result.xp.leveledUp && (
                    <p className="mt-1 text-accent">
                      {fmt(m.ctf.player.levelUp, { level: result.xp.level })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-[12.5px] text-muted2">
                  {m.ctf.player.signInToClaim}{" "}
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(`/ctf/${slug}`)}`}
                    className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                  >
                    {m.ctf.player.signIn}
                  </Link>
                </p>
              )}

              <Link
                href="/ctf"
                className="mt-5 inline-block rounded-full border border-pop/50 bg-pop/10 px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-pop transition hover:bg-pop/20"
              >
                {m.ctf.player.back}
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
