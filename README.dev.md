# Job Search Platform — Developer README

> **Stack:** Replit (Next.js API) + Supabase (Postgres/Auth/pgvector) + n8n (self‑hosted, Docker)  
> **Docs:** See `job-search-PRD.md` for product requirements and scope. This README focuses on setup, ops, and contributor workflows.

---

## 1) Repo Layout (proposed)
```
.
├─ apps/
│  └─ web/                # Next.js app (public site + private dashboard + API routes)
├─ automation/
│  └─ n8n/                # n8n exported JSON workflows + credentials template
├─ db/
│  ├─ init.sql            # Supabase schema (pgvector, tables, RLS) — mirrors PRD
│  └─ seed.sql            # Optional seed (profile, master resume)
├─ docs/
│  └─ job-search-PRD.md   # Product Requirements Document (PRD)
├─ .env.example           # Replit/Next.js env template
└─ README.dev.md
```

---

## 2) Environments & Secrets

### Replit / Next.js
Create secrets (Replit Secrets UI) or `.env` in dev:
```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=            # for client-only (Next.js)
SUPABASE_SERVICE_ROLE_KEY=    # server-side API routes ONLY

# LLMs (choose one or both)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email (Gmail SMTP example; use app password)
APP_EMAIL=you@example.com
APP_EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Optional
APP_SUBMIT_TO=apply@company.com
NEXT_PUBLIC_SITE_URL=https://your-public-site.com
```

### n8n (Docker)
Use the built-in **Credentials** store. Minimum needed:
- **Supabase REST** (Project URL + Service Role Key)
- **SMTP / Gmail** (for notifications)
- **Slack/Telegram** (if used for Approve/Skip)
- **OpenAI / Anthropic** (if n8n performs embeddings or LLM calls)

> Never commit real secrets. Use `.env.example` as the pattern.

---

## 3) Supabase Setup

1. Create a Supabase project (free tier).  
2. In Dashboard → SQL Editor: run `db/init.sql` (or copy from PRD).  
3. Enable **Row Level Security** (RLS) is included in `init.sql`.  
4. Create your **Auth user** (magic link) — this will be the owner of all rows.  
5. Insert a **Master resume** row in `resume_versions` with `label='Master'` for your `user_id` (optional seed script in `db/seed.sql`).

**Local psql:** (optional)
```
psql $SUPABASE_DB_URL -f db/init.sql
```

---

## 4) Next.js (apps/web) — Dev & Run

**Dev start (Node 18+):**
```
cd apps/web
pnpm i   # or npm i / yarn
pnpm dev # http://localhost:3000
```

**Key routes (MVP):**
- `GET /` — public portfolio homepage
- `GET /blog` — blog index
- `GET /contact` — contact form
- `GET /dashboard` — protected area
- `GET /tracker` — job pipeline
- `POST /api/tailor` — generate tailored resume + cover
- `POST /api/submit` — submit application (email-first)

**Auth:** Use `@supabase/auth-helpers-nextjs` for client session; secure server calls with Service Role key only on server.

---

## 5) n8n — Orchestration

### 5.1 Run locally (Docker Compose)
Create `docker-compose.yml`:
```yaml
version: "3.8"
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=change-me
      - N8N_SECURE_COOKIE=false
    volumes:
      - ./automation/n8n:/home/node/.n8n
```
```
docker compose up -d
# open http://localhost:5678
```

### 5.2 Core Workflows (per PRD)
- **WF-1: Discover & Score (daily cron)**  
  Cron → Fetch jobs (HTTP) → Normalize → Upsert to Supabase → Embeddings → Similarity → Notify (Approve/Skip link).
- **WF-2: Approval Listener (webhook)**  
  On Approve → log → POST `/api/tailor` → POST `/api/submit` → notify → update status.
- **WF-3: Recruiter Replies**  
  IMAP/Gmail trigger → classify → AI reply with time slots → send → create Google Calendar event → notify.

> Export each workflow JSON into `automation/n8n/` for versioning.

---

## 6) Data Model (short reference)

