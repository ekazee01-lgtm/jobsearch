-- Schedule the durable auto-tailoring worker. Every 10 minutes it tailors any
-- job the user moved into the apply stage that still lacks materials.
-- Relies on the same vault 'cron_secret' as the other scheduled functions.

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'process-ready-jobs';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'process-ready-jobs',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/process-ready-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
