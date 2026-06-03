// Phase 6 W2 P2 — Open content feed query helpers (ADR-0018 §2.5 F7).
//
// Server-side queries that back GET /api/open-content/feed and the web
// /open landing surface. Public surface, NO auth required (per spec §3
// web client open-content reader role).
//
// Filters supported (Phase 6 W2 baseline):
//   - status (default 'open' for question feed)
//   - domainTags (intersection match)
//   - kind (which entity table; default = open_question)
//   - sinceCreatedAt / untilCreatedAt (time window)
//   - limit (default 50, max 200 — pagination via prev_cursor in W3+)

export type FeedKind = 'open_question' | 'open_dataset' | 'share_snapshot';

export interface FeedFilter {
  kind: FeedKind;
  status?: 'open' | 'answered' | 'withdrawn';
  domainTags?: readonly string[];
  sinceCreatedAt?: Date;
  untilCreatedAt?: Date;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface OpenQuestionFeedRow {
  id: string;
  askerOrcidId: string | null;
  questionMd: string;
  domainTags: readonly string[];
  status: 'open' | 'answered' | 'withdrawn' | string;
  signedPayloadJws: string;
  merkleLogEntryId: string;
  createdAt: Date;
  withdrawnAt: Date | null;
}

export interface OpenQuestionPublishContent {
  questionMd: string;
  domainTags: string[];
}

export interface OpenQuestionPublishDraftInput {
  questionMd: unknown;
  domainTags?: unknown;
}

export type OpenQuestionPublishDraftRejectReason =
  | 'question-empty'
  | 'domain_tags-not-array'
  | 'domain_tag-not-string';

export type OpenQuestionPublishDraftValidation =
  | { ok: true; content: OpenQuestionPublishContent }
  | { ok: false; reason: OpenQuestionPublishDraftRejectReason };

export function buildOpenQuestionPublishContent(
  input: OpenQuestionPublishDraftInput,
): OpenQuestionPublishDraftValidation {
  if (
    typeof input.questionMd !== 'string' ||
    input.questionMd.trim().length === 0
  ) {
    return { ok: false, reason: 'question-empty' };
  }
  const tagCheck = normalizeDomainTags(input.domainTags);
  if (!tagCheck.ok) return tagCheck;
  return {
    ok: true,
    content: {
      questionMd: input.questionMd.trim(),
      domainTags: tagCheck.domainTags,
    },
  };
}

export interface OpenDatasetPublishContent {
  title: string;
  descriptionMd: string;
  blobStorageRef: string;
  sizeBytes: number;
  licenseSpdx: string;
  datasetDoi?: string;
}

export interface OpenDatasetPublishDraftInput {
  title: unknown;
  descriptionMd: unknown;
  blobStorageRef: unknown;
  sizeBytes: unknown;
  licenseSpdx: unknown;
  datasetDoi?: unknown;
}

export type OpenDatasetPublishDraftRejectReason =
  | 'title-empty'
  | 'description-empty'
  | 'blob_storage_ref-empty'
  | 'size_bytes-invalid'
  | 'license_spdx-empty'
  | 'dataset_doi-not-string';

export type OpenDatasetPublishDraftValidation =
  | { ok: true; content: OpenDatasetPublishContent }
  | { ok: false; reason: OpenDatasetPublishDraftRejectReason };

export function buildOpenDatasetPublishContent(
  input: OpenDatasetPublishDraftInput,
): OpenDatasetPublishDraftValidation {
  const title = readTrimmedString(input.title);
  if (!title) return { ok: false, reason: 'title-empty' };

  const descriptionMd = readTrimmedString(input.descriptionMd);
  if (!descriptionMd) return { ok: false, reason: 'description-empty' };

  const blobStorageRef = readTrimmedString(input.blobStorageRef);
  if (!blobStorageRef) {
    return { ok: false, reason: 'blob_storage_ref-empty' };
  }

  const sizeBytes = readSizeBytes(input.sizeBytes);
  if (sizeBytes === null) return { ok: false, reason: 'size_bytes-invalid' };

  const licenseSpdx = readTrimmedString(input.licenseSpdx);
  if (!licenseSpdx) return { ok: false, reason: 'license_spdx-empty' };

  if (
    input.datasetDoi !== undefined &&
    input.datasetDoi !== null &&
    typeof input.datasetDoi !== 'string'
  ) {
    return { ok: false, reason: 'dataset_doi-not-string' };
  }
  const datasetDoi =
    typeof input.datasetDoi === 'string' && input.datasetDoi.trim().length > 0
      ? input.datasetDoi.trim()
      : undefined;

  return {
    ok: true,
    content: {
      title,
      descriptionMd,
      blobStorageRef,
      sizeBytes,
      licenseSpdx,
      ...(datasetDoi ? { datasetDoi } : {}),
    },
  };
}

export interface ShareSnapshotPublishContent {
  markdownContent: string;
  yjsBinaryBase64: string;
  kind: 'section' | 'preprint' | 'dataset';
  permalinkHash: string;
  doi?: string;
  supersedesSnapshotId?: string;
}

export interface ShareSnapshotPublishDraftInput {
  markdownContent: unknown;
  yjsBinaryBase64: unknown;
  kind: unknown;
  permalinkHash: unknown;
  doi?: unknown;
  supersedesSnapshotId?: unknown;
}

export type ShareSnapshotPublishDraftRejectReason =
  | 'markdown_content-empty'
  | 'yjs_binary-empty'
  | 'invalid-snapshot-kind'
  | 'permalink_hash-empty'
  | 'doi-not-string'
  | 'supersedes_snapshot_id-not-string';

export type ShareSnapshotPublishDraftValidation =
  | { ok: true; content: ShareSnapshotPublishContent }
  | { ok: false; reason: ShareSnapshotPublishDraftRejectReason };

export function buildShareSnapshotPublishContent(
  input: ShareSnapshotPublishDraftInput,
): ShareSnapshotPublishDraftValidation {
  const markdownContent = readTrimmedString(input.markdownContent);
  if (!markdownContent) {
    return { ok: false, reason: 'markdown_content-empty' };
  }

  const yjsBinaryBase64 = readTrimmedString(input.yjsBinaryBase64);
  if (!yjsBinaryBase64) {
    return { ok: false, reason: 'yjs_binary-empty' };
  }

  if (!['section', 'preprint', 'dataset'].includes(input.kind as string)) {
    return { ok: false, reason: 'invalid-snapshot-kind' };
  }
  const kind = input.kind as ShareSnapshotPublishContent['kind'];

  const permalinkHash = readTrimmedString(input.permalinkHash);
  if (!permalinkHash) {
    return { ok: false, reason: 'permalink_hash-empty' };
  }

  if (input.doi !== undefined && input.doi !== null && typeof input.doi !== 'string') {
    return { ok: false, reason: 'doi-not-string' };
  }
  const doi =
    typeof input.doi === 'string' && input.doi.trim().length > 0
      ? input.doi.trim()
      : undefined;

  if (
    input.supersedesSnapshotId !== undefined &&
    input.supersedesSnapshotId !== null &&
    typeof input.supersedesSnapshotId !== 'string'
  ) {
    return { ok: false, reason: 'supersedes_snapshot_id-not-string' };
  }
  const supersedesSnapshotId =
    typeof input.supersedesSnapshotId === 'string' &&
    input.supersedesSnapshotId.trim().length > 0
      ? input.supersedesSnapshotId.trim()
      : undefined;

  return {
    ok: true,
    content: {
      markdownContent,
      yjsBinaryBase64,
      kind,
      permalinkHash,
      ...(doi ? { doi } : {}),
      ...(supersedesSnapshotId ? { supersedesSnapshotId } : {}),
    },
  };
}

export interface OpenDatasetFeedRow {
  id: string;
  datasetDoi: string | null;
  title: string;
  descriptionMd: string;
  sizeBytes: bigint | number;
  licenseSpdx: string;
  signedPayloadJws: string;
  merkleLogEntryId: string;
  createdAt: Date;
  withdrawnAt: Date | null;
}

export interface ShareSnapshotFeedRow {
  id: string;
  markdownContent: string;
  kind: string;
  permalinkHash: string;
  doi: string | null;
  signedPayloadJws: string;
  merkleLogEntryId: string;
  createdAt: Date;
  withdrawnAt: Date | null;
  supersedesSnapshotId: string | null;
}

export interface OpenPeerReviewFeedRow {
  targetKind: 'question' | 'dataset' | 'snapshot' | string;
  targetId: string;
  verdict: 'endorses' | 'challenges' | 'refines' | string;
  withdrawnAt: Date | null;
}

export interface OpenFeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  excerpt: string;
  href: string;
  createdAt: Date;
  tags: string[];
  status: string;
  pid: string | null;
  merkleLogEntryId: string;
  signed: boolean;
  reviewCount: number;
  endorseCount: number;
  challengeCount: number;
  refineCount: number;
  meta: string[];
}

