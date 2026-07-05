import type { Metadata } from 'next';

import {
  MarkdownPane,
  OpenRecordLayout,
  PublicRecordUnavailable,
  RecordNotFound,
  RecordSideMeta,
  ReviewThread,
} from '../../record-ui';
import { loadOpenSnapshotDetailSafely } from '@/lib/open-content-detail-query';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Open snapshot · 开放快照',
    description: 'A signed public snapshot and its peer responses.',
  };
}

export default async function OpenSnapshotDetailPage({
  params,
}: {
  params: Promise<{ permalinkHash: string }>;
}) {
  const { permalinkHash } = await params;
  const result = await loadOpenSnapshotDetailSafely(permalinkHash);
  if (result.unavailable) return <PublicRecordUnavailable />;
  if (!result.record) return <RecordNotFound />;

  const { item, markdownContent, provenance, reviews } = result.record;
  return (
    <OpenRecordLayout
      item={item}
      side={<RecordSideMeta item={item} provenance={provenance} />}
    >
      <MarkdownPane content={markdownContent} />
      <ReviewThread reviews={reviews} />
    </OpenRecordLayout>
  );
}
