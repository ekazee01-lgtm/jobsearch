# n8n Workflow Development Guide

## Overview
This guide provides specifications and best practices for creating n8n workflows programmatically, specifically for job search automation and general workflow development.

## n8n JSON Structure Specification

### Core Workflow Structure
```json
{
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...},
  "active": false,
  "settings": {},
  "versionId": "unique-id",
  "meta": {
    "instanceId": "n8n"
  },
  "id": "workflow-id",
  "tags": []
}
```

### Node Structure
Each node must have:
```json
{
  "id": "unique-node-id",
  "name": "Human Readable Name",
  "type": "n8n-nodes-base.nodeType",
  "typeVersion": 1,
  "position": [x, y],
  "parameters": {...}
}
```

### Connection Structure
```json
{
  "NodeName": {
    "main": [
      [
        {
          "node": "TargetNodeName",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

## Common Node Types Reference

### Trigger Nodes

#### Schedule Trigger
```json
{
  "id": "schedule1",
  "name": "Daily Check",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.1,
  "position": [250, 300],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "days",
          "daysInterval": 1,
          "triggerAtHour": 9
        }
      ]
    }
  }
}
```

#### Manual Trigger
```json
{
  "type": "n8n-nodes-base.manualTrigger",
  "typeVersion": 1
}
```

#### Webhook Trigger
```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 1,
  "parameters": {
    "path": "webhook-path",
    "method": "POST"
  }
}
```

### Data Processing Nodes

#### Code Node (JavaScript)
```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "jsCode": "// Your JavaScript code here\nreturn items;"
  }
}
```

#### Set Node
```json
{
  "type": "n8n-nodes-base.set",
  "typeVersion": 2,
  "parameters": {
    "values": {
      "string": [
        {
          "name": "fieldName",
          "value": "fieldValue"
        }
      ]
    }
  }
}
```

#### IF Node (Conditional)
```json
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 1,
  "parameters": {
    "conditions": {
      "string": [
        {
          "value1": "={{$json.field}}",
          "operation": "equals",
          "value2": "expectedValue"
        }
      ]
    }
  }
}
```

### External Service Nodes

#### HTTP Request
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/endpoint",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{$credentials.apiKey}}"
        }
      ]
    },
    "options": {}
  }
}
```

#### Email Send (SMTP)
```json
{
  "type": "n8n-nodes-base.emailSend",
  "typeVersion": 2.1,
  "parameters": {
    "fromEmail": "sender@example.com",
    "toEmail": "={{$json.recipient}}",
    "subject": "Email Subject",
    "text": "Email body text",
    "options": {}
  }
}
```

## Job Search Automation Workflows

### Workflow 1: Job Discovery & AI Scoring
```javascript
// Purpose: Discover new jobs and score them with AI
// Frequency: Every 30 minutes
// Nodes: Schedule → HTTP (job boards) → Code (dedupe) → AI Score → Database

const jobDiscoveryWorkflow = {
  name: "Job Discovery with AI Scoring",
  nodes: [
    // Schedule trigger every 30 minutes
    scheduleTrigger("30min"),
    // Fetch from multiple job boards
    httpRequest("Indeed API"),
    httpRequest("LinkedIn Jobs API"),
    httpRequest("Simplify Jobs API"),
    // Merge and deduplicate
    codeNode(`
      const allJobs = $items();
      const unique = [...new Map(allJobs.map(item => 
        [item.json.url, item])).values()];
      return unique;
    `),
    // AI scoring
    httpRequest("OpenAI", {
      body: {
        prompt: "Score this job for AI specialist role fit",
        job: "{{$json}}"
      }
    }),
    // Save to database
    supabaseNode("insert", "job_opportunities")
  ]
};
```

### Workflow 2: Application Automation
```javascript
// Purpose: Auto-apply to high-scoring jobs
// Frequency: Every 2 hours
// Nodes: Database → Filter → Resume Generator → Apply → Update Status

const applicationWorkflow = {
  name: "Automated Application Submission",
  nodes: [
    scheduleTrigger("2hours"),
    supabaseQuery("SELECT * FROM job_opportunities WHERE ai_score >= 8 AND status = 'pending'"),
    codeNode("filter", `
      // Additional filtering logic
      return $json.ai_score >= 8 && !$json.applied;
    `),
    // Generate tailored resume
    httpRequest("OpenAI", {
      prompt: "Tailor resume for {{$json.title}} at {{$json.company}}"
    }),
    // Submit application
    httpRequest("POST", "{{$json.application_url}}"),
    // Update status
    supabaseUpdate("job_opportunities", {status: "applied"})
  ]
};
```

