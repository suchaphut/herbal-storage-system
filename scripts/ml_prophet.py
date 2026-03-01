#!/usr/bin/env python3
"""
Prophet Time Series Prediction — Enhanced for Hospital Use
Features:
- Persistence & Caching
- Confidence Intervals
- Ensemble Forecasting
- Data Augmentation
- Performance Metrics
"""

import json
import sys
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Adds parent directory to path to import sibling scripts
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_model_manager import ModelManager
    from ml_ensemble import simple_moving_average, exponential_smoothing, weighted_ensemble_forecast
except ImportError:
    # Fallback if running standalone without helper scripts
    ModelManager = None
    
# Physical Constraints — realistic for herbal storage rooms
TEMP_MIN, TEMP_MAX = 15.0, 35.0
HUM_MIN, HUM_MAX = 20.0, 85.0
CURRENT_MAX = 100.0
POWER_MAX = 50000.0

# Max allowed deviation from recent mean (prevents wild predictions)
MAX_TEMP_DEVIATION = 5.0   # °C from recent mean
MAX_HUM_DEVIATION = 15.0   # % from recent mean

def _get_prophet_model(n_points=None):
    """Factory for Prophet model with conservative hyperparameters."""
    try:
        from prophet import Prophet
    except ImportError:
        return None
    
    # Need at least 2 full days (~96 points at 30min) for daily seasonality
    daily_seasonality = True if n_points is not None and n_points >= 96 else False
    # Need at least 2 weeks for weekly seasonality
    weekly_seasonality = True if n_points is not None and n_points >= 672 else False
    
    # Balanced changepoint scale — allows gentle trend without overfitting
    if n_points is None or n_points < 48:
        changepoint_scale = 0.01   # Allow gentle trend for small data
    elif n_points < 200:
        changepoint_scale = 0.02   # Moderate for medium data
    else:
        changepoint_scale = 0.05   # More flexible for large data
    
    # Conservative seasonality scale
    seasonality_scale = 0.1 if n_points is not None and n_points < 96 else 1.0
    
    return Prophet(
        interval_width=0.90,
        yearly_seasonality=False,
        daily_seasonality=daily_seasonality,
        weekly_seasonality=weekly_seasonality,
        changepoint_prior_scale=changepoint_scale,
        seasonality_prior_scale=seasonality_scale,
        seasonality_mode="additive",
        changepoint_range=0.8,
        uncertainty_samples=100,
        growth='linear'
    )

def _clean_series(series, lower, upper):
    """Clean data with clipping and interpolation."""
    arr = np.asarray(series, dtype=float)
    arr = np.clip(arr, lower, upper)
    
    # Handle NaN
    if np.any(~np.isfinite(arr)):
        mask = np.isfinite(arr)
        if mask.sum() >= 2:
            x = np.arange(len(arr))
            arr = np.interp(x, x[mask], arr[mask])
        else:
            # Not enough data to interpolate, use mean or default
            val = np.nanmean(arr) if mask.any() else (lower + upper) / 2
            arr = np.full_like(arr, val)
            
    return arr.tolist()

def _augment_data(df, target_size=24):
    """Augment data using linear interpolation if samples are insufficient."""
    if len(df) >= target_size:
        return df

    # Set 'ds' as index so pandas can interpolate numeric columns along time axis
    df = df.set_index('ds')

    # Resample to evenly-spaced intervals that yield at least target_size points
    total_duration = df.index[-1] - df.index[0]
    step = total_duration / (target_size - 1)
    new_index = pd.date_range(start=df.index[0], end=df.index[-1], periods=target_size)

    # Reindex with new timestamps and interpolate linearly
    df = df.reindex(df.index.union(new_index)).interpolate(method='time').reindex(new_index)

    return df.reset_index().rename(columns={'index': 'ds'})


