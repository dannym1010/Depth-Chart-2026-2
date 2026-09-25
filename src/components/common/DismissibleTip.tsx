import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

const STORAGE_KEY = 'footballDismissedTips';

function readDismissedTips(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface DismissibleTipProps {
  /** Stable id; once dismissed, the tip stays hidden on this device. */
  id: string;
  children: React.ReactNode;
  className?: string;
}

// A one-line hint that explains a screen once, then gets out of the way.
export const DismissibleTip: React.FC<DismissibleTipProps> = ({ id, children, className = '' }) => {
  const [hidden, setHidden] = useState(() => readDismissedTips().includes(id));
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set([...readDismissedTips(), id]))));
    } catch {
      // storage unavailable: the tip simply returns next visit
    }
  };

  return (
    <div
      role="note"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-xs text-slate-600 dark:text-slate-300 print:hidden ${className}`}
    >
      <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
      <span className="min-w-0">{children}</span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-auto shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        title="Got it"
        aria-label="Dismiss tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
