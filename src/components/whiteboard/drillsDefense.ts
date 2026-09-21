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
          { id: 'nt-1', type: 'X', label: 'NT', x: 320, y: 190, color: '#4338ca', subLabel: 'Shed & Tackle' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 315, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-shed', type: 'tackle', startX: 350, startY: 220, endX: 320, endY: 190, color: '#10b981', label: 'Shed Left A' },
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
          { id: 'lb-1', type: 'X', label: 'MLB', x: 420, y: 210, color: '#058538', subLabel: 'Clean Up' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 430, y: 200, color: '#d91b24', subLabel: 'Bounced Wide' },
        ],
        arrows: [
          { id: 'a-bounce', type: 'run', startX: 345, startY: 180, endX: 430, endY: 200, color: '#d91b24', label: 'Bounce' },
          { id: 'a-tkl', type: 'tackle', startX: 420, startY: 250, endX: 430, endY: 200, color: '#058538', label: 'Vice Tackle' },
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
          { id: 'lb-1', type: 'X', label: 'MIKE', x: 415, y: 230, color: '#10b981', subLabel: 'Form Fit' },
        ],
        arrows: [
          { id: 'a-hit', type: 'tackle', startX: 400, startY: 260, endX: 430, endY: 220, color: '#10b981', label: 'Strike Downhill' },
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
          { id: 'lb-1', type: 'X', label: 'ILB', x: 340, y: 190, color: '#10b981', subLabel: 'Shed & Wrap' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 340, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-shed', type: 'tackle', startX: 350, startY: 225, endX: 340, endY: 185, color: '#10b981', label: 'Shed to Runner' },
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
          { id: 'a-rb-spilled', type: 'run', startX: 250, startY: 180, endX: 170, endY: 215, color: '#d91b24', label: 'Forced Wide Outside' },
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
          { id: 'lb-tackle', type: 'X', label: 'MIKE', x: 180, y: 245, color: '#10b981', subLabel: 'Form Fit' },
        ],
        arrows: [
          { id: 'a-disengage', type: 'run', startX: 240, startY: 260, endX: 190, endY: 250, color: '#10b981', label: 'Disengage & Trigger' },
          { id: 'a-finish-tackle', type: 'tackle', startX: 180, startY: 245, endX: 170, endY: 235, color: '#10b981', label: 'Wrap & Drive Feet' },
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
];
