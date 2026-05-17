from __future__ import annotations

import numpy as np

from api.models import DailyRecord, DetectedPattern


def detect_patterns(history: list[DailyRecord]) -> list[DetectedPattern]:
    if len(history) < 7:
        return []

    patterns: list[DetectedPattern] = []
    recent = history[-14:] if len(history) >= 14 else history

    _check_sustained_suppression(recent, patterns)
    _check_rapid_load_escalation(recent, patterns)
    _check_unexplained_stress(recent, patterns)
    _check_cardiovascular_drift(recent, patterns)
    _check_classic_overreach(recent, patterns)
    _check_recovery_momentum(recent, patterns)
    _check_energy_deficiency_signal(recent, patterns)
    _check_chronic_accumulation(history, patterns)   # needs full history
    _check_red_s_autonomic_alert(recent, patterns)

    return patterns


def _run_lengths(flags: list[bool]) -> list[int]:
    """Returns run-length at each index (how many consecutive Trues ending at that index)."""
    runs = []
    count = 0
    for f in flags:
        count = count + 1 if f else 0
        runs.append(count)
    return runs


def _check_sustained_suppression(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    flags = [d.decoupling_idx < -0.5 for d in history]
    runs = _run_lengths(flags)
    max_run = max(runs)
    if max_run >= 4:
        out.append(DetectedPattern(
            pattern_id="sustained_suppression",
            label="Sustained Suppression",
            description=(
                f"Decoupling index has been negative for {max_run} consecutive days, "
                "indicating chronic strain outpacing HRV recovery."
            ),
            severity="high" if max_run >= 7 else "medium",
            duration_days=max_run,
        ))


def _check_rapid_load_escalation(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    acwr_vals = [d.acwr for d in history if d.acwr is not None]
    if len(acwr_vals) < 7:
        return

    recent_acwr = acwr_vals[-1] if acwr_vals else None
    week_ago_acwr = acwr_vals[-7] if len(acwr_vals) >= 7 else acwr_vals[0]

    if recent_acwr is None or week_ago_acwr is None:
        return

    delta = recent_acwr - week_ago_acwr
    if delta >= 0.3 and recent_acwr > 1.3:
        out.append(DetectedPattern(
            pattern_id="rapid_load_escalation",
            label="Rapid Load Escalation",
            description=(
                f"ACWR rose from {week_ago_acwr:.2f} to {recent_acwr:.2f} (+{delta:.2f}) "
                "in 7 days — above the 1.3 danger threshold. Injury and burnout risk elevated."
            ),
            severity="high" if recent_acwr > 1.5 else "medium",
            duration_days=7,
        ))


def _check_unexplained_stress(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    anomalies = [
        d for d in history[-7:]
        if d.anomaly == -1 and d.strain_z < 0.5
    ]
    if len(anomalies) >= 2:
        out.append(DetectedPattern(
            pattern_id="unexplained_stress",
            label="Unexplained Autonomic Stress",
            description=(
                f"{len(anomalies)} anomalous HRV readings detected in the past 7 days "
                "without corresponding training load — possible non-training stressors "
                "(illness, sleep disruption, life stress)."
            ),
            severity="medium",
            duration_days=7,
        ))


def _check_cardiovascular_drift(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    flags = [
        d.hr_trend_z is not None and d.hr_trend_z > 1.5
        for d in history
    ]
    runs = _run_lengths(flags)
    max_run = max(runs)
    if max_run >= 3:
        recent_hr = next(
            (d.hr_trend_z for d in reversed(history) if d.hr_trend_z is not None), None
        )
        hr_str = f" (currently +{recent_hr:.1f}σ)" if recent_hr is not None else ""
        out.append(DetectedPattern(
            pattern_id="cardiovascular_drift",
            label="Cardiovascular Drift",
            description=(
                f"Resting HR has been elevated >1.5σ above baseline for {max_run} consecutive days"
                f"{hr_str}. Persistent elevation is a leading indicator of overtraining."
            ),
            severity="high" if max_run >= 5 else "medium",
            duration_days=max_run,
        ))


def _check_classic_overreach(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    n = min(7, len(history))
    window = history[-n:]

    mag_vals = np.array([d.magnitude_z for d in window])
    strain_vals = np.array([d.strain_z for d in window])

    if len(mag_vals) < 4:
        return

    xs = np.arange(len(mag_vals), dtype=float)
    mag_slope = float(np.polyfit(xs, mag_vals, 1)[0])
    strain_mean = float(np.mean(strain_vals))

    if mag_slope < -0.1 and strain_mean > 0.3:
        out.append(DetectedPattern(
            pattern_id="classic_overreach",
            label="Classic Overreach Pattern",
            description=(
                f"HRV strength is declining ({mag_slope:+.2f}σ/day) while training load remains "
                f"elevated (avg strain z={strain_mean:.2f}). "
                "This is the textbook overreach signature — adaptation is stalling."
            ),
            severity="high",
            duration_days=n,
        ))


def _check_energy_deficiency_signal(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    if len(history) < 3:
        return
    flags = [
        d.magnitude_z < -0.5 and (d.acwr is None or d.acwr < 0.9)
        for d in history
    ]
    runs = _run_lengths(flags)
    max_run = max(runs)
    if max_run >= 3:
        out.append(DetectedPattern(
            pattern_id="energy_deficiency_signal",
            label="Energy Deficiency Signal",
            description=(
                f"HRV suppressed (magnitude z < −0.5) for {max_run} consecutive days "
                "with training load below chronic baseline (ACWR < 0.9). "
                "HRV drop unexplained by training — possible energy deficiency (REDs wearable signature). "
                "Consider nutrition audit and reduce training intensity."
            ),
            severity="high" if max_run >= 5 else "medium",
            duration_days=max_run,
        ))


def _check_chronic_accumulation(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    if len(history) < 45:
        return
    flags = [d.decoupling_idx < -0.3 for d in history]
    pct = sum(flags) / len(flags)
    if pct >= 0.40:
        pct_int = int(pct * 100)
        out.append(DetectedPattern(
            pattern_id="chronic_accumulation",
            label="Chronic Accumulation",
            description=(
                f"{pct_int}% of the last {len(history)} days show decoupling index below −0.3 — "
                "chronic energy deficit accumulating across the training season. "
                "Extended periods of HRV-strain decoupling indicate adaptation failure, "
                "not acute overload. Periodize rest weeks and reassess fueling strategy."
            ),
            severity="high",
            duration_days=len(history),
        ))


def _check_red_s_autonomic_alert(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    if len(history) < 2:
        return
    flags = [d.readiness_state == "Autonomic Exhaustion (RED-S Risk)" for d in history]
    runs = _run_lengths(flags)
    max_run = max(runs)
    if max_run >= 2:
        out.append(DetectedPattern(
            pattern_id="red_s_autonomic_alert",
            label="Paradoxical HRV / RED-S Alert",
            description=(
                f"Autonomic Exhaustion state persisted for {max_run} consecutive days — "
                "paradoxical HRV elevation with volatility collapse is a documented neuroendocrine "
                "signature of Relative Energy Deficiency in Sport (REDs). "
                "Reduce training load and consider clinical RED-S screening with a sports medicine provider."
            ),
            severity="high",
            duration_days=max_run,
        ))


def _check_recovery_momentum(history: list[DailyRecord], out: list[DetectedPattern]) -> None:
    vals = [d.decoupling_idx for d in history]
    if len(vals) < 5:
        return

    # Find a trough below -0.5 in first half, then consistent improvement
    mid = len(vals) // 2
    trough_val = min(vals[:mid])
    if trough_val > -0.5:
        return

    recent = vals[mid:]
    improving = all(recent[i] >= recent[i - 1] - 0.05 for i in range(1, len(recent)))
    if improving and vals[-1] > trough_val + 0.5:
        out.append(DetectedPattern(
            pattern_id="recovery_momentum",
            label="Recovery Momentum",
            description=(
                f"Decoupling index has improved from {trough_val:.2f}σ to {vals[-1]:+.2f}σ "
                f"over {len(recent)} days — autonomic recovery is trending in the right direction."
            ),
            severity="low",
            duration_days=len(recent),
        ))
