// Fold a written parse result and print the counts the canvas phase is checked by.
//
//   pnpm fold-check [result.json]     (defaults to the preview data)

import { readFileSync } from "node:fs";
import { decodeParseResult } from "../src/parser/read.ts";
import { foldDirectories } from "../src/map/fold.ts";
import { MORE, deriveView } from "../src/map/view.ts";

const file = process.argv[2] ?? "src/preview/parse-result.json";
const result = decodeParseResult(readFileSync(file, "utf8"));
const folding = foldDirectories(result.files);
const view = deriveView(result.files, result.edges, folding, new Set());

const nodeIds = new Set(view.nodes.map((n) => n.id));
const single = folding.groups.filter((g) => g.files.length < 2);
const dangling = view.edges.filter((e) => !nodeIds.has(e.source.node) || !nodeIds.has(e.target.node));
const lost = result.edges.filter((e) => !folding.ownerOf.has(e.from) || !folding.ownerOf.has(e.to));

console.log(`${result.root}: ${result.files.length} files, ${result.edges.length} file edges`);
console.log(`threshold ${folding.threshold}\n`);
for (const g of folding.groups) console.log(`  ${String(g.files.length).padStart(4)}  ${g.dir}`);
console.log(`\n1. nodes: ${view.nodes.length}  (files per node ${(result.files.length / view.nodes.length).toFixed(1)})`);
console.log(`2. nodes holding one file or fewer: ${single.length}`);
console.log(`3. edges between nodes: ${view.edges.length}, ending on a missing node: ${dangling.length}`);
console.log(`   file edges with an endpoint in no group: ${lost.length}`);

// With every group open as a panel, each edge must land on a row that panel draws.
const opened = deriveView(result.files, result.edges, folding, new Set(folding.groups.map((g) => g.dir)));
const rowsOf = new Map(
  opened.nodes.map((n) => [n.id, new Set(n.kind === "panel" ? [...n.rows.map((r) => r.path), ...(n.hidden > 0 ? [MORE] : [])] : [])]),
);
const offRow = opened.edges.filter((e) => [e.source, e.target].some((end) => end.row === null || !rowsOf.get(end.node)?.has(end.row)));
console.log(`   all open: ${opened.edges.length} edges between rows, ending on a missing row: ${offRow.length}`);

if (single.length > 0 || dangling.length > 0 || lost.length > 0 || offRow.length > 0) process.exit(1);
