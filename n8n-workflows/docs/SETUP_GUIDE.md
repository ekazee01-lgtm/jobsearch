# Smart Application Engine - Complete Setup Guide

## 🎯 What This System Does

**Automates 90% of your application process while maintaining quality:**
1. Monitors your job dashboard for positions marked "Ready to Apply"
2. Generates custom resume + cover letter using AI (Claude API)
3. Saves materials to your database for review
4. Emails you when materials are ready
5. Waits for your approval before submission
6. (Future) Automatically submits applications via Simplify/API

**Time Savings:** 15+ hours/week → 2 hours/week
**Application Volume:** 5-10/week → 50-100/week  
**Quality:** Higher (AI optimizes for keywords + relevance)

---

## 📋 Prerequisites

**Required (Free):**
- ✅ Supabase account (already have)
- ✅ GitHub account (for hosting templates)
- ✅ n8n cloud account OR self-hosted n8n
- ✅ Gmail account (for notifications)
- ⚠️ **Anthropic API key** - This is the only paid component

**Optional (Enhance Later):**
- Simplify.jobs Chrome extension (for auto-apply)
- Teal.hq account (enhanced job tracking)

---

## 💰 Cost Analysis

**Anthropic Claude API:**
- Model: Claude Sonnet 4 (best balance of cost/quality)
- Cost per application: ~$0.02-0.05
- 100 applications/week = ~$2-5/week = ~$8-20/month
- **ROI:** If it gets you hired 1-2 weeks faster, saves thousands in lost income

**Free Alternatives (Not Recommended):**
- ChatGPT API: Cheaper but lower quality customization
- Free Claude credits: Limited, not sustainable for volume

**Recommendation:** Start with $25 Anthropic credit, monitor usage first week

---

## 🚀 Step-by-Step Setup

### PHASE 1: Database Setup (15 minutes)

**1. Update Supabase Schema**

Go to Supabase SQL Editor and run:

```sql
-- Add columns to existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resume_version TEXT DEFAULT 'master';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_letter_draft TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_materials_approved BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

-- Create application materials tracking table
CREATE TABLE IF NOT EXISTS application_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_content TEXT,
  cover_letter_content TEXT,
  customization_notes TEXT,
  match_score INTEGER,
  key_requirements_matched TEXT[],
  recommended_approach TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  submitted_at TIMESTAMP,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision'))
);

-- Create index for faster queries
CREATE INDEX idx_materials_job_id ON application_materials(job_id);
CREATE INDEX idx_materials_approval_status ON application_materials(approval_status);

-- Create view for easy dashboard queries
CREATE OR REPLACE VIEW materials_pending_review AS
SELECT 
  am.*,
  j.company_name,
  j.job_title,
  j.url as job_url,
  j.ai_match_score
FROM application_materials am
JOIN jobs j ON am.job_id = j.id
WHERE am.approval_status = 'pending'
ORDER BY am.created_at DESC;
```

**2. Verify Schema**
```sql
-- Should return all new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('resume_version', 'application_materials_approved', 'submitted_at');

-- Should return rows if table exists
SELECT COUNT(*) FROM application_materials;
```

---

### PHASE 2: Template Setup (10 minutes)

**1. Create GitHub Repository (Private Recommended)**

```bash
# In your terminal
mkdir job-search-templates
cd job-search-templates
git init

# Copy your templates
cp /home/claude/master_resume_template.md .
cp /home/claude/master_cover_letter_template.md .
cp /home/claude/ai_customization_prompt.md .

# Add README
echo "# Job Application Templates - Private Repository" > README.md
echo "Master templates for AI-powered application customization" >> README.md

# Commit and push
git add .
git commit -m "Initial commit: master templates"
git remote add origin https://github.com/YOUR_USERNAME/job-search-templates.git
git push -u origin main
```

**2. Get Raw URLs**
- Navigate to each file on GitHub
- Click "Raw" button
- Copy the URL (format: `https://raw.githubusercontent.com/YOUR_USERNAME/job-search-templates/main/master_resume_template.md`)
- Save these URLs - you'll need them for n8n

**Alternative (Simpler):** 
- Use GitHub Gist for templates (public or secret)
- Pro: No repo needed
- Con: Less version control

---

### PHASE 3: Anthropic API Setup (5 minutes)

**1. Get API Key**
- Go to: https://console.anthropic.com/
- Sign up / Log in
- Navigate to "API Keys"
- Create new key (name it "Job Search Automation")
- **CRITICAL:** Copy and save immediately (won't show again)

**2. Add Initial Credits**
- Minimum: $25 (will last 500-1,250 applications)
- Recommended: $50 (peace of mind for first month)

**3. Test API (Optional but Recommended)**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello, Claude!"}]
  }'
