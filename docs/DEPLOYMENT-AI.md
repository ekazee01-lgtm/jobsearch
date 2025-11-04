# AI Features Deployment Guide

## Overview
This guide covers deploying the secure AI features for the Job Search Platform, which uses Supabase Edge Functions to safely handle OpenAI API calls.

## Architecture

### Security Model
- **Frontend**: Static site on GitHub Pages (no API keys exposed)
- **Backend**: Supabase Edge Functions (secure serverless environment)
- **AI Provider**: OpenAI GPT-4o-mini via server-side proxy
- **Database**: Supabase PostgreSQL with pgvector extension

### Request Flow
```
Browser → Supabase Edge Function → OpenAI API → Database → Browser
```

## Prerequisites

### 1. Supabase CLI Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref snmdcbrvvzasubdnnsbd
```

### 2. OpenAI API Key
1. Get API key from https://platform.openai.com/api-keys
2. Store securely in Supabase secrets (see below)

## Database Setup

### 1. Apply AI Schema Updates
Run the SQL commands from `database-ai-updates.sql` in your Supabase SQL editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add unique constraint for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_versions_user_label
ON resume_versions(user_id, label);
```

## Edge Functions Deployment

### 1. Set Environment Variables
```bash
# Set OpenAI API key as Supabase secret
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Set Supabase service role key (required for Edge Functions)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Set Supabase URL (required for database operations)
supabase secrets set SUPABASE_URL=https://snmdcbrvvzasubdnnsbd.supabase.co
```

**Important**: The service role key can be found in your Supabase project settings under API → Project API keys → service_role (secret). This key is required for the Edge Function to access the database with elevated permissions.

### 2. Deploy Edge Function
```bash
# Deploy the tailor-resume function
supabase functions deploy tailor-resume

# Verify deployment
supabase functions list
```

### 3. Test Function
```bash
# Test locally (optional)
supabase functions serve

# Test deployed function
curl -X POST 'https://snmdcbrvvzasubdnnsbd.supabase.co/functions/v1/tailor-resume' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jobId": "test-job-id"}'
```

## Frontend Integration

### Files Updated
- `js/ai-features-secure.js` - Secure AI features class
- `src/tracker.js` - Updated to use secure backend
- `tracker.html` - Updated script references

### Key Changes
1. **Removed Direct API Calls**: No more browser-to-OpenAI requests
2. **Added Authentication**: All Edge Function calls require valid session
3. **Secure Token Handling**: Uses Supabase session tokens

## Configuration

### Environment Variables (Frontend)
Already configured in your project:
```javascript
const SUPABASE_URL = 'https://snmdcbrvvzasubdnnsbd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Edge Function URL
```javascript
const functionsUrl = 'https://snmdcbrvvzasubdnnsbd.supabase.co/functions/v1'
```

## Security Features

### 1. Row Level Security (RLS)
- All database operations enforce user isolation
- Users can only access their own data
- Edge Functions respect RLS policies

### 2. API Key Protection
- OpenAI API key stored in Supabase secrets
- Never exposed to client-side code
- Rotatable without frontend changes

### 3. Authentication Required
- All AI features require valid Supabase session
- Automatic token refresh handled by client
- Graceful fallback for unauthenticated users

## Monitoring & Debugging

### Edge Function Logs
```bash
# View function logs
supabase functions logs tailor-resume

# Follow logs in real-time
supabase functions logs tailor-resume --follow
```

### Common Issues

#### 1. CORS Errors
- **Problem**: Direct OpenAI API calls from browser
- **Solution**: Use Edge Functions (already implemented)

#### 2. Authentication Failures
- **Problem**: Invalid or expired session tokens
- **Solution**: Check `supabase.auth.getSession()` response

#### 3. Database Constraints
- **Problem**: Upsert operations failing
- **Solution**: Ensure UNIQUE constraints are applied

## Testing

### 1. Unit Testing
Test AI features with mock data:
```javascript
// Test resume tailoring
const aiFeatures = new AIFeaturesSecure(supabase);
const result = await aiFeatures.tailorResume('job-id', 'user-id');
console.log('Tailored resume:', result);
```

### 2. Integration Testing
1. Create test job application
2. Trigger resume tailoring
3. Verify generated resume in database
4. Check Edge Function logs for errors

## Deployment Checklist

- [ ] Database schema updated with AI tables
- [ ] pgvector extension enabled
- [ ] OpenAI API key set in Supabase secrets
- [ ] Edge Function deployed and tested
- [ ] Frontend updated to use secure backend
- [ ] RLS policies verified
- [ ] Authentication flow tested
- [ ] Error handling implemented

## Cost Considerations

### OpenAI API Usage
- Model: GPT-4o-mini (cost-effective)
- Average tokens per request: ~3000-4000
- Estimated cost: $0.01-0.02 per resume tailoring

### Supabase Edge Functions
- Free tier: 500,000 invocations/month
- Paid tier: $2/million invocations

## Maintenance

### Regular Tasks
1. Monitor OpenAI API usage and costs
2. Review Edge Function logs for errors
3. Update AI prompts for better results
4. Rotate API keys periodically

### Updates
- Edge Functions can be updated without frontend changes
- Database schema changes require coordination
- AI model upgrades handled server-side

---

**Last Updated**: November 3, 2024
**Architecture**: Static Frontend + Serverless Backend
**Security**: Zero client-side API keys, full RLS protection