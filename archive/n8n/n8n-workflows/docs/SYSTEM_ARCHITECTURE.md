# Smart Application Engine - System Architecture & Workflow

## 📊 Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DISCOVERY LAYER                                     │
│  ┌──────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ LinkedIn │  │ Indeed  │  │ We Work   │  │AI Jobs  │  │ Company      │  │
│  │          │  │         │  │ Remotely  │  │         │  │ Career Pages │  │
│  └────┬─────┘  └────┬────┘  └─────┬─────┘  └────┬────┘  └──────┬───────┘  │
│       │             │              │             │              │           │
│       └─────────────┴──────────────┴─────────────┴──────────────┘           │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │    MANUAL JOB SCREENING        │
                    │  (Your Daily 30-min Review)    │
                    │                                │
                    │  1. Scan 50-100 job postings   │
                    │  2. Quick relevance check      │
                    │  3. Mark promising jobs        │
                    └────────┬───────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE DATABASE                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  JOBS TABLE                                                           │  │
│  │  ┌────────┬───────────┬──────────────┬──────────┬─────────────────┐ │  │
│  │  │ job_id │ company   │ job_title    │ pipeline │ ai_match_score  │ │  │
│  │  ├────────┼───────────┼──────────────┼──────────┼─────────────────┤ │  │
│  │  │ uuid1  │ LexisNexis│ AI Training  │ To Review│      NULL       │ │  │
│  │  │ uuid2  │ Clio      │ AI Adoption  │ Ready to │      88         │ │  │
│  │  │        │           │ Specialist   │ Apply    │                 │ │  │
│  │  └────────┴───────────┴──────────────┴──────────┴─────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Jobs marked "Ready to Apply" trigger automation                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           N8N WORKFLOW ENGINE                                │
│                    (Runs every 15 minutes, cloud-hosted)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  STEP 1: Query Supabase                                                │ │
│  │  SELECT * FROM jobs WHERE pipeline_stage = 'Ready to Apply'           │ │
│  │  LIMIT 5 (process in batches)                                         │ │
│  └────────┬───────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  STEP 2: Fetch Templates from GitHub                                  │ │
│  │  - master_resume_template.md                                          │ │
│  │  - master_cover_letter_template.md                                    │ │
│  └────────┬───────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  STEP 3: Call Anthropic Claude API                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Request:                                                         │ │ │
│  │  │  {                                                                │ │ │
│  │  │    "model": "claude-sonnet-4-6",                                 │ │ │
│  │  │    "max_tokens": 4000,                                           │ │ │
│  │  │    "messages": [{                                                │ │ │
│  │  │      "role": "user",                                             │ │ │
│  │  │      "content": "JOB DESCRIPTION + TEMPLATES + INSTRUCTIONS"    │ │ │
│  │  │    }]                                                            │ │ │
│  │  │  }                                                               │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Response (JSON):                                                │ │ │
│  │  │  {                                                               │ │ │
│  │  │    "resume": "Customized resume markdown...",                   │ │ │
│  │  │    "cover_letter": "Customized cover letter...",               │ │ │
│  │  │    "match_score": 88,                                          │ │ │
│  │  │    "key_requirements_matched": [...],                          │ │ │
│  │  │    "customization_notes": "Emphasized iManage experience..."   │ │ │
│  │  │  }                                                              │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────┬───────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  STEP 4: Save to Supabase                                             │ │
│  │  INSERT INTO application_materials (...)                              │ │
│  │  UPDATE jobs SET pipeline_stage = 'Materials Ready'                  │ │
│  └────────┬───────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  STEP 5: Send Email Notification                                      │ │
│  │  To: ekazee@outlook.com                                               │ │
│  │  Subject: ✅ Materials Ready: AI Adoption Specialist at Clio         │ │
│  │  Body: Match Score: 88% | Review in Dashboard →                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EMAIL NOTIFICATION RECEIVED                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  📧 From: n8n Automation <ekazee.careers@gmail.com>                  │  │
│  │  📬 To: Eric Kazee <ekazee@outlook.com>                              │  │
│  │                                                                        │  │
│  │  Subject: ✅ Application Materials Ready                              │  │
│  │           AI Adoption Specialist at Clio                             │  │
│  │                                                                        │  │
│  │  New customized materials generated:                                 │  │
│  │  • Match Score: 88%                                                  │  │
│  │  • Key Requirements: iManage, NetDocuments, AI training             │  │
│  │  • Customization: Emphasized DMS experience, legal compliance       │  │
│  │                                                                        │  │
│  │  [Review & Approve in Dashboard →]                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES DASHBOARD                                    │
│                   (ekazee01-lgtm.github.io/jobsearch)                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  📝 MATERIALS PENDING REVIEW (5)                                       │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  AI Adoption Specialist at Clio                     Score: 88%   │ │ │
│  │  │  ─────────────────────────────────────────────────────────────   │ │ │
│  │  │  [View Resume ▼]  [View Cover Letter ▼]                         │ │ │
│  │  │                                                                  │ │ │
│  │  │  AI Notes: Emphasized iManage/NetDocuments hands-on experience. │ │ │
│  │  │  Cover letter references Clio's legal practice management focus.│ │ │
│  │  │                                                                  │ │ │
│  │  │  ✅ Approve & Apply  │  ✏️ Request Changes  │  ❌ Skip Job     │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Training Manager at LexisNexis                 Score: 92%       │ │ │
│  │  │  [... similar card ...]                                          │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
         ┌─────────┐       ┌──────────┐      ┌──────────┐
         │ Approve │       │ Revise   │      │ Reject   │
         └────┬────┘       └─────┬────┘      └─────┬────┘
              │                  │                  │
              ▼                  ▼                  ▼
    ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
    │ approval_status  │  │ approval_    │  │ approval_    │
    │ = 'approved'     │  │ status =     │  │ status =     │
    │                  │  │ 'needs_      │  │ 'rejected'   │
    │ Move to          │  │ revision'    │  │              │
    │ submission       │  │              │  │ Update job   │
    │ queue            │  │ Regenerate   │  │ pipeline to  │
    │                  │  │ with notes   │  │ 'Skipped'    │
    └────┬─────────────┘  └──────────────┘  └──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUBMISSION LAYER (Future)                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  OPTION A: Simplify.jobs Integration                                  │ │
