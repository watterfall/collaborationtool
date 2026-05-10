# ADR-0013: ModelProvider 抽象 + BYO 模型 + 配置存储

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 3 W7
- **Deciders**: tech-lead
- **Gated on**: Phase 3 W7 dogfood gate（用户能切 Anthropic / OpenAI-兼容 / Ollama 三种 provider 跑 citation agent equivalent）

---

## 1. Context

### 1.1 起因

essay §11.5 反对长期模型锁定。Phase 1 + Phase 2 + Phase 2.5 的
ai-runtime 都直接 `import Anthropic from '@anthropic-ai/sdk'` 并把
client 实例当 `AgentPluginInput.anthropic` 字段传下去（`null` = mock）。
这把架构与 Anthropic SDK 绑死。

Phase 3 §一 维度表 + §二 §2.6 列了 BYO 模型（local Ollama / 自托管
OpenAI-兼容 / custom HTTP）作为目标。本 ADR 设计 ModelProvider 抽象
+ 配置存储 + 各 provider 适配层。

### 1.2 与既有 ADR 的关系

- ADR-0003 §2.x 锁定 Anthropic 作为 Phase 1 默认 LLM；本 ADR **不撤回**
  Anthropic 默认，只是把它降级为 1 of N provider
- ADR-0010 plugin manifest 已有 `runtime.target` / `tools[]`，但没
  `modelProvider` 字段——本 ADR §2.4 加（可选；未声明时 host 用 user
  默认）
- ADR-0008 long-horizon agent 由 apps/agent-worker 跑，每 job 都需 spawn
  Anthropic client 实例；本 ADR §2.5 让 worker 用 ModelProvider 抽象

### 1.3 哲学约束

1. **避免锁定** → 用户必须能切到本地 Ollama / 自托管 endpoint
2. **避免过度兼容性** → 不为每家 provider 写完整适配；只支持 4 类
   wire format（Anthropic / OpenAI-compat / Ollama / custom HTTP）
3. **新技术敢上** → Ollama 0.x 接受不稳定；用户自负
4. **平台性** → 第三方 plugin 不能强制 user 用某 provider；plugin 可
   声明偏好但 user 配置最终生效

---

## 2. Decision

### 2.1 ModelProvider 接口

```ts
export interface ModelProvider {
  /** Stable id, e.g. 'anthropic' / 'openai' / 'ollama' / 'custom-{slug}' */
  id: string;
  /** Human-friendly label for UI. */
  label: string;
  /** Wire format dispatch family. Determines which adapter handles
   * tool-use / streaming / system prompt. */
  wireFormat: 'anthropic' | 'openai-compat' | 'ollama' | 'custom-http';
  /** Run a single agent invocation (replacing runAnthropicAgent in
   * the existing API; runMockAgent stays). */
  runAgent(input: ProviderRunInput): Promise<AgentProposal>;
  /** Optional capability advertisement: which features the provider
   * supports. Plugin manifests can declare `requires_provider_features`
   * and host filters at install time. */
  features: ProviderFeatures;
}

export interface ProviderFeatures {
  toolUse: boolean;          // tool/function calling
  streaming: boolean;        // SSE-style token stream
  systemPrompt: boolean;     // top-level system prompt
  jsonMode: boolean;         // forced JSON output
  visionInput: boolean;      // image messages
  /** Approximate context window in tokens; not enforced, but used by
   * plugins to decide whether to chunk a long doc. */
  approxContextTokens: number;
}

export interface ProviderRunInput {
  modelId: string;            // provider-specific (e.g. 'claude-sonnet-4-6' / 'llama3.1:70b')
  systemPrompt: string;
  skill: SkillMeta;
  mcp: McpServerSet;
  passage: string;
  hints?: Record<string, unknown>;
  agentId: PrincipalId;
  actorPrincipalId: PrincipalId;
  // existing knobs
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  userInstruction?: string;
}
```

### 2.2 内置 4 个 wire format adapter

| ID | wireFormat | Target 服务 | Phase 3 W7 实施 |
|---|---|---|---|
| `anthropic` | `anthropic` | api.anthropic.com (Phase 1 默认) | ✅ 必做 |
| `openai-compat` | `openai-compat` | OpenAI API + Together / Groq / 自托管 vLLM | ✅ 必做 |
| `ollama` | `ollama` | localhost:11434 / 自托管 Ollama | ✅ 必做（local-first 关键） |
| `custom-{slug}` | `custom-http` | 用户填写 endpoint + headers + request shape | ⚠ 仅 admin 配置（Phase 3 实施 stub，Phase 4 完成） |

