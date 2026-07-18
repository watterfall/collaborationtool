# ADR-0021: Discovery-graph vault-native 存储 — Night artifact 长在用户 vault，不落 PG

- **Status**: Proposed
- **Phase**: 6 W4（improvement-plan-2026-08 Wave A2）
- **Date**: 2026-07-18
- **Deciders**: tech-lead (jili)，路线 A 拍板见 improvement-plan-2026-08 §二
- **Gated on**: thought 垂直切片 landed + ADR-0020 Wave D-5 30 天 dogfood（promote 条件不变）

## Context

phase-6-plan-stub §一原计划 ADR-0021 = "discovery-graph schema migration（Night artifact
落 PG）"。这与两条既有承诺正面冲突：(1) client-first 第一性原理 #1——client 文件是权威，
PG 是 replicated cache（ADR-0017，ADR-0001 §8.7 已正式反转）；(2) Night 层的存在理由——
"夜科学需要未被监视的空间"（ADR-0020 §1.4），**默认私密的凌晨想法落服务器数据库在哲学上
自相矛盾**。两次 pivot（client-first 2026-05-11 / triadic 2026-05-12）同日发生、从未在
数据模型层整合（client-first spec 中 night/triadic 零命中）。同时 dogfood-runbook §1 指定
的 30 天 dogfood 入口是零持久化 skeleton——gate 挡工具、dogfood 需要工具，死锁。
2026-07-18 三路调研（代码审计 / 外部格局 / 死锁诊断）后路线 A 拍板本 ADR 改向。

## Decision

**Night artifact 是 vault 里的 markdown 文件**（人可读，Obsidian 可开），一个 artifact
一个文件；PG 不存 Night 本体，只在用户显式分享/发布时收到投影。

1. **文件布局**：`<vault>/night/<YYYY-MM-DD>-<slug>.md`（Bridge 未来 `bridge/`）。
   顶层 `*.md` 仍是普通文档；`night/` 子目录即层语义。`.vault/` 仍是控制面不放内容。
2. **类型化 frontmatter**：`---` 围栏内约束文法（`key: value` 每行一条 + 逗号列表；
   **不引入 YAML 依赖**——完整 YAML 是超集陷阱，约束文法可双向 round-trip 验证）。
   字段映射 `NightArtifactBase`：`night`(=kind) / `id` / `author`（vault ed25519 公钥
   `ed25519:<hex>`，无 identity 时 `local:anonymous`；发布投影时才映射真 PrincipalId）/
   `created` / `updated` / `visibility`（默认 `private`）/ `status` / `mode-tags` /
   `provenance` / `title`。正文 = `bodyMarkdown`。codec 双向函数放
   `packages/discovery-graph/src/vault-file.ts`（类型 SoT 旁边，类型漂移即 typecheck 报错）。
3. **frontmatter 保全原语**：vault-fs 的 markdown ↔ Y.Doc 往返当前不识别 frontmatter
   （审计确认零处理）——编辑器打开 thought 再 flush 会损毁头部。新增
   `packages/vault-fs/src/frontmatter.ts`（split/join 纯函数），vault-host per-doc hooks
   在 parse 前剥离暂存、emit 时原样回贴。**头部字段的结构化更新走 codec 重写文件，
   不走 Y.Doc**（编辑器只拥有正文）。
4. **主机能力**：vault-host 新增两个 RPC——`vault.createFile`（create-only 原子写 +
   路径穿越防护 + 双语错误）与 `vault.listFiles`（子目录 `*.md` 递归列举，排除 `.vault/`）。
   Rust 层零改动（泛型 `vault_host_rpc` 直通）。
5. **分享/发布投影**：升 `visibility` ≠ 移动数据。发布走既有 open-content 路径
   （`/api/publish`，question → open_question，其余 → share_snapshot），签名 + Merkle log
   照旧；vault 文件始终是权威副本。本切片只留接缝不实现。
6. **本地 provenance**：切片记 frontmatter `provenance: prov-local-<uuid>` + author +
   时间戳；vault 本地 Merkle log 显式推迟（复活条件：dogfood 出现"本地防篡改"真痛点）。

**没选**：(a) 落 PG（stub 原案）——违背 #1 与 Night 隐私，且强制在线；(b) jsonb/sidecar
二进制存 artifact——违背 markdown 人可读（ADR-0017 invariant 2）；(c) vault 内 SQLite
索引——切片阶段过度工程，文件数 < 1000 时 readdir 足够，复活条件：列举可感知变慢。

## Consequences

- **好**：dogfood 死锁解除（真工具 + gate 仍挡 promote）；Night 隐私承诺技术兑现
  （private 数据物理上不出户）；Obsidian 等既有工具零成本互操作；桌面 substrate 获得
  首个内容语义消费者。
- **代价**：搜索/跨设备/多人协作能力受限于文件层（接受——Night 默认单人私密，协作
  发生在 Bridge/Day）；frontmatter 约束文法需文档化教育；发布投影的 Principal 映射
  留给 F4 路径（已有）。
- **盯**：编辑器内正文编辑与 codec 头部重写的并发窗口（切片用"编辑器只碰正文"约束
  兜底；若 dogfood 撞上真冲突，升级为 host 侧文件锁）。

## Review log

- 2026-07-18 起草（improvement-plan-2026-08 Wave A2.1）。thought 垂直切片实现随
  Wave A2.2 追加 entry。
- 2026-07-18 **Wave A2.2 thought 垂直切片 landed**（同日）：§2 codec =
  `discovery-graph/src/vault-file.ts`（serialize/parse round-trip 9 测锁全字段）；
  §3 保全原语 = `vault-fs/src/frontmatter.ts`（join(split(x))===x invariant 6 测）
  + vault-host per-doc hooks 接线（frontmatter 过编辑往返存活 + per-doc stash 不串
  2 测）；§4 = vault-host `vault.createFile`（create-only + 路径穿越拒绝）+
  `vault.listFiles`（递归 .md、排除 .vault、缺目录=空）3 测，Rust 零改动；§6 =
  webview `night-capture.ts` 纯 builder（authorKey 注入自 vault ed25519 公钥，
  缺省 `local:anonymous`，3 测）+ /vault Night capture UI（标题/正文/5 mode-tag
  toggle → createVaultFile → 列表刷新）。四包测试 37/69/19/535 全 PASS。
  真机（Tauri webview）端到端 smoke 留 user；dogfood-runbook §1 入口已改指桌面
  /vault。
- 2026-07-18 **A2.3 全 6 Night kind landed**（同日）：codec 从 thought-only 泛化为
  `serializeNightArtifactVaultFile` / `parseNightArtifactVaultFile`（thought API 保留为
  back-compat wrapper）。规则：单 token 枚举 → 可读命名行（lifecycle / metaphor-source /
  sketch-medium / contradiction-type / resolution-status）；结构化/多行 prose → 单行
  `data:` JSON（poles / outcomes / resolution / mappingDescription），仍是 key: value
  文法、round-trip 无损；line 字段禁换行（serializer 抛错）。discovery-graph 69→81
  （+12：6 kind round-trip + 严格性 5 + thematic-break 安全）；capture UI 升级为
  `NightCaptureForm` 组件（kind 选择器 + 各 kind 专有字段最小起步态——question
  lifecycle=open / contradiction status=open / TE outcomes=[]，per 7 原则 #2 不逼
  完整化）；web 535→538。四包 typecheck + Design grep 0 命中全 PASS。剩余：Bridge
  kind 切片 gated on thought 跑通 + dogfood 第 1 周反馈（不在本轮）。
