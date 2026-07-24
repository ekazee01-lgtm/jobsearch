# Runtime Verification and Reactivation Plan

- **Status:** Operator runbook; not yet executed
- **Repository:** `ekazee01-lgtm/jobsearch`
- **Verified planning baseline:** `5b4d542d7e314571c6e3423010304288b78f81fa`
- **Canonical architecture document:** `docs/status-and-architecture.md`
- **Canonical document SHA-256 at the planning baseline:** `21dd857fb7f94fe0eae649d7fc54ecf1aeec3434dbdd7e60ea1d5db51e2f6d67`
- **Supabase project reference:** `hndkhpwzvybbiagnjkdr`

## 1. Purpose

This plan converts the read-only items in section 8 of
`docs/status-and-architecture.md` into a controlled operator runbook. Its
purpose is to establish what is currently present and healthy, preserve
redacted evidence, classify every result consistently, and define the gate for
any later repair.

This document is a plan only. Authoring or reviewing it does not verify the
runtime and does not authorize any command or dashboard action described
below.

## 2. Scope

The initial verification run covers:

1. Supabase project health.
2. `pg_cron` definitions.
3. `pg_cron` execution history.
4. deployed Supabase Edge Functions.
5. configured Supabase secret names, never secret values.
6. base-table existence, row counts, and freshness indicators.
7. GitHub Pages source and canonical URL.
8. Apps Script time-driven triggers.
9. Gmail `JobReplies` label and filter configuration.

The run produces evidence and classifications only. It must not change a
project setting, schedule, function, secret, table, Pages setting, Apps Script
project, trigger, Gmail label, Gmail filter, or message.

## 3. Explicit exclusions

The initial verification run must not:

- invoke `discover-jobs` or any other Edge Function;
- fetch an RSS, Atom, or ATS feed through the application;
- call OpenAI or Resend;
- insert, update, upsert, delete, promote, send, submit, deploy, restore,
  resume, schedule, unschedule, authorize, or reauthorize anything;
- run `supabase db push`, `supabase functions deploy`,
  `supabase secrets set`, or any migration;
- expose or copy a secret value, access token, cookie, authorization header,
  service-role key, user UUID, or Gmail message body;
- click a dashboard control labeled **Restore**, **Resume**, **Deploy**,
  **Create**, **Add**, **Edit**, **Save**, **Run**, **Authorize**,
  **Reauthorize**, **Delete**, or an equivalent mutating action;
- treat a successful list command as proof that a function executed
  successfully;
- correct documentation or runtime configuration while gathering evidence.

The optional `discover-jobs` smoke test is intentionally excluded. Section 12
defines its separate authorization gate.

## 4. Repository basis and limits

The runbook is grounded in these repository sources at the planning baseline:

| Evidence | What it establishes |
|---|---|
| `docs/status-and-architecture.md`, especially sections 1.1, 7, 8, and 9 | The distinction between repository evidence and runtime verification, the required checks, and the separate mutating smoke-test gate. |
| `AUTOMATION.md` | Project reference, manual deployment model, expected functions and secrets, runtime architecture, and legacy verification notes. |
| `docs/email-ingest.md` | The `ingestJobEmails` trigger, `JobReplies` label/filter strategy, plus-addressing, and `ingestApplicationReplies` trigger. |
| `supabase/migrations/20260610120000_cron_schedules.sql` | Expected daily cron names and schedules. |
| `supabase/migrations/20260612210000_process_ready_jobs_cron.sql` | Expected ten-minute auto-tailoring cron name and schedule. |
| `supabase/migrations/20260611031500_job_raw_job_url_constraint.sql` | The active `job_raw.job_url` deduplication constraint. |
| `supabase/migrations/20260612190000_tighten_rls.sql` | Expected owner-only access posture for `job_applications` and authenticated read access for `job_raw`. |
| remaining files under `supabase/migrations/` | Incremental application tables and their timestamp fields; these migrations are not a complete empty-database bootstrap. |
| the seven entrypoints under `supabase/functions/*/index.ts` and shared code under `supabase/functions/_shared/` | Function names, table dependencies, authentication mode, required custom secret names, and the writes and external calls that make invocation non-read-only. |
| `scripts/gmail-application-replies.gs` | The `JobReplies`-limited reply poller and its `CRON_SECRET` use. |
| `README.md`, `AUTOMATION.md`, `index.html`, and `tracker.html` | The conflicting documented Pages locations and the expected page titles used during URL inspection. |

Repository evidence cannot establish present runtime state. The checked-in
migrations are incremental against a restored application schema and do not
provide a complete base-schema source of truth. In particular, the verification
run must observe `job_applications`, `job_raw`, and `resume_versions` directly
without assuming that a fresh migration replay created them.

## 5. Required authorization, access, and prerequisites

### 5.1 Authorization

Before starting, the owner must authorize one named operator for the
**read-only verification run only**. The authorization record must include:

- operator identity;
- approved check IDs `RV-01` through `RV-09`;
- approved project and repository identifiers;
- start and expiry time;
- approved private evidence location;
- an explicit statement that remediation and `RV-SMOKE-01` are not authorized.

