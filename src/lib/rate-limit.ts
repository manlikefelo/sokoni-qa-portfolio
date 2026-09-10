/**
 * Fixed-window rate limiter held in process memory. Adequate for a single-node
 * deployment and for the test environment; a multi-node deployment would move
 * this to Redis behind the same interface.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function checkRateLimit(
  key: string,
  max: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: max - 1 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: max - existing.count };
}

/** Clears a bucket after a successful attempt so honest users are not punished. */
export function resetRateLimit(key: string): void {
  windows.delete(key);
}

/** Test-only escape hatch used by the suite to keep specs order-independent. */
export function clearAllRateLimits(): void {
  windows.clear();
}
