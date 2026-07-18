# ADR-0025: Contribution Claims & Attestations — 协作贡献信用与验证协议

- **Status**: Proposed
- **Date**: 2026-07-18
- **Phase**: 6 post-Wave A4（Bridge 垂直切片前置设计）
- **Deciders**: tech-lead (jili)
- **Gated on**:
  - ADR-0021 vault-native Night 垂直切片已 landed —— ✅ 6 kind capture + vault round-trip
  - G-C1 Night 私密贡献声明：本地签名、零网络、篡改可检出
  - G-C2 Bridge 双人协作：claim → acknowledge / challenge 真闭环
  - G-C3 Agent 责任链：agent / operator / approver 三主体不混写
  - G-C4 Public receipt：离线 verifier 可验内容签名 + inclusion proof + signed checkpoint
  - ADR-0020 G-T6：30 天内 ≥10 个含 ≥2 contributor 的 artifact

---

## 1. Context

### 1.1 当前系统把五个不同问题都叫作 contribution / provenance / verification

仓库已经有五组真实机制，但它们的语义不同：

| 当前对象 | 当前职责 | 能证明 | 不能证明 |
|---|---|---|---|
| `contribution` PG row（ADR-0001） | 已接受的 PM/Yjs commit unit | 哪个 principal 提交了哪些二进制变更 | 这次变更属于哪类知识贡献、归属是否公平 |
| `provenance` PG row | actor / agent / input / tool / approval 元数据 | 变更或 agent proposal 的生成路径 | 贡献者本人是否认领、其他参与者是否承认、结果是否正确 |
| `ContributionGraph`（ADR-0020） | discovery role + contributor + timestamp 的类型契约 | 反 first-author 的展示形状 | 尚未挂入 artifact、未签名、未持久化、不可争议 |
| claim / open peer review | 对 claim 或公开对象给 verdict | 某 reviewer 表达了 endorses/challenges/refines | reviewer 的身份 token 是否签了 verdict/body；能否复现结论 |
| open-content signature + `provenance_merkle_log` | 公开 payload integrity + 线性 prev 索引 | payload hash / signature / 当前数据库结构异常 | 完整 transparency：外部 inclusion/consistency proof、尾部截断、整体重写 |

这不是“少几个字段”，而是概念边界缺失。继续把 `ContributionGraph` 塞进 jsonb 会让：

1. 编辑事实被误当成知识贡献；
2. 自我声明被误当成共同认可；
3. 身份认证被误当成内容签名；
4. 密码学完整性被误当成科学真实性；
5. 服务器内部链检查被误当成独立 transparency proof。

### 1.2 关键定义

> **贡献不是系统推断的事件记录，也不是作者自填的角色标签；贡献是一项可签名、可回应、
> 可争议、可独立验证、可撤回但不可删除的声明。**

本 ADR 引入 `ContributionClaim` 与 `Attestation` 作为 Night / Bridge / Day 的窄腰协议，
不替换现有 operational contribution / provenance / review / open-content 表。

### 1.3 当前实现中的两个紧急语义边界

#### ORCID 身份 token ≠ review 内容签名

`apps/web/src/app/api/claim/[claimId]/review/[reviewId]/sign/route.ts` 当前接收 ORCID
`id_token`，并把 token 写进 `signed_payload_jws`；代码注释也明确 verify-on-write 仍在
dogfood gate。OIDC token 可证明“ORCID 在某时向某 client 认证了此 subject”，但 token
并未覆盖 review 的 verdict / body / evidence refs。

本 ADR 要求拆为两项：

- `IdentityBindingAttestation`：ORCID-issued token，经 JWKS / issuer / audience / nonce / exp 校验；
- `ContributionAttestation`：贡献者 vault Ed25519 key 对具体 statement digest 签名。

两者可组合提高 assurance，但任何一项都不能冒充另一项。

#### 当前 `provenance_merkle_log` ≠ 完整 transparency log

当前实现是 `prev_entry_id + entry_seq + content_hash + payload signature`：

