import pandas as pd
import numpy as np
import requests
from datetime import datetime

WHOOP_API_BASE = "https://api.prod.whoop.com/developer"

WHOOP_SPORT_NAMES: dict[int, str] = {
    -1: "Activity",
    0: "Running",
    1: "Cycling",
    16: "Swimming",
    44: "Strength Training",
    45: "Functional Fitness",
    46: "CrossFit",
    47: "HIIT",
    48: "Pilates",
    49: "Yoga",
    50: "Hiking",
    51: "Basketball",
    52: "Soccer",
    53: "Baseball",
    54: "Tennis",
    55: "Golf",
    63: "Football",
    64: "Boxing",
    71: "Rock Climbing",
    72: "Rowing",
    126: "Triathlon",
}


class WhoopStressSentinel:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._session = requests.Session()
        self._session.headers["Authorization"] = f"Bearer {access_token}"

    def authenticate(self):
        pass  # token already set

    def pull_data(self, start_date_str: str, end_date_str: str):
        print(f"Pulling Whoop data ({start_date_str} to {end_date_str})...")

        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")

        start_iso = start_dt.strftime("%Y-%m-%dT00:00:00.000Z")
        end_iso = end_dt.strftime("%Y-%m-%dT23:59:59.000Z")

        all_records = []
        params: dict = {"start": start_iso, "end": end_iso, "limit": 25}

        while True:
            resp = self._session.get(
                f"{WHOOP_API_BASE}/v2/recovery", params=params, timeout=20
            )
            resp.raise_for_status()
            body = resp.json()
            all_records.extend(body.get("records", []))
            next_token = body.get("next_token")
            if not next_token:
                break
            params = {"nextToken": next_token, "limit": 25}

        print(f"  Retrieved {len(all_records)} recovery records")

        all_daily_data = []
        for rec in all_records:
            metrics = rec.get("score") or {}
            if not metrics:
                continue
            date = rec.get("created_at", "").split("T")[0]
            rhr = metrics.get("resting_heart_rate", np.nan)
            rmssd = metrics.get("hrv_rmssd_milli", np.nan)
            if pd.notna(rhr) and pd.notna(rmssd):
                all_daily_data.append({
                    "date": pd.to_datetime(date),
                    "resting_hr": float(rhr),
                    "rmssd": float(rmssd),
                })

        if not all_daily_data:
            return None

        df = pd.DataFrame(all_daily_data).set_index("date").sort_index()
        df = df[(df.index >= start_dt) & (df.index <= end_dt)]
        return df

    def pull_workouts(self, start_date_str: str, end_date_str: str) -> dict[str, list[dict]]:
        """Returns {date_str: [{sport_name, strain}, ...]} for each day with workouts."""
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
        start_iso = start_dt.strftime("%Y-%m-%dT00:00:00.000Z")
        end_iso = end_dt.strftime("%Y-%m-%dT23:59:59.000Z")

        all_records = []
        params: dict = {"start": start_iso, "end": end_iso, "limit": 25}
        while True:
            resp = self._session.get(
                f"{WHOOP_API_BASE}/v2/workout", params=params, timeout=20
            )
            resp.raise_for_status()
            body = resp.json()
            all_records.extend(body.get("records", []))
            next_token = body.get("next_token")
            if not next_token:
                break
            params = {"nextToken": next_token, "limit": 25}

        by_date: dict[str, list[dict]] = {}
        for rec in all_records:
            date = rec.get("start", "").split("T")[0]
            if not date:
                continue
            score = rec.get("score") or {}
            sport_id = rec.get("sport_id", -1)
            by_date.setdefault(date, []).append({
                "sport_name": WHOOP_SPORT_NAMES.get(sport_id, "Workout"),
                "strain": score.get("strain"),
            })
        return by_date
