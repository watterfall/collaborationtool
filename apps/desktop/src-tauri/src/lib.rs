// Tauri 2 entry. Spike-1 scope: webview-only shell with stub commands.
// Real commands (ollama detection, system) added in Task 3+.

mod commands;
mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            tray::build_tray(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ollama::detect_ollama_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
