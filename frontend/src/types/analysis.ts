export type ReadinessState =
  | 'Peak / Ready'
  | 'Functional Overreach'
  | 'Non-Functional Fatigue'
  | 'Autonomic Exhaustion (RED-S Risk)'
  | 'Maintaining / Normal'

export type PredictedRisk = 'High Burnout Risk' | 'Watch Load' | 'Optimal'

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
  readiness_state: ReadinessState
  anomaly: -1 | 1
}

export interface ForecastDay {
  date: string
  forecasted_decoupling: number
  predicted_risk: PredictedRisk
  burnout_risk_score: number
}

export interface AnalysisResponse {
  source: 'garmin' | 'whoop'
  generated_at: string
  history: DailyRecord[]
  forecast: ForecastDay[]
  latest: DailyRecord
}
