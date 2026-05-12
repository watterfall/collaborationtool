// Tauri 2 entry. Spike-1 scope: webview-only shell with stub commands.
// Real commands (ollama detection, system) added in Task 3+.

mod commands;
mod tray;

use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            tray::build_tray(&app.handle())?;

            // Deep link: collabtool://doc/<id>
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                log::info!("deep-link opened: {:?}", urls);
                // Spike-1 just logs; routing to /editor/<id> is webview-side.
                // Forward to webview via window event so JS can pick it up.
                if let Some(win) = handle.get_webview_window("main") {
                    let urls_strings: Vec<String> =
                        urls.iter().map(|u| u.to_string()).collect();
                    let _ = win.emit("deep-link-opened", urls_strings);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ollama::detect_ollama_available,
            commands::system::open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
