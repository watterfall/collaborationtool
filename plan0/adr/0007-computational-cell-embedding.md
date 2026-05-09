# ADR-0007: Computational cell embedding + iframe protocol

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2
- **Deciders**: tech-lead
- **Gated on**: Phase 1.5 close-out（done）；Phase 2 W1 ADR draft + W4 implementation

---

## 1. Context

Phase 0 ADR-0001 §5 与 ADR-0003 §2.11 已锁定：

- `BlockType: 'computational-cell'` 是 PM atom node，`attrs.cellId → ComputationalCell`（PG 实体）
- `ComputationalCell.kernel: 'molab' | 'pyodide-inline' | 'remote-jupyter' | 'marimo-server'`
- Phase 1/2 默认 `molab` iframe；Pyodide-inline 留 Phase 3（ADR-0003 §2.11 不变）

Phase 1 D10 落了 `packages/editor-core/src/extensions/computational-cell.ts`：atom node 占位，attrs 只有 `blockId / cellId / kernel / sourceCode`，NodeView 渲染一个静态 `<pre>`。Phase 1 没有 PG 表、没有 iframe、没有 artifact 通道。

Phase 2 必须解决的三个边界问题：

1. **PG schema**：`ComputationalCell` 实体落地（kernel / sourceCode / sourceLanguage / inputDatasetIds / outputArtifactRefs / executionEnv），与 ADR-0001 §5 verbatim 对齐
2. **iframe ↔ 主页面协议**：molab 跑完一个 cell → 怎么把 artifact（PNG / Plot / DataFrame）emit 回主页面 → 怎么进 PM tree（phase-2-plan-stub §3.2 列为"必须一个 ADR"的开放问题）
3. **PM tree 里的"计算产物"形态**：是新 PM node type `computational-output`，还是给现有 `figure` 加 `attrs.sourceCellId`？

本 ADR **决定**：以上三件事 + 安全边界（postMessage origin / auth / dataset 输入 / 资源上传）。**不决定**：molab 的可用性与商业延续（外部依赖；ADR-0003 §2.11 已把 fallback 留到 marimo-server）；Pyodide-inline UI（Phase 3）。

---

## 2. Decision

### 2.1 ComputationalCell PG 实体 schema

新增表 `computational_cell`（migration `0005_computational_cell.sql`，Phase 2 W1）：

```ts
// packages/schema/src/computational-cell.ts
export type CellId = string; // uuidv7

export type Kernel = 'molab' | 'pyodide-inline' | 'remote-jupyter' | 'marimo-server';

export interface ComputationalCell {
  cellId: CellId;                           // PG PK / Y.Doc atom attrs.cellId
  documentId: DocumentId;                   // 拥有者；FK + ON DELETE CASCADE
  kernel: Kernel;
  sourceCode: string;                       // 源代码 (UTF-8)
  sourceLanguage: 'python' | 'r' | 'sql' | 'markdown'; // Phase 2 仅 'python'
  inputDatasetIds: CitationId[];            // FK to citation where kind='dataset'
  outputArtifactRefs: ArtifactRef[];        // 跑完一次的产物 (jsonb 数组)
  executionEnv: ExecutionEnv;               // jsonb
  lastExecutedAt: Date | null;
  lastExecutedByPrincipalId: PrincipalId | null;  // who clicked Run
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactRef {
  hash: string;            // sha256 of the artifact bytes
  mime: string;            // 'image/png' | 'application/json' | 'text/csv' | ...
  blobUrl: string;         // s3://<bucket>/artifacts/<hash> or signed URL
  caption?: string;        // optional human label
  cellEvalId: string;      // groups artifacts from one Run; uuidv7
  createdAt: Date;
}

export interface ExecutionEnv {
  pythonVersion?: string;       // '3.11'
  packages?: string[];          // e.g. ['pandas==2.2.0', 'matplotlib==3.9.0']
  dockerImageRef?: string;      // 'ghcr.io/marimo-team/marimo:0.10.0'
  // Phase 3 extensions: gpu, memoryLimitMb, networkPolicy
}
```

PG migration adds：

