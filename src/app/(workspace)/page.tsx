import { auth } from "@clerk/nextjs/server";

// The organization comes off the session token during server rendering; no
// call to Clerk is made to produce this page.
export default async function WorkspaceHome() {
  const { orgId, orgRole } = await auth();

  return (
    <div className="p-3 text-xs">
      <dl className="grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-1">
        <dt className="text-muted">organization</dt>
        <dd className="font-mono">{orgId ?? "none"}</dd>
        <dt className="text-muted">role</dt>
        <dd className="font-mono">{orgRole ?? "none"}</dd>
      </dl>
    </div>
  );
}
