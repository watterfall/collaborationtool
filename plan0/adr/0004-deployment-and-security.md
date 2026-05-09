# ADR-0004: Phase 1 部署拓扑 + 安全基线

- **Status**: Accepted
- **Date**: 2026-05-08（Proposed → Accepted 同 commit；Phase 1 D16 收尾）
- **Phase**: 1（关键路径 D16）
- **Deciders**: <项目所有者>
- **Gated on**: D7–D15 全部实施完成；本 ADR 把 Phase 1 实际跑通的 deployment shape 落到纸面，作为 staging / 生产部署的 source of truth。

---

## 1. Context

Phase 1 D7–D15 把 schema / capability gateway / web / editor / sync / render / agent / approval flow 全部实施完毕。每个交付物都有自己的 README + env 列表，但**没有一个文档说"完整 stack 起来需要哪些进程、它们怎么互相找到、secrets 怎么管、TLS 在哪儿终止、监控插哪里"**。本 ADR 填这个洞——它是 Phase 1 sysadmin 部署的唯一指南，也是 Phase 2 加 OAuth / SSO / 多租户 时的修订基线。

边界：

- **决定**：Phase 1 默认部署拓扑、6 个进程的角色、secrets 管理、TLS / CORS / CSP 默认、备份策略、日志级别约定
- **不决定**：具体云厂商（GCP vs AWS vs CF —— ADR-0006 部署目标）；监控供应商（PostHog vs Mixpanel —— Phase 2 ADR）；TLS 证书续签自动化（Caddy / Cert-Manager —— 实施细节）

ADR-0003 §4 已锁定技术栈；本 ADR 在那之上**画拓扑**，回答"这些技术栈怎么拼"。

---

## 2. Decision

### 2.1 Phase 1 默认拓扑（"single-host docker-compose for two-author MVP"）

```
┌─────────────────────────────────────────────────────────────────┐
│ Reverse proxy（Caddy / Traefik / Cloudflare）                    │
│  - TLS termination                                              │
│  - HTTP/2                                                        │
│  - Rate limit (Phase 1.5)                                        │
└──────┬───────────────────────────────────┬──────────────────────┘
       │ /                                 │ /ws
       ▼                                    ▼
┌─────────────┐                       ┌──────────────────┐
│ apps/web    │                       │ apps/sync-gateway │
│ Next.js 15  │                       │ ws + capability    │
│ :3000       │                       │ :4321              │
└──────┬──────┘                       └──────┬─────────────┘
       │ pg                                   │ pg + ws
       ▼                                       ▼
┌────────────────┐                       ┌────────────┐
│ Postgres 16    │ ◀──── snapshot       │  y-sweet   │
│ :5432          │       worker (cron)   │  :8080     │
│  (pg-data vol) │                       │            │
└────────────────┘                       └─────┬──────┘
                                                │ S3
                                                ▼
                                         ┌──────────────┐
                                         │  MinIO / R2  │
                                         │  :9000       │
                                         └──────────────┘
```

**6 个进程**（每个 docker container 或 systemd unit 一个）：

| 进程 | 用途 | 副本数 | 端口 |
|---|---|---|---|
| `apps/web` (Next.js 15) | 用户 UI + auth + agent invoke + export | 1（Phase 4 水平扩展） | 3000 |
| `apps/sync-gateway` | WebSocket capability gate + body backend 适配 | 1（Phase 4 水平扩展，sticky routing 必要） | 4321 |
| `apps/snapshot-worker` | 周期 dump y-sweet → PG bytea | 1 | — |
| `infra/docker/postgres` | 主数据库 | 1 + replica（Phase 1.5） | 5432 |
| `infra/docker/y-sweet` | Yjs 文档 binary 持久化代理 | 1 | 8080 |
| `infra/docker/minio` | S3-compat 对象存储；y-sweet 持久层 | 1（Phase 1.5 替换 R2 / Tigris） | 9000 + 9001 |

