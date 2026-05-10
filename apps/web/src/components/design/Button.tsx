// Editorial Button — token-driven SoT (Design.md §5.1).
//
// Three variants × three sizes, all backed by globals.css classes:
//   primary  → .btn-primary   (ink fill / paper text / 2px radius)
//   ghost    → .btn-ghost     (transparent / 1.25px pencil border / ink text)
//   link     → .btn-link      (underline 0.4em offset, no border)
//
// Sizes adjust height (28 / 36 / 44 px) and horizontal padding only —
// font / color stays on the variant so we don't multiply token paths.
//
// No third-party headless UI lib (Design.md §14). Just a polymorphic
// button/link with a11y attributes.

import * as React from 'react';

import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** When supplied as 'a', renders an anchor element instead of <button>. */
  as?: 'button' | 'a';
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  /** Bilingual a11y label — wins over children for screen readers. */
  ariaLabel?: string;
  ariaLabelEn?: string;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  link: 'btn-link',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn-size-sm',
  md: 'btn-size-md',
  lg: 'btn-size-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className,
  children,
  disabled,
  type = 'button',
  href,
  ariaLabel,
  ariaLabelEn,
  ...rest
}: ButtonProps) {
  // Bilingual aria-label is "zh · en" so screen readers in either locale
  // hear something meaningful (Design.md §3.4).
  const a11y =
    ariaLabel && ariaLabelEn
      ? `${ariaLabel} · ${ariaLabelEn}`
      : ariaLabel || ariaLabelEn;

  const classes = cx(
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    disabled && 'is-disabled',
    className,
  );

  if (as === 'a') {
    return (
      <a
        href={href}
        className={classes}
        aria-label={a11y}
        aria-disabled={disabled || undefined}
        data-variant={variant}
        data-size={size}
        {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      aria-label={a11y}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
