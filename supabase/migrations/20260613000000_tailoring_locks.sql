-- Atomic claim table so the auto-tailoring worker can't double-generate for the
-- same job when cron runs overlap. The primary key on job_id is the lock: the
-- first INSERT wins, concurrent INSERTs fail with a unique violation and skip.
-- Locks are transient (released after each generation attempt); dedup across
-- runs is handled by checking resume_versions.

create table if not exists public.tailoring_locks (
  job_id uuid primary key references public.job_applications(id) on delete cascade,
  user_id uuid not null,
  claimed_at timestamptz not null default now()
);

-- Only the service role (Edge Functions) touches this table; deny client access.
alter table public.tailoring_locks enable row level security;
