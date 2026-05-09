// Phase 1 D15 — two-author MVP E2E.
//
// Drives the apps/web HTTP surface end-to-end with two cookie-isolated
// users (User A = author, User B = reviewer). The flow:
//
//   1. A signs up; B signs up — bridge creates two Principal rows
//   2. A creates a doc (PG fixture, since invitation flow is Phase 1.5)
//   3. B is granted paper-reviewer on A's doc (PG fixture)
//   4. A's editor page renders (auth + ACL OK)
//   5. A invokes Citation Agent — revision proposed
//   6. B lists pending revisions — sees A's invocation result
//   7. B rejects the citation revision with notes
//   8. A invokes Inline Editor Agent — revision proposed
//   9. A accepts (only writers can accept; B can't because reviewer is
//      block.review without block.commit)
//   10. A exports HTML + JATS + Typst source — all 200, content-bearing
//   11. PG verifies provenance + contribution + approval_chain integrity
//
// The sync-gateway / y-sweet are NOT exercised here (HTTP-only flow).
// Phase 1.5 / D15 follow-up adds the WebSocket leg + CRDT convergence
// once docker-compose is wired into CI.

import { test, expect, type APIRequestContext } from '@playwright/test';

import {
  closeHandle,
  createDocFixture,
  grantRoleFixture,
  pgContributionExists,
  pgPendingRevisions,
  pgProvenanceForRevision,
  principalForUserId,
} from '../fixtures/db';

interface SignUpResult {
  userId: string;
  email: string;
  context: APIRequestContext;
}