- `computational_cell` 表（pk = cellId）
- 1 trigger：`document` 删除时级联删
- 1 unique constraint：`(documentId, cellId)` 不能跨文档
- 1 jsonb GIN index on `outputArtifactRefs`（按 hash 查询过去版本）

### 2.2 PM tree：cell + output 拆开，复用 `figure`

Cell 节点本身仍是现有的 `computational-cell` atom block（attrs 不变：`blockId / cellId / kernel / sourceCode`）。

**不引入新 PM node type `computational-output`**。改为：扩展现有的 `figure` block node，加 `attrs.sourceCellId?: CellId` + `attrs.artifactHash?: string`：

```
ProseMirror tree:
  ├─ paragraph "见图 1"
  ├─ computational-cell { cellId: c1, kernel: molab, sourceCode: "..." }
  ├─ figure { sourceCellId: c1, artifactHash: 'sha256:abcd...', cellEvalId: e1 }
  │     ├─ image  (renders blobUrl from PG ArtifactRef where hash=artifactHash)
  │     └─ figure-caption "图 1: KMeans on Iris (1000 iter)"
  └─ paragraph "..."
```

理由：

1. **render-myst / render-typst 已有 figure emitter**（D12）——零新 emitter 工作即可导出
2. **citation-ref 模式延续**——`attrs.cellId` 延续"PM 只存 id，跨文档元数据走 PG"
3. **多次 Run 自动 supersede**——同一 `sourceCellId` + 新 `artifactHash` 替换旧 figure node（PM step 是 ReplaceStep）；旧 hash 仍在 `computational_cell.outputArtifactRefs[]` 历史里，contribution DAG 可回溯

**figure node 现有 schema 不破坏**：`attrs.sourceCellId` 缺省 undefined 时就是普通用户图（上传的 PNG）。新加两字段，PM JSON wire format 向后兼容（ADR-0005 §2.4 deadline 已过；这两个新 attrs 走 ADR-0005 的 minor bump = wire format v1.1，不破坏 v1.0 reader）。

### 2.3 iframe postMessage 协议

molab 的 embed URL：

```
https://molab.org/?embed=true&cell=<cellId>&host=<originHash>
```

iframe sandbox：`allow-scripts allow-popups`（**不**给 `allow-same-origin` —— molab 拿不到主页 cookie）。

CSP（ADR-0004 §2.4）`frame-src https://molab.org` + `connect-src 'self' https://molab.org` 已就位。

**消息格式**：每条消息是 `{ v: 1, kind: <string>, payload: <object> }`。所有消息走 `postMessage(msg, 'https://molab.org')` 严格 origin（不用 `'*'`）；接收侧每条都校验 `event.origin === 'https://molab.org'`。

**主页面 → iframe**（共 2 个 kind）：

| kind | payload | 何时发 |
|---|---|---|
| `cell.config` | `{ authToken, datasetUrls: { datasetId: signedS3Url }[] }` | iframe 第一次 `cell.ready` 之后 |
| `cell.execute` | `{ sourceCode, sourceLanguage, cellEvalId }` | 用户点 Run |

**iframe → 主页面**（共 4 个 kind）：

| kind | payload | 主页面动作 |
|---|---|---|
| `cell.ready` | `{ kernelVersion }` | 发 `cell.config` |
| `cell.progress` | `{ cellEvalId, fraction: 0..1, stderrTail?: string }` | 更新 NodeView 进度条 |
| `cell.executed` | `{ cellEvalId, artifacts: ArtifactPayload[] }` | POST artifacts → 写 `computational_cell.outputArtifactRefs` + 在 PM tree 插 figure node |
| `cell.error` | `{ cellEvalId, message, traceback }` | 在 NodeView 显示 + Sentry capture |

`ArtifactPayload`：

```ts
interface ArtifactPayload {
  mime: string;          // 'image/png' | 'application/json' | 'text/csv' | ...
  bytesBase64: string;   // ≤ 5 MB per artifact (Phase 2 limit)
  caption?: string;
}
```

> 5 MB 是 hard limit；超过的 artifact 由 iframe 自己上传到指定的 multi-part endpoint（Phase 3，不在本 ADR 范围）。

**auth token 流**：

