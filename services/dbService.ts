// layananDatabase.ts
/**
 * Layanan Database dengan backend penyimpanan yang dapat dipasang opsional.
 * - Perilaku default tetap kompatibel dengan API sinkron yang ada
 * - Mendukung backend: 'localStorage' (default), 'indexeddb', 'memory'
 * - Menambahkan fungsi bantuan async untuk konsumen yang menginginkan persistensi deterministik
 */

import { logger } from './logger';

const log = logger('layananDatabase');

// Prefiks untuk kunci penyimpanan lokal (localStorage)
const PREFIKS_DB = "api_sim_db_";

/**
 * Tipe dasar untuk item database
 */
export type Id = string | number;

export interface ItemDatabase {
  id?: Id;
  [k: string]: unknown;
}

/**
 * Koleksi yang secara default menggunakan UUID saat kosong
 * @constant
 */
const KOLEKSI_DENGAN_UUID_DEFAULT = new Set<string>(["produk", "item"]);

/**
 * Nomor ID numerik default pertama untuk kompatibilitas mundur
 * @constant
 */
const ID_NUMERIK_PERTAMA_DEFAULT = 1;

// Cache dalam memori untuk menjaga stabilitas API sinkron sementara persistensi mungkin async
const cache: Record<string, ItemDatabase[]> = {};

// Backend penyimpanan yang aktif, default ke localStorage
let _backend: 'localStorage' | 'indexeddb' | 'memory' = 'localStorage';

/**
 * Memeriksa ketersediaan localStorage di lingkungan saat ini
 * @returns {boolean} true jika localStorage tersedia
 */
const apakahLocalStorageTersedia = (): boolean => {
  try {
    return typeof (globalThis as any).localStorage !== 'undefined' &&
      (globalThis as any).localStorage !== null;
  } catch {
    return false;
  }
};

/**
 * Memeriksa ketersediaan IndexedDB di lingkungan saat ini
 * @returns {boolean} true jika IndexedDB tersedia
 */
const apakahIndexedDBTersedia = (): boolean => {
  try {
    return typeof (globalThis as any).indexedDB !== 'undefined' &&
      (globalThis as any).indexedDB !== null;
  } catch {
    return false;
  }
};

/**
 * Mendeteksi apakah semua ID dalam koleksi adalah numerik
 * @param ids - Array ID yang akan diperiksa
 * @returns {boolean} true jika semua ID numerik dan array tidak kosong
 */
const apakahStrategiIdNumerik = (ids: unknown[]): boolean => {
  const arrayTidakKosong = ids.length > 0;
  const semuaNumerik = ids.every((nilai) => typeof nilai === "number");

  return arrayTidakKosong && semuaNumerik;
};

/**
 * Menghasilkan ID numerik dengan mencari nilai maksimum dan menambahkan 1
 * @param ids - Array ID numerik yang ada
 * @returns {number} ID numerik baru
 */
const hasilkanIdNumerik = (ids: number[]): number => {
  if (ids.length === 0) {
    return ID_NUMERIK_PERTAMA_DEFAULT;
  }

  const idMaksimum = ids.reduce(
    (maksimum: number, nilaiSaatIni: number) => (nilaiSaatIni > maksimum ? nilaiSaatIni : maksimum),
    0
  );

  return idMaksimum + 1;
};

/**
 * Menghasilkan UUID pendek (8 karakter pertama)
 * @returns {string} UUID pendek
 */
const hasilkanUuidPendek = (): string => {
  return crypto.randomUUID().split("-")[0];
};

/**
 * Memuat semua koleksi dari localStorage ke cache
 * Fungsi ini digunakan saat inisialisasi untuk memastikan data tersedia untuk API sinkron
 */
const muatSemuaDariLocalStorage = (): void => {
  if (!apakahLocalStorageTersedia()) {
    return;
  }

  for (let indeks = 0; indeks < ((globalThis as any).localStorage.length || 0); indeks++) {
    const kunci = (globalThis as any).localStorage.key(indeks);

    if (kunci && kunci.startsWith(PREFIKS_DB)) {
      const namaKoleksi = kunci.replace(PREFIKS_DB, "");

      try {
        const dataString = (globalThis as any).localStorage.getItem(kunci) || 'null';
        cache[namaKoleksi] = JSON.parse(dataString) || [];
      } catch (errorParsing) {
        log.warn(`Gagal memparsing koleksi "${namaKoleksi}" dari localStorage:`, errorParsing);
        cache[namaKoleksi] = [];
      }
    }
  }
};

