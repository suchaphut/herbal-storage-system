import { ACRecommendation, ExternalWeatherData } from './types'
import { ClimateAnalyzer } from './climate-analyzer'
import { getRLACRecommendation, trainRLACOptimizer, type RLACRecommendOutput, type RLACEpisode } from './ml-python-bridge'

const ENABLE_PYTHON_ML =
  process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'

export interface ACOptimizerInput {
  roomId: string
  currentTemperature: number
  currentHumidity: number
  targetTemperature: number
  targetHumidity: number
  acPower: number // Current AC power consumption (W)
  acRunning: boolean
  outsideWeather: ExternalWeatherData
  forecastWeather?: ExternalWeatherData[] // Next few hours forecast
  energySavingMode?: boolean
}

export class ACOptimizer {
  /**
   * สร้างคำแนะนำการปรับระดับแอร์
   */
  static generateRecommendation(input: ACOptimizerInput): ACRecommendation {
    const {
      roomId,
      currentTemperature,
      currentHumidity,
      targetTemperature,
      targetHumidity,
      acPower,
      acRunning,
      outsideWeather,
      forecastWeather = [],
      energySavingMode = false,
    } = input

    // วิเคราะห์สภาพปัจจุบัน
    const tempDiff = currentTemperature - targetTemperature
    const humidityDiff = currentHumidity - targetHumidity
    const outsideTempDiff = currentTemperature - outsideWeather.temperature

    // คำนวณ Heat Index
    const insideHeatIndex = ClimateAnalyzer.calculateHeatIndex(currentTemperature, currentHumidity)
    const outsideHeatIndex = ClimateAnalyzer.calculateHeatIndex(
      outsideWeather.temperature,
      outsideWeather.humidity
    )

    // วิเคราะห์แนวโน้มจาก forecast
    const { nextHourTrend, suggestedPreemptiveAction } = this.analyzeForecast(
      forecastWeather,
      currentTemperature
    )

    // สร้างคำแนะนำ
    const recommendation = this.determineAction(
      tempDiff,
      humidityDiff,
      outsideTempDiff,
      outsideWeather,
      acRunning,
      energySavingMode,
      nextHourTrend
    )

    return {
      roomId,
      timestamp: new Date(),
      currentStatus: {
        temperature: currentTemperature,
        humidity: currentHumidity,
        acPower,
        acRunning,
      },
      externalConditions: {
        temperature: outsideWeather.temperature,
        humidity: outsideWeather.humidity,
        weatherCondition: outsideWeather.weatherCondition,
      },
      recommendation,
      forecast: {
        nextHourTrend,
        suggestedPreemptiveAction,
      },
      generatedAt: new Date(),
    }
  }

