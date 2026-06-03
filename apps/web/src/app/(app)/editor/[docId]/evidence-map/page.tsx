import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import { newCitationId, newEvidenceId } from '@collaborationtool/editor-core';
import {
  DEFAULT_ROLE_BUNDLES,
  loadPrincipalContext,
  materialiseRoleBundle,
} from '@collaborationtool/permissions';

import { HairlineRule, MonoDisc, StatusPill } from '@/components/design';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  EVIDENCE_RELATIONS,
  EVIDENCE_SOURCE_KINDS,
  assembleEvidenceMap,
  selectReusableCitationId,
  validateEvidenceDraftInput,
  type EvidenceSourceKind,
  type EvidenceDraftValidationReason,
  type EvidenceMapClaimNode,
  type EvidenceMapEvidenceNode,
  type EvidenceMapView,
} from '@/lib/evidence-map';
import { getPrincipalIdForUser } from '@/lib/principal';

export const dynamic = 'force-dynamic';

export default async function DocumentEvidenceMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { docId } = await params;
  const sp = await searchParams;
  const targetClaimId = firstParam(sp.claimId);
  const evidenceNotice = firstParam(sp.evidenceNotice);
  const evidenceError = firstParam(sp.evidenceError);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(`No Principal row for user ${session.user.id}`);
  }

  const db = getDb();
  const docRows = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.id, docId), isNull(schema.document.deletedAt)))
    .limit(1);

  if (docRows.length === 0) {
    return <EvidenceMapMessage title="404" body="文档不存在或已被删除。" />;
  }

  const doc = docRows[0]!;
  let ctx = await loadPrincipalContext(db, principalId, doc.id);
  if (!ctx && principalId === doc.ownerPrincipalId) {
    await materialiseRoleBundle(db, {
      documentId: doc.id,
      principalId,
      roleId: 'paper-author',
      capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
    });
    ctx = await loadPrincipalContext(db, principalId, doc.id);
  }
  if (!ctx || !ctx.documentCapabilities.has('block.read')) {
    return <EvidenceMapMessage title="403" body="你没有读取证据地图的权限。" />;
  }
  const canBindEvidence = ctx.documentCapabilities.has('block.commit');

  const claimRows = await db
    .select({
      claimId: schema.claim.id,
      text: schema.claim.text,
      claimType: schema.claim.claimType,
      status: schema.claim.status,
      confidence: schema.claim.confidence,
      createdAt: schema.claim.createdAt,
    })
    .from(schema.claim)
    .where(eq(schema.claim.documentOriginId, doc.id));
  const claimIds = claimRows.map((claim) => claim.claimId);

  const evidenceRows =
    claimIds.length > 0
      ? await db
          .select({
            evidenceId: schema.evidence.id,
            excerpt: schema.evidence.excerpt,
            supportsClaimId: schema.evidence.supportsClaimId,
            citationId: schema.evidence.citationId,
            relation: schema.evidence.relation,
            status: schema.evidence.status,
            documentOriginId: schema.evidence.documentOriginId,
            createdAt: schema.evidence.createdAt,
          })
          .from(schema.evidence)
          .where(inArray(schema.evidence.supportsClaimId, claimIds))
      : [];
  const citationIds = [
    ...new Set(
      evidenceRows
        .map((evidence) => evidence.citationId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const citationRows =
    citationIds.length > 0
      ? await db
          .select({
            citationId: schema.citation.id,
            kind: schema.citation.kind,
            cslJson: schema.citation.cslJson,
            doi: schema.citation.doi,
            url: schema.citation.url,
          })
          .from(schema.citation)
          .where(inArray(schema.citation.id, citationIds))
      : [];

  const view = assembleEvidenceMap({
    documentId: doc.id,
    claims: claimRows,
    evidences: evidenceRows,
    citations: citationRows,
    targetClaimId,
  });

  return (
    <main
      className="mx-auto max-w-5xl px-6 py-10"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <header className="mb-6">
        <p className="label-cap">evidence map · 证据地图</p>
        <div className="mt-2 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <h1
              className="font-serif text-[30px] font-medium leading-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {doc.title || doc.slug}
            </h1>
            <p
              className="mt-2 max-w-prose font-serif text-[15px] italic leading-[1.65]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Claim、evidence、citation 和跨文档复用的可复核视图。
            </p>
          </div>
          <nav
            aria-label="evidence map navigation"
            className="flex flex-wrap gap-x-5 gap-y-2 font-sans text-[13px] md:justify-end"
            style={{ color: 'var(--color-ink-2)' }}
          >
            <Link
              href={`/editor/${encodeURIComponent(doc.id)}`}
              className="underline-offset-4 hover:underline"
            >
              返回编辑器 · Editor
            </Link>
            <a
              href={evidenceMapApiHref(doc.id, targetClaimId)}
              className="underline-offset-4 hover:underline"
            >
              JSON · API
            </a>
          </nav>
        </div>
        <HairlineRule weight="thick" className="mt-4" />
      </header>

      <EvidenceMapSummaryBand view={view} />
      <EvidenceSourceBand view={view} />

      {view.summary.targetClaimId && !view.summary.targetFound ? (
        <p
          className="mt-4 font-serif text-[13px] italic"
          style={{ color: 'var(--color-accent-ox)' }}
        >
          目标 claim 不属于当前文档 · Target claim is not in this document.
        </p>
      ) : null}

      <EvidenceActionNotice notice={evidenceNotice} error={evidenceError} />

      <section className="mt-6" aria-labelledby="claim-evidence-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2
            id="claim-evidence-heading"
            className="font-serif text-[20px] font-medium"
          >
            Claim evidence ledger · 论断证据账本
          </h2>
          <p
            className="font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {view.claims.length} claims
          </p>
        </div>

        {view.claims.length === 0 ? (
          <EmptyEvidenceMap documentId={doc.id} />
        ) : (
          <ol
            className="m-0 list-none p-0"
            style={{ borderTop: '1px solid var(--color-hairline)' }}
          >
            {view.claims.map((claim) => (
              <EvidenceClaimRow
                key={claim.claimId}
                claim={claim}
                documentId={doc.id}
                canBindEvidence={canBindEvidence}
              />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function EvidenceMapSummaryBand({ view }: { view: EvidenceMapView }) {
  return (
    <section
      aria-label="evidence map summary"
      className="grid gap-4 md:grid-cols-5"
      style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: '18px' }}
    >
      <SummaryMetric label="claims" value={String(view.summary.totalClaims)} />
      <SummaryMetric
        label="evidenced"
        value={String(view.summary.evidencedClaims)}
      />
      <SummaryMetric
        label="unsupported"
        value={String(view.summary.unsupportedClaims)}
      />
      <SummaryMetric
        label="evidence"
        value={String(view.summary.totalEvidence)}
      />
      <SummaryMetric label="sources" value={String(view.summary.totalSources)} />
    </section>
  );
}

function EvidenceSourceBand({ view }: { view: EvidenceMapView }) {
  return (
    <section
      aria-label="reproducibility source coverage"
      className="grid gap-x-5 gap-y-2 py-4 font-mono text-[11px] md:grid-cols-3"
      style={{ borderBottom: '1px solid var(--color-hairline)', color: 'var(--color-ink-3)' }}
    >
      <p>
        data {view.summary.datasetSources} · software{' '}
        {view.summary.softwareSources} · protocol{' '}
        {view.summary.protocolSources}
      </p>
      <p>
        literature {view.summary.literatureSources} · web{' '}
        {view.summary.webSources} · document {view.summary.documentSources}
      </p>
      <p>
        repro claims {view.summary.reproducibilityAssetClaims}/
        {view.summary.totalClaims}
      </p>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-cap">{label}</p>
      <p
        className="mt-1 font-serif text-[28px] leading-none"
        style={{ color: 'var(--color-ink)' }}
      >
        {value}
      </p>
    </div>
  );
}

function EvidenceActionNotice({
  notice,
  error,
}: {
  notice: string | null;
  error: string | null;
}) {
  const isSaved = notice === 'saved';
  if (!isSaved && !error) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className="mt-4 font-serif text-[13px] italic"
      style={{
        color: error ? 'var(--color-accent-ox)' : 'var(--color-accent-moss)',
      }}
    >
      {isSaved
        ? 'Evidence 已绑定 · Evidence saved.'
        : evidenceErrorMessage(error)}
    </p>
  );
}

function EvidenceClaimRow({
  claim,
  documentId,
  canBindEvidence,
}: {
  claim: EvidenceMapClaimNode;
  documentId: string;
  canBindEvidence: boolean;
}) {
  const pillStatus = claim.needsEvidence ? 'blocked' : 'applied';
  return (
    <li
      id={`claim-${claim.claimId}`}
      className="grid gap-4 py-5 md:grid-cols-[32px_1fr]"
      style={{
        borderBottom: '1px solid var(--color-hairline)',
        background: claim.highlighted ? 'var(--color-paper-2)' : undefined,
      }}
    >
      <MonoDisc
        kind={claim.needsEvidence ? 'agent' : 'community'}
        monogram={claim.needsEvidence ? 'E' : 'C'}
        actorName="Evidence state"
        actorNameEn="Evidence state"
        size="md"
      />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            status={pillStatus}
            label={claim.needsEvidence ? '缺证据' : '已绑定'}
            labelEn={claim.needsEvidence ? 'Needs evidence' : 'Evidenced'}
          />
          {claim.highlighted ? (
            <StatusPill status="proposed" label="目标" labelEn="Target" />
          ) : null}
          <span
            className="font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {claim.claimType} · {claim.status} · {claim.confidence}
          </span>
        </div>
        <p
          className="mt-2 font-serif text-[16px] leading-[1.6]"
          style={{ color: 'var(--color-ink)' }}
        >
          {claim.text}
        </p>
        <p
          className="mt-2 font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          support {claim.supportCount} · challenge {claim.challengeCount} ·
          qualify {claim.qualifyCount} · sources {claim.sourceCount}
        </p>

        {claim.crossDocDocumentIds.length > 0 ? (
          <p
            className="mt-2 font-serif text-[12px] italic"
            style={{ color: 'var(--color-accent-moss)' }}
          >
            cross-doc evidence:{' '}
            {claim.crossDocDocumentIds.map((id) => id.slice(0, 18)).join(', ')}
          </p>
        ) : null}

        {claim.evidences.length === 0 ? (
          <p
            className="mt-4 font-serif text-[13px] italic"
            style={{ color: 'var(--color-accent-ox)' }}
          >
            暂无 evidence 绑定 · No evidence bound.
          </p>
        ) : (
          <ol
            className="mt-4 list-none p-0"
            style={{ borderTop: '1px solid var(--color-hairline)' }}
          >
            {claim.evidences.map((evidence) => (
              <EvidenceRow key={evidence.evidenceId} evidence={evidence} />
            ))}
          </ol>
        )}
        {canBindEvidence ? (
          <ManualEvidenceForm documentId={documentId} claim={claim} />
        ) : (
          <p
            className="mt-4 font-serif text-[12px] italic"
            style={{ color: 'var(--color-ink-3)' }}
          >
            只读权限 · Read-only evidence ledger.
          </p>
        )}
      </div>
    </li>
  );
}

function ManualEvidenceForm({
  documentId,
  claim,
}: {
  documentId: string;
  claim: EvidenceMapClaimNode;
}) {
  return (
    <form
      action={createEvidenceAction}
      className="mt-4 grid gap-3"
      style={{
        borderTop: '1px dashed var(--color-hairline)',
        paddingTop: '14px',
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="claimId" value={claim.claimId} />
      <label className="grid gap-2">
        <span className="label-cap">bind evidence · 绑定证据</span>
        <textarea
          name="excerpt"
          required
          minLength={16}
          maxLength={4000}
          rows={3}
          placeholder="Paste the dataset note, citation sentence, protocol fact, or counter-evidence excerpt."
          className="w-full resize-y"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--color-ink)',
            background: 'var(--color-paper)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
            padding: '10px 12px',
          }}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span
            className="font-sans text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            relation
          </span>
          <select
            name="relation"
            defaultValue="supports"
            style={{
              height: '32px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink)',
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-1)',
              padding: '0 8px',
            }}
          >
            {EVIDENCE_RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost btn-size-sm">
          保存 evidence · Save
        </button>
        <p
          className="font-serif text-[12px] italic"
          style={{ color: 'var(--color-ink-3)' }}
        >
          Manual rows are stored as human-reviewed evidence.
        </p>
      </div>
      <div
        className="grid gap-3 md:grid-cols-[0.8fr_1fr_1fr_1fr]"
        style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '12px' }}
      >
        <label className="grid gap-1">
          <span
            className="font-sans text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            source kind
          </span>
          <select
            name="sourceKind"
            defaultValue="literature"
            style={{
              height: '34px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink)',
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-1)',
              padding: '0 8px',
            }}
          >
            {EVIDENCE_SOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {sourceKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <EvidenceTextInput
          name="sourceTitle"
          label="source title"
          placeholder="Paper, dataset, protocol..."
        />
        <EvidenceTextInput
          name="sourceDoi"
          label="DOI"
          placeholder="10.1038/..."
        />
        <EvidenceTextInput
          name="sourceUrl"
          label="URL"
          placeholder="https://..."
        />
      </div>
    </form>
  );
}

function EvidenceTextInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1">
      <span
        className="font-sans text-[11px]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {label}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        style={{
          height: '34px',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: 'var(--color-ink)',
          background: 'var(--color-paper)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-1)',
          padding: '0 9px',
        }}
      />
    </label>
  );
}

