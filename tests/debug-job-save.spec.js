const { test, expect } = require('@playwright/test');

test.describe('Debug Job Form Save Process', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should debug why job form is not saving', async ({ page }) => {
    console.log('🔍 Debugging job form save process');

    // Capture console messages and alerts
    const messages = [];
    const alerts = [];

    page.on('console', msg => {
      const text = msg.text();
      messages.push({ type: msg.type(), text });
      console.log(`📝 Console [${msg.type()}]: ${text}`);
    });

    page.on('dialog', async dialog => {
      console.log(`🚨 Alert: ${dialog.message()}`);
      alerts.push(dialog.message());
      await dialog.accept();
    });

    // Login and navigate to tracker
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('#auth-btn');
    await page.waitForTimeout(1000);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('#submit-btn');
    await page.waitForTimeout(3000);

    await page.goto('/tracker.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open job modal
    console.log('➕ Opening job modal');
    await page.click('#add-job-btn');
    await page.waitForTimeout(1000);

    // Fill form
    console.log('📝 Filling job form');
    await page.fill('#company', 'Microsoft');
    await page.fill('#role', 'Senior AI Engineer');
    await page.fill('#location', 'Seattle, WA');
    await page.fill('#source', 'LinkedIn');
    await page.fill('#job-url', 'https://linkedin.com/jobs/microsoft-ai-engineer');
    await page.fill('#min-salary', '120000');
    await page.fill('#max-salary', '180000');
    await page.selectOption('#excitement', '5'); // Assuming 5 = highest
    await page.selectOption('#status', 'To Review');
    await page.fill('#description', 'Senior AI Engineer role at Microsoft working on cutting-edge ML systems.');

    console.log('✅ Form filled completely');

    await page.screenshot({ path: 'debug-form-before-save.png' });

    // Check form validity before submitting
    const formValid = await page.evaluate(() => {
      const form = document.getElementById('job-form');
      return form ? form.checkValidity() : false;
    });

    console.log(`📋 Form valid: ${formValid}`);

    // Look for validation errors
    const requiredFields = ['#company', '#role'];
    for (const field of requiredFields) {
      const isValid = await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        return input ? input.validity.valid : false;
      }, field);
      console.log(`📋 Field ${field} valid: ${isValid}`);
    }

    // Try to submit the form
    console.log('💾 Clicking Save Job button');
    await page.click('button:has-text("Save Job")');

    // Wait a bit and see what happens
    await page.waitForTimeout(3000);

    console.log('📊 Results after save attempt:');
    console.log(`   • Alerts: ${alerts.length}`);
    alerts.forEach((alert, i) => console.log(`     ${i + 1}. ${alert}`));

    console.log(`   • Console messages: ${messages.length}`);
    const errorMessages = messages.filter(msg => msg.type === 'error');
    errorMessages.forEach((msg, i) => console.log(`     Error ${i + 1}: ${msg.text}`));

    // Check modal state
    const modalVisible = await page.locator('#job-modal').isVisible();
    console.log(`   • Modal still visible: ${modalVisible}`);

    // Check if any new job cards appeared
    const jobCards = page.locator('.job-card');
    const jobCount = await jobCards.count();
    console.log(`   • Job cards count: ${jobCount}`);

    await page.screenshot({ path: 'debug-form-after-save.png', fullPage: true });

    // If modal is still visible, check for error messages in the modal
    if (modalVisible) {
      console.log('🔍 Modal still visible, checking for error messages');
      const errorElements = page.locator('#job-modal .error, #job-modal .alert, #job-modal [class*="error"]');
      const errorCount = await errorElements.count();
      console.log(`   • Error elements in modal: ${errorCount}`);

      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`     Error ${i + 1}: ${errorText}`);
      }

      // Try alternative save button selectors
      console.log('🔍 Looking for save button alternatives');
      const saveButtons = page.locator('#job-modal button, #job-modal input[type="submit"]');
      const saveButtonCount = await saveButtons.count();
      console.log(`   • Found ${saveButtonCount} buttons in modal:`);

      for (let i = 0; i < saveButtonCount; i++) {
        const button = saveButtons.nth(i);
        const text = await button.textContent();
        const type = await button.getAttribute('type');
        const isVisible = await button.isVisible();
        console.log(`     ${i + 1}. "${text}" (type: ${type}, visible: ${isVisible})`);
      }
    }

    expect(true).toBe(true);
  });
});