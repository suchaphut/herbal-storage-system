#!/usr/bin/env python3
"""
Prophet Time Series Prediction with External Weather Regressors
Enhanced to use external weather data (temperature, humidity) as additional features
"""

import json
import sys
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_model_manager import ModelManager
    from ml_ensemble import simple_moving_average, exponential_smoothing, weighted_ensemble_forecast
except ImportError:
    ModelManager = None

TEMP_MIN, TEMP_MAX = 15.0, 35.0
HUM_MIN, HUM_MAX = 20.0, 85.0

def _get_prophet_model_with_regressors(n_points=None):
    """Factory for Prophet model with external regressors."""
    try:
        from prophet import Prophet
    except ImportError:
        return None
    
    daily_seasonality = True if n_points is not None and n_points >= 96 else False
    weekly_seasonality = True if n_points is not None and n_points >= 672 else False
    
    if n_points is None or n_points < 48:
        changepoint_scale = 0.01
    elif n_points < 200:
        changepoint_scale = 0.02
    else:
        changepoint_scale = 0.05
    
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
    
    if np.any(~np.isfinite(arr)):
        mask = np.isfinite(arr)
        if mask.sum() >= 2:
            x = np.arange(len(arr))
            arr = np.interp(x, x[mask], arr[mask])
        else:
            val = np.nanmean(arr) if mask.any() else (lower + upper) / 2
            arr = np.full_like(arr, val)
            
    return arr.tolist()

