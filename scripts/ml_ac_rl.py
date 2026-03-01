#!/usr/bin/env python3
"""
ML AC Optimizer — Q-Learning + Learned Thermal Model
=====================================================
Uses historical sensor + weather + power data to:
1. Learn room thermal dynamics (how temp changes given conditions & AC state)
2. Train Q-table via offline reinforcement learning
3. Recommend optimal AC action that minimizes energy while maintaining comfort

State space (discretized):
  - temp_delta   : indoor_temp - target_temp  (bins)
  - outdoor_temp : outside temperature        (bins)
  - ac_running   : 0/1
  - hour_bucket  : time of day               (4 buckets)

Actions: increase, decrease, maintain, turn_on, turn_off

Reward: -(comfort_penalty + energy_cost)
  comfort_penalty = abs(temp_delta) * 10
  energy_cost     = normalized_power * 5
"""

import json
import sys
import os
import numpy as np
import pickle
import hashlib
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ml_model_manager import ModelManager
except ImportError:
    ModelManager = None

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ACTIONS = ['increase', 'decrease', 'maintain', 'turn_on', 'turn_off']
ACTION_IDX = {a: i for i, a in enumerate(ACTIONS)}
N_ACTIONS = len(ACTIONS)

# Discretization bins
TEMP_DELTA_BINS = [-999, -3, -1, 0, 1, 3, 999]      # 6 bins
OUTDOOR_TEMP_BINS = [-999, 25, 30, 35, 999]           # 4 bins
HOUR_BUCKETS = [0, 6, 12, 18, 24]                     # 4 buckets

# RL hyperparameters
ALPHA = 0.1       # Learning rate
GAMMA = 0.95      # Discount factor
EPSILON = 0.1     # Exploration rate (for training)

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml_models', 'ac_rl')
os.makedirs(MODEL_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# State discretization
# ---------------------------------------------------------------------------
def discretize(value, bins):
    """Return bin index for a continuous value."""
    for i in range(len(bins) - 1):
        if value < bins[i + 1]:
            return i
    return len(bins) - 2

def get_state(temp_delta, outdoor_temp, ac_running, hour):
    """Convert continuous state to discrete state tuple."""
    td = discretize(temp_delta, TEMP_DELTA_BINS)
    ot = discretize(outdoor_temp, OUTDOOR_TEMP_BINS)
    ac = 1 if ac_running else 0
    hb = discretize(hour, HOUR_BUCKETS)
    return (td, ot, ac, hb)

def state_space_size():
    return (
        len(TEMP_DELTA_BINS) - 1,
        len(OUTDOOR_TEMP_BINS) - 1,
        2,
        len(HOUR_BUCKETS) - 1,
    )

# ---------------------------------------------------------------------------
# Reward function
# ---------------------------------------------------------------------------
def compute_reward(temp_delta, ac_power, max_power=3000):
    """
    Reward = -(comfort_penalty + energy_cost)
    Goal: minimize both discomfort and energy usage.
    """
    comfort_penalty = abs(temp_delta) * 10.0
    # Normalize power to 0-1 range
    normalized_power = min(ac_power / max_power, 1.0) if max_power > 0 else 0
    energy_cost = normalized_power * 5.0
    return -(comfort_penalty + energy_cost)

# ---------------------------------------------------------------------------
# Infer action from consecutive data points
# ---------------------------------------------------------------------------
def infer_action(prev_power, curr_power, prev_ac_on, curr_ac_on):
    """Infer what AC action was taken between two timesteps."""
    if not prev_ac_on and curr_ac_on:
        return 'turn_on'
    if prev_ac_on and not curr_ac_on:
        return 'turn_off'
    if curr_ac_on:
        power_change = curr_power - prev_power
        if power_change > 50:
            return 'increase'
        elif power_change < -50:
            return 'decrease'
    return 'maintain'

# ---------------------------------------------------------------------------
# Q-Learning
# ---------------------------------------------------------------------------
class QLearningAgent:
    def __init__(self):
        dims = state_space_size()
        self.q_table = np.zeros((*dims, N_ACTIONS))
        self.visit_count = np.zeros((*dims, N_ACTIONS), dtype=int)
        self.total_episodes = 0

    def get_q_values(self, state):
        return self.q_table[state]

    def best_action(self, state):
        q_vals = self.get_q_values(state)
        return ACTIONS[int(np.argmax(q_vals))]

    def update(self, state, action_idx, reward, next_state):
        current_q = self.q_table[state + (action_idx,)]
        next_max_q = np.max(self.q_table[next_state])
        new_q = current_q + ALPHA * (reward + GAMMA * next_max_q - current_q)
        self.q_table[state + (action_idx,)] = new_q
        self.visit_count[state + (action_idx,)] += 1

    def confidence(self, state):
        """Confidence based on visit count for this state."""
        visits = self.visit_count[state]
        total_visits = int(np.sum(visits))
        if total_visits == 0:
            return 0.0
        # Confidence increases with log of visits, caps at ~0.95
        return min(0.95, np.log1p(total_visits) / 10.0)

    def save(self, path):
        data = {
            'q_table': self.q_table,
            'visit_count': self.visit_count,
            'total_episodes': self.total_episodes,
        }
        with open(path, 'wb') as f:
            pickle.dump(data, f)

    def load(self, path):
        if not os.path.exists(path):
            return False
        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
            self.q_table = data['q_table']
            self.visit_count = data['visit_count']
            self.total_episodes = data.get('total_episodes', 0)
            return True
        except Exception:
            return False

# ---------------------------------------------------------------------------
# Thermal model (simple gradient boosted regression)
# ---------------------------------------------------------------------------
def train_thermal_model(episodes):
    """
    Train a model: next_temp = f(current_temp, outdoor_temp, ac_power, hour, humidity)
    Used to generate synthetic experience for Q-learning when data is sparse.
    """
    try:
        from sklearn.ensemble import GradientBoostingRegressor
    except ImportError:
        return None

    if len(episodes) < 10:
        return None

    X = []
    y = []
    for ep in episodes:
        X.append([
            ep['indoor_temp'],
            ep['outdoor_temp'],
            ep['ac_power'],
            ep['hour'],
            ep['indoor_humidity'],
            ep['outdoor_humidity'],
        ])
        y.append(ep['next_indoor_temp'])

    X = np.array(X)
    y = np.array(y)

    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X, y)

    # Calculate training metrics
    y_pred = model.predict(X)
    mae = float(np.mean(np.abs(y - y_pred)))
    rmse = float(np.sqrt(np.mean((y - y_pred) ** 2)))

    return {
        'model': model,
        'mae': mae,
        'rmse': rmse,
        'n_samples': len(X),
    }

