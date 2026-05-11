// claim-review-anchor: inline mark that decorates a claim with a
// summary of its review lineage (verdict buckets + latest reviewer
// ORCID). Phase 5 Wave B B2 (ADR-0016 §2.2).
//
// Why a Mark instead of a Node:
//   - claim itself is a Node (block container, paragraph+ content).
//   - The "review status" is decoration ON the claim, not new content.
//     One claim → one anchor; the anchor never spans multiple claims.
//   - Marks let hover/click handlers attach naturally (same machinery
//     as citation-ref hover popovers in the editor mount).
//
// Three render contexts (Design.md §6 surface 准则 + accent triad):
//   - Reviewer view:  highlights claims THIS user has verdict'd
//   - Author view:    margin entry shows verdict bucket aggregate
//   - Public view:    edge color stripe by majority verdict
//
// Renderers (render-myst / render-typst) emit a stable inline span
// with `data-pm-mark="claim-review-anchor"` + `data-verdict-buckets`
// attrs so downstream tooling can find the anchor in the export.
//
// CSS / accent triad SoT (Design.md §3):
//   - accent-moss  = endorses
//   - accent-ox    = challenges
//   - accent-ink   = refines

import { Mark, mergeAttributes } from '@tiptap/core';

export interface VerdictBuckets {
  endorses: number;
  challenges: number;
  refines: number;
}

export type DominantVerdict =
  | 'endorses'
  | 'challenges'
  | 'refines'
  | 'mixed'    // 2+ buckets tied for max
  | 'empty';   // no verdicts yet (anchor pre-seeded)

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    claimReviewAnchor: {
      addClaimReviewAnchor: (
        claimId: string,
        buckets?: VerdictBuckets,
        latestReviewerOrcidId?: string | null,
      ) => ReturnType;
      removeClaimReviewAnchor: () => ReturnType;
    };
  }
}

const ZERO_BUCKETS: VerdictBuckets = Object.freeze({
  endorses: 0,
  challenges: 0,
  refines: 0,
}) as VerdictBuckets;

/** Pure helper — emit the dominant verdict for an anchor's CSS class. */
export function dominantVerdict(buckets: VerdictBuckets): DominantVerdict {
  const { endorses, challenges, refines } = buckets;
  const total = endorses + challenges + refines;
  if (total === 0) return 'empty';
  const max = Math.max(endorses, challenges, refines);
  const tied = [
    endorses === max ? 'endorses' : null,
    challenges === max ? 'challenges' : null,
    refines === max ? 'refines' : null,
  ].filter((x): x is 'endorses' | 'challenges' | 'refines' => x !== null);
  return tied.length === 1 ? tied[0]! : 'mixed';
}

/** Pure helper — accent-triad CSS class for an anchor (Design.md §3.2). */
export function anchorAccentClass(buckets: VerdictBuckets): string {
  switch (dominantVerdict(buckets)) {
    case 'endorses':
      return 'pm-mark-claim-review-anchor accent-moss';
    case 'challenges':
      return 'pm-mark-claim-review-anchor accent-ox';
    case 'refines':
      return 'pm-mark-claim-review-anchor accent-ink';
    case 'mixed':
      return 'pm-mark-claim-review-anchor accent-mixed';
    case 'empty':
    default:
      return 'pm-mark-claim-review-anchor accent-empty';
  }
}

function parseBuckets(raw: string | null): VerdictBuckets {
  if (!raw) return { ...ZERO_BUCKETS };
  try {
    const parsed = JSON.parse(raw) as Partial<VerdictBuckets>;
    return {
      endorses: Number(parsed.endorses) || 0,
      challenges: Number(parsed.challenges) || 0,
      refines: Number(parsed.refines) || 0,
    };
  } catch {
    return { ...ZERO_BUCKETS };
  }
}

export const ClaimReviewAnchor = Mark.create({
  name: 'claimReviewAnchor',
  inclusive: false,
  // Each anchor is one logical unit per (claimId, range). Don't merge
  // adjacent anchors that happen to have identical attrs — they may
  // represent two separate claim instances spliced together.
  spanning: false,

  addAttributes() {
    return {
      claimId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-claim-id'),
        renderHTML: (attrs) => ({ 'data-claim-id': attrs['claimId'] }),
      },
      verdictBuckets: {
        default: { ...ZERO_BUCKETS },
        parseHTML: (el) => parseBuckets(el.getAttribute('data-verdict-buckets')),
        renderHTML: (attrs) => ({
          'data-verdict-buckets': JSON.stringify(
            attrs['verdictBuckets'] ?? ZERO_BUCKETS,
          ),
        }),
      },
      latestReviewerOrcidId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-latest-reviewer-orcid'),
        renderHTML: (attrs) =>
          attrs['latestReviewerOrcidId']
            ? { 'data-latest-reviewer-orcid': attrs['latestReviewerOrcidId'] }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-pm-mark="claim-review-anchor"]' }];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const buckets = (mark.attrs['verdictBuckets'] as VerdictBuckets) ??
      ZERO_BUCKETS;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pm-mark': 'claim-review-anchor',
        class: anchorAccentClass(buckets),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      addClaimReviewAnchor:
        (
          claimId: string,
          buckets: VerdictBuckets = { ...ZERO_BUCKETS },
          latestReviewerOrcidId: string | null = null,
        ) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            claimId,
            verdictBuckets: buckets,
            latestReviewerOrcidId,
          }),
      removeClaimReviewAnchor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