### Workflow 3: Status Monitoring & Follow-ups
```javascript
// Purpose: Monitor application status and send follow-ups
// Frequency: Daily
// Nodes: Database → Check Status → Generate Follow-up → Send → Update

const statusMonitoringWorkflow = {
  name: "Status Monitoring & Follow-ups",
  nodes: [
    scheduleTrigger("daily", "9am"),
    // Get jobs needing follow-up
    supabaseQuery(`
      SELECT * FROM job_opportunities 
      WHERE status = 'applied' 
      AND applied_at < NOW() - INTERVAL '7 days'
      AND (last_followup IS NULL OR last_followup < NOW() - INTERVAL '7 days')
    `),
    // Generate personalized follow-up
    aiNode("Generate follow-up message"),
    // Send follow-up
    emailNode("send_followup"),
    // Update database
    supabaseUpdate("last_followup", "NOW()")
  ]
};
```

### Workflow 4: Network Intelligence
```javascript
// Purpose: LinkedIn research and connection requests
// Frequency: Daily
// Nodes: Database → LinkedIn Search → AI Analysis → Connection Request

const networkIntelligenceWorkflow = {
  name: "Network Intelligence & Outreach",
  nodes: [
    scheduleTrigger("daily"),
    // Get target companies
    supabaseQuery("SELECT DISTINCT company FROM job_opportunities WHERE ai_score >= 8"),
    // LinkedIn search (respecting ToS)
    httpRequest("LinkedIn API", {
      search: "{{$json.company}} hiring manager"
    }),
    // Analyze profiles
    aiNode("Identify relevant connections"),
    // Generate personalized message
    aiNode("Generate connection request"),
    // Store for manual review
    supabaseInsert("network_outreach_queue")
  ]
};
```

### Workflow 5: Weekly Analytics & Insights
```javascript
// Purpose: Generate weekly performance reports
// Frequency: Weekly (Sundays)
// Nodes: Database → Aggregate → AI Analysis → Report → Email

const analyticsWorkflow = {
  name: "Weekly Analytics & Insights",
  nodes: [
    scheduleTrigger("weekly", "Sunday", "6pm"),
    // Gather metrics
    supabaseQuery("SELECT * FROM job_opportunities WHERE created_at > NOW() - INTERVAL '7 days'"),
    // Calculate KPIs
    codeNode(`
      const metrics = {
        total_applications: items.length,
        response_rate: items.filter(i => i.json.response).length / items.length,
        average_ai_score: items.reduce((acc, i) => acc + i.json.ai_score, 0) / items.length,
        top_companies: [...new Set(items.map(i => i.json.company))].slice(0, 10)
      };
      return [{json: metrics}];
    `),
    // Generate insights
    aiNode("Analyze trends and suggest improvements"),
    // Create report
    htmlNode("Generate HTML report"),
    // Send report
    emailNode("weekly_report")
  ]
};
```

## Best Practices

### 1. Node Naming Conventions
- Use descriptive names: "Get Follow-up Candidates" not "HTTP Request"
- Include action verbs: "Send Email", "Update Database", "Filter Results"
- Be consistent: If you use "Get" for queries, always use "Get"

### 2. Error Handling
```json
{
  "continueOnFail": true,
  "alwaysOutputData": true,
  "onError": "continueWorkflow"
}
```

### 3. Expression Syntax
- Access JSON data: `{{$json.fieldName}}`
- Access previous node: `{{$node["NodeName"].json.field}}`
- Use functions: `{{$json.date.toISOString()}}`
- Conditionals: `{{$json.score >= 8 ? 'high' : 'low'}}`

### 4. Position Guidelines
- Start nodes at x=250
- Space nodes 200-250 pixels apart horizontally
- Use y=300 as center line
- Parallel branches: offset y by ±200

### 5. Credential Management
Never hardcode credentials. Always use:
```json
{
  "credentials": {
    "httpHeaderAuth": {
      "id": "{{credentialId}}",
      "name": "API Credentials"
    }
  }
}
```

## Database Schema for Job Search Automation

