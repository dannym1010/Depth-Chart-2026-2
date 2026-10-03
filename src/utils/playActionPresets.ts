import { isDefenseRole, type PlayStroke, type DrawKind } from './footballEngine';

export type ActionCategory = 'route' | 'run' | 'block' | 'motion' | 'drop' | 'coverage' | 'rush';

export interface PlayerActionPreset {
  id: string;
  name: string;
  category: ActionCategory;
  kind: DrawKind;
  description: string;
  hole?: number;
  generateStroke: (
    node: { x: number; y: number; role: string },
    ctx: { holesXs: Record<number, number>; qbNode?: { x: number; y: number } | null }
  ) => PlayStroke;
}

export interface PositionMeta {
  role: string;
  name: string;
  short: string;
  group: 'qb' | 'back' | 'receiver' | 'lineman' | 'defense';
  description: string;
  eligible: boolean;
}

function pt(x: number, y: number) {
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

export function getPositionMeta(role: string, isLine?: boolean): PositionMeta {
  if (isDefenseRole(role) || /^(SS|MLB|NB)/i.test(role)) {
    return {
      role,
      name: role.toUpperCase(),
      short: role.toUpperCase(),
      group: 'defense',
      description: 'Defensive assignment & pursuit',
      eligible: false,
    };
  }

  if (role === '1' || role === 'QB') {
    return {
      role,
      name: 'Quarterback',
      short: 'QB',
      group: 'qb',
      description: 'Field general, pass drops, keeps & options',
      eligible: true,
    };
  }

  if (role === '2' || role === 'FB') {
    return {
      role,
      name: 'Fullback',
      short: 'FB',
      group: 'back',
      description: 'Lead blocker, inside dives & check-downs',
      eligible: true,
    };
  }

  if (role === '3' || role === 'TB' || role === 'HB' || role === 'RB') {
    return {
      role,
      name: 'Tailback / RB',
      short: 'TB',
      group: 'back',
      description: 'Primary ball carrier, perimeter & cutback runs',
      eligible: true,
    };
  }

  if (role === '4' || role === 'WB' || role === 'SB') {
    return {
      role,
      name: 'Wingback / Extra Back',
      short: 'WB',
      group: 'back',
      description: 'Motion runner, edge blocker & flats target',
      eligible: true,
    };
  }

  if (role === 'X') {
    return {
      role,
      name: 'X Receiver (Split End)',
      short: 'X WR',
      group: 'receiver',
      description: 'Boundary wide receiver, vertical route tree',
      eligible: true,
    };
  }

  if (role === 'Z') {
    return {
      role,
      name: 'Z Receiver (Flanker)',
      short: 'Z WR',
      group: 'receiver',
      description: 'Field wide receiver, motions & deep routes',
      eligible: true,
    };
  }

  if (role.startsWith('Y')) {
    return {
      role,
      name: 'Y Tight End',
      short: role,
      group: 'receiver',
      description: 'In-line edge blocker & seam/crossing target',
      eligible: true,
    };
  }

  if (role.startsWith('W') || role === 'H') {
    return {
      role,
      name: 'Slot / H-Back',
      short: role,
      group: 'receiver',
      description: 'Slot receiver, underneath cross & bubble screens',
      eligible: true,
    };
  }

  if (role === 'C') {
    return {
      role,
      name: 'Center',
      short: 'C',
      group: 'lineman',
      description: 'Snaps ball, calls front, base & combo blocks',
      eligible: false,
    };
  }

  if (role === 'LG' || role === 'RG') {
    return {
      role,
      name: role === 'LG' ? 'Left Guard' : 'Right Guard',
      short: role,
      group: 'lineman',
      description: 'Interior pass pro, zone steps & pull kickouts',
      eligible: false,
    };
  }

  if (role === 'LT' || role === 'RT') {
    return {
      role,
      name: role === 'LT' ? 'Left Tackle' : 'Right Tackle',
      short: role,
      group: 'lineman',
      description: 'Edge protection, drive blocks & reach seals',
      eligible: false,
    };
  }

  if (isLine) {
    return {
      role,
      name: `Offensive Line (${role})`,
      short: role,
      group: 'lineman',
      description: 'Line of scrimmage run & pass protection',
      eligible: false,
    };
  }

  return {
    role,
    name: role,
    short: role,
    group: 'receiver',
    description: 'Skill player assignment',
    eligible: true,
  };
}

/**
 * Returns tailored action presets for a given football position.
 */
export function getActionsForPosition(role: string, isLine?: boolean): PlayerActionPreset[] {
  const meta = getPositionMeta(role, isLine);

  switch (meta.group) {
    case 'qb':
      return [
        // Drops
        {
          id: 'qb_3_step',
          name: '3-Step Drop',
          category: 'drop',
          kind: 'pass',
          description: 'Quick passing rhythm drop to pocket (~3 yards back)',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, n.y - 2.8)],
          }),
        },
        {
          id: 'qb_5_step',
          name: '5-Step Drop',
          category: 'drop',
          kind: 'pass',
          description: 'Deep drop for intermediate & downfield passing routes (~4.5 yards)',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, n.y - 4.5)],
          }),
        },
        {
          id: 'qb_rollout_right',
          name: 'Rollout / Sprint Right',
          category: 'drop',
          kind: 'run',
          description: 'Sprint out to the right numbers to open passing angles',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x + 1.8, n.y - 0.4), pt(n.x + 5.8, n.y + 0.6)],
          }),
        },
        {
          id: 'qb_rollout_left',
          name: 'Rollout / Sprint Left',
          category: 'drop',
          kind: 'run',
          description: 'Sprint out to the left numbers to open passing angles',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x - 1.8, n.y - 0.4), pt(n.x - 5.8, n.y + 0.6)],
          }),
        },
        {
          id: 'qb_boot_right',
          name: 'Play-Action Boot Right',
          category: 'drop',
          kind: 'run',
          description: 'Fake handoff to left back, naked bootleg roll to right',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x - 1.2, n.y + 0.3), pt(n.x + 1.6, n.y - 0.8), pt(n.x + 6, n.y + 0.5)],
          }),
        },
        {
          id: 'qb_boot_left',
          name: 'Play-Action Boot Left',
          category: 'drop',
          kind: 'run',
          description: 'Fake handoff to right back, naked bootleg roll to left',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x + 1.2, n.y + 0.3), pt(n.x - 1.6, n.y - 0.8), pt(n.x - 6, n.y + 0.5)],
          }),
        },
        // Runs / Keeps
        {
          id: 'qb_sneak',
          name: 'QB Sneak (5 Hole)',
          category: 'run',
          kind: 'run',
          hole: 5,
          description: 'Immediate surge behind Center for short yardage / goal line',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[5] ?? 0;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx, 0.2), pt(hx, 2.8)],
            };
          },
        },
        {
          id: 'qb_keep_right',
          name: 'QB Keep / Sweep Right (1 Hole)',
          category: 'run',
          kind: 'run',
          hole: 1,
          description: 'Keep around the right perimeter outside the tight end',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, n.y + 0.5), pt(hx, 0.3), pt(hx + 1.2, 3.2)],
            };
          },
        },
        {
          id: 'qb_keep_left',
          name: 'QB Keep / Sweep Left (9 Hole)',
          category: 'run',
          kind: 'run',
          hole: 9,
          description: 'Keep around the left perimeter outside the tight end',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, n.y + 0.5), pt(hx, 0.3), pt(hx - 1.2, 3.2)],
            };
          },
        },
        {
          id: 'qb_draw',
          name: 'QB Draw (Middle)',
          category: 'run',
          kind: 'run',
          hole: 5,
          description: 'Flash pass drop, pause, then burst through the A-gap',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[5] ?? 0;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.2), pt(hx, 0.2), pt(hx, 3.5)],
            };
          },
        },
        {
          id: 'qb_option_pitch_r',
          name: 'Speed Option Pitch Right',
          category: 'run',
          kind: 'run',
          description: 'Attack right defensive end, pitch or keep down sideline',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x + 4.2, n.y + 0.6), pt(n.x + 8, n.y + 2)],
          }),
        },
        {
          id: 'qb_option_pitch_l',
          name: 'Speed Option Pitch Left',
          category: 'run',
          kind: 'run',
          description: 'Attack left defensive end, pitch or keep down sideline',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x - 4.2, n.y + 0.6), pt(n.x - 8, n.y + 2)],
          }),
        },
      ];

    case 'back':
      return [
        // Power
        {
          id: 'rb_power_r',
          name: 'Power Right (Off-Tackle)',
          category: 'run',
          kind: 'run',
          description: 'Follow pulling guard tight to kickout block off right tackle',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[2] ?? 5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.5), pt(hx, 0.2), pt(hx + 0.4, 3.8)],
            };
          },
        },
        {
          id: 'rb_power_l',
          name: 'Power Left (Off-Tackle)',
          category: 'run',
          kind: 'run',
          description: 'Follow pulling guard tight to kickout block off left tackle',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[8] ?? -5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.5), pt(hx, 0.2), pt(hx - 0.4, 3.8)],
            };
          },
        },
        // Inside Zone
        {
          id: 'rb_inside_zone_r',
          name: 'Inside Zone Right',
          category: 'run',
          kind: 'run',
          description: 'Aim for right A/B-gap, read first down lineman to bang, bounce, or bend',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[4] ?? 3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.5, -0.4), pt(hx, 0.2), pt(hx + 0.3, 3.8)],
            };
          },
        },
        {
          id: 'rb_inside_zone_l',
          name: 'Inside Zone Left',
          category: 'run',
          kind: 'run',
          description: 'Aim for left A/B-gap, read first down lineman to bang, bounce, or bend',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[6] ?? -3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.5, -0.4), pt(hx, 0.2), pt(hx - 0.3, 3.8)],
            };
          },
        },
        // Outside Zone / Stretch
        {
          id: 'rb_outside_zone_r',
          name: 'Outside Zone / Stretch Right',
          category: 'run',
          kind: 'run',
          description: 'Lateral stretch track toward right TE hip before vertical cut',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + 2.4, n.y + 0.3), pt(hx * 0.85, -0.4), pt(hx, 0.4), pt(hx + 1.2, 3.8)],
            };
          },
        },
        {
          id: 'rb_outside_zone_l',
          name: 'Outside Zone / Stretch Left',
          category: 'run',
          kind: 'run',
          description: 'Lateral stretch track toward left TE hip before vertical cut',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x - 2.4, n.y + 0.3), pt(hx * 0.85, -0.4), pt(hx, 0.4), pt(hx - 1.2, 3.8)],
            };
          },
        },
        // Dive
        {
          id: 'rb_dive_quick',
          name: 'Quick Dive (Downhill Plunge)',
          category: 'run',
          kind: 'run',
          description: 'Fast hitting downhill handoff straight into A-gap',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(0, -0.3), pt(0, 0.2), pt(0, 3.6)],
          }),
        },
        {
          id: 'rb_counter_weak',
          name: 'Counter / Misdirection Left',
          category: 'run',
          kind: 'run',
          hole: 3,
          description: 'Fake right, cut back hard off left tackle (3 hole)',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[3] ?? -5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + 2.2, n.y + 0.4), pt(hx * 0.4, -0.6), pt(hx, 0.2), pt(hx - 0.3, 3.6)],
            };
          },
        },
        {
          id: 'rb_counter_strong',
          name: 'Counter / Misdirection Right',
          category: 'run',
          kind: 'run',
          hole: 2,
          description: 'Fake left, cut back hard off right tackle (2 hole)',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[2] ?? 5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x - 2.2, n.y + 0.4), pt(hx * 0.4, -0.6), pt(hx, 0.2), pt(hx + 0.3, 3.6)],
            };
          },
        },
        // Buck Sweep
        {
          id: 'rb_buck_sweep_r',
          name: 'Buck Sweep Right',
          category: 'run',
          kind: 'run',
          hole: 1,
          description: 'Sweep outside right behind dual pulling guards into the alley',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + 2.0, n.y + 0.35), pt(hx * 0.8, -0.5), pt(hx, 0.4), pt(hx + 1.2, 3.8)],
            };
          },
        },
        {
          id: 'rb_buck_sweep_l',
          name: 'Buck Sweep Left',
          category: 'run',
          kind: 'run',
          hole: 9,
          description: 'Sweep outside left behind dual pulling guards into the alley',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x - 2.0, n.y + 0.35), pt(hx * 0.8, -0.5), pt(hx, 0.4), pt(hx - 1.2, 3.8)],
            };
          },
        },
        // Trap
        {
          id: 'rb_trap_r',
          name: 'Trap Dive Right (2 Hole)',
          category: 'run',
          kind: 'run',
          hole: 2,
          description: 'Quick-hitting dive inside off guard trap block',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[2] ?? 5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.4), pt(hx, 0.2), pt(hx + 0.3, 3.6)],
            };
          },
        },
        {
          id: 'rb_trap_l',
          name: 'Trap Dive Left (8 Hole)',
          category: 'run',
          kind: 'run',
          hole: 8,
          description: 'Quick-hitting dive inside off guard trap block',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[8] ?? -5.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.4), pt(hx, 0.2), pt(hx - 0.3, 3.6)],
            };
          },
        },
        // Belly
        {
          id: 'rb_belly_r',
          name: 'Belly Blast Right (B-Gap)',
          category: 'run',
          kind: 'run',
          hole: 4,
          description: 'Downhill off-tackle blast into B-gap behind down blocks',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[4] ?? 3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.75, -0.4), pt(hx, 0.2), pt(hx, 3.6)],
            };
          },
        },
        {
          id: 'rb_belly_l',
          name: 'Belly Blast Left (B-Gap)',
          category: 'run',
          kind: 'run',
          hole: 6,
          description: 'Downhill off-tackle blast into B-gap behind down blocks',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[6] ?? -3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.75, -0.4), pt(hx, 0.2), pt(hx, 3.6)],
            };
          },
        },
        // Pin & Pull
        {
          id: 'rb_pin_pull_r',
          name: 'Pin & Pull Sweep Right',
          category: 'run',
          kind: 'run',
          hole: 1,
          description: 'Follow pulling linemen around pinned front into right perimeter',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + 2.2, n.y + 0.3), pt(hx * 0.85, -0.5), pt(hx, 0.45), pt(hx + 1.2, 3.8)],
            };
          },
        },
        {
          id: 'rb_pin_pull_l',
          name: 'Pin & Pull Sweep Left',
          category: 'run',
          kind: 'run',
          hole: 9,
          description: 'Follow pulling linemen around pinned front into left perimeter',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x - 2.2, n.y + 0.3), pt(hx * 0.85, -0.5), pt(hx, 0.45), pt(hx - 1.2, 3.8)],
            };
          },
        },
        // Duo
        {
          id: 'rb_duo_r',
          name: 'Duo Power Right',
          category: 'run',
          kind: 'run',
          hole: 4,
          description: 'Downhill power track reading Mike LB behind double-team combos',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[4] ?? 3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.4), pt(hx, 0.2), pt(hx + 0.3, 3.8)],
            };
          },
        },
        {
          id: 'rb_duo_l',
          name: 'Duo Power Left',
          category: 'run',
          kind: 'run',
          hole: 6,
          description: 'Downhill power track reading Mike LB behind double-team combos',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[6] ?? -3.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(hx * 0.6, -0.4), pt(hx, 0.2), pt(hx - 0.3, 3.8)],
            };
          },
        },
        // Jet Sweep
        {
          id: 'rb_jet_sweep_r',
          name: 'Jet Sweep Right',
          category: 'run',
          kind: 'run',
          hole: 1,
          description: 'Full sprint motion sweep around right perimeter',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + (hx - n.x) * 0.5, -0.4), pt(hx, 0.35), pt(hx + 1.5, 4.0)],
            };
          },
        },
        {
          id: 'rb_jet_sweep_l',
          name: 'Jet Sweep Left',
          category: 'run',
          kind: 'run',
          hole: 9,
          description: 'Full sprint motion sweep around left perimeter',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + (hx - n.x) * 0.5, -0.4), pt(hx, 0.35), pt(hx - 1.5, 4.0)],
            };
          },
        },
        // Reverse
        {
          id: 'rb_reverse_r',
          name: 'Reverse Hand Right',
          category: 'run',
          kind: 'run',
          hole: 1,
          description: 'Counter-flow reverse loop heading around right edge',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(0, -2.2), pt(hx * 0.7, -0.6), pt(hx, 0.35), pt(hx + 1.3, 3.8)],
            };
          },
        },
        {
          id: 'rb_reverse_l',
          name: 'Reverse Hand Left',
          category: 'run',
          kind: 'run',
          hole: 9,
          description: 'Counter-flow reverse loop heading around left edge',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(0, -2.2), pt(hx * 0.7, -0.6), pt(hx, 0.35), pt(hx - 1.3, 3.8)],
            };
          },
        },
        // Draw
        {
          id: 'rb_draw',
          name: 'RB Draw Delay',
          category: 'run',
          kind: 'run',
          hole: 5,
          description: 'Show pass block hesitation, then burst through middle crease',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x, n.y + 0.35), pt(0, -0.3), pt(0, 0.2), pt(0, 3.8)],
          }),
        },
        // FB Lead / Kickout blocks
        {
          id: 'rb_fb_lead_iso',
          name: 'Lead Iso Block',
          category: 'block',
          kind: 'block',
          description: 'Lead clean through designated hole and isolate/blow up linebacker',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x * 0.5, -0.3), pt(n.x, 1.85)],
          }),
        },
        {
          id: 'rb_fb_kickout_r',
          name: 'Kickout Block (Right Edge)',
          category: 'block',
          kind: 'block',
          description: 'J-block right defensive end / edge defender outside for Power',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[2] ?? 5.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(hx + 1.2, -0.4), pt(hx + 1.8, 0.85)],
            };
          },
        },
        {
          id: 'rb_fb_kickout_l',
          name: 'Kickout Block (Left Edge)',
          category: 'block',
          kind: 'block',
          description: 'J-block left defensive end / edge defender outside for Power',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[8] ?? -5.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(hx - 1.2, -0.4), pt(hx - 1.8, 0.85)],
            };
          },
        },
        // Routes for backs
        {
          id: 'rb_swing_right',
          name: 'Swing Route Right',
          category: 'route',
          kind: 'pass',
          description: 'Flare out to the right flat to catch in stride',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x + 3.8, n.y + 0.3), pt(n.x + 7.5, n.y + 1.4)],
          }),
        },
        {
          id: 'rb_swing_left',
          name: 'Swing Route Left',
          category: 'route',
          kind: 'pass',
          description: 'Flare out to the left flat to catch in stride',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x - 3.8, n.y + 0.3), pt(n.x - 7.5, n.y + 1.4)],
          }),
        },
        {
          id: 'rb_wheel_right',
          name: 'Wheel Route Right',
          category: 'route',
          kind: 'pass',
          description: 'Arc into right flat then turn straight up the sideline',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x + 4.2, n.y + 0.5), pt(n.x + 8, 1), pt(n.x + 8.2, 7.5)],
          }),
        },
        {
          id: 'rb_wheel_left',
          name: 'Wheel Route Left',
          category: 'route',
          kind: 'pass',
          description: 'Arc into left flat then turn straight up the sideline',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x - 4.2, n.y + 0.5), pt(n.x - 8, 1), pt(n.x - 8.2, 7.5)],
          }),
        },
        {
          id: 'rb_angle_texas',
          name: 'Angle / Texas Route',
          category: 'route',
          kind: 'pass',
          description: 'Stem toward the flat, sharp 45° angle back into middle',
          generateStroke: (n) => {
            const side = n.x >= 0 ? 1 : -1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x + side * 3.4, n.y + 0.8), pt(0, 3.2)],
            };
          },
        },
        {
          id: 'rb_check_release',
          name: 'Check & Release (Middle)',
          category: 'route',
          kind: 'pass',
          description: 'Check pass pro blitz, then slip into open middle zone',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, -0.4), pt(n.x, 2.2)],
          }),
        },
        // Lead blocks
        {
          id: 'rb_lead_hole_2',
          name: 'Lead Block · Off-Tackle Right (2 Hole)',
          category: 'block',
          kind: 'block',
          hole: 2,
          description: 'Lead through the 2 hole to kick out playside linebacker',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[2] ?? 5.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(hx * 0.7, -0.4), pt(hx + 0.4, 1.3)],
            };
          },
        },
        {
          id: 'rb_lead_hole_3',
          name: 'Lead Block · Off-Tackle Left (3 Hole)',
          category: 'block',
          kind: 'block',
          hole: 3,
          description: 'Lead through the 3 hole to kick out playside linebacker',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[3] ?? -5.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(hx * 0.7, -0.4), pt(hx - 0.4, 1.3)],
            };
          },
        },
        {
          id: 'rb_lead_iso',
          name: 'Lead Block · Inside Iso (A-Gap)',
          category: 'block',
          kind: 'block',
          hole: 5,
          description: 'Blast straight through A-gap onto middle linebacker',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(0, -0.2), pt(0, 1.4)],
          }),
        },
        {
          id: 'rb_pass_pro',
          name: 'Pass Protection (Scan & Anchor)',
          category: 'block',
          kind: 'block',
          description: 'Scan edge rusher / blitzing linebacker and anchor pocket',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x * 0.7, n.y + 0.7)],
          }),
        },
      ];

    case 'receiver': {
      return [
        // Standard Route Tree 0-9
        {
          id: 'rec_0_hitch',
          name: '0 · Hitch / Stop',
          category: 'route',
          kind: 'pass',
          description: 'Drive 5 yards vertical, snap back 1 yard toward QB',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 5.2), pt(n.x - side * 0.6, n.y + 4.3)],
            };
          },
        },
        {
          id: 'rec_1_slant',
          name: '1 · Quick Slant',
          category: 'route',
          kind: 'pass',
          description: '3 steps vertical, sharp 45° cut across the middle',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 2.5), pt(n.x - side * 5.5, n.y + 5)],
            };
          },
        },
        {
          id: 'rec_2_out',
          name: '2 · Quick Out',
          category: 'route',
          kind: 'pass',
          description: '5 yards vertical, crisp 90° break toward the sideline',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 4.8), pt(n.x + side * 4.8, n.y + 4.8)],
            };
          },
        },
        {
          id: 'rec_3_dig',
          name: '3 · Deep In / Dig',
          category: 'route',
          kind: 'pass',
          description: '10 yards vertical, 90° cut across the middle behind linebackers',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 8), pt(n.x - side * 7.5, n.y + 8)],
            };
          },
        },
        {
          id: 'rec_4_comeback',
          name: '4 · Comeback',
          category: 'route',
          kind: 'pass',
          description: '10 yards vertical, snap back 45° toward sideline',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 9), pt(n.x + side * 2.8, n.y + 7)],
            };
          },
        },
        {
          id: 'rec_5_deep_out',
          name: '5 · Deep Out',
          category: 'route',
          kind: 'pass',
          description: '10 yards vertical, sharp 90° cut toward the sideline',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 8.5), pt(n.x + side * 5.5, n.y + 8.5)],
            };
          },
        },
        {
          id: 'rec_6_curl',
          name: '6 · Deep Curl / Hook',
          category: 'route',
          kind: 'pass',
          description: '10-12 yards vertical, plant and turn back inside toward QB',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 9), pt(n.x - side * 0.8, n.y + 7.8)],
            };
          },
        },
        {
          id: 'rec_7_corner',
          name: '7 · Corner / Flag',
          category: 'route',
          kind: 'pass',
          description: '8-10 yards vertical, 45° angle break toward back pylon',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 7.5), pt(n.x + side * 5.8, n.y + 11)],
            };
          },
        },
        {
          id: 'rec_8_post',
          name: '8 · Post',
          category: 'route',
          kind: 'pass',
          description: '8-10 yards vertical, 45° break toward center goalposts',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x, n.y + 7.5), pt(n.x - side * 6, n.y + 11.2)],
            };
          },
        },
        {
          id: 'rec_9_go',
          name: '9 · Go / Fade / Streak',
          category: 'route',
          kind: 'pass',
          description: 'Full vertical speed route down the sideline / boundary',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, n.y + 11.8)],
          }),
        },
        {
          id: 'rec_drag_cross',
          name: 'Drag / Shallow Cross',
          category: 'route',
          kind: 'pass',
          description: 'Shallow crossing route underneath linebackers across formation',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x - side * 1.5, n.y + 1.8), pt(-n.x * 0.65, n.y + 2.4)],
            };
          },
        },
        {
          id: 'rec_bubble_screen',
          name: 'Bubble Screen',
          category: 'route',
          kind: 'pass',
          description: 'Backpedal outward to catch screen behind blockers',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x + side * 2.2, n.y - 0.7), pt(n.x + side * 4.8, n.y + 1.5)],
            };
          },
        },
        {
          id: 'rec_wheel',
          name: 'Wheel Route (From Slot)',
          category: 'route',
          kind: 'pass',
          description: 'Stem toward sideline then turn vertical down field',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x + side * 3, n.y + 2), pt(n.x + side * 3.4, n.y + 10.5)],
            };
          },
        },
        // Receiver blocking
        {
          id: 'rec_stalk_block',
          name: 'Stalk Block (Cornerback)',
          category: 'block',
          kind: 'block',
          description: 'Drive 3 yards downfield and mirror cornerback to open edge',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x, n.y + 3.2)],
          }),
        },
        {
          id: 'rec_crack_block',
          name: 'Crack Block (Inside LB/Safety)',
          category: 'block',
          kind: 'block',
          description: 'Angle hard down inside to blindside block linebacker or safety',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x - side * 5.8, n.y + 1.2)],
            };
          },
        },
        {
          id: 'rec_down_block',
          name: 'Down / Seal Block (TE/Wing)',
          category: 'block',
          kind: 'block',
          description: 'Down block inside to seal the perimeter for runner',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x - side * 2, n.y + 0.9)],
            };
          },
        },
        // Motions
        {
          id: 'rec_jet_motion',
          name: 'Jet Motion Across',
          category: 'motion',
          kind: 'run',
          description: 'Full speed pre-snap motion across the backfield',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(0, -1.6), pt(-n.x * 0.8, -1.6)],
          }),
        },
        {
          id: 'rec_orbit_motion',
          name: 'Orbit Motion (Deep)',
          category: 'motion',
          kind: 'run',
          description: 'Arc motion circling deep behind quarterback',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(n.x * 0.5, -3.4), pt(0, -4.4), pt(-n.x * 0.5, -3.4)],
          }),
        },
      ];
    }

    case 'lineman':
      return [
        // Run blocks
        {
          id: 'ol_drive_block',
          name: 'Drive / Base Block',
          category: 'block',
          kind: 'block',
          description: 'Straight ahead surge into defensive lineman on LOS',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x, n.y + 1.35)],
          }),
        },
        {
          id: 'ol_reach_right',
          name: 'Reach Block Right',
          category: 'block',
          kind: 'block',
          description: 'Lateral step playside right to hook and seal outside defender',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x + 1.35, n.y + 1.15)],
          }),
        },
        {
          id: 'ol_reach_left',
          name: 'Reach Block Left',
          category: 'block',
          kind: 'block',
          description: 'Lateral step playside left to hook and seal outside defender',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x - 1.35, n.y + 1.15)],
          }),
        },
        {
          id: 'ol_down_inside',
          name: 'Down Block (Inside)',
          category: 'block',
          kind: 'block',
          description: 'Angle down inside on DT/Nose tackle to clear running lane',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x - side * 1.4, n.y + 0.95)],
            };
          },
        },
        {
          id: 'ol_pull_kick_r',
          name: 'Pull & Kickout (Right Edge)',
          category: 'block',
          kind: 'block',
          description: 'Pull behind line to the right to kick out the edge defender',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[1] ?? 7.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.15), pt(hx * 0.7, -0.65), pt(hx + 1.5, 0.95)],
            };
          },
        },
        {
          id: 'ol_pull_kick_l',
          name: 'Pull & Kickout (Left Edge)',
          category: 'block',
          kind: 'block',
          description: 'Pull behind line to the left to kick out the edge defender',
          generateStroke: (n, { holesXs }) => {
            const hx = holesXs[9] ?? -7.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.15), pt(hx * 0.7, -0.65), pt(hx - 1.5, 0.95)],
            };
          },
        },
        {
          id: 'ol_pull_lead',
          name: 'Pull & Lead Upfield',
          category: 'block',
          kind: 'block',
          description: 'Pull behind line and turn upfield through the hole onto linebacker',
          generateStroke: (n) => {
            const targetX = n.x <= 0 ? n.x + 3.2 : n.x - 3.2;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.15), pt(targetX, -0.7), pt(targetX, 1.9)],
            };
          },
        },
        {
          id: 'ol_climb_lb',
          name: 'Combo & Climb to LB (2nd Level)',
          category: 'block',
          kind: 'block',
          description: 'Double team on defensive tackle, then advance to block linebacker',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x, n.y + 0.8), pt(n.x, n.y + 2.9)],
          }),
        },
        // Pass pro
        {
          id: 'ol_pass_set',
          name: 'Pass Set & Anchor',
          category: 'block',
          kind: 'block',
          description: 'Kick-slide 1 yard back, establish wide base & anchor pocket',
          generateStroke: (n) => {
            const offset = n.x === 0 ? 0 : Math.sign(n.x) * -0.3;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x + offset, n.y - 1.1)],
            };
          },
        },
        // Scheme blocks
        {
          id: 'ol_buck_kick',
          name: 'Buck Sweep Kickout',
          category: 'block',
          kind: 'block',
          description: 'Playside guard pull to kick out first defender outside tackle/TE',
          generateStroke: (n, { holesXs }) => {
            const side = Math.sign(n.x) || 1;
            const hx = holesXs[side > 0 ? 1 : 9] ?? side * 7.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.0), pt(hx * 0.7, -0.6), pt(hx + side * 1.5, 0.95)],
            };
          },
        },
        {
          id: 'ol_buck_wrap',
          name: 'Buck Sweep Wrap (Alley Lead)',
          category: 'block',
          kind: 'block',
          description: 'Backside guard pull flat across and wrap up into alley for lead block',
          generateStroke: (n, { holesXs }) => {
            const side = -Math.sign(n.x) || 1;
            const hx = holesXs[side > 0 ? 1 : 9] ?? side * 7.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 1.25), pt(hx * 0.45, -0.75), pt(hx + side * 0.35, 2.2)],
            };
          },
        },
        {
          id: 'ol_trap_pull',
          name: 'Trap Pull & Kickout',
          category: 'block',
          kind: 'block',
          description: 'Pull flat across center to trap unblocked down lineman',
          generateStroke: (n, { holesXs }) => {
            const side = -Math.sign(n.x) || 1;
            const hx = holesXs[side > 0 ? 2 : 8] ?? side * 5.5;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x, n.y - 0.95), pt(hx * 0.6, -0.45), pt(hx + side * 0.85, 0.85)],
            };
          },
        },
        {
          id: 'ol_duo_double',
          name: 'Duo Double-Team Drive',
          category: 'block',
          kind: 'block',
          description: 'Vertical push double team on down lineman climbing to Mike LB',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x + side * 0.25, 1.45)],
            };
          },
        },
        {
          id: 'ol_pin_down',
          name: 'Pin Down Block',
          category: 'block',
          kind: 'block',
          description: 'Angle down inside on DL to seal the edge for pulling escort',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'block',
              points: [pt(n.x, n.y), pt(n.x - side * 1.4, 0.9)],
            };
          },
        },
        {
          id: 'ol_wedge_converge',
          name: 'Wedge Converge',
          category: 'block',
          kind: 'block',
          description: 'Shoulder-to-shoulder converge into center wedge driving forward',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x * 0.25, 1.3)],
          }),
        },
      ];

    case 'defense':
      return [
        {
          id: 'def_rush_qb',
          name: 'Bull Rush QB',
          category: 'rush',
          kind: 'run',
          description: 'Direct charge into backfield targeting quarterback',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(0, -2.5)],
          }),
        },
        {
          id: 'def_edge_contain',
          name: 'Edge Rush & Contain',
          category: 'rush',
          kind: 'run',
          description: 'Set hard outside edge to force ball carrier back inside',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(n.x + side * 1.5, -2)],
            };
          },
        },
        {
          id: 'def_a_gap_blitz',
          name: 'A-Gap Blitz',
          category: 'rush',
          kind: 'run',
          description: 'Shoot gap between Center and Guard',
          generateStroke: (n) => ({
            kind: 'run',
            points: [pt(n.x, n.y), pt(0, -1.8)],
          }),
        },
        {
          id: 'def_b_gap_stunt',
          name: 'B-Gap Stunt',
          category: 'rush',
          kind: 'run',
          description: 'Slant or twist into B-gap between Guard and Tackle',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'run',
              points: [pt(n.x, n.y), pt(side * 2.2, -1.8)],
            };
          },
        },
        {
          id: 'def_deep_third',
          name: 'Deep 1/3 (Cover 3 Zone)',
          category: 'coverage',
          kind: 'pass',
          description: 'Drop deep to cover deep third zone',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, n.y + 5.5)],
          }),
        },
        {
          id: 'def_flat_zone',
          name: 'Flat Zone Coverage',
          category: 'coverage',
          kind: 'pass',
          description: 'Reroute receiver and drop into flats',
          generateStroke: (n) => {
            const side = Math.sign(n.x) || 1;
            return {
              kind: 'pass',
              points: [pt(n.x, n.y), pt(n.x + side * 3.5, n.y - 0.6)],
            };
          },
        },
        {
          id: 'def_hook_curl',
          name: 'Hook / Curl Zone',
          category: 'coverage',
          kind: 'pass',
          description: 'Drop 5 yards to middle hook-curl zone',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(n.x, n.y + 2.5)],
          }),
        },
        {
          id: 'def_spy_qb',
          name: 'QB Spy',
          category: 'coverage',
          kind: 'pass',
          description: 'Mirror quarterback scrambles at second level',
          generateStroke: (n) => ({
            kind: 'pass',
            points: [pt(n.x, n.y), pt(0, 1.4)],
          }),
        },
        {
          id: 'def_man_press',
          name: 'Man-to-Man Press',
          category: 'coverage',
          kind: 'block',
          description: 'Jam receiver on line of scrimmage',
          generateStroke: (n) => ({
            kind: 'block',
            points: [pt(n.x, n.y), pt(n.x, n.y - 1.4)],
          }),
        },
      ];

    default:
      return [];
  }
}
