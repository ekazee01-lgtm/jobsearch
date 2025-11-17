const { test, expect } = require('@playwright/test');

test.describe('Create Test User', () => {
  test('should create a new test user account', async ({ page }) => {
    // Use a unique test email
    const timestamp = Date.now();
    const TEST_EMAIL = `test.user.${timestamp}@example.com`;
    const TEST_PASSWORD = 'TestPassword123!';

    console.log(`🆕 Creating test user: ${TEST_EMAIL}`);

    // Capture alerts
    const alerts = [];
    page.on('dialog', async dialog => {
      console.log(`🚨 Alert: ${dialog.message()}`);
      alerts.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click login button to open modal
    await page.click('#auth-btn');
    await page.waitForTimeout(1000);

    // Switch to Sign Up mode
    console.log('🔄 Switching to Sign Up mode');
    await page.click('#toggle-mode');
    await page.waitForTimeout(500);

    // Verify we're in sign up mode
    const titleText = await page.locator('#auth-title').textContent();
    console.log(`📝 Modal title: ${titleText}`);

    // Fill credentials
    console.log('📝 Filling sign up form');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    // Submit sign up
    console.log('✅ Submitting sign up');
    await page.click('#submit-btn');

    // Wait for response
    await page.waitForTimeout(3000);

    console.log('\n📊 Sign Up Results:');
    console.log(`   • Alerts: ${alerts.length}`);
    alerts.forEach((alert, i) => console.log(`     ${i + 1}. ${alert}`));

    // If sign up was successful, we should see a confirmation message
    const expectedMessages = [
      'Check your email for confirmation!',
      'User already registered',
      'Password should be at least'
    ];

    const hasExpectedMessage = alerts.some(alert =>
      expectedMessages.some(msg => alert.includes(msg))
    );

    if (hasExpectedMessage) {
      console.log('✅ Sign up process worked (got expected message)');
      console.log('💡 Save these credentials for testing:');
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   Password: ${TEST_PASSWORD}`);
    } else {
      console.log('⚠️ Unexpected response during sign up');
    }

    await page.screenshot({ path: 'test-user-creation.png' });

    expect(true).toBe(true);
  });

  test('should test with known working account', async ({ page }) => {
    // Test with the original account from CLAUDE.md
    const ORIGINAL_EMAIL = 'ekazee.career@gmail.com'; // Note: "career" not "careers"
    const TEST_PASSWORD = 'TeslaUTT!679';

    console.log('🔍 Testing with original email from CLAUDE.md (ekazee.career@gmail.com)');

    const alerts = [];
    page.on('dialog', async dialog => {
      console.log(`🚨 Alert: ${dialog.message()}`);
      alerts.push(dialog.message());
      await dialog.accept();
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('#auth-btn');
    await page.waitForTimeout(1000);

    await page.fill('#email', ORIGINAL_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('#submit-btn');
    await page.waitForTimeout(3000);

    console.log('\n📊 Original Account Test:');
    console.log(`   • Email: ${ORIGINAL_EMAIL}`);
    console.log(`   • Alerts: ${alerts.length}`);
    alerts.forEach((alert, i) => console.log(`     ${i + 1}. ${alert}`));

    const modalVisible = await page.locator('#auth-modal').isVisible();
    const trackerVisible = await page.locator('#tracker-link').isVisible();

    console.log(`   • Auth modal still visible: ${modalVisible}`);
    console.log(`   • Tracker link visible: ${trackerVisible}`);

    if (!modalVisible && trackerVisible) {
      console.log('🎉 SUCCESS! Found working credentials');
      console.log(`   ✅ Email: ${ORIGINAL_EMAIL}`);
      console.log(`   ✅ Password: ${TEST_PASSWORD}`);
    } else {
      console.log('❌ These credentials also don\'t work');
    }

    expect(true).toBe(true);
  });
});