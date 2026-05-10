# ADR-0012: Plugin sandbox + 用户安装路径 + capability 提示 UI

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 3 W5
- **Deciders**: tech-lead
- **Gated on**: Phase 3 W5 dogfood gate（用户能装第三方 plugin 且 OS 沙箱真隔离）

---

## 1. Context

### 1.1 起因

ADR-0006 §2.5 + ADR-0010 §2.5 把"用户挂自己 MCP server / agent / skill"
推到 Phase 3。Phase 2.5 的 `plugins/registry.json` 是 built-in 路径
查找；要让普通 user role 装第三方 plugin（不只 admin），需要：

1. **OS-level 隔离** — 第三方 plugin 进程不能读用户 home 目录、不能
   绕过 capability 走 raw network、不能 escape 进 host
2. **Capability 提示 UI** — 用户安装时显式同意 plugin 声明的
   `required_capabilities` 子集；类似 Android / iOS install permission
3. **安装/卸载/审计流程** — POST /api/plugin/install + 后台审计；卸载
   清理 sandbox + revoke capability grants

### 1.2 与 Phase 2 已落地的关系

- ADR-0010 §2.3 plugin manifest 已声明 `required_capabilities[]` —
  本 ADR 把它从"warn 不 reject" → 真"安装时 user 必须勾选"
- Phase 2 stub §四 列了"用户挂自己的 localhost MCP server" 推 Phase 3
  ——本 ADR 把 user role 路径打开
- ADR-0006 §2.5 已建 `mcp_server.installed_by` + `origin='user'` 字段；
  ADR-0010 §2.5 plugin install 流程在 plugin 表上对称做

### 1.3 哲学约束（user 2026-05-09）

1. **平台性非常重要** → 用户挂自己 plugin 是开放平台核心承诺
2. **避免过度兼容性** → 不为 npm package / VSCode contribution 等
   既有生态适配；只支持 ADR-0010 manifest schema
3. **新技术敢上** → OS 沙箱选 modern 工具（不用 chroot+seccomp 自写）
4. **安全第一** → 默认 deny；显式 grant；审计 trail

---

## 2. Decision

### 2.1 OS 沙箱选型：**Bubblewrap (Linux) / sandbox-exec (macOS) per-process 隔离**

| 平台 | 选型 | 理由 |
|---|---|---|
| Linux | **Bubblewrap** (`bwrap`) | systemd ecosystem；user namespace；广泛部署；Flatpak 同款 |
| macOS | **sandbox-exec** + seatbelt profile | Apple 官方；零依赖；profile DSL 简洁 |
| Windows | **AppContainer** (WIP, Phase 4) | Phase 3 不优先；Windows 用户走 WSL2 兜底 |

**rejected**:
- **Docker container per plugin** —— 启动开销大（>500ms）；image 管理重；
  与 Phase 1 D7 6-process 拓扑（已含 docker-compose）层叠复杂
- **WasmEdge / quarkjs** —— 限制只能 WASM 编译过的 plugin；阻止 Node
  生态 plugin 复用（ADR-0010 §2.3 默认 `target: 'node'`）
- **chroot+seccomp 自写** —— 安全工程风险高；user 哲学"避免过度兼容性"
  反对自造轮子
- **Firejail** —— Linux only；社区维护下滑

**Phase 3 范围**：仅 Linux Bubblewrap 实现；macOS / Windows 推 Phase 4。
Linux 是 self-host + CI 主目标，其他平台 dogfood 期间用本地 Node 直跑
（标 `unsafe_user_install: true`，仅 admin 同意）。

### 2.2 沙箱配置（Bubblewrap）

每个 user-installed plugin 进程启动时套：

```bash
bwrap \
  --ro-bind /usr /usr \
  --ro-bind /lib /lib --ro-bind /lib64 /lib64 \
  --ro-bind <plugin_dir> /plugin \
  --tmpfs /tmp \
  --proc /proc --dev /dev \
  --unshare-all \              # PID / mount / IPC / cgroup 全 unshare
  --share-net \                # 网络默认 share；下方 capability 限制 domains
  --die-with-parent \
  --new-session \
  --setenv NODE_ENV production \
  -- node /plugin/agent.js
```

**只读绑定**：`/usr` `/lib` `/lib64` + plugin 自身目录。
**禁读**：用户 home / `/etc` / `/var` / 其他 plugin 目录 / `/proc/<other-pid>`。
**网络**：默认 share，但走 host-side egress 代理（per §2.4）拦截 outbound
请求 enforce `network.fetch:domains:[...]` capability。

### 2.3 Capability 提示 UI

**安装流程**：

```
GET /api/plugin/install/preview?source=<git-url|registry-id>
  → { manifest: ..., capabilityRequests: Capability[] }

POST /api/plugin/install
  body: { source, acceptedCapabilities: Capability[], unsafe_user_install?: boolean }
  → 201 { pluginId }
```

