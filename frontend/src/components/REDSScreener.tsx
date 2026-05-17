import { useEffect, useState } from 'react'
import type { SurveyEntry } from '../types/analysis'
import { SURVEY_QUESTIONS, computeSurveyScore } from '../lib/screenerUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
  wearableScore: number
  onComplete: (entry: SurveyEntry) => void
}

type Step = 'intro' | number | 'confirm'

export function REDSScreener({ isOpen, onClose, wearableScore, onComplete }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [answers, setAnswers] = useState<Record<string, number>>({})

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('intro')
      setAnswers({})
    }
  }, [isOpen])

  // Trap scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const totalQuestions = SURVEY_QUESTIONS.length
  const currentIdx = typeof step === 'number' ? step : 0
  const currentQ = typeof step === 'number' ? SURVEY_QUESTIONS[step] : null
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined
  const progressPct = typeof step === 'number' ? ((step + 1) / totalQuestions) * 100 : step === 'confirm' ? 100 : 0

  function handleSubmit() {
    const survey_score = computeSurveyScore(answers)
    const entry: SurveyEntry = {
      id: crypto.randomUUID(),
      completed_at: new Date().toISOString(),
      answers,
      survey_score,
      wearable_score: wearableScore,
    }
    onComplete(entry)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Progress bar */}
        {step !== 'intro' && (
          <div className="h-1 bg-[#e2e8f0]">
            <div
              className="h-full bg-[#0ea5e9] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#94a3b8] hover:text-[#64748b] text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>

          {/* ── INTRO ── */}
          {step === 'intro' && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider">
                  RED-S Symptom Screener
                </span>
                <h2 className="text-lg font-bold text-[#0f172a] mt-1">
                  Biometric Concordance Assessment
                </h2>
              </div>
              <p className="text-sm text-[#475569] leading-relaxed">
                This 10-question screener is based on the RED-S Symptom Assessment Framework,
                covering energy availability, mood, performance, and health markers.
              </p>
              <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3.5">
                <p className="text-xs text-[#0369a1] font-mono">
                  Answers are stored locally on your device and never sent to a server.
                  After submission, your symptom score is compared against your current
                  wearable burnout risk score ({Math.round(wearableScore)}/100).
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  Start Screener
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] border border-[#e2e8f0]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── QUESTION ── */}
          {typeof step === 'number' && currentQ && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider">
                  Question {step + 1} of {totalQuestions}
                </span>
                <span className="text-[11px] font-mono text-[#94a3b8] capitalize">
                  {currentQ.category}
                </span>
              </div>

              <p className="text-sm font-semibold text-[#0f172a] leading-snug pr-6">
                {currentQ.text}
              </p>

              <div className="space-y-2">
                {currentQ.options.map(opt => {
                  const selected = currentAnswer === opt.value
                  const isNA = opt.value === -1
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: opt.value }))}
                      className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-all"
                      style={{
                        borderColor: selected ? '#0ea5e9' : '#e2e8f0',
                        backgroundColor: selected ? '#f0f9ff' : isNA ? '#f8fafc' : '#fff',
                        color: selected ? '#0369a1' : isNA ? '#94a3b8' : '#374151',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(step > 0 ? step - 1 : 'intro')}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] border border-[#e2e8f0]"
                >
                  Back
                </button>
                <button
                  disabled={currentAnswer === undefined}
                  onClick={() => setStep(step < totalQuestions - 1 ? step + 1 : 'confirm')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{ backgroundColor: '#0ea5e9', opacity: currentAnswer === undefined ? 0.4 : 1 }}
                >
                  {step < totalQuestions - 1 ? 'Next' : 'Review Answers'}
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRM ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider">
                  RED-S Symptom Screener
                </span>
                <h2 className="text-lg font-bold text-[#0f172a] mt-1">
                  Ready to submit
                </h2>
              </div>

              <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] divide-y divide-[#e2e8f0]">
                {SURVEY_QUESTIONS.map((q, i) => {
                  const ans = answers[q.id]
                  const opt = q.options.find(o => o.value === ans)
                  return (
                    <div key={q.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-[11px] font-mono text-[#94a3b8] mt-0.5 shrink-0">
                        {i + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#64748b] truncate">{q.text}</p>
                        <p className="text-xs font-semibold text-[#0f172a] mt-0.5">
                          {opt?.label ?? '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(i)}
                        className="ml-auto text-[11px] text-[#0ea5e9] font-mono shrink-0"
                      >
                        edit
                      </button>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-[#64748b]">
                Submit to generate your Biometric Concordance score and see how your
                self-reported symptoms align with your wearable biometrics.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(totalQuestions - 1)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] border border-[#e2e8f0]"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
