import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  correlateReply,
  emailDomain,
  parseReplyClassification,
  proposedStatus,
  trimReplyBody,
} from './application-replies.ts'

Deno.test('trims quoted history and signatures before classification', () => {
  assertEquals(
    trimReplyBody('Thanks for applying.\nWe would like to interview you.\n\n-- \nRecruiting Team'),
    'Thanks for applying.\nWe would like to interview you.',
  )
  assertEquals(
    trimReplyBody('We are moving forward.\n\nOn Monday, Candidate wrote:\n> Previous message'),
    'We are moving forward.',
  )
})

Deno.test('extracts a normalized sender domain', () => {
  assertEquals(emailDomain('Recruiter Name <Jobs@Example.COM>'), 'example.com')
})

Deno.test('uses a prior linked Gmail thread as the strongest correlation', () => {
  const result = correlateReply({
    fromDomain: 'mail.example.com',
    subject: 'Update',
    snippet: 'Hello',
    priorThreadJobId: 'job-2',
  }, [
    { id: 'job-1', company: 'Other', role: 'Manager' },
    { id: 'job-2', company: 'Example', role: 'AI Program Manager' },
  ])
  assertEquals(result.method, 'thread')
  assertEquals(result.jobId, 'job-2')
})

Deno.test('matches a unique direct employer domain but not a generic ATS domain', () => {
  const direct = correlateReply({
    fromDomain: 'careers.example.com',
    subject: 'Application update',
    snippet: '',
  }, [
    { id: 'job-1', company: 'Example', role: 'AI Lead', url: 'https://example.com/jobs/1' },
  ])
  assertEquals(direct.method, 'domain')

  const ats = correlateReply({
    fromDomain: 'mail.greenhouse.io',
    subject: 'Application update',
    snippet: '',
  }, [
    { id: 'job-1', company: 'Example', role: 'AI Lead', url: 'https://boards.greenhouse.io/example/jobs/1' },
  ])
  assertEquals(ats.method, 'unmatched')
})

Deno.test('requires a clear company and role winner for fuzzy correlation', () => {
  const result = correlateReply({
    fromDomain: 'gmail.com',
    subject: 'OpenAI AI enablement manager interview',
    snippet: 'We would like to discuss the AI enablement manager role at OpenAI.',
  }, [
    { id: 'job-1', company: 'OpenAI', role: 'AI Enablement Manager' },
    { id: 'job-2', company: 'Acme', role: 'Sales Manager' },
  ])
  assertEquals(result.method, 'company_role')
  assertEquals(result.jobId, 'job-1')
})

Deno.test('maps only status-bearing classifications to proposals', () => {
  assertEquals(proposedStatus('rejection'), 'Rejected')
  assertEquals(proposedStatus('interview'), 'Interview')
  assertEquals(proposedStatus('offer'), 'Offer')
  assertEquals(proposedStatus('info_request'), null)
})

Deno.test('rejects malformed classifications and out-of-range confidence', () => {
  assertEquals(parseReplyClassification('not json'), null)
  assertEquals(parseReplyClassification(JSON.stringify({
    classification: 'interview',
    confidence: 98,
    rationale: 'Invalid confidence scale.',
  })), null)
  assertEquals(parseReplyClassification(JSON.stringify({
    classification: 'unknown',
    confidence: 0.9,
    rationale: 'Unknown label.',
  })), null)
})

Deno.test('accepts a bounded structured classification', () => {
  assertEquals(parseReplyClassification(JSON.stringify({
    classification: 'rejection',
    confidence: 0.96,
    rationale: 'The sender explicitly declined the application.',
    company_hint: 'Example',
    role_hint: 'AI Lead',
  })), {
    classification: 'rejection',
    confidence: 0.96,
    rationale: 'The sender explicitly declined the application.',
    company_hint: 'Example',
    role_hint: 'AI Lead',
  })
})
