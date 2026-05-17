from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel

ReadinessState = Literal[
    "Peak / Ready",
    "Functional Overreach",
    "Non-Functional Fatigue",
    "Autonomic Exhaustion (RED-S Risk)",
    "Maintaining / Normal",
]

PredictedRisk = Literal["High Burnout Risk", "Watch Load", "Optimal"]


class WorkoutSummary(BaseModel):
    sport_name: str
    strain: Optional[float]


class ScoreBreakdown(BaseModel):
    base_risk: float
    acwr_penalty: float
    hr_penalty: float
    total: float


class DailyRecord(BaseModel):
    date: date
    resting_hr: Optional[float]
    rmssd: Optional[float]
    red_strain: float
    magnitude_z: float
    volatility_cv: float
    volatility_z: float
    strain_z: float
    decoupling_idx: float
    burnout_risk_score: float
    hrv_strength_score: float
    strain_health_score: float
    acwr: Optional[float] = None
    hr_trend_z: Optional[float] = None
    score_breakdown: Optional[ScoreBreakdown] = None
    readiness_state: ReadinessState
    anomaly: Literal[-1, 1]
    workouts: list[WorkoutSummary] = []


class ForecastDay(BaseModel):
    date: date
    forecasted_decoupling: float
    predicted_risk: PredictedRisk
    burnout_risk_score: float
    trend_direction: Literal["improving", "stable", "declining"] = "stable"
    confidence: float = 0.5
    lo_decoupling: float = 0.0
    hi_decoupling: float = 0.0


class AnalysisResponse(BaseModel):
    source: Literal["garmin", "whoop"]
    generated_at: str
    history: list[DailyRecord]
    forecast: list[ForecastDay]
    latest: DailyRecord


class DetectedPattern(BaseModel):
    pattern_id: str
    label: str
    description: str
    severity: Literal["low", "medium", "high"]
    duration_days: int


class InsightCard(BaseModel):
    title: str
    body: str
    severity: Literal["info", "warning", "critical"]
    signals: list[str]


class InsightsResponse(BaseModel):
    generated_at: str
    patterns: list[DetectedPattern]
    insights: list[InsightCard]
    cached: bool = False
