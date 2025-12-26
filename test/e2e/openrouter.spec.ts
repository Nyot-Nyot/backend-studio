import { expect, test } from '@playwright/test';

test('openrouter proxy health (optional)', async ({ request }) => {
  const proxyUrl = process.env.OPENROUTER_HELPER_URL || 'http://localhost:3002';
  const res = await request.get(`${proxyUrl}/health`);
  // If proxy not running, this will be 404/ECONNREFUSED; that's acceptable during CI unless explicitly started
  if (res.ok()) {
    const json = await res.json();
    expect(json.ok).toBe(true);
  } else {
    test.skip();
  }
});
