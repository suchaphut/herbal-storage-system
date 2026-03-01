/**
 * Python ML Bridge – เรียกสคริปต์ Prophet และ Isolation Forest ผ่าน child_process
 *
 * เปิดใช้เมื่อตั้งค่า ENABLE_PYTHON_ML=1 (หรือ true) ใน environment
 * ต้องติดตั้ง Python และ dependencies: pip install -r scripts/requirements-ml.txt
 */

import { spawn, spawnSync, execSync } from 'child_process'
import path from 'path'

const PYTHON_SCRIPT_TIMEOUT_MS = 90_000 // 90 วินาที (Prophet ช้ากว่า)
const IF_SCRIPT_TIMEOUT_MS = 30_000
const LSTM_SCRIPT_TIMEOUT_MS = 120_000 // 120 วินาที (LSTM training ช้า)
const ENSEMBLE_SCRIPT_TIMEOUT_MS = 180_000 // 180 วินาที (รัน 3 models)
const RL_SCRIPT_TIMEOUT_MS = 60_000 // 60 วินาที (Q-Learning)

/** โฟลเดอร์โปรเจกต์ (root) สำหรับหา scripts/ */
function getProjectRoot(): string {
  // Next.js: process.cwd() คือ root โปรเจกต์
  return process.cwd()
}

/** path เต็มไปยังสคริปต์ Python */
function getScriptPath(name: string): string {
  return path.join(getProjectRoot(), 'scripts', name)
}

/** คำสั่ง Python: ใช้ PYTHON_PATH หรือ python3 / python */
function getPythonCommand(): string {
  return process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3')
}

export interface ProphetInput {
  timestamps: string[]
  temperature: number[]
  humidity: number[]
  /** Optional: ใช้พยากรณ์ power sensor (current, power) */
  current?: number[]
  power?: number[]
  horizon_hours?: number
  freq_minutes?: number
}

export interface ProphetPredictionPoint {
  time: string
  temperature: number
  humidity: number
  temp_low?: number
  temp_high?: number
  hum_low?: number
  hum_high?: number
}

export interface ProphetPowerPredictionPoint {
  time: string
  current: number
  power: number
}

export interface ProphetOutput {
  error?: string
  predictions: ProphetPredictionPoint[]
  predictions_power?: ProphetPowerPredictionPoint[] | null
  metrics: { mae: number; rmse: number; mape: number }
  actuals: { time: string; temperature: number; humidity: number }[]
  backtest_predicted: { time: string; temperature: number; humidity: number }[]
  meta?: {
    model_type: string
    version: string
    generated_at: string
    training_points?: number
    data_hash?: string
    uses_external_weather?: boolean
  }
}

/**
 * เรียก scripts/ml_prophet.py ด้วย JSON ทาง stdin ได้ผลทาง stdout
 */
