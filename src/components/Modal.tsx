import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  /** Close the modal — invoked on backdrop click and on Escape. */
  onClose: () => void;
  /** Extra class(es) applied to the `.modal` element, e.g. `modal-wide`. */
  className?: string;
  /**
   * When provided the modal renders as a `<form>` and calls this on submit;
   * otherwise it renders as a `<div>`.
   */
  onSubmit?: (e: React.FormEvent) => void;
  children: ReactNode;
}

/**
 * Shared modal shell: a backdrop that closes on click, an inner panel that stops
 * click propagation, and Escape-to-close. Used by the course editor, program
 * settings and the diff view.
 */
export function Modal({ onClose, className, onSubmit, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const cls = `modal${className ? ` ${className}` : ''}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {onSubmit ? (
        <form className={cls} onClick={stop} onSubmit={onSubmit}>
          {children}
        </form>
      ) : (
        <div className={cls} onClick={stop}>
          {children}
        </div>
      )}
    </div>
  );
}