async function signUp(
  request: APIRequestContext,
  baseURL: string,
  name: string,
): Promise<SignUpResult> {
  const email = `e2e-${name}-${Date.now()}-${Math.floor(
    Math.random() * 1e6,
  )}@example.com`;
  const res = await request.post('/api/auth/sign-up/email', {
    data: { email, password: 'd15-e2e-12345', name: `D15 ${name}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { user?: { id?: string } };
  expect(body.user?.id).toBeTruthy();
  void baseURL;
  return { userId: body.user!.id!, email, context: request };
}

test.afterAll(async () => {
  await closeHandle();
});

test('two-author MVP: agent → propose → reject; agent → propose → accept; export', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);

  // Two cookie-isolated request contexts (a.k.a. two users).
  const userA = await browser.newContext();
  const userB = await browser.newContext();
  const reqA = userA.request;
  const reqB = userB.request;

  // ---- 1. Both users sign up ----
  const a = await signUp(reqA, baseURL!, 'A-author');
  const b = await signUp(reqB, baseURL!, 'B-reviewer');

  const principalA = await principalForUserId(a.userId);
  const principalB = await principalForUserId(b.userId);
  expect(principalA).toMatch(/^user:/);
  expect(principalB).toMatch(/^user:/);

  // ---- 2. A creates a doc (direct PG fixture; invitation flow is Phase 1.5) ----
  const { documentId } = await createDocFixture({
    ownerPrincipalId: principalA!,
    title: 'D15 两人协作 MVP / Two-author MVP',
    primaryLanguage: 'zh-Hans',
    bilingualMode: 'mixed',
  });

  // ---- 3. B granted paper-reviewer on A's doc ----
  await grantRoleFixture({
    documentId,
    principalId: principalB!,
    roleId: 'paper-reviewer',
  });

  // ---- 4. A's editor page renders (200 + appropriate Chinese title) ----
  const editorPage = await reqA.get(`/editor/${documentId}`);
  expect(editorPage.status()).toBe(200);
  const editorHtml = await editorPage.text();
  expect(editorHtml).toMatch(/D15/);
  expect(editorHtml).toMatch(/zh-Hans/);

  // B has read access too — sees the editor placeholder.
  const editorPageB = await reqB.get(`/editor/${documentId}`);
  expect(editorPageB.status()).toBe(200);

  // ---- 5. A invokes Citation Agent — revision proposed ----
  const invokeCitation = await reqA.post('/api/agent/invoke', {
    data: {
      kind: 'citation',
      documentId,
      blockId: 'blk-intro',
      passage:
        'See DOI 10.1145/3531146.3533104 for the foundation models survey.',
      flaggedDoiCandidates: [
        '10.1145/3531146.3533104',
        '10.48550/arXiv.2310.O6770', // typo: capital O for digit 0
        '10.9999/unknown.2024', // unfindable
      ],
    },
  });
  expect(invokeCitation.status()).toBe(200);
  const invokeCitationBody = (await invokeCitation.json()) as {
    revisionId?: string;
    proposal?: { revisedFragments?: unknown[]; uncertainties?: string[] };
  };
  expect(invokeCitationBody.revisionId).toBeTruthy();
  expect(invokeCitationBody.proposal?.revisedFragments?.length).toBeGreaterThan(
    0,
  );
  expect(invokeCitationBody.proposal?.uncertainties?.length).toBeGreaterThan(
    0,
  );
  const citationRevisionId = invokeCitationBody.revisionId!;

  // ---- 6. B lists pending revisions — sees A's invocation result ----
  const listRes = await reqB.get(
    `/api/revision?docId=${encodeURIComponent(documentId)}`,
  );
  expect(listRes.status()).toBe(200);
  const listBody = (await listRes.json()) as {
    revisions: Array<{ id: string; status: string }>;
  };
  const seen = listBody.revisions.find((r) => r.id === citationRevisionId);
  expect(seen).toBeTruthy();
  expect(seen!.status).toBe('proposed');

  // ---- 7. B rejects the citation revision with notes ----
  const reject = await reqB.post(`/api/revision/${citationRevisionId}/reject`, {
    data: { notes: 'too many uncertain DOIs — revisit' },
  });
  expect(reject.status()).toBe(200);
  const rejectBody = (await reject.json()) as { status?: string };
  expect(rejectBody.status).toBe('rejected');

  // ---- 8. A invokes Inline Editor Agent ----
  const invokeEditor = await reqA.post('/api/agent/invoke', {
    data: {
      kind: 'inline-editor',
      documentId,
      blockId: 'blk-method',
      passage: '我们用 Yjs 写了一个 hybrid 模型。',
      userInstruction: 'make this more formal',
    },
  });
  expect(invokeEditor.status()).toBe(200);
  const invokeEditorBody = (await invokeEditor.json()) as {
    revisionId?: string;
  };
  const editorRevisionId = invokeEditorBody.revisionId!;
  expect(editorRevisionId).toBeTruthy();

  // ---- 9. B (reviewer, block.review only) cannot accept; A (block.commit) can ----
  const bAcceptAttempt = await reqB.post(
    `/api/revision/${editorRevisionId}/accept`,
    { data: { notes: 'should fail' } },
  );
  expect(bAcceptAttempt.status()).toBe(403);

  const aAccept = await reqA.post(`/api/revision/${editorRevisionId}/accept`, {
    data: { notes: 'shipped to body' },
  });
  expect(aAccept.status()).toBe(200);
  const aAcceptBody = (await aAccept.json()) as {
    contributionId?: string;
    status?: string;
  };
  expect(aAcceptBody.status).toBe('accepted');
  expect(aAcceptBody.contributionId).toBeTruthy();

  // ---- 10. A exports HTML + JATS + Typst source ----
  // Inline a small PM tree as base64 so the export route has content
  // (the snapshot worker hasn't materialised the live Y.Doc here).
  const pmDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: '协作论文平台' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '我们用 GPT 写论文。' }],
      },
    ],
  };
  const b64 = encodeURIComponent(
    Buffer.from(JSON.stringify(pmDoc), 'utf8').toString('base64'),
  );

  const html = await reqA.get(
    `/api/export/${encodeURIComponent(documentId)}/html?content=${b64}`,
  );
  expect(html.status()).toBe(200);
  const htmlBody = await html.text();
  expect(htmlBody).toMatch(/<!doctype html>/);
  expect(htmlBody).toMatch(/<html lang="zh-Hans">/);
  expect(htmlBody).toMatch(/Source Han Serif SC/); // CJK font fallback chain
  expect(htmlBody).toMatch(/我们用 GPT 写论文/); // typography pre-pass

  const jats = await reqA.get(
    `/api/export/${encodeURIComponent(documentId)}/jats?content=${b64}`,
  );
  expect(jats.status()).toBe(200);
  const jatsBody = await jats.text();
  expect(jatsBody).toMatch(/^<\?xml version="1\.0"/);
  expect(jatsBody).toMatch(/xml:lang="zh_Hans"/);

  const typstSrc = await reqA.get(
    `/api/export/${encodeURIComponent(documentId)}/typst-source?content=${b64}`,
  );
  expect(typstSrc.status()).toBe(200);
  const typstSrcBody = await typstSrc.text();
  expect(typstSrcBody).toMatch(/#set text\(lang: "zh", region: "hans"/);

  // PDF needs a typst CLI on PATH; in CI sandbox this returns 503 with
  // an actionable hint. We assert either-or so the test stays portable.
  const pdf = await reqA.get(
    `/api/export/${encodeURIComponent(documentId)}/pdf?content=${b64}`,
  );
  expect([200, 503]).toContain(pdf.status());
  if (pdf.status() === 503) {
    const pdfBody = (await pdf.json()) as { error?: string };
    expect(pdfBody.error).toBe('typst-binary-unavailable');
  }

  // ---- 11. PG integrity — provenance + contribution + approval_chain ----
  const editorProv = await pgProvenanceForRevision(editorRevisionId);
  expect(editorProv).toBeTruthy();
  expect(editorProv!.actorKind).toBe('agent');
  expect(editorProv!.agentContext).toBeTruthy();
  expect(
    (editorProv!.agentContext as Record<string, unknown>)['promptHash'],
  ).toMatch(/^[0-9a-f]{64}$/);
  // Inline editor produces no tool calls (Phase 1).
  expect(editorProv!.toolCalls).toBeNull();
  // approval_chain has the accept entry.
  expect(editorProv!.approvalChain).toBeTruthy();
  const accepts = (editorProv!.approvalChain as Array<Record<string, unknown>>)
    .filter((e) => e['decision'] === 'accept');
  expect(accepts.length).toBe(1);
  expect(accepts[0]!['notes']).toBe('shipped to body');

  // Citation revision was rejected — chain entry has decision=reject.
  const citationProv = await pgProvenanceForRevision(citationRevisionId);
  expect(citationProv!.actorKind).toBe('agent');
  expect(Array.isArray(citationProv!.toolCalls)).toBe(true);
  expect((citationProv!.toolCalls as unknown[]).length).toBeGreaterThan(0);
  const rejects = (citationProv!.approvalChain as Array<Record<string, unknown>>)
    .filter((e) => e['decision'] === 'reject');
  expect(rejects.length).toBe(1);

  // Contribution row materialised for the accepted revision.
  expect(await pgContributionExists(aAcceptBody.contributionId!)).toBe(true);

  // No remaining pending revisions for this document.
  const stillPending = await pgPendingRevisions({ documentId });
  expect(stillPending.length).toBe(0);

  await userA.close();
  await userB.close();
});
