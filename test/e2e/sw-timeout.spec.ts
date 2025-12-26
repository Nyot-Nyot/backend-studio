import { expect, test } from '@playwright/test';

// This test verifies that when a visible client is unresponsive to SW postMessage,
// the Service Worker falls back to the network after the handshake timeout.

test('SW handshake timeout falls back to network when client unresponsive', async ({ page }) => {
  // Intercept the network request that represents the "real" network fallback
  let networkHit = false;
  await page.route('**/api/sw-timeout-e2e', route => {
    networkHit = true;
    route.fulfill({ status: 200, body: 'network-fallback' });
  });

  // Install an early message handler that prevents other message listeners from running
  // This simulates a controlled page that does NOT respond to INTERCEPT_REQUEST messages
  await page.addInitScript(() => {
    self.addEventListener('message', (ev: any) => {
      try {
        if (ev.data && ev.data.type === 'INTERCEPT_REQUEST') {
          // Prevent app from seeing/handling the message
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        }
      } catch (e) {
        // ignore
      }
    });
  });

  // Navigate to the app (this will register sw.js via the app's normal flow)
  await page.goto('/');

  // Ensure service worker is ready
  await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller);

  // Trigger a fetch that will be intercepted by sw.js
  const res = await page.evaluate(async () => {
    const r = await fetch('/api/sw-timeout-e2e');
    return { status: r.status, text: await r.text() };
  });

  // Expect that fallback to network happened and our route was used
  expect(networkHit).toBe(true);
  expect(res.status).toBe(200);
  expect(res.text).toBe('network-fallback');
});
