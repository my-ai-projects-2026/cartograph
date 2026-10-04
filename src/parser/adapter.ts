// Framework knowledge lives behind this interface so the parser never branches
// on a framework. The parser asks; the adapter answers from convention.

export interface RepoFacts {
  /** Every dependency name declared in any package.json in the repository. */
  dependencies: ReadonlySet<string>;
}

export interface FrameworkAdapter {
  readonly name: string;
  /** Whether this repository uses the framework the adapter knows about. */
  detect(repo: RepoFacts): boolean;
  /** What convention says the file at this repository-relative path is, or null. */
  roleOf(path: string): string | null;
}

/** Assumes no framework: detects everything, knows nothing. */
export const fallbackAdapter: FrameworkAdapter = {
  name: "none",
  detect: () => true,
  roleOf: () => null,
};

/** The first adapter that recognises the repository, else the fallback. */
export function pickAdapter(adapters: readonly FrameworkAdapter[], repo: RepoFacts): FrameworkAdapter {
  return adapters.find((a) => a.detect(repo)) ?? fallbackAdapter;
}
