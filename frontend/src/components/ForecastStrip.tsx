import type { ForecastDay } from '../types/analysis'
import { riskColor, directionArrow, directionColor } from '../lib/scoreMapper'

interface Props {
  forecast: ForecastDay[]
}

const DAY_LABELS = ['Tomorrow', 'Day +2', 'Day +3', 'Day +4', 'Day +5']

const RISK_BG: Record<string, string> = {
  'Optimal':           '#f0fdf4',
  'Watch Load':        '#fffbeb',
  'High Burnout Risk': '#fef2f2',
}
const RISK_BORDER: Record<string, string> = {
  'Optimal':           '#bbf7d0',
  'Watch Load':        '#fde68a',
  'High Burnout Risk': '#fecaca',
}

export function ForecastStrip({ forecast }: Props) {
  if (forecast.length === 0) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#94a3b8] font-mono">
          Forecast unavailable — requires 7+ days of data.
        </p>
      </div>
    )
  }

  const { trend_direction, confidence } = forecast[0]
  const trendColor = directionColor(trend_direction)
  const trendArrow = directionArrow(trend_direction)

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">
            Burnout Forecast — {forecast.length}-Day Outlook
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Mean-reverting model · confidence bands widen with horizon
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span style={{ color: trendColor }} className="font-bold text-base">{trendArrow}</span>
          <div className="text-right">
            <div style={{ color: trendColor }} className="font-semibold capitalize">{trend_direction}</div>
            <div className="text-[#94a3b8]">{Math.round(confidence * 100)}% conf.</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${forecast.length}, 1fr)` }}>
        {forecast.map((day, i) => {
          const color = riskColor(day.burnout_risk_score)
          const bg = RISK_BG[day.predicted_risk] ?? '#f8fafc'
          const border = RISK_BORDER[day.predicted_risk] ?? '#e2e8f0'
          const hasRange = day.hi_decoupling !== day.lo_decoupling
          return (
            <div
              key={day.date}
              className="rounded-xl p-4 flex flex-col items-center gap-2"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <span className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono">
                {DAY_LABELS[i] ?? day.date}
              </span>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg font-mono"
                style={{ border: `2px solid ${color}`, color, background: '#fff' }}
              >
                {Math.round(day.burnout_risk_score)}
              </div>
              <span className="text-xs font-semibold text-center leading-tight" style={{ color }}>
                {day.predicted_risk}
              </span>
              <div className="text-center">
                <span className="text-xs font-mono text-[#475569]">
                  {day.forecasted_decoupling > 0 ? '+' : ''}{day.forecasted_decoupling.toFixed(2)}σ
                </span>
                {hasRange && (
                  <div className="text-[10px] font-mono text-[#94a3b8] mt-0.5">
                    [{day.lo_decoupling.toFixed(1)}, {day.hi_decoupling.toFixed(1)}]
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-[#94a3b8] font-mono mt-3">
        Decoupling index = HRV z-score − Strain z-score. Values below 0 indicate strain is outpacing recovery.
      </p>
    </div>
  )
}
