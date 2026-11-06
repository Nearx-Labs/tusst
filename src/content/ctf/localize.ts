import type { CtfLevel } from "./types";

// Translated copy for one Gauntlet level. The level module stays the English
// source of truth; a locale overlay replaces only prose, never the executable
// pieces (files, starter, harness, flag). Same shape as the labs overlay so
// the content/i18n split is familiar.

export interface CtfTextOverlay {
  title?: string;
  tagline?: string;
  story?: string;
  brief?: string;
  hints?: string[];
}

/** Overlay translated prose; everything the sandbox runs stays untouched. */
export function localizeCtfLevel(
  level: CtfLevel,
  overlay?: CtfTextOverlay,
): CtfLevel {
  if (!overlay) return level;
  return {
    ...level,
    title: overlay.title ?? level.title,
    tagline: overlay.tagline ?? level.tagline,
    story: overlay.story ?? level.story,
    brief: overlay.brief ?? level.brief,
    hints: overlay.hints ?? level.hints,
  };
}
