import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  AI_CONTEXT_PACK_SCHEMA,
  buildAiContextPack,
} from '@/lib/ai-context-pack';

const EXPORT_DRAWER_SOURCE = readFileSync(
  new URL(
    '../src/app/(app)/editor/[docId]/components/ExportDrawer.tsx',
    import.meta.url,
  ),
  'utf8',
);

function doc() {
  return {
    id: 'doc:1',
    title: 'Reproducibility memo',
    slug: 'reproducibility-memo',
    primaryLanguage: 'en',
    bilingualMode: 'facing',
  };
}

function humanReview(
  claimId: string,
  overrides: {
    reviewerOrcidId?: string | null;
    signedPayloadJws?: string | null;
    orcidSignedAt?: Date | null;
  } = {},
) {
  return {
    id: `review:${claimId}`,
    claimId,
    reviewerPrincipalId: 'principal:reviewer',
    reviewerOrcidId: '0000-0002-1825-0097',
    isAiVerdict: false,
    verdict: 'endorses',
    bodyMarkdown: 'The claim is supported by the linked evidence.',
    evidenceRefs: [],
    signedPayloadJws: null,
    orcidSignedAt: new Date('2026-06-03T12:00:00Z'),
    signatureVerifiedAt: null,
    signatureAlgorithm: null,
    provenanceId: 'prov:1',
    submittedAt: new Date('2026-06-03T12:00:00Z'),
    withdrawnAt: null,
    withdrawnReason: null,
    verdictMeta: null,
    ...overrides,
  };
}

describe('buildAiContextPack', () => {
  it('adds readiness, reviews and maintenance findings to the graph export', () => {
    const pack = buildAiContextPack({
      doc: doc(),
      claims: [
        {
          id: 'claim:1',
          text: 'Supported claim',
          claimType: 'main',
          status: 'approved',
          confidence: 'high',
        },
        {
          id: 'claim:2',
          text: 'Unsupported claim',
          claimType: 'main',
          status: 'ai-suggested',
          confidence: 'medium',
        },
      ],
      evidences: [
        {
          id: 'evidence:1',
          supportsClaimId: 'claim:1',
          citationId: 'cite:1',
          relation: 'supports',
        },
      ],
      claimLinks: [],
      sources: [{ id: 'cite:1', doi: '10.1038/s41586-023-06924-6' }],
      reviews: [humanReview('claim:1')],
      maintenanceFindings: [
        {
          id: 'finding:1',
          claimId: 'claim:1',
          kind: 'unverified-ai-block',
          severity: 'low',
          status: 'open',
          summary: 'AI generated block still needs human approval.',
        },
      ],
      generatedAt: '2026-06-03T12:00:00.000Z',
    });

    assert.equal(pack.$schema, AI_CONTEXT_PACK_SCHEMA);
    assert.equal(pack.generatedAt, '2026-06-03T12:00:00.000Z');
    assert.equal(pack.reviews.length, 1);
    assert.equal(pack.maintenanceFindings.length, 1);
    assert.equal(pack.readiness.status, 'blocked');
    assert.equal(pack.readiness.unsupportedClaims, 1);
    assert.equal(pack.readiness.unverifiedAiFindings, 1);
    assert.equal(pack.readiness.orcidSignedClaims, 1);
    assert.equal(pack.readiness.signedReviewCoveragePct, 50);
    assert.equal(pack.readiness.actions[0]!.kind, 'bind-evidence');
  });

  it('marks a fully evidenced, asset-backed and signed human-reviewed pack as ready', () => {
    const pack = buildAiContextPack({
      doc: doc(),
      claims: [{ id: 'claim:1', text: 'Ready claim' }],
      evidences: [
        {
          id: 'evidence:1',
          supportsClaimId: 'claim:1',
          citationId: 'source:dataset',
        },
      ],
      claimLinks: [],
      sources: [
        {
          id: 'source:dataset',
          kind: 'dataset',
          cslJson: { title: 'Replication dataset' },
        },
      ],
      reviews: [humanReview('claim:1')],
      maintenanceFindings: [],
      generatedAt: '2026-06-03T12:00:00.000Z',
    });

    assert.equal(pack.readiness.status, 'ready');
    assert.equal(pack.readiness.evidenceCoveragePct, 100);
    assert.equal(pack.readiness.humanReviewCoveragePct, 100);
    assert.equal(pack.readiness.signedReviewCoveragePct, 100);
    assert.equal(pack.readiness.reproducibilityAssetCoveragePct, 100);
    assert.equal(pack.readiness.datasetSources, 1);
  });

  it('keeps literature-only signed packs out of ready state until assets are attached', () => {
    const pack = buildAiContextPack({
      doc: doc(),
      claims: [{ id: 'claim:1', text: 'Needs reproducibility asset' }],
      evidences: [
        {
          id: 'evidence:1',
          supportsClaimId: 'claim:1',
          citationId: 'source:paper',
        },
      ],
      claimLinks: [],
      sources: [
        {
          id: 'source:paper',
          kind: 'literature',
          cslJson: { title: 'Only a paper source' },
        },
      ],
      reviews: [humanReview('claim:1')],
      maintenanceFindings: [],
      generatedAt: '2026-06-03T12:00:00.000Z',
    });

    assert.equal(pack.readiness.status, 'needs-assets');
    assert.equal(pack.readiness.reproducibilityAssetCoveragePct, 0);
    assert.equal(pack.readiness.actions[0]!.kind, 'bind-reproducibility-asset');
  });

  it('keeps unsigned human-reviewed packs out of ready state', () => {
    const pack = buildAiContextPack({
      doc: doc(),
      claims: [{ id: 'claim:1', text: 'Needs signed review' }],
      evidences: [{ id: 'evidence:1', supportsClaimId: 'claim:1' }],
      claimLinks: [],
      sources: [],
      reviews: [
        humanReview('claim:1', {
          orcidSignedAt: null,
          signedPayloadJws: null,
        }),
      ],
      maintenanceFindings: [],
      generatedAt: '2026-06-03T12:00:00.000Z',
    });

    assert.equal(pack.readiness.status, 'needs-signature');
    assert.equal(pack.readiness.humanReviewCoveragePct, 100);
    assert.equal(pack.readiness.signedReviewCoveragePct, 0);
    assert.equal(pack.readiness.actions[0]!.kind, 'sign-human-review');
  });
});

describe('ExportDrawer — AI context pack affordance', () => {
  it('exposes the machine-facing context pack format', () => {
    assert.match(EXPORT_DRAWER_SOURCE, /id: 'ai-context-pack'/);
    assert.match(EXPORT_DRAWER_SOURCE, /AI context pack/);
    assert.match(EXPORT_DRAWER_SOURCE, /readiness\s+gate/);
  });
});
