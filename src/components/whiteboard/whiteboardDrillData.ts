import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble, WhiteboardTextElement, PlayResponsibility } from '../../types';
import { safeJSONParse, safeJSONSet } from '../../services/storageService';
import { SCHEME_DRILLS } from './drillsSchemes';
import { TEAM_CIRCUIT_DRILLS } from './drillsTeam';
import { EXTRA_YOUTH_DRILLS } from './drillsExtraYouth';
import { DRILL_MATRIX_DRILLS } from './drillsMatrixDrills';

export type DefensivePositionCategory =
  | 'DEFENSE'
  | 'DL'
  | 'DE'
  | 'LB'
  | 'DB'
  | 'TEAM'
  | 'SCHEME'
  | 'OFFENSE'
  | 'OFF_QB'
  | 'OFF_RB'
  | 'OFF_OL'
  | 'OFF_WR'
  | 'OFF_TEAM'
  | 'TACKLE'
  | 'BLOCKING'
  | 'ST'
  | 'WARMUP';

export interface WhiteboardDrill {
  id: string;
  category: DefensivePositionCategory;
  categoryLabel: string;
  title: string;
  subtitle: string;
  objective: string;
  setup?: string;
  instructions?: string[];
  equipment?: string;
  diagramKeys?: { text: string; isHighlight?: boolean }[];
  cues: string[];
  faults: string[];
  phases: {
    name: string;
    description: string;
    tokens: WhiteboardToken[];
    arrows: WhiteboardArrow[];
    zones: WhiteboardZoneBubble[];
    textElements?: WhiteboardTextElement[];
  }[];
  responsibilities?: PlayResponsibility[];
  notes?: string[];
  videoUrl?: string;
  hudlPlaybookName?: string;
  formationName?: string;
}

export interface PositionGroupFilter {
  id: 'ALL' | DefensivePositionCategory;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}

export const DEFENSIVE_POSITION_GROUPS: PositionGroupFilter[] = [
  { id: 'ALL', label: 'All Playbook Drills', shortLabel: 'ALL', icon: '🛡️', color: 'slate' },
  { id: 'OFFENSE', label: 'Offense (All Units)', shortLabel: 'OFFENSE', icon: '🏈', color: 'blue' },
  { id: 'OFF_QB', label: 'Quarterbacks (QB)', shortLabel: 'QB', icon: '🎯', color: 'blue' },
  { id: 'OFF_RB', label: 'Running Backs (RB)', shortLabel: 'RB', icon: '💨', color: 'blue' },
  { id: 'OFF_OL', label: 'Offensive Line (OL)', shortLabel: 'OL', icon: '🧱', color: 'blue' },
  { id: 'OFF_WR', label: 'Wide Receivers & TEs', shortLabel: 'WR/TE', icon: '⚡', color: 'blue' },
  { id: 'OFF_TEAM', label: 'Team Offense & Install', shortLabel: 'OFF TEAM', icon: '👥', color: 'blue' },
  { id: 'DEFENSE', label: 'Defense (All Positions)', shortLabel: 'DEFENSE', icon: '🛡️', color: 'emerald' },
  { id: 'DL', label: 'Defensive Tackles (DL)', shortLabel: 'DL', icon: '🧱', color: 'indigo' },
  { id: 'DE', label: 'Defensive Ends (DE)', shortLabel: 'DE', icon: '⚡', color: 'cyan' },
  { id: 'LB', label: 'Linebackers (LB)', shortLabel: 'LB', icon: '💥', color: 'emerald' },
  { id: 'DB', label: 'Defensive Backs (DB)', shortLabel: 'DB', icon: '🦅', color: 'purple' },
  { id: 'TEAM', label: 'Team Tackling & Circuits', shortLabel: 'TEAM', icon: '🎯', color: 'amber' },
  { id: 'TACKLE', label: 'Form Fit Tackling', shortLabel: 'TACKLE', icon: '🥋', color: 'rose' },
  { id: 'BLOCKING', label: 'Blocking Technique', shortLabel: 'BLOCKING', icon: '🛡️', color: 'teal' },
  { id: 'ST', label: 'Special Teams (Kick/Punt)', shortLabel: 'SPECIALS', icon: '🌟', color: 'yellow' },
  { id: 'WARMUP', label: 'Warm-Up & Conditioning', shortLabel: 'WARMUP', icon: '🏃', color: 'orange' },
  { id: 'SCHEME', label: 'Defensive Schemes & Shells', shortLabel: 'SCHEMES', icon: '📋', color: 'violet' },
];

