# Next session tasks

> 本文件记录上一 session 收尾时仍未完成 / 实测中发现需要在下一 session 处理的事项。
> 新 session 启动时先读这里，再决定执行顺序。

---

## 0. 上下文一句话

Phase 0 全部 6 个交付物 + 综合报告已 commit + push（最后一个 commit `2d4d075`）。
ADR-0001 / 0002 / 0003 状态 Proposed；ADR-0003 §3 已 Accepted。

---

## 1. D3 双 tab 手测在浏览器实跑发现的问题（priority: P0）

**实测时间**：2026-05-08（截图含完整 Chrome DevTools console output）

**关键肯定证据**：
- 状态行 `Indexeddb synced: yes · Peers (incl. self): 1 · y-prosemirror warnings observed: 0`
- 单 tab 内插入 citation-ref / inline-equation / footnote-ref / computational-cell 全部正常渲染
- Y.Doc body fragment live dump 能看到结构化 atom node（含 blockId / citationId / latex / cellId / kernel / sourceCode 全字段）
- **y-prosemirror schema-recovery 警告计数为 0**——这是 H1 / ADR-0001 schema 部分最有力的实证

**4 个待修问题**（按优先级）：

### 1.1 `[P1]` y-webrtc 公共信令服务器在用户网络下不可达

```
WebSocket connection to 'wss://signaling.yjs.dev/' failed
WebSocket connection to 'wss://y-webrtc-signaling-us.herokuapp.com/' failed
WebSocket connection to 'wss://y-webrtc-signaling-eu.herokuapp.com/' failed
```

**影响**：双 tab **跨 tab 同步无法验证**——`Peers (incl. self): 1` 说明第二个 tab 没看到。这阻塞了"3 个手测 case"中的 case 1（concurrent atom inserts）和 case 3（delete + annotation collision），它们都需要两个 client 实时连通。

**Theory**：y-webrtc 内置 BroadcastChannel 应该让同 origin 同浏览器 tabs 不依赖外部信令也能同步——需要查源码确认是否需要至少一个 signalling 成功才启动 BroadcastChannel。

**修方案（推荐）**：
1. 在 `apps/prototypes/proto-a-yjs-schema/` 加 `scripts/start-ws.ts` 启动 **本地** y-websocket server（npm `y-websocket` package, port 1234）
2. `setup-sync.ts` 加一个 `WebsocketProvider` 用 `ws://localhost:1234`，**不再依赖** 公共信令
3. 提供 `pnpm proto-a:ws`（先启 ws server）+ `pnpm proto-a:dev`（再启 Vite）的 README 说明
4. 这条路径与 ADR-0003 §2.3 y-sweet 路径一致——Phase 1 真实部署也是先有 ws server，不用公共 webrtc 信令

**fallback 方案**：
- y-webrtc 改 `signaling: []` 强制 BroadcastChannel-only（验证一下是否可行）
- 这个简单但不能跨 device，对手测 ok，对 Phase 1 production 不行

### 1.2 `[P1]` React StrictMode dev 双 mount 触发 `A Yjs Doc connected to room "..." already exists!`

```
chunk-MAUYH5ZJ.js:599 Uncaught (in promise) Error: A Yjs Doc connected to room "proto-a-yjs-schema-default-room" already exists!
    at create3
    at openRoom
```

**根因**：`App.tsx` 在组件 body 里直接 `if (!syncRef.current) syncRef.current = setupSync({...})`。React 18 StrictMode 在 dev 双调用组件函数时，第一个 render 设置 ref，第二个 render 守护应该有效——但 y-webrtc 的 `rooms` 是 module-level Map，可能在 cleanup 路径上没正确释放。

**修方案**：
- 把 setupSync 移到 `useEffect(() => { ... return () => bundle.destroy(); }, [])`
- 或者用 `useSyncExternalStore` / 或者在 setupSync 里检查 `rooms.has(name)` 提前返回已有实例

文件：`apps/prototypes/proto-a-yjs-schema/src/App.tsx`（关键行 ~24-28）

