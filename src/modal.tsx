import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {dialog.close(); prior?.focus();};
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => {event.preventDefault(); onClose();}} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]')).filter(el => el.getClientRects().length > 0);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
  }}><header className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Pencereyi kapat" onClick={onClose}><X size={22}/></button></header>{children}</dialog>;
}