/**
 * Menyimpan koleksi ke backend yang aktif
 * @param nama - Nama koleksi
 * @param data - Data koleksi
 * @returns {Promise<void>} Promise yang selesai ketika penyimpanan berhasil atau gagal
 */
const simpanKoleksiKeBackend = async (nama: string, data: ItemDatabase[]): Promise<void> => {
  try {
    switch (_backend) {
      case 'localStorage':
        if (!apakahLocalStorageTersedia()) {
          log.warn(`localStorage tidak tersedia: tidak dapat menyimpan koleksi "${nama}"`);
          return;
        }

        (globalThis as any).localStorage.setItem(PREFIKS_DB + nama, JSON.stringify(data));
        break;

      case 'indexeddb':
        const modul = await import('./indexedDbService');
        await modul.indexedDbService.simpanKoleksi(nama, data);
        break;

      case 'memory':
        // Backend memory tidak memerlukan persistensi eksternal
        break;
    }
  } catch (errorPenyimpanan) {
    log.error(`Gagal menyimpan koleksi "${nama}" ke backend ${_backend}:`, errorPenyimpanan);
  }
};

/**
 * Membersihkan koleksi dari backend yang aktif
 * @param nama - Nama koleksi yang akan dibersihkan
 * @returns {Promise<void>} Promise yang selesai ketika pembersihan selesai
 */
const bersihkanKoleksiDariBackend = async (nama: string): Promise<void> => {
  try {
    switch (_backend) {
      case 'localStorage':
        if (apakahLocalStorageTersedia()) {
          (globalThis as any).localStorage.removeItem(PREFIKS_DB + nama);
        }
        break;

      case 'indexeddb':
        const modul = await import('./indexedDbService');
        await modul.indexedDbService.bersihkanKoleksi(nama);
        break;

      case 'memory':
        // Tidak ada tindakan khusus untuk memory backend
        break;
    }
  } catch (errorPembersihan) {
    log.warn(`Gagal membersihkan koleksi "${nama}" dari backend ${_backend}:`, errorPembersihan);
  }
};

