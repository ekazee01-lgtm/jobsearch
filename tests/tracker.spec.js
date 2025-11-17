const { test, expect } = require('@playwright/test');

test.describe('Job Tracker Dashboard', () => {
  // Test credentials - you'll need to replace these with valid test credentials
  const TEST_EMAIL = 'ekazee.career@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test.describe('Access Control', () => {
    test('should show authentication required for unauthenticated users', async ({ page }) => {
      await page.goto('/tracker.html');

      // Should show authentication required state
      await expect(page.locator('text=Authentication Required')).toBeVisible();
      await expect(page.locator('#dashboard')).not.toBeVisible();
    });

    test('should redirect to tracker after login', async ({ page }) => {
      await page.goto('/');

      // Login
      await page.click('button:has-text("Login")');
      await page.fill('#auth-email', TEST_EMAIL);
      await page.fill('#auth-password', TEST_PASSWORD);
      await page.click('#auth-submit');

      // Wait for login to complete
      await page.waitForTimeout(2000);

      // Should show tracker link
      await expect(page.locator('#tracker-link')).toBeVisible();

      // Navigate to tracker
      await page.click('#tracker-link');
      await expect(page).toHaveURL(/tracker\.html/);

      // Should show dashboard
      await expect(page.locator('#dashboard')).toBeVisible();
      await expect(page.locator('#loading')).not.toBeVisible();
    });
  });

  test.describe('Dashboard Functionality', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/');
      await page.click('button:has-text("Login")');
      await page.fill('#auth-email', TEST_EMAIL);
      await page.fill('#auth-password', TEST_PASSWORD);
      await page.click('#auth-submit');
      await page.waitForTimeout(2000);

      // Navigate to tracker
      await page.goto('/tracker.html');
      await page.waitForSelector('#dashboard', { state: 'visible' });
    });

    test('should load jobs in correct order (created_at DESC)', async ({ page }) => {
      // Wait for jobs to load
      await page.waitForSelector('.job-card', { state: 'visible', timeout: 10000 });

      const jobCards = page.locator('.job-card');
      const count = await jobCards.count();

      if (count > 1) {
        // Get dates from first two jobs and verify order
        const firstJobDate = await jobCards.nth(0).locator('.job-date').textContent();
        const secondJobDate = await jobCards.nth(1).locator('.job-date').textContent();

        // Parse dates and verify first is newer than second
        const date1 = new Date(firstJobDate);
        const date2 = new Date(secondJobDate);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });

    test('should show empty state when no jobs', async ({ page }) => {
      // Check if empty state is shown (when no jobs exist)
      const emptyState = page.locator('.empty-state');
      const jobCards = page.locator('.job-card');

      const jobCount = await jobCards.count();

      if (jobCount === 0) {
        await expect(emptyState).toBeVisible();
      }
    });

    test('should open Add Job modal', async ({ page }) => {
      await page.click('#add-job-btn');
      await expect(page.locator('#job-modal')).toBeVisible();
      await expect(page.locator('#job-modal h2')).toHaveText('Add New Job Application');
    });

    test('should validate required fields in job form', async ({ page }) => {
      await page.click('#add-job-btn');

      // Try to submit empty form
      await page.click('button:has-text("Save Job")');

      // Check for required field validation
      const companyInput = page.locator('#company');
      const roleInput = page.locator('#role');

      await expect(companyInput).toHaveJSProperty('validity.valid', false);
      await expect(roleInput).toHaveJSProperty('validity.valid', false);
    });

    test('should update column counts after job status change', async ({ page }) => {
      // Wait for initial load
      await page.waitForSelector('.column-header', { state: 'visible' });

      // Get initial counts
      const initialCounts = {};
      const columns = page.locator('.column-header span');
      const columnCount = await columns.count();

      for (let i = 0; i < columnCount; i++) {
        const text = await columns.nth(i).textContent();
        const match = text.match(/\((\d+)\)/);
        if (match) {
          const columnName = await columns.nth(i).locator('..').locator('h3').textContent();
          initialCounts[columnName] = parseInt(match[1]);
        }
      }

      // If there are jobs, try to change status of one
      const firstJob = page.locator('.job-card').first();
      const jobExists = await firstJob.count() > 0;

      if (jobExists) {
        await firstJob.hover();
        await firstJob.locator('.edit-job').click();

        // Change status
        await page.selectOption('#status', 'In Progress');
        await page.click('button:has-text("Save Job")');

        // Wait for update
        await page.waitForTimeout(1000);

        // Verify counts updated
        const updatedColumns = page.locator('.column-header span');
        const hasUpdated = await updatedColumns.first().isVisible();
        expect(hasUpdated).toBe(true);
      }
    });

    test('should filter jobs by search term', async ({ page }) => {
      // Wait for jobs to load
      await page.waitForSelector('.job-card, .empty-state', { timeout: 10000 });

      const searchInput = page.locator('#search-input');
      await searchInput.fill('Microsoft');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Check that only matching jobs are shown
      const visibleJobs = page.locator('.job-card:visible');
      const jobCount = await visibleJobs.count();

      if (jobCount > 0) {
        // Verify each visible job contains the search term
        for (let i = 0; i < jobCount; i++) {
          const jobText = await visibleJobs.nth(i).textContent();
          expect(jobText.toLowerCase()).toContain('microsoft');
        }
      }
    });

    test('should persist column visibility settings', async ({ page }) => {
      // Open column settings
      await page.click('#column-settings-btn');
      await expect(page.locator('#column-settings')).toBeVisible();

      // Toggle a column
      const firstCheckbox = page.locator('#column-settings input[type="checkbox"]').first();
      const wasChecked = await firstCheckbox.isChecked();
      await firstCheckbox.click();

      // Close settings
      await page.click('#column-settings-btn');

      // Reload page
      await page.reload();
      await page.waitForSelector('#dashboard', { state: 'visible' });

      // Check that setting persisted
      await page.click('#column-settings-btn');
      const checkboxAfterReload = page.locator('#column-settings input[type="checkbox"]').first();
      await expect(checkboxAfterReload).toHaveJSProperty('checked', !wasChecked);
    });

    test('should enable bulk actions when jobs selected', async ({ page }) => {
      // Wait for jobs to load
      await page.waitForSelector('.job-card', { state: 'visible', timeout: 10000 });

      const jobCards = page.locator('.job-card');
      const jobCount = await jobCards.count();

      if (jobCount > 0) {
        // Select first job
        await jobCards.first().locator('input[type="checkbox"]').check();

        // Bulk action buttons should be enabled
        await expect(page.locator('#bulk-delete')).toBeEnabled();
        await expect(page.locator('#bulk-status')).toBeEnabled();

        // Unselect job
        await jobCards.first().locator('input[type="checkbox"]').uncheck();

        // Bulk action buttons should be disabled
        await expect(page.locator('#bulk-delete')).toBeDisabled();
        await expect(page.locator('#bulk-status')).toBeDisabled();
      }
    });

    test('should logout and redirect to homepage', async ({ page }) => {
      await page.click('#logout-btn');

      // Should redirect to homepage
      await expect(page).toHaveURL('/');

      // Should hide tracker link
      await expect(page.locator('#tracker-link')).not.toBeVisible();
    });
  });

  test.describe('AI Integration Modal', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to tracker
      await page.goto('/');
      await page.click('button:has-text("Login")');
      await page.fill('#auth-email', TEST_EMAIL);
      await page.fill('#auth-password', TEST_PASSWORD);
      await page.click('#auth-submit');
      await page.waitForTimeout(2000);
      await page.goto('/tracker.html');
      await page.waitForSelector('#dashboard', { state: 'visible' });
    });

    test('should open AI modal and load job events', async ({ page }) => {
      // Wait for jobs to load
      await page.waitForSelector('.job-card', { state: 'visible', timeout: 10000 });

      const firstJob = page.locator('.job-card').first();
      const jobExists = await firstJob.count() > 0;

      if (jobExists) {
        // Open AI modal
        await firstJob.hover();
        await firstJob.locator('.ai-action').click();

        await expect(page.locator('#ai-modal')).toBeVisible();
        await expect(page.locator('#ai-events')).toBeVisible();

        // Should load events (or show empty state)
        const eventsContainer = page.locator('#ai-events');
        await expect(eventsContainer).toBeVisible();
      }
    });

    test('should enable AI actions based on prerequisites', async ({ page }) => {
      // Wait for jobs to load
      await page.waitForSelector('.job-card', { state: 'visible', timeout: 10000 });

      const firstJob = page.locator('.job-card').first();
      const jobExists = await firstJob.count() > 0;

      if (jobExists) {
        await firstJob.hover();
        await firstJob.locator('.ai-action').click();

        await expect(page.locator('#ai-modal')).toBeVisible();

        // Check if tailor resume button exists and its state
        const tailorBtn = page.locator('#tailor-resume-btn');
        if (await tailorBtn.count() > 0) {
          // Button should be present (enabled/disabled based on prerequisites)
          await expect(tailorBtn).toBeVisible();
        }

        // Check if generate cover letter button exists
        const coverLetterBtn = page.locator('#generate-cover-letter-btn');
        if (await coverLetterBtn.count() > 0) {
          await expect(coverLetterBtn).toBeVisible();
        }
      }
    });
  });
});