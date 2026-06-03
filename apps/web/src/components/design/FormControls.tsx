// Form controls (Design.md §5 / v2) — token-driven primitives that replace
// the per-file `FIELD_STYLE` / `inputStyle()` consts copy-pasted across
// settings/models, orgs/new, settings/plugins, docs/new.
//
// Thin wrappers over the native elements: ALL native props pass through
// (name, id, required, value, defaultValue, onChange, data-testid, aria-*),
// so they work for both FormData server actions (name=) and controlled React
// forms. `tone` switches font: 'mono' (IDs/URLs, default) or 'serif' (prose).
// `invalid` sets aria-invalid + an oxblood border.
//
// Plain function components (no forwardRef) — the codebase uses native
// FormData, not refs. Zero hex — colors via globals.css `.form-control`.

import * as React from 'react';

import { cx } from '@/lib/cx';

export type FormControlTone = 'mono' | 'serif';

type CommonProps = {
  tone?: FormControlTone;
  invalid?: boolean;
};

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> &
  CommonProps;

export function TextInput({
  tone = 'mono',
  invalid,
  className,
  type = 'text',
  ...rest
}: TextInputProps) {
  return (
    <input
      type={type}
      className={cx('form-control', className)}
      data-tone={tone}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  CommonProps;

export function TextArea({
  tone = 'serif',
  invalid,
  className,
  rows = 4,
  ...rest
}: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={cx('form-control', className)}
      data-tone={tone}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  CommonProps;

export function Select({
  tone = 'mono',
  invalid,
  className,
  children,
  ...rest
}: SelectProps) {
  return (
    <select
      className={cx('form-control', 'form-control-select', className)}
      data-tone={tone}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
