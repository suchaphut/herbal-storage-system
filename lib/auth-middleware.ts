// Authentication and Authorization Middleware
import { NextRequest, NextResponse } from 'next/server'
import { authService } from './auth-service'
import type { AuthSession, RolePermissions, UserRole } from './types'

// Result types
export type AuthResult =
  | { success: true; session: AuthSession }
  | { success: false; error: string; status: number }

export type AuthorizedResult<T> =
  | { success: true; session: AuthSession; data?: T }
  | { success: false; error: string; status: number }

// Extract token from request
export function extractToken(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('auth-token')?.value
  const headerToken = request.headers.get('Authorization')?.replace('Bearer ', '')
  return cookieToken || headerToken || null
}

// Verify authentication (just check if user is logged in)
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request)

  if (!token) {
    return {
      success: false,
      error: 'ไม่ได้เข้าสู่ระบบ',
      status: 401,
    }
  }

  const session = await authService.verifyToken(token)
  if (!session) {
    return {
      success: false,
      error: 'Token ไม่ถูกต้องหรือหมดอายุ',
      status: 401,
    }
  }

  return { success: true, session }
}

// Check if user has specific permission
export async function requirePermission(
  request: NextRequest,
  permission: keyof RolePermissions
): Promise<AuthResult> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) {
    return authResult
  }

  if (!authResult.session.permissions[permission]) {
    return {
      success: false,
      error: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
      status: 403,
    }
  }

  return authResult
}

// Check if user has specific role
export async function requireRole(
  request: NextRequest,
  roles: UserRole | UserRole[]
): Promise<AuthResult> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) {
    return authResult
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  if (!allowedRoles.includes(authResult.session.role)) {
    return {
      success: false,
      error: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
      status: 403,
    }
  }

  return authResult
}

// Check if user can access a specific room
export async function requireRoomAccess(
  request: NextRequest,
  roomId: string,
  writeAccess: boolean = false
): Promise<AuthResult> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) {
    return authResult
  }

  const { session } = authResult
  const { role, assignedRooms } = session

  // Admin has full access
  if (role === 'admin') {
    return authResult
  }

  // Viewer can only read
  if (role === 'viewer') {
    if (writeAccess) {
      return {
        success: false,
        error: 'ผู้ดูไม่สามารถแก้ไขข้อมูลได้',
        status: 403,
      }
    }
    return authResult
  }

  // Operator can only access assigned rooms
  if (role === 'operator') {
    if (!assignedRooms.includes(roomId)) {
      return {
        success: false,
        error: 'ไม่มีสิทธิ์เข้าถึงห้องนี้',
        status: 403,
      }
    }
    return authResult
  }

  return {
    success: false,
    error: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
    status: 403,
  }
}

// Check if user can manage sensors in a room
export async function requireSensorManagement(
  request: NextRequest,
  roomId: string | null
): Promise<AuthResult> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) {
    return authResult
  }

  const { session } = authResult
  const { role, assignedRooms, permissions } = session

  // Viewer cannot manage sensors
  if (role === 'viewer') {
    return {
      success: false,
      error: 'ผู้ดูไม่สามารถจัดการเซ็นเซอร์ได้',
      status: 403,
    }
  }

  // Admin has full access
  if (role === 'admin') {
    return authResult
  }

  // Operator can only manage sensors in assigned rooms
  if (role === 'operator') {
    if (!permissions.canManageAssignedSensorsOnly) {
      return {
        success: false,
        error: 'ไม่มีสิทธิ์จัดการเซ็นเซอร์',
        status: 403,
      }
    }

    if (roomId && !assignedRooms.includes(roomId)) {
      return {
        success: false,
        error: 'ไม่มีสิทธิ์จัดการเซ็นเซอร์ในห้องนี้',
        status: 403,
      }
    }

    return authResult
  }

  return {
    success: false,
    error: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
    status: 403,
  }
}

// Helper to create error response
export function createErrorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status })
}

// Helper to handle auth result in API routes
export function handleAuthError(result: AuthResult): NextResponse | null {
  if (!result.success) {
    return createErrorResponse(result.error, result.status)
  }
  return null
}

// Middleware wrapper for protected routes
export function withAuth<T>(
  handler: (request: NextRequest, session: AuthSession) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createErrorResponse(authResult.error, authResult.status)
    }
    return handler(request, authResult.session)
  }
}

// Middleware wrapper for admin-only routes
export function withAdminAuth<T>(
  handler: (request: NextRequest, session: AuthSession) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requireRole(request, 'admin')
    if (!authResult.success) {
      return createErrorResponse(authResult.error, authResult.status)
    }
    return handler(request, authResult.session)
  }
}

// Middleware wrapper for permission-based routes
export function withPermission<T>(
  permission: keyof RolePermissions,
  handler: (request: NextRequest, session: AuthSession) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requirePermission(request, permission)
    if (!authResult.success) {
      return createErrorResponse(authResult.error, authResult.status)
    }
    return handler(request, authResult.session)
  }
}
