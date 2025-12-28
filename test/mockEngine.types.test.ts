import { processMockResponse, simulateRequest } from "../services/mockEngine";

(async () => {
  console.log('🧪 [mockEngine] Memastikan simulateRequest mengembalikan struktur SimulationResult');

  const mocks = [
    {
      id: 'm1',
      projectId: 'p1',
      name: 'GetUsers',
      path: '/users',
      method: 'GET',
      statusCode: 200,
      delay: 0,
      responseBody: '[]',
      isActive: true,
      version: '1',
      createdAt: Date.now(),
      requestCount: 0,
      headers: []
    }
  ];

  const res = await simulateRequest('GET', 'http://localhost/users', {}, '', mocks as any, []);
  if (!res || !res.response) throw new Error('simulateRequest harus mengembalikan objek dengan field response');
  if (typeof res.response.status !== 'number') throw new Error('response.status harus number');
  console.log('✅ PASS: simulateRequest mengembalikan struktur yang valid');

  console.log('🧪 [mockEngine] Memastikan processMockResponse melakukan substitusi variabel');
  const tpl = '{"id":"{{$uuid}}","name":"{{my_var}}"}';
  const out = processMockResponse(tpl, '/users', '/users', [{ id: '1', key: 'my_var', value: 'Halo' } as any], null);
  if (!out.includes('Halo')) throw new Error('processMockResponse harus mengganti {{my_var}}');
  if (!out.includes('id')) throw new Error('processMockResponse harus men-generate uuid');

  console.log('✅ PASS: processMockResponse menggantikan variabel dengan benar');

  console.log('🧪 [mockEngine] Ensure boolean token results in typed boolean in JSON output');
  const tplBool = '{"ok": {{$randomBool}}}';
  const outBool = processMockResponse(tplBool, '/users', '/users', [], null);
  const parsedBool = JSON.parse(outBool);
  if (typeof parsedBool.ok !== 'boolean') throw new Error('{{$randomBool}} should produce boolean when used as a JSON unquoted value');
  console.log('✅ PASS: {{$randomBool}} produces boolean in JSON');

  console.log('🧪 [mockEngine] content-type inference in simulateRequest');
  const mockText = [{ id: 'mtxt', projectId: 'p', name: 'Text', path: '/hello', method: 'GET', statusCode: 200, delay: 0, responseBody: 'Hello {{$randomName}}', isActive: true, version: '1', createdAt: Date.now(), requestCount: 0, headers: [] }];
  const resText = await simulateRequest('GET', 'http://localhost/hello', {}, '', mockText as any, []);
  const ctText = resText.response.headers.find(h => h.key.toLowerCase() === 'content-type');
  if (!ctText || ctText.value !== 'text/plain') throw new Error('simulateRequest should infer text/plain for non-JSON response');
  console.log('✅ PASS: simulateRequest infers text/plain');

  const mockJson = [{ id: 'mjson', projectId: 'p', name: 'JSON', path: '/j', method: 'GET', statusCode: 200, delay: 0, responseBody: '{"ok": true}', isActive: true, version: '1', createdAt: Date.now(), requestCount: 0, headers: [] }];
  const resJson = await simulateRequest('GET', 'http://localhost/j', {}, '', mockJson as any, []);
  const ctJson = resJson.response.headers.find(h => h.key.toLowerCase() === 'content-type');
  if (!ctJson || ctJson.value !== 'application/json') throw new Error('simulateRequest should infer application/json for JSON response');
  console.log('✅ PASS: simulateRequest infers application/json');
})();