**UI 要素**（apps/web Phase 3 W5）：

1. plugin 卡片：title / description / authors / homepage / version
2. **capability 详细展开**——每个 capability 用人话解释
   （e.g. `document.read.citations` → "Read citations in your documents"）
3. **必勾**所有 plugin 声明的 required_capabilities；不能拒一部分装一部分
4. ADR-0002 词汇外的 capability（如 `mcp.install`）显示
   **⚠ 候选词汇** badge，require admin 二次审批
5. install 按钮 disabled 直到所有 checkbox 勾完
6. 卸载 = 清理 sandbox + revoke capability_grant + DELETE plugin row

**rejected** UI 选项：
- "全部同意 / 全部拒绝" 单按钮 → 用户不读 capability 列表
- "推迟到 install 后再问" → 已经在系统里跑过了再问没意义

### 2.4 网络 capability enforcement

`network.fetch:domains:[...]` 不是 ADR-0002 36 词汇内的 verb；它是
**plugin 自声明的 sandbox 限制**（ADR-0010 §2.3 review note）。

**实现**：host-side egress proxy。Plugin 进程的 outbound HTTP 请求
通过 `HTTPS_PROXY=http://localhost:<port>` 重定向到 host 进程的
proxy server。proxy 检查 SNI / Host 头，比对 plugin 的 allowed domains
白名单；不匹配返回 403。

```
Plugin → HTTPS Proxy (host) → real internet
              ↓ 检查 plugin manifest network.fetch:domains
              ↓ 不在白名单 → 403 + 写 audit log
```

**rejected** alternatives:
- iptables OUTPUT rules per uid → 配置复杂；macOS 移植难
- DNS-based blackhole → 子域名通配符难写对；HTTPS host header bypass

### 2.5 PG schema：`plugin` 表（与 mcp_server 表对称）

```sql
CREATE TABLE plugin (
  id text PRIMARY KEY,                    -- @owner/name 形式
  version text NOT NULL,
  type plugin_type_enum NOT NULL,         -- skill | agent | mcp-server | ui-panel
  source_url text,                        -- git url for re-install
  install_path text NOT NULL,             -- ~/.platform/plugins/<id>
  manifest jsonb NOT NULL,                -- 完整 manifest 缓存
  accepted_capabilities text[] NOT NULL,  -- 用户同意的 capability list
  origin plugin_origin_enum NOT NULL,     -- built-in | user | team
  installed_by text REFERENCES principal(id),
  installed_at timestamptz NOT NULL DEFAULT now(),
  enabled boolean NOT NULL DEFAULT true,
  unsafe_user_install boolean NOT NULL DEFAULT false,  -- macOS/Win Phase 3 兜底
  audit_log jsonb DEFAULT '[]'::jsonb     -- install/uninstall/grant 审计
);
```

`plugins/registry.json`（Phase 2.5）作为 built-in seed；user 安装 INSERT
进来。loader 启动时合并 JSON seed + PG `plugin` 表。

### 2.6 W5 dogfood gate criteria

参考 ADR-0010 §2.7 三项 criteria 模式：

1. **真第三方 plugin 装载成功**：写一个 `@third-party/test-plugin/`
   仓库（本仓库 fixtures 目录），通过 install endpoint 装进 PG，
   sandbox 启动并响应 invocation
2. **OS 沙箱真隔离**：plugin 内 `fs.readFile('/etc/passwd')` 被拒
   （bwrap 只读 bind 不含 /etc）；plugin `fetch('https://evil.com')` 被
   host proxy 拒；audit log 写入
3. **Capability deny 真生效**：用户安装时拒勾 `block.propose` →
   plugin 调 `proposeRevision` 工具时 host capability gate 拒（既有 ADR-
   0002 路径）；audit log 写

不通过则停止 W6+，重新设计 ADR-0012。

---

## 3. Consequences

### 3.1 正面

- 用户挂自己 plugin 通路打开（开放平台 axis 5 真兑现）
- OS 沙箱默认 deny → 即使 plugin 漏洞也限制爆炸半径
- Egress proxy 给 ADR-0001 provenance 加一层"plugin 真发了哪些 outbound
  请求"audit
- macOS / Windows 推 Phase 4 是合理 scope cut

### 3.2 负面

- bwrap 安装是 self-host docs 一项新依赖（apt install bubblewrap）
- HTTPS proxy 引入加密终止 → 需自签证书 + plugin trust store 配置；
  实施复杂度中等
- `unsafe_user_install: true` 兜底是个口子，必须 admin role 才能用
- macOS dogfood 用户 Phase 3 暂时只能 admin 装

### 3.3 长期债

