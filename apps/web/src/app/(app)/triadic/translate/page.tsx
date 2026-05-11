// Wave D-4 — /triadic/translate (Bridge surface, Bridge-builder role).
//
// Skeleton: lists the 4 Bridge atomic units with descriptions, shows an
// empty-state for "your Bridge artifacts", and highlights that failed
// Bridge work (not-formalizable hypothesis / broken analogy) is itself
// first-class output — anti-publication-bias.
//
// SoT for the 4 kinds is `@collaborationtool/bridge-layer` —
// BRIDGE_ARTIFACT_KINDS.

import { BRIDGE_ARTIFACT_KINDS } from '@collaborationtool/bridge-layer';

import { HairlineRule, MonoDisc, StatusPill } from '@/components/design';

interface BridgeKindCopy {
  zh: string;
  en: string;
  intentZh: string;
}

const KIND_COPY: Record<string, BridgeKindCopy> = {
  'concept-prototype': {
    zh: '概念验证',
    en: 'Concept Prototype',
    intentZh:
      '最小可演示物：notebook / 5-min demo video / 小开放数据集。声明 demonstrationClaim + 标 maturity 4 档。',
  },
  'design-fiction': {
    zh: '设计虚构',
    en: 'Design Fiction',
    intentZh:
      'speculative / cautionary / parodic / counterfactual 4 种立场；必须显式列出"要暴露的假设"。',
  },
  'hypothesis-formalization': {
    zh: '假设形式化',
    en: 'Hypothesis Formalization',
    intentZh:
      '把 Night 隐喻 / 想法形式化为 testable claim + 4 类 variable + falsification condition。outcome 含 not-formalizable —— 失败是产出。',
  },
  'analogy-mapping': {
    zh: '类比映射',
    en: 'Analogy Mapping',
    intentZh:
      'Gentner 结构映射：列 mapped relations + 已知反类比；validationStatus 含 broken —— 反例本身有价值。',
  },
};

export default function TranslatePage() {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex items-baseline gap-3">
        <MonoDisc kind="human" monogram="B" size="md" />
        <h2
          className="font-serif"
          style={{
            color: 'var(--color-ink)',
            fontSize: '30px',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          <span lang="zh">桥接转化</span>
          <span aria-hidden="true"> · </span>
          <span lang="en" style={{ fontStyle: 'italic' }}>
            Bridge Translation
          </span>
        </h2>
        <StatusPill
          status="proposed"
          label="Wave D-4 骨架"
          labelEn="Wave D-4 skeleton"
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
        Bridge 默认 <strong>collaborator visibility</strong> —— Bridge 的全部意义就是让协作者能读到。Iteration 3 漏掉的层；Iteration 4 让它 first-class。
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
        Bridge defaults to <strong>collaborator</strong> visibility — the
        whole point of a Bridge artifact is to be readable by collaborators.
        Iteration 3 missed this layer; Iteration 4 makes it first-class.
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
          <span lang="zh">四类 Bridge 原子单元</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Four Bridge atomic units</span>
        </h3>
        <ul className="flex flex-col">
          {BRIDGE_ARTIFACT_KINDS.map((kind, idx) => {
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
        aria-labelledby="your-bridge-heading"
        className="flex flex-col gap-3"
      >
        <h3
          id="your-bridge-heading"
          className="font-sans uppercase"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '10px',
            letterSpacing: '0.18em',
          }}
        >
          <span lang="zh">你的 Bridge artifacts</span>
          <span aria-hidden="true"> · </span>
          <span lang="en">Your Bridge artifacts</span>
        </h3>
        <p
          className="font-serif"
          style={{
            color: 'var(--color-ink-3)',
            fontSize: '15px',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}
        >
          <span lang="zh">
            空。Wave D-5 dogfood gate target —— jili 30 天 ≥ 10 Bridge artifact，含至少 1 个 not-formalizable / broken 失败案例。
          </span>
          <br />
          <span lang="en">
            Empty. Wave D-5 target: ≥ 10 Bridge artifacts in 30 days,
            including ≥ 1 not-formalizable / broken failure case.
          </span>
        </p>
      </section>
    </article>
  );
}
