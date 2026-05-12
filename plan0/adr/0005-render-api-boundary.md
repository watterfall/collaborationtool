# ADR-0005: 编辑器 ↔ 渲染器 API 边界

- **Status**: Accepted
- **Date**: 2026-05-08（Proposed → Accepted 同 commit；Phase 1 D16 收尾）
- **Phase**: 1（关键路径 D16）
- **Deciders**: <项目所有者>
- **Gated on**: D10（编辑器内核）/ D12（render-myst + render-typst + typography）已实施完毕；Phase 1 5 格式导出在 D15 e2e 验收 PASS。

---

## 1. Context

Phase 1 D10 把编辑器内核 (`packages/editor-core`) 落地，9 个自定义 ProseMirror node + 1 个 mark
（paragraph / heading / equation / inline-equation / citation-ref / dataset-ref /
computational-cell / annotation-anchor / figure / footnote）。D12 又落地了 5 格式导出
（HTML / JATS / Markdown / Typst source / PDF）走两个 render 包：

- `packages/render-myst` —— PM → MyST AST → HTML/JATS/Markdown
- `packages/render-typst` —— PM → Typst source → PDF（subprocess `typst compile`）
- `packages/typography` —— CJK 排版 pre-pass，被两边消费

D12 PR 落地时 render 包**直接 import 了 PM JSON 形状**——`PmDocInput` 接口在
两个 render 包里**重复定义**，但都来自 editor-core 的 `paperSchema()` 输出。这是
Phase 1 收尾必须正式化的边界：

- **如果 editor-core 改 schema（加 node、改 attrs），渲染器静默失败**——MyST AST 不
  认识新节点 → drop；Typst source emit 空字符串 → 输出残缺。
- **如果渲染器各自演进 PmDocInput**——比如 render-typst 加 `attrs.format` 强约束、
  render-myst 不加，编辑器作者得记两套 schema。
- **typography pre-pass 的一致性**——HTML / Typst 都用 `applyCjkSpacing` +
  `smartQuoteByLang`，但前者在 emitter 内调用、后者在 source-from-pm 内调用；如果两边
  的调用顺序 / 参数不一致，"同样的 PM tree 渲染出不同标点"。

本 ADR 把"PM JSON tree 是 editor 与 renderer 之间的稳定 wire format"这件事写下来，
并指明每边的 ownership：editor-core 拥有 schema **写入端**、render 包拥有 schema
**消费端**、`packages/schema` 拥有 schema **类型源头**（Phase 1.5 提取）。

边界：

- **决定**：PM JSON tree 是渲染契约；渲染器入口签名；typography pre-pass 调用约定；
  Phase 2 schema 演化的 SemVer 规则。
- **不决定**：MyST 官方 `myst-spec` lib 何时替换我们自写的 ast-from-pm（Phase 1.5 ADR）；
  Typst 模板系统（house style sheet → preamble override）—— Phase 2 ADR；mystmd-to-docx
  的 .docx 接入 —— Phase 1.5。

---

## 2. Decision

### 2.1 Wire format：PM JSON tree

**`packages/editor-core` 的输出 = `packages/render-*` 的输入 = 普通 JSON**
（即 `JSON.parse(JSON.stringify(editor.getJSON()))` 的结果）。

```ts
// 形状（render-myst/src/ast-from-pm.ts:47, render-typst/src/source-from-pm.ts:39 ）
export interface PmDocInput {
  type: string;       // 必须 'doc'
  content?: unknown[];
}

// 内部展开后（PmNode）
interface PmNode {
  type: string;        // 'paragraph' / 'heading' / 'citation-ref' / ...
  attrs?: Record<string, unknown>;
  content?: PmNode[];  // children
  text?: string;       // text leaf
  marks?: PmMark[];    // bold / italic / annotation-anchor
}
```

**约定**：

1. 渲染器**不**依赖 `@tiptap/*` 或 `prosemirror-*` 任何包——纯 JSON walker。这让
   渲染器能在 Node-only 服务器上跑（导出 API、CI 单测、Worker），不被 DOM 染色。
2. 渲染器**不**修改输入 PM 树（pure function）。
3. PM JSON tree 是**有损压缩**——它丢失了 ProseMirror schema 的 marks 顺序信息中
   一部分（marks 的相对顺序由 schema 决定，序列化时归一）。Phase 1 不依赖 mark 顺序，
   渲染器以"出现即应用"的语义处理。
