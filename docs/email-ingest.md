# Email → Dashboard ingestion (Google Apps Script)

Pulls job-alert emails into the tracker every 4 hours, scored by the same
criteria as RSS. Runs inside your own Google account — no OAuth app, no token
expiry, no third-party service. Safe to commit: it contains no secret (the
`CRON_SECRET` is read from Script Properties at runtime; the function URL is
public but useless without the header).

Idempotency is **message-level on the server** (`ingested_email_messages`): the
script just sends recent alert messages each run, and `ingest-email-jobs` skips
ones it has already handled and processes a bounded number of new ones, so
nothing double-processes or gets lost — no Gmail labels involved.

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
  ones (cheap, before any LLM call) and advances through new ones a few per run,
  so a backlog clears over successive runs without losing or duplicating any.
- Indeed flags many roles as "bad match" (old profile); the scoring filters those
  — only role-fit 7+ jobs reach the tracker.
- Dedup: a job already in the tracker (normalized company+role) is skipped, so an
  email job that RSS already found won't duplicate.
- To capture more boards, add their alert sender addresses to `SENDERS`.
