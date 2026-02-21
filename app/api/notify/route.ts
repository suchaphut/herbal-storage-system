import { NextResponse } from 'next/server'
import { sendNotification, testNotifications } from '@/lib/notification-service'
import { dbService as db } from '@/lib/db-service'
import type { Alert } from '@/lib/types'

// Send a notification for an existing alert
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { alertId, alert: customAlert } = body

    let alert: Alert

    if (alertId) {
      // Get alert from database
      const found = await db.getAlertById(alertId)
      if (!found) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        )
      }
      alert = found
    } else if (customAlert) {
      // Use custom alert data
      alert = {
        _id: 'custom',
        ...customAlert,
        createdAt: new Date(),
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'alertId or alert object is required' },
        { status: 400 }
      )
    }

    // Get room and node info for context
    const room = alert.roomId ? await db.getRoomById(String(alert.roomId)) : null
    const node = alert.nodeId ? await db.getSensorNodeByNodeId(alert.nodeId) : null

    // Send notifications
    const results = await sendNotification(alert, room, node)

    return NextResponse.json({
      success: true,
      data: {
        alert,
        notificationResults: results,
      },
    })
  } catch (error) {
    console.error('Notification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}

// Test notification configuration
export async function GET() {
  try {
    const results = await testNotifications()

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Notification test completed',
    })
  } catch (error) {
    console.error('Notification test error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test notifications' },
      { status: 500 }
    )
  }
}
