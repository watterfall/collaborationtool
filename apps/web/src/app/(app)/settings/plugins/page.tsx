// Phase 4 W1 ADR-0012 plugin install dashboard.
//
// Lists the caller's plugin_install rows and provides the paste-manifest
// install flow. Two phases on the same URL:
//   - default: list
//   - ?manifest=<encoded JSON>: preview + capability prompt + confirm form
//
// The paste form uses GET so the textarea content lands in the URL
// (Server Component reads it from searchParams). Manifests are small
// (<1KB), so URL length is not a concern. Server Action handles the
// confirm step (uses POST + body for the JSON to avoid putting the
// confirmed payload back in the URL).
//
// The W1 dogfood gate replaces the paste flow with real git clone +
// tarball extraction + bwrap launch (Linux host required).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
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

export default async function PluginsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ manifest?: string; sourceUrl?: string; error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const sp = await searchParams;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.pluginInstall)
    .where(eq(schema.pluginInstall.installedBy, principalId))
    .orderBy(desc(schema.pluginInstall.installedAt));

  const previewMode = typeof sp.manifest === 'string' && sp.manifest.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-medium">插件 · Plugins</h1>
        <p className="mt-1 text-sm text-zinc-500">
          已装第三方 plugin + capability prompt 流程（详见 ADR-0010 / ADR-0012）。
          Phase 4 W1：本页只接受粘贴 manifest JSON 安装；git clone + bwrap
          真启动是 W1 dogfood gate（require Linux host）。
        </p>
      </header>

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {sp.error}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-900">
          已装 / Installed
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            还没有用户安装的 plugin。内置 plugin 由 plugins/registry.json
            管理（不显示在这里）。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-700">
                      {p.pluginKind}
                    </span>
                    <span className="text-sm font-medium text-zinc-900">
                      {p.pluginManifestId}
                    </span>
                    <span className="text-zinc-500">v{p.version}</span>
                    <StatusBadge status={p.status} />
                    <span className="text-zinc-500">
                      {p.installedAt
                        .toISOString()
                        .slice(0, 16)
                        .replace('T', ' ')}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    <span className="text-zinc-500">origin:</span>{' '}
                    <span className="font-mono">{p.origin}</span>
                    {p.sourceUrl && (
                      <>
                        {' · '}
                        <span className="text-zinc-500">source:</span>{' '}
                        <span className="font-mono">{p.sourceUrl}</span>
                      </>
                    )}
                  </div>
                  <details className="mt-1 text-xs text-zinc-500">
                    <summary className="cursor-pointer select-none">
                      已接受的 capability ·{' '}
                      {Array.isArray(p.acceptedCapabilities)
                        ? p.acceptedCapabilities.length
                        : 0}
                    </summary>
                    <ul className="mt-1 list-disc pl-5 font-mono">
                      {Array.isArray(p.acceptedCapabilities)
                        ? p.acceptedCapabilities.map((c) => (
                            <li key={String(c)}>{String(c)}</li>
                          ))
                        : null}
                    </ul>
                  </details>
                </div>
                {p.status === 'enabled' && (
                  <form action={uninstallAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700"
                    >
                      卸载
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewMode ? (
        <PreviewBlock
          manifestJson={sp.manifest!}
          sourceUrl={sp.sourceUrl ?? ''}
        />
      ) : (
        <PasteForm />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'enabled'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'disabled'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-zinc-100 text-zinc-500';
  const label =
    status === 'enabled' ? '启用' : status === 'disabled' ? '禁用' : '已卸载';
  return <span className={'rounded px-1.5 py-0.5 ' + cls}>{label}</span>;
}

function PasteForm() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-zinc-900">
        粘贴安装 / Paste manifest
      </h2>
      <p className="mb-3 text-xs text-zinc-500">
        粘贴 plugin manifest JSON。下一步会显示该 plugin 申请的
        capability，由你勾选后再 install。
      </p>
      {/* GET form: manifest payload lands in ?manifest=... so the
       Server Component below renders the preview block. */}
      <form
        method="GET"
        action="/settings/plugins"
        className="grid grid-cols-1 gap-3 text-sm"
      >
        <div>
          <label className="mb-1 block text-xs text-zinc-600">
            manifest JSON
          </label>
          <textarea
            name="manifest"
            required
            rows={10}
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            placeholder='{"$schema":"...","type":"agent","id":"...","version":"0.1.0","name":{"zh":"…","en":"…"},"requiredCapabilities":["block.read"],"agentKind":"custom","entryPoint":"./agent.ts"}'
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-600">
            源 URL（可选；https-only git URL；不填走 origin=local-path）
          </label>
          <input
            name="sourceUrl"
            type="text"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
            placeholder="https://github.com/foo/bar-plugin"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
        >
          预览
        </button>
      </form>
    </section>
  );
}

function PreviewBlock({
  manifestJson,
  sourceUrl,
}: {
  manifestJson: string;
  sourceUrl: string;
}) {
  const verdict = previewManifest(manifestJson);
  if (!verdict.ok) {
    return (
      <section className="rounded-md border border-red-300 bg-red-50 p-4">
        <h2 className="mb-2 text-sm font-medium text-red-900">
          manifest 无效 · Invalid manifest
        </h2>
        <p className="text-sm text-red-800">
          原因：<span className="font-mono">{verdict.reason}</span>
        </p>
        <p className="mt-1 break-all text-xs text-red-700">{verdict.detail}</p>
        <Link
          href="/settings/plugins"
          className="mt-3 inline-block text-xs text-red-900 underline"
        >
          ← 重新粘贴
        </Link>
      </section>
    );
  }
  const { manifest, capabilityPrompt, hostPlatform, warnings } = verdict.preview;
  const m = manifest;
  const title = m.title.zh || m.title.en || m.id;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-900">
        Capability 申请 · Capability prompt
      </h2>
      <dl className="mb-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-zinc-500">id</dt>
        <dd className="font-mono">{m.id}</dd>
        <dt className="text-zinc-500">type</dt>
        <dd className="font-mono">{m.type}</dd>
        <dt className="text-zinc-500">version</dt>
        <dd className="font-mono">{m.version}</dd>
        <dt className="text-zinc-500">title</dt>
        <dd>{title}</dd>
        <dt className="text-zinc-500">host platform</dt>
        <dd className="font-mono">{hostPlatform}</dd>
      </dl>

      {warnings.length > 0 && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <div className="font-medium">解析警告 · Parser warnings</div>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={confirmInstallAction} className="space-y-3 text-sm">
        <input type="hidden" name="manifestJson" value={manifestJson} />
        <input type="hidden" name="sourceUrl" value={sourceUrl} />

        <p className="text-xs text-zinc-600">
          下面 {capabilityPrompt.length} 个 capability 是 plugin 声明需要的。
          默认全部勾选；取消勾选 = 拒绝；不在 manifest 里的不能加。
        </p>
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
          {capabilityPrompt.map((row) => (
            <li
              key={row.capability}
              className="flex items-start gap-3 px-3 py-2"
            >
              <input
                type="checkbox"
                name="acceptedCapabilities"
                value={row.capability}
                defaultChecked
                className="mt-0.5"
                id={`cap-${row.capability}`}
              />
              <label
                htmlFor={`cap-${row.capability}`}
                className="flex-1 text-sm"
              >
                <span className="font-mono text-xs text-zinc-700">
                  {row.capability}
                </span>
                {row.requiredForCore && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                    核心
                  </span>
                )}
                <p className="mt-0.5 text-xs text-zinc-600">
                  {row.explanation.zh} · {row.explanation.en}
                </p>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
          >
            确认安装
          </button>
          <Link
            href="/settings/plugins"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            取消
          </Link>
        </div>
      </form>
    </section>
  );
}

async function confirmInstallAction(formData: FormData): Promise<void> {
  'use server';
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('no-principal');

  const manifestJson = String(formData.get('manifestJson') ?? '');
  const sourceUrlRaw = String(formData.get('sourceUrl') ?? '').trim();
  const sourceUrl = sourceUrlRaw.length > 0 ? sourceUrlRaw : null;
  const requestedCaps = formData.getAll('acceptedCapabilities').map(String);

  const verdict = previewManifest(manifestJson);
  if (!verdict.ok) {
    redirect(
      `/settings/plugins?error=${encodeURIComponent(`manifest invalid: ${verdict.detail}`)}`,
    );
  }
  const accepted = filterAcceptedCapabilities(
    verdict.preview.manifest,
    requestedCaps,
  ) as Capability[];

  let payload;
  try {
    payload = buildInstallRowPayload({
      manifest: verdict.preview.manifest,
      origin: sourceUrl ? 'git-url' : 'local-path',
      sourceUrl,
      installedBy: principalId,
      installPath: `/var/lib/collab/plugins/${verdict.preview.manifest.id}`,
      bundleBytes: new TextEncoder().encode(manifestJson),
      acceptedCapabilities: accepted,
      sandboxPlatform: verdict.preview.hostPlatform,
      nodeBinaryPath: '/usr/bin/node',
      nodeModulesPath: `/var/lib/collab/plugins/${verdict.preview.manifest.id}/node_modules`,
    });
  } catch (err) {
    if (err instanceof InstallRejectedError) {
      redirect(
        `/settings/plugins?error=${encodeURIComponent(`install rejected (${err.code}): ${err.message}`)}`,
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
  revalidatePath('/settings/plugins');
  redirect('/settings/plugins');
}

async function uninstallAction(formData: FormData): Promise<void> {
  'use server';
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('no-principal');

  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const db = getDb();
  await db
    .update(schema.pluginInstall)
    .set({ status: 'uninstalled', archivedAt: new Date() })
    .where(
      and(
        eq(schema.pluginInstall.id, id),
        eq(schema.pluginInstall.installedBy, principalId),
      ),
    );
  revalidatePath('/settings/plugins');
}
