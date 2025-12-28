import { sendEmailViaEmailJS } from "../services/emailService";

function test(name: string, fn: () => Promise<void> | void) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any).then(() => console.log(`✅ PASS: ${name}`)).catch((e: any) => {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   ${e?.message || e}`);
      });
    }
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

console.log("🧪 Starting emailService tests\n");

// Helper: create a blob of specified size
function makeBlob(size: number, type = "text/plain") {
  const parts = [new Uint8Array(size)];
  return new Blob(parts, { type });
}

// 1) Missing config should throw (non-demo)
process.env.VITE_EMAILJS_DEMO = "false";

test("throws when config is missing", async () => {
  let thrown = false;
  try {
    await sendEmailViaEmailJS("", "", "", "a@b.com", "s", "m", []);
  } catch (e: any) {
    thrown = true;
    assert(e.message.includes("EmailJS configuration not found"), "Should mention missing config");
  }
  assert(thrown, "Should throw when config missing");
});

// 2) Demo mode returns demo status and avoids leaking sensitive details
process.env.VITE_EMAILJS_DEMO = "true";

test("demo mode returns demo status", async () => {
  const res = await sendEmailViaEmailJS("", "", "", "alice@example.com", "s", "m", [{ name: "a.txt", blob: makeBlob(10) }]);
  assert(res && res.status === "demo", "Should return demo status");
});

// 3) Attachment per-file limit enforced
process.env.VITE_EMAILJS_DEMO = "false";

test("throws when attachments exceed per-file limit", async () => {
  const big = makeBlob(1_500_000);
  let thrown = false;
  try {
    await sendEmailViaEmailJS("service", "template", "key", "a@a.com", "s", "m", [{ name: "big.bin", blob: big }]);
  } catch (e: any) {
    thrown = true;
    assert(e.message.includes("Attachment too large"), "Error should mention attachment too large");
  }
  assert(thrown, "Should throw for big attachment");
});

// 4) Total attachments size limit enforced
process.env.VITE_EMAILJS_DEMO = "false";

test("throws when total attachments exceed total limit", async () => {
  const many = [makeBlob(2_000_000), makeBlob(2_000_000), makeBlob(2_000_000)];
  let thrown = false;
  try {
    await sendEmailViaEmailJS("service", "template", "key", "a@a.com", "s", "m", many.map((b, i) => ({ name: `f${i}.bin`, blob: b })));
  } catch (e: any) {
    thrown = true;
    assert(e.message.includes("Total attachments size too large"), "Error should mention total attachments size too large");
  }
  assert(thrown, "Should throw for total size exceed");
});

console.log("\n🧪 emailService tests finished");
