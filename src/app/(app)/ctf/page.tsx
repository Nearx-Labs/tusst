import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ctfLevels } from "@/content/ctf";
import { ctfTextFor } from "@/content/ctf/i18n";
import { localizeCtfLevel } from "@/content/ctf/localize";
import { getLocale, getMessages } from "@/i18n/server";
import { SceneRoot } from "@/components/scene/SceneRoot";
import { SceneParticles } from "@/components/scene/SceneParticles";
import { CtfCard } from "@/components/ctf/CtfCard";

// The Gauntlet — the off-chain CTF index. Public like /labs and /ide:
// anonymous heroes can play every level; only the XP claim asks them to
// sign in. The level content is server-only, so this page passes only the
// safe card fields down.

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: m.ctf.metaTitle, description: m.ctf.metaDescription };
}

export default async function CtfPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const [m, locale] = await Promise.all([getMessages(), getLocale()]);

  const solvedRows = userId
    ? await prisma.ctfProgress.findMany({
        where: { userId, solved: true },
        select: { levelSlug: true },
      })
    : [];
  const solved = new Set(solvedRows.map((row) => row.levelSlug));

  return (
    <SceneRoot id="gauntlet-index">
      <section
        data-scene
        className="sc-scene sc-scene--hall min-h-[calc(100dvh-56px)]"
      >
        <div className="sc-scrim" />
        <SceneParticles tone="hall" />

        <div className="relative mx-auto w-full max-w-5xl px-5 pb-24 pt-14">
          <div data-reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-accent2/90">
              {m.ctf.kicker}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-wide text-[#f4f2fb] sm:text-5xl">
              {m.ctf.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted2">
              {m.ctf.intro}
            </p>
          </div>

          <p
            data-reveal="2"
            className="mt-12 font-mono text-[11px] uppercase tracking-[0.3em] text-muted"
          >
            {m.ctf.liveHeading}
          </p>
          <div data-reveal="3" className="mt-4 grid gap-5 md:grid-cols-2">
            {ctfLevels.map((level) => {
              const localized = localizeCtfLevel(
                level,
                ctfTextFor(locale, level.slug),
              );
              return (
                <CtfCard
                  key={localized.slug}
                  level={{
                    slug: localized.slug,
                    title: localized.title,
                    tagline: localized.tagline,
                    difficulty: localized.difficulty,
                    estMinutes: localized.estMinutes,
                  }}
                  solved={solved.has(localized.slug)}
                  m={m.ctf}
                />
              );
            })}
          </div>
        </div>
      </section>
    </SceneRoot>
  );
}