export const layananDatabase = {
  /**
   * Mendapatkan seluruh koleksi (API sinkron dipertahankan)
   * Menggunakan cache dalam memori jika tersedia, jika tidak, fallback ke localStorage.
   *
   * @param nama - Nama koleksi
   * @returns Array item dari koleksi
   *
   * @contohPenggunaan
   * ```
   * const semuaPengguna = layananDatabase.dapatkanKoleksi('pengguna');
   * console.log(semuaPengguna.length); // 5
   * ```
   */
  dapatkanKoleksi: <T extends ItemDatabase = ItemDatabase>(nama: string): T[] => {
    // Jika menggunakan backend indexeddb dan cache sudah terisi, gunakan cache untuk pembacaan sinkron
    if (_backend === 'indexeddb' && cache[nama]) {
      return cache[nama] as T[];
    }

    // Selalu baca dari localStorage untuk perilaku pengujian yang deterministik
    if (!apakahLocalStorageTersedia()) {
      cache[nama] = cache[nama] || [];
      return cache[nama] as T[];
    }

    try {
      const dataString = (globalThis as any).localStorage.getItem(PREFIKS_DB + nama);
      const dataTerparsing = dataString ? (JSON.parse(dataString) as T[]) : [];
      cache[nama] = dataTerparsing;
      return dataTerparsing;
    } catch (errorPembacaan) {
      log.warn(`Error membaca koleksi "${nama}":`, errorPembacaan);
      cache[nama] = [];
      return [];
    }
  },

  /**
   * Menyimpan seluruh koleksi.
   * - Default: tanda tangan sinkron (persistensi latar belakang fire-and-forget) untuk mempertahankan perilaku yang ada.
   * - Jika `opsi.tunggu` true, mengembalikan Promise yang selesai ketika persistensi selesai.
   *
   * @param nama - Nama koleksi
   * @param data - Data koleksi
   * @param opsi - Opsi penyimpanan
   * @returns {void | Promise<void>} Tidak mengembalikan apa-apa atau Promise jika opsi.tunggu=true
   */
  simpanKoleksi: <T extends ItemDatabase = ItemDatabase>(
    nama: string,
    data: T[],
    opsi?: { tunggu?: boolean }
  ): void | Promise<void> => {
    // Perbarui cache dalam memori
    cache[nama] = data as ItemDatabase[];

    if (opsi && opsi.tunggu) {
      // Kembalikan Promise yang selesai ketika persistensi selesai
      return (async (): Promise<void> => {
        try {
          await simpanKoleksiKeBackend(nama, data as ItemDatabase[]);
        } catch (errorSimpan) {
          log.warn('Penyimpanan gagal:', errorSimpan);
        }
      })();
    }

    // Fire-and-forget (kompatibilitas mundur)
    (async (): Promise<void> => {
      try {
        await simpanKoleksiKeBackend(nama, data as ItemDatabase[]);
      } catch (errorSimpan) {
        log.warn('Penyimpanan gagal:', errorSimpan);
      }
    })();
  },

  /**
   * Fungsi async eksplisit untuk menyimpan koleksi
   * @param nama - Nama koleksi
   * @param data - Data koleksi
   * @returns {Promise<void>} Promise yang selesai ketika penyimpanan berhasil
   */
  simpanKoleksiAsync: async (nama: string, data: ItemDatabase[]): Promise<void> => {
    cache[nama] = data;
    await simpanKoleksiKeBackend(nama, data);
  },

  /**
   * Membersihkan koleksi tertentu
   * @param nama - Nama koleksi yang akan dibersihkan
   */
  bersihkanKoleksi: (nama: string): void => {
    // Hapus dari cache
    delete cache[nama];

    // Hapus dari backend yang aktif
    (async (): Promise<void> => {
      await bersihkanKoleksiDariBackend(nama);
    })();
  },

  /**
   * Mendaftar semua koleksi (dari cache + fallback localStorage)
   * @returns {string[]} Daftar nama koleksi
   */
  daftarKoleksi: (): string[] => {
    const namaKoleksi = new Set<string>(Object.keys(cache));

    if (!apakahLocalStorageTersedia()) {
      return Array.from(namaKoleksi);
    }

    for (let indeks = 0; indeks < ((globalThis as any).localStorage.length || 0); indeks++) {
      const kunci = (globalThis as any).localStorage.key(indeks);
      if (kunci && kunci.startsWith(PREFIKS_DB)) {
        namaKoleksi.add(kunci.replace(PREFIKS_DB, ''));
      }
    }

    return Array.from(namaKoleksi);
  },

  /**
   * Mencari item berdasarkan ID
   * @param koleksi - Nama koleksi
   * @param id - ID yang dicari
   * @returns Item jika ditemukan, undefined jika tidak
   */
  temukan: <T extends ItemDatabase = ItemDatabase>(koleksi: string, id: string | number): T | undefined => {
    const daftar = layananDatabase.dapatkanKoleksi<T>(koleksi);
    return daftar.find((item) => item.id == id);
  },

  /**
   * Menyisipkan item baru ke koleksi
   * @param koleksi - Nama koleksi
   * @param item - Item yang akan disisipkan
   * @returns Item yang sudah disisipkan dengan ID
   */
  sisipkan: (koleksi: string, item: Record<string, unknown>): Record<string, unknown> & { id: string | number } => {
    const daftar = layananDatabase.dapatkanKoleksi(koleksi);

    // Jika item tidak memiliki ID, hasilkan ID baru
    if (item.id === undefined || item.id === null) {
      const idYangAda = daftar
        .map((i) => i.id)
        .filter((nilai) => nilai !== undefined && nilai !== null) as unknown[];

      if (idYangAda.length === 0) {
        // Koleksi kosong: tentukan strategi ID berdasarkan nama koleksi
        if (KOLEKSI_DENGAN_UUID_DEFAULT.has(koleksi)) {
          item.id = hasilkanUuidPendek();
        } else {
          item.id = ID_NUMERIK_PERTAMA_DEFAULT;
        }
      } else if (apakahStrategiIdNumerik(idYangAda)) {
        // Koleksi menggunakan ID numerik
        item.id = hasilkanIdNumerik(idYangAda as number[]);
      } else {
        // Koleksi menggunakan ID string (UUID)
        item.id = hasilkanUuidPendek();
      }
    }

    // Tambahkan item ke daftar dan simpan
    daftar.push(item as ItemDatabase);
    layananDatabase.simpanKoleksi(koleksi, daftar);

    return item as Record<string, unknown> & { id: string | number };
  },

  /**
   * Memperbarui item berdasarkan ID
   * @param koleksi - Nama koleksi
   * @param id - ID item yang akan diperbarui
   * @param pembaruan - Data pembaruan
   * @returns Item yang sudah diperbarui atau null jika tidak ditemukan
   */
  perbarui: (
    koleksi: string,
    id: string | number,
    pembaruan: Partial<Record<string, unknown>>
  ): Record<string, unknown> | null => {
    const daftar = layananDatabase.dapatkanKoleksi(koleksi);
    const indeks = daftar.findIndex((item) => item.id == id);

    if (indeks !== -1) {
      // Gabungkan item lama dengan pembaruan
      daftar[indeks] = { ...daftar[indeks], ...pembaruan } as ItemDatabase;
      layananDatabase.simpanKoleksi(koleksi, daftar);
      return daftar[indeks] as Record<string, unknown>;
    }

    return null;
  },

  /**
   * Menghapus item berdasarkan ID
   * @param koleksi - Nama koleksi
   * @param id - ID item yang akan dihapus
   * @returns true jika berhasil dihapus, false jika tidak ditemukan
   */
  hapus: (koleksi: string, id: string | number): boolean => {
    let daftar = layananDatabase.dapatkanKoleksi(koleksi);
    const panjangAwal = daftar.length;

    daftar = daftar.filter((item) => item.id != id);

    if (daftar.length !== panjangAwal) {
      layananDatabase.simpanKoleksi(koleksi, daftar as ItemDatabase[]);
      return true;
    }

    return false;
  },

  /**
   * Mendapatkan statistik koleksi
   * @param koleksi - Nama koleksi
   * @returns Statistik jumlah item dan tipe ID
   */
  dapatkanStatistik: (koleksi: string): { jumlah: number; tipeId: 'numerik' | 'string' | 'campuran' } => {
    const daftar = layananDatabase.dapatkanKoleksi(koleksi);

    if (daftar.length === 0) {
      return { jumlah: 0, tipeId: 'campuran' };
    }

    const tipeIdUnik = new Set(daftar.map((item) => typeof item.id));
    let tipeId: 'numerik' | 'string' | 'campuran' = 'string';

    if (tipeIdUnik.size === 1) {
      tipeId = tipeIdUnik.has('number') ? 'numerik' : 'string';
    } else {
      tipeId = 'campuran';
    }

    return {
      jumlah: daftar.length,
      tipeId,
    };
  },

  /**
   * Membersihkan semua koleksi (sinkron)
   */
  bersihkanSemuaKoleksi: (): void => {
    const koleksi = layananDatabase.daftarKoleksi();
    koleksi.forEach((namaKoleksi) => {
      layananDatabase.bersihkanKoleksi(namaKoleksi);
    });
  },

  /**
   * Variasi async: membersihkan semua koleksi dan menunggu persistensi backend selesai.
   * Berguna untuk alur deterministik seperti reset pabrik atau impor di mana kita perlu menjamin
   * status penyimpanan sebelum melanjutkan.
   */
  bersihkanSemuaKoleksiAsync: async (): Promise<void> => {
    const koleksi = layananDatabase.daftarKoleksi();

    if (_backend === 'indexeddb') {
      try {
        const modul = await import('./indexedDbService');
        for (const namaKoleksi of koleksi) {
          await modul.indexedDbService.bersihkanKoleksi(namaKoleksi);
        }
      } catch (errorIndexedDB) {
        log.warn('bersihkanSemuaKoleksiAsync (indexeddb) gagal:', errorIndexedDB);
        // Fallback ke localStorage
        for (const namaKoleksi of koleksi) {
          if (apakahLocalStorageTersedia()) {
            (globalThis as any).localStorage.removeItem(PREFIKS_DB + namaKoleksi);
          }
        }
      }
    } else {
      // localStorage atau memory: bersihkan secara sinkron
      for (const namaKoleksi of koleksi) {
        if (apakahLocalStorageTersedia()) {
          (globalThis as any).localStorage.removeItem(PREFIKS_DB + namaKoleksi);
        }
        delete cache[namaKoleksi];
      }
    }
  },

  // Backward-compatible English alias
  clearAllCollectionsAsync: async (): Promise<void> => {
    return layananDatabase.bersihkanSemuaKoleksiAsync();
  },

  /**
   * Menginisialisasi backend dan secara opsional memigrasi data dari localStorage ke IndexedDB.
   * Jika backend adalah 'auto' maka akan memilih IndexedDB jika tersedia.
   */
  inisialisasi: async (opsi?: { backend?: 'auto' | 'indexeddb' | 'localStorage' }): Promise<{ dimigrasi: boolean }> => {
    const backend = opsi?.backend ?? 'auto';
    const indexedDBTersedia = apakahIndexedDBTersedia();

    if (backend === 'indexeddb' || (backend === 'auto' && indexedDBTersedia)) {
      try {
        _backend = 'indexeddb';
        const modul = await import('./indexedDbService');
        await modul.indexedDbService.inisialisasi();

        // Coba migrasi jika localStorage memiliki data
        const hasilMigrasi = await modul.indexedDbService.migrasiDariLocalStorage(PREFIKS_DB);
        const dimigrasi = (hasilMigrasi as any).dimigrasi ?? (hasilMigrasi as any).migrated ?? false;

        // Muat semua koleksi dari indexedDB ke cache untuk pembacaan sinkron
        const koleksi = (await modul.indexedDbService.daftarKoleksi()) as string[];
        for (const namaKoleksi of koleksi) {
          cache[namaKoleksi] = await modul.indexedDbService.dapatkanKoleksi(namaKoleksi);
        }

        // Juga ambil koleksi dari localStorage yang belum dimigrasi
        muatSemuaDariLocalStorage();

        return { dimigrasi };
      } catch (errorInisialisasi) {
        log.warn('Inisialisasi/migrasi IndexedDB gagal:', errorInisialisasi);
        // fallback ke mode localStorage
        _backend = 'localStorage';
        muatSemuaDariLocalStorage();
        return { dimigrasi: false };
      }
    }

    // Mode localStorage: isi cache segera
    _backend = 'localStorage';
    muatSemuaDariLocalStorage();
    return { dimigrasi: false };
  },

  /**
   * Variasi async untuk mendapatkan koleksi
   * @param nama - Nama koleksi
   * @returns Promise yang mengembalikan data koleksi
   */
  dapatkanKoleksiAsync: async <T extends ItemDatabase = ItemDatabase>(nama: string): Promise<T[]> => {
    if (_backend === 'indexeddb') {
      try {
        const modul = await import('./indexedDbService');
        const data = await modul.indexedDbService.dapatkanKoleksi(nama);
        cache[nama] = data;
        return data as T[];
      } catch (errorIndexedDB) {
        log.warn('dapatkanKoleksiAsync (indexeddb) gagal:', errorIndexedDB);
      }
    }

    // Fallback ke versi sinkron
    return layananDatabase.dapatkanKoleksi(nama);
  },

  // Backward-compatible aliases for initialization
  init: (opsi?: { backend?: 'auto' | 'indexeddb' | 'localStorage' }) => layananDatabase.inisialisasi(opsi),
  initialize: (opsi?: { backend?: 'auto' | 'indexeddb' | 'localStorage' }) => layananDatabase.inisialisasi(opsi),
};

// Backward-compatible named export expected by many modules/tests
export const dbService = layananDatabase;
export default layananDatabase;

