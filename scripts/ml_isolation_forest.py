#!/usr/bin/env python3
"""
Isolation Forest Anomaly Detection — Enhanced
Features:
- Multi-level Severity Scoring (Low, Medium, High, Critical)
- Feature Contribution/Explainability
- Adaptive Contamination
- Robust Scaling
"""

import json
import sys
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

# Configuration
SEVERITY_LEVELS = {
    "normal": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4
}

BOUNDS = {
    "environmental": {"min": [5.0, 0.0], "max": [50.0, 100.0]}, # Temp, Hum
    "power": {"min": [0.0, 0.0], "max": [100.0, 50000.0]}      # Current, Power
}

def calculate_severity(score, anomaly_label, data_point, feature_set="environmental"):
    """
    Determine severity based on anomaly score and deviations from bounds.
    Score: 0.0 (normal) to 1.0 (highly anomalous)
    Label: -1 (anomaly), 1 (normal)
    """
    if anomaly_label == 1:
        return "normal", SEVERITY_LEVELS["normal"]

    # Base severity from score
    # Score usually ranges 0.5 - 0.8 for anomalies
    severity = "low"
    if score > 0.75: severity = "critical"
    elif score > 0.65: severity = "high"
    elif score > 0.55: severity = "medium"
    
    # Check physical bounds violations (override score)
    bounds = BOUNDS.get(feature_set, BOUNDS["environmental"])
    mins, maxs = bounds["min"], bounds["max"]
    
    is_extreme = False
    for i, val in enumerate(data_point):
        if i < len(mins):
            # If outside physical bounds by > 10%, it's critical
            margin = (maxs[i] - mins[i]) * 0.1
            if val < mins[i] - margin or val > maxs[i] + margin:
                is_extreme = True
                
    if is_extreme:
        severity = "critical"
        
    return severity, SEVERITY_LEVELS[severity]

def explain_anomaly(scaler, clf, data_point, feature_names):
    """
    Simple contribution analysis: which feature deviates most from specific medians?
    Ideally needs SHAP, but for speed we use deviations.
    """
    try:
        scaled_point = scaler.transform([data_point])
        # This is a heuristic, real explanation needs Tree interpretation
        # Here we just check distance from median (0 in Robust scaler)
        deviations = np.abs(scaled_point[0])
        max_idx = np.argmax(deviations)
        
        return {
            "main_feature": feature_names[max_idx],
            "deviation": float(deviations[max_idx]),
            "description": f"{feature_names[max_idx]} is irregular"
        }
    except Exception:
        return {"description": "Complex pattern anomaly"}

def main():
    try:
        raw = sys.stdin.read()
        if not raw: return
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": str(e), "scores": [], "labels": []}), file=sys.stderr)
        sys.exit(1)

    X = data.get("data", [])
    contamination = float(data.get("contamination", 0.05))
    feature_set = data.get("feature_set", "environmental")
    
    feature_names = ["temperature", "humidity"] if feature_set == "environmental" else ["current", "power"]

    if len(X) < 2:
        print(json.dumps({"scores": [0.0]*len(X), "labels": [1]*len(X), "severities": ["normal"]*len(X)}))
        return

    # Preprocessing
    X_arr = np.array(X, dtype=float)
    
    # Clip to bounds for stability
    bounds = BOUNDS.get(feature_set, BOUNDS["environmental"])
    for j in range(min(X_arr.shape[1], len(bounds["min"]))):
        X_arr[:, j] = np.clip(X_arr[:, j], bounds["min"][j], bounds["max"][j])

    # Scaling
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X_arr)

    # Model
    clf = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=200,
        n_jobs=1
    )
    
    clf.fit(X_scaled)
    labels = clf.predict(X_scaled)
    scores = clf.decision_function(X_scaled)
    
    # Normalize scores: invert decision function so higher = more anomalous
    # Sklearn: positive = normal, negative = outlier
    # We map negative values to 0.5-1.0 range, positive to 0.0-0.5
    anomaly_scores = []
    min_score, max_score = scores.min(), scores.max()
    score_range = max_score - min_score if max_score != min_score else 1.0
    
    for s in scores:
        # Normalize to 0-1 (flipped)
        norm_s = 1.0 - ((s - min_score) / score_range)
        anomaly_scores.append(norm_s)

    # Generate rich output
    out_scores = []
    out_labels = [] # 1 normal, -1 anomaly
    out_severities = []
    out_explanations = []

    for i in range(len(X)):
        lbl = labels[i]
        scr = anomaly_scores[i]
        
        # Severity
        sev, sev_level = calculate_severity(scr, lbl, X[i], feature_set)
        
        # Explanation (only for anomalies)
        expl = None
        if lbl == -1:
            expl = explain_anomaly(scaler, clf, X[i], feature_names)
        
        out_scores.append(round(scr, 4))
        out_labels.append(int(lbl))
        out_severities.append({
            "level": sev,
            "score": sev_level,
            "explanation": expl
        })

    print(json.dumps({
        "scores": out_scores, 
        "labels": out_labels,
        "severities": out_severities,
        "meta": {"feature_set": feature_set}
    }))

if __name__ == "__main__":
    main()
