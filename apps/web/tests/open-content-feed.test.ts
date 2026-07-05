// Phase 6 W2 P2 — open content feed filter parser + open question answer validator.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assembleOpenContentFeed,
  buildOpenDatasetPublishContent,
  buildOpenQuestionPublishContent,
  buildOpenQuestionAnswerContent,
  buildShareSnapshotPublishContent,
  parseFeedFilter,
  validateOpenQuestionAnswer,
  type OpenDatasetFeedRow,
  type OpenPeerReviewFeedRow,
  type OpenQuestionFeedRow,
  type ShareSnapshotFeedRow,
} from '@/lib/open-content-feed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoWebSrc = path.resolve(__dirname, '../src');
const T0 = new Date('2026-06-03T10:00:00Z');
const T1 = new Date('2026-06-03T11:00:00Z');
const T2 = new Date('2026-06-03T12:00:00Z');

describe('parseFeedFilter', () => {
  it('empty params → defaults kind=open_question + status=open + limit=50', () => {
    const f = parseFeedFilter(new URLSearchParams());
    assert.equal(f.kind, 'open_question');
    assert.equal(f.status, 'open');
    assert.equal(f.limit, 50);
    assert.equal(f.domainTags, undefined);
  });

  it('kind=open_dataset → status not set (other entities have no status enum)', () => {
    const f = parseFeedFilter(new URLSearchParams('kind=open_dataset'));
    assert.equal(f.kind, 'open_dataset');
    assert.equal(f.status, undefined);
  });

  it('invalid kind falls back to default', () => {
    const f = parseFeedFilter(new URLSearchParams('kind=bogus'));
    assert.equal(f.kind, 'open_question');
  });

  it('status only honored when kind=open_question', () => {
    const f1 = parseFeedFilter(new URLSearchParams('kind=open_question&status=answered'));
    assert.equal(f1.status, 'answered');

    const f2 = parseFeedFilter(new URLSearchParams('kind=open_dataset&status=answered'));
    assert.equal(f2.status, undefined);
  });

  it('invalid status string for question kind → defaults to open', () => {
    const f = parseFeedFilter(new URLSearchParams('status=bogus'));
    assert.equal(f.status, 'open');
  });

  it('domainTags splits on comma + trims + drops empties', () => {
    const f = parseFeedFilter(new URLSearchParams('domainTags=ai,  physics  ,, '));
    assert.deepEqual(f.domainTags, ['ai', 'physics']);
  });

  it('limit clamped [1, 200]', () => {
    assert.equal(parseFeedFilter(new URLSearchParams('limit=0')).limit, 50);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=-5')).limit, 50);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=300')).limit, 200);
    assert.equal(parseFeedFilter(new URLSearchParams('limit=75')).limit, 75);
  });

  it('invalid date strings yield undefined', () => {
    const f = parseFeedFilter(new URLSearchParams('sinceCreatedAt=not-a-date'));
    assert.equal(f.sinceCreatedAt, undefined);
  });

  it('valid ISO date parsed', () => {
    const f = parseFeedFilter(new URLSearchParams('sinceCreatedAt=2026-05-12T00:00:00Z'));
    assert.ok(f.sinceCreatedAt instanceof Date);
    assert.equal(f.sinceCreatedAt!.toISOString(), '2026-05-12T00:00:00.000Z');
  });
});

function question(
  overrides: Partial<OpenQuestionFeedRow> & { id: string },
): OpenQuestionFeedRow {
  return {
    askerOrcidId: '0000-0002-1825-0097',
    questionMd: '# Can this replication protocol survive a new cohort?',
    domainTags: ['replication', 'methods'],
    status: 'open',
    signedPayloadJws: 'signed.question',
    merkleLogEntryId: `merkle:${overrides.id}`,
    createdAt: T0,
    withdrawnAt: null,
    ...overrides,
  };
}

