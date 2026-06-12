# Job Search Platform — Product Requirements Document (PRD)

**Owner:** Eric Kazee  
**Date:** 2025‑11‑03  
**Version:** 1.0  
**Status:** Draft (MVP scope locked; extensions noted)  

---

## 1) Project Overview

Build a personal job‑search platform with two faces:

1) **Public site** — a polished portfolio (LinkedIn‑style but more artistic) with Home, Blog, and Contact.  
2) **Private ops** — a hidden dashboard that automates job discovery → scoring → human approval → resume tailoring → application submission → recruiter reply handling → scheduling.

**Architecture (decided):** **Replit (Next.js app + API)** + **Supabase (Postgres/Auth/pgvector)** + **n8n (automation orchestrator, self‑hosted via Docker)**. Optional headless submission via Puppeteer/Playwright where safe. Notifications via Slack/Telegram/Email; Calendar via Google.

**Primary objective (6‑month horizon):** Maximize high‑quality applications and interviews while minimizing time and cash spend (prefer free tiers, existing subscriptions).

---

## 2) Goals & Non‑Goals

### Goals
- **G1:** Public portfolio site live, fast, and visually distinct from LinkedIn (Home, Blog, Contact).
- **G2:** Daily automated job discovery with de‑duplication and scoring against resume.
- **G3:** One‑click **approve/skip** workflow for candidate (human‑in‑the‑loop).
- **G4:** Auto‑tailor resume + cover letter per approved job and submit application via email or safe web form.
- **G5:** Monitor dedicated inbox for recruiter replies; auto‑respond with availability and add to calendar.
- **G6:** Track everything in Supabase; show status and metrics in dashboard.
- **G7:** Keep costs ≤ **$20/month** to start; prefer self‑hosted n8n and free tiers.

### Non‑Goals (MVP)
- Multi‑user SaaS; marketplace features.
- LinkedIn “Easy Apply” automation that requires logging into LinkedIn (ToS‑sensitive).
- Mobile app; browser extension (nice‑to‑have later).
- Advanced ML training beyond embeddings + LLM calls.

---

## 3) Personas & User Stories

**Primary Persona:** Eric (solo operator), savvy with AI/dev tools, wants speed and control.  

**Core User Stories**
- **US‑1 (Portfolio):** As Eric, I want a stylish Home with profile, timeline, skills visual, “getting to know me,” and featured projects.  
- **US‑2 (Blog):** As Eric, I want to publish short musings with tags, drafts, and scheduled posts.  
- **US‑3 (Discovery):** As Eric, I want daily curated job lists matching my skills with a relevance score.  
- **US‑4 (Approval):** As Eric, I want a simple Approve/Skip action per job from Slack/Telegram/Email.  
- **US‑5 (Tailor):** As Eric, I want an AI‑tailored resume and cover letter stored per job, auditable.  
- **US‑6 (Apply):** As Eric, I want applications submitted automatically via email or safe web forms and logged.  
- **US‑7 (Replies):** As Eric, I want recruiter replies detected, auto‑responded with times, and calendar invites created.  
- **US‑8 (Dashboard):** As Eric, I want a pipeline view (To Review → Applying → Applied → Interview → Offer/Rejected) and weekly metrics.  
- **US‑9 (Cost):** As Eric, I want costs capped and observable.

---

## 4) Functional Requirements

### 4.1 Public Site (Next.js on Replit or GitHub Pages)
- **Home**: Hero, tagline, stats, interactive timeline, skills visual, getting‑to‑know‑me, featured projects.
- **Blog**: List with pagination; post page (MD/MDX); tags; RSS.
- **Contact**: Form posts to n8n or Supabase Edge Function → email notification.

### 4.2 Private Dashboard (Next.js protected routes)
- Authenticated routes: `/dashboard`, `/tracker`, `/resumes`, `/analytics`.
- **Tracker**: Kanban or table with filters, inline status updates, links to job posting and artifacts.
- **Resumes**: Master + tailored versions (view, copy, export).
- **Analytics**: Submissions by week, approvals rate, interviews scheduled, conversion to interview/offer.

### 4.3 n8n Orchestrations
- **Daily Discovery (07:00)**  
  - Sources: job APIs (e.g., Adzuna/RapidAPI) or custom scrapers via Replit.  
  - Deduplicate; write to `job_applications`.  
  - Compute `jd_embedding` (OpenAI embeddings or local endpoint).  
  - Compute similarity with master resume embedding; write `ai_match_score`.  
  - Notify via Slack/Telegram/Email for scores ≥ threshold with Approve/Skip links.
- **Approval Intake**  
  - Webhook receives approval; logs `application_events` type=`approved`.
- **Tailor & Submit**  
  - POST `/api/tailor` (Replit) → save tailored `resume_versions` for job.  
  - POST `/api/submit` (Replit) → email submission (default) or safe headless form; log result; update status.
- **Reply Handling**  
  - IMAP/Gmail trigger watches inbox; detects recruiter emails.  
  - AI drafts reply with 2–3 time slots; send; on confirm → create Google Calendar event; notify Eric.

---

## 5) Non‑Functional Requirements

- **Security**: Supabase RLS for all PII; service‑role key server‑side only. Secrets in Replit/n8n vaults.  
- **Privacy**: Job data private; public site separated from private ops.  
- **Reliability**: Idempotent upserts; retries on transient failures; alert on scrape/submit errors.  
- **Performance**: Discovery + scoring completes in < 10 minutes daily. Dashboard loads < 2s p95.  
- **Costs**: ≤ $20/month initial; LLM spend ≤ $10/month target (use smaller models, cache embeddings).  
- **Compliance**: Respect site ToS; avoid fragile flows requiring account logins for apply (no LinkedIn Easy Apply).

