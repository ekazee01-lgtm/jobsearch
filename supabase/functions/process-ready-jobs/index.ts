// Supabase Edge Function: durable auto-tailoring worker.
// Replaces the browser-side trigger: finds jobs the user moved into the apply
// stage that still lack tailored materials, and generates them server-side so a
// closed tab or device switch can never leave a job un-tailored.
// Invoked by pg_cron with an x-cron-secret header; deploy with --no-verify-jwt.
// Required secrets: CRON_SECRET, USER_ID, OPENAI_API_KEY.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, createAdminClient, jsonResponse, requireCronSecret } from '../_shared/admin.ts'
import { generateTailoredMaterials, TAILORING_MODEL, PROMPT_VERSION } from '../_shared/tailor.ts'

const TRIGGER_STATUS = 'Applying'
const MAX_PER_RUN = 4 // bound generations per run; cron repeats to catch up
const LOCK_TTL_MINUTES = 15

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const unauthorized = requireCronSecret(req)
  if (unauthorized) return unauthorized

  try {
    const USER_ID = Deno.env.get('USER_ID')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!USER_ID) throw new Error('Missing USER_ID')
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')
    const supabase = createAdminClient()

    // Edge Functions can be terminated before finally runs. Expire abandoned
    // claims so a crashed invocation cannot block a job permanently.
    const staleBefore = new Date(Date.now() - LOCK_TTL_MINUTES * 60_000).toISOString()
    const { error: staleLockErr } = await supabase
      .from('tailoring_locks')
      .delete()
      .eq('user_id', USER_ID)
      .lt('claimed_at', staleBefore)
    if (staleLockErr) throw new Error(`stale-lock cleanup failed: ${staleLockErr.message}`)

    // Candidate jobs: in the apply stage, oldest first
    const { data: applyingJobs, error: jobsErr } = await supabase
      .from('job_applications')
      .select('id, company, role, location, description, url')
      .eq('user_id', USER_ID)
      .eq('status', TRIGGER_STATUS)
      .order('updated_at', { ascending: true })
    if (jobsErr) throw new Error(`job query failed: ${jobsErr.message}`)

    const jobs = applyingJobs ?? []
    if (jobs.length === 0) {
      return jsonResponse({ success: true, candidates: 0, tailored: 0, skipped: 0, failures: [] })
    }

    // Which of these already have a tailored version? (idempotency)
    const jobIds = jobs.map((j) => j.id)
    const { data: existing, error: exErr } = await supabase
      .from('resume_versions')
      .select('job_id')
      .eq('user_id', USER_ID)
      .in('job_id', jobIds)
    if (exErr) throw new Error(`existing-version query failed: ${exErr.message}`)
    const alreadyTailored = new Set((existing ?? []).map((r) => r.job_id))

    const todo = jobs.filter((j) => !alreadyTailored.has(j.id)).slice(0, MAX_PER_RUN)
    if (todo.length === 0) {
      return jsonResponse({ success: true, candidates: jobs.length, tailored: 0, skipped: jobs.length, failures: [] })
    }

    // Load the user's templates once
    const { data: master } = await supabase
      .from('resume_versions').select('resume_md')
      .eq('user_id', USER_ID).eq('label', 'Master').single()
    if (!master?.resume_md) {
      throw new Error('Master resume not found — seed it before auto-tailoring runs.')
    }
    const { data: coverTpl } = await supabase
      .from('resume_versions').select('cover_letter_md')
      .eq('user_id', USER_ID).eq('label', 'Cover Letter Template').single()
    const { data: profile } = await supabase
      .from('resume_versions').select('cover_letter_md')
      .eq('user_id', USER_ID).eq('label', 'Positioning Profile').single()

    // Gate: don't auto-generate from a not-yet-seeded setup. The Positioning
    // Profile only exists once the user has run the seed (which also installs
    // the current Master), so its absence means "not ready" — skip the run
    // rather than tailor from a stale/old resume.
    if (!profile?.cover_letter_md?.trim()) {
      return jsonResponse({
        success: true,
        gated: 'Positioning Profile not found — run the seed before auto-tailoring.',
        candidates: jobs.length,
        tailored: 0,
      })
    }

    const stampBase = new Date().toISOString().slice(0, 16).replace('T', ' ')
    let tailored = 0
    const failures: Array<{ job_id: string; error: string }> = []

    // Serial generation to respect rate limits and the function time budget
    let claimSkipped = 0
    for (const job of todo) {
      // Atomic claim: PK on job_id means only one concurrent run can hold it.
      const { error: claimErr } = await supabase
        .from('tailoring_locks')
        .insert({ job_id: job.id, user_id: USER_ID })
      if (claimErr) {
        if (claimErr.code === '23505') {
          // Unique violation — another run is generating this job right now
          claimSkipped++
          continue
        }
        failures.push({ job_id: job.id, error: `claim failed: ${claimErr.message}` })
        continue
      }

      try {
        // Re-verify under the lock: a concurrent run may have just finished one
        const { data: nowExisting } = await supabase
          .from('resume_versions').select('id')
          .eq('user_id', USER_ID).eq('job_id', job.id).limit(1)
        if (nowExisting && nowExisting.length > 0) {
          continue
        }

        const result = await generateTailoredMaterials({
          openaiApiKey: OPENAI_API_KEY,
          job,
          masterResumeMd: master.resume_md,
          coverTemplateMd: coverTpl?.cover_letter_md || '',
          positioningProfileMd: profile?.cover_letter_md || '',
        })

        const { data: version, error: saveErr } = await supabase
          .from('resume_versions')
          .insert({
            user_id: USER_ID,
            job_id: job.id,
            label: `Tailored: ${job.company} - ${job.role} (${stampBase})`,
            resume_md: result.tailored_resume,
            cover_letter_md: result.cover_letter,
          })
          .select('id')
          .single()
        if (saveErr) throw new Error(saveErr.message)

        await supabase.from('application_events').insert({
          job_id: job.id,
          user_id: USER_ID,
          type: 'tailored',
          payload: {
            resume_version_id: version.id,
            model: TAILORING_MODEL,
            prompt_version: PROMPT_VERSION,
            template_label: 'Master',
            source: 'process-ready-jobs',
            role_family: result.role_family,
            keywords_matched: result.keywords_matched,
            unsupported_requirements: result.unsupported_requirements,
          },
        })
        tailored++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`tailor failed for job ${job.id}:`, msg)
        failures.push({ job_id: job.id, error: msg })
      } finally {
        // Release the claim: transient lock, not a permanent processed-marker.
        // Dedup across runs is handled by the resume_versions existence check.
        const { error: releaseErr } = await supabase
          .from('tailoring_locks')
          .delete()
          .eq('job_id', job.id)
          .eq('user_id', USER_ID)
        if (releaseErr) {
          console.error(`lock release failed for job ${job.id}:`, releaseErr.message)
          failures.push({ job_id: job.id, error: `lock release failed: ${releaseErr.message}` })
        }
      }
    }

    const summary = {
      success: true,
      candidates: jobs.length,
      tailored,
      skipped: jobs.length - todo.length,
      claim_skipped: claimSkipped,
      remaining: Math.max(0, jobs.length - alreadyTailored.size - tailored),
      failures,
    }
    console.log('process-ready-jobs summary:', JSON.stringify(summary))
    return jsonResponse(summary)
  } catch (error) {
    console.error('Error in process-ready-jobs:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
