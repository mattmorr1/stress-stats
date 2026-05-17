"""
GarminFitSentinel — WHOOP-equivalent recovery scoring from Garmin Connect data.

Uses Garmin's granular API endpoints (not just summary values):
  - get_hrv_data()         → hrvReadings time series → SWS-window peak RMSSD
  - get_heart_rates()      → continuous overnight HR → true resting HR
  - get_respiration_data() → overnight respiratory rate
  - get_sleep_data()       → sleep duration, stages, debt
  - get_activity_hr_in_timezones() → Edwards TRIMP-based strain score

Recovery score formula (WHOOP-equivalent, weighted toward HRV):
  recovery = 0.65 × hrv_score + 0.25 × rhr_score + 0.10 × sleep_score

All scores are sigmoid-normalized against a rolling 21-day personal baseline
so the score reflects deviation from YOUR baseline, not population norms.
This makes it more critical and day-to-day sensitive than Garmin's Body Battery.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

try:
    from garminconnect import Garmin
except ImportError:
    Garmin = None  # type: ignore

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_BASELINE_DAYS     = 21    # rolling window for personal HRV / RHR baseline
_SIGMOID_K         = 1.8   # steepness of sigmoid — higher = more sensitive
_SLEEP_BASE_HOURS  = 7.5   # baseline sleep need before strain adjustment
_TRIMP_MAX         = 380.0 # TRIMP at which strain = 21 (very hard day)
_SWS_WINDOW_HOURS  = 3     # first N hours of sleep where SWS is densest

# Edwards TRIMP zone weights (zone_number → pts/min)
_TRIMP_ZONE_WEIGHTS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5}


# ── HRV time-series analysis ──────────────────────────────────────────────────

def _parse_ts(ts: str) -> datetime | None:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(ts, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _find_sws_rmssd(readings: list[dict], sleep_start: str | None = None) -> float:
    """
    WHOOP-style SWS-window RMSSD.

    Strategy:
    1. If sleep start is known, isolate readings within the first 3 hours
       (slow-wave sleep is most dense here — highest RMSSD, lowest noise).
    2. Remove obvious artifacts (readings outside 0.4–2.5× median).
    3. Return the peak clean reading — this is what WHOOP reports as HRV.

    Fallback: return the 75th-percentile of all overnight readings
    (captures high-parasympathetic moments without the sleep-staging info).
    """
    if not readings:
        return float("nan")

    tagged: list[tuple[datetime | None, float]] = []
    for r in readings:
        val = r.get("hrvValue")
        if val is None:
            continue
        ts_str = r.get("startTimestampGMT") or r.get("startTimestampLocal")
        tagged.append((_parse_ts(ts_str), float(val)))

    if not tagged:
        return float("nan")

    # Try SWS window selection
    if sleep_start and len(tagged) >= 3:
        sleep_dt = _parse_ts(sleep_start)
        if sleep_dt is not None:
            cutoff = sleep_dt + timedelta(hours=_SWS_WINDOW_HOURS)
            sws_vals = [v for ts, v in tagged if ts is not None and ts <= cutoff]
            if len(sws_vals) >= 3:
                median = float(np.median(sws_vals))
                clean = [v for v in sws_vals if 0.4 * median < v < 2.5 * median]
                if clean:
                    return float(max(clean))

    # Fallback — 75th percentile of all overnight readings
    all_vals = [v for _, v in tagged]
    return float(np.percentile(all_vals, 75)) if all_vals else float("nan")


# ── Strain computation ────────────────────────────────────────────────────────

def _trimp_from_zones(hr_zones: list[dict]) -> float:
    """Edwards TRIMP from garmin hrTimeInZones list."""
    trimp = 0.0
    for zone in hr_zones:
        w = _TRIMP_ZONE_WEIGHTS.get(zone.get("zoneNumber", 0), 0)
        trimp += (zone.get("secsInZone", 0) / 60.0) * w
    return trimp


def _trimp_to_strain(trimp: float) -> float:
    """Map TRIMP to WHOOP-equivalent 0–21 strain scale."""
    return min(21.0, max(0.0, trimp / _TRIMP_MAX * 21.0))


# ── Sleep scoring ─────────────────────────────────────────────────────────────

def _sleep_hours_from_data(sleep: dict) -> float | None:
    secs = sleep.get("sleepTimeSeconds") or sleep.get("totalSleepTimeInSeconds")
    if secs is None:
        # Try summing stage seconds
        secs = (
            (sleep.get("deepSleepSeconds") or 0)
            + (sleep.get("lightSleepSeconds") or 0)
            + (sleep.get("remSleepSeconds") or 0)
        )
    return round(secs / 3600.0, 2) if secs else None


def _sleep_start_gmt(sleep: dict) -> str | None:
    raw = sleep.get("sleepStartTimestampGMT") or sleep.get("startTimestampGMT")
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        # epoch millis
        dt = datetime.utcfromtimestamp(raw / 1000.0)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(raw)


def _sleep_need(prev_strain: float, sleep_debt_hours: float) -> float:
    """sleep_need increases with yesterday's strain and accumulated debt."""
    strain_add = min(2.0, prev_strain / 21.0 * 2.0)
    debt_add   = min(1.0, sleep_debt_hours / 3.0)
    return _SLEEP_BASE_HOURS + strain_add + debt_add


