import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
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
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  Layers,
  BarChart3,
  Search,
} from 'lucide-react';
import {
  ScoutingData,
  PlaybookGuideTree,
  PlaybookGuideOrder,
  UserRole,
  Team,
  ScoutingAttachment,
} from '../../types';
import {
  printCleanHTML,
  openCleanPrintTab,
  generatePlaybookGuidePrintHTML,
  generatePlaybookBinderPrintHTML,
} from '../../utils/printUtils';
import { FullDocumentViewer } from '../common/FullDocumentViewer';

interface TendenciesViewProps {
  scouting: ScoutingData;
  onUpdateScouting: (fieldOrUpdates: any, val?: any) => void;
  opponentName?: string;
  weekName?: string;
  userRole?: UserRole;
  activeTeam?: Team;
  onNavigateToScouting?: () => void;
}

const TENDENCY_STARTER_TEMPLATES = [
  {
    id: 'down_distance',
    name: '🏈 Down & Distance Tendency Matrix',
    description: 'Breakdown of Run vs. Pass % by 1st, 2nd, 3rd, and 4th down with primary play concepts',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px; max-width: 960px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 24px; color: #fbbf24; }
    .badge { background: #d97706; color: #020617; padding: 4px 12px; border-radius: 9999px; font-weight: 900; font-size: 12px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { background: #0f172a; color: #94a3b8; text-align: left; padding: 10px 14px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #334155; }
    td { padding: 12px 14px; border-bottom: 1px solid #334155; }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    .tag-run { background: #0369a1; color: #e0f2fe; padding: 2px 8px; border-radius: 6px; font-weight: bold; }
    .tag-pass { background: #b45309; color: #fef3c7; padding: 2px 8px; border-radius: 6px; font-weight: bold; }
    .notes-box { margin-top: 20px; background: #0f172a; border-left: 4px solid #fbbf24; padding: 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #cbd5e1; }
    .alert { color: #f87171; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1>DOWN &amp; DISTANCE RUN / PASS TENDENCIES</h1>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Film Sample: Last 3 Games • All Snaps Categorized</div>
      </div>
      <span class="badge">Early &amp; Late Downs</span>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 130px;">Situation</th>
          <th style="width: 110px;">Run / Pass %</th>
          <th>Top Run Concept</th>
          <th>Top Pass Concept</th>
          <th>Defensive Key &amp; Alert</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1st &amp; 10</strong></td>
          <td><span class="tag-run">72% Run</span></td>
          <td>Inside Zone Right / Power G</td>
          <td>Play-Action Bootleg / Post-Wheel</td>
          <td>Expect run off right tackle; ILBs fill downhill instantly.</td>
        </tr>
        <tr>
          <td><strong>2nd &amp; Short (&lt;4)</strong></td>
          <td><span class="tag-run">80% Run</span></td>
          <td>FB Lead Iso / Heavy Wedge</td>
          <td>Quick Pop to TE over Center</td>
          <td><span class="alert">ALERT:</span> Play-action deep shot down the boundary.</td>
        </tr>
        <tr>
          <td><strong>2nd &amp; Long (&gt;7)</strong></td>
          <td><span class="tag-pass">65% Pass</span></td>
          <td>Draw / Delay Weak</td>
          <td>Quick Out / Mesh Underneath</td>
          <td>Drop OLBs into flats; rally and tackle in space.</td>
        </tr>
        <tr>
          <td><strong>3rd &amp; Short (1-3)</strong></td>
          <td><span class="tag-run">85% Run</span></td>
          <td>QB Keeper / Off-Tackle Power</td>
          <td>Sprintout Flare</td>
          <td>Pinch defensive tackles; crash A-gaps.</td>
        </tr>
        <tr>
          <td><strong>3rd &amp; Medium (4-7)</strong></td>
          <td><span class="tag-pass">70% Pass</span></td>
          <td>Draw or Screen to RB</td>
          <td>50/50: Slants or Deep Out</td>
          <td>Sit at the first down marker; don't bite on pump fakes.</td>
        </tr>
        <tr>
          <td><strong>3rd &amp; Long (8+)</strong></td>
          <td><span class="tag-pass">90% Pass</span></td>
          <td>Draw only (Draw alert)</td>
          <td>Vertical routes with RB checkdown</td>
          <td>Bring 5-man pressure; force early throw under duress.</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-box">
      <strong>Coaching Key:</strong> On early downs, safety must walk down 8 yards from line of scrimmage to support the run fit. Watch for quick slot motion indicating jet sweep or counter.
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'defensive_fronts',
    name: '🛡️ Defensive Fronts & Blitz Tells',
    description: 'Opponent defensive alignments, coverage shells, and pre-snap blitz tells',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
    .wrapper { max-width: 960px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px; }
    .title { font-size: 24px; font-weight: 900; color: #38bdf8; margin-bottom: 6px; }
    .meta { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .box { background: #0f172a; border-radius: 12px; border: 1px solid #334155; padding: 18px; }
    h3 { margin-top: 0; color: #fbbf24; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    ul { margin: 8px 0 0 20px; padding: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
    .tell-tag { display: inline-block; background: #991b1b; color: #fecaca; font-weight: bold; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="title">🛡️ OPPONENT DEFENSIVE SCHEME &amp; BLITZ TELLS</div>
    <div class="meta">Analysis of base fronts, coverage rotations, and blitz pressure triggers</div>

    <div class="grid">
      <div class="box">
        <h3>Base Front: 4-4 / 5-3 Under</h3>
        <ul>
          <li><strong>Defensive Tackles:</strong> Shade 1-tech and 3-tech. Weakside 3-tech shoots the B-gap aggressively.</li>
          <li><strong>Defensive Ends:</strong> Tight 5-technique. Fast edge rushers who vulnerable to trap and kick-out blocks.</li>
          <li><strong>Linebackers:</strong> Stacked at 4.5 yards. Mike linebacker bites hard on first play-action step.</li>
          <li><strong>Weakness:</strong> C-gap bubble on the boundary side; cutback lanes open up quickly.</li>
        </ul>
      </div>

      <div class="box">
        <h3>Primary Coverage: Cover 3 Sky</h3>
        <ul>
          <li><strong>Free Safety:</strong> Single-high safety sits at 14 yards deep in middle of field.</li>
          <li><strong>Corners:</strong> Bail 7 yards deep at snap; vulnerable to quick hitches, outs, and comebacks.</li>
          <li><strong>Strong Safety:</strong> Steps into box as 8th defender to play curl/flat.</li>
          <li><strong>Attacking Rule:</strong> Seam routes between CB and FS; flood concepts against the rolled-up safety.</li>
        </ul>
      </div>

      <div class="box">
        <h3>Pre-Snap Blitz Tells</h3>
        <div><span class="tell-tag">A-GAP FIRE ZONE</span></div>
        <ul>
          <li>Mike LB creeps forward to 2 yards off ball when safety drops low.</li>
          <li>Nose Tackle tilts inward toward center's helmet.</li>
          <li><strong>Offensive Answer:</strong> Check to Quick Slant or Hot Out to slot WR.</li>
        </ul>
      </div>

      <div class="box">
        <h3>Corner / Edge Pressure Tell</h3>
        <div><span class="tell-tag">BOUNDARY EDGE BLITZ</span></div>
        <ul>
          <li>Boundary CB tightens to 2 yards off LOS with inside leverage.</li>
          <li>FS cheats over toward the boundary hash to replace corner's deep third.</li>
          <li><strong>Offensive Answer:</strong> Bubble screen or quick hitch away from pressure.</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'formations_personnel',
    name: '📐 Formations & Motion Tendencies',
    description: 'Alignments, strength calls, and motion tells mapped to run/pass rates',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px; max-width: 960px; margin: 0 auto; }
    h1 { color: #34d399; margin-top: 0; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th { background: #0f172a; color: #94a3b8; text-align: left; padding: 10px; border-bottom: 2px solid #334155; }
    td { padding: 10px; border-bottom: 1px solid #334155; }
    .rate-badge { font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .rate-run { background: #0284c7; color: white; }
    .rate-pass { background: #ea580c; color: white; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📐 FORMATIONS &amp; MOTION TENDENCIES</h1>
    <table>
      <thead>
        <tr>
          <th>Formation Name</th>
          <th>Personnel</th>
          <th>Tendency</th>
          <th>Primary Plays</th>
          <th>Motion / Pre-Snap Tells</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Trips Right Open</strong></td>
          <td>11 Personnel</td>
          <td><span class="rate-badge rate-pass">75% Pass</span></td>
          <td>Tunnel Screen, Smash, Dig</td>
          <td>If RB is on trips side, pass rate increases to 88%.</td>
        </tr>
        <tr>
          <td><strong>Pistol Strong I</strong></td>
          <td>21 Personnel</td>
          <td><span class="rate-badge rate-run">85% Run</span></td>
          <td>Power O, Stretch, Counter</td>
          <td>TE trade across formation signals weakside counter.</td>
        </tr>
        <tr>
          <td><strong>2x2 Spread</strong></td>
          <td>10 Personnel</td>
          <td><span class="rate-badge rate-pass">60% Pass</span></td>
          <td>Inside Zone / Quick Slants RPO</td>
          <td>Slot WR off ball motions across formation into flat.</td>
        </tr>
        <tr>
          <td><strong>Heavy Wing-T / T-Bone</strong></td>
          <td>22 Personnel</td>
          <td><span class="rate-badge rate-run">92% Run</span></td>
          <td>Buck Sweep, Trap, Wedge</td>
          <td>Fullback always takes dive; Wingback takes handoff outside.</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`,
  },
  {
    id: 'film_embed',
    name: '🎥 Video & HUDL Cutup Embed Frame',
    description: 'Responsive container for HUDL cutups, YouTube film study, or film links',
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
    .notes h3 { margin-top: 0; font-size: 15px; color: #fbbf24; }
    .notes ul { margin: 8px 0 0 20px; padding: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="title">🎬 OPPONENT FILM STUDY &amp; CUTUPS</div>
    <div class="meta">Paste your HUDL embed link, YouTube video ID, or video URL in the iframe below:</div>

    <div class="video-container">
      <iframe 
        src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" 
        title="Opponent Film Breakdown" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>

    <div class="notes">
      <h3>Key Film Teaching Points:</h3>
      <ul>
        <li><strong>Play 1 (0:15)</strong> - Notice the defense shifts to 5-man front when TE attaches to tackle.</li>
        <li><strong>Play 8 (1:45)</strong> - QB always rolls to his right under pressure; weakside pursuit has easy sack.</li>
        <li><strong>Play 14 (3:10)</strong> - Boundary CB doesn't maintain outside leverage on stretch run.</li>
      </ul>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'red_zone',
    name: '🎯 Red Zone & Goal Line Tendencies',
    description: 'Situational play calling inside the 20 and 5 yard line',
    code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { color: #f87171; margin-top: 0; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th { background: #0f172a; color: #94a3b8; text-align: left; padding: 10px; border-bottom: 2px solid #334155; }
    td { padding: 10px; border-bottom: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎯 RED ZONE &amp; GOAL LINE TENDENCIES</h1>
    <table>
      <thead>
        <tr>
          <th>Zone</th>
          <th>Run / Pass</th>
          <th>Favorite Calls</th>
          <th>Go-To Target / Ball Carrier</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Plus 20 to Plus 10</strong></td>
          <td>60% Run / 40% Pass</td>
          <td>Off-tackle stretch, Corner fade to WR1</td>
          <td>#7 QB / #24 RB</td>
        </tr>
        <tr>
          <td><strong>Plus 10 to Plus 5</strong></td>
          <td>70% Run / 30% Pass</td>
          <td>Inside Zone, TE Pop Pass seam</td>
          <td>#88 Tight End on sneak route</td>
        </tr>
        <tr>
          <td><strong>Inside the 5 (Goal Line)</strong></td>
          <td>90% Run / 10% Pass</td>
          <td>Heavy QB Sneak, Fullback Dive</td>
          <td>#7 QB behind Center</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`,
  },
  {
    id: 'blank_tendencies',
    name: '✨ Blank HTML5 Tendencies Sheet',
    description: 'Clean modern boilerplate to write custom charts, matrices, or embeds',
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
      max-width: 900px;
      margin: 0 auto;
      background: #1e293b;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid #334155;
    }
    h1 { color: #fbbf24; margin-top: 0; }
    p { color: #cbd5e1; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Opponent Tendency Breakdown</h1>
    <p>Type or paste your custom tendency charts, tables, diagrams, or embed widgets here.</p>
  </div>
</body>
</html>`,
  },
];

const DEFAULT_MAIN_CATEGORIES = [
  'Opponent Offense',
  'Opponent Defense',
  'Down & Distance',
  'Formations & Motions',
  'Red Zone & Specials',
];

const DEFAULT_SUB_TABS: Record<string, string[]> = {
  'Opponent Offense': ['Run vs Pass Tendencies', 'Top Pass Concepts', 'Backfield Actions & Counters'],
  'Opponent Defense': ['Fronts & Alignments', 'Coverage Shells', 'Blitz Packages & Pressures'],
  'Down & Distance': ['1st & 10 Tendencies', '2nd Down Run/Pass', '3rd Down & Blitz Alerts', '4th Down Go-For-It'],
  'Formations & Motions': ['Spread & Trips Looks', 'Heavy & Pistol Sets', 'Motion Tells & Adjustments'],
  'Red Zone & Specials': ['Red Zone (Inside 20)', 'Goal Line Heavy', 'Special Teams & Fake Alerts'],
};

export const TendenciesView: React.FC<TendenciesViewProps> = ({
  scouting,
  onUpdateScouting,
  opponentName = 'Opponent',
  weekName = 'Game Week',
  userRole = 'coach',
  activeTeam,
  onNavigateToScouting,
}) => {
  // Extract or initialize the Tendencies tree and order
  const tendenciesTree: PlaybookGuideTree = useMemo(() => {
    const base: PlaybookGuideTree = {};
    if (scouting.tendenciesTree && Object.keys(scouting.tendenciesTree).length > 0) {
      Object.entries(scouting.tendenciesTree).forEach(([k, v]) => {
        base[k] = { ...v };
      });
    } else {
      // Initial fallback tree
      DEFAULT_MAIN_CATEGORIES.forEach((cat) => {
        base[cat] = {};
        const subs = DEFAULT_SUB_TABS[cat] || ['Overview'];
        subs.forEach((sub) => {
          base[cat][sub] = '';
        });
      });
    }

    // Always bridge pre-existing attachments into the tree under "Imported Reports" if not already present
    if (scouting.attachments && scouting.attachments.length > 0) {
      if (!base['Imported Reports']) {
        base['Imported Reports'] = {};
      }
      scouting.attachments.forEach((a) => {
        // Only bridge if this report slot was not explicitly cleared (empty string = deleted)
        if (base['Imported Reports'][a.name] === undefined) {
          base['Imported Reports'][a.name] = a.htmlCode || a.dataUrl || (a as any).fileUrl || '';
        }
      });
    }

    return base;
  }, [scouting.tendenciesTree, scouting.attachments]);

  const tendenciesOrder: PlaybookGuideOrder = useMemo(() => {
    const existingOrder = scouting.tendenciesOrder;
    const treeMains = Object.keys(tendenciesTree);

    let mains: string[] = [];
    if (existingOrder && existingOrder.main && existingOrder.main.length > 0) {
      mains = [...existingOrder.main];
      treeMains.forEach((m) => {
        if (!mains.includes(m)) {
          mains.push(m);
        }
      });
    } else {
      mains = treeMains.length > 0 ? treeMains : DEFAULT_MAIN_CATEGORIES;
    }

    const subMap: Record<string, string[]> = {};
    mains.forEach((m) => {
      const treeSubs = Object.keys(tendenciesTree[m] || {});
      const existingSubs = existingOrder?.sub?.[m];
      if (existingSubs && existingSubs.length > 0) {
        subMap[m] = [...existingSubs];
        treeSubs.forEach((s) => {
          if (!subMap[m].includes(s)) {
            subMap[m].push(s);
          }
        });
      } else {
        subMap[m] = treeSubs;
      }
    });

    return {
      main: mains,
      sub: subMap,
    };
  }, [scouting.tendenciesOrder, tendenciesTree]);

  // Main Categories and Sub Tabs
  const mainCategories = useMemo(() => {
    if (tendenciesOrder.main && tendenciesOrder.main.length > 0) {
      return tendenciesOrder.main;
    }
    const keys = Object.keys(tendenciesTree);
    return keys.length > 0 ? keys : DEFAULT_MAIN_CATEGORIES;
  }, [tendenciesOrder.main, tendenciesTree]);

  // Active Category & Sub-Tab state
  const [activeMain, setActiveMain] = useState<string>(() => mainCategories[0] || 'Opponent Offense');

  // Keep activeMain valid if categories change
  const safeActiveMain = mainCategories.includes(activeMain) ? activeMain : mainCategories[0] || 'Opponent Offense';

  const currentSubTabs = useMemo(() => {
    if (tendenciesOrder.sub && tendenciesOrder.sub[safeActiveMain]) {
      return tendenciesOrder.sub[safeActiveMain];
    }
    return Object.keys(tendenciesTree[safeActiveMain] || {});
  }, [tendenciesOrder.sub, safeActiveMain, tendenciesTree]);

  const [activeSub, setActiveSub] = useState<string>(() => currentSubTabs[0] || 'Run vs Pass Tendencies');

  // Keep activeSub valid
  const safeActiveSub = currentSubTabs.includes(activeSub) ? activeSub : currentSubTabs[0] || '';

  const currentDocUrl = tendenciesTree[safeActiveMain]?.[safeActiveSub] || '';

  // UI state
  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);
  const [organizeCategory, setOrganizeCategory] = useState<string>(safeActiveMain);
  const [isFullScreenModalOpen, setIsFullScreenModalOpen] = useState(false);
  const [isHtmlEditorOpen, setIsHtmlEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');
  const [htmlEditorCode, setHtmlEditorCode] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-app Input/Rename Dialog State (safe against iframe prompt blocking)
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    value: string;
    placeholder?: string;
    confirmLabel?: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    value: '',
    onConfirm: () => {},
  });

  // In-app Confirmation Dialog State (safe against iframe confirm blocking)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Printing state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'current' | 'category' | 'all'>('current');
  const [printInkFriendly, setPrintInkFriendly] = useState(true);
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [selectedPrintSubTabs, setSelectedPrintSubTabs] = useState<Record<string, boolean>>({});
  const [isPrintingLoading, setIsPrintingLoading] = useState(false);

  // Hidden File Input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

  // --- MUTATION HELPERS ---

  const saveTreeAndOrder = (
    newTree: PlaybookGuideTree,
    newOrder?: PlaybookGuideOrder,
    extraUpdates?: Partial<ScoutingData>
  ) => {
    try {
      onUpdateScouting({
        tendenciesTree: newTree,
        ...(newOrder ? { tendenciesOrder: newOrder } : {}),
        ...(extraUpdates || {}),
      });
    } catch {
      onUpdateScouting('tendenciesTree', newTree);
      if (newOrder) onUpdateScouting('tendenciesOrder', newOrder);
      if (extraUpdates?.attachments) onUpdateScouting('attachments', extraUpdates.attachments);
    }
  };

  // Upload Document (PDF or HTML)
  const handleUploadDocument = (main: string, sub: string, file: File) => {
    const isHtmlFile =
      file.name.toLowerCase().endsWith('.html') ||
      file.name.toLowerCase().endsWith('.htm') ||
      file.type === 'text/html';

    if (isHtmlFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        const updatedTree = {
          ...tendenciesTree,
          [main]: {
            ...(tendenciesTree[main] || {}),
            [sub]: content,
          },
        };
        saveTreeAndOrder(updatedTree);
        showToast(`Uploaded HTML tendencies "${file.name}" to [${main} > ${sub}]`);
      };
      reader.readAsText(file);
      return;
    }

    // For PDF or image, convert to Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) || '';
      const updatedTree = {
        ...tendenciesTree,
        [main]: {
          ...(tendenciesTree[main] || {}),
          [sub]: dataUrl,
        },
      };
      saveTreeAndOrder(updatedTree);
      showToast(`Uploaded "${file.name}" to [${main} > ${sub}]`);
    };
    reader.readAsDataURL(file);
  };

  // Save HTML Editor content
  const handleSaveHtmlContent = (main: string, sub: string, html: string) => {
    const updatedTree = {
      ...tendenciesTree,
      [main]: {
        ...(tendenciesTree[main] || {}),
        [sub]: html,
      },
    };
    saveTreeAndOrder(updatedTree);
    setIsHtmlEditorOpen(false);
    showToast(`Saved HTML tendencies to [${main} > ${sub}]`);
  };

  // Clear / Delete Document
  const handleDeleteCurrentDocument = (main: string, sub: string) => {
    const targetMain = main || safeActiveMain;
    const targetSub = sub || safeActiveSub;
    const docToDelete = tendenciesTree[targetMain]?.[targetSub] || currentDocUrl || '';

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: `Are you sure you want to delete the uploaded document or HTML from [${targetMain} > ${targetSub}]? This will remove the file from this tab.`,
      confirmLabel: 'Delete Document',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updatedTree: PlaybookGuideTree = {
          ...tendenciesTree,
          [targetMain]: {
            ...(tendenciesTree[targetMain] || {}),
            [targetSub]: '',
          },
        };

        // If there is any legacy matching attachment in scouting.attachments, also remove it
        let extraUpdates: Partial<ScoutingData> | undefined = undefined;
        if (scouting.attachments && scouting.attachments.length > 0) {
          const filteredAttachments = scouting.attachments.filter((a) => {
            if (a.name === targetSub || a.id === targetSub) return false;
            if (docToDelete && (a.dataUrl === docToDelete || a.htmlCode === docToDelete || (a as any).fileUrl === docToDelete)) {
              return false;
            }
            return true;
          });
          extraUpdates = { attachments: filteredAttachments };
        }

        saveTreeAndOrder(updatedTree, undefined, extraUpdates);
        showToast(`Deleted document from [${targetMain} > ${targetSub}]`);
      },
    });
  };

  // Add Category Folder
  const handleAddMainFolder = (name: string) => {
    if (!name.trim()) return;
    const clean = name.trim();
    if (tendenciesTree[clean]) {
      showToast(`Category "${clean}" already exists.`);
      return;
    }
    const updatedTree = {
      ...tendenciesTree,
      [clean]: { 'Tendencies Overview': '' },
    };
    const updatedOrder = {
      main: [...mainCategories, clean],
      sub: {
        ...(tendenciesOrder.sub || {}),
        [clean]: ['Tendencies Overview'],
      },
    };
    saveTreeAndOrder(updatedTree, updatedOrder);
    setActiveMain(clean);
    setActiveSub('Tendencies Overview');
    setOrganizeCategory(clean);
    showToast(`Created category "${clean}"`);
  };

  // Add Sub-Tab
  const handleAddSubTab = (main: string, name: string) => {
    if (!name.trim()) return;
    const clean = name.trim();
    const updatedTree = {
      ...tendenciesTree,
      [main]: {
        ...(tendenciesTree[main] || {}),
        [clean]: '',
      },
    };
    const existingSubs = tendenciesOrder.sub?.[main] || currentSubTabs;
    const updatedOrder = {
      ...tendenciesOrder,
      sub: {
        ...(tendenciesOrder.sub || {}),
        [main]: [...existingSubs.filter((s) => s !== clean), clean],
      },
    };
    saveTreeAndOrder(updatedTree, updatedOrder);
    setActiveSub(clean);
    showToast(`Added sub-tab "${clean}" to [${main}]`);
  };

  // Rename Category Folder
  const handleRenameMainFolder = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const clean = newName.trim();
    const updatedTree = { ...tendenciesTree };
    updatedTree[clean] = updatedTree[oldName] || {};
    delete updatedTree[oldName];

    const updatedOrder = {
      main: [...tendenciesOrder.main],
      sub: { ...tendenciesOrder.sub },
    };
    const mIdx = updatedOrder.main.indexOf(oldName);
    if (mIdx !== -1) {
      updatedOrder.main[mIdx] = clean;
    } else {
      updatedOrder.main.push(clean);
    }
    if (updatedOrder.sub[oldName]) {
      updatedOrder.sub[clean] = updatedOrder.sub[oldName];
      delete updatedOrder.sub[oldName];
    }

    saveTreeAndOrder(updatedTree, updatedOrder);
    if (activeMain === oldName) setActiveMain(clean);
    if (organizeCategory === oldName) setOrganizeCategory(clean);
    showToast(`Renamed category to "${clean}"`);
  };

  // Rename Sub-Tab
  const handleRenameSubTab = (main: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const clean = newName.trim();
    const updatedTree: PlaybookGuideTree = { ...tendenciesTree };
    if (updatedTree[main]) {
      const val = updatedTree[main][oldName] ?? '';
      const newCategoryMap = { ...updatedTree[main] };
      delete newCategoryMap[oldName];
      newCategoryMap[clean] = val;
      updatedTree[main] = newCategoryMap;
    }

    const updatedOrder: PlaybookGuideOrder = {
      main: [...tendenciesOrder.main],
      sub: { ...tendenciesOrder.sub },
    };
    const currentSubs = updatedOrder.sub[main] || Object.keys(updatedTree[main] || {});
    const sIdx = currentSubs.indexOf(oldName);
    if (sIdx !== -1) {
      const newSubs = [...currentSubs];
      newSubs[sIdx] = clean;
      updatedOrder.sub[main] = newSubs;
    } else {
      updatedOrder.sub[main] = [...currentSubs.filter((s) => s !== oldName), clean];
    }

    // If there is any matching attachment in scouting.attachments, also update its name
    let updatedAttachments: ScoutingAttachment[] | undefined = undefined;
    if (scouting.attachments && scouting.attachments.length > 0) {
      const hasMatch = scouting.attachments.some((a) => a.name === oldName || a.id === oldName);
      if (hasMatch) {
        updatedAttachments = scouting.attachments.map((a) => {
          if (a.name === oldName || a.id === oldName) {
            return { ...a, name: clean };
          }
          return a;
        });
      }
    }

    saveTreeAndOrder(updatedTree, updatedOrder, updatedAttachments ? { attachments: updatedAttachments } : undefined);
    if (activeSub === oldName) setActiveSub(clean);
    showToast(`Renamed to "${clean}"`);
  };

  // Delete Category Folder
  const handleDeleteMainFolder = (name: string) => {
    if (mainCategories.length <= 1) {
      showToast('You must keep at least one category folder.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Category Folder',
      message: `Permanently delete category folder "${name}" and all sub-tabs inside it?`,
      confirmLabel: 'Delete Category',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updatedTree = { ...tendenciesTree };
        delete updatedTree[name];

        const updatedOrder = {
          main: tendenciesOrder.main.filter((m) => m !== name),
          sub: { ...tendenciesOrder.sub },
        };
        delete updatedOrder.sub[name];

        let extraUpdates: Partial<ScoutingData> | undefined = undefined;
        if (name === 'Imported Reports' && scouting.attachments && scouting.attachments.length > 0) {
          extraUpdates = { attachments: [] };
        }

        saveTreeAndOrder(updatedTree, updatedOrder, extraUpdates);
        const nextMain = updatedOrder.main[0] || '';
        setActiveMain(nextMain);
        setActiveSub(updatedOrder.sub[nextMain]?.[0] || '');
        if (organizeCategory === name) setOrganizeCategory(nextMain);
        showToast(`Deleted category "${name}"`);
      },
    });
  };

  // Delete Sub-Tab
  const handleDeleteSubTab = (main: string, name: string) => {
    const subsInMain = tendenciesOrder.sub?.[main] || Object.keys(tendenciesTree[main] || {});
    if (subsInMain.length <= 1) {
      showToast('You must keep at least one sub-tab in this category folder.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Sub-Tab / Report',
      message: `Permanently delete sub-tab "${name}" from [${main}] and any uploaded document inside it?`,
      confirmLabel: 'Delete Sub-Tab',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updatedTree: PlaybookGuideTree = { ...tendenciesTree };
        if (updatedTree[main]) {
          delete updatedTree[main][name];
        }

        const updatedOrder = {
          main: [...tendenciesOrder.main],
          sub: { ...tendenciesOrder.sub },
        };
        if (updatedOrder.sub[main]) {
          updatedOrder.sub[main] = updatedOrder.sub[main].filter((s) => s !== name);
        }

        let extraUpdates: Partial<ScoutingData> | undefined = undefined;
        if (scouting.attachments && scouting.attachments.length > 0) {
          const filtered = scouting.attachments.filter((a) => a.name !== name && a.id !== name);
          if (filtered.length !== scouting.attachments.length) {
            extraUpdates = { attachments: filtered };
          }
        }

        saveTreeAndOrder(updatedTree, updatedOrder, extraUpdates);
        const nextSub = updatedOrder.sub[main]?.[0] || '';
        if (activeSub === name) setActiveSub(nextSub);
        showToast(`Deleted sub-tab "${name}"`);
      },
    });
  };

  // Dialog opener helpers
  const openRenameCategory = (cat: string) => {
    setInputDialog({
      isOpen: true,
      title: 'Rename Category Folder',
      subtitle: `Update name for category "${cat}"`,
      value: cat,
      placeholder: 'e.g. Opponent Offense, Blitz Tells...',
      confirmLabel: 'Save Category',
      onConfirm: (newName) => handleRenameMainFolder(cat, newName),
    });
  };

  const openRenameSubTab = (main: string, sub: string) => {
    setInputDialog({
      isOpen: true,
      title: 'Rename Report / Sub-Tab',
      subtitle: `Update name for [${main} > ${sub}]`,
      value: sub,
      placeholder: 'e.g. Run vs Pass, Blitz Pickup, Report 1...',
      confirmLabel: 'Save Name',
      onConfirm: (newName) => handleRenameSubTab(main, sub, newName),
    });
  };

  const openAddCategory = () => {
    setInputDialog({
      isOpen: true,
      title: 'Add Category Folder',
      subtitle: 'Create a new top-level category folder for game tendencies',
      value: '',
      placeholder: 'e.g. 3rd Down Blitzes, Red Zone, Personnel...',
      confirmLabel: 'Create Category',
      onConfirm: (name) => handleAddMainFolder(name),
    });
  };

  const openAddSubTab = (main: string) => {
    setInputDialog({
      isOpen: true,
      title: `Add Sub-Tab in [${main}]`,
      subtitle: `Create a new sub-tab / report section inside "${main}"`,
      value: '',
      placeholder: 'e.g. Empty Formations, 2-Minute Drill, Report...',
      confirmLabel: 'Create Sub-Tab',
      onConfirm: (name) => handleAddSubTab(main, name),
    });
  };

  // Move Category Folder
  const handleMoveMainFolder = (name: string, direction: number) => {
    const idx = tendenciesOrder.main.indexOf(name);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tendenciesOrder.main.length) return;

    const newMain = [...tendenciesOrder.main];
    const [removed] = newMain.splice(idx, 1);
    newMain.splice(newIdx, 0, removed);

    const updatedOrder = { ...tendenciesOrder, main: newMain };
    saveTreeAndOrder(tendenciesTree, updatedOrder);
  };

  // Move Sub-Tab
  const handleMoveSubTab = (main: string, name: string, direction: number) => {
    const subs = tendenciesOrder.sub[main] || currentSubTabs;
    const idx = subs.indexOf(name);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= subs.length) return;

    const newSubs = [...subs];
    const [removed] = newSubs.splice(idx, 1);
    newSubs.splice(newIdx, 0, removed);

    const updatedOrder = {
      ...tendenciesOrder,
      sub: {
        ...tendenciesOrder.sub,
        [main]: newSubs,
      },
    };
    saveTreeAndOrder(tendenciesTree, updatedOrder);
  };

  // Open HTML Editor
  const handleOpenHtmlEditor = () => {
    setHtmlEditorCode(currentDocUrl && isCurrentHtml ? currentDocUrl : TENDENCY_STARTER_TEMPLATES[0].code);
    setEditorTab('code');
    setIsHtmlEditorOpen(true);
  };

  // Copy HTML code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlEditorCode);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // --- PRINTING LOGIC ---
  const handlePrintSingleSection = (cat: string, sub: string, mode: 'iframe' | 'tab' = 'iframe') => {
    const content = tendenciesTree[cat]?.[sub] || '';
    const teamTitle = activeTeam?.name || 'Football Team';
    const oppTitle = opponentName || 'Opponent';

    if (content && (content.startsWith('data:application/pdf') || content.endsWith('.pdf'))) {
      if (mode === 'tab') {
        window.open(content, '_blank');
      } else {
        printCleanHTML(
          `<iframe src="${content}" style="width:100%;height:100vh;border:none;"></iframe>`,
          `${teamTitle} - ${oppTitle} Tendencies - ${sub}`
        );
      }
      return;
    }

    const html = generatePlaybookGuidePrintHTML({
      teamName: teamTitle,
      teamSeason: `${weekName} vs. ${oppTitle}`,
      category: `Tendencies: ${cat}`,
      subTab: sub,
      content,
      inkFriendly: printInkFriendly,
    });

    const docTitle = `${teamTitle} - ${oppTitle} Tendencies - ${sub}`;
    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
    } else {
      printCleanHTML(html, docTitle);
    }
  };

  const handlePrintCategoryPacket = (category: string, mode: 'iframe' | 'tab' = 'iframe') => {
    const subTabs = tendenciesOrder.sub?.[category] || Object.keys(tendenciesTree[category] || {});
    const teamTitle = activeTeam?.name || 'Football Team';
    const oppTitle = opponentName || 'Opponent';

    const activeSubs = subTabs.filter(
      (sub) => selectedPrintSubTabs[`${category}__${sub}`] !== false
    );

    if (activeSubs.length === 0) {
      alert('Please select at least one tendency section to print.');
      return;
    }

    const sections = activeSubs.map((sub) => ({
      category: `Tendencies: ${category}`,
      subTab: sub,
      content: tendenciesTree[category]?.[sub] || '',
    }));

    const html = generatePlaybookBinderPrintHTML({
      teamName: teamTitle,
      teamSeason: `${weekName} vs. ${oppTitle}`,
      headCoachName: activeTeam?.headCoachName || '',
      title: `${category.toUpperCase()} TENDENCY PACKET`,
      sections,
      inkFriendly: printInkFriendly,
      includeCoverPage: includeCoverPage,
    });

    const docTitle = `${teamTitle} - ${oppTitle} - ${category} Packet`;
    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
    } else {
      printCleanHTML(html, docTitle);
    }
  };

  const handlePrintFullBinder = (mode: 'iframe' | 'tab' = 'iframe') => {
    const teamTitle = activeTeam?.name || 'Football Team';
    const oppTitle = opponentName || 'Opponent';

    const sections: Array<{ category: string; subTab: string; content: string }> = [];
    mainCategories.forEach((cat) => {
      const subs = tendenciesOrder.sub?.[cat] || Object.keys(tendenciesTree[cat] || {});
      subs.forEach((sub) => {
        if (selectedPrintSubTabs[`${cat}__${sub}`] !== false) {
          sections.push({
            category: `Tendencies: ${cat}`,
            subTab: sub,
            content: tendenciesTree[cat]?.[sub] || '',
          });
        }
      });
    });

    if (sections.length === 0) {
      alert('Please select at least one tendency section to print.');
      return;
    }

    const html = generatePlaybookBinderPrintHTML({
      teamName: teamTitle,
      teamSeason: `${weekName} vs. ${oppTitle}`,
      headCoachName: activeTeam?.headCoachName || '',
      title: `COMPLETE OPPONENT SCOUTING & TENDENCIES BINDER`,
      sections,
      inkFriendly: printInkFriendly,
      includeCoverPage: includeCoverPage,
    });

    const docTitle = `${teamTitle} - vs ${oppTitle} Complete Tendencies Binder`;
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
        handlePrintSingleSection(safeActiveMain, safeActiveSub, mode);
      } else if (printScope === 'category') {
        handlePrintCategoryPacket(safeActiveMain, mode);
      } else {
        handlePrintFullBinder(mode);
      }
      setIsPrintModalOpen(false);
    } finally {
      setTimeout(() => setIsPrintingLoading(false), 800);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.html,.htm,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadDocument(safeActiveMain, safeActiveSub, file);
          }
          e.target.value = '';
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-500/95 text-white text-xs font-black px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-500/20 border border-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white hover:text-emerald-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/80 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 border border-amber-500/40 text-amber-200 flex items-center justify-center font-black shadow-lg shadow-amber-600/20">
              <TrendingUp className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base md:text-xl text-slate-100 tracking-tight flex items-center gap-2">
                  <span>Opponent Tendencies &amp; Film Study</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                  vs {opponentName} • {weekName}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Upload PDFs, write interactive HTML tendency sheets, organize film breakdown folders, and print packets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToScouting && (
              <button
                type="button"
                onClick={onNavigateToScouting}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Return to Scouting Report"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <span>Scouting Report</span>
              </button>
            )}

            {/* Print Button */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Print tendency sheets, folder packet, or full team scouting binder"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tendencies</span>
            </button>

            {/* Organize Folders & Tabs */}
            <button
              type="button"
              onClick={() => setIsOrganizeModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Reorder, rename, or delete category folders and sub-tabs"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Organize Folders &amp; Tabs</span>
            </button>

            {/* Add Category Folder */}
            <button
              type="button"
              onClick={openAddCategory}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Add a new category folder"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Category Folder</span>
            </button>

            {/* Add Sub-Tab */}
            <button
              type="button"
              onClick={() => openAddSubTab(safeActiveMain)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title={`Add sub-tab / report to [${safeActiveMain}]`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Sub-Tab</span>
            </button>
          </div>
        </div>

        {/* Level 1: Main Category Ribbon */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2.5 no-scrollbar">
          {mainCategories.map((mainCat) => {
            const isActive = mainCat === safeActiveMain;
            return (
              <div key={mainCat} className="flex items-center group relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMain(mainCat);
                    const firstSub =
                      tendenciesOrder.sub?.[mainCat]?.[0] ||
                      Object.keys(tendenciesTree[mainCat] || {})[0] ||
                      '';
                    if (firstSub) setActiveSub(firstSub);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all select-none border cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-900 hover:bg-slate-750 text-slate-200 border-slate-700'
                  }`}
                >
                  <span>{mainCat}</span>
                  {isActive && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameCategory(mainCat);
                      }}
                      className="p-0.5 hover:bg-amber-500/40 rounded text-slate-900 hover:text-black transition-colors"
                      title={`Rename category "${mainCat}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Level 2: Sub-Tabs Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-slate-900/90 border border-slate-700 rounded-2xl no-scrollbar">
          {currentSubTabs.map((subTab) => {
            const isActive = subTab === safeActiveSub;
            const hasDoc = Boolean(tendenciesTree[safeActiveMain]?.[subTab]);
            return (
              <div key={subTab} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveSub(subTab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all select-none border cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>{subTab}</span>
                  {hasDoc && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has Document" />}
                  {isActive && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameSubTab(safeActiveMain, subTab);
                      }}
                      className="p-0.5 hover:bg-indigo-700/60 rounded text-indigo-200 hover:text-white transition-colors"
                      title={`Rename sub-tab "${subTab}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {currentSubTabs.length === 0 && (
            <span className="text-xs text-slate-400 p-1">No sub-tabs found. Click &quot;+ Add Sub-Tab&quot; above to create one.</span>
          )}
        </div>
      </div>

      {/* Document Area */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 space-y-4">
        {/* Document Action Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-2.5 flex-wrap">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="font-black text-xs text-slate-200 flex items-center gap-1.5">
              Active Section: <span className="text-amber-300">{safeActiveMain} &gt; {safeActiveSub}</span>
            </span>

            {safeActiveSub && (
              <button
                type="button"
                onClick={() => openRenameSubTab(safeActiveMain, safeActiveSub)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 hover:border-amber-400/40 flex items-center gap-1 transition-colors cursor-pointer"
                title={`Rename sub-tab / report "${safeActiveSub}"`}
              >
                <Edit2 className="w-3 h-3 text-amber-400" />
                <span>Rename Tab / Report</span>
              </button>
            )}

            {currentDocUrl ? (
              isCurrentHtml ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold border border-emerald-500/30">
                  <Code className="w-3 h-3" />
                  <span>HTML Code / Interactive</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[10.5px] font-bold border border-sky-500/30">
                  <Globe className="w-3 h-3" />
                  <span>PDF Document / File</span>
                </span>
              )
            ) : (
              <span className="text-[11px] text-slate-400">(Empty Section)</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* HTML Code Editor / Creator Button */}
            <button
              type="button"
              onClick={handleOpenHtmlEditor}
              title="Write or paste custom HTML code, styled tendency tables, or HUDL/video cutups"
              className="px-3.5 py-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 hover:text-emerald-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors active:scale-95"
            >
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isCurrentHtml ? 'Edit HTML Code' : '+ Add HTML Code'}</span>
            </button>

            {/* Upload File Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors active:scale-95"
              title="Upload PDF, HTML, or picture file"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Upload PDF / HTML / Doc</span>
            </button>

            {/* CLEAR / DELETE DOCUMENT BUTTON (Always available when currentDocUrl exists) */}
            {currentDocUrl && (
              <button
                type="button"
                onClick={() => handleDeleteCurrentDocument(safeActiveMain, safeActiveSub)}
                title="Delete this uploaded PDF or HTML code"
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Document</span>
              </button>
            )}

            {/* Delete Entire Sub-Tab */}
            {currentSubTabs.length > 0 && (
              <button
                type="button"
                onClick={() => handleDeleteSubTab(safeActiveMain, safeActiveSub)}
                title={`Delete sub-tab "${safeActiveSub}"`}
                className="p-2 hover:bg-rose-950/60 text-rose-400 hover:text-rose-200 border border-transparent hover:border-rose-800/50 rounded-xl cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Print Tendencies Button */}
            <button
              type="button"
              onClick={() => {
                setPrintScope('current');
                setIsPrintModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-indigo-100 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors active:scale-95"
              title="Print this tendency sheet or create a packet"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print Sheet</span>
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

        {/* Document Frame / Full Continuous Viewer */}
        {currentDocUrl ? (
          <FullDocumentViewer
            content={currentDocUrl}
            title={`${safeActiveMain} - ${safeActiveSub}`}
            categoryName={safeActiveMain}
            subTabName={safeActiveSub}
            onOpenFullScreen={() => setIsFullScreenModalOpen(true)}
          />
        ) : (
          <div className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl overflow-hidden min-h-[420px] flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shadow-inner">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-slate-200">
                No Tendency Document or HTML in [{safeActiveMain} &gt; {safeActiveSub}]
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Upload an opponent scouting PDF, Hudl tendency export, or create custom HTML breakdown sheets with charts, diagrams, and video cutups.
              </p>
            </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenHtmlEditor}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  <Code className="w-4 h-4" />
                  <span>+ Create HTML Tendencies</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload PDF / File</span>
                </button>
              </div>
            </div>
          )}
        </div>

      {/* HTML CODE EDITOR MODAL */}
      {isHtmlEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-850 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Code className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-sm text-slate-100">
                    HTML Tendencies Code Editor: <span className="text-amber-300">{safeActiveMain} &gt; {safeActiveSub}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Write standard HTML5, CSS styles, embed YouTube/HUDL videos, or select a starter template below
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Starter Templates Dropdown */}
                <select
                  onChange={(e) => {
                    const found = TENDENCY_STARTER_TEMPLATES.find((t) => t.id === e.target.value);
                    if (found) {
                      if (htmlEditorCode.trim()) {
                        const newCode = found.code;
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Load Starter Template',
                          message: 'Replace current editor code with this starter template?',
                          confirmLabel: 'Replace Code',
                          confirmVariant: 'primary',
                          onConfirm: () => {
                            setHtmlEditorCode(newCode);
                          },
                        });
                        e.target.value = '';
                        return;
                      }
                      setHtmlEditorCode(found.code);
                    }
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 rounded-xl cursor-pointer"
                >
                  <option value="" disabled>⚡ Load Tendency Template...</option>
                  {TENDENCY_STARTER_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
                  title="Copy code"
                >
                  {copiedNotification ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsHtmlEditorOpen(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Toggle: Code vs Preview */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditorTab('code')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    editorTab === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Code View
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    editorTab === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Live Preview
                </button>
              </div>

              <span className="text-[11px] text-slate-500">
                Safe sandboxed container • Supports HTML5, inline CSS, tables &amp; iframes
              </span>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-hidden relative">
              {editorTab === 'code' ? (
                <textarea
                  value={htmlEditorCode}
                  onChange={(e) => setHtmlEditorCode(e.target.value)}
                  placeholder="<!DOCTYPE html><html><head>...</head><body>...</body></html>"
                  className="w-full h-full p-4 font-mono text-xs text-emerald-300 bg-slate-950 resize-none focus:outline-none selection:bg-indigo-500/30"
                  spellCheck={false}
                />
              ) : (
                <iframe
                  srcDoc={htmlEditorCode}
                  title="Live HTML Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                  className="w-full h-full border-0 bg-white"
                />
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setHtmlEditorCode('')}
                className="text-xs font-bold text-slate-400 hover:text-rose-400 cursor-pointer"
              >
                Clear Editor
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHtmlEditorOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveHtmlContent(safeActiveMain, safeActiveSub, htmlEditorCode)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save HTML Tendencies</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN MODAL */}
      {isFullScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">
              Fullscreen: {safeActiveMain} &gt; {safeActiveSub}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintSingleSection(safeActiveMain, safeActiveSub)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullScreenModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white">
            {isCurrentHtml ? (
              <iframe
                srcDoc={currentDocUrl}
                title="Fullscreen Preview"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                className="w-full h-full border-0"
              />
            ) : (
              <iframe
                src={currentDocUrl}
                title="Fullscreen Preview"
                className="w-full h-full border-0"
              />
            )}
          </div>
        </div>
      )}

      {/* ORGANIZE FOLDERS & TABS MODAL */}
      {isOrganizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm text-slate-100">Organize Tendency Folders &amp; Tabs</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOrganizeModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              {/* Category Folders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                      1. Category Folders ({mainCategories.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Click a category below to inspect its sub-tabs and reports.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddCategory}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Category</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {mainCategories.map((cat, idx) => {
                    const isSelected = cat === (mainCategories.includes(organizeCategory) ? organizeCategory : safeActiveMain);
                    return (
                      <div
                        key={cat}
                        onClick={() => setOrganizeCategory(cat)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-xs'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                            {cat}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-black uppercase">
                              Active View
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleMoveMainFolder(cat, -1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMainFolder(cat, 1)}
                            disabled={idx === mainCategories.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openRenameCategory(cat)}
                            className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                            title="Rename category folder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMainFolder(cat)}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Delete category folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Tabs of Selected Category */}
              {(() => {
                const currentCat = mainCategories.includes(organizeCategory) ? organizeCategory : safeActiveMain;
                const subsInCat = tendenciesOrder.sub?.[currentCat] || Object.keys(tendenciesTree[currentCat] || {});

                return (
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                          2. Sub-Tabs &amp; Reports in [{currentCat}] ({subsInCat.length})
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Rename, reorder, or delete reports and sub-folders in this section.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddSubTab(currentCat)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Sub-Tab</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {subsInCat.map((sub, idx) => (
                        <div
                          key={sub}
                          className="flex items-center justify-between p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="font-bold text-xs text-slate-200 truncate">{sub}</span>
                            {Boolean(tendenciesTree[currentCat]?.[sub]) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Has Document" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveSubTab(currentCat, sub, -1)}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSubTab(currentCat, sub, 1)}
                              disabled={idx === subsInCat.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openRenameSubTab(currentCat, sub)}
                              className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                              title="Rename sub-tab / report"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubTab(currentCat, sub)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Delete sub-tab"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {subsInCat.length === 0 && (
                        <div className="text-xs text-slate-400 py-3 text-center bg-slate-800/40 rounded-xl border border-dashed border-slate-700">
                          No sub-tabs or reports yet. Click &quot;Add Sub-Tab&quot; above to create one.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOrganizeModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done Organizing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm text-slate-100">Print Opponent Tendencies</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-300 uppercase">Print Scope:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintScope('current')}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-center ${
                    printScope === 'current'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  Current Sheet
                  <div className="text-[10px] text-indigo-200 mt-0.5 truncate">{safeActiveSub}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintScope('category')}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-center ${
                    printScope === 'category'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  Category Packet
                  <div className="text-[10px] text-indigo-200 mt-0.5 truncate">{safeActiveMain}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintScope('all')}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer text-center ${
                    printScope === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  Complete Binder
                  <div className="text-[10px] text-indigo-200 mt-0.5">All Categories</div>
                </button>
              </div>

              {/* Options */}
              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printInkFriendly}
                    onChange={(e) => setPrintInkFriendly(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ink-Friendly Mode (Pure white background for clean paper printing)</span>
                </label>

                {printScope !== 'current' && (
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCoverPage}
                      onChange={(e) => setIncludeCoverPage(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include Official Opponent Cover Page</span>
                  </label>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPrintingLoading}
                onClick={() => handleExecutePrint('iframe')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrintingLoading ? 'Preparing Print...' : 'Print Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT / RENAME DIALOG (iFrame-safe prompt replacement) */}
      {inputDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-black text-sm text-slate-100">{inputDialog.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inputDialog.subtitle && (
              <p className="text-xs text-slate-400">{inputDialog.subtitle}</p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputDialog.value.trim()) {
                  inputDialog.onConfirm(inputDialog.value.trim());
                  setInputDialog((prev) => ({ ...prev, isOpen: false }));
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Name / Label
                </label>
                <input
                  type="text"
                  autoFocus
                  value={inputDialog.value}
                  onChange={(e) => setInputDialog((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder={inputDialog.placeholder || 'Enter name...'}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none shadow-inner"
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inputDialog.value.trim()}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 transition-all"
                >
                  {inputDialog.confirmLabel || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION DIALOG MODAL (Prevents browser confirm from being blocked in iframe) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="font-black text-sm text-slate-100">{confirmDialog.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`px-5 py-2 text-xs font-black rounded-xl shadow-lg cursor-pointer transition-all ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
