import type { DailyRecord, ReadinessState } from '../types/analysis'

const STATE_COLORS: Record<ReadinessState, string> = {
  'Peak / Ready': '#00ff94',
  'Functional Overreach': '#ffb800',
  'Non-Functional Fatigue': '#ff8c00',
  'Autonomic Exhaustion (RED-S Risk)': '#ff4444',
  'Maintaining / Normal': '#6b7280',
}

const STATE_DESCRIPTIONS: Record<ReadinessState, string> = {
  'Peak / Ready': 'HRV is elevated and stable. Green light for high-intensity work or training.',
  'Functional Overreach': 'HRV suppressed but stabilizing. Moderate load only — recovery is active.',
  'Non-Functional Fatigue': 'HRV suppressed with persistent volatility. Prioritize rest and recovery.',
  'Autonomic Exhaustion (RED-S Risk)': 'Paradoxical HRV elevation with volatility collapse. Possible energy deficiency — monitor closely.',
  'Maintaining / Normal': 'Steady autonomic state. No acute risk detected.',
}

interface Props {
  latest: DailyRecord
}

export function StateCard({ latest }: Props) {
  const color = STATE_COLORS[latest.readiness_state]

  return (
    <div className="bg-[#141414] rounded-2xl p-6 border border-[#1e1e1e]">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs text-gray-400 uppercase tracking-widest">Readiness State</span>
        {latest.anomaly === -1 && (
          <span className="ml-auto text-xs bg-red-900/30 text-red-400 border border-red-800/60 rounded-full px-2.5 py-0.5 flex-shrink-0">
            Anomaly
          </span>
        )}
      </div>

      <p className="text-xl font-semibold leading-tight" style={{ color }}>
        {latest.readiness_state}
      </p>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        {STATE_DESCRIPTIONS[latest.readiness_state]}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-[#0a0a0a] rounded-xl p-3.5">
          <div className="text-xs text-gray-500 mb-1">Resting HR</div>
          <div className="font-mono text-2xl font-semibold text-white leading-none">
            {latest.resting_hr != null ? Math.round(latest.resting_hr) : '—'}
            <span className="text-gray-500 text-xs font-sans ml-1">bpm</span>
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-3.5">
          <div className="text-xs text-gray-500 mb-1">HRV (RMSSD)</div>
          <div className="font-mono text-2xl font-semibold text-white leading-none">
            {latest.rmssd != null ? latest.rmssd.toFixed(1) : '—'}
            <span className="text-gray-500 text-xs font-sans ml-1">ms</span>
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-3.5">
          <div className="text-xs text-gray-500 mb-1">Decoupling Index</div>
          <div className="font-mono text-2xl font-semibold leading-none" style={{ color }}>
            {latest.decoupling_idx > 0 ? '+' : ''}{latest.decoupling_idx.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-3.5">
          <div className="text-xs text-gray-500 mb-1">HRV Strength</div>
          <div className="font-mono text-2xl font-semibold text-blue-400 leading-none">
            {Math.round(latest.hrv_strength_score)}
            <span className="text-gray-500 text-xs font-sans ml-1">/ 100</span>
          </div>
        </div>
      </div>
    </div>
  )
}
