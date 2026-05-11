# Spike-1: Tauri Desktop Shell + Local Ollama Inline AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 5 Wave B Spike-1 — 验证 Tauri 2.x 套现 Next.js web 套壳 + 系统集成 + 本地 ollama inline AI 调用，5-7 天内交付 3 平台 binary，作为后续 client-first pivot 的 desktop entry point。**只验证 Spike-1，不实现 client-first 反转 / vault-fs / sandbox**（那些是 Spike-2/3 + Phase 6 工作）。

**Architecture:** Tauri 2.x shell webview → 套现有 `apps/web/` Next.js（dev 期 `http://localhost:3000`，发布期可配置远端 URL）。Rust 侧提供 system tray / notifications / file association / deep link / updater / ollama detection。JS 侧提供 inline AI toggle + 直连 `fetch('http://localhost:11434')`。

**Tech Stack:** Tauri 2.x / Rust 1.75+ / pnpm 10 / Node 22 / `node --test --import tsx tests/*.test.ts`（项目惯例，**非** vitest）/ GitHub Actions / Tauri Updater（minisign-signed manifest）/ Apple notarization + Windows signtool（可选，spike-1 dev profile 即可）

---

## Prerequisites（执行前自检）

- [ ] Rust toolchain 已装：`cargo --version` 返回 1.75+
- [ ] macOS host：`xcode-select -p` 返回 SDK 路径
- [ ] pnpm 10 装好：`pnpm --version` 返回 10.x
- [ ] Node 22+：`node --version` 返回 22.x
- [ ] 当前在 `claude/spike-1-tauri-shell` 分支（如果不在，先 `git checkout -b claude/spike-1-tauri-shell`）

## Out of Scope（防止 scope creep）

- ❌ Client-first source-of-truth 反转（Spike-2 / Phase 6）
- ❌ `packages/vault-fs/` markdown ↔ Y.Doc reconcile（Spike-2）
- ❌ 跨平台 plugin sandbox（Spike-3）
- ❌ E2EE 加密（Phase 7+）
- ❌ 服务端架构改造（保持现 sync-gateway / snapshot-worker / agent-worker）
- ❌ 真生产 release（spike 用 dev profile 即可，code signing 留 failure_mode）
- ❌ 移动端（Tauri 2 支持 iOS/Android 但不在 Spike-1 scope）

---

## File Structure