```sql
-- Main job opportunities table
CREATE TABLE job_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  description TEXT,
  requirements TEXT[],
  
  -- Scoring and status
  ai_score DECIMAL(3,1),
  ai_analysis JSONB,
  status TEXT DEFAULT 'pending',
  company_tier TEXT,
  
  -- Application tracking
  applied_at TIMESTAMP,
  application_method TEXT,
  application_email TEXT,
  recruiter_email TEXT,
  recruiter_name TEXT,
  linkedin_profile TEXT,
  
  -- Follow-up tracking
  last_followup TIMESTAMP,
  followup_count INTEGER DEFAULT 0,
  response_received BOOLEAN DEFAULT FALSE,
  response_date TIMESTAMP,
  
  -- Metadata
  source TEXT,
  location TEXT,
  remote BOOLEAN,
  salary_min INTEGER,
  salary_max INTEGER,
  deadline TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Vector search
  embedding VECTOR(1536)
);

-- Indexes for performance
CREATE INDEX idx_status ON job_opportunities(status);
CREATE INDEX idx_ai_score ON job_opportunities(ai_score DESC);
CREATE INDEX idx_company ON job_opportunities(company);
CREATE INDEX idx_applied_at ON job_opportunities(applied_at);
CREATE INDEX idx_embedding ON job_opportunities USING ivfflat (embedding vector_cosine_ops);
```

## Common Issues and Solutions

### Issue: "Could not import file"
**Solution**: Use simple node types, avoid special characters in strings, validate JSON

### Issue: Credentials not found
**Solution**: Create credentials first, then import workflow, or remove credential references and add manually

### Issue: Node type not found
**Solution**: Check n8n version, use versioned node types (e.g., httpRequest v4.1 vs v3)

### Issue: Workflow doesn't trigger
**Solution**: Ensure workflow is activated, check timezone settings, verify trigger configuration

## Testing Workflows

### Manual Testing
1. Use "Execute Workflow" button
2. Test individual nodes with "Execute Node"
3. Check output data at each step
4. Monitor for errors in each node

### Test Data Generator
```javascript
// Code node to generate test data
const testJobs = [];
for (let i = 0; i < 5; i++) {
  testJobs.push({
    json: {
      id: `test-${i}`,
      title: `Test Job ${i}`,
      company: `Company ${i}`,
      ai_score: Math.floor(Math.random() * 10),
      applied_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
    }
  });
}
return testJobs;
```

## Integration with Your Tech Stack

### Supabase Integration
- Use HTTP Request nodes with Supabase REST API
- Headers: apikey, Authorization (Bearer)
- Use RPC functions for complex queries

### GitHub Actions Integration
```yaml
name: Trigger n8n Workflow
on:
  schedule:
    - cron: '0 */2 * * *'
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger n8n webhook
        run: |
          curl -X POST https://your-n8n.com/webhook/job-search \
            -H "Content-Type: application/json" \
            -d '{"action": "scan_jobs"}'
```

### Python Script Integration
```python
import requests
import json

def trigger_n8n_workflow(webhook_url, data):
    response = requests.post(
        webhook_url,
        json=data,
        headers={'Content-Type': 'application/json'}
    )
    return response.json()

# Trigger job search workflow
result = trigger_n8n_workflow(
    'https://your-n8n.com/webhook/job-search',
    {'source': 'python_script', 'action': 'full_scan'}
)
```

## Monitoring and Optimization

### Key Metrics to Track
- Workflow execution time
- Success/failure rates
- API call counts (for rate limits)
- Database query performance
- Email delivery rates

### Performance Tips
1. Use pagination for large datasets
2. Implement caching where appropriate
3. Batch database operations
4. Use parallel processing for independent tasks
5. Set appropriate timeout values

## Security Best Practices

1. **API Keys**: Store in n8n credentials, never in code
2. **Database Access**: Use read-only credentials where possible
3. **Rate Limiting**: Implement delays between API calls
4. **Data Validation**: Validate all external inputs
5. **Error Messages**: Don't expose sensitive info in logs

## Version Control for Workflows

### Export Format
Always export workflows with:
- Descriptive names
- Version numbers in workflow name
- Comments in code nodes
- Documentation in description fields

### Git Integration
```bash
# Export workflow
n8n export:workflow --id=<workflow-id> --output=./workflows/

# Version control
git add workflows/
git commit -m "feat: Add job search automation workflow v2.1"
git push
```

## Resources

- [n8n Documentation](https://docs.n8n.io)
- [n8n Community](https://community.n8n.io)
- [Node Reference](https://docs.n8n.io/integrations/)
- [Expression Reference](https://docs.n8n.io/code-examples/expressions/)

---

*Last Updated: November 2024*
*Version: 1.0*
*Author: Eric Kazee Job Search Automation System*
