import { FormationBoard, PlacedPlayer, WeekState } from '../types';
import { deepClone } from '../services/storageService';

export type CopyWeekMode = 'both' | 'formations_only' | 'positions_only';

export function normalizeCopyWeekMode(
  copyModeOrPlayerSpots: CopyWeekMode | boolean = 'both'
): CopyWeekMode {
  if (typeof copyModeOrPlayerSpots === 'boolean') {
    return copyModeOrPlayerSpots ? 'both' : 'formations_only';
  }
  return copyModeOrPlayerSpots || 'both';
}

export function countPlacedPlayers(dc?: Record<string, PlacedPlayer[]>): number {
  if (!dc || typeof dc !== 'object') return 0;
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

  let formations =
    targetExisting.formations && targetExisting.formations.length > 0
      ? targetExisting.formations
      : defaultFormations;
  let depthChart = targetExisting.depthChart || {};
  let scrimmageChart = targetExisting.scrimmageChart || {};

  if (mode === 'both') {
    formations = deepClone(src.formations && src.formations.length > 0 ? src.formations : defaultFormations);
    depthChart = deepClone(src.depthChart || {});
    scrimmageChart = deepClone(src.scrimmageChart || {});
  } else if (mode === 'formations_only') {
    formations = deepClone(src.formations && src.formations.length > 0 ? src.formations : defaultFormations);
    depthChart = {};
    scrimmageChart = {};
  } else {
    formations = deepClone(targetExisting.formations || []);
    const mappedDepthChart: Record<string, PlacedPlayer[]> = {};
    const srcDC = src.depthChart || {};

    Object.keys(srcDC).forEach((posId) => {
      if (srcDC[posId] && srcDC[posId].length > 0) {
        mappedDepthChart[posId] = deepClone(srcDC[posId]);
      }
    });

    const srcFormMap = new Map<string, Map<string, PlacedPlayer[]>>();
    (src.formations || []).forEach((sf) => {
      const formKey = (sf.name || '').toLowerCase().trim();
      const posMap = new Map<string, PlacedPlayer[]>();
      (sf.rows || []).forEach((row, rIdx) => {
        (row.positions || []).forEach((pos, pIdx) => {
          if (!pos) return;
          const players = srcDC[pos.id];
          if (players && players.length > 0) {
            const nameKey = (pos.name || '').toLowerCase().trim();
            const tagKey = ((pos as any)?.tag || '').toLowerCase().trim();
            if (nameKey) posMap.set(nameKey, deepClone(players));
            if (tagKey) posMap.set(tagKey, deepClone(players));
            posMap.set(`slot_${rIdx}_${pIdx}`, deepClone(players));
          }
        });
      });
      srcFormMap.set(formKey, posMap);
    });

    (targetExisting.formations || []).forEach((tf) => {
      const formKey = (tf.name || '').toLowerCase().trim();
      const srcPosMap = srcFormMap.get(formKey);
      if (!srcPosMap) return;
      (tf.rows || []).forEach((row, rIdx) => {
        (row.positions || []).forEach((pos, pIdx) => {
          if (!pos) return;
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
        });
      });
    });

    depthChart = mappedDepthChart;
    scrimmageChart = deepClone(src.scrimmageChart || {});
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
