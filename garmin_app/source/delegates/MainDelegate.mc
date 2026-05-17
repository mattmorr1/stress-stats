import Toybox.WatchUi as Ui;
import Toybox.Lang;

class MainDelegate extends Ui.BehaviorDelegate {

    hidden var _view as MainView;

    function initialize(view as MainView) {
        BehaviorDelegate.initialize();
        _view = view;

        // Fetch data immediately on launch
        getApp().fetchData();
    }

    // UP button or swipe up → previous page
    function onPreviousPage() as Boolean {
        _view.prevPage();
        return true;
    }

    // DOWN button or swipe down → next page
    function onNextPage() as Boolean {
        _view.nextPage();
        return true;
    }

    // Hold MENU → force refresh from API
    function onMenu() as Boolean {
        getApp().fetchData();
        return true;
    }

    // BACK button → exit app
    function onBack() as Boolean {
        Ui.popView(Ui.SLIDE_RIGHT);
        return true;
    }

    // SELECT (middle button) → same as next page on non-touch devices
    function onSelect() as Boolean {
        _view.nextPage();
        return true;
    }
}
