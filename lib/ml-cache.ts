/**
 * ML Prediction Cache
 *
 * In-memory TTL cache for ML prediction results, keyed by nodeId.
 * Prevents redundant Prophet/Holt-Winters computation when multiple
 * dashboard users request predictions for the same node within a short window.
 *
 * TTL: 5 minutes (configurable via ML_CACHE_TTL_MS env var)
 */

import type { PredictionResult } from './types'

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

const TTL_MS = (() => {
  const env = parseInt(process.env.ML_CACHE_TTL_MS ?? '', 10)
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_TTL_MS
})()

interface CacheEntry {
  result: PredictionResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Build a cache key from roomId + nodeId so different nodes in the same room
 * are cached independently.
 */
function cacheKey(roomId: string, nodeId: string): string {
  return `${roomId}::${nodeId}`
}

/**
 * Retrieve a cached prediction result.
 * Returns `null` if the entry is missing or expired.
 */
export function getCachedPrediction(roomId: string, nodeId: string): PredictionResult | null {
  const key = cacheKey(roomId, nodeId)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.result
}

/**
 * Store a prediction result in the cache with the configured TTL.
 */
export function setCachedPrediction(
  roomId: string,
  nodeId: string,
  result: PredictionResult
): void {
  cache.set(cacheKey(roomId, nodeId), {
    result,
    expiresAt: Date.now() + TTL_MS,
  })
}

/**
 * Explicitly invalidate the cache entry for a node (e.g. after new data ingested).
 */
export function invalidatePredictionCache(roomId: string, nodeId: string): void {
  cache.delete(cacheKey(roomId, nodeId))
}

/**
 * Remove all expired entries. Call periodically if memory is a concern.
 */
export function purgeExpiredPredictions(): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key)
  }
}
