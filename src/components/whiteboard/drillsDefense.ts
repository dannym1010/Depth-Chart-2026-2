import { WhiteboardDrill } from './whiteboardDrillData';

/**
 * 43 DEFENSIVE DRILLS FROM THE PRACTICE DRILL MATRIX
 * Categorized into:
 * - Defensive Line (DL) (13 drills)
 * - Defensive Ends (DE) (5 drills)
 * - Linebackers (LB) (7 drills)
 * - Defensive Backs (DB) (6 drills)
 * - Team Defense & Stunts / Blitzes (12 drills)
 */
export const DEFENSE_MATRIX_DRILLS: WhiteboardDrill[] = [
  // ==========================================
  // DEFENSIVE LINE (DL) - 13 DRILLS
  // ==========================================
  {
    id: 'matrix-dl-stance-shock',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Stance & Shock (First-Step Strike)',
    subtitle: '6-Inch Power Step, Double Palm Punch & Pad Pop',
    objective: 'Explode out of 3-point coiled stance on visual ball get-off. Strike offensive lineman breastplate with violent double-palm punch, lock out elbows, and maintain flat back leverage.',
    setup: 'Set 2 stand-up dummies on LOS. DT/NT align in balanced 3-point stance across from bags.',
    instructions: [
      'Assume 3-point stance with weight 60/40 forward, off-hand cocked at hip.',
      'On ball movement, fire 6-inch power step replacing down hand.',
      'Shoot double palm strike into chest plate with thumbs up and elbows in.',
      'Lock out arms, control the line of scrimmage, and locate ball carrier.'
    ],
    equipment: '2 Stand-up dummies, football on stick, whistle.',
    cues: ['Eyes burned into leather', 'Thumbs up, elbows tight', 'Explode hips on contact', 'Lock out and peek'],
    faults: ['Pop-up syndrome (rising before driving forward)', 'Heels clicking on first step', 'Hands outside breastplate'],
    phases: [
      {
        name: 'PHASE 1: COILED STANCE & VISUAL GET-OFF',
        description: 'DL coiled in 3-point stance. Ball on stick moves.',
        tokens: [
          { id: 'c-stick', type: 'ball', label: 'COACH', x: 350, y: 190, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DT', x: 280, y: 290, color: '#4338ca', subLabel: '3-Pt' },
          { id: 'dl-2', type: 'X', label: 'NT', x: 420, y: 290, color: '#4338ca', subLabel: '3-Pt' },
          { id: 'bag-1', type: 'bag', label: 'LG BAG', x: 280, y: 210, color: '#d91b24' },
          { id: 'bag-2', type: 'bag', label: 'RG BAG', x: 420, y: 210, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-step1', type: 'run', startX: 280, startY: 290, endX: 280, endY: 230, color: '#4338ca', label: 'Power Step' },
          { id: 'a-step2', type: 'run', startX: 420, startY: 290, endX: 420, endY: 230, color: '#4338ca', label: 'Power Step' },
        ],
        zones: [
          { id: 'z-strike', name: 'STRIKE ZONE', cx: 350, cy: 220, rx: 170, ry: 30, color: '#4338ca', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: PALM STRIKE & ARM LOCKOUT',
        description: 'DL strikes dummy breastplates with violent extension, peeks into backfield, and prepares to shed.',
        tokens: [
          { id: 'dl-1', type: 'X', label: 'DT', x: 280, y: 220, color: '#4338ca', subLabel: 'Locked Out' },
          { id: 'dl-2', type: 'X', label: 'NT', x: 420, y: 220, color: '#4338ca', subLabel: 'Locked Out' },
          { id: 'rb-ball', type: 'O', label: 'RB', x: 350, y: 150, color: '#d91b24', subLabel: 'Ball Carrier' },
        ],
        arrows: [
          { id: 'a-shed1', type: 'tackle', startX: 280, startY: 220, endX: 330, endY: 170, color: '#10b981', label: 'Shed & Pursue' },
          { id: 'a-shed2', type: 'tackle', startX: 420, startY: 220, endX: 370, endY: 170, color: '#10b981', label: 'Shed & Pursue' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-slant-rip',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Slant & Rip (Vertical Penetration)',
    subtitle: 'Gap-Crossing Angle, Dip Shoulder & Violent Arm Rip',
    objective: 'Execute gap slant across the face of offensive lineman without losing forward momentum or getting washed downfield.',
    setup: '2 offensive linemen dummies. DT aligns head-up, calls slant direction (Liz/Left or Rip/Right).',
    instructions: [
      'Fire first step at 45-degree angle through the outside V-neck of adjacent lineman.',
      'Punch lead arm to cross-face blocker, dip near shoulder to slide beneath blocker pad level.',
      'Violent upward arm rip, turning shoulders north-south into offensive backfield.'
    ],
    equipment: '2 Blocking dummies, football, whistle.',
    cues: ['Aim for adjacent hip', 'Dip under punch', 'Violent arm rip to the sky', 'Get skinny through the seam'],
    faults: ['Running too lateral (crossing face horizontally)', 'Standing tall during slant'],
    phases: [
      {
        name: 'PHASE 1: 45° CROSS-FACE STEP',
        description: 'DT fires step diagonally through the V of the adjacent guard.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 330, y: 280, color: '#4338ca' },
          { id: 'c-1', type: 'O', label: 'C', x: 330, y: 200, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 260, y: 200, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-slant', type: 'run', startX: 330, startY: 280, endX: 285, endY: 215, color: '#4338ca', label: '45° Slant' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: SHOULDER DIP & VERTICAL RIP',
        description: 'DT rips lead arm vertical, squares hips north-south, and penetrates into backfield.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 285, y: 170, color: '#4338ca', subLabel: 'Penetration' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 260, y: 200, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-pen', type: 'run', startX: 285, startY: 200, endX: 285, endY: 150, color: '#10b981', label: 'Vertical Burst' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-nose-2gap',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Nose Guard Bull & 2-Gap Strike',
    subtitle: 'Center-Line Anchor, A-Gap Control & Disengage',
    objective: 'Nose tackle strikes center helmet-to-helmet with double punch, controls both A-gaps, mirrors RB flow, and sheds to make tackle.',
    setup: 'Center and Nose Tackle on LOS. Running back 4 yards behind center in pistol.',
    instructions: [
      'Nose attacks center numbers with heavy strike.',
      'Keep feet active and wide—do not give up ground.',
      'Diagnose RB cut (Left A or Right A). Shed center opposite ball side and wrap runner.'
    ],
    equipment: 'Hand shield or full pads, football.',
    cues: ['Control center chest', 'Feet in cement, hands active', 'Shed and squeeze gap'],
    faults: ['Getting turned sideways', 'Losing sight of runner behind center'],
    phases: [
      {
        name: 'PHASE 1: 0-TECH LOCK & MIRROR',
        description: 'NT locks out Center, keeping eyes in backfield to read RB flow.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 210, color: '#1a1a24' },
          { id: 'nt-1', type: 'X', label: 'NT', x: 350, y: 270, color: '#4338ca', subLabel: '0-Tech' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 130, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-lock', type: 'block', startX: 350, startY: 270, endX: 350, endY: 225, color: '#4338ca', label: 'Strike & Lock' },
        ],
        zones: [
          { id: 'z-a1', name: 'A-GAP L', cx: 310, cy: 220, rx: 25, ry: 20, color: '#f59e0b', opacity: 0.2 },
          { id: 'z-a2', name: 'A-GAP R', cx: 390, cy: 220, rx: 25, ry: 20, color: '#f59e0b', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: SHED TO RUNNER & WRAP',
        description: 'RB cuts to Left A. NT rips right arm free, steps across Center, and secures stop.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 365, y: 210, color: '#1a1a24' },
          { id: 'nt-1', type: 'X', label: 'NT', x: 330, y: 206, color: '#4338ca', subLabel: 'Shed & Tackle' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 315, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-shed', type: 'tackle', startX: 350, startY: 262, endX: 330, endY: 206, color: '#10b981', label: 'Shed Left A' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-shed-spill',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Defensive Tackle Shed & Spill',
    subtitle: 'Trap & Puller Spill, Wrong-Arm Leverage',
    objective: 'DT recognizes pulling guard, steps into the line of scrimmage, attacks the pulling lead blocker with inside shoulder (wrong arm), spilling the ball carrier to outside pursuit.',
    setup: 'Offensive Guard and Center. DT aligned in 3-technique. RB and pulling Guard in backfield.',
    instructions: [
      'On snap, read guard block: if Guard down-blocks or pulls, squeeze line of scrimmage.',
      'Attack puller with inside shoulder pad right at the kickout point.',
      'Spill runner to linebackers scraping over the top.'
    ],
    equipment: 'Pads, football, cones.',
    cues: ['Wrong-arm the puller', 'Spill the ball outside', 'Do not get driven back'],
    faults: ['Bouncing outside and giving up interior gap', 'Catching the block'],
    phases: [
      {
        name: 'PHASE 1: READ PULL & ATTACK WRONG-ARM',
        description: 'Guard pulls. DT squares shoulders and attacks kickout block.',
        tokens: [
          { id: 'g-pull', type: 'O', label: 'LG', x: 280, y: 210, color: '#1a1a24' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 380, y: 260, color: '#4338ca', subLabel: '3-Tech' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 300, y: 150, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-pull', type: 'run', startX: 280, startY: 210, endX: 350, endY: 220, color: '#1a1a24', label: 'Pulling Trap' },
          { id: 'a-dt-spill', type: 'tackle', startX: 380, startY: 260, endX: 345, endY: 225, color: '#4338ca', label: 'Wrong-Arm Spill' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: SPILL BOUNCE & LB CLEANUP',
        description: 'DT blows up kickout seam; ball carrier is forced to bounce wide into scraping LB.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 345, y: 220, color: '#4338ca', subLabel: 'Spilled' },
          { id: 'lb-1', type: 'X', label: 'MLB', x: 425, y: 236, color: '#058538', subLabel: 'Clean Up' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 430, y: 200, color: '#d91b24', subLabel: 'Bounced Wide' },
        ],
        arrows: [
          { id: 'a-bounce', type: 'run', startX: 300, startY: 150, endX: 430, endY: 200, color: '#d91b24', label: 'Bounce', controlX: 385, controlY: 158 },
          { id: 'a-tkl', type: 'tackle', startX: 425, startY: 236, endX: 430, endY: 200, color: '#058538', label: 'Vice Tackle' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-downblock-squeeze',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Down-Block Squeeze & Spill',
    subtitle: 'Hat in B-Gap, Squeeze the Air out of Traps',
    objective: 'When adjacent lineman down-blocks, DL immediately squeezes tight to blocker hip, taking away gap air and preventing kickout creases.',
    setup: 'Tackle and Guard. DL in 3-technique.',
    instructions: [
      'Read down block by adjacent OT.',
      'Squeeze downhill tightly behind his backside.',
      'Strike incoming lead blocker or trap guard with inside forearm.'
    ],
    equipment: 'Shields or full pads.',
    cues: ['Squeeze the down block', 'Tight to hip', 'Do not run upfield'],
    faults: ['Rushing straight upfield and leaving gaping lane', 'Allowing kickout space'],
    phases: [
      {
        name: 'PHASE 1: DOWN BLOCK DIAGNOSIS',
        description: 'Tackle blocks down on NT. 3-Tech squeezes B-gap immediately.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'LT', x: 260, y: 200, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: '3T', x: 310, y: 260, color: '#4338ca' },
        ],
        arrows: [
          { id: 'a-down', type: 'block', startX: 260, startY: 200, endX: 320, endY: 210, color: '#1a1a24', label: 'Down Block' },
          { id: 'a-sq', type: 'run', startX: 310, startY: 260, endX: 280, endY: 220, color: '#4338ca', label: 'Squeeze Gap' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-passrush-clubrip',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Pass Rush Club-Rip & Chop-Swim',
    subtitle: 'Hand Combat, Violent Hip Turn & Corner Flatten',
    objective: 'Train interior pass rush counter moves: violent club to knock offensive lineman hands down, followed by upward arm rip or downward chop swim.',
    setup: '2 OL with pass pro shields, 2 DL rushing on cadence. QB dummy 7 yards deep.',
    instructions: [
      'Take 2 vertical attack steps to force lineman to set his hands.',
      'Violent downward chop with near hand to break blocker wrist grip.',
      'Rip opposite arm upward through the armpit, dipping hips to turn the corner.'
    ],
    equipment: '2 shields, football, 2 agility bags.',
    cues: ['Attack the wrists', 'Violent club', 'Turn hips to QB', 'Flatten to quarterback'],
    faults: ['Trying to swim without first clubbing hands down', 'Running past the quarterback'],
    phases: [
      {
        name: 'PHASE 1: ATTACK & CLUB',
        description: 'DL attacks guard breastplate, then executes violent lateral club to blocker forearm.',
        tokens: [
          { id: 'g-1', type: 'O', label: 'RG', x: 350, y: 220, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DT', x: 350, y: 270, color: '#4338ca' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 130, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-club', type: 'block', startX: 350, startY: 270, endX: 370, endY: 230, color: '#4338ca', label: 'Club Hands Down' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: UPWARD RIP & SACK FLATTEN',
        description: 'DL dips under guard shoulder, rips upward, and flattens path directly to QB.',
        tokens: [
          { id: 'g-1', type: 'O', label: 'RG', x: 330, y: 220, color: '#1a1a24' },
          { id: 'dl-1', type: 'X', label: 'DT', x: 370, y: 180, color: '#4338ca', subLabel: 'Rip & Close' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 130, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-sack', type: 'tackle', startX: 370, startY: 180, endX: 350, endY: 130, color: '#10b981', label: 'Flatten to QB' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-dl-fumble-recovery',
    category: 'DL',
    categoryLabel: 'Defensive Line (DL)',
    title: 'DL: Fumble Recovery & Strip-Sack Circuit',
    subtitle: 'Club-and-Tomahawk Strip, Scoop & Score',
    objective: 'Teach DL to attack throwing arm of QB with tomahawk downward chop to create turnover, then identify rolling ball: scoop if green grass, smother if traffic.',
    setup: 'QB dummy on 7-yard drop. 2 DL rushing from left and right.',
    instructions: [
      'DL beats pass block, closes distance on QB throwing shoulder.',
      'Tomahawk club across QB wrist/ball.',
      'Call "BALL! BALL!" on ground.',
      'Smother with fetal wrap in crowd, or scoop and score in open field.'
    ],
    equipment: '3 footballs, agile bags, whistle.',
    cues: ['Tomahawk the wrist', 'Eyes on the leather', 'Wrap in traffic, scoop in open'],
    faults: ['Trying to scoop in crowded traffic resulting in loose kick', 'Ignoring the football'],
    phases: [
      {
        name: 'PHASE 1: TOMAHAWK STRIP',
        description: 'DL closes on QB and chops down on the ball hand.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 180, color: '#d91b24' },
          { id: 'dl-1', type: 'X', label: 'DE', x: 380, y: 220, color: '#4338ca' },
        ],
        arrows: [
          { id: 'a-strip', type: 'tackle', startX: 380, startY: 220, endX: 355, endY: 185, color: '#4338ca', label: 'Tomahawk Chop' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: SCOOP & SCORE SPRINT',
        description: 'Ball loose on turf. Trailing defender scoops on the run and sprints into end zone.',
        tokens: [
          { id: 'ball-1', type: 'ball', label: 'BALL', x: 340, y: 160, color: '#f59e0b' },
          { id: 'dl-2', type: 'X', label: 'DT', x: 330, y: 190, color: '#4338ca' },
        ],
        arrows: [
          { id: 'a-scoop', type: 'run', startX: 330, startY: 190, endX: 340, endY: 160, color: '#10b981', label: 'Scoop & Go' },
          { id: 'a-score', type: 'run', startX: 340, startY: 160, endX: 340, endY: 80, color: '#10b981', label: 'Sprint to Endzone' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // DEFENSIVE ENDS (DE) - 5 DRILLS
  // ==========================================
  {
    id: 'matrix-de-contain-stiffarm',
    category: 'DE',
    categoryLabel: 'Defensive Ends (DE)',
    title: 'DE: Containment Stiff-Arm Track',
    subtitle: 'Outside Arm Free, Squeeze Perimeter & Force Inside',
    objective: 'Keep outside shoulder clean on outside sweeps and jet motions. Lock out inside arm on tight end or tackle, never letting runner get outside.',
    setup: 'TE and OT on LOS. DE aligned in 7-technique (outside eye of TE). RB sweeps wide.',
    instructions: [
      'Take 2 vertical containment steps on snap.',
      'Strike TE chest with inside hand; keep outside hand completely free.',
      'Squeeze the line of scrimmage while maintaining leverage 1 full yard outside ball carrier.'
    ],
    equipment: 'Shields, football, sideline cones.',
    cues: ['Keep outside arm free', 'Never give up the sideline', 'Force the ball back to pursuit'],
    faults: ['Getting hooked inside by tight end', 'Turning back to runner'],
    phases: [
      {
        name: 'PHASE 1: 7-TECH ALIGNMENT & OUTSIDE LOCKOUT',
        description: 'DE aligns outside eye of TE, locks out inside hand to control perimeter.',
        tokens: [
          { id: 'te-1', type: 'O', label: 'TE', x: 280, y: 220, color: '#1a1a24' },
          { id: 'de-1', type: 'X', label: 'DE', x: 250, y: 270, color: '#06b6d4', subLabel: '7-Tech' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 150, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-sweep', type: 'run', startX: 350, startY: 150, endX: 200, endY: 200, color: '#d91b24', label: 'Perimeter Sweep' },
          { id: 'a-contain', type: 'run', startX: 250, startY: 270, endX: 210, endY: 220, color: '#06b6d4', label: 'Keep Outside Leverage' },
        ],
        zones: [
          { id: 'z-contain', name: 'OUTSIDE WALL', cx: 200, cy: 220, rx: 40, ry: 40, color: '#06b6d4', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-de-backside-squeeze',
    category: 'DE',
    categoryLabel: 'Defensive Ends (DE)',
    title: 'DE: Backside Squeeze & Settle',
    subtitle: 'Slow Squeeze, Bootleg & Counter Insurance',
    objective: 'When play flows away, backside DE squeezes down the line of scrimmage with square shoulders, checking bootleg and reverse before chasing from behind.',
    setup: 'Full offensive line. DE aligns on weakside edge. Offense runs zone away.',
    instructions: [
      'Read offensive tackle stepping away.',
      'Squeeze downhill 2 paces into the B/C gap.',
      'Keep eyes on QB hands—check bootleg/naked keeper.',
      'If QB hands off, trail ball carrier flat down the line.'
    ],
    equipment: 'Full offense or scout bags.',
    cues: ['Slow squeeze', 'Check bootleg first', 'Trail flat, do not loop deep'],
    faults: ['Running blindly after the running back and giving up easy bootleg TD', 'Loafing on backside'],
    phases: [
      {
        name: 'PHASE 1: READ FLOW AWAY & SQUEEZE',
        description: 'DE reads OT flow to right. DE squeezes down to prevent cutback while checking QB.',
        tokens: [
          { id: 'ot-1', type: 'O', label: 'LT', x: 260, y: 210, color: '#1a1a24' },
          { id: 'de-1', type: 'X', label: 'WDE', x: 220, y: 260, color: '#06b6d4' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 190, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-sq', type: 'run', startX: 220, startY: 260, endX: 250, endY: 230, color: '#06b6d4', label: 'Squeeze Flat' },
          { id: 'a-boot', type: 'pass', startX: 350, startY: 190, endX: 260, endY: 190, color: '#f59e0b', label: 'Watch Bootleg' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-de-hoop-bend',
    category: 'DE',
    categoryLabel: 'Defensive Ends (DE)',
    title: 'DE: Hoop Bend & Dip (Edge Rusher Flatten)',
    subtitle: 'Circular Ankle Flexion, Dip Near Shoulder & Burst',
    objective: 'Train edge pass rush bend around an agile hoop without slowing down. Dip inside shoulder, flatten corner, and accelerate into sack landmark.',
    setup: 'Place a hula hoop or circular line of cones at edge tackle depth. DE starts outside.',
    instructions: [
      'Take explosive 3-step upfield burst.',
      'At apex of hoop, dip inside shoulder beneath simulated tackle reach.',
      'Ankle flexion around circle, accelerate out of turn toward QB cone.'
    ],
    equipment: '2 hula hoops, 4 cones, football.',
    cues: ['Dip the shoulder', 'Tight around the hoop', 'Explode out of turn'],
    faults: ['Taking wide sweeping turns instead of bending sharply', 'Standing up at the turn'],
    phases: [
      {
        name: 'PHASE 1: UPFIELD BURST & HOOP APEX',
        description: 'DE accelerates 3 yards upfield to the apex of the circle.',
        tokens: [
          { id: 'de-1', type: 'X', label: 'DE', x: 220, y: 290, color: '#06b6d4' },
          { id: 'hoop-1', type: 'cone', label: '⭕ HOOP', x: 220, y: 210, color: '#f59e0b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-burst', type: 'run', startX: 220, startY: 290, endX: 200, endY: 210, color: '#06b6d4', label: 'Upfield Burst' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: ANKLE FLEXION & SACK FLATTEN',
        description: 'DE dips inside shoulder, circles hoop tightly, and finishes through QB.',
        tokens: [
          { id: 'de-1', type: 'X', label: 'DE', x: 250, y: 180, color: '#06b6d4', subLabel: 'Bending' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-bend', type: 'tackle', startX: 250, startY: 180, endX: 350, endY: 150, color: '#10b981', label: 'Flatten to QB' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-de-spill-box-fit',
    category: 'DE',
    categoryLabel: 'Defensive Ends (DE)',
    title: 'DE: Spill vs. Box Gap Fit (Wrong-Arm Puller)',
    subtitle: 'Trap & Kickout Defeat, Squeeze & Force Out',
    objective: 'Differentiate between "BOX" (keep outside leverage on sweep) and "SPILL" (attack inside of kickout puller to force ball to perimeter LB).',
    setup: 'OT and pulling Guard on offense. DE on edge. ILB aligned behind.',
    instructions: [
      'Call "SPILL": attack puller with inside shoulder, driving blocker into the backfield.',
      'Ball carrier is forced to bounce into waiting alley defender.'
    ],
    equipment: 'Shields, cones, whistle.',
    cues: ['Wrong-arm the kickout', 'Spill the ball to safety/LB', 'Blow up the collision'],
    faults: ['Getting kicked out and widening the running lane'],
    phases: [
      {
        name: 'PHASE 1: WRONG-ARM STRIKE',
        description: 'DE strikes pulling guard inside shoulder to collapse the C-gap.',
        tokens: [
          { id: 'de-1', type: 'X', label: 'DE', x: 260, y: 240, color: '#06b6d4' },
          { id: 'g-pull', type: 'O', label: 'PULL G', x: 320, y: 210, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 340, y: 160, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-strike', type: 'tackle', startX: 260, startY: 240, endX: 290, endY: 215, color: '#06b6d4', label: 'Wrong-Arm Blow' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // LINEBACKERS (LB) - 7 DRILLS
  // ==========================================
  {
    id: 'matrix-lb-freeze-step',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: ILB 6-Inch Freeze Step',
    subtitle: 'Diagnose Run/Pass, Prevent False Steps & Read Flow',
    objective: 'ILBs take rapid 6-inch forward control step (freeze step) on snap with nose over toes, reading guard triangle before committing downhill.',
    setup: 'Center, Guards, and QB on offense. 2 ILBs aligned 4 yards off the ball in 2-point balanced linebacker stances.',
    instructions: [
      'Assume 2-point stance with knees bent, chest proud, weight on balls of feet.',
      'On snap, take 6-inch forward freeze step—never stepping backward.',
      'Read guard hat: Low hat = run downhill; High hat = open hips to pass drop.'
    ],
    equipment: 'Footballs, 4 cones.',
    cues: ['6 inches forward, never back', 'Read guard hats', 'Nose over toes', 'Diagnose before you sprint'],
    faults: ['False stepping backward before moving forward', 'Biting on play-action pump'],
    phases: [
      {
        name: 'PHASE 1: BALANCED STANCE & 6-INCH FREEZE',
        description: 'Snap of ball. ILBs plant 6-inch freeze step and diagnose guard hats.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 200, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 280, y: 200, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 420, y: 200, color: '#1a1a24' },
          { id: 'ilb-1', type: 'X', label: 'MIKE', x: 310, y: 280, color: '#10b981', subLabel: 'ILB' },
          { id: 'ilb-2', type: 'X', label: 'WILL', x: 390, y: 280, color: '#10b981', subLabel: 'ILB' },
        ],
        arrows: [
          { id: 'a-freeze1', type: 'run', startX: 310, startY: 280, endX: 310, endY: 265, color: '#10b981', label: '6" Freeze' },
          { id: 'a-freeze2', type: 'run', startX: 390, startY: 280, endX: 390, endY: 265, color: '#10b981', label: '6" Freeze' },
        ],
        zones: [
          { id: 'z-read', name: 'READ TRIANGLE', cx: 350, cy: 200, rx: 90, ry: 20, color: '#10b981', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-lb-mirror-scrape',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: ILB Mirror & Scrape (Inside-Out Flow)',
    subtitle: 'Lateral Shuffle, Square Shoulders & Cutback Vice',
    objective: 'RB flows laterally. LB shuffles with short choppy strides keeping shoulders square to field. Stay exactly 1 step behind runner inside hip, exploding downhill when runner cuts vertical.',
    setup: '2 cones 10 yards apart. Coach points ball left/right. LB mirrors across.',
    instructions: [
      'Shuffle laterally without clicking cleats together or crossing feet.',
      'Maintain inside leverage on ball carrier.',
      'When ball carrier plants foot to cut vertical, explode downhill with near shoulder tackle.'
    ],
    equipment: '4 cones, football.',
    cues: ['Never cross your feet', 'Stay on inside hip', 'Square to the line of scrimmage'],
    faults: ['Over-pursuing and losing inside cutback lane', 'Crossing cleats'],
    phases: [
      {
        name: 'PHASE 1: LATERAL SHUFFLE & MIRROR',
        description: 'RB sweeps right. LB shuffles with square shoulders mirroring runner hip.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 190, color: '#d91b24' },
          { id: 'lb-1', type: 'X', label: 'MIKE', x: 320, y: 260, color: '#10b981' },
        ],
        arrows: [
          { id: 'a-rb', type: 'run', startX: 350, startY: 190, endX: 430, endY: 190, color: '#d91b24', label: 'Flow Right' },
          { id: 'a-lb', type: 'run', startX: 320, startY: 260, endX: 400, endY: 260, color: '#10b981', label: 'Mirror Shuffle' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: VERTICAL CUT & DOWNHILL STRIKE',
        description: 'RB cuts vertical. LB plants outside foot and drives downhill for form tackle.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 430, y: 220, color: '#d91b24' },
          { id: 'lb-1', type: 'X', label: 'MIKE', x: 400, y: 262, color: '#10b981', subLabel: 'Form Fit' },
        ],
        arrows: [
          { id: 'a-hit', type: 'tackle', startX: 400, startY: 262, endX: 428, endY: 224, color: '#10b981', label: 'Strike Downhill' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-lb-shock-shed-fill',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: Shock, Shed & Fill',
    subtitle: 'Lead Blocker Attack, Upward Punch & Rip',
    objective: 'Meet fullback or pulling guard in the hole on defender side of the line of scrimmage. Deliver two-hand strike to chest, shed using violent rip, and tackle RB.',
    setup: 'Chute or 2 agility bags creating an alley. Fullback and LB 4 yards apart.',
    instructions: [
      'Take 2 downhill attack steps into the alley.',
      'Punch fullback breastplate with upward hip explosion.',
      'Shed blocker to the inside, wrap runner with outside arm.'
    ],
    equipment: '2 agile bags, shields, football.',
    cues: ['Attack on your side of the line', 'Deliver the blow, do not catch it', 'Violent arm rip'],
    faults: ['Catching the blocker and giving up 2 yards of push', 'Dropping head into contact'],
    phases: [
      {
        name: 'PHASE 1: ATTACK LEAD BLOCKER IN HOLE',
        description: 'LB charges downhill and shocks lead blocker with double uppercut.',
        tokens: [
          { id: 'fb-1', type: 'O', label: 'FB', x: 350, y: 210, color: '#1a1a24', subLabel: 'Lead Block' },
          { id: 'lb-1', type: 'X', label: 'ILB', x: 350, y: 270, color: '#10b981' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 160, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-shock', type: 'tackle', startX: 350, startY: 270, endX: 350, endY: 225, color: '#10b981', label: 'Shock Blocker' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: SHED & TACKLE BALL CARRIER',
        description: 'LB rips arm free, side-steps blocker, and executes textbook form tackle on RB.',
        tokens: [
          { id: 'fb-1', type: 'O', label: 'FB', x: 375, y: 210, color: '#1a1a24' },
          { id: 'lb-1', type: 'X', label: 'ILB', x: 345, y: 206, color: '#10b981', subLabel: 'Shed & Wrap' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 340, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-shed', type: 'tackle', startX: 350, startY: 262, endX: 345, endY: 206, color: '#10b981', label: 'Shed to Runner' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-lb-olb-leverage',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: OLB Leverage Step & Key Read (Sweep vs Kickout)',
    subtitle: 'Perimeter Containment, Near-Hip Angle & Force',
    objective: 'OLB reads near back and end man on line of scrimmage (EMOL). If Sweep: sprint to high-outside contain. If Kickout: step downhill, squeeze edge, strike kicker.',
    setup: 'OLB aligned 3 yards outside DE and 4 yards off LOS.',
    instructions: [
      'Take explosive leverage step forward-lateral with inside foot.',
      'Read near back: Sweep = high contain; Kickout = strike and squeeze.',
      'Never allow ball carrier to break outside your containing arm.'
    ],
    equipment: 'Shields, football, sideline cones.',
    cues: ['Keep outside shoulder clean', 'High contain on sweep', 'Strike kicker on trap'],
    faults: ['Turning back to sideline', 'Getting pinned inside'],
    phases: [
      {
        name: 'PHASE 1: LEVERAGE STEP & READ',
        description: 'OLB takes 45° step reading backfield action.',
        tokens: [
          { id: 'olb-1', type: 'X', label: 'OLB', x: 230, y: 260, color: '#10b981' },
          { id: 'te-1', type: 'O', label: 'TE', x: 280, y: 210, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 160, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-step', type: 'run', startX: 230, startY: 260, endX: 210, endY: 240, color: '#10b981', label: 'Leverage Step' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-lb-45-drop-break',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: 45-Degree Drop & Break Drill',
    subtitle: 'Open Hips, Zone Landmark Depth & Plant-and-Drive',
    objective: 'On high hat (pass read), LB opens hips at 45 degrees to zone depth (8-10 yards ILB, 10-12 yards OLB). On coach ball slap, plant back cleat and drive on route.',
    setup: 'Coach with football at QB position. 3 LBs on LOS.',
    instructions: [
      'Read QB high hat. Open hips 45 degrees—never backpedal.',
      'Crossover run to zone landmark with eyes on QB eyes.',
      'When QB hand comes off ball to throw, plant outside foot and drive 100% on target.'
    ],
    equipment: 'Footballs, 4 cones.',
    cues: ['Open hips 45 degrees', 'Eyes on QB eyes', 'Plant and drive on ball slap'],
    faults: ['Backpedaling on heels', 'Looking at receiver instead of QB'],
    phases: [
      {
        name: 'PHASE 1: 45° CROSSOVER ZONE DROP',
        description: 'LBs open hips and sprint to 10-yard hook/curl zone landmarks.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 190, color: '#d91b24' },
          { id: 'lb-1', type: 'X', label: 'MLB', x: 350, y: 290, color: '#10b981' },
          { id: 'cone-1', type: 'cone', label: '10y', x: 350, y: 350, color: '#f59e0b' },
        ],
        arrows: [
          { id: 'a-drop', type: 'run', startX: 350, startY: 290, endX: 350, endY: 350, color: '#10b981', label: '45° Drop' },
        ],
        zones: [
          { id: 'z-hook', name: 'HOOK ZONE', cx: 350, cy: 350, rx: 50, ry: 25, color: '#10b981', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: PLANT & BREAK ON THROW',
        description: 'QB loads to throw. LB plants back foot and drives downhill for interception.',
        tokens: [
          { id: 'lb-1', type: 'X', label: 'MLB', x: 350, y: 350, color: '#10b981', subLabel: 'Break' },
          { id: 'target-1', type: 'target', label: '🎯', x: 280, y: 260, color: '#10b981' },
        ],
        arrows: [
          { id: 'a-drive', type: 'tackle', startX: 350, startY: 350, endX: 280, endY: 260, color: '#10b981', label: 'Plant & Drive' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-lb-robot-crosser',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: Pass-Off & Robot Crosser Drill',
    subtitle: 'Underneath Crosser Pass-Off & Communication',
    objective: 'OLB reroutes crossing receiver, shouts "IN! IN!", and hands off to ILB. ILB carries across the formation and calls "OUT! OUT!" to opposite OLB.',
    setup: '3 LBs in Cover 3 underneath shells. WR runs shallow crosser.',
    instructions: [
      'OLB delivers physical two-hand reroute, calls "IN!".',
      'ILB matches crosser speed, undercuts route, and calls "OUT!".',
      'Never allow crossing receiver to run untouched across your zone.'
    ],
    equipment: 'Footballs, shields.',
    cues: ['Physical reroute', 'Call "IN!" and "OUT!" loudly', 'Undercut the route'],
    faults: ['Silent defense (no verbal communication)', 'Chasing crosser outside your zone'],
    phases: [
      {
        name: 'PHASE 1: REROUTE & "IN!" CALL',
        description: 'OLB jams crossing WR and calls "IN! IN!" to ILB.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 200, y: 230, color: '#2563eb' },
          { id: 'olb-1', type: 'X', label: 'ROLB', x: 240, y: 270, color: '#10b981' },
          { id: 'ilb-1', type: 'X', label: 'MLB', x: 350, y: 290, color: '#10b981' },
        ],
        arrows: [
          { id: 'a-route', type: 'run', startX: 200, startY: 230, endX: 420, endY: 270, color: '#2563eb', label: 'Shallow Cross' },
          { id: 'a-jam', type: 'block', startX: 240, startY: 270, endX: 240, endY: 240, color: '#10b981', label: 'Reroute & Call "IN!"' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-lb-scrape-spill-alley-tackle',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: Read-Step, Scrape & Spill to Alley Tackle',
    subtitle: 'Key Diagnose, Lateral Scrape Over Trash, Block Spill & Wrap Tackle',
    objective: 'Linebacker executes rapid 6-inch downhill read step on snap flow, scrapes laterally across agile bag trash with square shoulders, delivers violent inside flipper strike to spill oncoming lead blocker, and buzzes feet into the alley to finish with chest-to-chest form tackle.',
    setup: 'Place 3 step-over agile bags on ground simulating line-of-scrimmage trash. LB aligns 4 yards off ball in balanced 2-point stance. Offense sets QB, offset RB, and lead blocker (Fullback/H-Back) with hit shield. 4 boundary cones define the tackle alley.',
    instructions: [
      'Assume balanced 2-point stance: shoulder-width base, knees bent inside ankles, flat back, eyes focused on guard triangle.',
      'On snap/flow, take a 6-inch downhill read step, diagnosing guard/lead blocker track without false stepping.',
      'Scrape laterally across the step-over bags with quick choppy feet, keeping pad level low and shoulders parallel to LOS.',
      'Meet the oncoming lead blocker at the edge with violent inside-shoulder flipper contact to spill runner wide toward the sideline.',
      'Disengage with upward punch, buzz feet into the tackle alley, and finish with chest-to-chest wrap tackle running feet through contact.'
    ],
    equipment: '3 Agile step-over bags, 1 hit shield, 1 football, 4 boundary cones.',
    cues: [
      '6-inch read step downhill (never step back)',
      'High knees over bags, square shoulders',
      'Inside flipper strike to spill outside',
      'Buzz feet into alley, sink hips',
      'Eyes to the chest, wrap and squeeze'
    ],
    faults: [
      'False-stepping backward on snap before diagnosing',
      'Crossing feet or hopping while scraping across bags',
      'Accepting contact from lead blocker instead of attacking first',
      'Lunging with arms at runner feet instead of driving hips'
    ],
    diagramKeys: [
      { text: 'Agility Bags: Interior Line Trash', isHighlight: false },
      { text: 'Lead Blocker: Spill Target (Inside Flipper)', isHighlight: true },
      { text: 'Tackle Alley: Form Fit & Finish', isHighlight: true }
    ],
    videoUrl: 'https://www.facebook.com/reel/1072116722201615',
    phases: [
      {
        name: 'PHASE 1: SNAP READ & 6-INCH KEY DIAGNOSE',
        description: 'Snap of the ball. Linebacker fires 6-inch downhill read step, reading the guard triangle and lead blocker path.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 190, color: '#1a1a24' },
          { id: 'bag-1', type: 'bag', label: 'BAG 1', x: 280, y: 240, color: '#64748b' },
          { id: 'bag-2', type: 'bag', label: 'BAG 2', x: 340, y: 240, color: '#64748b' },
          { id: 'bag-3', type: 'bag', label: 'BAG 3', x: 400, y: 240, color: '#64748b' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
          { id: 'fb-1', type: 'O', label: 'FB/LEAD', x: 310, y: 170, color: '#d91b24', subLabel: 'Lead Blocker' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 360, y: 120, color: '#d91b24', subLabel: 'Runner' },
          { id: 'lb-1', type: 'X', label: 'MIKE', x: 350, y: 315, color: '#10b981', subLabel: 'Read Step' },
        ],
        arrows: [
          { id: 'a-read', type: 'run', startX: 350, startY: 315, endX: 350, endY: 290, color: '#10b981', label: '6" Read Step' },
          { id: 'a-lead-flow', type: 'run', startX: 310, startY: 170, endX: 240, endY: 235, color: '#d91b24', label: 'Lead Flow' },
          { id: 'a-rb-flow', type: 'run', startX: 360, startY: 120, endX: 250, endY: 180, color: '#d91b24', label: 'Mesh Track' },
        ],
        zones: [
          { id: 'z-read-key', name: 'READ TRIANGLE / KEY', cx: 330, cy: 180, rx: 70, ry: 25, color: '#10b981', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: LATERAL SCRAPE OVER TRASH & SPILL STRIKE',
        description: 'LB high-knees laterally over bags, meets lead blocker at C-gap, delivers inside flipper strike to spill runner wide.',
        tokens: [
          { id: 'bag-1', type: 'bag', label: 'BAG 1', x: 280, y: 240, color: '#64748b' },
          { id: 'bag-2', type: 'bag', label: 'BAG 2', x: 340, y: 240, color: '#64748b' },
          { id: 'bag-3', type: 'bag', label: 'BAG 3', x: 400, y: 240, color: '#64748b' },
          { id: 'fb-block', type: 'O', label: 'LEAD', x: 240, y: 240, color: '#d91b24', subLabel: 'Contact' },
          { id: 'lb-spill', type: 'X', label: 'MIKE', x: 240, y: 270, color: '#10b981', subLabel: 'Inside Flipper' },
          { id: 'rb-bounce', type: 'O', label: 'RB', x: 200, y: 200, color: '#d91b24', subLabel: 'Bounced' },
        ],
        arrows: [
          { id: 'a-scrape', type: 'run', startX: 350, startY: 290, endX: 250, endY: 275, color: '#10b981', label: 'Scrape Over Trash' },
          { id: 'a-spill-hit', type: 'block', startX: 240, startY: 270, endX: 240, endY: 245, color: '#10b981', label: 'Inside Flipper Spill' },
          { id: 'a-rb-spilled', type: 'run', startX: 200, startY: 200, endX: 166, endY: 228, color: '#d91b24', label: 'Forced Wide Outside' },
        ],
        zones: [
          { id: 'z-spill', name: 'SPILL ZONE (FORCE WIDE)', cx: 240, cy: 255, rx: 50, ry: 30, color: '#f59e0b', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 3: ALLEY TRIGGER, DECELERATION & FINISH WRAP TACKLE',
        description: 'LB disengages from spilled block, triggers downhill into the perimeter alley, buzzes feet, and finishes chest-to-chest form tackle.',
        tokens: [
          { id: 'cone-1', type: 'cone', label: 'ALLEY', x: 140, y: 200, color: '#ea580c' },
          { id: 'cone-2', type: 'cone', label: 'ALLEY', x: 140, y: 280, color: '#ea580c' },
          { id: 'rb-tackled', type: 'O', label: 'RB', x: 170, y: 235, color: '#d91b24', subLabel: 'Wrapped' },
          { id: 'lb-tackle', type: 'X', label: 'MIKE', x: 192, y: 260, color: '#10b981', subLabel: 'Form Fit' },
        ],
        arrows: [
          { id: 'a-disengage', type: 'run', startX: 240, startY: 260, endX: 192, endY: 260, color: '#10b981', label: 'Disengage & Trigger' },
          { id: 'a-finish-tackle', type: 'tackle', startX: 192, startY: 260, endX: 172, endY: 238, color: '#10b981', label: 'Wrap & Drive Feet' },
        ],
        zones: [
          { id: 'z-alley-finish', name: 'TACKLE ALLEY (FINISH RUNNER)', cx: 165, cy: 240, rx: 55, ry: 45, color: '#10b981', opacity: 0.2 },
        ],
      },
    ],
  },

  // ==========================================
  // DEFENSIVE BACKS (DB) - 6 DRILLS
  // ==========================================
  {
    id: 'matrix-db-alley-trigger',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Fast Alley Trigger & Breakdown',
    subtitle: 'Free Safety Run Fit, Inside-Out Angle & Near Hip',
    objective: 'Free safety reads run flow from 12 yards deep, takes 2 downhill read steps, angles inside-out through the alley, and executes breakdown vice tackle at 3 yards.',
    setup: 'FS aligned 12 yards deep in centerfield. RB runs off-tackle alley.',
    instructions: [
      'Take 2 downhill read steps on snap.',
      'Track ball carrier on inside-out pursuit angle.',
      'Chop feet and sink hips at 3 yards; clamp near hip without over-running.'
    ],
    equipment: '4 cones, football.',
    cues: ['Never cross near hip', 'Take an inside-out angle', 'Chop feet and strike'],
    faults: ['Over-pursuing and allowing runner to cut back inside', 'Diving at ankles'],
    phases: [
      {
        name: 'PHASE 1: FS DOWNHILL READ & ANGLE',
        description: 'FS reads off-tackle flow and takes inside-out pursuit path.',
        tokens: [
          { id: 'fs-1', type: 'X', label: 'FS', x: 350, y: 360, color: '#8b5cf6', subLabel: '12y Deep' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 260, y: 220, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-fs-angle', type: 'run', startX: 350, startY: 360, endX: 280, endY: 240, color: '#8b5cf6', label: 'Inside-Out Trigger' },
        ],
        zones: [
          { id: 'z-alley', name: 'ALLEY', cx: 280, cy: 230, rx: 35, ry: 25, color: '#8b5cf6', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-db-post-break-intercept',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Centerfield Post Break & Intercept',
    subtitle: 'Deep Middle Third, Crossover Drive & High-Point Catch',
    objective: 'Free Safety pedaling deep middle reads QB shoulder turn, plants outside cleat, drives 90 degrees across hashes, beats WR to catch point, and high-points football for INT.',
    setup: 'FS aligned 12 yards deep in center field. WR runs deep post. Coach throws.',
    instructions: [
      'Pedal in deep 1/3 with chest over toes and eyes on QB.',
      'When QB front shoulder turns, plant outside foot.',
      'Drive across hashes at 90-degree angle, high-point ball with two hands at apex.'
    ],
    equipment: '5 footballs, 4 cones.',
    cues: ['Break on shoulder turn', 'High-point the football', 'Two hands, high and tight'],
    faults: ['Drifting too deep', 'Waiting for ball to arrive instead of attacking catch point'],
    phases: [
      {
        name: 'PHASE 1: CENTERFIELD PEDAL & BREAK',
        description: 'FS pedaling deep middle drives across hashes on throw.',
        tokens: [
          { id: 'fs-1', type: 'X', label: 'FS', x: 350, y: 340, color: '#8b5cf6' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 220, y: 260, color: '#2563eb' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-post', type: 'run', startX: 220, startY: 260, endX: 300, endY: 320, color: '#2563eb', label: 'Deep Post' },
          { id: 'a-break', type: 'tackle', startX: 350, startY: 340, endX: 300, endY: 320, color: '#10b981', label: 'High-Point INT' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-db-backpedal-drive',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Backpedal & Break (45-Degree Drive)',
    subtitle: 'T-Step Plant, Low Center of Gravity & Route Drive',
    objective: 'DB maintains low pedal for 10 yards with nose over toes. On coach signal, plant back cleat with T-step, drive forward at 45-degree angle without false steps, and secure catch.',
    setup: 'Line of 3 DBs spaced 5 yards apart. Cones at 5 and 10 yards.',
    instructions: [
      'Smooth backpedal with knees bent and weight forward.',
      'Plant back foot perpendicular (T-step) to drive forward.',
      'Drive arms violently, accelerate through catch landmark.'
    ],
    equipment: 'Footballs, 6 cones.',
    cues: ['Nose over toes', 'T-step plant', 'Drive downhill on 45° angle'],
    faults: ['Standing straight up in pedal', 'False stepping backward before coming forward'],
    phases: [
      {
        name: 'PHASE 1: 10-YARD BACKPEDAL & PLANT',
        description: 'DB pedaling smoothly plants back foot and drives downhill.',
        tokens: [
          { id: 'db-1', type: 'X', label: 'CB', x: 350, y: 260, color: '#8b5cf6' },
          { id: 'c-1', type: 'O', label: 'COACH', x: 350, y: 180, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-pedal', type: 'run', startX: 350, startY: 200, endX: 350, endY: 260, color: '#8b5cf6', label: 'Backpedal' },
          { id: 'a-drive', type: 'tackle', startX: 350, startY: 260, endX: 300, endY: 200, color: '#10b981', label: '45° Drive' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-db-deep-cushion-bail',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Deep 1/3 Cushion & Route Bail',
    subtitle: 'Cover 3 Deep Third, Maintain 3-Yard Vertical Buffer',
    objective: 'Corner aligned 6 yards off WR opens hips at 45 degrees in side-shuffle bail, maintaining a 3-yard vertical buffer over the receiver. Never allow WR to get behind.',
    setup: 'Corner aligned 6 yards off WR on sideline. WR runs go/fade route.',
    instructions: [
      'At snap, side-shuffle bail keeping eyes split 70% WR / 30% QB.',
      'Maintain 3-yard cushion over top.',
      'If WR crosses cushion, turn and sprint to stay on top of route.'
    ],
    equipment: 'Footballs, sideline cones.',
    cues: ['Keep the roof on', 'Maintain 3-yard buffer', 'Split vision WR & QB'],
    faults: ['Looking only at QB and getting beat deep', 'Turning hips too late'],
    phases: [
      {
        name: 'PHASE 1: SIDE-SHUFFLE BAIL & CUSHION',
        description: 'Corner maintains 3-yard vertical buffer on go route.',
        tokens: [
          { id: 'cb-1', type: 'X', label: 'CB', x: 220, y: 280, color: '#8b5cf6', subLabel: 'Bail' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 220, y: 240, color: '#2563eb' },
        ],
        arrows: [
          { id: 'a-fade', type: 'run', startX: 220, startY: 240, endX: 220, endY: 340, color: '#2563eb', label: 'Vertical Route' },
          { id: 'a-bail', type: 'run', startX: 220, startY: 280, endX: 220, endY: 370, color: '#8b5cf6', label: 'Bail Cushion' },
        ],
        zones: [
          { id: 'z-cushion', name: '3Y BUFFER', cx: 220, cy: 355, rx: 20, ry: 15, color: '#8b5cf6', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-db-defeat-stalk-block',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Defeat Stalk Block & Force',
    subtitle: 'Two-Hand Punch to Chest, Rip Outside Arm & Force Inside',
    objective: 'Defender reads run flow, attacks approaching WR stalk block, punches breastplate, rips outside arm free, and maintains outside leverage to force runner inside to pursuing LBs.',
    setup: 'WR stalks CB on perimeter run.',
    instructions: [
      'Attack WR block aggressively—do not back up.',
      'Deliver violent two-hand punch into WR numbers.',
      'Rip outside arm free, stay outside the ball carrier.'
    ],
    equipment: 'Shields, football.',
    cues: ['Never get hooked inside', 'Punch and rip', 'Force runner into alley'],
    faults: ['Allowing receiver to get hands on chest and turn you inside'],
    phases: [
      {
        name: 'PHASE 1: PUNCH & OUTSIDE LEVERAGE',
        description: 'CB punches WR block and rips outside arm free.',
        tokens: [
          { id: 'cb-1', type: 'X', label: 'CB', x: 220, y: 250, color: '#8b5cf6' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 220, y: 220, color: '#2563eb' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 280, y: 200, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-punch', type: 'block', startX: 220, startY: 250, endX: 220, endY: 225, color: '#8b5cf6', label: 'Punch & Rip Outside' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-db-tip-drill',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Tip & Overturn Turnover Drill',
    subtitle: 'Tandem Tip Deflection, Overturn Sprint & Two Hands High',
    objective: '3 DBs in line. Lead DB tips high pass into air. Trailing DB tracks deflection, shouts "BALL! BALL!", secures INT, and sprints 15 yards to the endzone.',
    setup: '3 DBs in tandem line 5 yards apart. Coach throws high ball.',
    instructions: [
      'Lead DB leaps and tips ball upward.',
      'Trailing DB locates deflected football, secures with two hands, and yells "BALL!".',
      'Tuck high and tight and sprint 15 yards.'
    ],
    equipment: 'Footballs, cones.',
    cues: ['Tip it high', 'Locate the deflection', 'Secure and sprint'],
    faults: ['Letting tipped ball hit ground', 'Loose ball carry'],
    phases: [
      {
        name: 'PHASE 1: TIP & OVERTURN INTERCEPTION',
        description: 'DB 1 tips ball. DB 2 tracks and intercepts.',
        tokens: [
          { id: 'db-1', type: 'X', label: 'DB 1', x: 350, y: 260, color: '#8b5cf6', subLabel: 'Tip' },
          { id: 'db-2', type: 'X', label: 'DB 2', x: 350, y: 310, color: '#8b5cf6', subLabel: 'Catch' },
          { id: 'ball-1', type: 'ball', label: '🏈', x: 350, y: 240, color: '#f59e0b' },
        ],
        arrows: [
          { id: 'a-tip', type: 'pass', startX: 350, startY: 240, endX: 350, endY: 280, color: '#f59e0b', label: 'Tip' },
          { id: 'a-run', type: 'run', startX: 350, startY: 310, endX: 350, endY: 180, color: '#10b981', label: 'Sprint 15y' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // TEAM DEFENSE & STUNTS / BLITZES - 12 DRILLS
  // ==========================================
  {
    id: 'matrix-team-11man-liz-pursuit',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'TEAM DEFENSE: 11-Man "Liz" Pursuit Drill',
    subtitle: 'Run Fits, Pursuit Angles & 11-Man Swarm',
    objective: 'Full 11-man defense executes run fits and inside-out pursuit angles on perimeter sweep. Every player must touch runner before whistle blows.',
    setup: 'Full 11 defense on field. Scout offense runs sweep to Liz (left).',
    instructions: [
      'On snap, execute primary gap fit.',
      'When ball declares outside, all 11 take pursuit angles.',
      'Never follow same color jersey—take your own pursuit lane.',
      'Touch runner with two hands; finish in sprint.'
    ],
    equipment: 'Full 11 defense, scout offense, football.',
    cues: ['Never follow your teammate', 'Take your lane', 'All 11 to the ball'],
    faults: ['Loafing on backside', 'Rounding off pursuit angle'],
    phases: [
      {
        name: 'PHASE 1: 11-MAN PURSUIT WALL',
        description: 'All 11 defensive players sprint in pursuit lanes to contain runner at sideline.',
        tokens: [
          { id: 'de-l', type: 'X', label: 'E9', x: 200, y: 230, color: '#06b6d4' },
          { id: 'dt-l', type: 'X', label: 'T3', x: 280, y: 230, color: '#4338ca' },
          { id: 'dt-r', type: 'X', label: 'T1', x: 380, y: 230, color: '#4338ca' },
          { id: 'de-r', type: 'X', label: 'E5', x: 460, y: 230, color: '#06b6d4' },
          { id: 'lb-1', type: 'X', label: 'SAM', x: 230, y: 280, color: '#10b981' },
          { id: 'lb-2', type: 'X', label: 'MIKE', x: 330, y: 280, color: '#10b981' },
          { id: 'lb-3', type: 'X', label: 'WILL', x: 410, y: 280, color: '#10b981' },
          { id: 'fs-1', type: 'X', label: 'FS', x: 350, y: 350, color: '#8b5cf6' },
          { id: 'rb-ball', type: 'O', label: 'RB', x: 150, y: 200, color: '#d91b24', subLabel: 'Sweep' },
        ],
        arrows: [
          { id: 'a-p1', type: 'tackle', startX: 200, startY: 230, endX: 160, endY: 205, color: '#10b981', label: 'Force' },
          { id: 'a-p2', type: 'tackle', startX: 230, startY: 280, endX: 170, endY: 215, color: '#10b981', label: 'Alley' },
          { id: 'a-p3', type: 'tackle', startX: 350, startY: 350, endX: 180, endY: 230, color: '#8b5cf6', label: 'Over Top' },
        ],
        zones: [
          { id: 'z-wall', name: 'PURSUIT WALL', cx: 170, cy: 215, rx: 40, ry: 40, color: '#10b981', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-team-pursuit-11cones',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'TEAM DEFENSE: Team Pursuit Angle Drill (11 Sideline Cones)',
    subtitle: 'Assigned Sideline Lanes, Lane Discipline & Wall Formation',
    objective: '11 cones spaced along sideline. On ball movement, defense fires off, coach blows whistle, and each of the 11 defenders sprints to their designated cone lane to form an impenetrable wall.',
    setup: '11 orange cones spaced 2-3 yards apart on the left sideline.',
    instructions: [
      'Align in base 4-4 defense.',
      'Fire first 2 read steps on ball snap.',
      'On whistle, sprint at full speed to designated cone lane.',
      'Breakdown at cone and buzz feet until coach command.'
    ],
    equipment: '11 orange cones, whistle.',
    cues: ['Sprint to your cone', 'Never cross a teammate path', 'Buzz feet at the cone'],
    faults: ['Multiple defenders running to the same cone', 'Slowing down before reaching line'],
    phases: [
      {
        name: 'PHASE 1: ASSIGNED LANE FORMATION',
        description: 'All 11 players sprint to their corresponding sideline cone forming an unbroken wall.',
        tokens: [
          { id: 'c-1', type: 'cone', label: '1', x: 120, y: 140, color: '#f97316' },
          { id: 'c-2', type: 'cone', label: '2', x: 120, y: 170, color: '#f97316' },
          { id: 'c-3', type: 'cone', label: '3', x: 120, y: 200, color: '#f97316' },
          { id: 'c-4', type: 'cone', label: '4', x: 120, y: 230, color: '#f97316' },
          { id: 'c-5', type: 'cone', label: '5', x: 120, y: 260, color: '#f97316' },
          { id: 'c-6', type: 'cone', label: '6', x: 120, y: 290, color: '#f97316' },
          { id: 'c-7', type: 'cone', label: '7', x: 120, y: 320, color: '#f97316' },
        ],
        arrows: [],
        zones: [
          { id: 'z-sideline', name: 'SIDELINE WALL', cx: 120, cy: 240, rx: 25, ry: 120, color: '#10b981', opacity: 0.15 },
        ],
      },
    ],
  },
  {
    id: 'matrix-team-stay-counter',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'TEAM DEFENSE: Stay-at-Home Counter Fit Drill',
    subtitle: 'Backside Discipline, Guard Pull Key & Bootleg Contain',
    objective: 'Stop misdirection and counter plays. Backside ILB stays square, follows pulling guard to hole. Backside DE squeezes edge and contains bootleg.',
    setup: 'Scout offense runs Counter GT. Defense fits backside responsibilities.',
    instructions: [
      'Read offensive linemen, not backfield eye candy.',
      'If Guard pulls across, follow his hip directly to the ball.',
      'Backside DE remains patient and contains QB bootleg.'
    ],
    equipment: 'Full pads, football.',
    cues: ['Read linemen, not eye candy', 'Follow pulling guard', 'Backside stay at home'],
    faults: ['Biting on initial backfield fake and leaving cutback wide open'],
    phases: [
      {
        name: 'PHASE 1: COUNTER FIT EXECUTION',
        description: 'Guard pulls. ILB scrapes square and meets runner in the hole.',
        tokens: [
          { id: 'g-pull', type: 'O', label: 'RG PULL', x: 400, y: 200, color: '#1a1a24' },
          { id: 'ilb-1', type: 'X', label: 'WILL', x: 380, y: 270, color: '#10b981' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 300, y: 160, color: '#d91b24', subLabel: 'Counter' },
        ],
        arrows: [
          { id: 'a-pull', type: 'run', startX: 400, startY: 200, endX: 290, endY: 220, color: '#1a1a24', label: 'Pull' },
          { id: 'a-fill', type: 'tackle', startX: 380, startY: 270, endX: 295, endY: 225, color: '#10b981', label: 'Fill Counter Hole' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-team-alley-vice',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'TEAM DEFENSE: The Alley "Vice" Tackle Drill',
    subtitle: 'Force vs. Spill Coordination, Two-Man Vice Tackle',
    objective: '1 OLB (Force player) and 1 ILB (Spill player) coordinate to squeeze runner in alley: Spill player hits inside hip, Force player turns runner inside, executing two-man vice.',
    setup: 'Cones set 5-yard wide alley. RB and lead blocker attack alley.',
    instructions: [
      'Spill player attacks inside shoulder of blocker, forcing runner wide.',
      'Force player attacks outside, turning runner back in.',
      'Both tacklers compress near hips simultaneously for vice clamp.'
    ],
    equipment: '4 cones, football.',
    cues: ['Spill inside, force outside', 'Vice clamp on near hips', 'Drive feet through contact'],
    faults: ['Both players taking the same leverage, allowing an easy cut'],
    phases: [
      {
        name: 'PHASE 1: VICE COLLISION',
        description: 'ILB spills runner wide while OLB turns runner in, clamping near hips.',
        tokens: [
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 310, y: 270, color: '#10b981', subLabel: 'Spill' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 240, y: 250, color: '#10b981', subLabel: 'Force' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 275, y: 210, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-vice1', type: 'tackle', startX: 310, startY: 270, endX: 285, endY: 215, color: '#10b981', label: 'Inside Squeeze' },
          { id: 'a-vice2', type: 'tackle', startX: 240, startY: 250, endX: 265, endY: 215, color: '#10b981', label: 'Outside Force' },
        ],
        zones: [
          { id: 'z-vice', name: 'VICE FIT', cx: 275, cy: 215, rx: 25, ry: 20, color: '#10b981', opacity: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'matrix-stunt-44-slant-liz',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'STUNT: 4-4 Slant Liz',
    subtitle: 'Entire DL Slants One Gap Left, LBs Fill Backside',
    objective: 'Call on strong-side run tendencies to Liz (Tight End) side. Entire defensive line fires one gap left, shutting down off-tackle power and sweeps.',
    setup: '4-4 Base Front. E9, T3, T1, E5 aligned across OL.',
    instructions: [
      'On snap, E9 slants into C/D gap.',
      'T3 slants across Guard into Left B-gap.',
      'T1 slants across Center into Left A-gap.',
      'E5 slants inside into Right B-gap.',
      'Linebackers scrape and fill vacated gaps.'
    ],
    equipment: 'Full 11 defense.',
    cues: ['Rip to the Liz side', 'Rip through the V-neck', 'LBs fill the backside'],
    faults: ['Slanting too deep upfield instead of gap penetration'],
    phases: [
      {
        name: 'PHASE 1: 4-MAN SLANT ANGLE',
        description: 'All 4 down linemen slant one gap left on the snap.',
        tokens: [
          { id: 'e9', type: 'X', label: 'E9', x: 220, y: 250, color: '#06b6d4' },
          { id: 't3', type: 'X', label: 'T3', x: 290, y: 250, color: '#4338ca' },
          { id: 't1', type: 'X', label: 'T1', x: 370, y: 250, color: '#4338ca' },
          { id: 'e5', type: 'X', label: 'E5', x: 450, y: 250, color: '#06b6d4' },
          { id: 'c-1', type: 'O', label: 'C', x: 330, y: 200, color: '#1a1a24' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 260, y: 200, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 400, y: 200, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-e9', type: 'run', startX: 220, startY: 250, endX: 180, endY: 205, color: '#06b6d4', label: 'C/D Gap' },
          { id: 'a-t3', type: 'run', startX: 290, startY: 250, endX: 240, endY: 205, color: '#4338ca', label: 'Left B' },
          { id: 'a-t1', type: 'run', startX: 370, startY: 250, endX: 315, endY: 205, color: '#4338ca', label: 'Left A' },
          { id: 'a-e5', type: 'run', startX: 450, startY: 250, endX: 410, endY: 205, color: '#06b6d4', label: 'Right B' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-stunt-44-cross-liz',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'STUNT: 4-4 Cross Liz (Interior Tackle Cross)',
    subtitle: 'Interior Tackles Scissor A-Gaps, DEs Contain Edges',
    objective: 'Call against inside zone, ISO, and A-gap trap teams. Confuses center and guard blocking rules by scissoring interior defensive tackles across the center.',
    setup: '4-4 Base Front. T3 and T1 in A/B gaps.',
    instructions: [
      'T3 slants hard across Center into Right A-gap.',
      'T1 loops tightly behind T3 across into Left A-gap.',
      'DEs rush straight upfield with aggressive outside edge contain.'
    ],
    equipment: 'Defensive front, football.',
    cues: ['T3 first, T1 right behind', 'Scissor the Center', 'DEs hold the edge'],
    faults: ['T1 colliding with T3 due to lack of spacing'],
    phases: [
      {
        name: 'PHASE 1: SCISSOR CROSS IN CENTER A-GAPS',
        description: 'T3 slants first; T1 crosses behind into opposite A-gap.',
        tokens: [
          { id: 't3', type: 'X', label: 'T3', x: 300, y: 250, color: '#4338ca' },
          { id: 't1', type: 'X', label: 'T1', x: 380, y: 250, color: '#4338ca' },
          { id: 'c-1', type: 'O', label: 'C', x: 340, y: 200, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-cross1', type: 'run', startX: 300, startY: 250, endX: 360, endY: 205, color: '#4338ca', label: 'Cross Right A' },
          { id: 'a-cross2', type: 'run', startX: 380, startY: 250, endX: 320, endY: 205, color: '#4338ca', label: 'Loop Left A' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-stunt-44-fan-liz',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'STUNT: 4-4 Fan Liz',
    subtitle: 'Interior Tackles Fan to B-Gaps, ILBs Shoot Vacant A-Gaps',
    objective: 'Defensive tackles slant outward into B-gaps. Both inside linebackers read "Fan" call and shoot downhill like rockets through vacant A-gaps.',
    setup: '4-4 Front. Tackles and Inside Linebackers coordinated.',
    instructions: [
      'T3 slants into Left B-gap; T1 slants into Right B-gap.',
      'ILBs trigger immediately on snap, firing downhill through Left and Right A-gaps.',
      'Creates instant interior penetration to destroy handoff mesh.'
    ],
    equipment: 'Full front 8.',
    cues: ['Tackles fan out', 'LBs shoot A-gaps', 'Meet at the quarterback'],
    faults: ['LBs hesitating and allowing Center to recover'],
    phases: [
      {
        name: 'PHASE 1: TACKLES FAN & LBS FIRE DOWNHILL',
        description: 'Tackles fan out while ILBs shoot into A-gaps right into backfield.',
        tokens: [
          { id: 't3', type: 'X', label: 'T3', x: 300, y: 240, color: '#4338ca' },
          { id: 't1', type: 'X', label: 'T1', x: 380, y: 240, color: '#4338ca' },
          { id: 'mike', type: 'X', label: 'MIKE', x: 310, y: 290, color: '#10b981' },
          { id: 'will', type: 'X', label: 'WILL', x: 370, y: 290, color: '#10b981' },
          { id: 'c-1', type: 'O', label: 'C', x: 340, y: 190, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-fan-l', type: 'run', startX: 300, startY: 240, endX: 250, endY: 200, color: '#4338ca', label: 'Fan B-Gap' },
          { id: 'a-fan-r', type: 'run', startX: 380, startY: 240, endX: 430, endY: 200, color: '#4338ca', label: 'Fan B-Gap' },
          { id: 'a-lb-a1', type: 'tackle', startX: 310, startY: 290, endX: 325, endY: 195, color: '#10b981', label: 'Shoot Left A' },
          { id: 'a-lb-a2', type: 'tackle', startX: 370, startY: 290, endX: 355, endY: 195, color: '#10b981', label: 'Shoot Right A' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-blitz-44-doubledog',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'BLITZ: 4-4 Double Dog 0 Liz',
    subtitle: 'Dual A-Gap Linebacker Blitz, Cover 0 Man-to-Man',
    objective: 'High-pressure 3rd down blitz call. Both ILBs fire through A/B gaps right into QB face. Defensive backs lock in Cover 0 aggressive man coverage.',
    setup: 'Base 4-4 Defense. ILBs walk up to 2 yards off ball pre-snap.',
    instructions: [
      'ILBs show blitz late (mug the A-gaps).',
      'On snap, explode through A-gaps straight to QB.',
      'DBs press receivers with inside leverage.',
      'Ball must come out in under 1.5 seconds.'
    ],
    equipment: 'Full 11 vs 11.',
    cues: ['Mug the gaps late', 'Explode on the snap', 'Cover 0 lock on your man'],
    faults: ['Showing blitz too early allowing QB to audible'],
    phases: [
      {
        name: 'PHASE 1: DUAL A-GAP BLITZ EXPLOSION',
        description: 'Both ILBs blitz straight up the gut through Center A-gaps into QB chest.',
        tokens: [
          { id: 'mike', type: 'X', label: 'MIKE', x: 315, y: 260, color: '#10b981', subLabel: 'A-Gap' },
          { id: 'will', type: 'X', label: 'WILL', x: 365, y: 260, color: '#10b981', subLabel: 'A-Gap' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 340, y: 150, color: '#d91b24' },
          { id: 'c-1', type: 'O', label: 'C', x: 340, y: 200, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-b1', type: 'tackle', startX: 315, startY: 260, endX: 330, endY: 160, color: '#10b981', label: 'Blitz Mike' },
          { id: 'a-b2', type: 'tackle', startX: 365, startY: 260, endX: 350, endY: 160, color: '#10b981', label: 'Blitz Will' },
        ],
        zones: [
          { id: 'z-blitz', name: 'COLLAPSE POCKET', cx: 340, cy: 160, rx: 40, ry: 30, color: '#ef4444', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-blitz-44-blow-sting',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'BLITZ: 4-4 Blow Sting Liz (Edge Call)',
    subtitle: 'Coordinated DE Crash & OLB Edge Blitz',
    objective: 'Edge twist pressure package: "ME" call means OLB contains outside while DE crashes inside. "YOU" call means DE contains outside while OLB blitzes inside.',
    setup: '4-4 Front on passing down.',
    instructions: [
      'OLB and DE communicate call: "ME" or "YOU".',
      'Crash defender creates collision with offensive tackle.',
      'Looping defender accelerates through vacated seam to sack QB.'
    ],
    equipment: 'Full front 8.',
    cues: ['Call loud: "ME" or "YOU"', 'Pick the tackle', 'Loop tight to the hip'],
    faults: ['Both rushing the same gap'],
    phases: [
      {
        name: 'PHASE 1: EDGE TWIST PRESSURE',
        description: 'DE crashes B-gap; OLB loops over the top on outside rush.',
        tokens: [
          { id: 'de-1', type: 'X', label: 'DE', x: 240, y: 240, color: '#06b6d4' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 200, y: 270, color: '#10b981' },
          { id: 'ot-1', type: 'O', label: 'OT', x: 260, y: 190, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-crash', type: 'run', startX: 240, startY: 240, endX: 280, endY: 195, color: '#06b6d4', label: 'Crash B-Gap' },
          { id: 'a-loop', type: 'tackle', startX: 200, startY: 270, endX: 320, endY: 155, color: '#10b981', label: 'Loop to QB' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'team-defense-9-cone',
    category: 'TEAM',
    categoryLabel: 'Team Tackling & Circuits',
    title: 'TEAM DEFENSE: 9 Cone Vice Tackle Drill',
    subtitle: 'Two Tacklers, Changing Angles, Inside-Out & Outside-In Squeeze',
    objective: 'Two defenders work together to vice the ball carrier: one from each side, each pinning the near hip, so he has nowhere to cut. Players pick their own cones, so the angles change every rep like they do in a game.',
    setup: 'Nine cones in three rows of three, 5 yards apart each way (a 10 x 10 yard square): three across the 40, three across the 45 and three across the 50. The ball carrier and the two tacklers all start together at the middle cone.',
    instructions: [
      'All three players start in the middle of the square, at the center cone.',
      'On "Break!" the ball carrier sprints out to any of the three cones on the 40.',
      'At the same time each tackler breaks to a cone of his choice: any of the three on the 50, or the left or right cone on the 45. Different cones = different angles.',
      'As soon as they touch their cones the rep is live: both tacklers call "Vice! Vice! Vice!" and close on the ball carrier from opposite sides.',
      'Both tacklers scallop (shuffle downhill, shoulders square) and pin the ball carrier\'s near hip, so he can\'t cut back across either of them.',
      'The ball carrier makes it competitive: he tries to make them miss.',
      'Finish near foot, near shoulder, together. Rotate: tacklers pick new cones every rep.',
    ],
    equipment: '9 cones, 1 football, whistle.',
    diagramKeys: [
      { text: 'Everyone starts at the middle cone', isHighlight: true },
      { text: 'Top row (40): ball carrier picks a cone', isHighlight: false },
      { text: 'Bottom row (50) or outside 45 cones: tacklers pick', isHighlight: false },
      { text: 'Call it: "Vice! Vice! Vice!"', isHighlight: true },
      { text: 'Near foot, near shoulder', isHighlight: true },
    ],
    cues: ['"Vice! Vice! Vice!"', '"Scallop: stay square, inside foot up"', '"Pin the near hip"', '"Near foot, near shoulder"', '"Use your buddy"'],
    faults: [
      'No talk: neither tackler calls the vice.',
      'Running past the near hip and giving up the cutback between the two tacklers.',
      'Turning the shoulders and sprinting instead of scalloping under control.',
      'One tackler stops his feet and watches his partner make the tackle.',
    ],
    phases: [
      {
        name: 'PHASE 1: START IN THE MIDDLE, BREAK TO A CONE',
        description: 'All three start at the middle cone. On "Break!" the ball carrier goes to a cone on the 40 and each tackler to a cone on the 50 or an outside cone on the 45. New cones every rep.',
        tokens: [
          { id: 'cone-40-0', type: 'cone', label: '40', x: 230, y: 130, color: '#f97316' },
          { id: 'cone-40-1', type: 'cone', label: '40', x: 350, y: 130, color: '#f97316' },
          { id: 'cone-40-2', type: 'cone', label: '40', x: 470, y: 130, color: '#f97316' },
          { id: 'cone-45-0', type: 'cone', label: '45', x: 230, y: 250, color: '#f97316' },
          { id: 'cone-45-1', type: 'cone', label: '45', x: 350, y: 250, color: '#f97316' },
          { id: 'cone-45-2', type: 'cone', label: '45', x: 470, y: 250, color: '#f97316' },
          { id: 'cone-50-0', type: 'cone', label: '50', x: 230, y: 370, color: '#f97316' },
          { id: 'cone-50-1', type: 'cone', label: '50', x: 350, y: 370, color: '#f97316' },
          { id: 'cone-50-2', type: 'cone', label: '50', x: 470, y: 370, color: '#f97316' },
          { id: 'o-bc', type: 'O', label: 'BC', x: 350, y: 222, color: '#b91c1c' },
          { id: 'd-1', type: 'letter', label: 'D1', x: 322, y: 272, color: '#0052cc' },
          { id: 'd-2', type: 'letter', label: 'D2', x: 380, y: 272, color: '#058538' },
        ],
        arrows: [
          { id: 'a-bc-break', type: 'straight', startX: 350, startY: 222, endX: 350, endY: 145, color: '#b91c1c', label: 'Break to the 40' },
          { id: 'a-d1-break', type: 'straight', startX: 322, startY: 272, endX: 240, endY: 358, color: '#0052cc', label: 'Break to the 50' },
          { id: 'a-d2-break', type: 'straight', startX: 380, startY: 272, endX: 458, endY: 255, color: '#058538', label: 'Outside 45' },
        ],
        zones: [
          { id: 'z-bc', name: 'BALL CARRIER CONES', cx: 350, cy: 130, rx: 165, ry: 28, color: '#b91c1c', opacity: 0.1 },
          { id: 'z-d', name: 'TACKLER CONES', cx: 350, cy: 370, rx: 165, ry: 28, color: '#0052cc', opacity: 0.1 },
        ],
      },
      {
        name: 'PHASE 2: VICE! VICE! VICE!',
        description: 'On the whistle both tacklers call the vice and close from opposite sides, scalloping with shoulders square and pinning the near hip.',
        tokens: [
          { id: 'cone-40-0', type: 'cone', label: '40', x: 230, y: 130, color: '#f97316' },
          { id: 'cone-40-1', type: 'cone', label: '40', x: 350, y: 130, color: '#f97316' },
          { id: 'cone-40-2', type: 'cone', label: '40', x: 470, y: 130, color: '#f97316' },
          { id: 'cone-45-0', type: 'cone', label: '45', x: 230, y: 250, color: '#f97316' },
          { id: 'cone-45-1', type: 'cone', label: '45', x: 350, y: 250, color: '#f97316' },
          { id: 'cone-45-2', type: 'cone', label: '45', x: 470, y: 250, color: '#f97316' },
          { id: 'cone-50-0', type: 'cone', label: '50', x: 230, y: 370, color: '#f97316' },
          { id: 'cone-50-1', type: 'cone', label: '50', x: 350, y: 370, color: '#f97316' },
          { id: 'cone-50-2', type: 'cone', label: '50', x: 470, y: 370, color: '#f97316' },
          { id: 'o-bc', type: 'O', label: 'BC', x: 350, y: 160, color: '#b91c1c' },
          { id: 'd-1', type: 'letter', label: 'D1', x: 290, y: 300, color: '#0052cc', subLabel: 'Pin near hip' },
          { id: 'd-2', type: 'letter', label: 'D2', x: 440, y: 235, color: '#058538', subLabel: 'Pin near hip' },
        ],
        arrows: [
          { id: 'a-bc', type: 'straight', startX: 350, startY: 100, endX: 350, endY: 160, color: '#b91c1c', label: 'Tries to make them miss' },
          { id: 'a-d1', type: 'blitz', startX: 230, startY: 400, endX: 290, endY: 300, color: '#0052cc', label: 'Scallop' },
          { id: 'a-d2', type: 'blitz', startX: 505, startY: 250, endX: 440, endY: 235, color: '#058538', label: 'Scallop' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 3: SQUEEZE & FINISH',
        description: 'The two tacklers squeeze him between them and finish together: near foot, near shoulder.',
        tokens: [
          { id: 'cone-40-0', type: 'cone', label: '40', x: 230, y: 130, color: '#f97316' },
          { id: 'cone-40-1', type: 'cone', label: '40', x: 350, y: 130, color: '#f97316' },
          { id: 'cone-40-2', type: 'cone', label: '40', x: 470, y: 130, color: '#f97316' },
          { id: 'cone-45-0', type: 'cone', label: '45', x: 230, y: 250, color: '#f97316' },
          { id: 'cone-45-1', type: 'cone', label: '45', x: 350, y: 250, color: '#f97316' },
          { id: 'cone-45-2', type: 'cone', label: '45', x: 470, y: 250, color: '#f97316' },
          { id: 'cone-50-0', type: 'cone', label: '50', x: 230, y: 370, color: '#f97316' },
          { id: 'cone-50-1', type: 'cone', label: '50', x: 350, y: 370, color: '#f97316' },
          { id: 'cone-50-2', type: 'cone', label: '50', x: 470, y: 370, color: '#f97316' },
          { id: 'o-bc', type: 'O', label: 'BC', x: 365, y: 215, color: '#b91c1c' },
          { id: 'd-1', type: 'letter', label: 'D1', x: 335, y: 235, color: '#0052cc', subLabel: 'Near foot, near shoulder' },
          { id: 'd-2', type: 'letter', label: 'D2', x: 395, y: 215, color: '#058538' },
        ],
        arrows: [
          { id: 'a-d1', type: 'straight', startX: 290, startY: 300, endX: 335, endY: 235, color: '#0052cc' },
          { id: 'a-d2', type: 'straight', startX: 440, startY: 235, endX: 395, endY: 215, color: '#058538' },
        ],
        zones: [
          { id: 'z-vice', name: 'THE VICE', cx: 365, cy: 220, rx: 65, ry: 40, color: '#058538', opacity: 0.2 },
        ],
      },
    ],
    videoUrl: 'https://www.youtube.com/watch?v=afV8ChXnIU8',
  },

  // ==========================================
  // COVER 3 DEFENSE & POSITION PROGRESSIONS (5 DRILLS)
  // ==========================================
  {
    id: 'c3-olb-defend-smash',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'LB: Defend Smash Concept (OLB Route Recognition)',
    subtitle: 'Collision & Reroute #2, Sneak-a-Peek to #1, Buzz Downhill on Hitch/Flat',
    objective: 'Train the outside linebacker / apex defender on eye progression and route recognition against Smash (Hitch-Corner) concepts. Collision #2 at 5-6 yards while reading through his chest to locate #1. If #1 sits in the hitch/flat, immediately break ("buzz") downhill on the throw.',
    setup: 'Offense lines up with #1 outside receiver on the numbers and #2 slot receiver in the seam. QB takes 3-step drop. OLB/Apex defender aligns 4 yards off LOS shaded inside #2. Corner aligns 7 yards deep outside #1.',
    instructions: [
      'OLB aligns inside shade of #2 slot receiver with eyes reading through #2 to the quarterback.',
      'On snap: deliver a firm 2-hand jam/reroute on #2 at 5-6 yards to disrupt the timing of his corner route stem.',
      'While contacting #2, "sneak a peek" through his chest to identify #1\'s route on the perimeter.',
      'If #1 sits at 5 yards on a hitch or swings to the flat: immediately disengage, plant outside foot, and drive ("buzz") downhill through #1\'s inside shoulder.',
      'If #1 pushes vertical (Fade/Streak): sink under #2\'s corner route into the curl-flat window while Corner stays over the top.',
    ],
    equipment: '4 cones (marking 5 & 12 yard landmarks), 1 football, coach / QB.',
    diagramKeys: [
      { text: 'Collision #2 at 5-6 yards', isHighlight: true },
      { text: 'Sneak a peek through #2 to locate #1', isHighlight: true },
      { text: 'Buzz flat immediately when #1 sits on hitch', isHighlight: false },
      { text: 'Corner maintains deep 1/3 leverage over corner route', isHighlight: false },
    ],
    cues: [
      '"Jam & Reroute #2 at 5 yards!"',
      '"Sneak a peek through #2 to #1!"',
      '"Buzz the flat on the hitch throw!"',
      '"Don\'t let #2 get a free vertical release!"',
    ],
    faults: [
      'Chasing #2 out to the corner route and leaving the 5-yard hitch wide open for easy completion.',
      'Failing to collision #2, allowing him to push full speed into the deep corner window.',
      'Staring into the backfield and losing track of perimeter route distribution.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=nVwuQWHCvTo',
    phases: [
      {
        name: 'PHASE 1: COLLISION #2 & PEEK TO #1',
        description: 'Snap of ball. OLB strikes #2 at 5 yards, redirecting route while peeking at #1 hitch stem.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 200, color: '#b91c1c', subLabel: 'Hitch Stem' },
          { id: 'wr-2', type: 'O', label: '#2 SLOT', x: 230, y: 200, color: '#b91c1c', subLabel: 'Corner Stem' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 230, y: 250, color: '#10b981', subLabel: 'Collision & Peek' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 120, y: 360, color: '#7c3aed', subLabel: 'Deep 1/3 Bail' },
        ],
        arrows: [
          { id: 'a-wr1-stem', type: 'pass', startX: 120, startY: 200, endX: 120, endY: 245, color: '#b91c1c', label: '5-Yd Hitch' },
          { id: 'a-wr2-stem', type: 'pass', startX: 230, startY: 200, endX: 230, endY: 250, color: '#b91c1c', label: 'Vertical Stem' },
          { id: 'a-olb-jam', type: 'block', startX: 230, startY: 250, endX: 230, endY: 240, color: '#10b981', label: '2-Hand Jam' },
          { id: 'a-cb-bail', type: 'drop', startX: 120, startY: 360, endX: 120, endY: 410, color: '#7c3aed', dashed: true, label: 'Deep 1/3' },
        ],
        zones: [
          { id: 'z-jam', name: '5-YD COLLISION ZONE', cx: 230, cy: 245, rx: 40, ry: 25, color: '#10b981', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: BUZZ DOWNHILL ON THE HITCH THROW',
        description: 'As QB unloads to #1 hitch, OLB plants foot and drives downhill through the catch point while CB caps deep corner.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 245, color: '#b91c1c', subLabel: 'Hitch Sit' },
          { id: 'wr-2', type: 'O', label: '#2 SLOT', x: 190, y: 350, color: '#b91c1c', subLabel: 'Corner Break' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 135, y: 255, color: '#10b981', subLabel: 'Buzz Strike' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 170, y: 400, color: '#7c3aed', subLabel: 'Cap Corner' },
        ],
        arrows: [
          { id: 'a-throw', type: 'pass', startX: 350, startY: 150, endX: 125, endY: 245, color: '#f59e0b', dashed: true, label: 'Hitch Throw' },
          { id: 'a-olb-buzz', type: 'run', startX: 230, startY: 250, endX: 135, endY: 255, color: '#10b981', label: 'Drive to Catch' },
          { id: 'a-wr2-corner', type: 'pass', startX: 230, startY: 250, endX: 190, endY: 350, color: '#b91c1c', label: 'Corner Route' },
          { id: 'a-cb-cap', type: 'run', startX: 120, startY: 410, endX: 170, endY: 400, color: '#7c3aed', label: 'Top-Down Overlap' },
        ],
        zones: [
          { id: 'z-flat-kill', name: 'FLAT BREAK ZONE', cx: 130, cy: 250, rx: 45, ry: 30, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'c3-curl-flat-technique',
    category: 'LB',
    categoryLabel: 'Linebackers (LB)',
    title: 'Cover 3: Elite Curl/Flat Drop & QB Shoulder Read',
    subtitle: '12-Yard Landmark Drop, Reading QB Shoulder Progression',
    objective: 'Train apex and outside linebackers to drop efficiently to their 12-yard aiming point near the top of the numbers while reading the quarterback’s shoulders. The QB’s front shoulder tilt dictates when to hold depth in the curl vs. trigger aggressively on the flat.',
    setup: 'Place cone at 12-yard depth at the top of the numbers (hash to boundary). OLB aligns 4 yards off LOS. QB takes 5-step drop at center.',
    instructions: [
      'On pass read: open hips and cross-over sprint to the 12-yard landmark (top of numbers).',
      'Keep eyes locked onto the quarterback\'s front shoulder rather than turning head to hunt receivers.',
      'If QB shoulders remain high/neutral: sink deeper under the curl/dig window.',
      'As soon as QB\'s non-throwing shoulder points to the flat or hand separates from the ball: plant back foot and drive downhill through the catch point.',
    ],
    equipment: 'Cone at 12-yard top of numbers, football, coach / QB.',
    diagramKeys: [
      { text: 'Sprint to 12 yards top of numbers', isHighlight: true },
      { text: 'Eyes locked on QB front shoulder', isHighlight: true },
      { text: 'Hold curl window until QB shoulders commit to flat', isHighlight: false },
      { text: 'Plant back foot and drive flat throw', isHighlight: true },
    ],
    cues: [
      '"Sprint to 12 yards top of numbers!"',
      '"Eyes through QB front shoulder!"',
      '"Don\'t chase ghosts—read the throw!"',
      '"Plant and drive downhill through the catch!"',
    ],
    faults: [
      'Stopping drop at 6-7 yards and getting thrown over into the curl window.',
      'Turning head away from QB to chase flat route prematurely.',
      'Rounding off the transition instead of sticking a clean plant step.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=lVPyL0ZOaMQ',
    phases: [
      {
        name: 'PHASE 1: 12-YARD CURL DROP & QB SHOULDER READ',
        description: 'OLB sprints to 12-yard top-of-numbers landmark with eyes glued to QB shoulders, holding curl depth.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 140, color: '#1a1a24', subLabel: '5-Step Drop' },
          { id: 'cone-12', type: 'cone', label: '12 YD', x: 200, y: 340, color: '#f97316' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 230, y: 240, color: '#10b981', subLabel: 'Cross-Over Drop' },
          { id: 'wr-flat', type: 'O', label: 'FLAT', x: 100, y: 220, color: '#b91c1c' },
          { id: 'wr-curl', type: 'O', label: 'CURL', x: 200, y: 350, color: '#b91c1c' },
        ],
        arrows: [
          { id: 'a-olb-drop', type: 'drop', startX: 230, startY: 240, endX: 200, endY: 340, color: '#10b981', dashed: true, label: '12-Yd Landmark' },
          { id: 'a-wr-flat', type: 'pass', startX: 100, startY: 200, endX: 100, endY: 220, color: '#b91c1c', label: 'Flat Out' },
          { id: 'a-wr-curl', type: 'pass', startX: 200, startY: 200, endX: 200, endY: 350, color: '#b91c1c', label: '12-Yd Curl' },
        ],
        zones: [
          { id: 'z-curl', name: '12-YD CURL LANDMARK', cx: 200, cy: 340, rx: 60, ry: 35, color: '#10b981', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: QB SHOULDERS COMMIT & DOWNHILL DRIVE',
        description: 'QB shoulder opens to flat. OLB plants back foot and drives downhill on the flat ball while maintaining inside-out leverage.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 140, color: '#1a1a24' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 120, y: 235, color: '#10b981', subLabel: 'Plant & Drive' },
          { id: 'wr-flat', type: 'O', label: 'FLAT', x: 100, y: 230, color: '#b91c1c', subLabel: 'Target' },
        ],
        arrows: [
          { id: 'a-throw', type: 'pass', startX: 350, startY: 140, endX: 105, endY: 230, color: '#f59e0b', dashed: true, label: 'Flat Throw' },
          { id: 'a-olb-drive', type: 'run', startX: 200, startY: 340, endX: 120, endY: 235, color: '#10b981', label: 'Drive to Catch Point' },
        ],
        zones: [
          { id: 'z-drive', name: 'DRIVE & TACKLE ZONE', cx: 110, cy: 230, rx: 50, ry: 30, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'c3-db-bail-technique',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Cover 3 Bail Technique & Deep Third Footwork',
    subtitle: 'Pre-Turned Inside Foot, Zero False Steps, Staying 2 Yards on Top of #1',
    objective: 'Master the Cover 3 corner bail technique from pre-snap alignment to top of route. Eliminate false steps, turn the inside foot slightly pre-snap (45 degrees), and push off into a 3-step glide to maintain top-down leverage over vertical routes.',
    setup: 'Corner aligns 6-7 yards off #1 with inside leverage. Place landmark cones at 15 and 25 yards depth in the deep third boundary.',
    instructions: [
      'Corner aligns 6-7 yards off #1 with inside leverage, inside foot forward and turned slightly inward (45-degree pre-turn).',
      'Weight distributed 60/40 on the front foot to eliminate backward false stepping.',
      'On snap: push off front toe into a 3-step bail crossover without bouncing helmet level.',
      'Maintain vision on QB while keeping #1 in peripheral vision; always stay 2 yards deeper than the deepest receiver.',
      'At 12-15 yards: transition from bail glide to full speed stride if receiver pushes vertical stem.',
    ],
    equipment: '2 Boundary landmark cones, football, receiver, coach.',
    diagramKeys: [
      { text: 'Pre-turn inside foot 45 degrees', isHighlight: true },
      { text: '60/40 weight on front foot—zero false steps', isHighlight: true },
      { text: 'Push and glide into 3-step bail crossover', isHighlight: false },
      { text: 'Always stay 2 yards on top of #1', isHighlight: true },
    ],
    cues: [
      '"Pre-turn the inside foot 45°!"',
      '"No false steps—push and glide!"',
      '"Cap the deep third!"',
      '"Stay 2 yards on top of #1!"',
    ],
    faults: [
      'False stepping backwards with the back foot on snap.',
      'Turning shoulders completely toward the sideline and losing quarterback vision.',
      'Allowing #1 to get even with or behind your hip level.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=2c2qFip1yvc',
    phases: [
      {
        name: 'PHASE 1: 45° PRE-TURN STANCE & 3-STEP PUSH-GLIDE',
        description: 'Inside foot turned 45 degrees pre-snap, 60/40 weight forward. Smooth push off front toe into 3-step bail crossover.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 200, color: '#b91c1c', subLabel: 'Vertical Stem' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 130, y: 270, color: '#7c3aed', subLabel: '45° Pre-Turn' },
          { id: 'cone-15', type: 'cone', label: '15 YD', x: 130, y: 380, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-wr-stem', type: 'pass', startX: 120, startY: 200, endX: 120, endY: 340, color: '#b91c1c', label: 'Go Route Stem' },
          { id: 'a-cb-bail', type: 'drop', startX: 130, startY: 270, endX: 130, endY: 380, color: '#7c3aed', dashed: true, label: '3-Step Push & Glide' },
        ],
        zones: [
          { id: 'z-top', name: '2-YARD TOP-DOWN CUSHION', cx: 125, cy: 370, rx: 45, ry: 35, color: '#7c3aed', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: CAPPING THE DEEP THIRD & HIGH POINT',
        description: 'Corner stays 2 yards on top of #1, tracks ball in flight, and high-points interception at highest elevation.',
        tokens: [
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 380, color: '#b91c1c' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 125, y: 410, color: '#7c3aed', subLabel: 'High Point INT' },
        ],
        arrows: [
          { id: 'a-deep-throw', type: 'pass', startX: 350, startY: 150, endX: 125, endY: 410, color: '#f59e0b', dashed: true, label: 'Deep 1/3 Ball' },
          { id: 'a-cb-catch', type: 'run', startX: 130, startY: 380, endX: 125, endY: 410, color: '#7c3aed', label: 'Attack Ball at Apex' },
        ],
        zones: [
          { id: 'z-cap', name: 'DEEP 1/3 CAP ZONE', cx: 125, cy: 410, rx: 50, ry: 30, color: '#7c3aed', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'c3-db-feather-eyework',
    category: 'DB',
    categoryLabel: 'Defensive Backs (DB)',
    title: 'DB: Cover 3 Feather Step & Eye Transitions',
    subtitle: '6-Inch Control Steps, Zone Turn, & High-Pointing Overlapping Seams',
    objective: 'Train defensive backs to utilize the 6-inch "feather technique" control steps. Drill rapid eye transition from quarterback to receiver stem, executing a clean zone turn, and high-pointing overlapping vertical and post/seam routes.',
    setup: 'DB aligns at 7 yards depth on hash / boundary. Receiver runs vertical with option to break post/corner at 12 yards.',
    instructions: [
      'Initiate backpedal with 6-inch "feather steps"—low, controlled, ready to plant or drive in any direction.',
      'Eyes read QB drop (3-step quick vs 5-step deep); transition eyes to receiver’s hip at the break point (10-12 yards).',
      'Execute a clean "zone turn" (opening hips toward the quarterback while running stride-for-stride with receiver).',
      'Attack the ball at its highest point with two hands and secure into chest.',
    ],
    equipment: 'Football, receiver, coach.',
    diagramKeys: [
      { text: '6-inch feather backpedal steps', isHighlight: true },
      { text: 'Transition eyes: QB to receiver hip at 10-12 yds', isHighlight: true },
      { text: 'Zone turn: open hips to QB while running vertical', isHighlight: false },
      { text: 'High point ball with 2 hands at apex', isHighlight: true },
    ],
    cues: [
      '"6-inch feather steps!"',
      '"Fast eyes: QB to receiver hip!"',
      '"Clean zone turn—keep eyes on the ball!"',
      '"High point with two hands!"',
    ],
    faults: [
      'Taking long, bounding backpedal steps that lock the hips.',
      'Staring exclusively at receiver and missing QB pump-fake or scramble.',
      'Jumping early or mistiming the catch point.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=yR60NY6lUEs',
    phases: [
      {
        name: 'PHASE 1: 6-INCH FEATHER STEP & EYE TRANSITION',
        description: 'DB pedals with 6-inch feather steps, reads QB drop, and snaps eyes to receiver hip at 10-yard stem.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 140, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 200, y: 200, color: '#b91c1c', subLabel: 'Vertical Stem' },
          { id: 'db-1', type: 'X', label: 'DB', x: 200, y: 280, color: '#7c3aed', subLabel: '6" Feather' },
        ],
        arrows: [
          { id: 'a-wr-stem', type: 'pass', startX: 200, startY: 200, endX: 200, endY: 320, color: '#b91c1c', label: '10-Yd Stem' },
          { id: 'a-db-feather', type: 'drop', startX: 200, startY: 280, endX: 200, endY: 340, color: '#7c3aed', dashed: true, label: 'Feather Steps' },
        ],
        zones: [
          { id: 'z-eye', name: 'EYE TRANSITION POINT', cx: 200, cy: 320, rx: 45, ry: 25, color: '#7c3aed', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: ZONE TURN & HIGH POINT AT APEX',
        description: 'DB opens hips in zone turn facing QB, accelerates with receiver, and elevates with two hands for the interception.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 210, y: 390, color: '#b91c1c' },
          { id: 'db-1', type: 'X', label: 'DB', x: 205, y: 415, color: '#7c3aed', subLabel: 'Apex Catch' },
        ],
        arrows: [
          { id: 'a-throw', type: 'pass', startX: 350, startY: 140, endX: 205, endY: 415, color: '#f59e0b', dashed: true, label: 'Deep Seam Pass' },
          { id: 'a-db-turn', type: 'run', startX: 200, startY: 340, endX: 205, endY: 415, color: '#7c3aed', label: 'Zone Turn & High Point' },
        ],
        zones: [
          { id: 'z-apex', name: 'HIGH POINT CATCH ZONE', cx: 205, cy: 415, rx: 50, ry: 30, color: '#7c3aed', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'c3-shell-60-40-overlap',
    category: 'SCHEME',
    categoryLabel: 'Defensive Schemes & Shells',
    title: 'Cover 3 Shell: 60/40 Overlap Rule vs Deep Combinations',
    subtitle: 'Defending 4-Verticals & Post-Wheel Without Getting Split',
    objective: 'Teach the 3-deep secondary (Corners and Free Safety) how to apply the 60/40 overlap rule when two vertical threats enter their deep third. Maintain proper divide leverage so no intermediate route pulls a deep defender out of position.',
    setup: 'Full 3-deep secondary shell (Left CB, Free Safety, Right CB) aligned across the field. Offense lines up in 2x2 spread running 4-Verticals or Post-Wheel.',
    instructions: [
      'Secondary aligns in 3-deep shell (Corners at 7 yards outside third, Free Safety at 10-12 yards middle third).',
      'Offense executes 4-Verticals or Post-Wheel route combination.',
      'Free Safety plays 60/40 towards the passing strength / QB\'s eyes while capping the inner seam.',
      'Outside corner stays on top of #1 until #1 breaks inside, squeezing the sideline window while overlapping towards the hash.',
      'Linebackers drop through hook/curl and curl/flat to take away the intermediate throw, allowing deep DBs to stay over the top.',
    ],
    equipment: 'Full field grid, football, offense 4-verts look, secondary unit.',
    diagramKeys: [
      { text: 'FS 60/40 Rule: favor QB eyes and passing strength', isHighlight: true },
      { text: 'Corners cap outside thirds—never let #1 get over top', isHighlight: true },
      { text: 'Overlap inner seams to squeeze 4-vertical windows', isHighlight: false },
      { text: 'Underneath LBs rally—DBs stay over the top', isHighlight: true },
    ],
    cues: [
      '"60/40 Rule: favor the QB\'s eyes and strength!"',
      '"Never let a route get behind you!"',
      '"Squeeze the seam, overlap the post!"',
      '"Underneath LBs rally—DBs stay over the top!"',
    ],
    faults: [
      'Corner biting on a short flat route and giving up an 80-yard touchdown over the top.',
      'Free Safety guessing instead of reading QB eyes and getting divided by 4-verts.',
      'Linebackers failing to get depth, forcing deep DBs to play short.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=zDSLf9HRKzU',
    phases: [
      {
        name: 'PHASE 1: 3-DEEP COVER 3 ALIGNMENT VS 4-VERTS',
        description: 'Corners in outside thirds, Free Safety in deep middle. Offense releases 4 vertical threats.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 L', x: 100, y: 200, color: '#b91c1c' },
          { id: 'wr-2', type: 'O', label: '#2 L', x: 220, y: 200, color: '#b91c1c' },
          { id: 'wr-3', type: 'O', label: '#2 R', x: 480, y: 200, color: '#b91c1c' },
          { id: 'wr-4', type: 'O', label: '#1 R', x: 600, y: 200, color: '#b91c1c' },
          { id: 'cb-l', type: 'X', label: 'LCB', x: 110, y: 280, color: '#7c3aed', subLabel: 'Deep 1/3 L' },
          { id: 'fs', type: 'X', label: 'FS', x: 350, y: 350, color: '#0284c7', subLabel: 'Deep Middle' },
          { id: 'cb-r', type: 'X', label: 'RCB', x: 590, y: 280, color: '#7c3aed', subLabel: 'Deep 1/3 R' },
          { id: 'lb-l', type: 'X', label: 'WLB', x: 230, y: 240, color: '#10b981', subLabel: 'Curl/Flat' },
          { id: 'lb-m', type: 'X', label: 'MLB', x: 350, y: 240, color: '#10b981', subLabel: 'Hook' },
          { id: 'lb-r', type: 'X', label: 'SLB', x: 470, y: 240, color: '#10b981', subLabel: 'Curl/Flat' },
        ],
        arrows: [
          { id: 'a-w1', type: 'pass', startX: 100, startY: 200, endX: 100, endY: 380, color: '#b91c1c', label: 'Vertical' },
          { id: 'a-w2', type: 'pass', startX: 220, startY: 200, endX: 230, endY: 380, color: '#b91c1c', label: 'Seam' },
          { id: 'a-w3', type: 'pass', startX: 480, startY: 200, endX: 470, endY: 380, color: '#b91c1c', label: 'Seam' },
          { id: 'a-w4', type: 'pass', startX: 600, startY: 200, endX: 600, endY: 380, color: '#b91c1c', label: 'Vertical' },
          { id: 'a-cbl-drop', type: 'drop', startX: 110, startY: 280, endX: 110, endY: 410, color: '#7c3aed', dashed: true },
          { id: 'a-fs-drop', type: 'drop', startX: 350, startY: 350, endX: 330, endY: 430, color: '#0284c7', dashed: true, label: '60/40 Read' },
          { id: 'a-cbr-drop', type: 'drop', startX: 590, startY: 280, endX: 590, endY: 410, color: '#7c3aed', dashed: true },
        ],
        zones: [
          { id: 'z-3deep', name: '3-DEEP ZONE SHELL', cx: 350, cy: 410, rx: 280, ry: 45, color: '#0284c7', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 2: 60/40 OVERLAP & SQUEEZING THE WINDOW',
        description: 'Free Safety overlaps to the throwing side seam, Corner stays over the boundary fade, and LBs re-route underneath.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-2', type: 'O', label: '#2 L', x: 230, y: 390, color: '#b91c1c' },
          { id: 'fs', type: 'X', label: 'FS', x: 270, y: 430, color: '#0284c7', subLabel: '60/40 Overlap' },
          { id: 'cb-l', type: 'X', label: 'LCB', x: 115, y: 420, color: '#7c3aed', subLabel: 'Capped' },
          { id: 'wr-1', type: 'O', label: '#1 L', x: 100, y: 390, color: '#b91c1c' },
        ],
        arrows: [
          { id: 'a-fs-break', type: 'run', startX: 350, startY: 350, endX: 270, endY: 430, color: '#0284c7', label: 'Drive on Seam' },
          { id: 'a-seam-throw', type: 'pass', startX: 350, startY: 150, endX: 250, endY: 410, color: '#f59e0b', dashed: true, label: 'Contested Seam Throw' },
        ],
        zones: [
          { id: 'z-squeeze', name: 'SEAM SQUEEZE & INT ZONE', cx: 250, cy: 415, rx: 70, ry: 35, color: '#0284c7', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'c3-tandem-olb-db-halfline',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'OLB & DB: Cover 3 Tandem Half-Line Pass Shell',
    subtitle: '2-on-2 & 3-on-2 Perimeter Zone: Smash, Flood, & Seam-Wheel Communication',
    objective: 'Train Outside Linebackers (Curl/Flat) and Cornerbacks (Deep 1/3) to work in complete synchrony against 2-receiver pass concepts (Smash, Flood/Sail, Curl-Flat, Post-Wheel). Drill vocal hand-offs ("Under!", "Buzz!"), route collisions on #2, and high-low bracket leverage so neither defender gets isolated or split.',
    setup: 'Half-line grid (hash to sideline). QB takes 3-step or 5-step drop. Offense lines up with #1 outside receiver (numbers) and #2 slot/TE (hash). Defense lines up with 1 OLB/Apex (4 yards off inside #2) and 1 CB (7 yards off #1 in bail alignment). Optional: Free Safety capping deep hash.',
    instructions: [
      'Pre-snap: CB aligns in 7-yard inside-leverage bail; OLB aligns 4 yards off inside shade of #2.',
      'On snap: OLB delivers a 2-hand collision on #2 at 5 yards, disrupting the timing of his vertical/corner release.',
      'If Smash (Hitch/Corner): OLB yells "Under!" and buzzes down on the hitch; CB stays over top of #2\'s corner route.',
      'If Flood / Sail: CB bails to deep 1/3 over #1\'s go route; OLB drops to 12-yard intermediate out, driving on flat if thrown.',
      'If Seam-Wheel / Verts: OLB walls #2 up to 10 yards, yells "Go-Go-Go!" or "Under!", handing #2 off to CB/Safety while sinking under the throw.',
      'On throw: both defenders rally to the ball with inside-out and outside-in vice pursuit.',
    ],
    equipment: '4 cones (perimeter half-line grid), 1 football, QB/Coach, 2 Receivers, 1 OLB, 1 CB.',
    diagramKeys: [
      { text: 'OLB collision #2 at 5 yards', isHighlight: true },
      { text: 'CB stays 2 yards deeper than deepest route', isHighlight: true },
      { text: 'Vocal communication: "Under!" vs "Stay Top!"', isHighlight: true },
      { text: 'High-low bracket on intermediate throw', isHighlight: false },
    ],
    cues: [
      '"Talk on the release: \'Under-Under!\' or \'Buzz!\'"',
      '"OLB: Collision #2, sneak a peek to #1!"',
      '"CB: Stay on top—make everything throw underneath!"',
      '"High-Low Bracket the window!"',
    ],
    faults: [
      'Silent defense: neither player communicating the route distribution.',
      'Both defenders biting on the underneath route, allowing a wide-open touchdown over the top.',
      'OLB not getting hands on #2, giving up a clean vertical release.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=nVwuQWHCvTo',
    phases: [
      {
        name: 'PHASE 1: PRE-SNAP ALIGNMENT & ROUTE RELEASE',
        description: 'CB in 7-yd bail alignment, OLB in 4-yd apex. Offense stems vertical. OLB delivers 2-hand jam on #2 at 5 yards.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 200, color: '#b91c1c', subLabel: 'Numbers' },
          { id: 'wr-2', type: 'O', label: '#2 SLOT', x: 230, y: 200, color: '#b91c1c', subLabel: 'Slot / TE' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 130, y: 270, color: '#7c3aed', subLabel: 'Deep 1/3 Bail' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 230, y: 240, color: '#10b981', subLabel: 'Apex / Jam #2' },
        ],
        arrows: [
          { id: 'a-wr1-stem', type: 'pass', startX: 120, startY: 200, endX: 120, endY: 260, color: '#b91c1c', label: 'Vertical Stem' },
          { id: 'a-wr2-stem', type: 'pass', startX: 230, startY: 200, endX: 230, endY: 245, color: '#b91c1c', label: 'Vertical Stem' },
          { id: 'a-olb-jam', type: 'block', startX: 230, startY: 240, endX: 230, endY: 245, color: '#10b981', label: '2-Hand Jam' },
          { id: 'a-cb-bail', type: 'drop', startX: 130, startY: 270, endX: 130, endY: 370, color: '#7c3aed', dashed: true, label: '3-Step Bail' },
        ],
        zones: [
          { id: 'z-jam', name: '5-YD COLLISION ZONE', cx: 230, cy: 245, rx: 35, ry: 25, color: '#10b981', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: ROUTE DISTRIBUTION & HIGH-LOW BRACKET',
        description: 'On Smash/Flood break: OLB calls "Under!" and buzzes flat; CB stays over top of #2 corner route, creating a 2-level bracket.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'wr-1', type: 'O', label: '#1 WR', x: 120, y: 250, color: '#b91c1c', subLabel: 'Hitch / Flat' },
          { id: 'wr-2', type: 'O', label: '#2 SLOT', x: 180, y: 350, color: '#b91c1c', subLabel: 'Corner Break' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 135, y: 260, color: '#10b981', subLabel: 'Buzz "Under!"' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 165, y: 390, color: '#7c3aed', subLabel: 'Over Top' },
        ],
        arrows: [
          { id: 'a-wr1-hitch', type: 'pass', startX: 120, startY: 260, endX: 120, endY: 250, color: '#b91c1c' },
          { id: 'a-wr2-corner', type: 'pass', startX: 230, startY: 245, endX: 180, endY: 350, color: '#b91c1c', label: 'Corner Stem' },
          { id: 'a-olb-buzz', type: 'run', startX: 230, startY: 240, endX: 135, endY: 260, color: '#10b981', label: 'Drive on Flat' },
          { id: 'a-cb-bracket', type: 'run', startX: 130, startY: 370, endX: 165, endY: 390, color: '#7c3aed', label: 'Cap Corner' },
        ],
        zones: [
          { id: 'z-bracket', name: 'HIGH-LOW BRACKET ZONE', cx: 150, cy: 320, rx: 75, ry: 90, color: '#0284c7', opacity: 0.15 },
        ],
      },
      {
        name: 'PHASE 3: RALLY TO BALL & VICE TACKLE',
        description: 'As ball is thrown to either receiver, OLB (inside-out) and CB (outside-in) close simultaneously to vice the catch.',
        tokens: [
          { id: 'wr-target', type: 'O', label: 'CATCH', x: 130, y: 270, color: '#b91c1c', subLabel: 'Target' },
          { id: 'olb-1', type: 'X', label: 'OLB', x: 165, y: 275, color: '#10b981', subLabel: 'Inside Hip' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 110, y: 295, color: '#7c3aed', subLabel: 'Outside Contain' },
        ],
        arrows: [
          { id: 'a-olb-vice', type: 'straight', startX: 200, startY: 290, endX: 165, endY: 275, color: '#10b981', label: 'Pin Inside Hip' },
          { id: 'a-cb-vice', type: 'straight', startX: 130, startY: 370, endX: 110, endY: 295, color: '#7c3aed', label: 'Top-Down Vice' },
        ],
        zones: [
          { id: 'z-vice-finish', name: 'TANDEM VICE TACKLE', cx: 135, cy: 280, rx: 55, ry: 35, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },

  // ==========================================
  // DT & ILB GAP CROSS / STUNT PROGRESSIONS (3 DRILLS)
  // ==========================================
  {
    id: 'stunt-dt-ilb-butt-to-hip',
    category: 'DL',
    categoryLabel: 'Defensive Line & Linebackers (Stunts)',
    title: 'DT & ILB: Two-Man "Butt-to-Hip" Fit Drill',
    subtitle: 'Stunt Timing on Air: Penetrator Slant & Tight Rub Looper',
    objective: 'Establish the fundamental timing, tight angle, and trajectory of the DT/ILB A/B gap cross stunt on air before live blockers. The DT penetrates across the guard\'s face into the adjacent gap while the ILB takes a 1-step read, scrapes horizontally with zero separation ("butt-to-hip"), and explodes vertically into the vacated gap.',
    setup: 'Place DT in 2i or 3-technique alignment and stack ILB 4 yards deep in normal alignment. Place a target cone in the stunt gap.',
    instructions: [
      'The Penetrator (DT): On the whistle, take a violent vertical first step before slanting hard across the face of the imaginary guard into the adjacent gap, aiming to pin the lineman.',
      'The Looper (ILB): Take one control/read step forward, push off outside foot to scrape horizontally, and loop tightly off the rear end of the DT with zero separation ("rub shoulders").',
      'Explode vertically through the vacated gap without bellying out or looping too deep.',
      'Finish with eyes up tracking the ball carrier in the backfield.',
    ],
    equipment: '1 target cone, 1 football, whistle.',
    diagramKeys: [
      { text: 'DT: 1st step vertical, slant hard across guard face', isHighlight: true },
      { text: 'ILB: 1 read step, scrape tight "butt-to-hip"', isHighlight: true },
      { text: 'Zero daylight between DT rear and ILB loop', isHighlight: true },
      { text: 'Explode vertically through vacated gap', isHighlight: false },
    ],
    cues: [
      '"Rub shoulders—butt-to-hip!"',
      '"No daylight between DT and ILB!"',
      '"DT pins the guard!"',
      '"ILB: 1 step, scrape, and fire vertical!"',
    ],
    faults: [
      'ILB bellying out 4 yards deep, giving the offensive line time to recover and pick up the stunt.',
      'DT slanting too flat and tripping or colliding awkwardly with the ILB.',
      'Defenders tipping the stunt with pre-snap leaning or altered stances.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=9YRRKYGAC_0',
    phases: [
      {
        name: 'PHASE 1: PENETRATOR SLANT & LOOPER SCRAPE',
        description: 'DT fires vertical step and slants into B-gap. ILB takes 1 read step and scrapes tight off DT rear hip.',
        tokens: [
          { id: 'g-dummy', type: 'bag', label: 'GUARD', x: 300, y: 200, color: '#b91c1c' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 280, y: 240, color: '#4338ca', subLabel: 'Penetrator' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 320, y: 340, color: '#10b981', subLabel: 'Looper' },
          { id: 'cone-target', type: 'cone', label: 'A-GAP', x: 350, y: 190, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-dt-slant', type: 'blitz', startX: 280, startY: 240, endX: 250, endY: 190, color: '#4338ca', label: 'Slant across Face' },
          { id: 'a-ilb-step', type: 'drop', startX: 320, startY: 340, endX: 310, endY: 300, color: '#10b981', dashed: true, label: '1-Step Read' },
        ],
        zones: [
          { id: 'z-rub', name: 'BUTT-TO-HIP RUB POINT', cx: 290, cy: 235, rx: 35, ry: 25, color: '#10b981', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 2: TIGHT RUB & VERTICAL EXPLOSION',
        description: 'ILB rubs shoulders with DT rear, clears the edge, and explodes vertically through the target A-gap.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 250, y: 190, color: '#4338ca', subLabel: 'Pinned Guard' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 350, y: 190, color: '#10b981', subLabel: 'Vertical Burst' },
          { id: 'qb-target', type: 'O', label: 'QB', x: 350, y: 130, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-ilb-loop', type: 'blitz', startX: 310, startY: 300, endX: 350, endY: 190, color: '#10b981', label: 'Tight Butt-to-Hip Loop' },
          { id: 'a-ilb-sack', type: 'run', startX: 350, startY: 190, endX: 350, endY: 130, color: '#10b981', label: 'Burst to QB' },
        ],
        zones: [
          { id: 'z-gap', name: 'VACATED GAP ATTACK', cx: 350, cy: 190, rx: 40, ry: 30, color: '#10b981', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'stunt-agile-bag-dip-rip-loop',
    category: 'DL',
    categoryLabel: 'Defensive Line & Linebackers (Stunts)',
    title: 'DT & ILB: Agile Bag "Dip, Rip, & Loop" Drill',
    subtitle: 'Low Pad Level, Lateral Crossover & Upper-Body Rip ("Elbow to Ear-Hole")',
    objective: 'Build physical tools for clearing blocks at a low pad level. DT executes a violent dip-and-rip past the first agile bag to defeat a down block, while the ILB plants on the 3rd step, crosses over around the second bag, and executes an upper-body rip ("elbow to ear-hole") to flip hips through the gap.',
    setup: 'Lay two agile step-over bags flat on the ground sideways (3 yards apart) simulating offensive linemen\'s feet. DT and ILB align in stunt depth.',
    instructions: [
      'DT fires out with low hips, executes a hard "dip and rip" past the first bag, and anchors the gap.',
      'ILB takes read step, plants on 3rd step, and executes a lateral crossover around the second bag.',
      'As the ILB turns the corner, throw a violent upper-body rip ("elbow to ear-hole") to flip hips vertically through the hole.',
      'Keep weight centered without leaning pre-snap; maintain low pad level throughout lateral movement.',
    ],
    equipment: '2 agile step-over bags, football, whistle.',
    diagramKeys: [
      { text: 'DT: Dip and rip past 1st bag with low pad level', isHighlight: true },
      { text: 'ILB: Plant on step 3, lateral crossover around 2nd bag', isHighlight: true },
      { text: 'Elbow-to-ear-hole upper body rip', isHighlight: true },
      { text: 'Flip hips vertically to accelerate into backfield', isHighlight: false },
    ],
    cues: [
      '"Elbow to ear-hole rip!"',
      '"Low hips over the bags!"',
      '"Plant on 3, crossover, and turn corner!"',
      '"Flip the hips through the hole!"',
    ],
    faults: [
      'Standing tall through the loop and getting washed out by contact.',
      'Rounding off the bag instead of sticking a sharp plant-and-turn.',
      'Leaning forward pre-snap and giving away the stunt direction.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=zrSCoJXVX5I',
    phases: [
      {
        name: 'PHASE 1: DIP & RIP PAST FIRST AGILE BAG',
        description: 'DT explodes low, dipping outside shoulder and ripping past first bag. ILB initiates crossover stride.',
        tokens: [
          { id: 'bag-1', type: 'bag', label: 'AGILE 1', x: 270, y: 220, color: '#f59e0b' },
          { id: 'bag-2', type: 'bag', label: 'AGILE 2', x: 370, y: 220, color: '#f59e0b' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 270, y: 280, color: '#4338ca', subLabel: 'Dip & Rip' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 340, y: 350, color: '#10b981', subLabel: 'Plant on 3' },
        ],
        arrows: [
          { id: 'a-dt-rip', type: 'blitz', startX: 270, startY: 280, endX: 240, endY: 200, color: '#4338ca', label: 'Dip & Rip' },
          { id: 'a-ilb-cross', type: 'drop', startX: 340, startY: 350, endX: 300, endY: 300, color: '#10b981', dashed: true, label: 'Lateral Crossover' },
        ],
        zones: [
          { id: 'z-dip', name: 'LOW PAD LEVEL ZONE', cx: 270, cy: 220, rx: 45, ry: 25, color: '#4338ca', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: ELBOW-TO-EAR RIP & VERTICAL CORNER',
        description: 'ILB rips elbow to ear-hole around second bag, flips hips square, and drives into backfield.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 240, y: 200, color: '#4338ca', subLabel: 'Anchored' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 370, y: 190, color: '#10b981', subLabel: 'Elbow to Ear' },
        ],
        arrows: [
          { id: 'a-ilb-rip', type: 'blitz', startX: 300, startY: 300, endX: 370, endY: 190, color: '#10b981', label: 'Upper Body Rip' },
          { id: 'a-ilb-finish', type: 'run', startX: 370, startY: 190, endX: 370, endY: 140, color: '#10b981', label: 'Finish Vertical' },
        ],
        zones: [
          { id: 'z-rip', name: 'HIP FLIP & RIP ZONE', cx: 370, cy: 200, rx: 40, ry: 30, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'stunt-halfline-live-read',
    category: 'SCHEME',
    categoryLabel: 'Team Defense & Stunts',
    title: 'DT & ILB: Half-Line Live Block Recognition Drill',
    subtitle: 'Fight a Face vs. Chase a Tail: Reading Shifting Offensive Line Fronts',
    objective: 'Execute the called stunt against live offensive line blocks (Center & Guard or Guard & Tackle). DT diagnoses "Fight a Face" (hold ground, draw double-team) vs. "Chase a Tail" (chase flat on zone/down blocks), while the wrapping ILB reads the guard\'s hat to take the green-light gap or execute a ricochet move.',
    setup: 'Live Center, Guard, and QB/RB in backfield. DT in 3-tech, ILB stacked at 4.5 yards.',
    instructions: [
      'Fight a Face: If lineman blocks directly into penetrator\'s path, DT aggressively punches, holds ground, and occupies both blockers to keep ILB clean.',
      'Chase a Tail: If lineman blocks away (zone or down-block), DT closes flat down the line of scrimmage, tracking the hip of the blocker.',
      'The Wrapper\'s Cue (ILB): If Guard sticks to DT, ILB has green light straight through the gap. If Guard peels off to block the loop, ILB executes a ricochet or arm-over move to beat the block.',
      'Maintain gap integrity: if run hits before the twist unfolds, abort stunt and tackle nearest threat.',
    ],
    equipment: 'Full pads / helmets, 1 football, live Center, Guard, QB, DT, ILB.',
    diagramKeys: [
      { text: 'Fight a Face: DT punches & holds ground vs double team', isHighlight: true },
      { text: 'Chase a Tail: DT closes flat tracking blocker hip', isHighlight: true },
      { text: 'ILB Green Light: Guard sticks to DT -> shoot gap', isHighlight: true },
      { text: 'ILB Ricochet: Guard peels -> arm-over move', isHighlight: false },
    ],
    cues: [
      '"Fight a Face = occupy double-team!"',
      '"Chase a Tail = close down flat!"',
      '"ILB: Green light if guard commits to DT!"',
      '"Eyes up—never drop your head!"',
    ],
    faults: [
      'DT getting washed downfield by double-team instead of dropping anchor.',
      'ILB running into the back of his own DT.',
      'Dropping head and running blind past a cutback runner.',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=574syXWjiZc',
    phases: [
      {
        name: 'PHASE 1: LIVE SNAP & BLOCK DIAGNOSIS',
        description: 'Center and Guard execute block scheme. DT diagnoses block direction (Face vs. Tail) while ILB takes read step.',
        tokens: [
          { id: 'o-c', type: 'O', label: 'C', x: 350, y: 200, color: '#b91c1c' },
          { id: 'o-g', type: 'O', label: 'RG', x: 420, y: 200, color: '#b91c1c' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
          { id: 'dt-1', type: 'X', label: 'DT', x: 400, y: 250, color: '#4338ca', subLabel: 'Read Block' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 360, y: 330, color: '#10b981', subLabel: 'Read Guard' },
        ],
        arrows: [
          { id: 'a-g-block', type: 'block', startX: 420, startY: 200, endX: 400, endY: 240, color: '#b91c1c', label: 'Guard Blocks DT' },
          { id: 'a-dt-hold', type: 'blitz', startX: 400, startY: 250, endX: 390, endY: 210, color: '#4338ca', label: 'Fight Face / Anchor' },
          { id: 'a-ilb-read', type: 'drop', startX: 360, startY: 330, endX: 370, endY: 280, color: '#10b981', dashed: true, label: 'Read Guard Hat' },
        ],
        zones: [
          { id: 'z-los', name: 'LINE OF SCRIMMAGE READ ZONE', cx: 385, cy: 215, rx: 75, ry: 30, color: '#4338ca', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: GREEN-LIGHT GAP PENETRATION & SACK',
        description: 'Guard is pinned to DT. ILB gets green-light signal, looping cleanly through A-gap to record the TFL / sack.',
        tokens: [
          { id: 'dt-1', type: 'X', label: 'DT', x: 390, y: 210, color: '#4338ca', subLabel: 'Holding 2 Blocks' },
          { id: 'ilb-1', type: 'X', label: 'ILB', x: 350, y: 160, color: '#10b981', subLabel: 'Green Light Sack' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 150, color: '#1a1a24' },
        ],
        arrows: [
          { id: 'a-ilb-shoot', type: 'blitz', startX: 370, startY: 280, endX: 350, endY: 160, color: '#10b981', label: 'A-Gap Green Light' },
        ],
        zones: [
          { id: 'z-sack', name: 'TFL / SACK FINISH ZONE', cx: 350, cy: 155, rx: 45, ry: 25, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'dl-edge-setting-10u',
    category: 'DEFENSE',
    categoryLabel: 'Defensive Line & Edge Setting',
    title: '10U Setting the Edge Drill ("The Dirty Work")',
    subtitle: 'DE / OLB Edge Containment, Strike-and-Shed & Outside Leverage vs Sweeps/Tosses',
    objective: 'Teaches 10U defensive ends and outside edge defenders how to set a hard perimeter edge against sweeps, tosses, and outside runs (Coach Dub @coachdub11_). Focuses on explosive first-step outside leverage, violent inside-hand punch, keeping the outside arm free, and squeezing the ball carrier back into pursuit.',
    setup: '1 DE in 5/7-tech stance, 1 Blocker (OT/TE with hand shield or live), 1 Ball Carrier (RB), 4 cones marking 10x10 yd perimeter box.',
    instructions: [
      'Explosive Outside Foot Step: On ball movement, fire out with the outside foot to establish perimeter leverage.',
      'Violent Inside Strike: Punch blocker\'s chest/inside armpit with the inside hand to stop their forward momentum.',
      'Keep Outside Clean: Keep outside arm and leg completely free—never let the blocker hook or seal you outside.',
      'Squeeze & Spill: Squeeze the running lane towards the line of scrimmage without running too far upfield.',
      'Finish Near-Foot Near-Shoulder: Sink hips, clamp the near hip, and drive through contact into the tackle.',
    ],
    equipment: 'Full pads / helmets, 1 football, hand shield / agile dummy, 4 cones (10x10 yd box), 1 DE, 1 Blocker (OT/TE), 1 Ball Carrier (RB).',
    diagramKeys: [
      { text: 'Outside Leverage Step: Fire outside foot forward-lateral', isHighlight: true },
      { text: 'Inside Hand Punch: Strike inside armpit, lock out', isHighlight: true },
      { text: 'Outside Free Arm: Never get hooked or sealed', isHighlight: true },
      { text: 'Force & Squeeze: Turn runner inside into pursuit', isHighlight: false },
    ],
    cues: [
      '"Learn the dirty work early!"',
      '"Never get hooked—keep outside clean!"',
      '"Punch inside, rip outside!"',
      '"Force it back inside!"',
    ],
    faults: [
      'Rushing too far upfield past the QB/RB, leaving a massive inside running lane.',
      'Allowing the offensive tackle/tight end to get hands on the outside shoulder and hook the edge.',
      'Diving head-first without squaring hips and sinking into the tackle.',
    ],
    videoUrl: 'https://www.instagram.com/reel/DeHVNW4uaGK/',
    phases: [
      {
        name: 'PHASE 1: STRIKE, LOCK-OUT & KEEP OUTSIDE CLEAN',
        description: 'DE fires out on snap with outside foot, strikes blocker with inside hand punch to breastplate/armpit, and locks out with outside arm free.',
        tokens: [
          { id: 'o-ot', type: 'O', label: 'OT', x: 380, y: 220, color: '#b91c1c' },
          { id: 'o-rb', type: 'O', label: 'RB', x: 350, y: 160, color: '#b91c1c', subLabel: 'Stretch Flow' },
          { id: 'x-de', type: 'X', label: 'DE', x: 440, y: 240, color: '#4338ca', subLabel: 'Set Edge' },
          { id: 'c-edge', type: 'cone', label: 'C', x: 500, y: 220, color: '#f59e0b' },
        ],
        arrows: [
          { id: 'a-ot-reach', type: 'block', startX: 380, startY: 220, endX: 430, endY: 235, color: '#b91c1c', label: 'Reach Block' },
          { id: 'a-de-strike', type: 'blitz', startX: 440, startY: 240, endX: 425, endY: 225, color: '#4338ca', label: 'Punch & Lock Inside Arm' },
          { id: 'a-rb-sweep', type: 'run', startX: 350, startY: 160, endX: 430, endY: 190, color: '#b91c1c', label: 'Outside Bounce' },
        ],
        zones: [
          { id: 'z-edge-wall', name: 'HARD PERIMETER EDGE ZONE', cx: 460, cy: 220, rx: 55, ry: 35, color: '#4338ca', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 2: SHED, FORCE INSIDE & NEAR-HIP TACKLE',
        description: 'DE rips outside arm free, sets hard boundary wall, forces RB to hesitate/cutback, and clamps near hip with driving feet.',
        tokens: [
          { id: 'o-ot-shed', type: 'O', label: 'OT', x: 400, y: 230, color: '#b91c1c', subLabel: 'Shed' },
          { id: 'x-de-tackle', type: 'X', label: 'DE', x: 435, y: 205, color: '#4338ca', subLabel: 'Near-Hip Wrap' },
          { id: 'o-rb-forced', type: 'O', label: 'RB', x: 425, y: 200, color: '#b91c1c', subLabel: 'Cut Inside' },
          { id: 'x-pursuit', type: 'X', label: 'LB', x: 380, y: 260, color: '#10b981', subLabel: 'Inside Pursuit' },
        ],
        arrows: [
          { id: 'a-de-shed', type: 'blitz', startX: 425, startY: 225, endX: 435, endY: 205, color: '#4338ca', label: 'Rip & Disengage' },
          { id: 'a-rb-turn', type: 'run', startX: 430, startY: 190, endX: 415, endY: 215, color: '#b91c1c', label: 'Forced Inside' },
          { id: 'a-lb-close', type: 'drop', startX: 380, startY: 260, endX: 415, endY: 215, color: '#10b981', dashed: true, label: 'Vice Pursuit' },
        ],
        zones: [
          { id: 'z-tackle-box', name: 'VICE TACKLE COLLAPSE', cx: 425, cy: 210, rx: 45, ry: 30, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'lb-redirect-tackle-tjneal',
    category: 'DEFENSE',
    categoryLabel: 'Linebackers & Tackling',
    title: 'LB / Defender: Redirection & Clean-Foot Tackle Drill (TJ Neal)',
    subtitle: 'Stay Square, Clean Feet, Plant-and-Redirect vs Sudden Cutback & Near-Hip Finish',
    objective: 'Teaches linebackers and secondary defenders how to maintain square shoulders, keep clean feet without crossing cleats, and rapidly plant and redirect downhill against sudden cutbacks to finish a wrap tackle (Coach Tyrone "TJ" Neal).',
    setup: '3 agile step-over bags or cones spaced 2 yards apart. 1 Defender (LB/DB), 1 Ball Carrier (or Coach mirroring), 1 finish tackle dummy or live partner.',
    instructions: [
      'Clean Feet Shuffle: Defender mirrors ball carrier lateral flow with low, rhythmic, non-crossing shuffle steps with nose over toes.',
      'Stay Square to LOS: Keep shoulders and chest parallel to the line of scrimmage; never turn hips 90 degrees.',
      'The Plant & Redirect: When ball carrier hard-plants against the grain, stick the outside cleat firmly in the turf to arrest lateral momentum.',
      'Downhill 45° Drive: Fire downhill through the runner\'s inside hip crease, lowering pad level.',
      'Near-Foot Near-Shoulder Finish: Step aggressively with the near foot right before contact, strike through near hip, clamp arms, and churn feet.',
    ],
    equipment: '3 agile step-over bags or cones, 1 football, full pads / helmets, 1 Defender, 1 Ball Carrier / Coach.',
    diagramKeys: [
      { text: 'Clean Feet Scrape: Short square shuffles over bags', isHighlight: true },
      { text: 'Plant & Redirect: Outside cleat in ground, arrest flow', isHighlight: true },
      { text: 'Downhill 45° Angle: Drive through runner inside hip', isHighlight: true },
      { text: 'Near-Hip Finish: Near foot strike & wrap tackle', isHighlight: false },
    ],
    cues: [
      '"Clean feet, good leverage!"',
      '"Stay square—don\'t turn your hips!"',
      '"Plant the outside cleat and explode downhill!"',
      '"Near foot, near shoulder, finish the tackle!"',
    ],
    faults: [
      'Crossing feet while shuffling laterally (leaves defender stuck on cutbacks).',
      'Turning hips 90 degrees sideways to run with the ball carrier.',
      'Lunging with upper body and dropping eyes before contact.',
    ],
    videoUrl: 'https://www.facebook.com/reel/1855703092464454',
    phases: [
      {
        name: 'PHASE 1: CLEAN FEET LATERAL SCRAPE OVER BAGS',
        description: 'Ball carrier slides laterally. Defender shuffles with square shoulders and rapid, non-crossing feet over 3 agile bags.',
        tokens: [
          { id: 'o-rb-slide', type: 'O', label: 'RB', x: 320, y: 170, color: '#b91c1c', subLabel: 'Lateral Flow' },
          { id: 'c-bag1', type: 'cone', label: 'B1', x: 300, y: 220, color: '#f59e0b' },
          { id: 'c-bag2', type: 'cone', label: 'B2', x: 360, y: 220, color: '#f59e0b' },
          { id: 'c-bag3', type: 'cone', label: 'B3', x: 420, y: 220, color: '#f59e0b' },
          { id: 'x-lb-scrape', type: 'X', label: 'LB', x: 320, y: 270, color: '#10b981', subLabel: 'Clean Feet' },
        ],
        arrows: [
          { id: 'a-rb-flow', type: 'run', startX: 320, startY: 170, endX: 420, endY: 170, color: '#b91c1c', label: 'Stretch Flow' },
          { id: 'a-lb-scrape', type: 'drop', startX: 320, startY: 270, endX: 420, endY: 270, color: '#10b981', dashed: true, label: 'Square Shuffle' },
        ],
        zones: [
          { id: 'z-scrape', name: 'SQUARE SHUFFLE TRACK', cx: 370, cy: 245, rx: 75, ry: 35, color: '#10b981', opacity: 0.18 },
        ],
      },
      {
        name: 'PHASE 2: SUDDEN CUTBACK PLANT & REDIRECT',
        description: 'RB plants outside foot and cuts back hard against the grain. LB plants outside cleat, sinks hips, and redirects instantly.',
        tokens: [
          { id: 'o-rb-cut', type: 'O', label: 'RB', x: 420, y: 170, color: '#b91c1c', subLabel: 'Hard Plant Cutback' },
          { id: 'x-lb-plant', type: 'X', label: 'LB', x: 420, y: 270, color: '#10b981', subLabel: 'Plant Cleat & Redirect' },
        ],
        arrows: [
          { id: 'a-rb-cutback', type: 'run', startX: 420, startY: 170, endX: 350, endY: 220, color: '#b91c1c', label: 'Inside Cutback' },
          { id: 'a-lb-drive', type: 'blitz', startX: 420, startY: 270, endX: 355, endY: 225, color: '#10b981', label: '45° Downhill Trigger' },
        ],
        zones: [
          { id: 'z-redirect', name: 'REDIRECTION ZONE', cx: 385, cy: 220, rx: 55, ry: 30, color: '#f59e0b', opacity: 0.22 },
        ],
      },
      {
        name: 'PHASE 3: DOWNHILL NEAR-HIP TACKLE FINISH',
        description: 'LB closes on RB inside hip, drives near foot through contact, strikes with near shoulder, and wraps for the tackle.',
        tokens: [
          { id: 'o-rb-finish', type: 'O', label: 'RB', x: 350, y: 220, color: '#b91c1c' },
          { id: 'x-lb-finish', type: 'X', label: 'LB', x: 355, y: 225, color: '#10b981', subLabel: 'Near-Hip Wrap & Churn' },
        ],
        arrows: [
          { id: 'a-tackle-drive', type: 'blitz', startX: 355, startY: 225, endX: 350, endY: 190, color: '#10b981', label: 'Drive Feet 5 Yards' },
        ],
        zones: [
          { id: 'z-finish', name: 'NEAR-HIP TACKLE FINISH', cx: 352, cy: 210, rx: 40, ry: 25, color: '#10b981', opacity: 0.28 },
        ],
      },
    ],
  },
];