4. 渲染器**不**做 Citation / Annotation 元数据 join——`citation-ref` 节点只携 `attrs.citationId`，
   渲染时 emit 占位（HTML `<cite>` / JATS `<xref>` / Typst `#cite()`），由调用方在
   render 后做二次 PG join（Phase 2 起 `mystAstToHtml` 接受 `citations: Map<id, CslJson>`
   选项；Phase 1 默认空）。

### 2.2 渲染器入口签名（Phase 1 锁定）

```ts
// === @collaborationtool/render-myst ===

export function pmToMystAst(pm: PmDocInput): MystRoot;

export function mystAstToHtml(
  ast: MystRoot,
  options: HtmlRenderOptions,
): string;
export interface HtmlRenderOptions {
  primaryLanguage: LanguageTag; // 决定字体 fallback chain + 排版 pre-pass
  title?: string;
  fragment?: boolean;           // true → 不输出 <html><head>... 包壳
}

export function mystAstToJats(
  ast: MystRoot,
  options: JatsRenderOptions,
): string;
export interface JatsRenderOptions {
  primaryLanguage: LanguageTag;
  title: string;
  authors?: { givenName: string; familyName: string }[];
}

export function mystAstToMarkdown(ast: MystRoot): string;
//   Markdown 故意不接受 lang/title—— MyST source 是无包壳的。

// === @collaborationtool/render-typst ===

export function pmToTypstSource(
  pm: PmDocInput,
  options: TypstSourceOptions,
): string;
export interface TypstSourceOptions {
  primaryLanguage: LanguageTag;
  title: string;
  paper?: string;     // default 'a4'
  fontSize?: string;  // default '11pt'
}

export function compileTypstToPdf(
  source: string,
  options?: TypstCompileOptions,
): Promise<TypstCompileResult>;
export class TypstCompileError extends Error { /* exitCode, stderr */ }
```

**Stable through Phase 2** —— 这些签名在 Phase 2 末（reviewer agent 加入、
Marimo 嵌入加入、模板系统加入）之前**只能加可选参数，不能改已有字段语义**。
任何破坏性改动必须新写 ADR。

### 2.3 typography pre-pass 调用约定

`packages/typography` 暴露 4 组 helper（`language` / `cjk-spacing` /
`smart-quote-by-lang` / `font-tokens`）。两边渲染器**约定**在以下时机调用：

| 时机 | render-myst | render-typst |
|---|---|---|
| 字体选择 | `getFontTokens(lang)` → CSS `font-family` | `getFontTokens(lang)` → Typst `font` |
| 文本节点 → emit 之前 | `applyCjkSpacing` + `smartQuoteByLang` | 同 |
| 标题（heading）字符串 | 同上 | 同上 |
| Code block / `<pre>` 内容 | **不调用**（保留 ASCII 原貌）| **不调用** |
| Inline / display math | **不调用**（LaTeX 字符串原样透传）| **不调用** |

**幂等性保证**：`applyCjkSpacing` 看到已分隔的 CJK/Latin 不重复加空格；
`smartQuoteByLang` 看到已转 curly 的引号不再转。这让**重新导出**（已渲染 HTML
被存为草稿、再次导出 PDF）不会双倍排版。

**font tokens 的 fallback chain 单一来源**：`packages/typography/src/font-tokens.ts`
是唯一定义；HTML / JATS / Typst 三个 emitter 都从这里取。修改字体策略只改一处。

### 2.4 PM schema 演化规则（Phase 2 准备）

**Phase 1 锁定的 PM node types**（11 项）：

```
paragraph, heading, blockquote, list, list-item, code-block,
equation, inline-equation, citation-ref, dataset-ref,
computational-cell, figure, figure-caption, footnote-ref,
annotation-anchor (mark), bold (mark), italic (mark)
```

> Phase 1 D10 实际登记的 9 个 PM extension 都映射到上面，外加 footnote-ref 与
> dataset-ref 占位（schema 已认，Phase 1.5 加 NodeView UI）。

**演化规则（Phase 2 起）**：

1. **加新 node type**：渲染器必须在同一 PR 加对应 emitter 分支（HTML / JATS / Markdown
   / Typst 四处 + 一行单测 fixture）。否则 lint 报"unknown node kind"，PR 不能合并。
