/**
 * Statistical utilities for ML services
 */

/**
 * Calculate mean of array
 */
export function mean(data: number[]): number {
  if (data.length === 0) return 0
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(data: number[], dataMean?: number): number {
  if (data.length === 0) return 1
  const m = dataMean ?? mean(data)
  const squaredDiffs = data.map((val) => Math.pow(val - m, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length)
}

/**
 * Calculate quartiles for IQR method
 */
export function calculateQuartiles(data: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length

  const q1 = sorted[Math.floor(n * 0.25)]
  const q2 = sorted[Math.floor(n * 0.5)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1

  return { q1, q2, q3, iqr }
}

/**
 * IQR-based outlier detection and winsorization
 */
export function winsorizeData(data: number[]): number[] {
  const { q1, q3, iqr } = calculateQuartiles(data)
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  return data.map((val) => {
    if (val < lowerBound) return lowerBound
    if (val > upperBound) return upperBound
    return val
  })
}

/**
 * Linear interpolation for missing data
 */
export function interpolateMissing(data: (number | null)[]): number[] {
  const result: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (data[i] !== null) {
      result.push(data[i] as number)
    } else if (i > 0 && i < data.length - 1) {
      // Find next non-null value
      let nextIdx = i + 1
      while (nextIdx < data.length && data[nextIdx] === null) nextIdx++

      if (nextIdx < data.length && data[nextIdx] !== null) {
        // Linear interpolation
        const prevVal = result[result.length - 1]
        const nextVal = data[nextIdx] as number
        const steps = nextIdx - i + 1
        result.push(prevVal + (nextVal - prevVal) / steps)
      } else {
        // Forward fill
        result.push(result[result.length - 1])
      }
    } else if (i === 0 && data.length > 1) {
      // Find first non-null value and backfill
      let nextIdx = 1
      while (nextIdx < data.length && data[nextIdx] === null) nextIdx++
      result.push(nextIdx < data.length ? (data[nextIdx] as number) : 0)
    }
  }

  return result
}

/**
 * Create sliding windows for time series analysis
 */
export function createSlidingWindows(data: number[], windowSize: number, step: number = 1): number[][] {
  const windows: number[][] = []
  for (let i = 0; i <= data.length - windowSize; i += step) {
    windows.push(data.slice(i, i + windowSize))
  }
  return windows
}
