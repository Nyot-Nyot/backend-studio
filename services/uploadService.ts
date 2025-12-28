import retryUtil from './retry';
import { UploadFailedError, UploadTimeoutError } from './uploadErrors';

export type UploadResult = { url: string; expiresAt?: string };

export async function uploadTempFile(
  file: Blob,
  filename = 'export.zip',
  opts?: {
    url?: string; // override base URL
    fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
    retries?: number;
    timeoutMs?: number; // per attempt
  }
): Promise<UploadResult> {
  // Resolve base url in a consistent order: explicit opts.url > VITE_EMAIL_HELPER_URL > EMAIL_HELPER_URL > port-based fallbacks
  const fromImportMeta = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : undefined;
  const viteUrl = fromImportMeta?.VITE_EMAIL_HELPER_URL as string | undefined;
  const vitePort = fromImportMeta?.VITE_EMAIL_HELPER_PORT as string | undefined;
  const viteTls = fromImportMeta?.VITE_EMAIL_HELPER_TLS as string | undefined; // '1' or 'true'

  const envUrl = process.env.EMAIL_HELPER_URL;
  const envPort = process.env.EMAIL_HELPER_PORT;
  const envTls = process.env.EMAIL_HELPER_TLS;

  const baseUrl = opts?.url
    || viteUrl
    || envUrl
    || (vitePort ? `${viteTls === '1' || viteTls === 'true' ? 'https' : 'http'}://localhost:${vitePort}` : undefined)
    || (envPort ? `${envTls === '1' || envTls === 'true' ? 'https' : 'http'}://localhost:${envPort}` : undefined)
    || 'http://localhost:3001';

  const fetchFn = opts?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  if (!fetchFn) throw new Error('fetch not available; provide fetchFn in opts for this environment');

  const fd = new FormData();
  fd.append('file', file as any, filename);

  const doUpload = async () => {
    const res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/upload-temp`, { method: 'POST', body: fd });
    const text = await res.text();
    if (!res.ok) {
      // For 4xx client errors (except 429), don't retry
      const noRetry = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw Object.assign(new UploadFailedError(`Upload failed: ${res.status} ${res.statusText}`, res.status, text, noRetry), { noRetry });
    }
    try {
      const json = JSON.parse(text);
      return json as UploadResult;
    } catch (e) {
      // Bad json
      throw new UploadFailedError('Upload succeeded but response JSON parsing failed', res.status, text, false);
    }
  };

  const retries = typeof opts?.retries === 'number' ? opts.retries : 2;
  const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts.timeoutMs : 10000;

  try {
    return await retryUtil.retry(doUpload, { retries, baseDelayMs: 250, factor: 2, maxDelayMs: 1000, timeoutMs });
  } catch (err: any) {
    if (err instanceof Error && /timeout after \d+ms/.test(err.message)) {
      throw new UploadTimeoutError(timeoutMs);
    }
    throw err;
  }
}

