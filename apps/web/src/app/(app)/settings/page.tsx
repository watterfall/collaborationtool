// Settings hub. Phase 4 W1+W2: models + plugins.
//
// Phase 4 W10.7 — Design.md §6.5 / §11 compliance: hairline list (not a
// `rounded-md border bg-white` filled card), label-cap for caption text,
// editorial tokens throughout.

import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { HairlineRule } from '@/components/design';
import { auth } from '@/lib/auth';

interface SettingItem {
  href: string;
  title: string;
  caption: string;
}

const ITEMS: SettingItem[] = [
  {
    href: '/settings/models',
    title: '模型 · Models',
    caption:
      '自带 LLM endpoint（4 wireFormat：anthropic / openai-compat / ollama / custom-http；ADR-0013）',
  },
  {
    href: '/settings/plugins',
    title: '插件 · Plugins',
    caption:
      '已装第三方 plugin + capability prompt 装载流程（ADR-0010 / ADR-0012）',
  },
];

export default async function SettingsHubPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return (
    <div
      className="mx-auto max-w-3xl px-6 py-10"
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
          设置 · Settings
        </h1>
        <HairlineRule className="mt-3" />
      </header>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {ITEMS.map((it) => (
          <li
            key={it.href}
            style={{
              padding: '14px 0',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <Link
              href={it.href}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '17px',
                fontWeight: 500,
                color: 'var(--color-ink)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--color-pencil)',
                paddingBottom: '1px',
              }}
            >
              {it.title}
            </Link>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--color-ink-3)',
                fontStyle: 'italic',
                marginTop: '4px',
              }}
            >
              {it.caption}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
