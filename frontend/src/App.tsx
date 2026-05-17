import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { useAnalysis } from './hooks/useAnalysis'
import { RingDashboard } from './components/RingDashboard'
import { TimelineChart } from './components/TimelineChart'
import { ForecastStrip } from './components/ForecastStrip'
import { StateCard } from './components/StateCard'
import { SettingsPanel, type AnalysisSettings } from './components/SettingsPanel'
import { InsightsPanel } from './components/InsightsPanel'
import { GarminRecoveryCard } from './components/GarminRecoveryCard'
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
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
              Stress Sentinel
            </h1>
            <p className="text-[#64748b] text-sm mt-0.5 font-mono">
              burnout forecasting · biometric analysis
            </p>
          </div>
          {data && (
            <span className="text-xs text-[#94a3b8] font-mono">
              {isFetching ? 'refreshing…' : `↻ ${new Date(data.generated_at).toLocaleTimeString()}`}
            </span>
          )}
        </div>

        {/* Whoop connect banner */}
        {settings.source === 'whoop' && authStatus && !authStatus.whoop_connected && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex items-center justify-between mb-4 shadow-sm">
            <div>
              <p className="text-[#0f172a] font-semibold text-sm">Connect your Whoop</p>
              <p className="text-[#64748b] text-xs mt-0.5">
                Authorize OAuth access to load your recovery data.
              </p>
              {!authStatus.whoop_client_configured && (
                <p className="text-amber-600 text-xs mt-1 font-mono">
                  WHOOP_CLIENT_ID missing in .env
                </p>
              )}
            </div>
            <a
              href={getWhoopConnectUrl()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#0ea5e9' }}
            >
              Connect →
            </a>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-72 gap-3 text-[#94a3b8]">
            <div className="w-7 h-7 rounded-full border-2 border-[#0ea5e9] border-t-transparent animate-spin" />
            <span className="text-sm font-mono">fetching {settings.source} data…</span>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
            <p className="font-semibold text-sm mb-1">Connection failed</p>
            <p className="text-xs font-mono text-red-500">{(error as Error).message}</p>
          </div>
        )}

        {/* Main content */}
        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-8 border border-[#e2e8f0] shadow-sm flex items-center justify-center">
                <RingDashboard latest={data.latest} />
              </div>
              {data.latest.garmin_recovery ? (
                <GarminRecoveryCard recovery={data.latest.garmin_recovery} />
              ) : (
                <StateCard latest={data.latest} />
              )}
            </div>
            {data.latest.garmin_recovery && (
              <StateCard latest={data.latest} />
            )}

            <ForecastStrip forecast={data.forecast} />
            <InsightsPanel
              source={settings.source}
              start={settings.start}
              end={settings.end}
              latest={data.latest}
            />
            <TimelineChart history={data.history} />
            <SettingsPanel settings={settings} onChange={setSettings} />

            <p className="text-xs text-[#94a3b8] font-mono text-center pb-4">
              {data.source.toUpperCase()} · {data.history.length} days
            </p>
          </div>
        )}

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
