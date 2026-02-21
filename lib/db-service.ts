import mongoose from 'mongoose'
import dbConnect from './mongodb'
import { RoomModel, SensorNodeModel, SensorDataModel, AlertModel, UserModel, MLModelMetricsModel } from './models'
import type {
  Room,
  SensorNode,
  SensorData,
  Alert,
  User,
  DashboardStats,
  ACStatus,
  ACRoomStatus,
  ACUnitStatus,
  MLModelMetrics,
} from './types'

import { authDbService } from './db-service-auth'

export const dbService = {
  ...authDbService,
  // Rooms
  async getRooms(): Promise<Room[]> {
    await dbConnect()
    return await RoomModel.find({ isActive: true }).lean()
  },

  async getRoomById(id: string): Promise<Room | null> {
    await dbConnect()
    return await RoomModel.findById(id).lean()
  },

  // Sensors
  async getSensorNodes(): Promise<SensorNode[]> {
    await dbConnect()
    return await SensorNodeModel.find({ isActive: true }).lean()
  },

  async getSensorNodeByNodeId(nodeId: string): Promise<SensorNode | null> {
    await dbConnect()
    return await SensorNodeModel.findOne({ nodeId }).lean()
  },

  async getSensorNodeById(id: string): Promise<SensorNode | null> {
    await dbConnect()
    return await SensorNodeModel.findById(id).lean()
  },

  // Data
  async addSensorData(data: Omit<SensorData, '_id'>): Promise<SensorData> {
    await dbConnect()
    const roomIdForDb =
      data.roomId != null && typeof data.roomId === 'string' && mongoose.Types.ObjectId.isValid(data.roomId)
        ? new mongoose.Types.ObjectId(data.roomId)
        : data.roomId
    const payload = { ...data, roomId: roomIdForDb }
    const saved = await SensorDataModel.create(payload)
    const obj = saved.toObject() as Record<string, unknown>
    if (obj.roomId && typeof obj.roomId !== 'string') obj.roomId = String(obj.roomId)
    return obj as unknown as SensorData
  },

  async getSensorDataByRoom(roomId: string, limit = 100): Promise<SensorData[]> {
    await dbConnect()
    const queryRoomId =
      roomId && mongoose.Types.ObjectId.isValid(roomId)
        ? new mongoose.Types.ObjectId(roomId)
        : roomId
    return await SensorDataModel.find({ roomId: queryRoomId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
  },

  async getSensorDataByNodeId(nodeId: string, limit = 100): Promise<SensorData[]> {
    await dbConnect()
    return await SensorDataModel.find({ nodeId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
  },

  async getSensorDataHistory(opts: {
    roomId?: string
    nodeId?: string
    type?: string
    limit?: number
    page?: number
  }): Promise<{ records: SensorData[]; total: number }> {
    await dbConnect()
    const { roomId, nodeId, type, limit = 200, page = 1 } = opts
    const filter: Record<string, unknown> = {}
    if (roomId) {
      filter.roomId = mongoose.Types.ObjectId.isValid(roomId)
        ? new mongoose.Types.ObjectId(roomId)
        : roomId
    }
    if (nodeId) filter.nodeId = nodeId
    if (type) filter.type = type
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      SensorDataModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      SensorDataModel.countDocuments(filter),
    ])
    return { records: records as unknown as SensorData[], total }
  },

  // Alerts
  async getAlerts(resolved?: boolean): Promise<Alert[]> {
    await dbConnect()
    const filter = resolved !== undefined ? { isResolved: resolved } : {}
    const alerts = await AlertModel.find(filter).sort({ createdAt: -1 }).limit(50).lean()
    return alerts.map((a: Record<string, unknown>) => ({
      ...a,
      _id: String(a._id),
      roomId: a.roomId ? String(a.roomId) : null,
    })) as Alert[]
  },

  async getAlertById(id: string): Promise<Alert | null> {
    await dbConnect()
    const a = await AlertModel.findById(id).lean() as Record<string, unknown> | null
    if (!a) return null
    return { ...a, _id: String(a._id), roomId: a.roomId ? String(a.roomId) : null } as Alert
  },

  /** ตรวจสอบว่ามี active alert ของ node/room/type นี้อยู่แล้วหรือไม่ — query ตรงจาก DB ไม่มี limit */
  async hasActiveAlertForNode(
    roomId: string,
    nodeId: string,
    type: string,
    messagePrefix?: string
  ): Promise<boolean> {
    await dbConnect()
    const filter: Record<string, unknown> = {
      roomId: mongoose.Types.ObjectId.isValid(roomId) ? new mongoose.Types.ObjectId(roomId) : roomId,
      nodeId,
      type,
      isResolved: false,
    }
    if (messagePrefix) {
      filter.message = { $regex: `^${messagePrefix}` }
    }
    const count = await AlertModel.countDocuments(filter)
    return count > 0
  },

  async createAlert(alert: Omit<Alert, '_id' | 'createdAt'>): Promise<Alert> {
    await dbConnect()
    const saved = await AlertModel.create(alert)
    return saved.toObject()
  },

  async resolveAllAlerts(resolvedBy: string): Promise<number> {
    await dbConnect()
    const result = await AlertModel.updateMany(
      { isResolved: false },
      { isResolved: true, resolvedAt: new Date(), resolvedBy }
    )
    return result.modifiedCount
  },

  async resolveAlert(id: string, resolvedBy: string): Promise<Alert | null> {
    await dbConnect()
    return await AlertModel.findByIdAndUpdate(
      id,
      { isResolved: true, resolvedAt: new Date(), resolvedBy },
      { new: true }
    ).lean()
  },

  /** ยกเลิกการแจ้งเตือน anomaly ของ power sensor ในห้อง/โหนดนี้เมื่อกระแสกลับปกติ (ระบบยกเลิกอัตโนมัติ) */
  async resolvePowerAnomalyAlertsForNode(
    roomId: string,
    nodeId: string,
    resolvedBy: string = 'system'
  ): Promise<number> {
    await dbConnect()
    const result = await AlertModel.updateMany(
      {
        roomId: new mongoose.Types.ObjectId(roomId),
        nodeId,
        type: 'anomaly',
        isResolved: false,
      },
      { isResolved: true, resolvedAt: new Date(), resolvedBy }
    )
    return result.modifiedCount
  },

  // Additional Room Methods
  async createRoom(roomData: Omit<Room, '_id' | 'createdAt' | 'updatedAt'>): Promise<Room> {
    await dbConnect()
    const room = await RoomModel.create(roomData)
    return room.toObject()
  },

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    await dbConnect()
    return await RoomModel.findByIdAndUpdate(id, updates, { new: true }).lean()
  },

  async deleteRoom(id: string): Promise<boolean> {
    await dbConnect()
    const result = await RoomModel.findByIdAndDelete(id)
    return !!result
  },

  // Additional Sensor Methods
  async createSensorNode(nodeData: Omit<SensorNode, '_id' | 'createdAt' | 'updatedAt'>): Promise<SensorNode> {
    await dbConnect()
    const node = await SensorNodeModel.create(nodeData)
    return node.toObject()
  },

  async updateSensorNode(id: string, updates: Partial<SensorNode>): Promise<SensorNode | null> {
    await dbConnect()
    return await SensorNodeModel.findByIdAndUpdate(id, updates, { new: true }).lean()
  },

  async deleteSensorNode(id: string): Promise<boolean> {
    await dbConnect()
    const result = await SensorNodeModel.findByIdAndDelete(id)
    return !!result
  },

  async getSensorNodesByRoom(roomId: string): Promise<SensorNode[]> {
    await dbConnect()
    const qRoomId =
      roomId && mongoose.Types.ObjectId.isValid(roomId)
        ? new mongoose.Types.ObjectId(roomId)
        : roomId
    return await SensorNodeModel.find({ roomId: qRoomId, isActive: true }).lean()
  },

  /**
   * ค่าล่าสุดของ environmental ต่อห้อง (สำหรับแสดงบนการ์ดห้อง)
   * เมื่อ 1 ห้องมีหลายเซ็นเซอร์: หาค่าล่าสุดของแต่ละ node แล้วนำมาเฉลี่ย (ค่าเฉลี่ยอุณหภูมิ + ค่าเฉลี่ยความชื้น)
   * timestamp ที่ส่งกลับคือเวลาล่าสุดจากเซ็นเซอร์ใดก็ได้ในห้อง
   */
  async getLatestEnvironmentalReadingsPerRoom(): Promise<
    Record<string, { temperature: number; humidity: number; timestamp: Date }>
  > {
    await dbConnect()
    const activeRoomIds = await RoomModel.find({ isActive: true }).select('_id').lean()
    const activeSet = new Set(activeRoomIds.map((r) => String(r._id)))

    const aggregated = await SensorDataModel.aggregate<{
      _id: mongoose.Types.ObjectId
      temperature: number
      humidity: number
      timestamp: Date
    }>([
      { $match: { type: 'environmental', roomId: { $in: activeRoomIds.map((r) => r._id) } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: { roomId: '$roomId', nodeId: '$nodeId' },
          temperature: { $first: '$readings.temperature' },
          humidity: { $first: '$readings.humidity' },
          timestamp: { $first: '$timestamp' },
        },
      },
      {
        $group: {
          _id: '$_id.roomId',
          temperature: { $avg: '$temperature' },
          humidity: { $avg: '$humidity' },
          timestamp: { $max: '$timestamp' },
        },
      },
      {
        $project: {
          _id: 1,
          temperature: { $round: ['$temperature', 1] },
          humidity: { $round: ['$humidity', 1] },
          timestamp: 1,
        },
      },
    ])

    const result: Record<string, { temperature: number; humidity: number; timestamp: Date }> = {}
    for (const row of aggregated) {
      const rid = String(row._id)
      if (!activeSet.has(rid) || row.temperature == null || row.humidity == null) continue
      result[rid] = {
        temperature: row.temperature,
        humidity: row.humidity,
        timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
      }
    }
    return result
  },

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    await dbConnect()
    const [totalRooms, totalNodes, onlineNodes, activeAlerts, criticalAlerts, acStatus] =
      await Promise.all([
        RoomModel.countDocuments({ isActive: true }),
        SensorNodeModel.countDocuments({ isActive: true }),
        SensorNodeModel.countDocuments({ status: 'online', isActive: true }),
        AlertModel.countDocuments({ isResolved: false }),
        AlertModel.countDocuments({ isResolved: false, severity: 'critical' }),
        this.getACStatus(),
      ])

    return {
      totalRooms,
      totalNodes,
      onlineNodes,
      offlineNodes: totalNodes - onlineNodes,
      activeAlerts,
      criticalAlerts,
      acStatus: acStatus.summary.totalUnits > 0 ? acStatus : undefined,
    }
  },

  /** สถานะเครื่องปรับอากาศจาก power sensor: เปิด/ปิด จำนวนวัตต์ จำนวนเครื่องต่อห้อง */
  async getACStatus(): Promise<ACStatus> {
    await dbConnect()
    const powerNodes = await SensorNodeModel.find({
      type: 'power',
      isActive: true,
    }).lean()
    if (powerNodes.length === 0) {
      return {
        summary: { totalUnits: 0, onCount: 0, offCount: 0, totalPowerWatts: 0 },
        byRoom: [],
      }
    }

    const nodeIds = powerNodes.map((n) => n.nodeId)
    const latestByNode = await SensorDataModel.aggregate([
      { $match: { type: 'power', nodeId: { $in: nodeIds } } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$nodeId', doc: { $first: '$$ROOT' } } },
    ])

    const roomIds = [...new Set(powerNodes.map((n) => n.roomId?.toString()).filter(Boolean))]
    const rooms = await RoomModel.find({ _id: { $in: roomIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select('_id name')
      .lean()
    const roomNameById: Record<string, string> = {}
    rooms.forEach((r) => {
      roomNameById[String(r._id)] = r.name ?? ''
    })

    const nodeById: Record<string, SensorNode> = {}
    powerNodes.forEach((n) => {
      nodeById[n.nodeId] = n as SensorNode
    })

    const POWER_ON_THRESHOLD_W = 5
    const CURRENT_ON_THRESHOLD_A = 0.05

    const byRoomMap = new Map<string, ACUnitStatus[]>()
    for (const { _id: nodeId, doc } of latestByNode) {
      const node = nodeById[nodeId]
      if (!node?.roomId) continue
      const roomId = String(node.roomId)
      const r = doc?.readings as { voltage?: number; current?: number; power?: number; energy?: number } | undefined
      const power = r?.power ?? 0
      const current = r?.current ?? 0
      const isOn = power > POWER_ON_THRESHOLD_W || current > CURRENT_ON_THRESHOLD_A
      byRoomMap.set(roomId, byRoomMap.get(roomId) ?? [])
      byRoomMap.get(roomId)!.push({
        nodeId,
        name: node.name,
        power,
        current,
        isOn,
      })
    }

    const byRoom: ACRoomStatus[] = []
    let totalUnits = 0
    let onCount = 0
    let offCount = 0
    let totalPowerWatts = 0
    for (const [roomId, units] of byRoomMap) {
      const roomOn = units.filter((u) => u.isOn).length
      const roomOff = units.length - roomOn
      const roomPower = units.reduce((s, u) => s + u.power, 0)
      totalUnits += units.length
      onCount += roomOn
      offCount += roomOff
      totalPowerWatts += roomPower
      byRoom.push({
        roomId,
        roomName: roomNameById[roomId] ?? 'ไม่ระบุห้อง',
        units,
        onCount: roomOn,
        offCount: roomOff,
        totalPowerWatts: roomPower,
      })
    }

    return {
      summary: { totalUnits, onCount, offCount, totalPowerWatts },
      byRoom,
    }
  },

  // ─── ML Model Metrics ──────────────────────────────────────────────────────

  /**
   * บันทึกค่า MAE/RMSE/MAPE ของ Model ลง DB เพื่อใช้ทำ Drift Analysis
   * ควรเรียกหลังจาก getPrediction() หรือ analyzeRoom() สำเร็จ
   */
  async recordModelMetrics(
    metrics: Omit<MLModelMetrics, '_id' | 'recordedAt'>
  ): Promise<MLModelMetrics> {
    await dbConnect()
    const saved = await MLModelMetricsModel.create({
      ...metrics,
      recordedAt: new Date(),
    })
    return saved.toObject() as MLModelMetrics
  },

  /**
   * ดึงประวัติ Metrics ของ node (เรียงจากใหม่ไปเก่า)
   * ใช้สำหรับ Dashboard แสดงกราฟ RMSE ย้อนหลัง
   */
  async getModelMetricsHistory(
    nodeId: string,
    limit = 90
  ): Promise<MLModelMetrics[]> {
    await dbConnect()
    const rows = await MLModelMetricsModel.find({ nodeId })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .lean()
    return rows as MLModelMetrics[]
  },

  /**
   * ดึงค่า RMSE ล่าสุดของทุก node ในห้อง — ใช้แสดงบน Model Health card
   */
  async getLatestModelMetricsByRoom(roomId: string): Promise<MLModelMetrics[]> {
    await dbConnect()
    const rows = await MLModelMetricsModel.aggregate<MLModelMetrics>([
      { $match: { roomId } },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$nodeId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ])
    return rows
  },
}
