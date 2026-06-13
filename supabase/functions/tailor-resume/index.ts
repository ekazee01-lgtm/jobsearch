// Supabase Edge Function for AI Resume Tailoring
// This function handles OpenAI API calls securely on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateTailoredMaterials, TAILORING_MODEL, PROMPT_VERSION } from '../_shared/tailor.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: OPENAI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY')
    }

    // Parse request. resumeLabel selects which resume template to tailor
    // from (rows in resume_versions with job_id null); defaults to 'Master'.
    const { jobId, resumeLabel } = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const templateLabel = typeof resumeLabel === 'string' && resumeLabel.trim() ? resumeLabel.trim() : 'Master'

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('job_applications')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns this job
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: `Job application not found with id: ${jobId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the selected resume template
    const { data: masterResume, error: masterError } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('user_id', user.id)
      .eq('label', templateLabel)
      .single()

    if (masterError || !masterResume) {
      return new Response(
        JSON.stringify({ error: `Resume template "${templateLabel}" not found. Create it under Manage Resumes first.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get cover letter template if available
    const { data: coverTemplate } = await supabase
      .from('resume_versions')
      .select('cover_letter_md')
      .eq('user_id', user.id)
      .eq('label', 'Cover Letter Template')
      .single()

    // Optional positioning profile steers framing (never overrides integrity)
    const { data: profileRow } = await supabase
      .from('resume_versions')
      .select('cover_letter_md')
      .eq('user_id', user.id)
      .eq('label', 'Positioning Profile')
      .single()

    // Generate via the shared tailoring core (validates and throws on bad output)
    const parsed = await generateTailoredMaterials({
      openaiApiKey: OPENAI_API_KEY,
      job,
      masterResumeMd: masterResume.resume_md || '',
      coverTemplateMd: coverTemplate?.cover_letter_md || '',
      positioningProfileMd: profileRow?.cover_letter_md || '',
    })

    // Save tailored resume version. Timestamp suffix keeps labels unique when
    // the same job is re-tailored (resume_versions has UNIQUE(user_id, label)).
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const { data: tailoredVersion, error: saveError } = await supabase
      .from('resume_versions')
      .insert({
        user_id: user.id,
        job_id: jobId,
        label: `Tailored: ${job.company} - ${job.role} (${stamp})`,
        resume_md: parsed.tailored_resume,
        cover_letter_md: parsed.cover_letter
      })
      .select()
      .single()

    if (saveError) {
      throw new Error('Failed to save tailored resume')
    }

    // Log event with provenance: model, prompt version, template, and any
    // requirements the candidate does not demonstrably meet.
    await supabase.from('application_events').insert({
      job_id: jobId,
      user_id: user.id,
      type: 'tailored',
      payload: {
        resume_version_id: tailoredVersion.id,
        model: TAILORING_MODEL,
        prompt_version: PROMPT_VERSION,
        template_label: templateLabel,
        unsupported_requirements: parsed.unsupported_requirements || ''
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        resume_version_id: tailoredVersion.id,
        label: tailoredVersion.label,
        unsupported_requirements: parsed.unsupported_requirements || '',
        match_analysis: parsed.match_analysis || ''
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in tailor-resume function:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})