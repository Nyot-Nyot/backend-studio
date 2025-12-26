import EmailExportModal from "../components/EmailExportModal";

async function run() {
  console.log("🧪 EmailExportModal import test");
  if (typeof EmailExportModal !== "function") {
    console.error("❌ EmailExportModal should be a function component");
    process.exit(1);
  }
  console.log("✅ EmailExportModal component is importable");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
