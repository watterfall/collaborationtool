// Phase 5 Wave B B2 — render-myst tests for the claim-review-anchor
// mark. End-to-end: PM doc → MyST AST → HTML output, locking attrs +
// accent class + dominant-verdict logic.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pmToMystAst } from '../src/ast-from-pm';
import { mystAstToHtml } from '../src/html';
import type { MystText } from '../src/types';

function pmWithReviewedClaim(buckets: {
  endorses: number;
  challenges: number;
  refines: number;
}, latestReviewerOrcidId: string | null = null) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '碳排放峰值假设',
            marks: [
              {
                type: 'claimReviewAnchor',
                attrs: {
                  claimId: 'claim_abc',
                  verdictBuckets: buckets,
                  latestReviewerOrcidId,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('pmToMystAst — claim-review-anchor mark', () => {
  it('translates the mark with bucket counts preserved', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 3, challenges: 1, refines: 0 }),
    );
    const para = ast.children[0];
    assert.equal(para?.type, 'paragraph');
    if (para?.type !== 'paragraph') return;
    const text = para.children[0] as MystText;
    assert.equal(text.type, 'text');
    const review = text.marks?.find((m) => m.type === 'claim-review-anchor');
    assert.ok(review, 'claim-review-anchor mark missing');
    if (review?.type !== 'claim-review-anchor') return;
    assert.equal(review.claimId, 'claim_abc');
    assert.equal(review.verdictBuckets.endorses, 3);
    assert.equal(review.verdictBuckets.challenges, 1);
    assert.equal(review.verdictBuckets.refines, 0);
    assert.equal(review.latestReviewerOrcidId, null);
  });

  it('preserves reviewer ORCID when present', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim(
        { endorses: 1, challenges: 0, refines: 0 },
        '0000-0002-1825-0097',
      ),
    );
    const para = ast.children[0];
    if (para?.type !== 'paragraph') return;
    const text = para.children[0] as MystText;
    const review = text.marks?.find((m) => m.type === 'claim-review-anchor');
    if (review?.type !== 'claim-review-anchor') return;
    assert.equal(review.latestReviewerOrcidId, '0000-0002-1825-0097');
  });

  it('defaults empty buckets when attrs absent', () => {
    const ast = pmToMystAst({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'plain',
              marks: [
                {
                  type: 'claimReviewAnchor',
                  attrs: { claimId: 'claim_x' },
                },
              ],
            },
          ],
        },
      ],
    });
    const para = ast.children[0];
    if (para?.type !== 'paragraph') return;
    const text = para.children[0] as MystText;
    const review = text.marks?.find((m) => m.type === 'claim-review-anchor');
    if (review?.type !== 'claim-review-anchor') return;
    assert.deepEqual(review.verdictBuckets, {
      endorses: 0,
      challenges: 0,
      refines: 0,
    });
  });
});

describe('mystAstToHtml — claim-review-anchor accent triad', () => {
  it('endorses dominant emits accent-moss class', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 5, challenges: 0, refines: 0 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /class="claim-review-anchor accent-moss"/);
    assert.match(html, /data-claim-id="claim_abc"/);
  });

  it('challenges dominant emits accent-ox class', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 0, challenges: 4, refines: 1 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /accent-ox/);
  });

  it('refines dominant emits accent-ink class', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 1, challenges: 0, refines: 3 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /accent-ink/);
  });

  it('mixed (tied buckets) emits accent-mixed class', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 2, challenges: 2, refines: 0 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /accent-mixed/);
  });

  it('empty buckets emits accent-empty class', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 0, challenges: 0, refines: 0 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /accent-empty/);
  });

  it('preserves reviewer ORCID as data attr when present', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim(
        { endorses: 1, challenges: 0, refines: 0 },
        '0000-0002-1825-0097',
      ),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(html, /data-latest-reviewer-orcid="0000-0002-1825-0097"/);
  });

  it('omits ORCID data attr when null', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 1, challenges: 0, refines: 0 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.equal(/data-latest-reviewer-orcid/.test(html), false);
  });

  it('emits verdict buckets in semi-colon-delimited data attr', () => {
    const ast = pmToMystAst(
      pmWithReviewedClaim({ endorses: 3, challenges: 1, refines: 2 }),
    );
    const html = mystAstToHtml(ast, { primaryLanguage: 'zh' });
    assert.match(
      html,
      /data-verdict-buckets="endorses=3;challenges=1;refines=2"/,
    );
  });
});
