import { WhiteboardDrill } from './whiteboardDrillData';
import { HUDL_10U_DEFENSE_INSTALL_PLAYS } from '../../data/hudl10UDefenseData';

const BASE_SCHEME_DRILLS: WhiteboardDrill[] = [
  {
    id: 'scheme-44-stack-liz',
    category: 'SCHEME',
    categoryLabel: 'Defensive Schemes & Shells',
    title: '4-4 BASE STACK LIZ',
    subtitle: 'VS 21 L (Pro-I Formation)',
    objective: 'Standard 4-4 Stack gap-responsible defense against 21 Personnel Pro-I Left. Sound containment on edges, A/B gap interior spills, fast flow linebackers, and 1/3 boundary zone integrity.',
    setup: 'Full 11-on-11 formation set on 40-yard grid. Place line of scrimmage at 30-yard line with hash marks. Offense lines up in 21 Personnel Pro-I Left (TE & flanker left, split end right, I-backs).',
    instructions: [
      'Call "Liz! Liz! Liz!" to declare strong-side strength to the left (Tight End side).',
      'Defensive Ends align in 9-technique (outside TE) and 5-technique (outside weak tackle) with contain responsibility.',
      'Defensive Tackles align in 3-technique (strong B-gap) and 1-technique (weak A-gap shade).',
      'Stack linebackers align at 4.5 yards depth directly behind DL, reading offensive guard and fullback flow.',
      'Corners align 6-7 yards off wideouts in outside-third bail leverage; Free Safety caps the deep middle third.',
      'On snap: front 4 penetrate assigned gaps, linebackers scrape downhill inside-out, secondary upholds zone coverage.',
    ],
    equipment: 'Standard field grid, line markers at 10/20/30, coach whistle, football.',
    diagramKeys: [
      { text: 'Flow = direction of the ball', isHighlight: false },
      { text: 'We are a Pursuing Gap responsible defense', isHighlight: false },
      { text: 'Something goes away, something is coming back.', isHighlight: false },
      { text: '11 guys on the tackle every play', isHighlight: true },
    ],
    cues: [
      '"Flow = direction of the ball!"',
      '"We are a Pursuing Gap responsible defense!"',
      '"Something goes away, something is coming back!"',
      '"11 GUYS ON THE TACKLE EVERY PLAY!"',
    ],
    faults: [
      'Edge rushers losing outside contain and letting the sweep turn upfield.',
      'Linebackers jumping out of their assigned gap on counter action.',
      'Safeties biting on play-action before confirming run commit.',
    ],
    phases: [
      {
        name: 'PHASE 1: BASE ALIGNMENT & COVERAGE KEYS',
        description: 'Front 4 aligned in 9, 3, 1, 5 techniques. Stack linebackers at 4.5 yards depth reading backfield flow. Corners bailing to deep thirds.',
        tokens: [
          // Offense (21 L Formation) - Spaced across full field width (y: 200)
          { id: 'o-c', type: 'square', label: 'C', x: 350, y: 200, color: '#1e293b', isSquare: true },
          { id: 'o-lg', type: 'O', label: '', x: 280, y: 200, color: '#1e293b' },
          { id: 'o-rg', type: 'O', label: '', x: 420, y: 200, color: '#1e293b' },
          { id: 'o-lt', type: 'O', label: '', x: 210, y: 200, color: '#1e293b' },
          { id: 'o-rt', type: 'O', label: '', x: 490, y: 200, color: '#1e293b' },
          { id: 'o-qb', type: 'O', label: '', x: 350, y: 155, color: '#1e293b' },
          { id: 'o-fb', type: 'O', label: '', x: 350, y: 115, color: '#1e293b' },
          { id: 'o-tb', type: 'O', label: '', x: 350, y: 70, color: '#1e293b' },
          { id: 'o-wr1', type: 'O', label: '', x: 80, y: 200, color: '#1e293b' },
          { id: 'o-wr2', type: 'O', label: '', x: 620, y: 200, color: '#1e293b' },

          // Defense Down Linemen
          { id: 'd-e9', type: 'O', label: '', subLabel: 'E9', x: 170, y: 260, color: '#1e293b' },
          { id: 'd-t3', type: 'O', label: '', subLabel: 'T3', x: 260, y: 260, color: '#1e293b' },
          { id: 'd-t1', type: 'O', label: '', subLabel: 'T1', x: 390, y: 260, color: '#1e293b' },
          { id: 'd-e5', type: 'O', label: '', subLabel: 'E5', x: 520, y: 260, color: '#1e293b' },

          // Second Level Linebackers & Secondary (Letter tokens)
          { id: 'd-cb1', type: 'letter', label: 'C', x: 90, y: 310, color: '#0f172a' },
          { id: 'd-s', type: 'letter', label: 'S', x: 190, y: 345, color: '#0f172a' },
          { id: 'd-m', type: 'letter', label: 'M', x: 285, y: 345, color: '#0f172a' },
          { id: 'd-w', type: 'letter', label: 'W', x: 415, y: 345, color: '#0f172a' },
          { id: 'd-r', type: 'letter', label: 'R', x: 510, y: 345, color: '#0f172a' },
          { id: 'd-cb2', type: 'letter', label: 'C', x: 610, y: 310, color: '#0f172a' },

          // Deep Level
          { id: 'd-fs', type: 'letter', label: 'FS', x: 350, y: 440, color: '#0f172a' },
        ],
        arrows: [
          // E9 Containment Curl
          { id: 'a-e9', type: 'curved', startX: 170, startY: 260, endX: 145, endY: 185, controlX: 140, controlY: 225, color: '#2563eb' },
          // T3 Slant
          { id: 'a-t3', type: 'straight', startX: 260, startY: 260, endX: 245, endY: 195, color: '#2563eb' },
          // T1 Slant
          { id: 'a-t1', type: 'straight', startX: 390, startY: 260, endX: 365, endY: 195, color: '#2563eb' },
          // E5 Containment Curl
          { id: 'a-e5', type: 'curved', startX: 520, startY: 260, endX: 545, endY: 185, controlX: 550, controlY: 225, color: '#2563eb' },

          // Purple dashed drop/coverage arrows matching 3-deep shell
          { id: 'a-cb1', type: 'drop', startX: 90, startY: 325, endX: 90, endY: 410, color: '#7c3aed', dashed: true },
          { id: 'a-s', type: 'drop', startX: 190, startY: 355, endX: 155, endY: 405, color: '#7c3aed', dashed: true },
          { id: 'a-m', type: 'drop', startX: 285, startY: 360, endX: 280, endY: 415, color: '#7c3aed', dashed: true },
          { id: 'a-w', type: 'drop', startX: 415, startY: 360, endX: 420, endY: 415, color: '#7c3aed', dashed: true },
          { id: 'a-r', type: 'drop', startX: 510, startY: 355, endX: 545, endY: 405, color: '#7c3aed', dashed: true },
          { id: 'a-cb2', type: 'drop', startX: 610, startY: 325, endX: 610, endY: 410, color: '#7c3aed', dashed: true },
          { id: 'a-fs', type: 'drop', startX: 350, startY: 450, endX: 350, endY: 485, color: '#7c3aed', dashed: true },
        ],
        zones: [
          { id: 'z-deep-3rd-l', name: 'DEEP 1/3 (CB)', cx: 120, cy: 425, rx: 75, ry: 35, color: '#7c3aed', opacity: 0.12 },
          { id: 'z-deep-3rd-m', name: 'DEEP 1/3 (FS)', cx: 350, cy: 460, rx: 80, ry: 30, color: '#7c3aed', opacity: 0.12 },
          { id: 'z-deep-3rd-r', name: 'DEEP 1/3 (CB)', cx: 580, cy: 425, rx: 75, ry: 35, color: '#7c3aed', opacity: 0.12 },
        ],
      },
      {
        name: 'PHASE 2: RUN FLOW TO STRONG SIDE (SWARM)',
        description: 'Offense shows lead sweep left. Sam sets the hard edge, Mike scrapes downhill over the top, Will fills cutback lane, Free Safety rallies from deep middle.',
        tokens: [
          { id: 'o-c', type: 'square', label: 'C', x: 350, y: 200, color: '#1e293b', isSquare: true },
          { id: 'o-lg', type: 'O', label: '', x: 280, y: 195, color: '#1e293b' },
          { id: 'o-lt', type: 'O', label: '', x: 210, y: 190, color: '#1e293b' },
          { id: 'o-qb', type: 'O', label: '', x: 300, y: 150, color: '#1e293b' },
          { id: 'o-fb', type: 'O', label: '', x: 230, y: 135, color: '#1e293b' },
          { id: 'o-tb', type: 'O', label: '', x: 155, y: 120, color: '#b91c1c' },

          { id: 'd-e9', type: 'O', label: '', subLabel: 'E9', x: 180, y: 245, color: '#1e293b' },
          { id: 'd-s', type: 'letter', label: 'S', x: 120, y: 220, color: '#0f172a' },
          { id: 'd-m', type: 'letter', label: 'M', x: 275, y: 295, color: '#0f172a' },
          { id: 'd-w', type: 'letter', label: 'W', x: 395, y: 310, color: '#0f172a' },
          { id: 'd-fs', type: 'letter', label: 'FS', x: 280, y: 390, color: '#0f172a' },
        ],
        arrows: [
          { id: 'a-s-funnel', type: 'blitz', startX: 120, startY: 220, endX: 125, endY: 140, color: '#058538', label: 'Force Edge' },
          { id: 'a-m-fill', type: 'blitz', startX: 275, startY: 295, endX: 200, endY: 165, color: '#058538', label: 'Downhill Meet' },
          { id: 'a-fs-rally', type: 'blitz', startX: 280, startY: 390, endX: 185, endY: 205, color: '#2563eb', label: 'Alley Swarm' },
        ],
        zones: [
          { id: 'z-swarm-box', name: 'PERIMETER SPILL BOX', cx: 160, cy: 155, rx: 55, ry: 35, color: '#058538', opacity: 0.18 },
        ],
      },
    ],
  },
  {
    id: 'scheme-53-bear-base',
    category: 'SCHEME',
    categoryLabel: 'Defensive Schemes & Shells',
    title: '5-3 BEAR YOUTH FRONT',
    subtitle: 'Interior Stacking & C-Gap Lockout',
    objective: 'Stout youth front placing 3 interior linemen covering the center and both guards, forcing all run action to bounce outside into unblocked linebackers.',
    setup: 'Line of scrimmage at 20-yard line. 5 down linemen in 3-point stances: Nose Tackle head-up on Center (0-Tech), Defensive Tackles head-up on Guards (3-Tech), Defensive Ends on outside shoulder of Tackles/Tight Ends. 3 Linebackers stacked at 4 yards depth.',
    instructions: [
      'Nose Tackle strikes center chest on the snap and anchors both A-gaps.',
      'Defensive Tackles punch guards square and refuse to be moved backwards or turned.',
      'Defensive Ends establish outside contain leverage, turning any outside sweep back inside.',
      'Middle Linebacker keys fullback/tailback through the center mesh and fills with downhill momentum.',
      'Outside Linebackers scrape clean over the top to make the tackle for loss once runner bounces outside.',
    ],
    diagramKeys: [
      { text: 'Cover center and both guards', isHighlight: false },
      { text: 'No A or B gap seams', isHighlight: false },
      { text: 'Force everything to bounce outside', isHighlight: false },
      { text: 'Linebackers scrape clean to boundary', isHighlight: true },
    ],
    cues: ['"Pound the center!"', '"Control the A-gaps!"', '"Make the running back bounce!"'],
    faults: ['Interior linemen getting hooked by pulling guards.', 'Linebackers overrunning cutback lane.'],
    phases: [
      {
        name: 'PHASE 1: 5-3 BEAR ALIGNMENT & SURGE',
        description: 'Nose tackle head-up over center (0-Tech), tackles over guards (3-Tech), ends on tight ends (7/9-Tech), 3 linebackers stacked.',
        tokens: [
          { id: 'o-c', type: 'square', label: 'C', x: 350, y: 200, color: '#1e293b', isSquare: true },
          { id: 'o-lg', type: 'O', label: '', x: 275, y: 200, color: '#1e293b' },
          { id: 'o-rg', type: 'O', label: '', x: 425, y: 200, color: '#1e293b' },
          { id: 'o-lt', type: 'O', label: '', x: 200, y: 200, color: '#1e293b' },
          { id: 'o-rt', type: 'O', label: '', x: 500, y: 200, color: '#1e293b' },
          { id: 'o-qb', type: 'O', label: '', x: 350, y: 145, color: '#1e293b' },

          { id: 'd-nt', type: 'O', label: '', subLabel: 'NT (0-T)', x: 350, y: 260, color: '#1e293b' },
          { id: 'd-dt1', type: 'O', label: '', subLabel: 'DT (3-T)', x: 275, y: 260, color: '#1e293b' },
          { id: 'd-dt2', type: 'O', label: '', subLabel: 'DT (3-T)', x: 425, y: 260, color: '#1e293b' },
          { id: 'd-de1', type: 'O', label: '', subLabel: 'DE (7-T)', x: 175, y: 265, color: '#1e293b' },
          { id: 'd-de2', type: 'O', label: '', subLabel: 'DE (7-T)', x: 525, y: 265, color: '#1e293b' },

          { id: 'd-mlb', type: 'letter', label: 'M', x: 350, y: 345, color: '#0f172a' },
          { id: 'd-olb1', type: 'letter', label: 'W', x: 235, y: 345, color: '#0f172a' },
          { id: 'd-olb2', type: 'letter', label: 'S', x: 465, y: 345, color: '#0f172a' },
          { id: 'd-fs', type: 'letter', label: 'FS', x: 350, y: 440, color: '#0f172a' },
        ],
        arrows: [
          { id: 'a-nt-bull', type: 'straight', startX: 350, startY: 260, endX: 350, endY: 215, color: '#2563eb', label: '0-Tech Lock' },
          { id: 'a-dt1-push', type: 'straight', startX: 275, startY: 260, endX: 275, endY: 215, color: '#2563eb' },
          { id: 'a-dt2-push', type: 'straight', startX: 425, startY: 260, endX: 425, endY: 215, color: '#2563eb' },
          { id: 'a-de1-edge', type: 'curved', startX: 175, startY: 265, endX: 155, endY: 195, controlX: 150, controlY: 230, color: '#058538', label: 'Contain' },
          { id: 'a-de2-edge', type: 'curved', startX: 525, startY: 265, endX: 545, endY: 195, controlX: 550, controlY: 230, color: '#058538', label: 'Contain' },
        ],
        zones: [
          { id: 'z-bear-wall', name: 'INTERIOR WALL (A & B GAPS SHUT)', cx: 350, cy: 230, rx: 115, ry: 25, color: '#2563eb', opacity: 0.16 },
        ],
      },
    ],
  },
  {
    id: 'scheme-43-over',
    category: 'SCHEME',
    categoryLabel: 'Defensive Schemes & Shells',
    title: '4-3 OVER YOUTH FRONT',
    subtitle: 'Strong-Side Shade & Weak-Side Stunt',
    objective: 'Shift interior defensive tackle to 3-technique towards offensive strength (TE), with Nose Tackle in 1-technique away from strength. Sam sets TE edge, Mike roams free to ball.',
    setup: 'Offense aligns with Tight End on the right. Defense sets 4-3 Over front: 3-Tech DT and 7-Tech DE to the TE (strong side); 1-Tech NT and 5-Tech DE to open side (weak side). Linebackers stack at 4.5 yards depth.',
    instructions: [
      'Call "Over! Over! Over!" to slide the defensive front to the Tight End side.',
      '3-Tech DT aligns on outside eye of strong guard, charging through B-gap.',
      '1-Tech NT aligns on weak center-guard A-gap, anchoring against the scoop block.',
      'Sam Linebacker walks up to 3 yards over TE, ready to jam and force outside runs.',
      'Mike Linebacker aligns directly behind the 1-Tech, keeping clean legs to flow to both boundaries.',
      'Will Linebacker protects weak B/C gap and trails bootlegs/reverses.',
    ],
    cues: ['"Find the Tight End!"', '"3-Tech sets to the TE!"', '"Mike stack behind shade!"'],
    faults: ['DL lining up in wrong techniques when offense shifts.', 'Nose losing weak A-gap on reach block.'],
    phases: [
      {
        name: 'PHASE 1: 4-3 OVER ALIGNMENT & KEYS',
        description: 'Tackle in 3-tech on strong guard, Nose in 1-tech on weak guard, End in 7-tech on TE.',
        tokens: [
          { id: 'o-c', type: 'square', label: 'C', x: 350, y: 200, color: '#1e293b', isSquare: true },
          { id: 'o-lg', type: 'O', label: '', x: 275, y: 200, color: '#1e293b' },
          { id: 'o-rg', type: 'O', label: '', x: 425, y: 200, color: '#1e293b' },
          { id: 'o-lt', type: 'O', label: '', x: 200, y: 200, color: '#1e293b' },
          { id: 'o-rt', type: 'O', label: '', x: 500, y: 200, color: '#1e293b' },
          { id: 'o-te', type: 'O', label: 'TE', x: 575, y: 200, color: '#1e293b' },
          { id: 'o-qb', type: 'O', label: '', x: 350, y: 145, color: '#1e293b' },
          { id: 'o-rb', type: 'O', label: '', x: 350, y: 95, color: '#b91c1c' },

          // Down Linemen
          { id: 'd-wde', type: 'O', label: '', subLabel: 'WDE (5)', x: 175, y: 260, color: '#1e293b' },
          { id: 'd-nt', type: 'O', label: '', subLabel: 'NT (1-T)', x: 320, y: 260, color: '#1e293b' },
          { id: 'd-t3', type: 'O', label: '', subLabel: '3-Tech', x: 455, y: 260, color: '#1e293b' },
          { id: 'd-sde', type: 'O', label: '', subLabel: 'SDE (7)', x: 575, y: 260, color: '#1e293b' },

          // Linebackers
          { id: 'd-w', type: 'letter', label: 'W', x: 235, y: 345, color: '#0f172a' },
          { id: 'd-m', type: 'letter', label: 'M', x: 355, y: 345, color: '#0f172a' },
          { id: 'd-s', type: 'letter', label: 'S', x: 520, y: 345, color: '#0f172a' },
        ],
        arrows: [
          { id: 'a-t3-burst', type: 'straight', startX: 455, startY: 260, endX: 465, endY: 210, color: '#2563eb', label: 'B-Gap Rush' },
          { id: 'a-nt-anchor', type: 'straight', startX: 320, startY: 260, endX: 320, endY: 215, color: '#2563eb', label: 'A-Gap Shade' },
          { id: 'a-sde-jam', type: 'straight', startX: 575, startY: 260, endX: 575, endY: 215, color: '#058538', label: 'TE Jam & Contain' },
          { id: 'a-m-scrape', type: 'curved', startX: 355, startY: 345, endX: 430, endY: 250, controlX: 395, controlY: 300, color: '#058538', label: 'Flow Scrape' },
        ],
        zones: [
          { id: 'z-strong-box', name: 'STRONG ATTACK BOX', cx: 500, cy: 230, rx: 70, ry: 30, color: '#2563eb', opacity: 0.15 },
        ],
      },
    ],
  },
  {
    id: 'scheme-62-goal-line',
    category: 'SCHEME',
    categoryLabel: 'Defensive Schemes & Shells',
    title: '6-2 GOAL LINE WEDGE BUSTER',
    subtitle: 'Low Pad Surge & No-Gain Wall',
    objective: 'Short yardage lock: 6 down linemen firing under the offensive pads, 2 linebackers filling downhill on the whistle. No penetration allowed, zero yards forward.',
    setup: 'Ball inside the 3-yard line. 6 down linemen line up in 4-point stances nose-to-nose with offensive line. 2 middle linebackers line up 2 yards directly behind the guards. Corners press tight on outside receivers.',
    instructions: [
      'All 6 down linemen drop into low 4-point stances with cleats dug in.',
      'On the snap: fire forward and low, targeting the offensive lineman’s knees and numbers.',
      'Do not try to rush the passer—stay low, create a pile, and stalemated the line of scrimmage.',
      'Both Linebackers step forward with knees bent, tracking the fullback and diving over the top of the pile on sneak attempts.',
      'Defensive Ends must not allow any bounce outside; squeeze and force everything into the teeth of the 6-man wall.',
    ],
    cues: ['"Nose on toes!"', '"Fire under their chin straps!"', '"Knock the wedge backwards!"'],
    faults: ['Standing up and getting driven into the end zone.', 'Losing outside contain on a QB bootleg.'],
    phases: [
      {
        name: 'PHASE 1: 6-2 TIGHT FRONT SURGE',
        description: 'All 6 down linemen in 4-point stances with eyes on the ball, linebackers 2 yards off.',
        tokens: [
          { id: 'o-c', type: 'square', label: 'C', x: 350, y: 200, color: '#1e293b', isSquare: true },
          { id: 'o-lg', type: 'O', label: '', x: 280, y: 200, color: '#1e293b' },
          { id: 'o-rg', type: 'O', label: '', x: 420, y: 200, color: '#1e293b' },
          { id: 'o-lt', type: 'O', label: '', x: 210, y: 200, color: '#1e293b' },
          { id: 'o-rt', type: 'O', label: '', x: 490, y: 200, color: '#1e293b' },
          { id: 'o-te', type: 'O', label: 'TE', x: 560, y: 200, color: '#1e293b' },

          // 6 Down Linemen
          { id: 'd-de1', type: 'O', label: '', subLabel: 'DE', x: 180, y: 255, color: '#1e293b' },
          { id: 'd-dt1', type: 'O', label: '', subLabel: 'DT', x: 250, y: 255, color: '#1e293b' },
          { id: 'd-dg1', type: 'O', label: '', subLabel: 'DG', x: 315, y: 255, color: '#1e293b' },
          { id: 'd-dg2', type: 'O', label: '', subLabel: 'DG', x: 385, y: 255, color: '#1e293b' },
          { id: 'd-dt2', type: 'O', label: '', subLabel: 'DT', x: 455, y: 255, color: '#1e293b' },
          { id: 'd-de2', type: 'O', label: '', subLabel: 'DE', x: 540, y: 255, color: '#1e293b' },

          // 2 Linebackers
          { id: 'd-mlb1', type: 'letter', label: 'M', x: 295, y: 325, color: '#b91c1c' },
          { id: 'd-mlb2', type: 'letter', label: 'W', x: 405, y: 325, color: '#b91c1c' },
        ],
        arrows: [
          { id: 'a-dg1-low', type: 'straight', startX: 315, startY: 255, endX: 325, endY: 215, color: '#2563eb' },
          { id: 'a-dg2-low', type: 'straight', startX: 385, startY: 255, endX: 375, endY: 215, color: '#2563eb' },
          { id: 'a-surge-1', type: 'straight', startX: 295, startY: 325, endX: 300, endY: 250, color: '#b91c1c', label: 'Fill A-Gap' },
          { id: 'a-surge-2', type: 'straight', startX: 405, startY: 325, endX: 400, endY: 250, color: '#b91c1c', label: 'Fill A-Gap' },
          { id: 'a-de1-contain', type: 'curved', startX: 180, startY: 255, endX: 160, endY: 195, controlX: 155, controlY: 225, color: '#058538' },
          { id: 'a-de2-contain', type: 'curved', startX: 540, startY: 255, endX: 565, endY: 195, controlX: 570, controlY: 225, color: '#058538' },
        ],
        zones: [
          { id: 'z-wall-zone', name: 'NO-GAIN GOAL LINE WALL', cx: 350, cy: 225, rx: 135, ry: 20, color: '#b91c1c', opacity: 0.18 },
        ],
      },
    ],
  },
];

export const SCHEME_DRILLS: WhiteboardDrill[] = [...HUDL_10U_DEFENSE_INSTALL_PLAYS, ...BASE_SCHEME_DRILLS];
