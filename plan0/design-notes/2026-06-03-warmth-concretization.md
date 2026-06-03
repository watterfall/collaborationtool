# Design note — Warmth + Concretization（Design.md v1 → v2）

> 2026-06-03 · 载体说明：**这不是新编号 ADR**。ADR moratorium（CLAUDE.md §5.3）下
> 不起新 ADR；设计语言演进以 **Design.md v2 修订 + 本 note** 为载体（仿
> `docs/superpowers/specs/2026-05-12-landing-directness-design.md` 惯例）。

## 为什么（context）

项目所有者反馈：当前产品 **"太哲学、太抽象"**，要求大幅提升设计/UI。三路并行探索
（design-system / landing-content / surface-audit）一致结论：

- **视觉打磨本身已不错**（editorial 系统、paper-ink、hairline、8 token 组件，主力页 7–8/10）。
- 真正"抽象/冷"的根源有二：
  1. **内容/叙事**：landing 前三屏 ~80% 哲学散文，specimens 是概念 facsimile 而非真
     产品截图，pillars 讲技术栈不讲收益，`/triadic/*` 是空骨架。
  2. **视觉语言本身天生冷**：token 系统 monochrome（paper×3 + ink×3），accent triad
     明文"语义、绝不装饰、一屏不超一个"，没有暖色 / 立体 / motion token / 图标插画体系。

所有者拍板：**内容 + 视觉都要改、全面扫一遍、Design.md 可演进但先提案、明显升温、
认真做 triadic UI**。

## 改了什么（v2 增量）

| 维度 | 增量 | Design.md |
|---|---|---|
| 暖色 | `--color-warm-wash #F6EDE0` / `--color-warm-edge #E3D3B8`（<40% sat），仅 sectional 暖带 | §2.3 |
| 立体 | `--color-surface-0/1/2` + `--elev-lift`（硬边双 hairline，**无 blur**） | §2.4 |
| accent 填色 | `--color-accent-{ink,ox,moss}-wash`（rgba 0.06） | §2.5 |
| motion | `--motion-fast/base/slow` + `--ease-out`（收口散落字面量 + §9 曲线） | §4.4 |
| 组件 | ProductFrame（真截图 mat）/ Icon（本地 line-icon）/ LineGlyph（line-art grammar） | §5.9–§5.11 |
| reject | 13→16：+#14 禁模糊阴影、+#15 暖色天花板、+#16 只用真截图；放松 accent 装饰限制 | §11 |

落地文件：`apps/web/src/app/globals.css`（**唯一**新增 hex 的文件——
`components/design/*` 零 hex 纪律由 `design-components.test.ts` 强制）、
`components/design/{Icon,LineGlyph,ProductFrame}.tsx` + barrel + 测试。

## 被否的方案（为什么不那样做）

- **加第 4 个 accent 色相**（"友好色"）→ 否。直接破坏"一屏一个 accent"律 + 通向
  SaaS slop。改为：扩 triad 的 **usage**（wash 填色 + 暖色 wash 派生自 paper，不引新色相）。
- **加圆角"友好"UI 字体**（rounded sans）→ 否。这正是 SaaS tell；serif 本身已暖。
- **`npm install` Phosphor 图标库**→ 否。运行时依赖 + tree-shake 风险 + 1000 个用不上的
  glyph，违 moratorium 极简精神。改为**本地 ~15 个 line-icon + LineGlyph grammar**，
  保证 stroke 一致。
- **模糊 box-shadow 做立体**→ 否（reject #12/#14）。改为硬边双 hairline `--elev-lift`，
  letterpress 质感、零 blur。
- **/triadic 填假数据让页面好看**→ 否（provenance 价值观）。改为策划的**真实示例**
  （沿用 QEC 误差模型 lineage 叙事），明确标 example，真数据待 Wave D-5。

## 不动的（守住的第一性原理）

local-first / markup-as-source / **AI-as-collaborator（绝不 sidebar chatbot）** /
中英双语一等 / provenance 一等 / 延迟即设计。motion 仍 **CSS-only**（不引 Framer
Motion）。暖色有天花板（不做全局底色）。

## gate 变更

- CLAUDE.md §4.6 commit gate 加一条：`grep -E "box-shadow:\s*[^;]*[1-9][0-9]*px\s+[1-9]"`
  （模糊阴影即 fail），原有 blue/zinc/rounded/shadow/hex regex 不变。
- `design-components.test.ts`：新 3 组件加入 barrel 列表 + token-discipline files 数组
  + 渲染/属性透传断言。
- 验证：`pnpm typecheck` 全过 + `apps/web` 38 design-component 测试全过 + 该 grep 0 命中。
