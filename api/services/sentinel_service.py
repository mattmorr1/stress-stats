from __future__ import annotations

import math
import os
import sys
from datetime import datetime, timedelta

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from proto import GarminStressSentinel, SentinelCoreMath  # noqa: E402
from whoop_client import WhoopStressSentinel               # noqa: E402
from garmin_fit_client import GarminFitSentinel            # noqa: E402

from api.config import settings
from api.models import AnalysisResponse, DailyRecord, ForecastDay, GarminRecoveryDetail, ScoreBreakdown, WorkoutSummary
from api.whoop_oauth import get_token
from api.services.score_mapper import (
    composite_burnout_risk,
    magnitude_z_to_hrv_strength,
    score_breakdown,
    strain_z_to_health,
)


def _ar_forecast(df, days_ahead: int = 3):
    """
    Mean-reverting AR(1) forecast with exponentially-weighted initialization.
    Produces genuinely distinct values per day by blending momentum decay
    with pull toward the user's long-term autonomic baseline.
    Returns (forecasts, lo_bounds, hi_bounds, confidence, trend_direction).
    """
    series = df["decoupling_idx"].dropna().values
    if len(series) < 7:
        return None

    n = len(series)
    long_mean = float(np.mean(series[-min(60, n):]))
    recent_std = float(np.std(series[-min(14, n):])) if n >= 3 else 1.0

    # EWM-weighted current state
    recent_n = min(14, n)
    w = np.exp(np.linspace(-2.0, 0.0, recent_n))
    w /= w.sum()
    current = float(np.dot(w, series[-recent_n:]))

    # Weighted linear trend over last 7 days
    trend_n = min(7, n)
    xw = np.exp(np.linspace(-1.0, 0.0, trend_n))
    xw /= xw.sum()
    xs = np.arange(trend_n, dtype=float)
    ys = series[-trend_n:]
    xm, ym = float(np.dot(xw, xs)), float(np.dot(xw, ys))
    denom = float(np.dot(xw, (xs - xm) ** 2)) + 1e-10
    trend = float(np.dot(xw, (xs - xm) * (ys - ym))) / denom

    # Mean-reversion: 20% pull toward long-term mean per day
    # Momentum: halves each step, so days 1/2/3 carry 100%/50%/25% of initial slope
    mr = 0.20
    momentum_decay = 0.50

    forecasts, lo_bounds, hi_bounds = [], [], []
    val, t = current, trend
    for i in range(1, days_ahead + 1):
        val = val + t + (long_mean - val) * mr
        t *= momentum_decay
        sigma = recent_std * (0.4 + 0.35 * i)  # uncertainty grows with horizon
        forecasts.append(float(val))
        lo_bounds.append(float(val - sigma))
        hi_bounds.append(float(val + sigma))

    confidence = float(np.clip(1.0 - recent_std / 4.0, 0.15, 0.90))

    net_change = forecasts[-1] - current
    if net_change > 0.12:
        trend_direction = "improving"
    elif net_change < -0.12:
        trend_direction = "declining"
    else:
        trend_direction = "stable"

    return forecasts, lo_bounds, hi_bounds, confidence, trend_direction