def _fit_predict_ensemble(df, col, steps, freq_minutes, model_manager=None, data_hash=None):
    """
    Fit model and predict using Ensemble approach.
    Returns: forecast_values, lower_bound, upper_bound
    """
    train_df = df[["ds", col]].rename(columns={col: "y"}).dropna()
    n_points = len(train_df)
    
    if n_points < 2:
        return None, None, None

    # --- Strategy Selection based on Data Points ---
    # Case 1: Extremely low data (< 6 points) -> Use Last Value (Persistence)
    if n_points < 6:
        last_val = train_df['y'].iloc[-1]
        final_pred = np.full(steps, last_val)
        return final_pred, final_pred, final_pred

    # Case 2: Low data (6-23 points) -> Use damped linear trend anchored to recent values
    if n_points < 24:
        y = train_df['y'].values
        recent_avg = np.mean(y[-min(5, n_points):])
        recent_std = np.std(y[-min(5, n_points):]) if n_points >= 3 else 1.0
        
        # Damped linear trend: slope decays exponentially into the future
        x = np.arange(n_points)
        slope, intercept = np.polyfit(x, y, 1)
        
        # Damping factor: slope effect decays by 50% every `steps/3` steps
        damping = np.exp(-np.arange(steps) * 0.1)
        damped_trend = slope * damping * np.arange(1, steps + 1)
        
        # Anchor prediction to recent average + damped trend
        final_pred = recent_avg + damped_trend
        
        # Clamp deviation from recent average
        max_dev = max(recent_std * 2, 2.0)
        final_pred = np.clip(final_pred, recent_avg - max_dev, recent_avg + max_dev)
        
        # Simple uncertainty bounds
        uncertainty = max(recent_std, 0.5) * np.linspace(1, 2, steps)
        
        return final_pred, final_pred - uncertainty, final_pred + uncertainty

    # Case 3: Sufficient data (>= 24 points) -> Prophet + Ensemble
    # 1. Prophet Prediction
    m = _get_prophet_model(len(train_df))
    if not m:
        return None, None, None

    # Try to load existing model
    loaded_model = None
    cache_key = f"prophet_{col}_{data_hash}" if data_hash else None
    if model_manager and cache_key:
        loaded_model, _ = model_manager.load_model(cache_key)
    
    if loaded_model:
        m = loaded_model
    else:
        m.fit(train_df)
        if model_manager and cache_key:
            try:
                model_manager.save_model(m, cache_key)
            except Exception:
                pass # Non-critical failure

    future = m.make_future_dataframe(periods=steps, freq=f"{freq_minutes}min")
    fcst = m.predict(future)
    
    prophet_pred = fcst["yhat"].iloc[-steps:].values
    prophet_lower = fcst["yhat_lower"].iloc[-steps:].values
    prophet_upper = fcst["yhat_upper"].iloc[-steps:].values
    
    # 2. Simple Moving Average with gentle drift toward Prophet direction
    recent_vals = train_df['y'].iloc[-min(5, n_points):].values
    recent_avg = np.mean(recent_vals)
    recent_slope = np.polyfit(np.arange(len(recent_vals)), recent_vals, 1)[0] if len(recent_vals) >= 3 else 0
    # SMA with gentle linear drift (damped)
    sma_pred = np.array([recent_avg + recent_slope * min(i, 6) * 0.5 for i in range(steps)])
    
    # 3. Exponential Smoothing (Trend awareness)
    try:
        exp_vals = exponential_smoothing(train_df['y'].values)
        exp_last = exp_vals[-1]
        # Project with recent slope (damped)
        exp_proj = np.array([exp_last + recent_slope * min(i, 6) * 0.3 for i in range(steps)])
    except:
        exp_proj = sma_pred

    # Ensemble Weighting — balanced: let Prophet contribute meaningful signal
    if n_points < 48:
        weights = {'prophet': 0.45, 'sma': 0.30, 'exp': 0.25}
    elif n_points < 200:
        weights = {'prophet': 0.60, 'sma': 0.20, 'exp': 0.20}
    else:
        weights = {'prophet': 0.75, 'sma': 0.15, 'exp': 0.10}

    final_pred = weighted_ensemble_forecast(
        prophet_pred, 
        sma_pred, 
        exp_proj, 
        weights
    )
    
    # --- Post-processing: dampen predictions that deviate too far from recent data ---
    recent_mean = train_df['y'].iloc[-min(10, n_points):].mean()
    recent_std = train_df['y'].iloc[-min(10, n_points):].std()
    max_deviation = max(recent_std * 3, 2.0)  # Allow up to 3 std or 2 units min
    
    final_pred = np.clip(final_pred, recent_mean - max_deviation, recent_mean + max_deviation)
    
    # Smooth the prediction to reduce jaggedness
    if len(final_pred) >= 3:
        kernel = np.array([0.15, 0.7, 0.15])
        smoothed = np.convolve(final_pred, kernel, mode='same')
        # Keep first and last values from original
        smoothed[0] = final_pred[0]
        smoothed[-1] = final_pred[-1]
        final_pred = smoothed
    
    # Adjust bounds based on ensemble shift
    shift = final_pred - prophet_pred
    final_lower = np.clip(prophet_lower + shift, recent_mean - max_deviation, recent_mean + max_deviation)
    final_upper = np.clip(prophet_upper + shift, recent_mean - max_deviation, recent_mean + max_deviation)
    
    return final_pred, final_lower, final_upper

