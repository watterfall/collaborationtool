// Public open-content feed DB loader.
//
// The feed must never move bulky payloads into the public page render:
// datasets expose metadata only, and snapshots intentionally omit their
// yjs_binary column. Detail/download authorization can grow separately.

import { desc } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import {
  assembleOpenContentFeed,
  type FeedFilter,
  type OpenFeedView,
} from '@/lib/open-content-feed';
import { getDb } from '@/lib/db';

const ENTITY_QUERY_LIMIT = 200;
const REVIEW_QUERY_LIMIT = 500;

export interface OpenContentFeedLoadResult {
  feed: OpenFeedView;
  unavailable: boolean;
}

export async function loadOpenContentFeed(
  filter: FeedFilter,
): Promise<OpenFeedView> {
  const db = getDb();
  const entityLimit = Math.min(
    ENTITY_QUERY_LIMIT,
    Math.max(filter.limit ?? 50, 1) * 4,
  );

  const [questions, datasets, snapshots, reviews] = await Promise.all([
    db
      .select({
        id: schema.openQuestion.id,
        askerOrcidId: schema.openQuestion.askerOrcidId,
        questionMd: schema.openQuestion.questionMd,
        domainTags: schema.openQuestion.domainTags,
        status: schema.openQuestion.status,
        signedPayloadJws: schema.openQuestion.signedPayloadJws,
        merkleLogEntryId: schema.openQuestion.merkleLogEntryId,
        createdAt: schema.openQuestion.createdAt,
        withdrawnAt: schema.openQuestion.withdrawnAt,
      })
      .from(schema.openQuestion)
      .orderBy(desc(schema.openQuestion.createdAt))
      .limit(entityLimit),
    db
      .select({
        id: schema.openDataset.id,
        datasetDoi: schema.openDataset.datasetDoi,
        title: schema.openDataset.title,
        descriptionMd: schema.openDataset.descriptionMd,
        sizeBytes: schema.openDataset.sizeBytes,
        licenseSpdx: schema.openDataset.licenseSpdx,
        signedPayloadJws: schema.openDataset.signedPayloadJws,
        merkleLogEntryId: schema.openDataset.merkleLogEntryId,
        createdAt: schema.openDataset.createdAt,
        withdrawnAt: schema.openDataset.withdrawnAt,
      })
      .from(schema.openDataset)
      .orderBy(desc(schema.openDataset.createdAt))
      .limit(entityLimit),
    db
      .select({
        id: schema.shareSnapshot.id,
        markdownContent: schema.shareSnapshot.markdownContent,
        kind: schema.shareSnapshot.kind,
        permalinkHash: schema.shareSnapshot.permalinkHash,
        doi: schema.shareSnapshot.doi,
        signedPayloadJws: schema.shareSnapshot.signedPayloadJws,
        merkleLogEntryId: schema.shareSnapshot.merkleLogEntryId,
        createdAt: schema.shareSnapshot.createdAt,
        withdrawnAt: schema.shareSnapshot.withdrawnAt,
        supersedesSnapshotId: schema.shareSnapshot.supersedesSnapshotId,
      })
      .from(schema.shareSnapshot)
      .orderBy(desc(schema.shareSnapshot.createdAt))
      .limit(entityLimit),
    db
      .select({
        targetKind: schema.openPeerReview.targetKind,
        targetId: schema.openPeerReview.targetId,
        verdict: schema.openPeerReview.verdict,
        withdrawnAt: schema.openPeerReview.withdrawnAt,
      })
      .from(schema.openPeerReview)
      .orderBy(desc(schema.openPeerReview.createdAt))
      .limit(REVIEW_QUERY_LIMIT),
  ]);

  return assembleOpenContentFeed({
    filter,
    questions,
    datasets,
    snapshots,
    reviews,
  });
}

export async function loadOpenContentFeedSafely(
  filter: FeedFilter,
): Promise<OpenContentFeedLoadResult> {
  try {
    return {
      feed: await loadOpenContentFeed(filter),
      unavailable: false,
    };
  } catch (error) {
    console.error('[open-content-feed] failed to load public feed', error);
    return {
      feed: assembleOpenContentFeed({
        filter,
        questions: [],
        datasets: [],
        snapshots: [],
        reviews: [],
      }),
      unavailable: true,
    };
  }
}
