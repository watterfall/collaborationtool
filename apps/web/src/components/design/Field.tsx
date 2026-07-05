// Field (Design.md v2 §5) — label-cap + control + optional hint/error stack.
// Replaces the duplicated local `Field` helper (settings/models) and the
// inline `<label className="label-cap">` blocks in orgs/new, settings/plugins.
//
//   <Field label="provider id" htmlFor="providerId" required hint="…">
//     <TextInput id="providerId" name="providerId" required />
//   </Field>
//
// No hooks (used inside Server Components). a11y: pass `htmlFor` matching the
// control's `id`; when `error` is set, the control should set
// aria-describedby={`${htmlFor}-error`} + invalid. Zero hex.

import * as React from 'react';

import { cx } from '@/lib/cx';

export interface FieldProps {
  /** Visible label (rendered in label-cap; CSS uppercases ASCII, keeps CJK). */
  label: string;
  /** id of the control this label is for (a11y association). */
  htmlFor?: string;
  /** Optional helper text below the control. */
  hint?: string;
  /** Optional error text (oxblood) — replaces hint visually when present. */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx('field', className)}>
      <label className="label-cap field-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="field-required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          className="field-error"
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export default Field;
