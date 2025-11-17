# N8N Job Search Automation - Complete Setup Guide

## 🚀 Overview
This automation system reduces job search effort by 90% while improving application quality and response rates. Built specifically for Eric Kazee's AI Adoption Specialist job search.

## 📊 Expected Results
- **Time Savings:** 15+ hours/week → 2 hours/week
- **Application Volume:** 5-10/week → 50-100/week
- **Response Rate:** Target 10-15% (vs industry average 2-3%)
- **Cost:** ~$30-50/month total for all services

## 🔧 System Architecture

### Workflow Components
1. **Job Discovery & Aggregation** - Automated scraping from multiple sources
2. **Application Submission** - AI-powered resume/cover letter tailoring
3. **Status Monitoring** - Follow-ups, deadlines, interview scheduling
4. **Human Approval Gates** - Strategic decision points
5. **Analytics & Reporting** - Weekly metrics and insights

### Data Flow
```
Job Boards → AI Scoring → Human Review → Application → Follow-up → Analytics
     ↓            ↓            ↓            ↓           ↓          ↓
  Supabase    Supabase     Supabase    Supabase   Supabase   Reports
```

## 📋 Prerequisites

### Required Services
1. **n8n Instance** (Choose one):
   - n8n Cloud: $20/month (easiest)
   - Self-hosted: Free (requires technical setup)
   - Docker: `docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n`

2. **Supabase Database** (Free tier sufficient):
   - Sign up at https://supabase.com
   - Create new project
   - Note your URL and anon key

3. **OpenAI API** ($20-30/month):
   - Sign up at https://platform.openai.com
   - Add $50 credit to start
   - Create API key

4. **Job Scraping APIs** (Choose based on budget):
   - **RapidAPI JSearch**: $10/month for 1000 searches
   - **Apify LinkedIn Scraper**: $49/month for unlimited
   - **Free Alternative**: Use n8n's RSS feed reader for job boards

5. **Google Workspace** (Existing):
   - Gmail for email sending
   - Google Calendar for interview scheduling
   - Google Drive for document storage

6. **Optional Enhancements**:
   - Slack workspace (free) for notifications
   - LinkedIn Sales Navigator ($80/month) for better targeting
   - Simplify Chrome Extension (free) for auto-fill

## 🗄️ Database Setup

### Create Supabase Tables

```sql
-- Main job opportunities table
CREATE TABLE job_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  url TEXT UNIQUE NOT NULL,
  description TEXT,
  salary_range VARCHAR(100),
  remote BOOLEAN DEFAULT false,
  ai_score DECIMAL(3,1),
  match_reasons TEXT,
  red_flags TEXT,
  source VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20),
  human_notes TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(),
  applied_at TIMESTAMP,
  last_followup TIMESTAMP,
  followup_count INTEGER DEFAULT 0,
  deadline DATE,
  application_email VARCHAR(255),
  linkedin_profile VARCHAR(255),
  recruiter_email VARCHAR(255),
  resume_version VARCHAR(50),
  cover_letter_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Application history tracking
CREATE TABLE application_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES job_opportunities(id),
  action VARCHAR(100),
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Interview preparation
CREATE TABLE interview_prep (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES job_opportunities(id),
  prep_date TIMESTAMP,
  materials_sent BOOLEAN DEFAULT false,
  interview_date TIMESTAMP,
  interview_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics history
CREATE TABLE analytics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE,
  metrics JSONB,
  performance_data JSONB,
  insights JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email inbox monitoring (optional)
CREATE TABLE email_inbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id VARCHAR(255) UNIQUE,
  subject TEXT,
  from_email VARCHAR(255),
  email_content TEXT,
  received_at TIMESTAMP,
  processed BOOLEAN DEFAULT false,
  job_id UUID REFERENCES job_opportunities(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_job_status ON job_opportunities(status);
CREATE INDEX idx_job_source ON job_opportunities(source);
CREATE INDEX idx_job_company ON job_opportunities(company);
CREATE INDEX idx_job_ai_score ON job_opportunities(ai_score DESC);
CREATE INDEX idx_job_applied_at ON job_opportunities(applied_at);
```

## 🔌 n8n Configuration

