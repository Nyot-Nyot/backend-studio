import { validateWorkspaceImport } from '../../services/validation';

let pass = 0;
let fail = 0;
const tests: Array<() => Promise<void>> = [];
function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      pass++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      fail++;
    }
  });
}

function assert(cond: boolean, msg = 'assert') {
  if (!cond) throw new Error(msg);
}

test('valid workspace passes', async () => {
  const payload = { projects: [{ id: 'p1', name: 'P' }], mocks: [{ id: 'm1', path: '/x', method: 'GET' }] };
  const res = validateWorkspaceImport(payload);
  assert(res === true);
});

test('invalid workspace missing mocks fails', async () => {
  let threw = false;
  try {
    validateWorkspaceImport({ projects: [] } as any);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'expected validation to throw');
});

(async () => {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