def _nan_to_none(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _enrich_features(df):
    """
    Post-processing on top of SentinelCoreMath.engineer_features():

    1. Lag strain_z by 1 day — HRV suppression peaks 24-48h after load, not same-day.
    2. Recompute decoupling_idx with the lagged strain signal.
    3. ACWR: 7-day acute / 28-day chronic rolling mean of red_strain.
       ACWR > 1.3 = danger zone; > 1.5 = high injury/burnout risk.
    4. hr_trend_z: resting HR z-score against 7-day rolling baseline.
       Persistently elevated resting HR is one of the clearest overtraining signals.
    """
    df = df.copy()

    df["strain_z"] = df["strain_z"].shift(1).fillna(0.0)
    df["decoupling_idx"] = df["magnitude_z"] - df["strain_z"]

    acute   = df["red_strain"].rolling(7,  min_periods=3).mean()
    chronic = df["red_strain"].rolling(28, min_periods=7).mean()
    df["acwr"] = (acute / chronic.where(chronic > 0)).round(3)

    if "resting_hr" in df.columns and df["resting_hr"].notna().sum() >= 3:
        hr_mean = df["resting_hr"].rolling(7, min_periods=3).mean()
        hr_std  = df["resting_hr"].rolling(7, min_periods=3).std()
        df["hr_trend_z"] = ((df["resting_hr"] - hr_mean) / hr_std.where(hr_std > 0)).round(3)
    else:
        df["hr_trend_z"] = np.nan

    return df


def _build_daily_record(idx, row, workouts: list[dict] | None = None) -> DailyRecord:
    d = idx.date() if hasattr(idx, "date") else idx
    acwr       = _nan_to_none(row.get("acwr"))
    hr_trend_z = _nan_to_none(row.get("hr_trend_z"))
    breakdown  = score_breakdown(float(row["decoupling_idx"]), acwr, hr_trend_z)

    # Garmin-specific enrichment — only present when GarminFitSentinel is used
    garmin_recovery = None
    recovery_whoop  = _nan_to_none(row.get("recovery_whoop"))
    if recovery_whoop is not None:
        garmin_recovery = GarminRecoveryDetail(
            recovery_score   = recovery_whoop,
            sleep_performance = float(row.get("sleep_performance") or 50.0),
            strain_score     = _nan_to_none(row.get("strain_score")),
            sleep_hours      = _nan_to_none(row.get("sleep_hours")),
            sleep_need       = _nan_to_none(row.get("sleep_need")),
            respiratory_rate = _nan_to_none(row.get("respiratory_rate")),
            rmssd_sws        = _nan_to_none(row.get("rmssd_sws")),
        )

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
        burnout_risk_score=breakdown["total"],
        hrv_strength_score=magnitude_z_to_hrv_strength(row["magnitude_z"]),
        strain_health_score=strain_z_to_health(row["strain_z"]),
        acwr=round(acwr, 3) if acwr is not None else None,
        hr_trend_z=round(hr_trend_z, 3) if hr_trend_z is not None else None,
        score_breakdown=ScoreBreakdown(**breakdown),
        garmin_recovery=garmin_recovery,
        readiness_state=row["readiness_state"],
        anomaly=int(row["anomaly"]),
        workouts=[WorkoutSummary(**w) for w in (workouts or [])],
    )


def run_analysis(source: str, start: str, end: str) -> AnalysisResponse:
    if source == "garmin":
        engine = GarminFitSentinel(settings.garmin_email, settings.garmin_password)
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
    df = _enrich_features(df)  # lag strain, add ACWR + hr_trend_z after proto.py processing

    workouts_by_date: dict[str, list[dict]] = {}
    if source == "whoop":
        try:
            workouts_by_date = engine.pull_workouts(start, end)
        except Exception:
            pass  # workouts are non-critical; proceed without them

    history = [
        _build_daily_record(idx, row, workouts_by_date.get(
            (idx.date() if hasattr(idx, "date") else idx).isoformat(), []
        ))
        for idx, row in df.iterrows()
    ]

    forecast = []
    ar_result = _ar_forecast(df, days_ahead=3)
    if ar_result is not None:
        forecasts, lo_bounds, hi_bounds, confidence, trend_direction = ar_result
        last_date = df.index[-1]
        for i, (val, lo, hi) in enumerate(zip(forecasts, lo_bounds, hi_bounds)):
            fdate = (last_date + timedelta(days=i + 1))
            risk = "High Burnout Risk" if val < -1.5 else ("Watch Load" if val < 0 else "Optimal")
            forecast.append(
                ForecastDay(
                    date=fdate.date() if hasattr(fdate, "date") else fdate,
                    forecasted_decoupling=round(val, 3),
                    predicted_risk=risk,
                    burnout_risk_score=composite_burnout_risk(val),
                    trend_direction=trend_direction,
                    confidence=round(confidence, 2),
                    lo_decoupling=round(lo, 3),
                    hi_decoupling=round(hi, 3),
                )
            )

    return AnalysisResponse(
        source=source,
        generated_at=datetime.utcnow().isoformat() + "Z",
        history=history,
        forecast=forecast,
        latest=history[-1],
    )
