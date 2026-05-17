import Toybox.Graphics as Gfx;
import Toybox.Lang;
import Toybox.WatchUi as Ui;

// ── Colours ───────────────────────────────────────────────────────────────────
const CLR_GREEN   = 0x059669;
const CLR_AMBER   = 0xd97706;
const CLR_RED     = 0xdc2626;
const CLR_BLUE    = 0x0ea5e9;
const CLR_BG      = 0x0f172a;  // near-black
const CLR_TRACK   = 0x1e293b;  // dark track for arcs
const CLR_TEXT    = 0xe2e8f0;  // light text
const CLR_MUTED   = 0x64748b;  // muted labels

// ── State enum ────────────────────────────────────────────────────────────────
enum AppState {
    :loading,
    :data,
    :noPhone,
    :error
}

// ── Pages ─────────────────────────────────────────────────────────────────────
enum Page {
    PAGE_RECOVERY = 0,
    PAGE_SLEEP    = 1,
    PAGE_BIOMETRICS = 2
}

const PAGE_COUNT = 3;

class MainView extends Ui.View {

    hidden var _state  as AppState = :loading;
    hidden var _page   as Page = PAGE_RECOVERY;
    hidden var _data   as Dictionary?;

    // Screen dimensions (set in onLayout)
    hidden var _w as Number = 260;
    hidden var _h as Number = 260;
    hidden var _cx as Number = 130;
    hidden var _cy as Number = 130;

    function initialize() {
        View.initialize();
    }

    function onLayout(dc as Gfx.Dc) as Void {
        _w  = dc.getWidth();
        _h  = dc.getHeight();
        _cx = _w / 2;
        _cy = _h / 2;
    }

    function setState(state as AppState) as Void {
        _state = state;
    }

    function setData(data as Dictionary) as Void {
        _data = data;
    }

    function nextPage() as Void {
        _page = (_page + 1) % PAGE_COUNT;
        Ui.requestUpdate();
    }

    function prevPage() as Void {
        _page = (_page - 1 + PAGE_COUNT) % PAGE_COUNT;
        Ui.requestUpdate();
    }

    function onUpdate(dc as Gfx.Dc) as Void {
        _drawBackground(dc);

        if (_state == :loading) {
            _drawLoading(dc);
        } else if (_state == :noPhone) {
            _drawMessage(dc, "Connect to phone", CLR_AMBER);
        } else if (_state == :error) {
            _drawMessage(dc, "Data unavailable", CLR_RED);
        } else if (_data != null) {
            if (_page == PAGE_RECOVERY) {
                _drawRecoveryPage(dc);
            } else if (_page == PAGE_SLEEP) {
                _drawSleepPage(dc);
            } else {
                _drawBiometricsPage(dc);
            }
            _drawPageDots(dc);
        }
    }

    // ── Background ────────────────────────────────────────────────────────────

    hidden function _drawBackground(dc as Gfx.Dc) as Void {
        dc.setColor(CLR_BG, CLR_BG);
        dc.fillRectangle(0, 0, _w, _h);
    }

    // ── Loading ───────────────────────────────────────────────────────────────

    hidden function _drawLoading(dc as Gfx.Dc) as Void {
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy - 10, Gfx.FONT_SMALL, "Fetching data…",
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    hidden function _drawMessage(dc as Gfx.Dc, msg as String, color as Number) as Void {
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy - 10, Gfx.FONT_SMALL, msg,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy + 20, Gfx.FONT_XTINY, "Hold MENU to retry",
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);
    }

    // ── Page 1: Recovery ──────────────────────────────────────────────────────

    hidden function _drawRecoveryPage(dc as Gfx.Dc) as Void {
        var score = _data["recovery_score"] as Float;
        var label = _data["recovery_label"] as String;
        var strain = _data["strain_score"];
        var strainLbl = _data["strain_label"] as String;
        var trend = _data["trend"] as String;

        var color = _recoveryColor(score);

        // Section label
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, 22, Gfx.FONT_XTINY, "RECOVERY",
                    Gfx.TEXT_JUSTIFY_CENTER);

        // Arc gauge — 240° sweep, starts at 150° (lower-left)
        var radius   = (_w / 2 - 18).toNumber();
        var arcStart = 150;
        var arcSweep = 240;
        var filled   = (score.toFloat() / 100.0 * arcSweep).toNumber();

