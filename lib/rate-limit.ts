/**
 * In-memory sliding-window rate limiter
 *
 * Keyed by arbitrary string (e.g. IP, API key, nodeId).
 * No external dependencies — suitable for single-instance deployments.
 * For multi-instance (e.g. behind a load balancer), swap to Redis-backed implementation.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs * 2
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // Allow Node.js to exit even if timer is active
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Requests used in the current window */
  current: number
  /** Maximum requests allowed */
  limit: number
  /** Milliseconds until the oldest request in the window expires */
  retryAfterMs: number
}

/**
 * Check if a request identified by `key` is within the rate limit.
 * Returns whether the request is allowed and relevant headers info.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  ensureCleanup(config.windowMs)

  const now = Date.now()
  const windowStart = now - config.windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + config.windowMs - now
    return {
      allowed: false,
      current: entry.timestamps.length,
      limit: config.maxRequests,
      retryAfterMs: Math.max(0, retryAfterMs),
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    current: entry.timestamps.length,
    limit: config.maxRequests,
    retryAfterMs: 0,
  }
}
