import assert from 'node:assert/strict';
import { createZipBlob } from "../services/zipService";

async function run() {
  // small file should zip
  const small = new Blob(['hello']);
  const z = await createZipBlob([{ name: 'hi.txt', blob: small }]);
  // Expect a Blob or ArrayBuffer depending on environment
  if ((z as any) instanceof Blob) {
    assert.ok((z as Blob).size > 0, 'blob size > 0');
  } else if ((z as any) instanceof ArrayBuffer) {
    assert.ok((z as ArrayBuffer).byteLength > 0, 'arraybuffer size > 0');
  }

  // enforce per-entry size limit (set to 1 byte so our small file exceeds)
  let threw = false;
  try {
    await createZipBlob([{ name: 'too.txt', blob: small }], { maxEntrySize: 1 });
  } catch (e: any) {
    threw = true;
    assert.equal(e.code, 'ZIP_SIZE_EXCEEDED');
  }
  assert.ok(threw, 'should throw ZipSizeError on large entry');

  // enforce total size limit
  const a = new Blob([new Uint8Array(1024 * 1024 * 10)]); // 10MB
  const b = new Blob([new Uint8Array(1024 * 1024 * 11)]); // 11MB
  threw = false;
  try {
    await createZipBlob([{ name: 'a', blob: a }, { name: 'b', blob: b }], { maxTotalSize: 15 * 1024 * 1024 });
  } catch (e: any) {
    threw = true;
    assert.equal(e.code, 'ZIP_SIZE_EXCEEDED');
  }
  assert.ok(threw, 'should throw ZipSizeError on total size exceed');

  console.log('zipService tests passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
