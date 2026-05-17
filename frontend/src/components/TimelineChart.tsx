import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { DailyRecord } from '../types/analysis'

interface Props {
  history: DailyRecord[]
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, allData }: any) {
  if (!active || !payload?.length) return null
  const day = allData?.find((d: { date: string }) => d.date === label)
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-md px-3 py-2.5 text-xs">
      <p className="font-mono text-[#64748b] mb-1.5">{label}</p>
      {payload
        .filter((p: { dataKey: string; value: unknown }) => p.value != null)
        .map((p: { name: string; value: number; color: string; dataKey: string }) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-[#475569]">{p.name}</span>
            <span className="font-mono text-[#0f172a] ml-auto pl-4">{p.value}</span>
          </div>
        ))}
      {day?.workouts?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
          {day.workouts.map((w: { sport_name: string; strain: number | null }, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8b5cf6] flex-shrink-0" />
              <span className="text-[#7c3aed]">{w.sport_name}</span>
              {w.strain != null && (
                <span className="font-mono text-[#94a3b8] ml-auto">{w.strain.toFixed(1)} strain</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Toggle chip ───────────────────────────────────────────────────────────────

function Chip({
  label, color, active, onClick,
}: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all"
      style={{
        background:   active ? `${color}14` : '#f8fafc',
        borderColor:  active ? color : '#e2e8f0',
        color:        active ? color : '#94a3b8',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? color : '#cbd5e1' }} />
      {label}
    </button>
  )
}

// ── Chart ─────────────────────────────────────────────────────────────────────

const GRID  = '#f1f5f9'
const AXIS  = '#94a3b8'
const TICK  = { fill: AXIS, fontSize: 11 }

export function TimelineChart({ history }: Props) {
  const [show, setShow] = useState({
    decoupling: true,
    hrv:        true,
    burnout:    true,
    workouts:   true,
  })
  type Key = keyof typeof show
  const toggle = (k: Key) => setShow(v => ({ ...v, [k]: !v[k] }))

  const minDec  = Math.min(...history.map(d => d.decoupling_idx))
  const maxDec  = Math.max(...history.map(d => d.decoupling_idx))
  const yDomMin = minDec - 0.3
  const yDomMax = maxDec + 0.4

  const chartData = history.map(d => ({
    date:       d.date.slice(5),
    decoupling: parseFloat(d.decoupling_idx.toFixed(2)),
    anomaly:    d.anomaly === -1 ? d.decoupling_idx : null,
    hrv:        Math.round(d.hrv_strength_score),
    burnout:    Math.round(d.burnout_risk_score),
    workouts:   d.workouts,
  }))

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">

      {/* ── Panel 1: Decoupling Index ───────────────────────────────────── */}
      <div className="p-5 pb-2">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">
              Strain Decoupling Index
            </h3>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              HRV z-score − Strain z-score · above 0 = recovery dominant · below −1.5 = high burnout risk
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Chip label="Decoupling" color="#0ea5e9" active={show.decoupling} onClick={() => toggle('decoupling')} />
            <Chip label="Workouts"   color="#8b5cf6" active={show.workouts}   onClick={() => toggle('workouts')} />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              domain={[yDomMin, yDomMax]}
              width={36}
              tickFormatter={v => v.toFixed(1)}
            />
            <Tooltip content={(props) => <ChartTooltip {...props} allData={chartData} />} />

            <ReferenceLine y={1.5}  stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.5}
              label={{ value: '↑ Optimal', fill: '#059669', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={0}    stroke="#d97706" strokeDasharray="3 3" strokeOpacity={0.4}
              label={{ value: 'Watch', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine y={-1.5} stroke="#dc2626" strokeDasharray="3 3" strokeOpacity={0.4}
              label={{ value: '↓ High Risk', fill: '#dc2626', fontSize: 10, position: 'insideTopRight' }} />

            {show.workouts && chartData
              .filter(d => d.workouts.length > 0)
              .map(d => (
                <ReferenceLine
                  key={`wo-${d.date}`}
                  x={d.date}
                  stroke="#8b5cf6"
                  strokeDasharray="4 3"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  label={{
                    value: d.workouts.map(w => w.sport_name).join(' · '),
                    position: 'insideTopLeft',
                    fill: '#7c3aed',
                    fontSize: 9,
                    offset: 4,
                  }}
                />
              ))
            }

            <Line yAxisId={0} type="monotone" dataKey="decoupling" stroke="#0ea5e9" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }}
              name="Decoupling" hide={!show.decoupling} />

            <Line yAxisId={0} type="monotone" dataKey="anomaly" stroke="#dc2626" strokeWidth={0}
              dot={{ r: 5, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }}
              activeDot={false} name="Anomaly" hide={!show.decoupling} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mx-5 border-t border-[#f1f5f9]" />

      {/* ── Panel 2: Derived Scores ─────────────────────────────────────── */}
      <div className="p-5 pt-3">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">
              Derived Scores (0–100)
            </h3>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              Normalized to your personal rolling baseline · 50 = at baseline
            </p>
          </div>
          <div className="flex gap-1.5">
            <Chip label="HRV Strength" color="#059669" active={show.hrv}     onClick={() => toggle('hrv')} />
            <Chip label="Burnout Risk" color="#dc2626" active={show.burnout} onClick={() => toggle('burnout')} />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK} axisLine={false} tickLine={false} domain={[0, 100]} width={36} />
            <Tooltip content={(props) => <ChartTooltip {...props} allData={chartData} />} />

            <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" strokeOpacity={0.5}
              label={{ value: 'baseline', fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }} />

            {show.workouts && chartData
              .filter(d => d.workouts.length > 0)
              .map(d => (
                <ReferenceLine
                  key={`wo2-${d.date}`}
                  x={d.date}
                  stroke="#8b5cf6"
                  strokeDasharray="4 3"
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                />
              ))
            }

            <Line type="monotone" dataKey="hrv" stroke="#059669" strokeWidth={1.5}
              dot={false} activeDot={{ r: 3, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
              name="HRV Strength" hide={!show.hrv} />
            <Line type="monotone" dataKey="burnout" stroke="#dc2626" strokeWidth={1.5}
              dot={false} activeDot={{ r: 3, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }}
              name="Burnout Risk" hide={!show.burnout} />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-[11px] text-[#94a3b8] font-mono mt-2">
          HRV Strength = (HRV z-score + 3) / 6 × 100 · Burnout Risk = (−Decoupling + 1.5) / 3 × 100
        </p>
      </div>
    </div>
  )
}
