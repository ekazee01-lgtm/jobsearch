# Eric Kazee - Professional Portfolio

AI Adoption Specialist | Legal Technology | Training & Consulting

## About
12+ years helping law firms and businesses leverage AI and technology while maintaining privilege, compliance, and security standards.

## Live Site
🌐 [View Portfolio](https://ekazee01.github.io/jobsearch/)

## Connect
- 💼 [LinkedIn](https://linkedin.com/in/erickazee)
- 📧 [ekazee.careers@gmail.com](mailto:ekazee.careers@gmail.com)
- 🐦 [Twitter/X](https://x.com/ekazee)

## Tech Stack
- Frontend: HTML5, CSS3, JavaScript (static, GitHub Pages)
- Backend: Supabase (Postgres + Auth + RLS + Edge Functions)
- Automation: Supabase Cron (pg_cron) + Edge Functions — serverless, no VPS
- AI: OpenAI via the `tailor-resume` Edge Function

## 🤖 Job Search Automation

Daily automation runs entirely inside Supabase — no servers to maintain. See
[AUTOMATION.md](AUTOMATION.md) for architecture, deployment, and verification.

- `discover-jobs` Edge Function (daily, pg_cron): fetches 9 RSS/Atom job feeds,
  dedupes, inserts into `job_raw`
- `daily-digest` Edge Function (daily, pg_cron): emails a morning summary of
  new jobs, pipeline status, and upcoming interviews via Resend
- Human-in-the-loop: drag a card to **Ready to Apply** in the tracker and click
  Tailor — the existing `tailor-resume` function generates materials

The earlier n8n + VPS design was retired before deployment (over-engineered for
this workload); its workflows are preserved in [archive/n8n/](archive/n8n/).

---

*Currently building: Job search automation and application tracking system*
