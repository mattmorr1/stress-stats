import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { useAnalysis } from './hooks/useAnalysis'
import { RingDashboard } from './components/RingDashboard'
import { TimelineChart } from './components/TimelineChart'
import { ForecastStrip } from './components/ForecastStrip'
import { StateCard } from './components/StateCard'
import { SettingsPanel, type AnalysisSettings } from './components/SettingsPanel'
import { fetchAuthStatus, getWhoopConnectUrl } from './api/auth'

const queryClient = new QueryClient()

function Dashboard() {
  const [settings, setSettings] = useState<AnalysisSettings>({
    source: 'whoop',
    start: format(subDays(new Date(), 180), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  })

  const { data: authStatus, refetch: refetchAuth } = useQuery({
    queryKey: ['auth-status'],
    queryFn: fetchAuthStatus,
    refetchInterval: false,
  })

  // Detect OAuth callback result in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'whoop') {
      window.history.replaceState({}, '', '/')
      refetchAuth()
    }
    const authError = params.get('auth_error')
    if (authError) {
      window.history.replaceState({}, '', '/')
      console.error('Whoop auth error:', authError)
    }
  }, [refetchAuth])

  const { data, isLoading, isError, error, isFetching } = useAnalysis(
    settings.source,
    settings.start,
    settings.end,
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Stress Sentinel
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Burnout forecasting from biometric data
            </p>
          </div>
          {data && (
            <span className="text-xs text-gray-600">
              {isFetching ? 'Refreshing…' : `Updated ${new Date(data.generated_at).toLocaleTimeString()}`}
            </span>
          )}
        </div>

        {/* Whoop connect banner */}
        {settings.source === 'whoop' && authStatus && !authStatus.whoop_connected && (
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6 flex items-center justify-between mb-2">
            <div>
              <p className="text-white font-medium">Connect your Whoop</p>
              <p className="text-gray-500 text-sm mt-0.5">
                Authorize access to your recovery data to get started.
              </p>
              {!authStatus.whoop_client_configured && (
                <p className="text-amber-500 text-xs mt-1">
                  WHOOP_CLIENT_ID missing in .env — add your developer credentials first.
                </p>
              )}
            </div>
            <a
              href={getWhoopConnectUrl()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#00ff94' }}
            >
              Connect Whoop
            </a>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-72 gap-3 text-gray-600">
            <div className="w-8 h-8 rounded-full border-2 border-[#00ff94] border-t-transparent animate-spin" />
            <span className="text-sm">Fetching {settings.source} data…</span>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="bg-red-950/30 border border-red-900/60 rounded-2xl p-6 text-red-400">
            <p className="font-medium mb-1">Connection failed</p>
            <p className="text-sm text-red-500">{(error as Error).message}</p>
          </div>
        )}

        {/* Main content */}
        {data && (
          <div className="space-y-4">

            {/* Row 1: Rings + State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#141414] rounded-2xl p-8 border border-[#1e1e1e] flex items-center justify-center">
                <RingDashboard latest={data.latest} />
              </div>
              <StateCard latest={data.latest} />
            </div>

            {/* Row 2: Forecast */}
            <ForecastStrip forecast={data.forecast} />

            {/* Row 3: Timeline */}
            <TimelineChart history={data.history} />

            {/* Row 4: Settings */}
            <SettingsPanel settings={settings} onChange={setSettings} />

            <p className="text-xs text-gray-700 text-center pb-4">
              Source: {data.source.toUpperCase()} · {data.history.length} days of data
            </p>
          </div>
        )}

        {/* Empty state — settings visible before first load */}
        {!isLoading && !isError && !data && (
          <SettingsPanel settings={settings} onChange={setSettings} />
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
