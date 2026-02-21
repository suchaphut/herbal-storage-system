#!/usr/bin/env python3
"""
ML Model Manager - Handles persistence, caching, and versioning of ML models.
"""

import os
import hashlib
import json
import time
from datetime import datetime
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml_models')
os.makedirs(MODEL_DIR, exist_ok=True)

class ModelManager:
    def __init__(self, model_type):
        self.model_type = model_type
        self.base_dir = os.path.join(MODEL_DIR, model_type)
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_data_hash(self, data_input):
        """Create a hash of the input data to identify unique datasets."""
        # Handle JSON strings by parsing and sorting keys
        if isinstance(data_input, str):
            try:
                # Try to parse as JSON to canonicalize
                json_data = json.loads(data_input)
                # Sort keys to ensure {"a":1, "b":2} == {"b":2, "a":1}
                canonical_str = json.dumps(json_data, sort_keys=True)
            except json.JSONDecodeError:
                # Not JSON, use as-is
                canonical_str = data_input
        elif isinstance(data_input, (dict, list)):
            canonical_str = json.dumps(data_input, sort_keys=True)
        else:
            canonical_str = str(data_input)
            
        return hashlib.md5(canonical_str.encode('utf-8')).hexdigest()

    def _get_model_path(self, data_hash, version='latest'):
        return os.path.join(self.base_dir, f"{data_hash}_{version}.joblib")

    def _get_metadata_path(self, data_hash, version='latest'):
        return os.path.join(self.base_dir, f"{data_hash}_{version}_meta.json")

    def save_model(self, model, data_input, metrics=None, metadata=None):
        """Save a trained model with metadata using atomic writes."""
        data_hash = self._get_data_hash(data_input)
        timestamp = datetime.now().isoformat()
        
        # Paths
        model_path = self._get_model_path(data_hash)
        meta_path = self._get_metadata_path(data_hash)
        
        # Temporary paths for atomic write
        tmp_model_path = model_path + ".tmp"
        tmp_meta_path = meta_path + ".tmp"
        
        try:
            # Save model to temp file
            joblib.dump(model, tmp_model_path)
            
            # Save metadata to temp file
            meta = {
                'timestamp': timestamp,
                'metrics': metrics or {},
                'metadata': metadata or {},
                'data_hash': data_hash,
                'model_type': self.model_type
            }
            
            with open(tmp_meta_path, 'w') as f:
                json.dump(meta, f, indent=2)
                
            # Rename to final paths (atomic operation on POSIX, usually safe enough on Windows)
            if os.path.exists(model_path):
                os.remove(model_path)
            os.rename(tmp_model_path, model_path)
            
            if os.path.exists(meta_path):
                os.remove(meta_path)
            os.rename(tmp_meta_path, meta_path)
                
            return data_hash
            
        except Exception as e:
            # Cleanup temp files
            if os.path.exists(tmp_model_path):
                os.remove(tmp_model_path)
            if os.path.exists(tmp_meta_path):
                os.remove(tmp_meta_path)
            raise e

    def load_model(self, data_input, max_age_seconds=3600*24):
        """Load a cached model if it exists and is not too old."""
        data_hash = self._get_data_hash(data_input)
        model_path = self._get_model_path(data_hash)
        meta_path = self._get_metadata_path(data_hash)
        
        if not os.path.exists(model_path) or not os.path.exists(meta_path):
            return None, None
            
        try:
            with open(meta_path, 'r') as f:
                meta = json.load(f)
                
            # Check age
            saved_time = datetime.fromisoformat(meta['timestamp'])
            age_seconds = (datetime.now() - saved_time).total_seconds()
            
            if age_seconds > max_age_seconds:
                return None, None
                
            model = joblib.load(model_path)
            return model, meta
            
        except Exception as e:
            # If load fails, return None to force retraining
            # Could log error here
            return None, None

    def list_models(self):
        """List all saved models."""
        models = []
        if not os.path.exists(self.base_dir):
            return []
            
        for f in os.listdir(self.base_dir):
            if f.endswith('_meta.json'):
                try:
                    with open(os.path.join(self.base_dir, f), 'r') as meta_file:
                        models.append(json.load(meta_file))
                except Exception:
                    pass
        return models

    def cleanup_old_models(self, max_age_days=7, max_models=50):
        """
        Remove model files that are older than max_age_days.
        If total model count still exceeds max_models after age-based cleanup,
        remove the oldest ones until under the limit.
        Returns number of model pairs removed.
        """
        if not os.path.exists(self.base_dir):
            return 0

        removed = 0
        max_age_seconds = max_age_days * 86400
        entries = []  # (timestamp, data_hash) for surviving models

        for f in os.listdir(self.base_dir):
            if not f.endswith('_meta.json'):
                continue
            meta_path = os.path.join(self.base_dir, f)
            try:
                with open(meta_path, 'r') as mf:
                    meta = json.load(mf)
                saved_time = datetime.fromisoformat(meta['timestamp'])
                age_seconds = (datetime.now() - saved_time).total_seconds()
                data_hash = meta.get('data_hash', '')
                if age_seconds > max_age_seconds:
                    self._delete_model_files(data_hash)
                    removed += 1
                else:
                    entries.append((saved_time, data_hash))
            except Exception:
                # Corrupt metadata — remove it
                try:
                    os.remove(meta_path)
                except Exception:
                    pass

        # Cap total count: remove oldest first
        if len(entries) > max_models:
            entries.sort(key=lambda x: x[0])  # oldest first
            for saved_time, data_hash in entries[:len(entries) - max_models]:
                self._delete_model_files(data_hash)
                removed += 1

        return removed

    def _delete_model_files(self, data_hash):
        """Delete .joblib and _meta.json files for a given data_hash."""
        for path in [
            self._get_model_path(data_hash),
            self._get_metadata_path(data_hash),
        ]:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
