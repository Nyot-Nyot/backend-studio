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
})();
