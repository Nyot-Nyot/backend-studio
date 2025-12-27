import { validateAndNormalizeRecipients } from "../components/EmailExportModal";

async function run() {
  console.log("🧪 EmailExportModal validation tests");

  // empty
  let res = validateAndNormalizeRecipients("");
  if (!res.error || !res.error.includes("Enter at least one")) {
    console.error("❌ empty input should return Enter at least one recipient email.");
    process.exit(1);
  }

  // invalid
  res = validateAndNormalizeRecipients("bad-email, also@bad");
  if (!res.error || !res.error.includes("Invalid email")) {
    console.error("❌ invalid emails should be reported");
    process.exit(1);
  }

  // duplicates
  res = validateAndNormalizeRecipients("a@example.com, a@example.com\n b@example.com");
  if (res.error) {
    console.error("❌ valid duplicated input should not return error", res.error);
    process.exit(1);
  }
  if (res.recipients.length !== 2) {
    console.error("❌ duplicates should be deduped, expected 2 recipients, got", res.recipients.length);
    process.exit(1);
  }

  // too many
  const many = Array.from({ length: 11 }, (_, i) => `u${i}@ex.com`).join(",");
  res = validateAndNormalizeRecipients(many);
  if (!res.error || !res.error.includes("Too many")) {
    console.error("❌ should complain about too many recipients");
    process.exit(1);
  }

  // valid
  res = validateAndNormalizeRecipients("one@example.com;two@example.com\nthree@ex.com");
  if (res.error) {
    console.error("❌ valid addresses should not error", res.error);
    process.exit(1);
  }
  if (res.recipients.length !== 3) {
    console.error("❌ expected 3 recipients", res.recipients);
    process.exit(1);
  }

  console.log("✅ EmailExportModal validation tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
