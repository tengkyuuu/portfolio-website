import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Native modal focus containment, Escape, and restoration to the opener. */
export function PreviewDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(
    <dialog ref={ref} className="preview-dialog no-print" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="preview-dialog-inner">
        <header><h2 id={titleId}>{title}</h2><button type="button" className="doc-button" onClick={onClose} aria-label="Close preview"><X size={18} /></button></header>
        {children}
      </div>
    </dialog>, document.body,
  );
}