  /**
   * กำหนด action ที่แนะนำ
   */
  private static determineAction(
    tempDiff: number,
    humidityDiff: number,
    outsideTempDiff: number,
    outsideWeather: ExternalWeatherData,
    acRunning: boolean,
    energySavingMode: boolean,
    nextHourTrend: 'warming' | 'cooling' | 'stable'
  ): ACRecommendation['recommendation'] {
    let action: ACRecommendation['recommendation']['action'] = 'maintain'
    let reason = ''
    let energySavingPotential = 0
    let priority: 'low' | 'medium' | 'high' = 'low'
    let targetTemperature: number | undefined

    // กรณีอุณหภูมิสูงเกินไป
    if (tempDiff > 2) {
      if (!acRunning) {
        action = 'turn_on'
        reason = 'อุณหภูมิสูงกว่าเป้าหมาย แนะนำเปิดแอร์'
        priority = 'high'
      } else {
        action = 'increase'
        reason = 'อุณหภูมิสูงกว่าเป้าหมาย แนะนำเพิ่มกำลังแอร์'
        priority = tempDiff > 4 ? 'high' : 'medium'
      }
      energySavingPotential = 0
    }
    // กรณีอุณหภูมิต่ำเกินไป
    else if (tempDiff < -2) {
      if (acRunning) {
        action = 'decrease'
        reason = 'อุณหภูมิต่ำกว่าเป้าหมาย แนะนำลดกำลังแอร์'
        priority = 'medium'
        energySavingPotential = 20
      } else {
        action = 'maintain'
        reason = 'อุณหภูมิต่ำกว่าเป้าหมาย ไม่ต้องเปิดแอร์'
        priority = 'low'
      }
    }
    // กรณีอุณหภูมิใกล้เคียงเป้าหมาย
    else {
      // ตรวจสอบสภาพอากาศภายนอก
      if (outsideWeather.temperature < 25 && energySavingMode) {
        if (acRunning) {
          action = 'decrease'
          reason = 'อากาศภายนอกเย็น แนะนำลดกำลังแอร์เพื่อประหยัดพลังงาน'
          energySavingPotential = 30
          priority = 'medium'
        } else {
          action = 'maintain'
          reason = 'อากาศภายนอกเย็น ไม่จำเป็นต้องเปิดแอร์'
          energySavingPotential = 100
          priority = 'low'
        }
      } else if (outsideWeather.temperature > 35) {
        if (!acRunning) {
          action = 'turn_on'
          reason = 'อากาศภายนอกร้อนจัด แนะนำเปิดแอร์เพื่อรักษาอุณหภูมิ'
          priority = 'high'
        } else {
          action = 'maintain'
          reason = 'อากาศภายนอกร้อนจัด รักษาระดับแอร์ปัจจุบัน'
          priority = 'medium'
        }
      } else {
        action = 'maintain'
        reason = 'อุณหภูมิอยู่ในระดับเหมาะสม'
        priority = 'low'
        energySavingPotential = acRunning ? 0 : 100
      }
    }

    // ปรับตาม forecast
    if (nextHourTrend === 'warming' && action === 'maintain') {
      reason += ' (คาดว่าอุณหภูมิจะเพิ่มขึ้นในชั่วโมงหน้า)'
    } else if (nextHourTrend === 'cooling' && action === 'increase') {
      action = 'maintain'
      reason = 'คาดว่าอุณหภูมิจะลดลงเอง ไม่จำเป็นต้องเพิ่มกำลังแอร์'
      energySavingPotential = 15
    }

    return {
      action,
      targetTemperature,
      reason,
      energySavingPotential,
      priority,
    }
  }

  /**
   * วิเคราะห์ forecast เพื่อหาแนวโน้ม
   */
  private static analyzeForecast(
    forecast: ExternalWeatherData[],
    currentTemp: number
  ): {
    nextHourTrend: 'warming' | 'cooling' | 'stable'
    suggestedPreemptiveAction?: string
  } {
    if (forecast.length === 0) {
      return { nextHourTrend: 'stable' }
    }

    // เอาข้อมูล 1-2 ชั่วโมงข้างหน้า
    const nextHourForecast = forecast.slice(0, 2)
    const avgForecastTemp =
      nextHourForecast.reduce((sum, f) => sum + f.temperature, 0) / nextHourForecast.length

    const tempChange = avgForecastTemp - currentTemp

    let nextHourTrend: 'warming' | 'cooling' | 'stable' = 'stable'
    let suggestedPreemptiveAction: string | undefined

    if (tempChange > 2) {
      nextHourTrend = 'warming'
      suggestedPreemptiveAction = 'เตรียมเพิ่มกำลังแอร์ในอีก 30-60 นาที'
    } else if (tempChange < -2) {
      nextHourTrend = 'cooling'
      suggestedPreemptiveAction = 'อาจลดกำลังแอร์ได้ในอีก 30-60 นาที'
    }

    return { nextHourTrend, suggestedPreemptiveAction }
  }

  /**
   * คำนวณ Energy Efficiency Ratio (EER) ของแอร์
   */
  static calculateEER(
    coolingCapacity: number, // BTU/hr
    powerConsumption: number // Watts
  ): number {
    if (powerConsumption === 0) return 0
    return coolingCapacity / powerConsumption
  }

  /**
   * ประมาณการ Cooling Capacity ที่ต้องการ (BTU/hr)
   */
  static estimateRequiredCoolingCapacity(
    roomArea: number, // m²
    ceilingHeight: number = 2.5, // m
    outsideTemp: number,
    targetTemp: number
  ): number {
    const roomVolume = roomArea * ceilingHeight
    const tempDiff = outsideTemp - targetTemp

    // สูตรประมาณการ: 100-150 BTU/hr per m² (ขึ้นกับฉนวน)
    const baseBTU = roomArea * 120

    // เพิ่มตามความต่างอุณหภูมิ
    const tempFactor = 1 + (tempDiff / 10) * 0.2

    return Math.round(baseBTU * tempFactor)
  }

