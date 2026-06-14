-- Durable retry state for Gmail job-alert ingestion. Completed message IDs stay
-- in ingested_email_messages; this table tracks only deferred and quarantined
-- failures so one poison message cannot monopolize every bounded function run.

create table if not exists public.email_ingest_retries (
  message_id text primary key,
  user_id uuid not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text not null,
  last_attempt_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  quarantined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_ingest_retry_state_check check (
    (quarantined_at is null and next_attempt_at is not null)
    or (quarantined_at is not null and next_attempt_at is null)
  )
);

create index if not exists email_ingest_retries_due_idx
  on public.email_ingest_retries (next_attempt_at)
  where quarantined_at is null;

-- Only the service role (the Edge Function) touches this; deny client access.
alter table public.email_ingest_retries enable row level security;

create or replace function public.record_email_ingest_failure(
  p_message_id text,
  p_user_id uuid,
  p_error text,
  p_max_attempts integer default 5,
  p_retry_delay interval default interval '8 hours'
)
returns table (attempt_count integer, quarantined boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.email_ingest_retries (
    message_id, user_id, attempt_count, last_error, last_attempt_at,
    next_attempt_at, quarantined_at, updated_at
  )
  values (
    p_message_id,
    p_user_id,
    1,
    left(p_error, 500),
    now(),
    case when p_max_attempts <= 1 then null else now() + p_retry_delay end,
    case when p_max_attempts <= 1 then now() else null end,
    now()
  )
  on conflict (message_id) do update
  set
    user_id = excluded.user_id,
    attempt_count = email_ingest_retries.attempt_count + 1,
    last_error = excluded.last_error,
    last_attempt_at = now(),
    next_attempt_at = case
      when email_ingest_retries.attempt_count + 1 >= p_max_attempts then null
      else now() + p_retry_delay
    end,
    quarantined_at = case
      when email_ingest_retries.attempt_count + 1 >= p_max_attempts
        then coalesce(email_ingest_retries.quarantined_at, now())
      else null
    end,
    updated_at = now()
  returning
    email_ingest_retries.attempt_count,
    email_ingest_retries.quarantined_at is not null;
end;
$$;

revoke all on function public.record_email_ingest_failure(text, uuid, text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.record_email_ingest_failure(text, uuid, text, integer, interval)
  to service_role;

create or replace function public.complete_email_ingest_messages(
  p_user_id uuid,
  p_message_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
begin
  insert into public.ingested_email_messages (message_id, user_id)
  select distinct ids.message_id, p_user_id
  from unnest(p_message_ids) as ids(message_id)
  on conflict (message_id) do nothing;

  get diagnostics completed_count = row_count;

  delete from public.email_ingest_retries
  where message_id = any(p_message_ids);

  return completed_count;
end;
$$;

revoke all on function public.complete_email_ingest_messages(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.complete_email_ingest_messages(uuid, text[])
  to service_role;
