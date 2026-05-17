from __future__ import annotations

import secrets
from urllib.parse import urlencode

import requests

from api.config import settings

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_SCOPES = "read:recovery read:cycles read:profile"

_token_store: dict = {}
_state_store: dict = {}


def get_auth_url() -> str:
    state = secrets.token_urlsafe(16)
    _state_store["state"] = state
    params = {
        "client_id": settings.whoop_client_id,
        "redirect_uri": settings.whoop_redirect_uri,
        "response_type": "code",
        "scope": WHOOP_SCOPES,
        "state": state,
    }
    return f"{WHOOP_AUTH_URL}?{urlencode(params)}"


def verify_state(state: str) -> bool:
    return state == _state_store.pop("state", None)


def exchange_code(code: str) -> dict:
    resp = requests.post(
        WHOOP_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": settings.whoop_client_id,
            "client_secret": settings.whoop_client_secret,
            "redirect_uri": settings.whoop_redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    resp.raise_for_status()
    token = resp.json()
    _token_store["token"] = token
    return token


def get_token() -> dict | None:
    return _token_store.get("token")


def is_authenticated() -> bool:
    return bool(_token_store.get("token"))


def clear_token() -> None:
    _token_store.clear()
