import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'Laptop 1366x768', width: 1366, height: 768 },
  { name: 'Desktop 1440x900', width: 1440, height: 900 },
  { name: 'Tablet 768x1024', width: 768, height: 1024 },
];

test.describe('Layout & Responsiveness', () => {
  for (const vp of viewports) {
    test(`Layout sanity at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto('/');

      // Sidebar & Overview visible
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('h2', { hasText: 'Overview' })).toBeVisible();

      // Key UI pieces
      await expect(page.locator('text=Designed Routes')).toBeVisible();
      // Ensure at least one route card exists by checking Ping card
      await expect(page.locator('h3:has-text("Ping")')).toBeVisible();

      // Open a mock editor and ensure main editor is visible
      await page.click('h3:has-text("Ping")');
      await expect(page.locator('text=Response Schema')).toBeVisible();

      // Service Worker check via fetch to /api/ping
      const ping = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/ping');
          return { ok: r.ok, json: await r.json() };
        } catch (e) {
          return { ok: false, json: null };
        }
      });
      expect(ping.ok).toBe(true);
      expect(ping.json).toHaveProperty('pong', true);

      // Ensure no console errors were emitted
      expect(consoleErrors).toEqual([]);
    });
  }
});
