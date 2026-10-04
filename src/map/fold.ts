// Folding directories into the nodes of the map. Pure: a file list in, groups
// out. Nothing here knows about React, the canvas or the database.

/** Roughly how many nodes a person can read at once. */
export const MAX_NODES = 24;

/** The threshold starts at "fewer than a couple of files". */
const START_THRESHOLD = 2;

export interface FoldGroup {
  /** The directory the group is named after, "." at the root. */
  dir: string;
  /** Files the group holds, its own and any merged up from below, sorted. */
  files: string[];
}

export interface Folding {
  /** The threshold that produced this folding: groups below it were merged. */
  threshold: number;
  /** Sorted by directory. */
  groups: FoldGroup[];
  /** File path → the directory of the group holding it. */
  ownerOf: ReadonlyMap<string, string>;
}

const parentOf = (dir: string): string => {
  const cut = dir.lastIndexOf("/");
  return cut === -1 ? "." : dir.slice(0, cut);
};

const depthOf = (dir: string): number => (dir === "." ? 0 : dir.split("/").length);

/**
 * One pass at a fixed threshold. Directories are visited deepest first; at each
 * depth every directory's size is read before any of them merges, so a merge at
 * one depth can't change what another merge at the same depth sees.
 */
function foldAt(files: readonly { path: string; folder: string }[], threshold: number): Map<string, string[]> {
  const held = new Map<string, string[]>();
  const add = (dir: string, paths: readonly string[]) => {
    const list = held.get(dir);
    if (list === undefined) held.set(dir, [...paths]);
    else list.push(...paths);
  };

  for (const f of files) add(f.folder, [f.path]);
  // Ancestors with no files of their own still exist, so their children have somewhere to merge into.
  for (const dir of [...held.keys()]) {
    for (let d = dir; d !== "."; d = parentOf(d)) if (!held.has(parentOf(d))) held.set(parentOf(d), []);
  }

  const maxDepth = Math.max(0, ...[...held.keys()].map(depthOf));
  for (let depth = maxDepth; depth >= 1; depth--) {
    const merging = [...held.entries()]
      .filter(([dir, paths]) => depthOf(dir) === depth && paths.length > 0 && paths.length < threshold)
      .map(([dir, paths]) => [dir, [...paths]] as const);
    for (const [dir, paths] of merging) {
      held.set(dir, []);
      add(parentOf(dir), paths);
    }
  }

  for (const [dir, paths] of held) if (paths.length === 0) held.delete(dir);
  return held;
}

/**
 * Fold at the lowest threshold whose result has at most MAX_NODES groups. The
 * repository's shape decides how deep that goes; nothing is chosen in advance.
 */
export function foldDirectories(files: readonly { path: string; folder: string }[], maxNodes = MAX_NODES): Folding {
  let threshold = START_THRESHOLD;
  let held = foldAt(files, threshold);
  // Ends: at threshold files.length + 1 everything has merged into the root.
  while (held.size > maxNodes && threshold <= files.length) {
    threshold += 1;
    held = foldAt(files, threshold);
  }

  const groups = [...held.entries()]
    .map(([dir, paths]) => ({ dir, files: paths.sort() }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  const ownerOf = new Map<string, string>();
  for (const g of groups) for (const p of g.files) ownerOf.set(p, g.dir);
  return { threshold, groups, ownerOf };
}