**未在拓扑里**：
- MCP server 容器化 —— Phase 1 在 ai-runtime 进程内 (in-memory transport for crossref-mock；Phase 1.5 stdio child for real CrossRef）
- 缓存层（Redis）—— Phase 2 评估，看 capability lookup 是否成为热路径
- 邮件队列 —— Phase 1.5 invitation flow / 密码重置后引入

### 2.2 服务间认证 (server-to-server)

| 关系 | 协议 | secret |
|---|---|---|
| browser → web (HTTP) | better-auth session cookie | `BETTER_AUTH_SECRET` |
| browser → sync-gateway (WS) | SyncToken JWT in URL `?token=...` | `SYNC_TOKEN_SECRET`（web + gateway 共享）|
| browser → web → ai-runtime → MCP (in-memory) | 进程内调用 | — |
| sync-gateway → y-sweet (WS, Phase 1) | y-sweet client token (issued via HTTP) | `YSWEET_AUTH`（gateway + y-sweet 共享）|
| snapshot-worker → y-sweet (HTTP) | y-sweet bearer | `YSWEET_AUTH` |
| y-sweet → MinIO (S3) | AWS-SDK signature v4 | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| web → Postgres / sync-gateway → Postgres / snapshot-worker → Postgres | postgres-js（password） | `DATABASE_URL` |

**Phase 1 简化**：
- `SYNC_TOKEN_SECRET` 是 HS256 共享对称密钥（HMAC）。Phase 1.5 评估 RS256（gateway 持公钥 + JWKS rotation）以避开 web ↔ gateway 共享 secret。
- `YSWEET_AUTH` 是单 bearer token；y-sweet 不支持多 token，所以 rotation 必须 graceful（双 secret 重合期，Phase 2 实施）。

### 2.3 Secrets 管理

**Phase 1（local dev）**：env vars in shell；`docs/SELF_HOST.md` 列默认值；测试用确定性 secret。

**Phase 1.5（staging）**：
- 用 `dotenv` 文件（`.env.staging`）+ `direnv` / 1Password CLI 注入；不进 git
- BETTER_AUTH_SECRET / SYNC_TOKEN_SECRET / YSWEET_AUTH / ANTHROPIC_API_KEY / DATABASE_URL 全在 `.env.staging`

**生产**：
- AWS Secrets Manager / GCP Secret Manager / Vault
- 容器启动时注入（Cloud Run 原生支持；K8s 用 External Secrets Operator）
- Rotation：每季度强制；rotation 时双 secret 共存窗口 ≥ 5 分钟（覆盖 SyncToken 5 分钟 TTL）

**严禁**：
- secrets 进 git（包括 `.env*`，已在 `.gitignore`）
- secrets 印在日志（gateway / web 必须 sanitize）
- 默认值在 production code path 触发（`SYNC_TOKEN_SECRET` 缺失 → fail-fast in env.ts，已实施）

### 2.4 TLS / CORS / CSP

**TLS**：
- 终止在反向代理；后端进程仅监听 localhost
- HTTP/2 默认 on；HSTS max-age ≥ 1 年（Phase 1.5）
- 自动 cert：Caddy（首选，零配置）/ Traefik / cert-manager (k8s)

**CORS**：
- `apps/web` 不需要跨域（同源）
- `apps/sync-gateway` 默认拒绝跨域 WS upgrade（同源策略）；Phase 4 加联邦时按需开 Origin allowlist

**CSP**（Phase 1.5 加，Phase 1 dev 不强制）：
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'`（Next.js 15 需要 inline；Phase 2 用 nonce）
- `style-src 'self' 'unsafe-inline'`
- `connect-src 'self' wss://gateway.<host>`
- `img-src 'self' data:`
- `font-src 'self' data:`
- `frame-src https://molab.org`（Phase 2 Marimo iframe）
- `object-src 'none'`
- `base-uri 'self'`
- `report-uri /api/csp-report`（Phase 1.5）

### 2.5 日志 / 监控

**Phase 1**：
- stdout JSON lines (`pino` 或类似；Phase 1 直接 console)
- 日志级别按 env：dev=debug / staging=info / prod=warn
- 不收集任何 user PII（passage 内容、AI prompt 内容、邮箱 hash 之外）

**Phase 1.5 加**：
- Sentry：错误 + 慢请求（>1s）告警，scrub PII
- Better Stack / Logflare：log aggregation
- PostHog：行为分析（不上传用户 ID，只上传 anon UUID）

**Phase 3 加**：
- Agent quality dashboard（自建；ADR-0003 §4 已记录）
- Capability check audit（频率分布、deny 率）

### 2.6 备份

| 数据 | Phase 1 | Phase 1.5 + 生产 |
|---|---|---|
| Postgres | docker volume；手动 `pg_dump` | WAL-G / pgBackRest 流式 + 7 天 PITR |
| MinIO / S3 binary | docker volume | S3 lifecycle + cross-region replication（R2 自动）|
| `document.yjs_doc_binary` (PG bytea) | 跟随 PG 备份 | 同上 |
| Skill `prompt_template` 表 | 跟随 PG 备份 | 同上 |

恢复演练：Phase 1.5 加，季度 1 次（restore PG → smoke pnpm e2e:test）。

### 2.7 Anthropic API 成本控制

- 默认无 ANTHROPIC_API_KEY → 走 mock runner（CI / 离线 dev 不烧 token）
- 生产配置时加 quota：每用户每日 ≤ N 次 invoke（Phase 1.5 Redis-backed counter）
- 模型选择：default `claude-sonnet-4-6`；agent 可在 `defaults` 字段升级到 `claude-opus-4-7` for long-horizon tasks（Phase 2 reviewer / researcher agent）

---

## 3. Consequences

### Good

- 两人 MVP 可在 1 台 4-core / 8GB 主机上跑（含 Postgres + MinIO + y-sweet + web + gateway + snapshot-worker）
- secrets 边界清晰：4 个 secret 字符串（BETTER_AUTH / SYNC_TOKEN / YSWEET_AUTH / DATABASE_URL）+ 1 可选 (ANTHROPIC_API_KEY)
- 全部进程都 typecheck-clean + 单元 / 集成测试覆盖
- 反向代理 + HTTPS 是部署关注点，不是代码关注点

### Bad / Trade-offs

- **单进程 single-host 不支持 50+ 协作者并发** → Phase 4 sticky routing + horizontal scale 必经
- **HS256 共享对称 secret** → Phase 1.5 RS256 + JWKS rotation
- **MCP server 在进程内（in-memory transport）** → Phase 1.5 stdio child for real CrossRef
- **PG bytea 大文档可能慢** → Phase 2 评估 yjs_doc_binary 移到 S3，PG 仅存 pointer

### Neutral / Need watching

- **Cloudflare R2 vs Tigris vs MinIO**：R2 出口费 0 是优势；Tigris global edge 写延迟最低；MinIO 自托管最强主权。Phase 1.5 选型实测后定。
- **Caddy vs Traefik**：都行；Caddy 更简单，Traefik 集成 K8s 更深。

---

## 4. Alternatives considered

### A. Vercel + Neon + Cloudflare R2 全托管

**为什么不（Phase 1）**：
- better-auth 在 Vercel 上跑要把 secrets 进 Vercel env；可以，但 lock-in 更深
- y-sweet 不能直接跑在 Vercel function（要 stateful WS 进程）；得另开 Fly / Railway
- 每月成本估 $50+（Neon free tier 限 0.5GB；y-sweet hosting separate）

Phase 2 评估：把 web 部署到 Vercel + edge runtime 加速；DB / gateway / y-sweet 留 self-host

### B. 全 Kubernetes + Helm chart

**为什么不（Phase 1）**：
- Phase 1 验收只需要"两个人跑通"，单 host docker-compose 够用
- K8s 学习 / 维护成本超出 Phase 1 单人月预算

Phase 4 评估：开放评审场景下需要弹性，K8s + HPA + 多 region

### C. Per-user docker container

**为什么不（永远不）**：
- 协作模型本质上是多 user share 一个 doc + 一个 sync state；分容器破坏 CRDT 语义
- 资源隔离用 PG row-level security + capability gate 已实现

---

## 5. Decision log

- **2026-05-08**：决定单 host docker-compose 是 Phase 1 默认；Vercel / K8s 留 Phase 2 / 4。理由：minimum viable + 数据所有权一等公民。
- **2026-05-08**：决定 SYNC_TOKEN_SECRET 用 HS256 共享对称；Phase 1.5 升 RS256。理由：Phase 1 web + gateway 在同台机器同 deploy unit，对称密钥的 ops cost 比 RS256 + JWKS 低；Phase 1.5 拆机器后必升。
- **2026-05-08**：决定 secrets 不进 git，用 env vars + dotenv（dev）+ Secrets Manager（prod）。理由：业界共识 + 已有审计案例（Linear / Stripe 都按这个模型）。
- **2026-05-08**：决定 anthropic key 缺失时自动 fallback mock runner。理由：CI / 离线 dev / 演示不应当依赖外网 paid API。

---

## 6. References

- ADR-0001 §2.1（Y.Doc / PG 拆分） / §2.5（commit boundary）
- ADR-0002 §2.4（同步网关执行策略 + JWT 决策）
- ADR-0003 §2（11 项技术栈）
- `docs/SELF_HOST.md`（本 ADR 的实施手册）
- `apps/sync-gateway/README.md`（gateway 端口 + env + close codes）
- `apps/snapshot-worker/README.md`（snapshot worker env + cron）
- y-sweet ops: https://github.com/jamsocket/y-sweet
- Caddy: https://caddyserver.com/
- AWS Secrets Manager / 1Password CLI / direnv 任一
