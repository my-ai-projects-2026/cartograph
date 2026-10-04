-- Workspace schema: everything an analysis produces, owned by an organization.
--
-- Authorization is the policies at the bottom of this file and nothing else.
-- The application never adds an organization filter; if a query returns
-- another organization's row, the policy is the bug.

-- ---------------------------------------------------------------------------
-- RLS on by default.
--
-- A table without RLS returns every row to every caller, silently. This event
-- trigger enables RLS on any table created in `public`, by any later migration,
-- so forgetting is impossible rather than unlikely. Each table below also
-- enables it explicitly, so this file reads correctly on its own.
-- ---------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.enable_rls_on_new_tables()
returns event_trigger
language plpgsql
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type = 'table'
      and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', obj.object_identity);
  end loop;
end;
$$;

create event trigger enable_rls_on_new_tables
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function private.enable_rls_on_new_tables();

-- ---------------------------------------------------------------------------
-- The organization claim.
--
-- Clerk session tokens carry the active organization as `o.id` (v2 tokens) or
-- `org_id` (v1 / custom claim). Policies only ever call this, so the claim's
-- location is written down once.
-- ---------------------------------------------------------------------------

create or replace function private.requesting_org_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')
$$;

grant usage on schema private to authenticated;
grant execute on function private.requesting_org_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables.
--
-- Every table carries `org_id` with a cascading foreign key to organizations,
-- so deleting an organization removes everything it owns. Child rows also
-- reference their parent through (id, org_id), so a row cannot claim a
-- different organization from the analysis it belongs to.
-- ---------------------------------------------------------------------------

-- Keyed by the Clerk organization id; Clerk stays the source of truth for
-- everything else about the organization.
create table public.organizations (
  id text primary key,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, repo_owner, repo_name),
  unique (id, org_id)
);
alter table public.projects enable row level security;

create type public.analysis_status as enum ('queued', 'running', 'complete', 'failed');

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  status public.analysis_status not null default 'queued',
  commit_sha text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
alter table public.analyses enable row level security;
create index analyses_project_id_idx on public.analyses (project_id);
create index analyses_org_id_created_at_idx on public.analyses (org_id, created_at desc);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  path text not null,
  unique (analysis_id, path),
  unique (id, org_id),
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade
);
alter table public.files enable row level security;
create index files_org_id_idx on public.files (org_id);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  from_file_id uuid not null,
  to_file_id uuid not null,
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade,
  foreign key (from_file_id, org_id) references public.files (id, org_id) on delete cascade,
  foreign key (to_file_id, org_id) references public.files (id, org_id) on delete cascade
);
alter table public.edges enable row level security;
create index edges_analysis_id_idx on public.edges (analysis_id);
create index edges_from_file_id_idx on public.edges (from_file_id);
create index edges_to_file_id_idx on public.edges (to_file_id);
create index edges_org_id_idx on public.edges (org_id);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  method text not null,
  path text not null,
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade,
  foreign key (file_id, org_id) references public.files (id, org_id) on delete cascade
);
alter table public.routes enable row level security;
create index routes_analysis_id_idx on public.routes (analysis_id);
create index routes_file_id_idx on public.routes (file_id);
create index routes_org_id_idx on public.routes (org_id);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade,
  foreign key (file_id, org_id) references public.files (id, org_id) on delete cascade
);
alter table public.explanations enable row level security;
create index explanations_analysis_id_idx on public.explanations (analysis_id);
create index explanations_file_id_idx on public.explanations (file_id);
create index explanations_org_id_idx on public.explanations (org_id);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  role text not null,
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade,
  foreign key (file_id, org_id) references public.files (id, org_id) on delete cascade
);
alter table public.file_roles enable row level security;
create index file_roles_analysis_id_idx on public.file_roles (analysis_id);
create index file_roles_file_id_idx on public.file_roles (file_id);
create index file_roles_org_id_idx on public.file_roles (org_id);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, org_id) references public.analyses (id, org_id) on delete cascade
);
alter table public.insights enable row level security;
create index insights_analysis_id_idx on public.insights (analysis_id);
create index insights_org_id_idx on public.insights (org_id);

-- ---------------------------------------------------------------------------
-- Policies.
--
-- Read-only for now: nothing in the app writes yet, and a missing write policy
-- denies, which is the safe default. The claim is wrapped in a subselect so
-- Postgres evaluates it once per query rather than once per row.
-- ---------------------------------------------------------------------------

create policy "members read their organization"
  on public.organizations for select to authenticated
  using (id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.projects for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.analyses for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.files for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.edges for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.routes for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.explanations for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.file_roles for select to authenticated
  using (org_id = (select private.requesting_org_id()));

create policy "members read their organization's rows"
  on public.insights for select to authenticated
  using (org_id = (select private.requesting_org_id()));