Authorization to view does not imply authorization to repair. If the operator
cannot distinguish a read-only control from a mutating control, the operator
must stop before using it.

### 5.2 Required operator access

The operator needs:

- Supabase organization/project access sufficient to view project health,
  execute `SELECT` statements in the SQL Editor, list functions, and list
  secret names;
- a locally authenticated Supabase CLI profile that can list functions and
  secret metadata for project `hndkhpwzvybbiagnjkdr`;
- GitHub repository access sufficient to read Pages settings for
  `ekazee01-lgtm/jobsearch`;
- access to the Google account that owns the relevant Apps Script project;
- Gmail settings access for the mailbox that owns the `JobReplies` label and
  filters;
- access to the owner-approved private evidence location.

No secret value needs to be known for `RV-01` through `RV-09`.

### 5.3 Local prerequisites

Record, but do not change, the local tool versions used:

```powershell
git --version
gh --version
supabase --version
```

Before any external read, verify the local repository baseline:

```powershell
git fetch origin
git rev-parse origin/main
(Get-FileHash -Algorithm SHA256 -LiteralPath `
  'docs\status-and-architecture.md').Hash.ToLowerInvariant()
git status --short
```

Expected:

- `origin/main` is the owner-approved verification baseline;
- the canonical-document hash matches the hash approved for the run;
- the working tree has no unrelated changes.

If any value differs, stop. A changed baseline requires a new evidence review
and owner approval before runtime verification.

### 5.4 Evidence workspace

Create the evidence location outside this public repository. It must have
access controls appropriate for operational metadata and Gmail evidence. The
operator must assign a run ID in the form
`RV-YYYYMMDD-HHMM-<operator-initials>` and create one evidence record per check.

Do not commit runtime output, screenshots, exported filters, user identifiers,
or secret metadata to this repository.

## 6. Operating rules

### 6.1 Read-only means no state transition

Permitted actions are limited to:

- dashboard navigation that only displays existing state;
- SQL `SELECT` statements;
- CLI/API list or get operations;
- HTTP `GET` requests to public Pages URLs;
- Gmail searches that do not modify messages;
- screenshots or text captures after redaction.

If a command prompts to link, log in, restore, initialize, update, authorize,
or save, answer nothing and stop that check. Authentication setup and access
repair are separate administrative activities.

### 6.2 Run one check at a time

For each check:

1. record the start timestamp in UTC;
2. record the exact command or dashboard path;
3. perform only that check;
4. redact the captured output;
5. classify the result;
6. record the end timestamp and evidence location;
7. stop on the check's stopping condition before advancing.

Do not combine a failed check with a repair. Do not rerun a failed check after
anyone changes state unless a separately authorized reactivation change record
exists.

### 6.3 Redaction standard

Remove or obscure:

- secret values and secret digests;
- API keys, OAuth tokens, session cookies, JWTs, and authorization headers;
- database connection strings and signed URLs;
- `auth.users` UUIDs and other user identifiers;
- Gmail message bodies, sender/recipient addresses other than the already
  documented plus-addressing criterion, and unnecessary subject text;
- job descriptions, candidate materials, and other personal data;
- query parameters or error text that contain any of the above.

Preserve the minimum evidence needed to classify the check:

- project reference and visible health state;
- cron job names, schedules, active flags, statuses, and timestamps;
- function names, deployment statuses, versions, and timestamps;
- secret **names only**;
- table names, aggregate counts, and aggregate timestamps;
- Pages source, canonical URL, HTTP status, final URL, and page title;
- Apps Script handler names, trigger type, cadence, status, and last/next run
  metadata;
- Gmail label name, filter criteria, filter action, and aggregate search counts.

If safe redaction would remove the fact needed for classification, keep the
unredacted evidence only in the restricted evidence location and place a
redacted summary in the completion report.

## 7. Evidence record format

Use this schema for every check:

```yaml
run_id: RV-YYYYMMDD-HHMM-XX
check_id: RV-00
check_name: Short descriptive name
operator:
  name: Operator name
  account: Account or role used
authorization_reference: Owner approval record location
started_at_utc: YYYY-MM-DDTHH:MM:SSZ
ended_at_utc: YYYY-MM-DDTHH:MM:SSZ
target:
  system: Supabase | GitHub | Apps Script | Gmail
  identifier: Redacted or non-secret project/repository identifier
command_or_action: Exact command or dashboard path
redaction_applied:
  - Description of each removed field
evidence:
  summary: Minimal redacted result
  location: Restricted evidence URI or path
classification: verified operational | present but unhealthy | absent | access-blocked | indeterminate
pass_fail_indeterminate: pass | fail | indeterminate
observations:
  - Relevant fact
