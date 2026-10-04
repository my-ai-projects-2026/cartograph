// What stays at full strength when something is selected: the selection, its
// edges, and whatever those edges reach. Pure arithmetic over the view.

import { endpointKey } from "./view.ts";
import type { Endpoint, View, ViewEdge } from "./view.ts";

export type Selection =
  | { kind: "group"; id: string }
  /** A row inside an open panel; `row` is a file path or MORE. */
  | { kind: "row"; node: string; row: string }
  | null;

export type Direction = "in" | "out";

export interface Lit {
  /** Edge id → which way it flows relative to the selection. */
  edges: Map<string, Direction>;
  /** endpointKey of every row or folded node that stays at full strength. */
  endpoints: Set<string>;
  /** Node ids with anything at full strength. */
  nodes: Set<string>;
}

function touches(sel: NonNullable<Selection>, end: Endpoint): boolean {
  return sel.kind === "group" ? end.node === sel.id : end.node === sel.node && end.row === sel.row;
}

export function lightUp(view: View, sel: Selection): Lit | null {
  if (sel === null) return null;
  const edges = new Map<string, Direction>();
  const endpoints = new Set<string>();
  const nodes = new Set<string>([sel.kind === "group" ? sel.id : sel.node]);
  if (sel.kind === "row") endpoints.add(endpointKey({ node: sel.node, row: sel.row }));

  const light = (e: ViewEdge, dir: Direction, other: Endpoint) => {
    edges.set(e.id, dir);
    endpoints.add(endpointKey(other));
    nodes.add(other.node);
  };
  for (const e of view.edges) {
    if (touches(sel, e.target)) light(e, "in", e.source);
    else if (touches(sel, e.source)) light(e, "out", e.target);
  }
  return { edges, endpoints, nodes };
}
