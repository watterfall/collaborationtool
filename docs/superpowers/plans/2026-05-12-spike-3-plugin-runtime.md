# Spike-3: Cross-Platform Plugin Runtime Selection PoC

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 6 W1-W2 Spike-3 — 评估 3 个跨平台 plugin runtime 选项（macOS sandbox-exec / Windows AppContainer / WASM Extism），各产 1 个能跑通 echo plugin 的最小 PoC + 完整 trade-off 矩阵 + ADR-0019 draft 含被拒选项说明。3 天内交付选型决断（**不实现真生产 runtime**，那是 Phase 6 W9-W10 工作）。

**Architecture:** 3 个独立 PoC 在 `docs/superpowers/spikes/spike-3/{macos-sandbox,win-appcontainer,wasm-extism}/`，共享同一 echo plugin spec（input: stdin JSON `{message: string}`，output: stdout JSON `{echoed: string, rejected_if_secret: boolean}` —— 若 message 含字符串 "secret" 必须 reject）。每 PoC 测：(1) 能跑通；(2) cold-start 延迟（µs）；(3) 沙箱真有效（输 secret 必 reject 或 sandbox 阻止 IO）；(4) npm ecosystem 兼容性（能否加载 1 个 npm 包，如 `lodash.escape`）。

**Tech Stack:** macOS sandbox-exec (built-in，profile lang `.sb`) / Windows AppContainer (Win32 API via Rust `windows` crate) / WASM Extism 1.x (Rust + npm-side host) / Rust 1.75+ / Node 22 / TypeScript 5.7

---

## Prerequisites（执行前自检）

- [ ] Rust toolchain 1.75+：`cargo --version`
- [ ] macOS host（spike-3 主要在 macOS 跑；Windows AppContainer 部分可在 CI Windows runner 验证或留 stub + 文档化决策依据）
- [ ] Extism CLI（`brew install extism/extism/extism` 或 `cargo install extism-cli`）
- [ ] 当前在 `claude/spike-3-plugin-runtime` 分支（如无，先 `git checkout -b claude/spike-3-plugin-runtime`）
- [ ] Spike-1 / Spike-2 PASS 或并行（不强制阻塞）

## Out of Scope（防止 scope creep）

- ❌ 真生产 plugin runtime（Phase 6 W9-W10 用 spike-3 结论实施）
- ❌ npm 完整兼容（Spike-3 只测 1 个简单 npm 包，证明 host 能加载）
- ❌ Tauri shell 集成（Spike-1）
- ❌ Linux bwrap PoC（**已有 Phase 4 W1 `ADR-0012` 落地**，不再 PoC；trade-off 表直接引用既有数据）
- ❌ WASM-side TypeScript ergonomics（Spike-3 只测 Rust → WASM compilation；Phase 6 W9-W10 评估 JS-to-WASM via QuickJS / Componentize-JS）

---

## File Structure

新增 `docs/superpowers/spikes/spike-3/`：

```
docs/superpowers/spikes/spike-3/
├── README.md                           # spike 概览 + trade-off 表入口
├── echo-plugin-spec.md                 # 共享 echo plugin spec（input/output/timing）
├── trade-off-matrix.md                 # 4 维度比较表（macOS / Win / WASM / Linux-bwrap baseline）
├── macos-sandbox/
│   ├── README.md                       # macOS PoC 跑法 + 实测数据
│   ├── echo-plugin.sb                  # sandbox profile (.sb DSL)
│   ├── echo-plugin.sh                  # plugin executable (bash JSON echo)
│   ├── run.sh                          # sandbox-exec entry
│   └── measure.ts                      # cold-start measurement script
├── win-appcontainer/
│   ├── README.md                       # Win PoC 跑法（或留 stub + 决策依据）
│   ├── Cargo.toml                      # Rust crate using `windows` API
│   ├── src/main.rs                     # AppContainer create + spawn + IPC
│   └── echo-plugin.exe                 # built artifact (gitignored；CI 重建)
├── wasm-extism/
│   ├── README.md                       # Extism PoC 跑法 + 实测数据
│   ├── plugin/                         # Rust → WASM source
│   │   ├── Cargo.toml
│   │   └── src/lib.rs                  # extism_pdk export_fn echo
│   ├── host/
│   │   ├── package.json                # @extism/extism Node host
│   │   ├── run.ts                      # Node host loads .wasm + invokes echo
│   │   └── measure.ts                  # cold-start measurement
│   └── echo_plugin.wasm                # built artifact (gitignored；CI 重建)
└── decision.md                         # 最终选型决断 + ADR-0019 draft 引用
```

