import retryUtil from './retry';

export async function uploadTempFile(file: Blob, filename = 'export.zip') {
  const url = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_EMAIL_HELPER_PORT)
    ? `http://localhost:${(import.meta as any).env.VITE_EMAIL_HELPER_PORT}`
    : (process.env.EMAIL_HELPER_PORT ? `http://localhost:${process.env.EMAIL_HELPER_PORT}` : 'http://localhost:3001');

  const fd = new FormData();
  fd.append('file', file as any, filename);

  const doUpload = async () => {
    const res = await fetch(`${url}/upload-temp`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json(); // { url, expiresAt }
  };

  return retryUtil.retry(doUpload, { retries: 2, baseDelayMs: 250, factor: 2, maxDelayMs: 1000, timeoutMs: 10000 });
}
