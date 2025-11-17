const { test, expect } = require('@playwright/test');

test.describe('Debug Tracker Dashboard Elements', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should inspect tracker dashboard and find available buttons', async ({ page }) => {
    console.log('🚀 Testing complete auth flow and dashboard inspection');

    // Step 1: Login
    console.log('🔐 Step 1: Authenticate');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#auth-btn');
    await page.waitForTimeout(1000);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('#submit-btn');
    await page.waitForTimeout(3000);

    // Verify login success
    const modalVisible = await page.locator('#auth-modal').isVisible();
    const trackerVisible = await page.locator('#tracker-link').isVisible();
    console.log(`✅ Login success - Modal hidden: ${!modalVisible}, Tracker link: ${trackerVisible}`);

    // Step 2: Navigate to tracker
    console.log('📊 Step 2: Navigate to tracker dashboard');
    await page.goto('/tracker.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('📸 Taking tracker dashboard screenshot');
    await page.screenshot({ path: 'debug-tracker-dashboard.png', fullPage: true });

    // Step 3: Inspect dashboard elements
    console.log('🔍 Step 3: Inspect dashboard elements');

    // Check if dashboard is visible
    const dashboard = page.locator('#dashboard');
    const dashboardVisible = await dashboard.isVisible();
    console.log(`📊 Dashboard visible: ${dashboardVisible}`);

    // Check for auth required message
    const authRequired = page.locator('#auth-required');
    const authRequiredVisible = await authRequired.isVisible();
    console.log(`🔒 Auth required message visible: ${authRequiredVisible}`);

    // If dashboard is not visible, wait and try again
    if (!dashboardVisible) {
      console.log('⏳ Dashboard not visible, waiting for async load...');
      await page.waitForTimeout(5000);
      const dashboardVisibleAfterWait = await dashboard.isVisible();
      console.log(`📊 Dashboard visible after wait: ${dashboardVisibleAfterWait}`);
    }

    // Look for all buttons on the page
    console.log('🔘 Step 4: Find all buttons');
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`🔘 Found ${buttonCount} buttons:`);

    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      const id = await button.getAttribute('id');
      const className = await button.getAttribute('class');
      const isVisible = await button.isVisible();
      console.log(`  ${i + 1}. "${text}" (ID: ${id}, Class: ${className}, Visible: ${isVisible})`);
    }

    // Look for elements with "Add" in the text
    console.log('➕ Step 5: Look for Add-related elements');
    const addElements = page.locator('button, a, div').filter({ hasText: /add/i });
    const addCount = await addElements.count();
    console.log(`➕ Found ${addCount} elements with "add" text:`);

    for (let i = 0; i < addCount; i++) {
      const element = addElements.nth(i);
      const tagName = await element.evaluate(el => el.tagName);
      const text = await element.textContent();
      const isVisible = await element.isVisible();
      console.log(`  ${i + 1}. ${tagName}: "${text}" (Visible: ${isVisible})`);
    }

    // Look for job-related elements
    console.log('💼 Step 6: Look for job-related elements');
    const jobElements = page.locator('button, a, div').filter({ hasText: /job/i });
    const jobCount = await jobElements.count();
    console.log(`💼 Found ${jobCount} elements with "job" text:`);

    for (let i = 0; i < Math.min(jobCount, 10); i++) {
      const element = jobElements.nth(i);
      const tagName = await element.evaluate(el => el.tagName);
      const text = await element.textContent();
      const isVisible = await element.isVisible();
      console.log(`  ${i + 1}. ${tagName}: "${text}" (Visible: ${isVisible})`);
    }

    // Check the page HTML for any hidden elements
    console.log('📝 Step 7: Check page structure');
    const bodyHTML = await page.locator('body').innerHTML();
    const hasAddJobText = bodyHTML.toLowerCase().includes('add job');
    const hasJobModalText = bodyHTML.toLowerCase().includes('job-modal');

    console.log(`📝 Page contains "add job" text: ${hasAddJobText}`);
    console.log(`📝 Page contains "job-modal" text: ${hasJobModalText}`);

    // Look for any modals or hidden containers
    console.log('🪟 Step 8: Look for modal containers');
    const modals = page.locator('[id*="modal"], [class*="modal"]');
    const modalCount = await modals.count();
    console.log(`🪟 Found ${modalCount} modal containers:`);

    for (let i = 0; i < modalCount; i++) {
      const modal = modals.nth(i);
      const id = await modal.getAttribute('id');
      const className = await modal.getAttribute('class');
      const isVisible = await modal.isVisible();
      console.log(`  ${i + 1}. ID: ${id}, Class: ${className}, Visible: ${isVisible}`);
    }

    console.log('✅ Dashboard inspection complete');
    expect(true).toBe(true);
  });
});