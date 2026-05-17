export interface WorkoutSummary {
  sport_name: string
  strain: number | null
}

export type ReadinessState =
  | 'Peak / Ready'
  | 'Functional Overreach'
  | 'Non-Functional Fatigue'
  | 'Autonomic Exhaustion (RED-S Risk)'
  | 'Maintaining / Normal'

export type PredictedRisk = 'High Burnout Risk' | 'Watch Load' | 'Optimal'

export interface GarminRecoveryDetail {
  recovery_score: number
  sleep_performance: number
  strain_score: number | null
  sleep_hours: number | null
  sleep_need: number | null
  respiratory_rate: number | null
  rmssd_sws: number | null
}

export interface ScoreBreakdown {
  base_risk: number
  acwr_penalty: number
  hr_penalty: number
  total: number
}

export interface DailyRecord {
  date: string
  resting_hr: number | null
  rmssd: number | null
  red_strain: number
  magnitude_z: number
  volatility_cv: number
  volatility_z: number
  strain_z: number
  decoupling_idx: number
  burnout_risk_score: number
  hrv_strength_score: number
  strain_health_score: number
  acwr: number | null
  hr_trend_z: number | null
  score_breakdown: ScoreBreakdown | null
  garmin_recovery: GarminRecoveryDetail | null
  readiness_state: ReadinessState
  anomaly: -1 | 1
  workouts: WorkoutSummary[]
}

export interface ForecastDay {
  date: string
  forecasted_decoupling: number
  predicted_risk: PredictedRisk
  burnout_risk_score: number
  trend_direction: 'improving' | 'stable' | 'declining'
  confidence: number
  lo_decoupling: number
  hi_decoupling: number
}

export interface AnalysisResponse {
  source: 'garmin' | 'whoop'
  generated_at: string
  history: DailyRecord[]
  forecast: ForecastDay[]
  latest: DailyRecord
}

export type PatternSeverity = 'low' | 'medium' | 'high'
export type InsightSeverity = 'info' | 'warning' | 'critical'

export interface DetectedPattern {
  pattern_id: string
  label: string
  description: string
  severity: PatternSeverity
  duration_days: number
}

export interface InsightCard {
  title: string
  body: string
  severity: InsightSeverity
  signals: string[]
}

export interface InsightsResponse {
  generated_at: string
  patterns: DetectedPattern[]
  insights: InsightCard[]
  cached: boolean
}

export type SurveyCategory = 'energy' | 'mood' | 'performance' | 'health'

export interface SurveyOption {
  label: string
  value: number  // 0–100, or -1 for N/A
}

export interface SurveyQuestion {
  id: string
  text: string
  options: SurveyOption[]
  weight: number
  category: SurveyCategory
}

export interface SurveyEntry {
  id: string
  completed_at: string
  answers: Record<string, number>
  survey_score: number
  wearable_score: number
}

export type ConcordanceLevel = 'strong' | 'moderate' | 'divergent'

export interface ScreenerResult {
  survey_score: number
  wearable_score: number
  delta: number
  concordance: ConcordanceLevel
  interpretation: string
  completed_at: string
}
