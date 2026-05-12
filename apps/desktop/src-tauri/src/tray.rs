// apps/desktop/src-tauri/src/tray.rs
//
// System tray icon + minimal menu (Show / Quit). Spike-1 scope: prove tray
// works on macOS / Windows / Linux. Branded icon / advanced state replaces
// in Phase 6.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

pub fn build_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示窗口 · Show", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 · Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}
