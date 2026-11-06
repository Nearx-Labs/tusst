import Link from "next/link";
import type { CtfLevel } from "@/content/ctf/types";
import type { Messages } from "@/i18n/messages/en";
import { fmt } from "@/i18n/format";
import { XP_CTF } from "@/lib/xp";

// Server component: one level on the Gauntlet index. Only safe level fields
// are passed in — the hidden harness, flag and reference never reach here.
export function CtfCard({
  level,
  solved,
  m,
}: {
  level: Pick<
    CtfLevel,
    "slug" | "title" | "tagline" | "difficulty" | "estMinutes"
  >;
  solved: boolean;
  m: Messages["ctf"];
}) {
  return (
    <Link href={`/ctf/${level.slug}`} className="block h-full">
      <div className="sc-door flex h-full gap-4 rounded-2xl border border-accent2/25 bg-bg/70 p-5 backdrop-blur transition hover:border-accent2/60">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-accent2/30 bg-[radial-gradient(70%_70%_at_50%_40%,rgba(69,214,196,0.16),transparent_75%)] text-3xl">
          <span aria-hidden>⚔</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold tracking-wide text-fg">
              {level.title}
            </h3>
            {solved && (
              <span className="rounded-full border border-pop/50 bg-pop/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-pop">
                {m.card.solved}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted2">
            {level.tagline}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <span>{m.difficulty[level.difficulty]}</span>
            <span>{fmt(m.card.minutes, { minutes: level.estMinutes })}</span>
            <span className="text-gold/80">
              {fmt(m.card.xp, { xp: XP_CTF[level.difficulty] })}
            </span>
            <span className="ml-auto text-accent2">
              {solved ? m.card.replay : m.card.start} →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
