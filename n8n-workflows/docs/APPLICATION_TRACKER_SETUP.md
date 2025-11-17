# Application Tracker - Complete Setup Guide

## 🎯 What This Workflow Does

The **Application Tracker** is the third piece of your complete job search automation system:

**Daily at 8 AM, it automatically:**
1. ✅ Sends follow-up emails (7, 14, 21 days after applying)
2. ✅ Scans your Gmail inbox for job application responses
3. ✅ Uses AI to classify emails (interview request vs. rejection vs. acknowledgment)
4. ✅ Auto-updates job status based on responses
5. ✅ Sends you instant notifications for interview requests
6. ✅ Generates weekly progress reports

**Time savings:** No more manually tracking when to follow up or checking for responses!

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Completed Application Tracker schema setup (ran the SQL file)
- ✅ Gmail account (ekazee.careers@gmail.com or ekazee@outlook.com)
- ✅ n8n account (same one from previous workflows)
- ✅ Anthropic API key (same one from previous workflows)
- ✅ Supabase credentials (same project)

---

## 🔐 Step 1: Gmail OAuth Setup (15 minutes)

### Option A: Gmail via n8n Cloud (Recommended)

**1. In n8n, create Gmail OAuth2 credential:**
```
1. Go to n8n → Credentials
2. Click "New Credential"
3. Search for "Gmail"
4. Select "Gmail OAuth2 API"
5. Name it: "Gmail OAuth - Job Search"
```

**2. Get Google OAuth Credentials:**
```
1. Go to: https://console.cloud.google.com/
2. Create new project (or select existing)
   - Name: "n8n Job Search Automation"
3. Enable Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search "Gmail API"
   - Click "Enable"
4. Create OAuth credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "n8n Gmail Access"
   - Authorized redirect URIs: Add your n8n OAuth redirect URL
     (n8n will show you this URL in the credential creation form)
5. Copy Client ID and Client Secret
6. Paste into n8n credential form
7. Click "Connect my account"
8. Authorize the Gmail access
```

**3. Verify Gmail Access:**
```
In n8n, test the credential:
1. Create a test workflow
2. Add "Gmail" node
3. Select operation: "Get"
4. Select your OAuth credential
5. Execute → Should show your recent emails
```

### Option B: Gmail via App Password (Alternative)

If OAuth is too complex, use App Password:

```
1. Go to: https://myaccount.google.com/security
2. Enable 2-Step Verification (if not already)
3. Go to "App Passwords"
4. Generate new app password:
   - App: Mail
   - Device: Other (n8n)
5. Copy the 16-character password
6. In n8n, create SMTP credential:
   - Host: smtp.gmail.com
   - Port: 587
   - User: ekazee.careers@gmail.com
   - Password: [paste app password]
```

**Note:** OAuth is recommended because it allows both sending AND receiving emails. App Password only works for sending.

---

## 🛠️ Step 2: Import Workflow (5 minutes)

**1. Import the JSON file:**
```
1. Open n8n
2. Click "Import from File"
3. Select: n8n_workflow_application_tracker.json
4. Workflow should appear with all nodes
```

**2. Update Supabase credentials:**
```
All Supabase nodes should use the same credential you set up for previous workflows.

If needed, update:
- Project URL: https://snmdcbrvvzasubdnnsbd.supabase.co
- Service Role Key: (from Supabase Project Settings → API)
```

**3. Update Gmail credentials:**
```
Gmail nodes to update:
- "Send via Gmail" (node for follow-ups)
- "Scan Gmail for Responses" (node for inbox scanning)

Both should use your Gmail OAuth2 credential
```

**4. Verify Anthropic API key:**
```
Check these nodes have ANTHROPIC_API_KEY environment variable:
- "Generate Follow-up Email"
- "Classify Email with AI"
- "Generate Report Analysis"

If using n8n Cloud, set environment variable:
Settings → Environment Variables → Add:
  Name: ANTHROPIC_API_KEY
  Value: [your Anthropic API key]
```

---

## 🎯 Step 3: Configure Email Templates (10 minutes)

### Follow-up Email Templates

The workflow uses Claude to generate follow-up emails dynamically, but you can customize the prompt for different tones.

**Node: "Generate Follow-up Email"**

Current prompt generates professional emails. To customize:

**For more casual tone:**
```json
"content": "Generate a friendly follow-up email for this job application:\n\nCompany: {{ company }}\nPosition: {{ job_title }}\nDays since applied: {{ days }}\n\nRequirements:\n- Friendly and conversational tone\n- Express enthusiasm\n- Ask about next steps\n- Keep very brief (under 100 words)\n- Subject line and body\n\nReturn as JSON: {\"subject\": \"...\", \"body\": \"...\"}"
```

