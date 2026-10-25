// The Summary tab on paper: made for reading on a printed page, not the screen shrunk down. Big type, plain tables
// in place of cards, ink only where it says something (the down & distance boxes and the field bars), and fitted to
// one letter page.
import type { AIScoutingReport, DownDistGroup, Play, TendencyAnalysis } from '../../types/football';
import { fieldTendencies, type Split3 } from '../../utils/fieldTendencies';
import { buildTakeaways, identity, runSides, type ReportVoice } from './reportText';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** A down & distance box's shading: green for run, blue for pass, stronger for a stronger lean. */
function leanShade(runPct: number): { bg: string; fg: string } {
  const lean = Math.abs(runPct - 50);
  if (lean < 10) return { bg: '#e2e8f0', fg: '#0f172a' };
  const run = runPct > 50;
  if (lean >= 30) return run ? { bg: '#047857', fg: '#ffffff' } : { bg: '#1d4ed8', fg: '#ffffff' };
  return run ? { bg: '#bbf7d0', fg: '#052e16' } : { bg: '#bfdbfe', fg: '#172554' };
}

/** A three-part bar ("Wide side 55% | Middle 24% | Boundary 21%") as table cells sized by share. */
function bar(parts: { label: string; pct: number; count: number; color: string }[]): string {
  const shown = parts.filter((p) => p.count > 0);
  if (!shown.length) return '<div class="none">No plays</div>';
  return `<div class="bar">${shown
    .map(
      (p) =>
        `<div style="flex-grow:${Math.max(p.pct, 14)};background:${p.color}">${p.pct >= 25 ? `${esc(p.label)} ` : ''}${p.pct}%</div>`
    )
    .join('')}</div>`;
}

const part = <K extends string>(s: Split3<K>, k: K, label: string, color: string) => ({ label, pct: s.pct[k], count: s.count[k], color });