safe_stop_triggered: true | false
permitted_next_action: Continue, escalate, or request a separately authorized repair
operator_attestation: No state-changing control was used
```

Timestamps must be UTC and include seconds. Evidence files should use
`<run-id>-<check-id>-<short-name>` naming so the completion report can point to
them without embedding sensitive content.

## 8. Dependency-aware execution sequence

Run checks in this order:

| Order | Check | Dependency reason |
|---:|---|---|
| 1 | `RV-01` Supabase project health | A paused, unavailable, or inaccessible project makes later Supabase observations misleading. |
| 2 | `RV-02` cron definitions | Establishes which schedules should generate run history. |
| 3 | `RV-04` deployed Edge Functions | Establishes whether cron targets exist before interpreting cron failures. |
| 4 | `RV-05` configured secret names | Establishes whether required name-level configuration is present before interpreting function or cron failures. |
| 5 | `RV-03` cron execution history | Interpret history only after definitions, deployments, and secret-name inventory are known. |
| 6 | `RV-06` base tables and freshness | Compare table aggregates with the already captured schedule and run evidence. |
| 7 | `RV-07` GitHub Pages | Independent of Supabase writes; perform after the core data path is classified. |
| 8 | `RV-08` Apps Script triggers | Establishes whether the Gmail pollers are scheduled. |
| 9 | `RV-09` Gmail label and filters | Interprets reply-ingestion coverage after the reply trigger is known. |

If `RV-01` is `absent`, `access-blocked`, or `indeterminate`, do not run
`RV-02` through `RV-06`. Classify each skipped dependent check consistently
with the evidence available; do not guess.

If `RV-02` shows a required cron definition is absent, still run `RV-04` and
`RV-05`, but classify run history for that missing job as `absent` rather than
allowing an empty history query to obscure the missing definition.

## 9. Supabase read-only procedures

### 9.1 `RV-01` - Supabase project health

**Authorization required:** owner-approved read-only access to Supabase project
`hndkhpwzvybbiagnjkdr`.

**Read-only dashboard action:**

1. Sign in to the Supabase Dashboard using the approved operator account.
2. Navigate directly to project `hndkhpwzvybbiagnjkdr`.
3. Observe the project overview and database health/status indicators.
4. Record any paused, restoring, degraded, unavailable, or healthy state and
   its displayed timestamp.
5. Do not click **Restore project**, **Resume project**, **Restart server**, or
   any similar control.

**Expected evidence:** a screenshot or text record showing the project
reference, visible project state, database/API health indicators, observation
time, and operator account or role. Crop navigation that reveals unrelated
projects.

**Redaction requirements:** redact organization details, billing information,
connection strings, user identifiers, and unrelated project names.

**Criteria:**

- **Pass:** the correct project is present, not paused or restoring, and its
  dashboard reports normal/healthy service state.
- **Fail:** the project is present but paused, restoring beyond its documented
  normal window, degraded, or unavailable. Classify `present but unhealthy`.
- **Fail:** the approved organization has no project with the required
  reference. Classify `absent`.
- **Indeterminate:** status indicators conflict, are stale, or do not establish
  health.
- **Access-blocked:** authentication succeeds but the operator cannot view the
  required project or health state.

**Safe stopping condition:** any prompt to create, restore, resume, restart,
transfer, or reconfigure the project. Stop all dependent Supabase checks.

**Permitted next action after failure:** record evidence and request separate
authorization for project-access recovery, project restoration, or incident
diagnosis. Do not use a restore/resume control during verification.

### 9.2 `RV-02` - Cron definitions

**Authorization required:** owner-approved SQL Editor access allowing
`SELECT` against the `cron` schema.

**Exact read-only action:** open the SQL Editor for the verified project and
run:

```sql
select jobid, jobname, schedule, active, database, username
from cron.job
where jobname in (
  'discover-jobs-daily',
  'daily-digest',
  'process-ready-jobs'
)
order by jobname, jobid;
```

Do not display or copy the `command` column because it contains endpoint and
secret-retrieval details that are not needed for this check.

**Expected evidence:** exactly one active row for each expected name:

| Job name | Expected schedule |
|---|---|
| `discover-jobs-daily` | `0 13 * * *` |
| `daily-digest` | `15 13 * * *` |
| `process-ready-jobs` | `*/10 * * * *` |

**Redaction requirements:** redact database usernames if they identify a
person. Preserve job IDs, names, schedules, and active flags.

**Criteria:**

- **Pass:** exactly one row exists for each expected name, every row is active,
  and every schedule matches.
- **Fail:** all names exist but any is inactive, duplicated, or has a different
  schedule. Classify `present but unhealthy`.
- **Fail:** any required name has no row. Classify the missing component
  `absent`.
- **Indeterminate:** the query returns incomplete metadata or the result cannot
  be tied to the verified project.
- **Access-blocked:** the operator cannot query `cron.job`.

**Safe stopping condition:** any instruction to enable extensions, apply a
migration, call `cron.schedule`, or call `cron.unschedule`.

**Permitted next action after failure:** continue to `RV-04` and `RV-05` to
separate schedule absence from target/configuration absence, then request a
separately authorized cron repair. Do not edit cron during this run.

### 9.3 `RV-04` - Deployed Edge Functions

**Authorization required:** owner-approved Supabase metadata read access. The
CLI must already be authenticated; this run does not authorize login, linking,
or token creation.

**Exact read-only command:**

```powershell
supabase functions list `
  --project-ref hndkhpwzvybbiagnjkdr `
  --output json
