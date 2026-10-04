// Pure functions over the import records. No I/O, nothing to mock.

import type {
  Coverage,
  Edge,
  EdgeKind,
  ExcludedReason,
  ImportRecord,
  ReasonGroup,
  StatusCounts,
  UnresolvedReason,
} from "./types.ts";
import { EDGE_KINDS } from "./types.ts";

const EXAMPLES_PER_REASON = 10;

/** One edge per distinct (from, to) pair, from internal imports only. */
export function buildEdges(records: readonly ImportRecord[]): Edge[] {
  const byPair = new Map<string, Edge>();
  for (const r of records) {
    if (r.outcome.status !== "internal") continue;
    const key = `${r.from}\u0000${r.outcome.target}`;
    const edge = byPair.get(key);
    if (edge === undefined) {
      byPair.set(key, { from: r.from, to: r.outcome.target, kinds: [r.kind], typeOnly: r.typeOnly });
    } else {
      if (!edge.kinds.includes(r.kind)) edge.kinds.push(r.kind);
      edge.typeOnly = edge.typeOnly && r.typeOnly;
    }
  }
  for (const edge of byPair.values()) {
    edge.kinds.sort((a, b) => EDGE_KINDS.indexOf(a) - EDGE_KINDS.indexOf(b));
  }
  return [...byPair.values()];
}

/** Fan-in and fan-out per path. Expects deduplicated edges, as buildEdges returns. */
export function fanCounts(
  paths: readonly string[],
  edges: readonly Edge[],
): Map<string, { fanIn: number; fanOut: number }> {
  const counts = new Map(paths.map((p) => [p, { fanIn: 0, fanOut: 0 }]));
  for (const e of edges) {
    const from = counts.get(e.from);
    const to = counts.get(e.to);
    if (from === undefined || to === undefined) {
      throw new Error(`Edge ${e.from} -> ${e.to} points at a file that is not a node`);
    }
    from.fanOut += 1;
    to.fanIn += 1;
  }
  return counts;
}

const emptyCounts = (): StatusCounts => ({ total: 0, internal: 0, external: 0, excluded: 0, unresolved: 0 });

export function summariseImports(
  records: readonly ImportRecord[],
): Pick<Coverage, "imports" | "byKind" | "unresolved" | "excluded"> {
  const imports = emptyCounts();
  const byKind: Record<EdgeKind, StatusCounts> = {
    import: emptyCounts(),
    "re-export": emptyCounts(),
    "dynamic-import": emptyCounts(),
  };
  const unresolved: Partial<Record<UnresolvedReason, ReasonGroup>> = {};
  const excluded: Partial<Record<ExcludedReason, ReasonGroup>> = {};

  const note = (group: ReasonGroup | undefined, r: ImportRecord, detail: string): ReasonGroup => {
    const g = group ?? { count: 0, examples: [] };
    g.count += 1;
    if (g.examples.length < EXAMPLES_PER_REASON) {
      g.examples.push({ from: r.from, line: r.line, specifier: r.specifier, detail });
    }
    return g;
  };

  for (const r of records) {
    const status = r.outcome.status;
    imports.total += 1;
    imports[status] += 1;
    byKind[r.kind].total += 1;
    byKind[r.kind][status] += 1;

    if (r.outcome.status === "unresolved") {
      unresolved[r.outcome.reason] = note(unresolved[r.outcome.reason], r, r.outcome.detail);
    } else if (r.outcome.status === "excluded") {
      excluded[r.outcome.reason] = note(excluded[r.outcome.reason], r, r.outcome.detail);
    }
  }

  return { imports, byKind, unresolved, excluded };
}
