# 🤖 n8n Job Search Automation Guide

Complete automation setup for Eric Kazee's AI-Powered Job Search Platform using n8n workflow automation.

---

## 🎯 Overview

This guide implements a fully automated job search pipeline that:
- **Discovers** jobs from LinkedIn, Indeed, and other platforms
- **Filters** opportunities using AI scoring (OpenAI GPT-4)
- **Tailors** resumes and cover letters automatically
- **Submits** applications via LinkedIn Easy Apply or email
- **Monitors** status and sends intelligent alerts
- **Schedules** interview prep and calendar events
- **Requires human approval** at key decision points

---

## 📋 Automation Workflow Overview

### 1. **Job Discovery & Filtering** (`job-discovery-workflow.json`)
- **Trigger**: Runs daily at scheduled time
- **Sources**: LinkedIn, Indeed, AngelList, company sites
- **AI Scoring**: OpenAI GPT-4 rates jobs 1-10 for relevance
- **Auto-Save**: High-scoring jobs (7+) saved to Supabase
- **Notification**: Email alert with new opportunities

### 2. **Application Submission** (`application-submission-workflow.json`)
- **Trigger**: When job status changed to "Ready to Apply"
- **AI Generation**: Tailored resume + cover letter for each job
- **Multi-Channel**: LinkedIn Easy Apply or email submission
- **Tracking**: Updates database with application status
- **Audit Trail**: Complete logging of all actions

### 3. **Status Monitoring** (`status-monitoring-workflow.json`)
- **Schedule**: Checks applications twice daily
- **Deadline Alerts**: 7-day warning for approaching deadlines
- **Follow-up Reminders**: 14-day nudges for pending applications
- **Interview Management**: Automatic calendar scheduling
- **Smart Notifications**: Context-aware email alerts

### 4. **Human Approval Gates** (`human-approval-workflow.json`)
- **Job Review**: Email notifications for new high-scoring jobs
- **Resume Approval**: Review AI-generated documents before submission
- **Interview Prep**: Automated preparation scheduling and checklists
- **Timeout Protection**: Auto-reject jobs after 48 hours if no decision

---

## 🛠️ Setup Requirements

### Required Services & API Keys

#### 1. **n8n Instance**
```bash
# Option 1: n8n Cloud (Recommended)
# Sign up at: https://app.n8n.cloud

# Option 2: Self-Hosted Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

#### 2. **API Keys & Credentials**
```env
# OpenAI (Required for AI features)
OPENAI_API_KEY=sk-your-openai-api-key

# RapidAPI (For job scraping)
RAPIDAPI_KEY=your-rapidapi-key

# Supabase (Database integration)
SUPABASE_URL=https://snmdcbrvvzasubdnnsbd.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_USER_ID=your-user-uuid

# Email (SMTP for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Google Calendar (Interview scheduling)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token

# Master Resume (For AI tailoring)
MASTER_RESUME=your-complete-resume-text
```

#### 3. **Service Subscriptions**
- **OpenAI API**: $20/month for GPT-4 usage
- **RapidAPI**: $10-50/month for job scraping
- **n8n Cloud**: $20/month (or self-host for free)
- **Supabase**: Free tier sufficient
- **Google Workspace**: Free Gmail account works

---

## 📥 Installation Steps

### 1. **Import Workflows to n8n**

```bash
# Clone the repository
git clone https://github.com/ekazee01-lgtm/jobsearch.git
cd jobsearch/n8n-workflows

