// Supabase Edge Function: daily job discovery.
// Replaces the retired external workflow runner: fetches the RSS/Atom feeds
// below, normalizes entries, archives everything into job_raw (deduped by the
// unique job_url index), then promotes relevant new jobs into job_applications
// with status 'To Review' so they appear in the tracker.
// Relevance keywords are preserved from the earlier automation prototype.
// Invoked by pg_cron (see supabase/migrations/*_cron_schedules.sql) with an
// x-cron-secret header; deploy with --no-verify-jwt.
// Required secrets: CRON_SECRET, USER_ID (tracker owner's auth.users id).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { parseFeed } from 'https://deno.land/x/rss@1.1.2/mod.ts'
import { corsHeaders, createAdminClient, jsonResponse, requireCronSecret } from '../_shared/admin.ts'

interface FeedSource {
  name: string
  url: string
  // How to split a feed item title into company/role
  titleFormat: 'role-at-company' | 'company-colon-role' | 'plain'
}

// Preserved from the earlier automation prototype.
const FEEDS: FeedSource[] = [
  { name: 'RemoteOK – AI/Automation/Implementation', url: 'https://remoteok.com/remote-ai+automation+implementation-jobs.rss', titleFormat: 'role-at-company' },
  { name: 'RemoteOK – Consulting/Enablement', url: 'https://remoteok.com/remote-consulting+enablement-jobs.rss', titleFormat: 'role-at-company' },
  { name: 'WeWorkRemotely – Programming', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', titleFormat: 'company-colon-role' },
  { name: 'WeWorkRemotely – Management/Finance', url: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss', titleFormat: 'company-colon-role' },
  { name: 'Google Alert 1', url: 'https://www.google.com/alerts/feeds/14300375354423668492/10755734950416799199', titleFormat: 'plain' },
  { name: 'Google Alert 2', url: 'https://www.google.com/alerts/feeds/14300375354423668492/9346164383827631766', titleFormat: 'plain' },
  { name: 'Google Alert 3', url: 'https://www.google.com/alerts/feeds/14300375354423668492/16331894078291876616', titleFormat: 'plain' },
  { name: 'Google Alert 4', url: 'https://www.google.com/alerts/feeds/14300375354423668492/16143147402762450619', titleFormat: 'plain' },
  { name: 'Google Alert 5', url: 'https://www.google.com/alerts/feeds/14300375354423668492/14045647346583799887', titleFormat: 'plain' },
]

// Preserved from the earlier automation prototype.
const RELEVANT_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'ml',
  'python', 'aws', 'cloud', 'implementation', 'consulting',
  'data science', 'automation', 'genai', 'llm', 'nlp',
  'delivery consultant', 'solution architect', 'enablement',
]
const EXCLUDE_KEYWORDS = [
  'sales', 'marketing', 'recruiter', 'hr', 'accounting',
  'finance', 'legal', 'paralegal', 'nurse', 'doctor',
]

const FETCH_TIMEOUT_MS = 20_000
const MAX_DESCRIPTION_CHARS = 5_000

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTitle(rawTitle: string, format: FeedSource['titleFormat']): { title: string; company: string } {
  const title = stripHtml(rawTitle)
  if (format === 'company-colon-role') {
    const idx = title.indexOf(':')
    if (idx > 0) {
      return { company: title.slice(0, idx).trim(), title: title.slice(idx + 1).trim() }
    }
  }
  if (format === 'role-at-company') {
    const idx = title.lastIndexOf(' at ')
    if (idx > 0) {
      return { title: title.slice(0, idx).trim(), company: title.slice(idx + 4).trim() }
    }
  }
  return { title, company: 'Unknown' }
}

// Word-boundary matching so 'ml' doesn't fire on 'html' or 'hr' on 'three'.
function matchKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
}

interface RawJobRow {
  user_id: string
  source: string
  job_url: string
  title: string
  company: string
  location: string | null
  description: string | null
  status: string
  discovery_status: string
  posted_date: string | null
  raw_data: Record<string, unknown>
}

