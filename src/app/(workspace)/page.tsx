import { createServerDb } from "@/db/server";
import type { Database } from "@/db/types";

const LIST_LIMIT = 100;

type Status = Database["public"]["Enums"]["analysis_status"];

// Status is told apart by shape, not hue: colour is reserved for edge direction
// and file kind, so a status can't borrow green or amber.
const STATUS_MARK: Record<Status, { glyph: string; className: string }> = {
  queued: { glyph: "○", className: "text-faint" },
  running: { glyph: "◐", className: "text-fg" },
  complete: { glyph: "●", className: "text-muted" },
  failed: { glyph: "✕", className: "text-fg font-medium" },
};

const timestamp = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

function duration(from: string, to: string | null): string | null {
  if (!to) return null;
  const seconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function Header({ count }: { count: number }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
      <h1 className="text-[13px] font-semibold">Analyses</h1>
      <span className="tabular-nums text-muted">{count}</span>
      {count === LIST_LIMIT && (
        <span className="ml-auto text-xs text-muted">Showing the newest {LIST_LIMIT}</span>
      )}
    </div>
  );
}

// No organization filter here on purpose: the policy decides which rows come
// back, from the organization claim on the token. Switching organization swaps
// the token, so this same query returns the other organization's rows.
export default async function Dashboard() {
  const db = await createServerDb();
  const { data: analyses, error } = await db
    .from("analyses")
    .select("id, status, commit_sha, created_at, finished_at, project:projects(repo_owner, repo_name)")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(`Loading analyses failed: ${error.message}`);

  if (analyses.length === 0) {
    return (
      <>
        <Header count={0} />
        <div className="px-3 py-10">
          <div className="max-w-sm border border-dashed border-line px-4 py-5">
            <p className="font-medium">No analyses in this team yet</p>
            <p className="mt-1 text-xs text-muted">
              Each repository this team maps will be listed here, with its commit and how long
              the parse took.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header count={analyses.length} />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-surface text-[11px] text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 pr-4 pl-3 font-normal">Repository</th>
              <th scope="col" className="w-28 py-1.5 pr-4 font-normal">Status</th>
              <th scope="col" className="w-24 py-1.5 pr-4 font-normal">Commit</th>
              <th scope="col" className="w-36 py-1.5 pr-4 font-normal">Started (UTC)</th>
              <th scope="col" className="w-20 py-1.5 pr-3 text-right font-normal">Took</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => {
              const mark = STATUS_MARK[a.status];
              return (
                <tr key={a.id} className="border-b border-rule">
                  <td className="py-1.5 pr-4 pl-3 font-mono">
                    <span className="text-muted">{a.project.repo_owner}/</span>
                    {a.project.repo_name}
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className={`w-3 text-center ${mark.className}`}>
                        {mark.glyph}
                      </span>
                      <span className={a.status === "failed" ? "font-medium" : undefined}>
                        {a.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-muted" title={a.commit_sha ?? undefined}>
                    {a.commit_sha?.slice(0, 7) ?? "—"}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums text-muted">
                    {timestamp.format(new Date(a.created_at))}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {duration(a.created_at, a.finished_at) ?? <span className="text-faint">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