- `content_hash` 绑定实体 payload；
- `prev_entry_id` 是数据库结构字段，没有进入 signer 所签 payload；
- 没有 signed tree head / tree size / Merkle root；
- 没有 inclusion proof / consistency proof；
- 没有外部 witness 记住 checkpoint。

因此当前 worker 能发现拿到的行集合中的断链、fork、双 genesis、重复序号；但只凭当前
数据库快照，不能可靠发现管理员重写整条结构或截断尾部。本 ADR 不否定现有签名与巡检价值，
只收紧它的公开语义。

### 1.4 与既有 ADR 的关系

| ADR | 本 ADR 的关系 |
|---|---|
| ADR-0001 | 保留 `contribution` 为 operational commit；不改成 scholarly credit object |
| ADR-0008 | agent provenance 成为 claim evidence；agent/operator/approver 分离 |
| ADR-0011 | claim/evidence 是 Day 知识对象；verification attestation 可引用它们 |
| ADR-0015/0016 | ORCID 只负责 identity binding；review 内容另签；withdraw 改为追加事件 |
| ADR-0017/0021 | vault 是私密 artifact / attestation 的权威；PG 是分享/公开 projection |
| ADR-0018 | 保留 Ed25519 + public verifier；公开日志语义升级为 receipt/checkpoint 模型 |
| ADR-0020 | 落实 contribution-graph，但把 list 升级为声明/回应 DAG，三层同协议不同 policy |

### 1.5 ADR moratorium 例外

`phase-6-plan-stub.md` 允许“视具体痛点起草的 ADR”。本 ADR 的触发不是抽象扩张：

- ADR-0021 已把 Night artifact 真落 vault；
- contribution graph 仍只是 type-only list；
- claim-review ORCID token 与内容签名语义发生真实错位；
- open-content worker 已 landed，暴露出 structural check 与 transparency proof 的边界。

因此本 ADR 是已落地机制之间的窄腰修正，不启动数据库 migration，不解除 ADR-0020 dogfood gate。

---

## 2. Decision

### 2.1 五类对象严格分名

1. **Operational Contribution**：已接受的文档/CRDT 变更。现有 PG `contribution` 保持。
2. **Provenance Record**：变更如何产生。现有 PG `provenance` 保持。
3. **Contribution Claim**：某主体对某 immutable artifact version 的贡献声明。新增。
4. **Attestation**：某 issuer 对 claim 作认领、提名、承认、挑战、验证、撤回或取代。新增。
5. **Transparency Receipt**：公开 statement 被某 append-only log 收录的可验证回执。新增。

任何 API / UI 不得再用裸 `verified` 同时指代上述多项。

### 2.2 三本账 + 一层公共回执

```
Work evidence ledger              Credit ledger
────────────────────              ─────────────────────────
Yjs commits / revisions           signed ContributionClaim
agent runs / tool calls           acknowledge / challenge
high volume / mostly private      sparse / human-readable
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
              Verification ledger
              ───────────────────
              evidence check / reproduction
              success / partial / failed
                       │
                       ▼ public only
              Transparency receipt
              inclusion + checkpoint + witness
```

工作证据不是自动信用；信用不是自动真理；公开收录不是自动认可。

### 2.3 核心数据契约

以下是 feature ADR 锁定的语义形状；具体 package / DB migration 由实施切片决定：

