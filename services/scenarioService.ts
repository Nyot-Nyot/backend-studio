// layananSkenario.ts
// Layanan untuk mengelola dan menjalankan skenario pengujian

import { Connector, Scenario, ScenarioRun, ScenarioStepLog } from '../types';
import { ambilPenggunaAcak } from './apiService';
import { indexedDbService } from './indexedDbService';
import {
  ErrorSkenarioTidakDitemukan,
  ErrorStepGagal,
  ErrorTemplate
} from './scenarioErrors';

/**
 * Nama store untuk penyimpanan data
 */
const STORE_SKENARIO = 'skenario';
const STORE_RUNS = 'runs';
const STORE_KONEKTOR = 'konektor';

/**
 * Bus event sederhana untuk subskripsi UI
 */
export const BusSkenario = new EventTarget();

/**
 * Mendapatkan timestamp saat ini
 */
const waktuSekarang = () => Date.now();

/**
 * Mengambil nilai dari objek menggunakan jalur (path) bertingkat
 * @param obj - Objek sumber
 * @param jalur - Jalur untuk mengakses nilai (misal: "response.items[0].name")
 * @returns Nilai yang ditemukan atau undefined
 *
 * @catatan
 * Mendukung jalur dengan titik dan indeks array, contoh:
 * - "response.items[0].name"
 * - "response.items.0.name"
 */
const ambilNilaiDariJalur = (obj: unknown, jalur: string): unknown => {
  try {
    if (typeof jalur !== 'string' || jalur.length === 0) return undefined;
    if (typeof obj !== 'object' || obj === null) return undefined;

    const segmen: string[] = [];
    const regex = /([^.[\]]+)|\[(\d+)\]/g;
    let kecocokan: RegExpExecArray | null;

    while ((kecocokan = regex.exec(jalur)) !== null) {
      segmen.push(kecocokan[1] ?? kecocokan[2]);
    }

    let akumulator: unknown = obj;
    for (const segmenSaatIni of segmen) {
      if (akumulator === undefined || akumulator === null) return undefined;

      if (Array.isArray(akumulator)) {
        const indeks = Number(segmenSaatIni);
        if (!Number.isNaN(indeks) && indeks in (akumulator as any)) {
          akumulator = (akumulator as any)[indeks];
          continue;
        }
      }

      if (typeof akumulator === 'object' && akumulator !== null &&
        (segmenSaatIni in (akumulator as Record<string, unknown>))) {
        akumulator = (akumulator as Record<string, unknown>)[segmenSaatIni];
      } else {
        return undefined;
      }
    }

    return akumulator;
  } catch (errorAmbil) {
    return undefined;
  }
};

/**
 * Menerapkan template pada input menggunakan konteks
 * @param input - Data input yang mungkin berisi template
 * @param konteks - Konteks untuk mengganti placeholder
 * @returns Data dengan template yang sudah diterapkan
 */
const terapkanTemplate = (input: unknown, konteks: unknown): unknown => {
  if (typeof input === 'string') {
    return input.replace(/{{\s*([^}]+)\s*}}/g, (cocokan: string, kunci: string) => {
      try {
        const nilai = ambilNilaiDariJalur(konteks, kunci.trim());
        return (nilai === undefined || nilai === null) ? '' : String(nilai);
      } catch (errorTemplate) {
        // Konservatif: jika gagal mengurai template, kembalikan string kosong
        return '';
      }
    });
  }

  if (Array.isArray(input)) {
    return input.map(item => terapkanTemplate(item, konteks));
  }

  if (typeof input === 'object' && input !== null) {
    const keluaran: Record<string, unknown> = {};
    for (const [kunci, nilai] of Object.entries(input as Record<string, unknown>)) {
      keluaran[kunci] = terapkanTemplate(nilai, konteks);
    }
    return keluaran;
  }

  return input;
};

export class LayananSkenario {
  /**
   * Mendapatkan daftar semua skenario
   */
  static async daftarSkenario(): Promise<Scenario[]> {
    return (await indexedDbService.dapatkanKoleksi(STORE_SKENARIO)) as Scenario[];
  }

