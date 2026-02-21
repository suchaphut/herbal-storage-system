import { NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'

export async function GET() {
  try {
    const stats = await db.getDashboardStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
