// The parser: a directory path in, files, edges and coverage out. It imports no
// web framework, UI library or database client, and fetches nothing.

import { readFileSync } from "node:fs";
import path from "node:path";
import { pickAdapter } from "./adapter.ts";
import type { FrameworkAdapter, RepoFacts } from "./adapter.ts";
import { extractImports } from "./extract.ts";
import { buildEdges, fanCounts, summariseImports } from "./graph.ts";
import { createResolver } from "./resolve.ts";
import { SCHEMA_VERSION } from "./types.ts";
import type { ConfigProblem, FileNode, ImportRecord, ParseResult, SkippedFile } from "./types.ts";
import { toRel, walk } from "./walk.ts";

export type { FrameworkAdapter, RepoFacts } from "./adapter.ts";
export { fallbackAdapter } from "./adapter.ts";
export * from "./types.ts";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

interface Manifests {
  facts: RepoFacts;
  workspacePackages: Map<string, string>;
  problems: ConfigProblem[];
}

function readManifests(root: string, paths: readonly string[]): Manifests {
  const dependencies = new Set<string>();
  const workspacePackages = new Map<string, string>();
  const problems: ConfigProblem[] = [];

  for (const abs of paths) {
    const rel = toRel(root, abs);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(abs, "utf8"));
    } catch (error) {
      problems.push({ path: rel, problems: [`unreadable: ${String(error)}`] });
      continue;
    }
    if (!isRecord(data)) {
      problems.push({ path: rel, problems: ["not a JSON object"] });
      continue;
    }
    if (typeof data.name === "string") workspacePackages.set(data.name, rel);
    for (const field of DEPENDENCY_FIELDS) {
      const deps = data[field];
      if (isRecord(deps)) for (const name of Object.keys(deps)) dependencies.add(name);
    }
  }

  return { facts: { dependencies }, workspacePackages, problems };
}

export function parseRepository(
  directory: string,
  adapters: readonly FrameworkAdapter[] = [],
): ParseResult {
  const root = path.resolve(directory);
  const walked = walk(root);
  const manifests = readManifests(root, walked.packageJsons);
  const adapter = pickAdapter(adapters, manifests.facts);

  const extraction = extractImports(walked.files);

  const skipped: SkippedFile[] = [...walked.skipped];
  for (const [rel, detail] of extraction.syntaxErrors) skipped.push({ path: rel, reason: "syntax-error", detail });
  skipped.sort((a, b) => a.path.localeCompare(b.path));

  const parsed = walked.files.filter((f) => !extraction.syntaxErrors.has(f.rel));
  const absOf = (rel: string): string => path.join(root, ...rel.split("/"));

  const resolver = createResolver({
    root,
    nodes: parsed.map((f) => f.abs),
    skipped: new Map(skipped.map((s) => [absOf(s.path), s])),
    declaredDependencies: manifests.facts.dependencies,
    workspacePackages: manifests.workspacePackages,
  });

  const imports: ImportRecord[] = [];
  for (const file of parsed) {
    for (const raw of extraction.imports.get(file.rel) ?? []) {
      imports.push({
        from: file.rel,
        specifier: raw.specifier ?? raw.text,
        kind: raw.kind,
        line: raw.line,
        typeOnly: raw.typeOnly,
        outcome: resolver.resolve(file.abs, raw),
      });
    }
  }

  const edges = buildEdges(imports);
  const fans = fanCounts(
    parsed.map((f) => f.rel),
    edges,
  );

  const files: FileNode[] = parsed.map((f) => {
    const slash = f.rel.lastIndexOf("/");
    const fan = fans.get(f.rel) ?? { fanIn: 0, fanOut: 0 };
    return {
      path: f.rel,
      folder: slash === -1 ? "." : f.rel.slice(0, slash),
      lines: f.lines,
      hash: f.hash,
      role: adapter.roleOf(f.rel),
      fanIn: fan.fanIn,
      fanOut: fan.fanOut,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    root: path.basename(root),
    adapter: adapter.name,
    generatedAt: new Date().toISOString(),
    files,
    edges,
    imports,
    coverage: {
      files: { found: walked.files.length + walked.skipped.length, parsed: parsed.length, skipped: skipped.length },
      skippedFiles: skipped,
      excludedDirectories: walked.excludedDirectories,
      ...summariseImports(imports),
      configProblems: [...manifests.problems, ...resolver.configProblems()],
    },
  };
}
