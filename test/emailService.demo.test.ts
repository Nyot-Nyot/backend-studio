import { sendEmailViaEmailJS } from "../services/emailService";

async function run() {
  console.log("🧪 emailService demo tests");
  // In demo mode, serviceId/template/key can be empty
  const res = await sendEmailViaEmailJS("", "", "", "a@b.com", "demo subject", "demo message", [
    { name: 'foo.json', blob: new Blob([JSON.stringify({ x: 1 })], { type: 'application/json' }) }
  ]);
  if ((res as any)?.status !== 'demo') {
    console.error('❌ Expected demo response');
    process.exit(1);
  }
  console.log('✅ demo mode returned success');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
