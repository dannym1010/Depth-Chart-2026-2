import React from 'react';
import { Clock, LogIn, ShieldAlert } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  onLogInAgain: () => void;
  timeoutMinutes?: number;
}

export const IdleTimeoutModal: React.FC<IdleTimeoutModalProps> = ({
  isOpen,
  onLogInAgain,
  timeoutMinutes = 10,
}) => {
  if (!isOpen) return null;

  const formatDuration = (mins: number) => {
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}${rem > 0 ? ` ${rem} min` : ''}`;
    }
    return `${mins} minutes`;
  };

  return (
    <div
      id="idle-timeout-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="idle-timeout-modal-card"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-center p-6 sm:p-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Clock className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
          Session Timed Out
        </h3>

        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          You have been automatically logged out due to <strong>{formatDuration(timeoutMinutes)} of inactivity</strong>. Any active section locks have been safely released to allow other coaches to collaborate.
        </p>

        <div className="my-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2.5 text-left">
          <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0" />
          <span>All team formations, game plans, and depth charts were securely saved to the server before logout.</span>
        </div>

        <button
          type="button"
          id="idle-timeout-relogin-btn"
          onClick={onLogInAgain}
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          Log Back In
        </button>
      </div>
    </div>
  );
};
