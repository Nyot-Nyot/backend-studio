import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { indexedDbService } from '../services/indexedDbService';
import { ScenarioNotFoundError, StepFailedError } from '../services/scenarioErrors';
import { ScenarioService } from '../services/scenarioService';

async function run() {
  await indexedDbService.init();
  await indexedDbService.clearAllCollections();

  // nested/array template resolution
  const scenario1 = {
    id: 's-arr',
    name: 'arr test',
    steps: [
      { id: 'a', type: 'emitSocket', payload: { items: [{ name: 'first' }, { name: 'second' }] } },
      { id: 'b', type: 'emitSocket', payload: { pick: '{{response.items[1].name}}' } }
    ]
  } as any;
  await indexedDbService.insert('scenarios', scenario1);
  const events: any[] = [];
  const bus = new EventTarget();
  bus.addEventListener('scenario:socket', (e: any) => events.push(e.detail));
  const run1 = await ScenarioService.runScenario('s-arr', { eventTarget: bus });
  assert.equal(run1.status, 'completed');
  assert.ok(events.length >= 2);
  assert.equal(events[1].pick, 'second');

  // failure on fetch
  await indexedDbService.clearAllCollections();
  const scenario2 = { id: 's-fail', name: 'fail test', steps: [{ id: 'a', type: 'callApi', payload: { url: 'http://should.fail' } }] } as any;
  await indexedDbService.insert('scenarios', scenario2);
  const fakeFetch = async () => { throw new Error('network down'); };
  let saw = false;
  try {
    await ScenarioService.runScenario('s-fail', { fetchFn: fakeFetch as any });
  } catch (err) {
    saw = true;
    assert.ok(err instanceof StepFailedError);
  }
  assert.ok(saw, 'should have thrown');
  const runs = await ScenarioService.listRunsForScenario('s-fail');
  assert.ok(runs.length > 0 && runs[0].status === 'failed');

  // simple template
  await indexedDbService.clearAllCollections();
  const scenario3 = { id: 's-hello', name: 'hello test', steps: [{ id: 'a', type: 'emitSocket', payload: { hello: 'world' } }, { id: 'b', type: 'emitSocket', payload: { msg: 'greeting: {{response.hello}}' } }] } as any;
  await indexedDbService.insert('scenarios', scenario3);
  const events2: any[] = [];
  const bus2 = new EventTarget();
  bus2.addEventListener('scenario:socket', (e: any) => events2.push(e.detail));
  const run3 = await ScenarioService.runScenario('s-hello', { eventTarget: bus2 });
  assert.equal(run3.status, 'completed');
  assert.equal(events2[1].msg, 'greeting: world');

  // missing scenario
  await indexedDbService.clearAllCollections();
  let threw = false;
  try {
    await ScenarioService.runScenario('nope');
  } catch (err) {
    threw = true;
    assert.ok(err instanceof ScenarioNotFoundError);
  }
  assert.ok(threw, 'should throw ScenarioNotFoundError');

  console.log('scenarioService tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
