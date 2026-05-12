// apps/desktop/src-tauri/src/commands/system.rs
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    app.shell()
        .open(url, None)
        .map_err(|e| format!("failed to open url: {e}"))
}
