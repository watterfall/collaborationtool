// apps/desktop/src-tauri/src/commands/vault_host.rs
//
// Dev-tier transport to the Node vault host (packages/vault-host): spawn the
// system Node runtime running `server-main.ts` and speak ndjson JSON-RPC over
// stdin/stdout. Zero new dependencies — std::process + threads; tauri events
// forward the server's push messages to the webview.
//
// dev-tier 传输：用系统 Node 拉起 vault-host server，stdio 走 ndjson JSON-RPC。
// "打包 Node runtime 进发行版"是被推迟的 release 决策（ADR-0017 review log）——
// 没有仓库 checkout / VAULT_HOST_ENTRY 时，start 会返回双语错误而不是假装可用。

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::Emitter;

/// Webview event channel for server → client push messages.
pub const VAULT_HOST_EVENT: &str = "vault-host://event";

const RPC_TIMEOUT: Duration = Duration::from_secs(20);

type PendingMap = Arc<Mutex<HashMap<u64, mpsc::Sender<Value>>>>;

/// What a line coming back from the Node host means. Pure — unit-tested
/// without a real process.
#[derive(Debug)]
pub enum LineKind {
    /// A response to a request we issued (`{"id": n, ...}`).
    Response { id: u64, body: Value },
    /// A server-initiated push (`{"event": "...", ...}`).
    Event(Value),
    /// Anything else (logs, blank lines, malformed JSON) — ignored.
    Noise,
}

pub fn classify_line(line: &str) -> LineKind {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return LineKind::Noise;
    }
    let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
        return LineKind::Noise;
    };
    if let Some(id) = value.get("id").and_then(Value::as_u64) {
        return LineKind::Response { id, body: value };
    }
    if value.get("event").and_then(Value::as_str).is_some() {
        return LineKind::Event(value);
    }
    LineKind::Noise
}

struct VaultHostProc {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: PendingMap,
    next_id: Arc<AtomicU64>,
}

#[derive(Default)]
pub struct VaultHostState(Mutex<Option<VaultHostProc>>);

#[derive(Debug, Serialize)]
pub struct VaultHostStatus {
    pub running: bool,
    pub pid: Option<u32>,
}

/// Resolve the server entry file: explicit arg > VAULT_HOST_ENTRY env > walk
/// up from cwd looking for a repo checkout (dev mode).
fn resolve_entry(explicit: Option<String>) -> Result<PathBuf, String> {
    const REL: &str = "packages/vault-host/src/server-main.ts";
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(path) = explicit {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(env_entry) = std::env::var("VAULT_HOST_ENTRY") {
        candidates.push(PathBuf::from(env_entry));
    }
    if let Ok(mut dir) = std::env::current_dir() {
        loop {
            candidates.push(dir.join(REL));
            if !dir.pop() {
                break;
            }
        }
    }
    first_existing(candidates).ok_or_else(missing_entry_error)
}

/// First candidate that exists as a file, in priority order. Pure over the
/// candidate list so tests control the filesystem surface.
fn first_existing(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|candidate| candidate.is_file())
}

fn missing_entry_error() -> String {
    String::from(
        "vault host entry not found — dev-tier transport needs a repo checkout \
         or VAULT_HOST_ENTRY pointing at packages/vault-host/src/server-main.ts. \
         未找到 vault host 入口——dev-tier 传输需要仓库 checkout，或设置 \
         VAULT_HOST_ENTRY 指向 packages/vault-host/src/server-main.ts。",
    )
}

