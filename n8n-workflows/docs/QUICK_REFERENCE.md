# Smart Application Engine - Quick Reference Card

## 📱 Daily Commands (Copy-Paste Ready)

### Check Pending Materials
```sql
SELECT 
  j.company_name,
  j.job_title,
  am.match_score,
  am.created_at
FROM application_materials am
JOIN jobs j ON am.job_id = j.id
WHERE am.approval_status = 'pending'
ORDER BY am.match_score DESC;
```

### Weekly Stats
```sql
-- This week's activity
SELECT 
  COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected,
  COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending,
  AVG(match_score) as avg_match_score
FROM application_materials
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Mark Job Ready to Apply
```sql
UPDATE jobs 
SET pipeline_stage = 'Ready to Apply'
WHERE id = 'PASTE_JOB_ID_HERE';
```

### Bulk Approve High-Scoring Materials
```sql
UPDATE application_materials
SET approval_status = 'approved',
    approved_at = NOW()
WHERE match_score >= 85 
AND approval_status = 'pending';
```

---

## 🎯 Decision Matrix: When to Approve

| Match Score | Action | Rationale |
|-------------|--------|-----------|
| 90-100 | ✅ Auto-approve | Excellent fit, apply immediately |
| 80-89 | 👀 Quick review (1 min) | Strong fit, spot-check customization |
| 70-79 | 📝 Full review (3-5 min) | Good fit, verify key requirements |
| 60-69 | ⚠️ Consider skipping | Moderate fit, only if slow week |
| <60 | ❌ Reject | Weak fit, not worth your time |

---

## 💰 Cost Calculator

**Anthropic Claude Sonnet 4 Pricing:**
- Input tokens: $3 per 1M tokens
- Output tokens: $15 per 1M tokens

**Average Application Cost:**
- Input: ~2,000 tokens (job description + templates)
- Output: ~1,500 tokens (customized materials)
- **Total: ~$0.03 per application**

**Budget Scenarios:**

| Applications/Week | Weekly Cost | Monthly Cost | Annual Cost |
|-------------------|-------------|--------------|-------------|
| 25 | $0.75 | $3 | $36 |
| 50 | $1.50 | $6 | $72 |
| 100 | $3.00 | $12 | $144 |
| 200 | $6.00 | $24 | $288 |

**Cost Optimization Tips:**
1. Filter to match_score > 75 before generating materials
2. Use shorter job descriptions (summarize if >2000 words)
3. Reduce max_tokens in n8n (4000 → 3000)
4. Process in batches during off-peak hours

---

## 🚨 Emergency Fixes

**Workflow stopped working?**
```bash
# Check n8n is running
curl http://localhost:5678/healthz

# Restart n8n (if self-hosted)
docker restart n8n
```

**API rate limit hit?**
```bash
# Check current usage
curl https://api.anthropic.com/v1/usage \
  -H "x-api-key: YOUR_KEY"
```

**Materials not showing in dashboard?**
```sql
-- Manual refresh check
SELECT COUNT(*) FROM materials_pending_review;
```

**Wrong templates being used?**
```bash
# Re-fetch templates from GitHub
curl https://raw.githubusercontent.com/YOUR_REPO/main/master_resume_template.md
```

---

## 📊 Quality Checks

**Before approving, verify:**
- [ ] Company name is correct (not "YOUR_COMPANY")
- [ ] Job title matches posting exactly
- [ ] Resume bullets reference specific requirements from JD
- [ ] Cover letter mentions company by name 2-3x
- [ ] No [BRACKETED] placeholders remain
- [ ] Match score reasoning makes sense
- [ ] Tone matches company type (formal vs casual)

**Red flags (reject/revise):**
- Generic cover letter that could apply anywhere
- Resume missing key requirements from JD
- Obvious hallucinations (fake projects, wrong dates)
- Awkward phrasing or grammatical errors
- Match score doesn't align with actual fit

---

## ⏱️ Time Budgets

**Per application review:**
- 90-100 match score: 30 seconds (skim only)
- 80-89 match score: 1-2 minutes (quick read)
- 70-79 match score: 3-5 minutes (full review)

**Weekly targets:**
- Mon-Fri morning: 10 materials/day = 15-30 min/day
- Weekend batch: 20-30 materials = 60-90 min
- **Total: <2 hours/week**

---

## 🔧 Customization Triggers

**Request revision if:**
- Cover letter too generic
- Resume missing 3+ key requirements from JD
- Wrong tone (too casual for law firm, too formal for startup)
- Doesn't highlight relevant legal tech experience

**Example revision request:**
```
"Add more emphasis on iManage and NetDocuments experience. 
Mention my AI Champion program work in paragraph 2. 
Make cover letter more formal - this is a BigLaw firm."
```

---

## 📈 Success Metrics Dashboard

**Track weekly in spreadsheet:**

| Week | Materials Generated | Approved | Rejected | Avg Match Score | Cost | Applications Submitted |
|------|---------------------|----------|----------|-----------------|------|------------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |

**Goal:** Approval rate >80%, avg match score >75, cost <$5/week

---

## 🎯 Optimization Checklist (Monthly)

- [ ] Review template effectiveness (are materials converting?)
- [ ] Update resume bullets based on what works
- [ ] Refine match score threshold (raise if too many low-quality)
- [ ] Check API usage trends (costs increasing?)
- [ ] A/B test cover letter variations
- [ ] Update job description filters
- [ ] Review rejection reasons (pattern?)
- [ ] Adjust n8n schedule based on job flow

---

## 📞 Quick Links

- **n8n Dashboard:** http://localhost:5678 (or cloud URL)
- **Supabase Console:** https://app.supabase.com
- **Anthropic Console:** https://console.anthropic.com
- **Job Dashboard:** https://ekazee01-lgtm.github.io/jobsearch
- **GitHub Templates:** https://github.com/YOUR_REPO

---

## 🔐 Security Reminders

- **Never commit API keys to GitHub**
- **Use environment variables in n8n**
- **Keep Supabase service key private**
- **Use App Passwords for Gmail, not main password**
- **Regularly rotate API keys (every 90 days)**

---

**Print this page and keep it handy while you get familiar with the system!**
