import { NextResponse } from 'next/server'
import { isPythonMLAvailable } from '@/lib/ml-python-bridge'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pythonML = isPythonMLAvailable()

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    features: {
      pythonML,
      ensembleAnomaly: process.env.USE_ENSEMBLE_ANOMALY === '1',
    },
  })
}
