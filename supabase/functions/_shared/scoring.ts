// Shared job scoring + promotion, used by discover-jobs (RSS) and
// ingest-email-jobs (Gmail alerts) so both channels apply identical criteria.
// Given normalized raw job rows already inserted into job_raw, this filters,
// LLM-scores (role fit 1-10 + tier), applies the employer bonus, enforces the
// threshold, dedupes, and promotes survivors into job_applications.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Keyword pre-filter (search-criteria Section 1, Tier 1 + Tier 2) ---
export const RELEVANT_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'llm', 'genai', 'generative ai',
  'rlhf', 'red team', 'model evaluation', 'ai safety', 'ai evaluation', 'prompt',
  'agentic', 'ai workflow', 'ai automation', 'ai ops', 'mcp', 'n8n', 'mlops',
  'ai adoption', 'ai enablement', 'ai implementation', 'ai training', 'ai readiness',
  'ai onboarding', 'ai solutions', 'ai coach', 'digital adoption', 'enablement',
  'trust and safety', 'policy operations', 'ai policy', 'responsible ai', 'ai governance',
  'content moderation', 'ai program', 'ai project', 'ai delivery', 'ai product operations',
  'annotation', 'annotator', 'human feedback', 'model trainer', 'legal ai', 'harvey',
]

export function matchKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
}

export function looksNonEnglish(title: string): boolean {
  return /[ãõçáàâéêíóôúüñöäß]/i.test(title) || /\(m\/[wfx]\/[dx]\)/i.test(title)
}

// --- Hard title exclusions (Section 7) ---
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
export function isExcludedTitle(title: string): boolean {
  const aiEngineerException = /\bai\s+(implementation|enablement)\s+engineer\b/i.test(title)
  if (!aiEngineerException && EXCLUDED_TITLE_PATTERNS.some((re) => re.test(title))) return true
  if (EXCLUDED_PROFESSION_PATTERNS.some((re) => re.test(title))) return true
  if (/\banalyst\b/i.test(title) && !/\bai\b|artificial intelligence/i.test(title)) return true
  return false
}

// --- Employer bonus (Section 2) ---
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
export function employerBonus(company: string): { bonus: number; flag: boolean; group: string | null } {
  const c = company.toLowerCase()
  if (FRONTIER_LABS.some((e) => c.includes(e))) return { bonus: 2, flag: true, group: 'frontier-lab' }
  if (AI_FORWARD.some((e) => c.includes(e))) return { bonus: 1, flag: true, group: 'ai-forward' }
  if (LEGAL_AI.some((e) => c.includes(e))) return { bonus: 1, flag: true, group: 'legal-ai' }
  return { bonus: 0, flag: false, group: null }
}

export const FALLBACK_PROFILE = `CANDIDATE PROFILE SUMMARY:
- 12+ years enterprise technology deployment and enablement; hands-on RLHF
  evaluation, rubric design, adversarial prompting (Outlier/Scale AI); agentic
  workflow design (Claude, n8n, MCP, Supabase); production AI deployment.
- Not an engineer (BS Biology); targets AI-native operational/enablement roles,
  not software-engineering or ML-research roles.
- Located Dallas-Fort Worth; open to remote/hybrid/travel.`

export interface LlmVerdict {
  score: number
  reason: string
  tier: string
}

export function parseScoreVerdicts(content: string, candidateCount: number): Map<number, LlmVerdict> | null {
  let parsed: { scores?: Array<{ i: number; score: number; reason: string; tier?: string }> }
  try {
    parsed = JSON.parse(content)
  } catch {
    console.error('LLM scoring returned invalid JSON:', content.slice(0, 300))
    return null
  }
  if (!Array.isArray(parsed.scores) || parsed.scores.length !== candidateCount) {
    console.error(`LLM scoring returned ${parsed.scores?.length ?? 'no'} verdicts for ${candidateCount} candidates`)
    return null
  }

  const verdicts = new Map<number, LlmVerdict>()
  for (const s of parsed.scores) {
    if (!Number.isInteger(s.i) || s.i < 0 || s.i >= candidateCount || !Number.isFinite(s.score) || verdicts.has(s.i)) {
      console.error('LLM scoring returned an invalid or duplicate candidate index:', JSON.stringify(s).slice(0, 300))
      return null
    }
    verdicts.set(s.i, {
      score: Math.max(1, Math.min(10, Math.round(s.score))),
      reason: String(s.reason ?? '').slice(0, 500),
      tier: ['1', '2'].includes(String(s.tier)) ? String(s.tier) : '0',
    })
  }
  return verdicts.size === candidateCount ? verdicts : null
}