def _sleep_performance(actual: float | None, need: float) -> float:
    if actual is None or need <= 0:
        return 50.0
    return min(100.0, max(0.0, actual / need * 100.0))


# ── Recovery score ────────────────────────────────────────────────────────────

def _sigmoid(z: float, k: float = _SIGMOID_K) -> float:
    return 100.0 / (1.0 + math.exp(-k * z))


def _recovery_score(
    rmssd_sws: float,
    rmssd_mean: float,
    rmssd_std: float,
    rhr: float,
    rhr_mean: float,
    rhr_std: float,
    sleep_perf: float,
) -> float:
    """
    WHOOP-equivalent recovery score, 0–100.

    Three-signal composite with sigmoid normalization against the user's
    21-day rolling baseline.  More sensitive than Garmin's Body Battery
    because:
      1. Uses SWS-window RMSSD (peak, not nightly average).
      2. 21-day baseline (shorter = more day-to-day sensitivity).
      3. HRV weighted at 65% (RHR 25%, sleep 10%).
      4. No smoothing — raw daily values.
    """
    hrv_z  = (rmssd_sws - rmssd_mean) / max(rmssd_std, 1.0)
    hrv_score = _sigmoid(hrv_z)

    rhr_z  = -(rhr - rhr_mean) / max(rhr_std, 1.0)   # inverted: lower = better
    rhr_score = _sigmoid(rhr_z)

    raw = 0.65 * hrv_score + 0.25 * rhr_score + 0.10 * sleep_perf
    return round(max(0.0, min(100.0, raw)), 1)


# ── Overnight resting HR ──────────────────────────────────────────────────────

def _resting_hr_from_heartrates(hr_data: dict) -> float | None:
    """
    Extract true resting HR from the daily heart rate time series.
    Uses the 5th-percentile of overnight readings (midnight–06:00)
    rather than Garmin's stated resting HR, which is a 5-minute morning
    window and tends to be higher.
    """
    values = hr_data.get("heartRateValues") or []
    if not values:
        return hr_data.get("restingHeartRate") or None

    # heartRateValues: [[epoch_ms, bpm], ...]
    overnight = []
    for pair in values:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        ts_ms, bpm = pair[0], pair[1]
        if bpm is None or bpm <= 0:
            continue
        dt = datetime.utcfromtimestamp(ts_ms / 1000.0)
        if 0 <= dt.hour < 6:  # midnight–06:00 = sleep trough
            overnight.append(float(bpm))

    if overnight:
        return float(np.percentile(overnight, 5))  # 5th pct = true resting

    # Fall back to Garmin's stated value
    return hr_data.get("restingHeartRate") or None


# ── Respiratory rate ──────────────────────────────────────────────────────────

def _overnight_respiration(resp_data: dict) -> float | None:
    avg = (
        resp_data.get("avgWakingRespirationValue")
        or resp_data.get("avgSleepRespirationValue")
        or resp_data.get("lowestRespirationValue")
    )
    return float(avg) if avg else None


# ── Main Client ───────────────────────────────────────────────────────────────

