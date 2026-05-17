from __future__ import annotations

import json
import logging
from datetime import datetime

import anthropic

from api.config import settings
from api.models import DailyRecord, DetectedPattern, InsightCard, InsightsResponse
from api.services.pattern_detector import detect_patterns

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a sports science and recovery specialist embedded in Stress Sentinel, \
a burnout forecasting tool for athletes and high performers. Your role is to interpret biometric \
patterns and deliver specific, actionable insights — not generic wellness advice.

Signal reference:
- Decoupling Index: HRV z-score minus next-day-lagged strain z-score. Negative = strain outpacing HRV recovery.
- Burnout Risk Score: 0–100 composite (base HRV risk + ACWR penalty + resting HR penalty). >66 = High Risk.
- ACWR: Acute (7-day) / Chronic (28-day) training load. Optimal 0.8–1.3. >1.3 = danger zone.
- HR Trend Z: Resting HR deviation above 7-day baseline. >1.5σ = significant elevation.
- HRV Strength Score: 0–100; higher = stronger autonomic recovery capacity.
- Readiness States: Peak/Ready, Functional Overreach, Non-Functional Fatigue, \
Autonomic Exhaustion (RED-S Risk), Maintaining/Normal.

Rules:
- Reference specific values and dates from the data — never speak in generalities.
- Be direct and expert. Do not hedge with "it could be" or "consider speaking to a doctor."
- Each insight must be specific: name the signal, the value, and what it means.
- Severity: "info" = positive trend or neutral observation; "warning" = correctable risk; \
"critical" = urgent intervention needed.
- Signals list: short labels for which metrics drove the insight (e.g. "HRV Decoupling", "ACWR", "Resting HR").
"""

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "insights": {
            "type": "array",
            "minItems": 2,
            "maxItems": 3,
            "items": {
                "type": "object",
                "required": ["title", "body", "severity", "signals"],
                "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
                    "signals": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
    "required": ["insights"],
}


def _format_history_table(history: list[DailyRecord]) -> str:
    rows = ["Date       | State                    | Decoupling | Risk | ACWR  | HR-Z  | Anomaly"]
    rows.append("-" * 85)
    for d in history:
        acwr = f"{d.acwr:.2f}" if d.acwr is not None else "  —  "
        hrz  = f"{d.hr_trend_z:+.2f}" if d.hr_trend_z is not None else "  —  "
        anom = "ANOMALY" if d.anomaly == -1 else "normal"
        rows.append(
            f"{d.date} | {d.readiness_state:<24s} | "
            f"{d.decoupling_idx:+.2f}σ     | {d.burnout_risk_score:>4.0f} | "
            f"{acwr:<5} | {hrz:<5} | {anom}"
        )
    return "\n".join(rows)


def _format_patterns(patterns: list[DetectedPattern]) -> str:
    if not patterns:
        return "None detected."
    return "\n".join(
        f"- [{p.severity.upper()}] {p.label}: {p.description}"
        for p in patterns
    )


async def generate_insights(
    history: list[DailyRecord],
    source: str,
) -> InsightsResponse:
    patterns = detect_patterns(history)

    if not settings.anthropic_api_key:
        return _fallback_response(patterns)

    recent_14 = history[-14:] if len(history) >= 14 else history
    latest = history[-1]

    user_message = f"""Source: {source.upper()}
Analysis period: {history[0].date} to {latest.date} ({len(history)} days total)
Latest readiness state: {latest.readiness_state}
Latest burnout risk: {latest.burnout_risk_score:.0f}/100

Last {len(recent_14)} days of data (chronological, most recent last):
{_format_history_table(recent_14)}

Detected algorithmic patterns:
{_format_patterns(patterns)}

Generate 2–3 insight cards as JSON matching this schema exactly:
{{
  "insights": [
    {{
      "title": "short title (5–8 words)",
      "body": "2–3 sentences. Specific values, specific action.",
      "severity": "info|warning|critical",
      "signals": ["Signal Name 1", "Signal Name 2"]
    }}
  ]
}}

Respond with only the JSON object — no markdown, no preamble."""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        stream = client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_message}],
        )
        async with stream as s:
            message = await s.get_final_message()

        raw = message.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)

        insight_cards = [InsightCard(**card) for card in parsed["insights"]]
    except Exception as exc:
        logger.warning("Claude insights generation failed: %s", exc)
        insight_cards = _rule_based_insights(history, patterns)

    return InsightsResponse(
        generated_at=datetime.utcnow().isoformat() + "Z",
        patterns=patterns,
        insights=insight_cards,
        cached=False,
    )


def _fallback_response(patterns: list[DetectedPattern]) -> InsightsResponse:
    """Used when no API key is configured — returns pattern-derived insights only."""
    insights = _rule_based_insights([], patterns)
    return InsightsResponse(
        generated_at=datetime.utcnow().isoformat() + "Z",
        patterns=patterns,
        insights=insights,
        cached=False,
    )


def _rule_based_insights(
    history: list[DailyRecord],
    patterns: list[DetectedPattern],
) -> list[InsightCard]:
    """Deterministic fallback when Claude is unavailable."""
    cards: list[InsightCard] = []

    high_patterns = [p for p in patterns if p.severity == "high"]
    if high_patterns:
        p = high_patterns[0]
        cards.append(InsightCard(
            title=p.label,
            body=p.description + " Reduce training intensity and prioritize sleep.",
            severity="critical" if p.severity == "high" else "warning",
            signals=[p.pattern_id.replace("_", " ").title()],
        ))

    if history:
        latest = history[-1]
        if latest.burnout_risk_score > 66:
            cards.append(InsightCard(
                title="High Burnout Risk — Reduce Load",
                body=(
                    f"Burnout risk score is {latest.burnout_risk_score:.0f}/100. "
                    "HRV recovery is being outpaced by cumulative strain. "
                    "Consider 2–3 days of active recovery or complete rest."
                ),
                severity="critical",
                signals=["Burnout Risk Score", "HRV Decoupling"],
            ))
        elif latest.burnout_risk_score < 33:
            cards.append(InsightCard(
                title="Autonomic Recovery Strong",
                body=(
                    f"Burnout risk score is {latest.burnout_risk_score:.0f}/100 — "
                    "HRV is well ahead of strain load. "
                    "This is a good window for high-intensity training blocks."
                ),
                severity="info",
                signals=["Burnout Risk Score", "HRV Decoupling"],
            ))

    if not cards:
        cards.append(InsightCard(
            title="Monitoring Steady State",
            body="No significant stress patterns detected. Continue current training load and monitor for changes.",
            severity="info",
            signals=["Decoupling Index"],
        ))

    return cards[:3]
