// Phase 4 W1 ADR-0012 plugin install API:
//
//   GET  /api/settings/plugins   → list caller's plugin_install rows
//   POST /api/settings/plugins   → install (paste-manifest mode)
//                                  body: { manifestJson, sourceUrl?,
//                                          acceptedCapabilities[] }
//
// Authorization: caller's principal_id; rows are private to the
// `installed_by` principal.
//
// Phase 4 W1 scope: paste-manifest install only. The git-clone +
// tarball extract + bwrap launch flow is the W1 dogfood gate
// (require Linux host) and lives in apps/agent-worker. Here we
// validate + write the plugin_install row + record the user's
// accepted-capabilities snapshot.

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';
import {
  InstallRejectedError,
  buildInstallRowPayload,
} from '@collaborationtool/ai-runtime';
import type { Capability } from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  detectHostPlatform,
  filterAcceptedCapabilities,
  previewManifest,
} from '@/lib/plugin-install';
import { getPrincipalIdForUser } from '@/lib/principal';

export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.pluginInstall)
    .where(eq(schema.pluginInstall.installedBy, principalId));

  return NextResponse.json({
    plugins: rows.map((r) => ({
      id: r.id,
      pluginManifestId: r.pluginManifestId,
      pluginKind: r.pluginKind,
      version: r.version,
      origin: r.origin,
      sourceUrl: r.sourceUrl,
      status: r.status,
      acceptedCapabilities: r.acceptedCapabilities,
      installPath: r.installPath,
      sandboxDescriptor: r.sandboxDescriptor,
      bundleHashSha256: r.bundleHashSha256,
      installedAt: r.installedAt.toISOString(),
      archivedAt: r.archivedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    return NextResponse.json({ error: 'no-principal' }, { status: 403 });
  }

  let body: {
    manifestJson?: unknown;
    sourceUrl?: unknown;
    acceptedCapabilities?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (typeof body.manifestJson !== 'string') {
    return NextResponse.json(
      { error: 'manifestJson-required' },
      { status: 400 },
    );
  }
  const preview = previewManifest(body.manifestJson);
  if (!preview.ok) {
    return NextResponse.json(preview, { status: 400 });
  }

  const sourceUrl =
    typeof body.sourceUrl === 'string' && body.sourceUrl.trim().length > 0
      ? body.sourceUrl.trim()
      : null;
  const origin = sourceUrl ? 'git-url' : 'local-path';

  const requested = Array.isArray(body.acceptedCapabilities)
    ? (body.acceptedCapabilities.filter(
        (x): x is string => typeof x === 'string',
      ) as readonly string[])
    : [];
  const acceptedCapabilities = filterAcceptedCapabilities(
    preview.preview.manifest,
    requested,
  ) as Capability[];

  // The pasted-manifest install path doesn't have a real tarball; we
  // hash the manifest JSON as a placeholder. The W1 dogfood gate
  // replaces this with the actual tarball SHA-256.
  const bundleBytes = new TextEncoder().encode(body.manifestJson);
  let payload;
  try {
    payload = buildInstallRowPayload({
      manifest: preview.preview.manifest,
      origin,
      sourceUrl,
      installedBy: principalId,
      installPath: `/var/lib/collab/plugins/${preview.preview.manifest.id}`,
      bundleBytes,
      acceptedCapabilities,
      sandboxPlatform: detectHostPlatform(),
      // These two are placeholders until the W1 dogfood gate wires the
      // actual host node binary + per-install node_modules layout.
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: `/var/lib/collab/plugins/${preview.preview.manifest.id}/node_modules`,
    });
  } catch (err) {
    if (err instanceof InstallRejectedError) {
      return NextResponse.json(
        { error: 'install-rejected', code: err.code, detail: err.message },
        { status: 400 },
      );
    }
    throw err;
  }

  const id = uuidv7();
  const db = getDb();
  await db.insert(schema.pluginInstall).values({
    id,
    pluginManifestId: payload.pluginManifestId,
    pluginKind: payload.pluginKind,
    version: payload.version,
    origin: payload.origin,
    sourceUrl: payload.sourceUrl,
    installedBy: payload.installedBy,
    status: payload.status,
    acceptedCapabilities: payload.acceptedCapabilities,
    installPath: payload.installPath,
    sandboxDescriptor: payload.sandboxDescriptor,
    bundleHashSha256: payload.bundleHashSha256,
  });

  return NextResponse.json(
    { ok: true, id, manifestId: payload.pluginManifestId },
    { status: 201 },
  );
}
