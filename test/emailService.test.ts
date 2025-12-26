import { sendEmailViaEmailJS } from "../services/emailService";

async function run() {
  console.log("🧪 emailService tests");
  try {
    await sendEmailViaEmailJS("", "", "", "a@b.com", "s", "m", []);
    console.error("❌ Expected error when config is missing");
    process.exit(1);
  } catch (e: any) {
    console.log("✅ throws when config missing:", e.message);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
