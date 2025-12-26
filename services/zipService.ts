import JSZip from "jszip";

export async function createZipBlob(files: { name: string; blob: Blob }[]) {
  const zip = new JSZip();
  for (const f of files) {
    // In Node, Blob might not be accepted directly by JSZip - convert to ArrayBuffer when possible
    if (typeof (f.blob as any).arrayBuffer === "function") {
      const buf = await (f.blob as any).arrayBuffer();
      zip.file(f.name, buf);
    } else {
      zip.file(f.name, f.blob as any);
    }
  }
  const result = await zip.generateAsync({ type: "blob" });
  return result;
}
