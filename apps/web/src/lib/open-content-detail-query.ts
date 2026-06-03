// Public open-content detail loaders.
//
// These loaders back /open/question/*, /open/dataset/* and
// /open/snapshot/*. They intentionally select public metadata only.

import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';

import {
  assembleOpenContentFeed,
  type OpenFeedItem,
} from '@/lib/open-content-feed';
import { getDb } from '@/lib/db';

export interface OpenReviewDetail {
  id: string;
  reviewerOrcidId: string;
  verdict: string;
  bodyMd: string;
  evidenceRefs: string[];
  signed: boolean;
  merkleLogEntryId: string;
  createdAt: Date;
}

interface OpenReviewRow {
  id: string;
  reviewerOrcidId: string;
  targetKind: 'question' | 'dataset' | 'snapshot';
  targetId: string;
  verdict: 'endorses' | 'challenges' | 'refines';
  bodyMd: string;
  evidenceRefs: string[];
  signedPayloadJws: string;
  merkleLogEntryId: string;
  createdAt: Date;
  withdrawnAt: Date | null;
}

export interface OpenQuestionDetail {
  item: OpenFeedItem;
  questionMd: string;
  reviews: OpenReviewDetail[];
}

export interface OpenDatasetDetail {
  item: OpenFeedItem;
  descriptionMd: string;
  reviews: OpenReviewDetail[];
}

export interface OpenSnapshotDetail {
  item: OpenFeedItem;
  markdownContent: string;
  reviews: OpenReviewDetail[];
}

export type OpenDetailLoadResult<T> =
  | { unavailable: false; record: T | null }
  | { unavailable: true; record: null };

export async function loadOpenQuestionDetailSafely(
  questionId: string,
): Promise<OpenDetailLoadResult<OpenQuestionDetail>> {
  return loadSafely(() => loadOpenQuestionDetail(questionId));
}

export async function loadOpenDatasetDetailSafely(
  datasetId: string,
): Promise<OpenDetailLoadResult<OpenDatasetDetail>> {
  return loadSafely(() => loadOpenDatasetDetail(datasetId));
}

export async function loadOpenSnapshotDetailSafely(
  permalinkHash: string,
): Promise<OpenDetailLoadResult<OpenSnapshotDetail>> {
  return loadSafely(() => loadOpenSnapshotDetail(permalinkHash));
}

async function loadOpenQuestionDetail(
  questionId: string,
): Promise<OpenQuestionDetail | null> {
  const db = getDb();
  const questionRows = await db
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
    .where(eq(schema.openQuestion.id, questionId))
    .limit(1);
  const question = questionRows[0];
  if (!question || question.withdrawnAt !== null) return null;

  const reviewRows = await loadReviewRows('question', question.id);
  const feed = assembleOpenContentFeed({
    filter: {
      kind: 'open_question',
      status:
        question.status === 'answered' || question.status === 'withdrawn'
          ? question.status
          : 'open',
      limit: 1,
    },
    questions: [question],
    datasets: [],
    snapshots: [],
    reviews: reviewRows,
  });
  const item = feed.items[0];
  return item
    ? { item, questionMd: question.questionMd, reviews: reviewRows.map(toReviewDetail) }
    : null;
}

async function loadOpenDatasetDetail(
  datasetId: string,
): Promise<OpenDatasetDetail | null> {
  const db = getDb();
  const datasetRows = await db
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
    .where(eq(schema.openDataset.id, datasetId))
    .limit(1);
  const dataset = datasetRows[0];
  if (!dataset || dataset.withdrawnAt !== null) return null;

  const reviewRows = await loadReviewRows('dataset', dataset.id);
  const feed = assembleOpenContentFeed({
    filter: { kind: 'open_dataset', limit: 1 },
    questions: [],
    datasets: [dataset],
    snapshots: [],
    reviews: reviewRows,
  });
  const item = feed.items[0];
  return item
    ? { item, descriptionMd: dataset.descriptionMd, reviews: reviewRows.map(toReviewDetail) }
    : null;
}

async function loadOpenSnapshotDetail(
  permalinkHash: string,
): Promise<OpenSnapshotDetail | null> {
  const db = getDb();
  const snapshotRows = await db
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
    .where(eq(schema.shareSnapshot.permalinkHash, permalinkHash))
    .limit(1);
  const snapshot = snapshotRows[0];
  if (!snapshot || snapshot.withdrawnAt !== null) return null;

  const reviewRows = await loadReviewRows('snapshot', snapshot.id);
  const feed = assembleOpenContentFeed({
    filter: { kind: 'share_snapshot', limit: 1 },
    questions: [],
    datasets: [],
    snapshots: [snapshot],
    reviews: reviewRows,
  });
  const item = feed.items[0];
  return item
    ? {
        item,
        markdownContent: snapshot.markdownContent,
        reviews: reviewRows.map(toReviewDetail),
      }
    : null;
}

async function loadReviewRows(
  targetKind: 'question' | 'dataset' | 'snapshot',
  targetId: string,
): Promise<OpenReviewRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.openPeerReview.id,
      reviewerOrcidId: schema.openPeerReview.reviewerOrcidId,
      targetKind: schema.openPeerReview.targetKind,
      targetId: schema.openPeerReview.targetId,
      verdict: schema.openPeerReview.verdict,
      bodyMd: schema.openPeerReview.bodyMd,
      evidenceRefs: schema.openPeerReview.evidenceRefs,
      signedPayloadJws: schema.openPeerReview.signedPayloadJws,
      merkleLogEntryId: schema.openPeerReview.merkleLogEntryId,
      createdAt: schema.openPeerReview.createdAt,
      withdrawnAt: schema.openPeerReview.withdrawnAt,
    })
    .from(schema.openPeerReview)
    .where(
      and(
        eq(schema.openPeerReview.targetKind, targetKind),
        eq(schema.openPeerReview.targetId, targetId),
      ),
    )
    .orderBy(desc(schema.openPeerReview.createdAt));

  return rows.filter((row): row is OpenReviewRow => row.withdrawnAt === null);
}

function toReviewDetail(row: OpenReviewRow): OpenReviewDetail {
  return {
    id: row.id,
    reviewerOrcidId: row.reviewerOrcidId,
    verdict: row.verdict,
    bodyMd: row.bodyMd,
    evidenceRefs: [...row.evidenceRefs],
    signed: row.signedPayloadJws.trim().length > 0,
    merkleLogEntryId: row.merkleLogEntryId,
    createdAt: row.createdAt,
  };
}

async function loadSafely<T>(
  load: () => Promise<T | null>,
): Promise<OpenDetailLoadResult<T>> {
  try {
    return { unavailable: false, record: await load() };
  } catch (error) {
    console.error('[open-content-detail] failed to load public record', error);
    return { unavailable: true, record: null };
  }
}
