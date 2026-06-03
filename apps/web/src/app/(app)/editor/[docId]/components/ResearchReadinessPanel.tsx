import Link from 'next/link';

import { HairlineRule, StatusPill } from '@/components/design';
import type {
  ResearchReadinessAction,
  ResearchReadinessCheck,
  ResearchReadinessStatus,
  ResearchReadinessSummary,
} from '@/lib/research-readiness';
import { buildResearchReadinessActionHref } from '@/lib/research-readiness';

const STATUS_COPY: Record<
  ResearchReadinessStatus,
  { label: string; labelEn: string; body: string }
> = {
  'no-claims': {
    label: '尚未建模',
    labelEn: 'No claims',
    body: '先把关键判断标成 claim，后续才能绑定 evidence、review 和 provenance。',
  },
  blocked: {
    label: '复核受阻',
    labelEn: 'Blocked',
    body: '这篇文档还有证据缺口、active finding 或未复核 AI block，暂不适合外发评审。',
  },
  'needs-review': {
    label: '等待复核',
    labelEn: 'Needs review',
    body: '证据链已基本成形，但仍需要人类 verdict，最好由 ORCID 身份签名。',
  },
  'needs-signature': {
    label: '等待签名',
    labelEn: 'Needs signature',
    body: '每条 claim 已有人类 verdict，但仍缺 ORCID-signed verdict；签名后才适合进入可公开验证的评审链。',
  },
  'needs-assets': {
    label: '等待复现资产',
    labelEn: 'Needs assets',
    body: '评审链已成形，但仍缺 data、software 或 protocol source；补齐后外部协作者才能复跑关键判断。',
  },
  ready: {
    label: '可进入评审',
    labelEn: 'Ready',
    body: '所有 claim 都已有 evidence、data/code/protocol asset、active human verdict 和 ORCID-signed proof，当前没有阻塞型巡检发现。',
  },
};

export function ResearchReadinessPanel({
  documentId,
  summary,
}: {
  documentId: string;
  summary: ResearchReadinessSummary;
}) {
  const copy = STATUS_COPY[summary.status];
  const pillStatus =
    summary.status === 'ready'
      ? 'applied'
      : summary.status === 'blocked'
        ? 'blocked'
        : 'proposed';

  return (
    <section
      aria-labelledby="research-readiness-heading"
      className="mb-8"
      style={{
        borderTop: '1.5px solid var(--color-pencil)',
        borderBottom: '1px solid var(--color-hairline)',
        paddingTop: '18px',
        paddingBottom: '18px',
      }}
    >
      <div className="flex flex-col gap-4">
        <header className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="label-cap">research readiness · 复现准备度</p>
            <h2
              id="research-readiness-heading"
              className="mt-2 font-serif text-[24px] font-medium leading-[1.25]"
              style={{ color: 'var(--color-ink)' }}
            >
              这篇论文是否可被复核？
              <span
                className="font-serif italic"
                style={{ color: 'var(--color-ink-2)', fontWeight: 400 }}
              >
                {' '}
                · reproducibility gate
              </span>
            </h2>
            <p
              className="mt-2 max-w-prose font-serif text-[15px] italic leading-[1.65]"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              {copy.body}
            </p>
          </div>
          <StatusPill
            status={pillStatus}
            label={copy.label}
            labelEn={copy.labelEn}
          />
        </header>

        <HairlineRule />

        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <ReadinessScore summary={summary} />
          <ol className="m-0 flex list-none flex-col p-0">
            {summary.checks.map((check) => (
              <ReadinessCheckRow key={check.id} check={check} />
            ))}
          </ol>
        </div>

        <ReadinessActionQueue
          documentId={documentId}
          actions={summary.actions}
        />

        <nav
          aria-label="research readiness actions"
          className="flex flex-wrap gap-x-5 gap-y-2 pt-1 font-sans text-[13px]"
          style={{ color: 'var(--color-ink-2)' }}
        >
          <Link
            href={`/editor/${encodeURIComponent(documentId)}/evidence-map`}
            className="underline-offset-4 hover:underline"
          >
            证据地图 · Evidence map
          </Link>
          <Link
            href={`/reviewer-inbox?documentId=${encodeURIComponent(documentId)}`}
            className="underline-offset-4 hover:underline"
          >
            claim 级评审 · Claim review
          </Link>
          <Link
            href="/maintenance?status=open"
            className="underline-offset-4 hover:underline"
          >
            巡检队列 · Maintenance queue
          </Link>
        </nav>
      </div>
    </section>
  );
}

