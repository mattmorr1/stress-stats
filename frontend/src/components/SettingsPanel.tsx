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

  const applyPreset = (days: number) => {
    onChange({
      ...settings,
      start: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      end: today,
    })
  }

  return (
    <div className="bg-[#141414] rounded-2xl p-6 border border-[#1e1e1e]">
      <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Settings</h3>

      {/* Source toggle */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2">Data Source</p>
        <div className="flex gap-2">
          {(['whoop', 'garmin'] as const).map((src) => (
            <button
              key={src}
              onClick={() => onChange({ ...settings, source: src })}
              className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all duration-150"
              style={
                settings.source === src
                  ? { background: '#00ff94', color: '#000', borderColor: '#00ff94' }
                  : { background: 'transparent', color: '#6b7280', borderColor: '#1e1e1e' }
              }
            >
              {src.charAt(0).toUpperCase() + src.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2">Date Range</p>
        <div className="flex gap-2 mb-3">
          {PRESETS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => applyPreset(days)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-[#1e1e1e] text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-all"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['start', 'end'] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-gray-600 block mb-1 capitalize">{field}</label>
              <input
                type="date"
                value={settings[field]}
                onChange={(e) => onChange({ ...settings, [field]: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00ff94] transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
