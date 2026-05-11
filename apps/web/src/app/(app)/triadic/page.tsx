// Wave D-4 — /triadic overview surface.
//
// Lists the 3 layers (Night / Bridge / Day) as equal-prominent hairline
// sections + the 4 roles as cross-cutting accents. No data fetching;
// this is a skeleton page that explains the model and points to the
// per-layer surfaces. Real artifact lists land in Wave D-5 dogfood.
//
// Design.md compliance:
//   - hairline list rows, not filled cards (reject §11.6)
//   - accent triad used at most once per surface (one accent ink for
//     Night, one ox for Bridge, one moss for Day — never together)
//   - 双语 labels everywhere (§3.4)

import Link from 'next/link';

import {
  NIGHT_ARTIFACT_KINDS,
  ROLES,
  ROLE_LABELS_ZH,
  ROLE_LABELS_EN,
  MODE_TAGS,
} from '@collaborationtool/discovery-graph';
import { BRIDGE_ARTIFACT_KINDS } from '@collaborationtool/bridge-layer';

import { HairlineRule } from '@/components/design';

interface LayerSection {
  layer: 'night' | 'bridge' | 'day';
  zh: string;
  en: string;
  surfaceHref: string;
  intentZh: string;
  intentEn: string;
  atomicUnits: ReadonlyArray<string>;
  accentVar: string;
}

const LAYERS: ReadonlyArray<LayerSection> = [
  {
    layer: 'night',
    zh: 'Night · 夜科学（生成 / 发散）',
    en: 'Night — generative / divergent',
    surfaceHref: '/triadic/discover',
    intentZh:
      '草图、隐喻、矛盾、思想实验、问题 —— 容许未完成；负能力是默认。',
    intentEn:
      'Sketches, metaphors, contradictions, thought experiments, questions — incompleteness allowed; negative capability is the default.',
    atomicUnits: NIGHT_ARTIFACT_KINDS,
    accentVar: 'var(--color-accent-ink)',
  },
  {
    layer: 'bridge',
    zh: 'Bridge · 桥接（转化 / 翻译）',
    en: 'Bridge — translation / formalization',
    surfaceHref: '/triadic/translate',
    intentZh:
      '概念验证、设计虚构、假设形式化、类比映射 —— 写作即思考；Bridge 失败也是 first-class 产出。',
    intentEn:
      'Concept prototypes, design fictions, hypothesis formalizations, analogy mappings — writing is thinking; failed Bridge work is itself a first-class output.',
    atomicUnits: BRIDGE_ARTIFACT_KINDS,
    accentVar: 'var(--color-accent-ox)',
  },
  {
    layer: 'day',
    zh: 'Day · 日科学（验证 / 收敛）',
    en: 'Day — validation / convergent',
    surfaceHref: '/triadic/manuscript',
    intentZh: '论文、代码、政策 —— 批判性、风险削减、形式化、可被引用。',
    intentEn:
      'Papers, code, policy — critical, risk-reducing, formal, citable.',
    atomicUnits: ['claim', 'evidence', 'manuscript', 'code', 'data'] as const,
    accentVar: 'var(--color-accent-moss)',
  },
];

export default function TriadicOverview() {
  return (
    <article className="flex flex-col gap-10">
      {/* Three layers — equal-prominent hairline blocks */}
      <section aria-labelledby="layers-heading" className="flex flex-col gap-8">
        <h2
          id="layers-heading"
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '20px',
            lineHeight: 1.35,
          }}
        >
          <span lang="zh">三层产出 · 等价</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Three layers — equal weight
          </span>
        </h2>
        {LAYERS.map((layer, idx) => (
          <div key={layer.layer} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className="font-mono"
                style={{
                  color: layer.accentVar,
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontFeatureSettings: "'onum' 1",
                }}
              >
                {`§ ${idx + 1}`}
              </span>
              <h3
                className="font-serif"
                style={{
                  color: 'var(--color-ink)',
                  fontSize: '20px',
                  lineHeight: 1.35,
                }}
              >
                <span lang="zh">{layer.zh}</span>
              </h3>
              <Link
                href={layer.surfaceHref}
                className="ml-auto font-sans underline-offset-4 hover:underline"
                style={{
                  color: layer.accentVar,
                  fontSize: '13px',
                }}
              >
                <span lang="zh">进入 →</span>
                <span aria-hidden="true"> · </span>
                <span lang="en">Open →</span>
              </Link>
            </div>
            <p
              className="font-serif"
              style={{
                color: 'var(--color-ink-2)',
                fontSize: '17px',
                lineHeight: 1.78,
              }}
              lang="zh"
            >
              {layer.intentZh}
            </p>
            <p
              className="font-serif"
              style={{
                color: 'var(--color-ink-3)',
                fontSize: '15px',
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
              lang="en"
            >
              {layer.intentEn}
            </p>
            <ul
              className="flex flex-wrap gap-x-3 gap-y-1 font-mono"
              style={{
                color: 'var(--color-ink-3)',
                fontSize: '11px',
                letterSpacing: '0.02em',
              }}
            >
              {layer.atomicUnits.map((k) => (
                <li key={k}>· {k}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <HairlineRule weight="thick" />

      {/* Roles — the orthogonal cut */}
      <section aria-labelledby="roles-heading" className="flex flex-col gap-3">
        <h2
          id="roles-heading"
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '20px',
            lineHeight: 1.35,
          }}
        >
          <span lang="zh">四个角色（可同时担任）</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Four roles (concurrent)
          </span>
        </h2>
        <p
          className="font-serif"
          style={{
            color: 'var(--color-ink-2)',
            fontSize: '15px',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}
        >
          <span lang="zh">角色是 default surface 偏好，不是 RBAC。</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">
            Roles are default-surface preferences, not access controls.
          </span>
        </p>
        <ul className="flex flex-col">
          {ROLES.map((r, idx) => (
            <li
              key={r}
              className="flex items-baseline gap-3 py-2"
              style={{
                borderTop:
                  idx === 0 ? '1px solid var(--color-hairline)' : 'none',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <span
                className="font-mono"
                style={{
                  color: 'var(--color-ink-3)',
                  fontSize: '11px',
                  width: '2.5rem',
                  fontFeatureSettings: "'onum' 1",
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span
                className="font-serif"
                style={{ color: 'var(--color-ink)', fontSize: '17px' }}
                lang="zh"
              >
                {ROLE_LABELS_ZH[r]}
              </span>
              <span
                className="font-serif"
                style={{
                  color: 'var(--color-ink-2)',
                  fontSize: '15px',
                  fontStyle: 'italic',
                }}
                lang="en"
              >
                {ROLE_LABELS_EN[r]}
              </span>
              <span
                className="ml-auto font-mono"
                style={{
                  color: 'var(--color-ink-3)',
                  fontSize: '11px',
                }}
              >
                role:{r}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <HairlineRule weight="thick" />

      {/* 5 mode tags */}
      <section
        aria-labelledby="modes-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="modes-heading"
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '20px',
            lineHeight: 1.35,
          }}
        >
          <span lang="zh">五种创意触发模式（可标 0-3 个）</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Five creative trigger modes (0–3 per artifact)
          </span>
        </h2>
        <ul
          className="flex flex-wrap gap-x-4 gap-y-2 font-mono"
          style={{
            color: 'var(--color-ink-2)',
            fontSize: '13px',
            letterSpacing: '0.02em',
          }}
        >
          {MODE_TAGS.map((m) => (
            <li key={m}>· mode:{m}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
