// BridgeArtifactCard — replaces /demo/landing-specimen-bridge.svg.
//
// 用 HTML 代替 SVG：真公式排版（serif italic + sub/sup tag）+ 真 Tailwind
// progress bar + 真 .label-cap / .rule / .rule-dashed 设计系统类。
//
// 4 sections：
//   1 · TOY MODEL — 公式 box + 假设说明
//   2 · 三个可测参数 — 水平 bar chart（prior art 成熟度 from "已知" → "首测"）
//   3 · 两个风险点 — 左 accent-ox 2px rule callout
//   4 · 测试 plan — 4 checklist items（1 项已 check）

import * as React from 'react';

export function BridgeArtifactCard() {
  return (
    <article
      className="relative w-full"
      style={{
        border: '1px solid var(--color-ink)',
        background: 'var(--color-paper)',
      }}
      aria-label="原型空间一张表：假设形式化 + 三个可测参数 + 风险 + 测试 plan"
    >
      <div className="px-10 py-9">
        {/* Header */}
        <p className="label-cap">BRIDGE · 做原型空间</p>
        <h3
          className="mt-3 font-serif text-3xl font-medium leading-[1.15]"
          style={{ color: 'var(--color-ink)' }}
          data-prose="bilingual"
        >
          device-dependent error model
        </h3>
        <p
          className="mt-2 font-serif text-base italic"
          style={{ color: 'var(--color-ink-2)' }}
          data-prose="bilingual"
        >
          假设形式化 · 2026-04-08 · jili + alice
        </p>
        <hr className="rule my-6" />

        {/* Section 1: Formula */}
        <Section number="1" label="TOY MODEL">
          <div
            className="mt-3 px-6 py-5"
            style={{
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-paper-2)',
            }}
          >
            <p
              className="text-center font-serif text-[22px] italic leading-[1.4]"
              style={{ color: 'var(--color-ink)' }}
            >
              err(t, d){'  '}={'  '}
              <em>α</em> · T<sub>1</sub>(d)<sup>−1</sup>
              {'  '}+{'  '}
              <em>β</em> · xtalk(d){'  '}+{'  '}
              <em>γ</em> · drift(t)
            </p>
            <p
              className="mt-3 text-center font-mono text-[11px]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              α, β, γ ∈ ℝ⁺  ·  d ∈ devices  ·  t ∈ time
            </p>
          </div>
          <p
            className="mt-4 font-serif text-[14px] italic leading-[1.6]"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            假设：错误率不是常数，而是 device + time 的函数。三个参数都可独立测量，可跨 device 迁移。
          </p>
        </Section>

        <hr className="rule-dashed my-7" />

        {/* Section 2: Bar chart */}
        <Section number="2" label="三个可测参数">
          <div className="mt-4 grid grid-cols-[140px_1fr_140px] items-center gap-x-5 gap-y-4">
            <BarRow
              name="T₁  退相干时间"
              widthPct={90}
              note="已有标准测法"
            />
            <BarRow
              name="xtalk  串扰"
              widthPct={60}
              note="Google 2023 基线"
            />
            <BarRow
              name="drift  温漂"
              widthPct={20}
              note="本组首测"
            />
          </div>
          <p
            className="mt-3 ml-[145px] font-mono text-[11px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            prior art 成熟度 ────────────────────────────────→
          </p>
        </Section>

        <hr className="rule-dashed my-7" />

        {/* Section 3: Risks */}
        <Section number="3" label="两个风险点">
          <div className="mt-4 space-y-4">
            <Risk
              title="α / β / γ 可能 device-coupled"
              body="→ 拟合参数无法跨 device 迁移，文章 generalize 受限。"
            />
            <Risk
              title="γ（温漂）若主导"
              body="→ 文献无 prior art 作 baseline，需自己造对照实验。"
            />
          </div>
        </Section>

        <hr className="rule-dashed my-7" />

        {/* Section 4: Checklist */}
        <Section number="4" label="测试 plan">
          <div className="mt-4 grid grid-cols-1 gap-y-2.5 font-serif text-[14px] md:grid-cols-2 md:gap-x-7">
            <CheckItem text="单 device 三参数测量 · 复现 Google baseline" />
            <CheckItem
              checked
              text="跨 3 device 拟合 α/β/γ · ✓ alice 04-15"
            />
            <CheckItem text="温漂对照实验（同 device 加热 ±20°C）" />
            <CheckItem text="如果模型成立 → 撰写论文（→ Day 层）" />
          </div>
        </Section>

        <hr className="rule mt-8" />
        <p
          className="mt-3 font-mono text-[11px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          还不是论文 · 但已经能给同行看 · ORCID-signed contribution-graph : jili (formula) + alice (testing)
        </p>
      </div>
    </article>
  );
}

function Section({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="label-cap">
        {number} · {label}
      </p>
      {children}
    </section>
  );
}

function BarRow({
  name,
  widthPct,
  note,
}: {
  name: string;
  widthPct: number;
  note: string;
}) {
  return (
    <>
      <p
        className="text-right font-serif text-[14px]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {name}
      </p>
      <div
        className="relative h-[14px]"
        style={{
          border: '0.5px solid var(--color-hairline)',
          background: 'var(--color-paper)',
        }}
      >
        <div
          className="h-full"
          style={{
            width: `${widthPct}%`,
            background: 'var(--color-accent-ink)',
            opacity: 0.55,
          }}
        />
      </div>
      <p
        className="font-mono text-[11px]"
        style={{ color: 'var(--color-ink-2)' }}
      >
        {note}
      </p>
    </>
  );
}

function Risk({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="pl-4"
      style={{ borderLeft: '2px solid var(--color-accent-ox)' }}
    >
      <p
        className="font-serif text-[15px] font-medium"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {title}
      </p>
      <p
        className="mt-1 font-serif text-[14px] italic"
        style={{ color: 'var(--color-ink-2)' }}
        data-prose="bilingual"
      >
        {body}
      </p>
    </div>
  );
}

function CheckItem({ checked = false, text }: { checked?: boolean; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-1 inline-flex h-[12px] w-[12px] shrink-0 items-center justify-center text-[10px] font-bold leading-none"
        style={{
          border: '1px solid var(--color-ink)',
          background: checked ? 'var(--color-ink)' : 'transparent',
          color: 'var(--color-paper)',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {text}
      </span>
    </div>
  );
}
