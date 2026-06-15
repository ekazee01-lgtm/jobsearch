export type Channel = 'api' | 'email' | 'assisted' | 'manual'

export type Route = {
  channel: Channel
  reason: string
  evidence: Record<string, unknown>
  interventionReason?: string
}

function normalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function extractEmail(value: unknown): string {
  const text = normalizedString(value)
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0]?.toLowerCase() ?? ''
}

function extractMasterProfile(masterResume: string) {
  const lines = masterResume.split(/\r?\n/)
  const heading = lines.find((line) => /^#\s+\S/.test(line)) ?? ''
  const name = heading.replace(/^#\s+/, '').trim()
  const email = extractEmail(masterResume)
  const phoneMatch = masterResume.match(
    /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/,
  )
  const linkedinMatch = masterResume.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)>]+/i,
  )

  return {
    name,
    email,
    phone: phoneMatch?.[0]?.trim() ?? '',
    linkedin: linkedinMatch?.[0]?.trim() ?? '',
  }
}

function atsProvider(hostname: string): string {
  const host = hostname.toLowerCase()
  if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) return 'workday'
  if (host.includes('greenhouse.io')) return 'greenhouse'
  if (host.includes('lever.co')) return 'lever'
  if (host.includes('icims.com')) return 'icims'
  if (host.includes('taleo.net')) return 'taleo'
  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('indeed.com')) return 'indeed'
  return 'unknown'
}

export function routeJob(job: Record<string, unknown>): Route {
  const rawUrl = normalizedString(job.url || job.job_url)
  const applicationMethod = normalizedString(job.application_method).toLowerCase()
  const contactEmail = extractEmail(job.recruiter_contact)

  if (rawUrl.toLowerCase().startsWith('mailto:')) {
    const email = extractEmail(rawUrl.slice('mailto:'.length))
    if (email) {
      return {
        channel: 'email',
        reason: 'The application URL explicitly specifies an email recipient.',
        evidence: { email, source: 'mailto_url' },
      }
    }
  }

  if (applicationMethod === 'email' && contactEmail) {
    return {
      channel: 'email',
      reason: 'The job record explicitly marks email as the application method.',
      evidence: { email: contactEmail, source: 'application_method' },
    }
  }

  if (!rawUrl) {
    return {
      channel: 'manual',
      reason: 'No application URL or explicit email destination is available.',
      evidence: {},
      interventionReason: 'missing_destination',
    }
  }

  try {
    const parsed = new URL(rawUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        channel: 'manual',
        reason: 'The application destination uses an unsupported URL scheme.',
        evidence: { protocol: parsed.protocol },
        interventionReason: 'unsupported_destination',
      }
    }

    const provider = atsProvider(parsed.hostname)

    // Phase 0 deliberately has no API credential registry. A public endpoint
    // being reachable is not authorization to submit through it.
    return {
      channel: 'assisted',
      reason: provider === 'unknown'
        ? 'A web application is available, but no authorized submission API is configured.'
        : `${provider} requires a user-controlled browser or employer-issued API authorization.`,
      evidence: {
        hostname: parsed.hostname.toLowerCase(),
        provider,
        api_authorized: false,
      },
    }
  } catch {
    return {
      channel: 'manual',
      reason: 'The application URL is malformed and must be reviewed.',
      evidence: { raw_url: rawUrl },
      interventionReason: 'invalid_url',
    }
  }
}

export function candidateAnswers(user: {
  email?: string
  user_metadata?: Record<string, unknown>
}, masterResume: string) {
  const metadata = user.user_metadata ?? {}
  const master = extractMasterProfile(masterResume)
  const metadataName = normalizedString(
    metadata.full_name || metadata.name || metadata.display_name,
  )
  const metadataPhone = normalizedString(metadata.phone || metadata.phone_number)
  const metadataLinkedin = normalizedString(metadata.linkedin || metadata.linkedin_url)
  const location = normalizedString(metadata.location)
  const fullName = metadataName || master.name
  const email = normalizedString(user.email) || master.email
  const phone = metadataPhone || master.phone
  const linkedin = metadataLinkedin || master.linkedin

  return [
    {
      question_key: 'full_name',
      question: 'Full name',
      answer: fullName || null,
      confidence: fullName ? 1 : 0,
      required: true,
      requires_user_attestation: !fullName,
      source: metadataName ? 'user_profile' : 'master_resume',
    },
    {
      question_key: 'email',
      question: 'Email address',
      answer: email || null,
      confidence: email ? 1 : 0,
      required: true,
      requires_user_attestation: !email,
      source: user.email ? 'user_profile' : 'master_resume',
    },
    {
      question_key: 'phone',
      question: 'Phone number',
      answer: phone || null,
      confidence: phone ? 1 : 0,
      required: false,
      requires_user_attestation: false,
      source: metadataPhone ? 'user_profile' : 'master_resume',
    },
    {
      question_key: 'linkedin',
      question: 'LinkedIn profile',
      answer: linkedin || null,
      confidence: linkedin ? 1 : 0,
      required: false,
      requires_user_attestation: false,
      source: metadataLinkedin ? 'user_profile' : 'master_resume',
    },
    {
      question_key: 'location',
      question: 'Current location',
      answer: location || null,
      confidence: location ? 1 : 0,
      required: false,
      requires_user_attestation: false,
      source: 'user_profile',
    },
  ]
}

export function normalizedPayloadString(value: unknown): string {
  return normalizedString(value)
}
