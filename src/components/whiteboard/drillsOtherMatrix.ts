import { WhiteboardDrill } from "./whiteboardDrillData";

export const OTHER_MATRIX_DRILLS: WhiteboardDrill[] = [
{
    id: 'matrix-tackle-formfit',
    category: 'TACKLE',
    categoryLabel: 'Tackling Fundamentals',
    title: 'TACKLING: FORM FIT & DRIVE (THUD)',
    subtitle: 'Near-Foot Strike, Double Uppercuts & Eyes to the Sky',
    objective: 'Ingrain head-up form tackle mechanics: strike with near foot, explode hips with double uppercuts into chest plate, wrap and squeeze.',
    setup: 'Players pair up in 2 single-file lines facing each other 3 yards apart. Mat or soft turf surface.',
    instructions: [
      'On command "FIT", tackler steps near foot between runner thighs.',
      'Shoot hips forward with violent double uppercuts through runner chest plate.',
      'Head is up and across the chest—eyes focused on sky/ceiling, never looking down.',
      'Wrap arms tightly around runner lower back and lift with legs.'
    ],
    equipment: 'Whistle, 4 agility cones, optional step-over dummies or tackle dummies.',
    cues: ['Eyes up, head out of the tackle', 'Near foot, near hip', 'Double uppercut strike', 'Squeeze the wrap'],
    faults: ['Dropping head (severe safety hazard - blow whistle immediately)', 'Lunging with arms instead of stepping foot'],
    phases: [
      {
        name: 'PHASE 1: NEAR-FOOT STEP & HIP SINK',
        description: 'Tackler sinks hips and plants front cleat between runner thighs with chest upright.',
        tokens: [
          { id: 't-1', type: 'X', label: 'TKL', x: 350, y: 280, color: '#058538' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 350, y: 220, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-step', type: 'tackle', startX: 350, startY: 280, endX: 350, endY: 235, color: '#058538', label: 'Near Foot Strike' },
        ],
        zones: [
          { id: 'z-strike', name: 'FIT POINT', cx: 350, cy: 230, rx: 25, ry: 20, color: '#10b981', opacity: 0.3 },
        ],
      },
      {
        name: 'PHASE 2: UPPERCUT PUNCH & WRAP',
        description: 'Tackler shoots arms up and through armpits, wraps back of jersey, and drives legs for 3 paces.',
        tokens: [
          { id: 't-1', type: 'X', label: 'TKL', x: 350, y: 215, color: '#058538', subLabel: 'Wrapped Up' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 350, y: 195, color: '#d91b24', subLabel: 'Secured' },
        ],
        arrows: [
          { id: 'a-drive', type: 'tackle', startX: 350, startY: 235, endX: 350, endY: 180, color: '#058538', label: 'Drive Legs' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-tackle-hawkroll',
    category: 'TACKLE',
    categoryLabel: 'Tackling Fundamentals',
    title: 'TACKLING: HAWK (RUGBY) ROLL TACKLE',
    subtitle: 'Near Shoulder to Near Hip, Squeeze & Alligator Roll',
    objective: 'Remove head impact by aiming near shoulder to the runner hip pocket, clamping arms around hamstrings, and rolling runner to turf.',
    setup: 'Place 1 landing mat or soft grass zone. Runner jogs at half speed along straight line. Tackler approaches from 45-degree angle.',
    instructions: [
      'Tackler tracks inside-out, focusing vision on runner near hip.',
      'Strike with near shoulder pad directly against runner thigh/hip pocket.',
      'Wrap both arms securely behind the knee bend and squeeze thighs together.',
      'Roll your body like an alligator over the runner to bring them down cleanly.'
    ],
    equipment: 'Landing mat / tackle donut, 4 boundary cones.',
    cues: ['Eyes on the hip', 'Shoulder punch, not helmet', 'Wrap the knees', 'Gator roll through contact'],
    faults: ['Reaching across runner body (causes arm tackles and horse collars)', 'Leading with helmet crown'],
    phases: [
      {
        name: 'PHASE 1: ANGLE PURSUIT & SHOULDER TARGET',
        description: 'Tackler tracks runner angle, sinking hips and loading near shoulder toward runner hip pad.',
        tokens: [
          { id: 't-1', type: 'X', label: 'TKL', x: 260, y: 270, color: '#058538' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 340, y: 220, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-track', type: 'tackle', startX: 260, startY: 270, endX: 320, endY: 225, color: '#058538', label: 'Inside-Out Angle' },
          { id: 'a-bc-run', type: 'run', startX: 340, startY: 220, endX: 340, endY: 160, color: '#d91b24', label: 'Runner Track' },
        ],
        zones: [
          { id: 'z-strike', name: 'HIP POCKET STRIKE', cx: 330, cy: 220, rx: 25, ry: 20, color: '#10b981', opacity: 0.35 },
        ],
      },
      {
        name: 'PHASE 2: CLAMP HAMSTRINGS & ROLL',
        description: 'Tackler shoulder impacts thigh, arms clamp behind knees, and body rolls with momentum to ground.',
        tokens: [
          { id: 't-1', type: 'X', label: 'TKL', x: 335, y: 195, color: '#058538', subLabel: 'Roll Down' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 345, y: 190, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-roll', type: 'tackle', startX: 320, startY: 225, endX: 340, endY: 180, color: '#058538', label: 'Alligator Roll' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-tackle-openfield',
    category: 'TACKLE',
    categoryLabel: 'Tackling Fundamentals',
    title: 'TACKLING: OPEN-FIELD ANGLE TACKLE (10x10 GRID)',
    subtitle: 'Leverage Discipline, Sideline as 12th Defender & Breakdown Shimmy',
    objective: 'Teach defenders in space to keep outside leverage, squeeze ballcarrier toward the sideline alley, and breakdown without lunging.',
    setup: 'Create a 10x10 yard square using 4 boundary cones. Ballcarrier starts at one corner; tackler starts at adjacent baseline cone.',
    instructions: [
      'On whistle, ballcarrier attempts to reach opposite sideline without being touched with 2 hands or tackled.',
      'Defender sprints on 45° angle, keeping outside shoulder leveraged to the boundary cone.',
      'Shimmy feet at 3 yards to absorb cuts. Do not dive early—force runner into sideline.'
    ],
    equipment: '4 orange cones, 1 football.',
    cues: ['Keep the sideline inside your pocket', 'Shimmy feet, low hips', 'Near-foot strike at boundary'],
    faults: ['Biting on inside cut and losing edge leverage', 'Diving at feet from 4 yards away'],
    phases: [
      {
        name: 'PHASE 1: LEVERAGE PURSUIT IN GRID',
        description: 'Defender attacks on cutoff angle, maintaining outside leverage to eliminate perimeter cut.',
        tokens: [
          { id: 'c-1', type: 'bag', label: 'CONE', x: 200, y: 300, color: '#f97316' },
          { id: 'c-2', type: 'bag', label: 'CONE', x: 380, y: 300, color: '#f97316' },
          { id: 'c-3', type: 'bag', label: 'CONE', x: 200, y: 160, color: '#f97316' },
          { id: 'c-4', type: 'bag', label: 'CONE', x: 380, y: 160, color: '#f97316' },
          { id: 'def-1', type: 'X', label: 'DEF', x: 360, y: 290, color: '#058538' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 220, y: 180, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-def', type: 'tackle', startX: 360, startY: 290, endX: 250, endY: 200, color: '#058538', label: 'Cutoff Track' },
          { id: 'a-bc', type: 'run', startX: 220, startY: 180, endX: 220, endY: 280, color: '#d91b24', label: 'Boundary Sprint' },
        ],
        zones: [
          { id: 'z-sideline', name: 'SIDELINE PIN ALLEY', cx: 210, cy: 230, rx: 20, ry: 50, color: '#ef4444', opacity: 0.25 },
        ],
      },
      {
        name: 'PHASE 2: BOUNDARY SQUEEZE & BREAKDOWN',
        description: 'Defender sinks hips at boundary line, wraps ballcarrier as sideline eliminates cutback.',
        tokens: [
          { id: 'def-1', type: 'X', label: 'DEF', x: 240, y: 240, color: '#058538', subLabel: 'Pin & Squeeze' },
          { id: 'bc-1', type: 'O', label: 'BALL', x: 220, y: 240, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-pin', type: 'tackle', startX: 240, startY: 240, endX: 215, endY: 240, color: '#058538', label: 'Form Pin' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // SPECIAL TEAMS DRILLS
  // ==========================================
  {
    id: 'matrix-st-kickoff',
    category: 'ST',
    categoryLabel: 'Special Teams (Kickoff)',
    title: 'SPECIAL TEAMS: KICKOFF LANE SPACING & SPRINT',
    subtitle: '5-Yard Spacing, 40-Yard Sprint & Containment Funnel',
    objective: 'Maintain rigid 5-yard lane spacing across the entire 50-yard kickoff front, avoiding fold-ins and boxing the returner inside.',
    setup: 'Ball placed at 35-yard line on tee. 10 kickoff coverage men spaced 5 yards apart across field. 2 outside contain safeties.',
    instructions: [
      'On kicker approach step, coverage team times full-speed sprint hitting LOS exactly as ball is struck.',
      'Stay strictly in your vertical lane for first 30 yards.',
      'At 20 yards from returner, break down into containment funnel: L1 and R1 contain outside, L2-R2 squeeze inside.'
    ],
    equipment: 'Kickoff tee, football, 10 boundary cones.',
    cues: ['Do not cross lanes', 'Time the kick on the run', 'Keep outside arm free on contain', 'Swarm as a wall'],
    faults: ['Leaving lane early (opens massive return alley)', 'Offsides before ball is kicked'],
    phases: [
      {
        name: 'PHASE 1: TIMED APPROACH & LANE SPRINT',
        description: 'Coverage team sprints in 5-yard lanes as kicker makes contact with the football.',
        tokens: [
          { id: 'k-1', type: 'O', label: 'K', x: 350, y: 310, color: '#f59e0b' },
          { id: 'l1', type: 'X', label: 'L1', x: 180, y: 310, color: '#2563eb', subLabel: 'Contain' },
          { id: 'l2', type: 'X', label: 'L2', x: 230, y: 310, color: '#2563eb' },
          { id: 'l3', type: 'X', label: 'L3', x: 280, y: 310, color: '#2563eb' },
          { id: 'r3', type: 'X', label: 'R3', x: 420, y: 310, color: '#2563eb' },
          { id: 'r2', type: 'X', label: 'R2', x: 470, y: 310, color: '#2563eb' },
          { id: 'r1', type: 'X', label: 'R1', x: 520, y: 310, color: '#2563eb', subLabel: 'Contain' },
          { id: 'ret-1', type: 'O', label: 'RET', x: 350, y: 130, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-k', type: 'pass', startX: 350, startY: 310, endX: 350, endY: 140, color: '#f59e0b', label: 'Deep Kick' },
          { id: 'a-l1', type: 'run', startX: 180, startY: 310, endX: 200, endY: 200, color: '#2563eb' },
          { id: 'a-l2', type: 'run', startX: 230, startY: 310, endX: 260, endY: 200, color: '#2563eb' },
          { id: 'a-l3', type: 'run', startX: 280, startY: 310, endX: 310, endY: 200, color: '#2563eb' },
          { id: 'a-r3', type: 'run', startX: 420, startY: 310, endX: 390, endY: 200, color: '#2563eb' },
          { id: 'a-r2', type: 'run', startX: 470, startY: 310, endX: 440, endY: 200, color: '#2563eb' },
          { id: 'a-r1', type: 'run', startX: 520, startY: 310, endX: 500, endY: 200, color: '#2563eb' },
        ],
        zones: [
          { id: 'z-funnel', name: 'CONTAINMENT FUNNEL', cx: 350, cy: 190, rx: 140, ry: 40, color: '#10b981', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-st-puntshield',
    category: 'ST',
    categoryLabel: 'Special Teams (Punt)',
    title: 'SPECIAL TEAMS: PUNT SHIELD PROTECTION INSTALL',
    subtitle: 'Snap-to-Kick Timing, 3-Man Shield & Gunner Releases',
    objective: 'Protect the punter at 14 yards depth with a solid 3-man shield wall, ensuring snap-to-kick operation under 2.0 seconds.',
    setup: 'Long snapper at 30-yard line. Punter aligned at 14 yards. 3 shield protectors positioned 6 yards behind LOS.',
    instructions: [
      'Snapper snaps ball with tight spiral back to punter hands.',
      'Shield linemen take 2 shuffle steps back, lock inside shoulders together to prevent A-gap leaks.',
      'Absorb contact with low base—never retreat into punter kicking leg.',
      'Gunners release off LOS, fight through jammer hands, and sprint to break down 3 yards in front of returner.'
    ],
    equipment: 'Footballs, 4 agile rushers, 2 gunner cones.',
    cues: ['Shield locked shoulder-to-shoulder', '2.0 second launch rule', 'Gunners track outside-in'],
    faults: ['Shield opening up a gap between protectors', 'Punter dropping ball too low on stride'],
    phases: [
      {
        name: 'PHASE 1: SNAP & SHIELD LOCKOUT',
        description: 'Snapper snaps ball back; 3-man shield forms interlocking wall 6 yards deep.',
        tokens: [
          { id: 'ls-1', type: 'O', label: 'LS', x: 350, y: 200, color: '#1a1a24' },
          { id: 'sh-1', type: 'O', label: 'SH1', x: 320, y: 260, color: '#2563eb' },
          { id: 'sh-2', type: 'O', label: 'SH2', x: 350, y: 260, color: '#2563eb' },
          { id: 'sh-3', type: 'O', label: 'SH3', x: 380, y: 260, color: '#2563eb' },
          { id: 'p-1', type: 'O', label: 'P', x: 350, y: 340, color: '#f59e0b' },
          { id: 'gun-1', type: 'O', label: 'GUN', x: 170, y: 200, color: '#10b981' },
          { id: 'gun-2', type: 'O', label: 'GUN', x: 530, y: 200, color: '#10b981' },
          { id: 'rush-1', type: 'X', label: 'RUSH', x: 330, y: 190, color: '#ef4444' },
          { id: 'rush-2', type: 'X', label: 'RUSH', x: 370, y: 190, color: '#ef4444' },
        ],
        arrows: [
          { id: 'a-snap', type: 'pass', startX: 350, startY: 200, endX: 350, endY: 330, color: '#1a1a24', label: '14-Yd Snap' },
          { id: 'a-gun1', type: 'run', startX: 170, startY: 200, endX: 200, endY: 130, color: '#10b981', label: 'Boundary Release' },
          { id: 'a-gun2', type: 'run', startX: 530, startY: 200, endX: 500, endY: 130, color: '#10b981', label: 'Field Release' },
          { id: 'a-rush1', type: 'blitz', startX: 330, startY: 190, endX: 330, endY: 250, color: '#ef4444' },
          { id: 'a-rush2', type: 'blitz', startX: 370, startY: 190, endX: 370, endY: 250, color: '#ef4444' },
        ],
        zones: [
          { id: 'z-shield', name: '3-MAN SHIELD WALL', cx: 350, cy: 260, rx: 50, ry: 20, color: '#2563eb', opacity: 0.35 },
        ],
      },
    ],
  },

  // ==========================================
  // BLOCKING TECHNIQUE
  // ==========================================
  {
    id: 'matrix-blocking-cuff',
    category: 'BLOCKING',
    categoryLabel: 'Blocking Technique',
    title: 'BLOCKING: CUFF BLOCKING PROGRESSION',
    subtitle: 'Chest Up, Feet Fast, Fit & Drive',
    objective: 'Ingrain CUFF fundamentals (Chest Up, Feet Fast) to prevent leaning forward and falling off blocks.',
    setup: 'Pair players up with 1 hand shield per pair. Stand across from each other 2 feet apart.',
    instructions: [
      'Player establishes athletic base with knees bent, back arched, and eyes up.',
      'On whistle, strike shield with base of hands inside the frame.',
      'Keep feet buzzing rapidly in 6-inch increments, driving opponent back without over-extending.'
    ],
    equipment: 'Blocking shields / agile bags.',
    cues: ['Chest up at all times', 'Fast feet on the turf', 'Thumbs up, elbows clamped', 'Keep your head back'],
    faults: ['Lunging forward onto toes', 'Looking down at the ground'],
    phases: [
      {
        name: 'PHASE 1: CUFF FIT & DRIVE',
        description: 'Blocker strikes pad with chest upright and knees bent, driving legs continuously.',
        tokens: [
          { id: 'b-1', type: 'O', label: 'BLK', x: 350, y: 260, color: '#1a1a24' },
          { id: 'd-1', type: 'X', label: 'PAD', x: 350, y: 210, color: '#ef4444' },
        ],
        arrows: [
          { id: 'a-fit', type: 'block', startX: 350, startY: 260, endX: 350, endY: 215, color: '#1a1a24', label: 'CUFF Fit' },
          { id: 'a-drive', type: 'block', startX: 350, startY: 215, endX: 350, endY: 160, color: '#1a1a24', label: 'Feet Fast Drive' },
        ],
        zones: [
          { id: 'z-fit', name: 'INSIDE CHEST FIT', cx: 350, cy: 210, rx: 25, ry: 20, color: '#10b981', opacity: 0.3 },
        ],
      },
    ],
  },

  // ==========================================
  // WARM-UP, AGILITY & CONDITIONING (DESCRIPTION-FOCUSED)
  // ==========================================
  {
    id: 'matrix-warmup-dyn1',
    category: 'WARMUP',
    categoryLabel: 'Warm-Up & Agility',
    title: 'WARM-UP: DYNAMIC PROGRESSION 1 (EXPANDED)',
    subtitle: 'Athletic Stances, Joint Activation & Multi-Planar Mobility',
    objective: 'Prepare youth athletes physically and mentally with athletic stance activation, groin/hip mobility, and dynamic jumping cadences.',
    setup: 'Set up 5 lines spaced 5 yards apart on the 20-yard line facing the coach. Whistle ready.',
    instructions: [
      'Line up the entire roster in 5 even columns spaced 5 yards apart.',
      'Clap it up on whistle to lock in focus.',
      'Perform Feet-Sink-Holsters breakdown drill (20 seconds x 2 reps).',
      '10 Jumping Jacks with full overhead reach.',
      '10 Seal Jacks with horizontal chest openers.',
      '10 Air Squats focusing on deep hip crease and knees over toes.'
    ],
    equipment: '5 landmark cones, whistle, stopwatch.',
    cues: ['Feet-Sink-Holsters stance', 'Chest high on squats', 'All sound off cadence together on every rep'],
    faults: ['Sluggish transitions between exercises', 'Rounded backs on squats'],
    phases: [], // No diagram needed — displays normal descriptions
  },
  {
    id: 'matrix-warmup-dyn2',
    category: 'WARMUP',
    categoryLabel: 'Warm-Up & Agility',
    title: 'WARM-UP: DYNAMIC PROGRESSION 2 (CONDENSED)',
    subtitle: 'High Knees, Butt Kicks, Frankensteins & Ball Catch',
    objective: 'Execute high-tempo linear locomotor warm-up across 20 yards, finishing with coach breakdown call and football reaction catch.',
    setup: 'Sideline to numbers (20-yard lane). Coach stands at 20-yard mark with football.',
    instructions: [
      'Line 1 fires out on whistle: 10 yards high knees with aggressive arm pump.',
      'Transition immediately into 10 yards butt kicks maintaining dorsiflexed ankles.',
      'Frankenstein straight-leg kicks stretching hamstrings on return lap.',
      'Finish each rep with breakdown command; coach tosses ball to random player to test hand readiness.'
    ],
    equipment: '1 football, whistle.',
    cues: ['Toe up, knee up', 'Pump arms cheek-to-cheek', 'Eyes on the coach for the pass'],
    faults: ['Leaning backward during high knees'],
    phases: [], // No diagram needed
  },
  {
    id: 'matrix-warmup-lines',
    category: 'WARMUP',
    categoryLabel: 'Warm-Up & Agility',
    title: 'WARM-UP: DYNAMIC LINE CADENCES',
    subtitle: 'Sideline Cadences, Karaoke & 10-Yard Explosive Bursts',
    objective: 'Build team energy, coordination, and rapid deceleration across hash mark milestones.',
    setup: 'Sideline to opposite hash mark. Cones set every 5 yards.',
    instructions: [
      'Team lines up toeing the sideline.',
      'Coach leads loud verbal cadence ("DOWN, SET, HIT!").',
      'Perform Karaoke (Grapevine) for 10 yards focusing on hip rotation.',
      'Lateral shuffle 10 yards with hands up in holster position.',
      'Sprint full speed 10 yards, plant foot, and backpedal 5 yards into athletic breakdown.'
    ],
    equipment: 'Whistle, 6 cones.',
    cues: ['Hips swivel on karaoke', 'Do not click heels on shuffle', 'Sink into breakdown on command'],
    faults: ['High center of gravity during lateral shuffle'],
    phases: [], // No diagram needed
  },
  {
    id: 'matrix-agility-4way',
    category: 'WARMUP',
    categoryLabel: 'Warm-Up & Agility',
    title: 'AGILITY: 4-WAY DIRECTION CHANGE & MIRROR',
    subtitle: 'Reactionary Foot Chopping & Center of Gravity Control',
    objective: 'Train athletes to react to visual cues instantly while keeping feet buzzing rapidly and maintaining low base.',
    setup: 'Coach stands 5 yards in front of group. Players aligned in 3x3 grid.',
    instructions: [
      'On coach command "FEET", all athletes begin chopping feet rapidly.',
      'Coach points hand: Forward (sprint 2 yards), Backward (backpedal 2 yards), Left/Right (lateral shuffle).',
      'On whistle, all players breakdown into solid tackling fit and shout "HIT!".'
    ],
    equipment: 'Whistle, 4 grid cones.',
    cues: ['Buzz the feet', 'React to hands, not sound', 'Stay in the athletic tunnel'],
    faults: ['Crossing feet during lateral shuffle', 'Standing up tall between commands'],
    phases: [], // No diagram needed
  },
  {
    id: 'matrix-cond-gassers',
    category: 'WARMUP',
    categoryLabel: 'Warm-Up & Agility',
    title: 'CONDITIONING: FULL TEAM GASSERS & STRIPS',
    subtitle: 'Fourth-Quarter Stamina, Mental Toughness & Team Unity',
    objective: 'Finish practice with high-effort team conditioning, requiring every player to touch the sideline on each turn before time expires.',
    setup: 'Sideline to opposite sideline (53.3 yards). Full team spaced along boundary.',
    instructions: [
      'On whistle, entire team sprints from sideline to opposite sideline.',
      'Touch sideline with hand, turn, and sprint back (Half Gasser = 1 round trip; Full Gasser = 2 round trips).',
      'Encourage teammates; no hands on knees between sets.'
    ],
    equipment: 'Stopwatch, whistle.',
    cues: ['Touch the line with your hand', 'Finish through the whistle', 'Heads up, lungs open'],
    faults: ['Stopping short of the sideline', 'Walking back before reps are complete'],
    phases: [], // No diagram needed
  },
  {
    id: 'matrix-gen-chalktalk',
    category: 'SCHEME',
    categoryLabel: 'General & Chalk Talk',
    title: 'GENERAL: TEAM INSTALL (CHALK TALK & WATER)',
    subtitle: 'Whiteboard Walkthrough, Audibles & Situational Review',
    objective: 'Review weekly game plan, opponent offensive/defensive fronts, red zone audibles, and personnel assignments before walking through cards.',
    setup: 'Whiteboard positioned at sideline bench or water tent. All offensive and defensive units gathered.',
    instructions: [
      'Coaches review new playbook installs, pass protection rules, and coverage shells on whiteboard.',
      'Quiz players on individual alignment, gap keys, and audibles.',
      'Transition immediately into brief 3-minute hydration break before field walkthrough.'
    ],
    equipment: 'Whiteboard, dry-erase markers, water coolers.',
    cues: ['Eyes on the board', 'Repeat the call loudly', 'Know your assignment before stepping on field'],
    faults: ['Talking over coaches', 'Failing to communicate assignment during check'],
    phases: [], // Description focused
  },
];
