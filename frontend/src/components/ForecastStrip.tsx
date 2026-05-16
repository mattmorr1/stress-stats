import type { ForecastDay } from '../types/analysis'
import { riskColor, riskLabel } from '../lib/scoreMapper'

interface Props {
  forecast: ForecastDay[]
}

const DAY_LABELS = ['Tomorrow', 'Day 2', 'Day 3', 'Day 4', 'Day 5']

export function ForecastStrip({ forecast }: Props) {
  if (forecast.length === 0) {
    return (
      <div className="bg-[#141414] rounded-2xl p-6 border border-[#1e1e1e] text-gray-500 text-sm">
        Forecast unavailable — requires 14+ days of data.
      </div>
    )
  }

  return (
    <div className="bg-[#141414] rounded-2xl p-6 border border-[#1e1e1e]">
      <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">
        Burnout Forecast — Next {forecast.length} Days
      </h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${forecast.length}, 1fr)` }}>
        {forecast.map((day, i) => {
          const color = riskColor(day.burnout_risk_score)
          return (
            <div
              key={day.date}
              className="bg-[#0a0a0a] rounded-xl p-4 flex flex-col items-center gap-2.5 border border-[#1e1e1e]"
            >
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                {DAY_LABELS[i] ?? day.date}
              </span>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl"
                style={{ border: `2px solid ${color}`, color }}
              >
                {Math.round(day.burnout_risk_score)}
              </div>
              <span className="text-xs font-medium text-center leading-tight" style={{ color }}>
                {day.predicted_risk}
              </span>
              <span className="text-xs text-gray-600 font-mono">
                {day.forecasted_decoupling > 0 ? '+' : ''}{day.forecasted_decoupling.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
