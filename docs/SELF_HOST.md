# 自托管指南 / Self-Host Guide

> Phase 4 W4 — 一台 Linux 服务器从零跑起完整 stack 的手册。

预算：约 1 小时 onboarding 完成第一次 self-host 演示。

> 本指南覆盖 4 个进程（web / sync-gateway / snapshot-worker / agent-worker）+ 3 个数据服务（Postgres / MinIO / y-sweet）+ 可选 typst CLI 与 Linux bwrap 沙箱（Phase 4 W1+ plugin install 用）。Phase 1 之外的环境变量在节末 `[Phase X+]` 标记。

---

## 1. 必要依赖 / Prerequisites

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 22+ | 运行 web / gateway / snapshot-worker / agent-worker / e2e |
| pnpm | 10+ | 包管理 + workspace |
| Postgres | 16+ | 主数据库；若用 docker-compose 则跳过本地装 |
| Docker + compose v2 | 任意近期版本 | 起 Postgres + MinIO + y-sweet |
| typst | 0.14+ (可选) | 服务端 PDF 导出；缺则 PDF API 返 503 + hint |
| bubblewrap (`bwrap`) | 0.8+ (可选) | Linux plugin sandbox（Phase 4 W1+；ADR-0012）；缺则 plugin install 仍可调试，但 `bwrap` 真启动 dogfood gate 不能跑 |
| Ollama / vLLM / OpenAI-compat endpoint | 可选 | BYO 模型（Phase 4 W2+；ADR-0013）；任何兼容 anthropic / openai-compat / ollama / custom-http 4 wireFormat 之一的 endpoint |

**字体**（生产 docker image 装；本地 dev 系统装即可）：

- **Source Han Serif SC / TC**（OFL；用于中文正文）
- **Source Han Sans SC / TC**（OFL；用于中文标题）
- **Noto Sans CJK SC / TC**（OFL；fallback）
- **WenQuanYi Zen Hei**（fallback；多 Linux 发行版自带）

`packages/typography/src/font-tokens.ts` 定义了完整的 fallback chain；
HTML / JATS / Typst 三个渲染器都消费同一个 token。生产容器
`Dockerfile` 应当 `apt-get install fonts-noto-cjk fonts-wqy-zenhei` 等
对应包；如果允许的话 fork Source Han 进 image。

---

## 2. docker-compose 起手 / Bring up the stack

```bash
# 1. clone + install
git clone <repo>
cd collaborationtool
pnpm install

# 2. 起 Postgres + MinIO + y-sweet（一键）
docker compose -f infra/docker/docker-compose.yml up -d
# 或快捷：pnpm db:up

# 3. apply schema migrations
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm db:migrate

# 4. seed 基础 fixtures（service principal + demo user + 2 个 platform agent）
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm db:seed
# Phase 4 W4 共 10 个 migration（0001 initial → 0010 phase3 closeout）。
# 增量包含：mcp_server / claim+evidence / agent_job / source+source_extraction /
# maintenance_finding / plugin_install / user_model_pref / document_model_override

# 5. (可选) 装 typst 到 PATH
curl -sL https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz \
  -o /tmp/typst.tar.xz
sudo tar -xJf /tmp/typst.tar.xz -C /tmp
sudo mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/
typst --version
```

容器 health checks：

| 服务 | 端口 | 检查 |
|---|---|---|
| postgres | 5432 | `pg_isready -h localhost` |
| minio S3 | 9000 | `curl localhost:9000/minio/health/live` |
| minio 控制台 | 9001 | 浏览器打开 / collab / collab12345 |
| ysweet | 8080 | `curl localhost:8080/check_store` |

---

## 3. 生成 secrets

