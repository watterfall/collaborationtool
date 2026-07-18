# ADR-0018: Open Content Mechanisms — Open Question / Dataset / Peer Review + Merkle-signed Provenance (DeSCI 去区块链)

- **Status**: Proposed
- **Date**: 2026-05-12
- **Phase**: 6 W2
- **Deciders**: tech-lead (jili)
- **Gated on**:
  - ADR-0017 client-first runtime（本 ADR 的 substrate）—— ⏳ Proposed 同期
  - `packages/identity/` ed25519 keypair 实施（Phase 6 W1-W2 同期）—— ⏳ 待落
  - dogfood gate G4（open question → stranger reply → owner accept）+ G8（DOI mint + Merkle log 完整）—— ⏳ Phase 6 W6-W7

---

## 1. Context

### 1.1 为什么现在决定

ADR-0017 把 truth 推到 client。**那么 server 还有什么独立价值？** spec §3 答案：**open content surface** —— DOI landing / share-link reader / inline comment / margin annotation / suggest-edit / open question feed / reviewer onboarding。这是 web client 在 client-first 架构下的唯一一等存在场景。

DeSCI 圈子在解决"开放科学"时大量走 token / NFT / DAO / on-chain 路径。user 在 spec §1 Q4 明确**排除**：

> "DeSCI 去区块链 —— Merkle log signed provenance + ed25519 而非 on-chain；排除 NFT / token / DAO"

本 ADR 把"开放科学"工程化为**4 个 entity + 1 个 provenance 模型**，证明不上链也可以做"防伪 provenance"。

### 1.2 与 ADR-0011/0015/0016 的关系

| ADR | 既有职责 | 本 ADR 的扩展 |
|---|---|---|
| 0011 Claim/Evidence | Day 层 atomic units + 6 finding kind | open dataset / open peer review 引 evidence；signed provenance 链 + Merkle log |
| 0015 ORCID OAuth + signed review | better-auth OAuth + JWS signing | open question stranger reply 触发；anonymous + ORCID 混合反馈 |
| 0016 Claim-on-Claim Review | Day 层 verdict / lineage / Reviewer Inbox | open project 走 ORCID-signed review；与 ADR-0015 共享 OAuth flow |

本 ADR **不重写** 上 3 ADR；仅在 server 加 4 个 entity 表 + 1 个 Merkle log。

### 1.3 Spike-2 实证

`packages/vault-fs/` (commit `6492b36`) 落地 emit / parse markdown + 3-way merge。本 ADR 的 F4 publish flow（spec §5）直接基于 spike-2 API：

```
publish flow:
  desktop emit markdown snapshot (Spike-2 emitMarkdown)
  + Y.Doc binary (Spike-2 sidecar + Y.encodeStateAsUpdate)
  + Merkle entry signed by ed25519 (本 ADR §2.4)
  → POST /api/publish
```

### 1.4 这是底层 Phase 6 锁定决策

严格度高（per template §1 提示）：
- ed25519 keypair 一旦生成不可换（用户身份绑定）—— passphrase-derived 备份必须 Phase 6 W1-W2 落
- Merkle log append-only 设计 —— 一旦 ship 不可补回历史
- "去区块链" 立场写入 ADR —— 长期不偏移

---

## 2. Decision

**4 entity + 1 provenance 模型，DeSCI 去区块链**。

### 2.1 `packages/identity/`（新建 package，Phase 6 W1-W2）

| 职责 | API |
|---|---|
| ed25519 keypair 生成 | `generateKeypair(): { publicKey, secretKey }` |
| Passphrase-derived 加密备份 | `encryptKeypair(kp, passphrase): EncryptedKeypair` + `decrypt...()`（argon2id KDF） |
| ORCID identity 链接 | `linkOrcid(publicKey, orcidId, jwsToken): IdentityRecord` |
| 签名 + verify helper | `sign(data, secretKey): Uint8Array` + `verify(data, signature, publicKey): boolean` |

存储：`~/MyVault/.vault/keys/`（per spec §3）：

```
keys/
├── ed25519.pub          # 公钥（明文）
├── ed25519.enc          # 加密私钥（argon2id + chacha20-poly1305）
├── orcid.link.json      # { orcid_id, signed_jws, signed_at } 
└── identity.json        # { publicKey, createdAt, derivation: 'argon2id' }
```