### Step 1: Import Workflows
1. Open n8n interface (http://localhost:5678 if local)
2. Go to Workflows → Import
3. Import each JSON file in order:
   - `job-discovery-workflow.json`
   - `application-submission-workflow.json`
   - `status-monitoring-workflow.json`
   - `human-approval-workflow.json`
   - `analytics-reporting-workflow.json`

### Step 2: Configure Credentials

#### Supabase Connection
1. Go to Credentials → New → Supabase
2. Enter:
   - **URL**: Your Supabase project URL
   - **Service Role Key**: Your service role key (not anon key)

#### OpenAI Connection
1. Go to Credentials → New → OpenAI
2. Enter:
   - **API Key**: Your OpenAI API key
   - **Organization ID**: (optional)

#### Gmail Connection
1. Go to Credentials → New → Gmail OAuth2
2. Follow OAuth flow to authorize
3. Or use SMTP:
   - **Host**: smtp.gmail.com
   - **Port**: 587
   - **User**: Your email
   - **Password**: App-specific password

#### Google Calendar
1. Go to Credentials → New → Google Calendar OAuth2
2. Follow OAuth flow to authorize

#### RapidAPI (for JSearch)
1. Go to Credentials → New → Header Auth
2. Enter:
   - **Header Name**: X-RapidAPI-Key
   - **Header Value**: Your RapidAPI key

### Step 3: Customize Settings

#### Update Job Discovery Workflow
- Edit "LinkedIn Jobs Scraper" node:
  - Customize search queries for your target roles
  - Adjust location preferences
  - Set remote preference

- Edit "AI Job Scorer" node:
  - Update the system prompt with your specific profile
  - Adjust scoring criteria
  - Add industry-specific keywords

#### Update Application Workflow
- Edit "Tailor Resume" node:
  - Add your complete resume content
  - Customize emphasis points
  - Update achievement metrics

- Edit "Generate Cover Letter" node:
  - Add your unique value propositions
  - Customize tone and style
  - Include specific examples

#### Configure Notifications
- Update all email nodes with your email address
- Optional: Add Slack webhook URL for notifications
- Set up SMS alerts (via Twilio) for urgent updates

## 🎯 Optimization Tips

### Cost Optimization
1. **Reduce API Calls**:
   - Batch job scoring (process 5-10 at once)
   - Cache AI responses for similar jobs
   - Use GPT-3.5 for initial screening, GPT-4 for finals

2. **Smart Scheduling**:
   - Run discovery workflows during off-peak (cheaper API rates)
   - Limit follow-ups to high-score opportunities only
   - Weekly analytics instead of daily

3. **Free Alternatives**:
   - Use Indeed RSS feeds instead of paid APIs
   - Leverage GitHub Jobs API (free)
   - Scrape company career pages directly

### Performance Optimization
1. **Database**:
   - Add composite indexes for common queries
   - Archive old applications after 90 days
   - Use materialized views for analytics

2. **Workflows**:
   - Implement error handling and retries
   - Add circuit breakers for external APIs
   - Use parallel processing where possible

3. **AI Prompts**:
   - Create prompt templates for consistency
   - Fine-tune temperature settings (0.3-0.5 for consistency)
   - Implement prompt caching for similar jobs

## 📈 Success Metrics

### Track Weekly
- Applications sent
- Response rate
- Interview conversion rate
- Time per application
- Cost per application

### Track Monthly
- Offer rate
- Average time to response
- Best performing sources
- Keyword performance
- AI score accuracy

### Red Flags to Watch
- Response rate < 3% (revise strategy)
- AI score drift (retune prompts)
- High manual intervention rate (improve automation)
- Cost per application > $2 (optimize API usage)

## 🐛 Troubleshooting

### Common Issues

#### "Workflow execution failed"
- Check API credentials are valid
- Verify Supabase connection
- Review error logs in n8n

#### "AI scoring seems off"
- Review and update the scoring prompt
- Check if job descriptions are being parsed correctly
- Validate that your profile info is current

#### "Not finding relevant jobs"
- Expand search queries
- Add more job sources
- Lower AI score threshold temporarily

#### "Low response rate"
- A/B test different resume versions
- Improve cover letter personalization
- Focus on higher AI-scored opportunities

## 🚦 Getting Started Checklist

### Week 1: Setup
- [ ] Set up n8n instance
- [ ] Create Supabase database and tables
- [ ] Configure all API credentials
- [ ] Import and test each workflow
- [ ] Customize AI prompts with your profile

### Week 2: Testing
- [ ] Run job discovery manually
- [ ] Review AI scoring accuracy
- [ ] Test application submission flow
- [ ] Verify email notifications work
- [ ] Check calendar integration

### Week 3: Optimization
- [ ] Analyze first batch of metrics
- [ ] Tune AI scoring based on results
- [ ] Adjust search queries
- [ ] Optimize API usage for cost
- [ ] Set up weekly reporting

### Week 4: Scaling
- [ ] Enable all automations
- [ ] Add additional job sources
- [ ] Implement A/B testing
- [ ] Create feedback loops
- [ ] Document what works

## 🔒 Security Best Practices

1. **API Keys**:
   - Never commit to version control
   - Use environment variables
   - Rotate keys monthly
   - Set spending limits

2. **Database**:
   - Enable Row Level Security (RLS)
   - Use service role key only in n8n
   - Regular backups
   - Encrypt sensitive data

3. **Personal Information**:
   - Anonymize data in analytics
   - Secure document storage
   - Use OAuth where possible
   - Enable 2FA on all services

## 💡 Advanced Features (Future)

### Phase 2 Enhancements
- Company research automation
- Salary negotiation assistant
- Interview scheduling bot
- Reference check automation
- Offer comparison tool

### Phase 3 Scaling
- Multi-user support (help others)
- Industry-specific modules
- Placement agency integration
- Performance prediction ML
- Automated portfolio generation

## 📞 Support Resources

### n8n Help
- Documentation: https://docs.n8n.io
- Community: https://community.n8n.io
- YouTube Tutorials: n8n official channel

### API Documentation
- OpenAI: https://platform.openai.com/docs
- Supabase: https://supabase.com/docs
- RapidAPI: https://rapidapi.com/docs

### Job Search Strategy
- LinkedIn Learning courses
- Reddit: r/jobsearch, r/resumes
- Career coaching resources

## 🎉 Success Tips

1. **Start Small**: Begin with job discovery, then add features
2. **Iterate Quickly**: Adjust based on what works
3. **Track Everything**: Data drives improvement
4. **Network Parallel**: Automation supplements, doesn't replace networking
5. **Stay Positive**: Automation handles volume, you handle relationships

---

Remember: This system is a force multiplier for your job search, not a replacement for genuine engagement. Use the time saved to network, upskill, and prepare thoroughly for interviews.

Good luck with your job search! 🚀