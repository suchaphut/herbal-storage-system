import { ClimateAnalysis, ExternalWeatherData, EnvironmentalSensorData } from './types'
import { runProphetWithWeather, type ProphetOutput } from './ml-python-bridge'

const ENABLE_PYTHON_ML =
  process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'

export interface ClimateAnalyzerInput {
  roomId: string
  insideTemperature: number
  insideHumidity: number
  outsideWeather: ExternalWeatherData
  roomArea?: number // m² (optional, for heat load calculation)
}

/** Extended input ที่รวม historical data สำหรับ ML prediction */
export interface ClimateAnalyzerMLInput extends ClimateAnalyzerInput {
  historicalSensorData?: EnvironmentalSensorData[]
  historicalWeatherData?: ExternalWeatherData[]
}

export class ClimateAnalyzer {
  /**
   * วิเคราะห์ความสัมพันธ์ระหว่างสภาพอากาศภายในและภายนอก
   */
  static analyze(input: ClimateAnalyzerInput): ClimateAnalysis {
    const { roomId, insideTemperature, insideHumidity, outsideWeather, roomArea = 50 } = input

    const tempDelta = insideTemperature - outsideWeather.temperature
    const humidityDelta = insideHumidity - outsideWeather.humidity

    // คำนวณ Heat Load (W/m²) - ประมาณการแบบง่าย
    // Heat load เพิ่มขึ้นเมื่ออุณหภูมิภายนอกสูงกว่าภายใน
    const heatLoad = this.calculateHeatLoad(tempDelta, outsideWeather.temperature, roomArea)

    // คำนวณ AC Efficiency Score (0-100)
    const efficiency = this.calculateEfficiency(tempDelta, humidityDelta, outsideWeather)

    // สร้างคำแนะนำ
    const recommendation = this.generateRecommendation(
      tempDelta,
      humidityDelta,
      outsideWeather,
      efficiency
    )

    return {
      roomId,
      timestamp: new Date(),
      inside: {
        temperature: insideTemperature,
        humidity: insideHumidity,
      },
      outside: {
        temperature: outsideWeather.temperature,
        humidity: outsideWeather.humidity,
        weatherCondition: outsideWeather.weatherCondition,
      },
      delta: {
        temperature: tempDelta,
        humidity: humidityDelta,
      },
      heatLoad,
      efficiency,
      recommendation,
    }
  }

