import React from 'react';
import { Activity, ListChecks, Shield, Users } from 'lucide-react';

export type HudlSection = 'opponent' | 'own' | 'log' | 'pff';

const SECTIONS: { id: HudlSection; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'opponent', label: 'Opponent', hint: "This week's scouting report", icon: Shield },
  { id: 'own', label: 'Our team', hint: 'Self-scout report', icon: Users },
  { id: 'log', label: 'Our play log', hint: 'Tag plays, units, subs', icon: ListChecks },
  { id: 'pff', label: 'PFF grades', hint: 'Grade every player', icon: Activity },
];

/** Hudl Scout: one place for the opponent report, our film (report + play log) and PFF grades. */
export const HudlScoutSections: React.FC<{ section: HudlSection; onChange: (s: HudlSection) => void }> = ({ section, onChange }) => (
  <div className="w-full max-w-7xl mx-auto px-2 sm:px-0 print:hidden">
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mr-2">Hudl Scout</h1>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/80" role="tablist" aria-label="Hudl Scout sections">
      {SECTIONS.map(({ id, label, hint, icon: Icon }) => {
        const on = section === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(id)}
            className={`min-h-[48px] rounded-xl px-3 py-1.5 text-left flex items-center gap-2 cursor-pointer transition-colors ${
              on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${on ? 'text-indigo-600 dark:text-indigo-300' : ''}`} />
            <span className="min-w-0">
              <span className="block text-xs sm:text-sm font-black leading-tight">{label}</span>
              <span className="hidden sm:block text-[10.5px] font-medium opacity-70 truncate">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
