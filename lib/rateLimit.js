// Simple in-memory rate limiter for API routes.
// 100 requests per minute per IP address.
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

const ipRequestMap = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestMap) {
    if (now - data.windowStart > WINDOW_MS) {
      ipRequestMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit check for API routes.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const clientIp = ip || "unknown";

  let data = ipRequestMap.get(clientIp);

  if (!data || now - data.windowStart > WINDOW_MS) {
    data = { windowStart: now, count: 0 };
    ipRequestMap.set(clientIp, data);
  }

  data.count++;

  const remaining = Math.max(0, MAX_REQUESTS - data.count);
  const resetAt = data.windowStart + WINDOW_MS;

  return {
    allowed: data.count <= MAX_REQUESTS,
    remaining,
    resetAt,
  };
}

/**
 * Create a rate-limited NextResponse for rejected requests.
 */
export function rateLimitResponse(resetAt) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(MAX_REQUESTS),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
