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
import { AboutPanel } from './about-panel'
import { WeatherCard } from './WeatherCard'
import { ClimateComparisonCard } from './ClimateComparisonCard'
import { ACRecommendationCard } from './ACRecommendationCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import type {
  DashboardStats,
  Room,
  SensorNode,
  Alert,
  EnvironmentalSensorData,
  MLAnalysisResult,
  ExternalWeatherData,
  ClimateAnalysis,
  ACRecommendation,
  ACStatus,
} from '@/lib/types'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const error = new Error(body?.error || `HTTP ${res.status}`)
    throw error
  }
  return res.json()
}

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

  const { data: unresolvedAlertsData, mutate: mutateUnresolved } = useSWR<{
    success: boolean
    data: Alert[]
  }>('/api/alerts?resolved=false', fetcher, { refreshInterval: 10000 })

  const { data: resolvedAlertsData, mutate: mutateResolved } = useSWR<{
    success: boolean
    data: Alert[]
  }>('/api/alerts?resolved=true', fetcher, { refreshInterval: 30000 })

  const mutateAlerts = () => { mutateUnresolved(); mutateResolved() }

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

  const { data: acStatusData } = useSWR<{ success: boolean; data: ACStatus }>(
    '/api/data/ac-status',
    fetcher,
    { refreshInterval: 10000 }
  )

  // Weather data (global - Prachin Buri)
  const { data: weatherData } = useSWR<{
    success: boolean
    data: ExternalWeatherData
  }>('/api/weather/current', fetcher, { refreshInterval: 900000 }) // 15 min

  // Climate analysis (per selected room)
  const { data: climateData } = useSWR<{
    success: boolean
    data: ClimateAnalysis
  }>(selectedRoomId ? `/api/climate/analyze?roomId=${selectedRoomId}` : null, fetcher, {
    refreshInterval: 60000,
  })

  // AC recommendation (per selected room)
  const { data: acRecommendationData } = useSWR<{
    success: boolean
    data: ACRecommendation
  }>(selectedRoomId ? `/api/recommendations/ac?roomId=${selectedRoomId}` : null, fetcher, {
    refreshInterval: 60000,
  })

  const weather = weatherData?.success ? weatherData.data : null
  const climateAnalysis = climateData?.success ? climateData.data : null
  const acRecommendation = acRecommendationData?.success ? acRecommendationData.data : null

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
  const liveACStatus = acStatusData?.success ? acStatusData.data : stats.acStatus
  const unresolvedAlerts = unresolvedAlertsData?.data || []
  const resolvedAlerts = resolvedAlertsData?.data || []
  const alerts = [...unresolvedAlerts, ...resolvedAlerts]
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
            <div className="space-y-5">
              {/* Page header + weather inline */}
              <header className="space-y-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    ภาพรวมระบบ
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    ติดตามสถานะห้องเก็บยาสมุนไพรแบบเรียลไทม์
                  </p>
                </div>
                {weather && <WeatherCard weather={weather} />}
              </header>

              {/* Stats */}
              <StatsCards stats={stats} />

              {/* Room cards */}
              <section aria-label="ห้องเก็บยา">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  ห้องเก็บยา
                  <span className="ml-2 text-xs font-normal normal-case tracking-normal">
                    {rooms.length} ห้อง
                  </span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                        roomACStatus={liveACStatus?.byRoom.find((r) => r.roomId === room._id)}
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

              {/* Room detail — tabbed interface */}
              {selectedRoomData?.data && (
                <section
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
                  aria-label="รายละเอียดห้องที่เลือก"
                >
                  {/* Title bar with close button */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-1 rounded-full bg-primary" />
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedRoomData.data.room?.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedRoomId(null)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="ปิดรายละเอียดห้อง"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <Tabs defaultValue="sensors" className="space-y-4">
                    <TabsList className="w-full sm:w-auto">
                      <TabsTrigger value="sensors">เซ็นเซอร์</TabsTrigger>
                      <TabsTrigger value="ml">AI วิเคราะห์</TabsTrigger>
                      <TabsTrigger value="forecast">พยากรณ์</TabsTrigger>
                      {(climateAnalysis || acRecommendation) && (
                        <TabsTrigger value="climate">อากาศ & แอร์</TabsTrigger>
                      )}
                    </TabsList>

                    {/* Tab: เซ็นเซอร์ */}
                    <TabsContent value="sensors">
                      <SensorChart
                        data={selectedRoomData.data.sensorData || []}
                        room={selectedRoomData.data.room}
                        title={`ข้อมูลเซ็นเซอร์ - ${selectedRoomData.data.room?.name || ''}`}
                      />
                    </TabsContent>

                    {/* Tab: AI วิเคราะห์ */}
                    <TabsContent value="ml" className="space-y-4">
                      <MLAnalysisPanel analysis={mlAnalysis ?? null} />
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
                    </TabsContent>

                    {/* Tab: พยากรณ์ */}
                    <TabsContent value="forecast">
                      <PredictionChart
                        predictions={mlAnalysis?.prediction ?? null}
                        title={`การพยากรณ์ - ${selectedRoomData.data.room?.name || ''}`}
                        showBothCharts
                      />
                    </TabsContent>

                    {/* Tab: อากาศ & แอร์ */}
                    {(climateAnalysis || acRecommendation) && (
                      <TabsContent value="climate">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {climateAnalysis && (
                            <ClimateComparisonCard analysis={climateAnalysis} />
                          )}
                          {acRecommendation && (
                            <ACRecommendationCard recommendation={acRecommendation} />
                          )}
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </section>
              )}

              {/* Hint when no room selected */}
              {!selectedRoomId && rooms.length > 0 && (
                <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  คลิกการ์ดห้องเพื่อดูรายละเอียดและผลวิเคราะห์
                </p>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <RoomManagement
              rooms={rooms}
              sensors={sensors}
              acStatus={liveACStatus}
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

          {activeTab === 'about' && <AboutPanel />}
        </main>
      </div>
    </div>
  )
}