Tables (see full SQL in `db/init.sql`):
- `profiles(id, user_id, display_name, headline, location, avatar_url, created_at)`
- `job_applications(id, user_id, company, role, location, source, url, description, jd_embedding vector(1536), ai_match_score numeric, status, created_at, updated_at)`
- `resume_versions(id, user_id, job_id, label, resume_md, cover_letter_md, created_at)`
- `application_events(id, job_id, user_id, type, payload, created_at)`

**Policy:** All tables RLS: `auth.uid() = user_id`

---

## 7) LLM & Embeddings

- Default: **OpenAI** (`text-embedding-3-small` or `-large`) for embeddings; **gpt-4o-mini** (cheap) or **gpt-4o** (higher quality) for tailoring.  
- Anthropic: swap to `ANTHROPIC_API_KEY` and Claude model calls in `/api/tailor`.  
- Cache resume and JD embeddings; recompute on change only.

**Cost guardrails:**  
- Set max tokens per call; prefer low‑temp (0.0–0.3).  
- Add a daily limit environment var; log token usage (store in `application_events`).

---

## 8) Notifications & Approvals

- **Telegram**: create bot via BotFather → set token in n8n → send message with InlineKeyboard buttons (Approve/Skip) hitting a webhook.  
- **Slack**: create app → Bot OAuth → post message with button → interaction endpoint → webhook.  
- **Email**: include a signed approval link (`/api/approve?jobId=...&token=...`). Token should be HMAC of jobId + timestamp.

---

## 9) Submission Paths

- **Email-first**: `/api/submit` formats cover + resume and sends via SMTP.  
- **Headless form (optional)**: add `/api/submit-form` using Playwright (with strong error handling, screenshots on failure).  
  - **Avoid** login-required “Easy Apply” flows (ToS risk).  
  - Rate-limit and randomize delays.

---

## 10) Security & Compliance

- **Service Role key**: **NEVER** expose to client; server-only.  
- **RLS** enforced on all data; test with an anon client session.  
- **Secrets** in Replit Secrets and n8n Credentials only.  
- **Email deliverability**: prefer a custom domain with SPF/DKIM/DMARC.  
- **Logs & PII**: avoid persisting raw emails beyond necessity; redact where possible.

---

## 11) Dev Tasks (MVP checklist)

- [ ] Import `db/init.sql` into Supabase; create your auth user.  
- [ ] Insert `resume_versions` master row for your user.  
- [ ] Implement `/api/tailor` and `/api/submit` (server-side only).  
- [ ] Build `/dashboard` + `/tracker` with Supabase client (RLS).  
- [ ] n8n WF-1 (cron discovery) and WF-2 (approve → tailor → submit).  
- [ ] Daily summary notification (jobs found, approvals, sent).

---

## 12) Troubleshooting

- **401/403 from Supabase**: Using `SERVICE_ROLE_KEY` on server? RLS policy correct? `user_id` set on row insert?  
- **No Approve click detected**: Check webhook URL exposure (localhost vs public). Use an ngrok tunnel or host n8n where public.  
- **SMTP blocked**: Use Gmail App Password; verify “less secure” settings aren’t needed; consider a provider like Resend/SendGrid (free tiers).  
- **LLM cost spikes**: switch to cheaper model, lower max tokens, cache embeddings.  
- **Slow dashboard**: index `status`, `created_at`; paginate; avoid N+1 fetches.

---

## 13) Runbooks

- **Key rotation**: rotate LLM + SMTP + Supabase keys quarterly.  
- **Backups**: Supabase automated; export weekly CSV (cron job).  
- **Monitoring**: n8n failed executions → Telegram/Email alert; daily success summary.  
- **Upgrades**: pin Node/Next versions; test workflows in a staging branch.  

---

## 14) Roadmap (post‑MVP)

- Reply-handling + Google Calendar integration.  
- Analytics dashboard (conversion funnels, time-to-first-response).  
- Chrome extension for one‑click “Save Job to Tracker”.  
- Mobile‑friendly quick-approve UI.  
- Headless form submit for common ATS patterns (Greenhouse/Lever).

---

## 15) Contributor Notes

- Use conventional commits (`feat:`, `fix:`, `chore:`).  
- PRs must include: scope, screenshots/GIFs, and testing steps.  
- Keep workflows exportable; do not export credentials.  
- Prefer small, iterative changes; update `db/seed.sql` if schema evolves.

---

Happy hunting. Keep it simple, ship daily. 🚀
