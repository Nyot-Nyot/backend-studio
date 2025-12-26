import { postErrorResponseToPort } from "../services/swHelpers";

let passCount = 0;
let failCount = 0;
const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      failCount++;
    }
  });
}

function assert(cond: boolean, msg = "Assertion failed") {
  if (!cond) throw new Error(msg);
}

// Fake port captures posted messages
function createFakePort() {
  const messages: any[] = [];
  return {
    postMessage: (m: any) => messages.push(m),
    __messages: messages,
  } as any;
}

test("postErrorResponseToPort posts a 500 JSON response", async () => {
  const port = createFakePort();
  postErrorResponseToPort(port, "Kaboom");
  assert(port.__messages.length === 1, "Should have posted one message");
  const msg = port.__messages[0];
  assert(msg && msg.response, "Message should include response");
  assert(msg.response.status === 500, "Status should be 500");
  assert(typeof msg.response.body === "string", "Body should be a string");
  const parsed = JSON.parse(msg.response.body);
  assert(parsed.error === "Kaboom", "Error message should match");
});

(async () => {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
})();
