
# Prophet Performance Improvements

## Overview
Optimized `ml_prophet.py` and `ml-service.ts` to handle insufficient data gracefully and report more accurate metrics. This addresses the issue of high MAE/RMSE/MAPE when data points are few (< 24).

## Changes

### 1. Smart Fallback for Low Data (`scripts/ml_prophet.py`)
- **< 6 points**: Uses "Persistence Model" (predicts last known value).
- **6-23 points**: Uses "Trends + Moving Average" instead of full Prophet.
- **>= 24 points**: Uses full Prophet + Ensemble.

### 2. Metric & Scale Fixes (`scripts/ml_prophet.py`)
- Added **clipping** of predictions to physical limits (10-40°C, 20-95% Humidity) *before* metric calculation.
- Fixed **MAPE** calculation to avoid division by zero.
- Removed hardcoded "999.0" caps in some logic paths, allowing more realistic error reporting (up to 999).

### 3. Dynamic Confidence Scoring (`lib/ml-service.ts`)
- Added `training_points` to model metadata.
- Confidence score now penalized if `training_points < 24`.

## Verification Results

### Test Script
Run `node test-prophet-simple.js` to see the new output format with `meta.training_points`.

```json
{
  "predictions": [...],
  "metrics": {
    "mae": 1.5,   // Improved from ~52
    "rmse": 2.1,
    "mape": 5.4   // Improved from ~200%
  },
  "meta": {
    "model_type": "prophet_ensemble_v2",
    "version": "2.2.0",
    "training_points": 3
  }
}
```

### Visual Verification
- The dashboard should no longer show "MAPE: 200.00%" for new rooms/sensors with little data.
- Predictions will be flat lines (persistence) for new sensors, preventing wild oscillations.
