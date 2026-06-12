-- Ensure discover-jobs can upsert on job_raw.job_url.
-- PostgREST/Supabase upsert requires a real unique constraint or a full
-- unique index on the conflict target; the restored database only had a
-- partial unique index.

alter table public.job_raw
  alter column job_url set not null;

drop index if exists public.unique_job_url;

alter table public.job_raw
  add constraint job_raw_job_url_key unique (job_url);