function EvidenceRow({ evidence }: { evidence: EvidenceMapEvidenceNode }) {
  return (
    <li
      className="grid gap-3 py-3 md:grid-cols-[120px_1fr]"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div
        className="font-mono text-[11px]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        <p>{evidence.relation}</p>
        <p>{formatDate(evidence.createdAt)}</p>
        {evidence.isCrossDocument ? <p>cross-doc</p> : null}
      </div>
      <div>
        <p
          className="font-serif text-[14px] leading-[1.6]"
          style={{ color: 'var(--color-ink)' }}
        >
          {evidence.excerpt}
        </p>
        <EvidenceCitation evidence={evidence} />
      </div>
    </li>
  );
}

function EvidenceCitation({ evidence }: { evidence: EvidenceMapEvidenceNode }) {
  const citation = evidence.citation;
  if (!citation) {
    return (
      <p
        className="mt-2 font-serif text-[12px] italic"
        style={{ color: 'var(--color-ink-3)' }}
      >
        未绑定 citation · No citation source.
      </p>
    );
  }
  return (
    <p
      className="mt-2 font-sans text-[12px] leading-[1.55]"
      style={{ color: 'var(--color-ink-2)' }}
    >
      <span style={{ color: 'var(--color-ink)' }}>{citation.title}</span>
      <span aria-hidden="true"> · </span>
      {sourceKindLabel(citation.sourceKind)}
      <span aria-hidden="true"> · </span>
      {citation.meta}
      {citation.doi ? (
        <>
          <span aria-hidden="true"> · </span>
          <a
            href={`https://doi.org/${encodeURI(citation.doi)}`}
            className="underline-offset-4 hover:underline"
          >
            doi:{citation.doi}
          </a>
        </>
      ) : citation.url ? (
        <>
          <span aria-hidden="true"> · </span>
          <a href={citation.url} className="underline-offset-4 hover:underline">
            source
          </a>
        </>
      ) : null}
    </p>
  );
}

