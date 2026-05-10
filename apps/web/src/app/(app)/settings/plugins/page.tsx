// Phase 4 W1 ADR-0012 plugin install dashboard.
//
// Lists the caller's plugin_install rows and provides the
// capability-prompt install flow.
//
// Phase 4 W8 (P4(17)) refactor:
//   1. Non-Linux UI gate. Server Component reads process.platform; on
//      darwin / win32 we render a hairline-bordered notice block and
//      disable both forms (per ADR-0012 review log option (b) — UI
//      cut-off rather than shipping a real macOS / Windows sandbox).
//   2. Two input modes — "Repository URL · 仓库 URL" and
//      "Paste JSON · 粘贴 JSON" — switched via ?mode=url|paste. The
//      URL mode replaces the old `?manifest=<JSON>` path that role-
//      user.md §2 flagged as a P0 anti-pattern. URL fetch goes
//      through fetchManifestFromGitHubUrl(): https-only, GitHub host
//      whitelist, 8 s timeout, 1 MB body cap.
//   3. Capability prompt is rendered as a Design.md §5.4 Provenance
//      card: paper bg + 1.5 px hairline + 3 sections (label-cap,
//      mono-disc + name + source/time, hairline list of capability
//      rows with bilingual descriptions).
//
// All form fields use editorial design tokens (var(--color-*)). No
// rounded-lg, no bg-zinc-*, no #3B82F6.

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
  fetchManifestFromGitHubUrl,
  filterAcceptedCapabilities,
  previewManifest,
  validateGitHubManifestUrl,
} from '@/lib/plugin-install';
import { getPrincipalIdForUser } from '@/lib/principal';

type InputMode = 'url' | 'paste';

interface PluginsSearchParams {
  mode?: string;
  manifest?: string;
  manifestUrl?: string;
  sourceUrl?: string;
  error?: string;
  errorDetail?: string;
}

export default async function PluginsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<PluginsSearchParams>;
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

  const hostPlatform = detectHostPlatform();
  const isLinux = hostPlatform === 'linux';
  const installEnabled = isLinux;
  const inputMode: InputMode = sp.mode === 'paste' ? 'paste' : 'url';

  // Fetch flow: ?mode=url + ?manifestUrl=... → server-side fetch then
  // render preview. Paste flow: ?manifest=<JSON> → render preview.
  let previewText: string | null = null;
  let previewSource: { kind: 'git-url' | 'paste'; sourceUrl: string } | null =
    null;
  let urlFetchError: { reason: string; detail: string } | null = null;

  if (sp.manifestUrl && installEnabled) {
    const verdict = await fetchManifestFromGitHubUrl(sp.manifestUrl);
    if (verdict.ok) {
      previewText = verdict.manifestText;
      previewSource = { kind: 'git-url', sourceUrl: verdict.sourceUrl };
    } else {
      urlFetchError = { reason: verdict.reason, detail: verdict.detail };
    }
  } else if (typeof sp.manifest === 'string' && sp.manifest.length > 0) {
    previewText = sp.manifest;
    previewSource = {
      kind: sp.sourceUrl ? 'git-url' : 'paste',
      sourceUrl: sp.sourceUrl ?? '',
    };
  }

  return (
    <div
      className="mx-auto max-w-4xl px-6 py-10"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <header className="mb-6">
        <h1
          className="font-serif"
          style={{
            fontSize: '30px',
            lineHeight: 1.25,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          插件 · Plugins
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--color-ink-3)',
          }}
        >
          已装第三方 plugin · capability prompt 流程（ADR-0010 / ADR-0012）
        </p>
        <hr className="rule-thick mt-3" />
      </header>

      {sp.error && <ErrorBanner message={sp.error} detail={sp.errorDetail} />}

      {!installEnabled && <PlatformNotice hostPlatform={hostPlatform} />}

      <InstalledList rows={rows} />

      {previewText !== null ? (
        <PreviewBlock
          manifestJson={previewText}
          sourceKind={previewSource!.kind}
          sourceUrl={previewSource!.sourceUrl}
          installEnabled={installEnabled}
        />
      ) : (
        <InstallForms
          inputMode={inputMode}
          installEnabled={installEnabled}
          urlError={urlFetchError}
        />
      )}
    </div>
  );
}

