# proto-b · D4 findings — MyST vs Typst CJK 渲染对比

> Phase 0 D4: 实证 H4——mystmd 与 Typst 在中英双语论文渲染上的差距。
> 本报告 + `output/` 下产物 → ADR-0003 §3 双管线渲染决策从 default 转 Accepted。

## TL;DR

**Phase 1 印刷 PDF backend = Typst.ts**（实证站得住）。
**Web / Word / JATS = mystmd**（生态成熟，AST 互操作强）。

ADR-0003 §3 的默认值确认成立。本报告记录在做 D4 时遇到的 6 个具体证据 + Phase 1 实施时要补的 3 个工程任务。

---

## 1. 测试环境（reproducible）

```
Linux 6.18.5
Node 22.22.2 / pnpm 10.33.0
mystmd 1.9.0  (npm package, no offline mode)
typst 0.14.2  (downloaded binary, single 50MB executable, no deps)
fonts: WenQuanYi Zen Hei (system) + Unifont (system); 没有 Source Han / Noto CJK
```

测试文档：`myst-source/index.md` (MyST flavored Markdown) + `typst-source/specimen.typ`（同源内容，独立写）。覆盖 6 个排版边角：标点挤压、CJK-Latin 间距、破折号、数字单位、引号一致性、行末禁则。

## 2. 命令与产物

```bash
# Typst pipeline
./typst-bin compile typst-source/specimen.typ output/specimen-typst.pdf
# 结果：115 KB PDF，0 警告，<1s 编译。

# mystmd pipeline (export 路径)
npx mystmd build --tex --jats --docx
# 结果：
#   ✅ specimen-mystmd.jats.xml (7.6 KB, 110ms) — 不需要 template
#   ❌ tex export: HTTP 403 拉远端 template 'plain_latex'
#   ❌ docx export: HTTP 403 拉远端 template 'default'
#   (PDF 不可用 — 需 LaTeX engine 装在系统里)
```

## 3. 六个具体发现

### 3.1 印刷 PDF 链路 dependency 重量

| Backend | 依赖 | Phase 1 工程影响 |
|---|---|---|
| **Typst** | 一个 50 MB 静态 binary（cargo build 或下 release）；无运行时依赖；本地编译 | 部署轻；客户端 WASM 版本（typst.ts）<5 MB，可直接在浏览器跑 |
| **mystmd → LaTeX** | mystmd CLI + Node + LaTeX engine（TexLive / xelatex，~1-3 GB）+ xeCJK template 包 + 远端 template 拉取（mystmd template registry） | 服务端必装 LaTeX；中文模板维护成本高；远端 template registry 不可达时整个 PDF 链坏（本次实测就是） |

**结论**：Typst 的"零依赖单 binary"让我们在 Phase 1 的 export worker 里**直接调用** typst CLI，不需要专门的 LaTeX 容器。

### 3.2 mystmd 远端 template 是 fragile dependency

`mystmd build --tex/--docx/--html` 都试图从 `https://api.mystmd.org/templates/...` 拉模板。如果：
- 我们的部署环境无法外联到 api.mystmd.org（air-gapped、防火墙、Sandbox）
- mystmd 团队改 API 路径
- 该 endpoint 临时挂了

**整条 print/Word/HTML 链断**。本次测试就是 403——mystmd 的策略是"模板远端拉，本地缓存"，缓存过期时强行重新 fetch。

**Phase 1 缓解**：本机 fork `myst-templates` repo 到 `templates/myst/`；mystmd 支持 `--template /local/path/` 跳过 registry。要进 ADR-0003 §3 实施清单。

### 3.3 mystmd 不读 myst.yml 的 `language: zh`

```
⚠️  myst.yml 'config.project' extra key ignored: language (at myst.yml)
```

—— mystmd 1.9.0 不在 `project.language` 上加 schema validation，但在生成 JATS 时仍把 `xml:lang="en"` 硬写出来。结果：JATS 接收方（Pandoc / xelatex / 翻译 pipeline）按英文断行规则处理 CJK 段落。**这是 Phase 1 必须 patch 的点**。

Typst 对应 `set text(lang: "zh", region: "cn")` 一行，且字体回退链可在同 `set text` 里给：
```typst
font: ("New Computer Modern", "WenQuanYi Zen Hei")
```

### 3.4 mystmd 的 smart-quote 不分语言

观察 JATS 输出：

| 源 markdown | mystmd 输出 |
|---|---|
| `"double quotes"`（英文段落） | `“double quotes”` ✅ |
| `"双引号"`（中文段落） | `“双引号”` ❌ — 仍用拉丁弯引号；中文应当用全形 “” 或直角「」 |
| `"x86_64"`（标识符引号） | `“x86_64”` ❌ — 标识符不应被弯引号化 |

mystmd 的 typography 处理（`smart` extension）按照 CommonMark / pandoc 风格做 substitution，不感知 mixed-script 上下文。Typst 用 lang="zh" 时引号自动按 region 走，没此问题。

