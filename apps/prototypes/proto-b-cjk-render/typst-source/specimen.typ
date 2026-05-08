// Bilingual rendering specimen for the Typst pipeline.
// Covers the same six edge cases as myst-source/index.md, in the same order.
//
// Font fallback chain (best-effort given system fonts):
//   - 拉丁正文：New Computer Modern (typst 默认 serif) → DejaVu Serif
//   - 中文正文：WenQuanYi Zen Hei（Linux 默认 CJK）
//   - 公式：New Computer Modern Math
//
// 真实 Phase 1 部署应当切到 Source Han Serif / Source Han Sans / IBM Plex
// Sans / Noto Sans CJK，但本机 sandbox 没有这些字体，先用 WenQuanYi Zen Hei
// 验证结构性排版（标点挤压、CJK-Latin 间距、断行）行不行。

#set document(title: "协作论文平台 · CJK 渲染样张 / Bilingual rendering specimen")
#set page(paper: "a4", margin: 2.5cm)
#set par(justify: true, leading: 0.7em, first-line-indent: 2em)
#set text(
  size: 11pt,
  lang: "zh",
  region: "cn",
  // Mixed-script fallback: latin glyphs from CMU/DejaVu, CJK from WenQuanYi.
  font: ("New Computer Modern", "DejaVu Serif", "WenQuanYi Zen Hei"),
)
#show heading: set text(weight: "bold")
#show heading.where(level: 1): set text(size: 16pt)
#show heading.where(level: 2): set text(size: 13pt)

// CJK-Latin auto-spacing (clreq style). Typst 0.14 has built-in CJK
// punctuation squeeze via `set text(lang: "zh")`; for CJK-Latin spacing
// we add a thin space between ASCII and CJK boundaries via show rule.
// (Best-effort heuristic; production code would integrate the
//  typst-doc-cn/clreq companion.)

#show regex("([\p{Han}])([A-Za-z0-9])"): it => {
  let parts = it.text.match(regex("(.)(.+)"))
  if parts != none {
    parts.captures.at(0)
    h(0.15em)
    parts.captures.at(1)
  } else {
    it
  }
}
#show regex("([A-Za-z0-9])([\p{Han}])"): it => {
  let parts = it.text.match(regex("(.+)(.)$"))
  if parts != none {
    parts.captures.at(0)
    h(0.15em)
    parts.captures.at(1)
  } else {
    it
  }
}

#align(center)[
  #text(size: 18pt, weight: "bold")[协作论文平台 · CJK 渲染样张]\
  #text(size: 12pt)[Bilingual rendering specimen — Phase 0 D4 prototype]
]

#v(1em)

= 1. 引言 / Introduction

Phase 0 是关键路径。系统第一性原理 #h(0.1em) #10 警告：「先简单后扩展」在分布式系统和数据模型上经常是骗局。我们用 ProseMirror 的 schema 模型承载论文级语义（theorem、proof、citation 这些 first-class 节点）。

The first-principles document explicitly says: _"Markup-as-source, WYSIWYM rendering."_ 底层是结构化文本（MyST / Typst / 类似），用户看到的是富文本 + 实时预览。

技术细节涉及 76% 的协作者会同时编辑同一段落（cf. Linear 的并发数据），其中 GPT-4o 与 Claude Opus 4.7 的输出会被作为 inline 改写候选；标点挤压（如「，」「。」「；」在中文段落里）和 CJK-Latin spacing（中文与 ProseMirror 之间）需要排版引擎自动处理。

= 2. 公式 / Equations

数据收敛函数定义为：

$ rho(t) = 1 / N sum_(i=1)^N bb(1) [s_i^((t)) = s_*] $

其中 $s_i^((t))$ 表示第 $i$ 个客户端在时刻 $t$ 的状态，$s_*$ 是收敛目标；当 $rho(t) -> 1$ 时认为系统已达到 CRDT 收敛。

行内公式示例：能量与质量的关系是 $E = m c^2$，速度场满足 $nabla dot bold(v) = 0$。

= 3. 引用与脚注 / Citations and footnotes

研究 (Smith 2024) 表明在 50+ 协作者场景下，awareness gossip 风暴是主要瓶颈#footnote[Linear 的工程团队在公开 talk 中讨论过类似经验：_"once you cross \~30 simultaneous cursors per doc, awareness becomes the dominant cost."_ 见 Linear engineering blog 2023.]。中文文献例如《编辑实务》(王明 2023) 同样指出"跨语种排版的核心是间距与断行"。

= 4. 排版边角案例 / Typography edge cases

下列样张测试六个易翻车的排版细节：

+ *句末标点挤压*：他说，「我同意。」我们应该继续讨论。注意「」之后的空白与之前的标点不应连成两格。
+ *中英混排间距*：使用 ProseMirror v2.10 的 schema-driven design，我们将 atom node 与 inline mark 分开管理。这里"ProseMirror v2.10"前后应有半字距。
+ *破折号与连字符*：协作模式 —— 包含人写、机器建议、社区贡献 —— 是一个动词，不是名词。dash 不应被误识为 hyphen-minus。
+ *数字与单位*：CRDT 在 250 ms 内收敛；Y.Doc binary 通常 \< 1 MB；50+ 协作者时 awareness 包尺寸约 12 KB / s。
+ *上下引号*：英文段落里 "double quotes" 应是弯引号；中文段落里"双引号"应使用宽引号。Mixed: "x86_64" 是架构代号。
+ *CJK 行末禁则*：标点符号「，。、；：！？」不出现在行首；连续打开的「（《【"」不出现在行末。

= 5. 图说 / Figure caption

#figure(
  caption: [图 1 / Figure 1：CRDT 收敛过程示意（5 client × 50 ops；所有 client 字节一致后停止）],
  raw("     Client 0 ───┐
     Client 1 ───┤
     Client 2 ───┼────▶ converged state vector
     Client 3 ───┤
     Client 4 ───┘"),
)

The placeholder above stands in for an actual figure; in the real paper this would be a vector diagram from `apps/prototypes/proto-a-yjs-schema/src/stress/run-stress.ts`.

= 6. 总结 / Conclusion

本样张覆盖六个维度：标点挤压、CJK-Latin 间距、破折号识别、数字单位混排、引号一致性、行末禁则。任何排版引擎在这六项上的失败模式应在 D4 报告中具体记录，作为 Phase 1 印刷 PDF backend 选型的实证依据。
