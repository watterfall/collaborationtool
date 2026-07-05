import type { Metadata } from 'next';

import {
  MarkdownPane,
  OpenRecordLayout,
  PublicRecordUnavailable,
  RecordNotFound,
  RecordSideMeta,
  ReviewThread,
} from '../../record-ui';
import { loadOpenQuestionDetailSafely } from '@/lib/open-content-detail-query';
import { AnswerOpenQuestionForm } from './AnswerOpenQuestionForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Open question · 开放问题',
    description: 'A signed public research question and its peer responses.',
  };
}

export default async function OpenQuestionDetailPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const result = await loadOpenQuestionDetailSafely(questionId);
  if (result.unavailable) return <PublicRecordUnavailable />;
  if (!result.record) return <RecordNotFound />;

  const { item, questionMd, provenance, reviews } = result.record;
  return (
    <OpenRecordLayout
      item={item}
      side={<RecordSideMeta item={item} provenance={provenance} />}
    >
      <MarkdownPane content={questionMd} />
      {item.status === 'open' ? (
        <AnswerOpenQuestionForm questionId={item.id} />
      ) : null}
      <ReviewThread reviews={reviews} />
    </OpenRecordLayout>
  );
}
