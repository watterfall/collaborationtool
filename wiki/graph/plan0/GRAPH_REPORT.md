# Graph Report - plan0  (2026-05-12)

## Corpus Check
- 40 files · ~69,727 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 137 nodes · 270 edges · 13 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Architecture ADRs|Core Architecture ADRs]]
- [[_COMMUNITY_Plugin Runtime + Design SoT|Plugin Runtime + Design SoT]]
- [[_COMMUNITY_Triadic Architecture + ADR Governance|Triadic Architecture + ADR Governance]]
- [[_COMMUNITY_Competitive Landscape|Competitive Landscape]]
- [[_COMMUNITY_CRDT + Editor Stack|CRDT + Editor Stack]]
- [[_COMMUNITY_Future ADRs (Reserved)|Future ADRs (Reserved)]]
- [[_COMMUNITY_Cross-Cutting Concerns|Cross-Cutting Concerns]]
- [[_COMMUNITY_Phase 0 Core Decisions|Phase 0 Core Decisions]]
- [[_COMMUNITY_Typst Renderer Spike|Typst Renderer Spike]]
- [[_COMMUNITY_Misc 9|Misc 9]]
- [[_COMMUNITY_Misc 10|Misc 10]]
- [[_COMMUNITY_Misc 11|Misc 11]]
- [[_COMMUNITY_Misc 12|Misc 12]]

