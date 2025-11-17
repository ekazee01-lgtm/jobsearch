# 🚀 Lean Job Search Automation - Setup Guide

## Phase 1: Foundation Setup (30 minutes)

### Step 1: Database Preparation
1. **Run the staging table setup**:
   ```sql
   -- In Supabase SQL Editor, run:
   -- Copy and paste contents of database-staging-setup.sql
   ```

2. **Verify tables created**:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('job_raw', 'job_applications');
   ```

### Step 2: n8n Credentials Setup
1. **Access n8n**: http://localhost:5678
2. **Add Supabase credential**:
   - Settings → Credentials → Add Credential
   - Name: `Supabase-JobSearch`
   - Type: HTTP Request (Custom)
   - URL: `https://snmdcbrvvzasubdnnsbd.supabase.co/rest/v1`
   - Headers:
     - `apikey`: `your_supabase_anon_key`
     - `Authorization`: `Bearer your_supabase_anon_key`
     - `Content-Type`: `application/json`

3. **Add OpenAI credential**:
   - Name: `OpenAI-JobScoring`
   - Type: OpenAI API
   - API Key: `your_openai_api_key`

4. **Add Email credential**:
   - Name: `Gmail-Digest`
   - Type: SMTP
   - Host: `smtp.gmail.com`, Port: `587`
   - Username: `your_email@gmail.com`
   - Password: `your_app_password`

### Step 3: Import Workflows
1. **Import lean job discovery**:
   - Workflows → Import → Select `workflows/lean-job-discovery.json`
   - Verify all credentials are connected (green checkmarks)

2. **Import daily digest**:
   - Import `workflows/daily-digest.json`
   - Update email address to yours

## Phase 2: Testing & Validation (20 minutes)

### Step 1: Manual Test Run
1. **Open "Lean Job Discovery Pipeline"**
2. **Click "Execute Workflow"** (test button)
3. **Monitor execution**:
   - Watch each node complete
   - Check for errors (red nodes)
   - Verify data flows correctly

### Step 2: Verify Data Pipeline
1. **Check staging table**:
   ```sql
   SELECT source, COUNT(*) as count,
          processed, error_message
   FROM job_raw
   GROUP BY source, processed, error_message
   ORDER BY count DESC;
   ```

2. **Check main jobs table**:
   ```sql
   SELECT source, COUNT(*) as count,
          AVG(ai_match_score) as avg_score
   FROM job_applications
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY source;
   ```

3. **Verify AI scoring**:
   ```sql
   SELECT role, company, ai_match_score, ai_reasoning
   FROM job_applications
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   ORDER BY ai_match_score DESC
   LIMIT 5;
   ```

### Step 3: Test Daily Digest
1. **Execute digest workflow manually**
2. **Check your email** for digest
3. **Verify formatting** and content

## Phase 3: Go Live (10 minutes)

### Step 1: Activate Automation
1. **Set job discovery schedule**:
   - Edit trigger: Every 12 hours (6 AM, 6 PM)
   - Toggle workflow "Active"

2. **Set digest schedule**:
   - Daily at 6 PM
   - Toggle workflow "Active"

### Step 2: Monitor First Week
1. **Daily checks**:
   - Review digest emails
   - Check job quality scores
   - Monitor token usage
   - Watch for errors

2. **Weekly review**:
   ```sql
   -- Run weekly performance query
   SELECT * FROM get_job_stats(7);
   ```

## 🎯 Success Metrics (Week 1 Goals)

### Volume Targets
- **Jobs Discovered**: 20-50 per day
- **High Score (8+)**: 2-5 per day
- **Added to Tracker**: 10-20 per week

### Quality Targets
- **Duplicate Rate**: <10%
- **Error Rate**: <5%
- **AI Score Accuracy**: Manual review confirms 80%+ relevance

### Cost Tracking
- **OpenAI Usage**: Track daily token spend
- **Target**: <$15/month total
- **Monitor**: API rate limits and errors

## 🔧 Monitoring Dashboard

### Key Queries to Bookmark

```sql
-- Daily job discovery stats
SELECT
  DATE_TRUNC('day', created_at) as day,
  source,
  COUNT(*) as jobs_found,
  COUNT(*) FILTER (WHERE ai_match_score >= 8) as high_quality,
  AVG(ai_match_score) as avg_score
FROM job_applications
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY day, source
ORDER BY day DESC, jobs_found DESC;

-- Error monitoring
SELECT
  source,
  error_message,
  COUNT(*) as error_count,
  MAX(created_at) as last_error
FROM job_raw
WHERE error_message IS NOT NULL
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source, error_message;

-- Processing health check
SELECT * FROM job_processing_monitor;

-- Weekly performance
SELECT
  'This Week' as period,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE ai_match_score >= 8) as excellent,
  COUNT(*) FILTER (WHERE ai_match_score >= 7) as good,
  ROUND(AVG(ai_match_score), 2) as avg_score
FROM job_applications
WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'Last Week' as period,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE ai_match_score >= 8) as excellent,
  COUNT(*) FILTER (WHERE ai_match_score >= 7) as good,
  ROUND(AVG(ai_match_score), 2) as avg_score
FROM job_applications
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND created_at < NOW() - INTERVAL '7 days';
```

## 🚨 Common Issues & Fixes

### Issue: No jobs being found
**Solution**:
1. Check RSS feed URLs are working
2. Verify Supabase credentials
3. Review RSS feed parsing logic

### Issue: AI scoring errors
**Solution**:
1. Check OpenAI API key and credits
2. Review prompt format
3. Monitor token usage

### Issue: Duplicate jobs
**Solution**:
1. Check URL normalization
2. Review duplicate detection RPC
3. Add additional deduplication logic

### Issue: Poor score quality
**Solution**:
1. Review and refine AI prompt
2. Add more specific criteria
3. Analyze false positives/negatives

## 📈 Week 2+ Optimization

### After 1 Week of Data
1. **Analyze source performance**
2. **Refine search keywords**
3. **Adjust AI scoring thresholds**
4. **Add high-performing job sources**

### After 2 Weeks
1. **Add application automation** (if ready)
2. **Implement follow-up sequences**
3. **Add more sophisticated filtering**
4. **Consider premium APIs**

## 🎯 Next Phase Planning

### Phase 4: Application Automation (Week 3)
- Trigger resume tailoring for 8+ scored jobs
- Add human approval workflow
- Integrate with existing AI features

### Phase 5: Advanced Intelligence (Week 4)
- Company research automation
- Competitive analysis
- LinkedIn integration
- Advanced analytics

---

**Ready to launch? Start with Phase 1 and let's get your first automated jobs discovered today! 🚀**