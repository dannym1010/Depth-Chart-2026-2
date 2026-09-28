/** "18:00" -> "6:00 PM", "07:05" -> "7:05 AM". Times already written with AM/PM (or empty) are kept. */
export function formatClock(time?: string | null): string {
  const t = String(time ?? '').trim();
  if (!t) return '';
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?(.*)$/i);
  if (ampm) return `${Number(ampm[1])}:${ampm[2] || '00'} ${ampm[3].toUpperCase()}M${ampm[4] || ''}`;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return t;
  const h = Number(m[1]);
  if (h > 23) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "18:00" + "19:30" -> "6:00 PM - 7:30 PM". */
export function formatClockRange(start?: string | null, end?: string | null): string {
  const a = formatClock(start);
  const b = formatClock(end);
  return a && b ? `${a} - ${b}` : a || b;
}