│  │  - Auto-fill application forms                                        │ │
│  │  - Submit with one click                                              │ │
│  │  - Track submission status                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  OPTION B: API-Based Submission (where available)                     │ │
│  │  - Direct API calls to company ATSs                                   │ │
│  │  - Greenhouse, Lever, Workday integrations                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  OPTION C: Manual Submission (current)                                │ │
│  │  - You copy-paste materials from dashboard                            │ │
│  │  - Fill out company application forms                                 │ │
│  │  - Mark as submitted in database                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRACKING & ANALYTICS                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Weekly Stats (Auto-generated)                                        │ │
│  │  ───────────────────────────────────────────────────────────────────  │ │
│  │  Applications Submitted:  67                                          │ │
│  │  Response Rate:           4.5% (3 interview requests)                 │ │
│  │  Avg Match Score:         82                                          │ │
│  │  Top Performing Platform: LinkedIn (45% of responses)                 │ │
│  │  API Cost This Week:      $2.15                                       │ │
│  │  Time Spent Reviewing:    1.5 hours                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Funnel Visualization                                                 │ │
│  │                                                                        │ │
│  │  Jobs Discovered:    450 ███████████████████████████████████████      │ │
│  │  Ready to Apply:     125 ████████████████                             │ │
│  │  Materials Generated: 98 ████████████                                 │ │
│  │  Approved:            78 ██████████                                   │ │
│  │  Submitted:           67 ████████                                     │ │
│  │  Interviews:           3 █                                            │ │
│  │  Offers:               0                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Sequence

**Detailed Step-by-Step:**

### Phase 1: Discovery (Manual, 30 min/day)
```
You → Browse LinkedIn/Indeed/etc
You → Save promising jobs to Supabase
You → Mark AI match score (optional, can automate later)
You → Set pipeline_stage = "Ready to Apply"
```

