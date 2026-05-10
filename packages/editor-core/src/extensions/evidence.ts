// evidence: block container that holds an evidence excerpt + link to a
// claim and (optionally) a citation source.
//
// Per ADR-0011 §2.1, this is the 2nd of 2 new node types added in
// Phase 2 W5. `relation` attr distinguishes:
//   - supports:    standard supporting evidence
//   - challenges:  counter-evidence (essay §15 :::counterpoint:::)
//   - qualifies:   evidence that limits the scope of a claim
//
// The PG `evidence` table requires `supportsClaimId` (NOT NULL FK).
// Editor allows insert without it — caller must back-fill before
// commit, or commit boundary writer rejects.
//
// `citationId` is optional (some evidence may be anecdotal / awaiting
// source attribution).

import { Node, mergeAttributes } from '@tiptap/core';

import { newBlockId, newEvidenceId } from '../util/ids';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    evidence: {
      /** Insert an empty evidence block tied to a claim. */
      insertEvidence: (
        supportsClaimId: string,
        relation?: 'supports' | 'challenges' | 'qualifies',
        citationId?: string | null,
      ) => ReturnType;
    };
  }
}

export type EvidenceRelation = 'supports' | 'challenges' | 'qualifies';

export const Evidence = Node.create({
  name: 'evidence',
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
      evidenceId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-evidence-id'),
        renderHTML: (attrs) => ({ 'data-evidence-id': attrs['evidenceId'] }),
      },
      supportsClaimId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-supports-claim-id'),
        renderHTML: (attrs) => ({
          'data-supports-claim-id': attrs['supportsClaimId'],
        }),
      },
      citationId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-citation-id'),
        renderHTML: (attrs) => ({ 'data-citation-id': attrs['citationId'] }),
      },
      relation: {
        default: 'supports' as EvidenceRelation,
        parseHTML: (el) =>
          (el.getAttribute('data-relation') as EvidenceRelation | null) ??
          'supports',
        renderHTML: (attrs) => ({ 'data-relation': attrs['relation'] }),
      },
      status: {
        default: 'ai-suggested',
        parseHTML: (el) => el.getAttribute('data-status') ?? 'ai-suggested',
        renderHTML: (attrs) => ({ 'data-status': attrs['status'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-pm-node="evidence"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-pm-node': 'evidence',
        class: 'pm-node-evidence',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertEvidence:
        (
          supportsClaimId: string,
          relation: EvidenceRelation = 'supports',
          citationId: string | null = null,
        ) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              blockId: newBlockId(),
              evidenceId: newEvidenceId(),
              supportsClaimId,
              citationId,
              relation,
              status: 'ai-suggested',
            },
            content: [{ type: 'paragraph' }],
          }),
    };
  },
});