```ts
type ArtifactLayer = 'night' | 'bridge' | 'day';

interface ArtifactVersionRef {
  artifactId: string;
  layer: ArtifactLayer;
  versionDigest: `sha256:${string}`;
  mediaType: string;
}

interface ExternalIdRef {
  scheme: 'orcid' | 'ror' | 'doi' | 'raid' | string;
  value: string;
  authenticatedAt?: string;
  issuer?: string;
}

interface PrincipalRef {
  principalId: string;
  kind: 'human' | 'agent' | 'organization' | 'service' | 'pseudonym';
  keyFingerprint?: `ed25519:${string}`;
  externalIds?: readonly ExternalIdRef[]; // ORCID / ROR / DOI / RAiD ...
}

interface ContributionRoleRef {
  scheme: 'discovery' | 'credit' | `plugin:${string}`;
  id: string;
}

type ArtifactSelector =
  | { kind: 'whole-artifact' }
  | { kind: 'block'; blockId: string }
  | { kind: 'json-pointer'; pointer: string }
  | { kind: 'text-quote'; exact: string; prefix?: string; suffix?: string };

interface EvidenceRef {
  id: string;
  digest: `sha256:${string}`;
  mediaType: string;
  availability: 'private' | 'collaborator' | 'public';
  uri?: string;
  description?: string;
}

interface ContributionClaim {
  schema: 'collaborationtool.contribution-claim/v1';
  id: string;
  artifact: ArtifactVersionRef;
  subject: PrincipalRef;             // 被声明为贡献者的人/agent
  roles: readonly ContributionRoleRef[];
  scope: readonly ArtifactSelector[];
  used: readonly EvidenceRef[];
  generated: readonly EvidenceRef[];
  changeDigest?: `sha256:${string}`;  // diff/patch digest，不等于 artifact digest
  note?: string;
  delegation?: {
    agentPrincipalId: string;
    operatorPrincipalId: string;
    approvingHumanId?: string;
  };
  recordedAt: string;                // actor clock，仅展示，不证明 priority
}

type ContributionAttestationKind =
  | 'claim'          // subject 自己认领
  | 'nominate'       // 他人提名 subject；未获 subject 签名不算认领
  | 'acknowledge'    // artifact steward / collaborator 承认范围
  | 'challenge'      // 对角色、scope、evidence 或身份提出异议
  | 'verify'         // 独立检查 activity/evidence/reproduction
  | 'withdraw'       // issuer 撤回自己先前声明
  | 'supersede';     // 新声明取代旧声明，不删除旧声明

interface AttestationStatement {
  schema: 'collaborationtool.attestation/v1';
  kind: ContributionAttestationKind;
  issuer: PrincipalRef;
  subjectClaimId: string;
  subjectClaimDigest: `sha256:${string}`;
  parents: readonly `sha256:${string}`[]; // 已知 causal heads 的 envelope digests
  targets: readonly `sha256:${string}`[]; // 被 challenge/withdraw/supersede 的 event；可为空
  issuedAt: string;
  authority: {
    kind: 'self' | 'collaborator' | 'artifact-steward' | 'delegated' | 'independent-verifier';
    evidence: readonly EvidenceRef[]; // capability/delegation/steward snapshot，可为空但会降低 assurance
  };
  verification?: {
    type: 'activity-observed' | 'evidence-checked' | 'reproduction-attempt';
    verdict: 'passes' | 'partial' | 'fails' | 'inconclusive';
    evidence: readonly EvidenceRef[];
    method?: string;
  };
}

interface SignedAttestation {
  statement: AttestationStatement;
  statementDigest: `sha256:${string}`;
  proof: {
    canonicalization: 'RFC8785-JCS';
    algorithm: 'Ed25519';
    verificationMethod: string;
    signature: string;
  };
}
```

`ContributionClaim.id` 是稳定的逻辑 ID，不承担内容寻址。`claimDigest = SHA-256(JCS(claim))`。
attestation 的签名输入是 `JCS(statement)`，`statementDigest` 必须与其 SHA-256 一致；事件文件名与
`parents[]` / `targets[]` 使用 `envelopeDigest = SHA-256(JCS(signedAttestation))`。这样 proof 不会进入
自己的签名输入，也不会出现 digest 自引用。`parents[]` 只表达因果知识，`targets[]` 才表达被挑战、
撤回或取代的具体事件。

### 2.4 版本绑定，不给可变 artifact“永久签名”

