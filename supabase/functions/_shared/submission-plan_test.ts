import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { candidateAnswers, routeJob } from './submission-plan.ts'

Deno.test('routes explicit mailto destinations to email', () => {
  const route = routeJob({ url: 'mailto:careers@example.com' })
  assertEquals(route.channel, 'email')
  assertEquals(route.evidence.email, 'careers@example.com')
})

Deno.test('routes known ATS URLs to assisted without API authorization', () => {
  const route = routeJob({
    url: 'https://example.wd5.myworkdayjobs.com/en-US/jobs/job/123',
  })
  assertEquals(route.channel, 'assisted')
  assertEquals(route.evidence.provider, 'workday')
  assertEquals(route.evidence.api_authorized, false)
})

Deno.test('routes a missing destination to manual intervention', () => {
  const route = routeJob({})
  assertEquals(route.channel, 'manual')
  assertEquals(route.interventionReason, 'missing_destination')
})

Deno.test('routes malformed URLs to manual intervention', () => {
  const route = routeJob({ url: 'not a valid url' })
  assertEquals(route.channel, 'manual')
  assertEquals(route.interventionReason, 'invalid_url')
})

Deno.test('uses auth metadata before Master resume contact fields', () => {
  const answers = candidateAnswers({
    email: 'auth@example.com',
    user_metadata: { full_name: 'Auth Name' },
  }, '# Resume Name\nresume@example.com\n(555) 111-2222')

  assertEquals(answers.find((answer) => answer.question_key === 'full_name')?.answer, 'Auth Name')
  assertEquals(answers.find((answer) => answer.question_key === 'email')?.answer, 'auth@example.com')
  assertEquals(answers.find((answer) => answer.question_key === 'phone')?.answer, '(555) 111-2222')
})
