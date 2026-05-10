// Phase 4 W2 ADR-0013 BYO model settings UI.
//
// User manages their user_model_pref rows here. The 4-tier resolver
// (document-override > user-pref > manifest-hint > env-default) reads
// these at agent invoke time. ENV-default fallback is shown read-only.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';

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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-medium">模型 · Models</h1>
        <p className="mt-1 text-sm text-zinc-500">
          自带 LLM endpoint。优先级 document-override &gt; user-pref &gt;
          manifest-hint &gt; env-default（详见 ADR-0013）。
        </p>
      </header>

      <section className="mb-8 rounded-md border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-900">环境兜底 / Env default</h2>
        <p className="mt-1 text-xs text-zinc-500">
          没有 user-pref 命中时使用。
        </p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <div>
            <span className="font-mono text-xs text-zinc-700">anthropic</span>
            <span className="ml-2 text-zinc-500">claude-sonnet-4-6</span>
          </div>
          <span
            className={
              'rounded px-1.5 py-0.5 text-xs ' +
              (anthropicEnvSet
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-zinc-100 text-zinc-500')
            }
          >
            {anthropicEnvSet ? 'ANTHROPIC_API_KEY 已配置' : '走 mock runner'}
          </span>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-900">我的偏好 / My prefs</h2>
        {prefs.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            还没有自带模型偏好。下面的表单可加一个。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
            {prefs.map((p) => {
              const apiKeyOk = isEnvVarSet(p.apiKeyEnvVar);
              return (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-700">
                        {p.wireFormat}
                      </span>
                      <span className="text-sm font-medium text-zinc-900">
                        {p.providerId}
                      </span>
                      {p.label && (
                        <span className="text-zinc-500">{p.label}</span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-y-0.5 text-xs text-zinc-600 sm:grid-cols-2">
                      <span>
                        <span className="text-zinc-500">model:</span>{' '}
                        <span className="font-mono">{p.modelId}</span>
                      </span>
                      {p.endpointUrl && (
                        <span>
                          <span className="text-zinc-500">endpoint:</span>{' '}
                          <span className="font-mono">{p.endpointUrl}</span>
                        </span>
                      )}
                      {p.apiKeyEnvVar && (
                        <span>
                          <span className="text-zinc-500">api-key env:</span>{' '}
                          <span
                            className={
                              'font-mono ' +
                              (apiKeyOk ? 'text-emerald-700' : 'text-amber-700')
                            }
                          >
                            {p.apiKeyEnvVar}
                            {apiKeyOk ? ' ✓' : ' ⚠ 未设'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={deletePrefAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700"
                    >
                      删除
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-900">
          添加偏好 / Add pref
        </h2>
        <form action={createPrefAction} className="grid grid-cols-1 gap-3 text-sm">
          <Field label="provider id" name="providerId" required placeholder="my-anthropic" />
          <div>
            <label className="mb-1 block text-xs text-zinc-600">
              wire format
            </label>
            <select
              name="wireFormat"
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
              defaultValue="anthropic"
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
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
          >
            添加
          </button>
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
      <label className="mb-1 block text-xs text-zinc-600">{label}</label>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
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