- claim 必须引用 immutable `versionDigest`；artifact ID 本身可继续演化。
- scope 必须是结构化 selector，不能只用自由文本 `scope?: string`。
- 修改角色、scope、subject、artifact version、evidence 任一字段都会改变 statement digest。
- 新版本继承信用必须显式 `supersede` 或新 claim；不得自动把旧签名漂移到新版本。
- `recordedAt` 是 actor clock，不证明首次发生时间；公开 witness 只能证明“不晚于 checkpoint time”。

### 2.5 Attestation 是 DAG，不是单一全局顺序

离线协作会产生并发声明。强制单链会把设备时钟和同步先后误当成 priority。

- 每条 attestation 是 immutable content-addressed event；
- `parents[]` 表达 issuer 已知的 causal heads；
- `targets[]` 表达语义作用对象，不能用 causal parent 暗示撤回/挑战目标；
- 合并规则是 set union + digest dedupe；
- 并发 acknowledge/challenge 可同时存在；
- UI 从完整 event set 推导当前 view，不 update 一行中央 status；
- `first-proposer` 可保留为历史 observation，但永不参与默认排序/评分。

`withdraw` 只能指向同一 issuer 的旧 event；`supersede` 必须列出被取代 event 并携带新 statement；
`challenge` 可指向 claim 或具体 attestation。缺少有效 target 的这三类事件可保留供审计，但不改变
derived view。

### 2.6 身份、签名与委托

#### Human / pseudonym

- vault Ed25519 key 是内容签名主体；默认可只显示 pseudonymous fingerprint。
- ORCID OAuth/OIDC 是外部身份认证，不签 artifact 内容。
- 经 ORCID token 真校验后，可由平台签发 `IdentityBindingAttestation`，把 ORCID iD 与
  vault key fingerprint 绑定；UI 必须显示 issuer（平台）和 assurance level。
- ROR 表示组织 affiliation，不表示组织认可某项贡献；组织认可需单独 attestation。
- key rotation / compromise / revocation 都是追加事件；旧签名按签署时有效性解释。

#### Agent

AI 不拥有可追责的社会身份，因此必须同时记录：

- `subject = agent principal`：实际产出主体；
- `operatorPrincipalId`：谁配置/触发/授权运行；
- `approvingHumanId`：谁接受结果（如有）；
- model/provider/prompt/tool/input digests：来自 ADR-0008 provenance；
- human approval 不把 agent contribution 改写成人类 contribution。

### 2.7 验证是向量，不是一个绿勾

```ts
interface ContributionVerificationView {
  integrity: 'unsigned' | 'signed' | 'publicly-witnessed' | 'invalid';
  identity: 'unbound' | 'local-pseudonym' | 'authenticated-external-id' | 'organization-attested';
  attribution: 'nominated' | 'self-claimed' | 'mutually-acknowledged' | 'contested' | 'withdrawn';
  evidence: 'private' | 'shared' | 'public-replayable' | 'unavailable';
  epistemic: 'unreviewed' | 'checked' | 'reproduced' | 'partial' | 'failed' | 'inconclusive';
}
```

推导 view 时：

- 密码学有效只影响 `integrity`；
- ORCID / ROR binding 只影响 `identity`；
- contributor + steward 双方 attestation 才可得 `mutually-acknowledged`；
- steward/collaborator 的 acknowledge 必须带可验证的 authority evidence；否则只显示“第三方回应”；
- 任一未撤回 challenge 使 attribution 至少显示 `contested`；
- `verify` 必须声明验证方法与证据，不能只发“已验证”；
- 不计算单一 trust score，不把复杂争议压成排行榜。

### 2.8 Night / Bridge / Day 同协议，不同 proof policy

| Layer | 默认策略 | 最小贡献证明 | 升级条件 |
|---|---|---|---|
| Night | private / local-only | 不强制 claim；用户主动认领时本地签名 | 分享时选择性带出 claim，不远程暴露私密 hash |
| Bridge | collaborator | claim + subject 签名；多人时请求 acknowledge/challenge | promotion 到 Day 前保留 unresolved disputes |
| Day | selectable/public | 贡献 statement + identity binding + evidence availability | publish 时生成 public receipt；验证结果与内容签名分开 |

