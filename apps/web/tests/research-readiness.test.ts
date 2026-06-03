// Pure tests for the editor research-readiness summary.
//
// These lock the product rules from the 2026-06-03 research-systems
// baseline: evidence is not optional, AI verdicts are not human review,
// withdrawn reviews do not count, and active maintenance findings can
// block reproducibility readiness.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assembleResearchReadiness,
  buildResearchReadinessActionHref,
  type ResearchReadinessCheckId,
  type ResearchReadinessEvidenceRow,
  type ResearchReadinessFindingRow,
  type ResearchReadinessReviewRow,
  type ResearchReadinessSummary,
} from '../src/lib/research-readiness';

const SIGNED_AT = new Date('2026-06-03T10:00:00Z');

function evidence(claimId: string): ResearchReadinessEvidenceRow {
  return { supportsClaimId: claimId };
}

function assetEvidence(
  claimId: string,
  sourceKind: 'dataset' | 'software' | 'protocol' = 'dataset',
): ResearchReadinessEvidenceRow {
  return { supportsClaimId: claimId, sourceKind };
}

function humanReview(
  claimId: string,
  overrides: Partial<ResearchReadinessReviewRow> = {},
): ResearchReadinessReviewRow {
  return {
    claimId,
    isAiVerdict: false,
    withdrawnAt: null,
    reviewerOrcidId: null,
    orcidSignedAt: null,
    signedPayloadJws: null,
    ...overrides,
  };
}

function finding(
  overrides: Partial<ResearchReadinessFindingRow>,
): ResearchReadinessFindingRow {
  return {
    findingId: 'finding:1',
    claimId: null,
    kind: 'unsupported-claim',
    severity: 'medium',
    status: 'open',
    summary: 'claim needs a better source',
    ...overrides,
  };
}

function readinessCheck(
  summary: ResearchReadinessSummary,
  id: ResearchReadinessCheckId,
) {
  const check = summary.checks.find((item) => item.id === id);
  assert.ok(check, `expected readiness check ${id}`);
  return check;
}

describe('assembleResearchReadiness — claim/evidence coverage', () => {
  it('no claims is explicitly not ready', () => {
    const summary = assembleResearchReadiness({
      claims: [],
      evidences: [],
      reviews: [],
      findings: [],
    });
    assert.equal(summary.status, 'no-claims');
    assert.equal(summary.evidenceCoveragePct, 0);
    assert.equal(readinessCheck(summary, 'claim-evidence').state, 'attention');
    assert.equal(summary.actions[0]!.kind, 'model-claims');
  });

  it('missing evidence blocks readiness', () => {
    const summary = assembleResearchReadiness({
      claims: [
        { claimId: 'c1', claimText: 'supported claim' },
        { claimId: 'c2', claimText: 'unsupported claim' },
      ],
      evidences: [evidence('c1')],
      reviews: [humanReview('c1'), humanReview('c2')],
      findings: [],
    });
    assert.equal(summary.status, 'blocked');
    assert.equal(summary.evidencedClaims, 1);
    assert.equal(summary.unsupportedClaims, 1);
    assert.equal(summary.evidenceCoveragePct, 50);
    assert.equal(readinessCheck(summary, 'claim-evidence').state, 'blocked');
    assert.equal(summary.actions[0]!.kind, 'bind-evidence');
    assert.equal(summary.actions[0]!.claimId, 'c2');
    assert.equal(
      buildResearchReadinessActionHref('doc:1', summary.actions[0]!),
      '/editor/doc%3A1/evidence-map?claimId=c2',
    );
  });
});

