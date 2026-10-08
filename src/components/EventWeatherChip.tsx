// The weather for a game or practice on the schedule: temperature, rain chance and wind at the start time
// (about two weeks out at most). Shows nothing until it's known.
import React, { useEffect, useState } from 'react';
import { fetchEventWeather, type EventWeather } from '../utils/weather';

interface Props {
  event: { date: string; startTime?: string; location: string; durationMinutes?: number; isCancelled?: boolean };
  /** The team's home town, for an event whose location doesn't say. */
  home?: string;
  className?: string;
  /** 'dark': on a dark card (the Schedule). 'auto': follows the light / dark theme (the Home page). */
  tone?: 'dark' | 'auto';
  /** Larger, with the conditions written out (a card of its own). */
  large?: boolean;
}

export const EventWeatherChip: React.FC<Props> = ({ event, home, className = '', tone = 'dark', large = false }) => {
  const [w, setW] = useState<EventWeather | null>(null);
  useEffect(() => {
    let live = true;
    setW(null);
    if (event.isCancelled) return;
    // Some dates carry a time ("2026-10-11T00:00"): the day is what's asked for.
    fetchEventWeather({ ...event, date: String(event.date || '').split('T')[0] }, home)
      .then((x) => live && setW(x))
      .catch(() => live && setW(null));
    return () => {
      live = false;
    };
  }, [event.date, event.startTime, event.location, event.durationMinutes, event.isCancelled, home]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  const wet = w.maxPrecipChance >= 50;
  const cold = (w.feelsF ?? w.tempF) <= 40;
  const hot = w.tempF >= 88;
  const colors =
    tone === 'auto'
      ? wet
        ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/40'
        : cold || hot
          ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30'
          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
      : wet
        ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/40'
        : cold || hot
          ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30'
          : 'bg-slate-700/60 text-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1 ${large ? 'rounded-xl px-2.5 py-1.5 text-xs' : 'rounded-md px-1.5 py-0.5 text-[11px]'} font-bold ${colors} ${className}`}
      title={`${w.place}: ${w.label}, ${w.tempF}°F${w.feelsF != null && w.feelsF !== w.tempF ? ` (feels like ${w.feelsF}°F)` : ''}, ${w.precipChance}% chance of rain at the start${w.maxPrecipChance > w.precipChance ? `, up to ${w.maxPrecipChance}% while it runs` : ''}, wind ${w.windMph} mph`}
    >
      <span aria-hidden className={large ? 'text-base leading-none' : ''}>{w.icon}</span>
      {w.tempF}°F
      {large && <span className="opacity-80">· {w.label}</span>}
      <span className="opacity-80">· {wet ? `Rain ${w.maxPrecipChance}%` : `${w.maxPrecipChance}% rain`}</span>
      {w.windMph >= 12 && <span className="opacity-80">· {w.windMph} mph</span>}
    </span>
  );
};
