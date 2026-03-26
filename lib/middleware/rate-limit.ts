// MEDIUM FIX: Rate limiting middleware
// Simple in-memory rate limiting for APIs

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number }
}

const store: RateLimitStore = {}

/**
 * Simple rate limiter
 * Tracks requests by IP or identifier
 * Returns true if request should be allowed
 */
export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now()
  const record = store[identifier]

  if (!record || now > record.resetTime) {
    // Reset or create new record
    store[identifier] = {
      count: 1,
      resetTime: now + windowMs
    }
    return true
  }

  if (record.count < limit) {
    record.count++
    return true
  }

  return false
}

/**
 * Get rate limit info for an identifier
 */
export function getRateLimitInfo(identifier: string) {
  const record = store[identifier]
  if (!record) {
    return { remaining: 100, resetTime: Date.now() + 60000 }
  }

  return {
    remaining: Math.max(0, 100 - record.count),
    resetTime: record.resetTime
  }
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanupRateLimit() {
  const now = Date.now()
  for (const [key, value] of Object.entries(store)) {
    if (now > value.resetTime) {
      delete store[key]
    }
  }
}

// Run cleanup every 5 minutes
if (typeof global !== 'undefined' && !global.__ratelimitCleanupScheduled) {
  global.__ratelimitCleanupScheduled = true
  setInterval(cleanupRateLimit, 5 * 60 * 1000)
}