function ReadinessActionQueue({
  documentId,
  actions,
}: {
  documentId: string;
  actions: ResearchReadinessAction[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="label-cap">next actions · 下一步</p>
        <p
          className="font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {actions.length} open
        </p>
      </div>
      {actions.length === 0 ? (
        <p
          className="py-3 font-serif text-[13px] italic"
          style={{
            borderTop: '1px solid var(--color-hairline)',
            color: 'var(--color-ink-3)',
          }}
        >
          暂无待处理项 · No readiness action open.
        </p>
      ) : (
        <ol
          className="m-0 list-none p-0"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          {actions.map((action) => (
            <ReadinessActionRow
              key={action.id}
              documentId={documentId}
              action={action}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function ReadinessScore({
  summary,
}: {
  summary: ResearchReadinessSummary;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-x-6 gap-y-4"
      style={{ alignContent: 'start' }}
    >
      <Metric
        label="claims"
        value={String(summary.totalClaims)}
        detail="一等论断对象"
      />
      <Metric
        label="evidence"
        value={`${summary.evidenceCoveragePct}%`}
        detail={`${summary.evidencedClaims}/${summary.totalClaims} bound`}
      />
      <Metric
        label="repro assets"
        value={`${summary.reproducibilityAssetCoveragePct}%`}
        detail={`${summary.reproducibilityAssetClaims}/${summary.totalClaims} claims`}
      />
      <Metric
        label="human review"
        value={`${summary.humanReviewCoveragePct}%`}
        detail={`${summary.humanReviewedClaims}/${summary.totalClaims} active`}
      />
      <Metric
        label="signed review"
        value={`${summary.signedReviewCoveragePct}%`}
        detail={`${summary.orcidSignedClaims}/${summary.totalClaims} claims`}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <p className="label-cap">{label}</p>
      <p
        className="mt-1 font-serif text-[28px] leading-none"
        style={{ color: 'var(--color-ink)' }}
      >
        {value}
      </p>
      <p
        className="mt-1 font-sans text-[11px]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {detail}
      </p>
    </div>
  );
}

function ReadinessCheckRow({
  check,
}: {
  check: ResearchReadinessCheck;
}) {
  const pillStatus =
    check.state === 'complete'
      ? 'applied'
      : check.state === 'blocked'
        ? 'blocked'
        : 'proposed';
  const label =
    check.state === 'complete'
      ? '通过'
      : check.state === 'blocked'
        ? '阻塞'
        : '待处理';
  const labelEn =
    check.state === 'complete'
      ? 'Pass'
      : check.state === 'blocked'
        ? 'Blocked'
        : 'Attention';

  return (
    <li
      className="grid gap-3 py-3 md:grid-cols-[1fr_auto]"
      style={{ borderTop: '1px solid var(--color-hairline)' }}
    >
      <div>
        <p
          className="font-serif text-[15px] font-medium leading-[1.4]"
          style={{ color: 'var(--color-ink)' }}
        >
          {check.label}
          <span
            className="ml-2 font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {check.value}
          </span>
        </p>
        <p
          className="mt-1 font-serif text-[13px] italic leading-[1.55]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {check.detail}
        </p>
      </div>
      <StatusPill status={pillStatus} label={label} labelEn={labelEn} />
    </li>
  );
}

function ReadinessActionRow({
  documentId,
  action,
}: {
  documentId: string;
  action: ResearchReadinessAction;
}) {
  const href = buildResearchReadinessActionHref(documentId, action);
  const pillStatus = action.severity === 'blocked' ? 'blocked' : 'proposed';
  const stateLabel = action.severity === 'blocked' ? '阻塞' : '待处理';
  const stateLabelEn =
    action.severity === 'blocked' ? 'Blocked' : 'Attention';
  return (
    <li
      className="grid gap-3 py-3 md:grid-cols-[1fr_auto]"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div>
        <p
          className="font-serif text-[15px] font-medium leading-[1.4]"
          style={{ color: 'var(--color-ink)' }}
        >
          {action.label}
          <span
            className="ml-2 font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {action.kind}
          </span>
        </p>
        <p
          className="mt-1 font-serif text-[13px] italic leading-[1.55]"
          style={{ color: 'var(--color-ink)' }}
        >
          {action.target}
        </p>
        <p
          className="mt-1 font-sans text-[12px] leading-[1.55]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {action.detail}
        </p>
      </div>
      <div className="flex items-start gap-3 md:justify-end">
        {href ? (
          <Link
            href={href}
            className="font-sans text-[13px] underline-offset-4 hover:underline"
            style={{ color: 'var(--color-ink-2)' }}
          >
            打开 · Open
          </Link>
        ) : null}
        <StatusPill
          status={pillStatus}
          label={stateLabel}
          labelEn={stateLabelEn}
        />
      </div>
    </li>
  );
}