```

Capture only function name, deployment/status field, version, and deployment
timestamp. Do not use `--debug`.

**Expected evidence:** deployed entries for:

1. `discover-jobs`
2. `daily-digest`
3. `process-ready-jobs`
4. `tailor-resume`
5. `ingest-email-jobs`
6. `plan-submission`
7. `ingest-application-replies`

Extra functions must be recorded for review but do not make this presence
check fail by themselves. A list result does not prove that deployed code
matches the local source or that invocation succeeds.

**Redaction requirements:** retain names, versions, statuses, and timestamps;
redact IDs or metadata not needed for comparison.

**Criteria:**

- **Pass:** all seven expected names are present and their displayed deployment
  state is active/ready.
- **Fail:** an expected function is present but its state is failed, inactive,
  or otherwise unhealthy. Classify `present but unhealthy`.
- **Fail:** an expected name is missing. Classify that function `absent`.
- **Indeterminate:** the CLI output does not expose a reliable state or cannot
  be tied to the verified project.
- **Access-blocked:** the pre-authenticated profile cannot list functions.

**Safe stopping condition:** a login/link prompt, a suggestion to deploy, or
any command that would create a token or change the linked project.

**Permitted next action after failure:** record the missing or unhealthy names
and request a separately authorized source/version comparison and deployment
change. Do not deploy during verification.

### 9.4 `RV-05` - Configured secret names

**Authorization required:** owner-approved Supabase secret-metadata read
access. Secret-value access is neither required nor authorized.

**Exact read-only command that emits names only:**

```powershell
supabase secrets list `
  --project-ref hndkhpwzvybbiagnjkdr `
  --output json |
  ConvertFrom-Json |
  Select-Object -ExpandProperty name |
  Sort-Object
```

If the installed CLI's JSON shape does not contain a `name` property, stop
rather than printing the unfiltered object. The operator may instead use the
Dashboard's Edge Functions **Secrets** list and capture the names column only.

**Expected evidence:**

Required custom names for the full documented runtime:

- `CRON_SECRET`
- `USER_ID`
- `OPENAI_API_KEY`
- `NOTIFICATION_EMAIL`

Optional or conditionally used names:

- `RESEND_API_KEY`
- `AI_SCORING_MODEL`
- `AI_SCORE_THRESHOLD`
- `TAILORING_MODEL`
- `DIGEST_FROM_EMAIL`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are platform-provided Edge
Function environment variables, not operator-managed custom secret
expectations for this check.

The repository makes `OPENAI_API_KEY` optional for the keyword fallback in
`discover-jobs`, but other documented functions require it. Therefore its
absence fails the **full-runtime** configuration check even though discovery
may still have a fallback path. `RESEND_API_KEY` is optional; without it,
`daily-digest` is expected to record that email delivery was skipped.

**Redaction requirements:** record names only. Never record values, digests,
last-four-character hints, clipboard contents, reveal-dialog contents, or
screenshots containing them.

**Criteria:**

- **Pass:** all four required custom names are present. Record optional names
  separately.
- **Fail:** any required custom name is absent. Classify the affected runtime
  path `present but unhealthy`; if the secret store itself is unavailable,
  use `indeterminate` or `access-blocked` as applicable.
- **Indeterminate:** the name inventory is truncated or cannot be associated
  with the verified project.
- **Access-blocked:** the operator cannot list names without requesting broader
  secret access.

**Safe stopping condition:** any reveal, copy, edit, add, rotate, delete, or
set-secret control; any output that unexpectedly includes values or digests
must be closed and handled under the evidence incident rule in section 14.

**Permitted next action after failure:** record missing **names only** and
request a separately authorized secret-provisioning or rotation procedure. Do
not ask anyone to place a secret value in the change ticket, chat, command
history, screenshot, or completion report.

### 9.5 `RV-03` - Cron execution history

**Authorization required:** owner-approved SQL Editor access allowing
`SELECT` against `cron.job_run_details`.

**Exact read-only action:** after `RV-02`, `RV-04`, and `RV-05`, run:

```sql
select
  j.jobname,
  d.runid,
  d.status,
  d.return_message,
  d.start_time,
  d.end_time
from cron.job_run_details as d
join cron.job as j on j.jobid = d.jobid
where j.jobname in (
  'discover-jobs-daily',
  'daily-digest',
  'process-ready-jobs'
)
order by d.start_time desc
limit 30;
```

If 30 rows do not include at least one run for each present definition, use
this bounded per-job query for the omitted name:

```sql
select
  j.jobname,
  d.runid,
  d.status,
  d.return_message,
  d.start_time,
  d.end_time
