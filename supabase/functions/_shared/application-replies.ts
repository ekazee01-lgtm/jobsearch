export type ReplyClassification =
  | 'rejection'
  | 'interview'
  | 'offer'
  | 'info_request'
  | 'other'

export type CorrelationMethod =
  | 'thread'
  | 'domain'
  | 'company_role'
  | 'unmatched'

export interface JobCandidate {
  id: string
  company?: string | null
  role?: string | null
  url?: string | null
  job_url?: string | null
}

export interface Correlation {
  jobId: string | null
  method: CorrelationMethod
  confidence: number
  details: Record<string, unknown>
}

export interface ClassificationResult {
  classification: ReplyClassification
  confidence: number
  rationale: string
  company_hint: string
  role_hint: string
}

const ALLOWED_CLASSIFICATIONS = new Set<ReplyClassification>([
  'rejection',
  'interview',
  'offer',
  'info_request',
  'other',
])

const GENERIC_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'greenhouse.io',
  'lever.co',
  'myworkdayjobs.com',
  'workday.com',
  'icims.com',
  'taleo.net',
  'smartrecruiters.com',
  'ashbyhq.com',
])

function isGenericDomain(domain: string): boolean {
  return [...GENERIC_DOMAINS].some((generic) =>
    domain === generic || domain.endsWith(`.${generic}`)
  )
}

const NOISE_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'your',
  'application',
  'position',
  'role',
  'team',
  'jobs',
  'job',
  'inc',
  'llc',
  'ltd',
  'corp',
  'corporation',
  'company',
  'co',
])

export function extractEmailAddress(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0]?.toLowerCase() ?? ''
}

export function emailDomain(value: unknown): string {
  return extractEmailAddress(value).split('@')[1] ?? ''
}

export function trimReplyBody(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return ''
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (
      /^On .+wrote:$/i.test(trimmed) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed) ||
      /^From:\s.+/i.test(trimmed) ||
      /^>{1,}/.test(trimmed) ||
      /^--\s*$/.test(trimmed) ||
      /^Sent from my /i.test(trimmed)
    ) {
      break
    }
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLength)
}

function tokens(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return [...new Set(
    value.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !NOISE_WORDS.has(word)),
  )]
}

function tokenCoverage(needles: string[], haystack: Set<string>): number {
  if (needles.length === 0) return 0
  return needles.filter((word) => haystack.has(word)).length / needles.length
}

function jobHostname(job: JobCandidate): string {
  const raw = job.url || job.job_url
  if (!raw) return ''
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function domainMatches(senderDomain: string, hostname: string): boolean {
  return senderDomain === hostname ||
    senderDomain.endsWith(`.${hostname}`) ||
    hostname.endsWith(`.${senderDomain}`)
}

export function correlateReply(
  input: {
    fromDomain: string
    subject: string
    snippet: string
    companyHint?: string
    roleHint?: string
    priorThreadJobId?: string | null
  },
  jobs: JobCandidate[],
): Correlation {
  if (input.priorThreadJobId && jobs.some((job) => job.id === input.priorThreadJobId)) {
    return {
      jobId: input.priorThreadJobId,
      method: 'thread',
      confidence: 0.99,
      details: { matched_existing_thread: true },
    }
  }

  const senderDomain = input.fromDomain.toLowerCase()
  if (senderDomain && !isGenericDomain(senderDomain)) {
    const domainMatchesForJobs = jobs.filter((job) =>
      domainMatches(senderDomain, jobHostname(job))
    )
    if (domainMatchesForJobs.length === 1) {
      return {
        jobId: domainMatchesForJobs[0].id,
        method: 'domain',
        confidence: 0.94,
        details: { sender_domain: senderDomain, job_hostname: jobHostname(domainMatchesForJobs[0]) },
      }
    }
  }

  const messageTokens = new Set(tokens(
    `${input.subject} ${input.snippet} ${input.companyHint ?? ''} ${input.roleHint ?? ''}`,
  ))
  const scored = jobs.map((job) => {
    const companyTokens = tokens(job.company)
    const roleTokens = tokens(job.role)
    const companyCoverage = tokenCoverage(companyTokens, messageTokens)
    const roleCoverage = tokenCoverage(roleTokens, messageTokens)
    const score = 0.55 * companyCoverage + 0.45 * roleCoverage
    return { job, score, companyCoverage, roleCoverage }
  }).sort((a, b) => b.score - a.score)

  const winner = scored[0]
  const runnerUp = scored[1]
  if (
    winner &&
    winner.companyCoverage >= 0.6 &&
    winner.score >= 0.72 &&
    (!runnerUp || winner.score - runnerUp.score >= 0.12)
  ) {
    return {
      jobId: winner.job.id,
      method: 'company_role',
      confidence: Math.min(0.89, Number(winner.score.toFixed(2))),
      details: {
        company_coverage: Number(winner.companyCoverage.toFixed(2)),
        role_coverage: Number(winner.roleCoverage.toFixed(2)),
        runner_up_score: runnerUp ? Number(runnerUp.score.toFixed(2)) : null,
      },
    }
  }

  return {
    jobId: null,
    method: 'unmatched',
    confidence: 0,
    details: winner
      ? {
        best_candidate_id: winner.job.id,
        best_score: Number(winner.score.toFixed(2)),
        reason: 'weak_or_ambiguous_match',
      }
      : { reason: 'no_candidate_jobs' },
  }
}

export function proposedStatus(classification: ReplyClassification): string | null {
  if (classification === 'rejection') return 'Rejected'
  if (classification === 'interview') return 'Interview'
  if (classification === 'offer') return 'Offer'
  return null
}

export function parseReplyClassification(content: string): ClassificationResult | null {
  try {
    const parsed = JSON.parse(content)
    const classification = parsed.classification as ReplyClassification
    const confidence = Number(parsed.confidence)
    if (
      !ALLOWED_CLASSIFICATIONS.has(classification) ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      return null
    }
    return {
      classification,
      confidence,
      rationale: String(parsed.rationale ?? '').trim().slice(0, 500),
      company_hint: String(parsed.company_hint ?? '').trim().slice(0, 200),
      role_hint: String(parsed.role_hint ?? '').trim().slice(0, 200),
    }
  } catch {
    return null
  }
}