function ErrorBanner({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <div
      className="mb-4"
      role="alert"
      style={{
        borderLeft: '2px solid var(--color-accent-ox)',
        padding: '10px 12px',
        background: 'transparent',
      }}
    >
      <div
        className="label-cap"
        style={{ color: 'var(--color-accent-ox)', marginBottom: '4px' }}
      >
        ERROR
      </div>
      <p
        className="font-serif"
        style={{
          fontSize: '14px',
          lineHeight: 1.55,
          color: 'var(--color-ink)',
          fontStyle: 'italic',
        }}
      >
        {message}
      </p>
      {detail && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-ink-3)',
            marginTop: '4px',
            wordBreak: 'break-all',
          }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function PlatformNotice({ hostPlatform }: { hostPlatform: string }) {
  return (
    <div
      data-testid="platform-notice"
      data-host-platform={hostPlatform}
      className="mb-6"
      style={{
        borderLeft: '2px solid var(--color-accent-ox)',
        padding: '12px 14px',
        background: 'transparent',
      }}
    >
      <div
        className="label-cap"
        style={{ color: 'var(--color-accent-ox)', marginBottom: '6px' }}
      >
        PLUGIN INSTALL · 平台限制 / Platform-gated
      </div>
      <p
        className="font-serif"
        style={{
          fontSize: '15px',
          lineHeight: 1.7,
          color: 'var(--color-ink)',
          fontStyle: 'italic',
          marginBottom: '4px',
        }}
      >
        plugin install 当前仅 Linux 主机支持
        <span
          style={{
            color: 'var(--color-ink-3)',
            marginLeft: '6px',
            fontStyle: 'italic',
          }}
        >
          · plugin install is Linux-host only (detected: {hostPlatform})
        </span>
      </p>
      <p
        className="font-serif"
        style={{
          fontSize: '13.5px',
          lineHeight: 1.7,
          color: 'var(--color-ink-2)',
          fontStyle: 'italic',
          marginBottom: '4px',
        }}
      >
        macOS / Windows 沙箱在 Phase 5 路线图。当前你能：(1) 浏览已安装 plugin
        查看现状；(2) 切换到 Linux 主机或 Docker 容器试用；(3) 暂时不通过 UI 装。
      </p>
      <p
        className="font-serif"
        style={{
          fontSize: '13px',
          lineHeight: 1.65,
          color: 'var(--color-ink-2)',
          fontStyle: 'italic',
        }}
      >
        macOS / Windows sandbox descriptors land in the Phase 5 roadmap. For
        now you can (1) browse installed plugins to inspect state, (2) switch
        to a Linux host or container, or (3) hold off on UI installs.
      </p>
    </div>
  );
}

function InstalledList({
  rows,
}: {
  rows: Array<typeof schema.pluginInstall.$inferSelect>;
}) {
  return (
    <section className="mb-8">
      <div
        className="label-cap"
        style={{ color: 'var(--color-ink-3)', marginBottom: '8px' }}
      >
        INSTALLED · 已装
      </div>
      {rows.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--color-ink-3)',
            padding: '14px 0',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          还没有用户安装的 plugin。内置 plugin 由 plugins/registry.json
          管理（不显示在这里）。
        </p>
      ) : (
        <ul style={{ borderTop: '1px solid var(--color-hairline)' }}>
          {rows.map((p) => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '14px 0',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--color-ink)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-3)',
                      borderRight: '1px solid var(--color-hairline)',
                      paddingRight: '8px',
                    }}
                  >
                    {p.pluginKind}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--color-ink)',
                    }}
                  >
                    {p.pluginManifestId}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-3)',
                    }}
                  >
                    v{p.version}
                  </span>
                  <StatusPill status={p.status} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-3)',
                    }}
                  >
                    {p.installedAt
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-ink-2)',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ color: 'var(--color-ink-3)' }}>origin:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.origin}
                  </span>
                  {p.sourceUrl && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--color-ink-3)' }}>
                        source:
                      </span>{' '}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {p.sourceUrl}
                      </span>
                    </>
                  )}
                </div>
                <details
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-ink-3)',
                    marginTop: '4px',
                  }}
                >
                  <summary
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    已接受的 capability ·{' '}
                    {Array.isArray(p.acceptedCapabilities)
                      ? p.acceptedCapabilities.length
                      : 0}
                  </summary>
                  <ul
                    style={{
                      marginTop: '4px',
                      paddingLeft: '20px',
                      fontFamily: 'var(--font-mono)',
                      listStyle: 'disc',
                    }}
                  >
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
                  <button type="submit" className="btn-ghost">
                    卸载 · Uninstall
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const dataState =
    status === 'enabled'
      ? 'applied'
      : status === 'disabled'
        ? 'blocked'
        : 'proposed';
  const label =
    status === 'enabled' ? '启用' : status === 'disabled' ? '禁用' : '已卸载';
  return (
    <span className="pill" data-state={dataState}>
      {label}
    </span>
  );
}