function dataset(
  overrides: Partial<OpenDatasetFeedRow> & { id: string },
): OpenDatasetFeedRow {
  return {
    datasetDoi: '10.5281/zenodo.1234567',
    title: 'Replication cohort extract',
    descriptionMd: 'Rows, variables and preprocessing notes for the cohort.',
    sizeBytes: 2048n,
    licenseSpdx: 'CC0-1.0',
    signedPayloadJws: 'signed.dataset',
    merkleLogEntryId: `merkle:${overrides.id}`,
    createdAt: T0,
    withdrawnAt: null,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ShareSnapshotFeedRow> & { id: string },
): ShareSnapshotFeedRow {
  return {
    markdownContent: '# Draft methods note\n\nA shareable section snapshot.',
    kind: 'section',
    permalinkHash: `hash-${overrides.id}`,
    doi: null,
    signedPayloadJws: 'signed.snapshot',
    merkleLogEntryId: `merkle:${overrides.id}`,
    createdAt: T0,
    withdrawnAt: null,
    supersedesSnapshotId: null,
    ...overrides,
  };
}

function review(
  overrides: Partial<OpenPeerReviewFeedRow> & {
    targetKind: OpenPeerReviewFeedRow['targetKind'];
    targetId: string;
  },
): OpenPeerReviewFeedRow {
  return {
    verdict: 'endorses',
    withdrawnAt: null,
    ...overrides,
  };
}

describe('assembleOpenContentFeed', () => {
  it('returns open questions newest-first with review counts and Merkle identity', () => {
    const feed = assembleOpenContentFeed({
      filter: parseFeedFilter(new URLSearchParams('kind=open_question')),
      questions: [
        question({ id: 'q-old', createdAt: T0 }),
        question({ id: 'q-new', createdAt: T2, domainTags: ['ai'] }),
        question({ id: 'q-answered', status: 'answered', createdAt: T1 }),
      ],
      datasets: [],
      snapshots: [],
      reviews: [
        review({ targetKind: 'question', targetId: 'q-new' }),
        review({
          targetKind: 'question',
          targetId: 'q-new',
          verdict: 'challenges',
        }),
        review({
          targetKind: 'question',
          targetId: 'q-old',
          withdrawnAt: T1,
        }),
      ],
    });

    assert.equal(feed.summary.kind, 'open_question');
    assert.equal(feed.summary.totalItems, 2);
    assert.equal(feed.summary.reviewedItems, 1);
    assert.deepEqual(
      feed.items.map((item) => item.id),
      ['q-new', 'q-old'],
    );
    assert.equal(feed.items[0]!.reviewCount, 2);
    assert.equal(feed.items[0]!.challengeCount, 1);
    assert.equal(feed.items[0]!.pid, 'orcid:0000-0002-1825-0097');
    assert.equal(feed.items[0]!.signed, true);
  });

  it('applies domain tag and time filters to open questions', () => {
    const feed = assembleOpenContentFeed({
      filter: parseFeedFilter(
        new URLSearchParams(
          'kind=open_question&domainTags=replication&sinceCreatedAt=2026-06-03T10:30:00Z',
        ),
      ),
      questions: [
        question({ id: 'q-old', createdAt: T0 }),
        question({ id: 'q-match', createdAt: T1 }),
        question({ id: 'q-topic', domainTags: ['theory'], createdAt: T2 }),
      ],
      datasets: [],
      snapshots: [],
      reviews: [],
    });

    assert.deepEqual(
      feed.items.map((item) => item.id),
      ['q-match'],
    );
  });

  it('summarizes datasets with DOI, license and byte size', () => {
    const feed = assembleOpenContentFeed({
      filter: parseFeedFilter(new URLSearchParams('kind=open_dataset')),
      questions: [],
      datasets: [dataset({ id: 'ds-1', sizeBytes: 1536n })],
      snapshots: [],
      reviews: [review({ targetKind: 'dataset', targetId: 'ds-1' })],
    });

    assert.equal(feed.summary.datasetItems, 1);
    assert.equal(feed.items[0]!.kind, 'open_dataset');
    assert.equal(feed.items[0]!.pid, 'doi:10.5281/zenodo.1234567');
    assert.ok(feed.items[0]!.meta.includes('1.5 KB'));
    assert.equal(feed.items[0]!.endorseCount, 1);
  });

  it('hides withdrawn and superseded snapshots from the feed', () => {
    const feed = assembleOpenContentFeed({
      filter: parseFeedFilter(new URLSearchParams('kind=share_snapshot')),
      questions: [],
      datasets: [],
      snapshots: [
        snapshot({ id: 'snap-old' }),
        snapshot({ id: 'snap-new', supersedesSnapshotId: 'snap-old', createdAt: T2 }),
        snapshot({ id: 'snap-withdrawn', withdrawnAt: T1 }),
      ],
      reviews: [
        review({ targetKind: 'snapshot', targetId: 'snap-new', verdict: 'refines' }),
      ],
    });

    assert.deepEqual(
      feed.items.map((item) => item.id),
      ['snap-new'],
    );
    assert.equal(feed.items[0]!.refineCount, 1);
    assert.equal(feed.items[0]!.pid, 'hash:hash-snap-new');
  });
});

describe('open content public surfaces', () => {
  it('exposes a public feed API without the auth gate', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/api/open-content/feed/route.ts'),
      'utf8',
    );
    assert.match(src, /parseFeedFilter/);
    assert.match(src, /loadOpenContentFeedSafely/);
    assert.doesNotMatch(src, /auth\.api\.getSession/);
  });

  it('keeps the public /open page outside the authenticated app shell', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/open/page.tsx'),
      'utf8',
    );
    assert.match(src, /Open collaboration ledger/);
    assert.match(src, /开放协作账本/);
    assert.match(src, /HeaderControls/);
    assert.match(src, /\/api\/open-content\/feed/);
    assert.doesNotMatch(src, /auth\.api\.getSession/);
  });

  it('landing chrome links visitors to the open ledger', () => {
    const src = readFileSync(path.join(repoWebSrc, 'app/page.tsx'), 'utf8');
    assert.match(src, /href=['"]\/open['"]/);
    assert.match(src, /Open ledger · 开放账本/);
  });

  it('feed loader selects metadata-only snapshot and dataset columns', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'lib/open-content-feed-query.ts'),
      'utf8',
    );
    assert.doesNotMatch(src, /yjsBinary:/);
    assert.doesNotMatch(src, /blobStorageRef:/);
    assert.match(src, /schema\.shareSnapshot\.markdownContent/);
  });

  it('feed rows link to public detail pages', () => {
    const src = readFileSync(path.join(repoWebSrc, 'app/open/page.tsx'), 'utf8');
    assert.match(src, /href=\{item\.href\}/);
  });

  it('public detail loaders do not select snapshot binaries or dataset storage refs', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'lib/open-content-detail-query.ts'),
      'utf8',
    );
    assert.doesNotMatch(src, /yjsBinary:/);
    assert.doesNotMatch(src, /blobStorageRef:/);
    assert.match(src, /loadOpenQuestionProvenanceSummary/);
    assert.match(src, /OpenContentProvenanceSummary/);
    assert.match(src, /loadOpenQuestionDetailSafely/);
    assert.match(src, /loadOpenDatasetDetailSafely/);
    assert.match(src, /loadOpenSnapshotDetailSafely/);
  });

  it('public provenance helper verifies hidden payload without leaking it through detail loader', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'lib/open-content-provenance-query.ts'),
      'utf8',
    );
    assert.match(src, /assessOpenContentProvenance/);
    assert.match(src, /loadOpenReviewProvenanceSummary/);
    assert.match(src, /loadOpenQuestionVerificationBundle/);
    assert.match(src, /verificationMode: 'public-replayable'/);
    assert.match(src, /verificationMode: 'server-summary-only'/);
    assert.match(src, /redactedFields: \['blobStorageRef'\]/);
    assert.match(src, /redactedFields: \['yjsBinaryBase64'\]/);
    assert.match(src, /schema\.provenanceMerkleLog\.contentHash/);
    assert.match(src, /schema\.principal\.ed25519PublicKey/);
    assert.match(src, /schema\.openPeerReview\.evidenceRefs/);
    assert.match(src, /schema\.openDataset\.blobStorageRef/);
    assert.match(src, /schema\.shareSnapshot\.yjsBinary/);
  });

  it('public provenance API exposes record and review summaries without auth', () => {
    const src = readFileSync(
      path.join(
        repoWebSrc,
        'app/api/open-content/provenance/[kind]/[id]/route.ts',
      ),
      'utf8',
    );
    assert.match(src, /loadOpenQuestionDetailSafely/);
    assert.match(src, /loadOpenDatasetDetailSafely/);
    assert.match(src, /loadOpenSnapshotDetailSafely/);
    assert.match(src, /loadOpenQuestionVerificationBundle/);
    assert.match(src, /loadOpenReviewVerificationBundle/);
    assert.match(src, /OpenContentVerificationBundle/);
    assert.match(src, /reviewerOrcidId/);
    assert.match(src, /packageName: '@collaborationtool\/open-content'/);
    assert.match(src, /verify:provenance <file-or-url>/);
    assert.match(src, /publicReplayableKinds/);
    assert.match(src, /serverSummaryOnlyKinds/);
    assert.match(src, /generatedAt/);
    assert.doesNotMatch(src, /auth\.api\.getSession/);
  });

  it('open question detail page mounts the ORCID answer form', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/open/question/[questionId]/page.tsx'),
      'utf8',
    );
    assert.match(src, /AnswerOpenQuestionForm/);
    assert.match(src, /loadOpenQuestionDetailSafely/);
    assert.match(src, /RecordSideMeta item=\{item\} provenance=\{provenance\}/);
  });

  it('answer route writes a Merkle-linked open peer review with auth', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/api/open-question/[id]/answer/route.ts'),
      'utf8',
    );
    assert.match(src, /auth\.api\.getSession/);
    assert.match(src, /validateOpenQuestionAnswer/);
    assert.match(src, /buildOpenQuestionAnswerContent/);
    assert.match(src, /buildPrincipalOpenContentSignatureVerifier/);
    assert.match(src, /persistPrincipalEd25519PublicKeyIfNeeded/);
    assert.match(src, /signaturePublicKey/);
    assert.match(src, /schema\.provenanceMerkleLog/);
    assert.match(src, /schema\.openPeerReview/);
    assert.match(src, /contentHashHex/);
    assert.match(src, /uuidv7/);
  });

  it('answer form posts JSON to the open question answer endpoint', () => {
    const src = readFileSync(
      path.join(
        repoWebSrc,
        'app/open/question/[questionId]/AnswerOpenQuestionForm.tsx',
      ),
      'utf8',
    );
    assert.match(src, /fetch\(`\/api\/open-question\/\$\{questionId\}\/answer`/);
    assert.match(src, /JSON\.stringify/);
    assert.match(src, /evidenceRefs: refs/);
    assert.match(src, /signaturePublicKey/);
    assert.match(src, /signedPayloadJws/);
    assert.match(src, /answer-signature-material/);
  });

  it('document open-question route publishes Merkle-linked questions from editor docs', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/api/document/[docId]/open-question/route.ts'),
      'utf8',
    );
    const helperSrc = readFileSync(
      path.join(repoWebSrc, 'lib/document-open-publish.ts'),
      'utf8',
    );
    assert.match(src, /buildOpenQuestionPublishContent/);
    assert.match(src, /buildPrincipalOpenContentSignatureVerifier/);
    assert.match(src, /persistPrincipalEd25519PublicKeyIfNeeded/);
    assert.match(src, /signaturePublicKey/);
    assert.match(src, /loadDocumentOpenPublishContext/);
    assert.match(helperSrc, /loadPrincipalContext/);
    assert.match(helperSrc, /block\.commit/);
    assert.match(src, /getOrcidIdentityForUser/);
    assert.match(src, /schema\.provenanceMerkleLog/);
    assert.match(src, /schema\.openQuestion/);
    assert.match(src, /askerOrcidId/);
    assert.match(src, /contentHashHex/);
  });

  it('document dataset and snapshot routes publish Merkle-linked public assets', () => {
    const datasetSrc = readFileSync(
      path.join(repoWebSrc, 'app/api/document/[docId]/open-dataset/route.ts'),
      'utf8',
    );
    const snapshotSrc = readFileSync(
      path.join(
        repoWebSrc,
        'app/api/document/[docId]/share-snapshot/route.ts',
      ),
      'utf8',
    );
    assert.match(datasetSrc, /buildOpenDatasetPublishContent/);
    assert.match(datasetSrc, /buildPrincipalOpenContentSignatureVerifier/);
    assert.match(datasetSrc, /persistPrincipalEd25519PublicKeyIfNeeded/);
    assert.match(datasetSrc, /signaturePublicKey/);
    assert.match(datasetSrc, /schema\.provenanceMerkleLog/);
    assert.match(datasetSrc, /schema\.openDataset/);
    assert.match(datasetSrc, /contentHashHex/);
    assert.match(datasetSrc, /\/open\/dataset/);

    assert.match(snapshotSrc, /buildShareSnapshotPublishContent/);
    assert.match(snapshotSrc, /buildPrincipalOpenContentSignatureVerifier/);
    assert.match(snapshotSrc, /persistPrincipalEd25519PublicKeyIfNeeded/);
    assert.match(snapshotSrc, /signaturePublicKey/);
    assert.match(snapshotSrc, /schema\.provenanceMerkleLog/);
    assert.match(snapshotSrc, /schema\.shareSnapshot/);
    assert.match(snapshotSrc, /permalinkHash/);
    assert.match(snapshotSrc, /\/open\/snapshot/);
  });

  it('editor mounts a writer-only open ledger panel with question, dataset and snapshot modes', () => {
    const pageSrc = readFileSync(
      path.join(repoWebSrc, 'app/(app)/editor/[docId]/page.tsx'),
      'utf8',
    );
    const editorSrc = readFileSync(
      path.join(repoWebSrc, 'app/(app)/editor/[docId]/editor-client.tsx'),
      'utf8',
    );
    const panelSrc = readFileSync(
      path.join(
        repoWebSrc,
        'app/(app)/editor/[docId]/components/OpenLedgerPublishPanel.tsx',
      ),
      'utf8',
    );
    assert.match(pageSrc, /canPublishOpenLedger/);
    assert.match(pageSrc, /documentCapabilities\.has\('block\.commit'\)/);
    assert.match(editorSrc, /OpenLedgerPublishPanel/);
    assert.match(panelSrc, /\/api\/document\/\$\{documentId\}\/open-question/);
    assert.match(panelSrc, /\/api\/document\/\$\{documentId\}\/open-dataset/);
    assert.match(panelSrc, /\/api\/document\/\$\{documentId\}\/share-snapshot/);
    assert.match(panelSrc, /open-ledger-publish-panel/);
    assert.match(panelSrc, /open-ledger-signature-material/);
    assert.match(panelSrc, /signaturePublicKey/);
    assert.match(panelSrc, /signedPayloadJws/);
    assert.match(panelSrc, /pmDocToMarkdown/);
    assert.match(panelSrc, /Published to ledger/);
  });

  it('public record sidebar exposes verifiable provenance status', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/open/record-ui.tsx'),
      'utf8',
    );
    assert.match(src, /provenanceStatusLabel/);
    assert.match(src, /content hash/);
    assert.match(src, /public key/);
    assert.match(src, /review\.provenance\.contentHashHex/);
    assert.match(src, /review\.provenance\.publicKeyFingerprint/);
    assert.match(src, /provenanceApiHref/);
    assert.match(src, /\/api\/open-content\/provenance\/\$\{item\.kind\}/);
    assert.match(src, /Provenance JSON/);
    assert.match(src, /verification packet/);
    assert.match(src, /verify:provenance provenance\.json/);
    assert.match(src, /Download JSON/);
    assert.match(src, /Open JSON/);
    assert.match(src, /download=\{\`\$\{item\.kind\}-\$\{item\.id\}-provenance\.json`\}/);
    assert.match(src, /Canonical content, Merkle entry and Ed25519 signature verify/);
  });
});

