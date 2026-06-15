# Capability-Routed Auto-Apply — Design

**Status:** Phase 0 implemented and PostgreSQL-verified locally; not yet deployed
· **Date:** 2026-06-15

Extends the Supabase-native architecture in [../AUTOMATION.md](../AUTOMATION.md)
**without reversing it**. No VPS, no n8n, no server-side headless browser, no
fingerprint spoofing / CAPTCHA bypass / proxy rotation. Supabase stays the
control plane; an **optional local execution worker** (browser extension or
desktop companion) uses the user's *own already-authenticated browser* for the
cases that have no authorized API. True unattended submission is limited to
officially supported channels (authorized API or email).

## Definition of "full automation" (agreed scope)

1. Automatic discovery, scoring, tailoring, and question-answering. *(discovery,
   scoring, tailoring already exist; question-answering is new.)*
2. Automatic submission **only** where an authorized API or email channel exists.
3. One-click *reviewed* submission everywhere else.
4. Idempotency, audit logs, daily volume limits, and immediate **stop on any
   challenge** (CAPTCHA, login, consent statement, ambiguous question).

## Capability router

Given a job's apply URL + source, classify into exactly one lane:

| Lane | Trigger | Execution | Human gate |
|---|---|---|---|
| `api` | An employer has explicitly provided and configured submission API credentials for this integration | Edge Function (server-side, no browser) | explicit approval policy configured for that credential |
| `email` | Posting accepts application by email (`email://` slug or a contact address) | Edge Function via Gmail API / Resend | **explicit per-send approval** |
| `assisted` | Real ATS portal, no usable API (Workday, iCIMS, Taleo, most Greenhouse/Lever) | **Local worker** in the user's browser: autofill + attach docs, **pause before final submit** | user clicks submit |
| `manual` | No URL, unknown form, or any challenge detected | none — surface in tracker | user does it |

**Important:** Greenhouse and Lever publish job-reading endpoints, but their
application-submission endpoints require API credentials controlled by the
employer. A reachable endpoint is not authorization. The router must never
probe a submission endpoint, infer permission from the ATS vendor, or attempt
to discover credentials. The `api` lane is disabled unless an employer-issued
credential has been configured explicitly; otherwise the job routes to
`assisted`. For an applicant-owned system, this lane will normally be empty.

Any of these at runtime force `manual` / `needs_intervention` and STOP:
CAPTCHA, login/2FA challenge, consent or attestation checkbox with legal text,
or an application question the model can't answer with high confidence.

## Components

1. **Control plane (Supabase, existing pattern):**
   - New `plan-submission` Edge Function: computes the lane per job, builds a
     canonical candidate/materials payload, and enqueues a submission plan
     through one transactional database function. The plan snapshot, answers,
     and audit event either all commit or all roll back. No outward action.
   - Exact ATS questions are included only when they are available through an
     authorized/read-only source. Dynamic questions discovered later by the
     assisted worker are returned to the tracker for review; Phase 0 does not
     claim it can inspect every ATS form from an apply URL.
   - `submit-via-api` / `submit-via-email` Edge Functions: perform authorized
     sends; idempotent; write audit + advance status.
2. **Local execution worker (new, optional):** a browser extension (MV3) or small
   desktop companion that long-polls Supabase for `assisted` jobs assigned to the
   signed-in user, opens the real application in the user's authenticated browser,
   autofills from the payload, attaches the tailored resume/cover letter, and
   **stops at the final submit button**. Pushes status back. Credentials never
   leave the user's machine; the worker authenticates to Supabase with the user's
   own session (RLS-scoped).
3. **Tracker review queue (existing UI + additions):** shows each job's routed
   lane, the answers the AI will submit, low-confidence flags, an approve/submit
   control, and the audit trail.

## Data model (additions)

```sql
-- Immutable versions in one lineage per job. Idempotency + audit live here.
create table application_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  job_id uuid not null references job_applications(id),
  channel text not null check (channel in ('api','email','assisted','manual')),
  status text not null default 'queued' check (status in
    ('queued','awaiting_approval','submitting','submitted',
     'needs_intervention','failed','skipped')),
  idempotency_key text not null,           -- hash(job_id), one lineage per job
  plan_version int not null default 1,
  route_reason text not null,
  route_evidence jsonb not null default '{}',
  external_ref text,                        -- ATS confirmation id / message id
  payload jsonb not null default '{}',      -- immutable snapshot for this plan/version
  intervention_reason text,                 -- captcha | login | consent | low_confidence | ...
  reviewed_at timestamptz,
  approved_at timestamptz,
  submitted_at timestamptz,
  last_error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key, plan_version)
);

-- Per-question answers so low-confidence ones can gate submission.
create table application_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references application_submissions(id) on delete cascade,
  question_key text not null,
  question text not null,
  answer text,
  confidence numeric check (confidence between 0 and 1),
  required boolean not null default false,
  requires_user_attestation boolean not null default false,
  source text check (source in
    ('master_resume','positioning_profile','user_profile','user_confirmed'))
);
```

Audit also flows through the existing `application_events` log. Phase 0 writes
`submission_plan_created` and `submission_plan_reviewed`; execution phases add
submission outcome and intervention events.

Both new tables must have RLS enabled before use. Authenticated users may access
only rows where `application_submissions.user_id = auth.uid()` (answers inherit
ownership through their parent submission). Browser clients cannot set
`submitted`, `external_ref`, or execution counters directly; those transitions
belong to the execution Edge Functions. Phase 0 needs an explicit state-machine
test so invalid transitions such as `queued -> submitted` are rejected.

## Guardrails

- **Idempotency:** the key identifies one job lineage. Channel changes participate
  in the payload hash and create the next plan version rather than a parallel
  lineage. Plan creation writes the snapshot, answers, and audit event in one
  transaction. Submit functions atomically claim an approved row and re-verify
  its status before acting. A failed attempt can be retried against the same plan
  without creating a duplicate successful submission.
- **Daily volume limit:** a configurable `MAX_SUBMISSIONS_PER_DAY`, enforced by
  execution functions immediately before an outward action. Planning and review
  are never capped, so Phase 0 can classify the full backlog safely.
- **Stop on challenge:** worker/edge function sets `needs_intervention` + reason
  and never proceeds; surfaced in tracker + digest.
- **No disguised automation:** assisted lane runs in the user's real browser with
  their real session at human speed; no spoofing, no bypass, no auto-click of the
  final submit for unsupported portals.
- **ToS posture:** unattended submission only on authorized API/email channels.
  LinkedIn and Workday automated-access prohibitions are respected by routing
  them to `assisted`/`manual` (user-driven), never unattended bots.

## Phasing (recommended build order)

- **Phase 0 — Router + review queue, zero outward actions.** Build the data
  model + RLS/state rules, `plan-submission` (classification + canonical payload
  and any questions available from read-only sources), and the tracker review
  queue that *shows* the plan. Completely safe to ship; nothing is sent.
  Validates routing accuracy on real jobs first.
- **Phase 1 — Email channel with explicit approval.** Lowest-risk authorized
  send; gives thread-based reply correlation for response-tracking.
- **Phase 2 — Local assisted worker.** Browser extension: autofill + stop before
  submit. The biggest build; start after routing is proven.
- **Phase 3 — API channel** where a verified authorized endpoint exists.

Response-tracking (classify employer replies, advance status) is built alongside
Phase 1, since email sending gives it the cleanest correlation key.