- macOS sandbox-exec 实施推 Phase 4
- Windows AppContainer 推 Phase 4
- 多 plugin 之间共享 capability grant 的 UX（"用户已经为 plugin A 同意
  了 document.read，安装 plugin B 时是否自动也同意"）推 Phase 4
- WASM target 沙箱（轻量替代 OS 沙箱）推 Phase 4

---

## 4. Alternatives considered

### 4.1 Docker container per plugin（rejected）

**拒绝**：启动开销 > 500ms 与 ADR-0006 §2.3 per-invocation spawn 模式
矛盾；image 管理负担重；与 ADR-0004 §2.1 既有 6-process 拓扑层叠。

### 4.2 In-process Node `vm.runInNewContext` 隔离（rejected）

**拒绝**：vm 模块文档明说**不是安全沙箱**；Node maintainers 反复警告
"don't trust user code in vm"。即使再加 vm2 一层，2024 vm2 已宣布
deprecated 因不可修复的逃逸漏洞。

### 4.3 完全用 WASM 跑 plugin（rejected）

**拒绝**：限制 plugin 必须 Rust/Go/AssemblyScript 等编译语言；
ADR-0010 §2.3 默认 `target: 'node'` 是为了让普通开发者用 TS/JS 写 plugin。
WASM target 推 Phase 4 review，作为可选 target 而非默认。

### 4.4 Cloud 托管 plugin（rejected）

**拒绝**：让所有 plugin 在 collaborationtool 自营 cloud 跑——破坏
self-host 模式；用户哲学反对锁定（essay §11.5）；用户数据出 host 是
provenance 漏洞。

---

## 5. Open questions（W5 实施时落实）

- **bwrap 版本下限**：Bubblewrap 0.5+（含 `--die-with-parent`）；
  Ubuntu 22.04 LTS 自带是 0.6.x ✓；旧 self-host 用户需 backport doc
- **HTTPS proxy 实施**：Node 自写 + node-forge 自签 vs 用 mitmproxy
  做 standalone 进程？倾向 self-host 体验考虑用 Node 内置（mitmproxy
  又是一个 Python 依赖）
- **sandbox image 大小**：bwrap bind 哪些目录算最小可运行 Node 18+？
  `/usr/lib/node_modules` 是否需要？需做实测列清单
- **sandbox failure 行为**：bwrap 启动失败时降级 in-process（unsafe）
  还是直接拒？倾向 admin 用户可降级（标 unsafe），普通用户拒
- **多 plugin 之间 capability 共享**：Phase 4 评估

---

## 6. 与其他 ADR 的关系

- **ADR-0002**: 加 `plugin.install` 进 36 词汇？倾向**不加**（install 是
  admin/owner 元操作不是协作 verb）；通过 user role bundle 控制
- **ADR-0006**: `mcp_server.origin/installed_by` schema 已就位；user
  挂自己 MCP 走同 install 流程
- **ADR-0010**: §2.5 manifest `required_capabilities` 与本 ADR §2.3
  capability UI 闭环
- **ADR-0004**: bwrap + HTTPS proxy 加进 SELF_HOST.md 部署文档

---

## 7. Review log

### Phase 3 closeout（2026-05-10，branch `claude/phase-3-to-phase-4-antaC`）

Phase 3 W5 backend schema 已落，UI + bwrap 实施推 Phase 4 dogfood gate
（require Linux 部署环境）：

- `plugin_install` PG 表 已落（migration 0010；`accepted_capabilities`
  jsonb + `sandbox_descriptor` jsonb + 三态 status enum + bundle_hash 防
  tamper）
- `plugin_install_origin` enum 三档：`git-url` (https only CHECK 强制) /
  `local-path` (admin only) / `marketplace` (Phase 4+ 预留)
- `mcp_server.installed_by` (Phase 2 W1) + `plugin_install.installed_by`
  对称，user role 装 plugin / MCP server 走同一 capability 提示流
- ADR-0010 §2.5 manifest `required_capabilities[]` 在本表 jsonb snapshot
  的关系: 安装时 user 同意的子集 ≤ manifest 声明的全集

仍开放（Phase 4 dogfood gate 必答）：

- bwrap 实际启动 + capability deny 真生效 e2e（require Linux host）
- HTTPS proxy enforce manifest network 域名实施（Node-internal vs
  mitmproxy 进程）
- plugin install / uninstall HTTP API 路由 + UI（POST /api/plugin/install）
- §5 4 个开放问题答案（bwrap 版本下限实测 / sandbox image 大小最小集 /
  failure 行为 admin 降级 / multi-plugin capability 共享）

Status 维持 **Proposed**；Phase 4 W1 dogfood gate（真 third-party plugin
装且 capability deny 真生效）通过后 promote Accepted。