  /**
   * ML-enhanced analysis: ใช้ Prophet with external weather regressors
   * ทำนายอุณหภูมิภายในล่วงหน้า 6 ชม. โดยรวมข้อมูลอากาศภายนอกเป็น regressor
   * ถ้า ML ไม่พร้อม จะ fallback เป็น rule-based
   */
  static async analyzeWithML(input: ClimateAnalyzerMLInput): Promise<ClimateAnalysis> {
    // เริ่มจาก rule-based analysis
    const baseAnalysis = this.analyze(input)

    // ถ้าไม่มี historical data หรือ Python ML ไม่เปิด → ใช้ rule-based
    if (!ENABLE_PYTHON_ML || !input.historicalSensorData || input.historicalSensorData.length < 12) {
      return {
        ...baseAnalysis,
        mlModel: undefined,
      }
    }

    try {
      const sensorData = input.historicalSensorData
      const weatherData = input.historicalWeatherData || []

      const timestamps = sensorData.map(d => d.timestamp.toISOString())
      const temperature = sensorData.map(d => d.readings.temperature)
      const humidity = sensorData.map(d => d.readings.humidity)

      // จับคู่ external weather data กับ sensor timestamps
      let externalTemp: number[] | undefined
      let externalHum: number[] | undefined

      if (weatherData.length >= 2) {
        // Interpolate weather data to match sensor timestamps
        externalTemp = sensorData.map(d => {
          const ts = d.timestamp.getTime()
          // หา weather data ที่ใกล้ที่สุด
          let closest = weatherData[0]
          let minDiff = Math.abs(new Date(closest.timestamp).getTime() - ts)
          for (const w of weatherData) {
            const diff = Math.abs(new Date(w.timestamp).getTime() - ts)
            if (diff < minDiff) {
              minDiff = diff
              closest = w
            }
          }
          return closest.temperature
        })
        externalHum = sensorData.map(d => {
          const ts = d.timestamp.getTime()
          let closest = weatherData[0]
          let minDiff = Math.abs(new Date(closest.timestamp).getTime() - ts)
          for (const w of weatherData) {
            const diff = Math.abs(new Date(w.timestamp).getTime() - ts)
            if (diff < minDiff) {
              minDiff = diff
              closest = w
            }
          }
          return closest.humidity
        })
      }

      // Estimate freq_minutes from data
      const freqMs = sensorData.length >= 2
        ? (sensorData[sensorData.length - 1].timestamp.getTime() - sensorData[0].timestamp.getTime()) / (sensorData.length - 1)
        : 60000
      const freqMinutes = Math.max(1, Math.round(freqMs / 60000))

      const prophetOutput: ProphetOutput = await runProphetWithWeather({
        timestamps,
        temperature,
        humidity,
        external_temperature: externalTemp,
        external_humidity: externalHum,
        horizon_hours: 6,
        freq_minutes: freqMinutes,
      })

      // Extract prediction summary
      const predictions = prophetOutput.predictions || []
      const usesWeather = prophetOutput.meta?.uses_external_weather ?? (externalTemp != null)

      let mlPrediction: ClimateAnalysis['mlPrediction'] = undefined
      if (predictions.length > 0) {
        const predTemps = predictions.map(p => p.temperature)
        const predHums = predictions.map(p => p.humidity)

        const avgPredTemp = predTemps.reduce((a, b) => a + b, 0) / predTemps.length
        const avgPredHum = predHums.reduce((a, b) => a + b, 0) / predHums.length

        const tempTrend = predTemps[predTemps.length - 1] - predTemps[0]
        const trend: 'warming' | 'cooling' | 'stable' =
          tempTrend > 0.5 ? 'warming' : tempTrend < -0.5 ? 'cooling' : 'stable'

        mlPrediction = {
          predictedIndoorTemp6h: avgPredTemp,
          predictedIndoorHumidity6h: avgPredHum,
          trend,
          confidence: Math.max(0.3, 1 - (prophetOutput.metrics?.mape ?? 50) / 100),
          usesExternalWeather: usesWeather,
        }
      }

      // Enhance recommendation with ML forecast info
      let enhancedRecommendation = baseAnalysis.recommendation
      if (mlPrediction) {
        const trendText = mlPrediction.trend === 'warming'
          ? 'ML พยากรณ์: อุณหภูมิมีแนวโน้มเพิ่มขึ้นใน 6 ชม. ข้างหน้า'
          : mlPrediction.trend === 'cooling'
            ? 'ML พยากรณ์: อุณหภูมิมีแนวโน้มลดลงใน 6 ชม. ข้างหน้า'
            : 'ML พยากรณ์: อุณหภูมิคงที่ใน 6 ชม. ข้างหน้า'
        enhancedRecommendation += ` • ${trendText}`
      }

      return {
        ...baseAnalysis,
        recommendation: enhancedRecommendation,
        mlPrediction,
        mlModel: {
          name: usesWeather ? 'Prophet + External Weather Regressors' : 'Prophet Ensemble',
          version: prophetOutput.meta?.version ?? '1.0.0',
          mae: prophetOutput.metrics?.mae,
          rmse: prophetOutput.metrics?.rmse,
          mape: prophetOutput.metrics?.mape,
          trainingPoints: prophetOutput.meta?.training_points,
        },
      }
    } catch (err) {
      console.error('[ClimateAnalyzer] ML prediction failed, using rule-based:', err instanceof Error ? err.message : err)
      return { ...baseAnalysis, mlModel: undefined }
    }
  }

  /**
   * คำนวณ Heat Load (W/m²)
   * สูตรประมาณการ: Q = U × A × ΔT
   * U = Overall heat transfer coefficient (~3-5 W/m²K for typical buildings)
   */
  private static calculateHeatLoad(
    tempDelta: number,
    outsideTemp: number,
    roomArea: number
  ): number {
    const U = 4.0 // W/m²K (ค่าประมาณสำหรับอาคารทั่วไป)
    
    // ถ้าภายนอกร้อนกว่าภายใน (tempDelta < 0) = heat gain
    // ถ้าภายในเย็นกว่าภายนอก (tempDelta > 0) = heat loss
    const heatTransfer = U * Math.abs(tempDelta)

    // เพิ่ม solar heat gain ถ้าอากาศแดดจัด
    let solarGain = 0
    if (outsideTemp > 30) {
      solarGain = (outsideTemp - 30) * 2 // W/m² per degree above 30°C
    }

    return Math.round((heatTransfer + solarGain) * 100) / 100
  }

