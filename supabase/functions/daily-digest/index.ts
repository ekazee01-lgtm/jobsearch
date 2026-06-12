// Supabase Edge Function: daily morning digest email.
// Replaces the retired external daily digest workflow: summarizes jobs
// promoted to the tracker in the last 24h, the application pipeline by status,
// and upcoming interviews, then emails the summary via Resend.
// Invoked by pg_cron with an x-cron-secret header; deploy with --no-verify-jwt.
// Required secret: CRON_SECRET.
// Optional secrets: RESEND_API_KEY, NOTIFICATION_EMAIL, DIGEST_FROM_EMAIL.
// If email is not configured yet, the function returns a successful skipped
// summary so cron stays healthy while the rest of the workflow runs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, createAdminClient, jsonResponse, requireCronSecret } from '../_shared/admin.ts'

const MAX_JOBS_LISTED = 30

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMatchPercent(score: number | null): string {
  if (score === null || score === undefined) return ''
  const percent = score <= 1 ? score * 100 : score * 10
  return `${Math.round(percent)}% match`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const unauthorized = requireCronSecret(req)
  if (unauthorized) return unauthorized

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL')

    const supabase = createAdminClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: newJobs, error: newJobsError } = await supabase
      .from('job_applications')
      .select('role, company, url, ai_match_score')
      .eq('status', 'To Review')
      .gte('created_at', since)
      .order('ai_match_score', { ascending: false })
    if (newJobsError) throw new Error(`job_applications query failed: ${newJobsError.message}`)

    const { count: rawCount, error: rawError } = await supabase
      .from('job_raw')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (rawError) console.error('job_raw count failed:', rawError.message)

    const { data: applications, error: appsError } = await supabase
      .from('job_applications')
      .select('status')
    if (appsError) throw new Error(`job_applications status query failed: ${appsError.message}`)

    const statusCounts: Record<string, number> = {}
    for (const app of applications ?? []) {
      statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1
    }

    let interviews: Array<{ company: string; position: string; interview_datetime: string }> = []
    const { data: interviewData, error: interviewError } = await supabase
      .from('interview_schedule')
      .select('company, position, interview_datetime')
      .gte('interview_datetime', new Date().toISOString())
      .order('interview_datetime', { ascending: true })
      .limit(10)
    if (interviewError) {
      console.error('interview_schedule query skipped:', interviewError.message)
    } else {
      interviews = interviewData ?? []
    }

    const jobs = newJobs ?? []
    const jobsListed = jobs.slice(0, MAX_JOBS_LISTED)
    const jobItems = jobsListed
      .map((job) =>
        `<li><a href="${escapeHtml(job.url ?? '#')}">${escapeHtml(job.role)}</a> - ${escapeHtml(job.company)}` +
        (job.ai_match_score ? ` (${formatMatchPercent(job.ai_match_score)})` : '') +
        `</li>`
      )
      .join('\n')
    const moreNote = jobs.length > MAX_JOBS_LISTED
      ? `<p>...and ${jobs.length - MAX_JOBS_LISTED} more in the tracker.</p>`
      : ''

    const statusRows = Object.entries(statusCounts)
      .map(([status, count]) => `<tr><td>${escapeHtml(status)}</td><td>${count}</td></tr>`)
      .join('\n')

    const interviewItems = interviews
      .map((interview) => `<li>${escapeHtml(interview.interview_datetime)} - ${escapeHtml(interview.company)} (${escapeHtml(interview.position)})</li>`)
      .join('\n')

    const today = new Date().toISOString().slice(0, 10)
    const html = `
<h2>Job Search Digest - ${today}</h2>
<h3>${jobs.length} relevant job(s) added to the tracker in the last 24h</h3>
<p>(${rawCount ?? '?'} raw feed items fetched; only keyword-relevant ones are promoted)</p>
${jobs.length ? `<ul>${jobItems}</ul>${moreNote}` : '<p>No relevant jobs found. Feeds may be quiet or check the discover-jobs logs.</p>'}
<h3>Pipeline</h3>
${statusRows ? `<table border="1" cellpadding="4" cellspacing="0"><tr><th>Status</th><th>Count</th></tr>${statusRows}</table>` : '<p>No applications tracked yet.</p>'}
<h3>Upcoming interviews</h3>
${interviewItems ? `<ul>${interviewItems}</ul>` : '<p>None scheduled.</p>'}
<p><a href="https://ekazee01-lgtm.github.io/jobsearch/tracker.html">Open the tracker</a></p>
`

    let emailSent = false
    let skippedReason: string | null = null
    if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
      skippedReason = 'Email delivery skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not configured'
      console.warn(skippedReason)
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('DIGEST_FROM_EMAIL') || 'Job Search Digest <onboarding@resend.dev>',
          to: [NOTIFICATION_EMAIL],
          subject: `Job Search Digest ${today}: ${jobs.length} new, ${statusCounts.Interview ?? 0} interviewing`,
          html,
        }),
      })
      if (!emailRes.ok) {
        const errorBody = await emailRes.text()
        throw new Error(`Resend API error (${emailRes.status}): ${errorBody}`)
      }
      emailSent = true
    }

    const summary = {
      success: true,
      new_relevant_jobs: jobs.length,
      raw_fetched_24h: rawCount ?? null,
      status_counts: statusCounts,
      upcoming_interviews: interviews.length,
      email_sent: emailSent,
      skipped_reason: skippedReason,
    }
    console.log('daily-digest summary:', JSON.stringify(summary))
    return jsonResponse(summary)
  } catch (error) {
    console.error('Error in daily-digest function:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