## God Nodes (most connected - your core abstractions)
1. `ADR-0020 Night-Bridge-Day Triadic Architecture` - 21 edges
2. `ADR-0010 Extension System + Plugin API + Skill Metadata` - 18 edges
3. `ADR Index` - 17 edges
4. `ADR-0002 Permission Model (Capability + Principal)` - 16 edges
5. `ADR-0001 Data Model & CRDT/Postgres Split` - 15 edges
6. `ADR-0008 Long-horizon Agent Runtime` - 15 edges
7. `Phase 6 (client-first pivot)` - 15 edges
8. `Improvement Plan 2026-05 (Council-driven)` - 15 edges
9. `ADR-0012 Plugin Sandbox + User Install + Capability UI` - 14 edges
10. `ADR-0014 Yjs Subdocument + Cross-reference Sync` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Prototypes report (Phase 0)` --implements--> `Phase 0 (prototypes / data model lock)`  [INFERRED]
  plan0/prototypes-report.md → plan0/ADR-INDEX.md
- `ADR-0016 Claim-on-Claim Review` --supersedes--> `ADR-0015 Open Peer Review + ORCID`  [AMBIGUOUS]
  plan0/adr/0016-claim-on-claim-review.md → plan0/adr/0015-open-peer-review-and-orcid.md
- `Phase 5 (Wave A/B/C/D)` --conceptually_related_to--> `Phase 6 (client-first pivot)`  [INFERRED]
  plan0/ADR-INDEX.md → plan0/adr/0019-plugin-runtime-cross-platform.md
- `Diff Library (prosemirror-changeset) + rebase semantics` --semantically_similar_to--> `Yjs Subdocument chapter-level split + cross-reference`  [INFERRED] [semantically similar]
  plan0/adr/0009-diff-library-and-revision-rebase.md → plan0/adr/0014-yjs-subdocument-and-crossref.md
- `Knowledge compiler essay integration (2026-05-09)` --semantically_similar_to--> `Claim/Evidence/Counterpoint/Synthesis Knowledge Objects`  [INFERRED] [semantically similar]
  plan0/research/2026-05-09-knowledge-compiler-essay-integration.md → plan0/adr/0011-claim-evidence-knowledge-object.md

## Hyperedges (group relationships)
- **Agent Runtime Stack (agent + plugin + sandbox + model provider)** — adr_0008, adr_0010, adr_0012, adr_0013 [EXTRACTED 0.95]
- **Phase 0 Foundation Trio (data + permission + tech stack)** — adr_0001, adr_0002, adr_0003 [EXTRACTED 1.00]
- **Claim/Review/ORCID Lineage (claim layer + open review + claim-on-claim)** — adr_0011, adr_0015, adr_0016 [EXTRACTED 0.90]
- **Wave D triadic architecture stack** — adr_0020, phase_5_wave_d, research_graphify_methodology, pkg_discovery_graph, pkg_bridge_layer [INFERRED 0.85]
- **Phase 4 W9 dogfood gate → ADR promote** — dogfood_report, improvement_plan_2026_05, adr_0012, adr_0013, adr_0014, week_w9, week_w10 [EXTRACTED 0.90]
- **Phase 6 client-first spike trio** — phase_6, spike_1_tauri_shell, spike_2_vault_fs, spike_3_plugin_runtime, adr_0017, adr_0018, adr_0019, concept_client_first_pivot [EXTRACTED 0.95]

## Communities

### Community 0 - "Core Architecture ADRs"
Cohesion: 0.22
Nodes (29): ADR-0000 Template, ADR-0001 Data Model & CRDT/Postgres Split, ADR-0002 Permission Model (Capability + Principal), ADR-0003 Tech Stack Lockdown, ADR-0004 Deployment Topology + Security Baseline, ADR-0005 Render API Boundary, ADR-0006 MCP Server Registry, ADR-0007 Computational Cell Embedding + iframe Protocol (+21 more)

### Community 1 - "Plugin Runtime + Design SoT"
Cohesion: 0.11
Nodes (27): ADR-0012 Plugin Sandbox + User Install + Capability UI, ADR-0013 ModelProvider Abstraction + BYO Model, ADR-0019 Cross-platform Plugin Runtime (WASM Extism + OS sandbox fallback), Claude design brief, Design.md reject criteria (13 rules commit gate), Dogfood gate, Plugin Sandbox (Bubblewrap / sandbox-exec / AppContainer), WASM Extism plugin runtime + OS sandbox hybrid (+19 more)

### Community 2 - "Triadic Architecture + ADR Governance"
Cohesion: 0.1
Nodes (24): ADR-0020 Night-Bridge-Day Triadic Architecture, 4 role differentiation (Explorer/Bridge-builder/Validator/Connector), 5 creative trigger modes (metaphor/contradiction/reframe/cross-domain/thought-experiment), 6 interaction modes (bidirectional info flow contract), ADR moratorium (new ADR freeze), AI-as-collaborator (not sidebar), Bridge layer (转化/桥接), Contribution-graph attribution (anti priority-race) (+16 more)

### Community 3 - "Competitive Landscape"
Cohesion: 0.16
Nodes (14): Curvenote (competitor), Overleaf (competitor), Prism (competitor), PubPub (competitor), Bilingual CJK + Latin first-class, Claim/Evidence/Counterpoint/Synthesis Knowledge Objects, 9x4 differentiation matrix (D1-D9 vs competitors), Landscape 9x4 matrix doc (+6 more)

### Community 4 - "CRDT + Editor Stack"
Cohesion: 0.19
Nodes (13): doc-store abstraction debt, Automerge (CRDT), Loro (CRDT), TipTap, y-prosemirror, Yjs (CRDT), Phase 5 Wave A — Honesty closeout, Phase 5 Wave A scope (+5 more)

### Community 5 - "Future ADRs (Reserved)"
Cohesion: 0.18
Nodes (11): ADR-0017 Client-first runtime (reserved), ADR-0018 Open content mechanisms (reserved), ADR-0021 discovery-graph schema migration (future), ADR-0022 bridge-layer schema migration (future), ADR-0023 triadic UI real data wiring (future), ADR-0024 puzzle classification reflection UI (future), Client-first pivot, Tauri (+3 more)

### Community 6 - "Cross-Cutting Concerns"
Cohesion: 0.29
Nodes (7): Long-horizon Agent Runtime (propose/accept state machine), Design Tokens (paper / ink / hairline / accent triad), Editorial aesthetic (warm-paper, serif, hairline, no SaaS cards), ModelProvider (4 wireFormat adapters, BYO model), Provenance (actorPrincipalId / agentContext / promptHash / toolCalls), Design.md (Design SoT), Rationale: warm paper #FBFAF7 chosen between chat spec #f7f3ea (too yellow) and brief (too cold)

### Community 7 - "Phase 0 Core Decisions"
Cohesion: 0.5
Nodes (4): Data Model (8 entities, Y.Doc + Postgres split), Diff Library (prosemirror-changeset) + rebase semantics, Yjs Subdocument chapter-level split + cross-reference, Rationale: Phase 0 data model is the most expensive decision (heterogeneous content graph, not text stream)

### Community 8 - "Typst Renderer Spike"
Cohesion: 0.67
Nodes (3): Typst (server CLI), Typst.ts (WASM), Typst.ts WASM spike (2026-05-09)

### Community 9 - "Misc 9"
Cohesion: 1.0
Nodes (1): MyST

### Community 10 - "Misc 10"
Cohesion: 1.0
Nodes (1): packages/ai-runtime

### Community 11 - "Misc 11"
Cohesion: 1.0
Nodes (1): packages/permissions

### Community 12 - "Misc 12"
Cohesion: 1.0
Nodes (0): 

## Ambiguous Edges - Review These
- `ADR-0015 Open Peer Review + ORCID` → `ADR-0016 Claim-on-Claim Review`  [AMBIGUOUS]
  plan0/ADR-INDEX.md · relation: supersedes

## Knowledge Gaps
- **52 isolated node(s):** `ADR-0000 Template`, `CRDT vs Postgres Field Split`, `Capability + Principal Permission Model`, `Tech Stack (11 items + dual pipeline render)`, `6-process Deployment Topology + Security Baseline` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Misc 9`** (1 nodes): `MyST`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 10`** (1 nodes): `packages/ai-runtime`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 11`** (1 nodes): `packages/permissions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 12`** (1 nodes): `paper-platform-landscape.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ADR-0015 Open Peer Review + ORCID` and `ADR-0016 Claim-on-Claim Review`?**
  _Edge tagged AMBIGUOUS (relation: supersedes) - confidence is low._
- **Why does `ADR-0020 Night-Bridge-Day Triadic Architecture` connect `Triadic Architecture + ADR Governance` to `Core Architecture ADRs`, `Plugin Runtime + Design SoT`?**
  _High betweenness centrality (0.310) - this node is a cross-community bridge._
- **Why does `Improvement Plan 2026-05 (Council-driven)` connect `Plugin Runtime + Design SoT` to `Triadic Architecture + ADR Governance`, `Competitive Landscape`, `CRDT + Editor Stack`, `Future ADRs (Reserved)`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Why does `Phase 6 (client-first pivot)` connect `Future ADRs (Reserved)` to `Plugin Runtime + Design SoT`, `Triadic Architecture + ADR Governance`, `Competitive Landscape`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **What connects `ADR-0000 Template`, `CRDT vs Postgres Field Split`, `Capability + Principal Permission Model` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plugin Runtime + Design SoT` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Triadic Architecture + ADR Governance` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._