**For formal legal industry tone:**
```json
"content": "Generate a formal follow-up email for this legal sector job application:\n\nCompany: {{ company }}\nPosition: {{ job_title }}\nDays since applied: {{ days }}\n\nRequirements:\n- Formal, professional tone appropriate for law firms\n- Reference commitment to legal technology\n- Maintain attorney-client privilege awareness\n- Keep concise (under 150 words)\n- Subject line and body\n\nReturn as JSON: {\"subject\": \"...\", \"body\": \"...\"}"
```

### Email Classification Prompts

**Node: "Classify Email with AI"**

The AI classifies emails into categories. Current categories:
- `interview_request` - They want to interview you
- `rejection` - They passed on your application
- `acknowledgment` - They received your application
- `question` - They have questions for you
- `other` - Unclassified

To add custom categories, update the prompt:

```json
"email_type": "interview_request" | "rejection" | "acknowledgment" | "question" | "screening_call" | "technical_assessment" | "other"
```

---

## 🧪 Step 4: Test the Workflow (30 minutes)

### Test 1: Follow-up Email Generation

**Setup:**
```sql
-- Add a test job that needs follow-up
INSERT INTO jobs (
  company_name, 
  job_title, 
  pipeline_stage, 
  submitted_at,
  hiring_manager_email
) VALUES (
  'Test Company',
  'Test Position',
  'Applied',
  NOW() - INTERVAL '8 days',
  'YOUR_TEST_EMAIL@gmail.com' -- Use your own email
);
```

**Run the workflow:**
```
1. In n8n, execute workflow manually
2. Should process the test job
3. Check your test email for follow-up
4. Verify subject and body are professional
```

**Verify database updated:**
```sql
SELECT 
  company_name,
  follow_up_sent_7d,
  follow_up_7d_at
FROM jobs 
WHERE company_name = 'Test Company';
```

**Clean up:**
```sql
DELETE FROM jobs WHERE company_name = 'Test Company';
```

---

### Test 2: Email Classification

**Setup:**
```
1. Send yourself a test email from another account
2. Subject: "Interview request for AI Adoption Specialist position"
3. Body: "Hi Eric, We'd love to schedule an interview for next week. Are you available Tuesday at 2pm?"
```

**Run the workflow:**
```
1. Execute workflow manually
2. Should scan Gmail and find the test email
3. AI should classify it as "interview_request"
4. Job status should update to "Interview"
5. You should receive notification email
```

**Verify in database:**
```sql
-- Check email was saved
SELECT * FROM email_communications 
ORDER BY created_at DESC LIMIT 1;

-- Check job status updated
SELECT pipeline_stage, last_response_at 
FROM jobs 
WHERE pipeline_stage = 'Interview'
ORDER BY updated_at DESC LIMIT 1;
```

---

### Test 3: Weekly Report Generation

**Run manually:**
```
1. Execute workflow
2. Wait for "Generate Weekly Stats" node
3. Should compile stats and generate report
4. You should receive weekly report email
```

**Verify report contains:**
- Application count
- Response count
- Interview requests
- Rejections
- AI-generated insights and recommendations

---

## ⏰ Step 5: Schedule the Workflow (5 minutes)

**1. Activate the workflow:**
```
1. In n8n, toggle workflow to "Active"
2. Verify schedule trigger shows: "Daily at 8 AM"
```

**2. Verify schedule settings:**
```
Schedule Trigger node should have:
- Cron Expression: "0 8 * * *"
- Timezone: Your local timezone

This means: Every day at 8:00 AM
```

**3. Test schedule (optional):**
```
Temporarily change to: "*/15 * * * *" (every 15 minutes)
Monitor for one cycle
Change back to: "0 8 * * *"
```

**4. Monitor first few runs:**
```
Check n8n execution history daily for first week:
- Look for errors
- Verify follow-ups sent correctly
- Confirm email classification working
```

---

## 📊 Step 6: Dashboard Integration (30 minutes)

Update your GitHub Pages dashboard to show tracker data:

### Add Email Activity Section

```html
<!-- Add to your dashboard HTML -->
<div id="email-activity">
  <h2>📧 Recent Email Activity</h2>
  <div id="email-list"></div>
</div>
```

```javascript
// Add to your dashboard JavaScript
async function loadEmailActivity() {
  const { data, error } = await supabase
    .from('email_communications')
    .select(`
      *,
      jobs:job_id (
        company_name,
        job_title
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error loading emails:', error);
    return;
  }
  
  renderEmailActivity(data);
}

