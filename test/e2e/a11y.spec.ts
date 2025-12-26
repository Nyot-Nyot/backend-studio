import { test } from '@playwright/test';

// Run a quick accessibility scan on the main app shell
test('Halaman utama tidak memiliki pelanggaran a11y kritis', async ({ page }) => {
  // Dynamic import so the test can be skipped gracefully when the package is not installed locally
  let axe: any;
  try {
    axe = await import('@axe-core/playwright');
  } catch (err) {
    test.skip(true, 'Paket @axe-core/playwright tidak tersedia; lewati tes a11y lokal. CI akan menginstal dependensi.');
    return;
  }

  const { injectAxe, checkA11y } = axe;

  await page.goto(process.env.VITE_E2E_BASE_URL || 'http://localhost:5173');
  await injectAxe(page);
  const results = await checkA11y(page, undefined, { detailedReport: true });

  if (results && results.violations && results.violations.length > 0) {
    const msgs = results.violations.map((v: any) => `${v.id}: ${v.description} (${v.impact})`).join('\n');
    throw new Error(`Accessibility violations found:\n${msgs}`);
  }
});