新增（all under `apps/desktop/`）：
- `apps/desktop/package.json` — pnpm scripts + Tauri CLI binding
- `apps/desktop/.gitignore` — Rust target / Tauri artifacts
- `apps/desktop/tsconfig.json` — TS for build helpers（如果有）
- `apps/desktop/README.md` — Spike-1 说明 + 本地起步
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/Cargo.lock`（auto generated）
- `apps/desktop/src-tauri/build.rs`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/icons/icon.png` — 512×512 placeholder（Spike-1 接受 placeholder，正式品牌资源 Phase 6 W1 再换）
- `apps/desktop/src-tauri/icons/icon.icns` — macOS
- `apps/desktop/src-tauri/icons/icon.ico` — Windows
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/src/commands/mod.rs`
- `apps/desktop/src-tauri/src/commands/ollama.rs` — `detect_ollama_available`
- `apps/desktop/src-tauri/src/commands/system.rs` — `open_external_url`, `quit_app`
- `apps/desktop/src-tauri/src/tray.rs` — 系统托盘
- `apps/desktop/src-tauri/tests/` — Rust integration tests

修改：
- `apps/web/src/lib/local-ollama.ts`（新建）— TS 侧 ollama HTTP client（fetch chat / parse stream / detect available）
- `apps/web/src/lib/desktop-bridge.ts`（新建）— JS 端检测 Tauri / 调 Tauri commands 的 helper
- `apps/web/tests/local-ollama.test.ts`（新建）— node:test 单元测试
- `apps/web/tests/desktop-bridge.test.ts`（新建）— node:test 单元测试
- `apps/web/src/app/(app)/editor/[docId]/components/InlineAgentMenu.tsx` — 加 "Use local AI" toggle（条件渲染：Tauri env 才显示）
- `apps/web/src/lib/inline-agent-menu.ts` — 加 `localAiEnabled` 字段到 menu state
- `apps/web/tests/inline-agent-menu.test.ts`（如果不存在则新建）— 测试 localAi toggle 行为
- `.github/workflows/desktop-release.yml`（新建）— 3 平台 build + release artifact
- `package.json`（root）— 加 `desktop:dev` / `desktop:build` / `desktop:test` scripts
- `pnpm-workspace.yaml` — 无需改（`apps/*` glob 已 cover）
- `STATUS.md` — 顶部"最后更新"+ §1 + §2（Spike-1 一行）
- `plan0/adr/0003-tech-stack-lockdown.md` — review log 追 Spike-1 entry

测试文件：
- `apps/desktop/src-tauri/src/commands/ollama.rs` — `#[cfg(test)]` 单元测试 `detect_ollama_available`
- `apps/desktop/src-tauri/tests/integration_test.rs` — Rust integration test for Tauri commands wiring（可选）
- `apps/web/tests/local-ollama.test.ts` — fetch mock + chat call
- `apps/web/tests/desktop-bridge.test.ts` — `isTauri()` / `safeInvoke()`
- `apps/web/tests/inline-agent-menu.test.ts` — localAi toggle state

---

## Tasks

### Task 1: 注册 apps/desktop 到 pnpm workspace

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/.gitignore`
- Modify: `package.json` (root, scripts 段)

- [ ] **Step 1: 创建 `apps/desktop/package.json`**

```json
{
  "name": "@collaborationtool/desktop",
  "version": "0.1.0-spike",
  "private": true,
  "description": "Tauri 2.x desktop shell for collaboration tool — Spike-1 PoC",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "cd src-tauri && cargo test --quiet",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.1.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: 创建 `apps/desktop/.gitignore`**

```
src-tauri/target/
src-tauri/Cargo.lock
src-tauri/gen/
*.dmg
*.deb
*.AppImage
*.msi
*.exe
*.app
```

- [ ] **Step 3: 加 root scripts**

修改 `package.json` 在 scripts 对象内追加（已有 web/gateway/snapshot 段后）：

```json
"desktop:dev": "pnpm --filter @collaborationtool/desktop dev",
"desktop:build": "pnpm --filter @collaborationtool/desktop build",
"desktop:test": "pnpm --filter @collaborationtool/desktop test",
"desktop:typecheck": "pnpm --filter @collaborationtool/desktop typecheck",
```

- [ ] **Step 4: 验证 workspace 识别**

Run: `pnpm list --depth 0 --filter @collaborationtool/desktop`
Expected: 显示 `@collaborationtool/desktop` 已注册（无 deps OK；本 step 只验证识别）

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/.gitignore package.json
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 1 — apps/desktop pnpm workspace 注册

scaffold 空 package.json + .gitignore + root scripts；尚未引入 Rust / Tauri 实际代码。
EOF
)"
```

---

### Task 2: Tauri Rust scaffold

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/icons/icon.png`（512×512 placeholder — Spike-1 用 PNG 生成命令；正式资源 Phase 6 W1 补）

- [ ] **Step 1: 创建 `Cargo.toml`**

```toml
[package]
name = "collabtool-desktop"
version = "0.1.0"
description = "Collaboration tool desktop shell — Spike-1"
edition = "2021"
rust-version = "1.75"

[lib]
name = "collabtool_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["tray-icon", "macos-private-api"] }
tauri-plugin-notification = "2.0"
tauri-plugin-shell = "2.0"
tauri-plugin-os = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
log = "0.4"

[dev-dependencies]
mockito = "1.5"
tokio-test = "0.4"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 2: 创建 `build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: 创建最小 `src/main.rs`**

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    collabtool_desktop_lib::run()
}
```

- [ ] **Step 4: 创建 `src/lib.rs`（Tauri entry）**

```rust
// Tauri 2 entry. Spike-1 scope: webview-only shell with stub commands.
// Real commands (ollama detection, system) added in Task 3+.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: 创建 `tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2.0",
  "productName": "Collaboration Tool",
  "version": "0.1.0",
  "identifier": "org.collaborationtool.desktop",
  "build": {
    "beforeDevCommand": "pnpm --filter @collaborationtool/web dev",
    "beforeBuildCommand": "pnpm --filter @collaborationtool/web build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../../web/.next/standalone"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Collaboration Tool",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "msi", "deb", "appimage"],
    "icon": [
      "icons/icon.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "12.0"
    }
  }
}
```

- [ ] **Step 6: 生成 placeholder icon**

```bash
# 生成 1×1 红色 PNG 作为 placeholder（用 base64 解码避免外部依赖）
mkdir -p apps/desktop/src-tauri/icons
# 用 Tauri 提供的 placeholder（如果 tauri-icon-utils 没装则用 ImageMagick 或 base64 解码）
# 简化：直接用 base64 inline 一个 8×8 的 PNG
echo "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVQYV2NkYGD4z0AEYBxVSF6owAdGFZIXKvCBUYXkhQp8YFQheaECABXSAggBmlA+AAAAAElFTkSuQmCC" | base64 -d > apps/desktop/src-tauri/icons/icon.png
# icns / ico 用 Tauri CLI 后续 task 自动生成；Spike-1 阶段可以缺省，build 时 Tauri 会 warning 但不阻塞
```

**注意**：placeholder PNG 是 8×8 红色块。Spike-1 接受，正式 release 由 Phase 6 W1 设计师品牌资源接管。这条要在 STATUS / Task 15 验收处记。

- [ ] **Step 7: 验证 cargo check 通过**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: 输出 `Checking collabtool-desktop v0.1.0` 后 `Finished` 无 error（可能首次 download deps 10-20 秒）

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 2 — Tauri 2 Rust scaffold

Cargo.toml + build.rs + lib.rs (空 invoke_handler) + tauri.conf.json + 8×8 placeholder icon。
cargo check 通过；尚未实现任何 command / tray / 真业务逻辑。
icon 是 placeholder，正式品牌资源 Phase 6 W1 替换。
EOF
)"
```

---

### Task 3: Rust command `detect_ollama_available()` — TDD

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop/src-tauri/src/commands/ollama.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`（register handler）

- [ ] **Step 1: 写失败测试 — `commands/ollama.rs`**

```rust
// apps/desktop/src-tauri/src/commands/ollama.rs
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub version: Option<String>,
    pub endpoint: String,
}

const DEFAULT_OLLAMA_ENDPOINT: &str = "http://localhost:11434";

/// Probe a given Ollama endpoint by calling /api/tags.
///
/// Returns `available=true` if HTTP 200, version string from response (if
/// present). Network/timeout/non-200 all map to `available=false`.
pub async fn probe_ollama(endpoint: &str) -> OllamaStatus {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .unwrap();

    let url = format!("{}/api/tags", endpoint);
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => OllamaStatus {
            available: true,
            version: None, // version is parsed from /api/version separately, Spike-1 skip
            endpoint: endpoint.to_string(),
        },
        _ => OllamaStatus {
            available: false,
            version: None,
            endpoint: endpoint.to_string(),
        },
    }
}

#[tauri::command]
pub async fn detect_ollama_available() -> OllamaStatus {
    probe_ollama(DEFAULT_OLLAMA_ENDPOINT).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn probe_returns_unavailable_when_no_server() {
        // No mock — probe a localhost port that is intentionally not bound.
        let status = probe_ollama("http://localhost:1").await;
        assert!(!status.available);
        assert_eq!(status.endpoint, "http://localhost:1");
    }

    #[tokio::test]
    async fn probe_returns_available_when_mock_returns_200() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/tags")
            .with_status(200)
            .with_body(r#"{"models":[]}"#)
            .create_async()
            .await;

        let status = probe_ollama(&server.url()).await;
        assert!(status.available);
        assert_eq!(status.endpoint, server.url());
    }

    #[tokio::test]
    async fn probe_returns_unavailable_when_mock_returns_500() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/tags")
            .with_status(500)
            .create_async()
            .await;

        let status = probe_ollama(&server.url()).await;
        assert!(!status.available);
    }
}
```

- [ ] **Step 2: 创建 `commands/mod.rs`**

```rust
// apps/desktop/src-tauri/src/commands/mod.rs
pub mod ollama;
```

- [ ] **Step 3: 在 lib.rs register handler**

修改 `apps/desktop/src-tauri/src/lib.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            commands::ollama::detect_ollama_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: 跑测试 — 验证 3 个 test PASS**

Run: `cd apps/desktop/src-tauri && cargo test --quiet`
Expected: `running 3 tests ... test result: ok. 3 passed; 0 failed`

如果 fail，常见问题：
- mockito 没装 → 检查 `[dev-dependencies] mockito = "1.5"` 在 Cargo.toml
- tokio runtime 缺 → 检查 `#[tokio::test]` 注解 + `tokio-test = "0.4"` dev-dep
- DNS / network restrict → 测试用 `localhost`, port 1 不需要外网

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 3 — detect_ollama_available command (TDD)

probe_ollama() 用 reqwest 探测 localhost:11434/api/tags，500ms timeout；
detect_ollama_available 是 #[tauri::command] wrapper（默认 endpoint）。
3 mockito 测试覆盖 unavailable / available-200 / available-500。
EOF
)"
```

---

### Task 4: TS helper `lib/local-ollama.ts` — TDD

**Files:**
- Create: `apps/web/src/lib/local-ollama.ts`
- Create: `apps/web/tests/local-ollama.test.ts`

- [ ] **Step 1: 写失败测试 `apps/web/tests/local-ollama.test.ts`**

```typescript
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectOllamaInBrowser,
  chatCompletion,
  parseStreamChunk,
  type OllamaChatRequest,
} from '../src/lib/local-ollama.js';

// fetch mocking via global override
const originalFetch = globalThis.fetch;

describe('local-ollama', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('detectOllamaInBrowser returns true when /api/tags 200', async () => {
    globalThis.fetch = async () => new Response('{"models":[]}', { status: 200 });
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, true);
  });

  test('detectOllamaInBrowser returns false when fetch throws', async () => {
    globalThis.fetch = async () => {
      throw new Error('NetworkError');
    };
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, false);
  });

  test('detectOllamaInBrowser returns false when 500', async () => {
    globalThis.fetch = async () => new Response('', { status: 500 });
    const ok = await detectOllamaInBrowser();
    assert.equal(ok, false);
  });

  test('chatCompletion POSTs to /api/chat with body', async () => {
    let captured: { url?: string; body?: string } = {};
    globalThis.fetch = async (url, init) => {
      captured.url = String(url);
      captured.body = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          message: { role: 'assistant', content: 'hi' },
          done: true,
        }),
        { status: 200 },
      );
    };

    const req: OllamaChatRequest = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
    };
    const resp = await chatCompletion(req);

    assert.equal(captured.url, 'http://localhost:11434/api/chat');
    assert.match(captured.body!, /llama3/);
    assert.match(captured.body!, /hello/);
    assert.equal(resp.message.content, 'hi');
  });

  test('parseStreamChunk extracts content from NDJSON', () => {
    const line = JSON.stringify({
      message: { role: 'assistant', content: 'wor' },
      done: false,
    });
    const out = parseStreamChunk(line);
    assert.equal(out?.content, 'wor');
    assert.equal(out?.done, false);
  });

  test('parseStreamChunk returns null on malformed line', () => {
    const out = parseStreamChunk('not-json');
    assert.equal(out, null);
  });
});
```

- [ ] **Step 2: 跑测试，确认全 FAIL**

Run: `cd apps/web && pnpm test`
Expected: 6 测试全 FAIL（module not found / import error）

- [ ] **Step 3: 实现 `apps/web/src/lib/local-ollama.ts`**

```typescript
// Phase 5 Wave B Spike-1: local Ollama HTTP client (browser/desktop).
// Bypasses server-side ai-runtime/providers/ollama.ts entirely;
// UI fetches localhost:11434 directly.
//
// Why a separate impl? server-side ollama.ts uses node:crypto + tauri
// fetch is the WebView fetch API. Same wire format, different runtime.

const OLLAMA_ENDPOINT = 'http://localhost:11434';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}

export interface OllamaChatResponse {
  message: OllamaMessage;
  done: boolean;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export async function detectOllamaInBrowser(): Promise<boolean> {
  try {
    const resp = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
      method: 'GET',
      // 500 ms cap via AbortSignal.timeout (Node 22+ / modern browsers)
      signal: AbortSignal.timeout(500),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function chatCompletion(
  req: OllamaChatRequest,
): Promise<OllamaChatResponse> {
  const resp = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: false }),
  });
  if (!resp.ok) {
    throw new Error(`Ollama chat failed: HTTP ${resp.status}`);
  }
  return (await resp.json()) as OllamaChatResponse;
}

export function parseStreamChunk(line: string): StreamChunk | null {
  try {
    const obj = JSON.parse(line) as {
      message?: { content?: string };
      done?: boolean;
    };
    if (!obj.message || typeof obj.message.content !== 'string') {
      return null;
    }
    return {
      content: obj.message.content,
      done: obj.done === true,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 跑测试，确认全 PASS**

Run: `cd apps/web && pnpm test`
Expected: 6 测试全 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/local-ollama.ts apps/web/tests/local-ollama.test.ts
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 4 — apps/web local-ollama TS helper (TDD)

detectOllamaInBrowser / chatCompletion / parseStreamChunk 3 个 pure-fn 实现 + 6 个 node:test
单元测试。绕过 server-side ai-runtime/providers/ollama.ts，UI 直接 fetch
http://localhost:11434。
EOF
)"
```

---

### Task 5: TS helper `lib/desktop-bridge.ts` — TDD

**Files:**
- Create: `apps/web/src/lib/desktop-bridge.ts`
- Create: `apps/web/tests/desktop-bridge.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// apps/web/tests/desktop-bridge.test.ts
import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { isTauri, safeInvoke } from '../src/lib/desktop-bridge.js';

// We simulate the Tauri global via the window.__TAURI_INTERNALS__ marker
// (Tauri 2 injects this; absence = browser env).
const W = globalThis as unknown as Record<string, unknown>;

describe('desktop-bridge', () => {
  afterEach(() => {
    delete W['__TAURI_INTERNALS__'];
  });

  test('isTauri returns false in plain Node / browser env', () => {
    assert.equal(isTauri(), false);
  });

  test('isTauri returns true when Tauri injects globals', () => {
    W['__TAURI_INTERNALS__'] = { invoke: () => {} };
    assert.equal(isTauri(), true);
  });

  test('safeInvoke returns null when not in Tauri', async () => {
    const out = await safeInvoke<{ a: number }>('detect_ollama_available');
    assert.equal(out, null);
  });

  test('safeInvoke calls __TAURI_INTERNALS__.invoke when in Tauri', async () => {
    let captured = '';
    W['__TAURI_INTERNALS__'] = {
      invoke: async (cmd: string) => {
        captured = cmd;
        return { available: true };
      },
    };
    const out = await safeInvoke<{ available: boolean }>(
      'detect_ollama_available',
    );
    assert.equal(captured, 'detect_ollama_available');
    assert.deepEqual(out, { available: true });
  });

  test('safeInvoke catches invoke errors → null', async () => {
    W['__TAURI_INTERNALS__'] = {
      invoke: async () => {
        throw new Error('command not found');
      },
    };
    const out = await safeInvoke<{ a: number }>('nonexistent');
    assert.equal(out, null);
  });
});
```

- [ ] **Step 2: 跑测试，确认全 FAIL**

Run: `cd apps/web && pnpm test -- --test-name-pattern='desktop-bridge'`
Expected: 5 个 FAIL（module not found）

- [ ] **Step 3: 实现 `apps/web/src/lib/desktop-bridge.ts`**

```typescript
// Phase 5 Wave B Spike-1: detect Tauri runtime + safely invoke Rust commands.
//
// In a plain Next.js page (browser tab), Tauri globals are absent → all
// invoke calls degrade to null. UI components should check isTauri() before
// rendering desktop-only affordances.

interface TauriInternals {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

function getInternals(): TauriInternals | null {
  const w = globalThis as unknown as Record<string, unknown>;
  const internals = w['__TAURI_INTERNALS__'];
  if (!internals || typeof internals !== 'object') return null;
  if (typeof (internals as TauriInternals).invoke !== 'function') return null;
  return internals as TauriInternals;
}

export function isTauri(): boolean {
  return getInternals() !== null;
}

export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const internals = getInternals();
  if (!internals) return null;
  try {
    return await internals.invoke<T>(cmd, args);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 跑测试 PASS**

Run: `cd apps/web && pnpm test -- --test-name-pattern='desktop-bridge'`
Expected: 5 测试全 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/desktop-bridge.ts apps/web/tests/desktop-bridge.test.ts
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 5 — desktop-bridge isTauri + safeInvoke (TDD)

window.__TAURI_INTERNALS__ 探测 + 优雅降级到 null（非 Tauri 环境）；
safeInvoke 包 try/catch 让 UI 永远拿到 T | null。5 node:test。
EOF
)"
```

---

### Task 6: InlineAgentMenu 加 "Use local AI" toggle

**Files:**
- Modify: `apps/web/src/lib/inline-agent-menu.ts`
- Modify: `apps/web/src/app/(app)/editor/[docId]/components/InlineAgentMenu.tsx`
- Create: `apps/web/tests/inline-agent-menu-localai.test.ts`

- [ ] **Step 1: 读现有 inline-agent-menu.ts 了解 state shape**

Run: `head -60 apps/web/src/lib/inline-agent-menu.ts`

记下 `InlineAgentMenuState` 类型 / `chipModes` 数组等关键字段。

- [ ] **Step 2: 写失败测试 `apps/web/tests/inline-agent-menu-localai.test.ts`**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  toggleLocalAi,
  getDefaultMenuState,
  isLocalAiEnabled,
} from '../src/lib/inline-agent-menu.js';

describe('inline-agent-menu localAi toggle', () => {
  test('default state has localAi disabled', () => {
    const st = getDefaultMenuState();
    assert.equal(isLocalAiEnabled(st), false);
  });

  test('toggleLocalAi flips the flag', () => {
    const st0 = getDefaultMenuState();
    const st1 = toggleLocalAi(st0);
    assert.equal(isLocalAiEnabled(st1), true);
    const st2 = toggleLocalAi(st1);
    assert.equal(isLocalAiEnabled(st2), false);
  });

  test('toggleLocalAi preserves other state fields', () => {
    const st0 = { ...getDefaultMenuState(), prompt: 'hello' };
    const st1 = toggleLocalAi(st0);
    assert.equal(st1.prompt, 'hello');
  });
});
```

- [ ] **Step 3: 修改 `apps/web/src/lib/inline-agent-menu.ts`**

在文件末尾追加（**不**改动现有 `chipModes` / `InlineAgentMenuState` 类型；只加新字段）：

```typescript
// === Phase 5 Wave B Spike-1: localAi toggle ===
//
// When user has Tauri + ollama running, allow inline edit to route to
// local Ollama instead of server-side ModelProvider. Default off.

export interface InlineAgentMenuStateWithLocalAi {
  // re-export the existing shape + new field; if existing state object is
  // 'InlineAgentMenuState' (check imports above), extend that interface
  // instead of redefining. For Spike-1 we add a parallel local-only flag.
  localAi?: boolean;
}

export function isLocalAiEnabled(
  s: { localAi?: boolean } | null | undefined,
): boolean {
  return s?.localAi === true;
}

export function toggleLocalAi<T extends { localAi?: boolean }>(s: T): T {
  return { ...s, localAi: !s.localAi };
}
```

**注意**：如果阅读 inline-agent-menu.ts 后发现已有 state shape，**用 module-augmentation 方式**或**直接修改原 interface**。本 step 取舍：先**最小侵入**（新 helper 不破坏现有 export），然后由 Step 4/5 整合。如果原 state 是 immutable / readonly，请改用现有 reducer 模式（看 file 末尾决定）。

`getDefaultMenuState` 如果不存在，确认 file 中的等价物（可能叫 `createMenuState` / `initialMenuState`），import 它然后写一个 thin wrapper：

```typescript
export function getDefaultMenuState(): { localAi?: boolean } & Record<string, unknown> {
  // If existing default fn exists, call it; else return empty.
  // Replace with real impl after reading the file.
  return { localAi: false };
}
```

**这条 step 涉及"对现有代码 fit"，不是纯新建。执行者需要：读原 file → 选最佳整合点 → 实现到通过 test**。

- [ ] **Step 4: 跑测试 PASS**

Run: `cd apps/web && pnpm test -- --test-name-pattern='localAi'`
Expected: 3 测试 PASS

- [ ] **Step 5: 修改 `InlineAgentMenu.tsx` 加 UI toggle**

读 file，在合适位置（chip mode 选择附近）加：

```tsx
import { isTauri } from '@/lib/desktop-bridge';
import { detectOllamaInBrowser } from '@/lib/local-ollama';
import { useEffect, useState } from 'react';
// 已有 import 不重复

// In component body:
const [ollamaReady, setOllamaReady] = useState(false);
useEffect(() => {
  if (!isTauri()) return;
  detectOllamaInBrowser().then(setOllamaReady);
}, []);

// In JSX, conditionally render toggle:
{ollamaReady && (
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      checked={state.localAi ?? false}
      onChange={() => onStateChange(toggleLocalAi(state))}
    />
    <span style={{ color: 'var(--color-ink-muted)' }}>
      使用本地 AI · Use local AI
    </span>
  </label>
)}
```

**Design.md gate**: 不要引入 hex / Tailwind palette / rounded-* 等被 reject 的 token。颜色用 `var(--color-*)`。

确认 `pnpm web:typecheck` 通过。

- [ ] **Step 6: 跑 web 测试套件确保无回归**

Run: `cd apps/web && pnpm test`
Expected: 现有 255+3 = 258 PASS（数字依现状增量；core baseline 不能 RED）

- [ ] **Step 7: typecheck**

Run: `pnpm web:typecheck`
Expected: 4 baseline 错误（apps/web layout React 19 ReactNode + lib/inline-agent-menu Duplicate ChipMode）不变。不应引入新错误。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/inline-agent-menu.ts apps/web/src/app/\(app\)/editor/\[docId\]/components/InlineAgentMenu.tsx apps/web/tests/inline-agent-menu-localai.test.ts
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 6 — InlineAgentMenu local-AI toggle (TDD)

toggleLocalAi + isLocalAiEnabled helper（3 node:test）；InlineAgentMenu
新增 conditional UI toggle，仅当 Tauri + ollama 在线时显示。
Design.md token 100% var(--color-*)，0 hex / 0 Tailwind palette。
EOF
)"
```

---

### Task 7: System tray icon + menu

**Files:**
- Create: `apps/desktop/src-tauri/src/tray.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 `tray.rs`**

```rust
// apps/desktop/src-tauri/src/tray.rs
//
// System tray icon + minimal menu (Show / Quit). Spike-1 scope: prove tray
// works on macOS / Windows / Linux. Branded icon / advanced state replaces
// in Phase 6.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
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
```

- [ ] **Step 2: 在 lib.rs setup 时调用 build_tray**

修改 `lib.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
```

- [ ] **Step 3: 跑 cargo check**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: PASS（如果 tauri 2 tray API 版本不匹配，参考 https://v2.tauri.app/learn/system-tray/）

- [ ] **Step 4: 跑 `pnpm desktop:dev` 手工验证**

Run: `pnpm desktop:dev`

人工检查：
- ✓ 应用启动 + 窗口出现
- ✓ 系统托盘出现图标
- ✓ 右键托盘 → 看到"显示窗口 / 退出"中英菜单
- ✓ 点"退出"后应用真退出
- ✓ 关闭窗口后再点托盘 → 窗口重现

平台特定备注：
- **macOS**：托盘在屏幕顶部 menu bar 右侧
- **Linux**：取决于 DE（GNOME 默认隐藏 tray，需要装 TopIcons extension；KDE 直接可见）
- **Windows**：托盘在右下角 system tray

人工验证失败 → 不要 commit，回头查 Tauri 2 tray 文档 + dist/icon.png 是否能加载。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/tray.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 7 — system tray icon + menu

Tauri 2 TrayIconBuilder + 中英双语 menu（显示 / 退出）；
left-click 重新激活主窗口；setup hook 注册。
跨平台手工验证（macOS / Linux）通过。Windows 等 task 12 CI 验证。
EOF
)"
```

---

### Task 8: Notifications + File association + Deep link

> 合并是因为这三个都是 tauri.conf.json 配置 + 一个小 Rust command，单独成 task 步骤太碎。

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`（加 `tauri-plugin-deep-link`）
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/src/commands/system.rs`

- [ ] **Step 1: 加 deep-link 依赖**

修改 `Cargo.toml` `[dependencies]` 加：

```toml
tauri-plugin-deep-link = "2.0"
```

- [ ] **Step 2: tauri.conf.json 加 file association + deep link**

修改 `bundle` 段：

```json
"bundle": {
  "active": true,
  "targets": ["dmg", "msi", "deb", "appimage"],
  "icon": ["icons/icon.png", "icons/icon.icns", "icons/icon.ico"],
  "fileAssociations": [
    {
      "ext": ["paper"],
      "name": "Collaboration Paper",
      "description": "Collaboration Tool paper document",
      "role": "Editor",
      "mimeType": "text/x.collabtool-paper"
    }
  ],
  "macOS": {
    "minimumSystemVersion": "12.0"
  }
}
```

加 plugins 段：

```json
"plugins": {
  "deep-link": {
    "desktop": {
      "schemes": ["collabtool"]
    }
  }
}
```

- [ ] **Step 3: 注册 deep-link plugin + 处理事件**

修改 `lib.rs`：

```rust
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
                    let _ = win.emit("deep-link-opened", urls);
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
```

- [ ] **Step 4: 创建 `commands/system.rs` 与 `mod.rs` 注册**

`commands/system.rs`：

```rust
// apps/desktop/src-tauri/src/commands/system.rs
use tauri_plugin_shell::ShellExt;
use tauri::AppHandle;

#[tauri::command]
pub async fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    app.shell()
        .open(url, None)
        .map_err(|e| format!("failed to open url: {e}"))
}
```

`commands/mod.rs` 改为：

```rust
pub mod ollama;
pub mod system;
```

- [ ] **Step 5: cargo check 通过**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: 人工验证 deep link**

启动 dev：`pnpm desktop:dev`

在另一终端：
- macOS: `open 'collabtool://doc/test-id-123'` → expect 应用前台 + console log `deep-link opened`
- Linux: `xdg-open 'collabtool://doc/test-id-123'`
- Windows: PowerShell `Start-Process 'collabtool://doc/test-id-123'`

人工验证 `.paper` 文件关联：暂留 task 12（release build 完才能验证）。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 8 — notifications/deep-link/.paper file association

tauri.conf.json bundle.fileAssociations + plugins.deep-link.schemes;
tauri-plugin-deep-link 注册 + on_open_url → window emit 'deep-link-opened'；
commands/system.rs::open_external_url（shell plugin 包装）。
Deep link 在 macOS / Linux 手工验证通过；.paper 关联等 task 12 release build 验证。
EOF
)"
```

---

### Task 9: Tauri Updater 签名配置

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/UPDATER_KEYS.md`（gitignored 后才能加） / 实际是 `apps/desktop/UPDATER_README.md`（commited，讲怎么生成 key）

- [ ] **Step 1: 加 updater 依赖**

修改 `Cargo.toml` `[dependencies]`：

```toml
tauri-plugin-updater = "2.0"
```

- [ ] **Step 2: 文档 minisign key 生成步骤**

创建 `apps/desktop/UPDATER_README.md`（**注意**：本文档讲流程，不放私钥；私钥放 GitHub Secrets）：

```markdown
# Updater Signing — Spike-1 PoC

Tauri 2 updater 用 minisign（Tauri 内置 CLI 包装）。

## 一次性生成 keypair

```bash
cd apps/desktop
pnpm tauri signer generate -w ~/.tauri/collabtool.key
# 提示输入 passphrase（保管好）
# 产出:
#   ~/.tauri/collabtool.key (private, **不要 commit**)
#   ~/.tauri/collabtool.key.pub (public, 复制到 tauri.conf.json updater.pubkey)
```

## CI 用

在 GitHub repo settings → Secrets：
- `TAURI_SIGNING_PRIVATE_KEY` = 私钥文件内容（cat 进去）
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = passphrase

## 本地 release build 用

```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/collabtool.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<your passphrase>'
pnpm desktop:build
```

## Spike-1 简化

Spike-1 仍然产出 release bundle，但 updater endpoint 暂未上线（不存在升级源）。
正式 updater endpoint 上线推到 Phase 6 W2。
```

- [ ] **Step 3: tauri.conf.json 加 updater 段**

```json
"plugins": {
  "deep-link": {
    "desktop": { "schemes": ["collabtool"] }
  },
  "updater": {
    "endpoints": [
      "https://github.com/<org>/collaborationtool/releases/latest/download/latest.json"
    ],
    "pubkey": "REPLACE_WITH_OUTPUT_OF_tauri_signer_generate",
    "dialog": true
  }
}
```

**注意**：`<org>` 占位、`pubkey` 占位都需要 owner 真实填入。Spike-1 可以暂时填 dummy URL（不会跑 update check 除非 UI 触发）。

- [ ] **Step 4: lib.rs register updater plugin**

修改 `lib.rs`，在 plugins 列表加：

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

- [ ] **Step 5: cargo check 通过**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/src/lib.rs apps/desktop/UPDATER_README.md
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 9 — Tauri Updater 框架 + minisign 文档

tauri-plugin-updater 注册 + tauri.conf.json plugins.updater 段（endpoint
+ pubkey 占位）；UPDATER_README.md 写 keypair 生成 + CI secrets 步骤。
真升级源 endpoint 上线 Phase 6 W2。
EOF
)"
```

---

### Task 10: GitHub Actions workflow（3 平台 build）

**Files:**
- Create: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: 创建 workflow**

`.github/workflows/desktop-release.yml`：

```yaml
name: Desktop Release (Spike-1)

on:
  push:
    tags:
      - 'desktop-v*'
  workflow_dispatch:

jobs:
  build:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14            # arm64
            target: aarch64-apple-darwin
            label: macos-arm64
          - os: macos-13            # x64
            target: x86_64-apple-darwin
            label: macos-x64
          - os: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            label: linux-x64
          - os: windows-2022
            target: x86_64-pc-windows-msvc
            label: windows-x64
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Linux deps
        if: matrix.os == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libssl-dev libgtk-3-dev

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Build desktop
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        run: pnpm desktop:build --target ${{ matrix.target }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: collabtool-desktop-${{ matrix.label }}
          path: |
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/dmg/*.dmg
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/macos/*.app
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/deb/*.deb
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/appimage/*.AppImage
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/msi/*.msi
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/nsis/*.exe

      - name: Release（tag push 才发）
        if: startsWith(github.ref, 'refs/tags/desktop-v')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/**/*.dmg
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/**/*.deb
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/**/*.AppImage
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/**/*.msi
            apps/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/**/*.exe
          generate_release_notes: true
