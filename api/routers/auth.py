from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from api.config import settings
from api.whoop_oauth import clear_token, exchange_code, get_auth_url, is_authenticated

router = APIRouter()


@router.get("/api/auth/whoop")
def whoop_login():
    if not settings.whoop_client_id:
        raise HTTPException(
            status_code=503,
            detail="WHOOP_CLIENT_ID not configured. Add it to .env and restart the server.",
        )
    return RedirectResponse(get_auth_url())


@router.get("/api/auth/whoop/callback")
def whoop_callback(code: str | None = None, error: str | None = None):
    if error or not code:
        return RedirectResponse(
            f"http://localhost:5173?auth_error={error or 'missing_code'}"
        )
    try:
        exchange_code(code)
    except Exception as e:
        return RedirectResponse(
            f"http://localhost:5173?auth_error={str(e)[:120]}"
        )
    return RedirectResponse("http://localhost:5173?connected=whoop")


@router.get("/api/auth/status")
def auth_status():
    return {
        "whoop_connected": is_authenticated(),
        "whoop_client_configured": bool(settings.whoop_client_id),
    }


@router.delete("/api/auth/whoop")
def whoop_disconnect():
    clear_token()
    return {"disconnected": True}
