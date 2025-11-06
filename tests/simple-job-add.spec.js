const { test, expect } = require('@playwright/test');

test.describe('Simple Job Addition Test', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should successfully add a job application', async ({ page }) => {
    const dialogMessages = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    const jobData = {
      company: 'Microsoft',
      role: 'Senior AI Engineer',
      location: 'Seattle, WA',
      source: 'LinkedIn',
      url: 'https://careers.microsoft.com/jobs/ai-engineer',
      description: `We are seeking a Senior AI Engineer to join our cutting-edge AI team at Microsoft.

Key Responsibilities:
- Develop and deploy machine learning models at scale
- Work with Python, TensorFlow, and Azure ML
- Collaborate with cross-functional teams on AI initiatives

Requirements:
- 5+ years of experience in machine learning and AI
- Strong proficiency in Python, TensorFlow, PyTorch
- Experience with cloud platforms (Azure preferred)`
    };

    console.log('🚀 Testing simple job addition workflow');

    // Step 1: Login
    console.log('🔐 Step 1: Authenticate');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#auth-btn');
    await page.waitForTimeout(300);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('#submit-btn');
    await page.waitForTimeout(2500);

    console.log('✅ Login completed');

    // Step 2: Navigate to tracker
    console.log('📊 Step 2: Navigate to tracker');
    await page.goto('/tracker.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#dashboard')).toBeVisible();
    console.log('✅ Dashboard loaded');

    // Step 3: Click Add Job button
    console.log('➕ Step 3: Click Add Job button');
    await page.click('#add-job-btn');
    const jobModal = page.locator('#job-modal');
    await expect(jobModal).toBeVisible();
    console.log('✅ Job modal opened');

    await page.screenshot({ path: 'simple-test-modal-open.png' });

    // Step 4: Fill out job information
    console.log('📝 Step 4: Fill job form');
    await page.fill('#company', jobData.company);
    await page.fill('#role', jobData.role);
    await page.fill('#location', jobData.location);
    await page.fill('#source', jobData.source);
    await page.fill('#job-url', jobData.url);
    await page.fill('#description', jobData.description);
    await page.selectOption('#excitement', '5');
    await page.selectOption('#status', 'Applied');
    console.log('✅ Form filled');

    await page.screenshot({ path: 'simple-test-form-filled.png' });

    // Step 5: Save the job
    console.log('💾 Step 5: Save job');
    await page.click('#job-form button.btn-primary');

    let modalClosed = true;
    try {
      await jobModal.waitFor({ state: 'hidden', timeout: 15000 });
    } catch (error) {
      modalClosed = false;
    }

    if (!modalClosed) {
      const message = dialogMessages[0] || 'Job modal did not close after saving.';
      throw new Error(`Job save failed: ${message}`);
    }

    console.log('✅ Modal closed');

    // Step 6: Verify job appears in Applied column
    const appliedColumnJob = page.locator('#applied-cards .job-card', { hasText: jobData.company });
    await expect(appliedColumnJob).toBeVisible({ timeout: 15000 });
    await expect(appliedColumnJob).toContainText(jobData.role);
    console.log('🎉 SUCCESS! Job appears in Applied column');

    await page.screenshot({ path: 'simple-test-job-added.png' });
    await page.screenshot({ path: 'simple-test-final.png', fullPage: true });

    console.log('✅ Simple job addition test completed');
  });
});