  /**
   * คำนวณ AC Efficiency Score (0-100)
   * ยิ่งต่างอุณหภูมิมาก ยิ่งทำงานหนัก = efficiency ต่ำ
   */
  private static calculateEfficiency(
    tempDelta: number,
    humidityDelta: number,
    outsideWeather: ExternalWeatherData
  ): number {
    let score = 100

    // ลดคะแนนตามความต่างอุณหภูมิ
    const tempDiff = Math.abs(tempDelta)
    if (tempDiff > 15) {
      score -= 40
    } else if (tempDiff > 10) {
      score -= 25
    } else if (tempDiff > 5) {
      score -= 10
    }

    // ลดคะแนนถ้าอากาศภายนอกร้อนมาก (>35°C)
    if (outsideWeather.temperature > 35) {
      score -= 15
    } else if (outsideWeather.temperature > 32) {
      score -= 10
    }

    // ลดคะแนนถ้าความชื้นภายนอกสูงมาก (>80%)
    if (outsideWeather.humidity > 80) {
      score -= 10
    } else if (outsideWeather.humidity > 70) {
      score -= 5
    }

    // ลดคะแนนถ้าแดดจัด (cloudiness < 20%)
    if (outsideWeather.cloudiness !== undefined && outsideWeather.cloudiness < 20) {
      score -= 5
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * สร้างคำแนะนำตามสภาพอากาศ
   */
  private static generateRecommendation(
    tempDelta: number,
    humidityDelta: number,
    outsideWeather: ExternalWeatherData,
    efficiency: number
  ): string {
    const recommendations: string[] = []

    // อุณหภูมิ
    if (tempDelta < -10) {
      recommendations.push('อากาศภายนอกร้อนมาก แอร์ทำงานหนัก แนะนำตรวจสอบประสิทธิภาพแอร์')
    } else if (tempDelta < -5) {
      recommendations.push('อากาศภายนอกร้อน แอร์กำลังทำงานเพื่อรักษาอุณหภูมิ')
    } else if (tempDelta > 5) {
      recommendations.push('อากาศภายนอกเย็นกว่าภายใน อาจลดกำลังแอร์เพื่อประหยัดพลังงาน')
    }

    // ความชื้น
    if (outsideWeather.humidity > 80) {
      recommendations.push('ความชื้นภายนอกสูงมาก ควระวังความชื้นภายในเพิ่มขึ้น')
    }

    // สภาพอากาศ
    if (outsideWeather.temperature > 35) {
      recommendations.push('อากาศร้อนจัด แนะนำเปิดแอร์เต็มกำลัง')
    } else if (outsideWeather.temperature < 25) {
      recommendations.push('อากาศเย็นสบาย อาจปรับลดกำลังแอร์ได้')
    }

    // Efficiency
    if (efficiency < 50) {
      recommendations.push('ประสิทธิภาพต่ำ แนะนำตรวจสอบการทำงานของแอร์และฉนวนห้อง')
    } else if (efficiency > 80) {
      recommendations.push('ประสิทธิภาพดี แอร์ทำงานได้อย่างมีประสิทธิภาพ')
    }

    return recommendations.length > 0
      ? recommendations.join(' • ')
      : 'สภาพอากาศปกติ แอร์ทำงานตามปกติ'
  }

  /**
   * คำนวณ Dew Point (จุดน้ำค้าง) - สำหรับวิเคราะห์ความชื้น
   */
  static calculateDewPoint(temperature: number, humidity: number): number {
    const a = 17.27
    const b = 237.7
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100)
    return (b * alpha) / (a - alpha)
  }

  /**
   * คำนวณ Heat Index (ดัชนีความร้อน) - อุณหภูมิที่รู้สึกได้
   */
  static calculateHeatIndex(temperature: number, humidity: number): number {
    if (temperature < 27) return temperature

    const T = temperature
    const RH = humidity

    let HI = -8.78469475556 +
      1.61139411 * T +
      2.33854883889 * RH +
      -0.14611605 * T * RH +
      -0.012308094 * T * T +
      -0.0164248277778 * RH * RH +
      0.002211732 * T * T * RH +
      0.00072546 * T * RH * RH +
      -0.000003582 * T * T * RH * RH

    return Math.round(HI * 10) / 10
  }
}
