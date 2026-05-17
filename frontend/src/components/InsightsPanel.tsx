import { useState } from 'react'
import type {
  DailyRecord,
  InsightsResponse,
  InsightSeverity,
  PatternSeverity,
  ScoreBreakdown,
  SurveyEntry,
} from '../types/analysis'
import { useInsights } from '../hooks/useInsights'
import { useSurvey } from '../hooks/useSurvey'
import { REDSScreener } from './REDSScreener'
import { computeScreenerResult, daysAgo } from '../lib/screenerUtils'

// ── Severity maps ─────────────────────────────────────────────────────────────

const INSIGHT_SEVERITY: Record<InsightSeverity, { bg: string; border: string; dot: string }> = {
  info:     { bg: '#f0f9ff', border: '#bae6fd', dot: '#0ea5e9' },
  warning:  { bg: '#fffbeb', border: '#fde68a', dot: '#d97706' },
  critical: { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
}

const PATTERN_SEVERITY: Record<PatternSeverity, { bg: string; text: string; border: string }> = {
  low:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  high:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
}

const CONCORDANCE_COLOR: Record<string, string> = {
  strong:    '#059669',
  moderate:  '#d97706',
  divergent: '#dc2626',
}

// ── Score Breakdown ───────────────────────────────────────────────────────────

function BreakdownBar({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / max) * 100))
  const sign = value > 0 ? '+' : ''
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono text-[#64748b] w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-[#e2e8f0] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono font-bold w-10 text-right" style={{ color }}>
        {sign}{value.toFixed(1)}
      </span>
    </div>
  )
}

function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
      <div className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono mb-3">
        Score Decomposition — Today
      </div>
      <div className="space-y-2">
        <BreakdownBar label="HRV Base"   value={breakdown.base_risk}    max={100} color="#64748b" />
        <BreakdownBar label="ACWR Load"  value={breakdown.acwr_penalty} max={25}  color="#d97706" />
        <BreakdownBar label="Resting HR" value={breakdown.hr_penalty}   max={20}  color="#dc2626" />
      </div>
      <div className="mt-3 pt-3 border-t border-[#e2e8f0] flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#94a3b8]">Composite Burnout Risk</span>
        <span
          className="text-lg font-bold font-mono"
          style={{ color: breakdown.total > 66 ? '#dc2626' : breakdown.total > 33 ? '#d97706' : '#059669' }}
        >
          {breakdown.total.toFixed(0)} / 100
        </span>
      </div>
    </div>
  )
}

// ── Concordance Card ──────────────────────────────────────────────────────────