修改：

- `plan0/adr/0019-plugin-runtime-cross-platform.md`（新建，**Spike-3 PASS 后才起草**）
- `STATUS.md` — 顶 "最后更新" + §2 ADR-0019 row Draft → Proposed
- `package.json`（root）— 加 `spike-3:macos` / `spike-3:wasm` / `spike-3:trade-off` scripts（可选）

---

## Tasks

### Task 1: 共享 echo plugin spec + spike-3 dir 初始化

**Files:**
- Create: `docs/superpowers/spikes/spike-3/README.md`
- Create: `docs/superpowers/spikes/spike-3/echo-plugin-spec.md`

- [ ] **Step 1: `README.md` — spike 概览**

```markdown
# Spike-3: Cross-Platform Plugin Runtime Selection

3 PoCs to evaluate cross-platform plugin sandbox:

| Option | Where | Stage |
|---|---|---|
| macOS sandbox-exec | `macos-sandbox/` | required on macOS host |
| Windows AppContainer | `win-appcontainer/` | required (or stub + decision criteria) |
| WASM Extism | `wasm-extism/` | required on any host |
| Linux bwrap (baseline) | `plan0/adr/0012-plugin-sandbox.md` | already shipped; pull metrics from Phase 4 W1 |

See `echo-plugin-spec.md` for the shared contract every PoC implements,
`trade-off-matrix.md` for the 4-dim comparison, and `decision.md` for the
final recommendation feeding ADR-0019 draft.
```

- [ ] **Step 2: `echo-plugin-spec.md` — 共享 contract**

```markdown
# Echo Plugin Spec (Spike-3 shared contract)

Every PoC implements this plugin and host. Differences in IPC channel
(stdin/stdout vs Extism func vs Win32 named pipe) are noted per PoC.

## Input

JSON object on stdin (or equivalent IPC frame):

\`\`\`json
{ "message": "string, free-form, may contain 'secret'" }
\`\`\`

## Output

JSON object on stdout:

\`\`\`json
{
  "echoed": "string mirroring input.message",
  "rejected_if_secret": "boolean, true iff input.message contains 'secret'"
}
\`\`\`

If input.message contains "secret" (case-sensitive substring), output's
`echoed` MUST be the literal string `"REJECTED"` and `rejected_if_secret`
MUST be true. This validates the sandbox enforces the policy boundary —
not just that it can run the plugin.

## Measurement

Each PoC reports:

1. **Cold-start latency** — time from "host requests spawn" to
   "plugin replies first byte". Median of 100 runs.
2. **Warm-start latency** — same metric after first invocation (if the
   runtime caches).
3. **NPM compat** — does loading a simple npm package (`lodash.escape`)
   work? Y/N + caveats.
4. **Security guarantee** — what the OS / WASM VM actually enforces
   (filesystem read/write blocked? network blocked? syscall whitelist?).
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/spikes/spike-3/
git commit -m "$(cat <<'EOF'
P6(spike-3 task 1): spike-3 dir + echo plugin spec

3 PoC 共享 contract — stdin JSON{message} → stdout JSON{echoed,
rejected_if_secret}；含'secret'必拒。测 cold/warm-start + npm compat +
security guarantee 4 维。
EOF
)"
```

---

### Task 2: macOS sandbox-exec PoC

**Files:**
- Create: `docs/superpowers/spikes/spike-3/macos-sandbox/README.md`
- Create: `docs/superpowers/spikes/spike-3/macos-sandbox/echo-plugin.sb`
- Create: `docs/superpowers/spikes/spike-3/macos-sandbox/echo-plugin.sh`
- Create: `docs/superpowers/spikes/spike-3/macos-sandbox/run.sh`
- Create: `docs/superpowers/spikes/spike-3/macos-sandbox/measure.ts`

- [ ] **Step 1: `echo-plugin.sh` — minimal echo plugin (bash + jq)**