三层“等价”指同样可归属、存档、引用、争议，不指相同公开度或相同证明负担。

### 2.9 Vault-native 存储

本地权威采用“一 event 一 content-addressed 文件”，不采用单 JSONL：

```text
<vault>/.vault/attestations/
└── <artifact-id>/
    ├── sha256-<claim-digest>.json
    ├── sha256-<ack-digest>.json
    └── sha256-<challenge-digest>.json
```

理由：

- 离线并发按文件集合合并，无 append lock / partial line；
- 内容地址与签名一一对应；
- 单 event 可选择性分享；
- `.vault/` 是控制面，artifact 正文仍是人可读 markdown；
- artifact frontmatter 的 `author` 暂保留为 convenience/legacy 字段，最终归属以 ledger 为准。

PG 只存 collaborator/public projection；用户 vault 仍是 ADR-0017/0021 的权威副本。

### 2.10 Canonicalization 与 proof envelope

- 新 attestation 使用 RFC 8785 JSON Canonicalization Scheme（JCS）。
- `schema` + canonicalization + algorithm 必须显式版本化。
- 不得静默改变 number/string/Unicode 规范化；升级需 `v2` 与 conformance fixtures。
- `ContributionClaim` 与 `AttestationStatement` schema 必须约束为 I-JSON；签名覆盖完整
  `AttestationStatement`，并通过 `subjectClaimDigest` 间接锁住 claim 的 subject、scope、roles、
  artifact digest 与 evidence digests。
- v1 verifier 对 statement 使用 closed schema（等价于 JSON Schema `additionalProperties: false`）；
  遇到未知字段或 schema/canonicalization version 必须 fail closed，而不是忽略后继续显示 verified。

### 2.11 私密数据与选择性披露

- private Night artifact 默认**不上传内容 hash**；低熵文本 hash 会遭字典猜测，时间戳也会泄露活动节律。
- 如果用户主动要求“证明早于某时存在”，采用随机 nonce 的 salted commitment；公开时再选择是否 reveal nonce。
- `EvidenceRef.availability` 是签名 statement 的一部分；公开 bundle 对 redaction 必须列出字段名与原因。
- 只公开 digest 不等于 evidence replayable；UI 必须显示 `private/unavailable`。
- signature/proof 文件不得包含原始 prompt、私密 input 或 vault 绝对路径。

### 2.12 公开 receipt 与 C2PA / VC 边界

公开 publication bundle 需要：

```ts
interface TransparencyReceipt {
  schema: 'collaborationtool.transparency-receipt/v1';
  hashAlgorithm: 'SHA-256';
  logId: string;
  entryDigest: `sha256:${string}`;
  logIndex: string;
  inclusionProof: readonly string[];
  checkpoint: {
    treeSize: string;
    rootHash: `sha256:${string}`;
    issuedAt: string;
    logSignature: {
      verificationMethod: string;
      signature: string;
    };
    witnesses: readonly {
      witnessId: string;
      observedAt: string;
      verificationMethod: string;
      signature: string;
    }[];
  };
  consistency?: {
    fromTreeSize: string;
    fromRootHash: `sha256:${string}`;
    proof: readonly string[];
  };
}
```

log signature 覆盖 `logId + treeSize + rootHash + issuedAt`；witness signature 覆盖同一 checkpoint
及自己的 `observedAt`。verifier 需支持 consistency proof，证明新 checkpoint 是已保存旧 checkpoint
的 append-only 扩展。至少一个平台外 witness 记住并签署 checkpoint，才能让平台事后整体重写可被发现。

- **W3C PROV**：内部概念映射（Entity / Activity / Agent / Role / Delegation）。
- **CRediT**：Day/public export 的 role vocabulary；不替代 discovery roles，不承担验真。
- **W3C VC**：跨系统携带 identity/contribution credential；“可验证”不等于 claim 为真。
- **C2PA**：最终 PDF/dataset/snapshot 的 content-binding 容器。多方自己签的贡献声明应作为
  gathered assertions 或独立 manifest 引用，不能由最终 publisher 冒充 created assertions。
