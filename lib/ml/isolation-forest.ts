/**
 * Simplified Isolation Forest — TypeScript implementation
 * Used as fallback when Python ML is not available
 */

const IF_N_TREES = 20
const IF_MAX_DEPTH = 10
const IF_SUBAMPLE = 256

/**
 * Single isolation tree: random splits, path length = number of edges to isolate point
 */
function isolationTreePathLength(
  point: number[],
  data: number[][],
  depth: number,
  maxDepth: number
): number {
  if (data.length <= 1 || depth >= maxDepth) return depth

  const dim = point.length
  const col = Math.floor(Math.random() * dim)
  const values = data.map((row) => row[col]).filter((v) => v != null)
  if (values.length < 2) return depth

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return depth

  const split = min + Math.random() * (max - min)
  const left: number[][] = []
  const right: number[][] = []
  for (const row of data) {
    if (row[col] < split) left.push(row)
    else right.push(row)
  }

  const goLeft = point[col] < split
  const child = goLeft ? left : right
  return 1 + isolationTreePathLength(point, child, depth + 1, maxDepth)
}

/**
 * c(n) normalizing constant for Isolation Forest
 */
function c(n: number): number {
  if (n <= 1) return 0
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n
}

/**
 * Isolation Forest anomaly score per row (0 = normal, 1 = anomaly)
 * data: rows of [temperature, humidity] (or more features)
 */
export function isolationForestScores(data: number[][]): number[] {
  if (data.length === 0) return []
  const n = Math.min(data.length, IF_SUBAMPLE)
  const scores: number[] = []

  for (let i = 0; i < data.length; i++) {
    const point = data[i]
    let pathSum = 0
    for (let t = 0; t < IF_N_TREES; t++) {
      const idx = Array.from({ length: data.length }, (_, j) => j)
      for (let k = idx.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [idx[k], idx[j]] = [idx[j], idx[k]]
      }
      const sample = idx.slice(0, n).map((j) => data[j])
      const path = isolationTreePathLength(point, sample, 0, IF_MAX_DEPTH)
      pathSum += path
    }
    const avgPath = pathSum / IF_N_TREES
    const score = Math.pow(2, -avgPath / c(n))
    scores.push(Math.min(1, Math.max(0, score)))
  }
  return scores
}