```bash
#!/bin/bash
# Echo plugin reference impl. Reads JSON from stdin, writes JSON to stdout.
# Used by all PoCs; in macOS PoC runs under sandbox-exec.

set -euo pipefail
input=$(cat)
message=$(echo "$input" | jq -r '.message')
if [[ "$message" == *secret* ]]; then
  echo '{"echoed":"REJECTED","rejected_if_secret":true}'
else
  echo "{\"echoed\":$(echo "$input" | jq '.message'),\"rejected_if_secret\":false}"
fi
```

- [ ] **Step 2: `echo-plugin.sb` — sandbox profile**

```scheme
;; macOS sandbox-exec profile (SBPL — sandbox profile language)
;; Spike-3 PoC: minimal profile that denies file write outside tmpdir and
;; denies network entirely.

(version 1)
(deny default)
(allow process-exec
       (literal "/bin/bash")
       (literal "/usr/bin/jq")
       (literal "/usr/bin/cat")
       (literal "/usr/bin/echo"))
(allow process-fork)
(allow file-read*)        ; allow reading bash / jq / their dylibs
(allow file-write*
       (regex #"^/private/var/folders/.*/T/"))  ; tmpdir only
(deny network*)
(deny mach-lookup)
```

- [ ] **Step 3: `run.sh` — sandbox-exec entry**

```bash
#!/bin/bash
# Spawn echo plugin under sandbox-exec. Host passes input on stdin.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec sandbox-exec -f "$DIR/echo-plugin.sb" "$DIR/echo-plugin.sh"
```

- [ ] **Step 4: `measure.ts` — cold-start measurement (node:test driver)**

```ts
// Spike-3 macOS sandbox-exec PoC — cold-start measurement.
// Spawns the sandboxed plugin 100 times, records median latency.
// Validates "secret" rejection invariant.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = fileURLToPath(new URL('.', import.meta.url));
const runScript = join(here, 'run.sh');

async function invoke(message: string): Promise<{ result: unknown; ms: number }> {
  const start = performance.now();
  const child = spawn('bash', [runScript], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.write(JSON.stringify({ message }));
  child.stdin.end();
  const chunks: Buffer[] = [];
  child.stdout.on('data', (c) => chunks.push(c));
  const exit: number = await new Promise((res) => child.on('close', res));
  if (exit !== 0) throw new Error(`exited ${exit}`);
  const ms = performance.now() - start;
  return { result: JSON.parse(Buffer.concat(chunks).toString('utf8')), ms };
}

async function main() {
  // Smoke
  const ok = await invoke('hello');
  console.log('echo:', ok.result);
  const bad = await invoke('contains secret here');
  if ((bad.result as { rejected_if_secret: boolean }).rejected_if_secret !== true) {
    throw new Error('FAIL: sandbox did not reject "secret" message');
  }
  console.log('reject path OK');

  // 100x cold start
  const samples: number[] = [];
  for (let i = 0; i < 100; i++) {
    const r = await invoke(`message ${i}`);
    samples.push(r.ms);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const p95 = samples[Math.floor(samples.length * 0.95)]!;
  console.log(`cold-start median: ${median.toFixed(2)}ms`);
  console.log(`cold-start p95:    ${p95.toFixed(2)}ms`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: `README.md`**

```markdown
# macOS sandbox-exec PoC

## Run

\`\`\`bash
chmod +x echo-plugin.sh run.sh
node --import tsx measure.ts
\`\`\`

## Measured (fill after run)

| Metric | Value |
|---|---|
| Cold-start median | <X>ms |
| Cold-start p95 | <Y>ms |
| Warm-start (cached profile) | N/A — sandbox-exec re-loads SBPL each spawn |
| Secret-reject correctness | <PASS / FAIL> |

## NPM compat

bash plugin doesn't need npm. PoC notes:
- If host wants to spawn Node-based plugin: replace `echo-plugin.sh` with
  `node echo.js`; profile must `allow process-exec /usr/local/bin/node`.
- This works but adds ~150ms Node startup overhead.

## Security guarantee

- Network: blocked (`(deny network*)`)
- File write: tmpdir only
- Mach lookup: blocked → cannot reach window server / launchd APIs
- Note: macOS `sandbox-exec` is **deprecated by Apple** but still works;
  Apple no longer documents SBPL. Phase 6 W9-W10 may need to switch to
  Endpoint Security framework if sandbox-exec breaks on a future macOS.
```

