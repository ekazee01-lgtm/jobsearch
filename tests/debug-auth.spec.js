const { test, expect } = require('@playwright/test');

test.describe('Debug Auth Modal', () => {
  test('should inspect auth modal structure', async ({ page }) => {
    console.log('🔍 Navigating to homepage...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'debug-before-login.png' });

    console.log('🔍 Looking for login button...');
    const authBtn = page.locator('#auth-btn');
    await expect(authBtn).toBeVisible();
    console.log('✅ Found auth button');

    console.log('🔍 Clicking login button...');
    await authBtn.click();
    await page.waitForTimeout(1000);

    console.log('📸 Taking screenshot after clicking login...');
    await page.screenshot({ path: 'debug-after-login-click.png', fullPage: true });

    // Check what's visible on the page now
    console.log('🔍 Looking for modal...');
    const modal = page.locator('#auth-modal');
    const isModalVisible = await modal.isVisible().catch(() => false);
    console.log('Modal visible:', isModalVisible);

    if (isModalVisible) {
      const modalHTML = await modal.innerHTML();
      console.log('📝 Modal HTML (first 1000 chars):', modalHTML.substring(0, 1000));
    }

    // Look for any forms or inputs
    console.log('🔍 Looking for all input fields...');
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log('📋 Found', inputCount, 'input fields');

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const isVisible = await input.isVisible();
      console.log(`  ${i + 1}. Type: ${type}, ID: ${id}, Name: ${name}, Placeholder: ${placeholder}, Visible: ${isVisible}`);
    }

    // Look for auth-related elements
    console.log('🔍 Looking for auth elements...');
    const authElements = page.locator('[id*="auth"], [class*="auth"], [name*="email"], [name*="password"]');
    const authCount = await authElements.count();
    console.log('🔐 Found', authCount, 'auth-related elements');

    for (let i = 0; i < authCount; i++) {
      const element = authElements.nth(i);
      const tagName = await element.evaluate(el => el.tagName);
      const id = await element.getAttribute('id');
      const className = await element.getAttribute('class');
      const isVisible = await element.isVisible();
      console.log(`  ${i + 1}. ${tagName}, ID: ${id}, Class: ${className}, Visible: ${isVisible}`);
    }

    // Wait a bit more to see if modal animation completes
    await page.waitForTimeout(2000);
    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: 'debug-final.png', fullPage: true });

    expect(true).toBe(true);
  });
});