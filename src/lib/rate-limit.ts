import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  anonLimit: number;
  signedLimit: number;
  maxKeys?: number;
}

export interface RateLimiter {
  check(clientKey: string, signedIn: boolean): number | null;
}

const SWEEP_THRESHOLD = 1024;
const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, anonLimit, signedLimit } = options;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const buckets = new Map<string, Bucket>();

  function sweep(now: number): void {
    if (buckets.size < SWEEP_THRESHOLD) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  function evictOldest(): void {
    let excess = buckets.size - maxKeys + 1;
    if (excess <= 0) return;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--excess <= 0) break;
    }
  }

  return {
    check(clientKey, signedIn) {
      const now = Date.now();
      sweep(now);
      const limit = signedIn ? signedLimit : anonLimit;
      const bucket = buckets.get(clientKey);
      if (!bucket || bucket.resetAt <= now) {
        buckets.delete(clientKey);
        evictOldest();
        buckets.set(clientKey, { count: 1, resetAt: now + windowMs });
        return null;
      }
      if (bucket.count < limit) {
        bucket.count++;
        return null;
      }
      return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    },
  };
}

/** Client key for rate limiting: user id when signed in, else best-effort IP. */
export function clientKeyFor(req: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return `ip:${ip}`;
}