export interface OpenFeedSummary {
  kind: FeedKind;
  totalItems: number;
  signedItems: number;
  reviewedItems: number;
  openQuestions: number;
  datasetItems: number;
  snapshotItems: number;
}

export interface OpenFeedView {
  filter: FeedFilter;
  summary: OpenFeedSummary;
  items: OpenFeedItem[];
}

/**
 * Parse raw URL search params into a typed FeedFilter. Caller passes
 * a `URLSearchParams` (Next.js route extracts from request).
 *
 * Invariants:
 *   - kind defaults to 'open_question' when missing
 *   - status only honored for open_question kind (other entities don't
 *     have status enum)
 *   - domainTags split on ',' (URL `?domainTags=ai,physics`)
 *   - limit clamped to [1, MAX_LIMIT]
 *   - invalid date strings → undefined (not error — keep parser lenient)
 */
export function parseFeedFilter(params: URLSearchParams): FeedFilter {
  const rawKind = params.get('kind');
  const kind: FeedKind = (['open_question', 'open_dataset', 'share_snapshot'] as const).includes(
    rawKind as FeedKind,
  )
    ? (rawKind as FeedKind)
    : 'open_question';

  const status = (params.get('status') ?? undefined) as FeedFilter['status'];
  const validStatus =
    kind === 'open_question' && status && ['open', 'answered', 'withdrawn'].includes(status)
      ? status
      : kind === 'open_question'
        ? 'open' // default for question feed
        : undefined;

  const tagsRaw = params.get('domainTags');
  const domainTags =
    tagsRaw && tagsRaw.length > 0
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

  const since = params.get('sinceCreatedAt');
  const until = params.get('untilCreatedAt');
  const sinceCreatedAt = since ? parseDateOrUndef(since) : undefined;
  const untilCreatedAt = until ? parseDateOrUndef(until) : undefined;

  let limit = parseInt(params.get('limit') ?? '', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return {
    kind,
    ...(validStatus !== undefined ? { status: validStatus } : {}),
    ...(domainTags !== undefined ? { domainTags } : {}),
    ...(sinceCreatedAt !== undefined ? { sinceCreatedAt } : {}),
    ...(untilCreatedAt !== undefined ? { untilCreatedAt } : {}),
    limit,
  };
}

export function assembleOpenContentFeed(args: {
  filter: FeedFilter;
  questions: readonly OpenQuestionFeedRow[];
  datasets: readonly OpenDatasetFeedRow[];
  snapshots: readonly ShareSnapshotFeedRow[];
  reviews: readonly OpenPeerReviewFeedRow[];
}): OpenFeedView {
  const reviewCounts = buildReviewCounts(args.reviews);
  const supersededSnapshotIds = new Set(
    args.snapshots
      .map((row) => row.supersedesSnapshotId)
      .filter((id): id is string => hasText(id)),
  );
  const items = [
    ...args.questions
      .filter((row) => row.withdrawnAt === null)
      .filter((row) => row.status === args.filter.status)
      .filter((row) => tagsMatch(row.domainTags, args.filter.domainTags))
      .map((row) =>
        questionToFeedItem(row, reviewCounts.get(targetKey('question', row.id))),
      ),
    ...args.datasets
      .filter((row) => row.withdrawnAt === null)
      .filter((row) => tagsMatch([], args.filter.domainTags))
      .map((row) =>
        datasetToFeedItem(row, reviewCounts.get(targetKey('dataset', row.id))),
      ),
    ...args.snapshots
      .filter((row) => row.withdrawnAt === null)
      .filter((row) => !supersededSnapshotIds.has(row.id))
      .filter((row) => tagsMatch([row.kind], args.filter.domainTags))
      .map((row) =>
        snapshotToFeedItem(row, reviewCounts.get(targetKey('snapshot', row.id))),
      ),
  ]
    .filter((item) => item.kind === args.filter.kind)
    .filter((item) => withinWindow(item.createdAt, args.filter))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, args.filter.limit ?? DEFAULT_LIMIT);

  return {
    filter: args.filter,
    summary: {
      kind: args.filter.kind,
      totalItems: items.length,
      signedItems: items.filter((item) => item.signed).length,
      reviewedItems: items.filter((item) => item.reviewCount > 0).length,
      openQuestions: items.filter(
        (item) => item.kind === 'open_question' && item.status === 'open',
      ).length,
      datasetItems: items.filter((item) => item.kind === 'open_dataset').length,
      snapshotItems: items.filter((item) => item.kind === 'share_snapshot')
        .length,
    },
    items,
  };
}

