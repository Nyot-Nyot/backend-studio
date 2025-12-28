import { formatTime } from "../components/LogViewer";

const tests: { name: string; fn: () => void | Promise<void> }[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      pass++;
    } catch (e: any) {
      console.error(`❌ ${t.name} — ${e.message}`);
      fail++;
    }
  }
  console.log(`\nSummary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

// Test case

test("formatTime includes hours, minutes, seconds and milliseconds", () => {
  const ts = Date.UTC(2020, 0, 1, 12, 34, 56, 789); // UTC timestamp
  const out = formatTime(ts);
  const ok = /\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?\.\d{3}$/i.test(out);
  assert(ok, `formatTime output unexpected: ${out}`);
});

runTests();