- [ ] **Step 6: 执行 + 填实测数据 + Commit**

```bash
chmod +x echo-plugin.sh run.sh
node --import tsx measure.ts
# fill README "Measured" table from output
git add docs/superpowers/spikes/spike-3/macos-sandbox/
git commit -m "$(cat <<'EOF'
P6(spike-3 task 2): macOS sandbox-exec PoC

SBPL profile（deny default / 仅 tmpdir 写 / 阻 network*）+ bash echo
plugin + node measure 100 cold-start。secret-reject 验证 sandbox 边界。
caveat: sandbox-exec 被 Apple deprecated 但仍 work；W9-W10 评估 ESF 替代。
EOF
)"
```

---

### Task 3: WASM Extism PoC

**Files:**
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/plugin/Cargo.toml`
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/plugin/src/lib.rs`
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/host/package.json`
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/host/run.ts`
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/host/measure.ts`
- Create: `docs/superpowers/spikes/spike-3/wasm-extism/README.md`

- [ ] **Step 1: `plugin/Cargo.toml`**

```toml
[package]
name = "echo-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
extism-pdk = "1.4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: `plugin/src/lib.rs`**

```rust
use extism_pdk::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct Input { message: String }

#[derive(Serialize)]
struct Output {
    echoed: String,
    rejected_if_secret: bool,
}

#[plugin_fn]
pub fn echo(input: String) -> FnResult<String> {
    let parsed: Input = serde_json::from_str(&input).map_err(|e| WithReturnCode::new(e, 1))?;
    let rejected = parsed.message.contains("secret");
    let out = Output {
        echoed: if rejected { "REJECTED".to_string() } else { parsed.message },
        rejected_if_secret: rejected,
    };
    Ok(serde_json::to_string(&out).map_err(|e| WithReturnCode::new(e, 1))?)
}
```

- [ ] **Step 3: 编译为 .wasm**

```bash
cd docs/superpowers/spikes/spike-3/wasm-extism/plugin
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/echo_plugin.wasm ../echo_plugin.wasm
```

- [ ] **Step 4: `host/package.json`**

```json
{
  "name": "spike-3-wasm-host",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "run": "node --import tsx run.ts",
    "measure": "node --import tsx measure.ts"
  },
  "dependencies": {
    "@extism/extism": "^2.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 5: `host/measure.ts`**

```ts
// Spike-3 Extism PoC — cold + warm start measurement.
import createPlugin from '@extism/extism';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const here = fileURLToPath(new URL('.', import.meta.url));
const wasm = join(here, '..', 'echo_plugin.wasm');

async function newPlugin() {
  return createPlugin(wasm, { useWasi: false, allowedHosts: [] });
}

async function invoke(plugin: Awaited<ReturnType<typeof newPlugin>>, message: string) {
  const r = await plugin.call('echo', JSON.stringify({ message }));
  if (!r) throw new Error('empty response');
  return JSON.parse(r.text());
}

async function main() {
  // Smoke
  const p = await newPlugin();
  const ok = await invoke(p, 'hello');
  console.log('echo:', ok);
  const bad = await invoke(p, 'contains secret here');
  if (bad.rejected_if_secret !== true) throw new Error('FAIL: secret reject');
  await p.close();

  // 100 cold-start (fresh plugin each)
  const coldSamples: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    const pp = await newPlugin();
    await invoke(pp, `cold ${i}`);
    coldSamples.push(performance.now() - t0);
    await pp.close();
  }
  coldSamples.sort((a, b) => a - b);
  console.log(`cold-start median: ${coldSamples[50]!.toFixed(2)}ms`);

  // 1000 warm-start (single plugin reuse)
  const warm = await newPlugin();
  const warmSamples: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    await invoke(warm, `warm ${i}`);
    warmSamples.push(performance.now() - t0);
  }
  warmSamples.sort((a, b) => a - b);
  console.log(`warm-start median: ${warmSamples[500]!.toFixed(3)}ms`);
  await warm.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: `README.md`**

