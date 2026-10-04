import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { SkippedFile } from "./types.ts";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

// Parsing cost grows with size; past this a file is almost certainly generated.
const MAX_BYTES = 1024 * 1024;

export interface ReadFile {
  abs: string;
  rel: string;
  text: string;
  lines: number;
  hash: string;
}

export interface WalkResult {
  files: ReadFile[];
  skipped: SkippedFile[];
  excludedDirectories: string[];
  packageJsons: string[];
}

/** Forward-slash path relative to root. */
export function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join("/");
}

export function isSourcePath(p: string): boolean {
  return SOURCE_EXTENSIONS.includes(path.extname(p).toLowerCase());
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const breaks = text.match(/\r\n|\r|\n/g)?.length ?? 0;
  return /[\r\n]$/.test(text) ? breaks : breaks + 1;
}

// Whole directories are kept: every source file outside a dependency or
// dot-directory becomes a candidate. Selecting a subset by size would keep a
// file and drop the leaf it imports.
export function walk(root: string): WalkResult {
  const result: WalkResult = { files: [], skipped: [], excludedDirectories: [], packageJsons: [] };

  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = toRel(root, abs);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          result.excludedDirectories.push(rel);
        } else {
          visit(abs);
        }
        continue;
      }

      // Links are never followed: they can leave the repository or loop.
      if (entry.isSymbolicLink()) {
        let isDir = false;
        try {
          isDir = statSync(abs).isDirectory();
        } catch {
          // A broken link is neither; if it looks like source it is reported below.
        }
        if (isDir) result.excludedDirectories.push(rel);
        else if (isSourcePath(entry.name)) {
          result.skipped.push({ path: rel, reason: "symlink", detail: "symbolic links are not followed" });
        }
        continue;
      }

      if (entry.name === "package.json" && entry.isFile()) result.packageJsons.push(abs);
      if (!isSourcePath(entry.name)) continue;
      if (!entry.isFile()) continue;

      let bytes: Buffer;
      try {
        const size = statSync(abs).size;
        if (size > MAX_BYTES) {
          result.skipped.push({
            path: rel,
            reason: "too-large",
            detail: `${size} bytes, limit is ${MAX_BYTES}`,
          });
          continue;
        }
        bytes = readFileSync(abs);
      } catch (error) {
        result.skipped.push({ path: rel, reason: "unreadable", detail: String(error) });
        continue;
      }

      const text = bytes.toString("utf8");
      result.files.push({
        abs,
        rel,
        text,
        lines: countLines(text),
        hash: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  };

  visit(root);
  return result;
}
