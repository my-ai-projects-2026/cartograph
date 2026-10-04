// Reading a written result back. The file is untrusted text, so every field is
// checked and rebuilt rather than cast: a wrong shape fails loudly, naming where.

import type {
  ConfigProblem,
  Coverage,
  Edge,
  FileNode,
  ImportExample,
  ImportOutcome,
  ImportRecord,
  ParseResult,
  ReasonGroup,
  SkippedFile,
  StatusCounts,
} from "./types.ts";
import { EDGE_KINDS, EXCLUDED_REASONS, SCHEMA_VERSION, SKIP_REASONS, UNRESOLVED_REASONS } from "./types.ts";

type Decoder<T> = (v: unknown, at: string) => T;

const fail = (at: string, expected: string, v: unknown): never => {
  throw new Error(`${at}: expected ${expected}, got ${JSON.stringify(v)?.slice(0, 80)}`);
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const record = (v: unknown, at: string): Record<string, unknown> => (isRecord(v) ? v : fail(at, "object", v));

const str: Decoder<string> = (v, at) => (typeof v === "string" ? v : fail(at, "string", v));
const bool: Decoder<boolean> = (v, at) => (typeof v === "boolean" ? v : fail(at, "boolean", v));
const count: Decoder<number> = (v, at) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : fail(at, "non-negative integer", v);
const nullableStr: Decoder<string | null> = (v, at) => (v === null ? null : str(v, at));

const oneOf =
  <T extends string>(values: readonly T[]): Decoder<T> =>
  (v, at) =>
    values.find((x) => x === v) ?? fail(at, values.join(" | "), v);

const array =
  <T>(item: Decoder<T>): Decoder<T[]> =>
  (v, at) =>
    Array.isArray(v) ? v.map((x, i) => item(x, `${at}[${i}]`)) : fail(at, "array", v);

const edgeKind = oneOf(EDGE_KINDS);
const unresolvedReason = oneOf(UNRESOLVED_REASONS);
const excludedReason = oneOf(EXCLUDED_REASONS);

const outcome: Decoder<ImportOutcome> = (v, at) => {
  const o = record(v, at);
  switch (o.status) {
    case "internal":
      return { status: "internal", target: str(o.target, `${at}.target`) };
    case "external":
      return { status: "external", package: str(o.package, `${at}.package`) };
    case "excluded":
      return {
        status: "excluded",
        reason: excludedReason(o.reason, `${at}.reason`),
        target: str(o.target, `${at}.target`),
        detail: str(o.detail, `${at}.detail`),
      };
    case "unresolved":
      return {
        status: "unresolved",
        reason: unresolvedReason(o.reason, `${at}.reason`),
        detail: str(o.detail, `${at}.detail`),
      };
    default:
      return fail(`${at}.status`, "internal | external | excluded | unresolved", o.status);
  }
};

const importRecord: Decoder<ImportRecord> = (v, at) => {
  const o = record(v, at);
  return {
    from: str(o.from, `${at}.from`),
    specifier: str(o.specifier, `${at}.specifier`),
    kind: edgeKind(o.kind, `${at}.kind`),
    line: count(o.line, `${at}.line`),
    typeOnly: bool(o.typeOnly, `${at}.typeOnly`),
    outcome: outcome(o.outcome, `${at}.outcome`),
  };
};

const fileNode: Decoder<FileNode> = (v, at) => {
  const o = record(v, at);
  return {
    path: str(o.path, `${at}.path`),
    folder: str(o.folder, `${at}.folder`),
    lines: count(o.lines, `${at}.lines`),
    hash: str(o.hash, `${at}.hash`),
    role: nullableStr(o.role, `${at}.role`),
    fanIn: count(o.fanIn, `${at}.fanIn`),
    fanOut: count(o.fanOut, `${at}.fanOut`),
  };
};

const edge: Decoder<Edge> = (v, at) => {
  const o = record(v, at);
  return {
    from: str(o.from, `${at}.from`),
    to: str(o.to, `${at}.to`),
    kinds: array(edgeKind)(o.kinds, `${at}.kinds`),
    typeOnly: bool(o.typeOnly, `${at}.typeOnly`),
  };
};

const statusCounts: Decoder<StatusCounts> = (v, at) => {
  const o = record(v, at);
  return {
    total: count(o.total, `${at}.total`),
    internal: count(o.internal, `${at}.internal`),
    external: count(o.external, `${at}.external`),
    excluded: count(o.excluded, `${at}.excluded`),
    unresolved: count(o.unresolved, `${at}.unresolved`),
  };
};

const example: Decoder<ImportExample> = (v, at) => {
  const o = record(v, at);
  return {
    from: str(o.from, `${at}.from`),
    line: count(o.line, `${at}.line`),
    specifier: str(o.specifier, `${at}.specifier`),
    detail: str(o.detail, `${at}.detail`),
  };
};

const reasonGroup: Decoder<ReasonGroup> = (v, at) => {
  const o = record(v, at);
  return { count: count(o.count, `${at}.count`), examples: array(example)(o.examples, `${at}.examples`) };
};

const reasonGroups =
  <R extends string>(reason: Decoder<R>): Decoder<Partial<Record<R, ReasonGroup>>> =>
  (v, at) => {
    const out: Partial<Record<R, ReasonGroup>> = {};
    for (const [key, group] of Object.entries(record(v, at))) {
      out[reason(key, `${at} key`)] = reasonGroup(group, `${at}.${key}`);
    }
    return out;
  };

const skippedFile: Decoder<SkippedFile> = (v, at) => {
  const o = record(v, at);
  return {
    path: str(o.path, `${at}.path`),
    reason: oneOf(SKIP_REASONS)(o.reason, `${at}.reason`),
    detail: str(o.detail, `${at}.detail`),
  };
};

const configProblem: Decoder<ConfigProblem> = (v, at) => {
  const o = record(v, at);
  return { path: str(o.path, `${at}.path`), problems: array(str)(o.problems, `${at}.problems`) };
};

const coverage: Decoder<Coverage> = (v, at) => {
  const o = record(v, at);
  const files = record(o.files, `${at}.files`);
  const byKind = record(o.byKind, `${at}.byKind`);
  return {
    files: {
      found: count(files.found, `${at}.files.found`),
      parsed: count(files.parsed, `${at}.files.parsed`),
      skipped: count(files.skipped, `${at}.files.skipped`),
    },
    skippedFiles: array(skippedFile)(o.skippedFiles, `${at}.skippedFiles`),
    excludedDirectories: array(str)(o.excludedDirectories, `${at}.excludedDirectories`),
    imports: statusCounts(o.imports, `${at}.imports`),
    byKind: {
      import: statusCounts(byKind.import, `${at}.byKind.import`),
      "re-export": statusCounts(byKind["re-export"], `${at}.byKind.re-export`),
      "dynamic-import": statusCounts(byKind["dynamic-import"], `${at}.byKind.dynamic-import`),
    },
    unresolved: reasonGroups(unresolvedReason)(o.unresolved, `${at}.unresolved`),
    excluded: reasonGroups(excludedReason)(o.excluded, `${at}.excluded`),
    configProblems: array(configProblem)(o.configProblems, `${at}.configProblems`),
  };
};

/** Decode a parse result from JSON text, or throw naming the first bad field. */
export function decodeParseResult(json: string): ParseResult {
  const o = record(JSON.parse(json), "result");
  if (o.schemaVersion !== SCHEMA_VERSION) fail("result.schemaVersion", String(SCHEMA_VERSION), o.schemaVersion);
  return {
    schemaVersion: SCHEMA_VERSION,
    root: str(o.root, "result.root"),
    adapter: str(o.adapter, "result.adapter"),
    generatedAt: str(o.generatedAt, "result.generatedAt"),
    files: array(fileNode)(o.files, "result.files"),
    edges: array(edge)(o.edges, "result.edges"),
    imports: array(importRecord)(o.imports, "result.imports"),
    coverage: coverage(o.coverage, "result.coverage"),
  };
}