function ConcordanceCard({
  entry,
  onRetake,
}: { entry: SurveyEntry; onRetake: () => void }) {
  const result = computeScreenerResult(entry)
  const age = daysAgo(entry.completed_at)
  const color = CONCORDANCE_COLOR[result.concordance]
  const wColor = result.wearable_score > 66 ? '#dc2626' : result.wearable_score > 33 ? '#d97706' : '#059669'
  const sColor = result.survey_score > 66 ? '#dc2626' : result.survey_score > 33 ? '#d97706' : '#059669'

  // Delta bar: center is neutral, left = wearable dominates, right = symptom dominates
  const barPct = Math.min(100, Math.abs(result.delta) / 100 * 200) // exaggerate for visibility
  const barLeft = result.delta < 0  // wearable > survey → bar goes left

  return (
    <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono">
          Biometric Concordance
        </span>
        <span
          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: color, background: `${color}15` }}
        >
          {result.concordance}
        </span>
      </div>

      {/* Score pills */}
      <div className="flex gap-3">
        <div className="flex-1 bg-white rounded-lg border border-[#e2e8f0] px-3 py-2 text-center">
          <div className="text-[10px] font-mono text-[#94a3b8] mb-0.5">Wearable Risk</div>
          <div className="text-xl font-bold font-mono" style={{ color: wColor }}>
            {Math.round(result.wearable_score)}
          </div>
        </div>
        <div className="flex items-center text-[#94a3b8] text-xs font-mono">vs</div>
        <div className="flex-1 bg-white rounded-lg border border-[#e2e8f0] px-3 py-2 text-center">
          <div className="text-[10px] font-mono text-[#94a3b8] mb-0.5">Symptom Score</div>
          <div className="text-xl font-bold font-mono" style={{ color: sColor }}>
            {Math.round(result.survey_score)}
          </div>
        </div>
      </div>

      {/* Delta bar */}
      <div className="relative h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-0.5 bg-[#94a3b8] left-1/2" />
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            width: `${barPct / 2}%`,
            backgroundColor: color,
            left: barLeft ? `${50 - barPct / 2}%` : '50%',
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-[#94a3b8]">
        <span>← wearable higher</span>
        <span>symptom higher →</span>
      </div>

      <p className="text-xs text-[#475569] leading-relaxed">{result.interpretation}</p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-mono text-[#94a3b8]">
          {age === 0 ? 'Completed today' : `${age}d ago`}
          {age > 14 && ' · may be outdated'}
        </span>
        <button
          onClick={onRetake}
          className="text-[11px] font-mono text-[#0ea5e9] hover:underline"
        >
          retake
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface Props {
  source: string
  start: string
  end: string
  latest: DailyRecord
}

export function InsightsPanel({ source, start, end, latest }: Props) {
  const { data, isLoading, isError } = useInsights(source, start, end)
  const { latest: latestSurvey, save } = useSurvey()
  const [screenerOpen, setScreenerOpen] = useState(false)

  function handleSurveyComplete(entry: SurveyEntry) {
    save(entry)
  }

  return (
    <>
      <REDSScreener
        isOpen={screenerOpen}
        onClose={() => setScreenerOpen(false)}
        wearableScore={latest.burnout_risk_score}
        onComplete={handleSurveyComplete}
      />

      <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94a3b8] uppercase tracking-widest font-mono">
              AI Insights
            </span>
            {data?.cached && (
              <span className="text-[10px] font-mono text-[#94a3b8] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
                cached
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-[10px] text-[#94a3b8] font-mono">
                {new Date(data.generated_at).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setScreenerOpen(true)}
              className="text-[11px] font-mono font-semibold border rounded-full px-3 py-1 transition-colors hover:bg-[#f0f9ff]"
              style={{ color: '#0ea5e9', borderColor: '#bae6fd' }}
            >
              RED-S Screener ›
            </button>
          </div>
        </div>

        {/* Score Breakdown */}
        {latest.score_breakdown && (
          <ScoreBreakdownCard breakdown={latest.score_breakdown} />
        )}

        {/* Concordance */}
        {latestSurvey ? (
          <ConcordanceCard entry={latestSurvey} onRetake={() => setScreenerOpen(true)} />
        ) : (
          <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
            <div className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono mb-2">
              Biometric Concordance
            </div>
            <p className="text-xs text-[#64748b] mb-3">
              Complete the RED-S Screener to compare your self-reported symptoms against
              your wearable biometrics and detect early energy deficiency signals.
            </p>
            <button
              onClick={() => setScreenerOpen(true)}
              className="text-xs font-semibold border rounded-xl px-4 py-2 transition-colors hover:bg-[#f0f9ff]"
              style={{ color: '#0ea5e9', borderColor: '#bae6fd' }}
            >
              Take the 10-question screener →
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[#94a3b8] py-1">
            <div className="w-4 h-4 rounded-full border-2 border-[#0ea5e9] border-t-transparent animate-spin shrink-0" />
            <span className="text-xs font-mono">analysing patterns…</span>
          </div>
        )}

        {/* No API key */}
        {isError && !isLoading && (
          <div className="text-xs text-[#94a3b8] font-mono py-1">
            Pattern analysis unavailable. Add <span className="text-[#0f172a]">ANTHROPIC_API_KEY</span> to .env to enable AI insights.
          </div>
        )}

        {data && (
          <>
            {/* Detected Patterns */}
            <div>
              <div className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono mb-2">
                Detected Patterns
              </div>
              {data.patterns.length === 0 ? (
                <p className="text-xs font-mono text-[#94a3b8]">No significant patterns detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.patterns.map(p => {
                    const s = PATTERN_SEVERITY[p.severity]
                    return (
                      <span
                        key={p.pattern_id}
                        title={p.description}
                        className="text-[11px] font-mono px-2.5 py-1 rounded-full border cursor-help"
                        style={{ background: s.bg, color: s.text, borderColor: s.border }}
                      >
                        {p.label}
                        <span className="ml-1.5 opacity-60">{p.duration_days}d</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Insight Cards */}
            {data.insights.length > 0 && (
              <div className="space-y-3">
                <div className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-mono">
                  Actionable Insights
                </div>
                {data.insights.map((card, i) => {
                  const s = INSIGHT_SEVERITY[card.severity]
                  return (
                    <div
                      key={i}
                      className="rounded-xl p-4 border"
                      style={{ background: s.bg, borderColor: s.border }}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        <div
                          className="w-2 h-2 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: s.dot }}
                        />
                        <p className="text-sm font-semibold text-[#0f172a] leading-tight">
                          {card.title}
                        </p>
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed mb-2.5">
                        {card.body}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {card.signals.map(sig => (
                          <span
                            key={sig}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border"
                            style={{ borderColor: s.border, color: '#64748b' }}
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
