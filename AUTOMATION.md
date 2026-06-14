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
     3. keyword pre-filter (include/exclude lists)
     4. noise heuristics (drop non-English titles; Google Alert items
        with company "Unknown" need 2+ keyword hits)
     5. LLM scoring: one batched OpenAI call scores survivors 1-10
        against the candidate profile (model: AI_SCORING_MODEL secret,
        default gpt-5.4-nano; threshold: AI_SCORE_THRESHOLD, default 7;
        falls back to keyword-count scoring if the call fails)
     6. promote passing jobs into public.job_applications as "To Review"

  -> 13:15 UTC daily -> Edge Function: daily-digest
     1. summarize new jobs from the last 24 hours
     2. summarize pipeline counts
     3. email digest via Resend

  -> every 10 min -> Edge Function: process-ready-jobs (durable auto-tailoring)
     1. find jobs the user moved to the "Applying" stage lacking materials
     2. gate: skip unless a Positioning Profile is seeded
     3. atomic per-job claim (tailoring_locks) so overlapping runs can't double
     4. generate via the shared tailoring core (Master + Positioning Profile),
        validate, refuse to save fabricated/truncated output
     5. save into public.resume_versions + log provenance to application_events

Tracker UI (GitHub Pages)
  -> move a card to "Applying" (Edit -> Status, or bulk)  ==> auto-tailored server-side
  -> OR click the AI button on a card for instant tailoring from a chosen template
  -> generated materials saved into public.resume_versions (review before sending)
```

Materials are always drafts to review — nothing is auto-submitted. The tailoring
model may use only facts present in the Master resume; it cannot invent metrics
(percentages absent from the master are rejected), employers, dates, or company
facts, and the job description is treated as untrusted input.

## What Replaced The Old Workflow Plan

| Retired workflow idea | Current implementation |
|---|---|
| Job discovery + relevance filter | `discover-jobs` + `pg_cron` |
| Daily digest / tracker summary | `daily-digest` + `pg_cron` |
| Resume tailoring (manual) | `tailor-resume` Edge Function (AI button) |
| Auto-tailoring on apply | `process-ready-jobs` + `pg_cron` (server-side, durable) |
| Email job-alert ingestion | `ingest-email-jobs` + a Gmail Apps Script (every 4h) — LLM-extracts jobs from alert emails (Indeed/LinkedIn), runs the same scoring as RSS. Setup + script: [docs/email-ingest.md](docs/email-ingest.md). Completed messages are tracked in `ingested_email_messages`; failures cool down in `email_ingest_retries` and quarantine after five attempts so poison messages cannot block the queue. URL dedup is enforced; company+role dedup is best-effort under concurrent runs. |
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
supabase secrets set AI_SCORING_MODEL=gpt-5.4-nano   # optional; discover-jobs scoring model
supabase secrets set AI_SCORE_THRESHOLD=7            # optional; min 1-10 score to promote (code default 7)
supabase secrets set TAILORING_MODEL=gpt-4o-mini     # optional; tailor-resume + process-ready-jobs model

# 3. Store the same cron secret in Vault from the SQL editor
#    select vault.create_secret('<same-random-string>', 'cron_secret');

# 4. Deploy the functions
supabase functions deploy discover-jobs --no-verify-jwt
supabase functions deploy daily-digest --no-verify-jwt
supabase functions deploy process-ready-jobs --no-verify-jwt
supabase functions deploy ingest-email-jobs --no-verify-jwt
supabase functions deploy tailor-resume

# 5. Enable the server-side extensions and apply the migrations
#    create extension if not exists pg_cron;
#    create extension if not exists pg_net;
supabase db push

# 6. Seed your materials (PII — local, gitignored): paste
#    supabase/seed/seed_eric_materials.sql into the SQL editor and run it.
#    The Positioning Profile row gates auto-tailoring — until it exists,
#    process-ready-jobs intentionally skips (won't tailor from a stale resume).
```

## Weekly Health Checks (search-criteria Section 6)

Run in the SQL editor; review weekly.

```sql
-- 1. Feed health: ALL configured feeds vs rows produced in the last 7 days.
--    A 0 row count means that feed produced nothing — investigate it.
with configured(feed) as (values
  ('RemoteOK – AI/Automation/Implementation'), ('RemoteOK – Consulting/Enablement'),
  ('WeWorkRemotely – Programming'), ('WeWorkRemotely – Management/Finance'),
  ('Google Alert 1'), ('Google Alert 2'), ('Google Alert 3'), ('Google Alert 4'),
  ('Google Alert 5'), ('Remotive'), ('Himalayas'))
select c.feed, count(r.id) as rows_7d
from configured c
left join public.job_raw r
  on r.raw_data->>'feed' = c.feed and r.created_at > now() - interval '7 days'
group by c.feed order by rows_7d asc;

-- 2. Promotion volume per day (proxy for criteria tightness). NOTE: the full
--    intake-score distribution is NOT measurable here — only jobs scoring >= the
--    threshold are promoted and carry a score; rejected scores aren't stored.
--    Too few promotions/day suggests criteria/feeds too narrow; a sudden spike
--    suggests scoring too lenient. (To measure true intake %, store scores on
--    job_raw for all scored candidates — deferred.)
select date_trunc('day', created_at)::date as day, count(*) as promoted
from public.job_applications
where created_at > now() - interval '14 days'
group by 1 order by 1 desc;

-- 3. Tier / employer mix of recent promotions
select raw_data->>'tier' as tier,
       raw_data->>'employer_group' as employer_group,
       count(*)
from public.job_applications
where created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;
```

Deferred (need infra not run here): lab career-page scraping, LinkedIn scraping,
the legal-AI 20% cap, and web-researched cover-letter personalization. See
`private/search-criteria.md`.

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
