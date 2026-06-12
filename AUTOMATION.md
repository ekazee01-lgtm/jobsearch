# Job Search Automation - Supabase-Native Architecture

**Decision (June 2026):** the planned `n8n` + VPS deployment was retired before
it ever ran. The active automation path is fully Supabase-native: Edge
Functions, `pg_cron`, `pg_net`, and a static tracker UI on GitHub Pages.
Historical `n8n` artifacts remain under `archive/n8n/` for reference only.

## Architecture

```text
pg_cron (inside Supabase Postgres)
  -> 13:00 UTC daily -> Edge Function: discover-jobs
     1. fetch RSS/Atom feeds
     2. normalize + dedupe into public.job_raw
     3. keyword-filter relevant jobs
     4. promote relevant jobs into public.job_applications as "To Review"

  -> 13:15 UTC daily -> Edge Function: daily-digest
     1. summarize new jobs from the last 24 hours
     2. summarize pipeline counts
     3. email digest via Resend

Tracker UI (GitHub Pages)
  -> drag card to "Ready to Apply"
  -> click Tailor
  -> Edge Function: tailor-resume
  -> generated materials saved into public.resume_versions
```

## What Replaced The Old Workflow Plan

| Retired workflow idea | Current implementation |
|---|---|
| Job discovery + relevance filter | `discover-jobs` + `pg_cron` |
| Daily digest / tracker summary | `daily-digest` + `pg_cron` |
| Resume tailoring | `tailor-resume` Edge Function |
| Gmail auto-reply workflow | Deferred |
| Weekly analytics workflow | Dropped |
| VPS-hosted workflow engine | Removed |

## Current Project

- Supabase project ref: `hndkhpwzvybbiagnjkdr`
- Base URL: `https://hndkhpwzvybbiagnjkdr.supabase.co`
- Tracker URL: `https://ekazee01-lgtm.github.io/jobsearch/tracker.html`

## One-Time Deployment

The restored database data does **not** recreate platform-level resources. A
fresh project still needs extensions, secrets, functions, and cron schedules.

```powershell
# 1. Link the repo to the current project
supabase link --project-ref hndkhpwzvybbiagnjkdr

# 2. Set project-specific function secrets
supabase secrets set OPENAI_API_KEY=<key>
supabase secrets set CRON_SECRET=<random-string>
supabase secrets set USER_ID=<auth-user-uuid>
supabase secrets set NOTIFICATION_EMAIL=ekazee.careers@gmail.com
supabase secrets set RESEND_API_KEY=<key>   # optional; daily-digest skips email if absent

# 3. Store the same cron secret in Vault from the SQL editor
#    select vault.create_secret('<same-random-string>', 'cron_secret');

# 4. Deploy the functions
supabase functions deploy discover-jobs --no-verify-jwt
supabase functions deploy daily-digest --no-verify-jwt
supabase functions deploy tailor-resume

# 5. Enable the server-side extensions and apply the cron migration
#    create extension if not exists pg_cron;
#    create extension if not exists pg_net;
supabase db push
```

## Verification

1. Manual invoke:
   ```powershell
   curl -X POST https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/discover-jobs -H "x-cron-secret: <value>"
   ```
2. Expect a JSON summary with `fetched`, `inserted_raw`, `filtered_out`, and `promoted_to_review`.
3. Run it again immediately and expect duplicates to be skipped.
4. Confirm cron jobs exist:
   ```sql
   select jobid, jobname, schedule from cron.job order by jobid;
   ```
5. Confirm cron executions:
   ```sql
   select * from cron.job_run_details order by start_time desc limit 5;
   ```
6. Invoke `daily-digest` the same way and confirm either:
   - the email arrives when `RESEND_API_KEY` is configured, or
   - the response reports `email_sent: false` with a `skipped_reason`.
7. In the tracker, move a job to `Ready to Apply`, click `Tailor`, and confirm a new row appears in `public.resume_versions`.

## Important Schema Notes

- `discover-jobs` now targets the restored schema:
  - `public.job_raw.job_url` is the dedupe key
  - `public.job_applications.url` stores the job link
  - `public.job_applications.ai_match_score` stores the numeric relevance score
- The browser tracker and Edge Functions now agree on those column names.

## Cost Profile

| Item | Current |
|---|---|
| VPS | $0 |
| Supabase | Free tier / project-based |
| Email | Resend free tier |
| LLM | Usage-based only |
| Workflow engine | None |
