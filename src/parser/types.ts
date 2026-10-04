// The shape the parser writes. Everything downstream reads this, so it is a
// contract: change it only by bumping SCHEMA_VERSION.

export const SCHEMA_VERSION = 1;

export const EDGE_KINDS = ["import", "re-export", "dynamic-import"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const SKIP_REASONS = ["too-large", "unreadable", "symlink", "syntax-error"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

// Resolved to something inside the repository that is deliberately not a node.
export const EXCLUDED_REASONS = ["target-skipped", "non-source-file", "excluded-directory"] as const;
export type ExcludedReason = (typeof EXCLUDED_REASONS)[number];

export const UNRESOLVED_REASONS = [
  "non-literal-specifier",
  "file-not-found",
  "alias-target-missing",
  "workspace-package-unresolved",
  "subpath-import-unresolved",
  "undeclared-bare-specifier",
] as const;
export type UnresolvedReason = (typeof UNRESOLVED_REASONS)[number];

export type ImportOutcome =
  | { status: "internal"; target: string }
  | { status: "external"; package: string }
  | { status: "excluded"; reason: ExcludedReason; target: string; detail: string }
  | { status: "unresolved"; reason: UnresolvedReason; detail: string };

export type ImportStatus = ImportOutcome["status"];

/** One import seen in one file. Edges and coverage are both derived from these. */
export interface ImportRecord {
  from: string;
  specifier: string;
  kind: EdgeKind;
  line: number;
  typeOnly: boolean;
  outcome: ImportOutcome;
}

export interface FileNode {
  /** Repository-relative, forward slashes. */
  path: string;
  /** Directory containing the file, "." at the root. Everything groups by this. */
  folder: string;
  lines: number;
  /** sha256 of the raw bytes, hex. */
  hash: string;
  /** What the framework adapter's conventions say this file is, or null. */
  role: string | null;
  fanIn: number;
  fanOut: number;
}

/** One per distinct (from, to) pair. */
export interface Edge {
  from: string;
  to: string;
  kinds: EdgeKind[];
  /** True only when every import between the pair is type-only. */
  typeOnly: boolean;
}

export interface SkippedFile {
  path: string;
  reason: SkipReason;
  detail: string;
}

export interface StatusCounts {
  total: number;
  internal: number;
  external: number;
  excluded: number;
  unresolved: number;
}

export interface ImportExample {
  from: string;
  line: number;
  specifier: string;
  detail: string;
}

export interface ReasonGroup {
  count: number;
  examples: ImportExample[];
}

export interface ConfigProblem {
  path: string;
  problems: string[];
}

export interface Coverage {
  files: { found: number; parsed: number; skipped: number };
  skippedFiles: SkippedFile[];
  /** Directories never walked (dependencies, dot-directories). */
  excludedDirectories: string[];
  imports: StatusCounts;
  byKind: Record<EdgeKind, StatusCounts>;
  unresolved: Partial<Record<UnresolvedReason, ReasonGroup>>;
  excluded: Partial<Record<ExcludedReason, ReasonGroup>>;
  /** tsconfig/jsconfig files that could not be fully read. Aliases may fail because of these. */
  configProblems: ConfigProblem[];
}

export interface ParseResult {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Directory name only; absolute paths would make the output machine-specific. */
  root: string;
  adapter: string;
  generatedAt: string;
  files: FileNode[];
  edges: Edge[];
  imports: ImportRecord[];
  coverage: Coverage;
}
