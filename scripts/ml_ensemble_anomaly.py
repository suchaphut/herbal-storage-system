#!/usr/bin/env python3
"""
Ensemble Anomaly Detection
Combines multiple anomaly detection methods:
1. Isolation Forest (fast, tree-based)
2. LSTM Autoencoder (deep learning, sequence-aware)
3. One-Class SVM (kernel-based, robust)

Features:
- Weighted voting system
- Adaptive ensemble weights based on data characteristics
- Consensus-based severity scoring
- Fallback mechanisms if models fail
"""

import json
import sys
import os
import numpy as np
import subprocess

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configuration
DEFAULT_WEIGHTS = {
    'isolation_forest': 0.4,
    'lstm_autoencoder': 0.35,
    'one_class_svm': 0.25
}

# Adaptive weights based on data size
def get_adaptive_weights(n_samples):
    """
    Adjust ensemble weights based on data characteristics.
    
    - Small data (< 20): Favor Isolation Forest (simpler, more stable)
    - Medium data (20-100): Balanced ensemble
    - Large data (> 100): Favor LSTM (can learn complex patterns)
    """
    if n_samples < 20:
        return {
            'isolation_forest': 0.6,
            'lstm_autoencoder': 0.1,
            'one_class_svm': 0.3
        }
    elif n_samples < 100:
        return {
            'isolation_forest': 0.4,
            'lstm_autoencoder': 0.35,
            'one_class_svm': 0.25
        }
    else:
        return {
            'isolation_forest': 0.3,
            'lstm_autoencoder': 0.45,
            'one_class_svm': 0.25
        }

