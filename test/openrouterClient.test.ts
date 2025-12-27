import { OpenRouterError, openrouterGenerateEndpoint, openrouterGenerateMock } from "../services/openrouterClient";

async function run() {
  console.log('🧪 openrouterClient tests');

  // Mock global.fetch
  const originalFetch = (globalThis as any).fetch;

  // 1) non-ok response -> throw OpenRouterError with body and status
  (globalThis as any).fetch = async (url: string, opts: any) => {
    return {
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    };
  };

  try {
    await openrouterGenerateMock({ path: '/x' });
    console.error('❌ expected openrouterGenerateMock to throw');
    process.exit(1);
  } catch (e) {
    if (!(e instanceof OpenRouterError)) {
      console.error('❌ expected OpenRouterError', e);
      process.exit(1);
    }
    if (e.status !== 502 || e.body !== 'bad gateway') {
      console.error('❌ OpenRouterError has wrong status/body', e.status, e.body);
      process.exit(1);
    }
  }

  // 2) check header forwarding when clientKey provided
  let capturedHeaders: Record<string, string> | null = null;
  (globalThis as any).fetch = async (url: string, opts: any) => {
    capturedHeaders = opts.headers;
    return { ok: true, json: async () => ({ json: '{}' }) };
  };

  await openrouterGenerateMock({ path: '/x' }, { clientKey: 'abc123' });
  if (!capturedHeaders || capturedHeaders['X-OpenRouter-Key'] !== 'abc123') {
    console.error('❌ failed to forward clientKey header', capturedHeaders);
    process.exit(1);
  }

  // 3) ensure URL built when BASE absent: should use path starting with '/'
  let capturedUrl: string | null = null;
  (globalThis as any).fetch = async (url: string, opts: any) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ json: '{}' }) };
  };

  await openrouterGenerateEndpoint({ prompt: 'hi' });
  if (!capturedUrl || !capturedUrl.startsWith('/')) {
    console.error('❌ url should be path when BASE absent', capturedUrl);
    process.exit(1);
  }

  // restore
  (globalThis as any).fetch = originalFetch;

  console.log('✅ openrouterClient tests passed');
}

run().catch(e => { console.error(e); process.exit(1); });