export function runProphet(input: ProphetInput): Promise<ProphetOutput> {
  const payload: Record<string, unknown> = {
    timestamps: input.timestamps,
    temperature: input.temperature,
    humidity: input.humidity,
    horizon_hours: input.horizon_hours ?? 6,
    freq_minutes: input.freq_minutes ?? 30,
  }
  if (input.current?.length) payload.current = input.current
  if (input.power?.length) payload.power = input.power

  return runPythonScript(
    'ml_prophet.py',
    JSON.stringify(payload as object),
    PYTHON_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as ProphetOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

export interface IsolationForestInput {
  data: number[][] // แต่ละแถว [temp, humidity] หรือ [current, power] หรือ [voltage, current, power]
  contamination?: number
  /** ปรับพฤติกรรมให้เหมาะกับ environmental (temp, humidity) หรือ power (current, power) */
  feature_set?: 'environmental' | 'power'
}

export interface IsolationForestSeverity {
  level: 'normal' | 'low' | 'medium' | 'high' | 'critical'
  score: number
  explanation?: {
    main_feature: string
    deviation: number
    description: string
  }
}

export interface IsolationForestOutput {
  error?: string
  scores: number[]
  labels: number[] // 1 = normal, -1 = anomaly
  severities?: IsolationForestSeverity[]
  meta?: { feature_set: string; [key: string]: unknown }
}

export interface EnsembleAnomalyInput {
  data: number[][] // แต่ละแถว [temp, humidity] หรือ [current, power]
  contamination?: number
  feature_set?: 'environmental' | 'power'
  weights?: {
    isolation_forest?: number
    lstm_autoencoder?: number
    one_class_svm?: number
  }
}

export interface EnsembleAnomalyOutput {
  error?: string
  scores: number[]
  labels: number[]
  severities?: Array<{
    level: 'normal' | 'low' | 'medium' | 'high' | 'critical'
    score: number
    avg_score?: number
    explanations?: Array<{
      model: string
      explanation: unknown
    }>
  }>
  meta?: {
    model: string
    models_used: string[]
    weights: Record<string, number>
    feature_set: string
    n_anomalies: number
    individual_results?: Record<string, unknown>
  }
}

/**
 * เรียก scripts/ml_isolation_forest.py ด้วย JSON ทาง stdin ได้ scores/labels ออก stdout (async)
 */
export function runIsolationForest(input: IsolationForestInput): Promise<IsolationForestOutput> {
  const payload: Record<string, unknown> = {
    data: input.data,
    contamination: input.contamination ?? 0.05,
  }
  if (input.feature_set) payload.feature_set = input.feature_set

  return runPythonScript(
    'ml_isolation_forest.py',
    JSON.stringify(payload),
    IF_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as IsolationForestOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

/**
 * เรียก scripts/ml_ensemble_anomaly.py - รวม IF + LSTM + SVM (async)
 * ใช้สำหรับ anomaly detection ที่มีประสิทธิภาพสูง
 */
export function runEnsembleAnomaly(input: EnsembleAnomalyInput): Promise<EnsembleAnomalyOutput> {
  const payload: Record<string, unknown> = {
    data: input.data,
    contamination: input.contamination ?? 0.05,
  }
  if (input.feature_set) payload.feature_set = input.feature_set
  if (input.weights) payload.weights = input.weights

  return runPythonScript(
    'ml_ensemble_anomaly.py',
    JSON.stringify(payload),
    ENSEMBLE_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as EnsembleAnomalyOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

/**
 * เรียก scripts/ml_lstm_autoencoder.py (async)
 */
export function runLSTMAutoencoder(input: IsolationForestInput & { sequence_length?: number; train_new?: boolean }): Promise<IsolationForestOutput> {
  const payload: Record<string, unknown> = {
    data: input.data,
    contamination: input.contamination ?? 0.05,
  }
  if (input.feature_set) payload.feature_set = input.feature_set
  if (input.sequence_length) payload.sequence_length = input.sequence_length
  if (input.train_new !== undefined) payload.train_new = input.train_new

  return runPythonScript(
    'ml_lstm_autoencoder.py',
    JSON.stringify(payload),
    LSTM_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as IsolationForestOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

/**
 * เรียก scripts/ml_ocsvm.py (async)
 */
export function runOneClassSVM(input: IsolationForestInput & { kernel?: string; auto_tune?: boolean }): Promise<IsolationForestOutput> {
  const payload: Record<string, unknown> = {
    data: input.data,
    contamination: input.contamination ?? 0.05,
  }
  if (input.feature_set) payload.feature_set = input.feature_set
  if (input.kernel) payload.kernel = input.kernel
  if (input.auto_tune !== undefined) payload.auto_tune = input.auto_tune

  return runPythonScript(
    'ml_ocsvm.py',
    JSON.stringify(payload),
    IF_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as IsolationForestOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

/**
 * รุ่น sync สำหรับใช้ใน detectAnomaly (blocking ไม่เกิน IF_SCRIPT_TIMEOUT_MS)
 */
export function runIsolationForestSync(input: IsolationForestInput): IsolationForestOutput {
  const payload: Record<string, unknown> = {
    data: input.data,
    contamination: input.contamination ?? 0.05,
  }
  if (input.feature_set) payload.feature_set = input.feature_set
  const scriptPath = getScriptPath('ml_isolation_forest.py')
  const python = getPythonCommand()
  const result = spawnSync(python, [scriptPath], {
    cwd: getProjectRoot(),
    input: JSON.stringify(payload as object),
    encoding: 'utf8',
    timeout: IF_SCRIPT_TIMEOUT_MS,
    maxBuffer: 2 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Python ml_isolation_forest.py exited ${result.status}. stderr: ${result.stderr || 'none'}`
    )
  }
  const stdout = result.stdout || ''
  const lines = stdout.trim().split('\n').filter(Boolean)
  const lastLine = lines[lines.length - 1] ?? stdout.trim()
  const out = JSON.parse(lastLine) as IsolationForestOutput
  if (out.error) throw new Error(out.error)
  return out
}

/**
 * รันสคริปต์ Python ด้วย stdin = inputJson, อ่าน stdout เป็น string (ใช้บรรทัดสุดท้ายที่เป็น JSON ถ้ามีหลายบรรทัด)
 */
function runPythonScript(
  scriptName: string,
  inputJson: string,
  timeoutMs: number
): Promise<string> {
  const scriptPath = getScriptPath(scriptName)
  const python = getPythonCommand()

  return new Promise((resolve, reject) => {
    const proc = spawn(python, [scriptPath], {
      cwd: getProjectRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Python script ${scriptName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start Python: ${err.message}. Set PYTHON_PATH if needed.`))
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && code !== null) {
        reject(new Error(`Python ${scriptName} exited with code ${code}. stderr: ${stderr}`))
        return
      }
      // สคริปต์อาจพิมพ์ debug มาก่อน บรรทัดสุดท้ายมักเป็น JSON
      const lines = stdout.trim().split('\n').filter(Boolean)
      const lastLine = lines[lines.length - 1] ?? stdout.trim()
      try {
        JSON.parse(lastLine)
        resolve(lastLine)
      } catch {
        resolve(stdout.trim() || '{}')
      }
    })

    proc.stdin.write(inputJson, (err) => {
      if (err) {
        clearTimeout(timer)
        proc.kill()
        reject(err)
      } else {
        proc.stdin.end()
      }
    })
  })
}

// ============================================================================
// Weather-enhanced Prophet (Time Series with External Regressors)
// ============================================================================

export interface ProphetWithWeatherInput {
  timestamps: string[]
  temperature: number[]
  humidity: number[]
  external_temperature?: number[]
  external_humidity?: number[]
  horizon_hours?: number
  freq_minutes?: number
}

/**
 * เรียก scripts/ml_prophet_with_weather.py
 * ใช้ข้อมูลอากาศภายนอกเป็น regressor เพิ่มความแม่นยำ
 */
export function runProphetWithWeather(input: ProphetWithWeatherInput): Promise<ProphetOutput> {
  const payload: Record<string, unknown> = {
    timestamps: input.timestamps,
    temperature: input.temperature,
    humidity: input.humidity,
    horizon_hours: input.horizon_hours ?? 6,
    freq_minutes: input.freq_minutes ?? 30,
  }
  if (input.external_temperature?.length) payload.external_temperature = input.external_temperature
  if (input.external_humidity?.length) payload.external_humidity = input.external_humidity

  return runPythonScript(
    'ml_prophet_with_weather.py',
    JSON.stringify(payload as object),
    PYTHON_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as ProphetOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

// ============================================================================
// RL-based AC Optimizer (Q-Learning)
// ============================================================================

export interface RLACEpisode {
  indoor_temp: number
  indoor_humidity: number
  outdoor_temp: number
  outdoor_humidity: number
  ac_power: number
  ac_running: boolean
  hour: number
  target_temp: number
  next_indoor_temp: number
}

export interface RLACTrainInput {
  mode: 'train'
  episodes: RLACEpisode[]
  room_id: string
  max_power?: number
}

export interface RLACTrainOutput {
  error?: string
  trained?: boolean
  total_episodes?: number
  thermal_model_mae?: number | null
  thermal_model_rmse?: number | null
}

export interface RLACRecommendInput {
  mode: 'recommend'
  room_id: string
  indoor_temp: number
  indoor_humidity: number
  outdoor_temp: number
  outdoor_humidity: number
  ac_power: number
  ac_running: boolean
  target_temp: number
  hour: number
  max_power?: number
}

export interface RLACRecommendOutput {
  error?: string
  action: string | null
  confidence: number
  model_available: boolean
  reason?: string
  q_values?: Record<string, number>
  energy_saving_potential?: number
  total_episodes?: number
  state?: {
    temp_delta_bin: number
    outdoor_temp_bin: number
    ac_running: boolean
    hour_bucket: number
  }
}

/**
 * Train RL model จากข้อมูลย้อนหลัง
 */
export function trainRLACOptimizer(input: RLACTrainInput): Promise<RLACTrainOutput> {
  return runPythonScript(
    'ml_ac_rl.py',
    JSON.stringify(input),
    RL_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as RLACTrainOutput
    if (out.error) throw new Error(out.error)
    return out
  })
}

/**
 * ขอคำแนะนำจาก RL model
 */
export function getRLACRecommendation(input: RLACRecommendInput): Promise<RLACRecommendOutput> {
  return runPythonScript(
    'ml_ac_rl.py',
    JSON.stringify(input),
    RL_SCRIPT_TIMEOUT_MS
  ).then((raw) => {
    const out = JSON.parse(raw) as RLACRecommendOutput
    if (out.error && !out.action) throw new Error(out.error)
    return out
  })
}

/** ตรวจว่า Python ML เปิดใช้และพร้อม (มีคำสั่ง python) */
export function isPythonMLAvailable(): boolean {
  const enabled =
    process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'
  if (!enabled) return false
  const python = getPythonCommand()
  try {
    execSync(`"${python}" --version`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
