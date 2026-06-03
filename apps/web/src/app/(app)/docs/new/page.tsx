import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { v7 as uuidv7 } from 'uuid';

import { schema } from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  materialiseRoleBundle,
} from '@collaborationtool/permissions';

import {
  Button,
  Field,
  PageHeader,
  PageShell,
  Select,
  TextInput,
} from '@/components/design';
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
    <PageShell width="prose">
      <PageHeader title="新建文档" titleEn="New document" />

      <form action={createDocument} className="flex flex-col gap-5">
        <ErrorBanner searchParams={searchParams} />

        <Field label="标题 / Title" htmlFor="title" required>
          <TextInput
            id="title"
            name="title"
            tone="serif"
            required
            maxLength={200}
            placeholder="例如：跨语种论文协作系统"
          />
        </Field>

        <Field label="主语言 / Primary language" htmlFor="language">
          <Select id="language" name="language" defaultValue="zh-Hans">
            <option value="zh-Hans">中文（简体） · zh-Hans</option>
            <option value="zh-Hant">中文（繁体） · zh-Hant</option>
            <option value="en">English · en</option>
          </Select>
        </Field>

        <Field label="双语模式 / Bilingual mode" htmlFor="bilingualMode">
          <Select id="bilingualMode" name="bilingualMode" defaultValue="mono">
            <option value="mono">单一语言 / mono</option>
            <option value="parallel">中英对照 / parallel</option>
            <option value="mixed">中英混排 / mixed</option>
          </Select>
        </Field>

        <fieldset className="template-fieldset">
          <legend className="label-cap">起手模板 / Starter template</legend>
          <div className="flex flex-col gap-2">
            {DOC_TEMPLATES.map((tpl, idx) => (
              <label key={tpl.id} className="template-option">
                <input
                  type="radio"
                  name="template"
                  value={tpl.id}
                  defaultChecked={idx === 0}
                  className="template-radio"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="template-option-label">{tpl.label}</span>
                  <span className="template-option-desc">{tpl.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button variant="primary" type="submit" className="self-start">
          创建 · Create
        </Button>
      </form>
    </PageShell>
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
    <p className="form-banner-error" role="alert">
      {error === 'title-required' ? '请填写标题 · Title is required.' : `Error: ${error}`}
    </p>
  );
}
