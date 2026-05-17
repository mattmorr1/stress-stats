import type { ConcordanceLevel, ScreenerResult, SurveyEntry, SurveyQuestion } from '../types/analysis'

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'fatigue',
    text: 'How would you describe your energy levels over the past 7 days?',
    category: 'energy',
    weight: 1.4,
    options: [
      { label: 'Normal — no change from baseline', value: 0 },
      { label: 'Slightly lower than usual', value: 25 },
      { label: 'Moderately fatigued', value: 50 },
      { label: 'Quite low — hard to get through the day', value: 75 },
      { label: 'Severely fatigued', value: 100 },
    ],
  },
  {
    id: 'mood',
    text: 'Have you experienced low mood, irritability, or emotional flatness in the past week?',
    category: 'mood',
    weight: 1.1,
    options: [
      { label: 'No — mood is normal', value: 0 },
      { label: 'Slightly off', value: 25 },
      { label: 'Noticeably lower mood or more irritable', value: 50 },
      { label: 'Quite difficult emotionally', value: 75 },
      { label: 'Severely low or detached', value: 100 },
    ],
  },
  {
    id: 'concentration',
    text: 'How has your ability to focus or concentrate been compared to your normal baseline?',
    category: 'mood',
    weight: 0.9,
    options: [
      { label: 'Normal — no change', value: 0 },
      { label: 'Slightly harder to focus', value: 25 },
      { label: 'Noticeably reduced concentration', value: 50 },
      { label: 'Brain fog most of the day', value: 75 },
      { label: 'Unable to concentrate effectively', value: 100 },
    ],
  },
  {
    id: 'gi_disturbances',
    text: 'Have you had any unusual gastrointestinal symptoms (bloating, nausea, appetite changes)?',
    category: 'health',
    weight: 0.8,
    options: [
      { label: 'No — none', value: 0 },
      { label: 'Mild and occasional', value: 25 },
      { label: 'Moderate and recurring', value: 50 },
      { label: 'Frequent and disruptive', value: 75 },
      { label: 'Severe or constant', value: 100 },
    ],
  },
  {
    id: 'sleep_quality',
    text: 'How would you rate your sleep quality over the past 7 days?',
    category: 'energy',
    weight: 1.2,
    options: [
      { label: 'Good — restful and restorative', value: 0 },
      { label: 'Slightly disrupted', value: 25 },
      { label: 'Moderately poor — waking or unrefreshed', value: 50 },
      { label: 'Poor most nights', value: 75 },
      { label: 'Very poor — severely impacting function', value: 100 },
    ],
  },
  {
    id: 'injury_frequency',
    text: 'Have you had any new or recurring injuries or musculoskeletal pain in the past 2 weeks?',
    category: 'health',
    weight: 0.9,
    options: [
      { label: 'No injuries or pain', value: 0 },
      { label: 'Minor soreness or niggles', value: 25 },
      { label: 'One notable issue limiting training', value: 50 },
      { label: 'Multiple issues or recurring injury', value: 75 },
      { label: 'Significant injury preventing training', value: 100 },
    ],
  },
  {
    id: 'motivation',
    text: 'How is your motivation to train or perform your normal activities?',
    category: 'performance',
    weight: 1.1,
    options: [
      { label: 'High — looking forward to training', value: 0 },
      { label: 'Slightly lower than usual', value: 25 },
      { label: 'Noticeably reduced — have to push myself', value: 50 },
      { label: 'Low — dreading most sessions', value: 75 },
      { label: 'None — avoiding training entirely', value: 100 },
    ],
  },
  {
    id: 'food_restriction',
    text: 'Have you been intentionally restricting food intake or skipping meals around training?',
    category: 'energy',
    weight: 1.3,
    options: [
      { label: 'No — eating normally to support training', value: 0 },
      { label: 'Occasionally eating less than needed', value: 25 },
      { label: 'Regularly skipping meals or restricting', value: 50 },
      { label: 'Significant restriction most days', value: 75 },
      { label: 'Severely undereating relative to output', value: 100 },
    ],
  },
  {
    id: 'performance_plateau',
    text: 'Has your performance plateaued or regressed despite continued training effort?',
    category: 'performance',
    weight: 1.1,
    options: [
      { label: 'No — performing as expected or improving', value: 0 },
      { label: 'Slight plateau in one area', value: 25 },
      { label: 'Noticeable stall across multiple metrics', value: 50 },
      { label: 'Clear regression in performance', value: 75 },
      { label: 'Significant performance decline', value: 100 },
    ],
  },
  {
    id: 'menstrual',
    text: 'Have you experienced menstrual irregularities or missed periods? (Select N/A if not applicable)',
    category: 'health',
    weight: 1.2,
    options: [
      { label: 'N/A — not applicable', value: -1 },
      { label: 'No — cycle is regular', value: 0 },
      { label: 'Slightly irregular', value: 25 },
      { label: 'Noticeably irregular or delayed', value: 50 },
      { label: 'Missed one period', value: 75 },
      { label: 'Missed 2+ periods or amenorrhea', value: 100 },
    ],
  },
]

export function computeSurveyScore(answers: Record<string, number>): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const q of SURVEY_QUESTIONS) {
    const answer = answers[q.id]
    if (answer === undefined || answer === -1) continue
    weightedSum += answer * q.weight
    totalWeight += q.weight
  }
  return totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight)
}

export function computeScreenerResult(entry: SurveyEntry): ScreenerResult {
  const { survey_score, wearable_score, completed_at } = entry
  const delta = survey_score - wearable_score
  const absDelta = Math.abs(delta)

  let concordance: ConcordanceLevel
  if (absDelta <= 15) concordance = 'strong'
  else if (absDelta <= 35) concordance = 'moderate'
  else concordance = 'divergent'

  let interpretation: string
  if (concordance === 'strong') {
    interpretation = `Your self-reported symptoms and wearable biometrics are in strong agreement (${delta > 0 ? '+' : ''}${delta.toFixed(0)} pts). The biometric signal is validated by subjective experience.`
  } else if (concordance === 'moderate') {
    interpretation = `Moderate alignment between self-report and wearable data (${delta > 0 ? '+' : ''}${delta.toFixed(0)} pts). Monitor both signals over the next 7 days.`
  } else if (delta > 35) {
    interpretation = `Your symptom burden (${survey_score}) substantially exceeds your wearable risk score (${wearable_score}). Subjective RED-S indicators may precede detectable HRV changes — consider discussing with a sports medicine clinician.`
  } else {
    interpretation = `Your wearable data (${wearable_score}) is significantly elevated above your symptom report (${survey_score}). You may be underreporting or have adapted to chronic load. Trust the biometric signal.`
  }

  return { survey_score, wearable_score, delta, concordance, interpretation, completed_at }
}

export function daysAgo(isoString: string): number {
  const ms = Date.now() - new Date(isoString).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
