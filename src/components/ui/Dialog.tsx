import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface DialogProps {
  title: string;
  /** Called for every close request: Escape, the close button, a backdrop click. The parent decides whether to unmount. */
  onClose: () => void;
  /** modal: centred. drawer: right-hand panel on desktop, full screen on phones. sheet: bottom sheet on phones. */
  variant?: 'modal' | 'drawer' | 'sheet';
  children: ReactNode;
  footer?: ReactNode;
  /** Optional element shown next to the title. */
  headerExtra?: ReactNode;
  /** Prevent closing by backdrop click (used while a form has unsaved changes). */
  lockBackdrop?: boolean;
  description?: string;
}

/**
 * Wraps the native <dialog> element. showModal() gives us a focus trap, an inert background,
 * Escape handling and focus restore for free. Mount it to open it, unmount it to close it.
 */
export function Dialog({ title, onClose, variant = 'modal', children, footer, headerExtra, lockBackdrop, description }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Remember who opened us. The native dialog restores focus on close(), but not when
    // it is simply unmounted, so we do it ourselves if that element still exists.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.open) el.showModal();
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (el.open) el.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Escape: let our own logic decide, so unsaved-change guards work.
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current && !lockBackdrop) onClose();
      }}
    >
      <div className="dialog-panel">
        <header className="dialog-header">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          {headerExtra}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        {description && (
          <p id={descId} className="dialog-desc">
            {description}
          </p>
        )}
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
