import type { Metadata } from 'next';

import {
  MarkdownPane,
  OpenRecordLayout,
  PublicRecordUnavailable,
  RecordNotFound,
  RecordSideMeta,
  ReviewThread,
} from '../../record-ui';
import { loadOpenDatasetDetailSafely } from '@/lib/open-content-detail-query';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Open dataset · 开放数据集',
    description: 'A signed public dataset record and its peer responses.',
  };
}

export default async function OpenDatasetDetailPage({
  params,
}: {
  params: Promise<{ datasetId: string }>;
}) {
  const { datasetId } = await params;
  const result = await loadOpenDatasetDetailSafely(datasetId);
  if (result.unavailable) return <PublicRecordUnavailable />;
  if (!result.record) return <RecordNotFound />;

  const { item, descriptionMd, provenance, reviews } = result.record;
  return (
    <OpenRecordLayout
      item={item}
      side={<RecordSideMeta item={item} provenance={provenance} />}
    >
      <MarkdownPane content={descriptionMd} />
      <ReviewThread reviews={reviews} />
    </OpenRecordLayout>
  );
}
