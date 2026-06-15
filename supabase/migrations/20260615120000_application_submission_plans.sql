-- Phase 0 capability-routed auto-apply foundation.
-- These tables hold reviewable submission plans only. No outward action is
-- performed by this migration or by the Phase 0 planner.

create table if not exists public.application_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.job_applications(id) on delete cascade,
  channel text not null check (channel in ('api', 'email', 'assisted', 'manual')),
  status text not null default 'queued' check (status in (
    'queued',
    'awaiting_approval',
    'submitting',
    'submitted',
    'needs_intervention',
    'failed',
    'skipped'
  )),
  idempotency_key text not null,
  plan_version integer not null default 1 check (plan_version > 0),
  payload_hash text not null,
  route_reason text not null,
  route_evidence jsonb not null default '{}'::jsonb,
  external_ref text,
  payload jsonb not null default '{}'::jsonb,
  intervention_reason text,
  reviewed_at timestamptz,
  approved_at timestamptz,
  submitted_at timestamptz,
  last_error text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key, plan_version)
);

create table if not exists public.application_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.application_submissions(id) on delete cascade,
  question_key text not null,
  question text not null,
  answer text,
  confidence numeric check (confidence between 0 and 1),
  required boolean not null default false,
  requires_user_attestation boolean not null default false,
  source text check (source in (
    'master_resume',
    'positioning_profile',
    'user_profile',
    'user_confirmed'
  )),
  created_at timestamptz not null default now(),
  unique (submission_id, question_key)
);

create index if not exists application_submissions_user_status_idx
  on public.application_submissions (user_id, status, created_at desc);
create index if not exists application_submissions_job_idx
  on public.application_submissions (job_id, created_at desc);
create index if not exists application_answers_submission_idx
  on public.application_answers (submission_id);

alter table public.application_submissions enable row level security;
alter table public.application_answers enable row level security;

create policy application_submissions_owner_select
  on public.application_submissions
  for select to authenticated
  using (auth.uid() = user_id);

create policy application_answers_owner_select
  on public.application_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.application_submissions s
      where s.id = application_answers.submission_id
        and s.user_id = auth.uid()
    )
  );

grant select on public.application_submissions to authenticated;
grant select on public.application_answers to authenticated;
grant all on public.application_submissions to service_role;
grant all on public.application_answers to service_role;

create or replace function public.set_application_submission_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists application_submissions_set_updated_at
  on public.application_submissions;
create trigger application_submissions_set_updated_at
  before update on public.application_submissions
  for each row execute function public.set_application_submission_updated_at();

create or replace function public.enforce_application_submission_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.job_id is distinct from old.job_id
    or new.channel is distinct from old.channel
    or new.idempotency_key is distinct from old.idempotency_key
    or new.plan_version is distinct from old.plan_version
    or new.payload_hash is distinct from old.payload_hash
    or new.route_reason is distinct from old.route_reason
    or new.route_evidence is distinct from old.route_evidence
    or new.payload is distinct from old.payload
    or new.created_at is distinct from old.created_at
  then
    raise exception 'application submission plan snapshots are immutable'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists application_submissions_enforce_snapshot
  on public.application_submissions;
create trigger application_submissions_enforce_snapshot
  before update on public.application_submissions
  for each row execute function public.enforce_application_submission_snapshot();

create or replace function public.enforce_application_submission_initial_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status not in ('queued', 'needs_intervention') then
    raise exception 'invalid initial application submission status: %', new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists application_submissions_enforce_initial_status
  on public.application_submissions;
create trigger application_submissions_enforce_initial_status
  before insert on public.application_submissions
  for each row execute function public.enforce_application_submission_initial_status();

create or replace function public.enforce_application_submission_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'queued' and new.status in ('awaiting_approval', 'needs_intervention', 'skipped'))
    or (old.status = 'awaiting_approval' and new.status in ('submitting', 'needs_intervention', 'skipped'))
    or (old.status = 'submitting' and new.status in ('submitted', 'needs_intervention', 'failed'))
    or (old.status = 'failed' and new.status in ('submitting', 'skipped'))
    or (old.status = 'needs_intervention' and new.status in ('queued', 'skipped'))
  ) then
    raise exception 'invalid application submission status transition: % -> %',
      old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'submitted' and new.submitted_at is null then
    raise exception 'submitted_at is required when status becomes submitted'
      using errcode = 'check_violation';
  end if;

  if new.status = 'submitting' and new.approved_at is null then
    raise exception 'approved_at is required when status becomes submitting'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists application_submissions_enforce_transition
  on public.application_submissions;
