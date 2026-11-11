// Quick / Standard / Best for a video made on this device: what each gives, and the size it'll be.
import React from 'react';
import { VIDEO_QUALITIES, type VideoQuality } from './videoQuality';

export const QualityPicker: React.FC<{
  value: VideoQuality;
  onChange: (q: VideoQuality) => void;
  disabled?: boolean;
  /** The size it'll be made at (when the device can). */
  sizes?: { w: number; h: number };
}> = ({ value, onChange, disabled, sizes }) => (
  <fieldset className="flex flex-col gap-1" disabled={disabled}>
    <legend className="font-black text-slate-800 dark:text-slate-100 mb-1 text-sm">Quality</legend>
    <div className="grid grid-cols-3 gap-1.5">
      {VIDEO_QUALITIES.map((q) => {
        const on = value === q.id;
        return (
          <button
            key={q.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(q.id)}
            className={`flex flex-col items-start gap-0.5 rounded-xl border p-2 text-left min-w-0 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}
          >
            <b className="text-xs text-slate-800 dark:text-slate-100">{q.label}</b>
            <span className="text-[11px] leading-tight text-slate-500">{q.note}</span>
          </button>
        );
      })}
    </div>
    {sizes && (
      <span className="text-[11px] text-slate-500">
        Made at {sizes.w}×{sizes.h}, 30 frames a second{value === 'best' && sizes.w >= 3000 ? ' (4K: for a big TV or projector; smaller if this device can’t)' : ''}.
      </span>
    )}
  </fieldset>
);