```bash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export SYNC_TOKEN_SECRET=$(openssl rand -base64 32)
export DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool

# y-sweet 集成（D11）— 仅当上面 docker-compose 把 ysweet 拉起时
export YSWEET_URL=http://localhost:8080
export YSWEET_AUTH=dev-y-sweet-auth-token-replace-in-prod

# 真 Anthropic API（可选；不设走 mock runner）
export ANTHROPIC_API_KEY=sk-ant-...

# 真 CrossRef MCP（可选；不设走 in-memory mock 仅认 5 条 fixture DOI）
# 走 stdio 子进程；Web route 在每次 invoke 时 spawn / 收回。
export CROSSREF_MCP_COMMAND=tsx
export CROSSREF_MCP_ARGS='["mcp-servers/crossref/src/bin.ts"]'
export CROSSREF_MCP_CWD=/path/to/collaborationtool   # 若 web 进程 cwd 不在 repo 根
# 透传到子进程（mcp-servers/crossref/src/bin.ts 读取）：
# CROSSREF_BASE_URL  default https://api.crossref.org
# CROSSREF_USER_AGENT default collaborationtool/0.0 (mailto:dev@…)
# CROSSREF_TIMEOUT_MS default 8000

# Async agent worker（apps/agent-worker；Phase 2.5+）
# reviewer / researcher / maintenance-scan 走 pgboss 队列异步跑；web
# 进程 enqueue，agent-worker 进程 subscribe + invoke。
# pgboss 自带 schema bootstrap，第一次 start 会建 schema='pgboss' 内的表。
export SKILLS_ROOT=./skills              # 默认 './skills'；docker image 若 cwd 不同则改成绝对路径
# DATABASE_URL + ANTHROPIC_API_KEY 与 web 共用即可（mock fallback 同样适用）

# BYO 模型 / 自带 LLM（apps/web + apps/agent-worker；Phase 4 W2+）
# 4 wireFormat：anthropic / openai-compat / ollama / custom-http
# 4 档优先级 resolver（document-override > user-pref > manifest-hint > env-default）
#   document-override / user-pref：写入 PG 表 document_model_override / user_model_pref
#     —— 通过 Settings UI（推 W2 末）或直接 INSERT；行里指定 endpoint_url + api_key_env_var
#   manifest-hint：plugin manifest 里的 prefers_provider 字段（coordinator-agent 默认声明 anthropic 长上下文）
#   env-default：ANTHROPIC_API_KEY 为空时 ai-runtime fallback 到 mock runner
# 任何 wireFormat 的实际 API key 都通过 user_model_pref.api_key_env_var
# 字段指过来（行只存 env var 名字，不存明文 key），所以你要在 web /
# agent-worker 进程环境里把对应的环境变量也设了：
export OPENAI_API_KEY=sk-...                            # 当某个 user_model_pref 行 api_key_env_var='OPENAI_API_KEY'
export OPENROUTER_API_KEY=sk-or-v1-...                  # 同上；任意命名都行，与表行对齐即可
# 本地 Ollama / vLLM 一般无 auth，留空即可（resolver 容忍 apiKey=null）

# Plugin sandbox（apps/web /api/plugin/install 路由 + agent-worker 装载阶段；Phase 4 W1+）
# Linux：bwrap 真启动；缺 bwrap 时 install 仍能落 plugin_install 行 + 校验
#   capability superset，但 dogfood gate（真 capability deny e2e）跑不起来。
# 当前 backend 已落 buildLinuxBwrapArgs 含：--unshare-{user,pid,ipc,uts}
#   --die-with-parent --clearenv（参 packages/ai-runtime/src/plugins/install.ts）。
# macOS / Windows：占位描述符就位；真启动推 Phase 5。
# install 时 https-only git URL 校验由 buildInstallRowPayload 强制；不能装本机
#   tarball / 任意 git url（仅 admin role 可走 origin='local-path' 后门）。

# Invitation flow / 邮件（可选；Phase 1.5 #1）
# 不设走 console-only：邀请链接 print 到 server stderr，docker logs 看
export MAIL_WEBHOOK_URL=https://api.resend.com/emails   # 或 Postmark / 自家 relay
export MAIL_WEBHOOK_AUTH=re_xxxxxxxxxxxxxxxxxxxxx       # 可选 Bearer
export MAIL_FROM='Collaboration Tool <noreply@your-host.example>'

# ORCID OAuth（可选；Phase 1.5 #2）
# 在 https://orcid.org/developer-tools 注册 public API client，回调地址：
#   https://<your-host>/api/auth/oauth2/callback/orcid
# 测试用 sandbox.orcid.org（独立 client id 注册），ORCID_BASE_URL 改成 sandbox。
export ORCID_CLIENT_ID=APP-XXXXXXXXXXXXXXXX
export ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ORCID_BASE_URL=https://orcid.org   # 可选；默认 https://orcid.org
# 客户端 UI 显示按钮的开关（next 编译时读，不能服务器动态切）
export NEXT_PUBLIC_ORCID_ENABLED=true
# 不设 client id/secret 则后端不注册 provider；按钮即使勾了也走 PROVIDER_CONFIG_NOT_FOUND

# 观测性 / Observability（可选；ADR-0004 §2.5）
# Sentry：错误 + 慢请求（>1s）告警；DSN 格式 https://<key>@<host>/<projectId>
export SENTRY_DSN=https://abc123@o100.ingest.sentry.io/42
# PostHog：行为分析；anon UUID 而非真实 user id
export POSTHOG_API_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxx
export POSTHOG_HOST=https://eu.posthog.com   # 可选；默认 app.posthog.com
# 不设任意一个则该路径自动 no-op（fire-and-forget HTTP capture，无 SDK 依赖）
```

