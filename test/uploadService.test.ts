import assert from 'node:assert/strict';
import { uploadTempFile } from '../services/uploadService';

// helper: create a Fake Response-like object
function makeRes(ok: boolean, status: number, body: any, statusText = ''): any {
  return {
    ok,
    status,
    statusText,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as any;
}

async function run() {
  // 1) success path
  let called = 0;
  const fakeFetch1 = async (input: string, init?: any) => {
    called++;
    return makeRes(true, 200, { url: 'https://cdn/example.zip', expiresAt: 'later' });
  };

  const result = await uploadTempFile(new Blob(['x']), 'a.zip', { fetchFn: fakeFetch1 as any });
  assert.equal(result.url, 'https://cdn/example.zip');
  assert.equal(called, 1);

  // 2) retry path (first fails, second succeeds)
  let calls2 = 0;
  const fakeFetch2 = async () => {
    calls2++;
    if (calls2 === 1) throw new Error('network down');
    return makeRes(true, 200, { url: 'ok', expiresAt: 'later' });
  };
  const res2 = await uploadTempFile(new Blob(['x']), 'b.zip', { fetchFn: fakeFetch2 as any });
  assert.equal(res2.url, 'ok');
  assert.equal(calls2, 2);

  // 3) client error (400) -> should not retry and throw UploadFailedError
  let calls3 = 0;
  const fakeFetch3 = async () => {
    calls3++;
    return makeRes(false, 400, { error: 'bad' }, 'Bad Request');
  };
  let threw = false;
  try {
    await uploadTempFile(new Blob(['x']), 'c.zip', { fetchFn: fakeFetch3 as any, retries: 3 });
  } catch (e: any) {
    threw = true;
    assert.ok(e.code === 'UPLOAD_FAILED');
    // ensure only one attempt (no retries)
    assert.equal(calls3, 1);
  }
  assert.ok(threw, 'should throw on client error');

  // 4) url override via opts
  let seenUrl = '';
  const fakeFetch4 = async (input: string) => { seenUrl = input; return makeRes(true, 200, { url: 'ok2' }); };
  const res4 = await uploadTempFile(new Blob(['x']), 'd.zip', { fetchFn: fakeFetch4 as any, url: 'https://api.example' });
  assert.equal(res4.url, 'ok2');
  assert.ok(seenUrl.startsWith('https://api.example/upload-temp'));

  console.log('uploadService tests passed');
}

run().catch((e) => { console.error(e); process.exit(1); });
