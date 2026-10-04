import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeParseResult } from "@/parser/read";
import type { ParseResult } from "@/parser/types";

// Scaffolding: real parser output for AI-Flight-Booking (226 files), checked in
// so the map can be built without an account, database or network. Read back
// through the same decoder as any written result, so the type is checked, not
// asserted. Goes away once analyses are stored.
export function loadPreview(): ParseResult {
  return decodeParseResult(readFileSync(path.join(process.cwd(), "src/preview/parse-result.json"), "utf8"));
}