from cron.job_run_details as d
join cron.job as j on j.jobid = d.jobid
where j.jobname = '<expected-job-name>'
order by d.start_time desc
limit 5;
```

Replace `<expected-job-name>` only with one of the three expected literal
names. This remains a `SELECT`.

**Expected evidence:**

- `discover-jobs-daily`: a recent run consistent with `0 13 * * *`;
- `daily-digest`: a recent run consistent with `15 13 * * *`;
- `process-ready-jobs`: recent runs consistent with `*/10 * * * *`;
- successful terminal statuses and plausible start/end timestamps.

A successful cron database status proves the scheduled SQL completed; it does
not by itself prove the HTTP target returned application-level success. Any
available response/error metadata must be interpreted conservatively and
redacted.

**Redaction requirements:** redact URLs, query strings, response bodies,
headers, secret material, user IDs, email addresses, and personal data from
`return_message`. Preserve the status and non-sensitive error category.

**Criteria:**

- **Pass:** each present expected job has recent successful runs at a cadence
  consistent with its definition and no unresolved recent failure streak.
- **Fail:** runs exist but are repeatedly failed, timing is materially
  inconsistent with the active schedule, or the latest expected runs are
  missing outside an owner-recorded maintenance window. Classify `present but
  unhealthy`.
- **Fail:** a required cron definition exists but has no execution history
  after its recorded creation/deployment time. Classify `present but
  unhealthy`.
- **Absent:** use only when `RV-02` already proved the definition is absent.
- **Indeterminate:** retention limits, a current maintenance window, ambiguous
  status text, or unavailable response-level evidence prevents a reliable
  health conclusion.
- **Access-blocked:** the operator cannot query run history.

**Safe stopping condition:** any suggestion to invoke a function, manually run
a job, change a schedule, clear history, or inspect an unredacted payload.

**Permitted next action after failure:** correlate the failure category with
the already captured function and secret-name evidence, then request a
separately authorized diagnostic or repair. Do not manually trigger the job.

### 9.6 `RV-06` - Base-table existence and freshness

**Authorization required:** owner-approved SQL Editor access allowing aggregate
`SELECT` statements against the `public` schema. Row-level content is not
needed.

**Exact read-only existence query:**

```sql
select
  expected.table_name,
  to_regclass('public.' || expected.table_name) is not null as exists
from (
  values
    ('job_raw'),
    ('job_applications'),
    ('resume_versions')
) as expected(table_name)
order by expected.table_name;
```

Only if all three exist, run the aggregate freshness query:

```sql
select
  'job_raw' as table_name,
  count(*) as row_count,
  min(created_at) as oldest_created_at,
  max(created_at) as newest_created_at
from public.job_raw
union all
select
  'job_applications',
  count(*),
  min(created_at),
  max(created_at)
from public.job_applications
union all
select
  'resume_versions',
  count(*),
  min(created_at),
  max(created_at)
from public.resume_versions
order by table_name;
```

If a table exists but the aggregate query reports that `created_at` is absent,
stop and capture that schema mismatch. Do not substitute a guessed timestamp
column. A separately authorized schema investigation may first run a targeted
`information_schema.columns` query.

**Expected evidence:** existence booleans plus aggregate counts and minimum/
maximum timestamps. Section 8 of the canonical document expects nonzero counts
and current timestamps for a live, non-stale system.

Freshness must be interpreted against earlier evidence:

- `job_raw` is the daily discovery/email intake table, but a successful
  duplicate-only run may add no row;
- `job_applications` receives only qualifying promotions, so no daily write is
  guaranteed;
- `resume_versions` changes only when materials are seeded or tailoring runs,
  so it has no fixed daily freshness requirement.

Do not inspect individual rows to compensate for ambiguous aggregates during
this run.

**Redaction requirements:** retain table names, aggregate counts, and aggregate
timestamps only. Do not capture row contents, user IDs, job descriptions,
resume text, cover letters, URLs, companies, or role names.

**Criteria:**

- **Pass:** all three tables exist, all have nonzero counts, timestamps are
  valid, and the aggregates do not contradict the verified schedule/run
  evidence or owner-recorded expected activity.
- **Fail:** a required table is missing. Classify that component `absent`.
- **Fail:** tables exist but expected restored/seeded data is empty, timestamps
  are invalid, or aggregates contradict a known successful write-producing
  event. Classify `present but unhealthy`.
- **Indeterminate:** timestamps are old but no verified event establishes that
  a newer row should exist, or cron evidence cannot distinguish duplicate-only
  or no-qualifying-job runs.
- **Access-blocked:** aggregate access is denied.

**Safe stopping condition:** a missing table/column, a request for row-level
content, or any proposal to seed, restore, migrate, insert, or update data.

**Permitted next action after failure:** record the aggregate evidence and
request a separately authorized schema or data-recovery investigation. The
checked-in migrations must not be assumed to bootstrap missing base tables.

## 10. GitHub Pages read-only procedure

### 10.1 `RV-07` - Pages source and canonical URL

**Authorization required:** owner-approved read access to repository Pages
settings and permission to issue public HTTP `GET` requests to the two
documented URLs.

**Exact read-only metadata command:**

```powershell
gh api repos/ekazee01-lgtm/jobsearch/pages `
  --jq '{status: .status, html_url: .html_url, build_type: .build_type, source: .source}'
```

If the operator lacks settings access, use
**GitHub repository > Settings > Pages** and record the displayed build source,
branch/folder, deployment status, and canonical URL without changing them.

Then inspect both repository-documented locations:

```powershell
$urls = @(
  'https://ekazee01.github.io/jobsearch/',
  'https://ekazee01-lgtm.github.io/jobsearch/tracker.html'
)

foreach ($url in $urls) {
  $response = Invoke-WebRequest -Uri $url -Method Get `
    -MaximumRedirection 5 -UseBasicParsing
  $finalUri = if (
    $response.BaseResponse.PSObject.Properties.Name -contains 'ResponseUri'
  ) {
    $response.BaseResponse.ResponseUri
  } else {
    $response.BaseResponse.RequestMessage.RequestUri
  }
  [pscustomobject]@{
    RequestedUrl = $url
    StatusCode = [int]$response.StatusCode
    FinalUrl = $finalUri.AbsoluteUri
    Title = if ($response.Content -match '<title>([^<]+)</title>') {
      $Matches[1]
    } else {
      '<missing>'
    }
  }
}
```

**Expected evidence:**

- the configured Pages source and deployment state;
- GitHub's reported `html_url`;
- HTTP status, redirect destination, and HTML title for both URLs;
- `tracker.html`, when served from the active deployment, has title
  `Job Tracker | Eric Kazee`;
- `index.html`, when served from the active deployment, has title
  `Eric Kazee | AI Adoption & Legal Technology Specialist`.

The settings result, not conflicting repository prose, determines the
canonical Pages host/source. A working legacy URL may be a redirect or a
separate deployment and must be described rather than assumed canonical.

**Redaction requirements:** redact operator/account metadata and private
settings not needed for Pages classification. Public URLs, branch/folder,
status codes, redirect destinations, and page titles may remain.

**Criteria:**

- **Pass:** Pages settings identify a source and canonical URL, deployment
  status is healthy, the canonical URL returns a successful response, and the
  expected content is served at its configured path.
- **Fail:** Pages is configured but its deployment is failed, the canonical URL
  is unavailable, or served content does not match the repository page.
  Classify `present but unhealthy`.
- **Fail:** Pages is not configured. Classify `absent`.
- **Indeterminate:** settings and public behavior conflict in a way that cannot
  be explained from read-only evidence.
- **Access-blocked:** the source/canonical setting cannot be viewed and public
  responses alone cannot establish it.

**Safe stopping condition:** any control to change source, configure a custom
domain, rebuild, disable Pages, or edit DNS.

**Permitted next action after failure:** request separate authorization for a
Pages settings, deployment, or documentation correction. Do not change either
documented URL during verification.

## 11. Google read-only procedures

### 11.1 `RV-08` - Apps Script triggers

**Authorization required:** owner-approved read access to the Google Apps
Script project that contains `ingestJobEmails` and
`ingestApplicationReplies`.

**Exact read-only dashboard action:**

1. Sign in to `https://script.google.com` with the approved Google account.
2. Open the existing job-ingest project; do not create a project.
3. Select **Triggers** using the clock icon.
4. Inspect the trigger list only.
5. Record handler name, deployment, event source, event type/cadence, visible
   status/error indicator, and last/next run metadata.
6. Do not open Script Properties because `CRON_SECRET` value access is outside
   this check.

**Expected evidence:** an active time-driven trigger for each handler:

| Handler | Expected trigger |
|---|---|
| `ingestJobEmails` | Time-driven, hour timer, every 4 hours |
| `ingestApplicationReplies` | Time-driven, every 4 hours |

Saved source without an active trigger does not pass. This check does not
authorize clicking **Run** and does not prove that a trigger's external request
succeeds.

**Redaction requirements:** crop or redact Google account addresses, project
IDs, unrelated projects/functions, and error details containing message
content or endpoint payloads. Preserve handler, cadence, state, and timestamps.

**Criteria:**

- **Pass:** exactly one active time-driven trigger exists for each handler at
  the expected cadence, with no unresolved visible failure/authorization
  indicator.
- **Fail:** handlers have triggers but any is disabled, duplicated, at a
  different cadence, or visibly failing authorization. Classify `present but
  unhealthy`.
- **Fail:** either handler has no trigger. Classify that trigger `absent`.
- **Indeterminate:** trigger metadata is incomplete or status cannot be
  interpreted without executing/reauthorizing.
- **Access-blocked:** the operator cannot open the owning project or trigger
  list.

**Safe stopping condition:** any prompt or control to add, edit, delete, run,
authorize, reauthorize, or deploy a trigger/script.

**Permitted next action after failure:** request separate authorization to
repair or reauthorize one named trigger. Do not run either handler as a test
during read-only verification because each handler calls an Edge Function and
may cause writes or external LLM use.

### 11.2 `RV-09` - Gmail label and filter configuration

**Authorization required:** owner-approved settings access to the Gmail mailbox
used for application replies. Message-body access is not required.

**Exact read-only dashboard actions:**

1. In Gmail, open **Settings > See all settings > Labels**.
2. Confirm a label named exactly `JobReplies` exists.
3. Open **Filters and Blocked Addresses**.
4. Locate filters whose action applies `JobReplies`.
5. Record each matching filter's criteria and action without editing or
   exporting it.
6. Confirm that the highest-precision plus-addressing filter includes:

   ```text
   to:ekazee01+apply@gmail.com
   ```

7. Run this Gmail search from the search box:

   ```text
   label:JobReplies to:ekazee01+apply@gmail.com newer_than:90d
   ```

   Record only the aggregate result count and newest message timestamp, if any.
   Do not open messages or capture bodies.

The search is supporting evidence that the plus-addressed path is receiving
labeled mail; zero results do not prove the filter is wrong if no recent
applications used the alias.

**Expected evidence:**