export function summaryPrintHtml(a: TendencyAnalysis, plays: Play[], voice: ReportVoice, report: AIScoutingReport | null, title: string): string {
  const id = identity(a, voice);
  const sides = runSides(a);
  const takeaways = buildTakeaways(a, plays, voice, 5);
  const third = a.thirdDownConversions;
  const bigEvery = a.explosivePlayRate > 0 ? Math.max(1, Math.round(100 / a.explosivePlayRate)) : 0;
  const showPlan = report && (voice.showCounters || voice.showSelfScout);
  // Read from the offense's snaps when both sides of the ball are in view, as the Run game tab does.
  const both = plays.some((p) => p.odk === 'O') && plays.some((p) => p.odk === 'D');
  const field = fieldTendencies(both ? plays.filter((p) => p.odk === 'O') : plays, voice.subject);

  const facts = [
    ['Run or pass', a.runPct >= a.passPct ? `${a.runPct}% run` : `${a.passPct}% pass`, `${a.avgGainRun} yds a run · ${a.avgGainPass} yds a pass`],
    ['Favorite run', sides.total ? sides.favorite.label.charAt(0).toUpperCase() + sides.favorite.label.slice(1) : 'No runs tagged', sides.total ? `${sides.favorite.pct}% of ${sides.total} runs · L ${sides.leftPct}% · M ${sides.middlePct}% · R ${sides.rightPct}%` : ''],
    ['3rd down', third.total ? `${third.rate}% converted` : 'No 3rd downs', third.total ? `${third.converted} of ${third.total} · short ${third.short.rate}% · med ${third.medium.rate}% · long ${third.long.rate}%` : ''],
    ['Big plays', a.explosivePlayCount ? `1 in ${bigEvery} plays` : 'None', a.explosivePlayCount ? `${a.explosivePlayCount} runs of 12+ or passes of 16+` : ''],
  ];

  const cell = (down: number, bucket?: 'short' | 'medium' | 'long') =>
    a.situationalGroups.find((g: DownDistGroup) => {
      if (g.down !== down) return false;
      if (!bucket) return true;
      return (g.distMax <= 3 ? 'short' : g.distMax <= 6 ? 'medium' : 'long') === bucket;
    });
  const box = (g: DownDistGroup | undefined, label: string, span = 1) => {
    if (!g || !g.count) return `<td colspan="${span}" class="dd empty"><b>${esc(label)}</b><span>No plays</span></td>`;
    const s = leanShade(g.runPct);
    return `<td colspan="${span}" class="dd" style="background:${s.bg};color:${s.fg}"><b>${esc(label)}</b><span class="big">${
      g.runPct >= 50 ? `${g.runPct}% run` : `${g.passPct}% pass`
    }</span><span>${g.count} plays · ${g.avgGain} yds</span></td>`;
  };
  const downRows = [1, 2, 3, 4]
    .map((down) => {
      const name = ['', '1st', '2nd', '3rd', '4th'][down];
      const cells =
        down === 1 || down === 4
          ? box(cell(down), down === 1 ? '1st & 10' : '4th down', 3)
          : (['short', 'medium', 'long'] as const).map((b) => box(cell(down, b), `${name} & ${b}`)).join('');
      return `<tr><th>${name}</th>${cells}</tr>`;
    })
    .join('');

  const FIELD = '#16a34a', MID = '#94a3b8', BOUND = '#dc2626';
  const hashRows = field.byHash
    .map((h) =>
      h.hash === 'M'
        ? `<tr><th>Ball in the middle <small>${h.byLR.total} play${h.byLR.total === 1 ? '' : 's'} · ${h.runPct}% run</small></th></tr><tr><td>${bar([
            part(h.byLR, 'L', 'Left', '#6366f1'),
            part(h.byLR, 'M', 'Middle', MID),
            part(h.byLR, 'R', 'Right', '#a855f7'),
          ])}</td></tr>`
        : `<tr><th>Ball on the ${esc(h.label.toLowerCase())} <small>${h.byField.total} play${h.byField.total === 1 ? '' : 's'} · ${h.runPct}% run</small></th></tr><tr><td>${bar([
            part(h.byField, 'field', 'Wide', FIELD),
            part(h.byField, 'middle', 'Middle', MID),
            part(h.byField, 'boundary', 'Boundary', BOUND),
          ])}</td></tr>`
    )
    .join('');
  const m = field.motion;
  const motionHtml = m.plays
    ? `<p><b>${m.plays}</b> plays with motion (${m.ofSnaps}% of snaps) · ${m.runPct}% run · ${m.avg} yds a play</p>
       ${m.playVsMotion.total ? `<p>Then the play goes: <b>${m.playVsMotion.pct.with}% with the motion</b> · ${m.playVsMotion.pct.middle}% middle · ${m.playVsMotion.pct.away}% away</p>` : ''}
       ${m.toField.total ? `<p>Motion goes to the wide side ${m.toField.pct.field}% · boundary ${m.toField.pct.boundary}%</p>` : ''}`
    : '<p class="muted">No motion direction on these plays.</p>';

  const items = takeaways
    .map(
      (t, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(t.title)}</b><div>${esc(t.detail)}</div>${
        voice.showCounters && t.counter ? `<div class="answer"><b>Our answer:</b> ${esc(t.counter)}</div>` : ''
      }${voice.showSelfScout && t.selfScout ? `<div class="answer"><b>Self-scout:</b> ${esc(t.selfScout)}</div>` : ''}</div></li>`
    )
    .join('');

  const plan =
    showPlan && report
      ? `<div class="plan"><h2>${voice.showCounters ? 'Our base plan' : 'How teams will likely defend us'}</h2>
          <p><b>Front:</b> ${esc(report.defensivePhilosophyRecommendation.recommendedBaseFront)} &nbsp; · &nbsp; <b>Coverage:</b> ${esc(report.defensivePhilosophyRecommendation.secondaryAlignment)}</p>
          <p class="why">${esc(report.defensivePhilosophyRecommendation.rationale)}</p></div>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${esc(title)}</title><style>
  @page { size: letter portrait; margin: 0.4in; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10.5pt/1.3 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #fff; }
  h1 { font-size: 20pt; margin: 0; }
  h2 { font-size: 11.5pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #0f172a; padding-bottom: 2px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 3px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
  .top p { margin: 2px 0 0; font-size: 11pt; }
  .count { font-weight: 800; font-size: 11pt; white-space: nowrap; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .fact { border: 1.5px solid #0f172a; border-radius: 6px; padding: 5px 7px; }
  .fact .l { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; color: #475569; }
  .fact .v { font-size: 14pt; font-weight: 900; margin: 1px 0; }
  .fact .s { font-size: 8.5pt; color: #334155; }
  ol { list-style: none; margin: 0 0 10px; padding: 0; }
  li { display: flex; gap: 8px; margin: 0 0 6px; break-inside: avoid; }
  .n { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #0f172a; color: #fff; font-weight: 900; font-size: 10pt; display: flex; align-items: center; justify-content: center; }
  .answer { margin-top: 2px; padding-left: 6px; border-left: 3px solid #4f46e5; }
  .cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; }
  table { width: 100%; border-collapse: separate; border-spacing: 3px; }
  table.dd-t th { width: 34px; text-align: left; font-size: 10pt; }
  table.dd-t thead th { text-align: center; font-size: 8.5pt; text-transform: uppercase; color: #475569; width: auto; }
  td.dd { border-radius: 4px; padding: 4px 6px; vertical-align: top; }
  td.dd b { display: block; font-size: 8pt; text-transform: uppercase; }
  td.dd span { display: block; font-size: 8.5pt; }
  td.dd span.big { font-size: 12.5pt; font-weight: 900; }
  td.dd.empty { border: 1px dashed #94a3b8; color: #64748b; }
  .key { font-size: 8.5pt; color: #475569; margin: 2px 0 0; }
  table.hash { border-spacing: 0 2px; } table.hash th { text-align: left; font-size: 10pt; padding-top: 4px; }
  table.hash small { font-weight: 400; font-size: 8.5pt; color: #475569; }
  .bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; font-size: 9pt; font-weight: 800; color: #fff; }
  .bar div { display: flex; align-items: center; justify-content: center; flex-basis: 0; border-right: 2px solid #fff; white-space: nowrap; overflow: hidden; }
  .bar div:last-child { border-right: 0; }
  .none, .muted { color: #64748b; }
  .motion p, .plan p { margin: 3px 0; }
  .plan { margin-top: 10px; }
  .why { font-size: 9.5pt; color: #334155; }
  section { break-inside: avoid; }
</style></head><body>
  <div class="top">
    <div><h1>${esc(id.label)}</h1><p>${esc(id.sentence)}</p></div>
    <div class="count">${a.totalPlays} plays scouted</div>
  </div>
  <div class="facts">${facts.map(([l, v, s]) => `<div class="fact"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('')}</div>
  <section><h2>${voice.mode === 'own' ? 'What stands out' : 'Top things to know'}</h2>${items ? `<ol>${items}</ol>` : '<p class="muted">No strong habits yet.</p>'}</section>
  <div class="cols">
    <section><h2>By down &amp; distance</h2>
      <table class="dd-t"><thead><tr><th></th><th>Short 1-3</th><th>Medium 4-6</th><th>Long 7+</th></tr></thead><tbody>${downRows}</tbody></table>
      <p class="key">Green = run, blue = pass. Darker = stronger lean.</p>
    </section>
    <section><h2>Wide side or boundary, by where the ball is</h2>
      ${field.total ? `<table class="hash"><tbody>${hashRows}</tbody></table><p class="key">Green = wide side, gray = middle, red = boundary.</p>` : '<p class="muted">No hash on these plays.</p>'}
      <h2 style="margin-top:10px">Motion</h2><div class="motion">${motionHtml}</div>
    </section>
  </div>
  ${plan}
</body></html>`;
}
