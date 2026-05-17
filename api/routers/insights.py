from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from api.cache import TTLCache, get_insights_cache
from api.models import InsightsResponse
from api.services.sentinel_service import run_analysis
from api.services.insights_service import generate_insights

router = APIRouter()


@router.get("/api/insights", response_model=InsightsResponse)
async def get_insights(
    source: str = Query("whoop", pattern="^(garmin|whoop)$"),
    start: str = Query(None),
    end: str = Query(None),
    cache: TTLCache = Depends(get_insights_cache),
):
    if end is None:
        end = datetime.today().strftime("%Y-%m-%d")
    if start is None:
        start = (datetime.today() - timedelta(days=180)).strftime("%Y-%m-%d")

    cache_key = f"insights:{source}:{start}:{end}"
    cached = cache.get(cache_key)
    if cached:
        result = cached.model_copy(update={"cached": True})
        return result

    try:
        analysis = run_analysis(source, start, end)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        err = str(e).lower()
        if any(w in err for w in ("auth", "login", "credential", "401", "403", "unauthorized")):
            raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")
        raise HTTPException(status_code=502, detail=f"Upstream device API error: {e}")

    result = await generate_insights(analysis.history, source)
    cache.set(cache_key, result)
    return result
