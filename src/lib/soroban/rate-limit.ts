import "server-only";

import { clientKeyFor, createRateLimiter } from "../rate-limit";

// Tiny in-process token bucket per client — good for the single-VPS v1.
// build/test/audit share one bucket per client so the sandbox stays scarce.

const WINDOW_MS = 5 * 60 * 1000;
const ANON_LIMIT = 8;
const SIGNED_LIMIT = 20;

const limiter = createRateLimiter({
  windowMs: WINDOW_MS,
  anonLimit: ANON_LIMIT,
  signedLimit: SIGNED_LIMIT,
});

/** Returns null when allowed, or seconds until the bucket resets when not. */
export function checkRateLimit(clientKey: string, signedIn: boolean): number | null {
  return limiter.check(clientKey, signedIn);
}

export { clientKeyFor };
