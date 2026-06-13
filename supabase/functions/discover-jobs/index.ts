// Supabase Edge Function: daily job discovery.
// Replaces the retired external workflow runner: fetches the RSS/Atom feeds
// below, normalizes entries, archives everything into job_raw (deduped by the
// unique job_url index), then promotes relevant new jobs into job_applications
// with status 'To Review' so they appear in the tracker.
// Relevance keywords are preserved from the earlier automation prototype.
// Invoked by pg_cron (see supabase/migrations/*_cron_schedules.sql) with an
// x-cron-secret header; deploy with --no-verify-jwt.
// Required secrets: CRON_SECRET, USER_ID (tracker owner's auth.users id).
// Optional secrets: OPENAI_API_KEY (enables LLM scoring; keyword fallback
// otherwise), AI_SCORING_MODEL (default gpt-5.4-nano), AI_SCORE_THRESHOLD
// (default 7 — minimum 1-10 score to reach the tracker).

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
  // AI-relevant boards (verified live 2026-06-13; the AI-specific Remotive/
  // aijobs.net/mljobs URLs 404'd, so use Remotive's general feed + Himalayas,
  // letting the keyword pre-filter + LLM scoring select AI roles).
  { name: 'Remotive', url: 'https://remotive.com/remote-jobs/feed', titleFormat: 'role-at-company' },
  { name: 'Himalayas', url: 'https://himalayas.app/jobs/rss', titleFormat: 'role-at-company' },
]

// Cheap pre-filter: at least one AI/role-family term must appear before the
// LLM scores it. Compiled from search-criteria Section 1 (Tier 1 + Tier 2).
const RELEVANT_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'llm', 'genai', 'generative ai',
  'rlhf', 'red team', 'model evaluation', 'ai safety', 'ai evaluation', 'prompt',
  'agentic', 'ai workflow', 'ai automation', 'ai ops', 'mcp', 'n8n', 'mlops',
  'ai adoption', 'ai enablement', 'ai implementation', 'ai training', 'ai readiness',
  'ai onboarding', 'ai solutions', 'ai coach', 'digital adoption', 'enablement',
  'trust and safety', 'policy operations', 'ai policy', 'responsible ai', 'ai governance',
  'content moderation', 'ai program', 'ai project', 'ai delivery', 'ai product operations',
  'annotation', 'annotator', 'human feedback', 'model trainer', 'legal ai', 'harvey',
]

// Hard title exclusions (search-criteria Section 7) — applied to the title only,
// before scoring, regardless of keywords.
const EXCLUDED_TITLE_PATTERNS = [
  /\bsoftware\s+engineer\b/i, /\bdata\s+scientist\b/i, /\bml\s+engineer\b/i,
  /\bmachine\s+learning\s+engineer\b/i, /\bresearch\s+scientist\b/i,
  /\bdata\s+engineer\b/i, /\bback[\s-]?end\s+engineer\b/i, /\bfront[\s-]?end\s+engineer\b/i,
  /\bfull[\s-]?stack\b/i, /\bdevops\b/i,
]
const EXCLUDED_PROFESSION_PATTERNS = [
  /\battorney\b/i, /\bparalegal\b/i, /\bnurse\b/i, /\bphysician\b/i,
  /\bpharmacist\b/i, /\baccountant\b/i, /\bcpa\b/i,
]
function isExcludedTitle(title: string): boolean {
  // Exception: AI Implementation/Enablement Engineer may pass (ops, not coding)
  const aiEngineerException = /\bai\s+(implementation|enablement)\s+engineer\b/i.test(title)
  if (!aiEngineerException && EXCLUDED_TITLE_PATTERNS.some((re) => re.test(title))) return true
  if (EXCLUDED_PROFESSION_PATTERNS.some((re) => re.test(title))) return true
  // 'Analyst' standalone (no AI) is excluded
  if (/\banalyst\b/i.test(title) && !/\bai\b|artificial intelligence/i.test(title)) return true
  return false
}

// Priority employers (search-criteria Section 2). Bonus added in code after the
// LLM's base role-fit score, capped at 10.
const FRONTIER_LABS = [
  'anthropic', 'openai', 'deepmind', 'google labs', 'meta ai', 'xai', 'grok',
  'microsoft ai', 'azure ai', 'copilot', 'bedrock', 'aws ai', 'amazon', 'apple',
  'cohere', 'mistral', 'inflection ai', 'adept', 'runway', 'stability ai', 'hugging face',
]
const AI_FORWARD = [
  'scale ai', 'outlier', 'surge ai', 'invisible', 'dataannotation', 'accenture',
  'quantumblack', 'mckinsey', 'bcg x', 'boston consulting', 'deloitte', 'watson',
  'ibm consulting', 'salesforce', 'einstein', 'servicenow', 'workday', 'sap ai',
]
const LEGAL_AI = [
  'harvey', 'casetext', 'thomson reuters', 'ironclad', 'lexisnexis', 'relativity',
  'contractpodai', 'luminance', 'spellbook',
]
function employerBonus(company: string): { bonus: number; flag: boolean; group: string | null } {
  const c = company.toLowerCase()
  if (FRONTIER_LABS.some((e) => c.includes(e))) return { bonus: 2, flag: true, group: 'frontier-lab' }
  if (AI_FORWARD.some((e) => c.includes(e))) return { bonus: 1, flag: true, group: 'ai-forward' }
  if (LEGAL_AI.some((e) => c.includes(e))) return { bonus: 1, flag: true, group: 'legal-ai' }
  return { bonus: 0, flag: false, group: null }
}

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

