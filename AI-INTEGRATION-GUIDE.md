# AI Integration Guide - Secure Backend Architecture

## Overview
This guide covers the secure AI integration architecture for the Job Search Platform. The system uses **Supabase Edge Functions** to handle all AI operations securely, with zero client-side API key exposure.

## Architecture

### Security-First Design
- **No Client-Side API Keys**: All OpenAI API calls happen server-side
- **Supabase Edge Functions**: Serverless functions handle AI operations
- **Row Level Security**: Database access is automatically secured
- **Session-Based Auth**: All AI features require valid user authentication

### Data Flow
```
User → Frontend → Supabase Edge Function → OpenAI API → Database → User
```

## Core Features

### 1. Resume Tailoring
- **Input**: Job description and master resume
- **Process**: GPT-4o-mini analyzes job requirements and customizes resume
- **Output**: Tailored resume version stored in database
- **Security**: Processed entirely on secure backend

### 2. Application Preparation
- **Input**: Job details and selected resume version
- **Process**: AI generates personalized cover letter and email
- **Output**: Complete application package ready for submission
- **Security**: No sensitive data exposed to client

### 3. Smart Matching
- **Input**: Job descriptions automatically processed
- **Process**: Vector embeddings created for semantic matching
- **Output**: AI-powered job match scores
- **Security**: Embeddings stored securely in pgvector

## Implementation

### Frontend Integration
The frontend uses the secure `AIFeaturesSecure` class:

```javascript
// Initialize (no API key needed)
const aiFeatures = new AIFeaturesSecure(supabase);

// Tailor resume (calls Edge Function)
const result = await aiFeatures.tailorResume(jobId, userId);

// All operations are authenticated automatically
```

### Backend Processing
Edge Functions handle all AI operations. Model selection follows a tiered strategy:

```typescript
// Generation (resume/cover letter) — Anthropic direct with prompt caching
const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,        // Server-side only
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }]
  })
});

// Scoring (1-10 match) — Haiku or OpenRouter cheap model
const scoringResponse = await fetch(AI_SCORING_BASE_URL + '/v1/messages', {
  headers: { 'x-api-key': AI_SCORING_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: AI_SCORING_MODEL, // e.g. claude-haiku-4-5-20251001
    max_tokens: 50,
    messages: [{ role: 'user', content: scoringPrompt }]
  })
});
```

Both models are configurable via environment variables — swap without code changes.

## User Experience

### Setup Process
1. **No Configuration Required**: Users can start using AI features immediately
2. **Automatic Authentication**: Features work seamlessly with existing login
3. **Zero Setup UI**: No API key prompts or configuration screens

### Feature Access
- Click "🤖 AI" button on any job application
- Access "Manage Resume" to set up master resume
- All AI features available instantly with secure backend

## Security Benefits

### Eliminated Vulnerabilities
- ❌ **No CORS Issues**: Direct browser-to-OpenAI calls eliminated
- ❌ **No API Key Exposure**: Keys never touch client-side code
- ❌ **No Browser Storage**: No sensitive data in localStorage/sessionStorage
- ❌ **No Client-Side Secrets**: Zero configuration required from users

### Enhanced Protection
- ✅ **Server-Side Only**: All API keys stored in Supabase secrets
- ✅ **Automatic RLS**: Database operations respect user isolation
- ✅ **Session Validation**: Every request requires valid authentication
- ✅ **Audit Trail**: All AI operations logged in application_events

## Performance

### Optimizations
- **Edge Functions**: Global deployment for low latency
- **Efficient Models**: GPT-4o-mini for cost-effective processing
- **Vector Search**: Fast job matching with pgvector
- **Caching**: Session-based caching for improved response times

### Monitoring
- **Function Logs**: Real-time monitoring via Supabase dashboard
- **Error Tracking**: Comprehensive error handling and reporting
- **Usage Analytics**: Built-in metrics for AI feature adoption

## Deployment Architecture

### Required Components
1. **Supabase Project**: Database, auth, and Edge Functions
2. **pgvector Extension**: Vector embeddings for job matching
3. **Edge Function**: `tailor-resume` serverless function
4. **Environment Variables**: OpenAI API key in Supabase secrets

### Zero-Config Frontend
- **Static Hosting**: GitHub Pages compatible
- **No Build Process**: Direct HTML/CSS/JS deployment
- **No Environment Variables**: All configuration server-side

## Cost Analysis

### Model Costs (verify current pricing before committing)
- **Generation**: `claude-sonnet-4-6` with prompt caching — ~$0.033/application
- **Scoring**: `claude-haiku-4-5-20251001` — ~$0.0002/job scored
- **At 400 applications**: ~$13-15/month total
- **OpenRouter alternative for scoring**: `google/gemini-flash-1.5` — often cheaper than Haiku; no caching needed for scoring since prompts are short

### Supabase Edge Functions
- **Free Tier**: 500,000 invocations/month
- **Paid Tier**: $2/million invocations
- **Performance**: Sub-second response times globally

## Developer Experience

### Local Development
```bash
# Test Edge Functions locally
supabase functions serve

# Deploy updates
supabase functions deploy tailor-resume
```

### Debugging
```bash
# View function logs
supabase functions logs tailor-resume --follow

# Check secrets
supabase secrets list
```

## Migration from Insecure Architecture

### What Was Removed
- ❌ Client-side OpenAI API key handling
- ❌ Browser-based API calls to OpenAI
- ❌ sessionStorage for API key persistence
- ❌ User configuration requirements

### What Was Added
- ✅ Supabase Edge Functions for AI processing
- ✅ Secure server-side API key management
- ✅ Automatic user authentication integration
- ✅ Enterprise-grade security architecture

## Future Enhancements

### Available Now (Not Future)
- **Batch Processing**: Anthropic and OpenAI both offer Batch APIs at 50% discount for async workloads. Use for non-urgent generation runs (overnight batch instead of real-time).
- **Prompt Caching**: Cache the static system prompt + resume template prefix. ~80% cost reduction on cached tokens. Implemented in the Anthropic HTTP call via `cache_control`.
- **Structured Outputs**: Enforce exact JSON schema on model responses using Anthropic tool use or OpenAI `response_format: json_schema`. Eliminates JSON parse failures.

### Still Planned
- **Advanced Analytics**: Detailed AI usage metrics per model/task
- **Model Auto-Routing**: Automatically select cheapest model that meets quality threshold
- **Custom Prompts**: User-configurable AI behaviors per role type

### Scalability
- **Auto-scaling**: Edge Functions scale automatically
- **Global CDN**: Worldwide function deployment
- **Database Optimization**: Vector index performance tuning
- **Caching Strategy**: Multi-layer response caching

---

**Security Status**: ✅ Production Ready
**API Key Exposure**: ❌ Zero client-side keys
**User Configuration**: ❌ No setup required
**Authentication**: ✅ Fully integrated

*This architecture ensures enterprise-grade security while maintaining the simplicity of a static website deployment.*