describe('buildOpenQuestionPublishContent', () => {
  it('trims question text and normalizes unique domain tags', () => {
    const r = buildOpenQuestionPublishContent({
      questionMd: '  # Why did the cohort drift?  ',
      domainTags: [' methods ', '', 'methods', 'replication'],
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.content.questionMd, '# Why did the cohort drift?');
      assert.deepEqual(r.content.domainTags, ['methods', 'replication']);
    }
  });

  it('rejects empty question text and malformed tag input', () => {
    const empty = buildOpenQuestionPublishContent({
      questionMd: ' ',
      domainTags: [],
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.reason, 'question-empty');

    const tagType = buildOpenQuestionPublishContent({
      questionMd: 'Question',
      domainTags: ['ok', 1],
    });
    assert.equal(tagType.ok, false);
    if (!tagType.ok) assert.equal(tagType.reason, 'domain_tag-not-string');
  });
});

describe('buildOpenDatasetPublishContent', () => {
  it('normalizes dataset metadata for public ledger publishing', () => {
    const r = buildOpenDatasetPublishContent({
      title: '  Cohort extract  ',
      descriptionMd: '  Variables and preprocessing notes.  ',
      blobStorageRef: '  s3://vault/cohort.csv  ',
      sizeBytes: '1536',
      licenseSpdx: '  CC0-1.0  ',
      datasetDoi: '  10.5281/zenodo.1234567  ',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.content, {
        title: 'Cohort extract',
        descriptionMd: 'Variables and preprocessing notes.',
        blobStorageRef: 's3://vault/cohort.csv',
        sizeBytes: 1536,
        licenseSpdx: 'CC0-1.0',
        datasetDoi: '10.5281/zenodo.1234567',
      });
    }
  });

  it('rejects malformed dataset drafts before signature work', () => {
    const missingTitle = buildOpenDatasetPublishContent({
      title: '',
      descriptionMd: 'd',
      blobStorageRef: 'r',
      sizeBytes: 0,
      licenseSpdx: 'CC0-1.0',
    });
    assert.equal(missingTitle.ok, false);
    if (!missingTitle.ok) assert.equal(missingTitle.reason, 'title-empty');

    const badSize = buildOpenDatasetPublishContent({
      title: 't',
      descriptionMd: 'd',
      blobStorageRef: 'r',
      sizeBytes: -1,
      licenseSpdx: 'CC0-1.0',
    });
    assert.equal(badSize.ok, false);
    if (!badSize.ok) assert.equal(badSize.reason, 'size_bytes-invalid');
  });
});

describe('buildShareSnapshotPublishContent', () => {
  it('normalizes a signed snapshot payload with server-derived permalink hash', () => {
    const r = buildShareSnapshotPublishContent({
      markdownContent: '  # Methods\n\nProtocol text.  ',
      yjsBinaryBase64: '  eyJkb2MiOiJwbSJ9  ',
      kind: 'preprint',
      permalinkHash: '  abc123  ',
      doi: '  10.1101/2026.06.03.123456  ',
      supersedesSnapshotId: '  snap-old  ',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.content, {
        markdownContent: '# Methods\n\nProtocol text.',
        yjsBinaryBase64: 'eyJkb2MiOiJwbSJ9',
        kind: 'preprint',
        permalinkHash: 'abc123',
        doi: '10.1101/2026.06.03.123456',
        supersedesSnapshotId: 'snap-old',
      });
    }
  });

  it('rejects empty snapshot content, missing archive and invalid kind', () => {
    const empty = buildShareSnapshotPublishContent({
      markdownContent: '',
      yjsBinaryBase64: 'abc',
      kind: 'preprint',
      permalinkHash: 'hash',
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.reason, 'markdown_content-empty');

    const missingArchive = buildShareSnapshotPublishContent({
      markdownContent: '# Draft',
      yjsBinaryBase64: '',
      kind: 'preprint',
      permalinkHash: 'hash',
    });
    assert.equal(missingArchive.ok, false);
    if (!missingArchive.ok) assert.equal(missingArchive.reason, 'yjs_binary-empty');

    const badKind = buildShareSnapshotPublishContent({
      markdownContent: '# Draft',
      yjsBinaryBase64: 'abc',
      kind: 'poster',
      permalinkHash: 'hash',
    });
    assert.equal(badKind.ok, false);
    if (!badKind.ok) assert.equal(badKind.reason, 'invalid-snapshot-kind');
  });
});

describe('validateOpenQuestionAnswer', () => {
  const goodQuestion = {
    id: 'q-1',
    status: 'open' as const,
    askerPrincipalId: 'principal:asker',
  };

  it('accepts valid answer from stranger', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: 'principal:stranger',
      reviewerOrcidId: '0000-0002-1825-0097',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.questionId, 'q-1');
  });

  it('rejects missing question (404 path)', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: null,
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-found');
  });

  it('rejects answered question', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: { ...goodQuestion, status: 'answered' },
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-open');
  });

  it('rejects withdrawn question', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: { ...goodQuestion, status: 'withdrawn' },
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'question-not-open');
  });

  it('rejects self-answer', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: goodQuestion.askerPrincipalId,
      reviewerOrcidId: '0',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'cannot-self-answer');
  });

  it('rejects reviewer with no ORCID', () => {
    const r = validateOpenQuestionAnswer({
      questionId: 'q-1',
      questionRow: goodQuestion,
      reviewerPrincipalId: 'p',
      reviewerOrcidId: '',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'reviewer-no-orcid');
  });
});