底层用 libsodium（`@noble/ed25519` + `@noble/hashes/argon2`）—— pure JS，零原生依赖，跨 Tauri 平台兼容。**不**用 secp256k1（与 Bitcoin / Ethereum 关联，避 DeSCI 误读）。

### 2.2 4 个开放 entity（PG schema, server-side）

| Entity | 表名 | 关键字段 |
|---|---|---|
| **Open Question** | `open_question` | id / asker_principal_id / asker_orcid_id? / question_md / domain_tags[] / status (open/answered/withdrawn) / source_subdoc_id? / signed_payload_jws / merkle_log_entry_id / created_at |
| **Open Dataset** | `open_dataset` | id / contributor_principal_id / dataset_doi? / title / description / blob_storage_ref / size_bytes / license_spdx / signed_payload_jws / merkle_log_entry_id / created_at |
| **Open Peer Review** | `open_peer_review` | id / reviewer_principal_id / reviewer_orcid_id / target_kind ('question'|'dataset'|'snapshot') / target_id / verdict (endorses/challenges/refines per ADR-0016) / body_md / evidence_refs[] / signed_payload_jws / merkle_log_entry_id / withdrawn_at? |
| **Share Snapshot** | `share_snapshot` | id / source_principal_id / source_subdoc_id / markdown_content / yjs_binary / kind ('section'\|'preprint'\|'dataset') / permalink_hash / doi? / signed_payload_jws / merkle_log_entry_id / created_at |

4 entity 共享 invariants：
- 每行 `signed_payload_jws` **必须** non-null（detached JWS over `{entity-id, content-hash, timestamp}` per RFC 7515）
- 每行 `merkle_log_entry_id` **必须** non-null，指向 `provenance_merkle_log` 表
- `withdrawn_at` 仅可 update 一次（mark-only，不删原 row）
- Signed payload 一旦写入 not editable —— edit 需 supersede pattern（旧 row 标 `superseded_by`，新 row 新签）

### 2.3 Merkle log（append-only signed provenance chain）

```sql
CREATE TABLE provenance_merkle_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prev_entry_id   uuid REFERENCES provenance_merkle_log(id),  -- chain link
  entry_seq       bigserial NOT NULL UNIQUE,                    -- ordering
  entity_kind     text NOT NULL,                                -- 'open_question' / ...
  entity_id       uuid NOT NULL,                                -- FK to one of 4 entity tables
  content_hash    bytea NOT NULL,                               -- sha-256 of canonical entity JSON
  signed_jws      text NOT NULL,                                -- detached JWS by author's ed25519
  appended_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_merkle_log_prev ON provenance_merkle_log(prev_entry_id);
CREATE INDEX idx_merkle_log_seq ON provenance_merkle_log(entry_seq);
```

**Anti-tamper invariants**：
- `prev_entry_id` 链式引用 + `entry_seq` 单调递增 + `content_hash` 防内容篡改
- 三 invariants 任一违反 → log corruption；nightly `verify-merkle-log.ts` worker（Phase 6 W7）扫描 + 报警
- 第三方独立可验证：拉取整张表 + 逐 row JWS verify + chain integrity check（不需访问 server 私钥）

**Why Merkle log NOT blockchain**：
- 性能：append-only PG table O(1) insert vs blockchain O(N) consensus；spec §1 Q4 显式排除 on-chain
- 用户友好：用户 ed25519 keypair 本地存 + ORCID 绑定 = identity；不需 wallet / gas fee / token
- 第三方 verify：拉 SQL dump 即可；不需运行 chain node

### 2.4 F4 publish flow 完整契约（per spec §5 F4）