**生产警告**：
- 把 `dev-y-sweet-auth-token-replace-in-prod` 替换成 `openssl rand -base64 32` 出来的随机串
- `BETTER_AUTH_SECRET` / `SYNC_TOKEN_SECRET` / `YSWEET_AUTH` 不要进 git；用 secrets manager
- MinIO `collab/collab12345` 改强密码
- TLS 由前置 reverse proxy（Caddy / Traefik / Cloudflare）终止

---

## 4. 启动 / Run the apps

每个进程一个终端（或用 systemd / pm2 / docker stack 编排生产）：

```bash
# 终端 1：Web 应用
pnpm web:dev    # next dev :3000

# 终端 2：Sync gateway
pnpm gateway:start    # WebSocket :4321

# 终端 3：Snapshot worker（可选；只有 YSWEET_URL 设了才有用）
pnpm snapshot:start   # 每 5 分钟扫描脏 docs

# 终端 4：Agent worker（Phase 2.5+；reviewer / researcher / maintenance-scan）
pnpm --filter @collaborationtool/agent-worker start
# 跟 web 进程共享 DATABASE_URL + ANTHROPIC_API_KEY；
# pgboss schema 第一次 start 自动 bootstrap；
# SIGTERM 会 graceful drain 在跑的 job 再退出
```

打开浏览器 <http://localhost:3000> → signup → 创建文档 → 编辑 → AI 调用
（同步 citation / inline-editor 走 web 进程 inline；异步 reviewer /
researcher 通过 web `/api/document/<docId>/agent-job` enqueue → agent-worker
跑 → SSE 回 `/api/agent/job/<jobId>/stream`） → 导出。

---

## 5. 验收清单 / Acceptance smoke

跑一遍 D15 双人 e2e（直接对 HTTP）：

```bash
DATABASE_URL=postgres://collab:collab@localhost:5432/collaborationtool \
  pnpm e2e:test
```

应当看到：

```
Running 1 test using 1 worker
  ✓  1 specs/two-author-mvp.spec.ts:63:1 › two-author MVP: agent → propose → reject; agent → propose → accept; export
  1 passed
```

测试覆盖：A 注册 → B 注册 → A 创建文档 → B 拿 reviewer 角色 → A 调
Citation Agent → B 拒 → A 调 Inline Editor → B 试 accept (403) → A
accept (200) → 4 格式导出 → PG provenance / contribution / approval_chain
完整。

---

## 6. 运维注意事项 / Operational notes

### Postgres 备份

`document.yjs_doc_binary` 字段最大可能数 MB（大文档）。生产用 WAL-G 流式
归档 + 7 天 PITR（ADR-0004 §2.6）。

**Phase 1.5 #7 一键启用**（前提：S3-compat 桶 + 凭证已就绪）：

```bash
# 1. 复制 wal-g 配置模板，填真实凭证
cp infra/walg/wal-g.json.example infra/docker/wal-g.json
$EDITOR infra/docker/wal-g.json   # 填 WALG_S3_PREFIX / AWS_* 字段

# 2. build 自定义 postgres image（含 wal-g 二进制）
docker build -f infra/walg/Dockerfile -t collaborationtool-pg-walg:local infra/walg

# 3. 用 walg overlay 起 stack（替换默认 postgres，加 walg-backup sidecar）
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.walg.yml \
  up -d postgres walg-backup

# 4. 验证 archive_command 生效（WAL 段 push 到桶里）
docker exec collaborationtool-pg psql -U collab -d collaborationtool \
  -c "SELECT pg_switch_wal();"
# 然后 mc ls 你的桶 / aws s3 ls 看到 walg 目录里有内容

# 5. 立刻做一次基线备份（不等 04:00 sidecar）
docker exec collaborationtool-walg-backup /opt/scripts/walg-backup.sh
```

