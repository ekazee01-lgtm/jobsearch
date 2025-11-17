const { expect } = require('@playwright/test');

/**
 * Test helper utilities for the job search application
 */

class TestHelper {
  constructor(page) {
    this.page = page;
  }

  /**
   * Login with test credentials
   * @param {string} email - Test email
   * @param {string} password - Test password
   */
  async login(email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD) {
    await this.page.goto('/');
    await this.page.click('button:has-text("Login")');
    await this.page.fill('#auth-email', email);
    await this.page.fill('#auth-password', password);
    await this.page.click('#auth-submit');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Navigate to tracker and ensure it's loaded
   */
  async goToTracker() {
    await this.page.goto('/tracker.html');
    await this.page.waitForSelector('#dashboard', { state: 'visible' });
  }

  /**
   * Add a sample job for testing
   * @param {Object} jobData - Job data to add
   */
  async addSampleJob(jobData = {}) {
    const defaultJob = {
      company: 'Test Company',
      role: 'Test Role',
      location: 'Test Location',
      description: 'Test job description for automated testing.',
      ...jobData
    };

    await this.page.click('#add-job-btn');
    await this.page.fill('#company', defaultJob.company);
    await this.page.fill('#role', defaultJob.role);
    if (defaultJob.location) await this.page.fill('#location', defaultJob.location);
    if (defaultJob.description) await this.page.fill('#description', defaultJob.description);
    if (defaultJob.source) await this.page.fill('#source', defaultJob.source);
    if (defaultJob.url) await this.page.fill('#job-url', defaultJob.url);
    if (defaultJob.salary) await this.page.fill('#min-salary', defaultJob.salary);
    if (defaultJob.excitement) await this.page.selectOption('#excitement', defaultJob.excitement);
    if (defaultJob.deadline) await this.page.fill('#deadline', defaultJob.deadline);

    await this.page.click('button:has-text("Save Job")');
    await this.page.waitForTimeout(1000);

    return defaultJob;
  }

  /**
   * Clean up test jobs by company name
   * @param {string} companyName - Company name to search for and delete
   */
  async cleanupTestJob(companyName) {
    try {
      const jobCard = this.page.locator(`.job-card:has-text("${companyName}")`);
      if (await jobCard.count() > 0) {
        await jobCard.hover();
        const deleteBtn = jobCard.locator('.delete-job');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          // Handle confirmation dialog if it exists
          const confirmBtn = this.page.locator('button:has-text("Delete"), button:has-text("Confirm")');
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
          }

          await this.page.waitForTimeout(500);
        }
      }
    } catch (error) {
      console.log(`Cleanup error for ${companyName}:`, error);
    }
  }

  /**
   * Wait for AI processing to complete
   * @param {number} timeout - Maximum wait time in milliseconds
   */
  async waitForAIProcessing(timeout = 60000) {
    await this.page.waitForSelector('#ai-processing', { state: 'visible' });
    await this.page.waitForSelector('#ai-processing', { state: 'hidden', timeout });
  }

  /**
   * Check for console errors (excluding known harmless ones)
   */
  async checkConsoleErrors() {
    const messages = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });

    await this.page.waitForLoadState('networkidle');

    // Filter out known harmless errors
    const criticalErrors = messages.filter(msg =>
      !msg.includes('favicon') &&
      !msg.includes('resource') &&
      !msg.includes('net::ERR_FAILED') &&
      !msg.includes('ERR_INTERNET_DISCONNECTED')
    );

    return criticalErrors;
  }

  /**
   * Take a screenshot for debugging
   * @param {string} name - Screenshot name
   */
  async screenshot(name) {
    await this.page.screenshot({ path: `test-results/${name}.png` });
  }

  /**
   * Verify modal opens and is functional
   * @param {string} modalSelector - CSS selector for the modal
   * @param {string} triggerSelector - CSS selector for the trigger element
   */
  async verifyModal(modalSelector, triggerSelector) {
    await this.page.click(triggerSelector);
    await expect(this.page.locator(modalSelector)).toBeVisible();

    // Check modal can be closed
    const closeBtn = this.page.locator(`${modalSelector} .close-modal, ${modalSelector} button:has-text("Cancel")`);
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await expect(this.page.locator(modalSelector)).not.toBeVisible();
    }
  }

  /**
   * Check responsive layout at given viewport
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  async checkResponsiveLayout(width, height) {
    await this.page.setViewportSize({ width, height });

    // Check no horizontal overflow
    const bodyWidth = await this.page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(width + 50);

    // Check main content is visible
    await expect(this.page.locator('main')).toBeVisible();

    return {
      bodyWidth,
      viewportWidth: width,
      overflow: bodyWidth > width + 50
    };
  }

  /**
   * Verify job card contains expected information
   * @param {string} companyName - Company name to find
   * @param {Object} expectedData - Expected job data
   */
  async verifyJobCard(companyName, expectedData) {
    const jobCard = this.page.locator(`.job-card:has-text("${companyName}")`);
    await expect(jobCard).toBeVisible();

    if (expectedData.role) {
      await expect(jobCard.locator(`:has-text("${expectedData.role}")`)).toBeVisible();
    }

    if (expectedData.status) {
      await expect(jobCard.locator(`.status-badge:has-text("${expectedData.status}")`)).toBeVisible();
    }

    return jobCard;
  }

  /**
   * Get current job count by status
   */
  async getJobCountsByStatus() {
    const counts = {};
    const statusColumns = this.page.locator('.kanban-column, .status-column');
    const columnCount = await statusColumns.count();

    for (let i = 0; i < columnCount; i++) {
      const column = statusColumns.nth(i);
      const header = column.locator('h3, .column-title');
      const jobs = column.locator('.job-card');

      const statusName = await header.textContent();
      const jobCount = await jobs.count();

      counts[statusName.trim()] = jobCount;
    }

    return counts;
  }

  /**
   * Wait for Supabase operations to complete
   * @param {number} timeout - Maximum wait time
   */
  async waitForSupabaseOperation(timeout = 5000) {
    // Wait for any loading indicators to disappear
    await this.page.waitForSelector('.loading, .spinner', { state: 'hidden', timeout }).catch(() => {});
    await this.page.waitForTimeout(500); // Additional buffer for network requests
  }
}

module.exports = { TestHelper };