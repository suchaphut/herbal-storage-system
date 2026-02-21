import type { EnvironmentalSensorData } from './types'

/**
 * รวมข้อมูล environmental ต่อช่วงเวลา (ค่าเฉลี่ยอุณหภูมิ/ความชื้นในแต่ละ bucket)
 * ใช้เมื่อห้องมีหลายเซนเซอร์ เพื่อให้ ML ได้ time series หนึ่งชุดต่อห้อง (ค่าเฉลี่ย)
 * @param data ข้อมูลจากทุกเซนเซอร์ในห้อง (type === 'environmental')
 * @param bucketMinutes ช่วงเวลาต่อ bucket (นาที) เช่น 5 = รวมทุก 5 นาที
 * @param roomId roomId สำหรับข้อมูลที่รวมแล้ว (ใช้จากตัวแรกถ้าไม่ส่ง)
 */
export function aggregateEnvironmentalByTime(
  data: EnvironmentalSensorData[],
  bucketMinutes: number = 5,
  roomId?: string | null
): EnvironmentalSensorData[] {
  if (data.length === 0) return []

  const rid = roomId ?? data[0].roomId
  const bucketMs = bucketMinutes * 60 * 1000

  const byBucket = new Map<
    number,
    { temperatures: number[]; humidities: number[]; timestamp: Date }
  >()

  for (const d of data) {
    if (d.type !== 'environmental' || d.readings == null) continue
    const t = d.timestamp instanceof Date ? d.timestamp.getTime() : new Date(d.timestamp).getTime()
    const bucketKey = Math.floor(t / bucketMs) * bucketMs
    if (!byBucket.has(bucketKey)) {
      byBucket.set(bucketKey, {
        temperatures: [],
        humidities: [],
        timestamp: new Date(bucketKey),
      })
    }
    const b = byBucket.get(bucketKey)!
    const temp = d.readings.temperature
    const hum = d.readings.humidity
    if (typeof temp === 'number' && !Number.isNaN(temp)) b.temperatures.push(temp)
    if (typeof hum === 'number' && !Number.isNaN(hum)) b.humidities.push(hum)
  }

  const result: EnvironmentalSensorData[] = []
  const sortedBuckets = [...byBucket.entries()].sort((a, b) => a[0] - b[0])
  for (const [, b] of sortedBuckets) {
    // ข้าม bucket ที่ขาดข้อมูลอย่างใดอย่างหนึ่ง เพื่อไม่ให้ค่า 0 เข้า ML pipeline
    if (b.temperatures.length === 0 || b.humidities.length === 0) continue
    const avgTemp = b.temperatures.reduce((s, v) => s + v, 0) / b.temperatures.length
    const avgHum = b.humidities.reduce((s, v) => s + v, 0) / b.humidities.length
    result.push({
      _id: '',
      nodeId: 'room-aggregated',
      roomId: rid ?? null,
      timestamp: b.timestamp,
      type: 'environmental',
      readings: { temperature: avgTemp, humidity: avgHum },
    })
  }
  return result
}
