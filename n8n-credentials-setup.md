# n8n Credentials Setup Checklist

## 🔐 Required Credentials for Lean Job Discovery

### 1. Supabase Database Connection
**Type**: Custom HTTP Request Headers
- **Name**: `Supabase-JobSearch`
- **URL**: `https://snmdcbrvvzasubdnnsbd.supabase.co/rest/v1`
- **Headers**:
  - `apikey`: `your_supabase_anon_key`
  - `Authorization`: `Bearer your_supabase_anon_key`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=representation`

### 2. OpenAI API for AI Scoring
**Type**: OpenAI API
- **Name**: `OpenAI-JobScoring`
- **API Key**: `your_openai_api_key`
- **Organization**: (optional)

### 3. Email for Daily Digest
**Type**: SMTP
- **Name**: `Gmail-Digest`
- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Security**: `STARTTLS`
- **Username**: `your_email@gmail.com`
- **Password**: `your_app_password` (not regular password!)

## 🧪 Test Your Credentials

### Test Supabase Connection
```bash
# In n8n, create a simple HTTP Request node:
GET {{$credentials.Supabase-JobSearch.url}}/job_applications?select=count&limit=1

# Should return: [{"count": X}]
```

### Test OpenAI Connection
```bash
# In n8n, create an OpenAI node:
Model: gpt-3.5-turbo
Message: "Hello, this is a test"

# Should return a response from GPT-3.5
```

### Test Email
```bash
# In n8n, create an Email Send node:
To: your_email@gmail.com
Subject: "n8n Test"
Body: "This is a test from n8n"

# Should receive email in your inbox
```

## 🔑 Where to Get API Keys

### Supabase Keys
1. Go to your Supabase project dashboard
2. Settings → API → Project API Keys
3. Copy "anon public" key for basic operations
4. Copy "service_role" key for admin operations (use carefully!)

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Add $20-50 credit to your account
4. Copy the key (save it - you won't see it again!)

### Gmail App Password
1. Go to Google Account settings
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate password for "Mail"
4. Copy the 16-character password

## 🚨 Security Notes

- **Never** commit API keys to git
- **Use** environment variables in production
- **Rotate** keys regularly (quarterly)
- **Monitor** usage and billing
- **Limit** permissions where possible

## ✅ Setup Verification

Once all credentials are added:
1. [ ] Supabase connection tested
2. [ ] OpenAI responds to test message
3. [ ] Email sends successfully
4. [ ] All credentials named consistently
5. [ ] No API keys in workflow JSON (only credential references)

## 💡 Next Steps

After credentials are verified:
1. Run the database staging setup SQL
2. Import the lean job discovery workflow
3. Test with a small batch (5-10 jobs)
4. Verify data appears in job_raw table
5. Check AI scoring quality
6. Send first daily digest email

---
**Ready to proceed once all checkboxes are ✅!**