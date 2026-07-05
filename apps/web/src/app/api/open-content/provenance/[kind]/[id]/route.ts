// Public machine-readable provenance summary for open content records.
//
// No auth: this endpoint exposes only verification summaries already
// represented on public detail pages. Hidden payload fields are read
// only by server-side provenance helpers.

import { NextResponse } from 'next/server';

import {
  loadOpenDatasetDetailSafely,
  loadOpenQuestionDetailSafely,
  loadOpenSnapshotDetailSafely,
} from '@/lib/open-content-detail-query';
import type { OpenContentProvenanceSummary } from '@/lib/open-content-provenance';
import {
  loadOpenDatasetVerificationBundle,
  loadOpenQuestionVerificationBundle,
  loadOpenReviewVerificationBundle,
  loadOpenSnapshotVerificationBundle,
  type OpenContentVerificationBundle,
} from '@/lib/open-content-provenance-query';

export const dynamic = 'force-dynamic';

type ProvenanceKind = 'open_question' | 'open_dataset' | 'share_snapshot';

interface PublicProvenanceRecord {
  kind: ProvenanceKind;
  id: string;
  verifier: {
    packageName: '@collaborationtool/open-content';
    command: string;
    publicReplayableKinds: readonly ['open_question', 'open_peer_review'];
    serverSummaryOnlyKinds: readonly ['open_dataset', 'share_snapshot'];
  };
  record: OpenContentVerificationBundle;
  reviews: Array<{
    id: string;
    reviewerOrcidId: string;
    verdict: string;
    provenance: OpenContentVerificationBundle;
  }>;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ kind: string; id: string }> },
): Promise<NextResponse> {
  const { kind, id } = await ctx.params;
  if (!isProvenanceKind(kind)) {
    return NextResponse.json({ error: 'invalid-kind' }, { status: 400 });
  }

  const loaded = await loadPublicProvenanceRecord(kind, id);
  if (loaded.unavailable) {
    return NextResponse.json(
      { error: 'open-provenance-unavailable' },
      { status: 503 },
    );
  }
  if (!loaded.record) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      ...loaded.record,
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}

async function loadPublicProvenanceRecord(
  kind: ProvenanceKind,
  id: string,
): Promise<
  | { unavailable: false; record: PublicProvenanceRecord | null }
  | { unavailable: true; record: null }
> {
  if (kind === 'open_question') {
    const result = await loadOpenQuestionDetailSafely(id);
    return mapDetailResult(kind, id, result, () =>
      loadOpenQuestionVerificationBundle(id),
    );
  }
  if (kind === 'open_dataset') {
    const result = await loadOpenDatasetDetailSafely(id);
    return mapDetailResult(kind, id, result, () =>
      loadOpenDatasetVerificationBundle(id),
    );
  }
  const result = await loadOpenSnapshotDetailSafely(id);
  return mapDetailResult(kind, id, result, () =>
    loadOpenSnapshotVerificationBundle(id),
  );
}

async function mapDetailResult<T extends {
  provenance: OpenContentProvenanceSummary;
  reviews: Array<{
    id: string;
    reviewerOrcidId: string;
    verdict: string;
    provenance: OpenContentProvenanceSummary;
  }>;
}>(
  kind: ProvenanceKind,
  id: string,
  result:
    | { unavailable: false; record: T | null }
    | { unavailable: true; record: null },
  loadRecordBundle: () => Promise<OpenContentVerificationBundle>,
):
  Promise<
    | { unavailable: false; record: PublicProvenanceRecord | null }
    | { unavailable: true; record: null }
  > {
  if (result.unavailable) return result;
  if (!result.record) return { unavailable: false, record: null };
  const record = await loadRecordBundle();
  const reviews = await Promise.all(
    result.record.reviews.map(async (review) => ({
      id: review.id,
      reviewerOrcidId: review.reviewerOrcidId,
      verdict: review.verdict,
      provenance: await loadOpenReviewVerificationBundle(review.id),
    })),
  );
  return {
    unavailable: false,
    record: {
      kind,
      id,
      verifier: {
        packageName: '@collaborationtool/open-content',
        command:
          'pnpm --filter @collaborationtool/open-content verify:provenance <file-or-url>',
        publicReplayableKinds: ['open_question', 'open_peer_review'],
        serverSummaryOnlyKinds: ['open_dataset', 'share_snapshot'],
      },
      record,
      reviews,
    },
  };
}

function isProvenanceKind(value: string): value is ProvenanceKind {
  return (
    value === 'open_question' ||
    value === 'open_dataset' ||
    value === 'share_snapshot'
  );
}
