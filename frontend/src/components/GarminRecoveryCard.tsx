import type { GarminRecoveryDetail } from '../types/analysis'

interface Props {
  recovery: GarminRecoveryDetail
}

function recoveryColor(score: number): string {
  if (score >= 67) return '#059669'
  if (score >= 34) return '#d97706'
  return '#dc2626'
}

function recoveryLabel(score: number): string {
  if (score >= 67) return 'Recovered'
  if (score >= 34) return 'Moderate'
  return 'Low'
}

function strainLabel(score: number | null): string {
  if (score === null) return '—'
  if (score < 10) return 'Light'
  if (score < 14) return 'Moderate'
  if (score < 18) return 'Strenuous'
  return 'All Out'
}

function strainColor(score: number | null): string {
  if (score === null) return '#94a3b8'
  if (score < 10) return '#059669'
  if (score < 14) return '#0ea5e9'
  if (score < 18) return '#d97706'
  return '#dc2626'
}

// Radial arc gauge — matches the ring dashboard aesthetic
function RecoveryGauge({ score }: { score: number }) {
  const color  = recoveryColor(score)
  const radius = 44
  const cx     = 56
  const cy     = 56
  const sweep  = 240  // degrees of arc
  const start  = 150 + (360 - sweep) / 2
  const filled = (score / 100) * sweep

  function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arc(start: number, end: number, r: number) {
    const s   = polar(cx, cy, r, start)
    const e   = polar(cx, cy, r, end)
    const big = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${big} 1 ${e.x} ${e.y}`
  }

  return (
    <svg width={112} height={112} viewBox="0 0 112 112">
      <path d={arc(start, start + sweep, radius)} fill="none" stroke="#e2e8f0" strokeWidth={8} strokeLinecap="round" />
      {score > 0 && (
        <path d={arc(start, start + filled, radius)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight="700" fontFamily="monospace">
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">
        / 100
      </text>
      <text x={cx} y={cy + 27} textAnchor="middle" fill={color} fontSize={9} fontWeight="600" fontFamily="sans-serif">
        {recoveryLabel(score)}
      </text>
    </svg>
  )
}

// Horizontal progress bar
function MetricBar({ label, value, max, unit, color }: {
  label: string; value: number | null; max: number; unit: string; color: string
}) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-mono text-[#64748b]">{label}</span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>
          {value != null ? `${typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : Math.round(value)} ${unit}` : '—'}
        </span>
      </div>
      <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function GarminRecoveryCard({ recovery }: Props) {
  const rColor = recoveryColor(recovery.recovery_score)
  const sColor = strainColor(recovery.strain_score)

  const sleepPct    = Math.round(recovery.sleep_performance)
  const sleepColor  = sleepPct >= 85 ? '#059669' : sleepPct >= 70 ? '#d97706' : '#dc2626'

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rColor }} />
        <span className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">
          Recovery · WHOOP-Equivalent
        </span>
      </div>

      <div className="flex items-center gap-6 mb-5">
        {/* Recovery gauge */}
        <RecoveryGauge score={recovery.recovery_score} />

        {/* Strain + key metrics */}
        <div className="flex-1 space-y-3">
          {/* Strain pill */}
          <div className="flex items-center justify-between bg-[#f8fafc] rounded-xl px-4 py-2.5 border border-[#e2e8f0]">
            <span className="text-[11px] font-mono text-[#64748b]">Daily Strain</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono" style={{ color: sColor }}>
                {recovery.strain_score != null ? recovery.strain_score.toFixed(1) : '—'}
              </span>
              <span className="text-[10px] font-mono text-[#94a3b8]">/ 21</span>
              <span
                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                style={{ color: sColor, background: `${sColor}18` }}
              >
                {strainLabel(recovery.strain_score)}
              </span>
            </div>
          </div>

          {/* HRV reading */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono text-[#64748b]">SWS-Window HRV</span>
            <span className="text-sm font-bold font-mono text-[#0f172a]">
              {recovery.rmssd_sws != null ? `${recovery.rmssd_sws.toFixed(1)} ms` : '—'}
            </span>
          </div>

          {/* Respiratory rate */}
          {recovery.respiratory_rate != null && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono text-[#64748b]">Resp. Rate</span>
              <span className="text-sm font-bold font-mono text-[#0f172a]">
                {recovery.respiratory_rate.toFixed(1)} brpm
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sleep breakdown */}
      <div className="space-y-3">
        <MetricBar
          label="Sleep Performance"
          value={sleepPct}
          max={100}
          unit="%"
          color={sleepColor}
        />
        <div className="flex gap-3 text-center">
          <div className="flex-1 bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <div className="text-[10px] font-mono text-[#94a3b8] mb-0.5">Slept</div>
            <div className="text-base font-bold font-mono text-[#0f172a]">
              {recovery.sleep_hours != null ? `${recovery.sleep_hours.toFixed(1)}h` : '—'}
            </div>
          </div>
          <div className="flex-1 bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0]">
            <div className="text-[10px] font-mono text-[#94a3b8] mb-0.5">Needed</div>
            <div className="text-base font-bold font-mono text-[#0f172a]">
              {recovery.sleep_need != null ? `${recovery.sleep_need.toFixed(1)}h` : '—'}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[#94a3b8] font-mono mt-3 leading-relaxed">
        Recovery = 0.65 × HRV (SWS-peak, 21d baseline) + 0.25 × RHR + 0.10 × sleep.
        Strain = Edwards TRIMP → 0–21 scale.
      </p>
    </div>
  )
}
