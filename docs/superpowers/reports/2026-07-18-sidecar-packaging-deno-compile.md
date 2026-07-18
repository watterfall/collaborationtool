# Sidecar 打包选型决策 memo — Deno compile 为主

> Wave A4.2（improvement-plan-2026-08）· 2026-07-18 · Driver: 2026 年中外部格局调研
> 状态: **decision memo（选型定向，实施 gated on release 工程 W2-W3）**

## 问题

`packages/vault-host` 是 Node stdio JSON-RPC 进程（PR #10 landed，dev-tier 传输）。
当前发行版在找不到系统 Node / repo checkout 时返回双语 "entry not found"，**不假装可用**
（ADR-0017 §8 review log）。要让终端用户"装了桌面 app 就能用 vault，无需自己装 Node"，
必须把 vault-host 打包成**自包含二进制**，由 Tauri 作为 sidecar（externalBin）spawn。

约束：零新运行时依赖是 dev-tier 的约定，但 release 工程可以引入打包工具链（只影响构建，
不影响运行时代码）。vault-host 是纯 Node（node:readline / node:fs / Buffer + workspace
包），无原生插件。

## 选项对比（2026 年中现状）

| 方案 | 自包含 | 体积 | 成熟度 | 判定 |
|------|--------|------|--------|------|
| **Deno compile** | ✅ 真自包含（不依赖外部源文件） | ~90-100MB | stable，`deno compile` 生产可用 | **选定（主）** |
| Bun `--compile` | ⚠️ 仍依赖外部源文件（未闭合 issue #14676） | ~90-100MB | 可用但边角未收敛 | 备选 |
| Node SEA（Single Executable App） | ⚠️ 仅单个 CommonJS 脚本 | 取决于 Node | 太受限（vault-host 是 ESM + workspace 多文件） | 拒 |
| 要求用户自装 Node | — | 0 | 当前态 | 拒（体验门槛） |

来源：Deno/Node/Bun 2026 runtime 对比 https://dev.to/pockit_tools/deno-2-vs-nodejs-vs-bun-in-2026-the-complete-javascript-runtime-comparison-1elm ；bun compile 外部文件依赖 issue https://github.com/oven-sh/bun/issues/14676 。

## 决策

**主选 Deno compile**，Bun compile 备选。理由：

1. **唯一真自包含**——Deno compile 产物不依赖外部源文件，正是 sidecar 场景需要的
   （用户机器上只有一个二进制 + Tauri 壳）。Bun 当前仍会引用外部文件，未闭合 issue。
2. Node SEA 只支持单 CommonJS 脚本——vault-host 是 ESM + 多 workspace 包，不适配。
3. Deno 对 node: 内建 + npm 兼容 2026 已足够跑 vault-host 这类纯 Node 逻辑（无原生插件）。

## 已知代价（must-measure before commit）

- **+90MB 包体税**：这与 Tauri "小体积"卖点（壳本身 2-10MB）直接冲突。sidecar 二进制
  比 Tauri 壳大一个数量级。**实施前必须量**：三平台（macOS/Win/Linux）各自 Deno compile
  产物实际体积 + 对总安装包的冲击；若不可接受，退路是"首次运行时下载 sidecar"或"检测
  系统 Node 优先、缺失才 fallback 打包二进制"。
- Deno 对某些 npm 包的边角兼容——vault-host 依赖 @collaborationtool/{doc-store, vault-fs,
  identity} + yjs + chokidar + @noble/*，实施第一步是 `deno compile` 冒烟这条依赖链。

## 实施路线（gated on release 工程 W2-W3）

1. `deno compile` 冒烟 vault-host + 全 workspace 依赖链，确认可跑（对齐 server.test.ts
   的 12 RPC 方法）。
2. 三平台产物体积实测 → 填本 memo"已知代价"表 → 决定是否接受 +90MB 或走 fallback 策略。
3. Tauri `externalBin` 配置 + `vault_host.rs` spawn 逻辑从"找系统 Node"改为"优先打包
   sidecar，缺失回退系统 Node"（保留 dev-tier 路径）。
4. GH Actions `desktop-release.yml` 加三平台 sidecar 构建步骤。
5. 落地后追 ADR-0017 §8 review log（"Node runtime 打包 DEFERRED" → "Deno compile
   sidecar landed"）。

## 关联

- ADR-0017 §8（Node runtime 打包属 release 工程 DEFERRED）
- PR #10 vault-host stdio IPC（被打包对象）
- improvement-plan-2026-08 Wave A4.2
