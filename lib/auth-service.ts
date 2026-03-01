// Authentication Service with JWT and Password Hashing

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import bcrypt from 'bcryptjs'
import { ROLE_PERMISSIONS } from './types'
import type {
  User,
  SafeUser,
  AuthSession,
  UserRole,
  RolePermissions,
} from './types'

// Environment variables (must be set in production)
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[auth] JWT_SECRET environment variable is required in production')
  } else {
    console.warn('[auth] WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET in .env.local')
  }
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'herbal-storage-jwt-secret-key-change-in-production'
)
const JWT_EXPIRES_IN = '24h'
const SALT_ROUNDS = 10

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(password, storedHash)
}

// Normalize MongoDB document to User (handle ObjectId etc.)
function normalizeUser(user: Record<string, unknown> & { _id: unknown; assignedRooms?: unknown[] }): User {
  return {
    ...user,
    _id: String(user._id),
    assignedRooms: (user.assignedRooms || []).map((r: unknown) => String(r)),
  } as User
}

// JWT Functions
async function createToken(user: User | Record<string, unknown>): Promise<string> {
  const u = '_id' in user && typeof user._id !== 'string' ? normalizeUser(user as never) : (user as User)

  const payload: Omit<AuthSession, 'iat' | 'exp'> = {
    userId: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    assignedRooms: u.assignedRooms || [],
    permissions: ROLE_PERMISSIONS[u.role],
  }

  const token = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET)

  return token
}

async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthSession
  } catch {
    return null
  }
}

// Convert User to SafeUser (remove sensitive data, normalize MongoDB docs)
function toSafeUser(user: User | Record<string, unknown>): SafeUser {
  const u = '_id' in user && typeof user._id !== 'string' ? normalizeUser(user as never) : (user as User)
  const prefs = u.notificationPreferences
  return {
    _id: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    assignedRooms: u.assignedRooms || [],
    notificationPreferences: {
      discord: prefs?.discord ?? false,
      hasDiscordWebhook: !!(prefs?.discordWebhookUrl),
      line: prefs?.line ?? false,
      hasLineToken: !!(prefs?.lineAccessToken),
      email: prefs?.email ?? true,
    },
    lastLogin: u.lastLogin ?? null,
    createdAt: u.createdAt ?? new Date(),
    isActive: u.isActive ?? true,
  }
}

// Authorization helpers
function hasPermission(
  session: AuthSession,
  permission: keyof RolePermissions
): boolean {
  return session.permissions[permission]
}

function canAccessRoom(session: AuthSession, roomId: string): boolean {
  // Admin can access all rooms
  if (session.role === 'admin') return true

  // Viewer can view all rooms
  if (session.role === 'viewer') return true

  // Operator can only access assigned rooms
  if (session.role === 'operator') {
    return session.assignedRooms.includes(roomId)
  }

  return false
}

function canManageSensorInRoom(session: AuthSession, roomId: string): boolean {
  // Admin can manage sensors in any room
  if (session.role === 'admin') return true

  // Operator can manage sensors only in assigned rooms
  if (session.role === 'operator') {
    return session.assignedRooms.includes(roomId)
  }

  return false
}

// Account lockout settings
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

function isAccountLocked(user: User): boolean {
  if (!user.lockedUntil) return false
  return new Date() < new Date(user.lockedUntil)
}

// Export auth service
export const authService = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  toSafeUser,
  hasPermission,
  canAccessRoom,
  canManageSensorInRoom,
  isAccountLocked,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
}
