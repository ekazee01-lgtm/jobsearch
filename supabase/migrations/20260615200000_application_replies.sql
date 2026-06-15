-- Phase 1A response tracking.
-- Replies are classified and proposed for review, but this migration contains
-- no path that changes job_applications.status.

create table if not exists public.application_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.job_applications(id) on delete set null,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_email text,
  from_domain text,
  subject text,
  snippet text,
  received_at timestamptz,
  classification text not null check (classification in (
    'rejection',
    'interview',
    'offer',
    'info_request',
    'other'
  )),
  classification_confidence numeric not null check (
    classification_confidence between 0 and 1
  ),
  classification_rationale text not null,
  proposed_status text,
  correlation_method text not null check (correlation_method in (
    'thread',
    'domain',
    'company_role',
    'unmatched'
  )),
  correlation_confidence numeric not null check (
    correlation_confidence between 0 and 1
  ),
  correlation_details jsonb not null default '{}'::jsonb,
  review_state text not null default 'pending_review' check (review_state in (
    'pending_review',
    'auto_applied',
    'confirmed',
    'dismissed'
  )),
  applied_status text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index if not exists application_replies_user_review_idx
  on public.application_replies (user_id, review_state, received_at desc);
create index if not exists application_replies_job_idx
  on public.application_replies (job_id, received_at desc);
create index if not exists application_replies_thread_idx
  on public.application_replies (user_id, gmail_thread_id)
  where gmail_thread_id is not null;

alter table public.application_replies enable row level security;

create policy application_replies_owner_select
  on public.application_replies
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.application_replies to authenticated;
grant all on public.application_replies to service_role;

-- Service-role ingestion entrypoint. The unique key makes repeated Gmail
-- deliveries idempotent, and ownership is checked before accepting a job link.
create or replace function public.record_application_reply(
  p_user_id uuid,
  p_job_id uuid,
  p_gmail_message_id text,
  p_gmail_thread_id text,
  p_from_email text,
  p_from_domain text,
  p_subject text,
  p_snippet text,
  p_received_at timestamptz,
  p_classification text,
  p_classification_confidence numeric,
  p_classification_rationale text,
  p_proposed_status text,
  p_correlation_method text,
  p_correlation_confidence numeric,
  p_correlation_details jsonb
)
returns table (reply_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if nullif(btrim(p_gmail_message_id), '') is null then
    raise exception 'gmail_message_id is required'
      using errcode = 'not_null_violation';
  end if;

  if p_job_id is not null and not exists (
    select 1
    from public.job_applications j
    where j.id = p_job_id
      and j.user_id = p_user_id
  ) then
    raise exception 'job application not found for user'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.application_replies (
    user_id,
    job_id,
    gmail_message_id,
    gmail_thread_id,
    from_email,
    from_domain,
    subject,
    snippet,
    received_at,
    classification,
    classification_confidence,
    classification_rationale,
    proposed_status,
    correlation_method,
    correlation_confidence,
    correlation_details,
    review_state
  )
  values (
    p_user_id,
    p_job_id,
    btrim(p_gmail_message_id),
    nullif(btrim(p_gmail_thread_id), ''),
    nullif(btrim(p_from_email), ''),
    nullif(btrim(p_from_domain), ''),
    nullif(left(btrim(p_subject), 500), ''),
    nullif(left(btrim(p_snippet), 2000), ''),
    p_received_at,
    p_classification,
    p_classification_confidence,
    left(p_classification_rationale, 500),
    p_proposed_status,
    p_correlation_method,
    p_correlation_confidence,
    coalesce(p_correlation_details, '{}'::jsonb),
    'pending_review'
  )
  on conflict (user_id, gmail_message_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, true;
    return;
  end if;

  return query
  select r.id, false
  from public.application_replies r
  where r.user_id = p_user_id
    and r.gmail_message_id = btrim(p_gmail_message_id);
end;
$$;

revoke all on function public.record_application_reply(
  uuid, uuid, text, text, text, text, text, text, timestamptz,
  text, numeric, text, text, text, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.record_application_reply(
  uuid, uuid, text, text, text, text, text, text, timestamptz,
  text, numeric, text, text, text, numeric, jsonb
) to service_role;

-- Browser review entrypoint. Confirm and dismiss only review the proposal.
-- Linking associates the reply with an owned job. No action changes job status.
create or replace function public.review_application_reply(
  p_reply_id uuid,
  p_action text,
  p_job_id uuid default null
)
returns public.application_replies
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed public.application_replies;
  target_job_id uuid;
begin
  if p_action not in ('confirm', 'dismiss', 'link') then
    raise exception 'invalid reply review action'
      using errcode = 'check_violation';
  end if;

  select r.job_id
  into target_job_id
  from public.application_replies r
  where r.id = p_reply_id
    and r.user_id = auth.uid()
    and r.review_state = 'pending_review';

  if not found then
    raise exception 'pending reply not found'
      using errcode = 'no_data_found';
  end if;

  if p_job_id is not null then
    if not exists (
      select 1
      from public.job_applications j
      where j.id = p_job_id
        and j.user_id = auth.uid()
    ) then
      raise exception 'job application not found for user'
        using errcode = 'foreign_key_violation';
    end if;
    target_job_id := p_job_id;
  end if;

  if p_action = 'link' and target_job_id is null then
    raise exception 'job_id is required when linking a reply'
      using errcode = 'not_null_violation';
  end if;

  update public.application_replies
  set
    job_id = target_job_id,
    correlation_confidence = case
      when p_job_id is not null then 1
      else correlation_confidence
    end,
    correlation_details = case
      when p_job_id is not null
        then correlation_details || jsonb_build_object('user_linked', true)
      else correlation_details
    end,
    review_state = case p_action
      when 'confirm' then 'confirmed'
      when 'dismiss' then 'dismissed'
      else review_state
    end,
    reviewed_at = case
      when p_action in ('confirm', 'dismiss') then now()
      else reviewed_at
    end
  where id = p_reply_id
    and user_id = auth.uid()
    and review_state = 'pending_review'
  returning * into reviewed;

  if reviewed.job_id is not null then
    insert into public.application_events (job_id, user_id, type, payload)
    values (
      reviewed.job_id,
      reviewed.user_id,
      'application_reply_reviewed',
      jsonb_build_object(
        'reply_id', reviewed.id,
        'action', p_action,
        'classification', reviewed.classification,
        'proposed_status', reviewed.proposed_status,
        'phase', '1A',
        'status_changed', false
      )
    );
  end if;

  return reviewed;
end;
$$;

revoke all on function public.review_application_reply(uuid, text, uuid)
  from public, anon;
grant execute on function public.review_application_reply(uuid, text, uuid)
  to authenticated;
