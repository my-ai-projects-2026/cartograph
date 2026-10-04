// What's on screen for a given folding and set of open folders. Pure: derived
// from the parser's files and edges, which are never reshaped.

import type { Edge, FileNode } from "../parser/types.ts";
import type { Folding } from "./fold.ts";
import { shortestUniqueLabels } from "./labels.ts";

/** Rows a panel shows before it says how many more there are. */
export const MAX_ROWS = 12;

/** Handle id for edges that land on a panel's "N more" row. */
export const MORE = "more";

export interface Row {
  path: string;
  label: string;
  fanIn: number;
  fanOut: number;
}

interface GroupFacts {
  id: string;
  label: string;
  fileCount: number;
  /** File edges crossing into the group from outside it. */
  fanIn: number;
  fanOut: number;
}

export type ViewNode =
  | ({ kind: "folder" } & GroupFacts)
  | ({ kind: "panel"; rows: Row[]; hidden: number } & GroupFacts);

/** An endpoint on screen: a node, and for panels the row it lands on. */
export interface Endpoint {
  node: string;
  /** Row path, MORE, or null for a folded node. */
  row: string | null;
}

export interface ViewEdge {
  id: string;
  source: Endpoint;
  target: Endpoint;
  /** How many file-to-file edges this one line stands for. */
  count: number;
}

export interface View {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export const endpointKey = (e: Endpoint): string => (e.row === null ? e.node : `${e.node}\u0000${e.row}`);

// Most depended-on first, so the rows a full panel hides are the least leaned on.
const byFanIn = (a: FileNode, b: FileNode) => b.fanIn - a.fanIn || (a.path < b.path ? -1 : 1);

export function deriveView(
  files: readonly FileNode[],
  edges: readonly Edge[],
  folding: Folding,
  open: ReadonlySet<string>,
): View {
  const fileByPath = new Map(files.map((f) => [f.path, f]));
  const owner = (path: string): string => {
    const dir = folding.ownerOf.get(path);
    if (dir === undefined) throw new Error(`${path} is in no group`);
    return dir;
  };

  const fan = new Map(folding.groups.map((g) => [g.dir, { fanIn: 0, fanOut: 0 }]));
  for (const e of edges) {
    const from = owner(e.from);
    const to = owner(e.to);
    if (from === to) continue;
    fan.get(from)!.fanOut += 1;
    fan.get(to)!.fanIn += 1;
  }

  const shownRows = new Map<string, FileNode[]>();
  for (const g of folding.groups) {
    if (!open.has(g.dir)) continue;
    const sorted = g.files.map((p) => fileByPath.get(p)!).sort(byFanIn);
    shownRows.set(g.dir, sorted.slice(0, MAX_ROWS));
  }
  const visibleRow = new Set([...shownRows.values()].flat().map((f) => f.path));

  const labels = shortestUniqueLabels([...folding.groups.map((g) => g.dir), ...visibleRow]);

  const nodes: ViewNode[] = folding.groups.map((g) => {
    const facts: GroupFacts = { id: g.dir, label: labels.get(g.dir)!, fileCount: g.files.length, ...fan.get(g.dir)! };
    const rows = shownRows.get(g.dir);
    if (rows === undefined) return { kind: "folder", ...facts };
    return {
      kind: "panel",
      ...facts,
      rows: rows.map((f) => ({ path: f.path, label: labels.get(f.path)!, fanIn: f.fanIn, fanOut: f.fanOut })),
      hidden: g.files.length - rows.length,
    };
  });

  const endpoint = (path: string): Endpoint => {
    const node = owner(path);
    if (!open.has(node)) return { node, row: null };
    return { node, row: visibleRow.has(path) ? path : MORE };
  };

  // Edges inside one group draw nothing: the group is one object on the canvas.
  const lines = new Map<string, ViewEdge>();
  for (const e of edges) {
    const source = endpoint(e.from);
    const target = endpoint(e.to);
    if (source.node === target.node) continue;
    const id = `${endpointKey(source)}\u0001${endpointKey(target)}`;
    const line = lines.get(id);
    if (line === undefined) lines.set(id, { id, source, target, count: 1 });
    else line.count += 1;
  }

  return { nodes, edges: [...lines.values()].sort((a, b) => (a.id < b.id ? -1 : 1)) };
}
