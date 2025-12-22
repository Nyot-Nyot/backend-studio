import { Connector, Scenario, ScenarioRun, ScenarioStepLog } from '../types';
import { fetchRandomUser } from './apiService';
import { generateSMTPTrace, scheduleStatusUpdate } from './emailService';
import { indexedDbService } from './indexedDbService';

const SCENARIO_STORE = 'scenarios';
const RUNS_STORE = 'runs';
const CONNECTOR_STORE = 'connectors';
const EMAIL_OUTBOX = 'email_outbox';

// Simple internal event bus for UI subscriptions
export const ScenarioBus = new EventTarget();

function now() { return Date.now(); }

function resolvePath(obj: any, path: string) {
  try {
    return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
  } catch (e) {
    return undefined;
  }
}

function applyTemplate(input: unknown, ctx: unknown): any {
  if (typeof input === 'string') {
    return input.replace(/{{\s*([^}]+)\s*}}/g, (_m: string, key: string) => {
      const val = resolvePath(ctx as any, key.trim());
      return (val === undefined || val === null) ? '' : String(val);
    });
  }
  if (Array.isArray(input)) return input.map(i => applyTemplate(i, ctx));
  if (typeof input === 'object' && input !== null) {
    const out: any = {};
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
      let lastOutput: any = undefined;
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

          // Handle step types
          if (step.type === 'callApi') {
            // crude handling: if payload.mock === 'randomUser' use fetchRandomUser
            let output: any = null;
            if ((payload as any).mock === 'randomUser') {
              output = await fetchRandomUser();
            } else if ((payload as any).url) {
              const res = await fetch((payload as any).url, { method: (payload as any).method || 'GET' });
              output = { status: res.status, body: await res.text() };
            }
            stepLog.output = output;
            stepLog.status = 'success';
            lastOutput = stepLog.output;
          } else if (step.type === 'sendEmail') {
            const to = (payload as any).to || 'test@example.com';
            const subject = (payload as any).subject || 'Scenario Email';
            const body = (payload as any).body || JSON.stringify({ runId: run.id }, null, 2);
            const messageId = crypto.randomUUID();
            const trace = generateSMTPTrace(to);

            // Save email to outbox store for visibility
            await indexedDbService.insert(EMAIL_OUTBOX, {
              id: messageId,
              to,
              subject,
              body,
              status: 'queued',
              trace,
              createdAt: now()
            });

            // Simulate status updates
            scheduleStatusUpdate(messageId, async (id: string, status: string) => {
              // update record in IndexedDB
              const msgList = await indexedDbService.getCollection(EMAIL_OUTBOX) as any[];
              const msg = msgList.find((m) => m.id === id);
              if (msg) {
                msg.status = status;
                msg.updatedAt = Date.now();
                msg.trace = (msg.trace || []).concat([`status:${status}@${Date.now()}`]);
                await indexedDbService.update(EMAIL_OUTBOX, id, msg as any);
                ScenarioBus.dispatchEvent(new CustomEvent('email:update', { detail: { message: msg } }));
              }
            });

            stepLog.output = { messageId, to, subject };
            stepLog.status = 'success';
            lastOutput = stepLog.output;
          } else if (step.type === 'emitSocket') {
            const payloadData: any = payload || {};
            // Emit a custom DOM event that UI SocketConsole can listen for
            window.dispatchEvent(new CustomEvent('scenario:socket', { detail: payloadData }));
            stepLog.output = payloadData;
            stepLog.status = 'success';
            lastOutput = stepLog.output;
          } else if (step.type === 'wait') {
            const payloadData: any = payload || {};
            const ms = payloadData.ms || 500;
            await new Promise(r => setTimeout(r, ms));
            stepLog.status = 'success';
          } else {
            stepLog.status = 'success';
            stepLog.output = { note: 'noop' };
            lastOutput = stepLog.output;
          }
        } catch (err: any) {
          stepLog.status = 'failed';
          stepLog.error = err?.message || String(err);
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
      await indexedDbService.update(RUNS_STORE, run.id, run as any);
      ScenarioBus.dispatchEvent(new CustomEvent('run:complete', { detail: { run } }));

      return run;
    } catch (err) {
      run.endedAt = now();
      run.status = 'failed';
      await indexedDbService.update(RUNS_STORE, run.id, run as any);
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

