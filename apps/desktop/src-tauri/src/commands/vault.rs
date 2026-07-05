// apps/desktop/src-tauri/src/commands/vault.rs
//
// Native vault operations the Tauri shell owns directly. The CRDT reconcile,
// sidecar Y.Doc IO and signing run in the Node host (packages/vault-host);
// what MUST live in Rust is the filesystem-level shell: validate + create a
// vault's `.vault/` control-plane skeleton, list its documents, and read the
// plaintext public key so the desktop can show a vault's identity without a
// passphrase. Layout mirrors packages/vault-host/src/_shared.ts.

use std::fs;
use std::path::Path;

use serde::Serialize;

/// Sub-directories that make up the `.vault/` control plane (spec §3 /
/// ADR-0017 §2.2). Kept in sync with `VAULT_CONTROL_DIRS` in vault-host.
const VAULT_CONTROL_DIRS: [&str; 4] =
    [".vault", ".vault/yjs", ".vault/keys", ".vault/pending-sync"];

/// Plaintext public-key file identity writes under the vault (identity's
/// `PUBLIC_KEY_FILE`), readable without the passphrase for sharing.
const PUBLIC_KEY_REL: &str = ".vault/keys/ed25519.pub";

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct VaultInfo {
    /// Absolute path of the vault root, echoed back for the caller.
    pub root: String,
    /// True if the directory already existed before this open call.
    pub existed: bool,
    /// True once the `.vault/` control plane is present (always true on success).
    pub initialized: bool,
}

/// Create the `.vault/` skeleton under `root`. Idempotent.
fn ensure_vault_skeleton(root: &Path) -> std::io::Result<()> {
    for sub in VAULT_CONTROL_DIRS {
        fs::create_dir_all(root.join(sub))?;
    }
    Ok(())
}

/// Open (creating if absent) a vault at `path` and ensure its skeleton.
fn open_vault(path: &str) -> Result<VaultInfo, String> {
    let root = Path::new(path);
    let existed = root.is_dir();
    fs::create_dir_all(root).map_err(|e| format!("failed to create vault dir: {e}"))?;
    ensure_vault_skeleton(root).map_err(|e| format!("failed to init .vault skeleton: {e}"))?;
    Ok(VaultInfo {
        root: path.to_string(),
        existed,
        initialized: root.join(".vault").is_dir(),
    })
}

/// List top-level markdown documents in a vault (shallow — nested-folder
/// recursion lands in Phase 6 W3-W4 alongside the doc index). Results sorted.
fn list_markdown(path: &str) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(path).map_err(|e| format!("failed to read vault dir: {e}"))?;
    let mut docs = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read entry: {e}"))?;
        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }
        if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
            if name.ends_with(".md") {
                docs.push(name.to_string());
            }
        }
    }
    docs.sort();
    Ok(docs)
}

/// Read the vault's plaintext ed25519 public key, or `None` when the vault has
/// no identity yet.
fn read_public_key(path: &str) -> Result<Option<String>, String> {
    let key_path = Path::new(path).join(PUBLIC_KEY_REL);
    match fs::read_to_string(&key_path) {
        Ok(contents) => Ok(Some(contents.trim().to_string())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("failed to read public key: {e}")),
    }
}

#[tauri::command]
pub async fn vault_open(path: String) -> Result<VaultInfo, String> {
    open_vault(&path)
}

#[tauri::command]
pub async fn vault_list_documents(path: String) -> Result<Vec<String>, String> {
    list_markdown(&path)
}

#[tauri::command]
pub async fn vault_public_key(path: String) -> Result<Option<String>, String> {
    read_public_key(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Unique throwaway dir under the OS temp root (no `tempfile` crate dep).
    fn unique_tmp_dir(tag: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let mut dir = std::env::temp_dir();
        dir.push(format!(
            "collabtool-vault-test-{tag}-{}-{nanos}",
            std::process::id()
        ));
        dir
    }

    #[test]
    fn open_vault_creates_skeleton_and_reports_new() {
        let dir = unique_tmp_dir("open");
        let info = open_vault(dir.to_str().unwrap()).expect("open_vault");
        assert!(!info.existed, "fresh dir should not pre-exist");
        assert!(info.initialized);
        for sub in VAULT_CONTROL_DIRS {
            assert!(dir.join(sub).is_dir(), "{sub} should be created");
        }
        // Second open on the same dir now reports existed=true, still idempotent.
        let again = open_vault(dir.to_str().unwrap()).expect("re-open_vault");
        assert!(again.existed);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn list_markdown_finds_only_top_level_md_sorted() {
        let dir = unique_tmp_dir("list");
        open_vault(dir.to_str().unwrap()).unwrap();
        fs::write(dir.join("b.md"), "b").unwrap();
        fs::write(dir.join("a.md"), "a").unwrap();
        fs::write(dir.join("notes.txt"), "x").unwrap();
        let docs = list_markdown(dir.to_str().unwrap()).unwrap();
        assert_eq!(docs, vec!["a.md".to_string(), "b.md".to_string()]);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_public_key_none_when_absent_some_when_present() {
        let dir = unique_tmp_dir("pubkey");
        open_vault(dir.to_str().unwrap()).unwrap();
        assert_eq!(read_public_key(dir.to_str().unwrap()).unwrap(), None);

        fs::write(dir.join(PUBLIC_KEY_REL), "ed25519:deadbeef\n").unwrap();
        assert_eq!(
            read_public_key(dir.to_str().unwrap()).unwrap(),
            Some("ed25519:deadbeef".to_string())
        );
        fs::remove_dir_all(&dir).ok();
    }
}
