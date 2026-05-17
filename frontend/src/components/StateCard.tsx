import type { DailyRecord, ReadinessState } from '../types/analysis'

function acwrColor(acwr: number | null): string {
  if (acwr == null) return '#94a3b8'
  if (acwr < 0.8)  return '#64748b'   // detraining
  if (acwr <= 1.3) return '#059669'   // optimal training zone
  if (acwr <= 1.5) return '#d97706'   // caution
  return '#dc2626'                     // danger zone
}

const STATE_COLORS: Record<ReadinessState, string> = {
  'Peak / Ready':                       '#059669',
  'Functional Overreach':               '#d97706',
  'Non-Functional Fatigue':             '#ea580c',
  'Autonomic Exhaustion (RED-S Risk)':  '#dc2626',
  'Maintaining / Normal':               '#64748b',
}

const STATE_DESCRIPTIONS: Record<ReadinessState, string> = {
  'Peak / Ready':
    'HRV elevated and stable. Parasympathetic dominant — green light for high-intensity training.',
  'Functional Overreach':
    'HRV suppressed but stabilizing. Moderate load only; active recovery underway.',
  'Non-Functional Fatigue':
    'HRV suppressed with persistent volatility. Prioritize rest — adaptation is stalling.',
  'Autonomic Exhaustion (RED-S Risk)':
    'Paradoxical HRV elevation with volatility collapse — possible energy deficiency. Monitor closely.',
  'Maintaining / Normal':
    'Steady autonomic state. No acute stress signal detected.',
}

interface Props {
  latest: DailyRecord
}

export function StateCard({ latest }: Props) {
  const color = STATE_COLORS[latest.readiness_state]

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">Readiness State</span>
        {latest.anomaly === -1 && (
          <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2.5 py-0.5 font-mono flex-shrink-0">
            anomaly
          </span>
        )}
      </div>

      <p className="text-lg font-bold leading-tight" style={{ color }}>
        {latest.readiness_state}
      </p>
      <p className="text-sm text-[#64748b] mt-2 leading-relaxed">
        {STATE_DESCRIPTIONS[latest.readiness_state]}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { label: 'Resting HR',       value: latest.resting_hr != null ? `${Math.round(latest.resting_hr)}` : '—', unit: 'bpm',  color: undefined },
          { label: 'HRV (RMSSD)',      value: latest.rmssd != null ? latest.rmssd.toFixed(1) : '—',                  unit: 'ms',   color: undefined },
          { label: 'Decoupling Index', value: `${latest.decoupling_idx > 0 ? '+' : ''}${latest.decoupling_idx.toFixed(2)}`, unit: 'σ', color },
          { label: 'HRV Strength',     value: `${Math.round(latest.hrv_strength_score)}`,                            unit: '/ 100', color: '#0ea5e9' },
          {
            label: 'Acute/Chronic Load',
            value: latest.acwr != null ? latest.acwr.toFixed(2) : '—',
            unit:  'ACWR',
            color: acwrColor(latest.acwr),
          },
          {
            label: 'HR Trend',
            value: latest.hr_trend_z != null
              ? `${latest.hr_trend_z > 0 ? '+' : ''}${latest.hr_trend_z.toFixed(2)}`
              : '—',
            unit:  'σ vs baseline',
            color: latest.hr_trend_z == null ? undefined
              : latest.hr_trend_z > 1.5 ? '#dc2626'
              : latest.hr_trend_z > 0.8 ? '#d97706'
              : latest.hr_trend_z < -0.5 ? '#059669'
              : undefined,
          },
        ].map(({ label, value, unit, color: c }) => (
          <div key={label} className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0]">
            <div className="text-[11px] text-[#94a3b8] mb-1 uppercase tracking-wider font-mono">{label}</div>
            <div className="text-2xl font-bold leading-none font-mono" style={{ color: c ?? '#0f172a' }}>
              {value}
              <span className="text-[#94a3b8] text-xs font-sans font-normal ml-1">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