每 adapter 实现 `ModelProvider` 接口；`runAgent` 内部把
`ProviderRunInput` 转为该 wire format 的 messages + tools 协议，跑
tool-use loop（与 Phase 1 `runAnthropicAgent` 对齐结构），最后输出
`AgentProposal`。

**rejected**:
- Vercel AI SDK / LangChain 抽象 → 太重 + 自带 dispatch；与本架构
  AgentPluginModule 模型重复；user 哲学"避免过度兼容性"反对
- LiteLLM proxy → Python 进程 + 又一层依赖；自托管用户不想多装

### 2.3 配置存储：双层（user-level + per-doc override）

```sql
-- user-level 偏好（每 principal 一行）
CREATE TABLE user_model_pref (
  principal_id text PRIMARY KEY REFERENCES principal(id) ON DELETE CASCADE,
  default_provider_id text NOT NULL,    -- 'anthropic' | 'openai' | ...
  default_model_id text NOT NULL,        -- 'claude-sonnet-4-6' | 'llama3.1:70b' | ...
  custom_endpoint_url text,              -- 仅 wireFormat='custom-http' 时用
  custom_headers jsonb,                  -- 同上
  api_key_secret_id text,                -- 引用 server-side keystore；从不存明文
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- per-doc override（少数场景）
CREATE TABLE document_model_override (
  document_id text NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  agent_kind text NOT NULL,              -- 'reviewer' | 'researcher' | 'editor' | ...
  provider_id text NOT NULL,
  model_id text NOT NULL,
  PRIMARY KEY (document_id, agent_kind)
);
```

**API key 存储**：API key 不进 PG 明文。Phase 3 选项 A：env 变量
（self-host 友好）；选项 B：server-side keystore（dev-only stub，Phase
4 真做）。倾向 A——A self-host 简单；B 引入 keystore 维护负担。

**rejected**: 把 API key 存浏览器 localStorage → 跨设备同步麻烦；
泄漏面更大（比 server env 多一个）；user 哲学"安全第一"反对。

### 2.4 Plugin manifest 加 `modelProvider` 偏好（可选）

```yaml
# plugin.yaml extension
prefers_provider:
  features:
    - toolUse        # 该 plugin 必须 provider 支持 tool-use
    - jsonMode
  # 可选，用户配置覆盖
  hint:
    provider_id: anthropic
    model_id: claude-sonnet-4-6
```

`features[]` 是硬约束（host 验证 user 选的 provider 满足，不满足拒
invocation）；`hint` 是软偏好（仅 UI 显示给用户参考）。

### 2.5 Worker / route invocation 升级

`apps/agent-worker` + apps/web `/api/agent/invoke` 当前传
`anthropic: Anthropic | null`。本 ADR 要求改成：

```ts
// before
invokeAgentViaPlugin({ ..., anthropic, modelId })

// after
invokeAgentViaPlugin({ ..., provider, modelId })
// where provider: ModelProvider — host 解析 user_model_pref + override
```

`AgentPluginInput.anthropic` → 改为 `AgentPluginInput.provider`（加上
`provider.features` 让 plugin 内部判断该走 Anthropic 路径还是 OpenAI
路径——但绝大多数 plugin 不该关心，应直接调
`provider.runAgent(...)`）。

**Migration**: Phase 3 W7 一次性切换；不留 dual-path（user 哲学"避免
兼容性"）。citation-agent / inline-editor / reviewer / researcher 4
plugin 同步改 4 处 `runAgent` body。

### 2.6 W7 dogfood gate criteria

参考 ADR-0010 §2.7 / ADR-0012 §2.6 模式：

1. **同 plugin 跑 3 provider 输出 equivalent**：citation-agent 用
   anthropic + openai-compat + ollama 三种 provider 跑同一 passage，
   `proposalRationale` / `revisedFragments[].replacementText` /
   `toolCalls` shape 等价（具体值可不同，因为 LLM；但 schema 必须 valid）
2. **provider features hard-constraint 真生效**：plugin 声明 `features:
   [toolUse]`，user 配置 ollama-without-tool-use → host 拒 invocation
3. **per-doc override 真生效**：用户配 doc-A 默认 anthropic + doc-B
   override 为 ollama → 同 user 调 doc-A 走 anthropic / doc-B 走 ollama；
   audit log 区分

