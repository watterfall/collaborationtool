// ProductFrame (Design.md v2 §5.9) — the abstract→concrete lever.
//
// Frames a REAL product screenshot in a raised paper "specimen mat"
// (.surface-raised = surface-1 + hairline + hard-edged --elev-lift, no blur)
// with a serif/label-cap caption and an optional in-layout provenance tick.
// Reject #16: real screenshots only — never illustrated / 3D mockups.
//
//   <ProductFrame
//     src="/screens/editor-readiness.png" alt="编辑器复现准备度面板"
//     width={1280} height={840}
//     caption="复现准备度实时打分" captionEn="Reproducibility, scored live"
//     provenanceLabel="AI · agent" provenanceKind="agent" />
//
// Colors come from tokens via classes; this file holds zero hex.

import Image from 'next/image';
import * as React from 'react';

import { cx } from '@/lib/cx';

import type { MonoDiscKind } from './MonoDisc';

export interface ProductFrameProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Primary caption (serif). */
  caption?: string;
  /** Secondary bilingual caption (smaller, ink-3). */
  captionEn?: string;
  /** Optional in-layout provenance tick (Design.md #8: in layout, not popup). */
  provenanceLabel?: string;
  provenanceKind?: MonoDiscKind;
  /** Tailwind `priority` for above-the-fold hero images. */
  priority?: boolean;
  className?: string;
}

export function ProductFrame({
  src,
  alt,
  width,
  height,
  caption,
  captionEn,
  provenanceLabel,
  provenanceKind = 'agent',
  priority,
  className,
}: ProductFrameProps) {
  return (
    <figure className={cx('product-frame', className)}>
      <div className="product-frame-mat surface-raised">
        <Image
          className="product-frame-img"
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(max-width: 768px) 100vw, 640px"
        />
        {provenanceLabel ? (
          <span className="product-frame-tick" data-kind={provenanceKind}>
            <span className="product-frame-tick-dot" aria-hidden="true" />
            <span className="label-cap">{provenanceLabel}</span>
          </span>
        ) : null}
      </div>
      {caption || captionEn ? (
        <figcaption className="product-frame-cap">
          {caption ? (
            <span className="product-frame-cap-zh">{caption}</span>
          ) : null}
          {captionEn ? (
            <span className="product-frame-cap-en">{captionEn}</span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default ProductFrame;
