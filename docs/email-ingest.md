# Email → Dashboard ingestion (Google Apps Script)

Pulls job-alert emails into the tracker every 4 hours, scored by the same
criteria as RSS. Runs inside your own Google account — no OAuth app, no token
expiry, no third-party service. Safe to commit: it contains no secret (the
`CRON_SECRET` is read from Script Properties at runtime; the function URL is
public but useless without the header).

Idempotency is **message-level on the server**. `ingested_email_messages` records
completed messages; `email_ingest_retries` gives failed messages an eight-hour
cooldown and quarantines them after five attempts. This prevents a malformed
message from blocking later alerts and leaves terminal failures visible for
inspection and manual requeue. No Gmail labels are involved.

## One-time setup

1. https://script.google.com → **New project**, name it "Job Ingest".
2. Paste the script below as `Code.gs`.
3. **Project Settings → Script Properties → Add**: `CRON_SECRET` = the same value
   as your Supabase `CRON_SECRET` secret.
4. Run `ingestJobEmails` once from the editor → authorize when prompted. Confirm
   the execution log shows a JSON summary (`processed`, `recorded`,
   `promoted_to_review`, ...).
5. **Triggers** (clock icon) → **Add Trigger**: `ingestJobEmails`, *Time-driven*,
   *Hour timer*, **Every 4 hours**.

## Code.gs

```javascript
const FUNCTION_URL = 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/ingest-email-jobs';
// Add/remove alert senders as needed.
const SENDERS = [
  'match.indeed.com',
  'jobalerts-noreply@linkedin.com',
  'jobs-noreply@linkedin.com',
  'noreply@ziprecruiter.com',
];
const MAX_MESSAGES = 40; // payload bound; server processes a few NEW ones per run

function ingestJobEmails() {
  const secret = PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  if (!secret) throw new Error('Set CRON_SECRET in Script Properties first.');

  const fromQuery = SENDERS.map(function (s) { return 'from:' + s; }).join(' OR ');
  const threads = GmailApp.search('(' + fromQuery + ') newer_than:3d', 0, 50);

  const emails = [];
  for (var t = 0; t < threads.length && emails.length < MAX_MESSAGES; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length && emails.length < MAX_MESSAGES; m++) {
      emails.push({
        id: msgs[m].getId(),
        subject: msgs[m].getSubject(),
        from: msgs[m].getFrom(),
        body: msgs[m].getPlainBody().slice(0, 8000),
      });
    }
  }
  if (emails.length === 0) { Logger.log('No alert emails in the 3-day window.'); return; }

  const resp = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-cron-secret': secret },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true,
  });
  Logger.log('Status %s: %s', resp.getResponseCode(), resp.getContentText());
}
```

## Notes
- The script re-sends recent messages each run; the server skips already-handled
  messages and temporarily skips failures during their retry cooldown, allowing
  later messages to advance through the bounded queue.
- A partial, duplicate-index, out-of-range, or truncated scoring response fails
  the whole scoring batch. Messages remain uncompleted and retry later rather
  than being rejected by keyword fallback.
- After five failed attempts a message is quarantined instead of retrying
  forever. Inspect or requeue quarantined messages in the Supabase SQL editor:
  ```sql
  select message_id, attempt_count, last_error, last_attempt_at, quarantined_at
  from public.email_ingest_retries
  where quarantined_at is not null
  order by quarantined_at desc;

  delete from public.email_ingest_retries
  where message_id = '<gmail-message-id>';
  ```
- Indeed flags many roles as "bad match" (old profile); the scoring filters those
  — only role-fit 7+ jobs reach the tracker.
- Dedup: URL uniqueness is enforced by the database. Normalized company+role
  dedup catches most RSS/email variants, but it is best-effort under overlapping
  runs because company+role is not a database uniqueness constraint.
- To capture more boards, add their alert sender addresses to `SENDERS`.

## Application reply tracking (Phase 1A)

Application replies use a separate, privacy-limited poller. Only threads with
the Gmail label `JobReplies` are forwarded. The server stores a classification
proposal for review and **does not change job status in Phase 1A**.

### One-time Gmail setup

1. In Gmail, create a label named `JobReplies`.
2. Create one or more conservative Gmail filters that apply `JobReplies` to
   known recruiting senders or application-response subjects. Start narrow,
   then add employer/recruiter domains as they appear. A starter query is:
   ```
   {from:(greenhouse.io lever.co ashbyhq.com smartrecruiters.com icims.com)
    subject:(application interview recruiter recruiting offer)}
   ```
   Do not use a broad filter over the entire inbox. You can also apply the label
   manually to any missed thread; the next poll will ingest it.
3. In the existing Apps Script project, add a new file named
   `ApplicationReplies.gs` and paste
   [`scripts/gmail-application-replies.gs`](../scripts/gmail-application-replies.gs).
4. Reuse the existing `CRON_SECRET` Script Property.
5. Run `ingestApplicationReplies` once and authorize it. Confirm the log reports
   `status_changes: 0` and `outward_actions: 0`.
6. Add a time-driven trigger for `ingestApplicationReplies`, every 4 hours.

The poller strips common signatures and quoted history, limits the body to 2 KB,
and skips messages sent from the signed-in Gmail address. The Edge Function
repeats the body trimming before classification and deduplicates by Gmail
message ID.
