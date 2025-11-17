# Market Intelligence Workflow - Setup Guide

**Workflow #5: Market Intelligence - Weekly Analytics & Optimization**

## 📊 Overview

This workflow runs **every Monday at 9 AM** to analyze your entire job search performance and provide strategic insights.

### What It Does
- ✅ Analyzes all data from workflows #1-4
- ✅ Calculates key performance metrics
- ✅ Identifies trends and patterns
- ✅ Generates AI-powered strategic recommendations
- ✅ Creates dashboard-ready data
- ✅ Emails comprehensive weekly report

---

## 🎯 Purpose

While workflows #1-4 execute your job search, this workflow provides **strategic intelligence** to optimize your approach:

- **Discovery Intelligence**: Which sources perform best?
- **Application Analytics**: What's your response rate trend?
- **Skill Insights**: Which skills are most in-demand?
- **Salary Analysis**: Are you targeting the right compensation?
- **Networking ROI**: Are connections converting to conversations?
- **Strategic Recommendations**: What should you change this week?

---

## 📈 Key Metrics Tracked

### Discovery Metrics
- Jobs discovered (week/month)
- High-quality jobs (score 70+)
- Average match score
- Week-over-week growth

### Application Metrics
- Applications submitted (week/month)
- Response rate (target: 2-4%)
- Conversion rate (jobs → applications)
- Interview requests
- By method: LinkedIn, Indeed, Manual

### Source Performance
- Jobs per source
- Average quality per source
- Best performing sources
- Sources to prioritize/reduce

### Skill Demand
- Top 20 most-requested skills
- Skills you have vs. need
- Emerging skill trends
- Resume optimization opportunities

### Salary Intelligence
- Common salary ranges
- Application success by compensation
- Market positioning

### Networking Analytics
- Contacts identified
- Connections made
- Conversations started
- Networking ROI

---

## 🔧 Setup Instructions

### 1. Import Workflow (5 minutes)

```bash
1. Open n8n
2. Click "Workflows" → "Import from File"
3. Select: n8n_workflow_5_market_intelligence.json
4. Workflow imports with all nodes configured
```

### 2. Configure Credentials (Already Set!)

The workflow is pre-configured with:
- ✅ Your Supabase URL
- ✅ Your User ID
- ✅ Claude API settings
- ✅ Gmail settings

You just need to select your existing credentials:
- Supabase API credential
- Anthropic Claude API credential
- Gmail OAuth2 credential

### 3. Test First Run (10 minutes)

**Before activating, test manually:**

```bash
1. Open the workflow in n8n
2. Click "Execute Workflow" button (top right)
3. Watch nodes execute one by one
4. Check your email for the report
5. Verify data appears correct
```

**Expected Execution Time:** 30-45 seconds

### 4. Activate for Weekly Runs

```bash
1. Toggle the "Active" switch (top right)
2. Workflow now runs every Monday 9 AM automatically
3. You'll receive email report each Monday
```

---

## 📧 Weekly Email Report Contents

Every Monday at 9 AM, you'll receive an email with:

### Executive Summary
- Jobs discovered this week
- Applications submitted
- Response rate
- Interview requests
- Progress toward 30-day goals

### Performance Analysis
- Top performing job sources
- Most in-demand skills
- Salary insights
- Networking effectiveness

### AI Strategic Analysis
8 sections of AI-generated insights:
1. Performance Assessment
2. Source Optimization
3. Skill Gap Analysis
4. Salary Strategy
5. Application Method Optimization
6. Networking Effectiveness
7. Action Items (5-7 specific recommendations)
8. Week Ahead Forecast

### Dashboard Link
Direct link to your interactive dashboard for detailed charts

---

## 🎨 Dashboard Data Structure

The workflow creates structured data for your dashboard:

```javascript
{
  summary: {
    jobs_discovered: 142,
    applications_submitted: 58,
    interviews_scheduled: 3,
    response_rate: "3.2%",
    avg_match_score: 73.5
  },
  
  charts: {
    source_performance: [...],  // For bar/pie charts
    skill_demand: [...],          // For word cloud/bar chart
    application_funnel: [...],   // For funnel visualization
    weekly_trend: {...}           // For line chart
  },
  
  metrics: {
    conversion_rate: "41.5%",
    response_rate: "3.2%",
    networking_roi: "28%",
    week_growth: "+12%"
  },
  
  ai_analysis: "...",  // Full AI report text
  
  detailed_analytics: {...}  // Complete raw data
}
```

Your GitHub Pages dashboard can fetch this from `analytics_daily` table.

---

## 🤖 AI Analysis Sections Explained

