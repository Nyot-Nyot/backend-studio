import { Connector, Scenario, ScenarioRun, ScenarioStepLog } from '../types';
import { fetchRandomUser } from './apiService';
import { indexedDbService } from './indexedDbService';

const SCENARIO_STORE = 'scenarios';
const RUNS_STORE = 'runs';
const CONNECTOR_STORE = 'connectors';

// Simple internal event bus for UI subscriptions
export const ScenarioBus = new EventTarget();

function now() { return Date.now(); }

function resolvePath(obj: unknown, path: string): unknown {
  try {
    if (typeof obj !== 'object' || obj === null) return undefined;
    let acc: unknown = obj;
    for (const k of path.split('.')) {
      if (typeof acc === 'object' && acc !== null && (k in (acc as Record<string, unknown>))) {
        acc = (acc as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    return acc;
  } catch (e) {
    return undefined;
  }
}

function applyTemplate(input: unknown, ctx: unknown): unknown {
  if (typeof input === 'string') {
    return input.replace(/{{\s*([^}]+)\s*}}/g, (_m: string, key: string) => {
      const val = resolvePath(ctx, key.trim());
      return (val === undefined || val === null) ? '' : String(val);
    });
  }
  if (Array.isArray(input)) return input.map(i => applyTemplate(i, ctx));
  if (typeof input === 'object' && input !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = applyTemplate(v, ctx);
    }
    return out;
  }
  return input;
}

export class ScenarioService {
  static async listScenarios(): Promise<Scenario[]> {
    return (await indexedDbService.getCollection(SCENARIO_STORE)) as Scenario[];
  }

  static async getScenario(id: string): Promise<Scenario | undefined> {
    const list = (await indexedDbService.getCollection(SCENARIO_STORE)) as Scenario[];
    return list.find((s) => s.id === id);
  }

  static async saveScenario(s: Scenario): Promise<void> {
    s.updatedAt = Date.now();
    if (!s.id) {
      await indexedDbService.insert(SCENARIO_STORE, s);
    } else {
      await indexedDbService.update(SCENARIO_STORE, s.id, s);
    }
  }

  static async deleteScenario(id: string): Promise<void> {
    await indexedDbService.delete(SCENARIO_STORE, id);
  }

  // Run a scenario by id. Emits events on ScenarioBus about run progress.
  static async runScenario(scenarioId: string): Promise<ScenarioRun> {
    const scenario = await this.getScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found');

    const run: ScenarioRun = {
      id: crypto.randomUUID(),
      scenarioId: scenario.id,
      startedAt: now(),
      status: 'running',
      stepLogs: []
    };

    await indexedDbService.insert(RUNS_STORE, run);

    ScenarioBus.dispatchEvent(new CustomEvent('run:update', { detail: { run } }));

    try {
      let lastOutput: unknown = undefined;
      for (const step of scenario.steps) {
        const stepLog: ScenarioStepLog = {
          stepId: step.id,
          startedAt: now(),
          status: 'running'
        };
        run.stepLogs.push(stepLog);
        ScenarioBus.dispatchEvent(new CustomEvent('run:step', { detail: { run, step: step, stepLog } }));

        try {
          // Optional delay
          if (step.delay) await new Promise(r => setTimeout(r, step.delay));

          // Ensure templates in payload are applied with context
          const payload = applyTemplate(step.payload || {}, { response: lastOutput });
          const payloadObj = (payload as unknown) as Record<string, unknown>;

          // Handle step types
          if (step.type === 'callApi') {
            // crude handling: if payload.mock === 'randomUser' use fetchRandomUser
            let output: unknown = null;
            if (typeof payloadObj?.mock === 'string' && payloadObj.mock === 'randomUser') {
              output = await fetchRandomUser();
            } else if (typeof payloadObj?.url === 'string') {
              const res = await fetch(payloadObj.url, { method: (typeof payloadObj.method === 'string' ? payloadObj.method : 'GET') });
              output = { status: res.status, body: await res.text() } as const;
            }
            stepLog.output = output;
            stepLog.status = 'success';
            lastOutput = stepLog.output;

          } else if (step.type === 'emitSocket') {
            const payloadData = payloadObj || {};
            // Emit a custom DOM event that UI SocketConsole can listen for
            window.dispatchEvent(new CustomEvent('scenario:socket', { detail: payloadData }));
            stepLog.output = payloadData;
            stepLog.status = 'success';
            lastOutput = stepLog.output;
          } else if (step.type === 'wait') {
            const payloadData = payloadObj || {};
            const ms = typeof (payloadData as any).ms === 'number' ? (payloadData as any).ms : 500;
            await new Promise(r => setTimeout(r, ms));
            stepLog.status = 'success';
          } else {
            stepLog.status = 'success';
            stepLog.output = { note: 'noop' };
            lastOutput = stepLog.output;
          }
        } catch (err: unknown) {
          stepLog.status = 'failed';
          stepLog.error = (err as Error)?.message || String(err);
          run.status = 'failed';
          // record and rethrow to stop scenario
          await indexedDbService.update(RUNS_STORE, run.id, run as any);
          ScenarioBus.dispatchEvent(new CustomEvent('run:update', { detail: { run } }));
          throw err;
        }

        stepLog.endedAt = now();
        // persist intermediate run
        await indexedDbService.update(RUNS_STORE, run.id, run as any);
        ScenarioBus.dispatchEvent(new CustomEvent('run:step:done', { detail: { run, step, stepLog } }));
      }
      run.endedAt = now();
      run.status = 'completed';
      await indexedDbService.update(RUNS_STORE, run.id, run);
      ScenarioBus.dispatchEvent(new CustomEvent('run:complete', { detail: { run } }));

      return run;
    } catch (err) {
      run.endedAt = now();
      run.status = 'failed';
      await indexedDbService.update(RUNS_STORE, run.id, run);
      ScenarioBus.dispatchEvent(new CustomEvent('run:complete', { detail: { run } }));
      throw err;
    }
  }

  static async listRunsForScenario(scenarioId: string): Promise<ScenarioRun[]> {
    const runs = (await indexedDbService.getCollection(RUNS_STORE)) as ScenarioRun[];
    return runs.filter(r => r.scenarioId === scenarioId);
  }

  // connectors
  static async listConnectors(): Promise<Connector[]> {
    return (await indexedDbService.getCollection(CONNECTOR_STORE)) as Connector[];
  }

  static async saveConnector(connector: Connector) {
    if (!connector.id) {
      await indexedDbService.insert(CONNECTOR_STORE, connector);
    } else {
      await indexedDbService.update(CONNECTOR_STORE, connector.id, connector);
    }
  }
}

