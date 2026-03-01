#!/usr/bin/env python3
"""
One-Class SVM for Anomaly Detection
Features:
- Kernel-based anomaly detection (RBF, polynomial)
- Robust to outliers during training
- Automatic hyperparameter tuning
- Model persistence and caching
- Multi-level severity scoring
"""

import json
import sys
import os
import numpy as np
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import GridSearchCV

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_model_manager import ModelManager
except ImportError:
    ModelManager = None

# Configuration
KERNELS = ['rbf', 'poly', 'sigmoid']
DEFAULT_KERNEL = 'rbf'

# Physical bounds for clipping
BOUNDS = {
    "environmental": {"min": [5.0, 0.0], "max": [50.0, 100.0]},  # Temp, Humidity
    "power": {"min": [0.0, 0.0], "max": [100.0, 50000.0]}  # Current, Power
}

def tune_ocsvm_hyperparameters(X_scaled, contamination):
    """
    Perform grid search to find optimal hyperparameters.
    Returns: best estimator
    """
    # Parameter grid
    param_grid = {
        'kernel': ['rbf'],
        'gamma': ['scale', 'auto', 0.001, 0.01, 0.1],
        'nu': [contamination * 0.5, contamination, contamination * 1.5]
    }
    
    # Base model
    base_model = OneClassSVM()
    
    # Custom scorer: maximize number of inliers while respecting contamination
    def custom_scorer(estimator, X):
        predictions = estimator.predict(X)
        decision = estimator.decision_function(X)
        # Higher score for better separation
        return np.mean(decision[predictions == 1]) - np.mean(decision[predictions == -1])
    
    # Grid search
    grid_search = GridSearchCV(
        base_model,
        param_grid,
        scoring=custom_scorer,
        cv=min(3, len(X_scaled) // 10),  # 3-fold CV or less if data is small
        n_jobs=1,
        verbose=0
    )
    
    try:
        grid_search.fit(X_scaled)
        return grid_search.best_estimator_
    except:
        # Fallback to default parameters
        return OneClassSVM(kernel='rbf', gamma='scale', nu=contamination)

def calculate_severity(decision_value, label, percentiles):
    """
    Determine severity based on decision function value.
    
    Args:
        decision_value: Distance from decision boundary (negative = anomaly)
        label: 1 (normal) or -1 (anomaly)
        percentiles: dict with p25, p50, p75 of decision values
    """
    if label == 1:
        return "normal", 0
    
    # For anomalies, more negative = more severe
    # Normalize based on percentiles
    p25, p50, p75 = percentiles['p25'], percentiles['p50'], percentiles['p75']
    
    if decision_value < p25:
        return "critical", 4
    elif decision_value < p50:
        return "high", 3
    elif decision_value < p75:
        return "medium", 2
    else:
        return "low", 1

def explain_anomaly(scaler, data_point, feature_names):
    """
    Simple explanation: which feature deviates most from median.
    """
    try:
        scaled_point = scaler.transform([data_point])
        deviations = np.abs(scaled_point[0])
        max_idx = np.argmax(deviations)
        
        return {
            "main_feature": feature_names[max_idx],
            "deviation": float(deviations[max_idx]),
            "description": f"{feature_names[max_idx]} shows unusual pattern"
        }
    except Exception:
        return {"description": "Complex anomaly pattern"}

def main():
    try:
        raw = sys.stdin.read()
        if not raw:
            return
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": str(e), "scores": [], "labels": []}), file=sys.stderr)
        sys.exit(1)
    
    X = data.get("data", [])
    contamination = float(data.get("contamination", 0.05))
    feature_set = data.get("feature_set", "environmental")
    kernel = data.get("kernel", DEFAULT_KERNEL)
    auto_tune = data.get("auto_tune", True)
    
    feature_names = ["temperature", "humidity"] if feature_set == "environmental" else ["current", "power"]
    
    if len(X) < 10:
        # Need at least 10 samples for One-Class SVM
        print(json.dumps({
            "scores": [0.0] * len(X),
            "labels": [1] * len(X),
            "severities": [{"level": "normal", "score": 0}] * len(X),
            "meta": {"model": "one_class_svm", "status": "insufficient_data"}
        }))
        return
    
    # Preprocessing
    X_arr = np.array(X, dtype=float)
    
    # Clip to physical bounds
    bounds = BOUNDS.get(feature_set, BOUNDS["environmental"])
    for j in range(min(X_arr.shape[1], len(bounds["min"]))):
        X_arr[:, j] = np.clip(X_arr[:, j], bounds["min"][j], bounds["max"][j])
    
    # Robust scaling (resistant to outliers)
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X_arr)
    
    # Model management
    mgr = ModelManager("one_class_svm") if ModelManager else None
    model = None
    
    # Try to load cached model
    if mgr:
        cache_key = f"ocsvm_{feature_set}_{kernel}_{contamination}"
        loaded_model, meta = mgr.load_model(cache_key)
        if loaded_model:
            model = loaded_model
            print(f"Loaded cached One-Class SVM model", file=sys.stderr)
    
    # Train new model if needed
    if model is None:
        print(f"Training One-Class SVM on {len(X)} samples...", file=sys.stderr)
        
        if auto_tune and len(X) >= 30:
            # Use grid search for larger datasets
            print("Performing hyperparameter tuning...", file=sys.stderr)
            model = tune_ocsvm_hyperparameters(X_scaled, contamination)
        else:
            # Use default parameters
            model = OneClassSVM(
                kernel=kernel,
                gamma='scale',
                nu=contamination
            )
            model.fit(X_scaled)
        
        print(f"Training completed. Support vectors: {model.n_support_[0]}", file=sys.stderr)
        
        # Save model
        if mgr:
            try:
                cache_key = f"ocsvm_{feature_set}_{kernel}_{contamination}"
                mgr.save_model(model, cache_key, metadata={
                    "feature_set": feature_set,
                    "kernel": kernel,
                    "contamination": contamination,
                    "n_support_vectors": int(model.n_support_[0])
                })
            except Exception as e:
                print(f"Failed to save model: {e}", file=sys.stderr)
    
    # Predictions
    labels = model.predict(X_scaled)
    decision_values = model.decision_function(X_scaled)
    
    # Calculate percentiles for severity determination
    anomaly_decisions = decision_values[labels == -1]
    if len(anomaly_decisions) > 0:
        percentiles = {
            'p25': np.percentile(anomaly_decisions, 25),
            'p50': np.percentile(anomaly_decisions, 50),
            'p75': np.percentile(anomaly_decisions, 75)
        }
    else:
        # No anomalies detected, use overall percentiles
        percentiles = {
            'p25': np.percentile(decision_values, 25),
            'p50': np.percentile(decision_values, 50),
            'p75': np.percentile(decision_values, 75)
        }
    
    # Normalize decision values to 0-1 scores
    # More negative = higher anomaly score
    min_decision = np.min(decision_values)
    max_decision = np.max(decision_values)
    decision_range = max_decision - min_decision if max_decision != min_decision else 1.0
    
    out_scores = []
    out_labels = []
    out_severities = []
    
    for i in range(len(X)):
        lbl = labels[i]
        decision = decision_values[i]
        
        # Normalize to 0-1 (flip so higher = more anomalous)
        score = 1.0 - ((decision - min_decision) / decision_range)
        
        # Severity
        sev_level, sev_score = calculate_severity(decision, lbl, percentiles)
        
        # Explanation (only for anomalies)
        expl = None
        if lbl == -1:
            expl = explain_anomaly(scaler, X[i], feature_names)
        
        out_scores.append(round(float(score), 4))
        out_labels.append(int(lbl))
        out_severities.append({
            "level": sev_level,
            "score": sev_score,
            "decision_value": round(float(decision), 4),
            "explanation": expl
        })
    
    # Output
    print(json.dumps({
        "scores": out_scores,
        "labels": out_labels,
        "severities": out_severities,
        "meta": {
            "model": "one_class_svm",
            "feature_set": feature_set,
            "kernel": kernel if hasattr(model, 'kernel') else 'rbf',
            "n_support_vectors": int(model.n_support_[0]),
            "n_anomalies": sum(1 for l in out_labels if l == -1)
        }
    }))

if __name__ == "__main__":
    main()
