# /demo — marketing + dogfood specimens
# /demo —— 营销与 dogfood 样张

This directory ships pre-built specimens that double as marketing
assets (linked from the landing page) and integration test fixtures.

本目录提供预编 specimens——既作首页营销资产，也作集成测试 fixture。

## Contents · 内容

### `specimen-bilingual.md` + `specimen-bilingual.json`
*Phase 1 D15 verification specimen.* Bilingual paper authored in the
editor, exported as MyST markdown + PM JSON. Exercises the 4-format
export pipeline.

*Phase 1 D15 验收样张。* 编辑器中创作的双语论文，导出为 MyST
markdown + PM JSON。覆盖 4 个导出格式管线。

### `onboarding.md`
*Phase 4 W6 onboarding specimen.* First-run document used by
`/docs/new` and the empty-state walkthroughs.

*Phase 4 W6 onboarding 样张。* 由 `/docs/new` 与空状态引导使用。

### `desci-review-pilot.md` + `desci-review-pilot.json` + `desci-review-pilot-fig1.svg`
*Phase 5 Wave C C2 — Claim-on-Claim Review pilot* (ADR-0016).
Illustrative bilingual review demonstrating:

*Phase 5 Wave C C2 —— Claim-on-Claim Review pilot* (ADR-0016)。
展示如下能力的示例双语评审：

- 5 claims (main / counter / synthesis) with status + confidence
- 3 evidences with `supports / qualifies / challenges` relations
- 2 ORCID-signed verdicts (one endorsing, one challenging with
  counter-evidence)
- 1 review DAG figure rendered with Design.md accent triad
- `aggregate` bucket counts feeding the `claim-review-anchor` PM mark
- Companion `desci-review-pilot.pdf` is **not** committed — it's
  generated externally via the Typst export route (Phase 5 W4
  follow-up will wire `/api/export/<docId>/typst-pdf` to compile this
  specimen and cache the result).

**Caveat: all ORCID iDs, JWS payloads, and reviewer principals are
illustrative.** Real Phase 5 pilots ship JWS payloads that verify
against ORCID's public JWKS (`https://orcid.org/oauth/jwks`); this
specimen uses placeholder strings so the file can ship to public/
without minting test signatures.

**注意：所有 ORCID iD、JWS 载荷与 reviewer principal 都是示例。**
真实 Phase 5 pilot 的 JWS 载荷可被 ORCID 公开 JWKS
(`https://orcid.org/oauth/jwks`) 验证；本样张使用 placeholder 字符串
以避免发布到 public/ 时引入测试签名。

## How to use · 用法

### As reading material · 作为阅读材料

Open `/demo/desci-review-pilot.md` from any markdown viewer (or
GitHub renders it inline).

### As an import target · 作为导入目标

Plumb `desci-review-pilot.json` into the Phase 4 W6.2 new-document
flow:

```
POST /api/document/new
  body: { templateId: "demo:desci-review-pilot" }
```

The template seeder reads from this directory (Phase 6 will move
templates into a database table; for now they live as static JSON
specimens).

### As a CI smoke target · 作为 CI 烟雾测试目标

E2E tests can fetch `/demo/desci-review-pilot.json` and assert the
shape against the AI-context-pack schema (Phase 5 W6 W9 dogfood gate
G3 follow-up).

## Phase 5 dogfood gate · Phase 5 dogfood gate

Per `improvement-plan-2026-05.md §三` Wave C, this specimen is the
public-facing artefact of the 5-year differentiation anchor. Once
Wave C lands a real ORCID-signed paper, that paper joins this
directory and `desci-review-pilot.{md,json,svg}` becomes the
*historical baseline* rather than the demo of record.

按 `improvement-plan-2026-05.md §三` Wave C 规划，本样张是 5 年差异化
锚点的对外公开物料。Wave C 真正 ship 1 篇 ORCID-signed 论文后，那篇
论文加入本目录，`desci-review-pilot.{md,json,svg}` 退为*历史基线*而
不再是当下演示样张。
