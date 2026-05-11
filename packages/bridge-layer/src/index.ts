// @collaborationtool/bridge-layer — Bridge layer atomic units for the
// Triadic Architecture (Night / Bridge / Day). See plan0/adr/0020-
// night-bridge-day-triadic-architecture.md §2.1 for the strategic
// decision and plan §G.3 for the Bridge-layer rationale (Iteration 3
// missed Bridge; Iteration 4 made it first-class).
//
// Wave D-2 (Phase 5 W6-W7): 4 Bridge atomic units (concept-prototype,
// design-fiction, hypothesis-formalization, analogy-mapping) + tests.
//
// Future Waves:
// - Wave D-3 (W8): 6 interaction-mode edges (hypothesis-output,
//   anomaly-input, constraint-transfer, metaphor-bridge,
//   question-return, method-transfer) + provenance writer extension.
// - Wave D-4 (W9-W10): apps/web/src/app/triadic/ surface for Bridge.
// - Wave D-5 (W11-W12): jili dogfood 30 days + ADR-0020 → Accepted.

export * from './_shared';
export * from './concept-prototype';
export * from './design-fiction';
export * from './hypothesis-formalization';
export * from './analogy-mapping';
export * from './bridge-artifact';
