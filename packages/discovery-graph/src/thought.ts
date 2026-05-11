// Thought — generic Night atomic unit (ADR-0020 §2.1).
//
// Use when no more specific Night type fits (metaphor / contradiction /
// question / sketch / thought-experiment). Free-form prose + optional
// links to other artifacts. The "default" Night artifact for capturing
// arbitrary research thoughts.

import type { NightArtifactBase, NightArtifactId } from './_shared';

export interface Thought extends NightArtifactBase {
  kind: 'thought';
  // Casual "see also" references to other Night artifacts. Stronger
  // cross-layer lineage goes through interaction-mode edges (Wave D-3).
  seeAlso?: readonly NightArtifactId[];
}
