// Editing the Drill Library tree without prompts: every change returns a new tree.
// A folder is addressed by its index path from the top ([2] = third section, [2, 0] = its first sub-section).
import type { DrillFolder, DrillItem } from '../types';

export type FolderPath = number[];

const clone = (tree: DrillFolder[]): DrillFolder[] =>
  tree.map((f) => ({ ...f, drills: [...(f.drills || [])], subfolders: clone(f.subfolders || []) }));

export function getFolder(tree: DrillFolder[], path: FolderPath): DrillFolder | undefined {
  let list = tree;
  let folder: DrillFolder | undefined;
  for (const i of path) {
    folder = list[i];
    if (!folder) return undefined;
    list = folder.subfolders || [];
  }
  return folder;
}

/** The list a folder sits in (top level or its parent's sub-sections). */
function siblings(tree: DrillFolder[], path: FolderPath): DrillFolder[] | undefined {
  if (path.length === 1) return tree;
  return getFolder(tree, path.slice(0, -1))?.subfolders;
}

export function countDrills(folder: DrillFolder | undefined): number {
  if (!folder) return 0;
  return (folder.drills || []).length + (folder.subfolders || []).reduce((n, f) => n + countDrills(f), 0);
}

/** Every drill in a folder and its sub-sections, in order. */
export function allDrills(folder: DrillFolder | undefined): DrillItem[] {
  if (!folder) return [];
  return [...(folder.drills || []), ...(folder.subfolders || []).flatMap(allDrills)];
}

/** Every folder with a readable label ("Defense › Linebackers"), for "move to" menus. */
export function folderOptions(tree: DrillFolder[]): { path: FolderPath; label: string; depth: number }[] {
  const out: { path: FolderPath; label: string; depth: number }[] = [];
  const walk = (list: DrillFolder[], base: FolderPath, names: string[]) =>
    list.forEach((f, i) => {
      const path = [...base, i];
      out.push({ path, label: [...names, f.name].join(' › '), depth: base.length });
      walk(f.subfolders || [], path, [...names, f.name]);
    });
  walk(tree, [], []);
  return out;
}

export const samePath = (a: FolderPath, b: FolderPath) => a.length === b.length && a.every((v, i) => v === b[i]);
export const isInside = (path: FolderPath, parent: FolderPath) => path.length > parent.length && parent.every((v, i) => v === path[i]);

export function newDrillId(): string {
  return `drill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function renameFolder(tree: DrillFolder[], path: FolderPath, name: string): DrillFolder[] {
  const next = clone(tree);
  const f = getFolder(next, path);
  if (f && name.trim()) f.name = name.trim();
  return next;
}

/** Add a section at the top level (parent = null) or inside another section. */
export function addFolder(tree: DrillFolder[], parent: FolderPath | null, name: string): { tree: DrillFolder[]; path: FolderPath } {
  const next = clone(tree);
  const folder: DrillFolder = { name: name.trim() || 'New section', subfolders: [], drills: [] };
  if (!parent) {
    next.push(folder);
    return { tree: next, path: [next.length - 1] };
  }
  const p = getFolder(next, parent);
  if (!p) return { tree, path: [] };
  p.subfolders = [...(p.subfolders || []), folder];
  return { tree: next, path: [...parent, p.subfolders.length - 1] };
}

/**
 * Delete a section. With `moveTo`, its drills (including sub-sections') go to that section first.
 * `moveTo` must not be the section itself or inside it.
 */
export function deleteFolder(tree: DrillFolder[], path: FolderPath, moveTo?: FolderPath): DrillFolder[] {
  const next = clone(tree);
  const folder = getFolder(next, path);
  if (!folder) return tree;
  if (moveTo && !samePath(moveTo, path) && !isInside(moveTo, path)) {
    const target = getFolder(next, moveTo);
    if (target) target.drills = [...(target.drills || []), ...allDrills(folder)];
  }
  const list = siblings(next, path);
  list?.splice(path[path.length - 1], 1);
  return next;
}

export function moveFolder(tree: DrillFolder[], path: FolderPath, dir: -1 | 1): DrillFolder[] {
  const next = clone(tree);
  const list = siblings(next, path);
  const i = path[path.length - 1];
  if (!list || i + dir < 0 || i + dir >= list.length) return tree;
  const [f] = list.splice(i, 1);
  list.splice(i + dir, 0, f);
  return next;
}

export function addDrill(tree: DrillFolder[], path: FolderPath, drill?: Partial<DrillItem>): { tree: DrillFolder[]; index: number } {
  const next = clone(tree);
  const f = getFolder(next, path);
  if (!f) return { tree, index: -1 };
  f.drills = [...(f.drills || []), { id: newDrillId(), name: drill?.name || 'New drill', desc: drill?.desc || '', key: drill?.key || '' }];
  return { tree: next, index: f.drills.length - 1 };
}

export function updateDrill(tree: DrillFolder[], path: FolderPath, index: number, patch: Partial<DrillItem>): DrillFolder[] {
  const next = clone(tree);
  const f = getFolder(next, path);
  if (!f?.drills?.[index]) return tree;
  f.drills[index] = { ...f.drills[index], ...patch };
  return next;
}

export function deleteDrill(tree: DrillFolder[], path: FolderPath, index: number): DrillFolder[] {
  const next = clone(tree);
  const f = getFolder(next, path);
  if (!f?.drills?.[index]) return tree;
  f.drills.splice(index, 1);
  return next;
}

export function duplicateDrill(tree: DrillFolder[], path: FolderPath, index: number): DrillFolder[] {
  const next = clone(tree);
  const f = getFolder(next, path);
  const d = f?.drills?.[index];
  if (!f || !d) return tree;
  f.drills.splice(index + 1, 0, { ...d, id: newDrillId(), name: `${d.name} (copy)` });
  return next;
}

export function moveDrill(tree: DrillFolder[], from: FolderPath, index: number, to: FolderPath): DrillFolder[] {
  if (samePath(from, to)) return tree;
  const next = clone(tree);
  const src = getFolder(next, from);
  const dst = getFolder(next, to);
  if (!src?.drills?.[index] || !dst) return tree;
  const [d] = src.drills.splice(index, 1);
  dst.drills = [...(dst.drills || []), d];
  return next;
}

export function reorderDrill(tree: DrillFolder[], path: FolderPath, index: number, dir: -1 | 1): DrillFolder[] {
  const next = clone(tree);
  const f = getFolder(next, path);
  if (!f?.drills || index + dir < 0 || index + dir >= f.drills.length) return tree;
  const [d] = f.drills.splice(index, 1);
  f.drills.splice(index + dir, 0, d);
  return next;
}
