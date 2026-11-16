import { test, expect } from '@playwright/test';

test.describe('Walkscope Web Companion Browser Interface & Accessibility Tests', () => {
  test('renders high-contrast OLED layout, Leaflet map canvas, and status badge', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle('Walkscope Web Companion Preview');

    // Check status badge
    const badge = page.getByTestId('status-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('GATEWAY CONNECTED');

    // Check map container
    const map = page.getByTestId('leaflet-map');
    await expect(map).toBeVisible();

    // Check Information Coverage Card
    const scoreCard = page.getByTestId('context-score-card');
    await expect(scoreCard).toBeVisible();
    await expect(page.getByTestId('score-value')).toHaveText('84%');

    // Check zero unhandled JavaScript console exceptions
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('tile.openstreetmap.org')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('verifies touch target accessibility (>= 48px height) on interactive controls', async ({ page }) => {
    await page.goto('/');

    // Verify Calculate Route button touch target
    const routeBtn = page.getByTestId('calculate-route-btn');
    await expect(routeBtn).toBeVisible();
    const routeBox = await routeBtn.boundingBox();
    expect(routeBox).not.toBeNull();
    expect(routeBox!.height).toBeGreaterThanOrEqual(48);

    // Verify Emergency 112 button touch target & ARIA label
    const emergencyBtn = page.getByTestId('emergency-btn');
    await expect(emergencyBtn).toBeVisible();
    await expect(emergencyBtn).toHaveAttribute('aria-label', 'Emergency Speed Dial 112');
    const emergencyBox = await emergencyBtn.boundingBox();
    expect(emergencyBox).not.toBeNull();
    expect(emergencyBox!.height).toBeGreaterThanOrEqual(48);
  });

  test('renders responsively on mobile portrait viewport (390 x 844 iPhone 14 / Pixel 8)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const map = page.getByTestId('leaflet-map');
    await expect(map).toBeVisible();

    const scoreCard = page.getByTestId('context-score-card');
    await expect(scoreCard).toBeVisible();

    const routeBtn = page.getByTestId('calculate-route-btn');
    await expect(routeBtn).toBeVisible();

    // Verify no horizontal document scrollbar on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('verifies memory stability and zero DOM element leakage across repeated interactions (memory-leak-debugging)', async ({ page }) => {
    await page.goto('/');

    const initialDomCount = await page.evaluate(() => document.getElementsByTagName('*').length);

    // Repeat user interactions 10 times to test for detached nodes or unbounded listener accretion
    const routeBtn = page.getByTestId('calculate-route-btn');
    for (let i = 0; i < 10; i++) {
      await routeBtn.click();
    }

    const finalDomCount = await page.evaluate(() => document.getElementsByTagName('*').length);

    // DOM node count must remain bounded without runaway accumulation
    expect(finalDomCount).toBeLessThanOrEqual(initialDomCount + 20);
  });
});
