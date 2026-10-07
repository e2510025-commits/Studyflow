"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Dialog({ open, onClose, title, children, id }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    }
    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} id={id} className="app-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="app-dialog-heading">
        <h2 id={titleId} className="text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} className="icon-button" aria-label={`${title}を閉じる`}><X size={22} aria-hidden="true" /></button>
      </div>
      <div className="app-dialog-content">{children}</div>
    </dialog>
  );
}
