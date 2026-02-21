'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Header } from './header'
import { SidebarNav } from './sidebar-nav'
import { StatsCards } from './stats-cards'
import { RoomCard } from './room-card'
import { SensorChart } from './sensor-chart'
import { AlertsList } from './alerts-list'
import { PredictionChart } from './prediction-chart'
import { MLMetricsCard } from './ml-metrics-card'
import { AnomalyDetectionCard } from './anomaly-detection-card'
import { RoomManagement } from './room-management'
import { SensorManagement } from './sensor-management'
import { SettingsPanel } from './settings-panel'
import { MLAnalysisPanel } from './ml-analysis-panel'
import { UserManagement } from './user-management'
import { AuditLogViewer } from './audit-log-viewer'
import { MobileBottomNav } from './mobile-bottom-nav'
import { SensorDataViewer } from './sensor-data-viewer'
import { useAuth } from '@/components/auth/auth-context'
import type {
  DashboardStats,
  Room,
  SensorNode,
  Alert,
  EnvironmentalSensorData,
  MLAnalysisResult,
} from '@/lib/types'

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => res.json())

export function Dashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const { user, hasPermission, isLoading } = useAuth()

  // Redirect to login when not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  // Fetch data
  const { data: statsData } = useSWR<{ success: boolean; data: DashboardStats }>(
    '/api/stats',
    fetcher,
    { refreshInterval: 30000 }
  )

  const { data: roomsData, mutate: mutateRooms } = useSWR<{
    success: boolean
    data: Room[]
  }>('/api/rooms', fetcher, { refreshInterval: 30000 })

  const { data: sensorsData, mutate: mutateSensors } = useSWR<{
    success: boolean
    data: SensorNode[]
  }>('/api/sensors', fetcher, { refreshInterval: 30000 })

  const { data: alertsData, mutate: mutateAlerts } = useSWR<{
    success: boolean
    data: Alert[]
  }>('/api/alerts', fetcher, { refreshInterval: 10000 })

  const { data: selectedRoomData } = useSWR<{
    success: boolean
    data: { room: Room; nodes: SensorNode[]; sensorData: EnvironmentalSensorData[] }
  }>(selectedRoomId ? `/api/rooms/${selectedRoomId}` : null, fetcher, {
    refreshInterval: 5000,
  })

  const { data: latestData } = useSWR<{
    success: boolean
    data: Record<string, { temperature: number; humidity: number; timestamp: string }>
  }>('/api/data/latest', fetcher, { refreshInterval: 5000 })

  const { data: mlApiResponse, error: mlFetchError } = useSWR<{
    success?: boolean
    data?: MLAnalysisResult
    error?: string
  }>(selectedRoomId ? `/api/ml/analyze?roomId=${selectedRoomId}` : null, fetcher, {
    refreshInterval: 60000,
  })
  // API ส่ง { success: true, data: analysis } เมื่อสำเร็จ หรือ { success: false, error: "..." } เมื่อล้ม
  const mlAnalysis =
    mlApiResponse?.data && (mlApiResponse?.success === true || mlApiResponse?.data?.prediction != null)
      ? mlApiResponse.data
      : null
  const mlError =
    mlFetchError?.message || (mlApiResponse && mlApiResponse.success === false ? mlApiResponse.error : undefined)

  const stats = statsData?.data || {
    totalRooms: 0,
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
  }

  const rooms = roomsData?.data || []
  const sensors = sensorsData?.data || []
  const alerts = alertsData?.data || []
  const unresolvedAlerts = alerts.filter((a) => !a.isResolved)
  const powerNodeIds = new Set(sensors.filter((s) => s.type === 'power').map((s) => s.nodeId))
  const powerAlertsByRoomId = new Map<string, boolean>()
  unresolvedAlerts.forEach((a) => {
    if (a.roomId && a.nodeId && powerNodeIds.has(a.nodeId)) {
      powerAlertsByRoomId.set(a.roomId, true)
    }
  })

  const handleResolveAlert = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedBy: user?.name ?? user?.email ?? 'unknown' }),
    })
    mutateAlerts()
  }

  const handleResolveAll = async () => {
    await fetch('/api/alerts/resolve-all', { method: 'POST', credentials: 'include' })
    mutateAlerts()
  }

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId)
  }

  // Show loading or nothing while checking auth / redirecting
  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/10">
      <Header
        alertCount={unresolvedAlerts.length}
        alerts={alerts}
        onResolveAlert={hasPermission('canResolveAlert') ? handleResolveAlert : undefined}
        onResolveAll={hasPermission('canResolveAlert') ? handleResolveAll : undefined}
      />

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={unresolvedAlerts.length}
      />

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-r bg-card/50 lg:block">
          <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
        </aside>

        <main className="flex-1 p-3 pb-20 sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Page header */}
              <header className="border-b border-border/50 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  ภาพรวมระบบ
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ติดตามสถานะห้องเก็บยาสมุนไพรแบบเรียลไทม์
                </p>
              </header>

              {/* Stats + AC status */}
              <section aria-label="สถิติระบบ">
                <StatsCards stats={stats} />
              </section>

              {/* Room cards — full width */}
              <section aria-label="ห้องเก็บยา">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-7 w-1 rounded-full bg-primary shadow-sm shadow-primary/20" />
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    ห้องเก็บยา
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {rooms.length} ห้อง
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {rooms.map((room) => {
                    const latest = latestData?.data?.[room._id]
                    const latestDataForCard: EnvironmentalSensorData | undefined = latest
                      ? {
                        _id: '',
                        nodeId: '',
                        roomId: room._id,
                        timestamp: new Date(latest.timestamp),
                        type: 'environmental',
                        readings: {
                          temperature: latest.temperature,
                          humidity: latest.humidity,
                        },
                      }
                      : undefined
                    return (
                      <RoomCard
                        key={room._id}
                        room={room}
                        nodes={sensors.filter((s) => s.roomId === room._id)}
                        latestData={latestDataForCard}
                        roomACStatus={stats.acStatus?.byRoom.find((r) => r.roomId === room._id)}
                        hasPowerAlert={powerAlertsByRoomId.get(room._id) === true}
                        onSelect={handleRoomSelect}
                      />
                    )
                  })}
                </div>
                {rooms.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    ยังไม่มีห้อง — ไปที่เมนู &quot;จัดการห้อง&quot; เพื่อเพิ่มห้อง
                  </p>
                )}
              </section>

              {/* Room detail — shown when room selected */}
              {selectedRoomData?.data && (
                <section
                  className="space-y-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-6"
                  aria-label="รายละเอียดห้องที่เลือก"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-1 rounded-full bg-primary shadow-sm shadow-primary/20" />
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      {selectedRoomData.data.room?.name}
                    </h3>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      กำลังดูอยู่
                    </span>
                  </div>

                  {/* Sensor chart + ML summary side by side on large screens */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <SensorChart
                      data={selectedRoomData.data.sensorData || []}
                      room={selectedRoomData.data.room}
                      title={`ข้อมูลเซ็นเซอร์ - ${selectedRoomData.data.room?.name || ''}`}
                    />
                    <MLAnalysisPanel analysis={mlAnalysis ?? null} />
                  </div>

                  {/* ML metrics + anomaly */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MLMetricsCard
                      metrics={mlAnalysis?.prediction?.metrics}
                      modelName={mlAnalysis?.prediction?.model}
                      error={mlError}
                      isRoomSelected={!!selectedRoomId}
                    />
                    <AnomalyDetectionCard
                      anomaly={mlAnalysis?.anomaly ?? null}
                      userFriendlyAnomaly={mlAnalysis?.userFriendly?.anomaly}
                      error={mlError}
                      isRoomSelected={!!selectedRoomId}
                    />
                  </div>

                  {/* Prediction chart */}
                  <PredictionChart
                    predictions={mlAnalysis?.prediction ?? null}
                    title={`การพยากรณ์ - ${selectedRoomData.data.room?.name || ''}`}
                    showBothCharts
                  />
                </section>
              )}

              {/* Hint when no room selected */}
              {!selectedRoomId && rooms.length > 0 && (
                <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <span>👆</span>
                  คลิกการ์ดห้องเพื่อดูกราฟและผลวิเคราะห์ ML
                </p>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <RoomManagement
              rooms={rooms}
              sensors={sensors}
              acStatus={stats.acStatus}
              onUpdate={mutateRooms}
            />
          )}

          {activeTab === 'sensors' && (
            <SensorManagement
              sensors={sensors}
              rooms={rooms}
              onUpdate={mutateSensors}
            />
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">การแจ้งเตือน</h2>
                <p className="text-sm text-muted-foreground">
                  รายการการแจ้งเตือนทั้งหมดในระบบ
                </p>
              </div>
              <AlertsList
                alerts={alerts}
                onResolve={hasPermission('canResolveAlert') ? handleResolveAlert : undefined}
                onResolveAll={hasPermission('canResolveAlert') ? handleResolveAll : undefined}
              />
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  ML พยากรณ์แนวโน้ม
                </h2>
                <p className="text-sm text-muted-foreground">
                  ใช้ Machine Learning พยากรณ์อุณหภูมิและความชื้นล่วงหน้า
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <button
                    key={room._id}
                    onClick={() => setSelectedRoomId(room._id)}
                    className={`rounded-lg border p-4 text-left transition-colors ${selectedRoomId === room._id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <p className="font-medium text-foreground">{room.name}</p>
                    <p className="text-sm text-muted-foreground">{room.location}</p>
                  </button>
                ))}
              </div>

              {selectedRoomId && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MLMetricsCard
                      metrics={mlAnalysis?.prediction?.metrics}
                      modelName={mlAnalysis?.prediction?.model}
                      error={mlError}
                      isRoomSelected
                    />
                    <AnomalyDetectionCard
                      anomaly={mlAnalysis?.anomaly ?? null}
                      userFriendlyAnomaly={mlAnalysis?.userFriendly?.anomaly}
                      error={mlError}
                      isRoomSelected
                    />
                  </div>
                  <MLAnalysisPanel analysis={mlAnalysis ?? null} />
                  <PredictionChart
                    predictions={mlAnalysis?.prediction ?? null}
                    title="การพยากรณ์ล่วงหน้า"
                    showBothCharts
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">ประวัติข้อมูล</h2>
                <p className="text-sm text-muted-foreground">
                  ข้อมูลเซ็นเซอร์ย้อนหลังทั้งหมด — กรองตามห้อง เซ็นเซอร์ หรือประเภท
                </p>
              </div>
              <SensorDataViewer rooms={rooms} sensors={sensors} />
            </div>
          )}

          {activeTab === 'settings' && <SettingsPanel />}

          {activeTab === 'users' && hasPermission('canManageUsers') && (
            <UserManagement rooms={rooms} />
          )}

          {activeTab === 'audit' && hasPermission('canManageUsers') && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Audit Log</h2>
                <p className="text-sm text-muted-foreground">
                  บันทึกกิจกรรมและการเปลี่ยนแปลงทั้งหมดในระบบ
                </p>
              </div>
              <AuditLogViewer />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