  /**
   * Mendapatkan skenario berdasarkan ID
   * @param id - ID skenario
   * @returns Skenario jika ditemukan, undefined jika tidak
   */
  static async dapatkanSkenario(id: string): Promise<Scenario | undefined> {
    const daftar = (await indexedDbService.dapatkanKoleksi(STORE_SKENARIO)) as Scenario[];
    return daftar.find((skenario) => skenario.id === id);
  }

  /**
   * Menyimpan skenario (buat baru atau perbarui yang sudah ada)
   * @param skenario - Objek skenario
   */
  static async simpanSkenario(skenario: Scenario): Promise<void> {
    skenario.updatedAt = Date.now();
    if (!skenario.id) {
      await indexedDbService.sisipkan(STORE_SKENARIO, skenario);
    } else {
      await indexedDbService.perbarui(STORE_SKENARIO, skenario.id, skenario);
    }
  }

  /**
   * Menghapus skenario berdasarkan ID
   * @param id - ID skenario
   */
  static async hapusSkenario(id: string): Promise<void> {
    await indexedDbService.hapus(STORE_SKENARIO, id);
  }

  /**
   * Menjalankan skenario berdasarkan ID
   * @param idSkenario - ID skenario yang akan dijalankan
   * @param opsi - Opsi tambahan untuk menjalankan skenario
   * @returns Hasil run skenario
   *
   * @catatan
   * - Mengirimkan event ke BusSkenario untuk melaporkan kemajuan
   * - Menyimpan log setiap step ke database
   * - Mendukung template dalam payload step
   */
  static async jalankanSkenario(
    idSkenario: string,
    opsi?: {
      fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
      eventTarget?: EventTarget;
      uuidFn?: () => string;
      nowFn?: () => number;
    }
  ): Promise<ScenarioRun> {
    const skenario = await this.dapatkanSkenario(idSkenario);
    if (!skenario) {
      throw new ErrorSkenarioTidakDitemukan(idSkenario);
    }

    const fetchFn = opsi?.fetchFn ??
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : async () => {
          throw new Error('fetch tidak tersedia di lingkungan ini');
        }
      );

    const eventTarget = opsi?.eventTarget ??
      (typeof window !== 'undefined' ? window : BusSkenario);

    const uuidFn = opsi?.uuidFn ??
      (() => (typeof crypto !== 'undefined' &&
        typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      ));

    const nowFn = opsi?.nowFn ?? (() => Date.now());

    const run: ScenarioRun = {
      id: uuidFn(),
      scenarioId: skenario.id,
      startedAt: nowFn(),
      status: 'running',
      stepLogs: []
    };

    // Simpan run ke database
    await indexedDbService.sisipkan(STORE_RUNS, run);

    // Kirim event bahwa run telah dimulai
    BusSkenario.dispatchEvent(
      new CustomEvent('run:update', { detail: { run } })
    );