# Import each workflow file:
# 1. Go to n8n dashboard
# 2. Click "Import from file"
# 3. Upload each JSON file:
#    - job-discovery-workflow.json
#    - application-submission-workflow.json
#    - status-monitoring-workflow.json
#    - human-approval-workflow.json
```

### 2. **Configure Environment Variables**

In n8n Settings → Environments:
```javascript
// Set all required environment variables
OPENAI_API_KEY: "sk-your-key-here"
RAPIDAPI_KEY: "your-rapidapi-key"
SUPABASE_URL: "https://snmdcbrvvzasubdnnsbd.supabase.co"
SUPABASE_ANON_KEY: "your-supabase-anon-key"
SUPABASE_USER_ID: "your-user-uuid"
// ... (all other keys from requirements section)
```

### 3. **Set Up Authentication**

#### Supabase Connection
```javascript
// In Supabase nodes, configure:
Host: snmdcbrvvzasubdnnsbd.supabase.co
API Key: [Your Supabase Anon Key]
Database Schema: public
```

#### OpenAI Connection
```javascript
// In OpenAI nodes, configure:
API Key: [Your OpenAI API Key]
Model: gpt-4
Max Tokens: 2000
```

#### Google Calendar Connection
```javascript
// Follow OAuth2 setup in n8n
Client ID: [Your Google Client ID]
Client Secret: [Your Google Client Secret]
Scope: https://www.googleapis.com/auth/calendar
```

### 4. **Activate Workflows**

1. **Job Discovery**: Activate and set to run daily at 9 AM
2. **Application Submission**: Activate (triggered by status changes)
3. **Status Monitoring**: Activate and set to run every 12 hours
4. **Human Approval**: Activate (webhook-triggered)

---

## 🎮 How It Works

### Daily Automation Flow

#### 9:00 AM - Job Discovery
1. n8n triggers job scraping from LinkedIn/Indeed
2. AI scores each job for relevance (1-10)
3. High-scoring jobs (7+) automatically saved to database
4. Email sent: "📋 5 New Jobs Need Review"

#### 9:15 AM - Human Review (You)
1. Check email notification
2. Visit job tracker dashboard
3. Review jobs in "To Review" column
4. Move interesting jobs to "Ready to Apply"
5. Move others to "Rejected"

#### 9:30 AM - Automated Applications
1. For each "Ready to Apply" job:
   - AI generates tailored resume
   - AI creates personalized cover letter
   - System sends you approval email
2. You review and reply "APPROVE" or "REVISE"
3. System automatically submits application
4. Status updated to "Applied"

#### 9:00 PM - Status Check
1. System checks all active applications
2. Sends alerts for approaching deadlines
3. Reminds about follow-ups needed
4. Creates calendar events for interviews

### Human Decision Points

#### ✋ **Job Review Gate**
- **When**: After AI discovers high-scoring jobs
- **Action**: Review job descriptions and company fit
- **Options**: Approve for application, Reject, or Save for later

#### ✋ **Resume Approval Gate**
- **When**: Before application submission
- **Action**: Review AI-tailored resume and cover letter
- **Options**: Approve, Request revisions, or Cancel

#### ✋ **Interview Scheduling Gate**
- **When**: Interview invitation received
- **Action**: Confirm availability and preferences
- **Options**: Accept time, Propose alternative, or Decline

#### ✋ **Follow-up Decision Gate**
- **When**: 14 days after application
- **Action**: Decide on follow-up strategy
- **Options**: Send follow-up email, Wait longer, or Mark as closed

### Automation Benefits

#### Time Savings
- **Job Discovery**: 2 hours/day → 5 minutes/day
- **Application Writing**: 1 hour/job → 5 minutes/job
- **Status Tracking**: 30 minutes/day → Automatic
- **Interview Prep**: 2 hours → Structured 1 hour

#### Quality Improvements
- **Consistent Applications**: AI maintains quality across all submissions
- **Tailored Content**: Each resume optimized for specific job
- **Never Miss Deadlines**: Automatic deadline tracking
- **Complete Audit Trail**: Track every action and decision

#### Scale Enhancement
- **Apply to 10x More Jobs**: Automation handles volume
- **Smart Filtering**: Only review pre-qualified opportunities
- **Parallel Processing**: Multiple applications simultaneously
- **24/7 Monitoring**: Continuous status tracking

---

## 🔧 Customization Options

### Job Search Criteria
Edit the AI scoring prompt in `job-discovery-workflow.json`:
```javascript
"content": "Rate jobs 1-10 based on match to: [YOUR CRITERIA]
- Role: Software Engineer → Data Scientist
- Experience: 5+ years → 3+ years
- Salary: $120k-180k → $90k-150k
- Location: Remote → San Francisco Bay Area
- Company: Mid-size → Startups only"
```

### Application Templates
Customize AI prompts in `application-submission-workflow.json`:
```javascript
"content": "You are an expert resume writer. Tailor for:
- Industry focus: [Tech/Finance/Healthcare]
- Writing style: [Professional/Creative/Technical]
- Key achievements: [Your specific wins]
- Skills emphasis: [Technical/Leadership/Cross-functional]"
```

### Notification Preferences
Adjust timing and channels in `status-monitoring-workflow.json`:
```javascript
// Change email frequency
"interval": [{ "field": "hours", "value": 6 }] // 4x daily vs 2x

