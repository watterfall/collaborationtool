# ADR-0019: 跨平台 plugin runtime — WASM Extism 为主 + 各 OS 原生沙箱 fallback

- **Status**: Proposed
- **Date**: 2026-05-12
- **Phase**: 6 W2（起草） / W9-W10（实施 + dogfood gate G7）
- **Deciders**: tech-lead
- **Gated on**: Phase 6 W9-W10 dogfood gate G7（3 OS 同一 plugin 安装 +
  sandbox spawn 成功 + secret-reject 测通）

---

## 1. Context

### 1.1 起因

ADR-0012 落地 Linux Bubblewrap 沙箱后，Phase 6 client-first pivot
（`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`）
要求 desktop 客户端（Tauri）在 Linux / macOS / Windows 三 OS 上跑
plugin 沙箱：

- ADR-0012 §2.1 显式 punt：macOS sandbox-exec 推 Phase 4；Windows
  AppContainer 推 Phase 4；都标 "WIP"
- Phase 6 plan stub §三"不做的事"已含"plugin marketplace 推 Phase 7"
  但**桌面端跑 plugin** 是 dogfood 基础 → 必须 Phase 6 W9-W10 落地
- macOS / Win sandbox 不写 = `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8
  Spike-3 验收三项之一

### 1.2 Spike-3 已收敛证据

`docs/superpowers/spikes/spike-3/` 三 PoC：

- `macos-sandbox/` — SBPL profile + bash + jq echo plugin（task 2）
- `wasm-extism/` — Rust + extism-pdk → wasm32 + Node @extism/extism host（task 3）
- `win-appcontainer/` — stub + 决策依据，真实施 Phase 6 W9-W10（task 4）

`trade-off-matrix.md` + `decision.md` 出 hybrid 模型结论。

### 1.3 与 ADR-0012 / ADR-0010 的关系

- ADR-0012 §2.1 三 OS 拼图本 ADR 补全；Linux bwrap 路径不变
- ADR-0010 plugin manifest schema 本 ADR 加 `runtime` 字段（§2.2）
- ADR-0010 §2.3 `required_capabilities[]` 模型适用 wasm / native 两路径

### 1.4 边界

**本 ADR 决定**：plugin runtime 选型 + manifest schema 扩展 + 各 OS
fallback 矩阵 + Phase 6 W9-W10 实施分包。

**本 ADR 不决定**：plugin marketplace（推 Phase 7）/ WASM-side JS
ergonomics（Componentize-JS GA 后评估）/ 真生产沙箱配置文件
（Phase 6 W9-W10 落 packages/plugin-runtime-{wasm,native}/）。

---

## 2. Decision

### 2.1 Hybrid runtime model

**WASM Extism = primary cross-platform path** + **per-OS native sandbox
= fallback for npm-heavy plugins**。

| 平台 | 主路径 | Fallback | 触发条件 |
|---|---|---|---|
| Linux | WASM Extism | Bubblewrap (ADR-0012) | manifest `runtime: 'native'` 或 plugin 含 node_modules |
| macOS | WASM Extism | sandbox-exec + SBPL profile | 同上 |
| Windows | WASM Extism | AppContainer + capability SIDs | 同上 |
| iOS / Android | WASM Extism only | — | 移动端不开 native fallback；plugin 必须 wasm |

理由：

1. **WASM 跨平台一致** — 一个 .wasm artifact 全 OS 跑；plugin author
   维护负担最小；与 client-first pivot §3 desktop 优先一致
2. **Native fallback 解 npm 兼容** — Componentize-JS / QuickJS 仍 beta
   （as of 2026-05），node_modules-heavy plugin（如 citation 工具链
   依赖 npm crossref / orcid SDK）短期内只能走 native 进程
3. **per-plugin 抉择** — manifest `runtime` 字段声明（§2.2）；安装时
   trust prompt 显示 runtime 的安全保证；user 知情同意

### 2.2 Plugin manifest schema 扩展

`packages/schema/src/plugin-manifest.ts` 加：

```ts
export interface PluginManifest {
  // ... existing fields (id / kind / required_capabilities[] / ...)
  /**
   * 选择 plugin 执行 runtime。
   * - 'wasm'         : 主路径；wasm32-unknown-unknown artifact + Extism host
   * - 'native:linux' : Bubblewrap（ADR-0012）
   * - 'native:macos' : sandbox-exec + SBPL profile
   * - 'native:windows': AppContainer + capability SIDs
   * - 'native:any'   : 由 host 按当前 OS 选 native fallback；三 OS 都需 ship 对应 binary
   */
  runtime:
    | 'wasm'
    | 'native:linux'
    | 'native:macos'
    | 'native:windows'
    | 'native:any';