describe('assembleResearchReadiness — review semantics', () => {
  it('AI verdict does not satisfy human review', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'AI-reviewed only claim' }],
      evidences: [evidence('c1')],
      reviews: [
        humanReview('c1', {
          isAiVerdict: true,
        }),
      ],
      findings: [],
    });
    assert.equal(summary.status, 'needs-review');
    assert.equal(summary.humanReviewedClaims, 0);
    assert.equal(summary.claimsNeedingHumanReview, 1);
    assert.equal(summary.actions[0]!.kind, 'request-human-review');
    assert.equal(
      buildResearchReadinessActionHref('doc:1', summary.actions[0]!),
      '/reviewer-inbox?documentId=doc%3A1&claimId=c1',
    );
  });

  it('withdrawn human review does not count', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'withdrawn human review claim' }],
      evidences: [evidence('c1')],
      reviews: [
        humanReview('c1', {
          withdrawnAt: new Date('2026-06-04T10:00:00Z'),
        }),
      ],
      findings: [],
    });
    assert.equal(summary.status, 'needs-review');
    assert.equal(summary.humanReviewCoveragePct, 0);
  });

  it('counts ORCID-signed active human reviews', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'ORCID signed claim' }],
      evidences: [assetEvidence('c1', 'dataset')],
      reviews: [
        humanReview('c1', {
          reviewerOrcidId: '0000-0002-1825-0097',
          orcidSignedAt: SIGNED_AT,
        }),
      ],
      findings: [],
    });
    assert.equal(summary.status, 'ready');
    assert.equal(summary.orcidSignedReviews, 1);
    assert.equal(summary.orcidSignedClaims, 1);
    assert.equal(summary.signedReviewCoveragePct, 100);
    assert.equal(summary.reproducibilityAssetClaims, 1);
    assert.equal(summary.reproducibilityAssetCoveragePct, 100);
    assert.equal(
      readinessCheck(summary, 'reproducibility-assets').state,
      'complete',
    );
    assert.equal(readinessCheck(summary, 'human-review').state, 'complete');
    assert.equal(readinessCheck(summary, 'orcid-signature').state, 'complete');
  });

  it('requires ORCID signature before a human-reviewed claim is ready', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'unsigned human review claim' }],
      evidences: [evidence('c1')],
      reviews: [humanReview('c1')],
      findings: [],
    });
    assert.equal(summary.status, 'needs-signature');
    assert.equal(summary.humanReviewedClaims, 1);
    assert.equal(summary.orcidSignedClaims, 0);
    assert.equal(summary.claimsNeedingSignedReview, 1);
    assert.equal(readinessCheck(summary, 'human-review').state, 'complete');
    assert.equal(readinessCheck(summary, 'orcid-signature').state, 'attention');
    assert.equal(summary.actions[0]!.kind, 'sign-human-review');
    assert.equal(
      buildResearchReadinessActionHref('doc:1', summary.actions[0]!),
      '/claim/c1/lineage',
    );
  });

  it('requires a dataset, software or protocol asset before a signed claim is ready', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'literature-only claim' }],
      evidences: [evidence('c1')],
      reviews: [
        humanReview('c1', {
          reviewerOrcidId: '0000-0002-1825-0097',
          orcidSignedAt: SIGNED_AT,
        }),
      ],
      findings: [],
    });
    assert.equal(summary.status, 'needs-assets');
    assert.equal(summary.evidencedClaims, 1);
    assert.equal(summary.reproducibilityAssetClaims, 0);
    assert.equal(summary.claimsNeedingReproducibilityAsset, 1);
    assert.equal(
      readinessCheck(summary, 'reproducibility-assets').state,
      'attention',
    );
    assert.equal(summary.actions[0]!.kind, 'bind-reproducibility-asset');
    assert.equal(
      buildResearchReadinessActionHref('doc:1', summary.actions[0]!),
      '/editor/doc%3A1/evidence-map?claimId=c1',
    );
  });
});

describe('assembleResearchReadiness — maintenance and AI audit', () => {
  it('active high / medium findings block readiness', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'maintenance-blocked claim' }],
      evidences: [evidence('c1')],
      reviews: [humanReview('c1')],
      findings: [finding({ severity: 'high', claimId: 'c1' })],
    });
    assert.equal(summary.status, 'blocked');
    assert.equal(summary.activeFindings, 1);
    assert.equal(summary.blockingFindings, 1);
    assert.equal(readinessCheck(summary, 'maintenance').state, 'blocked');
    assert.equal(summary.actions[0]!.kind, 'resolve-maintenance');
    assert.equal(summary.actions[0]!.target, 'maintenance-blocked claim');
    assert.equal(
      buildResearchReadinessActionHref('doc:1', summary.actions[0]!),
      '/maintenance?findingId=finding%3A1',
    );
  });

  it('resolved findings do not count as active', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'resolved finding claim' }],
      evidences: [assetEvidence('c1', 'protocol')],
      reviews: [
        humanReview('c1', {
          reviewerOrcidId: '0000-0002-1825-0097',
          orcidSignedAt: SIGNED_AT,
        }),
      ],
      findings: [finding({ status: 'resolved', severity: 'high' })],
    });
    assert.equal(summary.status, 'ready');
    assert.equal(summary.activeFindings, 0);
    assert.equal(summary.protocolSources, 1);
  });

  it('unverified AI block findings block AI audit even when severity is low', () => {
    const summary = assembleResearchReadiness({
      claims: [{ claimId: 'c1', claimText: 'AI-generated section claim' }],
      evidences: [evidence('c1')],
      reviews: [humanReview('c1')],
      findings: [
        finding({
          findingId: 'finding:ai',
          claimId: 'c1',
          kind: 'unverified-ai-block',
          severity: 'low',
          summary: 'AI block has no human approval chain',
        }),
      ],
    });
    assert.equal(summary.status, 'blocked');
    assert.equal(summary.unverifiedAiFindings, 1);
    assert.equal(readinessCheck(summary, 'ai-audit').state, 'blocked');
    assert.equal(summary.actions[0]!.kind, 'verify-ai-block');
    assert.equal(summary.actions[0]!.findingId, 'finding:ai');
  });
});