def _fit_predict_with_weather(df, col, steps, freq_minutes, has_weather=False):
    """
    Fit Prophet model with optional external weather regressors.
    Returns: forecast_values, lower_bound, upper_bound
    """
    train_df = df[["ds", col]].rename(columns={col: "y"}).dropna()
    
    # Add external regressors if available
    if has_weather and 'external_temp' in df.columns and 'external_hum' in df.columns:
        train_df['external_temp'] = df['external_temp'].values[:len(train_df)]
        train_df['external_hum'] = df['external_hum'].values[:len(train_df)]
    
    n_points = len(train_df)
    
    if n_points < 2:
        return None, None, None

    # For very small datasets, use simple persistence
    if n_points < 6:
        last_val = train_df['y'].iloc[-1]
        final_pred = np.full(steps, last_val)
        return final_pred, final_pred, final_pred

    # For small datasets, use damped linear trend
    if n_points < 24:
        y = train_df['y'].values
        recent_avg = np.mean(y[-min(5, n_points):])
        recent_std = np.std(y[-min(5, n_points):]) if n_points >= 3 else 1.0
        
        x = np.arange(n_points)
        slope, intercept = np.polyfit(x, y, 1)
        
        damping = np.exp(-np.arange(steps) * 0.1)
        damped_trend = slope * damping * np.arange(1, steps + 1)
        
        final_pred = recent_avg + damped_trend
        
        max_dev = max(recent_std * 2, 2.0)
        final_pred = np.clip(final_pred, recent_avg - max_dev, recent_avg + max_dev)
        
        uncertainty = max(recent_std, 0.5) * np.linspace(1, 2, steps)
        
        return final_pred, final_pred - uncertainty, final_pred + uncertainty

    # For sufficient data, use Prophet with optional weather regressors
    m = _get_prophet_model_with_regressors(len(train_df))
    if not m:
        return None, None, None

    # Add regressors if available
    if has_weather and 'external_temp' in train_df.columns:
        m.add_regressor('external_temp', standardize=True)
        m.add_regressor('external_hum', standardize=True)
        print(f"Added external weather regressors for {col}", file=sys.stderr)

    m.fit(train_df)

    # Create future dataframe
    future = m.make_future_dataframe(periods=steps, freq=f"{freq_minutes}min")
    
    # If we have weather regressors, we need to provide future values
    if has_weather and 'external_temp' in train_df.columns:
        # Use last known values or forecast values if provided
        last_ext_temp = train_df['external_temp'].iloc[-1]
        last_ext_hum = train_df['external_hum'].iloc[-1]
        
        # For future periods, use the last known values (or could use forecast)
        future_ext_temp = [last_ext_temp] * len(future)
        future_ext_hum = [last_ext_hum] * len(future)
        
        future['external_temp'] = future_ext_temp
        future['external_hum'] = future_ext_hum

    fcst = m.predict(future)
    
    prophet_pred = fcst["yhat"].iloc[-steps:].values
    prophet_lower = fcst["yhat_lower"].iloc[-steps:].values
    prophet_upper = fcst["yhat_upper"].iloc[-steps:].values
    
    # Ensemble with simple methods
    recent_vals = train_df['y'].iloc[-min(5, n_points):].values
    recent_avg = np.mean(recent_vals)
    recent_slope = np.polyfit(np.arange(len(recent_vals)), recent_vals, 1)[0] if len(recent_vals) >= 3 else 0
    
    sma_pred = np.array([recent_avg + recent_slope * min(i, 6) * 0.5 for i in range(steps)])
    
    try:
        exp_vals = exponential_smoothing(train_df['y'].values)
        exp_last = exp_vals[-1]
        exp_proj = np.array([exp_last + recent_slope * min(i, 6) * 0.3 for i in range(steps)])
    except:
        exp_proj = sma_pred

    # Ensemble weighting - give more weight to Prophet when using weather data
    if has_weather and 'external_temp' in train_df.columns:
        if n_points < 48:
            weights = {'prophet': 0.60, 'sma': 0.25, 'exp': 0.15}
        elif n_points < 200:
            weights = {'prophet': 0.75, 'sma': 0.15, 'exp': 0.10}
        else:
            weights = {'prophet': 0.85, 'sma': 0.10, 'exp': 0.05}
    else:
        if n_points < 48:
            weights = {'prophet': 0.45, 'sma': 0.30, 'exp': 0.25}
        elif n_points < 200:
            weights = {'prophet': 0.60, 'sma': 0.20, 'exp': 0.20}
        else:
            weights = {'prophet': 0.75, 'sma': 0.15, 'exp': 0.10}

    final_pred = weighted_ensemble_forecast(prophet_pred, sma_pred, exp_proj, weights)
    
    # Post-processing
    recent_mean = train_df['y'].iloc[-min(10, n_points):].mean()
    recent_std = train_df['y'].iloc[-min(10, n_points):].std()
    max_deviation = max(recent_std * 3, 2.0)
    
    final_pred = np.clip(final_pred, recent_mean - max_deviation, recent_mean + max_deviation)
    
    if len(final_pred) >= 3:
        kernel = np.array([0.15, 0.7, 0.15])
        smoothed = np.convolve(final_pred, kernel, mode='same')
        smoothed[0] = final_pred[0]
        smoothed[-1] = final_pred[-1]
        final_pred = smoothed
    
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
    
    # External weather data (optional)
    external_temp = data.get("external_temperature", [])
    external_hum = data.get("external_humidity", [])
    
    horizon_hours = data.get("horizon_hours", 6)
    freq_minutes = data.get("freq_minutes", 30)

    print(f"Received {len(timestamps)} data points.", file=sys.stderr)
    if len(external_temp) > 0:
        print(f"Using external weather data ({len(external_temp)} points).", file=sys.stderr)

    if len(timestamps) < 2:
        print(json.dumps({
            "error": "Insufficient data (need 2+ points)",
            "predictions": [],
            "metrics": {"mae": 0, "rmse": 0, "mape": 0}
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
        
        # Add external weather if available
        has_weather = False
        if len(external_temp) == len(timestamps):
            df["external_temp"] = _clean_series(external_temp, TEMP_MIN, TEMP_MAX)
            df["external_hum"] = _clean_series(external_hum, HUM_MIN, HUM_MAX)
            has_weather = True
            
        df = df.sort_values("ds").drop_duplicates(subset="ds", keep="last").reset_index(drop=True)
            
    except Exception as e:
        print(json.dumps({"error": f"Data prep error: {str(e)}"}), file=sys.stderr)
        return

    steps = int(horizon_hours * 60 / freq_minutes)
    predictions = []

    # Forecast Temperature
    pred_t, low_t, up_t = _fit_predict_with_weather(df, "temp", steps, freq_minutes, has_weather)
    if pred_t is None: 
        pred_t = np.zeros(steps)
        
    # Forecast Humidity
    pred_h, low_h, up_h = _fit_predict_with_weather(df, "hum", steps, freq_minutes, has_weather)
    if pred_h is None: 
        pred_h = np.zeros(steps)

    # Generate Timestamps
    last_time = df['ds'].iloc[-1]
    future_times = [last_time + timedelta(minutes=freq_minutes*(i+1)) for i in range(steps)]
    
    # Clip results
    pred_t = np.clip(pred_t, TEMP_MIN, TEMP_MAX)
    pred_h = np.clip(pred_h, HUM_MIN, HUM_MAX)

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

    # Backtesting
    metrics = {"mae": 0.0, "rmse": 0.0, "mape": 0.0}
    actuals = []
    backtest_predicted = []
    
    if len(df) >= 12:
        split_idx = int(len(df) * 0.8)
        train = df.iloc[:split_idx]
        test = df.iloc[split_idx:]
        
        if len(test) > 0:
            bt_steps = len(test)
            bt_pred_t, _, _ = _fit_predict_with_weather(train, "temp", bt_steps, freq_minutes, has_weather)
            
            if bt_pred_t is not None:
                bt_pred_t = np.clip(bt_pred_t, TEMP_MIN, TEMP_MAX)
                actual_t = test['temp'].values
                
                mae = np.mean(np.abs(bt_pred_t - actual_t))
                rmse = np.sqrt(np.mean((bt_pred_t - actual_t)**2))
                denominator = np.maximum(np.abs(actual_t), 0.1)
                mape = np.mean(np.abs((actual_t - bt_pred_t) / denominator)) * 100
                
                metrics = {
                    "mae": float(mae),
                    "rmse": float(rmse), 
                    "mape": float(mape)
                }

    # Output JSON
    output = {
        "predictions": predictions,
        "metrics": metrics,
        "actuals": actuals,
        "backtest_predicted": backtest_predicted,
        "meta": {
            "model_type": "prophet_with_weather_v1",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "training_points": len(df),
            "uses_external_weather": has_weather
        }
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