fn spawn_host(app: tauri::AppHandle, entry: PathBuf) -> Result<VaultHostProc, String> {
    // cwd = the vault-host package dir so `node --import tsx` resolves the
    // package's own devDependency install of tsx.
    let package_dir = entry
        .parent() // src/
        .and_then(|p| p.parent()) // vault-host/
        .ok_or_else(|| String::from("entry has no package dir / 入口路径缺少包目录"))?
        .to_path_buf();
    let node = std::env::var("VAULT_HOST_NODE").unwrap_or_else(|_| String::from("node"));

    let mut child = Command::new(&node)
        .arg("--import")
        .arg("tsx")
        .arg(&entry)
        .current_dir(&package_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "failed to spawn node ({node}): {e} — is Node.js installed? \
                 启动 node 失败（{node}）：{e}——请确认已安装 Node.js。"
            )
        })?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| String::from("child stdin unavailable / 子进程 stdin 不可用"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| String::from("child stdout unavailable / 子进程 stdout 不可用"))?;
    let stderr = child.stderr.take();

    let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));

    // Reader thread: route responses to their waiting caller, forward events
    // to the webview, ignore noise.
    let reader_pending = Arc::clone(&pending);
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            match classify_line(&line) {
                LineKind::Response { id, body } => {
                    let sender = reader_pending.lock().ok().and_then(|mut m| m.remove(&id));
                    if let Some(sender) = sender {
                        let _ = sender.send(body);
                    }
                }
                LineKind::Event(value) => {
                    let _ = app.emit(VAULT_HOST_EVENT, value);
                }
                LineKind::Noise => {}
            }
        }
        log::info!("vault-host stdout closed");
    });

    // stderr thread: server logs → desktop log, never the protocol channel.
    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                log::info!("vault-host: {line}");
            }
        });
    }

    Ok(VaultHostProc {
        child,
        stdin: Arc::new(Mutex::new(stdin)),
        pending,
        next_id: Arc::new(AtomicU64::new(1)),
    })
}

fn proc_status(proc_slot: &mut Option<VaultHostProc>) -> VaultHostStatus {
    match proc_slot {
        Some(proc_) => match proc_.child.try_wait() {
            Ok(None) => VaultHostStatus {
                running: true,
                pid: Some(proc_.child.id()),
            },
            _ => {
                // Exited (or unknowable) — drop the dead handle.
                *proc_slot = None;
                VaultHostStatus {
                    running: false,
                    pid: None,
                }
            }
        },
        None => VaultHostStatus {
            running: false,
            pid: None,
        },
    }
}

#[tauri::command]
pub fn vault_host_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, VaultHostState>,
    entry: Option<String>,
) -> Result<VaultHostStatus, String> {
    let mut slot = state.0.lock().map_err(|_| poisoned())?;
    let status = proc_status(&mut slot);
    if status.running {
        return Ok(status);
    }
    let entry_path = resolve_entry(entry)?;
    let proc_ = spawn_host(app, entry_path)?;
    let pid = proc_.child.id();
    *slot = Some(proc_);
    Ok(VaultHostStatus {
        running: true,
        pid: Some(pid),
    })
}

#[tauri::command]
pub fn vault_host_rpc(
    state: tauri::State<'_, VaultHostState>,
    method: String,
    params: Option<Value>,
) -> Result<Value, String> {
    // Grab the shared pieces, then release the state lock before blocking so
    // status/stop calls never queue behind a slow RPC.
    let (stdin, pending, next_id) = {
        let mut slot = state.0.lock().map_err(|_| poisoned())?;
        let status = proc_status(&mut slot);
        let proc_ = slot.as_ref().filter(|_| status.running).ok_or_else(|| {
            String::from(
                "vault host not running — call vault_host_start first. \
                 vault host 未运行——请先调用 vault_host_start。",
            )
        })?;
        (
            Arc::clone(&proc_.stdin),
            Arc::clone(&proc_.pending),
            Arc::clone(&proc_.next_id),
        )
    };

    let id = next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::channel::<Value>();
    pending
        .lock()
        .map_err(|_| poisoned())?
        .insert(id, tx);

    let request = json!({ "id": id, "method": method, "params": params.unwrap_or_else(|| json!({})) });
    let write_result = {
        let mut stdin = stdin.lock().map_err(|_| poisoned())?;
        stdin
            .write_all(format!("{request}\n").as_bytes())
            .and_then(|_| stdin.flush())
    };
    if let Err(e) = write_result {
        pending.lock().map_err(|_| poisoned())?.remove(&id);
        return Err(format!(
            "failed to write to vault host: {e} / 写入 vault host 失败：{e}"
        ));
    }

    match rx.recv_timeout(RPC_TIMEOUT) {
        Ok(body) => {
            if body.get("ok").and_then(Value::as_bool) == Some(true) {
                Ok(body.get("result").cloned().unwrap_or(Value::Null))
            } else {
                let code = body
                    .pointer("/error/code")
                    .and_then(Value::as_str)
                    .unwrap_or("internal");
                let message = body
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown error");
                Err(format!("{code}: {message}"))
            }
        }
        Err(_) => {
            pending.lock().map_err(|_| poisoned())?.remove(&id);
            Err(format!(
                "vault host rpc timed out after {}s ({method}) / vault host RPC 超时（{method}）",
                RPC_TIMEOUT.as_secs()
            ))
        }
    }
}