- **Transparency log**：证明收录和 append-only consistency；不证明科学正确。

---

## 3. Consequences

### Good

- **语义诚实**：编辑记录、身份、贡献认领、同行承认、科学复现不再共享一个绿勾。
- **local-first 不被破坏**：Night 可仅本地签名；分享/公开是选择性 projection。
- **反 priority race 更彻底**：因果 DAG 保留并发，不把 server receive order 当功劳排名。
- **争议成为一等数据**：被遗漏者可自行发布 claim；steward 可 challenge 但不能删除。
- **AI 责任链清晰**：agent、operator、approver 均有独立角色。
- **标准可对接**：内部窄腰可映射 PROV / CRediT / VC / C2PA，而不受任一外部格式绑架。

### Bad / Trade-offs

- 事件数增加，derived view 比单行 status 查询复杂。
- 密钥轮换、撤回、identity binding expiry 需要 verifier policy。
- 双方不回应会产生长期 `nominated/unconfirmed` 状态；这是诚实成本，不自动抹平。
- 真 transparency log 比当前线性索引复杂，需要 checkpoint/witness 运维。
- contributor 需要理解“签名 ≠ 同意 ≠ 科学正确”的多层语言。

### Neutral / Need watching

- CRediT 与 discovery role 映射存在歧义，必须允许“无映射”而不是强塞。
- organization attestation 的 issuer trust policy 由 verifier 决定，本协议不建立全球 CA。
- collusion / honorary authorship 不能靠密码学消灭；只能保留可审计声明与异议。
- “影响力”是后验判断，不进入 signed contribution role，避免自我夸大变成硬事实。

---

## 4. Alternatives considered

### A: 直接把当前 `ContributionGraph` 存 jsonb

- 不选：仍是 unsigned list；没有 artifact version binding、回应、争议、身份 assurance。
- 回头条件：仅用于临时 UI prototype，且明确 Evidence Tier=`contract`，不得公开称 verified。

### B: 直接采用 CRediT 作为内部 schema

- 不选：CRediT 面向成熟研究产出，无法表达 metaphor/reframe/contradiction，也不验证角色真实性。
- 回头条件：Day 层 export adapter；不作为 Night/Bridge source of truth。

### C: 平台根据 diff / token / commit 数自动分配信用

- 不选：可测工作量不等于知识贡献；鼓励拆碎提交、文字膨胀和 agent spam。
- 回头条件：仅作私密 evidence suggestion，必须由 contributor 明确认领。

### D: 继续把 ORCID id_token 当作 review signature

- 不选：token 证明身份认证事件，不覆盖 verdict/body/evidence；字段名会误导外部 verifier。
- 回头条件：无。可复用 token 作为 IdentityBindingAttestation evidence。

### E: 用 C2PA 作为内部协作账本

- 不选：C2PA 擅长最终 asset binding，不擅长高频私密协作和多方争议 DAG。
- 回头条件：public export / packaged artifact 边界。

### F: 签每次 keystroke / Yjs update

- 不选：高频、隐私泄露、key 使用面扩大；工作证据账已能保存操作路径。
- 回头条件：特定受监管 workflow 明确要求且性能/密钥策略通过实证。

### G: blockchain / token reputation

- 不选：ADR-0018 去区块链决策不变；共识成本不解决 attribution 语义和科学真实性。
- 回头条件：无 token 路径；必要时可把同一 signed digest 投到多个普通 transparency witness。

---

## 5. Threat model 与三方风险

