#!/usr/bin/env python3
"""
LSTM Autoencoder for Anomaly Detection
Features:
- Deep learning-based anomaly detection
- Sequence-aware pattern recognition
- Reconstruction error-based scoring
- Model persistence and caching
- Adaptive threshold calculation
"""

import json
import sys
import os
import numpy as np
import warnings
warnings.filterwarnings('ignore')

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    from sklearn.preprocessing import StandardScaler
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_model_manager import ModelManager
except ImportError:
    ModelManager = None

# Configuration
SEQUENCE_LENGTH = 10  # Number of time steps to look back
LATENT_DIM = 4  # Compressed representation size
EPOCHS = 50
BATCH_SIZE = 32
VALIDATION_SPLIT = 0.2

# Physical bounds for clipping
BOUNDS = {
    "environmental": {"min": [5.0, 0.0], "max": [50.0, 100.0]},  # Temp, Humidity
    "power": {"min": [0.0, 0.0], "max": [100.0, 50000.0]}  # Current, Power
}

def create_lstm_autoencoder(input_dim, sequence_length, latent_dim=4):
    """
    Create LSTM Autoencoder architecture.
    
    Architecture:
    Encoder: LSTM -> LSTM -> Dense (latent)
    Decoder: RepeatVector -> LSTM -> LSTM -> TimeDistributed Dense
    """
    # Encoder
    encoder_inputs = keras.Input(shape=(sequence_length, input_dim))
    
    # First LSTM layer with return sequences
    x = layers.LSTM(32, activation='relu', return_sequences=True)(encoder_inputs)
    x = layers.Dropout(0.2)(x)
    
    # Second LSTM layer without return sequences (bottleneck)
    x = layers.LSTM(16, activation='relu', return_sequences=False)(x)
    x = layers.Dropout(0.2)(x)
    
    # Latent representation
    latent = layers.Dense(latent_dim, activation='relu', name='latent')(x)
    
    # Decoder
    x = layers.RepeatVector(sequence_length)(latent)
    
    # First decoder LSTM
    x = layers.LSTM(16, activation='relu', return_sequences=True)(x)
    x = layers.Dropout(0.2)(x)
    
    # Second decoder LSTM
    x = layers.LSTM(32, activation='relu', return_sequences=True)(x)
    x = layers.Dropout(0.2)(x)
    
    # Output layer
    decoder_outputs = layers.TimeDistributed(layers.Dense(input_dim))(x)
    
    # Complete autoencoder
    autoencoder = keras.Model(encoder_inputs, decoder_outputs, name='lstm_autoencoder')
    
    # Compile with Adam optimizer
    autoencoder.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']
    )
    
    return autoencoder

def create_sequences(data, sequence_length):
    """
    Create sequences for LSTM input.
    Returns: sequences array of shape (n_sequences, sequence_length, n_features)
    """
    sequences = []
    for i in range(len(data) - sequence_length + 1):
        sequences.append(data[i:i + sequence_length])
    return np.array(sequences)

def calculate_reconstruction_error(model, sequences):
    """
    Calculate reconstruction error for each sequence.
    Returns: array of MSE values
    """
    predictions = model.predict(sequences, verbose=0)
    mse = np.mean(np.square(sequences - predictions), axis=(1, 2))
    return mse

def calculate_adaptive_threshold(errors, contamination=0.05):
    """
    Calculate adaptive threshold based on error distribution.
    Uses percentile-based approach.
    """
    threshold_percentile = (1 - contamination) * 100
    threshold = np.percentile(errors, threshold_percentile)
    return threshold

def determine_severity(error, threshold, max_error):
    """
    Determine anomaly severity based on reconstruction error.
    """
    if error <= threshold:
        return "normal", 0
    
    # Normalize error relative to threshold
    normalized_error = (error - threshold) / (max_error - threshold + 1e-6)
    
    if normalized_error > 0.75:
        return "critical", 4
    elif normalized_error > 0.5:
        return "high", 3
    elif normalized_error > 0.25:
        return "medium", 2
    else:
        return "low", 1

