import type { Locale } from "@/i18n/config";
import type { CtfTextOverlay } from "../localize";
import { openGateText as openGateEs } from "./open-gate.es";
import { openGateText as openGateFr } from "./open-gate.fr";
import { openGateText as openGatePt } from "./open-gate.pt";
import { openGateText as openGateTr } from "./open-gate.tr";
import { secondComingText as secondComingEs } from "./second-coming.es";
import { secondComingText as secondComingFr } from "./second-coming.fr";
import { secondComingText as secondComingPt } from "./second-coming.pt";
import { secondComingText as secondComingTr } from "./second-coming.tr";
import { borrowedBadgeText as borrowedBadgeEs } from "./borrowed-badge.es";
import { borrowedBadgeText as borrowedBadgeFr } from "./borrowed-badge.fr";
import { borrowedBadgeText as borrowedBadgePt } from "./borrowed-badge.pt";
import { borrowedBadgeText as borrowedBadgeTr } from "./borrowed-badge.tr";
import { negativeSpaceText as negativeSpaceEs } from "./negative-space.es";
import { negativeSpaceText as negativeSpaceFr } from "./negative-space.fr";
import { negativeSpaceText as negativeSpacePt } from "./negative-space.pt";
import { negativeSpaceText as negativeSpaceTr } from "./negative-space.tr";
import { dustMillText as dustMillEs } from "./dust-mill.es";
import { dustMillText as dustMillFr } from "./dust-mill.fr";
import { dustMillText as dustMillPt } from "./dust-mill.pt";
import { dustMillText as dustMillTr } from "./dust-mill.tr";
import { forgottenLedgerText as forgottenLedgerEs } from "./forgotten-ledger.es";
import { forgottenLedgerText as forgottenLedgerFr } from "./forgotten-ledger.fr";
import { forgottenLedgerText as forgottenLedgerPt } from "./forgotten-ledger.pt";
import { forgottenLedgerText as forgottenLedgerTr } from "./forgotten-ledger.tr";

// Translated level prose, keyed by locale then slug. English lives in the
// level module itself and is the fallback for any missing overlay.
type TranslatedLocale = Exclude<Locale, "en">;

export const CTF_TEXT: Record<
  TranslatedLocale,
  Record<string, CtfTextOverlay>
> = {
  pt: {
    "open-gate": openGatePt,
    "second-coming": secondComingPt,
    "borrowed-badge": borrowedBadgePt,
    "negative-space": negativeSpacePt,
    "dust-mill": dustMillPt,
    "forgotten-ledger": forgottenLedgerPt,
  },
  es: {
    "open-gate": openGateEs,
    "second-coming": secondComingEs,
    "borrowed-badge": borrowedBadgeEs,
    "negative-space": negativeSpaceEs,
    "dust-mill": dustMillEs,
    "forgotten-ledger": forgottenLedgerEs,
  },
  fr: {
    "open-gate": openGateFr,
    "second-coming": secondComingFr,
    "borrowed-badge": borrowedBadgeFr,
    "negative-space": negativeSpaceFr,
    "dust-mill": dustMillFr,
    "forgotten-ledger": forgottenLedgerFr,
  },
  tr: {
    "open-gate": openGateTr,
    "second-coming": secondComingTr,
    "borrowed-badge": borrowedBadgeTr,
    "negative-space": negativeSpaceTr,
    "dust-mill": dustMillTr,
    "forgotten-ledger": forgottenLedgerTr,
  },
};

export function ctfTextFor(
  locale: Locale,
  slug: string,
): CtfTextOverlay | undefined {
  if (locale === "en") return undefined;
  return CTF_TEXT[locale][slug];
}