```

- [ ] **Step 2: 本地静态校验 YAML**

Run: `npx --yes js-yaml .github/workflows/desktop-release.yml > /dev/null && echo "YAML OK"`
Expected: `YAML OK`（如果 js-yaml 不可用，用 `python3 -c 'import yaml,sys;yaml.safe_load(open(sys.argv[1]))' .github/workflows/desktop-release.yml`）

- [ ] **Step 3: 触发 workflow_dispatch 验证一次（人工）**

合并到 main 后，去 GitHub Actions → "Desktop Release (Spike-1)" → Run workflow。预期 4 个 matrix 4 个 artifact 上传。

**Spike-1 验收**：3 平台（macOS-arm64 / linux-x64 / windows-x64）任 1 成功即标 Spike-1 task 10 PASS。macOS-x64 是 nice-to-have。

如果 4 个都 fail，常见原因：
- pnpm-lock 缺 desktop deps → 先本地 `pnpm install`
- Tauri 2 deps 在 ubuntu-22.04 不全 → 添加 deps 到 `Linux deps` step
- Rust target 没装 → 已在 `dtolnay/rust-toolchain` step 装

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 task 10 — GitHub Actions desktop-release workflow

4 matrix（macOS-arm64/x64 / Linux-x64 / Windows-x64）build；artifact upload；
tag push（desktop-v*）触发 GH Release；workflow_dispatch 支持手动跑。
Spike-1 验收：3 平台任 1 成功即 PASS。
EOF
)"
```

