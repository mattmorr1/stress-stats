from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from api.cache import TTLCache, get_cache
from api.models import AnalysisResponse
from api.services.sentinel_service import run_analysis

router = APIRouter()


@router.get("/api/analysis", response_model=AnalysisResponse)
def get_analysis(
    source: str = Query("whoop", pattern="^(garmin|whoop)$"),
    start: str = Query(None),
    end: str = Query(None),
    cache: TTLCache = Depends(get_cache),
):
    if end is None:
        end = datetime.today().strftime("%Y-%m-%d")
    if start is None:
        start = (datetime.today() - timedelta(days=180)).strftime("%Y-%m-%d")

    cache_key = f"{source}:{start}:{end}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        result = run_analysis(source, start, end)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        err = str(e).lower()
        if any(w in err for w in ("auth", "login", "credential", "401", "403", "unauthorized")):
            raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")
        if "expecting value" in err or "json" in err:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"The {source.capitalize()} API returned an unexpected response — "
                    "this usually means Cloudflare blocked the request. "
                    "Try again in a few minutes, or check that your credentials are correct."
                ),
            )
        raise HTTPException(status_code=502, detail=f"Upstream device API error: {e}")

    cache.set(cache_key, result)
    return result
