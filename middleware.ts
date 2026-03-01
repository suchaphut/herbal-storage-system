import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'herbal-storage-jwt-secret-key-change-in-production'
)

// Routes that do NOT require user authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/data/ingest', // Protected by SENSOR_API_KEY, not user JWT
  '/api/sensors/check-offline', // Protected by SENSOR_API_KEY / CRON_SECRET
  '/api/health', // Health check for Render / uptime monitoring
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /api/* routes (pages are handled by client-side auth-context)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public API routes through
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Extract token from cookie or Authorization header
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'ไม่ได้เข้าสู่ระบบ' },
      { status: 401 }
    )
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Token ไม่ถูกต้องหรือหมดอายุ' },
      { status: 401 }
    )
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