### 1. Performance Assessment
Evaluates overall performance vs. targets:
- Are you on track for 325-400 applications?
- Is 2-4% response rate being met?
- Which metrics are strong/weak?

### 2. Source Optimization
Identifies best/worst job sources:
- "Indeed producing 45% of high-quality jobs"
- "WeWorkRemotely showing low match scores"
- Recommendation: Shift focus to top performers

### 3. Skill Gap Analysis
Compares your skills to market demand:
- "Claude AI mentioned in 67% of jobs" ✅ You have this
- "LangChain appearing frequently" ⚠️ Consider adding
- Resume update recommendations

### 4. Salary Strategy
Analyzes compensation targeting:
- "$100-120k range has 4.5% response rate"
- "$80-100k getting more volume but lower quality"
- Should you adjust expectations?

### 5. Application Method Optimization
Compares LinkedIn, Indeed, Manual:
- Which methods get best response rates?
- Should you shift method mix?
- Are Easy Apply submissions worthwhile?

### 6. Networking Effectiveness
Evaluates networking ROI:
- Connection acceptance rate
- Conversation conversion
- Is networking producing opportunities?

### 7. Action Items
5-7 specific recommendations:
- ✅ "Increase applications from LinkedIn (best response rate)"
- ✅ "Add 'LangChain' to resume skills section"
- ✅ "Send 10 more networking requests this week"
- ✅ "Reduce applications to jobs scoring <75"

### 8. Week Ahead Forecast
AI predicts next week's performance:
- Expected job discoveries
- Projected applications
- Anticipated interviews
- Confidence in 30-day goal

---

## 📊 SQL Queries Explained

The workflow runs 7 analytics queries:

### Query 1: Job Discovery Stats
```sql
-- Gets job discovery performance
- Total jobs found (week/month)
- High-quality jobs (score 70+)
- Average/max/min scores
```

### Query 2: Application Stats
```sql
-- Gets application and response metrics
- Applications submitted
- Interview requests
- Rejections
- By method (LinkedIn/Indeed/Manual)
```

### Query 3: Source Performance
```sql
-- Analyzes which sources perform best
- Jobs per source
- Average score per source
- High-quality job count
- Actions taken per source
```

### Query 4: Skill Demand
```sql
-- Identifies most requested skills
- Top 20 skills from job requirements
- Frequency count
- Average match score per skill
```

### Query 5: Salary Analysis
```sql
-- Analyzes salary ranges
- Common salary bands
- Application count per range
- Success rate per range
```

### Query 6: Networking Stats
```sql
-- Evaluates networking performance
- Total contacts identified
- Connections made
- Conversations started
- Weekly activity
```

---

## 🎯 Using the Insights

### High Priority (Do This Week)
Any recommendation marked "high priority" should be acted on immediately:
- Low response rate? → Improve cover letters
- Behind on volume? → Approve more jobs
- Source underperforming? → Add new sources

### Medium Priority (Plan This Week)
Address these within 7 days:
- Skill gaps → Update resume
- Salary misalignment → Adjust targeting
- Method optimization → Shift mix

### Low Priority (Monitor)
Keep an eye on these:
- Networking effectiveness
- Emerging trends
- Minor optimizations

---

## 📈 Success Metrics

### Week 1
- ✅ Receive first report
- ✅ Understand all metrics
- ✅ Implement 2-3 recommendations

### Week 2
- ✅ See trend improvements
- ✅ Response rate increasing
- ✅ Better source mix

### Week 3
- ✅ Optimized workflow
- ✅ Hitting volume targets
- ✅ Multiple interviews

### Week 4
- ✅ Data-driven approach refined
- ✅ On track for 30-day goals
- ✅ Job offers incoming! 🎉

---

## 🔧 Customization Options

### Adjust Schedule
Default: Every Monday 9 AM
```
Cron: 0 9 * * 1
```

To change:
- Daily: `0 9 * * *`
- Twice weekly: `0 9 * * 1,4` (Mon & Thu)
- Monthly: `0 9 1 * *` (1st of month)

### Adjust Thresholds
In "Generate Optimization Recommendations" node:
```javascript
// Change alert thresholds
if (responseRate < 2.0) {  // Change 2.0 to 1.5 or 2.5
if (conversionRate < 20) {  // Adjust volume alerts
if (weeklyApps < 50) {      // Change weekly targets
```

### Add Custom Metrics
Add new SQL query nodes:
1. Click "+" between Schedule and Combine nodes
2. Add "Supabase" node
3. Write custom query
4. Connect to "Combine All Analytics"
5. Update JavaScript to include new data

