import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { DailyRecord } from '../types/analysis'
import { riskColor, riskLabel } from '../lib/scoreMapper'

interface Props {
  latest: DailyRecord
}

export function RingDashboard({ latest }: Props) {
  const { burnout_risk_score, hrv_strength_score, strain_health_score } = latest

  const data = [
    { name: 'Strain Health', value: strain_health_score, fill: riskColor(100 - strain_health_score) },
    { name: 'HRV Strength',  value: hrv_strength_score,  fill: '#0ea5e9' },
    { name: 'Burnout Risk',  value: burnout_risk_score,   fill: riskColor(burnout_risk_score) },
  ]

  const primaryColor = riskColor(burnout_risk_score)

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-60 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="38%"
            outerRadius="96%"
            data={data}
            startAngle={210}
            endAngle={-30}
            barCategoryGap={5}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={4}
              background={{ fill: '#f1f5f9' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-5xl font-bold tabular-nums leading-none font-mono" style={{ color: primaryColor }}>
            {Math.round(burnout_risk_score)}
          </span>
          <span className="text-[10px] text-[#94a3b8] uppercase tracking-[0.15em] mt-1 font-mono">
            Burnout Risk
          </span>
          <span className="text-xs font-semibold mt-2 uppercase tracking-wider" style={{ color: primaryColor }}>
            {riskLabel(burnout_risk_score)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        {[
          { label: 'Burnout Risk',  value: burnout_risk_score,               color: primaryColor },
          { label: 'HRV Strength',  value: hrv_strength_score,               color: '#0ea5e9' },
          { label: 'Strain Health', value: strain_health_score, color: riskColor(100 - strain_health_score) },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2.5 text-xs">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[#64748b] flex-1">{label}</span>
            <span className="font-mono text-[#0f172a] tabular-nums">{Math.round(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
