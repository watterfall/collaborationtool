// Phase 4 W2 ADR-0013 BYO model settings UI.
//
// User manages their user_model_pref rows here. The 4-tier resolver
// (document-override > user-pref > manifest-hint > env-default) reads
// these at agent invoke time. ENV-default fallback is shown read-only.
//
// Phase 4 W10.7 — Design.md §11 reject criteria sweep: replaced
// `bg-emerald-100` env-status banner + `bg-zinc-100` mono labels with
// StatusPill + editorial mono spans; submit / delete buttons go through
// the SoT `<Button>` (variant=primary | ghost). Hairline list dividers
// instead of filled cards.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

import { Button, HairlineRule, StatusPill } from '@/components/design';
import { auth } from '@/lib/auth';
import {
  WIRE_FORMAT_DEFAULTS,
  WIRE_FORMATS,
  isEnvVarSet,
  validateModelPrefInput,
  type WireFormat,
} from '@/lib/byo-model';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  lineHeight: 1.55,
  padding: '8px 10px',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--radius-1)',
};

const MONO_TAG_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: 'var(--color-accent-ink)',
  borderRight: '1px solid var(--color-hairline)',
  paddingRight: '8px',
};

const WIRE_FORMAT_LABEL: Record<WireFormat, string> = {
  anthropic: 'Anthropic（官方 SDK）',
  'openai-compat': 'OpenAI 兼容（OpenAI / OpenRouter / vLLM / DeepSeek 等）',
  ollama: 'Ollama（本地模型）',
  'custom-http': '自定义 HTTP',
};

