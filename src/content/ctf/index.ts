import "server-only";

import { openGate } from "./levels/open-gate";
import { secondComing } from "./levels/second-coming";
import { borrowedBadge } from "./levels/borrowed-badge";
import { negativeSpace } from "./levels/negative-space";
import { dustMill } from "./levels/dust-mill";
import { forgottenLedger } from "./levels/forgotten-ledger";
import type { CtfLevel } from "./types";

// The Gauntlet catalog. Adding a level is a content module + one entry here.
// Server-only: levels carry the hidden harness, the flag and the reference
// exploit, so this module must never be imported by a client component.
export const ctfLevels: CtfLevel[] = [
  openGate,
  secondComing,
  borrowedBadge,
  negativeSpace,
  dustMill,
  forgottenLedger,
];

export function ctfLevelBySlug(slug: string): CtfLevel | undefined {
  return ctfLevels.find((level) => level.slug === slug);
}

export type { CtfDifficulty, CtfLevel } from "./types";
