// Sizes and positions for what's on screen. Pure and deterministic: nodes and
// edges go into dagre in sorted order, so the same view lays out the same way.

import dagre from "@dagrejs/dagre";
import type { EdgeLabel, GraphLabel, NodeLabel } from "@dagrejs/dagre";
import type { View, ViewNode } from "./view.ts";

/** Plex Mono at 12px is 0.6em per character. Width comes from the text, nothing else. */
export const CHAR_W = 7.2;
const PAD_X = 10;

export const FOLDER_MIN_H = 40;
/** The most a folded node grows by, reached by the most depended-on group. */
const FOLDER_GROW_H = 80;

export const HEADER_H = 40;
export const ROW_H = 20;
const PANEL_MIN_W = 200;
const PANEL_MAX_W = 380;
/** The fan-in and fan-out columns at the end of every row. */
export const ROW_NUMBERS_W = 64;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  /** Top-left corner and size, keyed by node id. */
  boxes: Map<string, Box>;
  bounds: Box;
}

const textWidth = (chars: number) => Math.ceil(chars * CHAR_W + PAD_X * 2);

export const folderMeta = (n: { fileCount: number; fanIn: number; fanOut: number }) =>
  `${n.fileCount} files  ↓${n.fanIn} ↑${n.fanOut}`;

function sizeOf(node: ViewNode, maxFanIn: number): { width: number; height: number } {
  const header = Math.max(node.label.length, folderMeta(node).length);
  if (node.kind === "folder") {
    // Height carries what depends on the group. Square root so one hub doesn't
    // flatten every other node to the minimum.
    const share = maxFanIn === 0 ? 0 : Math.sqrt(node.fanIn / maxFanIn);
    return { width: textWidth(header), height: Math.round(FOLDER_MIN_H + FOLDER_GROW_H * share) };
  }
  const longestRow = Math.max(0, ...node.rows.map((r) => r.label.length));
  const width = Math.max(textWidth(header), textWidth(longestRow) + ROW_NUMBERS_W);
  const rowCount = node.rows.length + (node.hidden > 0 ? 1 : 0);
  return {
    width: Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, width)),
    height: HEADER_H + rowCount * ROW_H + 4,
  };
}

export function layoutView(view: View): Layout {
  const g = new dagre.graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>();
  g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 64, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));

  // A group's fan-in doesn't change when panels open, so heights stay put too.
  const maxFanIn = Math.max(0, ...view.nodes.map((n) => n.fanIn));
  const nodes = [...view.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const n of nodes) g.setNode(n.id, sizeOf(n, maxFanIn));

  // Dagre places nodes, not rows, so lines between the same two nodes count once with their weight.
  const weights = new Map<string, { source: string; target: string; weight: number }>();
  for (const e of view.edges) {
    const key = `${e.source.node}\u0000${e.target.node}`;
    const w = weights.get(key);
    if (w === undefined) weights.set(key, { source: e.source.node, target: e.target.node, weight: e.count });
    else w.weight += e.count;
  }
  for (const [, w] of [...weights.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    g.setEdge(w.source, w.target, { weight: w.weight });
  }

  dagre.layout(g);

  const boxes = new Map<string, Box>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const { x, y, width, height } = g.node(n.id);
    if (x === undefined || y === undefined) throw new Error(`dagre placed no position for ${n.id}`);
    const box = { x: x - width / 2, y: y - height / 2, width, height };
    boxes.set(n.id, box);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + width);
    maxY = Math.max(maxY, box.y + height);
  }
  const bounds = nodes.length === 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return { boxes, bounds };
}