---

### Task 11: 跨平台 dev 手工 smoke test

**Files:** N/A（验收 task）

- [ ] **Step 1: 启动 web dev**

在 terminal 1：`pnpm web:dev`
Expected: `▲ Next.js ready on http://localhost:3000`

- [ ] **Step 2: 启动 desktop dev**

在 terminal 2：`pnpm desktop:dev`
Expected: Tauri 编译（首次 1-2 分钟）→ 应用窗口出现 + 显示 Next.js 内容

- [ ] **Step 3: 走完 smoke checklist**

```
☐ 窗口出现 + Next.js 页面渲染
☐ 系统托盘图标存在
☐ 托盘菜单"显示窗口"work
☐ 托盘菜单"退出"work
☐ deep link `collabtool://doc/abc` 触发 window event
☐ inline AI toggle (在编辑器内) 出现 *仅当* ollama 在线
☐ ollama 真在线时点击 toggle + 编辑器内 inline edit 调用本地 ollama 而非远端 API
```

如果 ollama 没装：`brew install ollama` (macOS) / `curl -fsSL https://ollama.com/install.sh | sh` (Linux)
等 ollama install 完，`ollama serve` 后 `ollama pull llama3.2` 验证。

**Note**: 本 task **不 commit**，只做记录验收。结果记入 task 15 spike-1 完工 report。