- label `JobReplies` exists;
- at least one filter applies that label;
- the active highest-precision strategy uses
  `to:ekazee01+apply@gmail.com`;
- any broad ATS/sender filters and job-alert exclusions are recorded as
  additional configuration, not silently treated as the primary criterion;
- aggregate search evidence is consistent with known recent use, if the owner
  expects such use.

**Redaction requirements:** redact Google account metadata, unrelated labels
and filters, message senders, subjects, snippets, and bodies. Preserve the
documented plus-addressing criterion, label name, filter action, aggregate
count, and aggregate timestamp.

**Criteria:**

- **Pass:** the exact label exists, a filter applies it using the documented
  plus-addressing criterion, and aggregate evidence does not contradict
  owner-recorded recent use.
- **Fail:** the label exists but the filter is disabled/misdirected, does not
  apply the label, or configuration contradicts the documented active
  strategy. Classify `present but unhealthy`.
- **Fail:** the label or all applicable filters are missing. Classify the
  missing component `absent`.
- **Indeterminate:** configuration is correct but no recent message is expected
  or available to establish actual use, or multiple filters make coverage
  ambiguous.
- **Access-blocked:** the operator cannot view label/filter settings.

**Safe stopping condition:** any control to create, edit, delete, import, or
export a label/filter; any need to open message content; or any proposal to
manually label a message for testing.

**Permitted next action after failure:** request separate authorization for one
specific label/filter change or for an owner-led review of how the plus address
is used on new applications. Do not change Gmail configuration during this
run.

## 12. Optional mutating smoke test - excluded from initial verification

### 12.1 `RV-SMOKE-01` - `discover-jobs`

`discover-jobs` is not a read-only health check. Its source shows that one
invocation:

- fetches configured external RSS/Atom feeds;
- may upsert newly discovered rows into `public.job_raw`;
- may call OpenAI and incur cost when `OPENAI_API_KEY` is configured and new
  candidates reach scoring;
- may promote/upsert qualifying rows into `public.job_applications`;
- uses the privileged cron-secret path and service-role database access.

Therefore `RV-SMOKE-01` must not be included in `RV-01` through `RV-09`, must
not be used to resolve an indeterminate read-only result, and must not be run
by implication from an approval to "verify" or "reactivate."

Before the owner may authorize it, the operator must provide:

1. the completed read-only verification report;
2. the exact proposed invocation method and target project;
3. a pre-run aggregate snapshot of `job_raw` and `job_applications`;
4. the expected write and cost bounds;
5. a secret-safe method that reads `CRON_SECRET` from an existing protected
   environment variable without echoing it;
6. redaction and evidence-capture steps;
7. abort conditions;
8. a rollback/containment proposal that acknowledges external feed reads and
   OpenAI cost cannot be rolled back.

Only the owner may issue later, explicit approval naming
`RV-SMOKE-01`. Approval must be time-bounded and must not be bundled with a
documentation review or read-only verification authorization.

The expected application response, if a later run is authorized, includes
`fetched`, `inserted_raw`, `filtered_out` or its current filtering fields, and
`promoted_to_review`. The current source also reports duplicate and failure
metadata. No invocation command is included here because selecting and
reviewing a secret-safe execution method is part of the later authorization
package.

## 13. Classification and decision matrix

Use one of these final classifications for every component:

| Classification | Decision rule | Allowed conclusion | Next gate |
|---|---|---|---|
| `verified operational` | Required read-only evidence is current, internally consistent, and meets the check's pass criteria. | The observed property was operational at the evidence timestamp; do not generalize beyond the check. | Continue to dependent checks or routine monitoring. |
| `present but unhealthy` | The component exists, but current evidence shows a failed state, wrong configuration, stale expected activity, or repeated errors. | Presence is established; operation or configuration is not acceptable. | Separate diagnosis/remediation authorization. |
| `absent` | Authoritative read-only evidence shows the required component does not exist. | The component must be created or restored before it can be operational. | Separate creation/restoration authorization. |
| `access-blocked` | Required state may exist, but the approved operator cannot view enough evidence. | No runtime conclusion is permitted. | Separate access-grant or owner-performed verification. |
| `indeterminate` | Evidence is available but conflicting, incomplete, retention-limited, or insufficient to distinguish healthy from unhealthy without a prohibited action. | State remains unknown; do not convert it to pass or fail by assumption. | Additional read-only evidence design or separately authorized diagnostic. |

The completion report may say **overall verified operational** only if every
required check passes and no required dependency is `present but unhealthy`,
`absent`, `access-blocked`, or `indeterminate`. Optional secret absence and a
deliberately excluded smoke test must be reported explicitly but do not by
themselves fail a read-only presence/configuration check.

## 14. Reactivation and remediation gate

### 14.1 Separate authorization for every repair

Each failed component requires its own change record and explicit owner
authorization. Do not bundle cron, function, secret, schema, Pages, Apps
Script, or Gmail changes into one implied approval.

The change record must contain:

- originating run ID and check ID;
- failure classification and redacted before evidence;
- exact proposed mutation;
- target system and component;
- operator and required privilege;
- expected effect and success criteria;
- data-write, external-call, cost, privacy, and downtime impact;
- rollback or containment procedure;
- validation query/action;
- approval identity, timestamp, and expiry.

