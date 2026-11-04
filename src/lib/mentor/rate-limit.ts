import "server-only";

// Mentor quota, counted from MentorHint rows (UTC day). DB-backed on
// purpose: the site runs on serverless where in-memory buckets (like the
// Forge one in src/lib/soroban/rate-limit.ts) reset per instance.
//
// Three fences:
//   - per lesson/day: pedagogy — struggle a little before the next hint;
//   - per user/day:   abuse cap;
//   - global/day:     headroom under the provider's own free-tier quota
//                     (GitHub Models mini models: ~150 requests/day).

import { prisma } from "@/lib/db";
import {
  finalizeMentorReservation,
  peekMentorRemaining,
  releaseMentorReservation,
  reserveMentorQuota,
  type MentorReservation,
  type MentorReservationInput,
} from "@/lib/mentor/quota";

export {
  GLOBAL_DAILY_LIMIT,
  LESSON_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  type MentorReservation,
  type MentorReservationInput,
} from "@/lib/mentor/quota";

// Forge hints pass lessonId null — they only count toward the per-user and
// global fences (the per-lesson cap is a lesson-pedagogy rule).
export function reserveQuota(
  input: MentorReservationInput,
): Promise<MentorReservation> {
  return reserveMentorQuota(prisma, input);
}

export function mentorRemaining(
  userId: string,
  lessonId: string | null,
): Promise<number> {
  return peekMentorRemaining(prisma, userId, lessonId);
}

export function finalizeReservation(id: string, hint: string): Promise<void> {
  return finalizeMentorReservation(prisma, id, hint);
}

export function releaseReservation(id: string): Promise<void> {
  return releaseMentorReservation(prisma, id);
}
