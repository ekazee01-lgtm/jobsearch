# AI Features Deployment Guide

## Overview

This project uses Supabase Edge Functions to keep OpenAI calls off the client.
The active Supabase project is `hndkhpwzvybbiagnjkdr`.

## Architecture

```text
Browser -> Supabase Edge Function -> OpenAI API -> Supabase database -> Browser
```

- Frontend: static site on GitHub Pages
- Backend: Supabase Edge Functions
- Database: Supabase Postgres
- Auth: Supabase Auth

## Prerequisites

```bash
npm install -g supabase
supabase login
supabase link --project-ref hndkhpwzvybbiagnjkdr
```

## Required Secrets

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

Supabase automatically injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
into Edge Functions. `tailor-resume` uses those built-in secrets plus your
project-specific `OPENAI_API_KEY`.

For the cron-driven automation path, also set:

```bash
supabase secrets set CRON_SECRET=your_random_shared_secret
supabase secrets set USER_ID=your_tracker_user_uuid
supabase secrets set NOTIFICATION_EMAIL=your_email@example.com
supabase secrets set RESEND_API_KEY=your_resend_api_key_here   # optional
```

## Database Setup

Run the SQL from `database-ai-updates.sql` in the Supabase SQL editor when
bootstrapping a fresh environment.

Key expectations:

```sql
create extension if not exists vector;
create unique index if not exists idx_resume_versions_user_label
on resume_versions(user_id, label);
```

## Deploy Edge Functions

```bash
supabase functions deploy tailor-resume
supabase functions deploy discover-jobs --no-verify-jwt
supabase functions deploy daily-digest --no-verify-jwt
supabase functions list
```

## Test `tailor-resume`

```bash
curl -X POST 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1/tailor-resume' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jobId": "test-job-id"}'
```

Expected behavior:

- Valid session token required
- Target `jobId` must belong to the authenticated user
- A tailored resume row is inserted into `public.resume_versions`
- An audit row is inserted into `public.application_events`

## Frontend Configuration

The active browser-side values are:

```javascript
const SUPABASE_URL = 'https://hndkhpwzvybbiagnjkdr.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_gGSkycyet1bMedqzYPwoug_pFm_Z8j-'
const functionsUrl = 'https://hndkhpwzvybbiagnjkdr.supabase.co/functions/v1'
```

## Security Notes

- No OpenAI key is exposed to the browser
- All AI writes happen from the Edge Function
- User-scoped data still relies on Supabase Auth and RLS
- Secrets can be rotated without changing frontend code

## Validation Checklist

- `tailor-resume` deployed
- `discover-jobs` deployed
- `daily-digest` deployed
- `OPENAI_API_KEY` secret set
- `CRON_SECRET` secret set
- `USER_ID` secret set
- `resume_versions` unique index present
- End-to-end tailoring works for an authenticated tracker user