function renderEmailActivity(emails) {
  const container = document.getElementById('email-list');
  container.innerHTML = emails.map(email => `
    <div class="email-card ${email.email_type}">
      <div class="email-header">
        <span class="email-type-badge ${email.email_type}">
          ${email.email_type.replace('_', ' ').toUpperCase()}
        </span>
        <span class="sentiment-badge ${email.sentiment}">
          ${email.sentiment}
        </span>
      </div>
      <h3>${email.jobs.company_name} - ${email.jobs.job_title}</h3>
      <p class="email-subject">${email.subject}</p>
      <p class="ai-summary">${email.ai_summary}</p>
      <div class="email-meta">
        <span>From: ${email.from_email}</span>
        <span>Received: ${new Date(email.received_at).toLocaleDateString()}</span>
      </div>
      ${email.ai_action_items && email.ai_action_items.length > 0 ? `
        <div class="action-items">
          <strong>Action Items:</strong>
          <ul>
            ${email.ai_action_items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadEmailActivity);
```

### Add CSS Styling

```css
.email-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: white;
}

.email-card.interview_request {
  border-left: 4px solid #4CAF50;
}

.email-card.rejection {
  border-left: 4px solid #f44336;
}

.email-type-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  margin-right: 8px;
}

.email-type-badge.interview_request {
  background: #4CAF50;
  color: white;
}

.email-type-badge.rejection {
  background: #f44336;
  color: white;
}

.sentiment-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.sentiment-badge.positive {
  background: #E8F5E9;
  color: #2E7D32;
}

.sentiment-badge.negative {
  background: #FFEBEE;
  color: #C62828;
}

.ai-summary {
  font-style: italic;
  color: #666;
  margin: 8px 0;
}

.action-items {
  background: #FFF9C4;
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.action-items ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}
```

---

## 🔔 Step 7: Notification Setup (10 minutes)

### Email Notifications

The workflow sends you emails for:
1. **Interview requests** (immediate notification)
2. **Weekly reports** (every Monday at 8 AM)

**Customize notification email:**

Node: "Notify: Interview Request"

Current template:
```html
<h2>📧 Interview Request Detected!</h2>
<p><strong>Company:</strong> {{ company }}</p>
<p><strong>Position:</strong> {{ job_title }}</p>
```

Add more details if desired:
```html
<p><strong>Hiring Manager:</strong> {{ hiring_manager_name }}</p>
<p><strong>Interview Date:</strong> {{ interview_date }}</p>
<p><strong>Link:</strong> <a href="{{ job_url }}">View Job Posting</a></p>
```

### Push Notifications (Optional)

To get push notifications on your phone:

**Option 1: IFTTT Integration**
```
1. Create IFTTT account
2. Create applet:
   - IF: Receive webhook from n8n
   - THEN: Send phone notification
3. Add HTTP Request node to workflow
4. Send to IFTTT webhook when interview detected
```

**Option 2: Slack Integration**
```
1. Add Slack node to workflow
2. Send message to your personal Slack
3. Enable mobile notifications in Slack app
```

---

## 📈 Step 8: Monitoring & Optimization (Ongoing)

### Daily Checks (First Week)

```sql
-- Check follow-ups sent
SELECT 
  COUNT(*) as followups_sent,
  follow_up_type
FROM follow_up_schedule
WHERE sent_at >= CURRENT_DATE
GROUP BY follow_up_type;

-- Check emails processed
SELECT 
  COUNT(*) as emails_processed,
  email_type,
  DATE(created_at) as date
FROM email_communications
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY email_type, DATE(created_at)
ORDER BY date DESC;

-- Check status updates triggered
SELECT 
  pipeline_stage,
  COUNT(*) as count
