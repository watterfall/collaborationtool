// Shared base types for the bridge-layer package — Bridge layer of the
// Night-Bridge-Day Triadic Architecture (ADR-0020 §2.1).
//
// Bridge is the explicit translation layer that Iteration 3 missed
// (per Appendix G of the brainstorm plan). jili's framework:
//
//   Night (生成/发散)      Bridge (转化/桥接)      Day (验证/收敛)
//   ───────────────       ───────────────────     ───────────────
//   metaphor / sketch     concept-prototype       paper / code /
//   contradiction         design-fiction          policy / dataset
//   thought / question    hypothesis-formal.
//   thought-experiment    analogy-mapping
//
// Bridge artifacts have stricter shape than Night (free-form) but
// looser than Day (full peer-reviewed claim). They are first-class
// outputs in the Triadic system — citable, archivable, attributable —
// not just a transient buffer on the way to Day.

import type {
  PrincipalId,
  IsoDateTime,
  LanguageTag,
  ProvenanceId,
} from '@collaborationtool/schema';

// Re-use the cross-layer ID brands declared centrally in discovery-graph,
// so Wave D-3 cross-layer references can be typed without import cycles.
import type {
  NightArtifactId,
  BridgeArtifactId,
  DayArtifactId,
  VisibilityTier,
  ArtifactStatus,
} from '@collaborationtool/discovery-graph';

export type {
  PrincipalId,
  IsoDateTime,
  LanguageTag,
  ProvenanceId,
  NightArtifactId,
  BridgeArtifactId,
  DayArtifactId,
  VisibilityTier,
  ArtifactStatus,
};

// Re-use the 5 mode-tag taxonomy from discovery-graph so Bridge artifacts
// participate in the same tag system as Night artifacts (per ADR-0020
// §2.2 — modes are schema-level tags, not layer-specific).
import type { ModeTag } from '@collaborationtool/discovery-graph';
export type { ModeTag };

// Base shape inherited by all Bridge artifact types. Bridge defaults to
// `collaborator` visibility (vs Night `private`) because the whole point
// of a Bridge artifact is to enable cross-domain conversation.
export interface BridgeArtifactBase {
  id: BridgeArtifactId;
  authorPrincipalId: PrincipalId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  visibility: VisibilityTier;
  status: ArtifactStatus;
  language?: LanguageTag;
  provenanceId: ProvenanceId;
  modeTags: readonly ModeTag[];
  title: string;
  // Bridge body is typically more structured than Night freewriting but
  // less rigorous than Day claims. We don't enforce structure at the
  // schema level — that is each subtype's responsibility.
  bodyMarkdown: string;
  // Upstream Night artifact(s) this Bridge built on. Wave D-3 will type
  // these as full cross-layer reference edges (with interaction-mode);
  // for Wave D-2 we record the IDs only.
  sourceNightArtifactIds?: readonly NightArtifactId[];
  // Downstream Day artifact(s) this Bridge promoted into (if any).
  // Populated retroactively when a Day promotion happens.
  derivedDayArtifactIds?: readonly DayArtifactId[];
}
