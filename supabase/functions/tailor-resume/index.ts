// Supabase Edge Function for AI Resume Tailoring
// This function handles OpenAI API calls securely on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Build enhanced prompt for OpenAI
    const prompt = `You are a professional resume expert and career consultant. Using the MASTER RESUME, COVER LETTER TEMPLATE, and JOB DESCRIPTION below, create a tailored resume and personalized cover letter for this specific position.

JOB DETAILS:
Company: ${job.company}
Role: ${job.role}
Location: ${job.location || 'Not specified'}
Description: ${job.description || 'No description provided'}
Job URL: ${job.url || 'Not provided'}

MASTER RESUME:
${masterResume.resume_md || ''}

COVER LETTER TEMPLATE SYSTEM:
${coverTemplate?.cover_letter_md || `Use this fallback structure:
1. Opening Hook - Match to role type (AI Implementation/Enablement, Product/Program Management, Governance/Risk, or Technical/Web3)
2. Core Value Proposition - Technical validation + Adoption expertise + Governance mindset
3. Relevant Experience - Choose 2-3 bullets most relevant to this job
4. Why This Company - Research-based customization (use any company info you can infer)
5. Professional Closing - Call to action

Key metrics to include: 80% operational reduction, 70%+ user retention, 30-50% faster proficiency, 60% cost reduction.`}

INSTRUCTIONS:
1. **Resume Tailoring:**
   - Emphasize experience and skills most relevant to this specific job
   - Use keywords from the job description naturally throughout
   - Maintain professional formatting and Eric's proven track record
   - Focus on quantifiable achievements (80% reduction, 70%+ retention, etc.)
   - Keep contact information and career timeline consistent

2. **Cover Letter Creation:**
   - Follow the template structure if provided, otherwise use fallback structure
   - If the template document contains MULTIPLE variants (e.g. labeled Variant 1-4 by role family), select the ONE variant that best matches this job's role family and write the letter following that variant — never include the selection instructions or multiple variants in the output
   - Fill every bracketed placeholder ([Date], [Company Name], [Role Title], [PERSONALIZE: ...]) with real values inferred from the job details; today's date is ${new Date().toISOString().slice(0, 10)}
   - Select the opening hook that matches this role type:
     * AI Implementation/Enablement: Focus on building systems + scaling adoption
     * Product/Program Management: Focus on bridging capability with adoption
     * Governance/Risk: Focus on secure systems + compliance
     * Technical/Web3: Focus on production systems + autonomous operations
   - Choose 2-3 experience bullets most relevant to job requirements
   - Research-based company customization (infer from company name, role, description)
   - Include specific metrics: 80%, 70%+, 30-50%, 60%
   - Professional but confident tone, 350-450 words

3. **Quality Standards:**
   - Use Eric's exact achievements and metrics from master resume
   - Maintain consistent voice and professional tone
   - Ensure cover letter feels personalized, not templated
   - Include at least one company-specific detail if possible

Return your response as a JSON object with these exact keys:
{
  "tailored_resume": "The complete tailored resume in markdown format",
  "cover_letter": "A personalized cover letter following the template structure",
  "match_analysis": "Brief analysis of how Eric's background aligns with this role"
}`

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
    }

    const openaiResult = await openaiResponse.json()
    const content = openaiResult.choices?.[0]?.message?.content || ''

    // Parse JSON response from OpenAI
    const jsonMatch = content.match(/\{[\s\S]*\}$/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      tailored_resume: content,
      cover_letter: '',
      match_analysis: 'Analysis not available'
    }

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

    // Log event
    await supabase.from('application_events').insert({
      job_id: jobId,
      user_id: user.id,
      type: 'tailored',
      payload: { resume_version_id: tailoredVersion.id }
    })

    return new Response(
      JSON.stringify({
        success: true,
        resume_version_id: tailoredVersion.id,
        label: tailoredVersion.label
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in tailor-resume function:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})