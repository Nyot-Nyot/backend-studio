// Helper script for verifying Sprint-1 Epic E2 Task 2.2 from the browser console.
// Usage:
// 1) Open your app in the browser (dev server or preview)
// 2) Open DevTools Console
// 3) Paste this entire file content or load the functions below
// 4) Run: await runTask22Tests()
// Notes:
// - Make sure you have these mocks:
//   a) GET /api/users/:id with response body using placeholders:
//      {
//        "id": "{{@param.id}}",
//        "page": "{{@query.page}}",
//        "active": "{{@query.active}}",
//        "generated": {
//          "uuid": "{{$uuid}}",
//          "email": "{{$randomEmail}}",
//          "iso": "{{$isoDate}}",
//          "fakerName": "{{$fakerName}}",
//          "fakerEmail": "{{$fakerEmail}}",
//          "fakerCity": "{{$fakerCity}}"
//        },
//        "env": "{{my_token}}"
//      }
//   b) POST /api/users with response body using @body placeholders:
//      {
//        "ok": true,
//        "echo": {
//          "name": "{{@body.name}}",
//          "age": "{{@body.age}}",
//          "nestedValue": "{{@body.nested.key}}"
//        }
//      }
// - Add env var in Settings: my_token = TEST123 (you can change and re-run as needed)

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  let bodyText = await res.text();
  let json;
  try { json = JSON.parse(bodyText); } catch (e) { json = { __raw: bodyText }; }
  return { res, json };
}

function hasDefaultHeaders(res) {
  const ct = res.headers.get('content-type') || '';
  const xp = res.headers.get('x-powered-by') || '';
  return ct.includes('application/json') && xp.toLowerCase() === 'backendstudio';
}

async function testGetUsers() {
  const { res, json } = await fetchJson('/api/users/123?active=true&page=2');
  const pass = !!(
    json &&
    json.id === '123' &&
    json.page === '2' &&
    json.active === 'true' &&
    json.generated && typeof json.generated.uuid === 'string' &&
    json.generated.email && typeof json.generated.email === 'string' &&
    json.generated.iso && typeof json.generated.iso === 'string' &&
    json.generated.fakerName &&
    json.generated.fakerEmail &&
    json.generated.fakerCity &&
    hasDefaultHeaders(res)
  );
  return { name: 'GET /api/users/:id with query + generators + env', pass, json, headers: Object.fromEntries(res.headers.entries()) };
}

async function testPostUsers() {
  const payload = { name: 'Alice', age: 30, nested: { key: 'Z' } };
  const { res, json } = await fetchJson('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const pass = !!(
    json && json.ok === true && json.echo &&
    json.echo.name === 'Alice' &&
    (json.echo.age === '30' || json.echo.age === 30) &&
    json.echo.nestedValue === 'Z' &&
    hasDefaultHeaders(res)
  );
  return { name: 'POST /api/users @body injection', pass, json, headers: Object.fromEntries(res.headers.entries()) };
}

async function testEnvVar(expectedToken) {
  const { res, json } = await fetchJson('/api/users/123?page=1');
  const pass = json && json.env === expectedToken;
  return { name: `Env var injection (expect ${expectedToken})`, pass, got: json && json.env };
}

async function runTask22Tests({ expectedEnvToken = 'TEST123' } = {}) {
  const results = [];
  try {
    results.push(await testGetUsers());
  } catch (e) {
    results.push({ name: 'GET /api/users/:id', pass: false, error: String(e) });
  }
  try {
    results.push(await testPostUsers());
  } catch (e) {
    results.push({ name: 'POST /api/users', pass: false, error: String(e) });
  }
  try {
    results.push(await testEnvVar(expectedEnvToken));
  } catch (e) {
    results.push({ name: 'Env var injection', pass: false, error: String(e) });
  }

  const summary = {
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    details: results
  };
  console.table(results.map(r => ({ test: r.name, pass: r.pass })));
  console.log('Detailed results:', results);
  console.log('Summary:', summary);
  return summary;
}

// Export helpers on window for convenience
if (typeof window !== 'undefined') {
  window.runTask22Tests = runTask22Tests;
  window.testGetUsers = testGetUsers;
  window.testPostUsers = testPostUsers;
  window.testEnvVar = testEnvVar;
  console.log('[Task22 Helper] Loaded. Run: await runTask22Tests({ expectedEnvToken: "TEST123" })');
}
