import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.WatchUi as Ui;

// ── Configuration ─────────────────────────────────────────────────────────────
// Replace with your deployed backend URL before building.
// For local testing on the same WiFi: "http://192.168.x.x:8000/api/garmin/summary"
const API_URL = "https://your-backend.fly.dev/api/garmin/summary";

// Cache TTL: refresh if data is older than this (seconds)
const CACHE_TTL_SECONDS = 14400; // 4 hours

// Storage keys
const KEY_RECOVERY   = "recovery_score";
const KEY_LABEL      = "recovery_label";
const KEY_STRAIN     = "strain_score";
const KEY_STRAIN_LBL = "strain_label";
const KEY_SLEEP_PERF = "sleep_performance";
const KEY_SLEEP_H    = "sleep_hours";
const KEY_SLEEP_NEED = "sleep_need";
const KEY_RMSSD      = "rmssd_sws";
const KEY_RHR        = "resting_hr";
const KEY_READINESS  = "readiness_state";
const KEY_BURNOUT    = "burnout_risk";
const KEY_TREND      = "trend";
const KEY_FETCHED_AT = "fetched_at";

// ── App entry point ───────────────────────────────────────────────────────────
class StressSentinelApp extends Application.AppBase {

    hidden var _mainView as MainView;
    hidden var _delegate as MainDelegate;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
        _mainView = new MainView();
        _delegate = new MainDelegate(_mainView);
    }

    function getInitialView() as [ Ui.Views ] or [ Ui.Views, Ui.InputDelegates ] {
        return [ _mainView, _delegate ];
    }

    // Called when web request returns
    function onReceiveData(responseCode as Number, data as Dictionary?) as Void {
        if (responseCode == 200 && data != null) {
            _storeData(data);
            _mainView.setData(data);
            _mainView.setState(:data);
        } else if (responseCode == -300 || responseCode == -101) {
            // No phone / BT disconnected
            _mainView.setState(:noPhone);
        } else {
            _mainView.setState(:error);
        }
        Ui.requestUpdate();
    }

    // Fetch from API (or serve from cache if fresh enough)
    function fetchData() as Void {
        var fetchedAt = Application.Storage.getValue(KEY_FETCHED_AT) as Number?;
        var now       = System.getTimer() / 1000; // seconds since boot

        if (fetchedAt != null && (now - fetchedAt) < CACHE_TTL_SECONDS) {
            // Cache is fresh — load stored values
            var cached = _loadCached();
            if (cached != null) {
                _mainView.setData(cached);
                _mainView.setState(:data);
                Ui.requestUpdate();
                return;
            }
        }

        // Need fresh data
        _mainView.setState(:loading);
        Ui.requestUpdate();

        Communications.makeWebRequest(
            API_URL,
            null,
            { :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON },
            method(:onReceiveData)
        );
    }

    hidden function _storeData(data as Dictionary) as Void {
        Application.Storage.setValue(KEY_RECOVERY,   data["recovery_score"]);
        Application.Storage.setValue(KEY_LABEL,      data["recovery_label"]);
        Application.Storage.setValue(KEY_STRAIN,     data["strain_score"]);
        Application.Storage.setValue(KEY_STRAIN_LBL, data["strain_label"]);
        Application.Storage.setValue(KEY_SLEEP_PERF, data["sleep_performance"]);
        Application.Storage.setValue(KEY_SLEEP_H,    data["sleep_hours"]);
        Application.Storage.setValue(KEY_SLEEP_NEED, data["sleep_need"]);
        Application.Storage.setValue(KEY_RMSSD,      data["rmssd_sws"]);
        Application.Storage.setValue(KEY_RHR,        data["resting_hr"]);
        Application.Storage.setValue(KEY_READINESS,  data["readiness_state"]);
        Application.Storage.setValue(KEY_BURNOUT,    data["burnout_risk"]);
        Application.Storage.setValue(KEY_TREND,      data["trend"]);
        Application.Storage.setValue(KEY_FETCHED_AT, System.getTimer() / 1000);
    }

    hidden function _loadCached() as Dictionary? {
        var score = Application.Storage.getValue(KEY_RECOVERY);
        if (score == null) { return null; }
        return {
            "recovery_score"    => score,
            "recovery_label"    => Application.Storage.getValue(KEY_LABEL),
            "strain_score"      => Application.Storage.getValue(KEY_STRAIN),
            "strain_label"      => Application.Storage.getValue(KEY_STRAIN_LBL),
            "sleep_performance" => Application.Storage.getValue(KEY_SLEEP_PERF),
            "sleep_hours"       => Application.Storage.getValue(KEY_SLEEP_H),
            "sleep_need"        => Application.Storage.getValue(KEY_SLEEP_NEED),
            "rmssd_sws"         => Application.Storage.getValue(KEY_RMSSD),
            "resting_hr"        => Application.Storage.getValue(KEY_RHR),
            "readiness_state"   => Application.Storage.getValue(KEY_READINESS),
            "burnout_risk"      => Application.Storage.getValue(KEY_BURNOUT),
            "trend"             => Application.Storage.getValue(KEY_TREND),
        };
    }
}

function getApp() as StressSentinelApp {
    return Application.getApp() as StressSentinelApp;
}