function EmptyEvidenceMap({ documentId }: { documentId: string }) {
  return (
    <div
      className="py-10 text-center"
      style={{
        borderTop: '1px solid var(--color-hairline)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <p
        className="font-serif text-[14px] italic"
        style={{ color: 'var(--color-ink-3)' }}
      >
        尚无 claim · No claims yet.
      </p>
      <Link
        href={`/editor/${encodeURIComponent(documentId)}`}
        className="mt-3 inline-block font-sans text-[13px] underline-offset-4 hover:underline"
        style={{ color: 'var(--color-ink)' }}
      >
        返回编辑器 · Back to editor
      </Link>
    </div>
  );
}

function EvidenceMapMessage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p
        className="mt-2 text-sm"
        style={{ color: 'var(--color-ink-2)' }}
      >
        {body}
      </p>
      <Link
        href="/docs"
        className="mt-4 inline-block text-sm underline"
        style={{ color: 'var(--color-ink)' }}
      >
        返回文档列表
      </Link>
    </main>
  );
}

async function createEvidenceAction(formData: FormData): Promise<void> {
  'use server';

  const documentId = String(formData.get('documentId') ?? '').trim();
  const claimId = String(formData.get('claimId') ?? '').trim();
  if (!documentId) redirect('/docs');

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    redirect(evidenceMapPageHref(documentId, claimId, 'no-principal'));
  }

  const db = getDb();
  const docRows = await db
    .select({
      id: schema.document.id,
      ownerPrincipalId: schema.document.ownerPrincipalId,
    })
    .from(schema.document)
    .where(and(eq(schema.document.id, documentId), isNull(schema.document.deletedAt)))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    redirect(evidenceMapPageHref(documentId, claimId, 'document-not-found'));
  }

  let ctx = await loadPrincipalContext(db, principalId, doc.id);
  if (!ctx && principalId === doc.ownerPrincipalId) {
    await materialiseRoleBundle(db, {
      documentId: doc.id,
      principalId,
      roleId: 'paper-author',
      capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
    });
    ctx = await loadPrincipalContext(db, principalId, doc.id);
  }
  if (!ctx || !ctx.documentCapabilities.has('block.commit')) {
    redirect(evidenceMapPageHref(doc.id, claimId, 'capability-denied'));
  }

  const claimRows = await db
    .select({
      claimId: schema.claim.id,
    })
    .from(schema.claim)
    .where(eq(schema.claim.documentOriginId, doc.id));
  const validation = validateEvidenceDraftInput({
    claimId,
    excerpt: formData.get('excerpt'),
    relation: formData.get('relation'),
    sourceTitle: formData.get('sourceTitle'),
    sourceDoi: formData.get('sourceDoi'),
    sourceUrl: formData.get('sourceUrl'),
    sourceKind: formData.get('sourceKind'),
    allowedClaimIds: claimRows.map((claim) => claim.claimId),
  });
  if (!validation.ok) {
    redirect(evidenceMapPageHref(doc.id, claimId, validation.reason));
  }

  await db.transaction(async (tx) => {
    let citationId: string | null = null;
    const source = validation.payload.source;
    if (source) {
      if (source.doi || source.url) {
        const reusableRows = await tx
          .select({
            citationId: schema.citation.id,
            doi: schema.citation.doi,
            url: schema.citation.url,
            archivedAt: schema.citation.archivedAt,
          })
          .from(schema.citation)
          .where(
            and(
              isNull(schema.citation.archivedAt),
              source.doi
                ? eq(schema.citation.doi, source.doi)
                : eq(schema.citation.url, source.url!),
            ),
          )
          .limit(3);
        citationId = selectReusableCitationId(source, reusableRows);
      }
    }
    if (source && !citationId) {
      citationId = newCitationId();
      await tx.insert(schema.citation).values({
        id: citationId,
        kind: source.kind,
        cslJson: {
          title: source.title,
          'collaborationtool:evidenceKind': source.sourceKind,
          ...(source.doi ? { DOI: source.doi } : {}),
          ...(source.url ? { URL: source.url } : {}),
        },
        doi: source.doi,
        url: source.url,
        createdBy: principalId,
      });
    }

    await tx.insert(schema.evidence).values({
      id: newEvidenceId(),
      excerpt: validation.payload.excerpt,
      supportsClaimId: validation.payload.claimId,
      citationId,
      relation: validation.payload.relation,
      status: 'human-reviewed',
      documentOriginId: doc.id,
      createdBy: principalId,
    });
  });

  const path = `/editor/${encodeURIComponent(doc.id)}/evidence-map`;
  revalidatePath(path);
  redirect(evidenceMapPageHref(doc.id, validation.payload.claimId, null, 'saved'));
}