2. **加新 attrs 字段**：可向后兼容（emit 端忽略未知 attrs）；渲染器消费新 attrs
   时必须 nullable 处理。
3. **改已有 node 语义**：必须新写 ADR + 数据迁移脚本（document.body bytea 不动，
   read 时按版本走兼容分支）。Phase 2 reviewer-flag mark 加入是这个等级。
4. **删 node type**：禁止。soft deprecate（emitter 留 fallback，编辑器 UI 隐藏入口）。

**Schema 单一来源（Phase 1.5 计划）**：把当前两份 `PmNode` / `PmDocInput` 接口提到
`@collaborationtool/schema` 包的 `pm-doc.ts`，render-myst / render-typst /
ai-runtime（处理 proposal diff 时也要解析 PM）/ snapshot-worker（reconcile 时
比 Y.Doc → PM JSON）共用。Phase 1 没提取是因为 D12 落地紧、4 处复制成本可控；
Phase 1.5 是这件事的 deadline。

### 2.5 字符串转义责任

| 调用方 | 转义责任 |
|---|---|
| editor-core → renderer | **不**做 HTML/XML 转义（PM 文本是普通字符串） |
| renderer 内部 emitter | 必须在 emit 前 `escapeHtml` / `escapeXml` / `escapeTypstMarkup` / `escapeTypstString` |
| renderer 输出 → 用户 | 已是目标语言的合法字符串 |

`packages/render-typst/src/escape.ts` 暴露 `escapeTypstMarkup` 与
`escapeTypstString`（前者用于正文 markup 上下文，后者用于 `#set document(title: "...")`
的字符串 literal）。两个不可互换。

---

## 3. Consequences

### Good

- **可在 Node-only 环境跑**：导出 API（`apps/web/src/app/api/export/[docId]/[format]/route.ts`）、
  CI 单测、未来的 worker 都能直接 import 渲染器，无 DOM / browser 污染
- **可重新导出**：典型场景 "存 HTML 草稿 → 半年后导 PDF" 经过同一份 PM JSON 不会双倍
  排版（pre-pass 幂等）
- **测试矩阵小**：每个 emitter 一组 fixture（PM JSON 输入 → expected output snapshot），
  PM schema 变更可一键扫出所有影响
- **Phase 2 加 mystmd 官方 lib 是替换 `pmToMystAst` 一个文件**，不影响下游消费者

### Bad / Trade-offs

- **PmDocInput 重复定义**：render-myst 与 render-typst 各有一份相同接口
  → Phase 1.5 必修（提到 schema 包）
- **citation 元数据 join 是调用方责任**：导出 API 现在不做 join，所以 HTML 里
  citation 是 `[<id>]` 而不是 "(Smith 2024)"。Phase 2 加 join layer。
- **MyST AST 自写而非用 myst-spec**：Phase 1 我们的 AST 是 myst-spec 子集；
  myst-spec 的官方 transformer 包用了 unified ecosystem，pull in remark / mdast
  几十个包 → 抑制 deps 体积，Phase 1 自写 ~200 行。Phase 1.5 评估替换。
- **Typst 模板硬编码在 source-from-pm 里**：preamble 是固定字符串模板，期刊
  house style 调整 = 改 `pmToTypstSource` 内部。Phase 2 模板系统拆出。

### Neutral / Need watching

- **Schema 演化触发 4 处 emit 改动**：每加一个 PM node type 是 4 文件 + 4 fixture
  的 CR；如果 Phase 2 加 5+ 新 node type（reviewer-flag mark / theorem / proof /
  table / interactive-figure），是否值得引入"emit pluggability"——延到 Phase 3 看
  实际负担再决定，不预先抽象
- **Markdown round-trip 不是双向无损**：`mystAstToMarkdown` 输出 MyST flavored
  Markdown，但**没有**对应的 `markdownToMystAst` 入口（D12 没做）。Phase 2 加
  invitation 流时如果支持 "粘贴 Markdown 创建文档"才需要补上
- **PDF 编译需 typst >= 0.14**：服务器 PATH 缺 typst → 返 503 + hint，UX 已就绪；
  但 docker image 必须 `apt-get` 或下载 typst，部署 ADR-0004 §2.1 已交代