### Phase 2: Automation (n8n, runs every 15 min)
```
n8n → Query: Get jobs WHERE pipeline_stage = 'Ready to Apply'
n8n → Fetch: master_resume_template.md from GitHub
n8n → Fetch: master_cover_letter_template.md from GitHub
n8n → Prepare prompt with job description + templates
n8n → Call Anthropic API (Claude Sonnet 4)
Claude → Analyze job requirements
Claude → Match to candidate experience
Claude → Customize resume (keyword optimization)
Claude → Generate tailored cover letter
Claude → Calculate match score
Claude → Return JSON with all materials
n8n → Parse Claude's response
n8n → INSERT INTO application_materials
n8n → UPDATE jobs SET pipeline_stage = 'Materials Ready'
n8n → Send email notification to you
```

### Phase 3: Review (Manual, 1-5 min per job)
```
You → Receive email notification
You → Open dashboard
You → Expand material card
You → Read resume/cover letter
You → Check customization notes
You → Decide: Approve / Revise / Reject
```

**If Approve:**
```
Dashboard → UPDATE application_materials SET approval_status = 'approved'
Dashboard → Move to submission queue
(Future) → Auto-submit via Simplify API
You → Mark as submitted when complete
```

**If Revise:**
```
Dashboard → UPDATE WITH revision notes
n8n → Detect revision request
n8n → Call Claude API again with feedback
Claude → Regenerate materials with improvements
n8n → Save new version
n8n → Notify you to re-review
```

**If Reject:**
```
Dashboard → UPDATE jobs SET pipeline_stage = 'Skipped'
Dashboard → Record rejection reason (optional)
Dashboard → Remove from pending queue
```

### Phase 4: Submission (Manual or Automated)
```
You → Copy resume from dashboard
You → Copy cover letter from dashboard
You → Fill out company application form (or use Simplify)
You → Submit application
You → Mark in database: submitted_at = NOW()
You → Pipeline_stage = 'Applied'
```

### Phase 5: Follow-Up (Future Automation)
```
After 7 days with no response:
n8n → Send follow-up email to hiring manager
n8n → LinkedIn connection request to recruiter
n8n → Add to "Need Follow-up" list

If rejection received:
n8n → Send thank-you note
n8n → Request feedback
n8n → Update pipeline_stage = 'Rejected'

If interview requested:
n8n → Move to 'Interview' stage
n8n → Send prep materials
n8n → Schedule reminder 1 day before
```

---

## 💾 Database Schema (Detailed)

### jobs Table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_description TEXT,
  url TEXT,
  source TEXT, -- 'linkedin', 'indeed', 'wwr', etc.
  location TEXT,
  salary_range TEXT,
  pipeline_stage TEXT DEFAULT 'To Review',
    -- Stages: To Review → Ready to Apply → Materials Ready → 
    --         Applied → Interview → Offer → Rejected → Skipped
  ai_match_score INTEGER,
  resume_version TEXT DEFAULT 'master',
  application_materials_approved BOOLEAN DEFAULT false,
  approval_notes TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(),
  applied_at TIMESTAMP,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### application_materials Table
```sql
CREATE TABLE application_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_content TEXT NOT NULL,
  cover_letter_content TEXT NOT NULL,
  customization_notes TEXT,
  match_score INTEGER,
  key_requirements_matched TEXT[],
  recommended_approach TEXT,
  approval_status TEXT DEFAULT 'pending',
    -- Values: pending, approved, rejected, needs_revision
  approval_notes TEXT, -- User's feedback for revisions
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  submitted_at TIMESTAMP,
  version INTEGER DEFAULT 1 -- Track revisions
);
```

### analytics View (for dashboard)
```sql
CREATE OR REPLACE VIEW weekly_analytics AS
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as jobs_discovered,
  COUNT(CASE WHEN pipeline_stage = 'Applied' THEN 1 END) as applications_submitted,
  COUNT(CASE WHEN pipeline_stage = 'Interview' THEN 1 END) as interviews_scheduled,
  COUNT(CASE WHEN pipeline_stage = 'Offer' THEN 1 END) as offers_received,
  AVG(ai_match_score) as avg_match_score,
  AVG(EXTRACT(EPOCH FROM (applied_at - created_at)) / 3600) as avg_hours_to_apply
FROM jobs
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;
```