        dc.setPenWidth(8);

        // Track
        dc.setColor(CLR_TRACK, Gfx.COLOR_TRANSPARENT);
        dc.drawArc(_cx, _cy, radius, Gfx.ARC_CLOCKWISE,
                   arcStart, arcStart - arcSweep);

        // Fill
        if (filled > 0) {
            dc.setColor(color, Gfx.COLOR_TRANSPARENT);
            dc.drawArc(_cx, _cy, radius, Gfx.ARC_CLOCKWISE,
                       arcStart, arcStart - filled);
        }

        dc.setPenWidth(1);

        // Score number
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy - 22, Gfx.FONT_NUMBER_HOT, score.toNumber().toString(),
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);

        // Label below score
        dc.setColor(color, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy + 14, Gfx.FONT_SMALL, label,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);

        // Trend arrow
        var arrow = _trendArrow(trend);
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy + 34, Gfx.FONT_XTINY, arrow + " " + trend,
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);

        // Strain row at bottom
        if (strain != null) {
            var strainColor = _strainColor(strain.toFloat());
            var strainStr   = strain.format("%.1f") + " / 21  " + strainLbl;
            dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
            dc.drawText(_cx, _h - 38, Gfx.FONT_XTINY, "STRAIN",
                        Gfx.TEXT_JUSTIFY_CENTER);
            dc.setColor(strainColor, Gfx.COLOR_TRANSPARENT);
            dc.drawText(_cx, _h - 24, Gfx.FONT_TINY, strainStr,
                        Gfx.TEXT_JUSTIFY_CENTER);
        }
    }

    // ── Page 2: Sleep ─────────────────────────────────────────────────────────

    hidden function _drawSleepPage(dc as Gfx.Dc) as Void {
        var perf  = _data["sleep_performance"] as Float;
        var slept = _data["sleep_hours"];
        var need  = _data["sleep_need"];

        var perfColor = perf >= 85.0 ? CLR_GREEN : perf >= 70.0 ? CLR_AMBER : CLR_RED;

        // Label
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, 22, Gfx.FONT_XTINY, "SLEEP", Gfx.TEXT_JUSTIFY_CENTER);

        // Big performance number
        dc.setColor(perfColor, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy - 30, Gfx.FONT_NUMBER_HOT,
                    perf.toNumber().toString() + "%",
                    Gfx.TEXT_JUSTIFY_CENTER | Gfx.TEXT_JUSTIFY_VCENTER);

        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, _cy + 10, Gfx.FONT_XTINY, "Performance",
                    Gfx.TEXT_JUSTIFY_CENTER);

        // Progress bar
        var barW  = (_w * 0.65).toNumber();
        var barH  = 8;
        var barX  = (_cx - barW / 2).toNumber();
        var barY  = (_cy + 32).toNumber();
        var fillW = (barW * perf / 100.0).toNumber();

        dc.setColor(CLR_TRACK, Gfx.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(barX, barY, barW, barH, 4);
        if (fillW > 0) {
            dc.setColor(perfColor, Gfx.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(barX, barY, fillW, barH, 4);
        }

        // Slept / Needed row
        var rowY = _h - 52;
        if (slept != null) {
            dc.setColor(CLR_TEXT, Gfx.COLOR_TRANSPARENT);
            dc.drawText(_cx - 32, rowY, Gfx.FONT_TINY,
                        slept.format("%.1f") + "h",
                        Gfx.TEXT_JUSTIFY_RIGHT);
        }
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, rowY, Gfx.FONT_XTINY, "/",
                    Gfx.TEXT_JUSTIFY_CENTER);
        if (need != null) {
            dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
            dc.drawText(_cx + 32, rowY, Gfx.FONT_TINY,
                        need.format("%.1f") + "h",
                        Gfx.TEXT_JUSTIFY_LEFT);
        }
        var labelY = rowY + 18;
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx - 32, labelY, Gfx.FONT_XTINY, "Slept",
                    Gfx.TEXT_JUSTIFY_RIGHT);
        dc.drawText(_cx + 32, labelY, Gfx.FONT_XTINY, "Needed",
                    Gfx.TEXT_JUSTIFY_LEFT);
    }

    // ── Page 3: Biometrics ────────────────────────────────────────────────────

    hidden function _drawBiometricsPage(dc as Gfx.Dc) as Void {
        var rmssd    = _data["rmssd_sws"];
        var rhr      = _data["resting_hr"];
        var readiness = _data["readiness_state"] as String?;
        var burnout  = _data["burnout_risk"] as Float;

        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_cx, 22, Gfx.FONT_XTINY, "BIOMETRICS", Gfx.TEXT_JUSTIFY_CENTER);

        var lineH  = 38;
        var startY = 54;

        // HRV (SWS window)
        _drawMetricRow(dc, startY, "HRV (SWS)",
                       rmssd != null ? rmssd.format("%.0f") + " ms" : "—",
                       CLR_BLUE);

        // Resting HR
        _drawMetricRow(dc, startY + lineH, "Resting HR",
                       rhr != null ? rhr.format("%.0f") + " bpm" : "—",
                       CLR_TEXT);

        // Burnout risk
        var brColor = burnout >= 66.0 ? CLR_RED : burnout >= 33.0 ? CLR_AMBER : CLR_GREEN;
        _drawMetricRow(dc, startY + lineH * 2, "Burnout Risk",
                       burnout.toNumber().toString() + " / 100",
                       brColor);

        // Readiness state (truncated)
        if (readiness != null) {
            var short = _shortenState(readiness);
            _drawMetricRow(dc, startY + lineH * 3, "State", short, CLR_TEXT);
        }
    }

    hidden function _drawMetricRow(dc as Gfx.Dc, y as Number, label as String,
                                   value as String, valueColor as Number) as Void {
        dc.setColor(CLR_MUTED, Gfx.COLOR_TRANSPARENT);
        dc.drawText(20, y, Gfx.FONT_XTINY, label, Gfx.TEXT_JUSTIFY_LEFT);
        dc.setColor(valueColor, Gfx.COLOR_TRANSPARENT);
        dc.drawText(_w - 16, y, Gfx.FONT_TINY, value, Gfx.TEXT_JUSTIFY_RIGHT);
        // Divider
        dc.setColor(CLR_TRACK, Gfx.COLOR_TRANSPARENT);
        dc.drawLine(16, y + 28, _w - 16, y + 28);
    }

    // ── Page dots ─────────────────────────────────────────────────────────────

    hidden function _drawPageDots(dc as Gfx.Dc) as Void {
        var dotR   = 4;
        var gap    = 14;
        var totalW = PAGE_COUNT * gap;
        var startX = _cx - totalW / 2 + gap / 2;

        for (var i = 0; i < PAGE_COUNT; i++) {
            var x = startX + i * gap;
            if (i == _page) {
                dc.setColor(CLR_TEXT, Gfx.COLOR_TRANSPARENT);
                dc.fillCircle(x, _h - 12, dotR);
            } else {
                dc.setColor(CLR_TRACK, Gfx.COLOR_TRANSPARENT);
                dc.fillCircle(x, _h - 12, dotR - 1);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    hidden function _recoveryColor(score as Float) as Number {
        if (score >= 67.0) { return CLR_GREEN; }
        if (score >= 34.0) { return CLR_AMBER; }
        return CLR_RED;
    }

    hidden function _strainColor(score as Float) as Number {
        if (score < 10.0) { return CLR_GREEN; }
        if (score < 14.0) { return CLR_BLUE;  }
        if (score < 18.0) { return CLR_AMBER; }
        return CLR_RED;
    }

    hidden function _trendArrow(trend as String?) as String {
        if (trend == null)          { return "→"; }
        if (trend.equals("improving")) { return "↑"; }
        if (trend.equals("declining")) { return "↓"; }
        return "→";
    }

    hidden function _shortenState(state as String) as String {
        if (state.equals("Peak / Ready"))                      { return "Peak / Ready";      }
        if (state.equals("Maintaining / Normal"))              { return "Maintaining";        }
        if (state.equals("Functional Overreach"))              { return "Func. Overreach";    }
        if (state.equals("Non-Functional Fatigue"))            { return "Non-Func. Fatigue";  }
        if (state.equals("Autonomic Exhaustion (RED-S Risk)")) { return "Auton. Exhaustion";  }
        return state.substring(0, 16);
    }
}