---

## 4. Alternatives considered

### A. 编辑器直接 emit Markdown / HTML（无中间 PM JSON）

**是什么**：TipTap 自带 `editor.getHTML()` / `editor.storage.markdown.getMarkdown()`。

**为什么不**：
1. TipTap 的 Markdown 输出不是 MyST flavored，缺 cite / dataset-ref / equation 语法
2. HTML 出口绑死在 DOM；服务器渲染要装 jsdom
3. JATS / Typst 没有现成 emitter，自己写起步是从 PM JSON walker 写起——既然如此，
   一开始就以 PM JSON 为契约更直
4. 重新导出场景：HTML → 反向解析回 PM JSON 是开销 + 信息丢失

### B. AST 标准化为 mdast / unified ecosystem

**是什么**：直接以 mdast 为内部表示，用 `unified` + `remark-*` plugins 串 emitter。

**为什么不（Phase 1）**：
1. mdast 不原生支持 cite / dataset-ref / computational-cell——还要 plugin 扩
2. unified pipeline 引入 remark / rehype / mdast-util-* 几十包；Phase 1 渲染器加起来
   <800 LOC，引入 unified 是反向膨胀
3. mystmd 官方 transformers（基于 unified + custom plugins）Phase 1.5 成熟时再
   评估替换

**什么情况会回头**：Phase 2 加.docx / EPUB（pandoc-style 多目标）后，emitter 维护
成本超过 5 处时考虑统一到 unified。

### C. Renderer 接受 Y.Doc binary 而非 PM JSON

**是什么**：渲染器入参 `Uint8Array`（Yjs update bytes），内部 `new Y.Doc().applyUpdate()`
取 ProseMirror state。

**为什么不**：
1. 渲染器要 import `yjs` + `y-prosemirror`——污染依赖 + 增构建体积
2. 没法在 CI 单测里手写 fixture——必须先编辑得到 binary
3. PM JSON 是更自然的契约：editor.getJSON() / snapshot-worker 反向 dump 都能产出

### D. 把 typography pre-pass 嵌入编辑器（而非渲染器）

**是什么**：用户敲键盘时 IME commit 后立刻应用 cjk-spacing + 智能引号。

**为什么不（Phase 1）**：
1. CRDT 协作下"编辑期改文本"会与协作者的 cursor 冲突
2. 用户撤销（Cmd+Z）的语义复杂——是撤销输入还是撤销自动转换？
3. 多语言文档：当前段落是 zh-Hans 还是 en？要给每个 paragraph 一个 lang
   attr——大动作

**正确做法（已采用）**：编辑器存原始 keystroke；渲染时统一 pre-pass。**幂等性
保证**让"再编辑 → 再渲染"链路正确。

---

## 5. Decision log

- **2026-05-08**：决定 PM JSON 是 wire format，渲染器走 plain JSON 而非
  TipTap Schema 实例。理由：服务器端运行无 DOM 依赖；fixture 易写；JSON 是
  存档友好（document.body 二进制 + 周期 PM JSON dump 是 Phase 2 备份策略）。
- **2026-05-08**：决定不引入 unified / mdast。理由：Phase 1 4 emitter
  ~800 LOC，unified 引入几十包反而是负担；mystmd 官方 transformer Phase 1.5
  成熟后再换。
- **2026-05-08**：决定 typography pre-pass 在渲染器侧（不在编辑器侧）。
  理由：CRDT + IME + 撤销语义太复杂；幂等性保证让多次 pre-pass 不出错。
- **2026-05-08**：决定 `PmDocInput` Phase 1 重复定义可接受、Phase 1.5 必提到
  `@collaborationtool/schema`。理由：D12 落地紧；4 处复制 + 类型对齐 lint 在
  Phase 1 是 100 行 PR；Phase 1.5 之前只要不再加第 5 处复制即可。

---

## 6. Phase 1 implementation review log

- **D10**：editor-core 的 `paperSchema()` 输出第一次形成稳定 PM JSON tree；
  9 个 PM extension 都通过 `editor.getJSON()` 序列化 round-trip 测过
- **D12**：render-myst (HTML/JATS/Markdown) + render-typst (Typst/PDF) +
  typography 三包同 PR 落地，5 emitter 共 800 LOC；fixture 18 个 snapshot 测试
