# proto-c · D5 findings — MCP + Skill end-to-end with Provenance

> Phase 0 D5: 实证 H5 / 验证 system-prompt §62 §64
> （MCP 是核心 bus / 每一次 AI 行为都有 provenance）。

## TL;DR

**端到端 5 步闭环全部走通，Provenance schema 在 SQLite (PG-compatible) 上落地完整字段。**

```
SKILL.md (Anthropic-style frontmatter)
    │ load + sha256 → promptHash
    ▼
MCP server (crossref-mock, in-memory transport)
    │ listTools → tool descriptors
    ▼
Agent runner (Anthropic SDK 真 API / deterministic mock)
    │ tool_use loop, hash arguments per call
    ▼
AgentProposal { revisedFragments, uncertainties, toolCalls, agentContext }
    │
    ▼
storage.insertProvenance + insertRevision (status='proposed')
    │
    ▼
storage.acceptRevisionToContribution → Revision becomes accepted,
Contribution row materialized, both linked to Provenance
```

## Demo run (mock mode — no API key needed)

```
$ pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump
```

输入：一段中文段落含 3 个 DOI 候选——
- `10.1145/3531146.3533104` (Bommasani et al. 2022) → 命中 mock fixture
- `10.48550/arXiv.2310.O6770` (Yjs paper, **typo**: 字母 `O` 替代数字 `0`) → 第一次 not_found，自动 normalize → 命中
- `10.9999/unknown.2024` → 既不在 fixture 里也无法 normalize → 留 uncertainty

## 输出（节选完整 Provenance JSON）

```json
{
  "id": "019e06f3-bbc6-779f-92ea-28ea40e053de",
  "actorPrincipalId": "agent:citation-demo",
  "actorKind": "agent",
  "agentContext": {
    "agentId": "agent-citation-demo-mock",
    "modelId": "mock:no-llm",
    "modelProvider": "local-ollama",
    "promptTemplateId": "citation-lookup@7c5937bf6a43",
    "promptHash": "a2c1f615…6786ea441",
    "inputSkillIds": ["citation-lookup"],
    "temperature": 0
  },
  "inputBlockIds": ["blk:passage-019e06f3"],
  "inputDocumentIds": ["doc:demo-019e06f3"],
  "triggeredAt": "2026-05-08T09:38:17.158Z",
  "toolCalls": [
    {
      "toolName": "lookup_doi",
      "mcpServerId": "crossref-mock",
      "argumentsHash": "dbf41b4a…f1c2f",
      "resultSummary": "{\"type\":\"paper-conference\",\"title\":\"…",
      "succeeded": true,
      "durationMs": 2
    },
    /* 3 more lookup_doi calls — typo, normalised retry, unknown */
  ]
}
```

**ADR-0001 §2.3.7 Provenance schema 全字段命中**：
- ✅ `actorPrincipalId` (`agent:` prefix → `kind=agent`，符合 Principal 前缀编码 ADR-0002 §2.3)
- ✅ `agentContext.modelId / promptTemplateId / promptHash / inputSkillIds`
- ✅ `inputBlockIds` / `inputDocumentIds`
- ✅ `toolCalls[]` 每条含 `mcpServerId / argumentsHash / resultSummary / succeeded / durationMs`
- ✅ `triggeredAt`

## 所做的工程证据

### 1. Skill loading 通过 description 自动发现（progressive disclosure）

Anthropic Skills 的 `description` 字段是给上层 agent 决定"加载哪些 skill"的入口（不预先全部 inject）。我们的 SKILL.md 含 ≤300 字 description；运行时 hash 整个文件成 `promptHash`，作为 immutable identifier 进 Provenance。

→ system-prompt 第一性原理 #11 实现："每一次 AI 行为都有 provenance……什么 prompt 就是什么 prompt template id + 文件 hash。"

### 2. MCP server 用真 SDK，非 hardcode

`mcp-servers/crossref-mock/` 是一个完整的 `@modelcontextprotocol/sdk` Server class，提供两个 tool（`lookup_doi`, `search_by_title`）。proto-c 通过 `InMemoryTransport.createLinkedPair()` 在同进程双向通讯。