---

### Task 12: 更新文档 + ADR review log + STATUS

**Files:**
- Modify: `STATUS.md`
- Modify: `plan0/adr/0003-tech-stack-lockdown.md`
- Create: `apps/desktop/README.md`

- [ ] **Step 1: 创建 `apps/desktop/README.md`**

```markdown
# @collaborationtool/desktop

> Phase 5 Wave B Spike-1 — Tauri 2.x desktop shell for Collaboration Tool.

## 目的（Spike-1）

验证 Tauri 2 套 Next.js web + 系统集成 + 本地 ollama inline AI 5-7 天交付 3 平台 binary 是否可行。
**不实现** client-first 反转 / vault-fs / sandbox（那些是 Spike-2 / 3 + Phase 6）。

## 本地起步

### 前置

- Rust toolchain（`cargo --version` ≥ 1.75）
- macOS / Linux / Windows host
- Ollama（可选，用于 inline AI 本地推理）：
  - macOS: `brew install ollama && ollama serve && ollama pull llama3.2`
  - Linux: `curl -fsSL https://ollama.com/install.sh | sh`

### 跑 dev

```bash
# Terminal 1
pnpm web:dev      # Next.js on :3000

# Terminal 2
pnpm desktop:dev  # Tauri webview pointing to :3000
```

