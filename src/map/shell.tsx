import type { ReactNode } from "react";

// The three columns every map screen uses. Placement is fixed here and later
// phases only fill the slots: the detail pane is a real column, never an
// overlay, so selecting something never covers the map.
export function MapShell({
  rail,
  canvas,
  detail,
}: {
  rail: ReactNode;
  canvas: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_20rem]">
      <aside aria-label="Categories" className="flex min-h-0 flex-col border-r border-line">
        <PaneHeader>Categories</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">{rail}</div>
      </aside>
      <section aria-label="Map" className="relative min-h-0 bg-raised/40">
        {canvas}
      </section>
      <aside aria-label="Details" className="flex min-h-0 flex-col border-l border-line">
        <PaneHeader>Details</PaneHeader>
        <div className="min-h-0 flex-1 overflow-auto">{detail}</div>
      </aside>
    </div>
  );
}

function PaneHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-line px-3 text-[11px] font-medium text-muted">
      {children}
    </div>
  );
}
