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
    readiness_state: ReadinessState
    anomaly: Literal[-1, 1]


class ForecastDay(BaseModel):
    date: date
    forecasted_decoupling: float
    predicted_risk: PredictedRisk
    burnout_risk_score: float


class AnalysisResponse(BaseModel):
    source: Literal["garmin", "whoop"]
    generated_at: str
    history: list[DailyRecord]
    forecast: list[ForecastDay]
    latest: DailyRecord
