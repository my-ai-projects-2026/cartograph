// A file's category is the role its framework adapter gave it. Files convention
// couldn't identify are counted as unlabelled rather than guessed at.

import type { FileNode } from "../parser/types.ts";

export interface Category {
  /** The adapter's role, or null for files with none. */
  role: string | null;
  name: string;
  count: number;
}

export const UNLABELLED = "unlabelled";

export function countCategories(files: readonly Pick<FileNode, "role">[]): Category[] {
  const counts = new Map<string | null, number>();
  for (const f of files) counts.set(f.role, (counts.get(f.role) ?? 0) + 1);
  return [...counts.entries()]
    .map(([role, count]) => ({ role, name: role ?? UNLABELLED, count }))
    // Unlabelled goes last whatever its size: it is what's left, not a kind of file.
    .sort((a, b) => Number(a.role === null) - Number(b.role === null) || b.count - a.count || (a.name < b.name ? -1 : 1));
}
