import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Settings,
  Plus,
  Maximize,
  Upload,
  FileText,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  X,
  Code,
  Eye,
  Check,
  Copy,
  Sparkles,
  FileCode,
  Globe,
  Printer,
  Layers,
  ExternalLink,
  CheckSquare,
  Folder,
} from 'lucide-react';
import { PlaybookGuideTree, PlaybookGuideOrder, UserRole, Team } from '../types';
import {
  printCleanHTML,
  openCleanPrintTab,
  generatePlaybookGuidePrintHTML,
  generatePlaybookBinderPrintHTML,
} from '../utils/printUtils';
import { FullDocumentViewer } from './common/FullDocumentViewer';
import { PlaybookInteractiveSheet } from './whiteboard/PlaybookInteractiveSheet';
import { HudlPlaybookUploadModal } from './whiteboard/HudlPlaybookUploadModal';
import { SCHEME_DRILLS } from './whiteboard/drillsSchemes';
import { DEFENSIVE_DRILLS, WhiteboardDrill, getCustomWhiteboardDrills, saveCustomWhiteboardDrills } from './whiteboard/whiteboardDrillData';
import { HUDL_10U_DEFENSE_INSTALL_PLAYS } from '../data/hudl10UDefenseData';

interface PlaybookGuidesViewProps {
  guideTree: PlaybookGuideTree;
  guideOrder: PlaybookGuideOrder;
  activeMain: string;
  activeSub: string;
  userRole: UserRole;
  activeTeam?: Team;
  onSelectMain: (main: string) => void;
  onSelectSub: (sub: string) => void;
  onUploadDocument: (main: string, sub: string, file: File) => void;
  onSaveHtmlContent: (main: string, sub: string, html: string) => void;
  onClearDocument: (main: string, sub: string) => void;
  onAddMainFolder: (name: string) => void;
  onAddSubTab: (main: string, name: string) => void;
  onRenameMainFolder: (oldName: string, newName: string) => void;
  onRenameSubTab: (main: string, oldName: string, newName: string) => void;
  onDeleteMainFolder: (name: string) => void;
  onDeleteSubTab: (main: string, name: string) => void;
  onMoveMainFolder: (name: string, direction: number) => void;
  onMoveSubTab: (main: string, name: string, direction: number) => void;
}