#[tauri::command]
pub fn vault_host_status(
    state: tauri::State<'_, VaultHostState>,
) -> Result<VaultHostStatus, String> {
    let mut slot = state.0.lock().map_err(|_| poisoned())?;
    Ok(proc_status(&mut slot))
}

#[tauri::command]
pub fn vault_host_stop(state: tauri::State<'_, VaultHostState>) -> Result<(), String> {
    let proc_ = {
        let mut slot = state.0.lock().map_err(|_| poisoned())?;
        slot.take()
    };
    let Some(mut proc_) = proc_ else {
        return Ok(());
    };
    // Graceful: host.shutdown flushes every open vault before the process
    // exits; fall back to kill if the pipe is already broken.
    let shutdown = json!({ "id": u64::MAX, "method": "host.shutdown", "params": {} });
    if let Ok(mut stdin) = proc_.stdin.lock() {
        let _ = stdin.write_all(format!("{shutdown}\n").as_bytes());
        let _ = stdin.flush();
    }
    std::thread::sleep(Duration::from_millis(300));
    match proc_.child.try_wait() {
        Ok(Some(_)) => Ok(()),
        _ => {
            let _ = proc_.child.kill();
            let _ = proc_.child.wait();
            Ok(())
        }
    }
}

fn poisoned() -> String {
    String::from("vault host state lock poisoned / vault host 状态锁已污染")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_line_routes_responses_by_id() {
        match classify_line(r#"{"id": 7, "ok": true, "result": {"pong": true}}"#) {
            LineKind::Response { id, body } => {
                assert_eq!(id, 7);
                assert_eq!(body.pointer("/result/pong"), Some(&Value::Bool(true)));
            }
            other => panic!("expected response, got {other:?}"),
        }
    }

    #[test]
    fn classify_line_routes_events() {
        match classify_line(r#"{"event": "vault-event", "payload": {"root": "/v"}}"#) {
            LineKind::Event(value) => {
                assert_eq!(
                    value.get("event").and_then(Value::as_str),
                    Some("vault-event")
                );
            }
            other => panic!("expected event, got {other:?}"),
        }
    }

    #[test]
    fn classify_line_ignores_noise_and_malformed_json() {
        assert!(matches!(classify_line(""), LineKind::Noise));
        assert!(matches!(classify_line("   "), LineKind::Noise));
        assert!(matches!(classify_line("not json {{{"), LineKind::Noise));
        // JSON without id or event is noise too (e.g. a stray log object).
        assert!(matches!(classify_line(r#"{"level":"info"}"#), LineKind::Noise));
    }

    #[test]
    fn first_existing_respects_priority_and_skips_missing() {
        let dir = std::env::temp_dir();
        let real = dir.join(format!("vault-host-test-{}.ts", std::process::id()));
        std::fs::write(&real, "// entry").expect("write temp entry");
        let picked = first_existing(vec![
            PathBuf::from("/definitely/not/a/file.ts"),
            real.clone(),
        ]);
        assert_eq!(picked, Some(real.clone()));
        assert_eq!(first_existing(vec![PathBuf::from("/nope.ts")]), None);
        let _ = std::fs::remove_file(real);
    }

    #[test]
    fn missing_entry_error_is_bilingual_and_actionable() {
        let err = missing_entry_error();
        assert!(err.contains("VAULT_HOST_ENTRY"));
        assert!(err.contains("未找到"));
    }
}