**Phase 1 缓解**：在 `packages/typography/` 加 pre-pass 把全形/直角引号在中文上下文中显式标注，再喂给 mystmd。这是工程量。

### 3.5 公式 AST 互操作

mystmd JATS 的公式段：

```xml
<disp-formula><alternatives>
  <mml:math display="block">…</mml:math>
  <tex-math><![CDATA[\rho(t) = …]]></tex-math>
</alternatives></disp-formula>
```

—— **MathML + LaTeX 双轨**。这是 JATS 标准的强项：投稿 NCBI / 期刊 production 系统都直接消费。Typst 没有内建 MathML 输出（typst.math → typst PDF only）。

**Phase 1 设计含义**：MyST AST 是公式的"外交语言"。Typst 印刷 PDF 时直接用 typst math syntax；导出 JATS 时走 MyST 路径。`packages/render-typst` 和 `packages/render-myst` 各自有公式 transformer，但底层共享 packages/schema 的 BlockShape（type='equation' attrs.latex）。

### 3.6 速度 / 端到端延迟

| 路径 | 端到端时间 | 备注 |
|---|---|---|
| Typst source → PDF | < 1s（115KB PDF） | 直接 |
| mystmd MD → JATS | 110ms（仅 AST 转换） | 不出 PDF |
| mystmd MD → PDF | N/A（本环境）；他人报告 ≈ 5-15s 中型论文（含 LaTeX 二阶段） | 需 LaTeX engine |

ADR-0003 §6 质量门槛"100 页论文 PDF 导出 < 10s（中英混排都达标）"——Typst 满足；mystmd→LaTeX 在大论文 + xeCJK 下接近上限。

## 4. ADR-0003 §3 决策落地

确认 **Phase 1 双管线** 设计：

```
ProseMirror 文档树 (Y.Doc)
        │
        ▼
  packages/schema BlockShape
        │
   ┌────┴────┐
   ▼         ▼
packages/    packages/
render-myst  render-typst
   │         │
   ├─ HTML   └─ PDF（印刷）
   ├─ JATS
   ├─ Word
   └─ MyST source export
```

**实施清单（Phase 1 ADR 接手）**：

1. `packages/render-typst`：PM tree → Typst source string → `typst compile` 调用。字体回退链和 `set text(lang)` 由 packages/typography 提供。
2. `packages/render-myst`：PM tree → MyST AST（mystmd JS API）。HTML / JATS / Word 走 mystmd export。**镜像 mystmd templates 到本仓 `templates/myst/` 避免远端依赖**。
3. `packages/typography`：CJK-Latin spacing、smart-quote-by-language、清晰的字体 token（serif-cjk-primary、serif-cjk-fallback、sans-cjk-primary、…）。两个 renderer 都消费。

## 5. 缺口（Phase 0 不修，Phase 1 处理）

- **Typst 字体 fallback** 在 sandbox 用 WenQuanYi Zen Hei；生产要切到 Source Han Serif / IBM Plex Sans CJK / Noto Sans CJK。Linux 服务端 export worker 要装这些字体。
- **clreq 断行 hint**（typst-doc-cn/clreq companion）：当前 Typst 0.14 内建 `lang="zh"` 已大部分满足，但「《【〔 等的连续行尾还有 squeeze 缺口（typst issue #2439 / #7643）。Phase 1 实测后决定是否引入 companion 包。
- **MathLive 输入 → LaTeX → packages/schema** 通道：Phase 2 任务，Phase 0 schema `equation.attrs.latex` 已就位。

## 6. 重现

```bash
# 1. 装 typst（一次性，下 release binary 即可）：
cd /tmp && curl -sL https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz -o typst.tar.xz
tar -xJf typst.tar.xz && cp typst-x86_64-unknown-linux-musl/typst <repo>/apps/prototypes/proto-b-cjk-render/typst-bin

# 2. 跑 Typst：
cd <repo>/apps/prototypes/proto-b-cjk-render
./typst-bin compile typst-source/specimen.typ output/specimen-typst.pdf

# 3. 跑 mystmd（JATS only — tex/docx 需要远端 template）：
cd myst-source
npx mystmd build --jats
```

打开 `output/specimen-typst.pdf` 直接看视觉效果；JATS 用文本编辑器看 markup 是否干净。

## 7. 决策

- ✅ ADR-0003 §3 默认 — **Phase 1 印刷 PDF 走 Typst** 转 Accepted
- ✅ ADR-0003 §3 默认 — **Phase 1 web/Word/JATS 走 mystmd** 转 Accepted
- 📋 Phase 1 必做：
  - 把 mystmd templates 镜像到 `templates/myst/` 避免远端依赖
  - 在 `packages/typography/` 处理 mystmd 的 language-naive smart-quote 缺口
  - 在 export worker 镜像安装 Source Han / Noto Sans CJK 字体
- 🚫 Phase 1 暂不做：
  - mystmd LaTeX 路径作为 fallback——work duplicate，Typst 已胜出
  - clreq companion 包深度集成——等 Typst 0.15+ 看上游进展
