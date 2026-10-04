import { realpathSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { ts } from "ts-morph";
import type { RawImport } from "./extract.ts";
import type { ConfigProblem, ImportOutcome, SkippedFile } from "./types.ts";
import { isSourcePath, toRel } from "./walk.ts";

export interface ResolverInput {
  root: string;
  /** Absolute path of every file that became a node. */
  nodes: readonly string[];
  /** Absolute path → why it was skipped. */
  skipped: ReadonlyMap<string, SkippedFile>;
  declaredDependencies: ReadonlySet<string>;
  /** Package name → repository-relative package.json that declares it. */
  workspacePackages: ReadonlyMap<string, string>;
}

export interface Resolver {
  resolve(fromAbs: string, raw: RawImport): ImportOutcome;
  configProblems(): ConfigProblem[];
}

interface LoadedConfig {
  path: string | null;
  options: ts.CompilerOptions;
  fileKeys: ReadonlySet<string>;
  references: string[];
  cache: ts.ModuleResolutionCache;
}

const CONFIG_NAMES = ["tsconfig.json", "jsconfig.json"];
// "No inputs were found" only means the config's include matched nothing; its
// compiler options are still the ones that govern resolution.
const IGNORED_CONFIG_ERRORS = new Set([18003]);

const caseInsensitive = process.platform === "win32" || process.platform === "darwin";
const keyOf = (p: string): string => {
  const normal = path.resolve(p).split(path.sep).join("/");
  return caseInsensitive ? normal.toLowerCase() : normal;
};

function realpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isRelative(specifier: string): boolean {
  return specifier === "." || specifier === ".." || /^\.\.?\//.test(specifier) || path.isAbsolute(specifier);
}

/** The text a `paths` pattern's `*` captured, or null if it doesn't match. */
function matchPattern(specifier: string, pattern: string): string | null {
  const star = pattern.indexOf("*");
  if (star === -1) return specifier === pattern ? "" : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (specifier.length < prefix.length + suffix.length) return null;
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

// Resolution is TypeScript's own, driven by whichever tsconfig governs the
// importing file, so aliases, baseUrl, index files and package exports behave
// exactly as the repository's own compiler sees them.
export function createResolver(input: ResolverInput): Resolver {
  const { root } = input;
  const nodeByKey = new Map(input.nodes.map((abs) => [keyOf(abs), abs]));
  const skippedByKey = new Map([...input.skipped].map(([abs, s]) => [keyOf(abs), s]));
  const problems: ConfigProblem[] = [];
  const configs = new Map<string, LoadedConfig>();
  const nearestConfigByDir = new Map<string, string | null>();

  const rel = (abs: string): string => toRel(root, abs);

  // Installed dependencies live under node_modules: outside the repository's
  // own code even when physically inside its directory.
  const insideRepository = (abs: string): boolean => {
    const r = path.relative(root, abs);
    if (r.startsWith("..") || path.isAbsolute(r)) return false;
    return !r.split(path.sep).includes("node_modules");
  };

  /** The dot-directory the walk declined to enter, if the path is inside one. */
  const unwalkedDirectory = (abs: string): string | null => {
    const segments = path.relative(root, abs).split(path.sep);
    const i = segments.findIndex((seg, n) => n < segments.length - 1 && seg.startsWith("."));
    return i === -1 ? null : segments.slice(0, i + 1).join("/");
  };

  const defaultOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
  };

  const finishOptions = (options: ts.CompilerOptions): ts.CompilerOptions => {
    const out = { ...options, allowJs: true, resolveJsonModule: true };
    // Classic resolution (TypeScript's default when unset for non-CommonJS
    // modules) finds neither index files nor packages, and no toolchain in use
    // resolves that way. Bundler is what such a project actually builds with.
    if (out.moduleResolution === undefined || out.moduleResolution === ts.ModuleResolutionKind.Classic) {
      out.moduleResolution = ts.ModuleResolutionKind.Bundler;
    }
    return out;
  };

  const makeCache = (options: ts.CompilerOptions) =>
    ts.createModuleResolutionCache(root, (s) => (caseInsensitive ? s.toLowerCase() : s), options);

  const loadConfig = (configPath: string | null): LoadedConfig => {
    const cacheKey = configPath === null ? "<default>" : keyOf(configPath);
    const existing = configs.get(cacheKey);
    if (existing) return existing;

    let loaded: LoadedConfig;
    if (configPath === null) {
      const options = finishOptions(defaultOptions);
      loaded = { path: null, options, fileKeys: new Set(), references: [], cache: makeCache(options) };
    } else {
      const issues: string[] = [];
      const read = ts.readConfigFile(configPath, ts.sys.readFile);
      if (read.error) issues.push(ts.flattenDiagnosticMessageText(read.error.messageText, " "));
      const parsed = ts.parseJsonConfigFileContent(
        read.config ?? {},
        ts.sys,
        path.dirname(configPath),
        undefined,
        configPath,
      );
      for (const e of parsed.errors) {
        if (!IGNORED_CONFIG_ERRORS.has(e.code)) issues.push(ts.flattenDiagnosticMessageText(e.messageText, " "));
      }
      if (issues.length > 0) problems.push({ path: rel(configPath), problems: issues });

      const options = finishOptions({ ...defaultOptions, ...parsed.options });
      loaded = {
        path: configPath,
        options,
        fileKeys: new Set(parsed.fileNames.map(keyOf)),
        references: (parsed.projectReferences ?? []).map((r) =>
          r.path.endsWith(".json") ? r.path : path.join(r.path, "tsconfig.json"),
        ),
        cache: makeCache(options),
      };
    }
    configs.set(cacheKey, loaded);
    return loaded;
  };

  const nearestConfig = (dir: string): string | null => {
    const known = nearestConfigByDir.get(dir);
    if (known !== undefined) return known;
    let found: string | null = null;
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) {
        found = candidate;
        break;
      }
    }
    if (found === null && path.relative(root, dir) !== "") {
      const parent = path.dirname(dir);
      found = parent === dir ? null : nearestConfig(parent);
    }
    nearestConfigByDir.set(dir, found);
    return found;
  };

  // The nearest config may be a solution file whose own file list is empty and
  // whose references hold the real options (aliases included). Prefer the
  // config that actually lists this file.
  const configFor = (fileAbs: string): LoadedConfig => {
    const nearest = loadConfig(nearestConfig(path.dirname(fileAbs)));
    const fileKey = keyOf(fileAbs);
    if (nearest.fileKeys.has(fileKey)) return nearest;

    const seen = new Set<string>();
    const queue = [...nearest.references];
    while (queue.length > 0) {
      const ref = queue.shift();
      if (ref === undefined || seen.has(keyOf(ref)) || !isFile(ref)) continue;
      seen.add(keyOf(ref));
      const config = loadConfig(ref);
      if (config.fileKeys.has(fileKey)) return config;
      queue.push(...config.references);
    }
    return nearest;
  };

  const classifyResolved = (resolvedFile: string, specifier: string): ImportOutcome => {
    const real = realpath(resolvedFile);
    if (!insideRepository(real)) {
      return { status: "external", package: isRelative(specifier) ? specifier : packageName(specifier) };
    }

    const unwalked = unwalkedDirectory(real);
    if (unwalked !== null) {
      return {
        status: "excluded",
        reason: "excluded-directory",
        target: rel(real),
        detail: `${unwalked} is not walked`,
      };
    }

    const key = keyOf(real);
    const node = nodeByKey.get(key);
    if (node !== undefined) return { status: "internal", target: rel(node) };

    const skipped = skippedByKey.get(key);
    if (skipped !== undefined) {
      return {
        status: "excluded",
        reason: "target-skipped",
        target: skipped.path,
        detail: `target was skipped (${skipped.reason}: ${skipped.detail})`,
      };
    }

    if (!isSourcePath(real)) {
      return {
        status: "excluded",
        reason: "non-source-file",
        target: rel(real),
        detail: `${path.extname(real) || "extensionless"} files are not parsed`,
      };
    }

    // Every source file inside the repository was either kept or skipped.
    throw new Error(`Resolved to ${rel(real)}, which the walk neither kept nor skipped`);
  };

  const existingAsset = (candidates: readonly string[]): ImportOutcome | null => {
    for (const c of candidates) {
      if (isFile(c) && !isSourcePath(c) && insideRepository(realpath(c))) {
        return {
          status: "excluded",
          reason: "non-source-file",
          target: rel(realpath(c)),
          detail: `${path.extname(c) || "extensionless"} files are not parsed`,
        };
      }
    }
    return null;
  };

  const classifyUnresolved = (fromAbs: string, specifier: string, config: LoadedConfig): ImportOutcome => {
    if (isRelative(specifier)) {
      const target = path.resolve(path.dirname(fromAbs), specifier);
      const asset = existingAsset([target]);
      if (asset) return asset;
      const shown = path.relative(root, target).startsWith("..") ? specifier : rel(target);
      return {
        status: "unresolved",
        reason: "file-not-found",
        detail: `nothing at ${shown}, with any source extension, or as a directory index`,
      };
    }

    if (specifier.startsWith("#")) {
      return {
        status: "unresolved",
        reason: "subpath-import-unresolved",
        detail: `no package.json "imports" entry resolved ${specifier}`,
      };
    }

    const paths = config.options.paths ?? {};
    const base = config.options.baseUrl ?? (config.path === null ? root : path.dirname(config.path));
    for (const [pattern, substitutions] of Object.entries(paths)) {
      const captured = matchPattern(specifier, pattern);
      if (captured === null) continue;
      const candidates = substitutions.map((s) => path.resolve(base, s.replace("*", captured)));
      const asset = existingAsset(candidates);
      if (asset) return asset;
      const configName = config.path === null ? "default options" : rel(config.path);
      return {
        status: "unresolved",
        reason: "alias-target-missing",
        detail: `matches "${pattern}" in ${configName}, but nothing at ${candidates.map(rel).join(" or ")}`,
      };
    }

    const name = packageName(specifier);
    if (specifier.startsWith("node:") || builtinModules.includes(name)) {
      return { status: "external", package: specifier.startsWith("node:") ? specifier : name };
    }

    const workspaceManifest = input.workspacePackages.get(name);
    if (workspaceManifest !== undefined) {
      return {
        status: "unresolved",
        reason: "workspace-package-unresolved",
        detail: `"${name}" is the package in ${workspaceManifest}, but no entry file resolved for ${specifier}`,
      };
    }

    if (input.declaredDependencies.has(name)) return { status: "external", package: name };

    return {
      status: "unresolved",
      reason: "undeclared-bare-specifier",
      detail: `"${name}" is not declared in any package.json and matches no path alias`,
    };
  };

  return {
    resolve(fromAbs, raw) {
      if (raw.specifier === null) {
        return {
          status: "unresolved",
          reason: "non-literal-specifier",
          detail: `import(${raw.text}) is computed at runtime`,
        };
      }
      const config = configFor(fromAbs);
      const resolved = ts.resolveModuleName(raw.specifier, fromAbs, config.options, ts.sys, config.cache);
      const file = resolved.resolvedModule?.resolvedFileName;
      return file !== undefined
        ? classifyResolved(file, raw.specifier)
        : classifyUnresolved(fromAbs, raw.specifier, config);
    },
    configProblems: () => problems,
  };
}
