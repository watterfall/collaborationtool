// Phase 4 W8.2 · Design.md §6.5 — read-only specimen quote shown to the
// right of the auth form. Visual anchor only: no interaction, no
// scroll capture. Content excerpted from public/demo/specimen-bilingual.md
// §1 (Introduction · 引言) + §3 byline so first-time visitors see the
// editor's bilingual + math typography intent before they sign in.

export default function SpecimenQuote() {
  return (
    <div
      className="flex w-full items-center justify-center px-12 py-16"
      data-testid="specimen-quote"
    >
      <article
        className="flex w-full max-w-[420px] flex-col gap-6"
        aria-label="Specimen excerpt"
      >
        <p className="label-cap" data-testid="specimen-eyebrow">
          § 1 · Introduction · 引言
        </p>

        <h3
          className="font-serif font-medium"
          style={{
            fontSize: '20px',
            lineHeight: 1.35,
            color: 'var(--color-ink)',
          }}
        >
          协作论文平台{' '}
          <span
            className="italic"
            style={{ color: 'var(--color-ink-2)', fontWeight: 400 }}
          >
            · Collaboration Tool
          </span>
        </h3>

        <p
          className="font-serif"
          style={{
            fontSize: '17px',
            lineHeight: 1.78,
            color: 'var(--color-ink)',
          }}
          data-testid="specimen-paragraph-zh"
        >
          本文介绍了 Phase 1
          的协作论文平台原型，把文档建模为<em>异构内容图</em>：Y.Doc CRDT
          承载可编辑树，Postgres 承载引用图与来源链。
        </p>

        <p
          className="font-serif"
          style={{
            fontSize: '17px',
            lineHeight: 1.7,
            color: 'var(--color-ink)',
          }}
          data-testid="specimen-paragraph-en"
        >
          We present a Phase 1 paper authoring platform that treats the
          document as a heterogeneous content graph rather than a flat
          token stream — pairing human authors with AI agents under a
          single capability model.
        </p>

        {/* Inline equation block — KaTeX-shaped specimen, rendered as
            mono text since this is a read-only thumbnail. */}
        <div
          className="font-mono"
          style={{
            background: 'var(--color-paper)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-1)',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'var(--color-ink-2)',
          }}
          data-testid="specimen-equation"
        >
          ρ(t) = (1 / Z(β)) · exp(−β · H(t))
        </div>

        <hr className="rule" />

        <footer
          className="flex flex-col gap-1 font-sans"
          style={{
            fontSize: '11px',
            lineHeight: 1.45,
            color: 'var(--color-ink-3)',
          }}
          data-testid="specimen-byline"
        >
          <span>
            Y. Wong · 王宇辰 · ORCID{' '}
            <span className="font-mono">0000-0002-1825-0097</span>
          </span>
          <span>2026-04-12 · two-author specimen · Phase 1</span>
        </footer>
      </article>
    </div>
  );
}