不通过 → 停止 W8，重新设计 ADR-0013。

---

## 3. Consequences

### 3.1 正面

- 用户从 Anthropic-only 解放（essay §11.5 反锁定承诺兑现）
- Local Ollama 跑通 = 完全离线 dogfood 可能（隐私场景关键）
- 企业自托管 vLLM / 自家 OpenAI-compat endpoint 直接接入
- Plugin 与 provider 解耦 → Phase 4 加新 wireFormat 不影响 plugin code

### 3.2 负面

- ai-runtime 多 4 个 adapter 文件；测试矩阵 ×4
- API key 存储路径选 env-only 简化但 multi-tenant SaaS 模式难承（
  Phase 4 评估真 keystore）
- 用户配置 UI 增加 onboarding 复杂度（首次启动必须选 provider）
- 各 provider tool-use 协议差异不小：Anthropic `tool_use` block / OpenAI
  `function_call` legacy + `tools` 新版 / Ollama 0.x 仍 best-effort

### 3.3 长期债

- Vision input / streaming / 1M context 等 feature flag 矩阵 Phase 4
  完整化
- API key 真 keystore（Vault / AWS KMS / GCP Secret Manager）Phase 4
- per-org / per-team default（多 user shared key）Phase 4
- 通用 Tool-use 协议中间语（避免每 adapter 重写 schema 转换）Phase 4

---

## 4. Alternatives considered

### 4.1 用 Vercel AI SDK 抽象（rejected）

**拒绝**：SDK 自带 dispatch + streaming + tool 协议，与本架构
AgentPluginModule + runAgent 模型重复；引入第二个抽象造成困惑；
user 哲学"避免过度兼容性"反对。

### 4.2 LangChain（rejected）

**拒绝**：太重；agent 抽象与本架构 plugin 系统不兼容；社区维护漂移
快；安全审计面大。

### 4.3 LiteLLM 反向代理（rejected）

**拒绝**：Python 进程 + 多一层依赖；self-host 用户不想再装一个；
延迟 + observability 反向代理也加成本。

### 4.4 让 plugin 自己挑 provider（rejected）

**拒绝**：user 失去配置权；plugin 越权选模型违反 axis 5（开放平台 +
用户主权）。

---

## 5. Open questions（W7 实施时落实）

- **API key env 命名规范**：`<PROVIDER>_API_KEY` 还是
  `MODEL_PROVIDER_<id>_API_KEY`？倾向后者（统一 prefix 便于自动 redact）
- **Ollama 默认 endpoint**：`http://localhost:11434` 还是允许 user 改？
  倾向允许改（self-host 用户可能 Ollama 跑别处）
- **provider health check**：启动时探活 + 失败时降级到下一个？还是
  invocation 时再失败？倾向 invocation 时失败（避免启动慢）
- **token budget enforcement**：本 ADR 不涉及；Phase 4 ADR-0014 加
  cost / quota
- **A/B 同 plugin 不同 provider 比较 UI**：Phase 4 ResearcherAgent 需要时再加

---

## 6. 与其他 ADR 的关系

- **ADR-0003**: 主线 LLM 不再是 Anthropic-only；review log 加 Phase 3
  W7 决策注（Anthropic 仍是默认，但是 1 of N provider）
- **ADR-0008**: apps/agent-worker 用 ModelProvider 抽象；reviewer/
  researcher 真跑（Phase 2.5 ⏸ 项）走这条路打开
- **ADR-0010**: plugin manifest schema 加 `prefers_provider`；W4 W5
  inline-editor / citation 切到 ModelProvider 路径
- **ADR-0012**: API key 不进 plugin sandbox env；host 进程持有，plugin
  调 ai-runtime → ai-runtime 调 provider（plugin 无 outbound 直连）

---

## 7. Review log

### Phase 3 closeout（2026-05-10，branch `claude/phase-3-to-phase-4-antaC`）

Phase 3 W7 4 wireFormat adapter 全部交付（types 稳定 + 网络 dispatch
+ 单元测试覆盖）。dogfood gate（真 endpoint 验证）推 Phase 4：

- `packages/ai-runtime/src/providers/`：
  - `anthropic.ts`（Phase 3 commit `e93fb78`）— 走 `@anthropic-ai/sdk`
  - `openai-compat.ts`（closeout）— `/v1/chat/completions` + tool-use
    loop；429 → `rate-limited`；401/403 → `auth-failed`
  - `ollama.ts`（closeout）— `/api/chat` + Ollama 0.3+ tool_calls；404 →
    `config-invalid`（"模型未 pull"）；默认 endpoint `http://localhost:11434`
  - `custom-http.ts`（closeout）— escape hatch；user 提供 `serializeRequest`
    + `parseResponse` callback；可选 toolCalls 循环