1. 用户点 Run → 主页面调 `POST /api/document/<docId>/cell/<cellId>/auth-token` → 返回短期（5 分钟）签名 JWT，scope = `cell.execute:<cellId>`
2. 主页面把 JWT 通过 `cell.config` 传给 iframe
3. iframe 上传 artifact 走 `POST /api/document/<docId>/cell/<cellId>/artifact`，header `authorization: Bearer <jwt>`
4. 服务端验签 + 校验 `cellId` 匹配 → 写 PG + 写 S3

JWT secret 复用 `SYNC_TOKEN_SECRET`（ADR-0004 §2.2）；`audience='cell-runtime'` 与现有 sync-gateway 区分。

### 2.4 Dataset 输入流

`computational_cell.inputDatasetIds: CitationId[]` 中每个 id 必须解析到 `citation` 表里 `kind='dataset'` 的行；该行有 `csl.url` 或 platform-managed `dataset` 子表（Phase 1 schema 已就位）。

服务端在签 cell.config 时给每个 dataset 发短期（5 分钟）signed S3 URL。iframe 走这些 URL 拉数据，无需主页面 cookie。

权限 gate：执行者必须有 `agent.invoke:custom`（per ADR-0002 §2.1）+ `block.read` on the document。Phase 2 加新 capability `cell.execute:<cellId>` （resource-scoped，可由 owner 临时 grant 给 reviewer 让 reviewer 自己跑）。

### 2.5 Provenance 联动

每次 `cell.executed` 写一条 `Provenance`，actorPrincipalId = 触发用户的 principal（不是 agent；执行 cell 不是 agent 行为）：

```ts
{
  kind: 'cell.execute',
  actorPrincipalId,
  agentContext: null,        // 没有 LLM 参与
  cellExecutionContext: {    // 新加 jsonb 子结构
    cellId, cellEvalId, kernel,
    sourceHash,              // sha256 of sourceCode at execution time
    durationMs,
    artifactHashes: string[],
    executionEnvSnapshot: ExecutionEnv,
  }
}
```

**复现**：给定 `cellId + cellEvalId` 可重放（sourceHash + executionEnv 都在），由用户决定信任。

---

## 3. Consequences

### Good

- **零新 emitter**——render-myst / render-typst 现有 figure 路径直接出 image+caption，PDF 不动
- **多次 Run 不污染历史**——artifact hashes 累积在 PG 数组里，PM tree 只显示当前；contribution DAG 自动有"哪个 user 在哪个 commit 触发了哪次 Run"
- **iframe 安全边界紧**——sandbox 无 `allow-same-origin`、postMessage 严格 origin、5 分钟 JWT、5 MB artifact 上限
- **Pyodide-inline 升级路径**——把 kernel 字段切到 `'pyodide-inline'`，artifact 流走同一 endpoint；只换 NodeView，不动数据模型

### Bad / Trade-offs

- **molab 是外部依赖**——他们改 embed contract / 倒闭，iframe 协议要再适配；fallback `marimo-server` 已在 schema（kernel 字段），但运营成本（Phase 3 起评估）
- **5 MB artifact 上限会卡 paper 里的高分辨率 plot / 大型 DataFrame** —— Phase 2 用户须显式 caption + downscale；Phase 3 multi-part upload + S3 direct PUT
- **同一 cell 多人同时点 Run** —— 当前协议没有 mutex，最后写入赢；UI 层加 "running by X..." 提示（参考 Provenance.in-flight Y.Map），但 race 不致命（每次 Run 各自一个 cellEvalId，artifact 不互覆盖）
- **执行权限模型 vs reviewer**——reviewer 默认不能跑 cell（防止 reviewer 用 paper 的 dataset 做无关计算消耗 quota），owner 须显式 grant `cell.execute:<cellId>`；这个 capability 在 ADR-0002 §2.1 还没注册，Phase 2 W1 加

### Neutral / Need watching

- **iframe 通信延迟**——postMessage 是同步进程间，延迟 < 1ms；瓶颈在 base64 序列化（5 MB artifact ~6.7 MB base64 字符串 ~30ms）。Phase 2 实测后定 transfer 模式（base64 vs ArrayBuffer transferable）
- **figure attrs 加 sourceCellId / artifactHash** wire format bump v1.0 → v1.1（ADR-0005 §2.4）；reader 兼容但 v1.1 server 写出的 figure，v1.0 reader 看不到 attrs 里的引用关系。Phase 2 W4 实施时同步 bump 全栈。