  /**
   * RL-enhanced recommendation: ใช้ Q-Learning model เสริม rule-based
   * ถ้า RL model ไม่พร้อม จะ fallback เป็น rule-based อัตโนมัติ
   */
  static async generateWithRL(input: ACOptimizerInput): Promise<ACRecommendation> {
    // เริ่มจาก rule-based recommendation
    const baseRecommendation = this.generateRecommendation(input)

    if (!ENABLE_PYTHON_ML) {
      return baseRecommendation
    }

    try {
      const rlResult: RLACRecommendOutput = await getRLACRecommendation({
        mode: 'recommend',
        room_id: input.roomId,
        indoor_temp: input.currentTemperature,
        indoor_humidity: input.currentHumidity,
        outdoor_temp: input.outsideWeather.temperature,
        outdoor_humidity: input.outsideWeather.humidity,
        ac_power: input.acPower,
        ac_running: input.acRunning,
        target_temp: input.targetTemperature,
        hour: new Date().getHours(),
      })

      if (!rlResult.model_available || !rlResult.action) {
        // RL model ยังไม่พร้อม — ใช้ rule-based
        return baseRecommendation
      }

      // Merge RL recommendation เข้ากับ rule-based
      const rlAction = rlResult.action as ACRecommendation['recommendation']['action']
      const rlConfidence = rlResult.confidence

      // ถ้า confidence สูงพอ (>0.3) ให้ RL override rule-based
      let finalAction = baseRecommendation.recommendation.action
      let finalReason = baseRecommendation.recommendation.reason
      let finalEnergySaving = baseRecommendation.recommendation.energySavingPotential

      if (rlConfidence >= 0.3 && rlAction !== baseRecommendation.recommendation.action) {
        finalAction = rlAction
        finalReason = `[ML/RL] ${baseRecommendation.recommendation.reason} — RL แนะนำ: ${rlAction} (confidence ${(rlConfidence * 100).toFixed(0)}%)`
        finalEnergySaving = rlResult.energy_saving_potential ?? finalEnergySaving
      } else if (rlConfidence >= 0.3) {
        // RL agrees with rule-based
        finalReason += ` (ML/RL ยืนยัน, confidence ${(rlConfidence * 100).toFixed(0)}%)`
      }

      return {
        ...baseRecommendation,
        recommendation: {
          ...baseRecommendation.recommendation,
          action: finalAction,
          reason: finalReason,
          energySavingPotential: finalEnergySaving,
        },
        rlRecommendation: {
          action: rlResult.action,
          confidence: rlConfidence,
          qValues: rlResult.q_values,
          energySavingPotential: rlResult.energy_saving_potential,
          totalEpisodes: rlResult.total_episodes,
        },
        mlModel: {
          name: 'Q-Learning AC Optimizer',
          totalEpisodes: rlResult.total_episodes ?? 0,
          thermalModelMAE: null,
        },
      }
    } catch (err) {
      console.error('[ACOptimizer] RL recommendation failed, using rule-based:', err instanceof Error ? err.message : err)
      return baseRecommendation
    }
  }

  /**
   * Train RL model จากข้อมูลย้อนหลัง
   */
  static async trainFromHistory(
    roomId: string,
    episodes: RLACEpisode[]
  ): Promise<{ trained: boolean; totalEpisodes?: number; thermalMAE?: number | null; error?: string }> {
    if (!ENABLE_PYTHON_ML) {
      return { trained: false, error: 'Python ML is not enabled (ENABLE_PYTHON_ML=1)' }
    }
    try {
      const result = await trainRLACOptimizer({
        mode: 'train',
        episodes,
        room_id: roomId,
      })
      return {
        trained: result.trained ?? false,
        totalEpisodes: result.total_episodes,
        thermalMAE: result.thermal_model_mae,
      }
    } catch (err) {
      return { trained: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