### Build release（本地）

```bash
pnpm desktop:build
# 产出位置：apps/desktop/src-tauri/target/release/bundle/
```

### Build release（CI）

push tag `desktop-v0.1.0` 触发 `.github/workflows/desktop-release.yml`，4 平台 build 上传到 GitHub Release。

## Spike-1 验收清单

参考 `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8。

## 已知 Spike-1 局限

- Icon 是 8×8 placeholder（Phase 6 W1 替换为品牌资源）
- Updater endpoint 是占位（Phase 6 W2 上线真 release endpoint）
- macOS notarization / Windows code signing 未配（Phase 6 W2 配 cert）
- `.paper` 文件关联 release build 后验证（dev 不触发）
```

- [ ] **Step 2: 修改 `STATUS.md` 顶部**

在 "上次更新" 行后插入新行：

```markdown
上次更新：2026-05-11（claude/spike-1-tauri-shell，**Phase 5 Wave B Spike-1 closeout**）。本分支 12 commits：(s1) apps/desktop pnpm workspace 注册；(s2) Tauri 2 Rust scaffold；(s3) detect_ollama_available Rust command + 3 mockito 单元测试；(s4) apps/web lib/local-ollama.ts + 6 node:test；(s5) lib/desktop-bridge.ts + 5 node:test；(s6) InlineAgentMenu local-AI toggle + 3 node:test + UI Design.md token 100%；(s7) system tray icon + 中英双语 menu；(s8) notifications/deep-link/.paper file association；(s9) Tauri Updater 框架 + minisign 文档；(s10) GitHub Actions 4-matrix desktop-release workflow；(s11) 跨平台 dev smoke test 通过；(s12) README + ADR-0003 review log。**测试基线增量**：apps/desktop +3 Rust test；apps/web +14 node:test。**Spike-1 验收**：3 平台 binary 至少 1 平台 PASS；本地 ollama inline AI 验证 PASS；deep link macOS / Linux PASS。
```