### 1.3 `[P2]` TipTap warning：`extension-collaboration` 与 `extension-history` 不兼容

```
[tiptap warn]: "@tiptap/extension-collaboration" comes with its own history support
and is not compatible with "@tiptap/extension-history".
```

**修方案**：从 `apps/prototypes/proto-a-yjs-schema/src/extensions/all.ts` 删除 `History`（让 collaboration 内置 undo/redo 接管）。

### 1.4 `[P3]` `computationalCell.sourceCode` 在 Y.Doc XML attr 里被字面化

JSON dump 中观察到：
```
sourceCode=\"import marimo as mo\nmo.md('Hello, paper!')\"
```

—— `\n` 是字面 backslash-n 而非真实换行。Y.Xml 的 attribute 是字符串 attr，原本插入的 JS 字符串包含 `\n`（真换行），但序列化时被转义为 `\n`（字面）。

**影响**：纯 cosmetic（serialization escape）；NodeView 展示已经正确显示一行（因为 JSX 构造是 `code.textContent = ...`，浏览器 textContent 不会渲染 `\n` 为换行）。

**修方案 A**：
- ComputationalCell 改用 `<textarea>` 或 `<pre>` 子节点（NodeView 内部用 contentEditable=false 的多行 element）
- 把 sourceCode 改成 children content（PM block content）而非 attribute

**修方案 B（建议 Phase 1 一并做）**：
- ComputationalCell 改用真 PM `content: "text*"` 节点（不是 atom），让 source code 用 PM 文本表示——CRDT 协作编辑代码自然支持
- atom 的语义保留给"指向外部 ComputationalCell 实体"的 ref node（Phase 1 schema 重构）

文件：`apps/prototypes/proto-a-yjs-schema/src/extensions/computational-cell.ts`

---

## 2. ADR-0001 状态推进

D3 自动化 stress 已通过；浏览器手测的 schema-recovery 部分经截图实证 0 warnings → ADR-0001 schema 决策**经实证站得住**。

但用户的 case 1 和 case 3（需要双 tab 同步）受 §1.1 阻塞未跑。

**操作步骤**（在 §1.1 修复后）：
1. 启 local ws server + 重启 dev server
2. 打开两 tab → 状态行应显示 `Peers: 2`
3. 跑 case 1: 两 tab 同时点 "Insert citation-ref" → 期望两 ref 都出现，warning 计数仍为 0
4. 跑 case 3: tab 1 删 block，tab 2 加 annotation anchor → 期望 anchor 优雅消失或落在剩余文本上
5. 把实测结果填入 `apps/prototypes/proto-a-yjs-schema/findings.md` 的 Manual test result template
6. 如三 case 都 0 warning + 表现合理 → ADR-0001 status 改 **Accepted**，加一行 decision log

---

## 3. Phase 1 起手清单（来自 prototypes-report.md §5.1，未变）

§1 修完、ADR-0001 转 Accepted 后开始 Phase 1。第一周的 4 项立即落地：

1. `apps/sync-gateway` 起手——网关 shim 接口（`canApplyUpdate(principalId, documentId, update) → boolean`），即便 Phase 1 只用连接级 capability 检查
2. `packages/schema` 加 `Document.forkedFromContributionId` / `forkedFromDocumentId` 字段（场景 C 走查时识别的字段补充）
3. `packages/permissions/src/capabilities.ts` 把 36 条 capability 词汇定义为常量
4. `mcp-servers/` 把 `crossref-mock` 替换为真 `crossref` server（继续保留 mock 在 CI / 离线 demo 用）

---

## 4. 建议的下一 session 第一条指令

> "读 plan0/next-session-tasks.md 的 §1（D3 follow-ups），按 P1 优先级修：先 1.1（local y-websocket server）、再 1.2（StrictMode useEffect 重写）、再 1.3 / 1.4。修完后让用户实跑双 tab 手测，0 warnings 就把 ADR-0001 转 Accepted。"

或者并行（如果有信心）：

> "§1 修复 + Phase 1 起手 §3.1（apps/sync-gateway 骨架），双线并进。"
