// Settings hub. Phase 4 W1+W2: models + plugins.

import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function SettingsHubPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-medium">设置 · Settings</h1>
      </header>
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
        <li className="px-4 py-3">
          <Link
            href="/settings/models"
            className="font-medium text-zinc-900 hover:underline"
          >
            模型 · Models
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500">
            自带 LLM endpoint（4 wireFormat：anthropic / openai-compat / ollama
            / custom-http；ADR-0013）
          </p>
        </li>
        <li className="px-4 py-3">
          <Link
            href="/settings/plugins"
            className="font-medium text-zinc-900 hover:underline"
          >
            插件 · Plugins
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500">
            已装第三方 plugin + capability prompt 装载流程（ADR-0010 / ADR-0012）
          </p>
        </li>
      </ul>
    </div>
  );
}
