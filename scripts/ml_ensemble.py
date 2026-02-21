#!/usr/bin/env python3
"""
ML Ensemble - Utilities for combining multiple forecasting models.
"""

import numpy as np

def simple_moving_average(series, window=3):
    """Calculate simple moving average."""
    return np.convolve(series, np.ones(window)/window, mode='valid')

def exponential_smoothing(series, alpha=0.3):
    """Simple exponential smoothing."""
    result = [series[0]]
    for n in range(1, len(series)):
        result.append(alpha * series[n] + (1 - alpha) * result[n-1])
    return np.array(result)

def weighted_ensemble_forecast(prophet_pred, sma_pred=None, exp_pred=None, weights=None):
    """
    Combine predictions from multiple models.
    Default weights favor Prophet strongly if not specified.
    """
    if weights is None:
        weights = {'prophet': 0.8, 'sma': 0.1, 'exp': 0.1}
        
    final_pred = weights['prophet'] * np.array(prophet_pred)
    
    current_weight = weights['prophet']
    
    if sma_pred is not None and len(sma_pred) == len(prophet_pred):
        final_pred += weights['sma'] * np.array(sma_pred)
        current_weight += weights['sma']
        
    if exp_pred is not None and len(exp_pred) == len(prophet_pred):
        final_pred += weights['exp'] * np.array(exp_pred)
        current_weight += weights['exp']
        
    # Normalize if weights don't sum to 1 (or if some models were missing)
    if current_weight > 0:
        final_pred /= current_weight
        
    return final_pred

def calculate_confidence_interval(predictions, variance_factor=1.96):
    """
    Calculate simple confidence interval based on prediction variance.
    Assumes normal distribution of errors.
    """
    std_dev = np.std(predictions)
    lower = predictions - (variance_factor * std_dev)
    upper = predictions + (variance_factor * std_dev)
    return lower, upper
