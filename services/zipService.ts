import JSZip from "jszip";
import { ZipGenerationError, ZipSizeError } from './zipErrors';

export type CreateZipOptions = {
  maxEntrySize?: number; // bytes
  maxTotalSize?: number; // bytes
  outputType?: 'blob' | 'arraybuffer' | 'nodebuffer';
};

export async function createZipBlob(files: { name: string; blob: Blob }[], opts: CreateZipOptions = {}) {
  const maxEntry = typeof opts.maxEntrySize === 'number' ? opts.maxEntrySize : 20 * 1024 * 1024; // 20MB per entry default
  const maxTotal = typeof opts.maxTotalSize === 'number' ? opts.maxTotalSize : 200 * 1024 * 1024; // 200MB total default

  const zip = new JSZip();

  // First pass: measure sizes conservatively without loading everything when possible
  let totalEstimate = 0;
  for (const f of files) {
    let size: number | undefined = (f.blob as any)?.size;
    if (typeof size !== 'number') {
      // as a last resort we must read it to determine size
      try {
        const buf = await (f.blob as any).arrayBuffer();
        size = buf.byteLength;
      } catch (e) {
        // if we can't determine size, assume worst-case: reject to avoid OOM
        throw new ZipSizeError(`Unable to determine size for ${f.name}`);
      }
    }
    if (size > maxEntry) {
      throw new ZipSizeError(`Entry ${f.name} is too large (${size} bytes), limit is ${maxEntry} bytes`);
    }
    totalEstimate += size;
    if (totalEstimate > maxTotal) {
      throw new ZipSizeError(`Total zip size estimate ${totalEstimate} exceeds limit ${maxTotal}`);
    }
  }

  // Second pass: add files (use ArrayBuffer in Node or when necessary)
  for (const f of files) {
    try {
      if (typeof (f.blob as any).arrayBuffer === 'function') {
        const buf = await (f.blob as any).arrayBuffer();
        zip.file(f.name, buf);
      } else {
        zip.file(f.name, f.blob as any);
      }
    } catch (e: any) {
      throw new ZipGenerationError(`Failed to add ${f.name} to zip: ${e?.message || String(e)}`);
    }
  }

  try {
    const type = opts.outputType ?? 'blob';
    const result = await zip.generateAsync({ type });
    return result;
  } catch (e: any) {
    throw new ZipGenerationError(`Failed to generate zip: ${e?.message || String(e)}`);
  }
}