    try {
      let keluaranTerakhir: unknown = undefined;

      // Jalankan setiap step dalam skenario
      for (const step of skenario.steps) {
        const logStep: ScenarioStepLog = {
          stepId: step.id,
          startedAt: nowFn(),
          status: 'running'
        };

        run.stepLogs.push(logStep);

        BusSkenario.dispatchEvent(
          new CustomEvent('run:step', {
            detail: { run, step: step, stepLog: logStep }
          })
        );

        try {
          // Penundaan opsional sebelum menjalankan step
          if (step.delay) {
            await new Promise(selesaikan => setTimeout(selesaikan, step.delay));
          }

          // Terapkan template pada payload dengan konteks keluaran sebelumnya
          let payload: unknown;
          try {
            payload = terapkanTemplate(
              step.payload || {},
              { response: keluaranTerakhir }
            );
          } catch (errorTemplate) {
            throw new ErrorTemplate('Gagal menerapkan template pada payload');
          }

          const payloadObj = (payload as unknown) as Record<string, unknown>;

          // Tangani berdasarkan tipe step
          const tipeStep = (step as any).tipe ?? (step as any).type;
          if (tipeStep === 'callApi') {
            // Penanganan sederhana: jika payload.mock === 'randomUser' gunakan ambilPenggunaAcak
            let keluaran: unknown = null;

            if (typeof payloadObj?.mock === 'string' && payloadObj.mock === 'randomUser') {
              keluaran = await ambilPenggunaAcak();
            } else if (typeof payloadObj?.url === 'string') {
              const methodStr = typeof payloadObj?.method === 'string'
                ? payloadObj.method
                : (typeof payloadObj?.metode === 'string' ? payloadObj?.metode : 'GET');

              const respons = await fetchFn(
                payloadObj.url as string,
                {
                  method: methodStr
                }
              );

              keluaran = {
                status: respons.status,
                body: await respons.text()
              } as const;
            }

            logStep.output = keluaran;
            logStep.status = 'success';
            keluaranTerakhir = logStep.output;

          } else if (tipeStep === 'emitSocket') {
            const dataPayload = payloadObj || {};

            // Kirim event kustom yang dapat didengarkan oleh UI SocketConsole
            eventTarget.dispatchEvent(
              new CustomEvent('scenario:socket', { detail: dataPayload })
            );

            logStep.output = dataPayload;
            logStep.status = 'success';
            keluaranTerakhir = logStep.output;

          } else if (tipeStep === 'wait') {
            const dataPayload = payloadObj || {};
            const milidetik = typeof (dataPayload as any).ms === 'number'
              ? (dataPayload as any).ms
              : 500;

            await new Promise(selesaikan => setTimeout(selesaikan, milidetik));
            logStep.status = 'success';

          } else {
            // Tipe step tidak dikenali, anggap sebagai no-op
            logStep.status = 'success';
            logStep.output = { note: 'noop' };
            keluaranTerakhir = logStep.output;
          }
        } catch (errorStep: unknown) {
          const errorDibungkus = new ErrorStepGagal(
            step.id,
            (errorStep as Error)?.message || String(errorStep),
            (errorStep as Error) || undefined
          );

          logStep.status = 'failed';
          logStep.error = errorDibungkus.message;
          run.status = 'failed';

          // Simpan status run yang gagal dan kirim event
          await indexedDbService.perbarui(STORE_RUNS, run.id, run as any);
          BusSkenario.dispatchEvent(
            new CustomEvent('run:update', { detail: { run } })
          );

          throw errorDibungkus;
        }

        logStep.endedAt = nowFn();

        // Simpan run setelah setiap step selesai
        await indexedDbService.perbarui(STORE_RUNS, run.id, run as any);
        BusSkenario.dispatchEvent(
          new CustomEvent('run:step:done', {
            detail: { run, step, stepLog: logStep }
          })
        );
      }

      // Semua step berhasil diselesaikan
      run.endedAt = nowFn();
      run.status = 'completed';
      await indexedDbService.perbarui(STORE_RUNS, run.id, run);

      BusSkenario.dispatchEvent(
        new CustomEvent('run:complete', { detail: { run } })
      );

      return run;
    } catch (errorRun) {
      // Tangani error yang tidak tertangkap dalam loop step
      run.endedAt = nowFn();
      run.status = 'failed';
      await indexedDbService.perbarui(STORE_RUNS, run.id, run);

      BusSkenario.dispatchEvent(
        new CustomEvent('run:complete', { detail: { run } })
      );

      throw errorRun;
    }
  }

  /**
   * Mendapatkan daftar run untuk skenario tertentu
   * @param idSkenario - ID skenario
   * @returns Array run skenario
   */
  static async daftarRunUntukSkenario(idSkenario: string): Promise<ScenarioRun[]> {
    const runs = (await indexedDbService.dapatkanKoleksi(STORE_RUNS)) as ScenarioRun[];
    return runs.filter(run => run.scenarioId === idSkenario);
  }

  /**
   * Mendapatkan daftar semua konektor
   */
  static async daftarKonektor(): Promise<Connector[]> {
    return (await indexedDbService.dapatkanKoleksi(STORE_KONEKTOR)) as Connector[];
  }

  /**
   * Menyimpan konektor (buat baru atau perbarui yang sudah ada)
   * @param konektor - Objek konektor
   */
  static async simpanKonektor(konektor: Connector): Promise<void> {
    if (!konektor.id) {
      await indexedDbService.sisipkan(STORE_KONEKTOR, konektor);
    } else {
      await indexedDbService.perbarui(STORE_KONEKTOR, konektor.id, konektor);
    }
  }
}
