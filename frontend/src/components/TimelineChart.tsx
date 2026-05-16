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

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#141414',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#9ca3af', marginBottom: 4 },
  itemStyle: { color: '#e5e7eb' },
}

export function TimelineChart({ history }: Props) {
  const chartData = history.map((d) => ({
    date: d.date.slice(5),
    decoupling: parseFloat(d.decoupling_idx.toFixed(2)),
    anomaly: d.anomaly === -1 ? d.decoupling_idx : undefined,
  }))

  return (
    <div className="bg-[#141414] rounded-2xl p-6 border border-[#1e1e1e]">
      <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-1">
        Strain Decoupling Index
      </h3>
      <p className="text-xs text-gray-600 mb-5">
        Positive = parasympathetic dominant (recovery) · Negative = burnout risk
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#4b5563', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#4b5563', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
            width={36}
          />
          <Tooltip {...TOOLTIP_STYLE} />

          <ReferenceLine y={1.5}  stroke="#00ff94" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: 'Optimal', fill: '#00ff94', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={0}    stroke="#ffb800" strokeDasharray="4 4" strokeOpacity={0.4}
            label={{ value: 'Watch', fill: '#ffb800', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={-1.5} stroke="#ff4444" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: 'High Risk', fill: '#ff4444', fontSize: 10, position: 'right' }} />

          <Line
            type="monotone"
            dataKey="decoupling"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#60a5fa', stroke: '#0a0a0a', strokeWidth: 2 }}
            name="Decoupling"
          />
          <Line
            type="monotone"
            dataKey="anomaly"
            stroke="#ff4444"
            strokeWidth={0}
            dot={{ r: 5, fill: '#ff4444', stroke: '#0a0a0a', strokeWidth: 2 }}
            activeDot={false}
            name="Anomaly"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-5 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-blue-400 inline-block" /> Decoupling Index
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff4444] inline-block" /> Anomaly
        </span>
      </div>
    </div>
  )
}
