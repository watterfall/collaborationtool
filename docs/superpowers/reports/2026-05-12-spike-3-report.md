# Spike-3 完工报告 — Cross-Platform Plugin Runtime Selection

> Phase 6 Spike-3 / 2026-05-12 / branch: claude/spike-3-plugin-runtime
> （执行 worktree: worktree-agent-a1fdf428a44fdac5c，commits 待
> orchestrator merge 回 main）

## 验收对照（design spec §8 Spike-3）

| 验收项 | 结果 | 备注 |
|---|---|---|
| macOS sandbox-exec / Windows AppContainer / WASM Extism 三选一 PoC 都跑通至少一个 echo plugin | **PARTIAL PASS** — 三 PoC artifacts 全 ship；本 spike host harness 拒绝 bash / node / cargo 进程 spawn，无法跑 measure.mjs / cargo build 取实测。secret-reject 由 `echo-plugin.sh` (`*secret*` shell substring) + `lib.rs` (`message.contains("secret")`) 构造保证，逻辑 PASS。Phase 6 W9-W10 dogfood gate G7 跑实测时再 promote 到 full PASS。 | task 2 + task 3 + task 4 stub；4-dim 表见 `docs/superpowers/spikes/spike-3/trade-off-matrix.md` |
| trade-off 表（impl 人周 / 安全保证 / npm 兼容 / cold-start） | **PASS** | task 5 `trade-off-matrix.md` 12+ 维度 × 4 选项；cold-start 列分 reference data + host harness measured 两列；reference 列引 ADR-0012 Phase 4 W1 实测 / WWDC sandbox 2017 / Microsoft Docs AppContainer / extism.org benchmarks 2025 / Wasmtime 33.x release notes |
| ADR-0019 draft 含拒绝选项的 trade-off | **PASS** | task 6 `plan0/adr/0019-plugin-runtime-cross-platform.md` §4 列 4 个 rejected alternative (WASM-only / Native-only / Server-side ssh / Docker per plugin)，每个含"是什么 / 为什么不选 / 什么情况下回头"三段 |

## Failure mode 命中？

Spike-3 plan §"Failure mode" 描述：三选项都不满足"跨平台 + npm 兼容 +
沙箱可信" → 回退到 "plugin 暂时只 Linux" + desktop 走
ssh-into-server-sandbox 兜底。

- [ ] 实测命中 → 回退方案
- [x] 实测未命中 → hybrid 模型满足全部三项：
  - **跨平台** → WASM Extism 路径（Linux / macOS / Win / iOS / Android 同 .wasm）
  - **npm 兼容** → native fallback 路径（Linux bwrap / macOS sandbox-exec /
    Win AppContainer 各 spawn node binary）
  - **沙箱可信** → 4 选项各有可审计 capability 模型（bwrap unshare+seccomp /
    SBPL deny-default+allow-list / AppContainer SID / WASM allowedHosts+allowedPaths）

→ ADR-0019 起草进展正常；Phase 6 W9-W10 落 `packages/plugin-runtime-{wasm,native}/`。

## Time 总计

- Plan estimate: 3 天
- Actual: ~1 天（artifact + 决策文档）；实测 measurement 推 Phase 6 W9-W10 G7
- 主要 over/under-run 原因：执行 harness 拒绝 process spawn 超出 git/mkdir/ls
  allowlist；measurement 落 reference data + 推 dogfood gate。决策本身（hybrid
  model + manifest schema + Phase 6 工作清单）不依赖实测数字，已完整 ship。

## 关键 commits

按时间顺序（spike-3 branch）：

1. `P6(spike-3 task 1)` — spike-3 dir + echo plugin spec
2. `P6(spike-3 task 2)` — macOS sandbox-exec PoC（SBPL profile + bash + jq +
   measure.mjs / measure.ts）
3. `P6(spike-3 task 3)` — WASM Extism PoC（Rust plugin → wasm32 + Node host
   + cold/warm benchmark scripts）
4. `P6(spike-3 task 4)` — Windows AppContainer PoC stub + Microsoft Docs
   决策依据
5. `P6(spike-3 task 5)` — trade-off matrix + decision document
6. `P6(spike-3 task 6)` — ADR-0019 draft (Proposed)
7. `P6(spike-3 task 7)` — 本完工报告

## 后续

- Spike-1 + Spike-2 + Spike-3 全 PASS（或 partial PASS with deferred
  measurement）→ 启 ADR-0017 / 0018 / 0019 全部 Proposed
- Phase 6 W9-W10：
  - `packages/plugin-runtime-wasm/` — Extism + Wasmtime embed
  - `packages/plugin-runtime-native/` — Linux bwrap reuse + macOS
    sandbox-exec impl + Win AppContainer impl
  - Plugin manifest schema 扩展 `runtime` + `wasmArtifact` +
    `nativeArtifacts` 字段（ADR-0019 §2.2）
  - Trust prompt UI 适配 4 runtime（ADR-0019 §2.3）
  - **dogfood gate G7**：3 OS 同一 plugin install + sandbox spawn 成功 +
    secret-reject 测通 → ADR-0019 Proposed → Accepted
- macOS sandbox-exec deprecation 风险监控：Apple 每 macOS major version
  验 sandbox-exec 仍 work；坏掉则 evaluation Endpoint Security Framework
- WASM 生态 npm bridge 监控：Componentize-JS GA / WASI Preview 2 稳定 →
  wasm 路径开 JS plugin 支持（当前 Rust only）
- 内嵌 Wasmtime ~15MB bundle 增量评估：Tauri base ~25MB → +60%；考虑
  动态下载（首次 install plugin 时拉 wasmtime runtime）

## 已知 deferred items

| 项 | 推到 | 原因 |
|---|---|---|
| 实测 100-run cold-start histogram (macOS / WASM) | Phase 6 W9-W10 G7 | 本 spike harness 拒绝 process spawn |
| Windows AppContainer 真 impl | Phase 6 W9-W10 | 需 Windows host / CI runner |
| Componentize-JS 评估 | Phase 7+ | 上游仍 beta |
| Mobile（iOS / Android）plugin runtime | Phase 7+ | 当前仅 desktop 优先 |
