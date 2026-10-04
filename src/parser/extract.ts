import { Node, Project, SyntaxKind, ts } from "ts-morph";
import type { EdgeKind } from "./types.ts";
import type { ReadFile } from "./walk.ts";

export interface RawImport {
  /** Null when a dynamic import's argument is not a literal string. */
  specifier: string | null;
  /** Source text of the argument, kept so a non-literal can be reported. */
  text: string;
  kind: EdgeKind;
  line: number;
  typeOnly: boolean;
}

export interface Extraction {
  /** Keyed by repository-relative path. */
  imports: Map<string, RawImport[]>;
  /** Files whose syntax didn't parse cleanly, with the first error. */
  syntaxErrors: Map<string, string>;
}

const DYNAMIC_IMPORT = /\bimport\s*\(/;

// Files are parsed from text already read by the walk, inside an in-memory file
// system: the parser reads each file once and never resolves anything here.
export function extractImports(files: readonly ReadFile[]): Extraction {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve, noLib: true, noResolve: true, types: [] },
  });
  const sources = files.map((f) => ({ rel: f.rel, sf: project.createSourceFile(`/${f.rel}`, f.text) }));

  // A tolerant parser still yields a tree for broken syntax, but imports after
  // the error may be missing from it. Such a file is skipped, not half-read.
  const program = project.getProgram().compilerObject;
  const result: Extraction = { imports: new Map(), syntaxErrors: new Map() };

  for (const { rel, sf } of sources) {
    const diagnostics = program.getSyntacticDiagnostics(sf.compilerNode);
    if (diagnostics.length > 0) {
      const first = diagnostics[0];
      const line = first.start === undefined ? 0 : sf.getLineAndColumnAtPos(first.start).line;
      result.syntaxErrors.set(rel, `line ${line}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`);
      continue;
    }

    const found: RawImport[] = [];

    for (const d of sf.getImportDeclarations()) {
      found.push({
        specifier: d.getModuleSpecifierValue(),
        text: d.getModuleSpecifier().getText(),
        kind: "import",
        line: d.getStartLineNumber(),
        typeOnly: d.isTypeOnly(),
      });
    }

    for (const d of sf.getExportDeclarations()) {
      const specifier = d.getModuleSpecifierValue();
      if (specifier === undefined) continue; // a local `export { x }`, not a re-export
      found.push({
        specifier,
        text: d.getModuleSpecifier()?.getText() ?? specifier,
        kind: "re-export",
        line: d.getStartLineNumber(),
        typeOnly: d.isTypeOnly(),
      });
    }

    if (DYNAMIC_IMPORT.test(sf.getFullText())) {
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
        const arg = call.getArguments()[0];
        const literal =
          arg !== undefined && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))
            ? arg.getLiteralValue()
            : null;
        found.push({
          specifier: literal,
          text: arg?.getText() ?? "",
          kind: "dynamic-import",
          line: call.getStartLineNumber(),
          typeOnly: false,
        });
      }
    }

    result.imports.set(rel, found.sort((a, b) => a.line - b.line));
  }

  return result;
}
