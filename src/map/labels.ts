// Labels are the shortest trailing part of a path that is still unique among
// everything on screen, so "objects" only grows a parent when two are showing.

export const ROOT_LABEL = "./";

export function shortestUniqueLabels(paths: readonly string[]): Map<string, string> {
  const labels = new Map<string, string>();
  const segmented = paths.filter((p) => p !== ".").map((p) => ({ path: p, parts: p.split("/") }));

  for (const { path, parts } of segmented) {
    let take = 1;
    const suffix = (ps: string[], n: number) => ps.slice(-n).join("/");
    while (
      take < parts.length &&
      segmented.some((o) => o.path !== path && suffix(o.parts, take) === suffix(parts, take))
    ) {
      take += 1;
    }
    labels.set(path, suffix(parts, take));
  }
  if (paths.includes(".")) labels.set(".", ROOT_LABEL);
  return labels;
}
