"""
/api/garmin/summary — lightweight endpoint for the Garmin Connect IQ app.

Returns only the fields the watch needs: no 180-day history array,
no score breakdowns, no pattern data. Small JSON payload the watch
can parse within its 30-second timeout and fit in 64KB heap.

Reuses the existing 1-hour analysis cache so the watch call is fast
after the first daily sync.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.cache import TTLCache, get_cache
from api.services.sentinel_service import run_analysis

router = APIRouter()


class GarminSummary(BaseModel):
    recovery_score: float
    recovery_label: str
    strain_score: float | None
    strain_label: str
    sleep_performance: float
    sleep_hours: float | None
    sleep_need: float | None
    rmssd_sws: float | None
    resting_hr: float | None
    readiness_state: str
    burnout_risk: float
    trend: str
    generated_at: str
    data_age_hours: float


def _recovery_label(score: float) -> str:
    if score >= 67:
        return "Recovered"
    if score >= 34:
        return "Moderate"
    return "Low"


def _strain_label(score: float | None) -> str:
    if score is None:
        return "—"
    if score < 10:
        return "Light"
    if score < 14:
        return "Moderate"
    if score < 18:
        return "Strenuous"
    return "All Out"


@router.get("/api/garmin/summary", response_model=GarminSummary)
def get_garmin_summary(cache: TTLCache = Depends(get_cache)):
    end   = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")

    # Reuse the analysis cache — avoids re-fetching from Garmin Connect
    cache_key = f"garmin:{start}:{end}"
    cached = cache.get(cache_key)
    if cached:
        result = cached
    else:
        try:
            result = run_analysis("garmin", start, end)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Garmin data error: {e}")
        cache.set(cache_key, result)

    latest = result.latest
    gr     = latest.garmin_recovery

    generated_at = result.generated_at
    try:
        gen_dt = datetime.fromisoformat(generated_at.rstrip("Z"))
        age_h  = round((datetime.utcnow() - gen_dt).total_seconds() / 3600, 1)
    except Exception:
        age_h = 0.0

    recovery = gr.recovery_score if gr else latest.burnout_risk_score
    # Invert burnout risk if no Garmin recovery detail (burnout=100 → recovery=0)
    if gr is None:
        recovery = round(100.0 - latest.burnout_risk_score, 1)

    return GarminSummary(
        recovery_score   = recovery,
        recovery_label   = _recovery_label(recovery),
        strain_score     = gr.strain_score if gr else None,
        strain_label     = _strain_label(gr.strain_score if gr else None),
        sleep_performance = gr.sleep_performance if gr else 50.0,
        sleep_hours      = gr.sleep_hours if gr else None,
        sleep_need       = gr.sleep_need if gr else None,
        rmssd_sws        = gr.rmssd_sws if gr else latest.rmssd,
        resting_hr       = latest.resting_hr,
        readiness_state  = latest.readiness_state,
        burnout_risk     = latest.burnout_risk_score,
        trend            = result.forecast[0].trend_direction if result.forecast else "stable",
        generated_at     = generated_at,
        data_age_hours   = age_h,
    )