An instruction to diagnose does not authorize repair. An instruction to repair
one component does not authorize adjacent cleanup.

### 14.2 One repair at a time

For each authorized repair:

1. reconfirm the target and approval are current;
2. capture a fresh read-only **before** record;
3. execute exactly the approved mutation;
4. capture command output after redaction;
5. run only the approved read-only validation;
6. capture a timestamped **after** record;
7. classify the component again;
8. stop before the next repair and obtain its separate authorization.

A component may move to `verified operational` only when before/after evidence
shows the approved repair occurred and the original check now passes.

### 14.3 Secret repairs

Secret values must be supplied through an approved secret manager or protected
interactive input. They must never appear in:

- this repository;
- a pull request, issue, chat, or completion report;
- shell history or a command transcript;
- screenshots or screen recordings;
- copied CLI output.

The after evidence for a secret repair is the name inventory and dependent
health evidence, never the value.

## 15. Rollback, containment, and escalation rules

### 15.1 During read-only verification

Read-only checks should have no state to roll back. Stop immediately if:

- a command or dashboard unexpectedly begins a mutation;
- secret or personal data appears in captured output;
- the operator discovers the wrong project, repository, Apps Script project,
  or Gmail account is open;
- evidence contradicts the approved baseline;
- an active incident, data loss, or security exposure is visible.

If unintended mutation occurs, record the time and exact action, preserve logs,
stop all further work, and escalate to the owner. Do not attempt an unapproved
"undo."

If secret or personal data is captured, move the evidence to the restricted
location, remove it from shared/public artifacts using the approved secure
handling process, and notify the owner. Secret rotation is a separate mutating
incident response action.

### 15.2 During a later authorized repair

Rollback is permitted only when:

- its exact procedure was pre-authorized in the change record; or
- the owner provides new explicit authorization after the failure.

If rollback cannot safely restore state, prefer containment: disable only the
specifically authorized failing path, prevent further writes/calls, preserve
evidence, and escalate. Never run `discover-jobs`, replay migrations, restore a
database, rotate secrets, redeploy all functions, or rewrite Gmail/Apps Script
configuration as an improvised rollback.

### 15.3 Escalation targets

- **Security or secret exposure:** stop the run and notify the owner
  immediately; do not paste the exposed material into the escalation.
- **Database/schema absence or corruption:** owner plus a separately
  authorized Supabase/database operator.
- **Unexpected writes or duplicate promotions:** owner; contain the invoking
  path before any data cleanup.
- **GitHub Pages source ambiguity:** repository owner; preserve settings and
  HTTP evidence before changing documentation.
- **Google authorization or privacy issue:** Google account owner; do not
  reauthorize or broaden Gmail scope during verification.
- **Access-blocked result:** owner or system administrator grants least-
  privilege read access, or performs the check and signs the evidence record.

## 16. Completion report template

```markdown
# Runtime Verification Completion Report

## Run metadata

- Run ID:
- Operator:
- Owner authorization reference:
- Started at (UTC):
- Ended at (UTC):
- Repository baseline:
- Canonical-document SHA-256:
- Private evidence location:

## Scope attestation

- Checks authorized:
- Checks completed:
- Checks skipped and why:
- Runtime mutations performed: none
- Edge Functions invoked: none
- External application calls initiated by the system: none
- Secret values accessed or exposed: none

## Results

| Check | Component | Classification | Pass/fail/indeterminate | Evidence location | Concise observation |
|---|---|---|---|---|---|
| RV-01 | Supabase project health | | | | |
| RV-02 | Cron definitions | | | | |
| RV-04 | Edge Functions | | | | |
| RV-05 | Secret names | | | | |
| RV-03 | Cron execution history | | | | |
| RV-06 | Base tables/freshness | | | | |
| RV-07 | GitHub Pages | | | | |
| RV-08 | Apps Script triggers | | | | |
| RV-09 | Gmail label/filters | | | | |

## Dependency interpretation

- Definition/deployment/configuration relationships:
- Cron-history interpretation:
- Table-freshness interpretation:
- Conflicting or retention-limited evidence:

## Required follow-up gates

| Failed or indeterminate check | Proposed next action | Mutation involved | Separate authorization required | Owner decision |
|---|---|---:|---:|---|
| | | yes/no | yes | |

## Optional smoke-test status

- RV-SMOKE-01 authorized: no
- RV-SMOKE-01 executed: no
- Later approval package requested: yes/no

## Operator attestation

I performed only the authorized read-only actions, applied the documented
redactions, did not access or expose secret values, and stopped without
remediation or smoke testing.
```

## 17. Completion criteria

The initial verification gate is complete when:

- `RV-01` through `RV-09` each have a signed evidence record or a documented
  dependency-based skip;
- every result uses the decision matrix in section 13;
- the completion report points to restricted evidence without embedding secret
  or personal data;
- all failures and unknowns remain unrepaired unless separately authorized;
- `RV-SMOKE-01` remains unexecuted unless a later explicit owner approval is
  documented;
- the owner accepts the report and decides which, if any, reactivation change
  records to authorize.

The next gate after this plan is an independent, complete-document review. It
is not execution of the plan.
