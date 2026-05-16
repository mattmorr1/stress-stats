def decoupling_to_burnout_risk(decoupling_idx: float) -> float:
    """
    decoupling_idx >= 1.5  -> risk = 0   (Optimal, green)
    decoupling_idx == 0    -> risk = 50  (Watch, amber)
    decoupling_idx <= -1.5 -> risk = 100 (High, red)
    """
    raw = (-decoupling_idx + 1.5) / 3.0 * 100.0
    return max(0.0, min(100.0, raw))


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
