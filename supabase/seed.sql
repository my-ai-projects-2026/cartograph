-- Seed rows until analyses are created for real.
--
-- The organization ids are the organizations in the Cartograph Clerk
-- development instance. Rows are split between them so switching organization
-- visibly changes what the dashboard returns. Fixed ids make this re-runnable.

insert into public.organizations (id) values
  ('org_3KE9tT2yee7BCjrM13JAjgXHYI4'), -- Dy's Organization
  ('org_3KEBnIhgdCEWhXEx8QqlpKWpbrY'), -- Second Team
  ('org_3KEDWuW9jqGIzYqYScdJTRE37YE')  -- AGM Demo
on conflict do nothing;

insert into public.projects (id, org_id, repo_owner, repo_name) values
  ('00000000-0000-4000-8000-000000000101', 'org_3KE9tT2yee7BCjrM13JAjgXHYI4', 'vercel', 'next.js'),
  ('00000000-0000-4000-8000-000000000102', 'org_3KE9tT2yee7BCjrM13JAjgXHYI4', 'colinhacks', 'zod'),
  ('00000000-0000-4000-8000-000000000201', 'org_3KEBnIhgdCEWhXEx8QqlpKWpbrY', 'expressjs', 'express'),
  ('00000000-0000-4000-8000-000000000301', 'org_3KEDWuW9jqGIzYqYScdJTRE37YE', 'sindresorhus', 'got'),
  ('00000000-0000-4000-8000-000000000302', 'org_3KEDWuW9jqGIzYqYScdJTRE37YE', 'trpc', 'trpc')
on conflict do nothing;

insert into public.analyses (id, org_id, project_id, status, commit_sha, created_at, finished_at) values
  ('00000000-0000-4000-8000-000000001101', 'org_3KE9tT2yee7BCjrM13JAjgXHYI4', '00000000-0000-4000-8000-000000000101',
   'complete', '3f1c2a9', now() - interval '2 days', now() - interval '2 days' + interval '41 seconds'),
  ('00000000-0000-4000-8000-000000001102', 'org_3KE9tT2yee7BCjrM13JAjgXHYI4', '00000000-0000-4000-8000-000000000102',
   'failed', '9be04d1', now() - interval '5 hours', now() - interval '5 hours' + interval '7 seconds'),
  ('00000000-0000-4000-8000-000000001103', 'org_3KE9tT2yee7BCjrM13JAjgXHYI4', '00000000-0000-4000-8000-000000000101',
   'running', 'a72e5c0', now() - interval '3 minutes', null),
  ('00000000-0000-4000-8000-000000002101', 'org_3KEBnIhgdCEWhXEx8QqlpKWpbrY', '00000000-0000-4000-8000-000000000201',
   'queued', null, now() - interval '1 minute', null),
  ('00000000-0000-4000-8000-000000003101', 'org_3KEDWuW9jqGIzYqYScdJTRE37YE', '00000000-0000-4000-8000-000000000301',
   'complete', 'c41d8e2', now() - interval '6 days', now() - interval '6 days' + interval '12 seconds'),
  ('00000000-0000-4000-8000-000000003102', 'org_3KEDWuW9jqGIzYqYScdJTRE37YE', '00000000-0000-4000-8000-000000000302',
   'complete', '05be7f3', now() - interval '1 day', now() - interval '1 day' + interval '2 minutes 4 seconds')
on conflict do nothing;