export const DLINE_DRILLS: WhiteboardDrill[] = [
  {
    id: 'drill-1',
    category: 'DL',
    categoryLabel: 'Defensive Line (DT/NT)',
    title: 'BALL-ON-A-STICK GET-OFF',
    subtitle: 'Cadence Discipline & Low-Hip Explosion',
    objective: 'Eliminate cadence flinching. DL fires immediately on ball movement with low hips and strikes bag.',
    setup: 'Set 2 stand-up dummies 3 yards in front of line of scrimmage. Coach holds football on a stick centered between bags. Place 2 orange finish cones 5 yards behind the bags.',
    instructions: [
      'DL assume coiled 3-point stances aligned across from each bag.',
      'Coach moves the football on the stick with varying cadence (hard counts, long pauses, quick snaps).',
      'DL must react purely to visual ball movement—never jumping on verbal cadence.',
      'Fire a 6-inch power step replacing the down hand, drive hips upward, and punch both palms violently into the dummy chest.',
      'Shed the bag outside and sprint 5 yards through the orange finish cones.',
    ],
    equipment: '2 stand-up bags, football on stick, 2 cones, whistle.',
    cues: [
      '"Eyes burned into the leather!"',
      '"First step replaces down-hand!"',
      '"Explode through the dummy breastplate!"',
    ],
    faults: [
      'Jumping on the QB\'s verbal count.',
      'Pop-up syndrome: Helmet rising before hips fire forward.',
      'False step backwards before moving ahead.',
    ],
    phases: [
      {
        name: 'PHASE 1: 3-POINT STANCE',
        description: 'Coiled in 3-point stance, weight balanced forward, eyes locked on the football on the stick.',
        tokens: [
          { id: 'c-1', type: 'ball', label: 'COACH', x: 350, y: 190, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DL 1', x: 200, y: 310, color: '#0052cc', subLabel: '3-Pt' },
          { id: 'dl-2', type: 'X', label: 'DL 2', x: 480, y: 310, color: '#0052cc', subLabel: '3-Pt' },
          { id: 'bag-1', type: 'bag', label: 'BAG 1', x: 200, y: 170, color: '#d91b24' },
          { id: 'bag-2', type: 'bag', label: 'BAG 2', x: 480, y: 170, color: '#d91b24' },
          { id: 'cone-1', type: 'cone', label: 'FINISH', x: 150, y: 70, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'FINISH', x: 430, y: 70, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-1', type: 'straight', startX: 200, startY: 300, endX: 200, endY: 230, color: '#0052cc', dashed: true, label: '6" Power Step' },
          { id: 'a-2', type: 'straight', startX: 480, startY: 300, endX: 480, endY: 230, color: '#0052cc', dashed: true, label: '6" Power Step' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: SNAP REACTION & PUNCH',
        description: 'Violent 2-hand punch into the dummy breastplate, driving hips upward through contact.',
        tokens: [
          { id: 'c-1', type: 'ball', label: 'COACH', x: 350, y: 190, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DL 1', x: 200, y: 220, color: '#0052cc', subLabel: 'Punch' },
          { id: 'dl-2', type: 'X', label: 'DL 2', x: 480, y: 220, color: '#0052cc', subLabel: 'Punch' },
          { id: 'bag-1', type: 'bag', label: 'BAG 1', x: 200, y: 160, color: '#d91b24' },
          { id: 'bag-2', type: 'bag', label: 'BAG 2', x: 480, y: 160, color: '#d91b24' },
          { id: 'cone-1', type: 'cone', label: 'FINISH', x: 150, y: 70, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'FINISH', x: 430, y: 70, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-1', type: 'blitz', startX: 200, startY: 210, endX: 200, endY: 95, color: '#058538', label: 'Drive & Burst' },
          { id: 'a-2', type: 'blitz', startX: 480, startY: 210, endX: 480, endY: 95, color: '#058538', label: 'Drive & Burst' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 3: SHED & 5YD SPRINT',
        description: 'Shed the bag violently and finish through the cones with high knees and full sprint.',
        tokens: [
          { id: 'c-1', type: 'ball', label: 'COACH', x: 350, y: 190, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DL 1', x: 200, y: 70, color: '#058538', subLabel: 'Burst!' },
          { id: 'dl-2', type: 'X', label: 'DL 2', x: 480, y: 70, color: '#058538', subLabel: 'Burst!' },
          { id: 'bag-1', type: 'bag', label: 'BAG 1', x: 200, y: 150, color: '#d91b24' },
          { id: 'bag-2', type: 'bag', label: 'BAG 2', x: 480, y: 150, color: '#d91b24' },
          { id: 'cone-1', type: 'cone', label: 'FINISH', x: 150, y: 70, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'FINISH', x: 430, y: 70, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-1', type: 'straight', startX: 200, startY: 220, endX: 200, endY: 75, color: '#058538', dashed: true, label: 'Finished Burst' },
          { id: 'a-2', type: 'straight', startX: 480, startY: 220, endX: 480, endY: 75, color: '#058538', dashed: true, label: 'Finished Burst' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'drill-2',
    category: 'DL',
    categoryLabel: 'Defensive Line (DT/NT)',
    title: 'STRIKE, LOCK & SHED',
    subtitle: 'Elbow Lockout & Violent Disengagement',
    objective: 'Control offensive linemen with inside hand punch, lock elbows out, then rip through the ballcarrier.',
    setup: 'Set 1 offensive lineman with hand shields or full pads on LOS. Defensive lineman aligns shaded on breastplate. Running back stands 5 yards deep holding a football.',
    instructions: [
      'DL coils in 3-point stance shaded on offensive lineman’s shoulder.',
      'On snap, punch both palms violently into blocker’s chest plate with thumbs up and elbows tucked tight.',
      'Lock both elbows out straight, establishing separation so the blocker cannot grasp your jersey.',
      'Peak into the backfield to diagnose the ballcarrier’s cut; use a violent push/pull steering wheel action.',
      'Violently rip the trail arm through the blocker’s armpit, discard the blocker, and wrap the ballcarrier.',
    ],
    equipment: 'Hand shields / blocking pads, football, whistle.',
    cues: [
      '"Thumbs up, elbows glued to your ribs!"',
      '"Lock out the arms — do NOT let them touch your chest!"',
      '"Violent steering-wheel push/pull to shed!"',
    ],
    faults: [
      'Catching the blocker with chest or waist.',
      'Chicken-wing elbows (flaring out wide loses leverage).',
      'Peeking into backfield before locking out blocker.',
    ],
    phases: [
      {
        name: 'PHASE 1: ENGAGE STANCE (1-ON-1)',
        description: 'Line up shaded on the offensive lineman. Ready to strike numbers on snap.',
        tokens: [
          { id: 'bc-1', type: 'O', label: 'RB', x: 350, y: 90, color: '#e06c00', subLabel: 'Ball' },
          { id: 'ol-1', type: 'O', label: 'OL', x: 350, y: 200, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DL', x: 350, y: 275, color: '#0052cc' },
        ],
        arrows: [
          { id: 'a-1', type: 'blitz', startX: 350, startY: 265, endX: 350, endY: 225, color: '#0052cc', label: 'Violent 2-Hand Punch' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: BREASTPLATE STRIKE & LOCKOUT',
        description: 'Elbows locked straight. Steer blocker like a wheel while tracking ballcarrier eyes.',
        tokens: [
          { id: 'bc-1', type: 'O', label: 'RB', x: 350, y: 90, color: '#e06c00', subLabel: 'Ball' },
          { id: 'ol-1', type: 'O', label: 'OL', x: 350, y: 185, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DL', x: 350, y: 260, color: '#0052cc', subLabel: 'Lockout' },
        ],
        arrows: [
          { id: 'a-1', type: 'curved', startX: 330, startY: 250, endX: 380, endY: 250, controlX: 355, controlY: 225, color: '#d91b24', label: 'Push/Pull Steer' },
          { id: 'a-2', type: 'blitz', startX: 335, startY: 245, endX: 345, endY: 125, color: '#058538', dashed: true, label: 'Rip Path' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 3: STEER, RIP & TACKLE CONE',
        description: 'Toss blocker aside with rip arm and accelerate straight into the ballcarrier.',
        tokens: [
          { id: 'bc-1', type: 'O', label: 'RB', x: 350, y: 80, color: '#e06c00', subLabel: 'Ballcarrier' },
          { id: 'ol-1', type: 'O', label: 'OL', x: 430, y: 215, color: '#64748b', subLabel: 'Shed' },
          { id: 'dl-1', type: 'X', label: 'DL', x: 350, y: 140, color: '#058538', subLabel: 'Tackle' },
        ],
        arrows: [
          { id: 'a-1', type: 'blitz', startX: 370, startY: 215, endX: 420, endY: 215, color: '#d91b24', label: 'Blocker Tossed' },
          { id: 'a-2', type: 'straight', startX: 350, startY: 220, endX: 350, endY: 155, color: '#058538', label: 'Clean Rip & Wrap' },
        ],
        zones: [
          { id: 'z-tackle', name: 'TACKLE BOX', cx: 350, cy: 110, rx: 65, ry: 45, color: '#058538', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-3',
    category: 'DE',
    categoryLabel: 'Defensive Ends (Edge)',
    title: 'SPILL VS. BOX GAP FIT',
    subtitle: 'Wrong-Arm Pullers & Funnel Ball to Scraping LB',
    objective: 'Interior DL wrong-arms pulling guard to force ball outside; Edge DE maintains outside arm free.',
    setup: 'Offense lines up with Center, Right Guard (puller), Right Tackle, and Running Back. Defense lines up with DE in 5-tech outside RT and Middle Linebacker stacked at 4.5 yards depth.',
    instructions: [
      'DE keys the offensive tackle and guard on the snap.',
      'As Right Guard pulls across, DE attacks the puller’s inside hip with their outside shoulder ("wrong-arm").',
      'The collision clogs the designated B/C gap, forcing the running back to bounce wide.',
      'Middle Linebacker scrapes clean over the top of the pile, tracking the running back inside-out.',
      'MLB meets the bounced runner behind the line of scrimmage for a tackle for loss.',
    ],
    equipment: 'Cones, hand shields, football, whistle.',
    cues: [
      '"DL spills the soup, linebackers eat it!"',
      '"Outside shoulder into the puller\'s inside hip!"',
      '"Bounce the ball sideways to sideline pursuit!"',
    ],
    faults: [
      'Letting the pulling guard kick you out toward sideline.',
      'Trying to jump around the puller instead of striking.',
      'DE caving inside and surrendering outside edge.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP READ (TRAP/POWER)',
        description: 'Offense shows trap/pull action. DE sets up on tight end/tackle shoulder.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 200, y: 195, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 290, y: 195, color: '#e06c00', subLabel: 'Puller' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 380, y: 195, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 240, y: 130, color: '#0052cc' },
          { id: 'de-1', type: 'X', label: 'DE', x: 420, y: 275, color: '#0052cc', subLabel: 'Spiller' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 450, y: 350, color: '#058538', subLabel: 'Scrape' },
        ],
        arrows: [
          { id: 'a-pull', type: 'curved', startX: 290, startY: 195, endX: 420, endY: 255, controlX: 350, controlY: 260, color: '#e06c00', dashed: true, label: 'Guard Pull (Trap)' },
          { id: 'a-rt-block', type: 'block', startX: 380, startY: 195, endX: 320, endY: 240, color: '#1a1a24', label: 'Down Block' },
          { id: 'a-de-charge', type: 'blitz', startX: 420, startY: 275, endX: 420, endY: 240, color: '#0052cc', label: 'Attack Hip' },
        ],
        zones: [
          { id: 'z-a-gap', name: 'A-GAP', cx: 245, cy: 220, rx: 30, ry: 20, color: '#0052cc', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: GUARD PULL & WRONG-ARM COLLISION',
        description: 'DE attacks the inside hip of the pulling guard with outside shoulder, blowing up the gap.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 200, y: 195, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 350, y: 220, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 390, y: 235, color: '#e06c00', subLabel: 'Collision' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 155, color: '#0052cc' },
          { id: 'de-1', type: 'X', label: 'DE', x: 440, y: 255, color: '#d91b24', subLabel: 'Impact!' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 480, y: 320, color: '#058538', subLabel: 'Over Top' },
        ],
        arrows: [
          { id: 'a-spill', type: 'curved', startX: 360, startY: 155, endX: 470, endY: 165, controlX: 410, controlY: 150, color: '#d91b24', label: 'BALL BOUNCES WIDE' },
          { id: 'a-mlb-scrape', type: 'blitz', startX: 480, startY: 310, endX: 490, endY: 200, color: '#058538', label: 'Scrape to Spill' },
        ],
        zones: [
          { id: 'z-spill-zone', name: 'SPILL FUNNEL', cx: 470, cy: 190, rx: 55, ry: 35, color: '#d91b24', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: BALL BOUNCES TO SCRAPING LB',
        description: 'RB is forced sideways with no cutback lane. Scraping MLB makes free tackle for loss.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 200, y: 195, color: '#64748b' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 310, y: 230, color: '#64748b' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 370, y: 245, color: '#64748b' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 450, y: 160, color: '#0052cc', subLabel: 'Stranded' },
          { id: 'de-1', type: 'X', label: 'DE', x: 390, y: 260, color: '#d91b24', subLabel: 'Spilled' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 500, y: 185, color: '#058538', subLabel: 'TFL!' },
        ],
        arrows: [
          { id: 'a-tackle', type: 'straight', startX: 500, startY: 185, endX: 465, endY: 165, color: '#058538', label: 'Tackle for Loss' },
        ],
        zones: [
          { id: 'z-tfl', name: 'TFL ZONE', cx: 480, cy: 180, rx: 60, ry: 40, color: '#058538', opacity: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'drill-4',
    category: 'DE',
    categoryLabel: 'Defensive Ends (Edge)',
    title: 'POCKET COLLAPSE & CONTAIN',
    subtitle: 'Edge Contain Ceiling & Interior Bull Push',
    objective: 'Interior DTs crush pocket depth while DEs restrict QB scrambles beyond pocket level.',
    setup: 'Offensive line sets 5-man pass protection (LT, LG, C, RG, RT) with QB taking 3-step shotgun drop. Defense aligns 4-man rush: 2 interior DTs and 2 edge DEs.',
    instructions: [
      'On snap, interior defensive tackles execute violent bull rushes, driving guards straight back into the QB’s lap.',
      'Edge rushers take outside arcs, keeping outside arm free to set the contain ceiling at the QB’s drop depth.',
      'DEs must never rush deeper than the QB’s launch point, preventing any escape lane.',
      'As interior pressure flushes the QB outside, edge contain defender constricts the rollout path for the sack.',
    ],
    equipment: '5 offensive linemen (or shields), QB with football, whistle.',
    cues: [
      '"DEs: Never rush deeper than the QB\'s drop!"',
      '"Keep outside shoulder clean for contain!"',
      '"DTs: Bull rush the guard into QB\'s face!"',
    ],
    faults: [
      'Speed rushing 10 yards deep, creating open scramble B-gap.',
      'Interior tackles getting locked up without pushing pocket.',
      'Biting on play-action rollouts and losing edge.',
    ],
    phases: [
      {
        name: 'PHASE 1: 4-MAN FRONT ALIGNMENT',
        description: 'DEs align in 5-tech / 7-tech. DTs align in 3-tech & 1-tech.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 200, y: 195, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 275, y: 195, color: '#1a1a24' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 350, y: 195, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 425, y: 195, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 500, y: 195, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 130, color: '#d91b24' },
          { id: 'lde',  type: 'X', label: 'LDE', x: 155, y: 275, color: '#0052cc', subLabel: 'Contain' },
          { id: 'ldt',  type: 'X', label: 'LDT', x: 275, y: 275, color: '#0052cc', subLabel: 'Bull' },
          { id: 'rdt',  type: 'X', label: 'RDT', x: 425, y: 275, color: '#0052cc', subLabel: 'Bull' },
          { id: 'rde',  type: 'X', label: 'RDE', x: 545, y: 275, color: '#0052cc', subLabel: 'Contain' },
        ],
        arrows: [
          { id: 'a-lde', type: 'curved', startX: 155, startY: 270, endX: 185, endY: 150, controlX: 135, controlY: 200, color: '#0052cc', label: 'Contain Arc' },
          { id: 'a-rde', type: 'curved', startX: 545, startY: 270, endX: 515, endY: 150, controlX: 565, controlY: 200, color: '#0052cc', label: 'Contain Arc' },
          { id: 'a-ldt', type: 'blitz', startX: 275, startY: 270, endX: 275, endY: 225, color: '#0052cc', label: 'Bull Rush' },
          { id: 'a-rdt', type: 'blitz', startX: 425, startY: 270, endX: 425, endY: 225, color: '#0052cc', label: 'Bull Rush' },
        ],
        zones: [
          { id: 'z-pocket', name: 'POCKET LEVEL (QB DROP CEILING)', cx: 350, cy: 140, rx: 140, ry: 35, color: '#d91b24', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: VERTICAL PUSH & CONTAIN DEPTH',
        description: 'Interior tackles crush the pocket backwards. Edge rushers set the contain ceiling.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 200, y: 185, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 275, y: 175, color: '#1a1a24' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 350, y: 185, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 425, y: 175, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 500, y: 185, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 130, color: '#d91b24' },
          { id: 'lde',  type: 'X', label: 'LDE', x: 175, y: 180, color: '#0052cc', subLabel: 'Wall' },
          { id: 'ldt',  type: 'X', label: 'LDT', x: 275, y: 215, color: '#058538', subLabel: 'Crush' },
          { id: 'rdt',  type: 'X', label: 'RDT', x: 425, y: 215, color: '#058538', subLabel: 'Crush' },
          { id: 'rde',  type: 'X', label: 'RDE', x: 525, y: 180, color: '#0052cc', subLabel: 'Wall' },
        ],
        arrows: [
          { id: 'a-push-l', type: 'blitz', startX: 280, startY: 210, endX: 320, endY: 155, color: '#058538', label: 'Squeeze' },
          { id: 'a-push-r', type: 'blitz', startX: 420, startY: 210, endX: 380, endY: 155, color: '#058538', label: 'Squeeze' },
        ],
        zones: [
          { id: 'z-crush', name: 'COLLAPSED POCKET', cx: 350, cy: 155, rx: 70, ry: 35, color: '#058538', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: SQUEEZE POCKET ON ROLLOUT',
        description: 'QB panics and attempts to escape right. RDE constricts contain angle for sack.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 200, y: 200, color: '#64748b' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 275, y: 190, color: '#64748b' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 350, y: 200, color: '#64748b' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 410, y: 180, color: '#64748b' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 470, y: 175, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 430, y: 135, color: '#d91b24', subLabel: 'Rollout' },
          { id: 'lde',  type: 'X', label: 'LDE', x: 215, y: 170, color: '#0052cc', subLabel: 'Backside' },
          { id: 'ldt',  type: 'X', label: 'LDT', x: 315, y: 170, color: '#058538', subLabel: 'Chase' },
          { id: 'rdt',  type: 'X', label: 'RDT', x: 385, y: 155, color: '#058538', subLabel: 'Flush' },
          { id: 'rde',  type: 'X', label: 'RDE', x: 490, y: 135, color: '#0052cc', subLabel: 'WALL SACK' },
        ],
        arrows: [
          { id: 'a-scramble', type: 'straight', startX: 360, startY: 150, endX: 420, endY: 135, color: '#d91b24', dashed: true, label: 'QB Scramble' },
          { id: 'a-rde-wall', type: 'blitz', startX: 520, startY: 160, endX: 475, endY: 135, color: '#0052cc', label: 'EDGE WALLED' },
        ],
        zones: [
          { id: 'z-sack', name: 'SACK CORRAL', cx: 450, cy: 135, rx: 50, ry: 30, color: '#0052cc', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-5',
    category: 'DE',
    categoryLabel: 'Defensive Ends (Edge)',
    title: 'HOOP BEND & DIP (CORNER FLATTEN)',
    subtitle: 'Ankle Flexion, Shoulder Dip & Tight Arc',
    objective: 'Edge rushers bend around agile hoops without upright pop-up, dipping the inside shoulder under OT hands and flattening to the QB launch point.',
    setup: 'Lay 2 circular agility hoops or curved cone tracks around the offensive tackle spot leading 7 yards deep toward the QB launch spot. Place agile dummy at QB spot.',
    instructions: [
      'DE aligns in a wide 7-technique stance outside the tackle.',
      'On ball movement, explode upfield for 3 steps along the hoop curve with extreme ankle flexion.',
      'Dip the inside shoulder low ("scrape the grass") under the tackle’s punch level.',
      'Violently rip the outside arm upward to prevent the blocker from recovering.',
      'Flatten immediately at a sharp 90-degree angle to the QB launch point and finish with a tomahawk chop on the football.',
    ],
    equipment: 'Agility hoops / curved cones, stand-up dummy, football.',
    cues: [
      '"Dip the inside shoulder low — scrape the grass!"',
      '"Violent upward rip through the tackle\'s armpit!"',
      '"Flatten immediately to the QB launch spot — no looping!"',
    ],
    faults: [
      'Standing upright around the hoop, allowing the OT to shove rusher past the play.',
      'Slipping on the turn from leaning on heels instead of balls of feet.',
      'Ballooning wide and losing the direct corner angle to the quarterback.',
    ],
    phases: [
      {
        name: 'PHASE 1: STANCE & EXPLOSIVE 3-STEP ARC',
        description: 'DE aligns in 7-technique. On snap, fires 3 explosive steps bending tightly along the outside hoop boundary.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'RT', x: 380, y: 195, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 120, color: '#d91b24' },
          { id: 'de-1', type: 'X', label: 'DE', x: 480, y: 275, color: '#0052cc', subLabel: '7-Tech' },
          { id: 'cone-1', type: 'cone', label: 'HOOP-1', x: 440, y: 210, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'HOOP-2', x: 400, y: 150, color: '#e06c00' },
          { id: 'bag-1', type: 'bag', label: 'AGILE DUMMY', x: 310, y: 120, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-step1', type: 'curved', startX: 480, startY: 270, endX: 420, endY: 175, controlX: 480, controlY: 210, color: '#0052cc', label: 'Tight Arc' },
          { id: 'a-ot-kick', type: 'straight', startX: 380, startY: 195, endX: 410, endY: 185, color: '#1a1a24', dashed: true, label: 'Kick Slide' },
        ],
        zones: [
          { id: 'z-hoop', name: 'HOOP BEND ZONE', cx: 420, cy: 180, rx: 65, ry: 45, color: '#0052cc', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: INSIDE SHOULDER DIP & RIP',
        description: 'DE sinks hips, dips inside shoulder under OT punch hands, and explodes upward with a violent arm rip.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'RT', x: 400, y: 210, color: '#1a1a24', subLabel: 'Beaten' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 120, color: '#d91b24' },
          { id: 'de-1', type: 'X', label: 'DE', x: 390, y: 160, color: '#058538', subLabel: 'Dip & Rip' },
          { id: 'cone-1', type: 'cone', label: 'HOOP-1', x: 450, y: 220, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'HOOP-2', x: 420, y: 160, color: '#e06c00' },
          { id: 'bag-1', type: 'bag', label: 'AGILE DUMMY', x: 310, y: 120, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-rip', type: 'blitz', startX: 385, startY: 160, endX: 310, endY: 125, color: '#058538', label: 'Flatten Corner' },
        ],
        zones: [
          { id: 'z-dip', name: 'LEVERAGE APEX', cx: 385, cy: 160, rx: 35, ry: 25, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: FLATTEN TO LAUNCH POINT & STRIP-SACK',
        description: 'DE flattens sharply at 90 degrees, closes distance to QB throwing arm, and finishes with a tomahawk strip-sack.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'RT', x: 410, y: 210, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 120, color: '#d91b24', subLabel: 'Sacked' },
          { id: 'de-1', type: 'X', label: 'DE', x: 295, y: 130, color: '#058538', subLabel: 'STRIP SACK' },
          { id: 'cone-1', type: 'cone', label: 'HOOP-1', x: 450, y: 220, color: '#e06c00' },
          { id: 'cone-2', type: 'cone', label: 'HOOP-2', x: 420, y: 160, color: '#e06c00' },
          { id: 'bag-1', type: 'bag', label: 'FUMBLE', x: 225, y: 90, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-finish', type: 'straight', startX: 335, startY: 135, endX: 295, endY: 130, color: '#058538', label: 'Tomahawk Swipe' },
        ],
        zones: [
          { id: 'z-strip', name: 'TURNOVER CRADLE', cx: 250, cy: 115, rx: 45, ry: 30, color: '#058538', opacity: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'drill-6',
    category: 'DL',
    categoryLabel: 'Defensive Line (DT/NT)',
    title: '2-ON-1 SPLIT & ANCHOR (DOUBLE TEAM)',
    subtitle: 'Low Center of Gravity, Corkscrew & Seam Jam',
    objective: 'DT recognizes Guard & Tackle double team, drops pad level, corkscrews into the post blocker, and splits the seam without giving ground so linebackers scrape clean.',
    setup: 'Set Center, Right Guard (post blocker), and Right Tackle (drive blocker) in offensive line formation. DT aligns in 3-technique shade on the Guard. Stack MLB 4 yards behind DT.',
    instructions: [
      'On snap, Guard strikes post while Tackle attempts to double-team down.',
      'DT immediately drops hips below the blockers\' breastplates to win leverage.',
      'Drop down-knee to turf and corkscrew torso hard into the post blocker, splitting the seam.',
      'Refuse to give ground—create a wall on the line of scrimmage preventing linemen from climbing.',
      'Middle Linebacker reads the stalemate, scrapes downhill completely unblocked, and wraps up the running back for a loss.',
    ],
    equipment: '3 offensive linemen (or shields), RB with football, whistle.',
    cues: [
      '"Drop your hips below their breastplates!"',
      '"Drop a knee and corkscrew into the post blocker!"',
      '"Split the seam or build a wall — do NOT let them climb to LB!"',
    ],
    faults: [
      'Turning sideways and getting driven 4 yards into linebacker\'s lap.',
      'Standing straight up upon initial impact.',
      'Trying to dance around the block, leaving a gaping A/B-gap crease.',
    ],
    phases: [
      {
        name: 'PHASE 1: POST BLOCKER STRIKE & COMBO READ',
        description: 'DT aligns in 3-tech on Guard. Snap fires, Guard hits post while Tackle crashes down on combo.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 220, y: 195, color: '#1a1a24' },
          { id: 'g-1', type: 'O', label: 'RG', x: 300, y: 195, color: '#1a1a24', subLabel: 'Post' },
          { id: 't-1', type: 'O', label: 'RT', x: 390, y: 195, color: '#1a1a24', subLabel: 'Drive' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 340, y: 125, color: '#0052cc' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 345, y: 275, color: '#0052cc', subLabel: '3-Tech' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 345, y: 360, color: '#058538', subLabel: 'Clean' },
        ],
        arrows: [
          { id: 'a-g-hit', type: 'straight', startX: 300, startY: 200, endX: 330, endY: 245, color: '#1a1a24', label: 'Post Contact' },
          { id: 'a-t-hit', type: 'straight', startX: 390, startY: 200, endX: 360, endY: 245, color: '#1a1a24', label: 'Combo Down' },
          { id: 'a-dt-strike', type: 'blitz', startX: 345, startY: 270, endX: 345, endY: 245, color: '#0052cc', label: 'Violent Hands' },
        ],
        zones: [
          { id: 'z-combo', name: 'DOUBLE TEAM CONVERGENCE', cx: 345, cy: 240, rx: 55, ry: 25, color: '#d91b24', opacity: 0.18 },
        ],
      },
      {
        name: 'PHASE 2: CORKSCREW & SEAM SPLIT',
        description: 'DT drops down-knee to turf, lowers pad level, corkscrews hips to split between Guard and Tackle.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 220, y: 195, color: '#1a1a24' },
          { id: 'g-1', type: 'O', label: 'RG', x: 305, y: 220, color: '#1a1a24' },
          { id: 't-1', type: 'O', label: 'RT', x: 385, y: 220, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 345, y: 155, color: '#0052cc' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 345, y: 245, color: '#d91b24', subLabel: 'Corkscrew' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 345, y: 325, color: '#058538', subLabel: 'Shooting Gap' },
        ],
        arrows: [
          { id: 'a-wedge', type: 'blitz', startX: 345, startY: 255, endX: 345, endY: 215, color: '#d91b24', label: 'Split Seam' },
          { id: 'a-mlb-shoot', type: 'straight', startX: 345, startY: 320, endX: 345, endY: 255, color: '#058538', label: 'Scrape Downhill' },
        ],
        zones: [
          { id: 'z-pile', name: 'STALEMATE WEDGE', cx: 345, cy: 230, rx: 45, ry: 25, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: PILE CREATION & MLB CLEAN-UP',
        description: 'DT holds both linemen in place, preventing climb to second level. MLB shoots untouched for TFL.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 220, y: 195, color: '#64748b' },
          { id: 'g-1', type: 'O', label: 'RG', x: 295, y: 230, color: '#64748b' },
          { id: 't-1', type: 'O', label: 'RT', x: 395, y: 230, color: '#64748b' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 345, y: 145, color: '#0052cc', subLabel: 'Halted' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 345, y: 245, color: '#d91b24', subLabel: 'Anchored' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 345, y: 195, color: '#058538', subLabel: 'TFL HIT!' },
        ],
        arrows: [
          { id: 'a-tfl', type: 'straight', startX: 345, startY: 230, endX: 345, endY: 170, color: '#058538', label: 'Run Stuffed' },
        ],
        zones: [
          { id: 'z-tfl-stop', name: 'WALL AT LINE OF SCRIMMAGE', cx: 345, cy: 215, rx: 50, ry: 25, color: '#058538', opacity: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'drill-7',
    category: 'DE',
    categoryLabel: 'Defensive Ends (Edge)',
    title: 'REACH VS. DOWN BLOCK (HAT-TRACK MIRROR)',
    subtitle: 'Helmet Direction Read & Gap Control',
    objective: 'DL reads offensive tackle\'s initial helmet step. If OT reaches outside, punch and fight across face; if OT blocks down, squeeze the line and destroy the kick-out puller.',
    setup: 'Offense aligns Right Guard and Right Tackle with RB 4 yards deep. DE lines up in 5-technique shaded on the Tackle’s outside eye. Place C-gap indicator cone.',
    instructions: [
      'DE keys the offensive tackle’s helmet movement upon the snap.',
      'IF REACH STEP (lateral hat): Punch outside breastplate, maintain outside arm free, and fight across face to set hard perimeter.',
      'IF DOWN BLOCK (inside hat): Squeeze hip of the OT down the line, close B/C gap, and hunt the incoming kick-out puller.',
      'Never run upfield blindly on a down block.',
      'Shed the blocker with violent rip, turning the ballcarrier back into pursuit.',
    ],
    equipment: 'Linemen pads/shields, football, gap cone, whistle.',
    cues: [
      '"Read the helmet hat: Outside reach or washing down?"',
      '"Reach: Punch, fight across face, keep outside arm free!"',
      '"Down block: Squeeze the hip, hunt the kick-out, do not run upfield!"',
    ],
    faults: [
      'Running upfield blindly on a down block, opening up a giant running lane.',
      'Allowing the reach blocker to hook outside arm on outside zone.',
      'Peeking into backfield instead of keying offensive lineman\'s helmet.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP 5-TECH ALIGNMENT',
        description: 'DE aligns in 5-technique on RT outside eye. Eyes locked onto RT helmet and breastplate.',
        tokens: [
          { id: 'rg-1', type: 'O', label: 'RG', x: 260, y: 195, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 350, y: 195, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 290, y: 125, color: '#0052cc' },
          { id: 'de-1', type: 'X', label: 'DE', x: 400, y: 275, color: '#0052cc', subLabel: '5-Tech' },
          { id: 'cone-1', type: 'cone', label: 'GAP-C', x: 460, y: 195, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-read-reach', type: 'straight', startX: 350, startY: 195, endX: 395, endY: 195, color: '#d91b24', dashed: true, label: 'Path A: Reach Step' },
          { id: 'a-read-down', type: 'straight', startX: 350, startY: 195, endX: 295, endY: 220, color: '#058538', dashed: true, label: 'Path B: Down Block' },
        ],
        zones: [
          { id: 'z-los', name: 'LINE OF SCRIMMAGE READ', cx: 350, cy: 220, rx: 80, ry: 25, color: '#0052cc', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: REACH BLOCK REACTION (FIGHT ACROSS FACE)',
        description: 'RT takes lateral reach step to seal. DE strikes outside breastplate, stays square, and fights across face.',
        tokens: [
          { id: 'rg-1', type: 'O', label: 'RG', x: 270, y: 205, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 375, y: 205, color: '#1a1a24', subLabel: 'Reach Attempt' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 360, y: 145, color: '#0052cc', subLabel: 'Outside Zone' },
          { id: 'de-1', type: 'X', label: 'DE', x: 430, y: 245, color: '#058538', subLabel: 'Outside Leverage' },
          { id: 'cone-1', type: 'cone', label: 'GAP-C', x: 480, y: 195, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-de-reach', type: 'blitz', startX: 430, startY: 245, endX: 430, endY: 195, color: '#058538', label: 'Punch & Extend' },
          { id: 'a-rb-flow', type: 'curved', startX: 360, startY: 145, endX: 440, endY: 160, controlX: 400, controlY: 140, color: '#0052cc', label: 'Stretch' },
        ],
        zones: [
          { id: 'z-seal', name: 'C-GAP EDGE CONTROL', cx: 430, cy: 215, rx: 45, ry: 30, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: SHED & FORCE RUNNER BACK INSIDE',
        description: 'DE locks out arm, sheds RT with violent rip, forces RB to hesitate and cut back into pursuing defense.',
        tokens: [
          { id: 'rg-1', type: 'O', label: 'RG', x: 270, y: 215, color: '#64748b' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 365, y: 215, color: '#64748b', subLabel: 'Shed' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 420, y: 160, color: '#0052cc', subLabel: 'Forced Inside' },
          { id: 'de-1', type: 'X', label: 'DE', x: 475, y: 195, color: '#058538', subLabel: 'SHUTDOWN' },
          { id: 'cone-1', type: 'cone', label: 'GAP-C', x: 500, y: 245, color: '#e06c00' },
        ],
        arrows: [
          { id: 'a-turnback', type: 'curved', startX: 420, startY: 160, endX: 350, endY: 180, controlX: 390, controlY: 150, color: '#d91b24', label: 'Cutback Corral' },
          { id: 'a-de-tackle', type: 'straight', startX: 475, startY: 195, endX: 430, endY: 165, color: '#058538', label: 'Edge Tackler' },
        ],
        zones: [
          { id: 'z-corral', name: 'CUTBACK TRAP', cx: 385, cy: 175, rx: 50, ry: 30, color: '#058538', opacity: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'drill-8',
    category: 'DL',
    categoryLabel: 'Defensive Line (DT/NT)',
    title: 'SCREEN & DRAW RETRACE (HIGH-HAT DIAGNOSIS)',
    subtitle: 'Trap Recognition & Retrace Sprint to Alley',
    objective: 'DL recognizes "too easy" offensive line pass release, immediately yells "SCREEN!", plants outside foot, retraces footsteps, and chases down the receiver from behind.',
    setup: 'Offense lines up with LT, Center, and RT in pass protection sets, QB in shotgun, and RB releasing into the flat. Defense aligns DT and DE in pass rush alignments.',
    instructions: [
      'DL rushes upfield on pass set cues.',
      'If the offensive linemen pop high and let you slip through without resistance ("too easy"), immediately yell "SCREEN!".',
      'Plant outside cleat in the turf, sink hips, and reverse direction (retrace).',
      'Sprint full throttle into the screen tunnel behind the offensive line’s blocking convoy.',
      'Make the vice tackle on the screen receiver from behind before the convoy can seal the alley.',
    ],
    equipment: 'Offensive line shields, QB with football, RB receiver, whistle.',
    cues: [
      '"If it feels too easy, it\'s a screen or draw!"',
      '"Yell \'SCREEN!\' so the whole defense swarms downhill!"',
      '"Plant cleats and retrace — sprint into the screen tunnel!"',
    ],
    faults: [
      'Running 10 yards past the QB without noticing the offensive line letting you go.',
      'Silent reaction — failing to call out "SCREEN!" verbally.',
      'Loafing or jogging on the retrace angle instead of full-throttle pursuit.',
    ],
    phases: [
      {
        name: 'PHASE 1: HIGH-HAT PASS SET BY OFFENSIVE LINE',
        description: 'Linemen pop high into pass sets. DL fires upfield aggressively on pass rush track.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 240, y: 195, color: '#1a1a24' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 350, y: 195, color: '#1a1a24' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 460, y: 195, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 125, color: '#d91b24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 270, y: 105, color: '#0052cc', subLabel: 'Screen Target' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 380, y: 275, color: '#0052cc', subLabel: 'Rush' },
          { id: 'de-1', type: 'X', label: 'DE', x: 490, y: 275, color: '#0052cc', subLabel: 'Rush' },
        ],
        arrows: [
          { id: 'a-rush-de', type: 'blitz', startX: 490, startY: 265, endX: 470, endY: 180, color: '#0052cc', label: 'Upfield Burst' },
          { id: 'a-rush-dt', type: 'blitz', startX: 380, startY: 265, endX: 370, endY: 180, color: '#0052cc', label: 'Upfield Burst' },
          { id: 'a-qb-drop', type: 'straight', startX: 350, startY: 180, endX: 350, endY: 125, color: '#d91b24', dashed: true, label: '3-Step Drop' },
        ],
        zones: [
          { id: 'z-bait', name: 'SCREEN BAIT ZONE', cx: 350, cy: 175, rx: 110, ry: 35, color: '#d91b24', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: "TOO EASY" RELEASE & RETRACE TRIGGER',
        description: 'OL allows DL to bypass them and releases outside. DL recognizes trick, yells "SCREEN!", plants and retraces.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 210, y: 185, color: '#e06c00', subLabel: 'Wall' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 270, y: 185, color: '#e06c00', subLabel: 'Wall' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 430, y: 195, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 125, color: '#d91b24', subLabel: 'Throws' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 160, y: 150, color: '#0052cc', subLabel: 'Catches Screen' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 360, y: 170, color: '#d91b24', subLabel: 'RETRACE!' },
          { id: 'de-1', type: 'X', label: 'DE', x: 450, y: 170, color: '#d91b24', subLabel: 'YELLS SCREEN!' },
        ],
        arrows: [
          { id: 'a-pass', type: 'straight', startX: 350, startY: 125, endX: 180, endY: 150, color: '#d91b24', dashed: true, label: 'Screen Pass' },
          { id: 'a-retrace-dt', type: 'curved', startX: 360, startY: 170, endX: 230, endY: 175, controlX: 300, controlY: 135, color: '#058538', label: 'Retrace Sprint' },
          { id: 'a-retrace-de', type: 'curved', startX: 450, startY: 170, endX: 270, endY: 180, controlX: 370, controlY: 125, color: '#058538', label: 'Pursuit Angle' },
        ],
        zones: [
          { id: 'z-retrace', name: 'SCREEN ALLEY', cx: 220, cy: 175, rx: 75, ry: 40, color: '#058538', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: TUNNEL PURSUIT & TACKLE BEHIND THE WALL',
        description: 'Retracing defensive linemen catch the back from behind before the screen wall can seal.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 150, y: 235, color: '#64748b' },
          { id: 'c-1',  type: 'O', label: 'C',  x: 220, y: 240, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 125, color: '#64748b' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 160, y: 170, color: '#0052cc', subLabel: 'Wrapped Up' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 215, y: 170, color: '#058538', subLabel: 'RETRACE TFL!' },
          { id: 'de-1', type: 'X', label: 'DE', x: 275, y: 170, color: '#058538', subLabel: 'Vice Tackle' },
        ],
        arrows: [
          { id: 'a-blowup', type: 'straight', startX: 275, startY: 170, endX: 225, endY: 170, color: '#058538', label: 'Tackle for Loss' },
        ],
        zones: [
          { id: 'z-tfl-screen', name: 'SCREEN DEFEATED', cx: 190, cy: 175, rx: 45, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-de-5',
    category: 'DE',
    categoryLabel: 'Defensive Ends (Edge)',
    title: 'STRIP-SACK & SCOOP-AND-SCORE',
    subtitle: 'Tomahawk Punch & Loose Ball Acceleration',
    objective: 'Edge rusher flattens corner on blind side, executes downward tomahawk swipe on quarterback throwing arm, scoops loose football in stride, and sprints to endzone.',
    setup: 'Offensive tackle sets on edge; QB stands 6 yards deep in passing posture holding a football. DE lines up in wide pass rush stance. Endzone marker cone 20 yards downfield.',
    instructions: [
      'DE explodes off the edge, sinking hips and dipping the inside shoulder around the tackle.',
      'Flatten the rush arc directly to the QB’s blind side.',
      'Target the quarterback’s cocked throwing arm—deliver a violent downward tomahawk chop onto the wrist and ball.',
      'As the football pops free, stay on your feet, bend knees, scoop the football with two hands without breaking stride.',
      'Tuck the ball high and tight and sprint across the goal line for a touchdown.',
    ],
    equipment: 'Blocking dummy or tackle, QB, football, endzone cone, whistle.',
    cues: [
      '"Target the throwing arm, not the body!"',
      '"Tomahawk chop downward violently across the wrist and football!"',
      '"Scoop with two hands and accelerate — do NOT break stride!"',
    ],
    faults: [
      'Tackling QB high around shoulders without attempting to strip the football.',
      'Trying to pick up ball with one hand and kicking it out of bounds.',
      'Assuming the play is dead instead of running into the endzone.',
    ],
    phases: [
      {
        name: 'PHASE 1: BLIND-SIDE CORNER FLATTEN',
        description: 'Left defensive end dips inside shoulder around the right tackle and flattens directly to the QB launch spot.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'RT', x: 380, y: 195, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 125, color: '#d91b24', subLabel: 'Pass Set' },
          { id: 'de-1', type: 'X', label: 'DE', x: 450, y: 275, color: '#0052cc', subLabel: 'Speed Rush' },
        ],
        arrows: [
          { id: 'a-speed', type: 'curved', startX: 450, startY: 270, endX: 320, endY: 140, controlX: 440, controlY: 170, color: '#0052cc', label: 'Corner Arc' },
        ],
        zones: [
          { id: 'z-launch', name: 'QB LAUNCH POCKET', cx: 250, cy: 125, rx: 50, ry: 35, color: '#d91b24', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: TOMAHAWK STRIP SWIPE',
        description: 'DE executes violent downward tomahawk chop on QB cocked throwing arm, knocking the football free.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'RT', x: 390, y: 210, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 125, color: '#d91b24', subLabel: 'Stripped' },
          { id: 'ball-1', type: 'ball', label: 'FUMBLE', x: 250, y: 70, color: '#e06c00' },
          { id: 'de-1', type: 'X', label: 'DE', x: 295, y: 135, color: '#058538', subLabel: 'TOMAHAWK!' },
        ],
        arrows: [
          { id: 'a-chop', type: 'straight', startX: 295, startY: 135, endX: 260, endY: 85, color: '#058538', label: 'Down-Chop' },
        ],
        zones: [
          { id: 'z-strip', name: 'FUMBLE IMPACT POINT', cx: 265, cy: 110, rx: 40, ry: 25, color: '#058538', opacity: 0.3 },
        ],
      },
      {
        name: 'PHASE 3: TWO-HAND SCOOP & SCORE',
        description: 'DE bends knees, scoops loose ball smoothly with two hands, and accelerates untouched down the sideline.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 250, y: 125, color: '#64748b' },
          { id: 'cone-td', type: 'cone', label: 'ENDZONE', x: 310, y: 35, color: '#058538' },
          { id: 'de-1', type: 'X', label: 'DE', x: 310, y: 85, color: '#058538', subLabel: 'TOUCHDOWN!' },
        ],
        arrows: [
          { id: 'a-scoop-burst', type: 'blitz', startX: 250, startY: 70, endX: 310, endY: 85, color: '#058538', label: 'Scoop & Sprint' },
        ],
        zones: [
          { id: 'z-td', name: 'TOUCHDOWN CELEBRATION', cx: 310, cy: 60, rx: 60, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-lb-1',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'SHUFFLE, MIRROR & SCRAPE (RUN FIT)',
    subtitle: '6-Inch Freeze Step & Inside-Out Flow',
    objective: 'Inside linebacker takes pre-snap 6-inch freeze step, mirrors ballcarrier flow keeping shoulders square, and scrapes downhill through the open gap to make solo tackle.',
    setup: 'Offense lines up with Center, Right Guard, QB, and Tailback. DT occupies Right Guard. MLB aligns 4.5 yards off the ball in base stance.',
    instructions: [
      'On snap, MLB takes a fast, controlled 6-inch read step while keeping eyes locked onto the tailback’s mesh.',
      'As the running back flows laterally toward the perimeter, shuffle laterally with shoulders completely square to the line of scrimmage.',
      'Do NOT cross your feet; maintain proper base and stay half-a-step inside the runner\'s inside hip.',
      'When the back cuts vertical toward the gap, plant the outside foot and trigger downhill with explosive acceleration.',
      'Wrap both arms through the thighs and drive through contact for a tackle for loss.',
    ],
    equipment: 'Shields/dummies for OL, football, whistle.',
    cues: [
      '"6-inch freeze step on snap — diagnose before committing!"',
      '"Shoulders square to LOS — don\'t cross your feet!"',
      '"Stay 1 step behind inside hip and trigger downhill!"',
    ],
    faults: [
      'Biting on play-action false keys.',
      'Crossing feet on lateral scrape, losing balance.',
      'Over-pursuing past the ballcarrier and giving up cutback lane.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP ALIGNMENT & FREEZE STEP',
        description: 'MLB is balanced 4.5 yards off LOS. On ball snap, takes a quick 6-inch control step with eyes locked on near back.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 420, y: 220, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 160, color: '#d91b24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 110, color: '#0052cc', subLabel: 'Tailback' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 420, y: 245, color: '#0052cc', subLabel: 'B-Gap' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 350, y: 310, color: '#058538', subLabel: 'Freeze Step' },
        ],
        arrows: [
          { id: 'a-freeze', type: 'straight', startX: 350, startY: 310, endX: 350, endY: 295, color: '#058538', dashed: true, label: '6" Read Step' },
          { id: 'a-mesh', type: 'straight', startX: 350, startY: 110, endX: 350, endY: 155, color: '#0052cc', label: 'Hand-Off' },
        ],
        zones: [
          { id: 'z-a-gap', name: 'A-GAP HOLE', cx: 380, cy: 220, rx: 30, ry: 20, color: '#058538', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: LATERAL SHUFFLE & MIRROR TRACK',
        description: 'RB presses lateral off-tackle. MLB shuffles sideways with square pads, staying half-a-step inside the runner\'s hip.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 430, y: 230, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 440, y: 160, color: '#0052cc', subLabel: 'Outside Flow' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 430, y: 250, color: '#0052cc', subLabel: 'Occupy' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 420, y: 290, color: '#058538', subLabel: 'Square Scrape' },
        ],
        arrows: [
          { id: 'a-rb-flow', type: 'straight', startX: 350, startY: 155, endX: 440, endY: 160, color: '#0052cc', label: 'Stretch' },
          { id: 'a-lb-scrape', type: 'straight', startX: 350, startY: 295, endX: 420, endY: 290, color: '#058538', dashed: true, label: 'Inside-Out Scrape' },
        ],
        zones: [
          { id: 'z-cutback', name: 'NO CUTBACK LANE', cx: 380, cy: 210, rx: 40, ry: 25, color: '#d91b24', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: DOWNHILL TRIGGER & TACKLE FOR LOSS',
        description: 'RB cuts vertical into C-gap. MLB plants outside foot, explodes downhill, and wraps up back behind LOS.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 460, y: 175, color: '#0052cc', subLabel: 'Contact' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 400, y: 250, color: '#64748b' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 460, y: 245, color: '#058538', subLabel: 'SOLO TFL!' },
        ],
        arrows: [
          { id: 'a-trigger', type: 'blitz', startX: 420, startY: 290, endX: 460, endY: 245, color: '#058538', label: 'Explode Downhill' },
        ],
        zones: [
          { id: 'z-tfl', name: 'TACKLE FOR LOSS ZONE', cx: 460, cy: 210, rx: 55, ry: 35, color: '#058538', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-lb-2',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'SHOCK, SHED & LEAD BLOCKER FILL',
    subtitle: 'Forearm Shiver & Violent Disengagement',
    objective: 'Linebacker attacks downhill into the hole, shocks the fullback/lead puller with inside forearm shiver, locks out arms, sheds into the ball path, and stops running back on the goal line.',
    setup: 'Offense lines up with Right Guard, Fullback (lead blocker), and Tailback. MLB aligns 4.5 yards deep stacked over the B-gap.',
    instructions: [
      'On snap, Fullback fires downhill on an Iso lead block into the B-gap.',
      'MLB attacks downhill instantly—delivering the blow on the defensive side of the line of scrimmage.',
      'Strike the lead blocker with an explosive inside forearm shiver/flipper directly under their pads.',
      'Lock out arms to stop the blocker’s momentum in the hole.',
      'Violently discard the lead blocker to the inside, square shoulders to the oncoming tailback, and make the chest-to-chest form tackle.',
    ],
    equipment: 'Blocking pads/shields, football, whistle.',
    cues: [
      '"Deliver the blow on your side of the line of scrimmage!"',
      '"Inside forearm shiver right under their pads!"',
      '"Violent shed into the gap — meet the back in the hole!"',
    ],
    faults: [
      'Catching the block instead of attacking downhill.',
      'Letting blocker reach chest and getting driven backward.',
      'Peeking around the block instead of striking through breastplate.',
    ],
    phases: [
      {
        name: 'PHASE 1: DOWNHILL TRIGGER ON ISO LEAD',
        description: 'Offense runs Lead Iso. Fullback charges into the B-gap. MLB steps downhill immediately to meet him in the hole.',
        tokens: [
          { id: 'rg-1', type: 'O', label: 'RG', x: 320, y: 220, color: '#1a1a24' },
          { id: 'fb-1', type: 'O', label: 'FB', x: 415, y: 130, color: '#e06c00', subLabel: 'Lead Blocker' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 415, y: 60, color: '#0052cc', subLabel: 'Ballcarrier' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 415, y: 345, color: '#058538', subLabel: 'Trigger' },
        ],
        arrows: [
          { id: 'a-fb-charge', type: 'straight', startX: 415, startY: 130, endX: 415, endY: 215, color: '#e06c00', label: 'Iso Block' },
          { id: 'a-lb-attack', type: 'blitz', startX: 415, startY: 335, endX: 415, endY: 240, color: '#058538', label: 'Attack LOS' },
        ],
        zones: [
          { id: 'z-iso-hole', name: 'ISO COLLISION POINT', cx: 415, cy: 225, rx: 45, ry: 24, color: '#058538', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: FOREARM SHIVER & LOCKOUT',
        description: 'MLB delivers an explosive flipper/forearm strike under FB pads, locks out elbows, and controls the gap.',
        tokens: [
          { id: 'fb-1', type: 'O', label: 'FB', x: 385, y: 210, color: '#e06c00', subLabel: 'Shocked!' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 395, y: 105, color: '#0052cc', subLabel: 'Searching' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 435, y: 245, color: '#d91b24', subLabel: 'Violent Shiver' },
        ],
        arrows: [
          { id: 'a-lockout', type: 'straight', startX: 435, startY: 245, endX: 395, endY: 215, color: '#d91b24', label: 'Arm Extension' },
        ],
        zones: [
          { id: 'z-plug', name: 'GAP PLUGGED', cx: 410, cy: 225, rx: 50, ry: 25, color: '#d91b24', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: SHED & GOAL-LINE STUFF',
        description: 'MLB rips through FB outside shoulder, squares up to the running back, and drives him backward for zero gain.',
        tokens: [
          { id: 'fb-1', type: 'O', label: 'FB', x: 325, y: 235, color: '#64748b', subLabel: 'Shed' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 410, y: 175, color: '#0052cc', subLabel: 'Stuffed' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 410, y: 245, color: '#058538', subLabel: 'GOAL-LINE STOP!' },
        ],
        arrows: [
          { id: 'a-stuff', type: 'straight', startX: 410, startY: 245, endX: 410, endY: 185, color: '#058538', label: 'Form Tackle' },
        ],
        zones: [
          { id: 'z-stop', name: 'GOAL LINE STAND', cx: 410, cy: 210, rx: 55, ry: 30, color: '#058538', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-lb-3',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: '45° DROP & ROBOT CROSSER PASS D',
    subtitle: 'Zone Depth, Seam Pass-Off & Break on Throw',
    objective: 'Linebacker reads high-hat pass set, opens hips at 45 degrees to reach 10-yard hook/curl depth, communicates and passes off crossing route, and breaks on QB throwing motion.',
    setup: 'Offense lines up Center, QB in shotgun, and Slot WR aligned wide left. Defense has WLB in boundary hook and MLB in middle hook.',
    instructions: [
      'MLB reads offensive lineman\'s high-hat pass protection set.',
      'Open hips at a 45-degree angle—sprint directly to 10-yard Hook/Curl landmark with eyes glued to the quarterback.',
      'Never backpedal on zone drops; open and run while keeping peripheral vision on receivers.',
      'When the slot receiver crosses underneath, WLB reroutes him physically and yells "IN! IN!" to pass off coverage to MLB.',
      'Plant back foot upon seeing QB’s front hand leave the ball and drive downhill to intercept the pass.',
    ],
    equipment: 'Footballs, cones for zone landmarks, whistle.',
    cues: [
      '"High hat pass read: Open hips 45° — never backpedal!"',
      '"Get hands on crosser and yell \'IN! IN!\' to pass off!"',
      '"Break on the quarterback\'s front shoulder!"',
    ],
    faults: [
      'Backpedaling on heels, losing vision and break speed.',
      'Chasing crosser all the way across field, leaving zone vacant.',
      'Failing to communicate pass-off calls verbally.',
    ],
    phases: [
      {
        name: 'PHASE 1: HIGH-HAT READ & 45-DEGREE DROP',
        description: 'Offensive line sets in high hat. MLB opens hips at 45 degrees, sprints 5 steps to Hook/Curl landmark with eyes on QB.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24', subLabel: 'High Hat' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 160, color: '#d91b24', subLabel: 'Dropback' },
          { id: 'wr-1', type: 'O', label: 'SLOT', x: 190, y: 220, color: '#0052cc', subLabel: 'Crosser' },
          { id: 'wlb-1', type: 'X', label: 'WLB', x: 260, y: 290, color: '#058538' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 350, y: 290, color: '#058538', subLabel: 'Open 45°' },
        ],
        arrows: [
          { id: 'a-drop-mlb', type: 'drop', startX: 350, startY: 290, endX: 370, endY: 360, color: '#058538', dashed: true, label: '45° Zone Drop' },
          { id: 'a-wr-cross', type: 'straight', startX: 190, startY: 220, endX: 300, endY: 280, color: '#0052cc', label: 'Shallow Cross' },
        ],
        zones: [
          { id: 'z-hook-curl', name: 'HOOK/CURL ZONE (10 YDS)', cx: 370, cy: 360, rx: 65, ry: 35, color: '#058538', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: REROUTE & PASS-OFF ("IN! IN!" CALL)',
        description: 'WLB reroutes crosser with collision, yells "IN! IN!", and passes him off to MLB sitting in the hook window.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24', subLabel: 'Winding Up' },
          { id: 'wr-1', type: 'O', label: 'SLOT', x: 320, y: 290, color: '#0052cc', subLabel: 'Rerouted' },
          { id: 'wlb-1', type: 'X', label: 'WLB', x: 280, y: 300, color: '#058538', subLabel: 'Pass Off' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 370, y: 350, color: '#058538', subLabel: 'Eyes on QB' },
        ],
        arrows: [
          { id: 'a-pass-off', type: 'straight', startX: 280, startY: 300, endX: 330, endY: 320, color: '#058538', dashed: true, label: '"IN! IN!" Call' },
        ],
        zones: [
          { id: 'z-window', name: 'PASSING WINDOW CONSTRICTED', cx: 340, cy: 310, rx: 55, ry: 30, color: '#d91b24', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: BREAK ON THROW & INTERCEPTION',
        description: 'QB loads to throw over the middle. MLB plants back foot, drives downhill into the lane, and picks off the pass.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#64748b' },
          { id: 'wr-1', type: 'O', label: 'SLOT', x: 350, y: 300, color: '#0052cc', subLabel: 'Target' },
          { id: 'mlb-1', type: 'X', label: 'MLB', x: 350, y: 295, color: '#058538', subLabel: 'PICK SIX!' },
        ],
        arrows: [
          { id: 'a-throw', type: 'straight', startX: 350, startY: 160, endX: 350, endY: 280, color: '#d91b24', dashed: true, label: 'Intercepted Pass' },
          { id: 'a-break-lb', type: 'blitz', startX: 370, startY: 350, endX: 350, endY: 295, color: '#058538', label: 'Downhill Drive' },
        ],
        zones: [
          { id: 'z-pick', name: 'TURNOVER / RETURN ALLEY', cx: 350, cy: 290, rx: 50, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-lb-4',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'DOUBLE A-GAP MUG & CROSS FIRE BLITZ',
    subtitle: 'Pre-Snap Disguise & Interior Stunt Cross',
    objective: 'Both inside linebackers walk up into A-gaps to mug the center, read snap, and execute cross-fire stunt blitz where one picks center and the other loops clean to the quarterback.',
    setup: 'Offense shows Center, Left Guard, Right Guard, and QB in shotgun. Both MLBs line up 1 yard off LOS in the left and right A-gaps.',
    instructions: [
      'On cadence, both linebackers creep down into the A-gaps to show aggressive double-A mug pressure.',
      'At the snap, Playside MLB 1 punches hard into the Center’s shoulder, turning the Center\'s shoulders and opening a gap.',
      'MLB 2 loops tight off MLB 1’s back hip into the vacated crease.',
      'Do not loop wide—scrape tight off the pick blocker to beat the guard’s recovery.',
      'Accelerate through the pocket to sack the quarterback before the drop is completed.',
    ],
    equipment: 'Offensive line shields, QB with football, whistle.',
    cues: [
      '"Creep into A-gap on the cadence — show max pressure!"',
      '"Playside LB crashes Center; Backside LB loops tight off hip!"',
      '"Wrap up the QB with chest-to-chest hit!"',
    ],
    faults: [
      'Jumping offsides pre-snap.',
      'Looping too wide and giving QB time to step up.',
      'Failing to disengage when offensive guard chips.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP DOUBLE A-GAP MUG',
        description: 'Both MLBs walk up right to the line of scrimmage in both A-gaps, forcing the center and quarterback into panic check.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 280, y: 220, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 420, y: 220, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24', subLabel: 'Shotgun' },
          { id: 'lb-1', type: 'X', label: 'MLB 1', x: 320, y: 245, color: '#d91b24', subLabel: 'Left A-Mug' },
          { id: 'lb-2', type: 'X', label: 'MLB 2', x: 380, y: 245, color: '#d91b24', subLabel: 'Right A-Mug' },
        ],
        arrows: [
          { id: 'a-mug-1', type: 'straight', startX: 320, startY: 280, endX: 320, endY: 245, color: '#d91b24', dashed: true, label: 'Walk Up' },
          { id: 'a-mug-2', type: 'straight', startX: 380, startY: 280, endX: 380, endY: 245, color: '#d91b24', dashed: true, label: 'Walk Up' },
        ],
        zones: [
          { id: 'z-pressure', name: 'DOUBLE A-GAP PRESSURE', cx: 350, cy: 230, rx: 70, ry: 30, color: '#d91b24', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: CENTER PICK & CROSS-FIRE STUNT',
        description: 'On snap, MLB 1 crashes hard into the center\'s left shoulder to occupy him, while MLB 2 loops tightly behind his back.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 365, y: 220, color: '#1a1a24', subLabel: 'Engaged' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 140, color: '#d91b24' },
          { id: 'lb-1', type: 'X', label: 'MLB 1', x: 320, y: 225, color: '#d91b24', subLabel: 'Pick Center' },
          { id: 'lb-2', type: 'X', label: 'MLB 2', x: 315, y: 175, color: '#058538', subLabel: 'Looping Free' },
        ],
        arrows: [
          { id: 'a-pick', type: 'straight', startX: 320, startY: 245, endX: 345, endY: 220, color: '#d91b24', label: 'Crash Center' },
          { id: 'a-cross', type: 'curved', startX: 380, startY: 245, endX: 315, endY: 175, controlX: 365, controlY: 225, color: '#058538', label: 'Tight Loop' },
        ],
        zones: [
          { id: 'z-stunt', name: 'STUNT CROSS APEX', cx: 335, cy: 200, rx: 50, ry: 25, color: '#058538', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: UNBLOCKED SACK IN THE POCKET',
        description: 'MLB 2 enters the backfield clean and buries the quarterback before he can hit the bottom of his drop.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 365, y: 220, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 320, y: 140, color: '#d91b24', subLabel: 'Sacked!' },
          { id: 'lb-1', type: 'X', label: 'MLB 1', x: 320, y: 225, color: '#64748b' },
          { id: 'lb-2', type: 'X', label: 'MLB 2', x: 375, y: 140, color: '#058538', subLabel: 'QB SACK!' },
        ],
        arrows: [
          { id: 'a-sack-finish', type: 'blitz', startX: 320, startY: 175, endX: 360, endY: 145, color: '#058538', label: 'Bury QB' },
        ],
        zones: [
          { id: 'z-sack-zone', name: 'SACK POINT (-7 YDS)', cx: 350, cy: 140, rx: 60, ry: 30, color: '#058538', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-lb-5',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'TRIANGLE BLOCK POP & DIRECTIONAL PEEK',
    subtitle: 'Separation Pop, Lead-Foot Peek & Cutback Redirect',
    videoUrl: 'https://www.facebook.com/reel/1072116722201615',
    objective: 'Linebacker fires downhill with coach-designated lead foot, delivers an explosive two-hand pop strike to blocker without grabbing cloth, peeks through to diagnose the ball carrier, and rapidly resets hips to redirect and tackle when the runner cuts opposite.',
    setup: 'Triangle alignment: Linebacker at top/apex 4.5 yards back; Blocker aligned 2 yards ahead with shield; Ball carrier 2-3 yards behind blocker. Coach stands behind LB or to side directing hand signals to ball carrier and calling lead foot to LB.',
    instructions: [
      'Pre-snap: Linebacker assumes a balanced, athletic linebacker stance with knees bent and chest over toes.',
      'Coach announces the lead foot (\'Right\' or \'Left\') to the linebacker, which determines whether the LB is peeking right or peeking left.',
      'Simultaneously, coach flashes a silent hand signal to the ball carrier directing whether to attack left or right.',
      'On the go-call/snap, the linebacker fires downhill aggressively leading with the designated foot.',
      'Deliver an explosive two-hand pop strike into the blocker’s breastplate to create immediate power and physical separation. Do NOT grab cloth on the pop-off so the blocker cannot latch on.',
      'Peek over the blocker’s shoulder in the designated direction to diagnose the ball carrier’s path.',
      'When the ball carrier cuts back to the opposite direction, disengage cleanly, sink hips, run back/reset feet, and redirect explosively to make the secure tackle.',
    ],
    equipment: 'Blocking shield/dummy, football, cones to mark triangle apex and running lanes.',
    cues: [
      '"Don\'t grab cloth on the pop-off — create instant separation!"',
      '"Lead foot dictates your peek — Right lead peeks right, Left lead peeks left!"',
      '"Pop, peek, reset hips, and explode on the cutback!"',
    ],
    faults: [
      'Grabbing the blocker\'s jersey/cloth instead of popping with violent open palms.',
      'Catching the block or letting the offensive player get into your chest.',
      'Peeking the wrong direction or guessing instead of trusting your lead-foot key.',
      'Failing to reset feet and get downhill when the ball carrier changes direction.',
    ],
    phases: [
      {
        name: 'PHASE 1: BASE TRIANGLE SETUP & LEAD-FOOT CALL',
        description: 'Triangle alignment with 3 blockers (B1 left, B2 middle, B3 right) and RB at top. Coach stands BEHIND LB calling lead foot and signaling RB lane.',
        tokens: [
          { id: 'cone-top', type: 'cone', label: 'Cone', x: 350, y: 75, color: '#f97316' },
          { id: 'cone-l', type: 'cone', label: 'Cone', x: 120, y: 370, color: '#f97316' },
          { id: 'cone-r', type: 'cone', label: 'Cone', x: 580, y: 370, color: '#f97316' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 75, color: '#dc2626', subLabel: 'Ball Carrier' },
          { id: 'blocker-1', type: 'square', label: 'B1', x: 225, y: 185, color: '#1e293b', subLabel: 'Left Blocker' },
          { id: 'blocker-2', type: 'square', label: 'B2', x: 350, y: 170, color: '#1e293b', subLabel: 'Middle Blocker' },
          { id: 'blocker-3', type: 'square', label: 'B3', x: 475, y: 185, color: '#1e293b', subLabel: 'Right Blocker' },
          { id: 'lb-1', type: 'X', label: 'LB', x: 350, y: 365, color: '#058538', subLabel: 'Lead-Foot Key' },
          { id: 'coach-1', type: 'O', label: 'COACH', x: 350, y: 455, color: '#7c3aed', subLabel: 'Behind LB' },
        ],
        arrows: [
          { id: 'a-flow-l', type: 'curved', startX: 335, startY: 90, endX: 145, endY: 350, controlX: 180, controlY: 180, color: '#dc2626', dashed: true, label: 'Left Flow' },
          { id: 'a-flow-m', type: 'straight', startX: 350, startY: 95, endX: 350, endY: 330, color: '#d97706', dashed: true, label: 'Middle ISO' },
          { id: 'a-flow-r', type: 'curved', startX: 365, startY: 90, endX: 555, endY: 350, controlX: 520, controlY: 180, color: '#dc2626', dashed: true, label: 'Right Flow' },
          { id: 'a-pop-strike', type: 'blitz', startX: 350, startY: 345, endX: 350, endY: 220, color: '#058538', label: 'Pop Strike (No Cloth)' },
          { id: 'a-signal', type: 'curved', startX: 365, startY: 442, endX: 470, endY: 240, controlX: 440, controlY: 370, color: '#7c3aed', dashed: true, label: 'Hand Signal' },
        ],
        zones: [
          { id: 'z-triangle', name: 'FIT TRIANGLE ZONE', cx: 350, cy: 260, rx: 160, ry: 90, color: '#2563eb', opacity: 0.12 },
        ],
      },
      {
        name: 'PHASE 2: EXPLOSIVE POP STRIKE & DIRECTIONAL PEEK',
        description: 'LB fires downhill with designated lead foot, strikes blocker’s breastplate with explosive thumbs-up punch (no cloth), and peeks through the hole.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 140, color: '#dc2626', subLabel: 'Attacking Lane' },
          { id: 'blocker-1', type: 'square', label: 'B1', x: 225, y: 185, color: '#64748b' },
          { id: 'blocker-2', type: 'square', label: 'B2', x: 350, y: 220, color: '#1e293b', subLabel: 'Popped Back' },
          { id: 'blocker-3', type: 'square', label: 'B3', x: 475, y: 185, color: '#64748b' },
          { id: 'lb-1', type: 'X', label: 'LB', x: 350, y: 280, color: '#058538', subLabel: 'Pop & Peek' },
          { id: 'coach-1', type: 'O', label: 'COACH', x: 350, y: 455, color: '#7c3aed', subLabel: 'Behind LB' },
        ],
        arrows: [
          { id: 'a-peek-eye', type: 'straight', startX: 350, startY: 280, endX: 385, endY: 200, color: '#058538', dashed: true, label: 'Directional Peek' },
          { id: 'a-pop-strike-p2', type: 'straight', startX: 350, startY: 280, endX: 350, endY: 235, color: '#16a34a', label: 'Explosive Separation' },
        ],
        zones: [
          { id: 'z-strike', name: 'SEPARATION POP ZONE', cx: 350, cy: 230, rx: 60, ry: 25, color: '#058538', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: SHED, HIP RESET & CUTBACK TACKLE',
        description: 'LB punches off blocker without latching on, sinks hips, resets feet, and drives downhill across the triangle to fit and wrap the cutback runner.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 260, y: 280, color: '#dc2626', subLabel: 'Cutback Tracked' },
          { id: 'blocker-1', type: 'square', label: 'B1', x: 225, y: 185, color: '#94a3b8' },
          { id: 'blocker-2', type: 'square', label: 'B2', x: 385, y: 230, color: '#94a3b8', subLabel: 'Disengaged' },
          { id: 'blocker-3', type: 'square', label: 'B3', x: 475, y: 185, color: '#94a3b8' },
          { id: 'lb-1', type: 'X', label: 'LB', x: 275, y: 300, color: '#058538', subLabel: 'SOLO TACKLE!' },
          { id: 'coach-1', type: 'O', label: 'COACH', x: 350, y: 455, color: '#7c3aed' },
        ],
        arrows: [
          { id: 'a-redirect-p3', type: 'blitz', startX: 350, startY: 280, endX: 275, endY: 300, color: '#058538', label: 'Hip Reset & Tackle' },
          { id: 'a-cut-p3', type: 'curved', startX: 350, startY: 140, endX: 260, endY: 280, controlX: 380, controlY: 200, color: '#dc2626', label: 'Cutback' },
        ],
        zones: [
          { id: 'z-tackle', name: 'FINISH TACKLE ZONE', cx: 270, cy: 290, rx: 55, ry: 30, color: '#058538', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'drill-db-1',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'BACKPEDAL, T-STEP & 45° DRIVE',
    subtitle: 'Low Center of Gravity & Explosive Break',
    objective: 'Defensive back maintains smooth low backpedal with chest over toes, plants back foot on wide receiver break without false steps, and drives 45 degrees downhill to break up pass.',
    setup: 'Align Wide Receiver at the numbers on LOS. Cornerback aligns 7 yards deep with inside shade leverage. QB stands 10 yards back in shotgun.',
    instructions: [
      'On snap, CB glides backward in a low, balanced backpedal with chest over toes and arms pumping.',
      'Maintain the 7-yard cushion as the receiver pushes vertically up the stem.',
      'When the receiver drops hips and cuts outside at 10 yards, plant the back foot firmly (T-Step) with zero wasted false steps.',
      'Drive downhill at a sharp 45-degree angle toward the catch point.',
      'Violently punch through the receiver’s hands with the near arm to rip the ball away.',
    ],
    equipment: 'Footballs, cones for 7-yard cushion and break line, whistle.',
    cues: [
      '"Low hips, chest over toes — glide on balls of feet!"',
      '"Plant back foot (T-Step) with ZERO false steps!"',
      '"Drive through the receiver\'s hands to rip ball out!"',
    ],
    faults: [
      'Standing straight up in backpedal.',
      'Taking an extra false step or click of the cleats before driving.',
      'Reaching with arms before driving hips.',
    ],
    phases: [
      {
        name: 'PHASE 1: 7-YARD LOW CUSHION BACKPEDAL',
        description: 'Cornerback maintains a low 7-yard cushion over the wide receiver with smooth gliding backpedal steps.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 180, y: 220, color: '#0052cc', subLabel: 'Stem' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 180, y: 330, color: '#7c3aed', subLabel: 'Smooth Pedal' },
        ],
        arrows: [
          { id: 'a-wr-stem', type: 'straight', startX: 180, startY: 220, endX: 180, endY: 270, color: '#0052cc', label: 'Vertical Stem' },
          { id: 'a-cb-pedal', type: 'drop', startX: 180, startY: 330, endX: 180, endY: 380, color: '#7c3aed', dashed: true, label: 'Low Glide' },
        ],
        zones: [
          { id: 'z-cushion', name: '7-YD CUSHION WINDOW', cx: 180, cy: 330, rx: 45, ry: 30, color: '#7c3aed', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: T-STEP PLANT ON WR CUT',
        description: 'WR breaks at 10 yards. CB plants inside cleat firmly at 90 degrees (T-step), eliminating false backward steps.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 180, y: 280, color: '#0052cc', subLabel: 'Out Break' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 180, y: 360, color: '#7c3aed', subLabel: 'T-Step Plant' },
        ],
        arrows: [
          { id: 'a-wr-cut', type: 'straight', startX: 180, startY: 280, endX: 120, endY: 270, color: '#0052cc', label: 'Quick Out' },
          { id: 'a-tstep', type: 'straight', startX: 180, startY: 360, endX: 140, endY: 310, color: '#7c3aed', dashed: true, label: 'Plant & Explode' },
        ],
        zones: [
          { id: 'z-break', name: 'BREAK POINT APEX', cx: 180, cy: 340, rx: 40, ry: 25, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: 45° DOWNHILL DRIVE & PBU',
        description: 'CB accelerates downhill at 45 degrees, punches through receiver\'s hands at the catch point, and breaks up pass.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 130, y: 270, color: '#0052cc', subLabel: 'Incomplete' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 130, y: 270, color: '#058538', subLabel: 'PASS BREAKUP!' },
        ],
        arrows: [
          { id: 'a-drive-pbu', type: 'blitz', startX: 180, startY: 360, endX: 130, endY: 270, color: '#058538', label: '45° Violent Drive' },
        ],
        zones: [
          { id: 'z-pbu', name: 'TURNOVER / PBU ZONE', cx: 130, cy: 270, rx: 45, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-db-2',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DEEP 1/3 CUSHION & ROUTE BAIL (COVER 3)',
    subtitle: 'Divider Rule, Vertical Bail & Apex Interception',
    objective: 'Cornerback in Cover 3 maintains 7-yard cushion, opens hips to sideline at 10 yards (bail), stays on top of receiver\'s vertical route stem, and high-points the football for an interception.',
    setup: 'Set Wide Receiver split out wide. Cornerback aligns 7 yards deep with inside shade leverage along the divider rule. QB drops back from under center.',
    instructions: [
      'CB pedals 3 steps, then flips hips toward the sideline (side-bail technique) as WR pushes vertically.',
      'Keep eyes divided between WR\'s hips and QB\'s front shoulder.',
      'Maintain an "over-the-top" ceiling position, never letting the receiver get stacked on top of you.',
      'When QB unleashes deep ball, track trajectory, position yourself between WR and ball, and leap at peak apex.',
      'Catch the football at the highest point with two hands and secure against chest.',
    ],
    equipment: 'Footballs, sideline cones, whistle.',
    cues: [
      '"Keep 7-yard cushion — stay on top of the numbers!"',
      '"Bail and turn hips to sideline while keeping eyes on WR and QB!"',
      '"High-point the ball at the very apex of your jump!"',
    ],
    faults: [
      'Allowing receiver to stack on top of you on go route.',
      'Looking back at QB too early and getting burned deep.',
      'Jumping too early or swatting with one hand instead of two.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP ALIGNMENT & STRIDE MATCHING',
        description: 'CB aligns 7 yards deep with inside leverage on the boundary numbers, watching WR hips and chest.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 150, y: 220, color: '#0052cc', subLabel: 'Sprint' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 160, y: 310, color: '#7c3aed', subLabel: 'Cover 3 Deep' },
        ],
        arrows: [
          { id: 'a-wr-fly', type: 'straight', startX: 150, startY: 220, endX: 150, endY: 340, color: '#0052cc', label: 'Go Route' },
          { id: 'a-cb-bail', type: 'drop', startX: 160, startY: 310, endX: 160, endY: 390, color: '#7c3aed', dashed: true, label: 'Side Bail' },
        ],
        zones: [
          { id: 'z-deep-third', name: 'DEEP 1/3 ZONE', cx: 160, cy: 400, rx: 70, ry: 40, color: '#7c3aed', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: HIP TURN & VERTICAL CEILING',
        description: 'CB flips hips toward sideline, matches speed stride-for-stride, and stays 2 steps over top to prevent deep stack.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 150, y: 360, color: '#0052cc', subLabel: 'Contested' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 160, y: 385, color: '#7c3aed', subLabel: 'Top Position' },
        ],
        arrows: [
          { id: 'a-air-ball', type: 'curved', startX: 350, startY: 150, endX: 155, endY: 420, controlX: 250, controlY: 280, color: '#d91b24', dashed: true, label: 'Deep Bomb' },
        ],
        zones: [
          { id: 'z-ceiling', name: 'OVER-TOP POSITION', cx: 160, cy: 385, rx: 45, ry: 25, color: '#058538', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: APEX HIGH-POINT INTERCEPTION',
        description: 'CB leaps before WR, snatches football at peak apex with two hands, and lands with ball securely tucked away.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 150, y: 410, color: '#64748b' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 155, y: 420, color: '#058538', subLabel: 'INTERCEPTION!' },
        ],
        arrows: [
          { id: 'a-leap', type: 'straight', startX: 160, startY: 385, endX: 155, endY: 420, color: '#058538', label: 'High Point Apex' },
        ],
        zones: [
          { id: 'z-int', name: 'INTERCEPTION APEX', cx: 155, cy: 420, rx: 50, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-db-3',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'COVER 2 HARD FLAT & SCREEN TRIGGER',
    subtitle: 'Two-Hand Jam, Flat Sink & Perimeter Force',
    objective: 'Cornerback lines up in press/catch-man, delivers two-hand jam to disrupt outside receiver, sinks into flat zone, and triggers downhill violently on swing/bubble pass to make open-field tackle.',
    setup: 'WR split wide, RB in backfield offset to that side, QB in shotgun. Cornerback aligns 1-2 yards off WR with inside leverage. Free Safety plays deep half.',
    instructions: [
      'At the snap, CB delivers a powerful two-hand jam into the WR\'s chest to disrupt the timing of the release.',
      'Release the WR inside toward the deep safety and sink 4–5 yards into the boundary flat zone.',
      'Keep eyes scanning the backfield for swing routes, bubble screens, or QB rollouts.',
      'As soon as QB releases the throw to the flat, trigger downhill violently on an outside-in angle.',
      'Attack the runner\'s outside shoulder to set the perimeter edge and make the open-field tackle for a loss.',
    ],
    equipment: 'Footballs, line markers, whistle.',
    cues: [
      '"Violent two-hand strike to WR chest at snap!"',
      '"Sink to 4-5 yards in flat with eyes on QB backfield!"',
      '"Trigger downhill immediately on ball in air — wrap up!"',
    ],
    faults: [
      'Whiffing on jam and getting beaten outside.',
      'Bailing deep instead of protecting the flat.',
      'Hesitating on the perimeter tackle and getting cut block.',
    ],
    phases: [
      {
        name: 'PHASE 1: PRESS JAM AT LINE OF SCRIMMAGE',
        description: 'CB aligns 1 yard off WR. On snap, punches with violent two-hand strike to reroute WR inside toward safety.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 150, y: 230, color: '#0052cc', subLabel: 'Press Release' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 300, y: 140, color: '#0052cc', subLabel: 'Swing Motion' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 150, y: 245, color: '#7c3aed', subLabel: 'Two-Hand Jam' },
          { id: 's-1',  type: 'X', label: 'FS', x: 200, y: 410, color: '#0284c7', subLabel: 'Deep Half' },
        ],
        arrows: [
          { id: 'a-jam', type: 'straight', startX: 150, startY: 245, endX: 150, endY: 230, color: '#7c3aed', label: 'Violent Jam' },
          { id: 'a-rb-swing', type: 'curved', startX: 300, startY: 140, endX: 120, endY: 210, controlX: 200, controlY: 150, color: '#0052cc', label: 'Swing Route' },
        ],
        zones: [
          { id: 'z-flat-zone', name: 'COVER 2 FLAT ZONE', cx: 130, cy: 260, rx: 55, ry: 30, color: '#7c3aed', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: FLAT ZONE SINK & BACKFIELD READ',
        description: 'CB disengages from WR release, sinks 4 yards into boundary flat, keys QB release on the swing pass.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24', subLabel: 'Throwing Swing' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 170, y: 290, color: '#64748b' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 120, y: 210, color: '#0052cc', subLabel: 'Catch Point' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 135, y: 260, color: '#7c3aed', subLabel: 'Flat Sink' },
          { id: 's-1',  type: 'X', label: 'FS', x: 200, y: 390, color: '#0284c7' },
        ],
        arrows: [
          { id: 'a-swing-pass', type: 'straight', startX: 350, startY: 150, endX: 125, endY: 205, color: '#d91b24', dashed: true, label: 'Swing Pass' },
          { id: 'a-trigger-cb', type: 'blitz', startX: 135, startY: 260, endX: 125, endY: 215, color: '#058538', label: 'Downhill Trigger' },
        ],
        zones: [
          { id: 'z-trigger', name: 'FORCE & CONTAIN ALLEY', cx: 125, cy: 220, rx: 40, ry: 25, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: DOWNHILL TRIGGER & OPEN-FIELD STOP',
        description: 'CB explodes downhill, attacks outside shoulder of RB to keep contain, and makes solo tackle behind LOS.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 120, y: 210, color: '#0052cc', subLabel: 'Tackled' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 120, y: 215, color: '#058538', subLabel: 'FORCE TFL!' },
          { id: 's-1',  type: 'X', label: 'FS', x: 160, y: 300, color: '#0284c7', subLabel: 'Pursuit Vice' },
        ],
        arrows: [
          { id: 'a-tfl-hit', type: 'straight', startX: 130, startY: 230, endX: 120, endY: 210, color: '#058538', label: 'Form Tackle' },
        ],
        zones: [
          { id: 'z-force-tfl', name: 'PERIMETER STUFF', cx: 120, cy: 210, rx: 45, ry: 30, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
  {
    id: 'drill-db-4',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'CENTERFIELD POST BREAK & TIP DRILL',
    subtitle: 'Deep Middle Third Range & Ball Security',
    objective: 'Free safety pedals in deep middle third, reads QB eyes and shoulder angle, breaks at full speed across hashes on deep post/seam, and snatches tipped pass for interception and return.',
    setup: 'WR lines up in slot running deep post route, QB in shotgun between hashes. Free Safety aligns 15 yards deep in middle of the field.',
    instructions: [
      'Free Safety begins in a calm, balanced deep backpedal in centerfield at 15 yards depth.',
      'Key the quarterback\'s front shoulder and eyes while keeping the post route in peripheral vision.',
      'When QB winds up and plants to throw the post, plant the back foot and drive across the hash on a flat sprint.',
      'Track the ball in flight; if tipped by the cornerback or thrown slightly off target, adjust instantly.',
      'Snatch the football with two hands out of the air, tuck it securely, yell "FIRE!" to alert teammates, and sprint up the sideline.',
    ],
    equipment: 'Footballs, cones for 15-yard centerfield landmark, whistle.',
    cues: [
      '"Read QB shoulders and front hip — break on the throw!"',
      '"Sprint across the hash — angle for the highest point!"',
      '"Snatch with two hands, tuck it, and call \'FIRE!\' for return!"',
    ],
    faults: [
      'Biting on underneath play-action routes in Cover 1/Cover 3.',
      'Taking a rounded angle to the catch point.',
      'One-hand swatting instead of intercepting.',
    ],
    phases: [
      {
        name: 'PHASE 1: CENTERFIELD HIGH PEDAL & READ',
        description: 'Free Safety pedals in deep centerfield 15 yards deep, keeping eyes locked on QB shoulders and eyes.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24', subLabel: 'Pocket Set' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 200, y: 240, color: '#0052cc', subLabel: 'Post Route' },
          { id: 'fs-1', type: 'X', label: 'FS', x: 350, y: 440, color: '#0284c7', subLabel: 'Centerfield' },
        ],
        arrows: [
          { id: 'a-post-stem', type: 'curved', startX: 200, startY: 240, endX: 290, endY: 360, controlX: 220, controlY: 300, color: '#0052cc', label: 'Post Stem' },
          { id: 'a-fs-pedal', type: 'drop', startX: 350, startY: 440, endX: 350, endY: 470, color: '#0284c7', dashed: true, label: 'Deep Read Pedal' },
        ],
        zones: [
          { id: 'z-centerfield', name: 'MIDDLE THIRD DOME', cx: 350, cy: 450, rx: 90, ry: 45, color: '#0284c7', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: EXPLOSIVE BREAK ACROSS THE HASH',
        description: 'QB loads to throw the post. FS plants back foot, drives at 90 degrees across hashes at full speed.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24', subLabel: 'Thrown' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 290, y: 360, color: '#0052cc', subLabel: 'Catch Point' },
          { id: 'fs-1', type: 'X', label: 'FS', x: 310, y: 375, color: '#0284c7', subLabel: 'Full Sprint' },
        ],
        arrows: [
          { id: 'a-pass-post', type: 'straight', startX: 350, startY: 150, endX: 290, endY: 360, color: '#d91b24', dashed: true, label: 'Deep Post Throw' },
          { id: 'a-fs-break', type: 'blitz', startX: 350, startY: 440, endX: 300, endY: 365, color: '#058538', label: 'Sprint Across Hashes' },
        ],
        zones: [
          { id: 'z-intercept-window', name: 'INTERCEPTION APEX', cx: 295, cy: 365, rx: 45, ry: 30, color: '#058538', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: TIP-DRILL SNATCH & SIDELINE RETURN',
        description: 'Pass is tipped in air. FS snatches ball out of the air with two hands, tucks it, and accelerates along sideline convoy.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 290, y: 360, color: '#64748b' },
          { id: 'fs-1', type: 'X', label: 'FS', x: 285, y: 355, color: '#058538', subLabel: 'INTERCEPTED!' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 240, y: 320, color: '#7c3aed', subLabel: 'Lead Block' },
        ],
        arrows: [
          { id: 'a-return', type: 'blitz', startX: 285, startY: 355, endX: 220, endY: 230, color: '#058538', label: '"FIRE!" Return Sprint' },
        ],
        zones: [
          { id: 'z-return', name: 'SIDELINE RETURN ALLEY', cx: 230, cy: 260, rx: 50, ry: 40, color: '#058538', opacity: 0.35 },
        ],
      },
    ],
  },
];

export const DEFENSIVE_SCHEMES: WhiteboardDrill[] = SCHEME_DRILLS;

export const TECHNIQUE_DRILLS: WhiteboardDrill[] = [
  ...DLINE_DRILLS,
  ...EXTRA_YOUTH_DRILLS,
  ...TEAM_CIRCUIT_DRILLS,
  ...DRILL_MATRIX_DRILLS,
];

export const DEFENSIVE_DRILLS: WhiteboardDrill[] = [
  ...SCHEME_DRILLS,
  ...DLINE_DRILLS,
  ...EXTRA_YOUTH_DRILLS,
  ...TEAM_CIRCUIT_DRILLS,
  ...DRILL_MATRIX_DRILLS,
];

export const isDefensiveScheme = (drill: WhiteboardDrill): boolean => {
  return (
    drill.category === 'SCHEME' ||
    drill.id.startsWith('hudl-') ||
    drill.id.startsWith('scheme-') ||
    Boolean(drill.hudlPlaybookName) ||
    Boolean(drill.formationName) ||
    (Boolean(drill.categoryLabel) && drill.categoryLabel.toLowerCase().includes('scheme'))
  );
};

export const WHITEBOARD_DRILLS: WhiteboardDrill[] = DEFENSIVE_DRILLS;

const WHITEBOARD_CUSTOM_DRILLS_KEY = 'footballCustomWhiteboardDrills';
const WHITEBOARD_DELETED_DRILLS_KEY = 'footballDeletedWhiteboardDrills';

export function getCustomWhiteboardDrills(): WhiteboardDrill[] {
  return safeJSONParse<WhiteboardDrill[]>(WHITEBOARD_CUSTOM_DRILLS_KEY, []);
}

export function saveCustomWhiteboardDrills(drills: WhiteboardDrill[]): void {
  safeJSONSet(WHITEBOARD_CUSTOM_DRILLS_KEY, drills);
}

export function getDeletedWhiteboardDrillIds(): string[] {
  return safeJSONParse<string[]>(WHITEBOARD_DELETED_DRILLS_KEY, []);
}

export function saveDeletedWhiteboardDrillIds(ids: string[]): void {
  safeJSONSet(WHITEBOARD_DELETED_DRILLS_KEY, ids);
}

export const WHITEBOARD_DISABLED_DRILLS_KEY = 'mahopac_disabled_whiteboard_drill_ids_v1';

export function getDisabledWhiteboardDrillIds(): string[] {
  return safeJSONParse<string[]>(WHITEBOARD_DISABLED_DRILLS_KEY, []);
}

export function saveDisabledWhiteboardDrillIds(ids: string[]): void {
  safeJSONSet(WHITEBOARD_DISABLED_DRILLS_KEY, ids);
}

export function isDrillWhiteboardEnabled(drillId: string): boolean {
  const disabled = new Set(getDisabledWhiteboardDrillIds());
  return !disabled.has(drillId);
}

export function setDrillWhiteboardEnabled(drillId: string, enabled: boolean): void {
  const current = new Set(getDisabledWhiteboardDrillIds());
  if (enabled) {
    current.delete(drillId);
  } else {
    current.add(drillId);
  }
  saveDisabledWhiteboardDrillIds(Array.from(current));
}

export function toggleDrillWhiteboard(drillId: string): boolean {
  const current = new Set(getDisabledWhiteboardDrillIds());
  const willBeEnabled = current.has(drillId);
  if (willBeEnabled) {
    current.delete(drillId);
  } else {
    current.add(drillId);
  }
  saveDisabledWhiteboardDrillIds(Array.from(current));
  return willBeEnabled;
}

export function loadEffectiveWhiteboardDrills(): WhiteboardDrill[] {
  const custom = getCustomWhiteboardDrills();
  const deletedIds = new Set(getDeletedWhiteboardDrillIds());

  // Custom drills map
  const customMap = new Map<string, WhiteboardDrill>();
  custom.forEach((d) => customMap.set(d.id, d));

  const list: WhiteboardDrill[] = [];
  DEFENSIVE_DRILLS.forEach((d) => {
    if (deletedIds.has(d.id)) return;
    if (customMap.has(d.id)) {
      list.push(customMap.get(d.id)!);
      customMap.delete(d.id);
    } else {
      list.push(d);
    }
  });

  // Append new custom drills not in base list
  customMap.forEach((d) => {
    if (!deletedIds.has(d.id)) {
      list.push(d);
    }
  });

  return list;
}

export const PRESET_SCHEMES = [
  {
    id: 'cover-3-sky',
    name: 'Cover 3 Sky (4-3 Front)',
    tokens: [
      { id: 'o-c', type: 'O' as const, label: 'C', x: 350, y: 240, color: '#1a1a24' },
      { id: 'o-lg', type: 'O' as const, label: 'LG', x: 300, y: 240, color: '#1a1a24' },
      { id: 'o-rg', type: 'O' as const, label: 'RG', x: 400, y: 240, color: '#1a1a24' },
      { id: 'o-lt', type: 'O' as const, label: 'LT', x: 250, y: 240, color: '#1a1a24' },
      { id: 'o-rt', type: 'O' as const, label: 'RT', x: 450, y: 240, color: '#1a1a24' },
      { id: 'o-qb', type: 'O' as const, label: 'QB', x: 350, y: 180, color: '#d91b24' },
      { id: 'o-rb', type: 'O' as const, label: 'RB', x: 350, y: 120, color: '#0052cc' },
      { id: 'x-lde', type: 'X' as const, label: 'DE', x: 210, y: 270, color: '#0052cc' },
      { id: 'x-ldt', type: 'X' as const, label: 'DT', x: 280, y: 260, color: '#0052cc' },
      { id: 'x-rdt', type: 'X' as const, label: 'NT', x: 370, y: 260, color: '#0052cc' },
      { id: 'x-rde', type: 'X' as const, label: 'DE', x: 490, y: 270, color: '#0052cc' },
      { id: 'x-wlb', type: 'X' as const, label: 'WLB', x: 260, y: 320, color: '#058538' },
      { id: 'x-mlb', type: 'X' as const, label: 'MLB', x: 350, y: 330, color: '#058538' },
      { id: 'x-slb', type: 'X' as const, label: 'SLB', x: 440, y: 320, color: '#058538' },
      { id: 'x-lcb', type: 'X' as const, label: 'CB', x: 120, y: 350, color: '#7c3aed' },
      { id: 'x-rcb', type: 'X' as const, label: 'CB', x: 580, y: 350, color: '#7c3aed' },
      { id: 'x-ss', type: 'X' as const, label: 'SS', x: 460, y: 360, color: '#d91b24' },
      { id: 'x-fs', type: 'X' as const, label: 'FS', x: 350, y: 440, color: '#0284c7' },
    ],
    arrows: [
      { id: 'a-ss-curl', type: 'drop' as const, startX: 460, startY: 360, endX: 470, endY: 320, color: '#d91b24', dashed: true, label: 'Flat / Curl Sky' },
      { id: 'a-fs-deep', type: 'drop' as const, startX: 350, startY: 440, endX: 350, endY: 460, color: '#0284c7', dashed: true, label: 'Deep Middle 1/3' },
    ],
    zones: [
      { id: 'z-deep-l', name: 'DEEP 1/3 (LEFT)', cx: 140, cy: 430, rx: 75, ry: 40, color: '#7c3aed', opacity: 0.2 },
      { id: 'z-deep-m', name: 'DEEP 1/3 (MIDDLE)', cx: 350, cy: 450, rx: 90, ry: 40, color: '#0284c7', opacity: 0.2 },
      { id: 'z-deep-r', name: 'DEEP 1/3 (RIGHT)', cx: 560, cy: 430, rx: 75, ry: 40, color: '#7c3aed', opacity: 0.2 },
      { id: 'z-curl-l', name: 'HOOK/CURL', cx: 270, cy: 330, rx: 55, ry: 25, color: '#058538', opacity: 0.2 },
      { id: 'z-curl-r', name: 'HOOK/CURL', cx: 430, cy: 330, rx: 55, ry: 25, color: '#058538', opacity: 0.2 },
      { id: 'z-flat-r', name: 'FLAT (SS)', cx: 540, cy: 320, rx: 50, ry: 25, color: '#d91b24', opacity: 0.2 },
    ],
  },
  {
    id: 'cover-2-tampa',
    name: 'Cover 2 Invert / Tampa (4-4 Front)',
    tokens: [
      { id: 'o-c', type: 'O' as const, label: 'C', x: 350, y: 240, color: '#1a1a24' },
      { id: 'o-lg', type: 'O' as const, label: 'LG', x: 300, y: 240, color: '#1a1a24' },
      { id: 'o-rg', type: 'O' as const, label: 'RG', x: 400, y: 240, color: '#1a1a24' },
      { id: 'o-lt', type: 'O' as const, label: 'LT', x: 250, y: 240, color: '#1a1a24' },
      { id: 'o-rt', type: 'O' as const, label: 'RT', x: 450, y: 240, color: '#1a1a24' },
      { id: 'o-qb', type: 'O' as const, label: 'QB', x: 350, y: 180, color: '#d91b24' },
      { id: 'x-de1', type: 'X' as const, label: 'DE', x: 210, y: 265, color: '#0052cc' },
      { id: 'x-dt1', type: 'X' as const, label: 'DT', x: 290, y: 260, color: '#0052cc' },
      { id: 'x-dt2', type: 'X' as const, label: 'DT', x: 410, y: 260, color: '#0052cc' },
      { id: 'x-de2', type: 'X' as const, label: 'DE', x: 490, y: 265, color: '#0052cc' },
      { id: 'x-olb1', type: 'X' as const, label: 'OLB', x: 170, y: 310, color: '#058538' },
      { id: 'x-ilb1', type: 'X' as const, label: 'ILB', x: 300, y: 325, color: '#058538' },
      { id: 'x-ilb2', type: 'X' as const, label: 'ILB', x: 400, y: 325, color: '#058538' },
      { id: 'x-olb2', type: 'X' as const, label: 'OLB', x: 530, y: 310, color: '#058538' },
      { id: 'x-fs', type: 'X' as const, label: 'FS', x: 240, y: 440, color: '#0284c7' },
      { id: 'x-ss', type: 'X' as const, label: 'SS', x: 460, y: 440, color: '#0284c7' },
    ],
    arrows: [
      { id: 'a-blitz-olb', type: 'blitz' as const, startX: 170, startY: 310, endX: 230, endY: 210, color: '#d91b24', label: 'Edge Fire Blitz' },
    ],
    zones: [
      { id: 'z-deep-half-l', name: 'DEEP 1/2 (FS)', cx: 230, cy: 440, rx: 110, ry: 45, color: '#0284c7', opacity: 0.2 },
      { id: 'z-deep-half-r', name: 'DEEP 1/2 (SS)', cx: 470, cy: 440, rx: 110, ry: 45, color: '#0284c7', opacity: 0.2 },
      { id: 'z-flat-l', name: 'FLAT (HARD)', cx: 130, cy: 300, rx: 60, ry: 30, color: '#058538', opacity: 0.2 },
      { id: 'z-flat-r', name: 'FLAT (HARD)', cx: 570, cy: 300, rx: 60, ry: 30, color: '#058538', opacity: 0.2 },
      { id: 'z-hook-curl', name: 'TAMPA HOLE / SEAM', cx: 350, cy: 360, rx: 70, ry: 35, color: '#e06c00', opacity: 0.2 },
    ],
  },
  {
    id: 'bear-a-gap-blitz',
    name: '5-3 Bear Double A-Gap Blitz',
    tokens: [
      { id: 'o-c', type: 'O' as const, label: 'C', x: 350, y: 240, color: '#1a1a24' },
      { id: 'o-lg', type: 'O' as const, label: 'LG', x: 300, y: 240, color: '#1a1a24' },
      { id: 'o-rg', type: 'O' as const, label: 'RG', x: 400, y: 240, color: '#1a1a24' },
      { id: 'o-lt', type: 'O' as const, label: 'LT', x: 250, y: 240, color: '#1a1a24' },
      { id: 'o-rt', type: 'O' as const, label: 'RT', x: 450, y: 240, color: '#1a1a24' },
      { id: 'o-qb', type: 'O' as const, label: 'QB', x: 350, y: 170, color: '#d91b24' },
      { id: 'x-nt', type: 'X' as const, label: 'NT', x: 350, y: 260, color: '#0052cc', subLabel: '0-Tech' },
      { id: 'x-dt1', type: 'X' as const, label: 'DT', x: 300, y: 260, color: '#0052cc', subLabel: '3-Tech' },
      { id: 'x-dt2', type: 'X' as const, label: 'DT', x: 400, y: 260, color: '#0052cc', subLabel: '3-Tech' },
      { id: 'x-de1', type: 'X' as const, label: 'DE', x: 210, y: 270, color: '#0052cc' },
      { id: 'x-de2', type: 'X' as const, label: 'DE', x: 490, y: 270, color: '#0052cc' },
      { id: 'x-mlb1', type: 'X' as const, label: 'MLB', x: 325, y: 310, color: '#d91b24', subLabel: 'A-Gap Blitz' },
      { id: 'x-mlb2', type: 'X' as const, label: 'MLB', x: 375, y: 310, color: '#d91b24', subLabel: 'A-Gap Blitz' },
      { id: 'x-fs', type: 'X' as const, label: 'FS', x: 350, y: 440, color: '#0284c7' },
    ],
    arrows: [
      { id: 'a-a1', type: 'blitz' as const, startX: 325, startY: 300, endX: 335, endY: 200, color: '#d91b24', label: 'A-Gap Fire' },
      { id: 'a-a2', type: 'blitz' as const, startX: 375, startY: 300, endX: 365, endY: 200, color: '#d91b24', label: 'A-Gap Fire' },
      { id: 'a-nt-sl', type: 'curved' as const, startX: 350, startY: 260, endX: 310, endY: 240, controlX: 330, controlY: 250, color: '#0052cc', label: 'Slant' },
    ],
    zones: [
      { id: 'z-man-deep', name: 'SINGLE HIGH (COVER 1)', cx: 350, cy: 440, rx: 120, ry: 45, color: '#0284c7', opacity: 0.2 },
    ],
  },
];