---

## 🔐 Security & Privacy Considerations

**Sensitive Data:**
- API keys stored in environment variables (never in code)
- Supabase uses RLS (Row Level Security) policies
- GitHub repo for templates is private
- Email notifications sent via encrypted SMTP

**Data Retention:**
- Job descriptions: Keep for 90 days, then archive
- Application materials: Keep indefinitely (for reference)
- API logs: Retained by Anthropic for 30 days

**Compliance:**
- No PII shared with Anthropic API (job descriptions only)
- Resume/cover letter are your own data
- GDPR compliant (right to delete, export)

---

## 🤖 Model Strategy (Tiered for Cost + Quality)

Different tasks need different models. Don't use Sonnet where Haiku will do.

| Task | Model | Approx Cost/Call |
|------|-------|-----------------|
| Resume + cover letter generation | `claude-sonnet-4-6` (Anthropic direct) | ~$0.008–0.032 |
| Job scoring (1-10) | `claude-haiku-4-5-20251001` | ~$0.0002 |
| Email classification | `claude-haiku-4-5-20251001` | ~$0.0001 |
| Follow-up drafts | `claude-haiku-4-5-20251001` | ~$0.0002 |

**OpenRouter alternative**: Route scoring/classification calls to `google/gemini-flash-1.5` or `meta-llama/llama-3.1-8b-instruct` for even lower cost. Use env var `AI_SCORING_MODEL` to switch without code changes. Tradeoff: prompt caching is not available via OpenRouter.

**Check current pricing** before committing to a model — the landscape changes rapidly. Verify at:
- Anthropic: https://www.anthropic.com/pricing
- OpenRouter: https://openrouter.ai/models

---

## 📊 Cost Breakdown (Detailed)

**Per Application — Generation (Sonnet 4.6, with prompt caching):**

Prompt caching caches the static portion of your request (system prompt + master resume template, ~3,500 tokens). On repeat calls only the job description is billed at full rate.

- Cached input (~3,500 tokens): 3,500 * $0.30/1M = $0.00105
- Uncached input (~500 tokens job description): 500 * $3/1M = $0.0015
- Output (~2,000 tokens resume + cover letter + JSON): 2,000 * $15/1M = $0.03
- **Total per application with caching: ~$0.033**

Without caching (e.g., via OpenRouter): ~$0.0435 — roughly 30% more expensive.

**Per Job Scored — Haiku 4.5:**
- Input (~500 tokens): 500 * $0.25/1M = $0.000125
- Output (~50 tokens): 50 * $1.25/1M = $0.0000625
- **Total per scoring call: ~$0.0002** (vs ~$0.005 using Sonnet)

**Monthly at Different Volumes (generation + scoring combined):**
- 50 applications: ~$1.70
- 100 applications: ~$3.40
- 200 applications: ~$6.80
- 400 applications: ~$13.60

**Free Tier Usage:**
- n8n: 5,000 executions/month (you'll use ~300-400)
- Supabase: 500MB storage, 2GB bandwidth (plenty)
- GitHub: Unlimited public/private repos
- Gmail SMTP: Unlimited (with app password)

**Paid Components: Anthropic API (primary), OpenRouter (optional for scoring)**

---

## 💡 Prompt Caching Setup (Anthropic Direct)

To enable caching on the static prefix (system prompt + resume template), set `cache_control` on the last static message block before the dynamic job description:

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 4000,
  "system": [
    {
      "type": "text",
      "text": "<system prompt here>",
      "cache_control": {"type": "ephemeral"}
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<master resume template here>",
          "cache_control": {"type": "ephemeral"}
        },
        {
          "type": "text",
          "text": "<job description — dynamic, not cached>"
        }
      ]
    }
  ]
}
```

The n8n HTTP node passes this as the request body. Cache hits are confirmed in the response's `usage.cache_read_input_tokens` field.

---

This architecture gives you industrial-scale application processing while maintaining quality control and keeping costs under $15/month at 400 applications.