function evidenceMapApiHref(documentId: string, claimId: string | null): string {
  const base = `/api/document/${encodeURIComponent(documentId)}/evidence-map`;
  return claimId ? `${base}?claimId=${encodeURIComponent(claimId)}` : base;
}

function evidenceMapPageHref(
  documentId: string,
  claimId: string | null,
  error?: string | null,
  notice?: string | null,
): string {
  const params = new URLSearchParams();
  if (claimId) params.set('claimId', claimId);
  if (error) params.set('evidenceError', error);
  if (notice) params.set('evidenceNotice', notice);
  const qs = params.toString();
  const fragment = claimId ? `#claim-${encodeURIComponent(claimId)}` : '';
  return `/editor/${encodeURIComponent(documentId)}/evidence-map${qs ? `?${qs}` : ''}${fragment}`;
}

function evidenceErrorMessage(error: string | null): string {
  switch (error as EvidenceDraftValidationReason | string | null) {
    case 'missing-claim':
      return '缺少 claim · Missing claim.';
    case 'unknown-claim':
      return '这个 claim 不属于当前文档 · Claim is not in this document.';
    case 'missing-excerpt':
      return '请填写 evidence 摘录 · Evidence excerpt is required.';
    case 'excerpt-too-short':
      return 'Evidence 摘录太短 · Evidence excerpt is too short.';
    case 'excerpt-too-long':
      return 'Evidence 摘录太长 · Evidence excerpt is too long.';
    case 'invalid-relation':
      return 'Evidence relation 无效 · Invalid evidence relation.';
    case 'invalid-source-kind':
      return 'Source kind 无效 · Invalid source kind.';
    case 'source-title-too-long':
      return 'Source title 太长 · Source title is too long.';
    case 'invalid-doi':
      return 'DOI 格式不正确 · Invalid DOI format.';
    case 'invalid-url':
      return 'Source URL 无效 · Invalid source URL.';
    case 'capability-denied':
      return '你没有绑定 evidence 的权限 · Missing block.commit permission.';
    case 'document-not-found':
      return '文档不存在或已删除 · Document not found.';
    case 'no-principal':
      return '当前账号缺少 principal · Principal missing.';
    default:
      return 'Evidence 未保存 · Evidence was not saved.';
  }
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : null;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sourceKindLabel(kind: EvidenceSourceKind): string {
  switch (kind) {
    case 'literature':
      return 'literature';
    case 'dataset':
      return 'dataset';
    case 'software':
      return 'software';
    case 'protocol':
      return 'protocol';
    case 'document':
      return 'document';
    case 'web':
      return 'web';
  }
}
