from __future__ import annotations

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from proto import GarminStressSentinel, SentinelCoreMath  # noqa: E402
from whoop_client import WhoopStressSentinel  # noqa: E402

from api.config import settings
from api.models import AnalysisResponse, DailyRecord, ForecastDay
from api.whoop_oauth import get_token
from api.services.score_mapper import (
    decoupling_to_burnout_risk,
    magnitude_z_to_hrv_strength,
    strain_z_to_health,
)


def _build_daily_record(idx, row) -> DailyRecord:
    d = idx.date() if hasattr(idx, "date") else idx
    return DailyRecord(
        date=d,
        resting_hr=float(row["resting_hr"]) if row.get("resting_hr") is not None else None,
        rmssd=float(row["rmssd"]) if row.get("rmssd") is not None else None,
        red_strain=float(row["red_strain"]),
        magnitude_z=float(row["magnitude_z"]),
        volatility_cv=float(row["volatility_cv"]),
        volatility_z=float(row["volatility_z"]),
        strain_z=float(row["strain_z"]),
        decoupling_idx=float(row["decoupling_idx"]),
        burnout_risk_score=decoupling_to_burnout_risk(row["decoupling_idx"]),
        hrv_strength_score=magnitude_z_to_hrv_strength(row["magnitude_z"]),
        strain_health_score=strain_z_to_health(row["strain_z"]),
        readiness_state=row["readiness_state"],
        anomaly=int(row["anomaly"]),
    )


def run_analysis(source: str, start: str, end: str) -> AnalysisResponse:
    if source == "garmin":
        engine = GarminStressSentinel(settings.garmin_email, settings.garmin_password)
    else:
        token_data = get_token()
        if not token_data:
            raise ValueError(
                "Not connected to Whoop. "
                "Visit http://localhost:8000/api/auth/whoop to connect."
            )
        engine = WhoopStressSentinel(access_token=token_data["access_token"])

    engine.authenticate()
    raw_df = engine.pull_data(start, end)

    if raw_df is None or raw_df.empty:
        raise ValueError("No data returned from device API for the requested date range.")

    df = SentinelCoreMath.engineer_features(raw_df)
    df = SentinelCoreMath.classify_readiness_state(df)
    df = SentinelCoreMath.run_anomaly_detection(df)
    forecast_df = SentinelCoreMath.forecast_burnout(df, days_ahead=3)

    history = [_build_daily_record(idx, row) for idx, row in df.iterrows()]

    forecast = []
    if forecast_df is not None:
        for idx, row in forecast_df.iterrows():
            forecast.append(
                ForecastDay(
                    date=idx.date() if hasattr(idx, "date") else idx,
                    forecasted_decoupling=float(row["forecasted_decoupling"]),
                    predicted_risk=row["predicted_risk"],
                    burnout_risk_score=decoupling_to_burnout_risk(row["forecasted_decoupling"]),
                )
            )

    return AnalysisResponse(
        source=source,
        generated_at=datetime.utcnow().isoformat() + "Z",
        history=history,
        forecast=forecast,
        latest=history[-1],
    )