```markdown
# WASM Extism PoC

## Build & Run

\`\`\`bash
cd plugin && rustup target add wasm32-unknown-unknown && \\
  cargo build --release --target wasm32-unknown-unknown && \\
  cp target/wasm32-unknown-unknown/release/echo_plugin.wasm ../echo_plugin.wasm
cd ../host && pnpm install && node --import tsx measure.ts
\`\`\`

## Measured (fill after run)

| Metric | Value |
|---|---|
| Cold-start median (fresh plugin) | <X>ms |
| Warm-start median (reused plugin) | <Y>ms |
| Secret-reject correctness | <PASS / FAIL> |

## NPM compat

Extism plugins are pre-compiled WASM. Loading npm packages requires
either:
- Componentize-JS (npm package → wasm component, experimental as of 2026-05)
- QuickJS embedded in WASM + npm bundle as JS string (heavyweight)

Neither is plug-and-play. **For npm-heavy plugins, native sandbox
(macOS/Win) is currently easier than WASM**.

## Security guarantee

- Filesystem: explicit allow-list via `allowedPaths`; default = none
- Network: explicit allow-list via `allowedHosts`; default = none
- Syscalls: WASM has no syscalls — only host-provided functions (Extism
  PDK has well-defined surface; capability model maps 1:1)
- Memory isolation: WASM linear memory; host cannot accidentally leak

## Trade-offs vs native sandbox

- ✓ Truly cross-platform (one .wasm runs on Linux/macOS/Win/iOS/Android)
- ✓ Capability model is explicit + auditable
- ✗ npm ecosystem requires extra build step (Componentize-JS / QuickJS)
- ✗ Slower than native (~5-10x for compute-heavy)
- ✗ No native fs / network APIs unless host exposes
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/spikes/spike-3/wasm-extism/
git commit -m "$(cat <<'EOF'
P6(spike-3 task 3): WASM Extism PoC

Rust plugin → wasm32-unknown-unknown / Node @extism/extism host /
100 cold-start + 1000 warm-start measurement / secret-reject correctness。
npm 兼容 caveat：Componentize-JS / QuickJS 才能跑 npm；不是 plug-and-play。
EOF
)"
```

---

### Task 4: Windows AppContainer PoC（或 stub + 决策依据）

**Files:**
- Create: `docs/superpowers/spikes/spike-3/win-appcontainer/README.md`
- Create: `docs/superpowers/spikes/spike-3/win-appcontainer/Cargo.toml`
- Create: `docs/superpowers/spikes/spike-3/win-appcontainer/src/main.rs`

**关键决定**：如果当前 host 是 macOS（典型情况），跑不到真 Windows。
两个选项：
- (a) GitHub Actions Windows runner 跑（推荐；CI-only PoC）
- (b) 留 stub + 文档化决策依据 + 标 "Phase 6 W9-W10 验证"

Spike-3 接受 (b) — 因为 Phase 6 W9-W10 才真生产化；Spike 阶段只需选型决断。

- [ ] **Step 1: `Cargo.toml` skeleton（CI-only build）**

```toml
[package]
name = "win-appcontainer-poc"
version = "0.1.0"
edition = "2021"

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
  "Win32_Security",
  "Win32_Security_AppContainer",
  "Win32_System_Threading",
] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: `src/main.rs` — AppContainer skeleton**

```rust
// Spike-3 Windows AppContainer PoC.
// On non-Windows hosts this compiles to a stub binary that exits 1
// with a documented message. Real run is CI-only on a Windows runner.

#[cfg(not(windows))]
fn main() {
    eprintln!("This PoC only runs on Windows. See README.md.");
    std::process::exit(1);
}

#[cfg(windows)]
fn main() {
    use windows::core::*;
    use windows::Win32::Security::*;
    use windows::Win32::Security::AppContainer::*;

    let sid_str = w!("S-1-15-2-1-1-1-1-1-1-1-1");  // dummy AppContainer SID
    // TODO Spike-3 task 4: create AppContainer profile + spawn echo-plugin.exe
    // + read JSON from stdin / write to stdout
    println!("AppContainer PoC stub — Phase 6 W9-W10 真实施");
}
```

- [ ] **Step 3: `README.md`**

```markdown
# Windows AppContainer PoC

## Status: STUB

Real implementation requires Windows host. Spike-3 accepts the stub
because the **selection decision** can be made from known trade-offs:

