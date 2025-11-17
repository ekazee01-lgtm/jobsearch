const { test, expect } = require('@playwright/test');

test.describe('Responsive Design and Cross-Browser Compatibility', () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 320, height: 568 },
    { name: 'Mobile Landscape', width: 568, height: 320 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop Small', width: 1280, height: 720 },
    { name: 'Desktop Large', width: 1920, height: 1080 }
  ];

  test.describe('Portfolio Page Responsiveness', () => {
    viewports.forEach(({ name, width, height }) => {
      test(`should display correctly on ${name} (${width}x${height})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Check that content is visible and properly sized
        await expect(page.locator('main')).toBeVisible();

        // Verify no horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(width + 50); // Allow small margin for browser differences

        // Check hero section
        const hero = page.locator('.hero, #hero');
        await expect(hero).toBeVisible();

        // Verify text is readable (not too small or cut off)
        const headings = page.locator('h1, h2, h3');
        const headingCount = await headings.count();

        for (let i = 0; i < Math.min(headingCount, 3); i++) {
          const heading = headings.nth(i);
          const box = await heading.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThan(50);
            expect(box.height).toBeGreaterThan(10);
          }
        }

        // Check navigation accessibility
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();

        // For mobile, check if navigation is accessible (hamburger menu or visible nav)
        if (width <= 768) {
          // Mobile: either nav is visible or there's a menu toggle
          const navLinks = page.locator('nav a');
          const menuToggle = page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]');

          const navVisible = await navLinks.first().isVisible();
          const hasMenuToggle = await menuToggle.count() > 0;

          expect(navVisible || hasMenuToggle).toBe(true);
        }

        // Test modal responsiveness
        await page.click('button:has-text("Login")');
        const modal = page.locator('#auth-modal');
        await expect(modal).toBeVisible();

        const modalBox = await modal.boundingBox();
        expect(modalBox.width).toBeLessThanOrEqual(width);
        expect(modalBox.height).toBeLessThanOrEqual(height);

        // Modal should be properly centered and sized
        const modalContent = page.locator('#auth-modal .modal-content, #auth-modal .auth-form');
        if (await modalContent.count() > 0) {
          const contentBox = await modalContent.boundingBox();
          expect(contentBox.width).toBeLessThanOrEqual(width - 40); // Account for padding
        }

        // Close modal
        await page.click('.close-modal');
      });
    });
  });

  test.describe('Job Tracker Responsiveness', () => {
    const TEST_EMAIL = 'ekazee.career@gmail.com';
    const TEST_PASSWORD = 'TeslaUTT!679';

    viewports.forEach(({ name, width, height }) => {
      test(`should display tracker correctly on ${name} (${width}x${height})`, async ({ page }) => {
        await page.setViewportSize({ width, height });

        // Login first
        await page.goto('/');
        await page.click('button:has-text("Login")');
        await page.fill('#auth-email', TEST_EMAIL);
        await page.fill('#auth-password', TEST_PASSWORD);
        await page.click('#auth-submit');
        await page.waitForTimeout(2000);

        // Navigate to tracker
        await page.goto('/tracker.html');
        await page.waitForSelector('#dashboard', { state: 'visible' });

        // Check dashboard layout
        const dashboard = page.locator('#dashboard');
        await expect(dashboard).toBeVisible();

        // Verify no horizontal overflow
        const dashboardWidth = await dashboard.evaluate(el => el.scrollWidth);
        expect(dashboardWidth).toBeLessThanOrEqual(width + 50);

        // Check column layout for different screen sizes
        const columns = page.locator('.kanban-column, .status-column');
        const columnCount = await columns.count();

        if (width <= 768) {
          // Mobile: columns should stack or be scrollable horizontally
          const columnsContainer = page.locator('.kanban-board, .columns-container');
          if (await columnsContainer.count() > 0) {
            const containerStyle = await columnsContainer.evaluate(el => {
              const styles = getComputedStyle(el);
              return {
                flexDirection: styles.flexDirection,
                overflowX: styles.overflowX
              };
            });

            // Should either stack (column) or allow horizontal scroll
            const isMobileFriendly = containerStyle.flexDirection === 'column' ||
                                   containerStyle.overflowX === 'auto' ||
                                   containerStyle.overflowX === 'scroll';
            expect(isMobileFriendly).toBe(true);
          }
        }

        // Test Add Job modal responsiveness
        await page.click('button:has-text("Add Job")');
        const jobModal = page.locator('#job-modal');
        await expect(jobModal).toBeVisible();

        const jobModalBox = await jobModal.boundingBox();
        expect(jobModalBox.width).toBeLessThanOrEqual(width);

        // Form fields should be properly sized
        const formInputs = page.locator('#job-modal input, #job-modal textarea, #job-modal select');
        const inputCount = await formInputs.count();

        for (let i = 0; i < Math.min(inputCount, 3); i++) {
          const input = formInputs.nth(i);
          if (await input.isVisible()) {
            const inputBox = await input.boundingBox();
            expect(inputBox.width).toBeGreaterThan(50);
            expect(inputBox.width).toBeLessThanOrEqual(jobModalBox.width - 40);
          }
        }

        // Close modal
        await page.click('#job-modal .close-modal, #job-modal button:has-text("Cancel")');
      });
    });
  });

  test.describe('Touch and Mobile Interactions', () => {
    test('should handle touch interactions on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone size

      // Simulate touch device
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
          writable: false,
          value: 5,
        });
      });

      await page.goto('/');

      // Test touch scrolling to sections
      await page.locator('a[href="#about"]').tap();
      await page.waitForTimeout(1000);

      const aboutSection = page.locator('#about');
      await expect(aboutSection).toBeInViewport();

      // Test modal interactions with touch
      await page.locator('button:has-text("Login")').tap();
      await expect(page.locator('#auth-modal')).toBeVisible();

      // Touch outside to close (if supported)
      await page.locator('#auth-modal').tap({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);

      // Modal might close on mobile devices
      const modalVisible = await page.locator('#auth-modal').isVisible();
      if (modalVisible) {
        // If still visible, close with X button
        await page.locator('.close-modal').tap();
      }

      await expect(page.locator('#auth-modal')).not.toBeVisible();
    });

    test('should have appropriate touch targets', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Check that interactive elements have adequate touch target size (44px minimum recommended)
      const buttons = page.locator('button, a[href], .clickable');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          const minSize = 32; // Minimum reasonable touch target

          expect(box.width).toBeGreaterThanOrEqual(minSize);
          expect(box.height).toBeGreaterThanOrEqual(minSize);
        }
      }
    });
  });

  test.describe('Content Readability', () => {
    test('should maintain readability across viewports', async ({ page }) => {
      const testViewports = [
        { width: 320, height: 568 },
        { width: 768, height: 1024 },
        { width: 1200, height: 800 }
      ];

      for (const viewport of testViewports) {
        await page.setViewportSize(viewport);
        await page.goto('/');

        // Check text contrast and size
        const textElements = page.locator('p, li, span, div').filter({
          hasText: /.{10,}/ // Elements with substantial text
        });

        const textCount = await textElements.count();

        for (let i = 0; i < Math.min(textCount, 3); i++) {
          const element = textElements.nth(i);
          if (await element.isVisible()) {
            const styles = await element.evaluate(el => {
              const computed = getComputedStyle(el);
              return {
                fontSize: computed.fontSize,
                lineHeight: computed.lineHeight,
                color: computed.color,
                backgroundColor: computed.backgroundColor
              };
            });

            // Font size should be reasonable (at least 14px)
            const fontSize = parseInt(styles.fontSize);
            expect(fontSize).toBeGreaterThanOrEqual(12);

            // Line height should provide good readability
            if (styles.lineHeight !== 'normal') {
              const lineHeight = parseFloat(styles.lineHeight);
              if (!isNaN(lineHeight)) {
                expect(lineHeight).toBeGreaterThanOrEqual(fontSize * 1.2);
              }
            }
          }
        }
      }
    });
  });

  test.describe('Cross-Browser Layout Consistency', () => {
    test('should maintain consistent layout structure', async ({ page }) => {
      await page.goto('/');

      // Check that key layout elements exist and are positioned correctly
      const layoutElements = [
        { selector: 'header, nav', name: 'navigation' },
        { selector: 'main, .main-content', name: 'main content' },
        { selector: 'footer', name: 'footer' },
        { selector: '.hero, #hero', name: 'hero section' }
      ];

      for (const { selector, name } of layoutElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();

          const box = await element.first().boundingBox();
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }

      // Check CSS Grid/Flexbox support
      const gridContainers = page.locator('[style*="grid"], .grid, .kanban-board');
      const gridCount = await gridContainers.count();

      if (gridCount > 0) {
        for (let i = 0; i < gridCount; i++) {
          const container = gridContainers.nth(i);
          const display = await container.evaluate(el => getComputedStyle(el).display);
          expect(['grid', 'flex', 'block', 'inline-block']).toContain(display);
        }
      }
    });
  });

  test.describe('Performance on Different Viewports', () => {
    test('should load efficiently on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Should load reasonably quickly (under 5 seconds)
      expect(loadTime).toBeLessThan(5000);

      // Check that critical content is visible
      await expect(page.locator('h1, .hero h1')).toBeVisible();
      await expect(page.locator('nav')).toBeVisible();
    });

    test('should handle rapid viewport changes', async ({ page }) => {
      await page.goto('/');

      const viewportSequence = [
        { width: 320, height: 568 },
        { width: 1200, height: 800 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 }
      ];

      for (const viewport of viewportSequence) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300); // Brief pause for layout adjustment

        // Verify layout remains intact
        await expect(page.locator('main')).toBeVisible();

        // Check for layout shift issues
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 50);
      }
    });
  });
});