-- Schedules the daily Supabase-native automation.
-- Requires a one-time manual step (NOT committed — this is a public repo):
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- Run that in the SQL editor before these jobs first fire, and set the
-- matching secret for the functions: supabase secrets set CRON_SECRET=<value>

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'discover-jobs-daily';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'daily-digest';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

-- Daily job discovery: 13:00 UTC = 8:00 AM America/Chicago during DST
-- (7:00 AM in winter; pg_cron has no timezone support on Supabase).
select cron.schedule(
  'discover-jobs-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/discover-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Daily digest email, 15 minutes after discovery.
select cron.schedule(
  'daily-digest',
  '15 13 * * *',
  $$
  select net.http_post(
    url := 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