def main():
    if not TENSORFLOW_AVAILABLE:
        print(json.dumps({
            "error": "TensorFlow not installed. Install with: pip install tensorflow",
            "scores": [],
            "labels": []
        }), file=sys.stderr)
        sys.exit(1)
    
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
    sequence_length = int(data.get("sequence_length", SEQUENCE_LENGTH))
    train_new = data.get("train_new", True)  # Whether to train new model or load cached
    
    if len(X) < sequence_length + 2:
        # Not enough data for LSTM
        print(json.dumps({
            "scores": [0.0] * len(X),
            "labels": [1] * len(X),
            "severities": [{"level": "normal", "score": 0}] * len(X),
            "meta": {"model": "lstm_autoencoder", "status": "insufficient_data"}
        }))
        return
    
    # Preprocessing
    X_arr = np.array(X, dtype=float)
    
    # Clip to physical bounds
    bounds = BOUNDS.get(feature_set, BOUNDS["environmental"])
    for j in range(min(X_arr.shape[1], len(bounds["min"]))):
        X_arr[:, j] = np.clip(X_arr[:, j], bounds["min"][j], bounds["max"][j])
    
    # Scaling
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_arr)
    
    # Create sequences
    sequences = create_sequences(X_scaled, sequence_length)
    
    if len(sequences) < 5:
        # Not enough sequences
        print(json.dumps({
            "scores": [0.0] * len(X),
            "labels": [1] * len(X),
            "severities": [{"level": "normal", "score": 0}] * len(X),
            "meta": {"model": "lstm_autoencoder", "status": "insufficient_sequences"}
        }))
        return
    
    input_dim = X_scaled.shape[1]
    
    # Model management
    mgr = ModelManager("lstm_autoencoder") if ModelManager else None
    model = None
    
    # Try to load cached model
    if mgr and not train_new:
        cache_key = f"lstm_ae_{feature_set}_{input_dim}_{sequence_length}"
        loaded_model, meta = mgr.load_model(cache_key)
        if loaded_model:
            model = loaded_model
            print(f"Loaded cached LSTM model", file=sys.stderr)
    
    # Train new model if needed
    if model is None:
        print(f"Training LSTM Autoencoder on {len(sequences)} sequences...", file=sys.stderr)
        
        model = create_lstm_autoencoder(input_dim, sequence_length, LATENT_DIM)
        
        # Train with early stopping
        early_stop = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True
        )
        
        # Suppress training output
        history = model.fit(
            sequences, sequences,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            validation_split=VALIDATION_SPLIT,
            callbacks=[early_stop],
            verbose=0
        )
        
        print(f"Training completed. Final loss: {history.history['loss'][-1]:.4f}", file=sys.stderr)
        
        # Save model
        if mgr:
            try:
                cache_key = f"lstm_ae_{feature_set}_{input_dim}_{sequence_length}"
                mgr.save_model(model, cache_key, metadata={
                    "feature_set": feature_set,
                    "sequence_length": sequence_length,
                    "input_dim": input_dim,
                    "final_loss": float(history.history['loss'][-1])
                })
            except Exception as e:
                print(f"Failed to save model: {e}", file=sys.stderr)
    
    # Calculate reconstruction errors
    reconstruction_errors = calculate_reconstruction_error(model, sequences)
    
    # Calculate adaptive threshold
    threshold = calculate_adaptive_threshold(reconstruction_errors, contamination)
    max_error = np.max(reconstruction_errors)
    
    print(f"Threshold: {threshold:.4f}, Max error: {max_error:.4f}", file=sys.stderr)
    
    # Generate outputs for all original data points
    # For first (sequence_length - 1) points, use average error
    out_scores = []
    out_labels = []
    out_severities = []
    
    avg_error = np.mean(reconstruction_errors)
    
    for i in range(len(X)):
        if i < sequence_length - 1:
            # Use average error for initial points
            error = avg_error
        else:
            # Use actual sequence error
            seq_idx = i - sequence_length + 1
            error = reconstruction_errors[seq_idx]
        
        # Normalize error to 0-1 score
        score = min(1.0, error / (threshold + 1e-6))
        
        # Label: 1 = normal, -1 = anomaly
        label = 1 if error <= threshold else -1
        
        # Severity
        sev_level, sev_score = determine_severity(error, threshold, max_error)
        
        out_scores.append(round(float(score), 4))
        out_labels.append(int(label))
        out_severities.append({
            "level": sev_level,
            "score": sev_score,
            "reconstruction_error": round(float(error), 4)
        })
    
    # Output
    print(json.dumps({
        "scores": out_scores,
        "labels": out_labels,
        "severities": out_severities,
        "meta": {
            "model": "lstm_autoencoder",
            "feature_set": feature_set,
            "sequence_length": sequence_length,
            "threshold": round(float(threshold), 4),
            "n_sequences": len(sequences),
            "n_anomalies": sum(1 for l in out_labels if l == -1)
        }
    }))

if __name__ == "__main__":
    main()
