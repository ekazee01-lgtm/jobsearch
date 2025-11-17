# 🔧 Environment Setup for Fixed Workflows

## Critical Configuration Required

### 1. User ID Configuration

The fixed workflows require a proper USER_ID to be set. Here are your options:

#### Option A: Get Your Supabase User ID
```sql
-- Run this in Supabase SQL Editor to get your user ID
SELECT id, email FROM auth.users;
```

#### Option B: Create a Service User (Recommended)
```sql
-- Create a dedicated automation user
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'automation@yourdomain.com',
  '{\"provider\":\"system\",\"role\":\"automation\"}',
  '{\"name\":\"Job Search Automation\"}',
  NOW(),
  NOW()
);

-- Get the automation user ID
SELECT id FROM auth.users WHERE email = 'automation@yourdomain.com';
```

### 2. n8n Environment Variables

In your n8n instance, set these environment variables:

#### Via Docker Compose
```yaml
# Add to your docker-compose.n8n.yml
environment:
  - USER_ID=your_user_id_from_above
  - SUPABASE_URL=https://snmdcbrvvzasubdnnsbd.supabase.co
```

#### Via n8n Cloud
1. Go to Settings → Environment Variables
2. Add:
   - `USER_ID`: `your_user_id_from_supabase`
   - `SUPABASE_URL`: `https://snmdcbrvvzasubdnnsbd.supabase.co`

### 3. Credential Updates

#### Supabase Service Role (Recommended)
For production automation, use service role key:

**Name**: `Supabase-ServiceRole`
- **URL**: `https://snmdcbrvvzasubdnnsbd.supabase.co/rest/v1`
- **Headers**:
  - `apikey`: `your_service_role_key`
  - `Authorization`: `Bearer your_service_role_key`
  - `Content-Type`: `application/json`

**Get service role key**: Supabase Dashboard → Settings → API → service_role key

## 🔒 Security Improvements Applied

### Database Level
- ✅ Proper RLS policies with user_id constraints
- ✅ Service role policies for automation
- ✅ Staging table with audit trail

### Workflow Level
- ✅ Proper JSON serialization
- ✅ Error handling for all paths
- ✅ Item-scoped data access
- ✅ Environment variable validation

### Data Integrity
- ✅ All jobs get processed flag set
- ✅ Duplicates handled before AI scoring
- ✅ Proper OpenAI response parsing
- ✅ SQL injection protection via JSON

## 🚀 Deployment Steps

### Step 1: Database Updates
```sql
-- Run the updated database-staging-setup.sql
-- This adds user_id column and proper RLS
```

### Step 2: Get User ID
```sql
-- Option A: Use your existing user
SELECT id, email FROM auth.users WHERE email = 'your_email@gmail.com';

-- Option B: Create automation user (copy the ID)
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'automation@yourdomain.com',
  '{\"provider\":\"system\",\"role\":\"automation\"}',
  '{\"name\":\"Job Search Automation\"}',
  NOW(),
  NOW()
)
RETURNING id;
```

### Step 3: Configure n8n
1. Set USER_ID environment variable
2. Update Supabase credentials to use service role
3. Test credential connections

### Step 4: Import Fixed Workflows
1. **Remove old workflows** (if imported)
2. **Import**: `lean-job-discovery-fixed.json`
3. **Import**: `daily-digest-fixed.json`
4. **Verify** all credentials are connected (green checkmarks)

### Step 5: Test End-to-End
```bash
# 1. Manual execution of job discovery
# - Should see jobs in job_raw table
# - Should see processed=true for all items
# - Should see high-score jobs in job_applications

# 2. Check staging table
SELECT source, processed, COUNT(*)
FROM job_raw
GROUP BY source, processed;

# 3. Verify main table
SELECT source, ai_match_score, COUNT(*)
FROM job_applications
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY source, ai_match_score
ORDER BY ai_match_score DESC;
```

## 🎯 Success Criteria

After fixes are applied:
- ✅ No duplicate jobs reach AI scoring
- ✅ All jobs get proper user_id
- ✅ Staging updates work for every item
- ✅ All workflow paths set processed=true
- ✅ Proper JSON data types throughout
- ✅ OpenAI responses parse correctly
- ✅ Daily digest sends with quality jobs only

## 📊 Monitoring Queries

### Check Processing Health
```sql
-- Should show processed=true for all recent entries
SELECT
  source,
  processed,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM job_raw
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source, processed
ORDER BY source, processed;
```

### Verify No Infinite Loops
```sql
-- Should NOT show any jobs processed multiple times
SELECT
  raw_payload->>'url' as job_url,
  COUNT(*) as times_processed
FROM job_raw
WHERE processed = false
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY raw_payload->>'url'
HAVING COUNT(*) > 1;
```

### Check AI Scoring Success
```sql
-- Should show most jobs getting scored
SELECT
  ai_match_score,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE ai_reasoning IS NOT NULL) as with_reasoning
FROM job_applications
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ai_match_score
ORDER BY ai_match_score DESC;
```

---

**Ready to deploy the fixed version? Follow steps 1-5 above for a bulletproof automation system! 🚀**