// Add Slack notifications
"webhook": "https://hooks.slack.com/your-slack-webhook"

// Change follow-up timing
"value2": 7*24*60*60*1000 // 7 days vs 14 days
```

### Human Approval Timing
Modify timeout rules in `human-approval-workflow.json`:
```javascript
// Auto-reject timeout
"value2": 172800000 // 48 hours → 24 hours (86400000)

// Interview prep advance time
"start": "={{new Date(new Date($json.interview_date).getTime() - 4*60*60*1000)}}"
// 2 hours → 4 hours before interview
```

---

## 📊 Monitoring & Analytics

### n8n Dashboard Metrics
- **Workflow Executions**: Daily/weekly/monthly runs
- **Success Rate**: % of successful executions
- **Error Tracking**: Failed nodes and reasons
- **Performance**: Execution time per workflow

### Email Reports
Configure weekly summary emails with:
- Jobs discovered and applied to
- Application response rates
- Interview conversion rates
- Time saved vs manual process

### Supabase Analytics
Query your database for insights:
```sql
-- Application success rate by source
SELECT source,
       COUNT(*) as total_applications,
       COUNT(*) FILTER (WHERE status IN ('Interview', 'Offer')) as responses
FROM job_applications
GROUP BY source;

-- AI scoring accuracy
SELECT ai_match_score,
       COUNT(*) FILTER (WHERE status = 'Applied') as applied,
       COUNT(*) FILTER (WHERE status IN ('Interview', 'Offer')) as success
FROM job_applications
GROUP BY ai_match_score
ORDER BY ai_match_score DESC;
```

---

## 🚨 Troubleshooting

### Common Issues

#### **LinkedIn Rate Limiting**
```javascript
// Add delays between requests
"options": {
  "timeout": 10000,
  "retry": { "count": 3, "delay": 5000 }
}
```

#### **OpenAI API Errors**
```javascript
// Handle rate limits and errors
"errorHandling": {
  "continue": "onError",
  "retries": 3
}
```

#### **Email Delivery Issues**
```javascript
// Use app passwords for Gmail
"password": "your-16-character-app-password"
// Enable 2FA and generate app password in Google settings
```

#### **Supabase Connection Timeout**
```javascript
// Increase timeout for large queries
"options": {
  "timeout": 30000,
  "pooling": true
}
```

### Debugging Steps

1. **Check n8n Execution Log**
   - View failed workflow executions
   - Check error messages in nodes
   - Verify API key configurations

2. **Test Individual Nodes**
   - Run single nodes in isolation
   - Verify data format and structure
   - Check API responses

3. **Monitor API Usage**
   - OpenAI: Check usage dashboard
   - RapidAPI: Monitor request quotas
   - Supabase: Review database metrics

4. **Validate Webhooks**
   - Test webhook URLs manually
   - Check webhook payload format
   - Verify authentication tokens

---

## 🔒 Security Best Practices

### API Key Management
- Store all keys in n8n environment variables
- Never hardcode keys in workflow JSON
- Rotate keys regularly (quarterly)
- Use minimum required permissions

### Database Security
- Enable Row Level Security (RLS) on all tables
- Use parameterized queries to prevent injection
- Regularly audit data access logs
- Backup database weekly

### Email Security
- Use app-specific passwords
- Enable 2FA on email accounts
- Monitor for unusual login activity
- Encrypt sensitive content

### Workflow Security
- Review imported workflows before activation
- Test in staging environment first
- Monitor execution logs for anomalies
- Implement approval gates for critical actions

---

## 📈 Performance Optimization

### Workflow Efficiency
```javascript
// Batch operations where possible
"batchSize": 50,
"parallel": true,