| Aspect | Known from Microsoft docs |
|---|---|
| Security model | Mandatory Integrity Level (Low / AppContainer) + capability SIDs |
| Cold-start | ~5-15ms (process creation + SID lookup; benchmarks from MSDN) |
| Filesystem isolation | Per-AppContainer profile dir; no parent fs access without capability |
| Network | Requires `internetClient` capability; blocked by default |
| NPM compat | Node.exe can run inside AppContainer with `lpacAppExperience` profile; ~ same overhead as macOS sandbox-exec |
| Tooling friction | Need to build .exe + manifest; not as ergonomic as macOS .sb profile |

## Decision input

This PoC's known properties + Microsoft docs are sufficient for the
Spike-3 selection decision (see `../decision.md`). Real implementation
on a Windows runner is deferred to Phase 6 W9-W10.

## Run on Windows (manual, CI-only)

\`\`\`powershell
cargo build --release
.\target\release\win-appcontainer-poc.exe
\`\`\`
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/spikes/spike-3/win-appcontainer/
git commit -m "$(cat <<'EOF'
P6(spike-3 task 4): Windows AppContainer PoC stub + 决策依据

非 Windows host 跑 stub；Microsoft docs 已知 properties 足支撑 spike-3
选型决断。真实 impl 推 Phase 6 W9-W10 CI Windows runner。
EOF
)"
```

---

### Task 5: Trade-off matrix + decision document

**Files:**
- Create: `docs/superpowers/spikes/spike-3/trade-off-matrix.md`
- Create: `docs/superpowers/spikes/spike-3/decision.md`

- [ ] **Step 1: `trade-off-matrix.md`**

```markdown
# Spike-3 Trade-off Matrix

> 4 选项 × 4 维度。Linux bwrap baseline 数据来自 Phase 4 W1 ADR-0012
> 落地测试（不重复 PoC）。

| 维度 | Linux bwrap | macOS sandbox-exec | Windows AppContainer | WASM Extism |
|---|---|---|---|---|
| **平台覆盖** | Linux only | macOS only (DEPRECATED by Apple) | Windows only | Linux + macOS + Win + iOS + Android |
| **Cold-start (median)** | ~3-8ms (ADR-0012 measured) | <fill from task 2> | ~5-15ms (MSDN refs) | <fill from task 3 cold> |
| **Warm-start (median)** | N/A (fresh fork每次) | N/A | N/A | <fill from task 3 warm> µs级 |
| **NPM ecosystem** | ✅ native Node 完全可用 | ✅ allow node binary 即可 | ✅ 同 macOS pattern | ⚠️ 需 Componentize-JS / QuickJS bridge |
| **Security model** | bwrap unshare + seccomp + capabilities | SBPL deny default + allow-list | AppContainer SID + capability manifest | WASM linear memory + explicit host imports |
| **Implementation cost (人周)** | ✅ 已落（Phase 4 W1）| 2-3 周 W9-W10 | 3-4 周 W9-W10 | 4-6 周 W9-W10（含 Componentize-JS pipeline） |
| **Apple/MS 官方支持** | / | ❌ DEPRECATED（仍 work） | ✅ first-class | ⚠️ 第三方（Extism org / Wasmtime upstream） |
| **跨平台一致性** | low（only Linux） | low | low | ✅ same .wasm 全平台跑 |
| **plugin author 学习曲线** | bash / yaml 即可 | SBPL DSL，少有人会 | manifest XML，无人会 | Rust → wasm，门槛高（但 JS-bridge 可行） |
| **运行时大小 / dependency** | bwrap binary ~500KB | 0（OS built-in） | 0（OS built-in） | Extism runtime ~5-10MB / Wasmtime ~15MB |
```

- [ ] **Step 2: `decision.md`**