---

## 🆘 Troubleshooting

### "No email received"
- Check Gmail credentials are valid
- Verify email address in workflow (ekazee.careers@gmail.com)
- Check spam folder
- Look at n8n execution logs

### "Empty analytics"
- Ensure workflows #1-4 have run and created data
- Check database has records in jobs, applications tables
- Verify Supabase credentials
- Test with manual execution first

### "AI analysis incomplete"
- Verify Anthropic API key is valid
- Check Claude API rate limits
- Review token usage (report uses ~2000 tokens)
- Ensure maxTokens is set to 2500+

### "SQL query errors"
- Verify all 5 tables exist in Supabase
- Check table names match exactly
- Ensure columns exist (ai_match_score, status, etc.)
- Review Supabase logs for specific errors

---

## 💡 Pro Tips

### 1. Review Before Activating
Run manually 2-3 times first to ensure all queries work and email looks correct.

### 2. Archive Reports
Save weekly emails to a "Job Search Analytics" folder for historical reference.

### 3. Act on Recommendations
The AI insights are only valuable if you implement them! Pick 2-3 actions each week.

### 4. Track Improvements
Keep a simple spreadsheet:
- Week 1: Response rate 1.8%
- Week 2: Response rate 2.3% (improved!)
- Week 3: Response rate 3.1% (on target!)

### 5. Combine with Dashboard
Use the email for high-level insights, dashboard for detailed exploration.

### 6. Share with Accountability Partner
Forward weekly reports to a friend/mentor who's tracking your progress.

---

## 🎯 Integration with Other Workflows

This workflow **analyzes** data from:

- **Workflow #1** → Job discovery metrics
- **Workflow #2** → Application performance
- **Workflow #3** → Response tracking
- **Workflow #4** → Networking effectiveness

**Data flows:**
```
Workflows #1-4 → Supabase Database → Workflow #5 Analysis → Email Report
                                                          ↓
                                                    Dashboard Updates
```

---

## 📊 Expected Results

### Weekly Email Example

```
📊 Weekly Job Search Intelligence Report
Generated: Monday, November 11, 2025

EXECUTIVE SUMMARY
- Jobs Discovered: 147
- Applications Submitted: 63
- Response Rate: 3.2%
- Interviews: 2 new this week

MONTH-TO-DATE PROGRESS
- Total Applications: 189 / 325 (58%)
- Interviews: 5 / 7 minimum
- On Track: ✅ Yes

TOP PERFORMING SOURCES
1. Indeed: 67 jobs, 34 high-quality (avg 76.2)
2. RemoteOK: 52 jobs, 28 high-quality (avg 74.8)
3. WeWorkRemotely: 28 jobs, 12 high-quality (avg 68.3)

TOP SKILLS IN DEMAND
1. AI adoption (89 jobs)
2. Claude/ChatGPT (67 jobs)
3. Training development (54 jobs)
4. Change management (48 jobs)
5. Legal tech (32 jobs)

AI STRATEGIC ANALYSIS
[8 detailed sections with specific recommendations]

ACTION ITEMS
✅ Focus applications on Indeed (best response rate)
✅ Add "LangChain" to technical skills
✅ Increase networking outreach by 30%
✅ Target $110-130k salary range
✅ Improve cover letter opening hooks

View full dashboard: https://ekazee01-lgtm.github.io/jobsearch
```

---

## 🚀 Quick Start Summary

1. **Import**: Drag JSON into n8n (5 min)
2. **Configure**: Select existing credentials (2 min)
3. **Test**: Manual execution to verify (10 min)
4. **Activate**: Toggle on for weekly runs (1 min)
5. **Monitor**: Check email every Monday morning

**Total Setup Time:** 20 minutes
**Ongoing Effort:** 10 minutes/week to review report

---

## 🎯 This Workflow Completes Your System

You now have a **complete 5-workflow automation system**:

1. **Discovery** → Find jobs automatically
2. **Application** → Apply with AI personalization
3. **Monitoring** → Track all responses
4. **Networking** → Build warm connections
5. **Intelligence** → Optimize strategically ⭐ NEW!

**The result:** A data-driven, continuously improving job search machine that learns and adapts every week.

---

**Ready to activate your Market Intelligence?**

Import the workflow, test it once, then let it run every Monday to keep you on track toward that AI adoption role! 🎯📊

---

**Workflow:** n8n_workflow_5_market_intelligence.json  
**Nodes:** 14  
**Execution Time:** 30-45 seconds  
**Schedule:** Every Monday 9 AM  
**Output:** Email report + Dashboard data + Database record