export default async function ModelsSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) {
    throw new Error(
      `No Principal row for user ${session.user.id}. Run principal-bridge.`,
    );
  }

  const db = getDb();
  const prefs = await db
    .select()
    .from(schema.userModelPref)
    .where(eq(schema.userModelPref.principalId, principalId));

  const anthropicEnvSet = isEnvVarSet('ANTHROPIC_API_KEY');

  return (
    <div
      className="mx-auto max-w-4xl px-6 py-10"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <header className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '30px',
            fontWeight: 500,
            letterSpacing: '-0.005em',
          }}
        >
          模型 · Models
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--color-ink-3)',
            marginTop: '6px',
          }}
        >
          自带 LLM endpoint · 优先级 document-override &gt; user-pref &gt;
          manifest-hint &gt; env-default（详见 ADR-0013）
        </p>
        <HairlineRule weight="thick" className="mt-3" />
      </header>

      <section className="mb-8">
        <div
          className="label-cap"
          style={{ color: 'var(--color-ink-3)', marginBottom: '8px' }}
        >
          ENV DEFAULT · 环境兜底
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
            fontSize: '13px',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--color-accent-ink)',
              }}
            >
              anthropic
            </span>
            <span
              style={{
                marginLeft: '10px',
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                color: 'var(--color-ink-2)',
              }}
            >
              claude-sonnet-4-6
            </span>
          </div>
          <StatusPill
            status={anthropicEnvSet ? 'applied' : 'proposed'}
            label={anthropicEnvSet ? 'ANTHROPIC_API_KEY 已配置' : '走 mock runner'}
            labelEn={anthropicEnvSet ? 'API key set' : 'Mock runner'}
          />
        </div>
      </section>

      <section className="mb-8">
        <div
          className="label-cap"
          style={{ color: 'var(--color-ink-3)', marginBottom: '8px' }}
        >
          MY PREFS · 我的偏好
        </div>
        {prefs.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--color-ink-3)',
              padding: '20px 0',
              borderTop: '1px solid var(--color-hairline)',
              borderBottom: '1px solid var(--color-hairline)',
              textAlign: 'center',
            }}
          >
            还没有自带模型偏好 · No preferences yet — add one below.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              borderTop: '1px solid var(--color-hairline)',
            }}
          >
            {prefs.map((p) => {
              const apiKeyOk = isEnvVarSet(p.apiKeyEnvVar);
              return (
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={MONO_TAG_STYLE}>{p.wireFormat}</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '15px',
                          fontWeight: 500,
                          color: 'var(--color-ink)',
                        }}
                      >
                        {p.providerId}
                      </span>
                      {p.label && (
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px',
                            color: 'var(--color-ink-3)',
                            fontStyle: 'italic',
                          }}
                        >
                          {p.label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: '4px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '2px 12px',
                        fontSize: '12px',
                        color: 'var(--color-ink-2)',
                      }}
                    >
                      <span>
                        <span style={{ color: 'var(--color-ink-3)' }}>
                          model:
                        </span>{' '}
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {p.modelId}
                        </span>
                      </span>
                      {p.endpointUrl && (
                        <span>
                          <span style={{ color: 'var(--color-ink-3)' }}>
                            endpoint:
                          </span>{' '}
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            {p.endpointUrl}
                          </span>
                        </span>
                      )}
                      {p.apiKeyEnvVar && (
                        <span>
                          <span style={{ color: 'var(--color-ink-3)' }}>
                            api-key env:
                          </span>{' '}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: apiKeyOk
                                ? 'var(--color-accent-moss)'
                                : 'var(--color-accent-ox)',
                            }}
                          >
                            {p.apiKeyEnvVar}
                            {apiKeyOk ? ' ✓' : ' · 未设'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={deletePrefAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      删除 · Delete
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        style={{
          background: 'var(--color-paper-2)',
          border: '1px solid var(--color-hairline)',
          padding: '20px 22px',
        }}
      >
        <div
          className="label-cap"
          style={{ color: 'var(--color-ink-3)', marginBottom: '12px' }}
        >
          ADD PREF · 添加偏好
        </div>
        <form
          action={createPrefAction}
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}
        >
          <Field label="provider id" name="providerId" required placeholder="my-anthropic" />
          <div>
            <label
              className="label-cap"
              style={{
                display: 'block',
                marginBottom: '6px',
                color: 'var(--color-ink-3)',
              }}
            >
              WIRE FORMAT
            </label>
            <select
              name="wireFormat"
              defaultValue="anthropic"
              style={FIELD_STYLE}
            >
              {WIRE_FORMATS.map((wf) => (
                <option key={wf} value={wf}>
                  {WIRE_FORMAT_LABEL[wf]}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="model id"
            name="modelId"
            required
            placeholder={WIRE_FORMAT_DEFAULTS.anthropic.modelId}
          />
          <Field
            label="endpoint URL（openai-compat / ollama / custom-http 必填）"
            name="endpointUrl"
            placeholder={WIRE_FORMAT_DEFAULTS['openai-compat'].endpointUrl ?? ''}
          />
          <Field
            label="API key env var（host 进程的环境变量名；密钥本身不存 PG）"
            name="apiKeyEnvVar"
            placeholder="ANTHROPIC_API_KEY"
          />
          <Field label="label（可选；UI 显示用）" name="label" />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            className="self-start"
          >
            添加 · Add
          </Button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="label-cap"
        style={{
          display: 'block',
          marginBottom: '6px',
          color: 'var(--color-ink-3)',
        }}
      >
        {label.toUpperCase()}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        style={FIELD_STYLE}
      />
    </div>
  );
}

async function createPrefAction(formData: FormData): Promise<void> {
  'use server';
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('no-principal');

  const raw = {
    providerId: String(formData.get('providerId') ?? ''),
    wireFormat: String(formData.get('wireFormat') ?? ''),
    modelId: String(formData.get('modelId') ?? ''),
    endpointUrl: String(formData.get('endpointUrl') ?? ''),
    apiKeyEnvVar: String(formData.get('apiKeyEnvVar') ?? ''),
    label: String(formData.get('label') ?? ''),
  };
  const verdict = validateModelPrefInput(raw);
  if (!verdict.ok) {
    // Server Action: silent reject is OK here — the API route returns
    // the verdict for callers that need to surface it. Phase 4 W2
    // closeout adds toast notifications.
    return;
  }

  const db = getDb();
  const id = uuidv7();
  const now = new Date();
  await db.insert(schema.userModelPref).values({
    id,
    principalId,
    prefKind: 'default',
    providerId: verdict.value.providerId,
    wireFormat: verdict.value.wireFormat,
    modelId: verdict.value.modelId,
    endpointUrl: verdict.value.endpointUrl,
    apiKeyEnvVar: verdict.value.apiKeyEnvVar,
    extraHeaders: verdict.value.extraHeaders,
    label: verdict.value.label,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/settings/models');
}

async function deletePrefAction(formData: FormData): Promise<void> {
  'use server';
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('no-principal');

  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const db = getDb();
  await db
    .delete(schema.userModelPref)
    .where(
      and(
        eq(schema.userModelPref.id, id),
        eq(schema.userModelPref.principalId, principalId),
      ),
    );
  revalidatePath('/settings/models');
}