- **D15**：双语 specimen（500 字中英混排 + 5 引用 + 1 公式 + 1 figure +
  1 注释锚点 + 1 computational-cell）通过 e2e 验收，5 格式都能成功导出；
  PDF 在 typst 0.14 上 < 1s 完成
- **未触发**：Phase 1 没有任何"加新 PM node type"的需求；schema 演化规则
  Phase 2 起首次实战
- **遗留 Phase 1.5**：PmDocInput 提取到 schema 包；citation join layer；
  Word / .docx 接入；mystmd 官方 transformer 评估

### Phase 6 Spike-2 review log — markdown emit ↔ PM JSON wire 兼容性（2026-05-12）

> 加于 2026-05-12（Phase 6 Spike-2 完工）。回应 client-first pivot
> （`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`）在
> `packages/vault-fs/` 引入第 6 个 emitter（markdown ↔ Y.Doc reconcile）
> 需要的兼容性证据。

**Spike-2 落地的兼容性测试**（branch `claude/spike-2-vault-fs`）：

| 验证项 | 结果 | 测试文件 |
|---|---|---|
| `emitMarkdown(yDoc)` 走 `yXmlFragmentToProsemirrorJSON` → paperSchema().nodeFromJSON(pmJson) → MarkdownSerializer.serialize；保持 PM JSON 作为 wire format（本 ADR §2 决策） | PASS | `packages/vault-fs/src/ydoc-to-markdown.ts` |
| `parseMarkdown(md)` 走 defaultMarkdownParser → PM JSON → renameMarks (strong→bold, em→italic) + flatten 不支持 block → prosemirrorJSONToYDoc | PASS | `packages/vault-fs/src/markdown-to-ydoc.ts` |
| 双向 round-trip 稳定：`emit(parse(emit(parse(md)))) === emit(parse(md))` | PASS | `tests/markdown-to-ydoc.test.ts:38` |
| 9 paper-schema custom node (claim/evidence/figure/figureCaption/equation/computationalCell/inlineEquation/citationRef/datasetRef/footnoteRef) emit 为 HTML comment 兜底；preserve round-trip | PASS | `tests/markdown-to-ydoc.test.ts:46` |
| TipTap mark 命名（bold/italic）和 prosemirror-markdown 默认 schema 的 strong/em 别名对齐 | 别名 mapping 已加，PASS | `src/ydoc-to-markdown.ts:46-50` |

**对本 ADR §2 决策的修正**：本 ADR 立的 "PM JSON 是 wire format" 决策
**继续 valid**——Spike-2 第 6 个 emitter (markdown) 严格走 PM JSON 中间
表示，未引入第 2 个 wire format。

**遗留到 Phase 6 W3-W4**：
- HTML comment 兜底替换为 markdown directive (`::claim{...}`) — 需 markdown-it
  custom plugin，并把 `paper-schema custom nodes` 加进 `defaultMarkdownParser`
  替代品（基于 markdown-it tokens 写新 MarkdownParser，对齐 paperSchema）。
- defaultMarkdownParser 不支持的 block (bullet_list/ordered_list/list_item/
  blockquote/code_block/horizontal_rule/hard_break/image) 在 Spike-2 flatten
  为 paragraph；Phase 6 W3-W4 加 paperSchema list / blockquote / code_block /
  image extension 后切换为 lower-to-schema 实现。

---

## 7. References

- ADR-0001 §2.2（ProseMirror schema 关键约定 / atom node）
- ADR-0001 §2.3（八个核心实体 — Block / Citation / Document）
- ADR-0003 §2.6（render pipeline 锁定 — MyST + Typst 双轨）
- `packages/editor-core/src/schema.ts`（paperSchema 定义）
- `packages/render-myst/src/index.ts`（exports surface）
- `packages/render-typst/src/index.ts`（exports surface）
- `packages/typography/src/index.ts`（pre-pass helper surface）
- `apps/web/src/app/api/export/[docId]/[format]/route.ts`（消费方示范）
- `docs/USER_GUIDE.md` §4（导出格式矩阵）
- MyST Spec: https://mystmd.org/spec
- Typst docs (`typst compile`): https://typst.app/docs/reference/foundations/
- ProseMirror schema basics: https://prosemirror.net/docs/guide/#schema
