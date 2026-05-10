import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  materialiseRoleBundle,
} from '@collaborationtool/permissions';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPrincipalIdForUser } from '@/lib/principal';
import {
  DOC_TEMPLATES,
  isDocTemplateId,
  type DocTemplateId,
} from '@/lib/doc-template';

async function createDocument(formData: FormData) {
  'use server';

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const principalId = await getPrincipalIdForUser(session.user.id);
  if (!principalId) throw new Error('Principal missing for user');

  const title = String(formData.get('title') ?? '').trim();
  const language = String(formData.get('language') ?? 'zh-Hans');
  const bilingualMode = String(formData.get('bilingualMode') ?? 'mono') as
    | 'mono'
    | 'parallel'
    | 'mixed';
  const templateRaw = String(formData.get('template') ?? 'blank');
  const templateId: DocTemplateId = isDocTemplateId(templateRaw)
    ? templateRaw
    : 'blank';

  if (!title) {
    redirect('/docs/new?error=title-required');
  }

  const db = getDb();
  const documentId = uuidv7();
  const slug = `${slugify(title)}-${documentId.slice(0, 8)}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.document).values({
      id: documentId,
      ownerPrincipalId: principalId,
      primaryLanguage: language,
      bilingualMode,
      title,
      slug,
      templateId,
    });
    // Materialise paper-author bundle for the owner so the gateway can
    // load it without an extra app-side query (ADR-0002 §2.5).
    await materialiseRoleBundle(tx, {
      documentId,
      principalId,
      roleId: 'paper-author',
      capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
    });
  });

  redirect(`/editor/${documentId}`);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'doc'
  );
}

export default function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-medium">新建文档 · New document</h1>

      <form action={createDocument} className="flex flex-col gap-4">
        <ErrorBanner searchParams={searchParams} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">标题 / Title</span>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="例如：跨语种论文协作系统"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">主语言 / Primary language</span>
          <select
            name="language"
            defaultValue="zh-Hans"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          >
            <option value="zh-Hans">中文（简体） · zh-Hans</option>
            <option value="zh-Hant">中文（繁体） · zh-Hant</option>
            <option value="en">English · en</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">双语模式 / Bilingual mode</span>
          <select
            name="bilingualMode"
            defaultValue="mono"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          >
            <option value="mono">单一语言 / mono</option>
            <option value="parallel">中英对照 / parallel</option>
            <option value="mixed">中英混排 / mixed</option>
          </select>
        </label>

        <fieldset className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-sm text-zinc-700">
            起手模板 / Starter template
          </legend>
          {DOC_TEMPLATES.map((tpl, idx) => (
            <label
              key={tpl.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 hover:bg-zinc-50 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50"
            >
              <input
                type="radio"
                name="template"
                value={tpl.id}
                defaultChecked={idx === 0}
                className="mt-1"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900">
                  {tpl.label}
                </span>
                <span className="text-xs text-zinc-600">{tpl.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          创建 / Create
        </button>
      </form>
    </div>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {error === 'title-required'
        ? '请填写标题。'
        : `Error: ${error}`}
    </p>
  );
}
