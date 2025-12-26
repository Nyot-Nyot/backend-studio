import { expect, test } from '@playwright/test';
import { spawn } from 'child_process';

const SOCKET_PORT = process.env.TEST_SOCKET_PORT ? Number(process.env.TEST_SOCKET_PORT) : 9222;
let srv: any;

async function startServer() {
  // If a server is already running, use it
  try {
    const res = await fetch(`http://localhost:${SOCKET_PORT}/health`);
    if (res.ok) return;
  } catch (e) {
    // not running, continue to spawn
  }

  return new Promise<void>((resolve, reject) => {
    srv = spawn(process.execPath, ['scripts/socket-server.cjs'], {
      env: { ...process.env, SOCKET_PORT: String(SOCKET_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onData = (d: Buffer) => {
      const s = d.toString();
      if (s.includes('listening on')) {
        srv.stdout.off('data', onData);
        resolve();
      }
    };
    srv.stdout.on('data', onData);
    srv.on('error', reject);
    setTimeout(() => reject(new Error('server failed to start')), 5000);
  });
}

async function stopServer() {
  if (srv) {
    srv.kill('SIGINT');
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.beforeAll(async () => {
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

test('Log emitted via socket server appears in LogViewer', async ({ page }) => {
  await page.goto('/');
  // Open Traffic Monitor
  await page.click('text=Traffic Monitor');
  // Ensure placeholder displayed
  await expect(page.locator('text=Waiting for incoming traffic')).toBeVisible();

  const payload = { id: 'e2e1', ts: Date.now(), method: 'GET', path: '/api/test', statusCode: 200 };
  // Emit via HTTP endpoint
  const res = await page.request.post(`http://localhost:${SOCKET_PORT}/emit-log`, { data: payload });
  expect(res.ok()).toBeTruthy();

  // Wait for log entry to appear containing the path
  await expect(page.locator(`text=/api/test/`)).toBeVisible({ timeout: 3000 });
});
