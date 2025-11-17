const { test, expect } = require('@playwright/test');

test.describe('Debug Authentication Errors', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should capture authentication error messages', async ({ page }) => {
    console.log('🔍 Testing authentication with error capture...');

    // Capture alert messages
    const alerts = [];
    page.on('dialog', async dialog => {
      console.log(`🚨 Alert: ${dialog.message()}`);
      alerts.push(dialog.message());
      await dialog.accept();
    });

    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      console.log(`📝 Console [${msg.type()}]: ${text}`);
    });

    // Navigate to homepage
    console.log('📍 Step 1: Navigate to homepage');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click login button
    console.log('🔍 Step 2: Click login button');
    await page.click('#auth-btn');
    await page.waitForTimeout(1000);

    console.log('🔍 Step 3: Fill credentials and submit');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    // Submit and wait for response
    await page.click('#submit-btn');
    console.log('⏳ Waiting for authentication response...');

    // Wait longer for potential async operations
    await page.waitForTimeout(5000);

    // Check what happened
    console.log('\n📊 Results:');
    console.log(`   • Alerts captured: ${alerts.length}`);
    alerts.forEach((alert, i) => console.log(`     ${i + 1}. ${alert}`));

    console.log(`   • Console messages: ${consoleMessages.length}`);
    consoleMessages.forEach((msg, i) => {
      if (msg.type === 'error' || msg.text.toLowerCase().includes('error')) {
        console.log(`     ${i + 1}. [${msg.type}] ${msg.text}`);
      }
    });

    // Check modal state
    const modalVisible = await page.locator('#auth-modal').isVisible();
    console.log(`   • Auth modal still visible: ${modalVisible}`);

    // Check tracker link
    const trackerVisible = await page.locator('#tracker-link').isVisible();
    console.log(`   • Tracker link visible: ${trackerVisible}`);

    // Try a test with wrong credentials to see if we get an error
    if (modalVisible && alerts.length === 0) {
      console.log('\n🔍 Step 4: Test with obviously wrong credentials to verify error handling');

      await page.fill('#email', 'wrong@email.com');
      await page.fill('#password', 'wrongpassword');
      await page.click('#submit-btn');
      await page.waitForTimeout(3000);

      console.log(`   • Additional alerts after wrong credentials: ${alerts.length}`);
      if (alerts.length > 0) {
        console.log(`     Last alert: ${alerts[alerts.length - 1]}`);
      }
    }

    // Check if there are any network errors
    console.log('\n🌐 Network activity check:');

    // Listen for network errors
    page.on('requestfailed', request => {
      console.log(`❌ Network request failed: ${request.url()}`);
    });

    // Try auth one more time to capture network activity
    if (modalVisible) {
      console.log('🔍 Step 5: Retry authentication to capture network activity');
      await page.fill('#email', TEST_EMAIL);
      await page.fill('#password', TEST_PASSWORD);
      await page.click('#submit-btn');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'debug-auth-final.png' });

    // Always pass - this is a debug test
    expect(true).toBe(true);
  });
});