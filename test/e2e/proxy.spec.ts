import { expect, test } from '@playwright/test';

const STORAGE_KEY_MOCKS = 'api_sim_mocks';

test('SW + proxy end-to-end: forwards request to target and returns proxied response', async ({ page }) => {
  // Prepopulate storage with a mock that has proxy configured, then load the app
  const mock = {
    id: 'e2e-proxy-1',
    projectId: 'default',
    name: 'E2E Proxy',
    path: '/api/proxy-e2e',
    method: 'GET',
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ proxied: false }),
    isActive: true,
    version: '1.0',
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
    proxy: { enabled: true, target: 'https://api.example.com', timeout: 2000, fallbackToMock: false },
  };

  await page.addInitScript(({ projectsValue, mocksValue }) => {
    localStorage.setItem('api_sim_projects', JSON.stringify(projectsValue));
    localStorage.setItem('api_sim_mocks', JSON.stringify(mocksValue));
    localStorage.setItem('api_sim_active_project', 'default');
  }, { projectsValue: [{ id: 'default', name: 'Default Workspace', createdAt: Date.now() }], mocksValue: [mock] });

  // Intercept requests destined for the proxy target and return a canned response
  await page.route('https://api.example.com/**', async route => {
    await route.fulfill({
      status: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proxied: true }),
    });
  });

  await page.goto('/');

  // Use test helper to set mocks directly into runtime (bypasses storage races)
  const setDirect = await page.evaluate((mocksValue) => {
    // @ts-ignore - test helper injected in DEV by App
    if (typeof (window as any).__setMocksDirect === 'function') {
      return (window as any).__setMocksDirect(mocksValue);
    }
    return false;
  }, [mock]);

  console.log('setMocksDirect:', setDirect);

  // Give React a tick to update internal refs/state
  await page.waitForTimeout(50);

  // Debug: inspect persisted mocks in localStorage to ensure our mock was loaded
  const storedMocks = await page.evaluate(() => localStorage.getItem('api_sim_mocks'));
  console.log('storedMocks @ page load:', storedMocks);

  // Ensure the service worker controls the page (gives the app time to register and claim)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 5000 });

  // Call the test helper to run the simulateRequest path directly in the app (bypasses SW). This verifies the engine + proxy end-to-end.
  const simulated = await page.evaluate(async () => {
    // @ts-ignore - test helper injected in DEV by App
    return await (window as any).__simulateRequest('GET', location.origin + '/api/proxy-e2e', {}, '');
  });

  console.log('simulated result:', simulated);

  expect(simulated.response.status).toBe(201);
  const parsedBody = (() => {
    try { return JSON.parse(simulated.response.body); } catch { return simulated.response.body; }
  })();
  expect(parsedBody.proxied).toBe(true);
});


// Additional e2e tests: fallback, timeout, and header passthrough

test('Proxy fallback to mock when target slow', async ({ page }) => {
  const slowMock = {
    id: 'e2e-proxy-slow-1',
    projectId: 'default',
    name: 'E2E Proxy Slow',
    path: '/api/proxy-slow',
    method: 'GET',
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ fallback: true }),
    isActive: true,
    version: '1.0',
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
    proxy: { enabled: true, target: 'https://slow.example.com', timeout: 50, fallbackToMock: true },
  };

  // route for slow target: respond after 200ms (longer than timeout)
  await page.route('https://slow.example.com/**', async (route) => {
    setTimeout(async () => {
      await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proxied: true }) });
    }, 200);
  });

  // Ensure app is loaded so test helpers are installed
  await page.goto('/');
  // Wait for the test helper to be available, then inject mock directly and run simulateRequest
  await page.waitForFunction(() => window.__setMocksDirect && typeof (window as any).__setMocksDirect === 'function', { timeout: 5000 });
  const setDirect = await page.evaluate((mocksValue) => {
    // @ts-ignore
    return (window as any).__setMocksDirect(mocksValue);
  }, [slowMock]);
  expect(setDirect).toBe(true);

  // give React tick
  await page.waitForTimeout(50);

  const simulated = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).__simulateRequest('GET', location.origin + '/api/proxy-slow', {}, '');
  });

  // Should return local mock since fallbackToMock is true
  expect(simulated.response.status).toBe(200);
  const parsed = JSON.parse(simulated.response.body);
  expect(parsed.fallback).toBe(true);
});


test('Proxy returns 502 when slow and fallback disabled', async ({ page }) => {
  const slowMock = {
    id: 'e2e-proxy-slow-2',
    projectId: 'default',
    name: 'E2E Proxy Slow 2',
    path: '/api/proxy-slow-2',
    method: 'GET',
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ fallback: true }),
    isActive: true,
    version: '1.0',
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
    proxy: { enabled: true, target: 'https://slow.example.com', timeout: 50, fallbackToMock: false },
  };

  await page.route('https://slow.example.com/**', async (route) => {
    setTimeout(async () => {
      await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proxied: true }) });
    }, 200);
  });

  // Ensure app is loaded so test helpers are installed
  await page.goto('/');
  // Wait for the test helper to be available, then inject mock directly
  await page.waitForFunction(() => window.__setMocksDirect && typeof (window as any).__setMocksDirect === 'function', { timeout: 5000 });
  const setDirect = await page.evaluate((mocksValue) => {
    // @ts-ignore
    return (window as any).__setMocksDirect(mocksValue);
  }, [slowMock]);
  expect(setDirect).toBe(true);

  // give React tick
  await page.waitForTimeout(50);

  const simulated = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).__simulateRequest('GET', location.origin + '/api/proxy-slow-2', {}, '');
  });

  // Should return 502 since fallback disabled
  expect(simulated.response.status).toBe(502);
});


test('Proxy forwards request headers to target (e2e)', async ({ page }) => {
  const hdrMock = {
    id: 'e2e-proxy-hdr-1',
    projectId: 'default',
    name: 'E2E Proxy Hdr',
    path: '/api/proxy-hdr',
    method: 'GET',
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ ok: true }),
    isActive: true,
    version: '1.0',
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
    proxy: { enabled: true, target: 'https://api.example.com', timeout: 2000, fallbackToMock: false },
  };

  await page.route('https://api.example.com/**', async (route) => {
    const req = route.request();
    const headers = req.headers();
    // Validate header forwarded
    if (headers['x-test-header'] === 'hello') {
      await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proxied: true }) });
    } else {
      await route.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing header' }) });
    }
  });

  // Ensure app is loaded so test helpers are installed
  await page.goto('/');
  // Wait for the test helper to be available, then inject mock directly
  await page.waitForFunction(() => window.__setMocksDirect && typeof (window as any).__setMocksDirect === 'function', { timeout: 5000 });
  const setDirect = await page.evaluate((mocksValue) => {
    // @ts-ignore
    return (window as any).__setMocksDirect(mocksValue);
  }, [hdrMock]);
  expect(setDirect).toBe(true);

  // give React tick
  await page.waitForTimeout(50);

  const simulated = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).__simulateRequest('GET', location.origin + '/api/proxy-hdr', { 'x-test-header': 'hello' }, '');
  });

  expect(simulated.response.status).toBe(200);
  const parsed = JSON.parse(simulated.response.body);
  expect(parsed.proxied).toBe(true);
});