- `user_model_pref` + `document_model_override` PG 表 已落（migration
  0010）；查找优先级 document_model_override → user_model_pref → ENV
- API key 安全策略：表内只存 `api_key_env_var`（指向 host env 变量名），
  不存原始 secret（ADR-0013 §2.6 落地）
- `model_provider_wire_format` enum 在 PG 与代码同源（4 档对齐 WireFormat
  union type）
- 单元测试：11 项 stub-fetch 覆盖（OpenAI happy + tool-use loop + 429；
  Ollama 默认 / custom endpoint / 404 / JSON 解析；custom-http 配置校
  验 + single-shot + tool-use 循环）

仍开放（Phase 4 dogfood gate 必答）：

- 真 endpoint round-trip 实测：vLLM + DeepSeek + OpenRouter（OpenAI-compat），
  本机 Llama 3.1 / Qwen 2.5（Ollama），corp gateway（custom-http）
- plugin manifest 加 `prefers_provider` 字段 + apps/web settings UI
- per-org keystore（多 tenant SaaS 部署）升级路径：env-var 不够时切 KMS
- A/B 同 plugin 不同 provider 输出对比 UI（Researcher 跨 provider）
- §5 5 个开放问题最终答案（API key naming / Ollama endpoint / health check /
  token budget / A/B UI）

Status 维持 **Proposed**；Phase 4 W2 dogfood gate（4 wireFormat 真
round-trip + plugin manifest prefers_provider 落地）通过后 promote
Accepted。

## Phase 4 W2 Implementation Review Log（settings UI 半交付）

Phase 4 W2 backend（4 adapter + 4 档 resolver；commit a5b277c + ebfa934）
+ settings UI（this commit）覆盖了 user_model_pref CRUD + ENV-default
状态可见性；dogfood gate（4 wireFormat 真 endpoint round-trip）仍
require API key + 真服务。

UI（apps/web）：

- `/(app)/settings/models` Server Component：
  - **环境兜底**只读卡片：显示 ANTHROPIC_API_KEY 是否配置 + default
    modelId（`claude-sonnet-4-6`）
  - **我的偏好**列表：每行展示 wireFormat / providerId / modelId /
    endpoint / api-key env var；env var 是否在 host 进程已设以
    `✓` / `⚠ 未设` 实时反馈
  - **添加偏好**表单：`providerId` / `wireFormat`（4 wireFormat 下拉）/
    `modelId` / `endpointUrl` / `apiKeyEnvVar` / `label`
- 删除 = `DELETE /api/settings/models/<id>` + revalidate

API（apps/web）：`GET/POST /api/settings/models` + `DELETE` 删除

共享 lib（`apps/web/src/lib/byo-model.ts`）：

- `validateModelPrefInput(raw)` —— 纯校验 verdict：providerId / modelId
  required / wireFormat ∈ 4 / endpoint required for non-anthropic /
  endpoint http(s) 校验 / api-key env-var 名形如 `[A-Z_][A-Z0-9_]*` /
  extraHeaders 字典型校验
- `WIRE_FORMAT_DEFAULTS` —— 4 wireFormat 的 placeholder 提示用默认值
- `isEnvVarSet(name)` —— host 进程 env 探测；UI 用来标"已配置"

**安全模型**（落地 ADR-0013 §2.6）：

- `user_model_pref.api_key_env_var` 列只存环境变量名（如
  `OPENROUTER_API_KEY`），密钥本身从不入 PG
- UI 不显示密钥值；只显示 env var 名 + 是否 set
- 切多 tenant SaaS（per-org keystore）走 KMS 是 §5 仍开放项

测试（apps/web）：13 项覆盖 happy（4 wireFormat × validate）+ trim 行为
+ extraHeaders + 8 拒绝路径；全 workspace typecheck PASS。

**dogfood gate 残项**：4 wireFormat 真 endpoint round-trip（vLLM /
DeepSeek / OpenRouter / Ollama / corp gateway）+ tool-use 兼容矩阵 +
plugin manifest prefers_provider 真 dispatch 测试 —— 都 require API
key + 真服务环境，推 W2 末。