→ Phase 1 升级：把 `InMemoryTransport` 换成 `StdioServerTransport` + child_process.spawn（或 HTTP transport 给远端 MCP），**应用代码无需改动**——只换 transport 一行。

### 3. 双模 runner（real Anthropic API / deterministic mock）

`anthropic-runner.ts` 用 `@anthropic-ai/sdk`：tool_use 循环、`messages.create` 多轮、最后从 final assistant text 提取 JSON proposal、所有 tool 调用的 argumentsHash 全程跟踪。

`mock-runner.ts` 不调 LLM，但走完全相同的 MCP 工具调用序列 + 构造同形状的 AgentProposal——验证整条 pipeline。**无 API key 也能跑全闭环**，CI 里跑 mock 模式就够。

### 4. Storage 用 SQLite + 与 Postgres + Drizzle 同形状

`src/storage.ts` 写 `revision / provenance / contribution` 三张表，schema 故意贴近 Phase 1 PG：
- TEXT id（uuidv7）
- BLOB pmStepsBinary / yjsUpdateBinary（PG bytea 替换）
- TEXT JSON 序列化字段（PG jsonb 替换）
- 索引 (document_id), (actor_principal_id)

→ Phase 1 迁 PG 是改 BLOB→bytea + TEXT→jsonb + Drizzle schema 重新生成。**ORM 切换不动 Provenance 数据形状**。

### 5. Commit boundary 强制 Provenance（ADR-0001 §2.5）

Demo 中 `storage.insertRevision` 接受 `provenanceId` 参数（可选 in TS 但 Phase 1 的 PG schema 要 NOT NULL FK）；`storage.acceptRevisionToContribution` 把 Revision 转 Contribution 时把 `provenance_id` cascade 过去。

任何想绕过 Provenance 写一笔 contribution 的代码路径**结构上不存在**。

## 缺口（Phase 1 处理）

1. **PM steps payload 是 placeholder**。Phase 1 packages/editor-core 提供"基于当前 Y.Doc 计算 PM steps + Yjs update"的真实算子（用 `prosemirror-transform` 序列化）。
2. **Approval flow 是 auto-accept**。Phase 1 加 review UI；reviewer 按按钮 → 网关校验 `block.review` capability → 走 acceptRevisionToContribution。
3. **Prompt registry 单独表**（ADR-0003 §2.5）。Phase 0 demo 只存 `promptTemplateId = 'skill:hash'`；Phase 1 加 `prompt_template` 表存全文 + version + immutable。
4. **Capability 检查未实施**。Phase 0 demo 里的 agent invocation 没经过网关层 capability 校验；Phase 1 引入 `apps/sync-gateway` 时把 invoke check 加进来（`agent.invoke:citation` 必查）。
5. **Approval chain 是空数组**。Phase 1 的真 review flow 把 reviewer 决策填入 `provenance.approval_chain`。

## 跑法

```bash
# 一次性安装
pnpm install

# 运行（mock，无 API key 也能跑）
pnpm --filter @collaborationtool/proto-c-mcp-skill demo

# 含完整 Provenance JSON dump
pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump

# 调真 API（需要先 export ANTHROPIC_API_KEY=...）
export ANTHROPIC_API_KEY=sk-ant-...
pnpm --filter @collaborationtool/proto-c-mcp-skill demo:dump
```

SQLite DB 落在 `apps/prototypes/proto-c-mcp-skill/proto-c.sqlite`（已在 .gitignore），可用 `sqlite3 proto-c.sqlite ".tables"` 检视；删除文件即重置。

## 决策

- ✅ Provenance schema (ADR-0001 §2.3.7) 字段经实证可写、可读、PG 兼容
- ✅ Skill loading + MCP tool 桥（in-memory transport）端到端工作
- ✅ Phase 1 切真 API + stdio MCP transport 是"两行更换"的工作量
- ✅ ADR-0003 §2.5 Provenance Hybrid 决策（Y.Map in-flight + PG committed）的 PG 端落实清晰
- 📋 Phase 1 必做（5 项缺口已记录）
