/**
 * Holt-Winters Triple Exponential Smoothing
 */

import { mean, winsorizeData } from './utils'

export interface HoltWintersState {
  level: number
  trend: number
  seasonals: number[]
}

/**
 * Initialize Holt-Winters state from historical data
 */
function initializeHoltWinters(
  data: number[],
  seasonLength: number
): HoltWintersState {
  // Initial level: average of first season
  const firstSeason = data.slice(0, Math.min(seasonLength, data.length))
  const level = mean(firstSeason)

  // Initial trend: average difference between corresponding points in first two seasons
  let trend = 0
  if (data.length >= seasonLength * 2) {
    for (let i = 0; i < seasonLength; i++) {
      trend += (data[seasonLength + i] - data[i]) / seasonLength
    }
    trend /= seasonLength
  }

  // Initial seasonal factors
  const seasonals: number[] = []
  for (let i = 0; i < seasonLength; i++) {
    if (i < data.length) {
      seasonals.push(data[i] - level)
    } else {
      seasonals.push(0)
    }
  }

  return { level, trend, seasonals }
}

export interface HoltWintersConfig {
  alpha: number
  beta: number
  gamma: number
  seasonLength: number
  horizonHours: number
}

/**
 * Holt-Winters prediction step
 */
export function holtWintersPredict(
  data: number[],
  steps: number,
  config: HoltWintersConfig
): { predictions: number[]; state: HoltWintersState } {
  const { alpha, beta, gamma, seasonLength } = config

  // Winsorize data to handle outliers
  const cleanData = winsorizeData(data)

  // Initialize state
  let state = initializeHoltWinters(cleanData, seasonLength)

  // Update state with all historical data
  for (let t = seasonLength; t < cleanData.length; t++) {
    const seasonIdx = t % seasonLength
    const observation = cleanData[t]

    // Update level
    const newLevel =
      alpha * (observation - state.seasonals[seasonIdx]) +
      (1 - alpha) * (state.level + state.trend)

    // Update trend
    const newTrend = beta * (newLevel - state.level) + (1 - beta) * state.trend

    // Update seasonal
    state.seasonals[seasonIdx] =
      gamma * (observation - newLevel) + (1 - gamma) * state.seasonals[seasonIdx]

    state.level = newLevel
    state.trend = newTrend
  }

  // Generate predictions
  const predictions: number[] = []
  for (let h = 1; h <= steps; h++) {
    const seasonIdx = (cleanData.length + h - 1) % seasonLength
    const prediction = state.level + h * state.trend + state.seasonals[seasonIdx]
    predictions.push(prediction)
  }

  return { predictions, state }
}