// Cheap noise heuristics observed in real digests: non-English postings
// (Portuguese/Spanish accents, German "(m/w/d)" notation) aren't reviewable.
function looksNonEnglish(title: string): boolean {
  return /[ãõçáàâéêíóôúüñöäß]/i.test(title) || /\(m\/[wfx]\/[dx]\)/i.test(title)
}

// Generic fallback profile used only when no 'Scoring Profile' row is seeded.
// The full candidate profile (incl. compensation targets) lives in the DB to
// keep PII out of this public repo.
const FALLBACK_PROFILE = `CANDIDATE PROFILE SUMMARY:
- 12+ years enterprise technology deployment and enablement; hands-on RLHF
  evaluation, rubric design, adversarial prompting (Outlier/Scale AI); agentic
  workflow design (Claude, n8n, MCP, Supabase); production AI deployment.
- Not an engineer (BS Biology); targets AI-native operational/enablement roles,
  not software-engineering or ML-research roles.
- Located Dallas-Fort Worth; open to remote/hybrid/travel.`

interface LlmVerdict {
  score: number
  reason: string
  tier: string
}

// One batched call scoring every candidate 1-10 for ROLE FIT (employer bonus is
// applied separately in code). Returns null on any failure so the caller can
// fall back to keyword scoring — discovery must never break on model issues.
async function scoreWithLlm(
  candidates: Array<{ title: string; company: string; description: string | null }>,
  apiKey: string,
  model: string,
  profileText: string,
): Promise<Map<number, LlmVerdict> | null> {
  const items = candidates.map((c, i) => ({
    i,
    title: c.title,
    company: c.company,
    description: (c.description ?? '').slice(0, 1500),
  }))
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: `You are a job relevance scorer for a specific candidate.

${profileText}

Score each posting 1-10 for ROLE FIT only (ignore employer prestige — an
employer bonus is applied separately). Use these bands:
- 9-10: role explicitly requires RLHF/model evaluation, rubric design, red
  teaming, adversarial testing, AI workflow/agentic design, or AI adoption at
  scale, and requires NO PhD or engineering degree.
- 7-8: a target family below, no PhD/ML-engineering degree required, work
  involves evaluation, enablement, workflow, operations, or adoption.
- 5-6: AI-adjacent but requires heavy engineering/coding, OR legal tech with no
  AI component.
- 3-4: traditional IT/help desk with no AI, gig/task-based annotation, or
  requires an active law/medical/CPA license.
- 1-2: requires PhD/ML-engineering degree or 5+ years software engineering;
  pure software dev, data science, or ML research; salary stated below $80k; or
  on-site outside Dallas-Fort Worth with no remote option.
Score 1 if it requires security clearance, a JD/law degree, nursing/medical
license, or is gig/1099 task-based annotation work.

Target families and tier: Tier 1 = AI Quality/Red Team/Evaluation; Prompt
Operations/AI Workflow; Learning & Enablement/AI Adoption; Trust & Safety/Policy;
AI Program/Project Management. Tier 2 = expert AI Trainer/Annotator (ONLY if
W-2 or a named 3+ month contract — gig/task work is Tier 0) and Legal AI/
Enterprise AI. Set "tier" to "1", "2", or "0".

Return ONLY: {"scores":[{"i":<index>,"score":<1-10>,"reason":"<one sentence>","tier":"0|1|2"}]}
Include every item exactly once.

Job postings:
${JSON.stringify(items)}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 8000,
  }
  // gpt-5.x are reasoning models: keep effort minimal for cost/latency and
  // leave temperature at its only supported value. Older models get 0.
  if (model.startsWith('gpt-5')) {
    body.reasoning_effort = 'minimal'
  } else {
    body.temperature = 0
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`LLM scoring failed: HTTP ${res.status}: ${await res.text()}`)
      return null
    }
    const result = await res.json()
    const content = result.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { scores?: Array<{ i: number; score: number; reason: string; tier?: string }> }
    if (!Array.isArray(parsed.scores)) {
      console.error('LLM scoring returned unexpected shape:', content.slice(0, 300))
      return null
    }
    const verdicts = new Map<number, LlmVerdict>()
    for (const s of parsed.scores) {
      if (typeof s.i === 'number' && typeof s.score === 'number') {
        verdicts.set(s.i, {
          score: Math.max(1, Math.min(10, Math.round(s.score))),
          reason: String(s.reason ?? '').slice(0, 500),
          tier: ['1', '2'].includes(String(s.tier)) ? String(s.tier) : '0',
        })
      }
    }
    return verdicts.size > 0 ? verdicts : null
  } catch (err) {
    console.error('LLM scoring error:', err)
    return null
  }
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

      let { title, company } = splitTitle(rawTitle, feed.titleFormat)
      // Some feeds (e.g. Himalayas) carry the employer in a custom namespaced
      // field rather than the title — recover it when the title gave 'Unknown'.
      if (company === 'Unknown') {
        const e = entry as unknown as Record<string, { value?: string } | undefined>
        for (const k of ['himalayasjobs:companyname', 'company', 'dc:creator', 'author']) {
          const v = e[k]?.value
          if (v && v.trim()) { company = stripHtml(v); break }
        }
      }
      // Prefer the longer of content vs description — RSS <description> is often
      // a truncated snippet while <content:encoded> carries the full posting.
      const descA = entry.description?.value ?? ''
      const descB = entry.content?.value ?? ''
      const descriptionSource = descB.length > descA.length ? descB : descA
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

    // Stage 2: keyword pre-filter — cheap first pass so the LLM never sees
    // obviously irrelevant items.
    const keywordPassed = insertedRaw
      .map((row) => {
        const text = `${row.title} ${row.description ?? ''}`
        const matched = matchKeywords(text, RELEVANT_KEYWORDS)
        return { row, matched }
      })
      .filter(({ matched }) => matched.length > 0)

    // Stage 2b: noise + hard-exclusion heuristics. Google Alerts surface news
    // articles with company 'Unknown' — require a second keyword hit for those.
    // Drop non-English titles and hard-excluded titles (Section 7) outright.
    const candidates = keywordPassed.filter(({ row, matched }) => {
      if (looksNonEnglish(row.title)) return false
      if (isExcludedTitle(row.title)) return false
      if (row.company === 'Unknown' && matched.length < 2) return false
      return true
    })

    // Candidate scoring profile: prefer the seeded 'Scoring Profile' (carries
    // compensation targets etc.), fall back to the generic in-code summary.
    const { data: scoringProfileRow } = await supabase
      .from('resume_versions').select('resume_md')
      .eq('user_id', USER_ID).eq('label', 'Scoring Profile').single()
    const profileText = scoringProfileRow?.resume_md?.trim() || FALLBACK_PROFILE

    // Stage 2c: LLM role-fit scoring (model via AI_SCORING_MODEL, threshold via
    // AI_SCORE_THRESHOLD, default 7). Falls back to keyword scoring on failure.
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const scoringModel = Deno.env.get('AI_SCORING_MODEL') || 'gpt-5.4-nano'
    const scoreThreshold = Number(Deno.env.get('AI_SCORE_THRESHOLD') || '7')
    let verdicts: Map<number, LlmVerdict> | null = null
    if (OPENAI_API_KEY && candidates.length > 0) {
      verdicts = await scoreWithLlm(candidates.map(({ row }) => row), OPENAI_API_KEY, scoringModel, profileText)
    }

    const promotable = candidates
      .map(({ row, matched }, i) => {
        const verdict = verdicts?.get(i) ?? null
        const base = verdict ? verdict.score : Math.min(10, matched.length + 2)
        const tier = verdict?.tier ?? '0'
        // Employer bonus applies ONLY to Tier 1/2 roles (per guidance Section 2).
        // In keyword-fallback mode there is no tier verdict, so no bonus is added.
        const emp = employerBonus(row.company)
        const bonusApplies = emp.flag && (tier === '1' || tier === '2')
        const bonus = bonusApplies ? emp.bonus : 0
        const score = Math.min(10, base + bonus)
        const reason = verdict
          ? `${scoringModel} (tier ${tier}${bonusApplies ? `, +${bonus} ${emp.group}` : ''}): ${verdict.reason}`
          : `Keyword match${bonusApplies ? ` (+${bonus} ${emp.group})` : ''}: ${matched.join(', ')}`
        return { row, matched, score, reason, tier, employer: { ...emp, bonusApplies } }
      })
      // Always enforce the threshold — including keyword-fallback scores — so a
      // scoring outage can't flood the tracker with unscored jobs.
      .filter(({ score }) => score >= scoreThreshold)

    // Stage 3: promote into job_applications as 'To Review'.
    let promoted = 0
    if (promotable.length > 0) {
      const applications = promotable.map(({ row, matched, score, reason, tier, employer }) => ({
        user_id: USER_ID,
        company: row.company,
        role: row.title,
        url: row.job_url,
        description: row.description,
        source: (row.raw_data as { feed?: string }).feed ?? 'rss',
        published_date: row.posted_date,
        status: 'To Review',
        application_status: 'discovered',
        ai_match_score: score,
        score_reason: reason,
        ai_reasoning: reason,
        raw_data: {
          source_job_id: row.id,
          matched_keywords: matched,
          tier,
          employer_group: employer.group,
          employer_bonus_applied: employer.bonusApplies,
        },
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
      keyword_filtered_out: insertedRaw.length - keywordPassed.length,
      heuristic_filtered_out: keywordPassed.length - candidates.length,
      llm_scoring: verdicts === null ? 'fallback-keyword' : scoringModel,
      llm_below_threshold: verdicts === null ? 0 : candidates.length - promotable.length,
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