```
1. Desktop:
   - vault-fs.emitMarkdown(subdoc.yDoc) → markdown_content
   - Y.encodeStateAsUpdate(subdoc.yDoc) → yjs_binary
   - canonical = JSON.stringify({entity-shape data, sorted keys})
   - content_hash = sha256(canonical)
   - signed_jws = identity.sign(canonical) 
   - payload = { kind, content, signed_jws, content_hash, prev_merkle_entry_id }

2. POST /api/publish:
   - server verify signed_jws via stored public_key (FK via principal_id → orcid → public key)
   - if invalid → 401
   - INSERT INTO share_snapshot (or open_question / open_dataset / open_peer_review)
   - INSERT INTO provenance_merkle_log
   - if kind ∈ {question, preprint}: server append to open_content_index (web feed)
   - if kind = preprint + DOI minting wanted: external CrossRef API call (Phase 6 W8)
   - return permalink + merkle_log_entry_id

3. Desktop:
   - .vault/published.yaml append { entity_id, permalink, merkle_log_entry_id, signed_at }
   - .vault/provenance.log append signed line (local audit trail)
```

### 2.5 F7 open question lifecycle（per spec §5 F7）

```
1. Desktop: 标 paragraph 为 open question + 写 ask body → publish flow §2.4 kind='question'
2. Server: /open feed shows question card
3. Stranger: web → ORCID OAuth (ADR-0015) → reply via inline editor (轻量)
4. Server: comment-store store reply with reply.linked_question_id
   + open_peer_review row（reviewer ORCID-signed）
5. Desktop owner: WS subscribe → pull reply
6. Owner: 选择 accept → Y.Doc edit + .vault/provenance.log sign + flush
   OR mark "interesting but not adopted" → annotation_thread link only
```

### 2.6 ADR-0016 Claim-on-Claim Review 联动

ADR-0016 `claim_review` 表是 **per-document Day-layer review**。本 ADR `open_peer_review` 是 **public surface review**（target 可以是 question / dataset / share-snapshot 任一）。两者**不重叠**：

| | `claim_review` (ADR-0016) | `open_peer_review` (本 ADR) |
|---|---|---|
| Scope | 特定 document 的 claim | 公开 share-snapshot / question / dataset |
| 签名要求 | ORCID-signed via JWS | 同 + Merkle log entry |
| Visibility | document ACL gated | always public (web feed) |
| Withdraw | yes (per §2.6 ADR-0016) | yes (mark-only) |

ADR-0016 review log（本 ADR Accepted 后追加）：明确二者非互斥；`open_peer_review` 不能"升级"为 `claim_review`（语义不同）。

### 2.7 Out of scope（显式排除）

per spec §13：
- IP-NFT / token economy / DAO / on-chain provenance（去区块链立场）
- E2EE 加密（spec §1 Q1，sync-gateway `cipher_mode` hook 已预留，Phase 7+）
- 跨设备 keypair 同步（用户自己手动备份 `.vault/keys/ed25519.enc`）
- Reputation 系统（user.trust_score 等）—— ORCID + Merkle log 即足够 provenance；声誉不工程化
- Auto-translate（cross-language review match）—— Phase 7+
- 自动 DOI mint（CrossRef API 集成推 Phase 6 W8 单独 ADR）

---

## 3. Consequences

### Good

- **去区块链 DeSCI**：避 token / wallet / gas 干扰；学者用 ORCID + ed25519 即可参与，门槛低
- **5 年差异化锚点**：Merkle-signed provenance + open question 跨陌生人协作 + 客户端 truth = 三组合无人覆盖
- **第三方独立可验证**：anyone with SQL dump 可 verify entire signature chain；不需信任 server
- **Open question feed**：web client 在 client-first 架构下唯一 first-class surface；学者发表"未解决问题"的轻量动作
- **既有 ADR 不重写**：ADR-0011/0015/0016 全部保留作 Day 层 Adapter；本 ADR 仅在 server 加 4 表 + 1 Merkle log + 4 API endpoint

### Bad / Trade-offs

- **ed25519 keypair 用户负担**：用户 lose private key = lose identity；缓解：passphrase-derived 加密备份 + 中英双语 onboarding（"导出私钥保管"提示 + .vault/keys 备份指南）
- **Merkle log 不是 absolute truth**：server admin 理论上可 reorder rows；缓解：anti-tamper invariants（prev_entry_id 链 + entry_seq + content_hash）让 tampering 可探测；nightly verify worker 报警
- **server 复杂度**：4 entity 表 + Merkle log + 验证 worker；缓解：写完即 immutable + nightly verify 是 read-only 工作，工程量可控（per migration 0019 Phase 6 W6）
- **open question 冷启动**：jili 自己 dogfood + alpha tester 邀请前，open 内容为空；缓解：Phase 5 Wave C C3 已规划学术社区邀请（清华 / 中科院 / Berkeley DeSci / Pluto.jl）
- **DeSCI 圈子认知冲突**：去区块链立场可能被误读为"不够开放"；缓解：spec §15 决策日志 + 本 ADR §1.1 显式陈述

