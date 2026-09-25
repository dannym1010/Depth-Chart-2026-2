import { DrillFolder, DrillItem } from '../types';
import {
  safeJSONSet,
  deepClone,
  escapeCSV,
  parseCSV,
  safeJSONStringify,
  normalizeCascadingDrills,
} from '../services/storageService';
import { findFolderByPath } from '../utils/drillPlanLinking';
import React from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface DrillLibraryActionsDeps {
  setCascadingDrills: Dispatch<SetStateAction<DrillFolder[]>>;
  latestStateRef: RefObject<LatestAppState>;
  lastLocalEditTimeRef: RefObject<number>;
  debouncedSave: (scope?: string, extraMeta?: Record<string, any>) => void;
  cascadingDrills: DrillFolder[];
}

// Drill library folders and drills: add, rename, move, delete, and CSV/JSON import/export.
export function useDrillLibraryActions({
  setCascadingDrills,
  latestStateRef,
  lastLocalEditTimeRef,
  debouncedSave,
  cascadingDrills,
}: DrillLibraryActionsDeps) {
  /* =========================================================================
     DRILL LIBRARY RECURSIVE ACTIONS
     ========================================================================= */

  const updateCascadingDrillsAndSave = (
    updater: (prev: DrillFolder[]) => DrillFolder[]
  ) => {
    setCascadingDrills((prev) => {
      const updated = updater(prev);
      latestStateRef.current.cascadingDrills = updated;
      safeJSONSet('footballCascadingDrills', updated);
      lastLocalEditTimeRef.current = Date.now();
      return updated;
    });
    debouncedSave('drills');
  };

  const handleAddTopDrillFolder = () => {
    const name = prompt('Enter new Top-Level Folder Name (e.g. Special Teams):');
    if (name && name.trim()) {
      updateCascadingDrillsAndSave((prev) => [
        ...prev,
        { name: name.trim(), subfolders: [], drills: [] },
      ]);
    }
  };

  const handleAddSubfolder = (pathKey: string) => {
    const name = prompt('Enter Subfolder Name:');
    if (name && name.trim()) {
      updateCascadingDrillsAndSave((prev) => {
        const updated = deepClone(prev);
        const target = findFolderByPath(updated, pathKey);
        if (target) {
          if (!target.subfolders) target.subfolders = [];
          target.subfolders.push({
            name: name.trim(),
            subfolders: [],
            drills: [],
          });
        }
        return updated;
      });
    }
  };

  const handleAddDrill = (pathKey: string) => {
    const newDrillId = `drill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const target = findFolderByPath(updated, pathKey);
      if (target) {
        if (!target.drills) target.drills = [];
        target.drills.push({
          id: newDrillId,
          name: 'New Drill',
          desc: '',
          key: '',
        });
      }
      return updated;
    });
  };

  const handleRenameDrillFolder = (pathKey: string) => {
    const target = findFolderByPath(cascadingDrills, pathKey);
    if (target) {
      const newName = prompt('Rename Folder:', target.name);
      if (newName && newName.trim()) {
        updateCascadingDrillsAndSave((prev) => {
          const updated = deepClone(prev);
          const t = findFolderByPath(updated, pathKey);
          if (t) {
            t.name = newName.trim();
          }
          return updated;
        });
      }
    }
  };

  const handleDeleteDrillFolder = (pathKey: string) => {
    if (!confirm('Delete this folder and all its drills?')) return;
    const parts = pathKey.split('_');
    const idx = parseInt(parts.pop()!, 10);
    const parentPath = parts.join('_');

    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      if (parentPath === '') {
        updated.splice(idx, 1);
      } else {
        const parent = findFolderByPath(updated, parentPath);
        if (parent && parent.subfolders) {
          parent.subfolders.splice(idx, 1);
        }
      }
      return updated;
    });
  };

  const handleMoveDrillFolder = (pathKey: string, direction: number) => {
    const parts = pathKey.split('_');
    const idx = parseInt(parts.pop()!, 10);
    const parentPath = parts.join('_');

    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      let list = updated;
      if (parentPath !== '') {
        const parent = findFolderByPath(updated, parentPath);
        if (parent && parent.subfolders) list = parent.subfolders;
      }

      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      const [moved] = list.splice(idx, 1);
      list.splice(newIdx, 0, moved);
      return updated;
    });
  };

  const handleUpdateDrill = (
    pathKey: string,
    drillIdx: number,
    field: keyof DrillItem,
    value: string
  ) => {
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const target = findFolderByPath(updated, pathKey);
      if (target && target.drills?.[drillIdx]) {
        target.drills[drillIdx][field] = value;
      }
      return updated;
    });
  };

  const handleDeleteDrill = (pathKey: string, drillIdx: number) => {
    if (confirm('Delete this drill?')) {
      updateCascadingDrillsAndSave((prev) => {
        const updated = deepClone(prev);
        const target = findFolderByPath(updated, pathKey);
        if (target && target.drills) {
          target.drills.splice(drillIdx, 1);
        }
        return updated;
      });
    }
  };

  const handleMoveDrillToFolder = (
    sourcePath: string,
    drillIdx: number,
    targetPath: string
  ) => {
    if (sourcePath === targetPath) return;
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const source = findFolderByPath(updated, sourcePath);
      const target = findFolderByPath(updated, targetPath);

      if (source && target && source.drills?.[drillIdx]) {
        const [movedDrill] = source.drills.splice(drillIdx, 1);
        if (!target.drills) target.drills = [];
        target.drills.push(movedDrill);
      }
      return updated;
    });
  };

  // CSV & JSON Drill Import / Export
  const handleExportDrillsCSV = () => {
    const rows: string[][] = [
      ['Top Folder', 'Subfolder', 'Drill Name', 'Setup & Instructions', 'Coaching Focus'],
    ];

    const traverse = (
      folders: DrillFolder[],
      topName = '',
      subName = ''
    ) => {
      folders.forEach((f) => {
        const curTop = topName || f.name;
        const curSub = topName ? (subName ? `${subName} > ${f.name}` : f.name) : '';
        (f.drills || []).forEach((d) => {
          rows.push([curTop, curSub, d.name || '', d.desc || '', d.key || '']);
        });
        if (f.subfolders?.length) {
          traverse(f.subfolders, curTop, curSub);
        }
      });
    };

    traverse(cascadingDrills);
    const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drills_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleImportDrillsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsedRows = parseCSV(evt.target?.result as string);
        if (parsedRows.length < 2) {
          alert('CSV file empty or invalid.');
          return;
        }

        const newTree: DrillFolder[] = [];
        const getOrCreate = (tree: DrillFolder[], name: string) => {
          let found = tree.find(
            (item) => item.name.toLowerCase() === name.toLowerCase()
          );
          if (!found) {
            found = { name, subfolders: [], drills: [] };
            tree.push(found);
          }
          return found;
        };

        const startIdx = parsedRows[0][0]?.toLowerCase().includes('folder') ? 1 : 0;
        for (let i = startIdx; i < parsedRows.length; i++) {
          const r = parsedRows[i];
          if (!r || r.length < 3) continue;
          const topFolderName = (r[0] || 'General').trim() || 'General';
          const subfolderName = (r[1] || '').trim();
          const drillName = (r[2] || '').trim();
          const drillDesc = (r[3] || '').trim();
          const drillKey = (r[4] || '').trim();
          if (!drillName) continue;

          const topFolder = getOrCreate(newTree, topFolderName);
          let targetFolder = topFolder;
          if (subfolderName) {
            const subParts = subfolderName.split('>').map((s) => s.trim()).filter(Boolean);
            let curParent = topFolder;
            subParts.forEach((sp) => {
              curParent = getOrCreate(curParent.subfolders, sp);
            });
            targetFolder = curParent;
          }
          if (!targetFolder.drills) targetFolder.drills = [];
          targetFolder.drills.push({
            id: `drill_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
            name: drillName,
            desc: drillDesc,
            key: drillKey,
          });
        }

        if (newTree.length > 0) {
          updateCascadingDrillsAndSave(() => newTree);
          alert('Drills CSV imported successfully!');
        }
      } catch (err: any) {
        alert(`Error importing CSV: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportDrillsJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(safeJSONStringify(cascadingDrills, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `drills_folders_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImportDrillsJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          const normalized = normalizeCascadingDrills(parsed);
          updateCascadingDrillsAndSave(() => normalized);
          alert('Drills JSON imported successfully!');
        }
      } catch (err: any) {
        alert(`Error parsing JSON: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return {
    handleImportDrillsCSV,
    handleImportDrillsJSON,
    handleAddTopDrillFolder,
    handleAddSubfolder,
    handleAddDrill,
    handleRenameDrillFolder,
    handleDeleteDrillFolder,
    handleMoveDrillFolder,
    handleUpdateDrill,
    handleDeleteDrill,
    handleMoveDrillToFolder,
    handleExportDrillsCSV,
    handleExportDrillsJSON,
    updateCascadingDrillsAndSave,
  };
}