# ---------------------------------------------------------------------------
# Main training from historical data
# ---------------------------------------------------------------------------
def train_from_history(data):
    """
    Train Q-learning agent from historical data.
    
    Input data format:
    {
        "episodes": [
            {
                "indoor_temp": float,
                "indoor_humidity": float,
                "outdoor_temp": float,
                "outdoor_humidity": float,
                "ac_power": float,
                "ac_running": bool,
                "hour": int,
                "target_temp": float,
                "next_indoor_temp": float (temp at next timestep)
            },
            ...
        ],
        "room_id": str,
        "max_power": float (optional, default 3000)
    }
    """
    episodes = data.get('episodes', [])
    room_id = data.get('room_id', 'unknown')
    max_power = data.get('max_power', 3000)

    if len(episodes) < 5:
        return {
            'error': f'Insufficient data ({len(episodes)} episodes, need >= 5)',
            'recommendation': None,
        }

    # Initialize or load agent
    agent = QLearningAgent()
    model_path = os.path.join(MODEL_DIR, f'{room_id}_qtable.pkl')
    agent.load(model_path)

    # Build experience from consecutive data points
    for i in range(len(episodes) - 1):
        ep = episodes[i]
        next_ep = episodes[i + 1]

        temp_delta = ep['indoor_temp'] - ep['target_temp']
        next_temp_delta = next_ep['indoor_temp'] - next_ep['target_temp']

        state = get_state(temp_delta, ep['outdoor_temp'], ep['ac_running'], ep['hour'])
        next_state = get_state(next_temp_delta, next_ep['outdoor_temp'], next_ep['ac_running'], next_ep['hour'])

        # Infer action taken
        action = infer_action(
            ep['ac_power'], next_ep['ac_power'],
            ep['ac_running'], next_ep['ac_running']
        )
        action_idx = ACTION_IDX[action]

        # Compute reward
        reward = compute_reward(next_temp_delta, next_ep['ac_power'], max_power)

        # Q-learning update
        agent.update(state, action_idx, reward, next_state)

    agent.total_episodes += len(episodes) - 1

    # Train thermal model for synthetic experience
    thermal_result = train_thermal_model(episodes)

    # If thermal model available, generate synthetic experience
    if thermal_result and thermal_result['model'] is not None:
        thermal_model = thermal_result['model']
        # Generate synthetic episodes by simulating different actions
        for ep in episodes[-min(50, len(episodes)):]:
            temp_delta = ep['indoor_temp'] - ep['target_temp']
            state = get_state(temp_delta, ep['outdoor_temp'], ep['ac_running'], ep['hour'])

            for action_name in ACTIONS:
                # Simulate action effect on power
                sim_power = ep['ac_power']
                sim_ac_on = ep['ac_running']
                if action_name == 'increase':
                    sim_power = min(sim_power + 300, max_power)
                    sim_ac_on = True
                elif action_name == 'decrease':
                    sim_power = max(sim_power - 300, 0)
                elif action_name == 'turn_on':
                    sim_power = max(sim_power, 800)
                    sim_ac_on = True
                elif action_name == 'turn_off':
                    sim_power = 0
                    sim_ac_on = False

                # Predict next temp using thermal model
                features = np.array([[
                    ep['indoor_temp'],
                    ep['outdoor_temp'],
                    sim_power,
                    ep['hour'],
                    ep['indoor_humidity'],
                    ep['outdoor_humidity'],
                ]])
                predicted_next_temp = thermal_model.predict(features)[0]
                next_temp_delta = predicted_next_temp - ep['target_temp']

                next_state = get_state(next_temp_delta, ep['outdoor_temp'], sim_ac_on, ep['hour'])
                reward = compute_reward(next_temp_delta, sim_power, max_power)

                action_idx = ACTION_IDX[action_name]
                # Use lower learning rate for synthetic data
                old_alpha = ALPHA
                agent.update(state, action_idx, reward * 0.5, next_state)

    # Save trained agent
    try:
        agent.save(model_path)
    except Exception as e:
        print(f"Warning: Could not save model: {e}", file=sys.stderr)

    return {
        'trained': True,
        'total_episodes': agent.total_episodes,
        'thermal_model_mae': thermal_result['mae'] if thermal_result else None,
        'thermal_model_rmse': thermal_result['rmse'] if thermal_result else None,
    }