### Neutral / Need watching

- **anonymous reviewer 路径**：F7 允许 anonymous reply（spec §3 web client "ORCID auth or anonymous"）；anonymous 不签 JWS / 不进 Merkle log —— surface 为 "anonymous comment"，与 ORCID-signed `open_peer_review` 区分清晰
- **ORCID OAuth 依赖**：ADR-0015 已 caveat `mock` → `real` （Wave B dogfood gate require sandbox.orcid.org client）；本 ADR 不抢占 ADR-0015 升 real 路径
- **公开后撤回 vs 删除**：`withdrawn_at` mark-only —— 用户 publish 后只能标撤回不能完全 erase；GDPR right-to-be-forgotten 需 Phase 6 W7+ 单独 ADR

---

## 4. Alternatives considered

### A: 上链（on-chain provenance）

- 为什么不选：spec §1 Q4 显式排除；token / gas / wallet 引入用户学习成本 + 性能问题（blockchain insert vs PG insert 量级差异）
- 什么情况下回头：Ethereum / Solana gas fee 降到 ~0 + 学者主流愿意管理 wallet（不可能 5 年内）

### B: 无 provenance（只 ORCID + JWS）

- 为什么不选：缺 Merkle chain → server admin 可 reorder rows = soft tampering；spec §2 invariant #7 显式 "Provenance 不可伪造"
- 什么情况下回头：dogfood gate G8 显示 chain integrity 工程量 > 3x 预算 → 简化到 per-entity JWS only，accept "soft tamper" 风险

### C: 第三方 archive（Software Heritage / Internet Archive）

- 为什么不选：依赖第三方 SLA + 第三方查询接口（rate limit / data freshness 不可控）；spec §2 invariant #1 client owns truth 与第三方 truth 冲突
- 什么情况下回头：Phase 7+ 加 archive.org integration 作 secondary backup（不是 primary）

### D: 完全无 server（pure P2P）

- 为什么不选：spec §3 显式 server-as-relay；open content feed (公开发现陌生人 question) 需要中心化 index；P2P discovery 工程量大且学术圈用户体验差
- 什么情况下回头：Phase 8+ 评估 libp2p / IPFS hybrid（与 Merkle log 兼容路径已留）

---

## 5. Decision log

- **2026-05-11** spec §1 Q4 / §2 invariant #7 锁定 DeSCI 去区块链立场（user 11 轮 brainstorm；memory `client_first_pivot_2026_05.md`）
- **2026-05-12 W1** Spike-2 vault-fs F4 publish flow 客户端侧 API 实证可行
- **2026-05-12 W2** 本 ADR 起草 Proposed —— 与 ADR-0017 同期
- **关键反对意见 1**：Merkle log vs blockchain 等价 —— "本质上你只是把 chain 写在 PG 里"。**回应**：差异在第三方 verify cost（PG dump SQL 查 vs blockchain node 跑全节点）+ 用户身份（ed25519 + ORCID vs wallet）；功能等价但用户体验完全不同
- **关键反对意见 2**：anonymous reviewer 削弱 open peer review 价值。**回应**：保留两路径（ORCID-signed 进 Merkle log / anonymous 仅 comment-store）；用户 UI 显式区分 trust level
- **关键反对意见 3**：4 entity 表 schema 一旦 ship 不可改。**回应**：每表 `signed_payload_jws` 不变 = 内容签名锁定；其他字段（如 status / withdrawn_at）通过 supersede pattern 演化；新 entity 类型加表不删表

---

## 6. Phase 6 implementation review log

待 Phase 6 W6-W8 实施过程追加。每个里程碑：

