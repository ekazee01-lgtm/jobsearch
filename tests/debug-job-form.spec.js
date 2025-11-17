const { test, expect } = require('@playwright/test');

test.describe('Debug Job Form Fields', () => {
  const TEST_EMAIL = 'ekazee.careers@gmail.com';
  const TEST_PASSWORD = 'TeslaUTT!679';

  test('should inspect job form fields and selectors', async ({ page }) => {
    console.log('🔍 Debugging job form fields');

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

    // Click Add Job button
    console.log('➕ Opening job modal');
    await page.click('#add-job-btn');
    await page.waitForTimeout(1000);

    // Verify modal is open
    await expect(page.locator('#job-modal')).toBeVisible();
    console.log('✅ Job modal is open');

    await page.screenshot({ path: 'debug-job-form-modal.png' });

    // Inspect all input fields in the modal
    console.log('🔍 Finding all input fields in job modal');
    const inputs = page.locator('#job-modal input');
    const inputCount = await inputs.count();
    console.log(`📝 Found ${inputCount} input fields:`);

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const isVisible = await input.isVisible();
      console.log(`  ${i + 1}. Type: ${type}, ID: ${id}, Name: ${name}, Placeholder: "${placeholder}", Visible: ${isVisible}`);
    }

    // Inspect textareas
    console.log('🔍 Finding all textarea fields in job modal');
    const textareas = page.locator('#job-modal textarea');
    const textareaCount = await textareas.count();
    console.log(`📝 Found ${textareaCount} textarea fields:`);

    for (let i = 0; i < textareaCount; i++) {
      const textarea = textareas.nth(i);
      const id = await textarea.getAttribute('id');
      const name = await textarea.getAttribute('name');
      const placeholder = await textarea.getAttribute('placeholder');
      const isVisible = await textarea.isVisible();
      console.log(`  ${i + 1}. ID: ${id}, Name: ${name}, Placeholder: "${placeholder}", Visible: ${isVisible}`);
    }

    // Inspect select fields
    console.log('🔍 Finding all select fields in job modal');
    const selects = page.locator('#job-modal select');
    const selectCount = await selects.count();
    console.log(`📝 Found ${selectCount} select fields:`);

    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const id = await select.getAttribute('id');
      const name = await select.getAttribute('name');
      const isVisible = await select.isVisible();
      console.log(`  ${i + 1}. ID: ${id}, Name: ${name}, Visible: ${isVisible}`);
    }

    // Get the modal HTML to understand the structure
    console.log('🔍 Job modal HTML structure');
    const modalHTML = await page.locator('#job-modal').innerHTML();

    // Extract just the form part
    const formStartIndex = modalHTML.indexOf('<form');
    const formEndIndex = modalHTML.indexOf('</form>') + 7;
    if (formStartIndex !== -1 && formEndIndex !== -1) {
      const formHTML = modalHTML.substring(formStartIndex, formEndIndex);
      console.log('📝 Form HTML (first 1500 chars):');
      console.log(formHTML.substring(0, 1500));
    }

    expect(true).toBe(true);
  });
});