import "server-only";

import type { CtfDifficulty } from "@/content/ctf/types";

// Safe view of the Gauntlet for the profile's trophy shelf. The catalog holds
// every flag, so this is the one place that decides which may leave the
// server: only levels the signed-in user has actually solved.

export interface TrophyLevel {
  slug: string;
  title: string;
  difficulty: CtfDifficulty;
}

export interface Trophy extends TrophyLevel {
  solvedAt: Date | null;
  /** Present ONLY when solved. Never filled for a level still to break. */
  flag: string | null;
}

export function buildTrophies(
  levels: (TrophyLevel & { flag: string })[],
  solvedRows: { levelSlug: string; solvedAt: Date | null }[],
): Trophy[] {
  const solved = new Map(solvedRows.map((r) => [r.levelSlug, r.solvedAt]));
  return levels.map((level) => {
    const isSolved = solved.has(level.slug);
    return {
      slug: level.slug,
      title: level.title,
      difficulty: level.difficulty,
      solvedAt: isSolved ? (solved.get(level.slug) ?? null) : null,
      flag: isSolved ? level.flag : null,
    };
  });
}
