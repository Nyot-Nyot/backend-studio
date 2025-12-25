import { createZipBlob } from "../services/zipService";

async function run() {
  console.log("🧪 zipService tests");
  const files = [
    { name: "a.txt", blob: new Blob(["hello"], { type: "text/plain" }) },
    { name: "b.txt", blob: new Blob(["world"], { type: "text/plain" }) },
  ];

  const zip = await createZipBlob(files);
  console.log("Zip size:", zip.size);
  if (zip.size <= 0) {
    console.error("❌ zip size should be > 0");
    process.exit(1);
  }
  console.log("✅ zip created successfully");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
