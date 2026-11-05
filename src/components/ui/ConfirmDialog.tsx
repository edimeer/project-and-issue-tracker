import { useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={title}
      onClose={busy ? () => undefined : onCancel}
      footer={
        <>
          {/* Safe choice gets initial focus for destructive actions. */}
          <button type="button" className="btn" onClick={onCancel} disabled={busy} data-autofocus={danger ? '' : undefined}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            data-autofocus={danger ? undefined : ''}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">{children}</div>
    </Dialog>
  );
}