describe('buildOpenQuestionAnswerContent', () => {
  it('normalizes a refine answer with trimmed body and evidence refs', () => {
    const r = buildOpenQuestionAnswerContent({
      questionId: ' q-1 ',
      reviewerOrcidId: ' 0000-0002-1825-0097 ',
      verdict: 'refines',
      bodyMd: '  Add the preregistered exclusion rule.  ',
      evidenceRefs: [' ev-1 ', '', 'ev-2'],
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.content, {
        reviewerOrcidId: '0000-0002-1825-0097',
        targetKind: 'question',
        targetId: 'q-1',
        verdict: 'refines',
        bodyMd: 'Add the preregistered exclusion rule.',
        evidenceRefs: ['ev-1', 'ev-2'],
      });
    }
  });

  it('requires evidence refs for challenges', () => {
    const r = buildOpenQuestionAnswerContent({
      questionId: 'q-1',
      reviewerOrcidId: '0000-0002-1825-0097',
      verdict: 'challenges',
      bodyMd: 'This conflicts with the dataset.',
      evidenceRefs: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'challenges-requires-evidence');
  });

  it('rejects unknown verdicts and malformed evidence refs', () => {
    const verdict = buildOpenQuestionAnswerContent({
      questionId: 'q-1',
      reviewerOrcidId: '0000-0002-1825-0097',
      verdict: 'maybe',
      bodyMd: 'Body',
      evidenceRefs: [],
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, 'invalid-verdict');

    const refs = buildOpenQuestionAnswerContent({
      questionId: 'q-1',
      reviewerOrcidId: '0000-0002-1825-0097',
      verdict: 'endorses',
      bodyMd: 'Body',
      evidenceRefs: [1],
    });
    assert.equal(refs.ok, false);
    if (!refs.ok) assert.equal(refs.reason, 'evidence_ref-not-string');
  });
});
