import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ctfLevelBySlug, ctfLevels } from "@/content/ctf";
import { ctfTextFor } from "@/content/ctf/i18n";
import { localizeCtfLevel } from "@/content/ctf/localize";
import { CtfPlayer } from "@/components/ctf/CtfPlayer";
import { SceneRoot } from "@/components/scene/SceneRoot";
import { getLocale } from "@/i18n/server";
import { XP_CTF } from "@/lib/xp";

// One CTF level. The page reads the server-only level module, overlays the
// requested locale's prose, and passes only the visible project, the starter
// exploit and the brief to the client player. `harness`, `reference` and
// `flag` never cross this boundary.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const level = ctfLevelBySlug(slug);
  if (!level) return {};
  const localized = localizeCtfLevel(level, ctfTextFor(await getLocale(), slug));
  return {
    title: `${localized.title} — TUSST`,
    description: localized.tagline,
  };
}

export default async function CtfLevelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const level = ctfLevelBySlug(slug);
  if (!level) notFound();

  const locale = await getLocale();
  const localized = localizeCtfLevel(level, ctfTextFor(locale, slug));

  // Solved levels drive the progress bar and checkmarks in the side list.
  const userId = (await auth())?.user?.id;
  const solvedRows = userId
    ? await prisma.ctfProgress
        .findMany({
          where: { userId, solved: true },
          select: { levelSlug: true },
        })
        // progress is decoration here: never let it take the level down
        .catch((): { levelSlug: string }[] => [])
    : [];
  const solved = new Set(solvedRows.map((row) => row.levelSlug));
  const levels = ctfLevels.map((l) => ({
    slug: l.slug,
    title: localizeCtfLevel(l, ctfTextFor(locale, l.slug)).title,
    solved: solved.has(l.slug),
  }));

  return (
    <SceneRoot id="gauntlet-level">
      {/* 140px = nav (57) + app footer (82), same accounting as the lab player. */}
      <section
        data-scene
        className="sc-scene sc-scene--lab min-h-[calc(100dvh-140px)]"
      >
        <CtfPlayer
          slug={localized.slug}
          levels={levels}
          title={localized.title}
          difficulty={localized.difficulty}
          story={localized.story}
          brief={localized.brief}
          hints={localized.hints}
          files={localized.files}
          starter={localized.starter}
          xp={XP_CTF[localized.difficulty]}
        />
      </section>
    </SceneRoot>
  );
}
