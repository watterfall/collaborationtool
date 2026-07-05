import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assembleEvidenceMap,
  selectReusableCitationId,
  validateEvidenceDraftInput,
  type EvidenceMapCitationRow,
  type EvidenceMapClaimRow,
  type EvidenceMapEvidenceRow,
} from '../src/lib/evidence-map';

const FIXED_NOW = new Date('2026-06-03T12:00:00Z');

function claim(
  overrides: Partial<EvidenceMapClaimRow> & { claimId: string; text?: string },
): EvidenceMapClaimRow {
  return {
    text: 'sample claim',
    claimType: 'main',
    status: 'ai-suggested',
    confidence: 'medium',
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function evidence(
  overrides: Partial<EvidenceMapEvidenceRow> & {
    evidenceId: string;
    supportsClaimId: string;
  },
): EvidenceMapEvidenceRow {
  return {
    excerpt: 'sample evidence excerpt',
    citationId: null,
    relation: 'supports',
    status: 'ai-suggested',
    documentOriginId: 'doc:1',
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function citation(
  overrides: Partial<EvidenceMapCitationRow> & { citationId: string },
): EvidenceMapCitationRow {
  return {
    kind: 'literature',
    cslJson: {},
    doi: null,
    url: null,
    ...overrides,
  };
}

describe('assembleEvidenceMap', () => {
  it('prioritizes the targeted claim, then unsupported claims', () => {
    const view = assembleEvidenceMap({
      documentId: 'doc:1',
      targetClaimId: 'c3',
      claims: [
        claim({ claimId: 'c1', text: 'supported old claim' }),
        claim({ claimId: 'c2', text: 'unsupported claim' }),
        claim({ claimId: 'c3', text: 'target claim' }),
      ],
      evidences: [
        evidence({ evidenceId: 'e1', supportsClaimId: 'c1' }),
        evidence({ evidenceId: 'e2', supportsClaimId: 'c3' }),
      ],
      citations: [],
    });

    assert.equal(view.summary.totalClaims, 3);
    assert.equal(view.summary.evidencedClaims, 2);
    assert.equal(view.summary.unsupportedClaims, 1);
    assert.equal(view.summary.targetFound, true);
    assert.deepEqual(
      view.claims.map((node) => node.claimId),
      ['c3', 'c2', 'c1'],
    );
    assert.equal(view.claims[0]!.highlighted, true);
    assert.equal(view.claims[1]!.needsEvidence, true);
  });

  it('counts support, challenge, qualify and source coverage per claim', () => {
    const view = assembleEvidenceMap({
      documentId: 'doc:1',
      claims: [claim({ claimId: 'c1' })],
      evidences: [
        evidence({
          evidenceId: 'e1',
          supportsClaimId: 'c1',
          relation: 'supports',
          citationId: 'src:1',
        }),
        evidence({
          evidenceId: 'e2',
          supportsClaimId: 'c1',
          relation: 'challenges',
          citationId: 'src:1',
        }),
        evidence({
          evidenceId: 'e3',
          supportsClaimId: 'c1',
          relation: 'qualifies',
          citationId: 'src:2',
        }),
      ],
      citations: [
        citation({ citationId: 'src:1' }),
        citation({ citationId: 'src:2', kind: 'dataset' }),
      ],
    });

    const node = view.claims[0]!;
    assert.equal(node.evidenceCount, 3);
    assert.equal(node.supportCount, 1);
    assert.equal(node.challengeCount, 1);
    assert.equal(node.qualifyCount, 1);
    assert.equal(node.sourceCount, 2);
    assert.equal(view.summary.totalSources, 2);
    assert.equal(view.summary.literatureSources, 1);
    assert.equal(view.summary.datasetSources, 1);
    assert.equal(view.summary.reproducibilityAssetClaims, 1);
  });

  it('summarizes CSL citation title, container and year', () => {
    const view = assembleEvidenceMap({
      documentId: 'doc:1',
      claims: [claim({ claimId: 'c1' })],
      evidences: [
        evidence({
          evidenceId: 'e1',
          supportsClaimId: 'c1',
          citationId: 'src:1',
        }),
      ],
      citations: [
        citation({
          citationId: 'src:1',
          doi: '10.1234/example',
          cslJson: {
            title: 'Reproducibility in practice',
            'container-title': 'Journal of Research Systems',
            issued: { 'date-parts': [[2026, 6, 3]] },
          },
        }),
      ],
    });

    const citationSummary = view.claims[0]!.evidences[0]!.citation!;
    assert.equal(citationSummary.title, 'Reproducibility in practice');
    assert.equal(citationSummary.meta, 'Journal of Research Systems · 2026');
    assert.equal(citationSummary.doi, '10.1234/example');
    assert.equal(citationSummary.sourceKind, 'literature');
  });

  it('reads protocol source role from CSL metadata without needing a citation enum migration', () => {
    const view = assembleEvidenceMap({
      documentId: 'doc:1',
      claims: [claim({ claimId: 'c1' })],
      evidences: [
        evidence({
          evidenceId: 'e1',
          supportsClaimId: 'c1',
          citationId: 'src:protocol',
        }),
      ],
      citations: [
        citation({
          citationId: 'src:protocol',
          kind: 'web',
          cslJson: {
            title: 'Replication protocol',
            'collaborationtool:evidenceKind': 'protocol',
          },
          url: 'https://example.org/protocol',
        }),
      ],
    });

    const citationSummary = view.claims[0]!.evidences[0]!.citation!;
    assert.equal(citationSummary.kind, 'web');
    assert.equal(citationSummary.sourceKind, 'protocol');
    assert.equal(view.summary.protocolSources, 1);
    assert.equal(view.summary.reproducibilityAssetClaims, 1);
  });

  it('marks cross-document evidence reuse', () => {
    const view = assembleEvidenceMap({
      documentId: 'doc:1',
      claims: [claim({ claimId: 'c1' })],
      evidences: [
        evidence({
          evidenceId: 'e1',
          supportsClaimId: 'c1',
          documentOriginId: 'doc:2',
        }),
      ],
      citations: [],
    });

    assert.deepEqual(view.claims[0]!.crossDocDocumentIds, ['doc:2']);
    assert.equal(view.claims[0]!.evidences[0]!.isCrossDocument, true);
  });
});

describe('selectReusableCitationId', () => {
  it('reuses the first live DOI match and ignores archived citations', () => {
    const selected = selectReusableCitationId(
      {
        title: 'Reproducibility in practice',
        doi: '10.1038/s41586-023-06924-6',
        url: null,
        kind: 'literature',
        sourceKind: 'literature',
      },
      [
        {
          citationId: 'src:archived',
          doi: '10.1038/s41586-023-06924-6',
          url: null,
          archivedAt: FIXED_NOW,
        },
        {
          citationId: 'src:live',
          doi: '10.1038/s41586-023-06924-6',
          url: null,
          archivedAt: null,
        },
      ],
    );

    assert.equal(selected, 'src:live');
  });

  it('prefers DOI identity over URL identity when both are present', () => {
    const selected = selectReusableCitationId(
      {
        title: 'Reproducibility in practice',
        doi: '10.1038/s41586-023-06924-6',
        url: 'https://example.org/source',
        kind: 'literature',
        sourceKind: 'literature',
      },
      [
        {
          citationId: 'src:url-only',
          doi: null,
          url: 'https://example.org/source',
          archivedAt: null,
        },
        {
          citationId: 'src:doi',
          doi: '10.1038/s41586-023-06924-6',
          url: 'https://publisher.example/source',
          archivedAt: null,
        },
      ],
    );

    assert.equal(selected, 'src:doi');
  });

  it('reuses URL identity only when DOI is absent', () => {
    const selected = selectReusableCitationId(
      {
        title: 'Protocol note',
        doi: null,
        url: 'https://example.org/protocol',
        kind: 'web',
        sourceKind: 'web',
      },
      [
        {
          citationId: 'src:web',
          doi: null,
          url: 'https://example.org/protocol',
          archivedAt: null,
        },
      ],
    );

    assert.equal(selected, 'src:web');
  });

  it('does not reuse title-only sources', () => {
    const selected = selectReusableCitationId(
      {
        title: 'Protocol note',
        doi: null,
        url: null,
        kind: 'document',
        sourceKind: 'document',
      },
      [
        {
          citationId: 'src:title',
          doi: null,
          url: null,
          archivedAt: null,
        },
      ],
    );

    assert.equal(selected, null);
  });
});

describe('validateEvidenceDraftInput', () => {
  it('accepts a trimmed manual evidence draft', () => {
    const result = validateEvidenceDraftInput({
      claimId: ' c1 ',
      excerpt: '  A sufficiently specific evidence excerpt.  ',
      relation: 'supports',
      allowedClaimIds: ['c1'],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.payload, {
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      source: null,
    });
  });

  it('accepts optional DOI / URL source metadata', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      sourceTitle: '  Reproducibility in practice  ',
      sourceDoi: '  10.1038/s41586-023-06924-6  ',
      sourceUrl: 'https://example.org/paper',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.payload.source, {
      title: 'Reproducibility in practice',
      doi: '10.1038/s41586-023-06924-6',
      url: 'https://example.org/paper',
      kind: 'literature',
      sourceKind: 'literature',
    });
  });

  it('accepts dataset and software source kinds as reproducibility assets', () => {
    const dataset = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific dataset evidence excerpt.',
      relation: 'supports',
      sourceTitle: 'Replication dataset',
      sourceDoi: '10.5281/zenodo.1234567',
      sourceKind: 'dataset',
      allowedClaimIds: ['c1'],
    });
    const software = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific software evidence excerpt.',
      relation: 'supports',
      sourceTitle: 'Analysis code repository',
      sourceUrl: 'https://github.com/example/repro',
      sourceKind: 'software',
      allowedClaimIds: ['c1'],
    });

    assert.equal(dataset.ok, true);
    assert.equal(software.ok, true);
    if (!dataset.ok || !software.ok) return;
    assert.equal(dataset.payload.source?.kind, 'dataset');
    assert.equal(dataset.payload.source?.sourceKind, 'dataset');
    assert.equal(software.payload.source?.kind, 'software');
    assert.equal(software.payload.source?.sourceKind, 'software');
  });

  it('stores protocol as a source role over web/document citation storage', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific protocol evidence excerpt.',
      relation: 'supports',
      sourceTitle: 'Registered replication protocol',
      sourceUrl: 'https://example.org/protocol',
      sourceKind: 'protocol',
      allowedClaimIds: ['c1'],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.payload.source, {
      title: 'Registered replication protocol',
      doi: null,
      url: 'https://example.org/protocol',
      kind: 'web',
      sourceKind: 'protocol',
    });
  });

  it('uses DOI as fallback source title', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      sourceDoi: '10.48550/arXiv.2310.06770',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.payload.source?.title, '10.48550/arXiv.2310.06770');
    assert.equal(result.payload.source?.kind, 'literature');
    assert.equal(result.payload.source?.sourceKind, 'literature');
  });

  it('rejects unknown claims', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c2',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'unknown-claim');
  });

  it('rejects short excerpts', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'too short',
      relation: 'supports',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'excerpt-too-short');
  });

  it('rejects invalid relations', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'agrees',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'invalid-relation');
  });

  it('rejects invalid source kind values', () => {
    const result = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      sourceTitle: 'Unknown source kind',
      sourceKind: 'lab-notebook',
      allowedClaimIds: ['c1'],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'invalid-source-kind');
  });

  it('rejects invalid DOI and URL source metadata', () => {
    const badDoi = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      sourceDoi: 'ISBN 978-0-13-110362-7',
      allowedClaimIds: ['c1'],
    });
    assert.equal(badDoi.ok, false);
    if (!badDoi.ok) assert.equal(badDoi.reason, 'invalid-doi');

    const badUrl = validateEvidenceDraftInput({
      claimId: 'c1',
      excerpt: 'A sufficiently specific evidence excerpt.',
      relation: 'supports',
      sourceUrl: 'ftp://example.org/file',
      allowedClaimIds: ['c1'],
    });
    assert.equal(badUrl.ok, false);
    if (!badUrl.ok) assert.equal(badUrl.reason, 'invalid-url');
  });
});