function parseDateOrUndef(s: string): Date | undefined {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function questionToFeedItem(
  row: OpenQuestionFeedRow,
  counts: ReviewCounts | undefined,
): OpenFeedItem {
  return withReviewCounts(
    {
      id: row.id,
      kind: 'open_question',
      title: firstMarkdownLine(row.questionMd) || 'Open question',
      excerpt: excerpt(row.questionMd),
      href: `/open/question/${encodeURIComponent(row.id)}`,
      createdAt: row.createdAt,
      tags: [...row.domainTags],
      status: row.status,
      pid: row.askerOrcidId ? `orcid:${row.askerOrcidId}` : null,
      merkleLogEntryId: row.merkleLogEntryId,
      signed: hasText(row.signedPayloadJws),
      meta: [
        row.askerOrcidId ? `ORCID ${row.askerOrcidId}` : 'ORCID pending',
        `merkle ${shortId(row.merkleLogEntryId)}`,
      ],
    },
    counts,
  );
}

function datasetToFeedItem(
  row: OpenDatasetFeedRow,
  counts: ReviewCounts | undefined,
): OpenFeedItem {
  const size = typeof row.sizeBytes === 'bigint' ? Number(row.sizeBytes) : row.sizeBytes;
  return withReviewCounts(
    {
      id: row.id,
      kind: 'open_dataset',
      title: row.title,
      excerpt: excerpt(row.descriptionMd),
      href: `/open/dataset/${encodeURIComponent(row.id)}`,
      createdAt: row.createdAt,
      tags: [row.licenseSpdx],
      status: 'published',
      pid: row.datasetDoi ? `doi:${row.datasetDoi}` : null,
      merkleLogEntryId: row.merkleLogEntryId,
      signed: hasText(row.signedPayloadJws),
      meta: [
        row.datasetDoi ? `DOI ${row.datasetDoi}` : 'DOI pending',
        row.licenseSpdx,
        formatBytes(size),
      ],
    },
    counts,
  );
}

function snapshotToFeedItem(
  row: ShareSnapshotFeedRow,
  counts: ReviewCounts | undefined,
): OpenFeedItem {
  return withReviewCounts(
    {
      id: row.id,
      kind: 'share_snapshot',
      title: firstMarkdownLine(row.markdownContent) || `${row.kind} snapshot`,
      excerpt: excerpt(row.markdownContent),
      href: `/open/snapshot/${encodeURIComponent(row.permalinkHash)}`,
      createdAt: row.createdAt,
      tags: [row.kind],
      status: 'published',
      pid: row.doi ? `doi:${row.doi}` : `hash:${row.permalinkHash}`,
      merkleLogEntryId: row.merkleLogEntryId,
      signed: hasText(row.signedPayloadJws),
      meta: [
        row.doi ? `DOI ${row.doi}` : `hash ${shortId(row.permalinkHash)}`,
        `merkle ${shortId(row.merkleLogEntryId)}`,
      ],
    },
    counts,
  );
}

interface ReviewCounts {
  reviewCount: number;
  endorseCount: number;
  challengeCount: number;
  refineCount: number;
}

function withReviewCounts(
  item: Omit<
    OpenFeedItem,
    'reviewCount' | 'endorseCount' | 'challengeCount' | 'refineCount'
  >,
  counts: ReviewCounts | undefined,
): OpenFeedItem {
  return {
    ...item,
    reviewCount: counts?.reviewCount ?? 0,
    endorseCount: counts?.endorseCount ?? 0,
    challengeCount: counts?.challengeCount ?? 0,
    refineCount: counts?.refineCount ?? 0,
  };
}

function buildReviewCounts(
  rows: readonly OpenPeerReviewFeedRow[],
): Map<string, ReviewCounts> {
  const out = new Map<string, ReviewCounts>();
  for (const row of rows) {
    if (row.withdrawnAt !== null) continue;
    const key = targetKey(row.targetKind, row.targetId);
    const current =
      out.get(key) ??
      ({ reviewCount: 0, endorseCount: 0, challengeCount: 0, refineCount: 0 } satisfies ReviewCounts);
    current.reviewCount += 1;
    if (row.verdict === 'endorses') current.endorseCount += 1;
    if (row.verdict === 'challenges') current.challengeCount += 1;
    if (row.verdict === 'refines') current.refineCount += 1;
    out.set(key, current);
  }
  return out;
}

function targetKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function tagsMatch(
  rowTags: readonly string[],
  wantedTags: readonly string[] | undefined,
): boolean {
  if (!wantedTags || wantedTags.length === 0) return true;
  const haystack = new Set(rowTags.map((tag) => tag.toLowerCase()));
  return wantedTags.some((tag) => haystack.has(tag.toLowerCase()));
}

function withinWindow(createdAt: Date, filter: FeedFilter): boolean {
  if (filter.sinceCreatedAt && createdAt < filter.sinceCreatedAt) return false;
  if (filter.untilCreatedAt && createdAt > filter.untilCreatedAt) return false;
  return true;
}

function firstMarkdownLine(value: string): string {
  const line = value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return cleanMarkdown(line ?? '');
}

function excerpt(value: string): string {
  const clean = cleanMarkdown(value).replace(/\s+/g, ' ').trim();
  if (clean.length <= 220) return clean;
  return `${clean.slice(0, 217)}...`;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 12)}...`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = value;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  const rounded = current >= 10 || unit === 0 ? Math.round(current) : Math.round(current * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSizeBytes(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizeDomainTags(
  value: unknown,
):
  | { ok: true; domainTags: string[] }
  | { ok: false; reason: 'domain_tags-not-array' | 'domain_tag-not-string' } {
  if (value === undefined || value === null) {
    return { ok: true, domainTags: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, reason: 'domain_tags-not-array' };
  }
  const tags: string[] = [];
  for (const tag of value) {
    if (typeof tag !== 'string') {
      return { ok: false, reason: 'domain_tag-not-string' };
    }
    const trimmed = tag.trim();
    if (trimmed.length > 0 && !tags.includes(trimmed)) tags.push(trimmed);
  }
  return { ok: true, domainTags: tags };
}

// ---------- Open question answer service ----------

/**
 * F7 stranger-reply validator. Called by POST /api/open-question/[id]/answer.
 *
 * Stranger publishes an open_peer_review with:
 *   - target_kind = 'question'
 *   - target_id = question.id
 *   - reviewer_orcid_id required (no anonymous in Merkle log)
 *   - verdict: typically 'endorses' (answer agrees) / 'refines' (partial)
 *     / 'challenges' (counter-question, evidence required)
 *
 * This validator wraps the generic publish path with question-specific
 * preconditions (question must exist + status = 'open' + reviewer
 * different from asker).
 */
export interface OpenQuestionAnswerInput {
  questionId: string;
  /** Loaded by route from open_question table. */
  questionRow: {
    id: string;
    status: 'open' | 'answered' | 'withdrawn' | string;
    askerPrincipalId: string;
  } | null;
  reviewerPrincipalId: string;
  reviewerOrcidId: string;
}

export type AnswerOpenQuestionRejectReason =
  | 'question-not-found'
  | 'question-not-open'
  | 'cannot-self-answer'
  | 'reviewer-no-orcid';

export type AnswerOpenQuestionValidation =
  | { ok: true; questionId: string }
  | { ok: false; reason: AnswerOpenQuestionRejectReason };

export function validateOpenQuestionAnswer(
  input: OpenQuestionAnswerInput,
): AnswerOpenQuestionValidation {
  if (!input.questionRow) {
    return { ok: false, reason: 'question-not-found' };
  }
  if (input.questionRow.status !== 'open') {
    return { ok: false, reason: 'question-not-open' };
  }
  if (input.questionRow.askerPrincipalId === input.reviewerPrincipalId) {
    return { ok: false, reason: 'cannot-self-answer' };
  }
  if (!input.reviewerOrcidId || input.reviewerOrcidId.trim().length === 0) {
    return { ok: false, reason: 'reviewer-no-orcid' };
  }
  return { ok: true, questionId: input.questionRow.id };
}

export interface OpenQuestionAnswerContent {
  reviewerOrcidId: string;
  targetKind: 'question';
  targetId: string;
  verdict: 'endorses' | 'challenges' | 'refines';
  bodyMd: string;
  evidenceRefs: string[];
}

export interface OpenQuestionAnswerDraftInput {
  questionId: string;
  reviewerOrcidId: string | null | undefined;
  verdict: unknown;
  bodyMd: unknown;
  evidenceRefs?: unknown;
}

export type OpenQuestionAnswerDraftRejectReason =
  | 'missing-question-id'
  | 'reviewer-no-orcid'
  | 'invalid-verdict'
  | 'body-empty'
  | 'evidence_refs-not-array'
  | 'evidence_ref-not-string'
  | 'challenges-requires-evidence';

export type OpenQuestionAnswerDraftValidation =
  | { ok: true; content: OpenQuestionAnswerContent }
  | { ok: false; reason: OpenQuestionAnswerDraftRejectReason };

export function buildOpenQuestionAnswerContent(
  input: OpenQuestionAnswerDraftInput,
): OpenQuestionAnswerDraftValidation {
  const questionId = input.questionId.trim();
  if (!questionId) return { ok: false, reason: 'missing-question-id' };

  const reviewerOrcidId = input.reviewerOrcidId?.trim() ?? '';
  if (!reviewerOrcidId) return { ok: false, reason: 'reviewer-no-orcid' };

  if (
    input.verdict !== 'endorses' &&
    input.verdict !== 'challenges' &&
    input.verdict !== 'refines'
  ) {
    return { ok: false, reason: 'invalid-verdict' };
  }

  if (typeof input.bodyMd !== 'string' || input.bodyMd.trim().length === 0) {
    return { ok: false, reason: 'body-empty' };
  }

  const evidenceCheck = normalizeEvidenceRefs(input.evidenceRefs);
  if (!evidenceCheck.ok) return evidenceCheck;

  if (input.verdict === 'challenges' && evidenceCheck.evidenceRefs.length === 0) {
    return { ok: false, reason: 'challenges-requires-evidence' };
  }

  return {
    ok: true,
    content: {
      reviewerOrcidId,
      targetKind: 'question',
      targetId: questionId,
      verdict: input.verdict,
      bodyMd: input.bodyMd.trim(),
      evidenceRefs: evidenceCheck.evidenceRefs,
    },
  };
}

function normalizeEvidenceRefs(
  value: unknown,
):
  | { ok: true; evidenceRefs: string[] }
  | {
      ok: false;
      reason: Extract<
        OpenQuestionAnswerDraftRejectReason,
        'evidence_refs-not-array' | 'evidence_ref-not-string'
      >;
    } {
  if (value === undefined || value === null) {
    return { ok: true, evidenceRefs: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, reason: 'evidence_refs-not-array' };
  }
  const evidenceRefs: string[] = [];
  for (const ref of value) {
    if (typeof ref !== 'string') {
      return { ok: false, reason: 'evidence_ref-not-string' };
    }
    const trimmed = ref.trim();
    if (trimmed.length > 0) evidenceRefs.push(trimmed);
  }
  return { ok: true, evidenceRefs };
}