| 威胁 | 主要受害方 | 控制 | 残余风险 |
|---|---|---|---|
| contributor 虚假自我声明 | steward /读者 | subject signature + evidence + challenge | 签名不能证明声明为真 |
| steward 漏掉真实贡献者 | contributor | contributor 可独立 claim；记录 challenge，不可删除 | 发现/传播仍需社会机制 |
| honorary / ghost authorship | 读者 /机构 | scope + evidence + mutual acknowledgement 状态 | 参与者可合谋 |
| key compromise / rotation | contributor | key-binding / revocation event + signed-at policy | compromise 发现前的窗口 |
| server rewrite / tail truncation | 全部 | signed checkpoint + consistency proof + external witness | witness 全部合谋/离线 |
| device clock spoof | priority 认定 | causal parents；actor time 不作 priority proof | 无 witness 的本地历史无法证明真实早期时间 |
| agent work 洗成人类贡献 | 人类/读者 | agent/operator/approver 三主体强制分离 | operator 仍可能隐瞒外部 agent 使用 |
| 私密 hash 泄露 | Night contributor | private 不远程 hash；salted commitment opt-in | reveal 后可关联 |
| canonicalization drift | verifier | schema/version/JCS conformance fixture | 老 verifier 需维护 |
| attestation spam | collaborator | sparse claim UX、rate/capability gate、聚合视图 | 开放 public claim 仍需 moderation |

三方默认责任：

- **Contributor**：只签自己理解的 claim；不把 nomination 当认领。
- **Artifact steward**：可以 acknowledge/challenge，不拥有删除他人 claim 的权力。
- **Independent verifier**：说明 method/evidence/verdict；不得把身份/完整性检查冒充 reproduction。

平台是传输、索引和 policy executor，不是贡献真假的最终裁判。

---

## 6. 接受准则

### 6.1 Contract gates

- [ ] 改 subject / role / scope / artifact version / evidence 任一字段后签名失败。
- [ ] `claimDigest`、`statementDigest`、`envelopeDigest` 任一不匹配即拒绝；proof 不发生自引用。
- [ ] 同一 attestation 不能 replay 到另一 artifact/version。
- [ ] 未知 schema/canonicalization/critical field fail closed。
- [ ] concurrent events set-union 后不丢失 acknowledge/challenge 任一分支。
- [ ] withdraw/supersede 只追加，不修改/删除旧 event。
- [ ] withdraw 不是原 event issuer、或 challenge/withdraw/supersede 缺有效 target 时，不改变 derived view。
- [ ] ORCID token 的验证结果永不直接把 review content 标为 signed。

### 6.2 Night / Bridge behavior gates

- [ ] Night self-claim 写 `.vault/attestations/...`，网络请求数 = 0。
- [ ] Alice claim → Bob acknowledge 后 UI 显示 `mutually-acknowledged`。
- [ ] Bob 的 acknowledge 无有效 steward/collaborator authority evidence 时只显示“第三方回应”。
- [ ] Bob challenge scope 后 acknowledge 与 challenge 同时可见，view=`contested`。
- [ ] 第三人 nominate Carol，Carol 未签前不得显示 Carol self-claimed。
- [ ] artifact 新版本不自动继承旧 version 的签名状态。

### 6.3 Agent gates

- [ ] agent contribution 同时显示 agent principal + operator；human approval 另列。
- [ ] prompt/tool/input 只存 digest 与 disclosure policy，private 原文不入 public bundle。
- [ ] agent output 经 human accept 仍显示 origin=agent。

### 6.4 Public verification gates

- [ ] 离线 verifier 能验证 canonical content、contributor signature、key binding、receipt inclusion。
- [ ] verifier 记住旧 checkpoint 后能用 consistency proof 检查新 checkpoint。
- [ ] tail truncation / fork / wrong tree root / wrong witness signature 各有失败 fixture。
- [ ] server-summary-only bundle 永不返回 `independentlyVerified=true`。
- [ ] redacted evidence 声明字段与原因，不把 digest-only 显示为 replayable。

### 6.5 Dogfood gates

- [ ] 30 天 ≥10 个多 contributor artifact（复用 ADR-0020 G-T6）。
- [ ] ≥3 次真实 challenge/correction，不只 happy path acknowledgement。
- [ ] ≥2 个 agent contribution 完成三主体责任链。
- [ ] 用户能解释 UI 五轴中至少四轴差异；若仍理解成总分，必须重做 copy/IA。

