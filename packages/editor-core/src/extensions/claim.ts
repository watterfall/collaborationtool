// claim: block container that holds a claim's prose body.
//
// Per ADR-0011 §2.1, this is a 2-of-2 new node added in Phase 2 W5
// (the other being `evidence`). It's a block container with
// `paragraph+` content so the prose can include rich text (bold,
// italic, citation-ref, inline-equation, ...).
//
// `claimType` attr distinguishes:
//   - main:        "Markdown will remain..." (the primary assertion)
//   - counter:     "...however, ProseMirror has..." (essay §15 counterpoint)
//   - synthesis:   "The future is therefore..." (essay §15 synthesis)
//
// counterpoint and synthesis are NOT separate node types — they're
// claimType subtypes. This collapses essay §15's 4 directives to 2 PM
// nodes (claim + evidence) per ADR-0011 §4.4 (rejected alternative).
//
// PM body text is denormalised cache; PG `claim` table `text` is the
// source of truth (ADR-0011 §2.3). Editor mounts must reload from PG
// before letting the user edit, otherwise concurrent same-claim edits
// across docs diverge.

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId, newClaimId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    claim: {
      /** Insert a new claim with auto-generated id + a single empty paragraph. */
      insertClaim: (
        claimType?: 'main' | 'counter' | 'synthesis',
      ) => ReturnType;
      /** Insert an existing claim (cross-doc reuse) with prose pre-populated. */
      insertExistingClaim: (
        claimId: string,
        claimType: 'main' | 'counter' | 'synthesis',
        prose: string,
      ) => ReturnType;
    };
  }
}

export type ClaimType = 'main' | 'counter' | 'synthesis';
export type ClaimStatus =
  | 'ai-suggested'
  | 'human-reviewed'
  | 'approved'
  | 'deprecated'
  | 'superseded';
export type ClaimConfidence = 'low' | 'medium' | 'high';

export const Claim = Node.create({
  name: 'claim',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-block-id'),
        renderHTML: (attrs) => ({ 'data-block-id': attrs['blockId'] }),
      },
      claimId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-claim-id'),
        renderHTML: (attrs) => ({ 'data-claim-id': attrs['claimId'] }),
      },
      claimType: {
        default: 'main' as ClaimType,
        parseHTML: (el) =>
          (el.getAttribute('data-claim-type') as ClaimType | null) ?? 'main',
        renderHTML: (attrs) => ({ 'data-claim-type': attrs['claimType'] }),
      },
      status: {
        default: 'ai-suggested' as ClaimStatus,
        parseHTML: (el) =>
          (el.getAttribute('data-status') as ClaimStatus | null) ??
          'ai-suggested',
        renderHTML: (attrs) => ({ 'data-status': attrs['status'] }),
      },
      confidence: {
        default: 'medium' as ClaimConfidence,
        parseHTML: (el) =>
          (el.getAttribute('data-confidence') as ClaimConfidence | null) ??
          'medium',
        renderHTML: (attrs) => ({ 'data-confidence': attrs['confidence'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-pm-node="claim"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'claim',
        class: 'pm-node-claim',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertClaim:
        (claimType: ClaimType = 'main') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              claimId: newClaimId(),
              claimType,
              status: 'ai-suggested',
              confidence: 'medium',
            },
            content: [{ type: 'paragraph' }],
          }),

      insertExistingClaim:
        (claimId: string, claimType: ClaimType, prose: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              claimId,
              claimType,
              status: 'human-reviewed',
              confidence: 'medium',
            },
            content: [
              {
                type: 'paragraph',
                content: prose ? [{ type: 'text', text: prose }] : [],
              },
            ],
          }),
    };
  },
});
