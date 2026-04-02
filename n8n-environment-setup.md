# n8n Environment Variables Setup

## Required Environment Variables

Add these to your n8n environment (Settings > Environment Variables or .env file):

### **Database & Storage**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
USER_ID=542413a9-b564-423c-96c9-99d51cc01107
```

### **AI Services**
```
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### **Email & Communication**
```
GMAIL_CLIENT_ID=your-gmail-oauth-client-id
GMAIL_CLIENT_SECRET=your-gmail-oauth-client-secret
NOTIFICATION_EMAIL=ekazee.careers@gmail.com
```

### **Resume & Assets**
```
RESUME_URL=https://your-supabase-bucket/master-resume.md
COVER_TEMPLATE_URL=https://your-supabase-bucket/cover-letter-templates.md
ASSETS_PATH=/data/assets
```

### **Job Discovery**
```
GOOGLE_ALERTS_RSS_URL=your-google-alerts-rss-feed-url
DEFAULT_JOB_STATUS=Ready to Apply
AI_SCORE_THRESHOLD=8
```

## How to Add in n8n Docker

### Method 1: Update .env.n8n file
Add these variables to your `.env.n8n` file:

```bash
echo "USER_ID=542413a9-b564-423c-96c9-99d51cc01107" >> .env.n8n
echo "DEFAULT_JOB_STATUS=Ready to Apply" >> .env.n8n
echo "AI_SCORE_THRESHOLD=8" >> .env.n8n
echo "NOTIFICATION_EMAIL=ekazee.careers@gmail.com" >> .env.n8n
```

### Method 2: Set via Docker Environment
Update your docker-compose.n8n.yml to include:

```yaml
environment:
  - USER_ID=542413a9-b564-423c-96c9-99d51cc01107
  - DEFAULT_JOB_STATUS=Ready to Apply
  - AI_SCORE_THRESHOLD=8
  - NOTIFICATION_EMAIL=ekazee.careers@gmail.com
```

### Method 3: n8n Web Interface
1. Go to n8n web interface (http://localhost:5678)
2. Click Settings > Environment Variables
3. Add each variable with its value

## Testing Environment Variables

Test in a Function node:
```javascript
return [{
  json: {
    user_id: process.env.USER_ID,
    notification_email: process.env.NOTIFICATION_EMAIL,
    ai_threshold: process.env.AI_SCORE_THRESHOLD
  }
}];
```