在 §2 ADR 表后追加 Spike-1 一行（如果 §2 是表格，新增行；如果是文本，新增条目）。

- [ ] **Step 3: ADR-0003 review log 追加**

在 `plan0/adr/0003-tech-stack-lockdown.md` 文件末尾追加：

```markdown
## Phase 5 Wave B Spike-1 review log（2026-05-11）

- 加 Tauri 2.x 到 tech stack（desktop shell）
- 加 Rust toolchain 1.75+ 到 build prereq
- 加 reqwest / mockito 到 Rust deps（Ollama HTTP detect）
- 加 GitHub Actions matrix build pipeline（4 platforms）
- minisign keypair 用于 Tauri Updater 签名（私钥放 GitHub Secrets）
- icon / notarization / Windows signing 占位，Phase 6 W2 真补
- **Spike-1 验收通过**：3 平台 binary 至少 1 平台产出；inline AI 本地 ollama 端到端跑通
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/README.md STATUS.md plan0/adr/0003-tech-stack-lockdown.md
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 closeout — docs + ADR-0003 review log + STATUS 更新

apps/desktop/README.md：Spike-1 目的 / 本地起步 / CI release / 已知局限；
ADR-0003 review log Phase 5 Wave B Spike-1 entry（Tauri stack + Rust deps
+ release pipeline + signing 占位）；STATUS 顶行 + Phase 5 表更新。
EOF
)"
```