FROM jobs
WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY pipeline_stage;
```

### Weekly Review

**Review n8n execution history:**
```
1. Go to n8n → Executions
2. Filter: "Application Tracker"
3. Check for:
   - Failed executions (investigate errors)
   - Execution time (should be <5 minutes)
   - Data processed (# of follow-ups, emails scanned)
```

**Review AI classification accuracy:**
```sql
-- Check classification confidence
SELECT 
  AVG(ai_classification_confidence) as avg_confidence,
  email_type,
  COUNT(*) as count
FROM email_communications
GROUP BY email_type
ORDER BY avg_confidence;

-- Find low-confidence classifications (may need manual review)
SELECT 
  id,
  subject,
  email_type,
  ai_classification_confidence,
  ai_summary
FROM email_communications
WHERE ai_classification_confidence < 0.75
ORDER BY created_at DESC;
```

### Monthly Optimization

**Adjust follow-up timing:**
```
If you're getting too many/few responses:
- Increase delays: 7 → 10 days, 14 → 21 days
- Decrease delays: 7 → 5 days, 14 → 10 days

Update in workflow or database:
UPDATE follow_up_schedule
SET scheduled_for = submitted_at + INTERVAL '10 days'
WHERE follow_up_type = '7_day' AND status = 'pending';
```

**Improve email templates:**
```
Track which follow-up emails get responses:
1. Note successful subject lines
2. Identify effective CTAs
3. Update Claude prompts to replicate success
```

---

## 🐛 Troubleshooting

### Problem: Follow-up emails not sending

**Check:**
```sql
-- Are there jobs needing follow-up?
SELECT * FROM applications_needing_followup;

-- Did workflow execute?
-- (Check n8n execution history)

-- Are Gmail credentials valid?
-- (Test by sending a test email manually in n8n)
```

**Solution:**
```
1. Verify Gmail OAuth token hasn't expired
2. Check n8n execution logs for errors
3. Verify jobs have submitted_at timestamp
4. Confirm hiring_manager_email is not NULL
```

---

### Problem: Emails not being classified correctly

**Check:**
```sql
-- Review recent classifications
SELECT 
  subject,
  email_type,
  ai_classification_confidence,
  ai_summary
FROM email_communications
ORDER BY created_at DESC LIMIT 10;
```

**Solution:**
```
1. Update classification prompt to be more specific
2. Add training examples to prompt
3. Increase max_tokens if responses are truncated
4. Consider using Claude Opus for higher accuracy
```

---

### Problem: Job status not updating automatically

**Check:**
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_update_job_status';

-- Test trigger manually
INSERT INTO email_communications (
  job_id, 
  direction, 
  contains_interview_request
) VALUES (
  'some-job-id',
  'inbound',
  true
);

-- Check if job updated
SELECT pipeline_stage FROM jobs WHERE id = 'some-job-id';
```

**Solution:**
```
1. Re-run schema setup (may have missed trigger creation)
2. Verify foreign key constraints are valid
3. Check Supabase logs for trigger errors
```

---

### Problem: Weekly reports not generating

**Check:**
```
1. Verify workflow is active
2. Check schedule trigger settings (should be "0 8 * * *")
3. Look for execution errors on Mondays at 8 AM
```

**Solution:**
```
1. Test "Generate Weekly Stats" node manually
2. Verify SQL query returns data
3. Check Anthropic API key is valid
4. Confirm email send node has correct credentials
```

---

## 💰 Cost Analysis

### API Usage Breakdown

**Per follow-up email:**
- Claude API call: ~500 tokens = $0.01

**Per email classification:**
- Claude API call: ~300 tokens = $0.008

**Per weekly report:**
- Claude API call: ~800 tokens = $0.02

**Monthly cost estimate:**
```
Follow-ups:
  - 50 applications/week × 3 follow-ups each = 150 emails/month
  - 150 × $0.01 = $1.50/month

Email classification:
  - Assume 30 responses/month
  - 30 × $0.008 = $0.24/month

Weekly reports:
  - 4 reports/month
  - 4 × $0.02 = $0.08/month

TOTAL: ~$1.82/month
```

**Combined with other workflows:**
- Job Discovery: $14/week = $56/month
- Application Engine: $3/week = $12/month
- Application Tracker: ~$2/month
- **Total system: ~$70/month**

Still way cheaper than:
- Sonara ($79/month) + Job Copilot ($75/month) = $154/month

**Your savings: $84/month or $1,008/year!** 💰

---

## ✅ Setup Completion Checklist

Before going live:

- [ ] Database schema updated (all tables and triggers)
- [ ] Gmail OAuth configured and tested
- [ ] n8n workflow imported
- [ ] All credentials configured
- [ ] Anthropic API key set in environment variables
- [ ] Follow-up email test successful
- [ ] Email classification test successful
- [ ] Weekly report test successful
- [ ] Dashboard updated with email activity section
- [ ] Workflow activated and scheduled
- [ ] First 24-hour monitoring period completed

**When all boxes are checked, you're ready for full automation!** ✅

---

## 🎯 Expected Daily Flow (After Setup)

**8:00 AM - Workflow Runs Automatically:**
```
1. Scans for jobs needing follow-up (7, 14, 21 days old)
2. Generates custom follow-up emails for each
3. Sends follow-ups via Gmail
4. Updates database with send timestamp
5. Scans Gmail inbox for new responses
6. Uses AI to classify each response
7. Auto-updates job status (Interview, Rejected, etc.)
8. Sends you instant notification if interview request
9. Generates weekly report (Mondays only)
```

**Your action required:**
- Review interview request notifications (~5 min)
- Read weekly report Monday morning (~5 min)
- **Total time: 10 minutes/week!**

**Compare to manual process:**
- Tracking follow-up dates: 30 min/week
- Writing follow-up emails: 60 min/week
- Checking inbox for responses: 30 min/week
- Updating spreadsheet: 30 min/week
- **Manual total: 150 min/week**

**Time savings: 140 minutes/week = 2.3 hours/week!** ⏰

---

**Setup complete! Your Application Tracker is ready to manage all post-application activities automatically.** 🚀
