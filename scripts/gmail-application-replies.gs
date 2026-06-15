const REPLY_FUNCTION_URL =
  'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/ingest-application-replies';
const REPLY_LABEL = 'JobReplies';
const MAX_REPLY_MESSAGES = 40;

function trimReplyBody_(body) {
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^On .+wrote:$/i.test(line) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line) ||
      /^From:\s.+/i.test(line) ||
      /^>/.test(line) ||
      /^--\s*$/.test(line) ||
      /^Sent from my /i.test(line)
    ) {
      break;
    }
    kept.push(lines[i]);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
}

function extractAddress_(value) {
  const match = String(value || '').match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  return match ? match[0].toLowerCase() : '';
}

function ingestApplicationReplies() {
  const secret = PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  if (!secret) throw new Error('Set CRON_SECRET in Script Properties first.');

  const ownAddresses = {};
  [
    Session.getActiveUser().getEmail(),
    Session.getEffectiveUser().getEmail(),
  ].concat(GmailApp.getAliases()).forEach(function (address) {
    const normalized = extractAddress_(address);
    if (normalized) ownAddresses[normalized] = true;
  });
  const threads = GmailApp.search(
    'label:' + REPLY_LABEL + ' newer_than:30d',
    0,
    50
  );
  const emails = [];

  for (let t = 0; t < threads.length && emails.length < MAX_REPLY_MESSAGES; t++) {
    const messages = threads[t].getMessages();
    for (let m = 0; m < messages.length && emails.length < MAX_REPLY_MESSAGES; m++) {
      const message = messages[m];
      const from = String(message.getFrom() || '');
      if (ownAddresses[extractAddress_(from)]) continue;

      emails.push({
        id: message.getId(),
        threadId: threads[t].getId(),
        subject: message.getSubject(),
        from: from,
        body: trimReplyBody_(message.getPlainBody()),
        receivedAt: message.getDate().toISOString(),
      });
    }
  }

  if (emails.length === 0) {
    Logger.log('No labeled application replies in the 30-day window.');
    return;
  }

  const response = UrlFetchApp.fetch(REPLY_FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-cron-secret': secret },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true,
  });
  Logger.log(
    'Status %s: %s',
    response.getResponseCode(),
    response.getContentText()
  );
}
