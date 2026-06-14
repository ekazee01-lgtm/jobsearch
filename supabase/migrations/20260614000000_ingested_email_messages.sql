-- Message-level idempotency for Gmail job-alert ingestion. The Apps Script
-- sends recent alert messages every run (no Gmail labels); ingest-email-jobs
-- records each message_id it successfully handles here and skips ones already
-- present — so multi-message threads and re-sends can't double-process or lose
-- messages (a per-message marker, unlike thread-level Gmail labels).

create table if not exists public.ingested_email_messages (
  message_id text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

-- Only the service role (the Edge Function) touches this; deny client access.
alter table public.ingested_email_messages enable row level security;
