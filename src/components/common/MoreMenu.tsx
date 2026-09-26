import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MoreMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  /** Destructive actions render in red. */
  danger?: boolean;
  /** Draw a divider above this item. */
  dividerBefore?: boolean;
  hidden?: boolean;
  title?: string;
}

interface MoreMenuProps {
  items: MoreMenuItem[];
  label?: string;
  title?: string;
  align?: 'left' | 'right';
  className?: string;
  /** Replaces the default "…" icon, e.g. a plus for an Add menu. */
  buttonIcon?: React.ReactNode;
  /** Replaces the default neutral button style, e.g. to make an Add menu the primary action. */
  buttonClassName?: string;
}

// Overflow menu for secondary toolbar actions, so each screen can show one
// primary button and tuck the rest away.
export const MoreMenu: React.FC<MoreMenuProps> = ({
  items,
  label = 'More',
  title = 'More actions',
  align = 'right',
  className = '',
  buttonIcon,
  buttonClassName,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Which edge the menu hangs from; flips when the preferred side would run off-screen (phones).
  const [side, setSide] = useState(align);
  const visible = items.filter((item) => !item.hidden);

  useLayoutEffect(() => {
    if (!open) {
      setSide(align);
      return;
    }
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (rect.left < 8 && side === 'right') setSide('left');
    else if (rect.right > window.innerWidth - 8 && side === 'left') setSide('right');
  }, [open, side, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        className={
          buttonClassName ||
          'px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer'
        }
      >
        {buttonIcon ?? <MoreHorizontal className="w-4 h-4" />}
        {label && <span>{label}</span>}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute ${side === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-2xl p-1.5 z-50`}
        >
          {visible.map((item, i) => (
            <React.Fragment key={`${item.label}-${i}`}>
              {item.dividerBefore && i > 0 && <div className="my-1 border-t border-slate-200 dark:border-slate-700" />}
              <button
                type="button"
                role="menuitem"
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  item.danger
                    ? 'text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {item.icon && <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