export async function scoreWithLlm(
  candidates: Array<{ title: string; company: string; description: string | null }>,
  apiKey: string,
  model: string,
  profileText: string,
): Promise<Map<number, LlmVerdict> | null> {
  const items = candidates.map((c, i) => ({ i, title: c.title, company: c.company, description: (c.description ?? '').slice(0, 1500) }))
  const body: Record<string, unknown> = {
    model,
    messages: [{
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
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 8000,
  }
  if (model.startsWith('gpt-5')) body.reasoning_effort = 'minimal'
  else body.temperature = 0

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`LLM scoring failed: HTTP ${res.status}: ${await res.text()}`)
      return null
    }
    const result = await res.json()
    const content = result.choices?.[0]?.message?.content ?? ''
    if (result.choices?.[0]?.finish_reason === 'length') {
      console.error('LLM scoring response was truncated')
      return null
    }
    return parseScoreVerdicts(content, candidates.length)
  } catch (err) {
    console.error('LLM scoring error:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Normalized key for soft company+role dedup: lowercase, drop common company
// suffixes (Inc/LLC/Ltd/Corp/Co) and punctuation, collapse whitespace. Catches
// "Deepgram" vs "Deepgram, Inc.".
function dedupKey(company: string, role: string): string {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/[.,]/g, ' ')
      .replace(/\b(inc|llc|ltd|corp|corporation|co|gmbh|sa|plc)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `${norm(company)}|${norm(role)}`
}

export interface RawJobLite {
  id: string
  job_url: string | null
  title: string
  company: string
  description: string | null
  posted_date: string | null
  raw_data: Record<string, unknown>
}

export interface PromoteResult {
  keyword_filtered_out: number
  heuristic_filtered_out: number
  llm_scoring: string
  scoring_failed: boolean
  duplicates_skipped: number
  promoted_to_review: number
}

// Filter -> score -> dedupe -> promote a set of freshly-inserted job_raw rows.
export async function promoteRawJobs(
  supabase: SupabaseClient,
  userId: string,
  insertedRaw: RawJobLite[],
  openaiApiKey: string | undefined,
  scoringModel: string,
  scoreThreshold: number,
  sourceLabel: string,
): Promise<PromoteResult> {
  // Keyword pre-filter
  const keywordPassed = insertedRaw
    .map((row) => ({ row, matched: matchKeywords(`${row.title} ${row.description ?? ''}`, RELEVANT_KEYWORDS) }))
    .filter(({ matched }) => matched.length > 0)

  // Noise + hard-exclusion heuristics
  const candidates = keywordPassed.filter(({ row, matched }) => {
    if (looksNonEnglish(row.title)) return false
    if (isExcludedTitle(row.title)) return false
    if (row.company === 'Unknown' && matched.length < 2) return false
    return true
  })

  // Dedup vs jobs already in the tracker by normalized company+role BEFORE
  // scoring, so a retry (where job_raw rows already exist) and already-promoted
  // jobs aren't re-scored. URLs differ across channels (Indeed uses tracking
  // redirects), so URL dedup alone misses these. Best-effort: a rare concurrent
  // run could still slip one through (no DB constraint, since company+role isn't
  // strictly unique); the job_url unique index is the hard guarantee, and a
  // duplicate card is user-deletable.
  let duplicatesSkipped = 0
  let freshCandidates = candidates
  {
    const { data: existing } = await supabase
      .from('job_applications').select('company, role').eq('user_id', userId)
    const seen = new Set((existing ?? []).map((e) => dedupKey(e.company ?? '', e.role ?? '')))
    freshCandidates = candidates.filter(({ row }) => {
      const key = dedupKey(row.company, row.title)
      if (seen.has(key)) { duplicatesSkipped++; return false }
      seen.add(key)
      return true
    })
  }

  // Candidate scoring profile (DB-injected; comp targets live there)
  const { data: scoringProfileRow } = await supabase
    .from('resume_versions').select('resume_md')
    .eq('user_id', userId).eq('label', 'Scoring Profile').single()
  const profileText = scoringProfileRow?.resume_md?.trim() || FALLBACK_PROFILE

  let verdicts: Map<number, LlmVerdict> | null = null
  if (openaiApiKey && freshCandidates.length > 0) {
    verdicts = await scoreWithLlm(freshCandidates.map(({ row }) => row), openaiApiKey, scoringModel, profileText)
  }
  // True scoring outage (not "no key" / "nothing to score"). Callers may choose
  // to retry rather than acknowledge, so a transient failure doesn't reject a
  // strong role via the weaker keyword fallback and lose it.
  const scoringFailed = !!openaiApiKey && freshCandidates.length > 0 && verdicts === null

  const promotable = freshCandidates
    .map(({ row, matched }, i) => {
      const verdict = verdicts?.get(i) ?? null
      const base = verdict ? verdict.score : Math.min(10, matched.length + 2)
      const tier = verdict?.tier ?? '0'
      const emp = employerBonus(row.company)
      const bonusApplies = emp.flag && (tier === '1' || tier === '2')
      const bonus = bonusApplies ? emp.bonus : 0
      const score = Math.min(10, base + bonus)
      const reason = verdict
        ? `${scoringModel} (tier ${tier}${bonusApplies ? `, +${bonus} ${emp.group}` : ''}): ${verdict.reason}`
        : `Keyword match: ${matched.join(', ')}`
      return { row, matched, score, reason, tier, employer: { ...emp, bonusApplies } }
    })
    .filter(({ score }) => score >= scoreThreshold)

  let promoted = 0
  if (promotable.length > 0) {
    const stamp = new Date().toISOString()
    const applications = promotable.map(({ row, matched, score, reason, tier, employer }) => ({
      user_id: userId,
      company: row.company,
      role: row.title,
      url: row.job_url,
      description: row.description,
      source: (row.raw_data as { feed?: string }).feed ?? sourceLabel,
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
        ingested_at: stamp,
      },
    }))
    const { data, error } = await supabase
      .from('job_applications')
      .upsert(applications, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`job_applications promotion failed: ${error.message}`)
    promoted = data?.length ?? 0
  }

  return {
    keyword_filtered_out: insertedRaw.length - keywordPassed.length,
    heuristic_filtered_out: keywordPassed.length - candidates.length,
    llm_scoring: verdicts === null ? 'fallback-keyword' : scoringModel,
    scoring_failed: scoringFailed,
    duplicates_skipped: duplicatesSkipped,
    promoted_to_review: promoted,
  }
}
