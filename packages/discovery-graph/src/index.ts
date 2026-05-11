// @collaborationtool/discovery-graph — Night layer atomic units for the
// Triadic Architecture (Night / Bridge / Day). See plan0/adr/0020-
// night-bridge-day-triadic-architecture.md for the strategic decision.
//
// Wave D-1 (Phase 5 W4-W5): 6 Night atomic units + 5 mode tags + 4 roles
// + contribution-graph attribution model.
//
// Future Waves:
// - Wave D-2 (W6-W7): packages/bridge-layer/ for the 4 Bridge atomic
//   units (concept-prototype, design-fiction, hypothesis-formalization,
//   analogy-mapping).
// - Wave D-3 (W8): cross-layer reference edges with the 6 interaction
//   modes (hypothesis-output, anomaly-input, constraint-transfer,
//   metaphor-bridge, question-return, method-transfer).
// - Wave D-4 (W9-W10): apps/web/src/app/triadic/ UI skeleton with
//   three equal-prominent surfaces.

export * from './_shared';
export * from './mode-tag';
export * from './role';
export * from './contribution-graph';
export * from './thought';
export * from './question';
export * from './metaphor';
export * from './sketch';
export * from './contradiction';
export * from './thought-experiment';
export * from './night-artifact';
// Wave D-3: 6 interaction modes + cross-layer reference edges.
export * from './interaction-mode';
export * from './cross-layer-reference';