// Cache frequently accessed data
"cache": {
  "ttl": 3600, // 1 hour
  "key": "master_resume"
}
```

### Rate Limit Management
```javascript
// Stagger API calls
"delay": 1000, // 1 second between calls
"maxConcurrent": 5 // Max parallel requests
```

### Database Performance
```sql
-- Add indexes for common queries
CREATE INDEX idx_job_applications_user_status
ON job_applications (user_id, status);

CREATE INDEX idx_job_applications_created
ON job_applications (created_at DESC);
```

---

## 🎯 Success Metrics

Track these KPIs to measure automation success:

### Efficiency Gains
- **Time Savings**: Hours saved per week
- **Application Volume**: Jobs applied to per week
- **Response Rate**: % of applications receiving responses
- **Interview Rate**: % of applications leading to interviews

### Quality Metrics
- **AI Score Accuracy**: Correlation between AI scores and your interest
- **Application Success**: Response rate by AI-generated vs manual applications
- **Deadline Management**: % of deadlines met
- **Follow-up Effectiveness**: Response rate to automated follow-ups

### Target Benchmarks
- **10x Application Volume**: 50+ applications/month vs 5/month manual
- **90% Time Reduction**: 2 hours/week vs 20 hours/week manual
- **15%+ Response Rate**: Industry average with personalized applications
- **Zero Missed Deadlines**: Complete deadline tracking coverage

---

## 🚀 Next Steps

### Phase 1: Basic Setup (Week 1)
1. ✅ Import all 4 n8n workflows
2. ✅ Configure API keys and credentials
3. ✅ Test job discovery workflow
4. ✅ Activate human approval gates

### Phase 2: Optimization (Week 2-3)
1. Fine-tune AI scoring criteria
2. Customize application templates
3. Set up advanced monitoring
4. Optimize response rates

### Phase 3: Advanced Features (Week 4+)
1. Add company research automation
2. Implement salary negotiation templates
3. Create interview performance tracking
4. Build offer management workflow

### Future Enhancements
- **Portfolio Integration**: Auto-update portfolio with relevant projects
- **Social Media Automation**: LinkedIn connection requests and posts
- **Market Intelligence**: Salary trends and company analysis
- **Performance Analytics**: Advanced reporting and insights

---

## 💡 Pro Tips

### Maximize Success Rate
1. **Personalize AI Prompts**: Include your specific achievements and style
2. **Research-Based Applications**: Add company research to AI context
3. **A/B Testing**: Test different resume formats and cover letter styles
4. **Timing Optimization**: Apply early in posting lifecycle
5. **Follow-up Strategy**: Automated but thoughtful follow-up sequences

### Avoid Common Pitfalls
1. **Over-Automation**: Keep human touch in key interactions
2. **Generic Applications**: Ensure each application feels personalized
3. **Rate Limiting**: Respect platform limits to avoid blocks
4. **Quality Control**: Regularly review AI-generated content
5. **Compliance**: Follow platform terms of service

---

*This automation system represents a comprehensive approach to modern job searching, combining AI efficiency with human judgment for optimal results.*

**Questions or Issues?**
- Check the troubleshooting section above
- Review n8n documentation: https://docs.n8n.io
- Test individual workflow components
- Monitor execution logs for detailed error information

**Happy Job Hunting! 🎯**