---

## 7. Phase gate / 实施顺序

| Slice | 范围 | Evidence Tier 目标 | 不做 |
|---|---|---|---|
| V0 语义止血 | ORCID identity binding vs content signature 分名；公开状态 copy 收紧；ADR-0018 log 边界 | real/contract | 不改 PG 大 schema |
| V1 Night local | pure types + RFC8785 fixtures + local sign/verify + content-addressed files + viewer | real | 不联网、不做 CRediT |
| V2 Bridge two-party | claim/nominate/ack/challenge DAG + vault merge + agent delegation | real | 不做 reputation score |
| V3 public receipt | PG projection + signed checkpoint + inclusion/consistency proof + external witness | real | 不上链 |
| V4 export | CRediT mapping + W3C VC + C2PA gathered assertions | contract→real | 不把外部容器当内部 SoT |

**实施停线条件**：

- V1 若迫使 Night 每次捕捉都签名/填 role，立即退回“主动认领”动作；不能损伤 capture 低摩擦。
- V2 若离线并发需要中央总序才能合并，模型设计失败；回到 content-addressed event set。
- V3 若没有外部 witness，只能称 signed append index，不得称 independently witnessed log。
- ADR-0020 仍由 30 天 dogfood 决定是否 Accepted；本 ADR 不代替该结论。

---

## 8. Decision / review log 与 References

### Decision log

- **2026-05-12**：ADR-0020 提出 contribution-graph attribution，Evidence Tier=`contract`。
- **2026-07-18 A2**：ADR-0021 将 Night artifact 真落 vault，暴露 base 仍单 `author`、local provenance 仅 opaque id。
- **2026-07-18 A4**：public verifier + verify-merkle-log worker landed；结构检查与独立 transparency 的边界变得可审计。
- **2026-07-18 本轮**：代码审计确认 operational contribution / provenance / contribution graph / review / public signature 五种语义分裂；决定起草本 ADR。
- **关键反对意见 1**：模型太复杂。回应：复杂性本已存在，只是被一个 `verified` 隐藏；五轴 view 是防误读，不是用户每次都要操作五次。
- **关键反对意见 2**：为什么不等 30 天 dogfood 后再写。回应：不先定义 claim/attestation，就无法真实执行 ADR-0020 G-T6 多人贡献 gate；本 ADR 挡结论，不挡最小工具。
- **关键反对意见 3**：签名会把协作变官僚。回应：Night 不强制；签名发生在认领/分享/发布边界，不是每次编辑。

### Implementation review log

Status=`Proposed`；尚无实现。每个 V0-V4 slice landed 后追加：

- commit / touched files；
- contract/mock/real 分层；
- exact test totals；
- browser/vault/public verifier proof；
- 未通过的 gate 与 residual threat。

### 项目内部

- ADR-0001 Data model + CRDT split
- ADR-0008 Long-horizon agent runtime
- ADR-0011 Claim/Evidence knowledge objects
- ADR-0015 Open peer review + ORCID
- ADR-0016 Claim-on-Claim Review
- ADR-0017 Client-first runtime
- ADR-0018 Open content mechanisms
- ADR-0020 Night-Bridge-Day Triadic Architecture
- ADR-0021 Discovery-graph vault-native storage
- `packages/discovery-graph/src/contribution-graph.ts`
- `packages/open-content/src/public-provenance.ts`
- `apps/agent-worker/src/verify-merkle-log.ts`

### 外部标准 / prior art

- W3C PROV-O: https://www.w3.org/TR/prov-o/
- CRediT taxonomy: https://credit.niso.org/
- W3C Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model/
- C2PA Technical Specification: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html
- ORCID authenticated iD: https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/
- Sigstore Rekor transparency log: https://docs.sigstore.dev/logging/overview/
- RFC 8785 JSON Canonicalization Scheme: https://www.rfc-editor.org/rfc/rfc8785
