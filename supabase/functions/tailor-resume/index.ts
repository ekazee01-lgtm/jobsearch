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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    // Parse request
    const { jobId } = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

    // Get master resume
    const { data: masterResume, error: masterError } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('user_id', user.id)
      .eq('label', 'Master')
      .single()

    if (masterError || !masterResume) {
      return new Response(
        JSON.stringify({ error: 'Master resume not found. Please create a master resume first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build prompt for OpenAI
    const prompt = `You are a professional resume expert. Using the MASTER RESUME and JOB DESCRIPTION below, create a tailored resume and cover letter that highlights the most relevant experience and skills for this specific position.

JOB DETAILS:
Company: ${job.company}
Role: ${job.role}
Location: ${job.location || 'Not specified'}
Description: ${job.description || 'No description provided'}

MASTER RESUME:
${masterResume.resume_md || ''}

INSTRUCTIONS:
1. Tailor the resume to emphasize experience and skills most relevant to this job
2. Use keywords from the job description naturally throughout the resume
3. Maintain professional formatting and structure
4. Create a compelling cover letter that shows genuine interest in this specific role
5. Keep the same contact information and overall career timeline
6. Focus on achievements and quantifiable results where possible

Return your response as a JSON object with these exact keys:
{
  "tailored_resume": "The complete tailored resume in markdown format",
  "cover_letter": "A personalized cover letter for this specific job"
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
      cover_letter: ''
    }

    // Save tailored resume version
    const { data: tailoredVersion, error: saveError } = await supabase
      .from('resume_versions')
      .insert({
        user_id: user.id,
        job_id: jobId,
        label: `Tailored: ${job.company} - ${job.role}`,
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