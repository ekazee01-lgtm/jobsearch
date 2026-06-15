// Phase 0 submission planner.
// Produces reviewable routing plans and canonical payloads. It never performs
// an outward action, opens an ATS page, sends email, or submits an application.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  createAdminClient,
  jsonResponse,
} from '../_shared/admin.ts'
import {
  candidateAnswers,
  normalizedPayloadString,
  routeJob,
} from '../_shared/submission-plan.ts'

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization header required' }, 401)
    }

    const supabase = createAdminClient()
    const token = authHeader.slice('Bearer '.length)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid authorization token' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const requestedIds = Array.isArray(body.jobIds)
      ? body.jobIds.filter((id: unknown) => typeof id === 'string')
      : []

    let jobsQuery = supabase
      .from('job_applications')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['To Review', 'Bookmarked', 'Applying'])
      .order('created_at', { ascending: false })

    if (requestedIds.length > 0) {
      jobsQuery = jobsQuery.in('id', requestedIds)
    }

    const { data: jobs, error: jobsError } = await jobsQuery
    if (jobsError) throw new Error(`Job query failed: ${jobsError.message}`)

    const jobIds = (jobs ?? []).map((job) => job.id)
    const materialsByJob = new Map<string, Record<string, unknown>>()
    const { data: masterResume, error: masterError } = await supabase
      .from('resume_versions')
      .select('resume_md')
      .eq('user_id', user.id)
      .eq('label', 'Master')
      .maybeSingle()
    if (masterError) {
      throw new Error(`Master resume query failed: ${masterError.message}`)
    }

    if (jobIds.length > 0) {
      const { data: materials, error: materialsError } = await supabase
        .from('resume_versions')
        .select('id, job_id, label, resume_md, cover_letter_md, created_at')
        .eq('user_id', user.id)
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
      if (materialsError) {
        throw new Error(`Materials query failed: ${materialsError.message}`)
      }
      for (const material of materials ?? []) {
        if (material.job_id && !materialsByJob.has(material.job_id)) {
          materialsByJob.set(material.job_id, material)
        }
      }
    }

    const standardAnswers = candidateAnswers(user, masterResume?.resume_md ?? '')
    const results: Array<Record<string, unknown>> = []

    for (const job of jobs ?? []) {
      const route = routeJob(job)
      const material = materialsByJob.get(job.id)
      const payload = {
        phase: 0,
        job: {
          id: job.id,
          company: job.company,
          role: job.role,
          location: job.location ?? null,
          url: job.url ?? job.job_url ?? null,
          source: job.source ?? null,
        },
        candidate: Object.fromEntries(
          standardAnswers.map((answer) => [answer.question_key, answer.answer]),
        ),
        materials: material
          ? {
            resume_version_id: material.id,
            label: material.label,
            has_resume: Boolean(normalizedPayloadString(material.resume_md)),
            has_cover_letter: Boolean(normalizedPayloadString(material.cover_letter_md)),
          }
          : {
            resume_version_id: null,
            label: null,
            has_resume: false,
            has_cover_letter: false,
          },
        route: {
          channel: route.channel,
          reason: route.reason,
          evidence: route.evidence,
        },
      }
      const payloadHash = await sha256(JSON.stringify(payload))
      const idempotencyKey = await sha256(job.id)
      const status = route.channel === 'manual' ? 'needs_intervention' : 'queued'
      const { data: createdPlans, error: createError } = await supabase.rpc(
        'create_application_submission_plan',
        {
          p_user_id: user.id,
          p_job_id: job.id,
          p_channel: route.channel,
          p_status: status,
          p_idempotency_key: idempotencyKey,
          p_payload_hash: payloadHash,
          p_route_reason: route.reason,
          p_route_evidence: route.evidence,
          p_payload: payload,
          p_intervention_reason: route.interventionReason ?? null,
          p_answers: standardAnswers,
        },
      )
      if (createError) {
        throw new Error(`Plan creation failed: ${createError.message}`)
      }
      const submission = createdPlans?.[0]
      if (!submission) {
        throw new Error('Plan creation returned no submission row')
      }

      results.push({
        job_id: job.id,
        submission_id: submission.submission_id,
        channel: route.channel,
        status: submission.submission_status,
        result: submission.created ? 'created' : 'unchanged',
        plan_version: submission.submission_plan_version,
      })
    }

    return jsonResponse({
      success: true,
      phase: 0,
      outward_actions: 0,
      jobs_considered: jobs?.length ?? 0,
      plans_created: results.filter((item) => item.result === 'created').length,
      plans_unchanged: results.filter((item) => item.result === 'unchanged').length,
      results,
    })
  } catch (error) {
    console.error('plan-submission failed:', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500)
  }
})
