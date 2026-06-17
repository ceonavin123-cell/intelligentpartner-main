// ============================================================
// RATE LIMITER — In-memory per-user rate limiting
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) {
    if (now > entry.resetAt) limits.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 },
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    limits.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    const resetIn = entry.resetAt - now;
    return { allowed: false, remaining: 0, resetIn };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

// Pre-configured rate limits for different endpoints
export const RATE_LIMITS = {
  chat: { windowMs: 60_000, maxRequests: 20 },      // 20 messages per minute
  auth: { windowMs: 60_000, maxRequests: 5 },        // 5 login attempts per minute
  upload: { windowMs: 60_000, maxRequests: 10 },     // 10 uploads per minute
  report: { windowMs: 300_000, maxRequests: 5 },     // 5 reports per 5 minutes
  default: { windowMs: 60_000, maxRequests: 30 },    // 30 requests per minute
} as const;
