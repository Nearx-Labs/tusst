import Link from "next/link";
import type { Messages } from "@/i18n/messages/en";
import { fmt } from "@/i18n/format";
import { XP_CTF } from "@/lib/xp";
import type { Trophy } from "@/lib/ctf/trophies";
import { CopyFlagButton } from "./CopyFlagButton";

// The profile's shelf of collected CTF flags. Server component: it receives
// the safe Trophy view, where a flag exists only for a level already solved.
export function CtfTrophies({
  trophies,
  locale,
  m,
}: {
  trophies: Trophy[];
  locale: string;
  m: Messages["ctf"];
}) {
  const solvedCount = trophies.filter((t) => t.flag !== null).length;
  const percent = (solvedCount / Math.max(1, trophies.length)) * 100;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          {m.trophies.heading}
        </p>
        <span className="font-mono text-[11px] text-muted">
          {solvedCount} / {trophies.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-pop transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {trophies.map((trophy) => {
          const solved = trophy.flag !== null;
          return (
            <li key={trophy.slug}>
              <div
                className={`flex h-full flex-col gap-3 rounded-2xl border px-4 py-4 ${
                  solved
                    ? "border-pop/40 bg-pop/5"
                    : "border-line bg-bg-elev opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className="text-2xl">
                    {solved ? "🚩" : "🔒"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/ctf/${trophy.slug}`}
                      className="block truncate font-display text-sm font-bold tracking-wide text-fg transition hover:text-accent2"
                    >
                      {trophy.title}
                    </Link>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {m.difficulty[trophy.difficulty]} ·{" "}
                      {fmt(m.card.xp, { xp: XP_CTF[trophy.difficulty] })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg/70 px-3 py-2">
                  <code
                    className={`min-w-0 break-all font-mono text-[12px] ${
                      solved ? "text-pop" : "text-muted"
                    }`}
                  >
                    {trophy.flag ?? "TUSST{••••••••}"}
                  </code>
                  {trophy.flag && (
                    <CopyFlagButton
                      flag={trophy.flag}
                      label={m.player.copy}
                      copiedLabel={m.player.copied}
                    />
                  )}
                </div>

                <p className="font-mono text-[10px] text-muted">
                  {solved && trophy.solvedAt
                    ? fmt(m.trophies.solvedOn, {
                        date: trophy.solvedAt.toLocaleDateString(locale, {
                          dateStyle: "medium",
                        }),
                      })
                    : solved
                      ? m.card.solved
                      : m.trophies.locked}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
