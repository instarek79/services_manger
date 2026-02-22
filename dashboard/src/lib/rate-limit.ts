const rateMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // per window per IP

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetTime) {
      rateMap.delete(ip);
    }
  }
}, 300_000);