class GarminFitSentinel:
    """
    Drop-in replacement for GarminStressSentinel with WHOOP-equivalent scoring.
    Compatible interface: authenticate() + pull_data() + pull_workouts().
    """

    def __init__(self, email: str, password: str):
        if Garmin is None:
            raise ImportError("pip install garminconnect")
        self.email    = email
        self.password = password
        self._client: Garmin | None = None

    def authenticate(self) -> None:
        self._client = Garmin(self.email, self.password)
        self._client.login()

    # ── Per-day fetch ─────────────────────────────────────────────────────────

    def _fetch_day(self, date_str: str) -> dict:
        c = self._client
        out: dict = {"date": date_str}

        # HRV time series
        try:
            hrv_data = c.get_hrv_data(date_str) or {}
            out["hrv_raw"]    = hrv_data.get("hrvReadings") or []
            out["hrv_summary"] = hrv_data.get("hrvSummary") or {}
        except Exception as e:
            logger.debug("HRV fetch failed %s: %s", date_str, e)
            out["hrv_raw"] = []
            out["hrv_summary"] = {}

        # Continuous heart rate
        try:
            hr_data = c.get_heart_rates(date_str) or {}
            out["hr_data"] = hr_data
        except Exception as e:
            logger.debug("HR fetch failed %s: %s", date_str, e)
            out["hr_data"] = {}

        # Respiration
        try:
            resp = c.get_respiration_data(date_str) or {}
            out["resp_data"] = resp
        except Exception as e:
            logger.debug("Respiration fetch failed %s: %s", date_str, e)
            out["resp_data"] = {}

        # Sleep
        try:
            sleep = c.get_sleep_data(date_str) or {}
            # get_sleep_data returns nested structure
            out["sleep_data"] = (
                sleep.get("dailySleepDTO") or sleep.get("sleepDTO") or sleep
            )
        except Exception as e:
            logger.debug("Sleep fetch failed %s: %s", date_str, e)
            out["sleep_data"] = {}

        return out

    def _day_to_row(self, fetched: dict, prev_strain: float = 0.0, sleep_debt: float = 0.0) -> dict:
        hrv_raw   = fetched["hrv_raw"]
        sleep     = fetched["sleep_data"]
        hr_data   = fetched["hr_data"]
        resp_data = fetched["resp_data"]

        sleep_start = _sleep_start_gmt(sleep)
        rmssd_sws   = _find_sws_rmssd(hrv_raw, sleep_start)

        # Fallback to summary if readings unavailable
        if math.isnan(rmssd_sws):
            summ = fetched["hrv_summary"]
            rmssd_sws = float(
                summ.get("lastNightRmssd") or summ.get("lastNightAvg") or float("nan")
            )

        rhr    = _resting_hr_from_heartrates(hr_data)
        resp   = _overnight_respiration(resp_data)
        sleep_h = _sleep_hours_from_data(sleep)
        need    = _sleep_need(prev_strain, sleep_debt)
        perf    = _sleep_performance(sleep_h, need)

        return {
            "rmssd_sws":        rmssd_sws,
            "resting_hr":       rhr,
            "respiratory_rate": resp,
            "sleep_hours":      sleep_h,
            "sleep_need":       need,
            "sleep_performance": perf,
        }

    # ── Activities / Strain ───────────────────────────────────────────────────

    def _fetch_strain(self, start: str, end: str) -> dict[str, float]:
        """Returns {date_str: strain_score_0_21} for all activities in range."""
        c = self._client
        strain_by_date: dict[str, float] = {}
        try:
            activities = c.get_activities_by_date(start, end) or []
        except Exception as e:
            logger.debug("Activities fetch failed: %s", e)
            return strain_by_date

        for act in activities:
            act_date = (act.get("startTimeLocal") or "")[:10]
            if not act_date:
                continue
            act_id = act.get("activityId")
            if not act_id:
                continue
            try:
                zones = c.get_activity_hr_in_timezones(str(act_id))
                hr_zones = zones.get("hrTimeInZones") or zones.get("timeInZones") or []
                trimp = _trimp_from_zones(hr_zones)
            except Exception:
                # Fallback: estimate from activity duration + avg HR
                duration_s = act.get("duration") or 0
                avg_hr     = act.get("averageHR") or 120
                # rough estimate: assume zone 3
                trimp = (duration_s / 60.0) * 3
            strain_by_date[act_date] = (
                strain_by_date.get(act_date, 0.0) + _trimp_to_strain(trimp)
            )
            # cap at 21
            strain_by_date[act_date] = min(21.0, strain_by_date[act_date])

        return strain_by_date

    # ── Public API ────────────────────────────────────────────────────────────

    def pull_data(self, start: str, end: str) -> pd.DataFrame:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt   = datetime.strptime(end,   "%Y-%m-%d")
        days     = (end_dt - start_dt).days + 1

        strain_by_date = self._fetch_strain(start, end)

        rows: list[dict] = []
        prev_strain    = 0.0
        sleep_debt     = 0.0

        for i in range(days):
            date_str = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
            fetched  = self._fetch_day(date_str)
            row      = self._day_to_row(fetched, prev_strain, sleep_debt)

            row["date"]         = pd.to_datetime(date_str)
            row["strain_score"] = strain_by_date.get(date_str, 0.0)
            rows.append(row)

            # Rolling sleep debt: positive = under-slept
            if row["sleep_hours"] is not None:
                sleep_debt = max(0.0, sleep_debt + row["sleep_need"] - row["sleep_hours"])
                sleep_debt = min(sleep_debt, 6.0)  # cap at 6h deficit

            prev_strain = row["strain_score"]

        df = pd.DataFrame(rows).set_index("date").sort_index()

        # Rename for compatibility with SentinelCoreMath.engineer_features()
        df["rmssd"] = df["rmssd_sws"]

        # ── Compute rolling 21-day baselines ────────────────────────────────
        n = min(_BASELINE_DAYS, len(df))
        df["_rmssd_mean"] = df["rmssd_sws"].rolling(n, min_periods=5).mean()
        df["_rmssd_std"]  = df["rmssd_sws"].rolling(n, min_periods=5).std().clip(lower=1.0)
        df["_rhr_mean"]   = df["resting_hr"].rolling(n, min_periods=5).mean()
        df["_rhr_std"]    = df["resting_hr"].rolling(n, min_periods=5).std().clip(lower=0.5)

        # Back-fill for early rows that lack 5 days
        for col in ["_rmssd_mean", "_rmssd_std", "_rhr_mean", "_rhr_std"]:
            df[col] = df[col].bfill().ffill()

        # ── Recovery score ───────────────────────────────────────────────────
        recovery_scores = []
        for _, row in df.iterrows():
            rmssd = row.get("rmssd_sws")
            rhr   = row.get("resting_hr")
            if rmssd is None or rhr is None or pd.isna(rmssd) or pd.isna(rhr):
                recovery_scores.append(float("nan"))
                continue
            score = _recovery_score(
                rmssd_sws  = float(rmssd),
                rmssd_mean = float(row["_rmssd_mean"]),
                rmssd_std  = float(row["_rmssd_std"]),
                rhr        = float(rhr),
                rhr_mean   = float(row["_rhr_mean"]),
                rhr_std    = float(row["_rhr_std"]),
                sleep_perf = float(row.get("sleep_performance") or 50.0),
            )
            recovery_scores.append(score)

        df["recovery_whoop"] = recovery_scores

        # Drop internal columns
        df.drop(columns=["_rmssd_mean", "_rmssd_std", "_rhr_mean", "_rhr_std"], inplace=True)

        return df

    def pull_workouts(self, start: str, end: str) -> dict[str, list[dict]]:
        """Compatible with WhoopStressSentinel.pull_workouts() return format."""
        workouts_by_date: dict[str, list[dict]] = {}
        try:
            activities = self._client.get_activities_by_date(start, end) or []
        except Exception:
            return workouts_by_date

        for act in activities:
            date_str  = (act.get("startTimeLocal") or "")[:10]
            if not date_str:
                continue
            sport     = act.get("activityType", {}).get("typeKey") or act.get("activityName") or "Activity"
            strain    = act.get("averageHR")  # proxy — real strain computed in pull_data
            workouts_by_date.setdefault(date_str, []).append({
                "sport_name": sport.replace("_", " ").title(),
                "strain": float(strain) if strain else None,
            })
        return workouts_by_date