**恢复演练**（quarterly 推荐）：

```bash
# 1. 起一个空 PGDATA 的临时 postgres
docker run --rm -it \
  -v "$(pwd)/infra/docker/wal-g.json:/etc/wal-g/wal-g.json:ro" \
  -v collaborationtool_pg-restore:/var/lib/postgresql/data \
  collaborationtool-pg-walg:local bash

# 2. 容器里跑 restore（默认走最新 base + WAL）
PGDATA=/var/lib/postgresql/data /opt/scripts/walg-restore.sh LATEST
# 指定时间点：
RECOVERY_TARGET_TIME='2026-05-09 14:00:00+00' \
  /opt/scripts/walg-restore.sh LATEST

# 3. 启 postgres，看 WAL 重放完成
docker-entrypoint.sh postgres
# 4. 跑 pnpm e2e:test 对它，确认数据回得来
```

> WAL-G 二进制在 image 里：`/usr/local/bin/wal-g`。配置在
> `/etc/wal-g/wal-g.json`。绝不进 git；放 secrets manager。

### S3-compat 选择

- **本地 dev**: MinIO（docker-compose 内）
- **生产**: Cloudflare R2（无出口费）/ Tigris / AWS S3。把 `AWS_ENDPOINT_URL_S3` 指过去；y-sweet 自动用。

### 字体许可

- Source Han Serif / Sans 是 SIL OFL（可商用、可重发）
- Noto CJK 是 SIL OFL
- 系统字体（PingFang / Microsoft YaHei）的许可只允许在装机上用 — 不能进 docker image，但 fallback chain 命中时用是 OK 的（终端用户机器上的字体）

### 端口冲突

| 端口 | 占用 |
|---|---|
| 3000 | apps/web (next) |
| 3100 | tests/e2e 用的 next 实例 |
| 4321 | apps/sync-gateway |
| 5432 | postgres |
| 8080 | y-sweet |
| 9000 | MinIO S3 |
| 9001 | MinIO 控制台 |

agent-worker 不监听端口（pgboss subscriber + 出向 LLM 请求）。snapshot-worker
同样不监听端口（出向 PG + y-sweet HTTP）。

### 关 / 重启

```bash
pnpm db:down       # 关所有容器（数据保留在 volume）
pnpm db:up         # 重启
pnpm db:logs       # tail postgres logs
docker volume ls | grep collaborationtool   # 找 volume
```

`db:down` + `docker volume rm` 才会清空 PG / MinIO 数据。

---

## 7. 故障排查 / Troubleshooting

| 现象 | 原因 | 解决 |
|---|---|---|
| signup 200 但 docs 列表 redirect 到 login | 中间件没拿到 cookie | 检查 BETTER_AUTH_URL 与你访问的 URL 严格一致 |
| 编辑器加载中卡住 | `/api/sync-token` 401 | 检查 SYNC_TOKEN_SECRET 在 web 与 gateway 是否同一个 |
| AI invoke 200 但 proposal 为空 | mock runner 命中无 fixture 的 DOI | crossref-mock 5 条 fixture 仅在 `mcp-servers/crossref-mock/src/server.ts`；改用真 ANTHROPIC_API_KEY 走 real LLM，或设 CROSSREF_MCP_COMMAND 走真 CrossRef |
| AI invoke 500 `agent-failed` 提到 spawn ENOENT | CROSSREF_MCP_COMMAND 不在 PATH | 用绝对路径（`which tsx`），或不设 → 自动 fallback 到 in-memory mock |
| PDF 导出 503 typst-binary-unavailable | 未装 typst CLI | 见上面 §2 装 typst |
| `migration "0001_initial.sql" already applied` 但出错 | 之前部分 apply | `psql ... -c 'DROP TABLE IF EXISTS _drizzle_migrations CASCADE'` 然后重 migrate；准备好丢数据 |
| `POST /api/document/<id>/agent-job` 201 但 SSE 一直空 | agent-worker 进程没起 / pgboss schema 没 bootstrap | 起 `pnpm --filter @collaborationtool/agent-worker start`；首次启动会建 `pgboss.*` 表，看 stdout `[agent-worker] started` |
| agent-worker 启动 immediate 退出 `relation "agent_job" does not exist` | migration 0007 没 apply | `pnpm db:migrate` 跑到 0010；agent_job 表在 0007；plugin_install / user_model_pref / document_model_override 在 0010 |
| BYO 模型路由到了 wireFormat=ollama 但 connection refused | user_model_pref.endpoint_url 指错 / Ollama 没起 | curl `<endpoint>/api/tags` 验证；resolver 在 manifest-hint 命中但用户没配 endpoint 时 apiKey=null，host 会 fallback 到 mock 而不是真访问 |
| Plugin install 500 `not-an-https-url` | git URL 用 http 或 ssh+git@ | https-only enforced；改 https URL 或 admin role 走 origin='local-path' 后门（仅 dev） |
| maintenance scan 不出 finding | scan 未入队 / 6 finding kind 中只有 3 类 SQL-pure 已实施 | 入队：往 pgboss `maintenance-scan` 队列扔 `{ documentId, generators }` 即可；剩 3 finding kind（duplicated-claim / contradicted-conclusion / broken-citation）推 Phase 4 W4 末 |