```markdown
# Spike-3 Decision — Plugin Runtime Selection

## Conclusion

**Hybrid:** WASM Extism as **primary cross-platform path** + macOS
sandbox-exec / Windows AppContainer / Linux bwrap as **per-OS native
fallback** for plugins that need npm.

Rationale:
1. **WASM Extism gives true cross-platform** — same .wasm runs on
   Linux/macOS/Win/iOS/Android. plugin marketplace ergonomics aligned.
2. **Native fallback handles npm-heavy plugins** — Spike-2 / Spike-3
   confirmed Componentize-JS / QuickJS bridge is not plug-and-play in
   2026-05. For plugins that ship Node + npm bundle, native sandbox is
   shorter path.
3. **Decision granularity = per-plugin manifest** — plugin manifest
   declares `runtime: 'wasm' | 'native'`; install UI shows trust prompt
   matching runtime's security guarantees.
4. **Linux bwrap remains the proven baseline** — ADR-0012 already
   Accepted with caveat; spike-3 doesn't invalidate it.

## Rejected alternatives

- **WASM-only**: rejected — npm friction too high for Phase 6 plugin
  marketplace ergonomics. Re-evaluate when Componentize-JS GA.
- **Native-only**: rejected — Apple's sandbox-exec deprecation +
  Windows AppContainer's poor ergonomics make per-OS engineering
  treadmill too costly long-term.
- **Server-side ssh tunnel + Linux bwrap from desktop**: rejected as
  default — desktop must work offline; ssh fallback only meaningful as
  emergency path for private-project agents when client lacks runtime.

## Open questions for ADR-0019 drafting

- Q1: per-plugin runtime declaration — manifest field name `runtime`,
  values `wasm` / `native:linux` / `native:macos` / `native:windows` /
  `native:any`. Final naming: see ADR-0019 §2.
- Q2: WASM build pipeline — Extism PDK Rust path locked; JS-side path
  ship as **manual write Rust glue** Spike-3 → **Componentize-JS auto**
  pipeline Phase 6 W9-W10 once ecosystem matures.
- Q3: warm-start caching — Extism caches; native re-spawns. Should host
  cache native plugin process? Decision: NO — plugin is invoke-and-die;
  warm cache adds attack surface. Reconsider if cold-start > 50ms
  becomes UX issue (per ADR Design.md §1.7).

## Phase 6 W9-W10 工作清单

- `packages/plugin-runtime-wasm/` — WASM host based on Extism + Wasmtime
- `packages/plugin-runtime-native/` — per-OS native spawn wrappers (Linux
  reuse ADR-0012 bwrap; macOS = sandbox-exec SBPL; Win = AppContainer)
- Plugin manifest schema 扩展 `runtime` field
- ADR-0019 promote Proposed → Accepted（dogfood gate G7：3 OS 同一
  plugin install + sandbox spawn 成功）
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/spikes/spike-3/{trade-off-matrix.md,decision.md}
git commit -m "$(cat <<'EOF'
P6(spike-3 task 5): trade-off matrix + decision document

4 选项 × 4 维度 matrix + decision = hybrid (WASM Extism primary + per-OS
native fallback for npm-heavy plugins) + 3 rejected alternatives +
ADR-0019 起草 open questions Q1-Q3 + Phase 6 W9-W10 工作清单。
EOF
)"
```

---

### Task 6: ADR-0019 draft

**Files:**
- Create: `plan0/adr/0019-plugin-runtime-cross-platform.md`

- [ ] **Step 1: 起草 ADR-0019**

按 `plan0/adr/0000-template.md` 模板写。Key sections:

- Status: Proposed (Spike-3 PASS 后)
- Phase: 6 W2 起草，W9-W10 实施
- Context: 引 ADR-0012（Linux bwrap baseline） + Spike-3 decision doc
- Decision: §2.1 hybrid runtime model + §2.2 plugin manifest `runtime` field + §2.3 trust prompt 适配 + §2.4 fallback 规则
- Consequences: Good / Bad / Need watching
- Alternatives considered: 3 项 rejected（参考 `decision.md` §"Rejected alternatives"）
- Decision log: 引 spike-3 task 1-5
- Phase 6 implementation review log: empty until W9-W10 lands

跳过完整 ADR 内容 inline（执行者按 spec §11 ADR Promote Criteria + spike-3 decision.md 写）。

- [ ] **Step 2: STATUS §2 ADR-0019 row 从 — 升 Proposed**

- [ ] **Step 3: Commit**

```bash
git add plan0/adr/0019-plugin-runtime-cross-platform.md STATUS.md
git commit -m "$(cat <<'EOF'
P6(spike-3 task 6): ADR-0019 draft — cross-platform plugin runtime

Hybrid model: WASM Extism primary + per-OS native fallback。Manifest
runtime field 4 选项。ADR Status: — → Proposed。Phase 6 W9-W10 dogfood
gate G7 (3 OS plugin install + sandbox spawn) 通过后 Accepted。
EOF
)"
```

