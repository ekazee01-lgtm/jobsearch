const { test, expect } = require('@playwright/test');

test.describe('Debug Tracker Page', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should debug tracker page authentication and loading', async ({ page }) => {
    console.log('🔍 Starting tracker debug...');

    // First, login on the main page
    console.log('🔍 Step 1: Login on main page');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('🔍 Step 2: Click login button');
    await page.click('#auth-btn');
    await page.waitForTimeout(1000);

    console.log('🔍 Step 3: Fill credentials');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    console.log('🔍 Step 4: Submit login');
    await page.click('#submit-btn');
    await page.waitForTimeout(3000);

    console.log('📸 Taking screenshot after login...');
    await page.screenshot({ path: 'debug-after-login.png' });

    // Check if login was successful
    const modalVisible = await page.locator('#auth-modal').isVisible().catch(() => false);
    console.log('Auth modal still visible after login:', modalVisible);

    // Check for any success indicators
    const trackerLink = page.locator('#tracker-link');
    const trackerLinkVisible = await trackerLink.isVisible().catch(() => false);
    console.log('Tracker link visible:', trackerLinkVisible);

    // Now navigate to tracker
    console.log('🔍 Step 5: Navigate to tracker');
    await page.goto('/tracker.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('📸 Taking screenshot of tracker page...');
    await page.screenshot({ path: 'debug-tracker-page.png', fullPage: true });

    // Check what's on the tracker page
    const pageHTML = await page.locator('body').innerHTML();
    console.log('📝 Tracker page HTML (first 1000 chars):', pageHTML.substring(0, 1000));

    // Check for dashboard element
    const dashboard = page.locator('#dashboard');
    const dashboardExists = await dashboard.count() > 0;
    const dashboardVisible = await dashboard.isVisible().catch(() => false);
    console.log('Dashboard exists:', dashboardExists);
    console.log('Dashboard visible:', dashboardVisible);

    // Check for loading indicators
    const loading = page.locator('#loading');
    const loadingExists = await loading.count() > 0;
    const loadingVisible = await loading.isVisible().catch(() => false);
    console.log('Loading indicator exists:', loadingExists);
    console.log('Loading indicator visible:', loadingVisible);

    // Check for authentication required message
    const authRequired = page.locator('text=Authentication Required');
    const authRequiredVisible = await authRequired.isVisible().catch(() => false);
    console.log('Auth required message visible:', authRequiredVisible);

    // Check for any error messages
    const errorMessages = page.locator('.error, .alert, [class*="error"], [class*="alert"]');
    const errorCount = await errorMessages.count();
    console.log('Error messages count:', errorCount);

    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorMessages.nth(i).textContent();
        console.log(`  Error ${i + 1}: ${errorText}`);
      }
    }

    // Check console for any JavaScript errors
    const messages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    if (messages.length > 0) {
      console.log('❌ JavaScript errors found:');
      messages.forEach((msg, i) => console.log(`  ${i + 1}. ${msg}`));
    } else {
      console.log('✅ No JavaScript errors detected');
    }

    // Try to wait for any async operations
    console.log('🔍 Waiting for potential async operations...');
    await page.waitForTimeout(5000);

    const dashboardVisibleAfterWait = await dashboard.isVisible().catch(() => false);
    console.log('Dashboard visible after waiting:', dashboardVisibleAfterWait);

    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: 'debug-tracker-final.png', fullPage: true });

    expect(true).toBe(true);
  });
});