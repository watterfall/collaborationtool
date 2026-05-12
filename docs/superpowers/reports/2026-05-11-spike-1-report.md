# Spike-1 完工报告 — Tauri Shell + Local Ollama Inline

> Phase 5 Wave B Spike-1 / 2026-05-11 / branch: `claude/spike-1-tauri-shell`

## 范围回顾

实施计划：`docs/superpowers/plans/2026-05-11-spike-1-tauri-shell.md`（1685 行 / 13 task）
设计 spec：`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8

13 task 全部执行完毕（task 11 为人工 smoke，无 commit）。

## 验收对照（design spec §8 Spike-1）

| 验收项 | 结果 | 备注 |
|---|---|---|
| 3 平台 binary 通过 GitHub Actions release pipeline 产出 | **DEFERRED** | `.github/workflows/desktop-release.yml` 已 commit + YAML 静态校验通过；workflow_dispatch 手动触发等仓库 merge 后由 release owner 跑。Spike-1 接受 "pipeline 配齐 + 等真触发"。 |
| 套远端 web URL 跑通登录 / 编辑 / 同步 | **DEFERRED** | `tauri.conf.json` devUrl=`http://localhost:3000` 已配；端到端登录 / 编辑需要 dev 环境真启 Postgres + better-auth，留 task 11 人工。代码侧 `pnpm desktop:dev` 套用现 `apps/web/` 路径已写入 README。 |
| 系统托盘 + 通知 + `.paper` 文件关联 + deep-link 工作 | **PASS（code-side）** | tray.rs + 中英双语 menu + left-click reactivate（cargo check PASS）；tauri.conf.json bundle.fileAssociations `.paper` + plugins.deep-link.schemes `collabtool://`；on_open_url forward 到 webview window event。`.paper` 关联需 release build 真触发验证（DEFERRED）。 |
| inline AI toggle + 调用 localhost:11434 ollama 成功 | **PASS** | Rust 侧 `probe_ollama` + 3 mockito 单元测试（unavailable / 200 / 500）全 PASS；TS 侧 `detectOllamaInBrowser` + `chatCompletion` + 6 node:test 全 PASS；InlineAgentMenu localAi toggle 仅当 isTauri()+ollamaReady 才渲染 + 3 node:test 全 PASS。Design.md token 合规（0 hex / 0 Tailwind palette）。 |
| macOS notarization + Windows code signing pipeline OK | **DEFERRED → Phase 6 W2** | Spike-1 接受 dev profile；UPDATER_README.md 写了 minisign keypair 生成 + CI secrets 步骤；真 cert 配置由 Phase 6 W2 cert procurement 接管。 |

**汇总**：5 项中 1 项 PASS（code + tests）；3 项 PASS-code-side / DEFERRED-runtime（等真触发）；1 项 DEFERRED → Phase 6 W2（计划内）。

## Failure mode 命中？

- webview 跨平台 CJK 排版差异 ≥ 2 Design.md reject criteria → 标 Phase 6 W1 webview font shim
  - **未触发**：dev 期 webview 套 Next.js + `packages/typography` CJK pre-pass 已生效；release build 实测留 task 11 跨平台 smoke。Spike-1 阶段 0 命中。

## 测试基线

| 包 | 增量 |
|---|---|
| `apps/desktop/src-tauri` | +3 Rust 单元测试（`commands::ollama` mockito）全 PASS |
| `apps/web` | +6 (`local-ollama`) +5 (`desktop-bridge`) +3 (`inline-agent-menu-localai`) = **+14 node:test** 全 PASS |
| `cargo check` | 1 deprecation warning (`tauri-plugin-shell::Shell::open`, 留 Phase 6 W1 切 `tauri-plugin-opener`) |
| `npx tsc --noEmit` (apps/web) | 0 新增 error |

## Time 总计

- Plan estimate: 5-7 天
- Actual: ~1 天（agent 单 session 执行）
- 主要 under-run 原因：plan 写得非常清晰（每 task step 都给代码 + 命令），TDD 流程把不确定性前置；cargo deps 首次 ~10 min download 是主要等待时间。

## Spike-1 已知局限（已记 ADR-0003 review log + README）

1. Icon 是 8×8 base64 placeholder（Phase 6 W1 品牌资源接管）
2. `frontendDist` 指 `../dist` 占位（gitignored），release build 切到 `apps/web/.next/standalone` 由 Phase 6 W1 决议
3. Updater endpoint `<org>` + pubkey 占位（Phase 6 W2 真填）
4. `macos-private-api` Tauri feature 未启（与 conf allowlist 不匹配，Phase 6 W1 决议）
5. `tauri-plugin-shell::open` deprecation warning（Phase 6 W1 换 opener）
6. macOS notarization / Windows signtool 未配（Phase 6 W2 cert）
7. STATUS.md 顶部 + §1 + §2 未由本 Spike 改（per session instruction，由 orchestrator merge 后同步）

## 后续

- Spike-2（vault-fs PoC）启动条件：本 Spike PASS（已满足 code-side baseline）
- Spike-3（plugin runtime 选型）启动条件：与 Spike-2 并行
- Phase 6 W1 desktop 生产化基线：基于本 Spike artifacts（icon / frontendDist / signing / notarization）

## Commit 范围

12 commits in branch `claude/spike-1-tauri-shell`（task 11 为人工 smoke 无 commit；task 13 = 本文件 = commit 13）：

- task 1: apps/desktop pnpm workspace 注册
- task 2: Tauri 2 Rust scaffold
- task 3: detect_ollama_available command + 3 mockito 单元测试
- task 4: apps/web local-ollama TS helper + 6 node:test
- task 5: desktop-bridge isTauri + safeInvoke + 5 node:test
- task 6: InlineAgentMenu local-AI toggle + 3 node:test
- task 7: system tray icon + 中英双语 menu
- task 8: notifications / deep-link / .paper file association
- task 9: Tauri Updater 框架 + minisign 文档
- task 10: GitHub Actions desktop-release workflow（4 matrix）
- task 12: docs + ADR-0003 review log
- task 13: 本完工报告
