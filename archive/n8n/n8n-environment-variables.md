# n8n Environment Variables - REQUIRED SETUP

## Copy-Paste These Into n8n Settings > Environment Variables

### **Core Infrastructure**
```
USER_ID=542413a9-b564-423c-96c9-99d51cc01107
NOTIFICATION_EMAIL=ekazee.careers@gmail.com
DEFAULT_JOB_STATUS=Ready to Apply
AI_SCORE_THRESHOLD=8
```

### **Database (Get from Supabase Settings)**
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (your service role key)
```

### **AI Services (You have these)**
```
OPENAI_API_KEY=sk-... (your OpenAI key)
ANTHROPIC_API_KEY=sk-ant-... (your Anthropic key)
```

### **Resume & Assets**
```
RESUME_URL=https://raw.githubusercontent.com/your-repo/assets/master-resume.md
ASSETS_BASE_PATH=/data/assets
```

## How to Find Your Supabase Keys:

1. **Go to**: [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select your project**
3. **Click Settings > API**
4. **Copy**:
   - **URL**: `https://xxx.supabase.co`
   - **Service Role Key**: `eyJ...` (secret key)

## How to Add in n8n:

### **Method 1: Web Interface**
1. Go to http://localhost:5678
2. Click Settings (gear icon)
3. Click "Environment Variables"
4. Add each variable above

### **Method 2: Update .env.n8n file**
```bash
echo "USER_ID=542413a9-b564-423c-96c9-99d51cc01107" >> .env.n8n
echo "AI_SCORE_THRESHOLD=8" >> .env.n8n
echo "DEFAULT_JOB_STATUS=Ready to Apply" >> .env.n8n
echo "NOTIFICATION_EMAIL=ekazee.careers@gmail.com" >> .env.n8n
```

Then restart n8n:
```bash
docker restart jobsearch-n8n
```

## Test Your Setup:

Create a test Function node with:
```javascript
return [{
  json: {
    user_id: process.env.USER_ID,
    supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    openai_key: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
    notification_email: process.env.NOTIFICATION_EMAIL
  }
}];
```