---

## 8. 升级 / Upgrades

- 每个 D-X commit 都可单独 cherry-pick 部署，但建议按顺序
- migration 必须按数字顺序 apply（`pnpm db:migrate` 自动 idempotent）
- 重大模型 / API 变更走 ADR；当前 15 ADR 在 `plan0/adr/0001-0015`（11 Accepted + 4 Proposed，分别等 Phase 4 W1/W2/W5-W6/W8 dogfood gate）
- 升级 Phase 边界（如 Phase 3 → Phase 4）时优先看根目录 `STATUS.md` "最后更新" 行 + 当前 phase 的 plan stub `plan0/phase-N-plan-stub.md`

---

## 9. 进程拓扑速览 / Process topology

```
┌─────────────────────────────────────────────────────────────────────┐
│ apps/web :3000                                                       │
│   - Next.js 15 + better-auth                                         │
│   - /api/agent/invoke      sync agent (citation / inline-editor)     │
│   - /api/document/<id>/agent-job  enqueue async agent (reviewer/researcher) │
│   - /api/agent/job/<id>/{,stream}  status + SSE                      │
│   - /api/document/<id>/evidence-map  read-only DAG view              │
│   - /api/export/<id>/<format>  7 formats incl. ai-context-pack       │
│   - /api/document/<id>/cell/<cell>/auth-token  molab iframe JWT      │
│   - /api/document/<id>/invitation, /api/orgs/bridge, ORCID OAuth     │
└──┬──────────────────────────────────────────────────────────────────┘
   │ enqueue                          ▲ status / SSE
   ▼                                  │
┌──────────────────────────────────────┴──────────────────────────────┐
│ apps/agent-worker  (no port)                                         │
│   - pgboss subscribe: reviewer / researcher / maintenance-scan       │
│   - invokeAgentViaPlugin → plugin_host → ai-runtime → ModelProvider  │
│   - writes agent_job_event (SSE consumer reads via web)              │
│   - 3 SQL-pure finding generators for maintenance-scan               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ apps/sync-gateway :4321  (WebSocket)                                 │
│   - JWT-gated; capability check on connect                           │
│   - InMemory body backend (default) / YSweetBackend (YSWEET_URL)     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ apps/snapshot-worker  (no port; only useful when YSWEET_URL set)     │
│   - poll dirty docs every 5min → fetch Y.Doc → upsert PG bytea       │
└─────────────────────────────────────────────────────────────────────┘

数据服务：postgres :5432  /  y-sweet :8080  /  minio :9000-9001
```

---

> Phase 4 W4 实测在沙箱里 (Linux 6.18 + Postgres 16 + Node 22) 跑通整套
> e2e + agent-worker + maintenance scan。生产部署 reference 是 ADR-0004
> 部署拓扑 + 上面 §9 进程图。Phase 4 dogfood gate（plugin sandbox bwrap
> 真启动 / 4 endpoint 真 round-trip / coordinator 真 multi-agent dispatch）
> 跑通后会再补一节 §10 production checklist。
