import { dbService } from "../services/dbService";

(async () => {
  // Nama test dan deskripsi berbahasa Indonesia
  console.log('🧪 [dbService] Memastikan saveCollection mengembalikanPromise saat opsi await diberikan');

  // Polyfill localStorage untuk environment Node test
  if (typeof (globalThis as any).localStorage === 'undefined') {
    (globalThis as any).localStorage = (function () {
      const store: Record<string, string> = {};
      return {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length; }
      };
    })();
  }

  // Persiapan
  const coll = 'type_contract_test_users';
  // Pastikan bersih
  dbService.clearCollection(coll);

  // Simulasikan menyimpan dan menunggu persist
  await dbService.saveCollection(coll, [{ id: 1, name: 'A' }], { await: true });

  const loaded = dbService.getCollection(coll);
  if (!Array.isArray(loaded)) throw new Error('getCollection harus mengembalikan array');
  if ((loaded as any).length === 0) throw new Error('Collection harus berisi item yang disimpan');

  console.log('✅ PASS: saveCollection(opts.await: true) dan getCollection berperilaku seperti yang diharapkan');

  // Cleanup
  dbService.clearCollection(coll);
})();
