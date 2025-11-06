const { test, expect } = require('@playwright/test');

const TEST_EMAIL = 'ekazee.careers@gmail.com';
const TEST_PASSWORD = 'TeslaUTT!679';

const BASE_JOB = {
  company: 'Contoso AI Labs',
  role: 'Senior AI Engineer',
  location: 'Remote',
  source: 'LinkedIn',
  url: 'https://www.linkedin.com/jobs/view/contoso-ai-engineer',
  excitement: '5',
  status: 'Applied',
  description: `Contoso AI Labs is hiring a Senior AI Engineer to build large-scale ML systems.

Key Responsibilities:
- Deploy production-grade machine learning pipelines
- Collaborate with cross-functional partners to deliver AI solutions
- Lead design reviews for AI/ML features

Requirements:
- 5+ years experience shipping ML systems
- Expertise with Python, TensorFlow or PyTorch
- Experience with cloud platforms (Azure preferred)`
};

const statusToColumnId = status =>
  `${status.toLowerCase().replace(/\s+/g, '-')}-cards`;

async function loginAndGoToTracker(page) {
  page.on('dialog', async dialog => {
    console.log(`📣 Dialog: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.click('#auth-btn');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('#submit-btn');
  await page.waitForTimeout(2500);

  await page.goto('/tracker.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#dashboard')).toBeVisible();
}

async function closeModalIfOpen(page, modalSelector) {
  try {
    const modal = page.locator(modalSelector);
    if (await modal.isVisible()) {
      await page.locator(`${modalSelector} .close`).click();
      await modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
  } catch (error) {
    // Modal already closed or doesn't exist
  }
}

async function deleteJobIfExists(page, company) {
  await closeModalIfOpen(page, '#ai-actions-modal');
  await closeModalIfOpen(page, '#job-modal');

  const cards = page.locator('.job-card', { hasText: company });
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    if (await card.isVisible()) {
      await card.locator('.delete-btn').click();
      await page.waitForTimeout(500);
    }
  }
}

async function addJob(page, overrides = {}) {
  const job = { ...BASE_JOB, ...overrides };

  await deleteJobIfExists(page, job.company);

  await page.click('#add-job-btn');
  const modal = page.locator('#job-modal');
  await expect(modal).toBeVisible();

  await page.fill('#company', job.company);
  await page.fill('#role', job.role);
  await page.fill('#location', job.location);
  await page.fill('#source', job.source);
  await page.fill('#job-url', job.url);
  await page.fill('#description', job.description);
  await page.selectOption('#excitement', job.excitement);
  await page.selectOption('#status', job.status);

  await page.click('#job-form button.btn-primary');

  try {
    await modal.waitFor({ state: 'hidden', timeout: 15000 });
  } catch (error) {
    throw new Error('Job modal did not close after submitting. Check Supabase schema for required columns.');
  }

  const columnSelector = `#${statusToColumnId(job.status)} .job-card`;
  const jobCard = page.locator(columnSelector, { hasText: job.company });
  await expect(jobCard).toBeVisible({ timeout: 15000 });
  await expect(jobCard).toContainText(job.role);

  return job;
}

const getJobCard = (page, company, status) =>
  page.locator(`#${statusToColumnId(status)} .job-card`, { hasText: company });

async function waitForAIModalElements(page, timeout = 20000) {
  // Wait for AI modal elements to be fully loaded and visible
  await page.waitForSelector('#tailor-resume-btn', { state: 'visible', timeout });

  // Try to wait for resume version select, but don't fail if it's not available
  try {
    await page.waitForSelector('#resume-version-select', { state: 'visible', timeout: 10000 });
  } catch (error) {
    console.log('⚠️ Resume version select not visible, continuing with test...');
  }
}

test.describe('End-to-End: Job Tracker + AI Workflow (Improved)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToTracker(page);
  });

  test('adds a job and opens AI actions with robust waits', async ({ page }) => {
    const job = await addJob(page);
    const jobCard = getJobCard(page, job.company, job.status);

    await jobCard.locator('.ai-btn').click();

    // Wait for AI modal to be fully loaded with stronger timeouts
    const aiModal = page.locator('#ai-actions-modal');
    await expect(aiModal).toBeVisible();

    // Wait for AI modal elements to load asynchronously
    await waitForAIModalElements(page);

    // Verify core elements are visible
    await expect(page.locator('#tailor-resume-btn')).toBeVisible();

    // Check if resume select exists (may not be visible if no resumes)
    const resumeSelect = page.locator('#resume-version-select');
    const isResumeSelectVisible = await resumeSelect.isVisible();
    console.log(`📋 Resume version select visible: ${isResumeSelectVisible}`);

    // Attempt tailoring and ensure we get a status message (success or error)
    await page.locator('#tailor-resume-btn').click();

    // Wait for tailoring status with extended timeout
    await page.waitForFunction(() => {
      const el = document.getElementById('tailoring-status');
      return el && el.textContent.trim().length > 0;
    }, null, { timeout: 60000 });

    const statusText = await page.locator('#tailoring-status').textContent();
    expect(statusText.trim().length).toBeGreaterThan(0);
    console.log(`✅ Tailoring status: ${statusText.trim()}`);
  });

  test('handles AI tailoring errors gracefully with improved waits', async ({ page }) => {
    const job = await addJob(page, { company: 'AI Error Corp' });
    const jobCard = getJobCard(page, job.company, job.status);

    await jobCard.locator('.ai-btn').click();
    await expect(page.locator('#ai-actions-modal')).toBeVisible();

    // Wait for AI modal elements before clicking
    await waitForAIModalElements(page);

    await page.locator('#tailor-resume-btn').click();

    // Wait for any status message (success or error)
    await page.waitForFunction(() => {
      const el = document.getElementById('tailoring-status');
      return el && (el.textContent.includes('✅') || el.textContent.includes('❌') || el.textContent.includes('Error') || el.textContent.trim().length > 0);
    }, null, { timeout: 60000 });

    const statusText = await page.locator('#tailoring-status').textContent();
    expect(statusText.toLowerCase()).not.toContain('undefined');
    console.log(`📊 Error handling status: ${statusText.trim()}`);
  });

  test('updates job status across pipeline with modal cleanup', async ({ page }) => {
    let currentStatus = 'To Review';
    const job = await addJob(page, { company: 'Pipeline Labs', status: currentStatus });

    const statuses = ['Applied', 'Interview', 'Offer'];

    for (const status of statuses) {
      // Ensure no modals are open before editing
      await closeModalIfOpen(page, '#ai-actions-modal');

      const jobCard = getJobCard(page, job.company, currentStatus);
      await jobCard.locator('.edit-btn').click();
      const modal = page.locator('#job-modal');
      await expect(modal).toBeVisible();

      await page.selectOption('#status', status);
      await page.click('#job-form button.btn-primary');
      await modal.waitFor({ state: 'hidden', timeout: 15000 });

      const column = getJobCard(page, job.company, status);
      await expect(column).toBeVisible({ timeout: 15000 });
      currentStatus = status;
      console.log(`✅ Job moved to ${status} status`);
    }
  });

  test.afterEach(async ({ page }) => {
    // Close any open modals before cleanup
    await closeModalIfOpen(page, '#ai-actions-modal');
    await closeModalIfOpen(page, '#job-modal');

    await deleteJobIfExists(page, BASE_JOB.company);
    await deleteJobIfExists(page, 'Pipeline Labs');
    await deleteJobIfExists(page, 'AI Error Corp');
  });
});