create trigger application_submissions_enforce_transition
  before update of status on public.application_submissions
  for each row execute function public.enforce_application_submission_transition();

-- Phase 0 browser action: record review without granting direct table updates.
-- This does not submit, send, open, or otherwise act on the application.
create or replace function public.review_application_submission_plan(
  p_submission_id uuid
)
returns public.application_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed public.application_submissions;
begin
  update public.application_submissions
  set
    status = 'awaiting_approval',
    reviewed_at = now()
  where id = p_submission_id
    and user_id = auth.uid()
    and status = 'queued'
  returning * into reviewed;

  if reviewed.id is null then
    raise exception 'queued submission plan not found'
      using errcode = 'no_data_found';
  end if;

  insert into public.application_events (job_id, user_id, type, payload)
  values (
    reviewed.job_id,
    reviewed.user_id,
    'submission_plan_reviewed',
    jsonb_build_object(
      'submission_id', reviewed.id,
      'channel', reviewed.channel,
      'plan_version', reviewed.plan_version,
      'phase', 0
    )
  );

  return reviewed;
end;
$$;

revoke all on function public.review_application_submission_plan(uuid)
  from public, anon;
grant execute on function public.review_application_submission_plan(uuid)
  to authenticated;

-- Atomically create one immutable plan version, its answers, and its audit
-- event. An advisory transaction lock serializes concurrent planners for the
-- same user/job lineage.
create or replace function public.create_application_submission_plan(
  p_user_id uuid,
  p_job_id uuid,
  p_channel text,
  p_status text,
  p_idempotency_key text,
  p_payload_hash text,
  p_route_reason text,
  p_route_evidence jsonb,
  p_payload jsonb,
  p_intervention_reason text,
  p_answers jsonb
)
returns table (
  submission_id uuid,
  submission_status text,
  submission_plan_version integer,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  latest public.application_submissions;
  inserted public.application_submissions;
begin
  if p_status not in ('queued', 'needs_intervention') then
    raise exception 'invalid planned submission status: %', p_status
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.job_applications j
    where j.id = p_job_id
      and j.user_id = p_user_id
  ) then
    raise exception 'job application not found for user'
      using errcode = 'foreign_key_violation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0)
  );

  select s.*
  into latest
  from public.application_submissions s
  where s.user_id = p_user_id
    and s.idempotency_key = p_idempotency_key
  order by s.plan_version desc
  limit 1;

  if latest.id is not null and latest.payload_hash = p_payload_hash then
    return query
    select latest.id, latest.status, latest.plan_version, false;
    return;
  end if;

  insert into public.application_submissions (
    user_id,
    job_id,
    channel,
    status,
    idempotency_key,
    plan_version,
    payload_hash,
    route_reason,
    route_evidence,
    payload,
    intervention_reason
  )
  values (
    p_user_id,
    p_job_id,
    p_channel,
    p_status,
    p_idempotency_key,
    coalesce(latest.plan_version, 0) + 1,
    p_payload_hash,
    p_route_reason,
    coalesce(p_route_evidence, '{}'::jsonb),
    coalesce(p_payload, '{}'::jsonb),
    p_intervention_reason
  )
  returning * into inserted;

  insert into public.application_answers (
    submission_id,
    question_key,
    question,
    answer,
    confidence,
    required,
    requires_user_attestation,
    source
  )
  select
    inserted.id,
    answer.question_key,
    answer.question,
    answer.answer,
    answer.confidence,
    answer.required,
    answer.requires_user_attestation,
    answer.source
  from jsonb_to_recordset(coalesce(p_answers, '[]'::jsonb)) as answer(
    question_key text,
    question text,
    answer text,
    confidence numeric,
    required boolean,
    requires_user_attestation boolean,
    source text
  );

  insert into public.application_events (job_id, user_id, type, payload)
  values (
    inserted.job_id,
    inserted.user_id,
    'submission_plan_created',
    jsonb_build_object(
      'submission_id', inserted.id,
      'channel', inserted.channel,
      'plan_version', inserted.plan_version,
      'phase', 0
    )
  );

  return query
  select inserted.id, inserted.status, inserted.plan_version, true;
end;
$$;

revoke all on function public.create_application_submission_plan(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_application_submission_plan(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, text, jsonb
) to service_role;