```

Expected response: JSON with Claude's greeting

---

### PHASE 4: n8n Workflow Setup (20 minutes)

**Option A: n8n Cloud (Recommended for beginners)**
1. Sign up: https://n8n.io/cloud
2. Free tier: 5,000 workflow executions/month (plenty)
3. Import workflow JSON file

**Option B: Self-Hosted n8n**
```bash
# Using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

**Setup Steps:**

1. **Import Workflow**
   - Go to n8n dashboard
   - Click "Import from File"
   - Upload `n8n_workflow_smart_application_engine.json`

2. **Configure Credentials**

   a. **Supabase Credential:**
   - Node: "Get Ready-to-Apply Jobs"
   - Click "Create New Credential"
   - Name: "Supabase Job Search"
   - Host: Your Supabase project URL (e.g., `https://abc123.supabase.co`)
   - Service Role Key: From Supabase Project Settings → API

   b. **Anthropic API Credential:**
   - Node: "Generate Custom Materials"
   - Add environment variable `ANTHROPIC_API_KEY` in n8n settings
   - OR hardcode in HTTP Request header (less secure)

   c. **Gmail SMTP Credential:**
   - Node: "Email Notification"
   - User: `ekazee.careers@gmail.com`
   - Password: Use App Password (not regular password)
   - How to get App Password:
     - Google Account → Security → 2-Step Verification → App Passwords
     - Generate password for "Mail" / "Other device"

3. **Update Template URLs**
   - Node: "Fetch Resume Template"
   - Replace `https://raw.githubusercontent.com/YOUR_REPO/master_resume_template.md` with your actual URL
   - Same for Cover Letter Template node

4. **Test Workflow**
   - Click "Execute Workflow" 
   - Should process any jobs in "Ready to Apply" status
   - Check Supabase for new entry in `application_materials` table
   - Check email for notification

---

### PHASE 5: Dashboard Integration (30 minutes)

**Update your GitHub Pages job dashboard to display generated materials**

**Add to your HTML:**
```html
<!-- Materials Review Section -->
<div id="materials-review" class="hidden">
  <h2>📝 Materials Pending Review</h2>
  <div id="materials-container"></div>
</div>

<script>
// Fetch pending materials
async function loadPendingMaterials() {
  const { data, error } = await supabase
    .from('materials_pending_review')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading materials:', error);
    return;
  }
  
  renderMaterials(data);
}

// Render materials cards
function renderMaterials(materials) {
  const container = document.getElementById('materials-container');
  container.innerHTML = materials.map(m => `
    <div class="material-card" data-id="${m.id}">
      <h3>${m.job_title} at ${m.company_name}</h3>
      <div class="match-score">Match: ${m.match_score}%</div>
      
      <details>
        <summary>View Resume</summary>
        <pre>${m.resume_content}</pre>
      </details>
      
      <details>
        <summary>View Cover Letter</summary>
        <pre>${m.cover_letter_content}</pre>
      </details>
      
      <div class="customization-notes">
        <strong>AI Notes:</strong> ${m.customization_notes}
      </div>
      
      <div class="actions">
        <button onclick="approveMaterial('${m.id}')">✅ Approve & Apply</button>
        <button onclick="requestRevision('${m.id}')">✏️ Request Changes</button>
        <button onclick="rejectMaterial('${m.id}')">❌ Skip This Job</button>
        <a href="${m.job_url}" target="_blank">🔗 View Job Posting</a>
      </div>
    </div>
  `).join('');
}

// Approve material
async function approveMaterial(materialId) {
  const { data, error } = await supabase
    .from('application_materials')
    .update({ 
      approval_status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', materialId);
  
  if (!error) {
    alert('✅ Approved! Moving to submission queue...');
    loadPendingMaterials(); // Refresh list
  }
}

// Request revision
async function requestRevision(materialId) {
  const notes = prompt('What changes do you want? (Be specific)');
  if (!notes) return;
  
  await supabase
    .from('application_materials')
    .update({ 
      approval_status: 'needs_revision',
      approval_notes: notes
    })
    .eq('id', materialId);
  
  alert('✏️ Revision requested. AI will regenerate materials.');
  loadPendingMaterials();
}

// Reject material
async function rejectMaterial(materialId) {
  if (!confirm('Skip this job entirely?')) return;
  
  await supabase
    .from('application_materials')
    .update({ approval_status: 'rejected' })
    .eq('id', materialId);
  
  loadPendingMaterials();
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadPendingMaterials);
</script>
```

---

### PHASE 6: Testing & Validation (15 minutes)

**1. Manual Test Flow**

