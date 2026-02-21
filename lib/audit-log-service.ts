// Audit Log Service - เก็บลง MongoDB
import dbConnect from './mongodb'
import { AuditLogModel } from './models'
import type { AuditLog, AuditAction, UserRole, AuditLogFilter } from './types'

// Map MongoDB document to AuditLog (ensure _id is string)
function toAuditLog(doc: Record<string, unknown>): AuditLog {
  return {
    _id: String(doc._id),
    userId: doc.userId != null ? String(doc.userId) : null,
    userEmail: String(doc.userEmail),
    userName: String(doc.userName),
    userRole: doc.userRole as UserRole | null,
    action: doc.action as AuditAction,
    resource: doc.resource as AuditLog['resource'],
    resourceId: doc.resourceId != null ? String(doc.resourceId) : null,
    details: String(doc.details),
    metadata: doc.metadata as Record<string, unknown> | undefined,
    ipAddress: doc.ipAddress != null ? String(doc.ipAddress) : null,
    userAgent: doc.userAgent != null ? String(doc.userAgent) : null,
    success: Boolean(doc.success),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt as string),
  }
}

// Create audit log entry
interface CreateAuditLogParams {
  userId: string | null
  userEmail: string
  userName: string
  userRole: UserRole | null
  action: AuditAction
  resource: AuditLog['resource']
  resourceId?: string | null
  details: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
  success: boolean
}

function buildFilterQuery(filter?: AuditLogFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  if (!filter) return query
  if (filter.userId) query.userId = filter.userId
  if (filter.action) query.action = filter.action
  if (filter.resource) query.resource = filter.resource
  const dateRange: Record<string, Date> = {}
  if (filter.startDate) dateRange.$gte = filter.startDate
  if (filter.endDate) dateRange.$lte = filter.endDate
  if (Object.keys(dateRange).length > 0) query.createdAt = dateRange
  if (filter.success !== undefined) query.success = filter.success
  return query
}

export const auditLogService = {
  // Create a new audit log entry (เก็บลง MongoDB)
  async create(params: CreateAuditLogParams): Promise<AuditLog> {
    await dbConnect()
    const doc = await AuditLogModel.create({
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      details: params.details,
      metadata: params.metadata,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      success: params.success,
    })
    const obj = doc.toObject() as Record<string, unknown>
    obj.createdAt = doc.createdAt
    return toAuditLog(obj)
  },

  // Get all audit logs with optional filtering
  async getAll(filter?: AuditLogFilter, limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    await dbConnect()
    const query = buildFilterQuery(filter)
    const docs = await AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
    return docs.map((d) => toAuditLog(d as Record<string, unknown>))
  },

  // Get audit logs by user
  async getByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    await dbConnect()
    const docs = await AuditLogModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return docs.map((d) => toAuditLog(d as Record<string, unknown>))
  },

  // Get audit logs by resource
  async getByResource(
    resource: AuditLog['resource'],
    resourceId?: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    await dbConnect()
    const query: Record<string, unknown> = { resource }
    if (resourceId) query.resourceId = resourceId
    const docs = await AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return docs.map((d) => toAuditLog(d as Record<string, unknown>))
  },

  // Get recent login activities
  async getLoginActivities(limit: number = 50): Promise<AuditLog[]> {
    await dbConnect()
    const docs = await AuditLogModel.find({ action: { $in: ['login', 'logout', 'login_failed'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return docs.map((d) => toAuditLog(d as Record<string, unknown>))
  },

  // Get count by action type (for stats)
  async getStats(): Promise<Record<AuditAction, number>> {
    await dbConnect()
    const result = await AuditLogModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ])
    const stats: Record<string, number> = {}
    for (const r of result) {
      stats[r._id] = r.count
    }
    return stats as Record<AuditAction, number>
  },

  // Get count
  async getCount(filter?: AuditLogFilter): Promise<number> {
    await dbConnect()
    const query = buildFilterQuery(filter)
    return await AuditLogModel.countDocuments(query)
  },

  // Clear all logs (for testing)
  async clear(): Promise<void> {
    await dbConnect()
    await AuditLogModel.deleteMany({})
  },
}

// Helper function to extract client info from request
export function getClientInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || null
  const userAgent = request.headers.get('user-agent')

  return { ipAddress, userAgent }
}

// Helper function to format action description in Thai
export function formatActionDescription(action: AuditAction, details?: Record<string, unknown>): string {
  const descriptions: Record<AuditAction, string> = {
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    login_failed: 'เข้าสู่ระบบไม่สำเร็จ',
    user_create: 'สร้างผู้ใช้ใหม่',
    user_update: 'แก้ไขข้อมูลผู้ใช้',
    user_delete: 'ลบผู้ใช้',
    user_password_change: 'เปลี่ยนรหัสผ่าน',
    room_create: 'สร้างห้องใหม่',
    room_update: 'แก้ไขข้อมูลห้อง',
    room_delete: 'ลบห้อง',
    sensor_create: 'เพิ่มเซ็นเซอร์ใหม่',
    sensor_update: 'แก้ไขข้อมูลเซ็นเซอร์',
    sensor_delete: 'ลบเซ็นเซอร์',
    alert_resolve: 'ยืนยันการแจ้งเตือน',
    settings_update: 'แก้ไขการตั้งค่า',
    data_export: 'ส่งออกข้อมูล',
  }

  let description = descriptions[action] || action

  if (details) {
    if (details.targetName) {
      description += `: ${details.targetName}`
    }
    if (details.reason) {
      description += ` (${details.reason})`
    }
  }

  return description
}
