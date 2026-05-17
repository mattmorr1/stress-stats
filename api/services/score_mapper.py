import math


def decoupling_to_burnout_risk(decoupling_idx: float) -> float:
    """
    decoupling_idx >= 1.5  -> risk = 0   (Optimal, green)
    decoupling_idx == 0    -> risk = 50  (Watch, amber)
    decoupling_idx <= -1.5 -> risk = 100 (High, red)
    """
    raw = (-decoupling_idx + 1.5) / 3.0 * 100.0
    return max(0.0, min(100.0, raw))


def _compute_breakdown(
    decoupling_idx: float,
    acwr: float | None = None,
    hr_trend_z: float | None = None,
) -> tuple[float, float, float, float]:
    """Returns (base_risk, acwr_penalty, hr_penalty, total) — all as floats."""
    base = decoupling_to_burnout_risk(decoupling_idx)

    acwr_adj = 0.0
    if acwr is not None and not math.isnan(float(acwr)):
        excess = max(0.0, float(acwr) - 1.3)
        acwr_adj = min(excess / 0.5 * 25.0, 25.0)

    hr_adj = 0.0
    if hr_trend_z is not None and not math.isnan(float(hr_trend_z)):
        hr_adj = max(-8.0, min(float(hr_trend_z) * 8.0, 20.0))

    total = max(0.0, min(100.0, base + acwr_adj + hr_adj))
    return base, acwr_adj, hr_adj, total


def composite_burnout_risk(
    decoupling_idx: float,
    acwr: float | None = None,
    hr_trend_z: float | None = None,
) -> float:
    """Multi-signal burnout risk score (0–100)."""
    _, _, _, total = _compute_breakdown(decoupling_idx, acwr, hr_trend_z)
    return total


def score_breakdown(
    decoupling_idx: float,
    acwr: float | None = None,
    hr_trend_z: float | None = None,
) -> dict:
    """Returns the decomposed components of the burnout risk score."""
    base, acwr_penalty, hr_penalty, total = _compute_breakdown(decoupling_idx, acwr, hr_trend_z)
    return {
        "base_risk": round(base, 1),
        "acwr_penalty": round(acwr_penalty, 1),
        "hr_penalty": round(hr_penalty, 1),
        "total": round(total, 1),
    }


def magnitude_z_to_hrv_strength(magnitude_z: float) -> float:
    raw = (magnitude_z + 3.0) / 6.0 * 100.0
    return max(0.0, min(100.0, raw))


def strain_z_to_health(strain_z: float) -> float:
    raw = (-strain_z + 3.0) / 6.0 * 100.0
    return max(0.0, min(100.0, raw))


def risk_color(burnout_risk_score: float) -> str:
    if burnout_risk_score <= 33:
        return "#00ff94"
    if burnout_risk_score <= 66:
        return "#ffb800"
    return "#ff4444"
