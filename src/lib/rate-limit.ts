/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per IP address.
 */

const windowMs = 60_000; // 1 minute window

const ipHits = new Map<string, number[]>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipHits) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, valid);
  }
}, 300_000);

export function rateLimit(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const timestamps = ipHits.get(ip) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= maxRequests) {
    return false; // rate limited
  }

  valid.push(now);
  ipHits.set(ip, valid);
  return true; // allowed
}