async function fetchFeed(feed: FeedSource, userId: string): Promise<RawJobRow[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (job-search-automation; +https://github.com/ekazee01-lgtm/jobsearch)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const parsed = await parseFeed(xml)

    const rows: RawJobRow[] = []
    for (const entry of parsed.entries ?? []) {
      const link = entry.links?.[0]?.href ?? (entry.id?.startsWith('http') ? entry.id : null)
      const rawTitle = entry.title?.value ?? ''
      if (!link || !rawTitle) continue

      const { title, company } = splitTitle(rawTitle, feed.titleFormat)
      const descriptionSource = entry.description?.value ?? entry.content?.value ?? ''
      rows.push({
        user_id: userId,
        source: feed.name,
        job_url: link,
        title: title || 'Untitled',
        company: company || 'Unknown',
        location: /remote/i.test(title) ? 'Remote' : null,
        description: descriptionSource ? stripHtml(descriptionSource).slice(0, MAX_DESCRIPTION_CHARS) : null,
        status: 'To Review',
        discovery_status: 'New',
        posted_date: entry.published?.toISOString?.() ?? entry.updated?.toISOString?.() ?? null,
        raw_data: { feed: feed.name, feed_url: feed.url, original_title: rawTitle },
      })
    }
    return rows
  } finally {
    clearTimeout(timer)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const unauthorized = requireCronSecret(req)
  if (unauthorized) return unauthorized

  try {
    const USER_ID = Deno.env.get('USER_ID')
    if (!USER_ID) {
      throw new Error('Missing required environment variable: USER_ID (tracker owner for promoted jobs)')
    }
    const supabase = createAdminClient()

    const results = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed, USER_ID)))
    const rows: RawJobRow[] = []
    const failures: Array<{ feed: string; error: string }> = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        rows.push(...result.value)
      } else {
        failures.push({ feed: FEEDS[i].name, error: String(result.reason) })
        console.error(`Feed failed: ${FEEDS[i].name}:`, result.reason)
      }
    })

    // Dedupe within this batch on the same key the table enforces,
    // otherwise a single upsert statement can hit its own duplicates.
    const seen = new Set<string>()
    const uniqueRows = rows.filter((row) => {
      const key = row.job_url
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Stage 1: archive everything into job_raw. With ignoreDuplicates the
    // upsert returns only the rows that were actually inserted, which is
    // exactly the set eligible for promotion (no double-promotion across runs).
    let insertedRaw: Array<{ id: string; job_url: string | null; title: string; company: string; description: string | null; posted_date: string | null; raw_data: Record<string, unknown> }> = []
    if (uniqueRows.length > 0) {
      const { data, error } = await supabase
        .from('job_raw')
        .upsert(uniqueRows, { onConflict: 'job_url', ignoreDuplicates: true })
        .select('id, job_url, title, company, description, posted_date, raw_data')
      if (error) throw new Error(`job_raw upsert failed: ${error.message}`)
      insertedRaw = data ?? []
    }

    // Stage 2: relevance filter — only jobs
    // matching relevant keywords and no exclusion keywords reach the tracker.
    const promotable = insertedRaw
      .map((row) => {
        const text = `${row.title} ${row.description ?? ''}`
        const matched = matchKeywords(text, RELEVANT_KEYWORDS)
        const excluded = matchKeywords(text, EXCLUDE_KEYWORDS)
        return { row, matched, excluded }
      })
      .filter(({ matched, excluded }) => matched.length > 0 && excluded.length === 0)

    // Stage 3: promote into job_applications as 'To Review' so the cards show
    // up in the tracker's first column. Score remains on the schema's 1-10
    // scale; presentation layers convert it to a percent for display.
    let promoted = 0
    if (promotable.length > 0) {
      const applications = promotable.map(({ row, matched }) => ({
        user_id: USER_ID,
        company: row.company,
        role: row.title,
        url: row.job_url,
        description: row.description,
        source: (row.raw_data as { feed?: string }).feed ?? 'rss',
        published_date: row.posted_date,
        status: 'To Review',
        application_status: 'discovered',
        ai_match_score: Math.min(10, matched.length + 2),
        score_reason: `Keyword match (${(row.raw_data as { feed?: string }).feed ?? 'rss'}): ${matched.join(', ')}`,
        ai_reasoning: `Keyword match (${(row.raw_data as { feed?: string }).feed ?? 'rss'}): ${matched.join(', ')}`,
        raw_data: { source_job_id: row.id, matched_keywords: matched },
      }))
      const { data, error } = await supabase
        .from('job_applications')
        .upsert(applications, { onConflict: 'url', ignoreDuplicates: true })
        .select('id')
      if (error) throw new Error(`job_applications promotion failed: ${error.message}`)
      promoted = data?.length ?? 0
    }

    const summary = {
      success: true,
      fetched: rows.length,
      inserted_raw: insertedRaw.length,
      skipped_duplicates: uniqueRows.length - insertedRaw.length,
      filtered_out: insertedRaw.length - promotable.length,
      promoted_to_review: promoted,
      failures,
    }
    console.log('discover-jobs summary:', JSON.stringify(summary))
    return jsonResponse(summary)
  } catch (error) {
    console.error('Error in discover-jobs function:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