---

### Task 13: Spike-1 验收 + 决断报告

**Files:**
- Create: `docs/superpowers/reports/2026-05-11-spike-1-report.md`

- [ ] **Step 1: 写 spike-1 完工报告**

```markdown
# Spike-1 完工报告 — Tauri Shell + Local Ollama Inline

> Phase 5 Wave B Spike-1 / 2026-05-11 / branch: claude/spike-1-tauri-shell

## 验收对照（design spec §8）

| 验收项 | 结果 | 备注 |
|---|---|---|
| 3 平台 binary 通过 GitHub Actions | <PASS / FAIL> | 填入实际数量 |
| 套远端 web URL 跑通登录 / 编辑 / 同步 | <PASS / FAIL> | dev 期 localhost:3000 |
| 系统托盘 + 通知 + .paper + deep-link | <PASS / FAIL> | 分平台填 |
| inline AI toggle + ollama 直连 | <PASS / FAIL> | localhost:11434 |
| macOS notarization + Windows signing | DEFERRED → Phase 6 W2 | Spike-1 接受 dev profile |

## Failure mode 命中？

- [ ] webview CJK 排版差异 ≥ 2 Design.md reject criteria → 标 Phase 6 W1 webview font shim
  - 实测结果：填写

## Time 总计

- Plan estimate: 5-7 天
- Actual: <X 天>
- 主要 over/under-run 原因：填写

## 后续

- Spike-2（vault-fs PoC）启动条件：本 Spike PASS 后立即
- Spike-3（plugin runtime 选型）启动条件：与 Spike-2 并行
- Phase 6 W1 desktop 生产化基线：基于本 Spike artifacts
```

- [ ] **Step 2: 填实际数据**

执行者跑完所有 task 后填实际验收数字。空 placeholder 不允许；最差也填 `FAIL + 原因`。

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/reports/2026-05-11-spike-1-report.md
git commit -m "$(cat <<'EOF'
P5(W0): Spike-1 完工报告

design spec §8 验收 5 项填实测结果；failure_mode 检查；time over/under 复盘；
Spike-2 / Spike-3 启动条件 + Phase 6 W1 基线。
EOF
)"
```

---

## Self-Review 结果（执行 plan 时引用）

### Spec coverage
- §8 Spike-1 验收 5 项 → task 11 smoke + task 13 report 覆盖
- §3 system topology 中 desktop 节点 → task 2-9 全覆盖
- §4 components apps/desktop/ → task 1-2 创建
- §5 F2 本地编辑流 (in-memory Y.Doc) → **不在 Spike-1 scope**（明确 out-of-scope）
- §5 F6 agent dispatch 客户端分支 → task 4-6 inline AI 部分覆盖（long-horizon agent client 推 Phase 6 W9-W10）
- §6 E1-E11 错误处理 → 大部分 Phase 6 才落地；Spike-1 只需 deep link / ollama unavailable 容错（task 3/4/5 已覆盖）

### Placeholder scan
- ✓ 所有 step 有代码或精确命令
- ✓ "实现 detect_ollama_available 类似 X" 替换为完整代码
- 占位字段（如 `<org>` GitHub repo name, `REPLACE_WITH_OUTPUT_OF_tauri_signer_generate`）已标注**用户必须替换**

### Type consistency
- `OllamaStatus` (Rust) 与 `OllamaChatResponse` (TS) 是不同 wire shape，**不混淆**
- `safeInvoke<T>` 返回 `T | null`，task 4/5/6 一致
- `toggleLocalAi` 与 `isLocalAiEnabled` 命名对称
- Rust command 名 `detect_ollama_available` 与 TS `safeInvoke('detect_ollama_available')` 完全一致

---

## Phase 5 Wave B 后续 plan

本 plan 只覆盖 **Spike-1**。Spike-2（vault-fs PoC）+ Spike-3（plugin runtime 选型）各自的 implementation plan 等本 Spike PASS 后单独起。流程：

1. Spike-1 task 13 报告 PASS
2. 调用 `superpowers:writing-plans` 起 Spike-2 plan
3. 调用 `superpowers:writing-plans` 起 Spike-3 plan
4. 三 spike 全 PASS → Phase 5 Wave C 起 ADR-0017 / 0018 / 0019

不在本 plan 范围。

---

End of plan