def main():
    try:
        raw = sys.stdin.read()
        if not raw: 
            return
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    # Inputs
    timestamps = data.get("timestamps", [])
    temperature = data.get("temperature", [])
    humidity = data.get("humidity", [])
    current = data.get("current", [])
    power = data.get("power", [])
    horizon_hours = data.get("horizon_hours", 6)
    freq_minutes = data.get("freq_minutes", 30)

    # Log data count to stderr for debugging
    print(f"Received {len(timestamps)} data points.", file=sys.stderr)

    # Basic Validation
    if len(timestamps) < 2:
        print(json.dumps({
            "error": "Insufficient data (need 2+ points)",
            "predictions": [],
            "metrics": {"mae": 0, "rmse": 0, "mape": 0},
            "actuals": [],
            "backtest_predicted": []
        }))
        return

    # Data Preparation
    try:
        ds = pd.to_datetime(timestamps, utc=True).tz_convert(None)
        df = pd.DataFrame({
            "ds": ds,
            "temp": _clean_series(temperature, TEMP_MIN, TEMP_MAX),
            "hum": _clean_series(humidity, HUM_MIN, HUM_MAX)
        })
        
        if len(current) == len(timestamps):
            df["current"] = _clean_series(current, 0, CURRENT_MAX)
            df["power"] = _clean_series(power, 0, POWER_MAX)
            
        # Deduplicate
        df = df.sort_values("ds").drop_duplicates(subset="ds", keep="last").reset_index(drop=True)
        
        # Augmentation if needed (Only if > 6 points but < 12)
        if 6 <= len(df) < 12:
            print(f"Augmenting data from {len(df)} points...", file=sys.stderr)
            df = _augment_data(df, target_size=12)
            
    except Exception as e:
        print(json.dumps({"error": f"Data prep error: {str(e)}"}), file=sys.stderr)
        return

    # Setup
    steps = int(horizon_hours * 60 / freq_minutes)
    predictions = []
    
    # Model Manager for Persistence
    mgr = ModelManager("prophet_ensemble") if ModelManager else None
    
    # Create a hash of the input data
    data_signature = {
        "timestamps": timestamps,
        "temperature": temperature,
        "humidity": humidity
    }
    if mgr:
        data_hash = mgr._get_data_hash(data_signature)
    else:
        import hashlib
        data_hash = hashlib.md5(json.dumps(data_signature, sort_keys=True).encode()).hexdigest()

    # Forecast Temperature
    pred_t, low_t, up_t = _fit_predict_ensemble(df, "temp", steps, freq_minutes, mgr, data_hash)
    if pred_t is None: pred_t = np.zeros(steps)
        
    # Forecast Humidity
    pred_h, low_h, up_h = _fit_predict_ensemble(df, "hum", steps, freq_minutes, mgr, data_hash)
    if pred_h is None: pred_h = np.zeros(steps)

    # Generate Timestamps
    last_time = df['ds'].iloc[-1]
    future_times = [last_time + timedelta(minutes=freq_minutes*(i+1)) for i in range(steps)]
    
    # Clip results to physical limits
    pred_t = np.clip(pred_t, TEMP_MIN, TEMP_MAX)
    pred_h = np.clip(pred_h, HUM_MIN, HUM_MAX)
    
    # Power Predictions
    predictions_power = None
    if "power" in df.columns:
        pred_c, _, _ = _fit_predict_ensemble(df, "current", steps, freq_minutes, mgr, data_hash)
        pred_p, _, _ = _fit_predict_ensemble(df, "power", steps, freq_minutes, mgr, data_hash)
        
        if pred_c is not None and pred_p is not None:
            predictions_power = []
            for i in range(steps):
                predictions_power.append({
                    "time": future_times[i].isoformat(),
                    "current": float(max(0, pred_c[i])),
                    "power": float(max(0, pred_p[i]))
                })

    # Assemble Output
    for i in range(steps):
        predictions.append({
            "time": future_times[i].isoformat(),
            "temperature": float(pred_t[i]),
            "humidity": float(pred_h[i]),
            "temp_low": float(low_t[i]) if low_t is not None else float(pred_t[i]),
            "temp_high": float(up_t[i]) if up_t is not None else float(pred_t[i]),
            "hum_low": float(low_h[i]) if low_h is not None else float(pred_h[i]),
            "hum_high": float(up_h[i]) if up_h is not None else float(pred_h[i])
        })

    # Backtesting (Simulate)
    metrics = {"mae": 0.0, "rmse": 0.0, "mape": 0.0}
    actuals = []
    backtest_predicted = []
    
    # Need at least 12 points to do a meaningful backtest split
    if len(df) >= 12:
        # Holdout last 20%
        split_idx = int(len(df) * 0.8)
        train = df.iloc[:split_idx]
        test = df.iloc[split_idx:]
        
        if len(test) > 0:
            bt_steps = len(test)
            bt_pred_t, _, _ = _fit_predict_ensemble(train, "temp", bt_steps, freq_minutes)
            bt_pred_h, _, _ = _fit_predict_ensemble(train, "hum", bt_steps, freq_minutes)
            
            if bt_pred_t is not None:
                # Clip BEFORE calculating metrics to match reality
                bt_pred_t = np.clip(bt_pred_t, TEMP_MIN, TEMP_MAX)
                if bt_pred_h is not None:
                    bt_pred_h = np.clip(bt_pred_h, HUM_MIN, HUM_MAX)
                
                actual_t = test['temp'].values
                
                # Metrics for Temp
                mae = np.mean(np.abs(bt_pred_t - actual_t))
                rmse = np.sqrt(np.mean((bt_pred_t - actual_t)**2))
                
                # MAPE: Avoid division by zero
                # Use a small epsilon for denominator
                denominator = np.maximum(np.abs(actual_t), 0.1)
                mape = np.mean(np.abs((actual_t - bt_pred_t) / denominator)) * 100
                
                metrics = {
                    "mae": float(mae),
                    "rmse": float(rmse), 
                    "mape": float(mape)
                }
                
                # Backtest data for visualization
                for i in range(len(test)):
                    actuals.append({
                        "time": test['ds'].iloc[i].isoformat(),
                        "temperature": float(test['temp'].iloc[i]),
                        "humidity": float(test['hum'].iloc[i])
                    })
                    backtest_predicted.append({
                        "time": test['ds'].iloc[i].isoformat(),
                        "temperature": float(bt_pred_t[i]),
                        "humidity": float(bt_pred_h[i]) if bt_pred_h is not None else float(test['hum'].iloc[i])
                    })

    # Output JSON
    output = {
        "predictions": predictions,
        "predictions_power": predictions_power,
        "metrics": metrics,
        "actuals": actuals,
        "backtest_predicted": backtest_predicted,
        "meta": {
            "model_type": "prophet_ensemble_v2",
            "version": "2.2.0",
            "generated_at": datetime.now().isoformat(),
            "data_hash": data_hash,
            "training_points": len(df)
        }
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
