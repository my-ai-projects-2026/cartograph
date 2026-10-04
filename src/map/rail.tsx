import type { Category } from "./categories";

// Kind hues sit away from the accent blue and the green/amber of direction.
const KIND_HUES = ["#7c3aed", "#0f766e", "#be185d", "#a16207", "#4f46e5", "#0e7490"];

export function CategoryRail({ categories }: { categories: Category[] }) {
  const labelled = categories.filter((c) => c.role !== null);
  return (
    <ul className="py-1 text-xs">
      {categories.map((c) => {
        const hue = c.role === null ? undefined : KIND_HUES[labelled.indexOf(c) % KIND_HUES.length];
        return (
          <li key={c.name} className="flex h-6 items-center gap-2 px-3">
            <span
              aria-hidden
              className={`size-2.5 shrink-0 rounded-[2px] ${hue === undefined ? "border border-faint" : ""}`}
              style={hue === undefined ? undefined : { background: hue }}
            />
            <span className={`min-w-0 flex-1 truncate ${c.role === null ? "text-muted" : ""}`}>{c.name}</span>
            <span className="tabular-nums text-muted">{c.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
