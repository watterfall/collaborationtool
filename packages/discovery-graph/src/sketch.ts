// Sketch — Night atomic unit (ADR-0020 §2.1).
//
// Per jili night_science_concepts.md #68 "草图不是差的成品" — a sketch
// is a *thinking medium*, not a draft of a finished diagram. Encodes
// informal externalisation: drawing / diagram / hand-written notes /
// whiteboard photo / napkin scribble. Often the most compressed form
// of a night-science thought.

import type { NightArtifactBase } from './_shared';

export type SketchMedium =
  | 'svg' // 矢量草图 (inline SVG or stored URL)
  | 'raster-image' // bitmap (PNG/JPEG/etc.)
  | 'whiteboard-photo' // 白板照片
  | 'tablet-handwritten' // 平板手写 (PDF/SVG export)
  | 'ascii-diagram' // 纯文本图示 (mermaid-like)
  | 'external-link'; // 外部工具链接 (excalidraw / tldraw / figma)

export interface Sketch extends NightArtifactBase {
  kind: 'sketch';
  medium: SketchMedium;
  // URL or inline content reference. For svg/ascii-diagram this can be
  // inline content directly; for raster/whiteboard/external this is a
  // URL pointer.
  contentRef: string;
  // Caption — often more important to outsiders than the sketch itself.
  // Per jili: "草图本身是思考媒介,caption 让别人能进入".
  caption: string;
  // Tactile context — under what circumstance was this sketch made?
  // E.g. "在 lab notebook 上画的", "Slack 群讨论时草拟", "梦里想到".
  context?: string;
}