def recommend(data):
    """
    Get AC recommendation using trained RL model.
    
    Input:
    {
        "room_id": str,
        "indoor_temp": float,
        "indoor_humidity": float,
        "outdoor_temp": float,
        "outdoor_humidity": float,
        "ac_power": float,
        "ac_running": bool,
        "target_temp": float,
        "hour": int,
        "max_power": float (optional)
    }
    """
    room_id = data.get('room_id', 'unknown')
    indoor_temp = data['indoor_temp']
    target_temp = data['target_temp']
    outdoor_temp = data['outdoor_temp']
    ac_running = data['ac_running']
    ac_power = data.get('ac_power', 0)
    hour = data.get('hour', datetime.now().hour)
    max_power = data.get('max_power', 3000)

    temp_delta = indoor_temp - target_temp
    state = get_state(temp_delta, outdoor_temp, ac_running, hour)

    # Load trained agent
    agent = QLearningAgent()
    model_path = os.path.join(MODEL_DIR, f'{room_id}_qtable.pkl')
    model_loaded = agent.load(model_path)

    if not model_loaded or agent.total_episodes < 5:
        return {
            'action': None,
            'confidence': 0.0,
            'model_available': False,
            'reason': 'ยังไม่มีข้อมูลเพียงพอสำหรับ ML — ใช้ rule-based แทน',
            'total_episodes': agent.total_episodes if model_loaded else 0,
        }

    # Get Q-values for current state
    q_values = agent.get_q_values(state)
    confidence = agent.confidence(state)

    # Best action
    best_action_idx = int(np.argmax(q_values))
    best_action = ACTIONS[best_action_idx]

    # Filter out invalid actions
    if not ac_running and best_action in ['increase', 'decrease']:
        # Can't increase/decrease if AC is off → switch to turn_on
        best_action = 'turn_on'
    if ac_running and best_action == 'turn_on':
        best_action = 'increase'
    if not ac_running and best_action == 'turn_off':
        best_action = 'maintain'

    # Compute energy saving potential
    maintain_q = q_values[ACTION_IDX['maintain']]
    best_q = q_values[best_action_idx]
    # Energy saving is estimated from Q-value improvement
    energy_saving = max(0, min(40, int((best_q - maintain_q) * 5))) if maintain_q != 0 else 0

    # All Q-values for transparency
    q_breakdown = {ACTIONS[i]: float(q_values[i]) for i in range(N_ACTIONS)}

    return {
        'action': best_action,
        'confidence': float(confidence),
        'model_available': True,
        'q_values': q_breakdown,
        'energy_saving_potential': energy_saving,
        'total_episodes': agent.total_episodes,
        'state': {
            'temp_delta_bin': state[0],
            'outdoor_temp_bin': state[1],
            'ac_running': bool(state[2]),
            'hour_bucket': state[3],
        },
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def main():
    try:
        raw = sys.stdin.read()
        if not raw:
            return
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    mode = data.get('mode', 'recommend')

    if mode == 'train':
        result = train_from_history(data)
    elif mode == 'recommend':
        result = recommend(data)
    else:
        result = {'error': f'Unknown mode: {mode}'}

    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
