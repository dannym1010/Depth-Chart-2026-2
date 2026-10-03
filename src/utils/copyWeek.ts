import { FormationBoard, PlacedPlayer, WeekState } from '../types';
import { deepClone } from '../services/storageService';

export type CopyWeekMode = 'both' | 'formations_only' | 'positions_only' | 'wristband_only';

export function normalizeCopyWeekMode(
  copyModeOrPlayerSpots: CopyWeekMode | boolean = 'both'
): CopyWeekMode {
  if (typeof copyModeOrPlayerSpots === 'boolean') {
    return copyModeOrPlayerSpots ? 'both' : 'formations_only';
  }
  return copyModeOrPlayerSpots || 'both';
}

export function countPlacedPlayers(dc?: Record<string, PlacedPlayer[]>): number {
  if (!dc) return 0;
  return Object.values(dc).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}

export function copyWeekCharts(opts: {
  src: WeekState;
  targetExisting: WeekState;
  defaultFormations: FormationBoard[];
  mode: CopyWeekMode | boolean;
}): {
  mode: CopyWeekMode;
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  scrimmageChart: Record<string, PlacedPlayer[]>;
  copiedPlayerCount: number;
} {
  const mode = normalizeCopyWeekMode(opts.mode);
  const src = opts.src || ({} as WeekState);
  const targetExisting = opts.targetExisting || ({} as WeekState);
  const defaultFormations = opts.defaultFormations || [];

  const getFormations = (state: WeekState) =>
    state.formations && state.formations.length > 0 ? state.formations : defaultFormations;

  let formations: FormationBoard[];
  let depthChart: Record<string, PlacedPlayer[]>;
  let scrimmageChart: Record<string, PlacedPlayer[]>;

  switch (mode) {
    case 'both':
      formations = deepClone(getFormations(src));
      depthChart = deepClone(src.depthChart || {});
      scrimmageChart = deepClone(src.scrimmageChart || {});
      break;

    case 'formations_only':
      formations = deepClone(getFormations(src));
      depthChart = {};
      scrimmageChart = {};
      break;

    case 'wristband_only':
      formations = deepClone(getFormations(targetExisting));
      depthChart = deepClone(targetExisting.depthChart || {});
      scrimmageChart = deepClone(targetExisting.scrimmageChart || {});
      break;

    default: {
      // positions_only
      formations = deepClone(targetExisting.formations || []);
      const mappedDepthChart: Record<string, PlacedPlayer[]> = {};
      const srcDC = src.depthChart || {};

      for (const [posId, players] of Object.entries(srcDC)) {
        if (players && players.length > 0) {
          mappedDepthChart[posId] = deepClone(players);
        }
      }

      const srcFormMap = new Map<string, Map<string, PlacedPlayer[]>>();
      for (const sf of src.formations || []) {
        const formKey = (sf.name || '').toLowerCase().trim();
        const posMap = new Map<string, PlacedPlayer[]>();
        for (const [rIdx, row] of (sf.rows || []).entries()) {
          for (const [pIdx, pos] of (row.positions || []).entries()) {
            if (!pos) continue;
            const players = srcDC[pos.id];
            if (players && players.length > 0) {
              const nameKey = (pos.name || '').toLowerCase().trim();
              const tagKey = ((pos as any)?.tag || '').toLowerCase().trim();
              if (nameKey) posMap.set(nameKey, deepClone(players));
              if (tagKey) posMap.set(tagKey, deepClone(players));
              posMap.set(`slot_${rIdx}_${pIdx}`, deepClone(players));
            }
          }
        }
        srcFormMap.set(formKey, posMap);
      }

      for (const tf of targetExisting.formations || []) {
        const formKey = (tf.name || '').toLowerCase().trim();
        const srcPosMap = srcFormMap.get(formKey);
        if (!srcPosMap) continue;
        for (const [rIdx, row] of (tf.rows || []).entries()) {
          for (const [pIdx, pos] of (row.positions || []).entries()) {
            if (!pos) continue;
            if (!mappedDepthChart[pos.id] || mappedDepthChart[pos.id].length === 0) {
              const nameKey = (pos.name || '').toLowerCase().trim();
              const tagKey = ((pos as any)?.tag || '').toLowerCase().trim();
              const matched =
                (nameKey && srcPosMap.get(nameKey)) ||
                (tagKey && srcPosMap.get(tagKey)) ||
                srcPosMap.get(`slot_${rIdx}_${pIdx}`);
              if (matched && matched.length > 0) {
                mappedDepthChart[pos.id] = deepClone(matched);
              }
            }
          }
        }
      }

      depthChart = mappedDepthChart;
      scrimmageChart = deepClone(src.scrimmageChart || {});
      break;
    }
  }

  return {
    mode,
    formations,
    depthChart,
    scrimmageChart,
    copiedPlayerCount: countPlacedPlayers(depthChart),
  };
}

export function applyCopiedFormationsToDeletedIds(
  deletedFormationIds: string[] | undefined,
  copiedFormations: FormationBoard[],
  mode: CopyWeekMode
): string[] {
  if (mode !== 'both' && mode !== 'formations_only') {
    return deletedFormationIds || [];
  }
  const copiedIds = new Set(copiedFormations.map((f) => f.id).filter(Boolean));
  return (deletedFormationIds || []).filter((id) => !copiedIds.has(id));
}
