import { useEffect, useRef } from 'react';
import { trapTabKey } from './focusTrap';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, dangerous, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', keydown);
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', keydown);
      trigger?.focus();
    };
  }, [onCancel]);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={(event) => trapTabKey(event, dialogRef.current)}>
        <h2 id="dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>取消</button>
          <button type="button" className={dangerous ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