const HTML_STARTER_TEMPLATES = [
  {
    id: 'play_card',
    name: '🏈 Play Scheme & Assignment Card',
    description: 'Formatted play sheet with formation, diagram container, and player assignments',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px; max-width: 900px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 24px; color: #facc15; }
    .badge { background: #3b82f6; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; }
    .diagram-box { background: #022c22; border: 2px dashed #10b981; border-radius: 12px; height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 24px; text-align: center; color: #6ee7b7; position: relative; overflow: hidden; }
    .grid-lines { position: absolute; width: 100%; height: 100%; background-size: 20px 20px; background-image: linear-gradient(to right, rgba(16, 185, 129, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.1) 1px, transparent 1px); }
    .diagram-title { z-index: 1; font-weight: 800; font-size: 16px; margin-bottom: 4px; }
    .diagram-sub { z-index: 1; font-size: 12px; color: #a7f3d0; }
    .assignments-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .assignments-table th { background: #0f172a; color: #94a3b8; text-align: left; padding: 10px 14px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #334155; }
    .assignments-table td { padding: 12px 14px; border-bottom: 1px solid #334155; font-size: 13px; }
    .pos-tag { background: #334155; color: #38bdf8; padding: 2px 8px; border-radius: 6px; font-weight: bold; font-family: monospace; }
    .notes-box { margin-top: 20px; background: #0f172a; border-left: 4px solid #facc15; padding: 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1>GUN TRIPS RIGHT - 62 SMASH</h1>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Personnel: 11 Personnel (1 RB, 1 TE, 3 WR)</div>
      </div>
      <span class="badge">Red Zone / Medium Pass</span>
    </div>

    <!-- Play Diagram Area -->
    <div class="diagram-box">
      <div class="grid-lines"></div>
      <div class="diagram-title">🏈 PLAY FIELD SCHEMATIC</div>
      <div class="diagram-sub">Read Progression: 1. Corner (Cornerback bite) &rarr; 2. Hitch (Underneath) &rarr; 3. Backside Dig</div>
    </div>

    <!-- Assignment Table -->
    <table class="assignments-table">
      <thead>
        <tr>
          <th style="width: 100px;">Position</th>
          <th style="width: 180px;">Alignment</th>
          <th>Assignment & Key Read</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="pos-tag">QB</span></td>
          <td>Gun (5 yds)</td>
          <td>3-step drop. Read boundary CB. If CB squats on hitch, throw corner route over top on rhythm.</td>
        </tr>
        <tr>
          <td><span class="pos-tag">X (WR1)</span></td>
          <td>Split Left (Numbers)</td>
          <td>12-yard Dig across hash. Settle in window between inside linebackers.</td>
        </tr>
        <tr>
          <td><span class="pos-tag">H (Slot)</span></td>
          <td>Inside Slot Right</td>
          <td>Corner route (10 yds stem, break at 45&deg; toward sideline pylon). High point the catch.</td>
        </tr>
        <tr>
          <td><span class="pos-tag">Z (WR2)</span></td>
          <td>Outside Slot Right</td>
          <td>5-yard Hitch. Sell vertical drive, plant outside foot, show numbers immediately to QB.</td>
        </tr>
        <tr>
          <td><span class="pos-tag">RB</span></td>
          <td>Weakside Offset</td>
          <td>Check-release to flat. Block weakside edge blitz first, otherwise release into open boundary.</td>
        </tr>
        <tr>
          <td><span class="pos-tag">OL</span></td>
          <td>Balanced Spacing</td>
          <td>Half-slide protection left. Center declares Mike LB. Firm interior pocket.</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-box">
      <strong>Coaching Key:</strong> Against Cover 2, the Corner route is open behind the CB and under the safety. Against Cover 3, take the 5-yard hitch immediately.
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'video_embed',
    name: '🎥 Video & HUDL Embed Frame',
    description: 'Responsive video container for HUDL cutups, YouTube film study, or online video',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
    .wrapper { max-width: 960px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 24px; }
    .title { font-size: 22px; font-weight: 800; color: #38bdf8; margin-bottom: 6px; }
    .meta { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
    .notes { margin-top: 20px; background: #0f172a; padding: 18px; border-radius: 12px; border: 1px solid #334155; }
    .notes h3 { margin-top: 0; font-size: 15px; color: #facc15; }
    .notes ul { margin: 8px 0 0 20px; padding: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="title">🎬 INSTALL FILM & CUTUP STUDY</div>
    <div class="meta">Paste your HUDL embed link, YouTube video ID, or video URL in the iframe below:</div>

    <div class="video-container">
      <!-- Replace the src URL below with your actual HUDL / YouTube embed link -->
      <iframe 
        src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" 
        title="Film Breakdown" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>

    <div class="notes">
      <h3>Key Film Teaching Points:</h3>
      <ul>
        <li><strong>0:15</strong> - Watch the safety rotation toward trips side at snap.</li>
        <li><strong>0:45</strong> - Slot receiver's stem depth creates 5 yards of separation against match coverage.</li>
        <li><strong>1:20</strong> - Backside offensive tackle hand placement during pass set.</li>
      </ul>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'wristband_insert',
    name: '📋 3-Column Wristband Grid Insert',
    description: 'Formatted sideline wristband sheet with color-coded play calls and wristband numbers',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: 'Arial Black', Arial, sans-serif; background: #ffffff; color: #000000; margin: 0; padding: 16px; }
    .wristband-header { text-align: center; font-size: 18px; font-weight: 900; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .column { border: 2px solid #000; border-radius: 8px; overflow: hidden; }
    .col-title { background: #000; color: #fff; padding: 6px; text-align: center; font-size: 13px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 4px 6px; border-bottom: 1px solid #ccc; }
    .num { width: 28px; font-weight: 900; background: #f0f0f0; text-align: center; border-right: 1px solid #000; }
    .play { font-weight: bold; }
    .tag-run { background: #e0f2fe; color: #0369a1; }
    .tag-pass { background: #fef3c7; color: #b45309; }
    .tag-screen { background: #dcfce7; color: #15803d; }
  </style>
</head>
<body>
  <div class="wristband-header">Sideline Wristband Play Insert - Card 1</div>
  <div class="grid-container">
    <!-- Column 1 -->
    <div class="column">
      <div class="col-title" style="background:#1e3a8a;">CARD 1: BASE RUNS</div>
      <table>
        <tr class="tag-run"><td class="num">1</td><td class="play">Gun Inside Zone Rt</td></tr>
        <tr class="tag-run"><td class="num">2</td><td class="play">Gun Outside Stretch Lt</td></tr>
        <tr class="tag-run"><td class="num">3</td><td class="play">Counter Tre Solid</td></tr>
        <tr class="tag-run"><td class="num">4</td><td class="play">Power G Weak</td></tr>
        <tr class="tag-run"><td class="num">5</td><td class="play">QB Draw Trap</td></tr>
        <tr class="tag-run"><td class="num">6</td><td class="play">Split Zone Slice</td></tr>
      </table>
    </div>

    <!-- Column 2 -->
    <div class="column">
      <div class="col-title" style="background:#991b1b;">CARD 2: QUICK PASS & RPO</div>
      <table>
        <tr class="tag-pass"><td class="num">7</td><td class="play">Trips Quick Slants</td></tr>
        <tr class="tag-pass"><td class="num">8</td><td class="play">Smash Out Concept</td></tr>
        <tr class="tag-pass"><td class="num">9</td><td class="play">Mesh Shallow Cross</td></tr>
        <tr class="tag-screen"><td class="num">10</td><td class="play">Tunnel Screen Right</td></tr>
        <tr class="tag-screen"><td class="num">11</td><td class="play">RB Middle Slip Screen</td></tr>
        <tr class="tag-pass"><td class="num">12</td><td class="play">Double Post Deep</td></tr>
      </table>
    </div>

    <!-- Column 3 -->
    <div class="column">
      <div class="col-title" style="background:#14532d;">CARD 3: SPECIALS & RED ZONE</div>
      <table>
        <tr class="tag-pass"><td class="num">13</td><td class="play">Philly Special Pass</td></tr>
        <tr class="tag-pass"><td class="num">14</td><td class="play">TE Pop Pass Seam</td></tr>
        <tr class="tag-run"><td class="num">15</td><td class="play">Heavy Goal-Line Wedge</td></tr>
        <tr class="tag-pass"><td class="num">16</td><td class="play">Fade / Out Red Zone</td></tr>
        <tr class="tag-run"><td class="num">17</td><td class="play">Jet Sweep Reverse</td></tr>
        <tr class="tag-run"><td class="num">18</td><td class="play">Victory Formation Knee</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'install_rules',
    name: '📊 Protection & Rule Assignments Table',
    description: 'Structured matrix for offensive line protections, blitz pick-ups, and route adjustments',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .box { background: #1e293b; border-radius: 14px; border: 1px solid #334155; padding: 20px; max-width: 900px; margin: 0 auto; }
    h2 { color: #38bdf8; margin-top: 0; font-size: 20px; border-bottom: 2px solid #334155; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th { background: #0284c7; color: #fff; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #334155; }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    .badge-ol { background: #475569; color: #f8fafc; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🛡️ PASS PROTECTION RULES & BLITZ ALERTS</h2>
    <table>
      <thead>
        <tr>
          <th>Call</th>
          <th>Type</th>
          <th>OL Responsibility</th>
          <th>RB Responsibility</th>
          <th>Hot Route Answer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>50 BASE</strong></td>
          <td>5-Man Slide</td>
          <td>Center slides to Call side; Tackles lock man-on-man</td>
          <td>Dual read Mike to Will LB</td>
          <td>Slot Sight Adjust Quick Out</td>
        </tr>
        <tr>
          <td><strong>60 BOB</strong></td>
          <td>Big On Big</td>
          <td>Guards and Tackles take 4 down linemen; Center on 0/1 Tech</td>
          <td>Check-release through A-gap</td>
          <td>RB checkdown in hook zone</td>
        </tr>
        <tr>
          <td><strong>MAX PROTECT</strong></td>
          <td>7-Man Heavy</td>
          <td>Full Slide strong; TE seals edge defensive end</td>
          <td>RB blocks weakside edge linebacker</td>
          <td>None (2-Man Deep route combination)</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`,
  },
  {
    id: 'blank_canvas',
    name: '✨ Blank Document / Custom HTML5',
    description: 'Clean boilerplate to write your own HTML, styles, tables, or embeds',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      margin: 0;
      line-height: 1.6;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      background: #1e293b;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid #334155;
    }
    h1 { color: #facc15; margin-top: 0; }
    p { color: #cbd5e1; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Custom Playbook Section</h1>
    <p>Type or paste your HTML content, diagrams, or embed widgets here.</p>
  </div>
</body>
</html>`,
  },
  {
    id: 'whiteboard_playbook',
    name: '🖍️ 10U D-Line Whiteboard & Gap Fit Playbook',
    description: 'Chalkboard card with moveable X\'s, O\'s, blitz arrows, zone coverage bubbles, and 10U coaching cues',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>10U D-Line Whiteboard Playbook</title>
<link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Permanent+Marker&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Space Grotesk', -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 20px; }
  .frame { background: #94a3b8; border-radius: 16px; padding: 16px; max-width: 960px; margin: 0 auto; box-shadow: 0 15px 35px rgba(0,0,0,0.6); }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; color: #0f172a; }
  .header h2 { margin: 0; font-family: 'Permanent Marker', cursive; font-size: 22px; }
  .badge { background: #d91b24; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; }
  .board { background: radial-gradient(circle at 50% 20%, #ffffff 0%, #f4f6f9 85%, #eaecf1 100%); border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; }
  .notes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
  .note-card { background: white; padding: 14px; border-radius: 8px; font-family: 'Architects Daughter', cursive; color: #1e293b; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
  .note-green { border-left: 6px solid #058538; }
  .note-red { border-left: 6px solid #d91b24; }
  .note-card h3 { margin-top: 0; font-family: 'Permanent Marker', cursive; font-size: 16px; margin-bottom: 8px; }
  ul { margin: 0; padding-left: 18px; line-height: 1.6; font-size: 14px; }
</style>
</head>
<body>
<div class="frame">
  <div class="header">
    <h2>10U D-LINE: BALL GET-OFF & GAP CONTROL</h2>
    <span class="badge">DEFENSIVE SCHEME & DRILLS</span>
  </div>
  <div class="board">
    <svg viewBox="0 0 700 460" style="width: 100%; height: auto; display: block;">
      <line x1="30" y1="230" x2="670" y2="230" stroke="#0052cc" stroke-width="2.5" />
      <text x="40" y="222" font-family="'Permanent Marker', cursive" font-size="12" fill="#0052cc">LOS (LINE OF SCRIMMAGE)</text>
      <!-- Zone Coverage Bubble -->
      <ellipse cx="350" cy="150" rx="90" ry="35" fill="#d91b24" fill-opacity="0.18" stroke="#d91b24" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="350" y="154" font-family="'Permanent Marker', cursive" font-size="11" fill="#d91b24" text-anchor="middle">COLLAPSED POCKET ZONE</text>
      <!-- Offensive O's -->
      <g transform="translate(230, 230)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#1a1a24">LT</text></g>
      <g transform="translate(290, 230)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#1a1a24">LG</text></g>
      <g transform="translate(350, 230)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#1a1a24">C</text></g>
      <g transform="translate(410, 230)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#1a1a24">RG</text></g>
      <g transform="translate(470, 230)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#1a1a24">RT</text></g>
      <g transform="translate(350, 150)"><circle cx="0" cy="0" r="16" fill="#fff" stroke="#d91b24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#d91b24">QB</text></g>
      <!-- Defensive X's -->
      <g transform="translate(180, 290)"><circle cx="0" cy="0" r="16" fill="#0052cc" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="24" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#0052cc">LDE</text></g>
      <g transform="translate(290, 290)"><circle cx="0" cy="0" r="16" fill="#0052cc" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="24" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#0052cc">LDT</text></g>
      <g transform="translate(410, 290)"><circle cx="0" cy="0" r="16" fill="#0052cc" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="24" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#0052cc">RDT</text></g>
      <g transform="translate(520, 290)"><circle cx="0" cy="0" r="16" fill="#0052cc" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="24" font-family="'Permanent Marker'" font-size="11" text-anchor="middle" fill="#0052cc">RDE</text></g>
      <!-- Blitz Arrows -->
      <path d="M 180 280 Q 160 210 200 160" fill="none" stroke="#0052cc" stroke-width="3"/>
      <polygon points="200,160 192,165 197,172" fill="#0052cc"/>
      <path d="M 520 280 Q 540 210 500 160" fill="none" stroke="#0052cc" stroke-width="3"/>
      <polygon points="500,160 503,172 508,165" fill="#0052cc"/>
      <path d="M 290 275 L 290 240" fill="none" stroke="#058538" stroke-width="3"/>
      <polygon points="290,235 285,245 295,245" fill="#058538"/>
      <path d="M 410 275 L 410 240" fill="none" stroke="#058538" stroke-width="3"/>
      <polygon points="410,235 405,245 415,245" fill="#058538"/>
    </svg>
  </div>
  <div class="notes">
    <div class="note-card note-green">
      <h3 style="color: #058538;">10U COACHING CUES</h3>
      <ul>
        <li>"Eyes burned into the leather &mdash; fire on the ball!"</li>
        <li>"Elbows glued to your ribs, violent lockout punch!"</li>
        <li>"DEs hold outside contain ceiling &mdash; never flush QB wide!"</li>
      </ul>
    </div>
    <div class="note-card note-red">
      <h3 style="color: #d91b24;">DO NOT DO THIS!</h3>
      <ul>
        <li>Jumping offsides on the quarterback's hard count.</li>
        <li>False stepping backwards with front foot before exploding forward.</li>
        <li>Speed rushing 10 yards behind QB and giving up easy scramble lanes.</li>
      </ul>
    </div>
  </div>
</div>
</body>
</html>`,
  },
];

export const PlaybookGuidesView: React.FC<PlaybookGuidesViewProps> = ({
  guideTree,
  guideOrder,
  activeMain,
  activeSub,
  userRole,
  activeTeam,
  onSelectMain,
  onSelectSub,
  onUploadDocument,
  onSaveHtmlContent,
  onClearDocument,
  onAddMainFolder,
  onAddSubTab,
  onRenameMainFolder,
  onRenameSubTab,
  onDeleteMainFolder,
  onDeleteSubTab,
  onMoveMainFolder,
  onMoveSubTab,
}) => {
  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);
  const [isFullScreenModalOpen, setIsFullScreenModalOpen] = useState(false);
  const [isHtmlEditorOpen, setIsHtmlEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');
  const [htmlEditorCode, setHtmlEditorCode] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Playbook & Guides Printing State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'current' | 'category' | 'all'>('current');
  const [printInkFriendly, setPrintInkFriendly] = useState(true);
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [selectedPrintSubTabs, setSelectedPrintSubTabs] = useState<Record<string, boolean>>({});
  const [isPrintingLoading, setIsPrintingLoading] = useState(false);

  // Hudl and Interactive Playbook Sheet State
  const [isHudlUploadOpen, setIsHudlUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'sheet' | 'doc'>('sheet');
  const [customPlays, setCustomPlays] = useState<WhiteboardDrill[]>(() => getCustomWhiteboardDrills());

  const allAvailablePlays = useMemo(() => {
    return [...customPlays, ...HUDL_10U_DEFENSE_INSTALL_PLAYS, ...SCHEME_DRILLS, ...DEFENSIVE_DRILLS];
  }, [customPlays]);

  const matchingPlay = useMemo(() => {
    const normSub = activeSub.toLowerCase().replace(/[^a-z0-9]/g, '');
    const directMatch = allAvailablePlays.find(
      (p) =>
        p.id === activeSub ||
        p.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normSub ||
        normSub.includes(p.title.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
        p.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normSub)
    );
    if (directMatch) return directMatch;

    if (activeMain.includes('Schemes') || activeMain.includes('Hudl') || activeMain.includes('Defense')) {
      return HUDL_10U_DEFENSE_INSTALL_PLAYS[0];
    }
    return null;
  }, [activeMain, activeSub, allAvailablePlays]);

  const handleImportFromHudl = (plays: WhiteboardDrill[], folderName: string) => {
    const updatedCustom = [...customPlays, ...plays];
    setCustomPlays(updatedCustom);
    saveCustomWhiteboardDrills(updatedCustom);

    if (!guideTree[folderName]) {
      onAddMainFolder(folderName);
    }
    plays.forEach((play) => {
      onAddSubTab(folderName, play.title);
    });

    onSelectMain(folderName);
    if (plays.length > 0) {
      onSelectSub(plays[0].title);
    }
    setViewMode('sheet');
  };

  const mainCategories =
    guideOrder.main && guideOrder.main.length > 0
      ? guideOrder.main
      : Object.keys(guideTree).length > 0
      ? Object.keys(guideTree)
      : ['Offense'];

  const currentSubTabs =
    (guideOrder.sub && guideOrder.sub[activeMain]) ||
    Object.keys(guideTree[activeMain] || {});

  // Defensive Playbook Sub-Folder Organization System
  const [selectedSubFolder, setSelectedSubFolder] = useState<string>('all');

  const isDefensiveCategory =
    activeMain.includes('Defense') || activeMain.includes('Schemes');

  const DEFENSIVE_SUB_FOLDERS = [
    { id: 'all', label: 'All Defensive Sections', icon: '📂' },
    { id: 'base', label: '4-4 Base Fronts', icon: '🛡️' },
    { id: 'blitz', label: 'Blitz Packages', icon: '⚡' },
    { id: 'stunts', label: 'Line Stunts & Slants', icon: '🔄' },
    { id: 'heavy', label: 'Heavy & Goal Line', icon: '🧱' },
    { id: 'technique', label: 'Position Technique & Drills', icon: '🎯' },
  ];

  const getSubTabCategory = (tabName: string): string => {
    const t = tabName.toLowerCase();
    if (t.includes('blow sting') || t.includes('double dog') || t.includes('blitz')) return 'blitz';
    if (t.includes('cross') || t.includes('fan') || t.includes('pinch') || t.includes('stunt')) return 'stunts';
    if (t.includes('5-3') || t.includes('6-2') || t.includes('goal line') || t.includes('overshift') || t.includes('heavy')) return 'heavy';
    if (
      t.includes('tackles') ||
      t.includes('ends') ||
      t.includes('linebacker') ||
      t.includes('backs') ||
      t.includes('circuit') ||
      t.includes('(dl)') ||
      t.includes('(de)') ||
      t.includes('(lb)') ||
      t.includes('(db)') ||
      t.includes('technique') ||
      t.includes('strike') ||
      t.includes('pursuit')
    ) {
      return 'technique';
    }
    return 'base';
  };

  const visibleSubTabs = useMemo(() => {
    if (!isDefensiveCategory || selectedSubFolder === 'all') {
      return currentSubTabs;
    }
    return currentSubTabs.filter((sub) => getSubTabCategory(sub) === selectedSubFolder);
  }, [currentSubTabs, isDefensiveCategory, selectedSubFolder]);

  const currentDocUrl = guideTree[activeMain]?.[activeSub] || '';
  const canManageDocs = userRole === 'admin' || userRole === ('coach' as any) || true;

  const totalSubTabsCount = useMemo(() => {
    let count = 0;
    mainCategories.forEach((cat) => {
      const subs =
        (guideOrder.sub && guideOrder.sub[cat]) || Object.keys(guideTree[cat] || {});
      count += subs.length;
    });
    return count;
  }, [mainCategories, guideOrder.sub, guideTree]);

  // Available sections for current print scope
  const availablePrintSections = useMemo(() => {
    if (printScope === 'current') {
      return [{ category: activeMain, subTab: activeSub, key: `${activeMain}__${activeSub}` }];
    }
    if (printScope === 'category') {
      return currentSubTabs.map((sub) => ({
        category: activeMain,
        subTab: sub,
        key: `${activeMain}__${sub}`,
      }));
    }
    // 'all' - full binder
    const list: { category: string; subTab: string; key: string }[] = [];
    mainCategories.forEach((cat) => {
      const subs =
        (guideOrder.sub && guideOrder.sub[cat]) || Object.keys(guideTree[cat] || {});
      subs.forEach((sub) => {
        list.push({ category: cat, subTab: sub, key: `${cat}__${sub}` });
      });
    });
    return list;
  }, [printScope, activeMain, activeSub, currentSubTabs, mainCategories, guideOrder.sub, guideTree]);

  const selectedSectionsCount = useMemo(() => {
    return availablePrintSections.filter((s) => selectedPrintSubTabs[s.key] !== false).length;
  }, [availablePrintSections, selectedPrintSubTabs]);

  const togglePrintSection = (key: string) => {
    setSelectedPrintSubTabs((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  const handleSelectAllPrintSections = (selectAll: boolean) => {
    const updated: Record<string, boolean> = {};
    availablePrintSections.forEach((s) => {
      updated[s.key] = selectAll;
    });
    setSelectedPrintSubTabs(updated);
  };

  const isHtml = (val: string): boolean => {
    if (!val) return false;
    const trimmed = val.trim();
    return (
      trimmed.startsWith('<') ||
      trimmed.includes('<html') ||
      trimmed.includes('<div') ||
      trimmed.includes('<style') ||
      trimmed.includes('<script') ||
      trimmed.includes('<svg') ||
      trimmed.includes('<table') ||
      trimmed.includes('<iframe') ||
      trimmed.includes('<!DOCTYPE') ||
      trimmed.startsWith('data:text/html')
    );
  };

  const isCurrentHtml = isHtml(currentDocUrl);

  const handleOpenHtmlEditor = () => {
    if (isCurrentHtml) {
      setHtmlEditorCode(currentDocUrl);
    } else {
      setHtmlEditorCode(HTML_STARTER_TEMPLATES[0].code);
    }
    setEditorTab('code');
    setIsHtmlEditorOpen(true);
  };

  const handleSaveHtmlEditor = () => {
    onSaveHtmlContent(activeMain, activeSub, htmlEditorCode);
    setIsHtmlEditorOpen(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlEditorCode);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Helper to print a single guide
  const handlePrintSingleGuide = (mainCat: string, subTabName: string, mode: 'iframe' | 'tab' = 'iframe') => {
    const content = guideTree[mainCat]?.[subTabName] || '';
    const teamTitle = activeTeam?.name || 'Mahopac 10U Indians';
    const teamSeason = activeTeam?.season || activeTeam?.ageGroup || '10U Football';

    // If it's a PDF URL or Data URL
    if (content && (content.startsWith('data:application/pdf') || content.endsWith('.pdf'))) {
      if (mode === 'tab') {
        window.open(content, '_blank');
      } else {
        printCleanHTML(
          `<iframe src="${content}" style="width:100%;height:100vh;border:none;"></iframe>`,
          `${teamTitle} - ${mainCat} - ${subTabName}`
        );
      }
      return;
    }

    const html = generatePlaybookGuidePrintHTML({
      teamName: teamTitle,
      teamSeason,
      category: mainCat,
      subTab: subTabName,
      content,
      inkFriendly: printInkFriendly,
    });

    const docTitle = `${teamTitle} - ${mainCat} - ${subTabName}`;
    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
    } else {
      printCleanHTML(html, docTitle);
    }
  };

  // Helper to print category packet (all sub-tabs in category)
  const handlePrintCategoryPacket = (category: string, mode: 'iframe' | 'tab' = 'iframe') => {
    const subTabs =
      (guideOrder.sub && guideOrder.sub[category]) || Object.keys(guideTree[category] || {});
    const teamTitle = activeTeam?.name || 'Mahopac 10U Indians';
    const teamSeason = activeTeam?.season || activeTeam?.ageGroup || '10U Football';
    const headCoach = activeTeam?.headCoachName || '';

    // Filter to selected sections
    const activeSubs = subTabs.filter(
      (sub) => selectedPrintSubTabs[`${category}__${sub}`] !== false
    );

    if (activeSubs.length === 0) {
      alert('Please select at least one playbook section to print.');
      return;
    }

    const sections = activeSubs.map((sub) => ({
      category,
      subTab: sub,
      content: guideTree[category]?.[sub] || '',
    }));

    const html = generatePlaybookBinderPrintHTML({
      teamName: teamTitle,
      teamSeason,
      headCoachName: headCoach,
      title: `${category.toUpperCase()} PLAYBOOK & INSTALL PACKET`,
      sections,
      inkFriendly: printInkFriendly,
      includeCoverPage: includeCoverPage,
    });

    const docTitle = `${teamTitle} - ${category} Playbook Packet`;
    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
    } else {
      printCleanHTML(html, docTitle);
    }
  };

  // Helper to print complete team playbook binder
  const handlePrintFullPlaybookBinder = (mode: 'iframe' | 'tab' = 'iframe') => {
    const teamTitle = activeTeam?.name || 'Mahopac 10U Indians';
    const teamSeason = activeTeam?.season || activeTeam?.ageGroup || '10U Football';
    const headCoach = activeTeam?.headCoachName || '';

    const sections: Array<{ category: string; subTab: string; content: string }> = [];
    mainCategories.forEach((cat) => {
      const subTabs =
        (guideOrder.sub && guideOrder.sub[cat]) || Object.keys(guideTree[cat] || {});
      subTabs.forEach((sub) => {
        if (selectedPrintSubTabs[`${cat}__${sub}`] !== false) {
          sections.push({
            category: cat,
            subTab: sub,
            content: guideTree[cat]?.[sub] || '',
          });
        }
      });
    });

    if (sections.length === 0) {
      alert('Please select at least one playbook section to print.');
      return;
    }

    const html = generatePlaybookBinderPrintHTML({
      teamName: teamTitle,
      teamSeason,
      headCoachName: headCoach,
      title: 'OFFICIAL TEAM PLAYBOOK & SCHEME INSTALL BINDER',
      sections,
      inkFriendly: printInkFriendly,
      includeCoverPage: includeCoverPage,
    });

    const docTitle = `${teamTitle} - Complete Team Playbook Binder`;
    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
    } else {
      printCleanHTML(html, docTitle);
    }
  };

  const handleExecutePrint = (mode: 'iframe' | 'tab' = 'iframe') => {
    setIsPrintingLoading(true);
    try {
      if (printScope === 'current') {
        handlePrintSingleGuide(activeMain, activeSub, mode);
      } else if (printScope === 'category') {
        handlePrintCategoryPacket(activeMain, mode);
      } else {
        handlePrintFullPlaybookBinder(mode);
      }
      setIsPrintModalOpen(false);
    } finally {
      setTimeout(() => setIsPrintingLoading(false), 800);
    }
  };

  const handlePrintHtmlEditorContent = (mode: 'iframe' | 'tab' = 'iframe') => {
    const teamTitle = activeTeam?.name || 'Mahopac 10U Indians';
    const teamSeason = activeTeam?.season || activeTeam?.ageGroup || '10U Football';
    const html = generatePlaybookGuidePrintHTML({
      teamName: teamTitle,
      teamSeason,
      category: activeMain,
      subTab: activeSub,
      content: htmlEditorCode,
      inkFriendly: printInkFriendly,
    });
    if (mode === 'tab') {
      openCleanPrintTab(html, `${teamTitle} - HTML Preview`);
    } else {
      printCleanHTML(html, `${teamTitle} - HTML Preview`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm dark:shadow-xl p-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700/80 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base md:text-lg text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>Playbooks &amp; Positional Install Guides</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">
                Upload PDFs, write interactive HTML playbook sheets, organize folders, and print team binders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Print Button in Header */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Print playbook sheets, install guides, or full team playbook binder"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Playbook</span>
            </button>

            {canManageDocs && (
              <>
                <button
                  type="button"
                  onClick={() => setIsOrganizeModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Organize Folders &amp; Tabs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Enter New Playbook / Guide Category Name (e.g. Special Teams, 7v7 Tournament, Red Zone):');
                    if (name && name.trim()) onAddMainFolder(name.trim());
                  }}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>+ Category Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const name = prompt(`Enter Position or Sub-Tab Name for [${activeMain}] (e.g. Wide Receivers, Blitz Pickup):`);
                    if (name && name.trim()) onAddSubTab(activeMain, name.trim());
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Sub-Tab</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Level 1: Main Category Ribbon */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2.5 no-scrollbar">
          {mainCategories.map((mainCat) => {
            const isActive = mainCat === activeMain;
            return (
              <div key={mainCat} className="flex items-center group relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelectMain(mainCat);
                    setSelectedSubFolder('all');
                    const firstSub =
                      guideOrder.sub[mainCat]?.[0] ||
                      Object.keys(guideTree[mainCat] || {})[0] ||
                      '';
                    if (firstSub) onSelectSub(firstSub);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all select-none border cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {mainCat}
                </button>
              </div>
            );
          })}
        </div>

        {/* Level 1.5: Well-Organized Sub-Folder System (for Defense / Schemes) */}
        {isDefensiveCategory && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 pr-1 shrink-0 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Folders:</span>
            </span>
            {DEFENSIVE_SUB_FOLDERS.map((folder) => {
              const isSelected = selectedSubFolder === folder.id;
              const count =
                folder.id === 'all'
                  ? currentSubTabs.length
                  : currentSubTabs.filter((s) => getSubTabCategory(s) === folder.id).length;

              if (folder.id !== 'all' && count === 0) return null;

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubFolder(folder.id);
                    const matching =
                      folder.id === 'all'
                        ? currentSubTabs
                        : currentSubTabs.filter((s) => getSubTabCategory(s) === folder.id);
                    if (matching.length > 0 && !matching.includes(activeSub)) {
                      onSelectSub(matching[0]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/50 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700/70'
                  }`}
                >
                  <span>{folder.icon}</span>
                  <span>{folder.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-amber-500/25 text-amber-900 dark:text-amber-200'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Level 2: Sub-Tabs Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl no-scrollbar">
          {visibleSubTabs.map((subTab) => {
            const isActive = subTab === activeSub;
            return (
              <button
                key={subTab}
                type="button"
                onClick={() => onSelectSub(subTab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all select-none border cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-slate-700'
                }`}
              >
                {subTab}
              </button>
            );
          })}
          {visibleSubTabs.length === 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 p-1">No plays found in this folder.</span>
          )}
        </div>
      </div>

      {/* Document Area */}
      <div className="bg-white dark:bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-xl p-5 space-y-4">
        {/* Document Action Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5 flex-wrap">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-black text-xs text-slate-800 dark:text-slate-200">
              Active Section: <span className="text-amber-700 dark:text-amber-300">{activeMain} &gt; {activeSub}</span>
            </span>

            {currentDocUrl ? (
              isCurrentHtml ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10.5px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                  <Code className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>HTML Code / Interactive</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 text-[10.5px] font-bold border border-sky-200 dark:border-sky-500/30">
                  <Globe className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>File / Cloud Document</span>
                </span>
              )
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">(Empty Section)</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Interactive Play Sheet vs Document / PDF */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('sheet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'sheet'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                📋 Whiteboard Play Sheet
              </button>
              <button
                type="button"
                onClick={() => setViewMode('doc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'doc'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                📄 Document / PDF View
              </button>
            </div>

            {/* Upload from Hudl Button */}
            <button
              type="button"
              onClick={() => setIsHudlUploadOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer transition-colors"
              title="Upload PDF or text playbook from Hudl and auto-redraw in interactive whiteboard"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload from Hudl</span>
            </button>

            {canManageDocs && (
              <>
                {/* HTML Code Editor / Creator Button */}
                <button
                  type="button"
                  onClick={handleOpenHtmlEditor}
                  title="Write or paste custom HTML code, styled diagrams, or HUDL/video embeds"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors active:scale-95"
                >
                  <Code className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isCurrentHtml ? 'Edit HTML Code' : '+ Add HTML Code'}</span>
                </button>

                {/* Upload File Button */}
                <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Upload PDF / HTML / Doc</span>
                  <input
                    type="file"
                    accept=".pdf,.html,.htm,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadDocument(activeMain, activeSub, file);
                      e.target.value = '';
                    }}
                  />
                </label>

                {/* Delete / Clear Document Content */}
                {currentDocUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Permanently delete the uploaded document or HTML code from [${activeMain} > ${activeSub}]?`)) {
                        onClearDocument(activeMain, activeSub);
                      }
                    }}
                    title="Delete document from this sub-tab"
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    <span>Delete Document</span>
                  </button>
                )}

                {/* Delete Entire Sub-Tab */}
                {currentSubTabs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete sub-tab "${activeSub}" from [${activeMain}]?`)) {
                        onDeleteSubTab(activeMain, activeSub);
                      }
                    }}
                    title={`Delete sub-tab "${activeSub}"`}
                    className="p-2 hover:bg-rose-950/60 text-rose-400 hover:text-rose-200 border border-transparent hover:border-rose-800/50 rounded-xl cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {/* Print Guide Button */}
            <button
              type="button"
              onClick={() => {
                setPrintScope('current');
                setIsPrintModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-indigo-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors active:scale-95"
              title="Print this playbook guide section or create a packet"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print Guide</span>
            </button>

            {currentDocUrl && (
              <button
                type="button"
                onClick={() => setIsFullScreenModalOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Fullscreen View</span>
              </button>
            )}
          </div>
        </div>

        {/* Document Frame / Interactive Whiteboard Sheet Viewer */}
        {viewMode === 'sheet' && matchingPlay ? (
          <PlaybookInteractiveSheet
            drill={matchingPlay}
            allPlays={allAvailablePlays}
            onSelectPlay={(p) => onSelectSub(p.title)}
            onBackToInstall={() => onSelectMain(activeMain)}
            onUpdateDrill={(updatedDrill) => {
              const updated = customPlays.map((p) => (p.id === updatedDrill.id ? updatedDrill : p));
              if (!updated.some((p) => p.id === updatedDrill.id)) {
                updated.push(updatedDrill);
              }
              setCustomPlays(updated);
              saveCustomWhiteboardDrills(updated);
            }}
          />
        ) : currentDocUrl ? (
          <FullDocumentViewer
            content={currentDocUrl}
            title={`${activeMain} - ${activeSub}`}
            categoryName={activeMain}
            subTabName={activeSub}
            onOpenFullScreen={() => setIsFullScreenModalOpen(true)}
          />
        ) : (
          <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl overflow-hidden min-h-[420px] flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-slate-200">
                No Document or HTML in [{activeMain} &gt; {activeSub}]
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Open the interactive whiteboard play sheet, upload a PDF playbook from Hudl to auto-redraw, or paste custom HTML code with responsive diagrams.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode('sheet');
                  if (!matchingPlay && allAvailablePlays.length > 0) {
                    onSelectSub(allAvailablePlays[0].title);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <span>📋 Open Whiteboard Play Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHudlUploadOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload from Hudl</span>
              </button>

              {userRole === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenHtmlEditor}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    <Code className="w-4 h-4" />
                    <span>+ Create HTML Playbook</span>
                  </button>

                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md border border-slate-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Upload PDF / File</span>
                    <input
                      type="file"
                      accept=".pdf,.html,.htm,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUploadDocument(activeMain, activeSub, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HTML Code Editor & Starter Template Modal */}
      {isHtmlEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    HTML Playbook &amp; Embed Editor
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Editing for section: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeMain} &gt; {activeSub}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHtmlEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Template Selector Ribbon */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                <span>Quick Starter HTML Templates:</span>
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {HTML_STARTER_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      if (
                        !htmlEditorCode ||
                        htmlEditorCode.trim() === '' ||
                        confirm(`Load "${tmpl.name}" template? This will replace current code in the editor.`)
                      ) {
                        setHtmlEditorCode(tmpl.code);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap cursor-pointer transition-colors active:scale-95"
                    title={tmpl.description}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switch Tabs (Editor / Live Preview) */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditorTab('code')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    editorTab === 'code'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>HTML Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    editorTab === 'preview'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Preview</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintHtmlEditorContent('tab')}
                  className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                  title="Print Preview this HTML design"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Print Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editor / Preview Body */}
            <div className="flex-1 min-h-[350px] max-h-[500px] overflow-hidden flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              {editorTab === 'code' ? (
                <textarea
                  value={htmlEditorCode}
                  onChange={(e) => setHtmlEditorCode(e.target.value)}
                  placeholder="Paste or write your HTML, CSS, SVG diagrams, table tags, or <iframe> embeds here..."
                  className="w-full h-full min-h-[350px] p-4 bg-transparent font-mono text-xs text-slate-900 dark:text-slate-200 border-0 focus:outline-none resize-none selection:bg-indigo-500 selection:text-white"
                  spellCheck={false}
                />
              ) : (
                <iframe
                  srcDoc={htmlEditorCode}
                  title="HTML Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  className="w-full h-full min-h-[350px] bg-white border-0"
                />
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                {htmlEditorCode.length.toLocaleString()} characters
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHtmlEditorOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveHtmlEditor}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Publish HTML</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Document Modal */}
      {isFullScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span className="font-black text-sm md:text-base">
                {activeMain} &gt; {activeSub} - Fullscreen View
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintSingleGuide(activeMain, activeSub, 'iframe')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 transition-all"
                title="Print this playbook guide"
              >
                <Printer className="w-4 h-4" />
                <span>Print Guide</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullScreenModalOpen(false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden mt-3 shadow-2xl">
            {isCurrentHtml ? (
              <iframe
                srcDoc={currentDocUrl}
                title="Fullscreen Playbook Guide"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                className="w-full h-full border-0"
              />
            ) : (
              <iframe
                src={currentDocUrl}
                title="Fullscreen Playbook Guide"
                className="w-full h-full border-0"
              />
            )}
          </div>
        </div>
      )}

      {/* Organize Tabs & Folders Modal */}
      {isOrganizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Organize Playbook Folders &amp; Tabs</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsOrganizeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Main Folders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-black text-[11px] text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  1. Playbook &amp; Category Folders ({mainCategories.length}):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Enter new Category / Playbook Folder Name (e.g. Special Teams, Pass Concepts):');
                    if (name && name.trim()) onAddMainFolder(name.trim());
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 p-2 rounded-2xl bg-slate-50 dark:bg-slate-950/80">
                {mainCategories.map((mainCat) => {
                  const subCount =
                    (guideOrder.sub && guideOrder.sub[mainCat]?.length) ||
                    Object.keys(guideTree[mainCat] || {}).length;
                  return (
                    <div
                      key={mainCat}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${
                        mainCat === activeMain
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span
                        onClick={() => {
                          onSelectMain(mainCat);
                          const firstSub =
                            guideOrder.sub[mainCat]?.[0] ||
                            Object.keys(guideTree[mainCat] || {})[0] ||
                            '';
                          if (firstSub) onSelectSub(firstSub);
                        }}
                        className="cursor-pointer hover:underline truncate max-w-[200px]"
                        title={`Select ${mainCat}`}
                      >
                        {mainCat} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">({subCount} tabs)</span>
                        {mainCat === activeMain ? ' 👈 (Active)' : ''}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveMainFolder(mainCat, -1)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveMainFolder(mainCat, 1)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newName = prompt('Rename Category:', mainCat);
                            if (newName && newName.trim() && newName !== mainCat)
                              onRenameMainFolder(mainCat, newName.trim());
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete Category Folder "${mainCat}" and all its ${subCount} sub-tabs?`
                              )
                            ) {
                              onDeleteMainFolder(mainCat);
                            }
                          }}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded cursor-pointer"
                          title="Delete Folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Sub-Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-black text-[11px] text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  2. Sub-Tabs in [{activeMain}] ({currentSubTabs.length}):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt(`Enter new Sub-Tab for [${activeMain}] (e.g. Quarterbacks, Red Zone):`);
                    if (name && name.trim()) onAddSubTab(activeMain, name.trim());
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Sub-Tab
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 p-2 rounded-2xl bg-slate-50 dark:bg-slate-950/80">
                {currentSubTabs.map((subTab) => {
                  const hasDoc = Boolean(guideTree[activeMain]?.[subTab]);
                  return (
                    <div
                      key={subTab}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${
                        subTab === activeSub
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span
                        onClick={() => onSelectSub(subTab)}
                        className="truncate cursor-pointer hover:underline max-w-[200px]"
                      >
                        {subTab} {hasDoc ? '📄' : ''}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveSubTab(activeMain, subTab, -1)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveSubTab(activeMain, subTab, 1)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newName = prompt('Rename Sub-Tab:', subTab);
                            if (newName && newName.trim() && newName !== subTab)
                              onRenameSubTab(activeMain, subTab, newName.trim());
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete sub-tab "${subTab}" from [${activeMain}]?`))
                              onDeleteSubTab(activeMain, subTab);
                          }}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded cursor-pointer"
                          title="Delete Sub-Tab"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {currentSubTabs.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-500">
                    No sub-tabs found for [{activeMain}]. Click &quot;Add Sub-Tab&quot; above to add one.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3.5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsOrganizeModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Playbook & Guides Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Print Playbook &amp; Guides</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    High-contrast, printer-friendly sideline sheets and complete team binders
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>1. Select Print Scope</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Current Sheet */}
                <button
                  type="button"
                  onClick={() => setPrintScope('current')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    printScope === 'current'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-white shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
                      <span>📄 Current Section</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1 truncate" title={`${activeMain} > ${activeSub}`}>
                      {activeSub}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {activeMain}
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-400 w-fit">
                    1 Single Sheet
                  </div>
                </button>

                {/* 2. Category Packet */}
                <button
                  type="button"
                  onClick={() => setPrintScope('category')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    printScope === 'category'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-white shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
                      <span>📑 Category Packet</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1 truncate" title={activeMain}>
                      {activeMain}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      All sub-tabs
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-900/60 text-amber-700 dark:text-amber-300 w-fit">
                    {currentSubTabs.length} Sections
                  </div>
                </button>

                {/* 3. Full Team Playbook Binder */}
                <button
                  type="button"
                  onClick={() => setPrintScope('all')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    printScope === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-white shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                      <span>📚 Full Binder</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">
                      Team Playbook
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Cover Page + TOC
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-900/60 text-emerald-700 dark:text-emerald-300 w-fit">
                    {totalSubTabsCount} Sections &bull; {mainCategories.length} Cats
                  </div>
                </button>
              </div>
            </div>

            {/* Pagination & Multi-Section Handling */}
            <div className="space-y-3">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/40 flex items-start gap-3">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Multi-Section Page Break Assurance</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-300 dark:border-indigo-400/40 font-mono">
                      page-break-after: always
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Every playbook section prints on its <strong>own separate page</strong>. If a complex play contains extensive diagrams and coaching assignments, it cleanly flows onto a <strong>2nd page</strong> without truncating, and the next section will always start on a brand new sheet.
                  </p>
                </div>
              </div>

              {printScope !== 'current' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <label htmlFor="cover-page-toggle" className="cursor-pointer flex items-center gap-2.5">
                    <input
                      id="cover-page-toggle"
                      type="checkbox"
                      checked={includeCoverPage}
                      onChange={(e) => setIncludeCoverPage(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 cursor-pointer accent-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-200">
                        Include Binder Cover Sheet &amp; Table of Contents
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Prints team title &amp; quick table of contents on Page 1. Playbook sections begin on Page 2.
                      </div>
                    </div>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                    includeCoverPage ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                  }`}>
                    {includeCoverPage ? '+1 Cover Sheet' : 'Plays Only'}
                  </span>
                </div>
              )}

              {printScope !== 'current' && availablePrintSections.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Sections to Print ({selectedSectionsCount} of {availablePrintSections.length})</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleSelectAllPrintSections(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-400 dark:text-slate-600">&bull;</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllPrintSections(false)}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2 border border-slate-200 dark:border-slate-800/80">
                    {availablePrintSections.map((sec, sIdx) => {
                      const isSelected = selectedPrintSubTabs[sec.key] !== false;
                      return (
                        <label
                          key={sec.key}
                          className={`flex items-center justify-between p-1.5 px-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white shadow-xs'
                              : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePrintSection(sec.key)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 cursor-pointer accent-indigo-500"
                            />
                            <span className="font-bold truncate">{sec.subTab}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase">
                              {sec.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-2">
                            Section {sIdx + 1}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Print Theme & Ink Format */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Print Styling &amp; Paper Mode
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrintInkFriendly(true)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    printInkFriendly
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                    printInkFriendly ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400 dark:border-slate-500'
                  }`}>
                    {printInkFriendly && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                      🖨️ Ink-Friendly Paper Mode (Recommended)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Clean white background, sharp black text, crisp borders. Saves expensive printer ink/toner.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintInkFriendly(false)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    !printInkFriendly
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                    !printInkFriendly ? 'border-indigo-500 bg-indigo-500' : 'border-slate-400 dark:border-slate-500'
                  }`}>
                    {!printInkFriendly && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                      🎨 Full Color / Original Theme
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Preserves dark backgrounds and original styles. Great for color PDFs and digital tablets.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Target Team & Pro-Tip Banner */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-200">
                  Team Target: {activeTeam?.name || 'Mahopac 10U Indians'} ({activeTeam?.season || activeTeam?.ageGroup || '10U Football'})
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  💡 In the system print dialog, choose <strong className="text-slate-800 dark:text-slate-200">&quot;Save as PDF&quot;</strong> to export an electronic playbook file to email or message to staff and families.
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecutePrint('tab')}
                  disabled={isPrintingLoading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Open formatted sheet in a new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Open in Print Tab</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecutePrint('iframe')}
                  disabled={isPrintingLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isPrintingLoading ? 'Preparing...' : 'Print Now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Hudl Playbook Upload & Auto-Redraw Modal */}
      <HudlPlaybookUploadModal
        isOpen={isHudlUploadOpen}
        onClose={() => setIsHudlUploadOpen(false)}
        onImportPlays={handleImportFromHudl}
        existingFolders={mainCategories}
      />
    </div>
  );
};
