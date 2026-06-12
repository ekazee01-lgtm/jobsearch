# 🎯 Crawl4AI + n8n Quick Start for Eric's Job Search

## Immediate Action Items

### 1️⃣ Today: Test Basic Integration (15 mins)
```bash
cd /path/to/your/jobsearch
source venv/bin/activate

# Test Crawl4AI is working
python scripts/test-crawler.py

# Install FastAPI for the API service
pip install fastapi uvicorn

# Start the API service
python crawl4ai_api.py
```

### 2️⃣ Import n8n Workflow (10 mins)
1. Open n8n: http://localhost:5678
2. Create new workflow → Import from File
3. Select: `n8n_crawl4ai_workflow.json`
4. Update these nodes:
   - **Execute Command**: Set correct path to your jobsearch directory
   - **Supabase**: Add your connection credentials
   - **Slack** (optional): Add webhook URL

### 3️⃣ First Test Run (5 mins)
1. Disable the Schedule Trigger (click on it → disable)
2. Add a Manual Trigger for testing
3. Run workflow manually
4. Check output in Supabase

## Integration Methods Ranked by Ease

### 🥇 Method 1: Execute Command (Easiest)
**Use this to start immediately**
```javascript
// n8n Execute Command node
Command: cd /your/path && python scripts/crawl_job.py "{{$json.url}}"
```

### 🥈 Method 2: HTTP API (Most Scalable)
**Use this once you're processing 50+ jobs/day**
- Run `python crawl4ai_api.py` in background
- Use HTTP Request nodes in n8n
- Handles parallel requests better

### 🥉 Method 3: Python Node (Future)
**Wait for n8n Python support to mature**
- Currently in beta
- Will allow inline Crawl4AI calls

## Your Specific Workflow Components

### Job Discovery (Workflow 1)
```javascript
// Targets for your profile
const jobBoards = [
  'indeed.com/jobs?q=AI+Adoption+Specialist&l=Remote',
  'linkedin.com/jobs/search?keywords=Legal+Technology',
  'dice.com/jobs?q=Instructional+Design+AI',
  'flexjobs.com/remote-jobs/technology'
];
```

### AI Scoring (Workflow 2)
Your key match criteria:
- **Title keywords**: AI, Adoption, Legal, Technology, Instructional
- **Skills**: ChatGPT, Claude, iManage, NetDocuments, LexisNexis
- **Salary**: $100k+ (score higher for $110k+)
- **Location**: Remote (20 pts), Texas (15 pts), Other (5 pts)

### Application Automation (Workflow 3)
```javascript
// Auto-apply threshold
if (matchScore >= 70) {
  // Generate tailored materials
  // Queue for Simplify/Huntr submission
} else if (matchScore >= 50) {
  // Save for manual review
}
```

## Performance Targets

Based on your 325-400 applications/month goal:

| Metric | Target | Automation Level |
|--------|--------|------------------|
| Jobs Scraped | 2000/week | Fully Automated |
| Jobs Scored | 2000/week | Fully Automated |
| High Matches (70+) | 100/week | Auto-Generated Materials |
| Applications Sent | 80/week | Semi-Automated |
| Time Investment | 2 hrs/week | Manual Review Only |

## Cost Optimization

### Free Tier Usage
- **Crawl4AI**: Unlimited (self-hosted)
- **n8n**: Unlimited (self-hosted)
- **Supabase**: 500MB storage, 2GB transfer
- **Claude API**: ~$15/month for resume generation
- **Total**: <$20/month

### When to Scale
- Add proxies when hitting rate limits (>500 scrapes/day)
- Upgrade Supabase at 10,000+ job records
- Consider n8n Cloud at 20+ workflows

## Troubleshooting Checklist

✅ **Crawl4AI not extracting data?**
```python
# Update selectors for the specific site
result = await crawler.arun(
    url=url,
    wait_for="css:.job-listing",  # Wait for content
    timeout=30
)
```

✅ **n8n workflow failing?**
- Check Execute Command node logs
- Verify Python environment activated
- Test command manually first

✅ **Rate limited?**
```javascript
// Add delays between requests
$sleep(3000)  // 3 second delay in n8n
```

## Next 7 Days Plan

**Day 1-2**: Basic integration working
- Test Execute Command method
- Scrape 10 jobs successfully

**Day 3-4**: Scale to all job boards  
- Add all 10+ job sites
- Implement AI scoring

**Day 5-6**: Application materials
- Connect resume/cover letter generation
- Test with 5 real applications

**Day 7**: Full automation
- Enable scheduled runs
- Monitor first batch of 50 applications

## Files Provided

1. **crawl4ai_api.py** - FastAPI service for HTTP integration
2. **n8n_crawl4ai_workflow.json** - Complete workflow template
3. **CRAWL4AI_N8N_INTEGRATION_GUIDE.md** - Full documentation

## Quick Commands Reference

```bash
# Start API service
cd jobsearch && source venv/bin/activate && python crawl4ai_api.py

# Test scraping
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://indeed.com/jobs?q=AI"}'

# Check n8n logs
docker logs n8n  # if using Docker
# OR
journalctl -u n8n -f  # if using systemd

# Monitor Crawl4AI
tail -f .crawl4ai-data/logs/crawler.log
```

## Get Started Now! 🚀

1. Copy the provided files to your project
2. Run the API service
3. Import the n8n workflow
4. Do a test run with 1 job URL
5. Scale up gradually

Within 2 hours, you'll have your first automated job applications going out!