def run_model(script_name, input_data):
    """
    Run a Python script and return its JSON output.
    Returns: (success, result_dict)
    """
    try:
        script_path = os.path.join(os.path.dirname(__file__), script_name)
        
        # Determine Python command
        python_cmd = os.environ.get('PYTHON_PATH', 'python' if os.name == 'nt' else 'python3')
        
        result = subprocess.run(
            [python_cmd, script_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Parse last line as JSON (scripts may print debug info to stdout)
            lines = result.stdout.strip().split('\n')
            last_line = lines[-1] if lines else '{}'
            output = json.loads(last_line)
            return True, output
        else:
            print(f"Error running {script_name}: {result.stderr}", file=sys.stderr)
            return False, None
    except Exception as e:
        print(f"Exception running {script_name}: {str(e)}", file=sys.stderr)
        return False, None

def combine_scores(scores_dict, weights):
    """
    Combine scores from multiple models using weighted average.
    
    Args:
        scores_dict: {'model_name': [score1, score2, ...]}
        weights: {'model_name': weight}
    
    Returns: combined scores array
    """
    n_samples = len(next(iter(scores_dict.values())))
    combined = np.zeros(n_samples)
    total_weight = 0.0
    
    for model_name, scores in scores_dict.items():
        if model_name in weights:
            weight = weights[model_name]
            combined += weight * np.array(scores)
            total_weight += weight
    
    if total_weight > 0:
        combined /= total_weight
    
    return combined

def combine_labels(labels_dict, weights):
    """
    Combine labels using weighted voting.
    Label is -1 (anomaly) if weighted vote exceeds threshold.
    """
    n_samples = len(next(iter(labels_dict.values())))
    combined = []
    
    for i in range(n_samples):
        vote = 0.0
        total_weight = 0.0
        
        for model_name, labels in labels_dict.items():
            if model_name in weights:
                weight = weights[model_name]
                # -1 = anomaly, 1 = normal
                # Convert to 0/1 for voting
                vote += weight * (1 if labels[i] == -1 else 0)
                total_weight += weight
        
        # If weighted vote > 0.5, it's an anomaly
        final_label = -1 if (vote / total_weight) > 0.5 else 1
        combined.append(final_label)
    
    return combined

def combine_severities(severities_dict, weights):
    """
    Combine severity scores using weighted average.
    Take the highest severity level among models.
    """
    n_samples = len(next(iter(severities_dict.values())))
    combined = []
    
    severity_map = {'normal': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
    reverse_map = {0: 'normal', 1: 'low', 2: 'medium', 3: 'high', 4: 'critical'}
    
    for i in range(n_samples):
        weighted_score = 0.0
        max_level = 0
        total_weight = 0.0
        explanations = []
        
        for model_name, severities in severities_dict.items():
            if model_name in weights:
                weight = weights[model_name]
                sev = severities[i]
                
                weighted_score += weight * sev.get('score', 0)
                max_level = max(max_level, sev.get('score', 0))
                total_weight += weight
                
                # Collect explanations
                if sev.get('explanation'):
                    explanations.append({
                        'model': model_name,
                        'explanation': sev['explanation']
                    })
        
        avg_score = weighted_score / total_weight if total_weight > 0 else 0
        
        # Use max level for conservative anomaly detection
        final_level = reverse_map.get(max_level, 'normal')
        
        combined.append({
            'level': final_level,
            'score': max_level,
            'avg_score': round(float(avg_score), 2),
            'explanations': explanations if explanations else None
        })
    
    return combined

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
    custom_weights = data.get("weights", None)
    
    if len(X) < 2:
        print(json.dumps({
            "scores": [0.0] * len(X),
            "labels": [1] * len(X),
            "severities": [{"level": "normal", "score": 0}] * len(X),
            "meta": {"model": "ensemble", "status": "insufficient_data"}
        }))
        return
    
    # Determine weights
    if custom_weights:
        weights = custom_weights
    else:
        weights = get_adaptive_weights(len(X))
    
    print(f"Using ensemble weights: {weights}", file=sys.stderr)
    
    # Prepare input for sub-models
    model_input = {
        "data": X,
        "contamination": contamination,
        "feature_set": feature_set
    }
    
    # Run models
    results = {}
    
    # 1. Isolation Forest (always run, it's fast and reliable)
    print("Running Isolation Forest...", file=sys.stderr)
    success, result = run_model('ml_isolation_forest.py', model_input)
    if success and result:
        results['isolation_forest'] = result
    
    # 2. LSTM Autoencoder (skip if data is too small)
    if len(X) >= 12:
        print("Running LSTM Autoencoder...", file=sys.stderr)
        lstm_input = model_input.copy()
        lstm_input['train_new'] = len(X) > 50  # Only train new model for large datasets
        success, result = run_model('ml_lstm_autoencoder.py', lstm_input)
        if success and result:
            results['lstm_autoencoder'] = result
    else:
        print("Skipping LSTM (insufficient data)", file=sys.stderr)
    
    # 3. One-Class SVM (skip if data is too small)
    if len(X) >= 10:
        print("Running One-Class SVM...", file=sys.stderr)
        success, result = run_model('ml_ocsvm.py', model_input)
        if success and result:
            results['one_class_svm'] = result
    else:
        print("Skipping One-Class SVM (insufficient data)", file=sys.stderr)
    
    # Check if we have at least one model result
    if not results:
        print(json.dumps({
            "error": "All models failed",
            "scores": [0.0] * len(X),
            "labels": [1] * len(X),
            "severities": [{"level": "normal", "score": 0}] * len(X)
        }), file=sys.stderr)
        sys.exit(1)
    
    # Adjust weights based on available models
    available_models = set(results.keys())
    adjusted_weights = {}
    total_weight = sum(weights[m] for m in available_models if m in weights)
    
    for model in available_models:
        if model in weights:
            adjusted_weights[model] = weights[model] / total_weight
    
    print(f"Adjusted weights (based on available models): {adjusted_weights}", file=sys.stderr)
    
    # Extract scores, labels, and severities
    scores_dict = {name: res['scores'] for name, res in results.items()}
    labels_dict = {name: res['labels'] for name, res in results.items()}
    severities_dict = {name: res['severities'] for name, res in results.items()}
    
    # Combine results
    combined_scores = combine_scores(scores_dict, adjusted_weights)
    combined_labels = combine_labels(labels_dict, adjusted_weights)
    combined_severities = combine_severities(severities_dict, adjusted_weights)
    
    # Prepare metadata
    meta = {
        "model": "ensemble",
        "models_used": list(available_models),
        "weights": adjusted_weights,
        "feature_set": feature_set,
        "n_anomalies": sum(1 for l in combined_labels if l == -1),
        "individual_results": {
            name: {
                "n_anomalies": sum(1 for l in res['labels'] if l == -1),
                "meta": res.get('meta', {})
            }
            for name, res in results.items()
        }
    }
    
    # Output
    print(json.dumps({
        "scores": [round(float(s), 4) for s in combined_scores],
        "labels": combined_labels,
        "severities": combined_severities,
        "meta": meta
    }))

if __name__ == "__main__":
    main()
