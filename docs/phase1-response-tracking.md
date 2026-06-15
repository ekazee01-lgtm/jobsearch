# Phase 1 — Response Tracking (reply ingestion + conservative status updates)

**Status:** Phase 1A implemented locally; not yet reviewed or deployed · **Date:** 2026-06-15
Extends [auto-apply-design.md](auto-apply-design.md). Builds on the Phase 0
plan/audit foundation. **No outward actions** — this phase only *reads* the
user's Gmail replies and proposes/records status changes.

## Why this is Phase 1 (not the email-send lane)

Live routing shows 35 `assisted` jobs and 0 `email` jobs, so an email-send lane
would have nothing to act on. Response tracking delivers value across **every**
application — ATS web-form and manually submitted alike — and builds production
experience with Gmail correlation before any sending exists. Email submission is
deferred until routing data shows real email-apply volume.

## Sequence

- **Phase 1A** — reply ingestion, classification, correlation, review queue. No
  status changes applied automatically; everything lands as a *proposal*.
- **Phase 1B** — conservative auto-apply for **high-confidence, unambiguous
  explicit rejections only**. Everything else stays review-gated.
- (Later) Phase 2A assisted-worker prototype for one ATS family.

## Components

1. **Gmail Apps Script (extend existing pattern):** a sibling to the job-alert
   poller that forwards *application reply* emails to a new endpoint. **Selection
   is label-based (decided):** the script forwards only messages in threads
   carrying a user-maintained Gmail label (e.g. `JobReplies`), set once via a
   Gmail filter. Nothing outside that label leaves the inbox. Sends Gmail
   `messageId`, `threadId`, `from`, `subject`, a trimmed body, and `receivedAt`.
2. **`ingest-application-replies` Edge Function (new):** mirrors
   `ingest-email-jobs` — `x-cron-secret` auth, `USER_ID` + `OPENAI_API_KEY`
   secrets, message-level idempotency. Classifies, correlates, writes an audit
   row, and (1B only) conditionally applies a status change via a guarded RPC.
3. **`application_replies` audit table (new):** stores every ingested reply with
   its classification, correlation, proposed status, and review state.
4. **Tracker "Replies" review queue (new UI section):** lists proposed outcomes
   with Confirm / Dismiss / Link-to-job controls. In Phase 1A, Confirm records
   review of the classification only and does not change job status.

## Data model

```sql
create table public.application_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.job_applications(id) on delete set null, -- null until correlated
  gmail_message_id text not null,         -- dedup key (message-level, like ingested_email_messages)
  gmail_thread_id text,
  from_email text,
  from_domain text,
  subject text,
  snippet text,                            -- trimmed body actually sent to the classifier
  received_at timestamptz,
  classification text check (classification in
    ('rejection','interview','offer','info_request','other')),
  classification_confidence numeric check (classification_confidence between 0 and 1),
  classification_rationale text not null, -- one-line model explanation
  proposed_status text,                    -- e.g. 'Rejected' / 'Interview' / 'Offer'
  correlation_method text check (correlation_method in
    ('thread','domain','company_role','unmatched')),
  correlation_confidence numeric check (correlation_confidence between 0 and 1),
  correlation_details jsonb not null default '{}',
  review_state text not null default 'pending_review' check (review_state in
    ('pending_review','auto_applied','confirmed','dismissed')),
  applied_status text,                     -- the status actually written, if any
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)       -- idempotent re-ingest
);
```

Owner-only RLS + SELECT-only grant to `authenticated`, identical to the Phase 0
tables. Ingestion writes happen only through a service-role RPC. Browser review
writes happen only through an owner-scoped `review_application_reply` RPC.
That Phase 1A RPC can confirm, dismiss, or link a proposal, but contains no job
status update.

## Correlation (multi-signal, scored)

For each reply, compute `correlation_confidence` from:
- **thread** — `gmail_thread_id` matches a thread we sent on. (Strong, but
  unavailable until email-send/Gmail-draft exists — most Phase 1 replies will
  not have this. Reason this ordering is good: we gain the plumbing now.)
- **domain** — `from_domain` matches the employer domain of a job's `url`.
- **company_role** — fuzzy company match (+ role keywords) against open jobs.
- **unmatched** — no confident match → `job_id` null, surfaced for manual link.

Only the highest-signal match wins; ties / weak matches → `unmatched`.

## Classification

Reuse the `ingest-email-jobs` OpenAI call shape (`response_format:
json_object`; `reasoning_effort:'none'` only for `gpt-5.4*`, omit for other
gpt-5, temperature 0 otherwise — see [[email-ingestion-live]]). Treat the email
body as **untrusted** (ignore embedded instructions). Classify into
`rejection / interview / offer / info_request / other` with a confidence score
and a one-line rationale.

## Auto-apply gate (Phase 1B)

A `SECURITY DEFINER`, service-role-only RPC `apply_reply_status_change` that
updates `job_applications.status` **only** when ALL hold:
- `classification = 'rejection'`
- `classification_confidence >= REJECTION_AUTO_THRESHOLD` (start high, e.g. 0.9)
- `correlation_method in ('thread','domain')` with high `correlation_confidence`
- the job is not already terminal (`Accepted` / `Rejected`)

Target status: **`Rejected`** (confirmed to exist). It sets
`review_state='auto_applied'`, records `applied_status`, and logs an
`application_events` row (`type='reply_status_applied'`). **Everything else** —
interview, offer, info_request, ambiguous, low-confidence, or unmatched —
stays `pending_review` and changes nothing until the user confirms in the queue.

Phase 1B adds a separate guarded status-change RPC. The Phase 1A Confirm/Dismiss
controls remain review-only and cannot advance a job to Interview/Offer/etc.

## Guardrails

- **No outward actions** — read + classify + record only; the only mutation is a
  gated local status change. No email is sent or opened.
- **Idempotency** — `unique(user_id, gmail_message_id)`; re-ingest is a no-op.
- **Untrusted input** — email body is data, never instructions.
- **Privacy** — send the classifier the minimum: subject + a trimmed body with
  signatures/quoted history stripped (see Open decision 2).
- **Conservative by default** — auto-apply is rejection-only and high-confidence;
  the bias is "surface for review," never "guess and mutate."

## Decisions

1. **How does the Apps Script pick reply emails?** **DECIDED: label-based.** A
   user-maintained Gmail label (e.g. `JobReplies`), applied via a one-time Gmail
   filter; the script forwards only labeled threads. Privacy-preserving (only
   labeled mail reaches OpenAI) and cheap. Accepted trade-off: an unlabeled reply
   is missed until labeled — the review queue's `unmatched`/empty state makes
   gaps visible. Setup instructions belong in `docs/email-ingest.md` alongside
   the existing alert-poller setup.

## Open tunables (safe defaults; adjust after observing real data)

2. **How much body to forward to OpenAI?** Default: subject + first ~1–2 KB
   with quoted history/signatures stripped. Minimizes PII exposure while keeping
   enough to classify.
3. **Rejection auto-threshold + required correlation strength** — start strict
   (0.9 confidence, thread/domain only) and loosen only after observing real
   accuracy.