function InstallForms({
  inputMode,
  installEnabled,
  urlError,
}: {
  inputMode: InputMode;
  installEnabled: boolean;
  urlError: { reason: string; detail: string } | null;
}) {
  return (
    <section
      data-testid="install-panel"
      data-install-enabled={installEnabled ? 'true' : 'false'}
      style={{
        background: 'var(--color-paper-2)',
        border: '1px solid var(--color-hairline)',
        padding: '20px 22px',
      }}
    >
      <div
        className="label-cap"
        style={{ color: 'var(--color-ink-3)', marginBottom: '10px' }}
      >
        NEW INSTALL · 安装 plugin
      </div>

      <ModeTabs current={inputMode} disabled={!installEnabled} />

      {urlError && (
        <div
          data-testid="url-error"
          data-error-reason={urlError.reason}
          style={{
            borderLeft: '2px solid var(--color-accent-ox)',
            padding: '8px 12px',
            marginBottom: '14px',
          }}
        >
          <div
            className="label-cap"
            style={{ color: 'var(--color-accent-ox)' }}
          >
            URL FETCH · {urlError.reason}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--color-ink-2)',
              marginTop: '4px',
              wordBreak: 'break-all',
            }}
          >
            {urlError.detail}
          </p>
        </div>
      )}

      {inputMode === 'url' ? (
        <UrlForm disabled={!installEnabled} />
      ) : (
        <PasteForm disabled={!installEnabled} />
      )}
    </section>
  );
}

function ModeTabs({
  current,
  disabled,
}: {
  current: InputMode;
  disabled: boolean;
}) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    padding: '6px 10px',
    background: 'transparent',
    color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
    borderBottom: active
      ? '1.5px solid var(--color-pencil)'
      : '1px solid transparent',
    pointerEvents: disabled ? 'none' : 'auto',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
  });
  return (
    <nav
      data-testid="mode-tabs"
      data-mode={current}
      style={{
        display: 'flex',
        gap: '14px',
        marginBottom: '14px',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <Link
        href="/settings/plugins?mode=url"
        aria-disabled={disabled}
        aria-current={current === 'url' ? 'page' : undefined}
        style={tabStyle(current === 'url')}
      >
        仓库 URL · Repository URL
      </Link>
      <Link
        href="/settings/plugins?mode=paste"
        aria-disabled={disabled}
        aria-current={current === 'paste' ? 'page' : undefined}
        style={tabStyle(current === 'paste')}
      >
        粘贴 JSON · Paste JSON
      </Link>
    </nav>
  );
}

function UrlForm({ disabled }: { disabled: boolean }) {
  return (
    <form
      method="GET"
      action="/settings/plugins"
      data-testid="url-form"
      style={{ display: 'grid', gap: '12px' }}
    >
      <input type="hidden" name="mode" value="url" />
      <div>
        <label
          className="label-cap"
          style={{ display: 'block', marginBottom: '6px' }}
        >
          GITHUB REPO URL · GITHUB 仓库 URL
        </label>
        <input
          name="manifestUrl"
          type="url"
          required
          disabled={disabled}
          placeholder="https://github.com/owner/plugin-repo"
          style={inputStyle(disabled)}
          aria-describedby="url-form-hint"
        />
        <p
          id="url-form-hint"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--color-ink-3)',
            marginTop: '6px',
            fontStyle: 'italic',
          }}
        >
          仅 https://github.com/owner/repo · 自动尝试 plugin.json /
          plugin.yaml · https only · GitHub allow-list · 8s timeout · 1 MB cap
        </p>
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={disabled}
        style={{ alignSelf: 'flex-start' }}
      >
        获取并预览 · Fetch and preview
      </button>
    </form>
  );
}

