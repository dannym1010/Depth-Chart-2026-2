import { WhiteboardDrill } from './whiteboardDrillData';

/**
 * 27 OFFENSIVE DRILLS FROM THE PRACTICE DRILL MATRIX
 * Categorized into:
 * - Quarterbacks (QB) (5)
 * - Running Backs (RB) (5)
 * - Offensive Line (OL) (5)
 * - Wide Receivers & Tight Ends (WR/TE) (7)
 * - Team Offense & Group Install (5)
 */
export const OFFENSE_MATRIX_DRILLS: WhiteboardDrill[] = [
  // ==========================================
  // QUARTERBACKS (QB) - 5 DRILLS
  // ==========================================
  {
    id: 'matrix-qb-undercenter',
    category: 'OFF_QB',
    categoryLabel: 'Quarterbacks (QB)',
    title: 'QB: Under Center Snap & Drop',
    subtitle: 'Exchange, Footwork & 3/5-Step Drop Depth',
    objective: "Master the snap exchange without fumbling. Ensure the QB applies firm upward pressure to the center's backside, seats the ball, and executes a smooth 3-step or 5-step drop on air with zero false steps.",
    setup: 'LOS set at 25-yard line. Center over ball, QB under center. Cones set at 1.5, 3, and 5-yard drop landmarks.',
    instructions: [
      'Center snaps ball on cadence ("Down, Set, Hut").',
      'QB presses hands firmly under center tailbone with dominant hand on top and thumbs crossed.',
      'Take immediate reach step with right foot without false stepping backward.',
      'Crossover step on 2, firm plant on 3 with front shoulder aimed at boundary receiver.',
      'Deliver pass in rhythm on the hitch.'
    ],
    equipment: '5 footballs, 3 landmark cones, target net or wide receiver.',
    cues: ['Firm pressure on center', 'Reach step, no false steps', 'Chin over chest', 'Firm back cleat plant'],
    faults: ['Pulling hands away early (fumble risk)', 'Heel clicking during drop', 'Dropping elbow below shoulder'],
    phases: [
      {
        name: 'PHASE 1: SNAP EXCHANGE & REACH STEP',
        description: 'QB takes snap under center, secures ball with two hands at chest shelf, and takes deep reach step.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 250, color: '#d91b24', subLabel: 'Under Center' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 180, y: 220, color: '#2563eb' },
          { id: 'cone-1', type: 'cone', label: '1.5y', x: 350, y: 280, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-step1', type: 'run', startX: 350, startY: 250, endX: 350, endY: 280, color: '#d91b24', label: '1. Reach' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: 3-STEP PLANT & THROW',
        description: 'QB executes crossover and plants right foot firmly at 5 yards, loading hips to strike receiver on slant.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 310, color: '#d91b24', subLabel: 'Plant & Fire' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 230, y: 160, color: '#2563eb', subLabel: 'Slant' },
          { id: 'target-1', type: 'target', label: '🎯', x: 230, y: 155, color: '#10b981' },
        ],
        arrows: [
          { id: 'a-cross', type: 'run', startX: 350, startY: 280, endX: 350, endY: 310, color: '#d91b24', label: '2-3. Plant' },
          { id: 'a-route', type: 'run', startX: 180, startY: 220, endX: 230, endY: 160, color: '#2563eb', label: 'Slant' },
          { id: 'a-throw', type: 'pass', startX: 350, startY: 310, endX: 230, endY: 160, color: '#f59e0b', label: 'On-Time Strike' },
        ],
        zones: [
          { id: 'z-catch', name: 'WINDOW', cx: 230, cy: 160, rx: 35, ry: 25, color: '#10b981', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'matrix-qb-shotgun',
    category: 'OFF_QB',
    categoryLabel: 'Quarterbacks (QB)',
    title: 'QB: Shotgun Snap & Quick Game',
    subtitle: 'Catch-and-Throw Rhythm & Slant/Hitch Release',
    objective: 'QB takes shotgun snap at 5 yards, instantly sets feet, and throws a quick slant or hitch in one fluid rhythm without extra ball pats.',
    setup: 'Center at LOS. QB at 5 yards depth. 2 receivers split out left and right running quick game routes.',
    instructions: [
      'QB assumes relaxed athletic stance at 5 yards depth, knees bent, hands presenting target.',
      'Center snaps spiral or dead-ball snap directly to QB chest.',
      'Catch ball with fingers, locate laces with throwing hand without looking down.',
      'Plant back foot simultaneously on catch and drive front hip toward designated target.'
    ],
    equipment: '5 footballs, cones marking receiver alignments.',
    cues: ['Hands out, soft catch', 'No ball patting', 'Drive off back heel', 'Front shoulder down target'],
    faults: ['Patting ball before throw (slows release)', 'Catching off back foot'],
    phases: [
      {
        name: 'PHASE 1: SHOTGUN CATCH & LACE GRIP',
        description: 'QB receives snap at 5 yards depth, eyes locked downfield, fingers instantly finding laces.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 190, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24', subLabel: '5y Gun' },
          { id: 'wr-1', type: 'O', label: 'WR1', x: 180, y: 190, color: '#2563eb' },
          { id: 'wr-2', type: 'O', label: 'WR2', x: 520, y: 190, color: '#2563eb' },
        ],
        arrows: [
          { id: 'a-snap', type: 'pass', startX: 350, startY: 190, endX: 350, endY: 280, color: '#e2e8f0', dashed: true, label: 'Gun Snap' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: CATCH-AND-FIRE TO QUICK SLANT',
        description: 'One-step catch-and-fire: plant back foot and deliver dart to inside slant route.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 190, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR1', x: 260, y: 130, color: '#2563eb', subLabel: 'Catch' },
          { id: 'wr-2', type: 'O', label: 'WR2', x: 520, y: 140, color: '#2563eb', subLabel: 'Hitch' },
        ],
        arrows: [
          { id: 'a-slant', type: 'run', startX: 180, startY: 190, endX: 260, endY: 130, color: '#2563eb', label: 'Quick Slant' },
          { id: 'a-throw', type: 'pass', startX: 350, startY: 280, endX: 260, endY: 130, color: '#f59e0b', label: 'Catch & Throw' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-qb-bootleg',
    category: 'OFF_QB',
    categoryLabel: 'Quarterbacks (QB)',
    title: 'QB: Play-Action Bootleg Mesh',
    subtitle: 'Hard Run Fake, Hip Tuck & Perimeter Sprint',
    objective: 'Execute a hard run fake to freeze second-level linebackers, drop the football to the hip, and sprint to the edge to deliver an on-target pass.',
    setup: 'Ball placed at LOS hash. Full backfield (QB, RB). Cones marking mesh point and 7-yard bootleg perimeter track.',
    instructions: [
      'QB takes snap, opens hips at 45 degrees, seats ball into running back stomach.',
      'Hold mesh for two full steps with running back clamping around empty hands.',
      'Disengage, tuck ball tightly behind right hip, snap head around to locate contain defender.',
      'Sprint downhill toward boundary, square hips, and hit drag or corner route.'
    ],
    equipment: 'Footballs, 4 agility cones, tight end or receiver target.',
    cues: ['Sell the run fake', 'Ball hidden on hip', 'Snap eyes around', 'Square shoulders before throw'],
    faults: ['Rushing the fake (fails to pull linebackers)', 'Running backward away from LOS'],
    phases: [
      {
        name: 'PHASE 1: HARD RUN MESH',
        description: 'QB seats ball into RB pocket attacking the left A-gap, selling outside zone run.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 320, y: 200, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 320, y: 240, color: '#d91b24', subLabel: 'Mesh Fake' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 260, y: 240, color: '#059669', subLabel: 'Zone Fake' },
          { id: 'te-1', type: 'O', label: 'TE', x: 420, y: 200, color: '#2563eb' },
        ],
        arrows: [
          { id: 'a-rb-mesh', type: 'run', startX: 260, startY: 240, endX: 220, endY: 180, color: '#059669', label: 'Sell Zone Run' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: NAKED BOOTLEG & THROW TO CORNER',
        description: 'QB disengages, hides ball on hip, sprints opposite side, and throws to dragging tight end.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 320, y: 200, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 440, y: 230, color: '#d91b24', subLabel: 'Sprint Edge' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 190, y: 160, color: '#059669' },
          { id: 'te-1', type: 'O', label: 'TE', x: 480, y: 130, color: '#2563eb', subLabel: 'Slide Route' },
        ],
        arrows: [
          { id: 'a-boot', type: 'curved', startX: 320, startY: 240, endX: 440, endY: 230, controlX: 380, controlY: 270, color: '#d91b24', label: 'Bootleg Sprint' },
          { id: 'a-te-route', type: 'run', startX: 420, startY: 200, endX: 480, endY: 130, color: '#2563eb', label: 'Flat / Slide' },
          { id: 'a-throw', type: 'pass', startX: 440, startY: 230, endX: 480, endY: 130, color: '#f59e0b', label: 'Strike on Edge' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-qb-targetnet',
    category: 'OFF_QB',
    categoryLabel: 'Quarterbacks (QB)',
    title: 'QB: Target Accuracy Net Drill',
    subtitle: '5, 10 & 15-Yard Precision Target Progression',
    objective: 'Develop laser target accuracy at varying depths. Ensure front toe points directly at target net on release with smooth overhand arm motion.',
    setup: 'Set 3 net targets or garbage cans at 5 yards, 10 yards, and 15 yards across field.',
    instructions: [
      'QB takes 3-step or 5-step drop on coach cadence.',
      'Coach calls out target color/depth mid-drop ("Red 5", "Blue 10", "Gold 15").',
      'QB aligns hips immediately to called target and throws 5 balls per station.',
      'Score 3 points for target pocket, 1 point for frame hit.'
    ],
    equipment: '3 target nets / bins, 10 footballs, scoring sheet.',
    cues: ['Front toe to target', 'High elbow release', 'Follow through to opposite hip', 'Consistent release point'],
    faults: ['Side-arming the ball on deep throws', 'Opening hips too early'],
    phases: [
      {
        name: 'PHASE 1: MULTI-DEPTH TARGET GRID',
        description: 'QB sets up in pocket with 3 tiered target landmarks at 5, 10, and 15 yards.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 320, color: '#d91b24' },
          { id: 'net-1', type: 'target', label: '5Y', x: 220, y: 220, color: '#10b981' },
          { id: 'net-2', type: 'target', label: '10Y', x: 350, y: 160, color: '#3b82f6' },
          { id: 'net-3', type: 'target', label: '15Y', x: 480, y: 100, color: '#f59e0b' },
        ],
        arrows: [
          { id: 'a-t1', type: 'pass', startX: 350, startY: 320, endX: 220, endY: 220, color: '#10b981', label: 'Quick 5y' },
          { id: 'a-t2', type: 'pass', startX: 350, startY: 320, endX: 350, endY: 160, color: '#3b82f6', label: 'Intermediate 10y' },
          { id: 'a-t3', type: 'pass', startX: 350, startY: 320, endX: 480, endY: 100, color: '#f59e0b', label: 'Deep 15y' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-qb-onrun',
    category: 'OFF_QB',
    categoryLabel: 'Quarterbacks (QB)',
    title: 'QB: On-Run & Off-Platform Throws',
    subtitle: 'Shoulder Squaring, Hip Torque & Boundary Throws',
    objective: 'Roll right and left while keeping shoulders square to target, generating velocity from core torque instead of throwing off back foot.',
    setup: 'Cones set at 7-yard hash marks to guide rollout path. Receivers running comeback routes at boundary.',
    instructions: [
      'QB takes snap, sprints laterally toward numbers.',
      'At 7 yards, dip inside shoulder to square chest to sideline receiver.',
      'Drive off back foot and follow through down the target line.'
    ],
    equipment: 'Footballs, 4 cones, receiver group.',
    cues: ['Do not throw across body', 'Square upper body', 'Lead with front shoulder', 'Drive through ball'],
    faults: ['Throwing off back foot while leaning away', 'Floating the ball out of bounds'],
    phases: [
      {
        name: 'PHASE 1: SPRINT ROLLOUT & BOUNDARY STRIKE',
        description: 'QB sprints laterally along rollout curve, squares chest at hash mark, and delivers pass to comeback route.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 300, y: 220, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 440, y: 260, color: '#d91b24', subLabel: 'Sprint Edge' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 550, y: 160, color: '#2563eb', subLabel: 'Comeback' },
        ],
        arrows: [
          { id: 'a-roll', type: 'curved', startX: 300, startY: 260, endX: 440, endY: 260, controlX: 370, controlY: 290, color: '#d91b24', label: 'Sprint Track' },
          { id: 'a-throw', type: 'pass', startX: 440, startY: 260, endX: 550, endY: 160, color: '#f59e0b', label: 'Square & Throw' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // RUNNING BACKS (RB) - 5 DRILLS
  // ==========================================
  {
    id: 'matrix-rb-mesh',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Handoff Mesh & Ball Security',
    subtitle: 'Inside/Outside Elbow Pocket & 4 Points of Pressure',
    objective: "Master proper handoff pocket (inside elbow up, outside elbow down), soft clamp on ball, and instant transition to 4 points of pressure.",
    setup: 'QB under center or shotgun at 20-yard line. RB aligned 4 yards behind. 2 cones marking A-gap track.',
    instructions: [
      'RB aligns in 2-point balanced stance with weight on balls of feet.',
      'On snap, RB takes downhill approach step.',
      'Form pocket: inside elbow at chin height, outside elbow at belt buckle, palms open.',
      'Allow QB to seat ball securely in stomach; clamp down softly without snatching.',
      'Tuck ball high and tight under ribcage with nose covered by fingers.'
    ],
    equipment: '5 footballs, 2 cones, handoff collision bag.',
    cues: ['Inside elbow UP, outside DOWN', 'Do not grab the ball early', '4 points of pressure', 'Burst through the mesh'],
    faults: ['Reaching for the ball with hands (causes fumbles)', 'Carrying ball loosely away from chest'],
    phases: [
      {
        name: 'PHASE 1: POCKET PRESENTATION & MESH POINT',
        description: 'RB forms firm pocket with inside elbow up and outside elbow down as QB seats ball into belly.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 180, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 220, color: '#d91b24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 310, y: 260, color: '#059669', subLabel: 'Open Pocket' },
        ],
        arrows: [
          { id: 'a-rb-mesh', type: 'run', startX: 310, startY: 260, endX: 345, endY: 225, color: '#059669', label: 'Mesh Step' },
        ],
        zones: [
          { id: 'z-mesh', name: 'MESH POINT', cx: 345, cy: 225, rx: 25, ry: 20, color: '#10b981', opacity: 0.3 },
        ],
      },
      {
        name: 'PHASE 2: BURST THROUGH A-GAP WITH 4 POINTS TUCK',
        description: 'RB clamps over ball, transitions to high-and-tight ball security, and accelerates downhill.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C', x: 350, y: 180, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 380, y: 140, color: '#059669', subLabel: 'Locked High & Tight' },
          { id: 'cone-1', type: 'cone', label: 'A-Gap', x: 390, y: 180, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-burst', type: 'run', startX: 345, startY: 225, endX: 380, endY: 140, color: '#059669', label: 'North-South Burst' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-rb-downhill',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Downhill A/B Gap Press',
    subtitle: 'North-South Attack & Blocker Hip Cut',
    objective: "Eliminate East-West dancing. RB receives handoff, presses line of scrimmage downhill, and makes a single explosive cut off blocker's hip.",
    setup: 'Place 4 agile bags on ground simulating Center, Guard, and Tackle. Coach stands 5 yards deep as read key.',
    instructions: [
      'RB receives handoff with shoulders square to LOS.',
      'Attack designated A or B gap with high knees and eyes up.',
      'Read front blocker: if defensive player flashes inside, plant outside cleat and cut to outside hip.'
    ],
    equipment: '4 step-over bags, 2 cones, footballs.',
    cues: ['One cut and GO', 'Shoulders square to line', 'Do not bounce wide', 'Drive knees through hole'],
    faults: ['Bouncing plays outside instead of taking positive yards inside', 'Stutter-stepping at LOS'],
    phases: [
      {
        name: 'PHASE 1: DOWNHILL PRESS & CUT',
        description: 'RB takes handoff, presses directly toward B-gap bag, plants outside cleat and cuts north.',
        tokens: [
          { id: 'bag-1', type: 'bag', label: 'LT', x: 260, y: 180, color: '#64748b' },
          { id: 'bag-2', type: 'bag', label: 'LG', x: 310, y: 180, color: '#64748b' },
          { id: 'bag-3', type: 'bag', label: 'C', x: 360, y: 180, color: '#64748b' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 360, y: 270, color: '#059669' },
        ],
        arrows: [
          { id: 'a-press', type: 'run', startX: 360, startY: 270, endX: 285, endY: 200, color: '#059669', label: 'Press B-Gap' },
          { id: 'a-cut', type: 'run', startX: 285, startY: 200, endX: 285, endY: 130, color: '#10b981', label: 'Vertical Cut' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-rb-gauntlet',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Running Back Gauntlet',
    subtitle: 'Pad Collision, High-and-Tight Tuck & Churning Feet',
    objective: 'Run through a tight chute of 4-6 hit shields without fumbling. Emphasize low pad level, churning knees, and 4 points of pressure.',
    setup: 'Line up two rows of 3 players each holding hit shields 2.5 yards apart, creating a 10-yard contact gauntlet.',
    instructions: [
      'RB receives handoff at full stride entering the chute.',
      'Keep eyes up, sink hips, and lock ball against ribs with forearm and bicep clamped.',
      'Drive through repeated heavy pad strikes, keeping feet moving constantly until crossing finish cone.'
    ],
    equipment: '6 hit shields, 2 cones, footballs.',
    cues: ['4 points of pressure', 'Never stop moving feet', 'Chin over ball', 'Low pad level'],
    faults: ['Letting ball loosen during contact', 'Stopping forward momentum when struck'],
    phases: [
      {
        name: 'PHASE 1: GAUNTLET CHUTE ENTRY',
        description: 'RB enters chute between opposing hit shields with high knees and ball locked.',
        tokens: [
          { id: 'p1', type: 'X', label: 'PAD', x: 300, y: 160, color: '#475569' },
          { id: 'p2', type: 'X', label: 'PAD', x: 300, y: 210, color: '#475569' },
          { id: 'p3', type: 'X', label: 'PAD', x: 400, y: 160, color: '#475569' },
          { id: 'p4', type: 'X', label: 'PAD', x: 400, y: 210, color: '#475569' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 260, color: '#059669', subLabel: 'Driving Knees' },
        ],
        arrows: [
          { id: 'a-drive', type: 'run', startX: 350, startY: 260, endX: 350, endY: 120, color: '#059669', label: 'Churn Through Hits' },
        ],
        zones: [
          { id: 'z-chute', name: 'CONTACT CHUTE', cx: 350, cy: 185, rx: 45, ry: 45, color: '#ef4444', opacity: 0.15 },
        ],
      },
    ],
  },
  {
    id: 'matrix-rb-sweep',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Outside Zone / Sweep Track',
    subtitle: 'Flank Acceleration & Hard Perimeter Cut',
    objective: 'Receive toss or wide pitch, stretch the defensive front laterally toward sideline numbers, plant hard on outside foot, and burst north-south.',
    setup: 'LOS set at 20-yard line. Place cones at tight end hip, numbers, and sideline boundary.',
    instructions: [
      'RB aligns in shotgun offset or I-formation.',
      'On pitch/toss, secure football with two hands before accelerating.',
      'Run flat down the line to force defense to flow laterally.',
      'Locate alley cone, stick outside cleat into turf, drop hips, and explode vertically upfield.'
    ],
    equipment: '4 landmark cones, footballs.',
    cues: ['Eye the toss into hands', 'Stretch the front', 'One-cut uphill', 'Accelerate through the alley'],
    faults: ['Trying to outrun everyone to sideline without ever cutting upfield', 'Fumbling the toss'],
    phases: [
      {
        name: 'PHASE 1: LATERAL STRETCH TRACK',
        description: 'RB takes pitch, stretches defensive contain laterally toward numbers.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 320, y: 240, color: '#d91b24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 390, y: 240, color: '#059669' },
          { id: 'cone-edge', type: 'cone', label: 'Alley', x: 500, y: 200, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-toss', type: 'pass', startX: 320, startY: 240, endX: 390, endY: 240, color: '#f59e0b', dashed: true, label: 'Pitch' },
          { id: 'a-stretch', type: 'run', startX: 390, startY: 240, endX: 500, endY: 210, color: '#059669', label: 'Stretch Track' },
        ],
        zones: [],
      },
      {
        name: 'PHASE 2: VERTICAL 90° CUT UPHILL',
        description: 'RB plants outside foot at alley cone, squares shoulders north, and explodes through seam.',
        tokens: [
          { id: 'rb-1', type: 'O', label: 'RB', x: 500, y: 130, color: '#059669', subLabel: 'North-South' },
          { id: 'cone-edge', type: 'cone', label: 'Cut Point', x: 500, y: 200, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-upfield', type: 'run', startX: 500, startY: 210, endX: 500, endY: 130, color: '#10b981', label: 'Explode North' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-rb-blitzpickup',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Pass Protection & Blitz Pickup',
    subtitle: 'Scanning A/B Gap & Striking Oncoming Linebackers',
    objective: 'RB identifies blitzing linebacker pre-snap, steps up into protection gap, squares up, strikes chest plate with heels of hands, and anchors.',
    setup: 'QB in shotgun at 5 yards. RB offset. Linebacker aligned 4 yards off LOS in blitz stance.',
    instructions: [
      'RB scans inside-out (A-gap first, then B-gap, then edge).',
      'On snap, take 2 aggressive steps forward to meet blitzer at LOS (do not wait in backfield).',
      'Sink hips into low athletic base, strike blitzer numbers with thumbs up, roll hips into contact and anchor.'
    ],
    equipment: 'Footballs, 2 hit shields or dummies.',
    cues: ['Inside-out scan', 'Meet blitzer at the line', 'Strike with heel of hands', 'Anchor low hips'],
    faults: ['Waiting in the backfield (gets pushed into QB)', 'Catching the blitzer instead of striking'],
    phases: [
      {
        name: 'PHASE 1: SCAN & STEP UP TO LOS',
        description: 'RB reads A-gap blitzer, fires downhill to line of scrimmage with wide base.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 320, y: 220, color: '#059669', subLabel: 'Step Up' },
          { id: 'lb-1', type: 'X', label: 'BLITZ', x: 320, y: 150, color: '#ef4444' },
        ],
        arrows: [
          { id: 'a-rb-step', type: 'run', startX: 320, startY: 250, endX: 320, endY: 200, color: '#059669', label: 'Meet at LOS' },
          { id: 'a-blitz', type: 'blitz', startX: 320, startY: 150, endX: 320, endY: 195, color: '#ef4444', label: 'A-Gap Blitz' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-rb-outside-press-cutback-lanes',
    category: 'OFF_RB',
    categoryLabel: 'Running Backs (RB)',
    title: 'RB: Perimeter Press & Cutback Reaction (Outside vs Cutback Lanes)',
    subtitle: 'Press Outside Edge, Read Force Defender, Bounce Wide or Plant & Slash Vertical',
    objective: 'Train running backs on wide zone and perimeter stretch reads. RB presses the outside track with speed to stretch the defense laterally. Read the force defender: when the edge is won, accelerate around the perimeter and turn corner up the numbers; when the defender over-pursues or sets a hard outside edge, violently plant outside foot 90 degrees and explode downhill through the cutback crease.',
    setup: 'Align QB in shotgun with RB offset. Place 4 cones establishing the outside perimeter track and corner turn. Place 2 agile bags defining the cutback crease lane. Position coach or defender with hit shield at the C-gap/perimeter force landmark.',
    instructions: [
      'Receive handoff/mesh on wide zone track, tucking football instantly into 4 points of pressure.',
      'Press the outside perimeter track at full speed toward the edge cone, forcing linebacker and safety pursuit wide.',
      'Read the force defender or coach hand signal: Rep A (Outside Bounce): Edge is sealed -> maintain perimeter speed, bend around corner cone, burst vertical up the numbers.',
      'Rep B (Cutback Lane): Defender flows hard outside -> plant outside cleat violently into turf, drop hips, bend 90 degrees back downhill through the cutback lane without stuttering.',
      'Cadence: Run 2 outside bounce repetitions to establish edge speed, then mix in surprise cutbacks to test instant vision and deceleration-to-acceleration burst.'
    ],
    equipment: '6 Cones, 2 Agile step-over bags (lane borders), 1 Handheld shield, footballs.',
    cues: [
      'Press the edge with speed first',
      'Eyes on force defender helmet',
      'Violent outside plant foot (no rounding)',
      'One cut and get vertical downhill',
      '4 points of ball security through contact'
    ],
    faults: [
      'Rounding off cutback angle into curved loop instead of sharp 90-degree plant',
      'Cutting back prematurely before forcing edge defender to commit wide',
      'Stutter-stepping or pitter-pattering feet before making cut',
      'Carrying football loosely away from ribcage'
    ],
    diagramKeys: [
      { text: 'Perimeter Cones: Outside Stretch Track', isHighlight: false },
      { text: 'Force Defender: Visual Read Key', isHighlight: true },
      { text: 'Cutback Lane: 90° Downhill Crease', isHighlight: true }
    ],
    videoUrl: 'https://www.facebook.com/reel/1443688096826333',
    phases: [
      {
        name: 'PHASE 1: SNAP & OUTSIDE STRETCH PRESS (SETTING UP PERIMETER)',
        description: 'RB takes wide zone mesh, presses track toward sideline cone with high speed to force defense to scrape laterally.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 180, color: '#1a1a24' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 320, y: 220, color: '#059669', subLabel: 'Stretch Track' },
          { id: 'c-cone1', type: 'cone', label: 'C-GAP', x: 270, y: 200, color: '#ea580c' },
          { id: 'c-cone2', type: 'cone', label: 'PERIMETER', x: 200, y: 200, color: '#ea580c' },
          { id: 'c-cone3', type: 'cone', label: 'BOUNDARY', x: 140, y: 200, color: '#ea580c' },
          { id: 'def-force', type: 'X', label: 'FORCE / DE', x: 210, y: 170, color: '#ef4444', subLabel: 'Read Key' },
        ],
        arrows: [
          { id: 'a-mesh', type: 'pass', startX: 350, startY: 180, endX: 320, endY: 220, color: '#1a1a24', label: 'Mesh' },
          { id: 'a-press', type: 'run', startX: 320, startY: 220, endX: 220, endY: 215, color: '#059669', label: 'Press Outside Track' },
          { id: 'a-force-read', type: 'run', startX: 210, startY: 170, endX: 200, endY: 185, color: '#ef4444', label: 'Flow' },
        ],
        zones: [
          { id: 'z-stretch', name: 'OUTSIDE STRETCH TRACK', cx: 240, cy: 215, rx: 80, ry: 25, color: '#059669', opacity: 0.18 },
        ],
      },
      {
        name: 'PHASE 2: REP OPTION A - OUTSIDE BOUNCE & CORNER TURN (EDGE WON)',
        description: 'Defender pinches inside or gets sealed. RB maintains speed to sideline, clears perimeter cone, and turns corner vertical up numbers.',
        tokens: [
          { id: 'c-cone2', type: 'cone', label: 'EDGE CONE', x: 200, y: 200, color: '#ea580c' },
          { id: 'def-hooked', type: 'X', label: 'DE', x: 220, y: 195, color: '#ef4444', subLabel: 'Pinched Inside' },
          { id: 'rb-bounce', type: 'O', label: 'RB', x: 150, y: 170, color: '#059669', subLabel: 'Turn Corner' },
        ],
        arrows: [
          { id: 'a-bounce', type: 'curved', startX: 220, startY: 215, endX: 150, endY: 170, controlX: 170, controlY: 215, color: '#059669', label: 'Speed Outside Bounce' },
          { id: 'a-burst-numbers', type: 'run', startX: 150, startY: 170, endX: 150, endY: 110, color: '#059669', label: 'Burst Up Numbers' },
        ],
        zones: [
          { id: 'z-bounce', name: 'PERIMETER BOUNCE ALLEY', cx: 150, cy: 150, rx: 45, ry: 40, color: '#2563eb', opacity: 0.2 },
        ],
      },
      {
        name: 'PHASE 3: REP OPTION B - SHARP PLANT & VERTICAL CUTBACK LANE (SLASHING DOWNHILL)',
        description: 'Force defender sets hard outside edge / over-pursues. RB plants outside right cleat into turf, drops hips 90°, and bursts downhill through cutback crease.',
        tokens: [
          { id: 'bag-cut1', type: 'bag', label: 'BAG 1', x: 260, y: 190, color: '#64748b' },
          { id: 'bag-cut2', type: 'bag', label: 'BAG 2', x: 300, y: 190, color: '#64748b' },
          { id: 'def-wide', type: 'X', label: 'FORCE', x: 180, y: 190, color: '#ef4444', subLabel: 'Over-Pursuit' },
          { id: 'rb-plant', type: 'O', label: 'RB', x: 210, y: 220, color: '#059669', subLabel: 'Plant Foot' },
          { id: 'rb-burst', type: 'O', label: 'RB', x: 280, y: 150, color: '#059669', subLabel: 'Vertical Cut' },
        ],
        arrows: [
          { id: 'a-plant-cut', type: 'run', startX: 210, startY: 220, endX: 280, endY: 160, color: '#10b981', label: '90° Plant & Cutback' },
          { id: 'a-vertical', type: 'run', startX: 280, startY: 160, endX: 280, endY: 100, color: '#10b981', label: 'North-South Explosion' },
          { id: 'a-flow-wide', type: 'run', startX: 190, startY: 180, endX: 150, endY: 190, color: '#ef4444', label: 'Washed Out' },
        ],
        zones: [
          { id: 'z-cutback-lane', name: 'CUTBACK CREASE / LANE', cx: 280, cy: 160, rx: 40, ry: 35, color: '#f59e0b', opacity: 0.25 },
        ],
      },
    ],
  },

  // ==========================================
  // OFFENSIVE LINE (OL) - 5 DRILLS
  // ==========================================
  {
    id: 'matrix-ol-powerstep',
    category: 'OFF_OL',
    categoryLabel: 'Offensive Line (OL)',
    title: 'OL: 6-Inch Power Step & Board Fit',
    subtitle: 'Explosion Off Snap, Thumbs Up & Low Pad Level',
    objective: 'Offensive linemen fire out of 3-point stance on cadence with a crisp 6-inch power step, keeping base wide and striking blocker chest plate with thumbs up.',
    setup: 'Place blocking board or 6-inch tape strip between feet. Coach holds hand shield opposite lineman.',
    instructions: [
      'Assume balanced 3-point stance: flat back, weight balanced 70/30 on balls of feet.',
      'On snap, take violent 6-inch power step with play-side foot (do not over-stride).',
      'Deliver two-handed punch inside opponent armpits with thumbs pointed up.',
      'Keep feet chopping wide on either side of the board.'
    ],
    equipment: 'Blocking boards, hit shields, cadence whistle.',
    cues: ['6-inch step, not 2 feet', 'Thumbs up, elbows tight', 'Flat back, eyes up', 'Keep feet wide of board'],
    faults: ['Over-striding (leads to falling forward on face)', 'Standing straight up at snap'],
    phases: [
      {
        name: 'PHASE 1: 3-POINT STANCE & 6-INCH FIT',
        description: 'OL fires out of stance, takes 6-inch step straddling board, and punches pad.',
        tokens: [
          { id: 'ol-1', type: 'O', label: 'RG', x: 350, y: 250, color: '#3b82f6', subLabel: '3-Pt Stance' },
          { id: 'dl-1', type: 'X', label: 'DT', x: 350, y: 190, color: '#dc2626', subLabel: 'Pad' },
          { id: 'board-1', type: 'bag', label: 'BOARD', x: 350, y: 220, color: '#f59e0b' },
        ],
        arrows: [
          { id: 'a-strike', type: 'block', startX: 350, startY: 250, endX: 350, endY: 200, color: '#3b82f6', label: '6-Inch Punch' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-ol-chute',
    category: 'OFF_OL',
    categoryLabel: 'Offensive Line (OL)',
    title: 'OL: Drive Blocking & Chute Drills',
    subtitle: 'Low Man Wins & Churning Leg Drive Under Chute',
    objective: 'Force offensive linemen to stay low off the snap. Drive through contact under the chute bar with wide base, short steps, and relentless leg drive.',
    setup: 'Set up blocking chute or stretch elastic cords at 4-foot height. Sled or blocking dummies positioned 2 yards inside chute.',
    instructions: [
      'Line up in 3-point stance completely under the chute ceiling.',
      'Fire out low on snap cadence without helmet contacting chute top.',
      'Strike dummy breastplate with thumbs up and elbows in.',
      'Drive dummy 5 yards downfield with short, churning, choppy power steps.'
    ],
    equipment: 'Blocking chute / ropes, blocking dummies / sled.',
    cues: ['Low man wins', 'Do not pop up', 'Churn the cleats', 'Hips under shoulders'],
    faults: ['Hitting the chute ceiling with helmet (standing up too fast)', 'Lunging with head down'],
    phases: [
      {
        name: 'PHASE 1: UNDER-CHUTE DRIVE FIT',
        description: 'Lineman fires out underneath low chute bar, strikes dummy with low pad level, and drives.',
        tokens: [
          { id: 'ol-1', type: 'O', label: 'OL', x: 350, y: 260, color: '#3b82f6', subLabel: 'Low Fit' },
          { id: 'dum-1', type: 'bag', label: 'DUMMY', x: 350, y: 200, color: '#64748b' },
        ],
        arrows: [
          { id: 'a-drive', type: 'block', startX: 350, startY: 260, endX: 350, endY: 150, color: '#3b82f6', label: '5-Yard Drive' },
        ],
        zones: [
          { id: 'z-chute', name: '4FT CHUTE BAR', cx: 350, cy: 230, rx: 60, ry: 20, color: '#38bdf8', opacity: 0.25 },
        ],
      },
    ],
  },
  {
    id: 'matrix-ol-pull',
    category: 'OFF_OL',
    categoryLabel: 'Offensive Line (OL)',
    title: 'OL: Pulling Guard & Trap Technique',
    subtitle: 'Open Step, Tight to Center Heels & Inside Shoulder Kickout',
    objective: 'Execute flat pulling footwork across formation, staying tight to Center heels, and deliver an explosive kick-out block on edge defender.',
    setup: 'Center, Guard, and Tackle aligned on LOS. Defensive End aligned 1 yard outside Tackle.',
    instructions: [
      'Guard takes open directional step at 90 degrees with play-side foot.',
      'Rip opposite arm across chest to turn shoulders parallel to LOS.',
      'Stay tight to Center and Tackle rear ends (do not belly out deep into backfield).',
      'Target edge defender inside number; strike with inside shoulder and drive out toward boundary.'
    ],
    equipment: 'Footballs, hit shield, cones.',
    cues: ['Open step flat', 'Tight to Center heels', 'Inside shoulder strike', 'Kick him OUT'],
    faults: ['Bellied pull path (collides with running back)', 'Lunging and missing kickout block'],
    phases: [
      {
        name: 'PHASE 1: FLAT PULL TRACK & KICKOUT',
        description: 'Right Guard opens flat behind Center, runs tight path, and kicks out defensive end on trap.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 260, y: 190, color: '#3b82f6' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 310, y: 190, color: '#3b82f6' },
          { id: 'c-1', type: 'O', label: 'C', x: 360, y: 190, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 410, y: 190, color: '#3b82f6', subLabel: 'Pulling' },
          { id: 'de-1', type: 'X', label: 'DE', x: 220, y: 180, color: '#ef4444', subLabel: 'Trap Key' },
        ],
        arrows: [
          { id: 'a-pull', type: 'curved', startX: 410, startY: 190, endX: 235, endY: 185, controlX: 330, controlY: 230, color: '#3b82f6', label: 'Flat Pull behind C' },
          { id: 'a-kick', type: 'block', startX: 240, startY: 195, endX: 215, endY: 180, color: '#f59e0b', label: 'Kick Out' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-ol-first2steps',
    category: 'OFF_OL',
    categoryLabel: 'Offensive Line (OL)',
    title: 'OL: First 2 Steps Progression',
    subtitle: 'Drive, Reach, Down & Scoop Footwork Reps',
    objective: 'Develop lightning-fast first 2 steps on snap cadence across all 4 core run blocking techniques (Drive, Reach, Down, Scoop).',
    setup: '5 linemen line up across line with 2-foot splits. Coach stands behind defense with signal cards.',
    instructions: [
      'Linemen assume 3-point stance on line.',
      'Coach calls block type: "REACH RIGHT" or "DOWN LEFT".',
      'On cadence, all 5 linemen fire first 2 steps in unison and freeze on 2nd step.',
      'Coach inspects pad level, cleat placement, and arm position.'
    ],
    equipment: 'Whistle, yard lines.',
    cues: ['First step 6 inches', 'Second step in the ground', 'Base wide as shoulders', 'Eyes up'],
    faults: ['False steps before forward movement', 'Narrow base resulting in stumbling'],
    phases: [
      {
        name: 'PHASE 1: SYNCHRONIZED 2-STEP FREEZE',
        description: 'Full offensive line fires 2 steps on snap and freezes for coach stance and base check.',
        tokens: [
          { id: 'lt-1', type: 'O', label: 'LT', x: 220, y: 220, color: '#3b82f6' },
          { id: 'lg-1', type: 'O', label: 'LG', x: 280, y: 220, color: '#3b82f6' },
          { id: 'c-1', type: 'O', label: 'C', x: 340, y: 220, color: '#1a1a24' },
          { id: 'rg-1', type: 'O', label: 'RG', x: 400, y: 220, color: '#3b82f6' },
          { id: 'rt-1', type: 'O', label: 'RT', x: 460, y: 220, color: '#3b82f6' },
        ],
        arrows: [
          { id: 'a-step1', type: 'block', startX: 220, startY: 220, endX: 220, endY: 180, color: '#3b82f6' },
          { id: 'a-step2', type: 'block', startX: 280, startY: 220, endX: 280, endY: 180, color: '#3b82f6' },
          { id: 'a-step3', type: 'block', startX: 340, startY: 220, endX: 340, endY: 180, color: '#3b82f6' },
          { id: 'a-step4', type: 'block', startX: 400, startY: 220, endX: 400, endY: 180, color: '#3b82f6' },
          { id: 'a-step5', type: 'block', startX: 460, startY: 220, endX: 460, endY: 180, color: '#3b82f6' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-ol-shockshed',
    category: 'OFF_OL',
    categoryLabel: 'Offensive Line (OL)',
    title: 'OL: Shock & Shed (Block Defeat)',
    subtitle: 'Violent Hands, Arm Lockout & Gap Pursuit for 2-Way Linemen',
    objective: 'Train two-way linemen to strike oncoming offensive blocks with violent hands, extend elbows to lock out, find the ball carrier, and rip off the block.',
    setup: 'Pair players up in offensive/defensive match-ups on hash marks.',
    instructions: [
      'Engage blocker with tight two-hand punch inside breastplates.',
      'Violently extend elbows to maintain separation from chest.',
      'Peek into designated gap to locate running back.',
      'Execute violent rip or club-and-swim to shed block and square up tackle.'
    ],
    equipment: 'Hit shields, footballs.',
    cues: ['Violent punch', 'Full arm extension', 'Locate the ball', 'Rip off and tackle'],
    faults: ['Catching the block with chest', 'Failing to disengage arms'],
    phases: [
      {
        name: 'PHASE 1: STRIKE, LOCKOUT & RIP',
        description: 'Lineman punches blocker, locks arms out, peeks into gap, and rips off to tackle.',
        tokens: [
          { id: 'ol-1', type: 'O', label: 'BLOCK', x: 350, y: 190, color: '#64748b' },
          { id: 'dl-1', type: 'X', label: '2-WAY', x: 350, y: 240, color: '#3b82f6', subLabel: 'Lockout' },
          { id: 'rb-1', type: 'O', label: 'RB', x: 420, y: 170, color: '#10b981' },
        ],
        arrows: [
          { id: 'a-shed', type: 'run', startX: 350, startY: 240, endX: 410, endY: 180, color: '#3b82f6', label: 'Rip & Pursue' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // WIDE RECEIVERS & TIGHT ENDS (WR/TE) - 7 DRILLS
  // ==========================================
  {
    id: 'matrix-wr-stance',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'WR: Stance & Release Package',
    subtitle: '2-Point Stance, Speed Release & Zero False Steps',
    objective: 'Receivers line up in balanced 2-point stance with inside foot up, zero false steps backward on snap, and beat press coverage with speed and single-cut releases.',
    setup: 'Receivers line up on numbers facing press corners 1 yard off LOS.',
    instructions: [
      'Assume 2-point stance: 80% weight on front inside foot, back heel elevated.',
      'Hands up relaxed in front of chest ready to defeat press jam.',
      'On snap, drive directly off front foot with zero rocking backward.',
      'Execute speed release or stick release to win outside leverage.'
    ],
    equipment: 'Cones, footballs, press corner pads.',
    cues: ['Inside foot forward', 'No rocking back', 'Hands up ready', 'Explode 5 yards'],
    faults: ['Rocking backward onto back heel before starting', 'Staring at feet'],
    phases: [
      {
        name: 'PHASE 1: STANCE & SPEED RELEASE',
        description: 'WR aligns in 2-point stance, fires directly off front cleat past press cornerback.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 350, y: 255, color: '#2563eb', subLabel: 'Inside Foot Up' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 350, y: 165, color: '#dc2626', subLabel: 'Press' },
        ],
        arrows: [
          { id: 'a-rel', type: 'run', startX: 335, startY: 245, endX: 270, endY: 80, color: '#2563eb', label: 'Speed Release' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-wr-routetree',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'WR: Route Tree Landmarks',
    subtitle: 'Slants (5y), Outs (10y) & Curls (12y) Precision',
    objective: 'Run precise depth routes: Slants at 5 yards, Out routes at 10 yards, and Curl/Comeback routes at 12 yards, snapping head around to quarterback.',
    setup: 'Place cones at 5y, 10y, and 12y depths along sideline and numbers.',
    instructions: [
      'WR takes release off LOS with vertical speed stem.',
      'Slant: Plant outside foot at 3 steps (5y) and cut 45 degrees across safety face.',
      'Out: Plant inside foot at 10 yards and snap flat 90 degrees to sideline.',
      'Curl: Drive to 12 yards, sink hips violently, take 3 choppy steps back to 10 yards.'
    ],
    equipment: '6 cones marking yardage depths, footballs.',
    cues: ['Run routes at full speed', 'Plant foot hard, no rounding', 'Snap eyes to QB', 'Catch with hands'],
    faults: ['Rounding off route breaks (allows DB to undercut)', 'Drifting on curl routes'],
    phases: [
      {
        name: 'PHASE 1: ROUTE TREE LANDMARKS GRID',
        description: 'WR demonstrates three foundational routes: 5y Slant, 10y Out, and 12y Curl with sharp cuts.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 260, y: 280, color: '#2563eb' },
          { id: 'cone-5', type: 'cone', label: '5y Slant', x: 350, y: 210, color: '#f97316' },
          { id: 'cone-10', type: 'cone', label: '10y Out', x: 150, y: 155, color: '#f97316' },
          { id: 'cone-12', type: 'cone', label: '12y Curl', x: 260, y: 120, color: '#f97316' },
        ],
        arrows: [
          { id: 'a-slant', type: 'run', startX: 260, startY: 280, endX: 345, endY: 215, color: '#2563eb', label: '1. Slant (5y)' },
          { id: 'a-out', type: 'run', startX: 260, startY: 280, endX: 155, endY: 160, color: '#3b82f6', label: '2. Out (10y)' },
          { id: 'a-curl', type: 'run', startX: 260, startY: 280, endX: 260, endY: 125, color: '#60a5fa', label: '3. Curl (12y)' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-wr-stalk',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'WR: Stalk Blocking',
    subtitle: 'Closing Cushion, Chopping Feet & Mirroring DB',
    objective: 'Close distance on perimeter defensive back, break down into balanced athletic stance, chop feet, and engage chest plate to seal perimeter run.',
    setup: 'WR aligns outside numbers; cornerback aligned 6 yards off in cover 3.',
    instructions: [
      'On snap, sprint 4 yards directly at cornerback to threaten deep pass.',
      'At 2 yards cushion, break down into wide basketball-defender stance.',
      'Buzz feet continuously; do not lunge or grab outside shoulder pads.',
      'Punch breastplate with thumbs up and mirror defender movement.'
    ],
    equipment: 'Cones, hit shield, football.',
    cues: ['Threaten deep first', 'Break down in the tunnel', 'Feet chop, do not lunge', 'Mirror like basketball'],
    faults: ['Lunging forward and whiffing on block', 'Grabbing outside jersey (holding penalty)'],
    phases: [
      {
        name: 'PHASE 1: SPRINT CUSHION & BREAKDOWN',
        description: 'WR attacks DB cushion, breaks down at 2 yards, and buzzes feet.',
        tokens: [
          { id: 'wr-1', type: 'O', label: 'WR', x: 350, y: 270, color: '#2563eb' },
          { id: 'cb-1', type: 'X', label: 'CB', x: 350, y: 140, color: '#7c3aed' },
        ],
        arrows: [
          { id: 'a-approach', type: 'run', startX: 320, startY: 265, endX: 320, endY: 180, color: '#2563eb', label: 'Close Cushion' },
          { id: 'a-stalk', type: 'block', startX: 350, startY: 180, endX: 350, endY: 155, color: '#f59e0b', label: 'Buzz & Strike' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-wr-gauntlet',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'WR: Catch & Tuck (Gauntlet)',
    subtitle: 'Middle Catch, Eyes to Tuck & Pad Squeeze',
    objective: 'Catch crossing passes over the middle of field with hands, tuck immediately away from contact, and burst through two pad holders.',
    setup: 'Receiver runs 10-yard dig across hash marks. Two coaches with pads positioned 5 yards beyond catch point.',
    instructions: [
      'Run route at full speed across field.',
      'Look ball all the way into fingertips with diamond hands.',
      'Tuck ball securely into armpit before anticipating contact.',
      'Lower shoulder level and accelerate through pad collision.'
    ],
    equipment: 'Footballs, 2 hit shields, cones.',
    cues: ['Catch with hands, not body', 'Look it into the tuck', 'Protect the rock', 'Accelerate through pads'],
    faults: ['Looking at pad holders before ball is secured (dropped pass)', 'Body catching'],
    phases: [
      {
        name: 'PHASE 1: CROSSING CATCH & PAD ENTRY',
        description: 'WR catches dig route over middle, locks ball, and charges through pads.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR', x: 280, y: 170, color: '#2563eb', subLabel: 'Catch' },
          { id: 'p1', type: 'X', label: 'PAD', x: 340, y: 160, color: '#64748b' },
          { id: 'p2', type: 'X', label: 'PAD', x: 340, y: 190, color: '#64748b' },
        ],
        arrows: [
          { id: 'a-dig', type: 'run', startX: 180, startY: 200, endX: 280, endY: 170, color: '#2563eb', label: 'Crossing Route' },
          { id: 'a-pass', type: 'pass', startX: 350, startY: 280, endX: 280, endY: 170, color: '#f59e0b', label: 'Over-Middle Ball' },
          { id: 'a-tuck', type: 'run', startX: 280, startY: 170, endX: 370, endY: 175, color: '#10b981', label: 'Tuck & Churn' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-wr-diamondhands',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'WR: Receiving Technique & Diamond Hands',
    subtitle: 'Thumbs & Index Diamond, Pinkies Below Waist & Extension',
    objective: 'Eliminate body catching. Catch passes above chest with thumbs and index fingers forming diamond shape; catch below waist with pinkies touching.',
    setup: 'Two single-file lines of receivers 8 yards from quarterbacks. Rapid-fire passing station.',
    instructions: [
      'High/Chest passes: Thumbs and index fingers together forming diamond window.',
      'Low passes (below waist): Pinkies touching, palms facing sky.',
      'Catch with outstretched arms, absorb ball with soft fingers, tuck immediately to ribs.'
    ],
    equipment: '8 footballs, target cones.',
    cues: ['Diamond hands high', 'Pinkies together low', 'Arms extended, soft fingers', 'Eyes on the laces'],
    faults: ['Catching ball against shoulder pads (rebounds off pads)', 'Hard stiff hands'],
    phases: [
      {
        name: 'PHASE 1: HAND POSITIONING STATION',
        description: 'Receivers work rapid-fire hand-placement catches at high, chest, and low ball landmarks.',
        tokens: [
          { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 270, color: '#d91b24' },
          { id: 'wr-1', type: 'O', label: 'WR1', x: 300, y: 170, color: '#2563eb', subLabel: 'Diamond' },
          { id: 'wr-2', type: 'O', label: 'WR2', x: 400, y: 170, color: '#2563eb', subLabel: 'Pinkies' },
        ],
        arrows: [
          { id: 'a-p1', type: 'pass', startX: 350, startY: 270, endX: 300, endY: 170, color: '#f59e0b', label: 'Chest Strike' },
          { id: 'a-p2', type: 'pass', startX: 350, startY: 270, endX: 400, endY: 170, color: '#f59e0b', label: 'Low Strike' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-te-inlinedrive',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'TE: Inline Drive Block & Seal',
    subtitle: 'Wide Base, Helmet Across Bow & B-Gap Seal',
    objective: 'Tight end engages defensive end on LOS, works helmet across defender face, and seals the edge for off-tackle running plays.',
    setup: 'TE aligned in 3-point stance next to OT on right hash. DE aligned in 6-technique or 7-technique.',
    instructions: [
      'Fire out low on snap with play-side foot.',
      'Place helmet across defender chest to seal inside lane.',
      'Engage breastplate with both hands, pump feet, and maintain wide base.'
    ],
    equipment: 'Hit shields, cones.',
    cues: ['Helmet across the bow', 'Drive the feet', 'Seal the edge', 'Maintain wide base'],
    faults: ['Letting DE penetrate inside into B-gap', 'Reaching without moving feet'],
    phases: [
      {
        name: 'PHASE 1: INLINE SEAL FIT',
        description: 'Tight End drives into Defensive End, works helmet across chest, and seals edge.',
        tokens: [
          { id: 'rt-1', type: 'O', label: 'RT', x: 330, y: 220, color: '#3b82f6' },
          { id: 'te-1', type: 'O', label: 'TE', x: 380, y: 220, color: '#2563eb', subLabel: 'Inline' },
          { id: 'de-1', type: 'X', label: 'DE', x: 390, y: 180, color: '#dc2626' },
        ],
        arrows: [
          { id: 'a-seal', type: 'block', startX: 380, startY: 220, endX: 405, endY: 175, color: '#2563eb', label: 'Seal DE Outside' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-te-seamrelease',
    category: 'OFF_WR',
    categoryLabel: 'Wide Receivers & Tight Ends (WR/TE)',
    title: 'TE: Seam Release & Reroute Read',
    subtitle: 'Swim Jam, Vertical Stride & Reading Safety Shell',
    objective: 'Tight end executes free release past jamming linebacker, accelerates up hash mark seam, and catches over-the-shoulder pass between safety and corner.',
    setup: 'TE on line, linebacker aligned in press 1 yard off. Free safety at 12 yards depth in middle of field.',
    instructions: [
      'Defeat linebacker collision with quick club-and-rip or swim move.',
      'Accelerate vertically up the hash marks maintaining 4 yards separation from hash.',
      'Track ball over outside shoulder and extend hands without breaking stride.'
    ],
    equipment: 'Footballs, cones.',
    cues: ['Wipe the jam', 'Sprint up the hash', 'High hands over shoulder', 'Do not look back too early'],
    faults: ['Getting knocked off course by linebacker', 'Slowing down to look for the ball'],
    phases: [
      {
        name: 'PHASE 1: RELEASE & SEAM CATCH',
        description: 'TE wipes linebacker contact on release, accelerates up the seam, and makes high catch.',
        tokens: [
          { id: 'te-1', type: 'O', label: 'TE', x: 380, y: 220, color: '#2563eb' },
          { id: 'lb-1', type: 'X', label: 'OLB', x: 380, y: 190, color: '#7c3aed' },
          { id: 'fs-1', type: 'X', label: 'FS', x: 350, y: 100, color: '#dc2626' },
        ],
        arrows: [
          { id: 'a-seam', type: 'run', startX: 380, startY: 220, endX: 390, endY: 110, color: '#2563eb', label: 'Vertical Seam' },
        ],
        zones: [],
      },
    ],
  },

  // ==========================================
  // OFFENSIVE GROUP INSTALL (TEAM) - 5 DRILLS
  // ==========================================
  {
    id: 'matrix-group-stance',
    category: 'OFF_TEAM',
    categoryLabel: 'Team Offense & Group Install',
    title: 'Team Offense: Individual Stance & Alignment',
    subtitle: 'Legal Splits, LOS Discipline & Shift Mechanics',
    objective: 'Ensure all 11 offensive players can legally align on the LOS, maintain correct offensive line and receiver splits, and avoid false start penalties.',
    setup: 'Full 11-man offensive lineup on 30-yard line with referee or coach checking line splits.',
    instructions: [
      'Call out offensive formation ("Pro Right", "Trips Left", "Spread").',
      'Team breaks huddle and sprints to line of scrimmage.',
      'Tackles and Tight Ends check alignment on Center belt buckle.',
      'Receivers check with sideline referee to confirm on or off the line of scrimmage.',
      'Hold motionless for 1 full second before snap cadence.'
    ],
    equipment: 'LOS rope or painted line, 5 footballs.',
    cues: ['Check with the official', 'Cover the tackle', 'Linemen eye the ball', 'Zero motion pre-snap'],
    faults: ['Covering an eligible receiver illegally', 'Lining up in the neutral zone'],
    phases: [
      {
        name: 'PHASE 1: 11-MAN PRE-SNAP FORMATION CHECK',
        description: 'Full offensive unit aligns legally on line with correct line splits and receiver spacing.',
        tokens: [
          { id: 'wr-l', type: 'O', label: 'X', x: 140, y: 220, color: '#2563eb' },
          { id: 'lt', type: 'O', label: 'LT', x: 260, y: 220, color: '#3b82f6' },
          { id: 'lg', type: 'O', label: 'LG', x: 300, y: 220, color: '#3b82f6' },
          { id: 'c', type: 'O', label: 'C', x: 340, y: 220, color: '#1a1a24' },
          { id: 'rg', type: 'O', label: 'RG', x: 380, y: 220, color: '#3b82f6' },
          { id: 'rt', type: 'O', label: 'RT', x: 420, y: 220, color: '#3b82f6' },
          { id: 'te', type: 'O', label: 'TE', x: 460, y: 220, color: '#2563eb' },
          { id: 'wr-r', type: 'O', label: 'Z', x: 560, y: 230, color: '#2563eb' },
          { id: 'qb', type: 'O', label: 'QB', x: 340, y: 260, color: '#d91b24' },
          { id: 'fb', type: 'O', label: 'FB', x: 340, y: 295, color: '#059669' },
          { id: 'rb', type: 'O', label: 'TB', x: 340, y: 330, color: '#059669' },
        ],
        arrows: [],
        zones: [
          { id: 'z-los', name: 'LINE OF SCRIMMAGE', cx: 350, cy: 220, rx: 250, ry: 10, color: '#38bdf8', opacity: 0.2 },
        ],
      },
    ],
  },
  {
    id: 'matrix-group-qbcenter',
    category: 'OFF_TEAM',
    categoryLabel: 'Team Offense & Group Install',
    title: 'Team Offense: QB & Center Exchange',
    subtitle: 'Under Center & Shotgun Cadence Reps',
    objective: 'Pair all quarterbacks and centers on team for 20 under-center and 20 shotgun snaps on coach cadence, building flawless snap muscle memory.',
    setup: '3 separate QB-Center pairs aligned 5 yards apart along 20-yard line.',
    instructions: [
      'Pair 1 executes under center exchange; Pair 2 executes shotgun snaps.',
      'Rotate pairs every 10 reps.',
      'Center focuses on dead-ball snapping into QB hands before taking pass protection step.',
      'QB focuses on keeping hands under center until ball touches palms.'
    ],
    equipment: '4 footballs, yard line.',
    cues: ['Snap on sound', 'Firm hand in palm', 'Lock thumbs together', 'Zero dropped snaps'],
    faults: ['Center looking up before ball is delivered', 'QB pulling hands away prematurely'],
    phases: [
      {
        name: 'PHASE 1: 3-STATION SNAP REPETITIONS',
        description: 'Three parallel center-quarterback pairs execute high-repetition snap exchanges.',
        tokens: [
          { id: 'c-1', type: 'O', label: 'C1', x: 220, y: 200, color: '#1a1a24' },
          { id: 'qb-1', type: 'O', label: 'QB1', x: 220, y: 240, color: '#d91b24' },
          { id: 'c-2', type: 'O', label: 'C2', x: 350, y: 200, color: '#1a1a24' },
          { id: 'qb-2', type: 'O', label: 'QB2', x: 350, y: 270, color: '#d91b24', subLabel: 'Gun' },
          { id: 'c-3', type: 'O', label: 'C3', x: 480, y: 200, color: '#1a1a24' },
          { id: 'qb-3', type: 'O', label: 'QB3', x: 480, y: 240, color: '#d91b24' },
        ],
        arrows: [
          { id: 'a-s1', type: 'pass', startX: 220, startY: 200, endX: 220, endY: 240, color: '#e2e8f0', dashed: true },
          { id: 'a-s2', type: 'pass', startX: 350, startY: 200, endX: 350, endY: 270, color: '#e2e8f0', dashed: true },
          { id: 'a-s3', type: 'pass', startX: 480, startY: 200, endX: 480, endY: 240, color: '#e2e8f0', dashed: true },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-group-walkthrough',
    category: 'OFF_TEAM',
    categoryLabel: 'Team Offense & Group Install',
    title: 'Team Offense: Offensive Play Install (Walkthrough)',
    subtitle: '11-Man Shell Walkthrough & Mental Reps',
    objective: 'Gather full 11-man unit without helmets or pads. Walk through new plays, audibles, motion timing, and blocking assignments against scout cans.',
    setup: 'Cones or garbage cans set up simulating defensive front. Offense huddles 7 yards back.',
    instructions: [
      'Coach calls play in huddle ("I-Right, 24 Power on Two").',
      'Offense breaks huddle on clap and sets on line.',
      'Execute motion or shift on first sound.',
      'Walk through assignment slowly to confirm every player knows their blocking fit.'
    ],
    equipment: '6 landmark cones / cans, whiteboard clipboard.',
    cues: ['Know your assignment', 'Communicate line calls', 'Timing on motion', 'Finish downfield'],
    faults: ['Confusion on line calls', 'Players rushing instead of walking through details'],
    phases: [
      {
        name: 'PHASE 1: SLOW-MOTION PLAY WALKTHROUGH',
        description: 'Full offense walks through 24 Power run play vs scout cans, checking every blocking fit.',
        tokens: [
          { id: 'c', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'qb', type: 'O', label: 'QB', x: 350, y: 255, color: '#d91b24' },
          { id: 'fb', type: 'O', label: 'FB', x: 350, y: 290, color: '#059669', subLabel: 'Kick DE' },
          { id: 'rb', type: 'O', label: 'TB', x: 350, y: 325, color: '#059669', subLabel: 'Follow FB' },
          { id: 'can-1', type: 'cone', label: 'DT', x: 310, y: 190, color: '#94a3b8' },
          { id: 'can-2', type: 'cone', label: 'DE', x: 430, y: 190, color: '#94a3b8' },
        ],
        arrows: [
          { id: 'a-fb', type: 'block', startX: 350, startY: 290, endX: 420, endY: 195, color: '#059669', label: 'FB Kickout' },
          { id: 'a-rb', type: 'run', startX: 350, startY: 325, endX: 390, endY: 170, color: '#10b981', label: 'Follow into C-Gap' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-group-skelly',
    category: 'OFF_TEAM',
    categoryLabel: 'Team Offense & Group Install',
    title: 'Team Offense: Full Offensive Install & Skelly',
    subtitle: '7-on-7 Passing Game & Coverage Shell Reads',
    objective: '7-on-7 pass skelly: QB reads defensive coverage shells (Cover 2, Cover 3, Man) and throws on-time to receivers running full route trees.',
    setup: 'QB, RB, and 4 WR/TE vs 3 LBs and 4 DBs. LOS at 40-yard line.',
    instructions: [
      'Offense huddles and runs weekly passing concepts (Mesh, Smash, Flood, Four Verticals).',
      'QB checks coverage shell pre-snap, takes 5-step drop, reads high-low route progression.',
      'Defense plays pass only with two-hand touch on receiver.'
    ],
    equipment: 'Footballs, cones, 7-on-7 defense.',
    cues: ['Read high to low', 'Precise route landmarks', 'Throw on the break', 'Communicate coverages'],
    faults: ['QB holding ball past 3.5 seconds (simulated sack)', 'Receivers drifting on routes'],
    phases: [
      {
        name: 'PHASE 1: 7-ON-7 FLOOD CONCEPT VS COVER 3',
        description: 'QB reads flat defender and hits intermediate 10-yard out in 3-level flood concept.',
        tokens: [
          { id: 'qb', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24' },
          { id: 'wr-deep', type: 'O', label: 'WR1', x: 500, y: 120, color: '#2563eb', subLabel: 'Go Clear' },
          { id: 'wr-out', type: 'O', label: 'WR2', x: 480, y: 180, color: '#2563eb', subLabel: '10y Out' },
          { id: 'rb-flat', type: 'O', label: 'RB', x: 440, y: 230, color: '#059669', subLabel: 'Flat' },
          { id: 'cb', type: 'X', label: 'CB', x: 500, y: 140, color: '#dc2626' },
        ],
        arrows: [
          { id: 'a-throw', type: 'pass', startX: 350, startY: 280, endX: 480, endY: 180, color: '#f59e0b', label: 'On-Time Strike' },
        ],
        zones: [],
      },
    ],
  },
  {
    id: 'matrix-group-11on11',
    category: 'OFF_TEAM',
    categoryLabel: 'Team Offense & Group Install',
    title: 'Team Offense: 11-on-11 Run Game Scrimmage',
    subtitle: 'Live Blocking, Gap Fits & Full-Speed Contact',
    objective: 'Live 11-on-11 contact session focusing on physical run blocking, ball carrier vision, and competitive drive on 3rd & short situations.',
    setup: 'Full 11 starting offense vs starting defense on 25-yard line with down & distance markers.',
    instructions: [
      'Offense runs strictly inside and outside run plays against starting front.',
      'Live blocking through whistle.',
      'Defensive players wrap and thud ball carrier to ground safely.'
    ],
    equipment: 'Full pads, footballs, chains / down box.',
    cues: ['Move the line of scrimmage', 'Pound the rock', 'Wrap and squeeze', 'Play to the whistle'],
    faults: ['Missing second-level linebacker blocks', 'Fumbling in heavy traffic'],
    phases: [
      {
        name: 'PHASE 1: 11-ON-11 LIVE SCRIMMAGE SNAP',
        description: 'Full starting 11 offense executes live inside zone run against 4-4 defensive front.',
        tokens: [
          { id: 'c', type: 'O', label: 'C', x: 350, y: 220, color: '#1a1a24' },
          { id: 'qb', type: 'O', label: 'QB', x: 350, y: 260, color: '#d91b24' },
          { id: 'rb', type: 'O', label: 'RB', x: 350, y: 310, color: '#059669' },
          { id: 'dt1', type: 'X', label: 'DT', x: 330, y: 200, color: '#dc2626' },
          { id: 'dt2', type: 'X', label: 'DT', x: 370, y: 200, color: '#dc2626' },
          { id: 'mlb', type: 'X', label: 'MLB', x: 350, y: 160, color: '#7c3aed' },
        ],
        arrows: [
          { id: 'a-zone', type: 'run', startX: 350, startY: 310, endX: 330, endY: 180, color: '#059669', label: 'Inside Zone Cut' },
        ],
        zones: [],
      },
    ],
  },
];
