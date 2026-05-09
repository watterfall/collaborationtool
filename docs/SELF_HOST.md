# 自托管指南 / Self-Host Guide

> Phase 1 D15 — 一台 Linux 服务器从零跑起完整 stack 的手册。

预算：约 1 小时 onboarding 完成第一次 self-host 演示。

---

## 1. 必要依赖 / Prerequisites

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 22+ | 运行 web / gateway / snapshot-worker / e2e |
| pnpm | 10+ | 包管理 + workspace |
| Postgres | 16+ | 主数据库；若用 docker-compose 则跳过本地装 |
| Docker + compose v2 | 任意近期版本 | 起 Postgres + MinIO + y-sweet |
| typst | 0.14+ (可选) | 服务端 PDF 导出；缺则 PDF API 返 503 + hint |

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
```

打开浏览器 <http://localhost:3000> → signup → 创建文档 → 编辑 → AI 调用 → 导出。

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

`document.yjs_doc_binary` 字段最大可能数 MB（大文档）。生产用 `pg_dump`
+ logical replication 备份；带宽够则保留 7 天 PITR。

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

---

## 8. 升级 / Upgrades

- 每个 D-X commit 都可单独 cherry-pick 部署，但建议按顺序
- migration 必须按数字顺序 apply（`pnpm db:migrate` 自动 idempotent）
- 重大模型 / API 变更走 ADR；当前 ADR 在 `plan0/adr/0001-0003`，D16 加 0004 (deployment) + 0005 (render API)

---

> Phase 1 D15 实测在沙箱里 (Linux 6.18 + Postgres 16 + Node 22 + 无 docker daemon 走本地 Postgres) 跑通整套 e2e。生产部署的最后一道关是 D16 加的 ADR-0004 部署拓扑。
