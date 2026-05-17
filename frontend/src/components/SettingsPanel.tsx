import { format, subDays } from 'date-fns'

export interface AnalysisSettings {
  source: 'garmin' | 'whoop'
  start: string
  end: string
}

interface Props {
  settings: AnalysisSettings
  onChange: (s: AnalysisSettings) => void
}

const PRESETS = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 180 },
]

export function SettingsPanel({ settings, onChange }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const applyPreset = (days: number) =>
    onChange({ ...settings, start: format(subDays(new Date(), days), 'yyyy-MM-dd'), end: today })

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm">
      <h3 className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono mb-4">Settings</h3>

      {/* Source */}
      <div className="mb-5">
        <p className="text-xs text-[#94a3b8] font-mono mb-2">Data Source</p>
        <div className="flex gap-2">
          {(['whoop', 'garmin'] as const).map(src => (
            <button
              key={src}
              onClick={() => onChange({ ...settings, source: src })}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all font-mono uppercase tracking-wider"
              style={
                settings.source === src
                  ? { background: '#0ea5e9', color: '#fff', borderColor: '#0ea5e9' }
                  : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }
              }
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs text-[#94a3b8] font-mono mb-2">Date Range</p>
        <div className="flex gap-2 mb-3">
          {PRESETS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => applyPreset(days)}
              className="flex-1 py-1.5 rounded-lg text-xs font-mono border border-[#e2e8f0] text-[#64748b] hover:border-[#0ea5e9] hover:text-[#0ea5e9] transition-all"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['start', 'end'] as const).map(field => (
            <div key={field}>
              <label className="text-[11px] text-[#94a3b8] font-mono block mb-1 uppercase">{field}</label>
              <input
                type="date"
                value={settings[field]}
                onChange={e => onChange({ ...settings, [field]: e.target.value })}
                className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 text-xs text-[#0f172a] font-mono focus:outline-none focus:border-[#0ea5e9] transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
