// lib/rate-limit.ts
// Simple in-memory rate limiter for API routes (resets on redeploy)

const requests = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requests) {
    if (now > value.resetAt) requests.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  ip: string,
  { maxRequests = 30, windowMs = 60_000 } = {},
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining };
}
