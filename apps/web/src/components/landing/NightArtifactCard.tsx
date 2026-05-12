// NightArtifactCard — replaces /demo/landing-specimen-night.svg.
//
// 用 HTML/CSS 代替 SVG <text>：拿到真 Source Serif 4 + Source Han Serif
// CJK kerning + 真 OpenType features + 真 Tailwind tokens + 真 .label-cap /
// .rule 设计系统类。SVG 内的 <text> 元素没有这些。
//
// 编辑/杂志气质（Design.md §11 守 #2 + #12）：
//   - 笔记本页面隐喻：左 margin 红色 hairline（accent-ox 0.4 opacity）
//   - 微淡 ruled paper 横线（repeating-linear-gradient）
//   - 多 fragment 在 12-column grid 里以不同 col-span 体现 editorial 编排
//   - 内嵌一个 mini SVG sketch（error rate by device 散点曲线，真小 chart）
//   - 全 hairline border + paper-2 fragment bg + 无 shadow / rounded-lg

import * as React from 'react';

export function NightArtifactCard() {
  return (
    <article
      className="relative w-full overflow-hidden"
      style={{
        border: '1px solid var(--color-ink)',
        background: 'var(--color-paper)',
      }}
      aria-label="想点子空间一页：含矛盾观察、隐喻、问题、思想实验、约束、草图共 6 类 atomic units"
    >
      {/* left margin red rule (notebook style) */}
      <div
        aria-hidden="true"
        className="absolute top-0 bottom-0"
        style={{
          left: '46px',
          width: '0.6px',
          background: 'var(--color-accent-ox)',
          opacity: 0.45,
        }}
      />

      {/* faint ruled lines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 53px, var(--color-hairline) 53px, var(--color-hairline) 54px)',
          opacity: 0.55,
        }}
      />

      <div className="relative px-14 py-9">
        {/* Header */}
        <p className="label-cap">NIGHT · 想点子空间</p>
        <h3
          className="mt-3 font-serif text-3xl font-medium leading-[1.15]"
          style={{ color: 'var(--color-ink)' }}
          data-prose="bilingual"
        >
          notebook · 2026-03
        </h3>
        <p
          className="mt-2 font-serif text-base italic"
          style={{ color: 'var(--color-ink-2)' }}
          data-prose="bilingual"
        >
          jili / alice / bob — half-baked allowed
        </p>
        <hr className="rule my-6" />

        {/* Editorial fragment grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Contradiction (big) */}
          <NoteCard
            label="CONTRADICTION · 03-12"
            author="jili"
            className="md:col-span-7"
          >
            <p
              className="font-serif text-[15px] leading-[1.55]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              Google 测到 0.8%。理论说 ≥ 1%。
            </p>
            <p
              className="mt-1 font-serif text-[15px] italic leading-[1.55]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              理论错了？还是 device 偏离假设？
              <span
                aria-hidden="true"
                className="ml-1 font-serif text-lg not-italic"
                style={{ color: 'var(--color-accent-ox)' }}
              >
                !
              </span>
            </p>
          </NoteCard>

          {/* Marginalia next to contradiction */}
          <div className="self-end pb-2 md:col-span-5">
            <p
              className="font-serif text-[13px] italic"
              style={{ color: 'var(--color-ink-3)' }}
            >
              !!  这条最重要 ——
              <br />
              先和 alice 讨论
            </p>
          </div>

          {/* Metaphor */}
          <NoteCard
            label="METAPHOR · 03-15"
            author="alice"
            className="md:col-span-5"
          >
            <p
              className="font-serif text-base italic leading-[1.45]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              错误率像血压
            </p>
            <p
              className="mt-1 font-serif text-[13px] italic"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              不是常数 · 会调节 · 受多因素影响
            </p>
          </NoteCard>

          {/* Question list */}
          <NoteCard
            label="QUESTION · 03-18"
            author="jili"
            className="md:col-span-7"
          >
            <p
              className="font-serif text-[15px] leading-[1.55]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              如果是 device 偏离，哪个参数主导？
            </p>
            <ul className="mt-2 space-y-0.5 font-serif text-[13px]">
              <li style={{ color: 'var(--color-ink-2)' }}>·  T₁ 退相干时间？</li>
              <li style={{ color: 'var(--color-ink-2)' }}>·  串扰 xtalk？</li>
              <li
                className="italic"
                style={{ color: 'var(--color-accent-ox)' }}
              >
                ·  温漂 drift？  ← 这个没人测过
              </li>
            </ul>
          </NoteCard>

          {/* Thought experiment */}
          <NoteCard
            label="THOUGHT-EXPERIMENT · 03-22"
            author="bob"
            authorAccent="moss"
            className="md:col-span-7"
          >
            <p
              className="font-serif text-[15px] italic leading-[1.5]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              假设：把 device 调到理想极限
            </p>
            <p
              className="mt-1 font-mono text-[12px]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              T₁ = ∞ · xtalk = 0 · drift = 0
            </p>
            <p
              className="mt-1 font-serif text-[13px] italic"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              → 错误率应趋近 0 ... 真会吗？
            </p>
          </NoteCard>

          {/* Sketch — embedded mini chart */}
          <div className="md:col-span-5">
            <p className="label-cap">SKETCH · 04-05 · alice</p>
            <svg viewBox="0 0 180 96" className="mt-3 block w-full" aria-hidden="true">
              <line
                x1="6"
                y1="22"
                x2="174"
                y2="22"
                stroke="var(--color-ink)"
                strokeWidth="0.4"
              />
              <line
                x1="6"
                y1="22"
                x2="6"
                y2="78"
                stroke="var(--color-ink)"
                strokeWidth="0.4"
              />
              <text
                x="6"
                y="14"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
                fill="var(--color-ink-3)"
              >
                err %
              </text>
              <text
                x="174"
                y="92"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
                fill="var(--color-ink-3)"
                textAnchor="end"
              >
                device
              </text>
              <path
                d="M 16 65 Q 50 50 80 55 Q 110 60 140 42 Q 160 36 170 48"
                fill="none"
                stroke="var(--color-accent-ox)"
                strokeWidth="1.4"
              />
              <circle cx="32" cy="60" r="2.2" fill="var(--color-accent-ox)" />
              <circle cx="60" cy="56" r="2.2" fill="var(--color-accent-ox)" />
              <circle cx="92" cy="58" r="2.2" fill="var(--color-accent-ox)" />
              <circle cx="124" cy="45" r="2.2" fill="var(--color-accent-ox)" />
              <circle cx="158" cy="40" r="2.2" fill="var(--color-accent-ox)" />
            </svg>
            <p
              className="mt-1 font-mono text-[11px]"
              style={{ color: 'var(--color-ink-3)' }}
            >
              error rate by device — 不是常数
            </p>
          </div>

          {/* Constraint (full width) */}
          <NoteCard
            label="CONSTRAINT · 04-03"
            author="moss"
            authorAccent="moss"
            className="md:col-span-12"
          >
            <p
              className="font-serif text-[15px] leading-[1.55]"
              style={{ color: 'var(--color-ink)' }}
              data-prose="bilingual"
            >
              Shor 1995: <em>error threshold theorem</em>.
            </p>
            <p
              className="mt-1 font-serif text-[13px] italic"
              style={{ color: 'var(--color-ink-2)' }}
              data-prose="bilingual"
            >
              物理边界 ≠ practical floor。约束 device-dependent model。
            </p>
          </NoteCard>
        </div>

        <hr className="rule mt-8" />
        <p
          className="mt-3 font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          atomic units 本页有 : contradiction · metaphor · question · thought-experiment · constraint · sketch
        </p>
      </div>
    </article>
  );
}

function NoteCard({
  label,
  author,
  authorAccent = 'ox',
  className = '',
  children,
}: {
  label: string;
  author: string;
  authorAccent?: 'ox' | 'moss';
  className?: string;
  children: React.ReactNode;
}) {
  const accent =
    authorAccent === 'moss'
      ? 'var(--color-accent-moss)'
      : 'var(--color-accent-ox)';
  return (
    <article
      className={`relative px-4 py-3 ${className}`}
      style={{
        border: '1px solid var(--color-hairline)',
        background: 'var(--color-paper-2)',
      }}
    >
      <p className="label-cap">{label}</p>
      <div className="mt-2">{children}</div>
      <div className="mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '20px',
            height: '2px',
            background: accent,
          }}
        />
        <span
          className="font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          — {author}
        </span>
      </div>
    </article>
  );
}
