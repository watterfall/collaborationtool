// Wave D-4 — /triadic/discover (Night surface, Explorer role).
//
// Skeleton: lists the 6 Night atomic units with descriptions, shows an
// empty-state for "your Night artifacts", and explains the visibility
// default (private). No DB fetching — Wave D-5 dogfood wires real data.
//
// The 6 Night kinds + their zh prose come from the type-only
// discovery-graph package; if the schema grows a 7th kind a typecheck
// elsewhere will catch the omission (NIGHT_ARTIFACT_KINDS is the SoT).

import { NIGHT_ARTIFACT_KINDS } from '@collaborationtool/discovery-graph';

import {
  EmptyState,
  HairlineRule,
  MonoDisc,
  StatusPill,
} from '@/components/design';

interface NightKindCopy {
  zh: string;
  en: string;
  intentZh: string;
}

const KIND_COPY: Record<string, NightKindCopy> = {
  thought: {
    zh: '思考',
    en: 'Thought',
    intentZh: '自由书写、未分类的研究念头。其他 5 类不合适时的兜底。',
  },
  question: {
    zh: '问题',
    en: 'Question',
    intentZh:
      '开放问题，可被 Polymath 风格 decompose；lifecycle 含 open / contested / resolved / reopened。',
  },
  metaphor: {
    zh: '隐喻',
    en: 'Metaphor',
    intentZh:
      '把源域结构映射到目标域（Gentner 结构映射 + Koestler 双联想）。须显式记录已知反类比。',
  },
  sketch: {
    zh: '草图',
    en: 'Sketch',
    intentZh: '白板照、SVG、手写板、ASCII 图 —— 非文字载体，Bridge 之前的视觉化。',
  },
  contradiction: {
    zh: '矛盾',
    en: 'Contradiction',
    intentZh:
      'data-vs-theory / theory-vs-theory / observation-vs-observation 等 5 类；矛盾视作机遇。',
  },
  'thought-experiment': {
    zh: '思想实验',
    en: 'Thought Experiment',
    intentZh: '前提 + 多个可能 outcome + reasoning + 真实世界含义。',
  },
};

export default function DiscoverPage() {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex items-baseline gap-3">
        <MonoDisc kind="agent" monogram="N" size="md" />
        <h2
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '30px',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          <span lang="zh">夜科学探索</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Night Discovery
          </span>
        </h2>
        <StatusPill
          status="proposed"
          label="示例数据"
          labelEn="Example data · live at Wave D-5"
          className="ml-auto"
        />
      </header>

      <p
        className="font-serif"
        style={{
          color: 'var(--color-ink-2)',
          fontSize: '17px',
          lineHeight: 1.78,
        }}
        lang="zh"
      >
        Night 默认 <strong>private visibility</strong> —— 夜科学需要未被监视的空间。共享时主动 escalate 到 collaborator / org / public，不是默认共享后再撤回。
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
        Night defaults to <strong>private</strong> — night science needs space
        that isn&rsquo;t watched. Sharing escalates explicitly to collaborator
        / org / public rather than the inverse.
      </p>

      <HairlineRule />

      <section aria-labelledby="kinds-heading" className="flex flex-col gap-3">
        <h3
          id="kinds-heading"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">六类 Night 原子单元</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Six Night atomic units</span>
        </h3>
        <ul className="flex flex-col">
          {NIGHT_ARTIFACT_KINDS.map((kind, idx) => {
            const copy = KIND_COPY[kind];
            return (
              <li
                key={kind}
                className="flex flex-col gap-1 py-4"
                style={{
                  borderTop:
                    idx === 0 ? '1px solid var(--color-hairline)' : 'none',
                  borderBottom: '1px solid var(--color-hairline)',
                }}
              >
                <div className="flex items-baseline gap-3">
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
                    style={{
                      color: 'var(--color-ink)',
                      fontSize: '17px',
                    }}
                    lang="zh"
                  >
                    {copy?.zh ?? kind}
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
                    {copy?.en ?? kind}
                  </span>
                  <span
                    className="ml-auto font-mono"
                    style={{
                      color: 'var(--color-ink-3)',
                      fontSize: '11px',
                    }}
                  >
                    kind:{kind}
                  </span>
                </div>
                {copy && (
                  <p
                    className="font-serif"
                    style={{
                      color: 'var(--color-ink-2)',
                      fontSize: '15px',
                      lineHeight: 1.7,
                      paddingLeft: '3.5rem',
                    }}
                    lang="zh"
                  >
                    {copy.intentZh}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <HairlineRule />

      <section
        aria-labelledby="your-night-heading"
        className="flex flex-col gap-3"
      >
        <h3
          id="your-night-heading"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">你的 Night artifacts</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Your Night artifacts</span>
        </h3>
        {/* Curated example artifact (illustrative, not seeded live data) so
            the surface shows what a Night artifact looks like. */}
        <p className="label-cap" style={{ color: 'var(--color-ink-3)' }}>
          示例 · Example
        </p>
        <figure
          className="m-0"
          style={{
            borderLeft: '2px solid var(--color-accent-ink)',
            background: 'var(--color-accent-ink-wash)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-2)',
          }}
        >
          <figcaption
            className="label-cap"
            style={{ color: 'var(--color-accent-ink)', marginBottom: '6px' }}
          >
            矛盾观察 · contradiction
          </figcaption>
          <p
            className="font-serif"
            data-prose="bilingual"
            style={{ color: 'var(--color-ink)', fontSize: '16px', lineHeight: 1.7 }}
          >
            Google 2024 在 NISQ 上测到 0.8% 错误率，但理论极限是 1%。会不会错误率不是常数？
          </p>
          <p
            className="font-mono"
            style={{ color: 'var(--color-ink-3)', fontSize: '11px', marginTop: '6px' }}
          >
            mode:contradiction · visibility:private · → bridge:hypothesis-output
          </p>
        </figure>

        <EmptyState
          message="还没有你自己的 Night artifact · No Night artifacts of your own yet."
          messageEn="真数据在 Wave D-5 dogfood 接入（目标：30 天 ≥ 50 条）。上面是一条示例。"
        />
      </section>
    </article>
  );
}