```sql
-- Add a test job manually
INSERT INTO jobs (
  company_name, 
  job_title, 
  job_description, 
  url, 
  pipeline_stage, 
  ai_match_score
) VALUES (
  'Test Company',
  'AI Adoption Specialist',
  'We are seeking an AI Adoption Specialist with legal tech experience...',
  'https://example.com/job',
  'Ready to Apply',
  85
);
```

**2. Run Workflow**
- Go to n8n
- Click "Execute Workflow"
- Monitor execution path (should turn green if successful)
- Check for errors in any node

**3. Verify Results**
```sql
-- Check if materials were created
SELECT * FROM application_materials ORDER BY created_at DESC LIMIT 1;

-- Check if job status was updated
SELECT pipeline_stage FROM jobs WHERE company_name = 'Test Company';
```

**4. Check Email**
- Should receive notification within 1-2 minutes
- Email should contain job title, company, match score

**5. Review in Dashboard**
- Refresh your GitHub Pages site
- Material card should appear in "Pending Review" section
- Test approve/reject buttons

**6. Monitor API Usage**
- Anthropic Console → Usage
- Should show 1 request, ~2,000-3,000 tokens
- Cost: ~$0.02-0.05

---

## 🔄 Daily Workflow

**Morning Routine (15 minutes):**
1. Check email for new material notifications
2. Open dashboard → "Materials Pending Review"
3. Review resume/cover letter for 3-5 jobs
4. Approve good matches, request revisions for others
5. (Future) Auto-submit approved applications

**Weekly Check (30 minutes):**
- Review Anthropic API usage/costs
- Update master templates if needed (push to GitHub)
- Adjust n8n schedule if too many/few materials
- Review match score accuracy

---

## 🐛 Troubleshooting

**Problem: No materials being generated**

Check:
1. Are there jobs in "Ready to Apply" status? 
   ```sql
   SELECT COUNT(*) FROM jobs WHERE pipeline_stage = 'Ready to Apply';
   ```
2. Is n8n workflow active? (Toggle should be green)
3. Check n8n execution history for errors
4. Verify Anthropic API key is valid

**Problem: Materials are low quality**

Solutions:
1. Update master templates with better examples
2. Add more specific keywords to resume bullets
3. Check job descriptions - are they complete?
4. Consider using Claude Opus for higher quality (costs 3x more)

**Problem: API costs too high**

Optimize:
1. Reduce max_tokens in n8n workflow (4000 → 3000)
2. Process fewer jobs per run (LIMIT 5 → LIMIT 2)
3. Increase n8n schedule interval (15min → 30min)
4. Filter only high-match jobs (WHERE ai_match_score > 75)

**Problem: Email notifications not sending**

Check:
1. Gmail App Password is correct
2. "Allow less secure apps" is enabled (if needed)
3. Check spam folder
4. Verify SMTP settings in n8n (port 587, TLS enabled)

---

## 📊 Success Metrics

Track these weekly:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Applications/week | 50-100 | `SELECT COUNT(*) FROM jobs WHERE submitted_at > NOW() - INTERVAL '7 days'` |
| Match score avg | 75+ | `SELECT AVG(ai_match_score) FROM jobs WHERE pipeline_stage = 'Ready to Apply'` |
| Approval rate | 80%+ | Materials approved / materials generated |
| Cost per app | <$0.10 | Anthropic bill / applications submitted |
| Time spent | <2 hrs/week | Manual tracking |

---

## 🎯 Next Steps (After 1 Week)

**Week 2: Add Auto-Submit**
- Integrate Simplify.jobs API
- Auto-apply to approved applications
- Track submission success rate

**Week 3: Add Follow-Up Automation**
- Email follow-ups 7 days after application
- LinkedIn connection requests to recruiters
- Thank you notes after rejections

**Week 4: Optimize**
- A/B test resume variations
- Track which customizations get best response rates
- Refine AI prompts based on results

---

## 📞 Support Resources

**If you get stuck:**
1. Check n8n community forum: https://community.n8n.io/
2. Anthropic Discord: https://discord.gg/anthropic
3. Supabase docs: https://supabase.com/docs
4. **Ask Claude for help!** (that's me 👋)

---

## ✅ Final Checklist

Before going live:

- [ ] Supabase schema updated
- [ ] Templates uploaded to GitHub
- [ ] Anthropic API key obtained and funded
- [ ] n8n workflow imported and configured
- [ ] All credentials saved securely
- [ ] Test run completed successfully
- [ ] Dashboard updated with review interface
- [ ] Email notifications working
- [ ] Match score calibration looks good

**When all checkboxes are complete, you're ready to scale!**

---

**Estimated Setup Time:** 90-120 minutes  
**Weekly Time Savings:** 13+ hours  
**ROI Timeline:** Pays for itself in 1-2 weeks via faster job placement
