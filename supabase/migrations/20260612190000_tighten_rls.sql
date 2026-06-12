-- Lock down anonymous access discovered on the restored schema:
-- job_applications rows were readable with the public (publishable) key.
-- Replace all legacy policies with owner-only access for authenticated
-- users. The Edge Functions use the service role, which bypasses RLS.
-- job_raw is non-sensitive feed data but has no anonymous use case either.

alter table public.job_applications enable row level security;
alter table public.job_raw enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'job_applications'
  loop
    execute format('drop policy %I on public.job_applications', r.policyname);
  end loop;
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'job_raw'
  loop
    execute format('drop policy %I on public.job_raw', r.policyname);
  end loop;
end $$;

create policy job_applications_owner_select on public.job_applications
  for select to authenticated using (auth.uid() = user_id);
create policy job_applications_owner_insert on public.job_applications
  for insert to authenticated with check (auth.uid() = user_id);
create policy job_applications_owner_update on public.job_applications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy job_applications_owner_delete on public.job_applications
  for delete to authenticated using (auth.uid() = user_id);

create policy job_raw_authenticated_select on public.job_raw
  for select to authenticated using (true);