---

## 6) Data Model (Supabase / Postgres)

```sql
-- Extensions
create extension if not exists vector;

-- Profiles
table profiles (
  id uuid pk, user_id uuid fk auth.users, display_name text, headline text,
  location text, avatar_url text, created_at timestamptz default now()
);

-- Job applications
table job_applications (
  id uuid pk, user_id uuid fk auth.users, company text, role text,
  location text, source text, url text, description text,
  jd_embedding vector(1536), ai_match_score numeric,
  status text default 'To Review', created_at timestamptz default now(), updated_at timestamptz default now()
);

-- Resume versions
table resume_versions (
  id uuid pk, user_id uuid fk auth.users, job_id uuid fk job_applications,
  label text, resume_md text, cover_letter_md text, created_at timestamptz default now()
);

-- Application events (audit)
table application_events (
  id uuid pk, job_id uuid fk job_applications, user_id uuid fk auth.users,
  type text, payload jsonb, created_at timestamptz default now()
);
```

**RLS policies:** user can `select/insert/update/delete` rows where `user_id = auth.uid()`.

---

## 7) API Endpoints (Replit / Next.js)

- `POST /api/tailor`  
  **Body:** `{ jobId }`  
  **Headers:** `x-user-id` (Supabase UID)  
  **Action:** Fetch job + master resume → call LLM → save tailored resume + cover letter → log event → return `resume_version_id`.

- `POST /api/submit`  
  **Body:** `{ jobId, resumeVersionId }`  
  **Action:** Email submission (Gmail SMTP) or safe form submit → update `job_applications.status='Applied'` → log event.

- `GET /api/approve?jobId=...&token=...`  
  **Action:** Validate token → mark approved → trigger n8n webhook or internal queue.

- (Optional) `POST /api/scrape` for custom scraping behind a secret token.

**Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, `APP_EMAIL`, `APP_EMAIL_APP_PASSWORD`.

---

## 8) Automation Flows (n8n)

- **WF‑1: Discover & Score (daily cron)**  
  1. HTTP → fetch jobs from sources.  
  2. Function → normalize/dedupe.  
  3. HTTP → Supabase upsert.  
  4. Embeddings → for each JD.  
  5. Function → cosine similarity vs master resume embedding.  
  6. IF → score ≥ threshold → Notify.  
  7. Notify → Slack/Telegram/Email with Approve/Skip links.
- **WF‑2: Approval Listener (webhook)**  
  - On Approve → log event → call `/api/tailor` → call `/api/submit` → Notify result.
- **WF‑3: Recruiter Replies**  
  - IMAP/Gmail trigger → classify → AI draft reply with time slots → send → create calendar event on confirm → Notify.

---

## 9) UX Notes

- Public site: dark/light toggle; parallax hero; Framer Motion micro‑animations.  
- Dashboard: compact Kanban with quick filters; “Open JD,” “Open tailored resume,” “Resend.”  
- Notifications: Keep short; include score, why‑fit blurb, link to JD, and Approve/Skip.

---

## 10) Metrics & Success Criteria

- **Leading:** # new relevant jobs/day; approval rate; time‑to‑submit after approval; % automated submissions succeeded.  
- **Lagging:** Interviews/week; offers; conversion Applied → Interview → Offer.  
- **System health:** Discovery errors, submission failures, LLM token usage, total monthly cost.

---

## 11) Risks & Mitigations

- **Job source volatility / ToS:** Prefer APIs/RSS; throttle; avoid login‑required “Easy Apply.”  
- **LLM cost creep:** Cache embeddings; default to smaller models; cap usage in env.  
- **Email deliverability:** Use proper SPF/DKIM; keep HTML simple; consider custom domain inbox.  
- **Headless fragility:** Email route first; form submit only for stable patterns; add screenshots on error.

---

## 12) MVP Scope (4–7 days)

- Public site (Home/Blog/Contact) + basic theme.  
- Supabase schema + RLS; seed master resume.  
- n8n WF‑1 (discover/score/notify).  
- Replit `/api/tailor` + `/api/submit` (email path).  
- WF‑2 Approve→Tailor→Submit + notifications.  
- Dashboard: basic tracker view (status change, links).

**Post‑MVP**: Recruiter reply handling + calendar, analytics, headless form submit, Chrome extension, mobile‑friendly apply.

---

## 13) Operational Runbooks

- **Rotate keys** quarterly; store secrets only in Replit/n8n vaults.  
- **Backups**: Supabase automated; export weekly CSV snapshot for job/resume tables.  
- **Monitoring**: n8n failed executions alert via email/Telegram; daily summary message.  
- **Cost check**: Track LLM tokens weekly; switch to cheaper models if >$10/month.

---

## 14) Open Questions

- Preferred notification channel default (Telegram vs Slack vs Email)?  
- Which job sources have dependable APIs for your target roles?  
- Do we need a simple review UI before sending the first recruiter reply (manual approve of the AI draft)?  
- Will we support cover‑letter always, or “on when requested”?

---

## 15) Acceptance Criteria (MVP)

- Public portfolio accessible; Lighthouse performance ≥ 85.  
- Daily discovery populates ≥ 10 unique jobs on average; scores present.  
- Approve click produces tailored resume + cover + sent email, logged in DB.  
- Dashboard shows status changes and artifacts for each job.  
- End‑to‑end run produces a daily summary notification.