  /** wasm runtime 必填；指向 plugin .wasm artifact 相对 plugin root 路径 */
  wasmArtifact?: string;

  /** native runtime 必填；指向各 OS binary（key = OS slug, value = relative path） */
  nativeArtifacts?: Partial<
    Record<'linux' | 'macos' | 'windows', string>
  >;
}
```

Validation：

- `runtime === 'wasm'` → `wasmArtifact` 必填；`nativeArtifacts` 忽略
- `runtime.startsWith('native:')` → `nativeArtifacts` 对应 key 必填
- `runtime === 'native:any'` → `nativeArtifacts` 三 key 都必填

### 2.3 Trust prompt 适配 runtime

`apps/web/src/components/plugin/InstallPrompt.tsx`（Phase 6 W9-W10 新建）
按 runtime 显示安全保证：

- **wasm**：「此 plugin 在 WebAssembly 隔离环境运行 — 无系统调用 / 无文件
  访问 / 无网络访问，除非你授权以下能力：[capabilities]」
- **native:linux**：「此 plugin 在 Bubblewrap 沙箱运行 — 只能读 plugin
  目录 + tmpfs；网络访问受 capability 限制」
- **native:macos**：「此 plugin 在 sandbox-exec 沙箱运行 — 只能写
  tmpdir；网络默认阻；mach lookup 阻。注意：sandbox-exec 已被 Apple 标记
  deprecated，未来版本可能切换。」
- **native:windows**：「此 plugin 在 AppContainer 运行 — 隔离 profile dir；
  默认无网络；需 internetClient capability 才可联网。」

### 2.4 Fallback 规则

- Host 启动 plugin 时先看 manifest `runtime` 字段
- `wasm` 路径走 `packages/plugin-runtime-wasm/`（Extism + Wasmtime embed）
- `native:*` 路径走 `packages/plugin-runtime-native/`：
  - Linux 复用 ADR-0012 bwrap 实现
  - macOS sandbox-exec 新 impl（参考 spike-3 `macos-sandbox/`）
  - Windows AppContainer 新 impl（参考 spike-3 `win-appcontainer/` +
    Microsoft Docs CreateAppContainerProfile + CreateProcess）
- 三 OS 任一缺 native runtime 实现 → plugin install UI 显式拒绝
  （**不**默默 fallback 到无沙箱直跑 — ADR-0012 §1.3 安全第一原则）

### 2.5 Warm-start caching

- **wasm**：Extism 自带 module-level cache；host 复用 Plugin 实例
  跨 invocation（warm-start ~µs 级）
- **native**：**不缓存**；每次 invoke spawn fresh 进程。理由：
  - 进程 reuse 增加 state bleed 攻击面（capability grant 跨 invocation 漂移）
  - SID / namespace handle 复用复杂度高
  - cold-start 10-30ms 仍在 Design.md §1.7 latency budget 内
  - 如未来 cold-start UX 成问题再 revisit

---

## 3. Consequences

### Good

- 跨平台 plugin 一致体验（wasm 路径）
- npm 兼容路径保留（native fallback）
- per-plugin runtime 选择 = plugin author 按需选；trust prompt
  对齐安全保证
- ADR-0012 Linux bwrap 投入复用（native:linux === bwrap）
- 移动端（iOS / Android）天然只接 wasm → 攻击面收缩

### Bad / Trade-offs

- **维护两套 runtime stack**：wasm + native；Phase 6 W9-W10 实施
  4-6 周（vs 单 wasm 4 周 / 单 native 2-3 周 / OS）
- **plugin author 学习曲线分叉**：wasm path 需 Rust（或 Componentize-JS
  GA 后用 TS）；native path 同 Phase 2 manifest 即可
- **macOS sandbox-exec deprecation 风险**：Apple 任何版本可能停 support
  → 需监控并 fallback 到 Endpoint Security Framework；ADR-0019 review
  log 加每 macOS major version verification 任务
- **Componentize-JS GA 之前 wasm 路径对 JS plugin 不友好** → Phase 6
  W9-W10 落地时 wasm 路径只接 Rust plugin；JS plugin 默认走 native:any

### Neutral / Need watching

- WASM ecosystem 演进（Wasmtime / Componentize-JS / WASI Preview 2）—
  Componentize-JS GA → JS plugin 走 wasm；当前 wasm 路径=Rust only
- ADR-0010 `required_capabilities[]` 在 wasm 路径下含义略变（不是 OS
  capability 而是 host-exported function 子集）；Phase 6 W9-W10 落
  validation
- 内嵌 Wasmtime ~15MB 增 desktop bundle 大小；Tauri 已有 ~25MB 基线
  → 影响 +60%，需评估是否动态下载

---

## 4. Alternatives considered

### A: WASM-only

**是什么**：所有 plugin 必须编译成 wasm32 artifact；放弃 native fallback。

**为什么不选**：

- npm 友好度不足 — Componentize-JS 仍 beta（2026-05）；QuickJS-in-WASM
  per-plugin 3-5MB bundle；plugin author 短期内无法直接复用 node_modules
- Phase 6 plugin marketplace（推 Phase 7）期望 plugin author 用熟悉
  栈（Node / TypeScript），强 wasm 拦在门口

**什么情况下回头**：Componentize-JS GA + WASI Preview 2 稳定后
（预期 Phase 7-8），考虑去 native fallback。

### B: Native-only（per-OS sandbox 各做一遍）

**是什么**：Linux bwrap + macOS sandbox-exec + Win AppContainer 全做；
无 wasm 路径。

**为什么不选**：

- 维护三套 OS-specific sandbox 长期成本高（每 macOS / Windows major
  version 验证 + 适配）
- Apple sandbox-exec deprecation 风险无 fallback
- 移动端（iOS / Android）必须再加 2 套 sandbox（iOS app extension /
  Android Isolated Process）→ 总共 5 套
- 跨平台一致性差 — 不同 OS 的 capability 模型 / 错误消息 / 性能特性都不一样

**什么情况下回头**：如果 WASM ecosystem 长期不成熟（Wasmtime 失维护 /
Componentize-JS 失败）。

### C: Server-side ssh tunnel + Linux bwrap from desktop

**是什么**：desktop 不跑 plugin；通过 ssh tunnel 把 plugin invocation
转发到一台 Linux server，server 上用 ADR-0012 bwrap 跑。

**为什么不选**：

- 与 client-first pivot §3 "desktop must work offline" 直接冲突
- 增加 server 依赖 → 与 local-first 第一性原理 #1 反
- 仅作为**应急路径**保留 — 当 client 平台缺 runtime 时（罕见，例如
  fresh Tauri 安装未 ship wasmtime）；不作 default

**什么情况下回头**：私有 corpus 部署场景下（org 自托管 server + 多
desktop 接入）作为可选路径。

### D: Docker container per plugin

**是什么**：每 plugin 跑独立 docker 容器。

**为什么不选**：与 ADR-0012 §2.1 rejected 同 — 启动开销 >500ms /
image 管理重 / 桌面端要求装 docker desktop 不现实。

---

## 5. Decision log

- 2026-05-12: Spike-3 task 1-5 收敛 trade-off matrix + decision doc；
  hybrid 模型出（`docs/superpowers/spikes/spike-3/decision.md`）
- 2026-05-12: Spike-3 task 6 起 ADR-0019 Proposed；待 Phase 6 W9-W10
  G7 dogfood gate（3 OS plugin install + sandbox spawn + secret-reject
  测通）promote → Accepted

## 6. References

- ADR-0010: extension system + plugin API（manifest schema base）
- ADR-0012: plugin sandbox + user install（Linux bwrap baseline）
- ADR-0013: model provider abstraction（Phase 4 W9 G3 模板）
- `docs/superpowers/spikes/spike-3/README.md`
- `docs/superpowers/spikes/spike-3/echo-plugin-spec.md`
- `docs/superpowers/spikes/spike-3/trade-off-matrix.md`
- `docs/superpowers/spikes/spike-3/decision.md`
- `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8 Spike-3 验收
- Extism docs: <https://extism.org/docs>
- Wasmtime: <https://wasmtime.dev/>
- Microsoft Docs "Implement an AppContainer"
- WWDC 2017 "Securing Your App with Sandbox"

## 7. Phase 6 implementation review log

> Phase 6 W9-W10 落地完毕后补充。当前 empty。
