// Run the parser against a directory and print what it found.
//
//   pnpm parse <dir> [--out result.json]
//
// With --out, the result is written, read back through the decoder, and
// compared with what was written.

import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { parseRepository } from "../src/parser/index.ts";
import type { ParseResult, StatusCounts } from "../src/parser/index.ts";
import { decodeParseResult } from "../src/parser/read.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" } },
});

const directory = positionals[0];
if (directory === undefined) {
  console.error("usage: pnpm parse <dir> [--out result.json]");
  process.exit(2);
}

const started = performance.now();
const result = parseRepository(directory);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

const pad = (s: string | number, n: number) => String(s).padStart(n);
const row = (label: string, c: StatusCounts) =>
  `  ${label.padEnd(16)}${pad(c.total, 7)}${pad(c.internal, 10)}${pad(c.external, 10)}${pad(c.excluded, 10)}${pad(c.unresolved, 12)}`;

function report(r: ParseResult): void {
  const cov = r.coverage;
  const folders = new Set(r.files.map((f) => f.folder));
  const missingFolder = r.files.filter((f) => f.folder === "").length;

  console.log(`${r.root}  (adapter: ${r.adapter}, ${seconds}s)\n`);
  console.log(`Files    found ${cov.files.found}  parsed ${cov.files.parsed}  skipped ${cov.files.skipped}`);
  const sums = cov.files.parsed + cov.files.skipped === cov.files.found;
  console.log(`         parsed + skipped = found: ${sums ? "yes" : "NO"}`);
  for (const s of cov.skippedFiles) console.log(`  skipped ${s.path}  [${s.reason}] ${s.detail}`);
  console.log(`Folders  ${folders.size} distinct${missingFolder > 0 ? `, ${missingFolder} files with none` : ""}`);
  console.log(`Edges    ${r.edges.length} distinct file-to-file\n`);

  console.log(`  ${"imports".padEnd(16)}${pad("seen", 7)}${pad("internal", 10)}${pad("external", 10)}${pad("excluded", 10)}${pad("unresolved", 12)}`);
  console.log(row("all", cov.imports));
  for (const [kind, counts] of Object.entries(cov.byKind)) console.log(row(kind, counts));

  for (const [title, groups] of [
    ["Unresolved", cov.unresolved],
    ["Excluded", cov.excluded],
  ] as const) {
    for (const [reason, group] of Object.entries(groups)) {
      if (group === undefined) continue;
      console.log(`\n${title}: ${reason} (${group.count})`);
      for (const e of group.examples) console.log(`  ${e.from}:${e.line}  "${e.specifier}"  ${e.detail}`);
      if (group.count > group.examples.length) console.log(`  … ${group.count - group.examples.length} more`);
    }
  }

  if (cov.configProblems.length > 0) {
    console.log("\nConfig problems");
    for (const p of cov.configProblems) console.log(`  ${p.path}: ${p.problems.join("; ")}`);
  }
  if (cov.excludedDirectories.length > 0) {
    const shown = cov.excludedDirectories.slice(0, 8).join(", ");
    const more = cov.excludedDirectories.length > 8 ? ` … ${cov.excludedDirectories.length - 8} more` : "";
    console.log(`\nNot walked: ${shown}${more}`);
  }
}

report(result);

if (values.out !== undefined) {
  writeFileSync(values.out, JSON.stringify(result, null, 2));
  const back = decodeParseResult(readFileSync(values.out, "utf8"));
  if (!isDeepStrictEqual(back, result)) {
    console.error(`\nRead-back of ${values.out} does not match what was written.`);
    process.exit(1);
  }
  console.log(`\nWrote ${values.out}; read back through the decoder and identical.`);
}