- `packages/identity/` 落地后追一段（W1-W2 单独）
- 4 entity migration（migration 0019）落地后追
- Merkle log + verify worker（W7）落地后追
- F4 publish + F7 open question end-to-end e2e（W6）跑通后追
- dogfood gate G4（open question → stranger reply → owner accept）+ G8（DOI mint + Merkle log 完整）跑通后 promote Proposed → Accepted

### 2026-07-18（improvement-plan-2026-08 Wave A4）

- **nightly verify-merkle-log worker landed**：`apps/agent-worker/src/verify-merkle-log.ts`
  ——纯 orchestrator `verifyMerkleLog(rows, {now, entryResolver?})` 包 open-content 的
  `verifyMerkleChain`（4 结构不变量：单 genesis / entry_seq 严格单调 / prev 可解析 /
  无 fork）+ 可选注入的单行签名验证（`verifyMerkleEntry`）；`loadMerkleRows(db)` 从
  `provenance_merkle_log` 按 entry_seq 读全链。8 单测（healthy / fork / 双 genesis /
  断链 / 重复 seq / 签名失败 / null-skip / 全 valid）PASS。**分层边界（诚实标注）**：
  结构完整性是纯 PG 行可查的主职，本轮做实；单行 ed25519 真验签是**可选注入**、缺省
  不跑——它需要重建当初签名的 canonical payload（publish 路径关注点）+ signer 公钥
  （migration 0017 principal.ed25519_public_key），接 `@collaborationtool/identity.verify`
  的真验签待 F4 publish 侧暴露 stored canonical payload 后启用。调度（nightly cron /
  pgboss schedule）+ 告警接线属 worker 运维，gated on 部署，不在本轮。

- **C2PA + W3C VC 容器方向确立（2026 外部格局调研 REPLACE 判定）**：本 ADR §2 的 Merkle
  log + ed25519 detached JWS 是**签名后端**，正确保留；但 provenance **序列化容器**不应是
  私有 wire format——2026 年中 C2PA / Content Credentials 已成内容真实性全球事实标准
  （6000+ 成员，EU AI Act Art.50 + California SB 942 部分场景法定要求），且 W3C
  Verifiable Credentials 可内嵌 C2PA manifest 作 actor 信任信号。**方向**：发布物的对外
  provenance 容器对标 **C2PA manifest + 内嵌 W3C VC**，ed25519 签名作 claim generator
  后端、Merkle log 作本地 tamper-evidence，三者叠加不冲突。这同时兑现第一性原理 #5（不
  发明私有格式）+ #11（provenance 一等）。**本轮只定方向不实现**——C2PA 完整实现 gated on
  open-content 有真实发布流量（improvement-plan-2026-08 §四不做清单）。参考：C2PA spec
  https://spec.c2pa.org/ ；Content Credentials https://contentcredentials.org/ 。
  DeSci 区块链层维持**明确不做**（§4 Alternatives A 已拒；调研确认 DeSci 仍 crypto/DAO/
  token 重绑，与研究者数据所有权诉求不同频）。

---

## 7. References

### 项目内部
- `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §3 + §4 + §5 F4/F5/F7 + §13 out-of-scope + §15 决策日志
- `docs/superpowers/reports/2026-05-12-spike-2-report.md`（F4 publish flow emit 实证）
- ADR-0011（Claim/Evidence —— signed provenance 链扩展）
- ADR-0015（ORCID OAuth + signed review —— OAuth flow 复用）
- ADR-0016（Claim-on-Claim Review —— per-doc review，本 ADR open peer review 互补）
- ADR-0017（client-first runtime —— substrate；F4 publish from client）
- ADR-0019（plugin runtime —— private agent 不进 open content flow）

### 外部
- JWS RFC 7515: https://datatracker.ietf.org/doc/html/rfc7515
- Merkle tree: https://en.wikipedia.org/wiki/Merkle_tree
- @noble/ed25519: https://github.com/paulmillr/noble-ed25519
- @noble/hashes (argon2id): https://github.com/paulmillr/noble-hashes
- ORCID OAuth 2.0 OIDC: https://info.orcid.org/documentation/integration-guide/
- Local-first software (Kleppmann et al 2019): https://www.inkandswitch.com/local-first/
- Software Heritage: https://www.softwareheritage.org/