function PasteForm({ disabled }: { disabled: boolean }) {
  return (
    <form
      method="GET"
      action="/settings/plugins"
      data-testid="paste-form"
      style={{ display: 'grid', gap: '12px' }}
    >
      <input type="hidden" name="mode" value="paste" />
      <div>
        <label
          className="label-cap"
          style={{ display: 'block', marginBottom: '6px' }}
        >
          MANIFEST JSON
        </label>
        <textarea
          name="manifest"
          required
          rows={10}
          disabled={disabled}
          placeholder='{"id":"@you/agent","type":"agent","version":"0.1.0","title":{"zh":"…","en":"…"},"required_capabilities":["block.read"],"runtime":{"kernel_version":"^2.0.0","target":"node"},"kind":"custom","prompt_template":"./prompt.md","entry_point":"./agent.ts"}'
          style={{
            ...inputStyle(disabled),
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: 1.5,
            resize: 'vertical',
          }}
        />
      </div>
      <div>
        <label
          className="label-cap"
          style={{ display: 'block', marginBottom: '6px' }}
        >
          源 URL（可选） · SOURCE URL (OPTIONAL)
        </label>
        <input
          name="sourceUrl"
          type="text"
          disabled={disabled}
          placeholder="https://github.com/foo/bar-plugin"
          style={inputStyle(disabled)}
        />
      </div>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          color: 'var(--color-ink-3)',
          fontStyle: 'italic',
        }}
      >
        粘贴 plugin manifest JSON。下一步显示该 plugin 申请的 capability，
        由你勾选后再 install。
      </p>
      <button
        type="submit"
        className="btn-primary"
        disabled={disabled}
        style={{ alignSelf: 'flex-start' }}
      >
        预览 · Preview
      </button>
    </form>
  );
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: 1.55,
    padding: '8px 10px',
    background: disabled ? 'var(--color-paper-3)' : 'var(--color-paper)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-hairline)',
    borderRadius: 'var(--radius-1)',
    opacity: disabled ? 0.6 : 1,
  };
}

