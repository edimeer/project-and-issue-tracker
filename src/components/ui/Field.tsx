import { useId } from 'react';
import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Render-prop so the control gets matching id and aria attributes. */
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
  className?: string;
  counter?: string;
}

export function Field({ label, error, hint, required, children, className = '', counter }: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'field-invalid' : ''} ${className}`}>
      <div className="field-head">
        <label htmlFor={id} className="field-label">
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {counter && <span className="field-counter">{counter}</span>}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
