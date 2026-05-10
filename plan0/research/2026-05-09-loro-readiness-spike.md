# Spike report: Loro 生产就绪重评估（vs Yjs / Automerge 3）

**Status**: Phase 2.5 closeout report (desk-research only)
**Date**: 2026-05-09
**Author**: claude/review-project-goals-TpFuH
**Trigger**: phase-2-plan-stub §7.1 "API 稳定性、ProseMirror 适配、CJK 文本边界、与 Yjs y-prosemirror 收敛行为对比"

---

## 1. Why this spike

Phase 1 ADR-0003 §2.x picked **Yjs** (with `y-prosemirror`). The reasons were:
- Mature ProseMirror integration (`y-prosemirror`)
- Battle-tested by Tiptap, Notion, etc.
- Plenty of community CRDT examples

ADR-0010 §4 + Phase 2 stub §七 listed Loro as "watchable, possibly disruptive" — the project philosophy explicitly admires "颠覆性新技术". Phase 2 W3 was supposed to bench Loro against Yjs.

This spike asks: **should Phase 3 / 4 switch?** (No commit; just go/no-go criteria.)

---

## 2. Findings (desk research, late 2024 / early 2025)

| Dimension | Yjs (current) | Loro | Verdict |
|---|---|---|---|
| API stability | 13.x stable since 2022 | 1.0-rc as of late 2024; breaking changes in 0.x | Yjs wins |
| ProseMirror integration | `y-prosemirror` mature, used in production by Tiptap/Notion | `loro-prosemirror` exists but pre-1.0 + thin community | Yjs wins |
| CJK text edge cases | Verified via Phase 0 proto-a (`apps/prototypes/proto-a-yjs-schema/`) — 中文 + 双向 + 复杂边界 OK | Loro claims good Unicode but hasn't been bench'd in our setup | Unknown |
| History size + perf | y.UndoManager works; large docs (>10K commits) get slow | Loro claims O(log n) operations, smaller history footprint, faster sync | Loro **possibly** wins at scale |
| Embedded artifacts | Phase 1 `attrs.<entityId>` pattern works fine in y-prosemirror | Loro's API offers richer metadata semantics; might allow tidier per-block provenance | Loro slight edge, untested |
| Multi-process collab | Yjs via y-websocket, awareness via `y-protocols/awareness` | Loro has Sync server design but ecosystem thinner | Yjs wins |
| Subdocument support (Phase 3 §一 50+ 协作者) | y-prosemirror doesn't natively support cross-subdoc PM atom; needs careful wiring | Loro 1.0 reportedly has cross-doc references built-in | Loro **possibly** wins (if claim holds) |
| Migration cost from Yjs | High: PM step format + binary update format both Yjs-specific | Loro provides import-from-yjs adapter, but content + history sync is non-trivial | High either way |

---

## 3. Decision

**Continue on Yjs through Phase 2.5 + Phase 3. Re-evaluate Loro before Phase 4.**

Reasons:
1. **No urgent pain**: Phase 2 dogfood gate showed PG round-trip + y-prosemirror works for the editor flows we have
2. **Loro pre-1.0 risk**: Phase 2's user philosophy "新技术敢上" is real, BUT "避免过度兼容性" cuts the other way — switching CRDTs mid-build is expensive if Loro 1.0 introduces yet another breaking change
3. **Subdocument is the real test**: Phase 3 §一 50+ 协作者 needs subdocument support; if y-prosemirror's subdoc story is too painful when we get there, Loro's cross-doc references become attractive
4. **Switch is re-evaluable, not impossible**: Yjs → Loro adapter exists; Phase 4 still has time

**Re-evaluation triggers**:
- Loro 1.0 stable release
- Phase 3 W6 subdocument prototype shows y-prosemirror cross-subdoc PM atoms hit a wall
- Performance at >100 concurrent users degrades materially in Yjs (load test in Phase 4)
- Major CRDT bug in Yjs 13.x that maintainers don't fix promptly

---

## 4. What we'd need before switching

A future "switch to Loro" ADR (ADR-0012 or later) needs:

1. **Output equivalence test**: Two PM trees authored on Yjs vs Loro must converge to identical content under the same edit sequence
2. **History migration plan**: Existing Yjs binaries can be imported to Loro losslessly OR users accept fresh history starting at switch date
3. **Subdocument story**: Whatever Phase 3 chooses for chapter-level isolation must be reproducible on Loro
4. **PG persistence layer compat**: Y.Doc binary blobs in `document.yjs_doc_binary` need a migration script (snapshot → Loro snapshot)
5. **Provenance + Citation links**: ADR-0001 §2.3 atom-node ID model is CRDT-agnostic, so this should be free, but verify

---

## 5. Action items

- [x] Document spike findings (this file)
- [ ] Phase 3 W6 subdocument prototype: include Loro as 1 of 2 candidates explicitly
- [ ] Phase 4 kickoff: re-bench against current Loro 1.0+ + run subdoc + perf test
- [ ] Open ADR-0012 only when at least one re-evaluation trigger fires
