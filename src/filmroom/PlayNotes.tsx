// Coaches' notes on the open play, shared with the team. Each note is pinned to a moment in the clip.
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { FilmNote } from './types';
import { fmtTime } from './FilmPlayer';

const GRADES: { id: NonNullable<FilmNote['grade']>; label: string; cls: string }[] = [
  { id: 'great', label: 'Great', cls: 'bg-emerald-600 text-white' },
  { id: 'good', label: 'Good', cls: 'bg-sky-600 text-white' },
  { id: 'ok', label: 'OK', cls: 'bg-amber-500 text-black' },
  { id: 'bad', label: 'Fix', cls: 'bg-rose-600 text-white' },
];

interface PlayNotesProps {
  play?: Play;
  notes: FilmNote[];
  currentTime: () => number;
  onSeek: (t: number) => void;
  onAdd: (text: string, grade: FilmNote['grade'], t: number) => void;
  onDelete: (id: string) => void;
}

export const PlayNotes: React.FC<PlayNotesProps> = ({ play, notes, currentTime, onSeek, onAdd, onDelete }) => {
  const [text, setText] = useState('');
  const [grade, setGrade] = useState<FilmNote['grade']>();

  if (!play) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Pick a play to see its notes.</p>;

  const add = () => {
    if (!text.trim() && !grade) return;
    onAdd(text.trim(), grade, currentTime());
    setText('');
    setGrade(undefined);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {play.notes?.trim() && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-bold">Hudl Scout note:</span> {play.notes}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          rows={2}
          placeholder="Note at this moment of the play…"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-1 flex-wrap">
          {GRADES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGrade(grade === g.id ? undefined : g.id)}
              className={`px-2.5 h-8 rounded-lg text-xs font-bold ${grade === g.id ? g.cls : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
              {g.label}
            </button>
          ))}
          <button
            onClick={add}
            disabled={!text.trim() && !grade}
            className="ml-auto px-3 h-8 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-40"
          >
            Add note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-slate-400">No notes on this play yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => {
            const g = GRADES.find((x) => x.id === n.grade);
            return (
              <li key={n.id} className="group rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <button onClick={() => onSeek(n.t)} className="font-bold tabular-nums text-indigo-600 dark:text-indigo-300 hover:underline" title="Go to this moment">
                    {fmtTime(n.t)}
                  </button>
                  {g && <span className={`px-1.5 rounded font-bold ${g.cls}`}>{g.label}</span>}
                  <span className="text-slate-400 truncate">{n.author}</span>
                  <button
                    onClick={() => onDelete(n.id)}
                    className="ml-auto text-slate-400 hover:text-rose-500 opacity-60 group-hover:opacity-100"
                    aria-label="Delete note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {n.text && <p className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{n.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
