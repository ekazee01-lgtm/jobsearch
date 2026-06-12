// Shared helpers for cron-invoked Edge Functions.
// These functions are deployed with --no-verify-jwt and instead authenticate
// the caller via the x-cron-secret header (set in Supabase Vault + secrets).

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Returns null when authorized, otherwise a 401 Response to return as-is.
export function requireCronSecret(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) {
    console.error('CRON_SECRET is not set in function secrets')
    return jsonResponse({ error: 'Server misconfigured: CRON_SECRET missing' }, 500)
  }
  const provided = req.headers.get('x-cron-secret')
  if (provided !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  return null
}

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey)
}
