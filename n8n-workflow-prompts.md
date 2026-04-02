# n8n MCP Workflow Prompts for Eric's Job Search Automation

## Setup Context for Claude Desktop MCP
```
I'm Eric Kazee, an AI Adoption Specialist with 12+ years in legal technology. I need you to build 5 n8n workflows using the n8n MCP to automate my job search. My goal is 325-400 applications in 30 days.

My profile:
- Target roles: AI Adoption Specialist, Legal Technology Manager, Instructional Designer, Program Manager, Implementation Specialist
- Requirements: Remote only, $100k+, AI + Legal technology combination preferred
- Supabase URL: https://snmdcbrvvzasubdnnsbd.supabase.co
- User ID: 542413a9-b564-423c-96c9-99d51cc01107

Build these workflows one by one, validate each, and deploy to my n8n instance.
```

## Workflow 1: Intelligent Job Discovery
```
Create an n8n workflow called "Job Discovery Engine" that:

1. TRIGGERS: Every 4 hours during business hours (9 AM - 6 PM)

2. JOB SOURCES:
   - Indeed RSS: "AI adoption specialist" + remote
   - LinkedIn Jobs API: "legal technology manager" + remote + $100k+
   - RemoteOK RSS: "implementation specialist"
   - AngelList API: "AI legal" + remote
   - Glassdoor API: "instructional designer" + "technology"

3. DATA PROCESSING:
   - Deduplicate by URL and company+role combination
   - Extract: company, role, location, salary_range, description, application_url
   - Skip jobs older than 48 hours
   - Skip jobs with salary under $80k (when listed)

4. AI SCORING (Use claude-haiku-4-5-20251001 — or google/gemini-flash-1.5 via OpenRouter):
   System prompt: "Score this job 1-10 for Eric Kazee: AI Adoption Specialist, 12+ years legal tech (iManage, NetDocuments), seeks remote AI+legal roles $100k+. Perfect=10, Poor=1"
   Note: Use the cheapest capable model here — scoring is a simple task; Haiku costs ~12x less than Sonnet.

5. SUPABASE INTEGRATION:
   - Save ALL jobs to job_raw table (staging)
   - Save jobs scoring 7+ to job_applications table
   - Update job_applications.ai_match_score
   - Set status = "To Review" for high-scoring jobs

6. ERROR HANDLING:
   - Retry API failures 3x with exponential backoff
   - Log errors to job_raw.error_message
   - Continue processing other sources if one fails

7. NOTIFICATIONS:
   - Send email digest if 3+ jobs scoring 8+ found
   - Include job titles, companies, scores

Build this workflow with proper validation, deploy to n8n, and test with a single execution.
```

## Workflow 2: Smart Application Generator
```
Create an n8n workflow called "Smart Application Engine" that:

1. TRIGGERS: When job_applications.status changes to "Ready to Apply"

2. JOB ANALYSIS:
   - Read job description from Supabase
   - Extract key requirements, skills, company info
   - Research company (LinkedIn, website, recent news)

3. RESUME CUSTOMIZATION (Use claude-sonnet-4-6 via Anthropic direct — enables prompt caching):
   - Read my master resume from Supabase resume_versions table
   - Emphasize relevant experience for this specific job
   - Highlight AI + legal technology expertise
   - Keep format professional, ATS-friendly
   - Max 2 pages
   - Cache the master resume + system prompt as a prefix block to cut token costs ~80%

4. COVER LETTER GENERATION (Use claude-sonnet-4-6):
   - Write personalized 200-250 word cover letter
   - Reference specific job requirements
   - Mention company research insights
   - Include my unique AI + legal background
   - Professional, enthusiastic tone

5. APPLICATION PACKAGE:
   - Save customized resume to resume_versions (job_id linked)
   - Save cover letter to application_materials table
   - Generate application email draft
   - Update job_applications.status = "Application Ready"

6. HUMAN APPROVAL STEP:
   - Send notification: "Application ready for review: [Company] - [Role]"
   - Include links to review materials
   - Pause workflow for approval

7. AUTO-SUBMIT (After approval):
   - Submit via company's careers API (when available)
   - Or send via Gmail API with attachments
   - Update job_applications.status = "Applied"
   - Set application_date = now()

Build with proper error handling and approval gates.
```

