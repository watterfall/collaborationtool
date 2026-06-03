import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  loadPrincipalContext,
  materialiseRoleBundle,
} from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { readEvidenceSourceKind } from '@/lib/evidence-map';
import { getPrincipalIdForUser } from '@/lib/principal';
import { assembleResearchReadiness } from '@/lib/research-readiness';

import EditorClient from './editor-client';
import ExportDrawer from './components/ExportDrawer';
import { ResearchReadinessPanel } from './components/ResearchReadinessPanel';
import RevisionInbox from './components/RevisionInbox';
import ShareDialog from './components/ShareDialog';

export default async function EditorPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;

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
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-medium">404</h1>
        <p className="text-sm text-zinc-600">文档不存在或已被删除。</p>
        <Link href="/docs" className="mt-4 inline-block text-sm underline">
          返回文档列表
        </Link>
      </div>
    );
  }

  const doc = docRows[0]!;

  // Owner short-circuit (codex review 2026-05-11 follow-up / demo-doc
  // fix): the document.ownerPrincipalId IS the source of truth for
  // ownership (per ADR-0002 §6 + `PAPER_AUTHOR_BUNDLE` comment "via
  // document.owner_principal_id, not via per-document ACL row"). Older
  // seed paths (`infra/drizzle/src/seed.ts`) only insert the document
  // row and skip `materialiseRoleBundle`, so the owner gets a 403 on
  // their own doc. Self-heal: when the request comes from the owner
  // and no ACL row exists, materialise paper-author on first access.
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
  if (!ctx || !ctx.documentCapabilities.has('document.read')) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-medium">403</h1>
        <p className="text-sm text-zinc-600">你没有访问此文档的权限。</p>
        <Link href="/docs" className="mt-4 inline-block text-sm underline">
          返回文档列表
        </Link>
      </div>
    );
  }

  const readinessClaims = await db
    .select({
      claimId: schema.claim.id,
      claimText: schema.claim.text,
    })
    .from(schema.claim)
    .where(eq(schema.claim.documentOriginId, doc.id));
  const readinessClaimIds = readinessClaims.map((claim) => claim.claimId);

  const [readinessEvidences, readinessReviews, readinessFindings] =
    await Promise.all([
      readinessClaimIds.length > 0
        ? db
            .select({
              supportsClaimId: schema.evidence.supportsClaimId,
              citationId: schema.evidence.citationId,
            })
            .from(schema.evidence)
            .where(
              inArray(schema.evidence.supportsClaimId, readinessClaimIds),
            )
        : [],
      readinessClaimIds.length > 0
        ? db
            .select({
              claimId: schema.claimReview.claimId,
              isAiVerdict: schema.claimReview.isAiVerdict,
              withdrawnAt: schema.claimReview.withdrawnAt,
              reviewerOrcidId: schema.claimReview.reviewerOrcidId,
              orcidSignedAt: schema.claimReview.orcidSignedAt,
              signedPayloadJws: schema.claimReview.signedPayloadJws,
            })
            .from(schema.claimReview)
            .where(
              inArray(schema.claimReview.claimId, readinessClaimIds),
            )
        : [],
      db
        .select({
          findingId: schema.maintenanceFinding.id,
          claimId: schema.maintenanceFinding.claimId,
          kind: schema.maintenanceFinding.kind,
          severity: schema.maintenanceFinding.severity,
          status: schema.maintenanceFinding.status,
          summary: schema.maintenanceFinding.summary,
        })
        .from(schema.maintenanceFinding)
        .where(
          and(
            eq(schema.maintenanceFinding.documentId, doc.id),
            eq(schema.maintenanceFinding.vaultPrincipalId, principalId),
          ),
        ),
    ]);
  const readinessCitationIds = [
    ...new Set(
      readinessEvidences
        .map((evidence) => evidence.citationId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const readinessCitationRows =
    readinessCitationIds.length > 0
      ? await db
          .select({
            citationId: schema.citation.id,
            kind: schema.citation.kind,
            cslJson: schema.citation.cslJson,
          })
          .from(schema.citation)
          .where(inArray(schema.citation.id, readinessCitationIds))
      : [];
  const sourceKindByCitationId = new Map(
    readinessCitationRows.map((citation) => [
      citation.citationId,
      readEvidenceSourceKind(citation.kind, citation.cslJson),
    ]),
  );

  const researchReadiness = assembleResearchReadiness({
    claims: readinessClaims,
    evidences: readinessEvidences.map((evidence) => ({
      supportsClaimId: evidence.supportsClaimId,
      sourceKind: evidence.citationId
        ? (sourceKindByCitationId.get(evidence.citationId) ?? null)
        : null,
    })),
    reviews: readinessReviews,
    findings: readinessFindings,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-medium">{doc.title || doc.slug}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {doc.primaryLanguage} · {doc.bilingualMode} · /{doc.slug}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {ctx.documentCapabilities.has('capability.grant') && (
            <ShareDialog documentId={doc.id} />
          )}
        </div>
      </header>

      <ResearchReadinessPanel
        documentId={doc.id}
        summary={researchReadiness}
      />

      <EditorClient
        documentId={doc.id}
        canPublishOpenLedger={ctx.documentCapabilities.has('block.commit')}
      />

      {/*
        Phase 4 W6.1：旧 AgentPanel 折叠侧边栏被 InlineAgentMenu (⌘K
        floating menu) 替代。AI 提议直接落到下方 RevisionInbox。
        参见第一性原理 #3「AI 是协作者不是侧边栏」。
      */}
      {(ctx.documentCapabilities.has('block.review') ||
        ctx.documentCapabilities.has('block.commit')) && (
        <RevisionInbox documentId={doc.id} />
      )}

      <ExportDrawer documentId={doc.id} />

      <Link href="/docs" className="mt-6 inline-block text-sm underline">
        ← 返回文档列表
      </Link>
    </div>
  );
}