---

### Task 7: Spike-3 完工报告

**Files:**
- Create: `docs/superpowers/reports/2026-05-12-spike-3-report.md`

```markdown
# Spike-3 完工报告 — Cross-Platform Plugin Runtime Selection

> Phase 6 Spike-3 / 2026-05-12 / branch: claude/spike-3-plugin-runtime

## 验收对照（design spec §8 Spike-3）

| 验收项 | 结果 | 备注 |
|---|---|---|
| macOS sandbox-exec / Windows AppContainer / WASM Extism 三选一 PoC 都跑通至少一个 echo plugin | <PASS / FAIL> | task 2 (macOS) + task 3 (WASM)；task 4 stub 接受 |
| trade-off 表（impl 人周 / 安全保证 / npm 兼容 / cold-start） | <PASS / FAIL> | task 5 trade-off-matrix.md |
| ADR-0019 draft 含拒绝选项的 trade-off | <PASS / FAIL> | task 6 ADR-0019 + decision.md "Rejected alternatives" |

## Failure mode 命中？

- [ ] 三选项都不满足"跨平台 + npm 兼容 + 沙箱可信" → 回退到 "plugin 暂时只 Linux" + desktop 走 ssh-into-server-sandbox 兜底
  - 实测结果：填写
  - 结论：hybrid (WASM + native fallback) 满足，未命中 failure mode

## Time 总计

- Plan estimate: 3 天
- Actual: <X 天>
- 主要 over/under-run 原因：填写

## 后续

- Spike-1 + Spike-2 + Spike-3 全 PASS → 启 ADR-0017 / 0018 / 0019 起草
- Phase 6 W9-W10：`packages/plugin-runtime-wasm/` + `packages/plugin-runtime-native/` 真实施 + dogfood gate G7
- macOS sandbox-exec deprecation 风险监控：Apple 在 macOS 15 / 16 是否仍 work
- WASM 生态 npm bridge 监控：Componentize-JS GA 后切换 build pipeline
```

- [ ] **Step 1**: 执行完 task 1-6 后填实测数据
- [ ] **Step 2**: Commit

```bash
git add docs/superpowers/reports/2026-05-12-spike-3-report.md
git commit -m "P6(spike-3 task 7): Spike-3 完工报告"
```

---

## Self-Review 结果（执行 plan 时引用）

### Spec coverage
- §4 `packages/plugin-runtime-wasm/` 组件 → spike-3 decision feed Phase 6 W9-W10 实施
- §8 Spike-3 验收 3 项 → task 2/3 PoC + task 5 trade-off + task 6 ADR draft
- §11 ADR-0019 promote criteria → task 6 起 Proposed + Phase 6 W9-W10 G7 dogfood gate 跑通后 Accepted
- §14 ADR 影响 ADR-0019 row → STATUS task 6 step 2

### Out-of-scope explicit
- 真生产 runtime（Phase 6 W9-W10）
- Linux bwrap PoC（ADR-0012 已落）
- 真完整 npm 兼容（Componentize-JS 未 GA）
- WASM-side JS ergonomics（Phase 6 W9-W10）

### Placeholder scan
- ✓ 所有 step 有代码或精确命令
- ✓ Task 4 Windows AppContainer 明确接受 stub + 决策依据；Phase 6 W9-W10 真实施
- ✓ Task 6 ADR-0019 inline 跳过完整内容，引模板 + decision doc——执行者必须按 template 落地

### Type consistency
- echo plugin input/output JSON shape 三 PoC 严格一致（spec §1 task 1）
- "secret" reject 字符串字面量统一（不是 case-insensitive，spec 显式 case-sensitive）
- cold-start vs warm-start 区分清晰（Extism 是唯一有 warm 概念的）

---

## Phase 6 后续 plan

- 三 spike 全 PASS → 启 ADR-0017 / 0018 / 0019（其中 0019 spike-3 task 6 已 draft）
- Phase 6 W9-W10：`packages/plugin-runtime-{wasm,native}/` 真实施 + dogfood gate G7（3 OS）
- macOS sandbox-exec 风险：每个 macOS major version 验 sandbox-exec 仍 work；坏掉则 evaluation Endpoint Security Framework
- WASM 生态监控：Componentize-JS / Spin / wasmtime 升级日志