## Workflow 3: Application Tracking & Follow-up
```
Create an n8n workflow called "Application Tracker" that:

1. TRIGGERS: Daily at 8 AM

2. APPLICATION MONITORING:
   - Check job_applications where status = "Applied"
   - Calculate days since application_date
   - Monitor for email responses (Gmail API)

3. AUTOMATED FOLLOW-UPS:
   - Day 7: Polite follow-up email
   - Day 14: Check application status
   - Day 21: Final follow-up
   - Day 30: Mark as "No Response"

4. RESPONSE PROCESSING:
   - Scan Gmail for job-related emails
   - Classify: Interview Request, Rejection, Request for Info, Other
   - Update job_applications.status accordingly
   - Extract interview details if found

5. INTERVIEW PREPARATION:
   - Research company deeper (recent news, key people)
   - Prepare company-specific talking points
   - Generate practice questions based on job description
   - Save to interview_prep table

6. STATUS REPORTING:
   - Weekly summary email: Applied, Interviews, Responses
   - Success rate metrics
   - Recommendations for improvement

Build with email integration and smart classification.
```

## Workflow 4: Network Intelligence Engine
```
Create an n8n workflow called "Network Intelligence" that:

1. TRIGGERS: When high-scoring job (8+) is found

2. COMPANY RESEARCH:
   - LinkedIn company page analysis
   - Find employees in similar roles
   - Identify hiring managers, VPs, legal tech teams
   - Extract contact information (email patterns)

3. CONNECTION STRATEGY:
   - Find mutual LinkedIn connections
   - Identify warm introduction paths
   - Check for alumni connections (schools, companies)

4. OUTREACH PREPARATION:
   - Generate personalized LinkedIn messages
   - Create email templates for cold outreach
   - Schedule follow-up reminders

5. SUPABASE INTEGRATION:
   - Save contacts to networking_contacts table
   - Link to job_applications.id
   - Track outreach attempts and responses

6. AUTOMATION:
   - Send LinkedIn connection requests (with personalization)
   - Schedule follow-up messages
   - Track response rates

Build with LinkedIn API integration and personalization.
```

## Workflow 5: Market Intelligence Dashboard
```
Create an n8n workflow called "Market Intelligence" that:

1. TRIGGERS: Weekly on Monday 9 AM

2. JOB MARKET ANALYSIS:
   - Analyze job_applications data for trends
   - Track which sources produce best matches
   - Monitor salary ranges by role type
   - Identify growing vs declining job categories

3. COMPETITION ANALYSIS:
   - Monitor similar job postings
   - Track how quickly jobs get filled
   - Identify most in-demand skills

4. PERFORMANCE METRICS:
   - Application-to-response rate
   - Interview conversion rate
   - Source effectiveness
   - AI scoring accuracy

5. OPTIMIZATION RECOMMENDATIONS:
   - Suggest resume improvements
   - Recommend skill development priorities
   - Identify high-opportunity companies

6. REPORTING:
   - Generate weekly dashboard
   - Email summary with key insights
   - Update strategy recommendations

Build with analytics and visualization components.
```

## Quick Start Instructions

## Model Strategy Summary

| Task | Model | Why |
|------|-------|-----|
| Job scoring (1-10) | `claude-haiku-4-5-20251001` | Simple task; ~12x cheaper than Sonnet |
| Resume customization | `claude-sonnet-4-6` (Anthropic direct) | Quality matters; use prompt caching on templates |
| Cover letter generation | `claude-sonnet-4-6` (Anthropic direct) | Same as above |
| Email classification | `claude-haiku-4-5-20251001` or OpenRouter cheap model | Simple text classification |

**OpenRouter alternative**: Use `anthropic/claude-sonnet-4-6` and `anthropic/claude-haiku-4-5` via OpenRouter for a single API key and access to Gemini/Llama alternatives for scoring. Tradeoff: prompt caching is not available through OpenRouter, so generation costs will be higher.

**When to go direct Anthropic**: When running high volume (100+ applications). Prompt caching on the ~3,500-token template prefix saves ~$0.028 per call vs. uncached.

---

## Quick Start Instructions

1. **Install n8n MCP** (if not already done):
   ```bash
   docker pull n8nio/n8n-mcp
   ```

2. **Configure Claude Desktop** with the MCP config above

3. **Start with Workflow 1**: Copy the "Job Discovery Engine" prompt to Claude Desktop with n8n MCP enabled

4. **Test thoroughly**: Run manual execution, verify Supabase integration

5. **Deploy remaining workflows**: One by one, test each before moving to next

6. **Go live**: Activate all workflows and start the automation

## Success Metrics
- 50-100 job applications per week
- 15%+ response rate
- 5+ interviews scheduled monthly
- Time saved: 30+ hours per week
- Goal: 325-400 applications in 30 days

Ready to build your automated job search machine?