function PreviewBlock({
  manifestJson,
  sourceKind,
  sourceUrl,
  installEnabled,
}: {
  manifestJson: string;
  sourceKind: 'git-url' | 'paste';
  sourceUrl: string;
  installEnabled: boolean;
}) {
  const verdict = previewManifest(manifestJson);
  if (!verdict.ok) {
    return (
      <section
        data-testid="invalid-manifest"
        data-reason={verdict.reason}
        style={{
          background: 'var(--color-paper-2)',
          border: '1px solid var(--color-hairline)',
          padding: '18px 22px',
        }}
      >
        <div
          className="label-cap"
          style={{ color: 'var(--color-accent-ox)', marginBottom: '8px' }}
        >
          MANIFEST INVALID · {verdict.reason}
        </div>
        <p
          className="font-serif"
          style={{
            fontSize: '15px',
            lineHeight: 1.7,
            color: 'var(--color-ink)',
            fontStyle: 'italic',
          }}
        >
          manifest 无效 · invalid manifest
        </p>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-ink-2)',
            marginTop: '6px',
            wordBreak: 'break-all',
          }}
        >
          {verdict.detail}
        </p>
        <Link
          href="/settings/plugins"
          style={{
            display: 'inline-block',
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--color-ink)',
            borderBottom: '1px solid var(--color-pencil)',
            paddingBottom: '1px',
            textDecoration: 'none',
          }}
        >
          ← 重新输入 · Try again
        </Link>
      </section>
    );
  }
  const { manifest, capabilityPrompt, hostPlatform, warnings } =
    verdict.preview;
  const title = manifest.title.zh || manifest.title.en || manifest.id;
  const initial = (title.match(/[A-Za-z一-龥]/)?.[0] ?? '?').toUpperCase();
  const nowIso = new Date().toISOString().slice(0, 16).replace('T', ' ');

  return (
    <section
      data-testid="provenance-card"
      data-source-kind={sourceKind}
      style={{
        background: 'var(--color-paper-2)',
        border: '1.5px solid var(--color-hairline)',
        padding: '20px 22px',
      }}
    >
      {/* Section 1 — label-cap */}
      <div
        data-testid="provenance-section-1"
        className="label-cap"
        style={{ color: 'var(--color-accent-ink)', marginBottom: '12px' }}
      >
        PLUGIN INSTALL · capability request
      </div>

      {/* Section 2 — mono-disc + actor + source/time */}
      <div
        data-testid="provenance-section-2"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <span className="mono-disc" data-kind="agent">
          {initial}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-serif"
            style={{
              fontSize: '17px',
              lineHeight: 1.4,
              color: 'var(--color-ink)',
              fontWeight: 500,
            }}
          >
            {title}
            <span
              style={{
                fontStyle: 'italic',
                color: 'var(--color-ink-3)',
                fontSize: '13px',
                fontWeight: 400,
                marginLeft: '8px',
              }}
            >
              · {manifest.id} · v{manifest.version}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--color-ink-3)',
              marginTop: '4px',
            }}
          >
            <span style={{ color: 'var(--color-accent-ink)' }}>
              {sourceKind === 'git-url' ? 'git url' : 'paste'}
            </span>
            {sourceUrl && (
              <>
                {' · '}
                <span style={{ wordBreak: 'break-all' }}>{sourceUrl}</span>
              </>
            )}
            {' · '}
            <span>{nowIso}</span>
            {' · '}
            <span>host {hostPlatform}</span>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div
          data-testid="parser-warnings"
          style={{
            borderLeft: '2px solid var(--color-accent-ox)',
            padding: '8px 12px',
            marginBottom: '14px',
          }}
        >
          <div
            className="label-cap"
            style={{ color: 'var(--color-accent-ox)' }}
          >
            PARSER WARNINGS
          </div>
          <ul
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--color-ink-2)',
              marginTop: '4px',
              listStyle: 'disc',
              paddingLeft: '20px',
            }}
          >
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 3 — capability list (hairline rows) */}
      <form action={confirmInstallAction} style={{ display: 'grid', gap: '14px' }}>
        <input type="hidden" name="manifestJson" value={manifestJson} />
        <input type="hidden" name="sourceUrl" value={sourceUrl} />

        <p
          className="font-serif"
          style={{
            fontSize: '14px',
            lineHeight: 1.65,
            color: 'var(--color-ink-2)',
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          下面 {capabilityPrompt.length} 条 capability 是 plugin
          声明需要的；默认全部勾选；取消勾选 = 拒绝；不在 manifest
          里的不能加。
        </p>

        <ul
          data-testid="provenance-section-3"
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          {capabilityPrompt.map((row) => (
            <li
              key={row.capability}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <input
                type="checkbox"
                name="acceptedCapabilities"
                value={row.capability}
                defaultChecked
                disabled={!installEnabled}
                style={{ marginTop: '4px' }}
                id={`cap-${row.capability}`}
              />
              <label
                htmlFor={`cap-${row.capability}`}
                style={{ flex: 1, minWidth: 0 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--color-accent-ink)',
                    }}
                  >
                    {row.capability}
                  </span>
                  {row.requiredForCore && (
                    <span
                      className="pill"
                      data-state="blocked"
                      style={{ fontSize: '10px' }}
                    >
                      核心 · core
                    </span>
                  )}
                </div>
                <p
                  className="font-serif"
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--color-ink-2)',
                    marginTop: '3px',
                  }}
                >
                  {row.explanation.zh}
                  <span
                    style={{
                      color: 'var(--color-ink-3)',
                      fontStyle: 'italic',
                      marginLeft: '6px',
                    }}
                  >
                    · {row.explanation.en}
                  </span>
                </p>
              </label>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={!installEnabled}
          >
            确认安装 · Confirm install
          </button>
          <Link href="/settings/plugins" className="btn-ghost">
            取消 · Cancel
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

  // Server-side platform gate: even if a client crafts a POST that
  // bypasses the disabled buttons, refuse on non-Linux hosts.
  const hostPlatform = detectHostPlatform();
  if (hostPlatform !== 'linux') {
    redirect(
      `/settings/plugins?error=${encodeURIComponent(
        'install rejected: non-Linux host (Phase 5)',
      )}&errorDetail=${encodeURIComponent(`platform=${hostPlatform}`)}`,
    );
  }

  const manifestJson = String(formData.get('manifestJson') ?? '');
  const sourceUrlRaw = String(formData.get('sourceUrl') ?? '').trim();
  const sourceUrl = sourceUrlRaw.length > 0 ? sourceUrlRaw : null;
  if (sourceUrl) {
    // Re-validate so an attacker can't smuggle a non-https sourceUrl
    // via POST after the URL fetch validated it via GET.
    const v = validateGitHubManifestUrl(sourceUrl);
    if (!v.ok) {
      redirect(
        `/settings/plugins?error=${encodeURIComponent(
          `sourceUrl rejected: ${v.reason}`,
        )}&errorDetail=${encodeURIComponent(v.detail)}`,
      );
    }
  }
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
