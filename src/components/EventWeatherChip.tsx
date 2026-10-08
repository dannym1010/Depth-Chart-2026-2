// The weather for a game or practice on the schedule: temperature, rain chance and wind at the start time
// (about two weeks out at most). Shows nothing until it's known.
import React, { useEffect, useState } from 'react';
import { fetchEventWeather, type EventWeather } from '../utils/weather';

interface Props {
  event: { date: string; startTime?: string; location: string; durationMinutes?: number; isCancelled?: boolean };
  /** The team's home town, for an event whose location doesn't say. */
  home?: string;
  className?: string;
}

export const EventWeatherChip: React.FC<Props> = ({ event, home, className = '' }) => {
  const [w, setW] = useState<EventWeather | null>(null);
  useEffect(() => {
    let live = true;
    setW(null);
    if (event.isCancelled) return;
    fetchEventWeather(event, home)
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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
        wet ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/40' : cold || hot ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30' : 'bg-slate-700/60 text-slate-200'
      } ${className}`}
      title={`${w.place}: ${w.label}, ${w.tempF}°F${w.feelsF != null && w.feelsF !== w.tempF ? ` (feels like ${w.feelsF}°F)` : ''}, ${w.precipChance}% chance of rain at the start${w.maxPrecipChance > w.precipChance ? `, up to ${w.maxPrecipChance}% while it runs` : ''}, wind ${w.windMph} mph`}
    >
      <span aria-hidden>{w.icon}</span>
      {w.tempF}°F
      <span className="opacity-80">· {wet ? `Rain ${w.maxPrecipChance}%` : `${w.maxPrecipChance}% rain`}</span>
      {w.windMph >= 12 && <span className="opacity-80">· {w.windMph} mph</span>}
    </span>
  );
};
