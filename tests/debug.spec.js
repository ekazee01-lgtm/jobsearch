const { test, expect } = require('@playwright/test');

test.describe('Debug Website Structure', () => {
  test('should inspect page content and find elements', async ({ page }) => {
    console.log('🔍 Navigating to homepage...');
    await page.goto('/');

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'debug-homepage.png', fullPage: true });

    // Get page title
    const title = await page.title();
    console.log('📄 Page title:', title);

    // Get page HTML to understand structure
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('📝 Body HTML (first 500 chars):', bodyHTML.substring(0, 500));

    // Check for any buttons containing "Login" text
    console.log('🔍 Looking for Login buttons...');
    const loginButtons = page.locator('button, a, input[type="button"], input[type="submit"]').filter({ hasText: /login/i });
    const loginCount = await loginButtons.count();
    console.log('🔘 Found', loginCount, 'elements with "login" text');

    for (let i = 0; i < loginCount; i++) {
      const text = await loginButtons.nth(i).textContent();
      const tagName = await loginButtons.nth(i).evaluate(el => el.tagName);
      console.log(`  ${i + 1}. ${tagName}: "${text}"`);
    }

    // Check for navigation links
    console.log('🔍 Looking for navigation links...');
    const navLinks = page.locator('nav a, a[href^="#"]');
    const navCount = await navLinks.count();
    console.log('🔗 Found', navCount, 'navigation links');

    for (let i = 0; i < Math.min(navCount, 10); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      const text = await navLinks.nth(i).textContent();
      console.log(`  ${i + 1}. "${text}" -> ${href}`);
    }

    // Check for any forms
    console.log('🔍 Looking for forms...');
    const forms = page.locator('form');
    const formCount = await forms.count();
    console.log('📋 Found', formCount, 'forms');

    // Check for modals or hidden elements
    console.log('🔍 Looking for modal elements...');
    const modals = page.locator('[id*="modal"], [class*="modal"], [id*="auth"], [class*="auth"]');
    const modalCount = await modals.count();
    console.log('🪟 Found', modalCount, 'modal-related elements');

    // Get all clickable elements
    console.log('🔍 Looking for all clickable elements...');
    const clickable = page.locator('button, a, input[type="button"], input[type="submit"], [onclick], [role="button"]');
    const clickableCount = await clickable.count();
    console.log('👆 Found', clickableCount, 'clickable elements');

    // Check for console errors
    const messages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    if (messages.length > 0) {
      console.log('❌ Console errors found:');
      messages.forEach((msg, i) => console.log(`  ${i + 1}. ${msg}`));
    } else {
      console.log('✅ No console errors detected');
    }

    // This test should always pass - it's just for debugging
    expect(true).toBe(true);
  });
});