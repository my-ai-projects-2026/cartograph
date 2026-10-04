// Two files and the import between them: the only thing this app ever draws.
export function Wordmark() {
  return (
    <span className="flex items-center gap-1.5 text-fg">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
        <rect x="0.5" y="0.5" width="5" height="5" fill="none" stroke="currentColor" />
        <rect x="8.5" y="8.5" width="5" height="5" fill="currentColor" stroke="currentColor" />
        <path d="M3 6v5h5" fill="none" stroke="currentColor" />
      </svg>
      <span className="font-mono text-[12px] font-medium tracking-tight">cartograph</span>
    </span>
  );
}
