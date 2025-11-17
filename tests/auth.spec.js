const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage without console errors', async ({ page }) => {
    const messages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Check for critical console errors
    const criticalErrors = messages.filter(msg =>
      !msg.includes('favicon') &&
      !msg.includes('resource') &&
      !msg.includes('net::ERR_FAILED')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should open login modal when clicking Login button', async ({ page }) => {
    await page.click('button:has-text("Login")');
    await expect(page.locator('#auth-modal')).toBeVisible();
    await expect(page.locator('#auth-form h2')).toHaveText('Login');
  });

  test('should close modal via X button', async ({ page }) => {
    await page.click('button:has-text("Login")');
    await expect(page.locator('#auth-modal')).toBeVisible();

    await page.click('.close-modal');
    await expect(page.locator('#auth-modal')).not.toBeVisible();
  });

  test('should close modal when clicking outside', async ({ page }) => {
    await page.click('button:has-text("Login")');
    await expect(page.locator('#auth-modal')).toBeVisible();

    // Click on the modal backdrop
    await page.click('#auth-modal', { position: { x: 10, y: 10 } });
    await expect(page.locator('#auth-modal')).not.toBeVisible();
  });

  test('should toggle between Login and Sign Up', async ({ page }) => {
    await page.click('button:has-text("Login")');

    // Initially should be Login
    await expect(page.locator('#auth-form h2')).toHaveText('Login');
    await expect(page.locator('#auth-submit')).toHaveText('Login');

    // Click toggle to Sign Up
    await page.click('#auth-toggle');
    await expect(page.locator('#auth-form h2')).toHaveText('Sign Up');
    await expect(page.locator('#auth-submit')).toHaveText('Sign Up');

    // Toggle back to Login
    await page.click('#auth-toggle');
    await expect(page.locator('#auth-form h2')).toHaveText('Login');
    await expect(page.locator('#auth-submit')).toHaveText('Login');
  });

  test('should maintain password visibility toggle', async ({ page }) => {
    await page.click('button:has-text("Login")');

    const passwordInput = page.locator('#auth-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle password visibility
    await page.click('.password-toggle');
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Toggle back
    await page.click('.password-toggle');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.click('button:has-text("Login")');

    await page.fill('#auth-email', 'invalid@test.com');
    await page.fill('#auth-password', 'wrongpassword');
    await page.click('#auth-submit');

    // Should show error message
    await expect(page.locator('.auth-error')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Login")');

    // Try to submit empty form
    await page.click('#auth-submit');

    // Browser validation should prevent submission
    const emailInput = page.locator('#auth-email');
    await expect(emailInput).toHaveJSProperty('validity.valid', false);
  });
});

test.describe('Navigation and Anchors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should scroll to About section when clicking anchor', async ({ page }) => {
    await page.click('a[href="#about"]');
    await page.waitForTimeout(1000); // Wait for scroll animation

    const aboutSection = page.locator('#about');
    await expect(aboutSection).toBeInViewport();
  });

  test('should scroll to Experience section when clicking anchor', async ({ page }) => {
    await page.click('a[href="#experience"]');
    await page.waitForTimeout(1000);

    const experienceSection = page.locator('#experience');
    await expect(experienceSection).toBeInViewport();
  });

  test('should scroll to Contact section when clicking anchor', async ({ page }) => {
    await page.click('a[href="#contact"]');
    await page.waitForTimeout(1000);

    const contactSection = page.locator('#contact');
    await expect(contactSection).toBeInViewport();
  });

  test('should open email client when clicking email CTA', async ({ page }) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
      page.click('a[href^="mailto:"]')
    ]);

    // On some systems, mailto links don't open popups but trigger the email client
    // We just check that the link has the correct href
    const emailLink = page.locator('a[href^="mailto:"]').first();
    await expect(emailLink).toHaveAttribute('href', /mailto:.+@.+/);
  });

  test('should open LinkedIn in new tab', async ({ page }) => {
    const linkedinLink = page.locator('a[href*="linkedin.com"]').first();
    await expect(linkedinLink).toHaveAttribute('target', '_blank');

    // Verify the href is a valid LinkedIn URL
    const href = await linkedinLink.getAttribute('href');
    expect(href).toMatch(/linkedin\.com/);
  });
});

test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'Mobile', width: 320, height: 568 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1024, height: 768 }
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`should be responsive at ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      // Check that main content is visible
      await expect(page.locator('main')).toBeVisible();

      // Check that navigation is accessible (might be hidden in mobile menu)
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Check that content doesn't overflow horizontally
      const body = page.locator('body');
      const boundingBox = await body.boundingBox();
      expect(boundingBox.width).toBeLessThanOrEqual(width + 20); // Allow for small margins

      // Test login modal responsiveness
      await page.click('button:has-text("Login")');
      const modal = page.locator('#auth-modal');
      await expect(modal).toBeVisible();

      const modalBox = await modal.boundingBox();
      expect(modalBox.width).toBeLessThanOrEqual(width);
    });
  });
});