---

## 4. Alternatives considered

### A: 新 PM node type `computational-output`

每个 output 是独立 node type：`{ type: 'computational-output', attrs: { sourceCellId, artifactHash, mime } }`。子节点是 `<image>` 或 `<json-table>` 等。

**为什么不选**：

1. 每个 emitter（HTML / JATS / MyST / Typst / docx / pdf）都要加新 case
2. 投稿格式（JATS）没有"computational output"，必须 fallback 到 `<fig>` —— 等于绕一圈又回到 figure
3. 用户期望"一个图就是一个图"，再多分两类徒增认知负担

**什么情况会回头**：Phase 3 出现 interactive figure（plotly / observable），普通 `<image>` 渲染丢失互动性。那时候新 node type 表达"这是 interactive 不是 raster"，与本 ADR 的 figure-with-source 共存。

### B: cell 与 output 都在一个 atom block 里（NodeView 内嵌图）

`computational-cell` node 自己渲染 source + last-output；不在 PM tree 里有独立 figure node。

**为什么不选**：

1. 导出 PDF / docx 需要图与 caption；NodeView 内嵌图导出时要嵌套渲染逻辑
2. 同一 figure 不能被多个段落 reference（"见图 1"）—— 引文锚点丢失
3. 用户改 caption 文字得在 NodeView 里改，不能用 prosemirror 命令；不符合"所有内容都是 PM document"的一致性

### C: WebSocket / SSE 替代 postMessage

iframe 通过 WebSocket 直连后端（不经主页面）。

**为什么不选**：

1. iframe 与主页面共用浏览器 process —— postMessage 同步进程，开 WS 又一次三次握手 + TLS，无收益
2. 鉴权流多一段（iframe 自己 issue JWT 再连 WS）；postMessage 让主页面持有 token 是更紧的安全边界
3. molab 不一定支持 outbound WS 到我们的后端

### D: 直接用 iframe 的 fetch（CORS）替代 postMessage

iframe 自己 fetch `/api/document/<docId>/cell/<cellId>/artifact`。

**为什么不选**：CORS 需要给 molab.org 加 `Access-Control-Allow-Origin: https://molab.org` —— 等于把后端 API 暴露给整个 molab 用户群，而不仅是我们的 cell。postMessage + JWT 把"哪个 cell 的产物"绑死。

---

## 5. Decision log（决策过程中的关键讨论）

- **2026-05-09**: 选 figure-with-sourceCellId（B 选项）over 新 PM node type，理由是 emitter 复用 + JATS 兼容 + 用户认知一致
- **2026-05-09**: 5 MB artifact 上限来自 base64 over postMessage 的实测延迟预算（~30ms 序列化是用户可感知上限）；Phase 3 multi-part 解锁
- **2026-05-09**: cell.execute 走 5 分钟 JWT 而非主页面 cookie，因为 iframe 被刻意 sandbox 不传 cookie；JWT secret 复用 SYNC_TOKEN_SECRET，audience='cell-runtime' 区分
- **2026-05-09**: `cell.execute:<cellId>` 新 capability 走 resource-scoped；不进 paper-author bundle 默认（默认认 owner-only），reviewer 须 explicit grant

---

## 6. References

- ADR-0001 §5 §2.3.5（ComputationalCell schema 预留）
- ADR-0002 §2.1（agent.invoke:custom + capability 命名）
- ADR-0003 §2.11（kernel = molab 默认；Pyodide-inline 留 Phase 3）
- ADR-0004 §2.2（SYNC_TOKEN_SECRET reuse），§2.4（CSP frame-src molab.org）
- ADR-0005 §2.4（PM JSON wire format minor bump）
- `plan0/phase-2-plan-stub.md §3.2`（开放问题，本 ADR 答）
- Marimo embedding docs: https://docs.marimo.io/guides/publishing/embedding/
- `packages/editor-core/src/extensions/computational-cell.ts`（Phase 1 D10 占位）
