/* Layanan berbasis IndexedDB yang minimal
 * - Menggunakan satu object store `koleksi` yang dikunci oleh nama koleksi
 * - Menyediakan CRUD berbasis Promise dan helper migrasi
 * - Implementasi yang sengaja kecil/sinkron untuk menghindari dependensi ekstra
 */

import { hasilkanIdUntukKoleksi } from './idUtils';

/**
 * Konstanta untuk konfigurasi database
 */
const NAMA_DB_DEFAULT = "backendStudioDB";
const NAMA_STORE_DEFAULT = "koleksi";

/**
 * Memeriksa ketersediaan IndexedDB di lingkungan saat ini
 */
const apakahIndexedDBTersedia = typeof indexedDB !== 'undefined';

/**
 * Penyimpanan dalam memori sebagai fallback ketika IndexedDB tidak tersedia
 */
const penyimpananDalamMemori: Record<string, any[]> = {};

/**
 * Tipe untuk merekam hasil migrasi
 */
interface HasilMigrasi {
  dimigrasi: boolean;
  kunciYangDimigrasi: string[];
  error: { kunci: string; pesan: string }[];
}

/**
 * Membuka koneksi ke database IndexedDB
 * @param namaDb - Nama database (default: NAMA_DB_DEFAULT)
 * @returns Promise yang mengembalikan koneksi database atau null jika IndexedDB tidak tersedia
 */
const bukaDatabase = (namaDb: string = NAMA_DB_DEFAULT): Promise<IDBDatabase | null> => {
  if (!apakahIndexedDBTersedia) {
    return Promise.resolve(null);
  }

  return new Promise((selesaikan, tolak) => {
    const permintaan = indexedDB.open(namaDb, 1);

    permintaan.onupgradeneeded = (peristiwa: IDBVersionChangeEvent) => {
      const database = (peristiwa.target as IDBOpenDBRequest).result as IDBDatabase;

      // Buat object store jika belum ada
      if (!database.objectStoreNames.contains(NAMA_STORE_DEFAULT)) {
        database.createObjectStore(NAMA_STORE_DEFAULT, { keyPath: "nama" });
      }
    };

    permintaan.onsuccess = () => {
      selesaikan(permintaan.result);
    };

    permintaan.onerror = () => {
      tolak(permintaan.error);
    };
  });
};

/**
 * Menyimpan atau memperbarui data koleksi di IndexedDB
 * @param database - Koneksi database atau null
 * @param nama - Nama koleksi
 * @param data - Data koleksi
 * @returns Promise yang selesai ketika operasi selesai
 */
const simpanRekaman = async (database: IDBDatabase | null, nama: string, data: any[]): Promise<void> => {
  if (!apakahIndexedDBTersedia || database === null) {
    // Fallback ke penyimpanan dalam memori
    penyimpananDalamMemori[nama] = data;
    return;
  }

  return new Promise((selesaikan, tolak) => {
    const transaksi = database.transaction(NAMA_STORE_DEFAULT, "readwrite");
    const store = transaksi.objectStore(NAMA_STORE_DEFAULT);
    const permintaan = store.put({ nama, data });

    permintaan.onsuccess = () => {
      selesaikan();
    };

    permintaan.onerror = () => {
      tolak(permintaan.error);
    };
  });
};

/**
 * Mengambil data koleksi dari IndexedDB
 * @param database - Koneksi database atau null
 * @param nama - Nama koleksi
 * @returns Promise yang mengembalikan data koleksi atau null jika tidak ditemukan
 */
const ambilRekaman = async (database: IDBDatabase | null, nama: string): Promise<any[] | null> => {
  if (!apakahIndexedDBTersedia || database === null) {
    // Fallback ke penyimpanan dalam memori
    return penyimpananDalamMemori[nama] ?? null;
  }

  return new Promise((selesaikan, tolak) => {
    const transaksi = database.transaction(NAMA_STORE_DEFAULT, "readonly");
    const store = transaksi.objectStore(NAMA_STORE_DEFAULT);
    const permintaan = store.get(nama);

    permintaan.onsuccess = () => {
      const hasil = permintaan.result;
      selesaikan(hasil ? hasil.data : null);
    };

    permintaan.onerror = () => {
      tolak(permintaan.error);
    };
  });
};

/**
 * Mengambil semua kunci (nama koleksi) dari IndexedDB
 * @param database - Koneksi database atau null
 * @returns Promise yang mengembalikan array nama koleksi
 */
const ambilSemuaKunci = async (database: IDBDatabase | null): Promise<string[]> => {
  if (!apakahIndexedDBTersedia || database === null) {
    // Fallback ke penyimpanan dalam memori
    return Object.keys(penyimpananDalamMemori);
  }

  return new Promise((selesaikan, tolak) => {
    const transaksi = database.transaction(NAMA_STORE_DEFAULT, "readonly");
    const store = transaksi.objectStore(NAMA_STORE_DEFAULT);
    const permintaan = store.getAllKeys();

    permintaan.onsuccess = () => {
      selesaikan(permintaan.result as string[]);
    };

    permintaan.onerror = () => {
      tolak(permintaan.error);
    };
  });
};

export const indexedDbService = {
  /**
   * Menginisialisasi database IndexedDB
   * @param namaDb - Nama database (opsional)
   * @returns Promise yang selesai ketika database siap
   *
   * @contohPenggunaan
   * ```
   * await indexedDbService.inisialisasi();
   * ```
   */
  inisialisasi: async (namaDb: string = NAMA_DB_DEFAULT): Promise<void> => {
    await bukaDatabase(namaDb); // memastikan database ada
  },

  /**
   * Mendapatkan koleksi berdasarkan nama
   * @param nama - Nama koleksi
   * @returns Promise yang mengembalikan array data koleksi
   *
   * @contohPenggunaan
   * ```
   * const dataPengguna = await indexedDbService.dapatkanKoleksi('pengguna');
   * ```
   */
  dapatkanKoleksi: async (nama: string): Promise<any[]> => {
    const database = await bukaDatabase();
    const data = await ambilRekaman(database, nama);
    return data || [];
  },

  /**
   * Menyimpan koleksi ke IndexedDB
   * @param nama - Nama koleksi
   * @param data - Data koleksi
   * @returns Promise yang selesai ketika penyimpanan berhasil
   */
  simpanKoleksi: async (nama: string, data: any[]): Promise<void> => {
    const database = await bukaDatabase();
    await simpanRekaman(database, nama, data || []);
  },

  /**
   * Mendapatkan daftar semua nama koleksi yang tersimpan
   * @returns Promise yang mengembalikan array nama koleksi
   */
  daftarKoleksi: async (): Promise<string[]> => {
    const database = await bukaDatabase();
    const kunci = await ambilSemuaKunci(database);
    return kunci.filter(Boolean);
  },

  /**
   * Membersihkan koleksi tertentu
   * @param nama - Nama koleksi yang akan dibersihkan
   * @returns Promise yang selesai ketika koleksi berhasil dibersihkan
   */
  bersihkanKoleksi: async (nama: string): Promise<void> => {
    const database = await bukaDatabase();

    if (!apakahIndexedDBTersedia || database === null) {
      // Fallback ke penyimpanan dalam memori
      delete penyimpananDalamMemori[nama];
      return;
    }

    await simpanRekaman(database, nama, []);
  },

  /**
   * Membersihkan semua koleksi
   * @returns Promise yang selesai ketika semua koleksi berhasil dibersihkan
   */
  bersihkanSemuaKoleksi: async (): Promise<void> => {
    const database = await bukaDatabase();

    if (!apakahIndexedDBTersedia || database === null) {
      // Bersihkan penyimpanan dalam memori
      for (const kunci of Object.keys(penyimpananDalamMemori)) {
        delete penyimpananDalamMemori[kunci];
      }
      return;
    }

    return new Promise((selesaikan, tolak) => {
      const transaksi = database.transaction(NAMA_STORE_DEFAULT, "readwrite");
      const store = transaksi.objectStore(NAMA_STORE_DEFAULT);
      const permintaan = store.clear();

      permintaan.onsuccess = () => {
        selesaikan();
      };

      permintaan.onerror = () => {
        tolak(permintaan.error);
      };
    });
  },

  /**
   * Menyisipkan item baru ke dalam koleksi
   * @param koleksi - Nama koleksi
   * @param item - Item yang akan disisipkan
   * @returns Promise yang mengembalikan item yang sudah disisipkan dengan ID
   */
  sisipkan: async (koleksi: string, item: any): Promise<any> => {
    const daftar = (await indexedDbService.dapatkanKoleksi(koleksi)) || [];

    // Hasilkan ID sederhana jika diperlukan
    if (item.id === undefined || item.id === null) {
      const idYangAda = daftar
        .map((i: any) => i.id)
        .filter((v: any) => v !== undefined && v !== null);

      const idDihasilkan = hasilkanIdUntukKoleksi(idYangAda, koleksi);
      item.id = idDihasilkan;
    }

    daftar.push(item);
    await indexedDbService.simpanKoleksi(koleksi, daftar);
    return item;
  },

  /**
   * Memperbarui item dalam koleksi berdasarkan ID
   * @param koleksi - Nama koleksi
   * @param id - ID item yang akan diperbarui
   * @param pembaruan - Data pembaruan
   * @returns Promise yang mengembalikan item yang sudah diperbarui atau null jika tidak ditemukan
   */
  perbarui: async (koleksi: string, id: string | number, pembaruan: any): Promise<any | null> => {
    const daftar = (await indexedDbService.dapatkanKoleksi(koleksi)) || [];
    const indeks = daftar.findIndex((item: any) => item.id == id);

    if (indeks === -1) {
      return null;
    }

    daftar[indeks] = { ...daftar[indeks], ...pembaruan };
    await indexedDbService.simpanKoleksi(koleksi, daftar);
    return daftar[indeks];
  },

  /**
   * Menghapus item dari koleksi berdasarkan ID
   * @param koleksi - Nama koleksi
   * @param id - ID item yang akan dihapus
   * @returns Promise yang mengembalikan true jika berhasil dihapus, false jika tidak ditemukan
   */
  hapus: async (koleksi: string, id: string | number): Promise<boolean> => {
    const daftar = (await indexedDbService.dapatkanKoleksi(koleksi)) || [];
    const daftarBaru = daftar.filter((item: any) => item.id != id);

    if (daftarBaru.length === daftar.length) {
      return false;
    }

    await indexedDbService.simpanKoleksi(koleksi, daftarBaru);
    return true;
  },

  /**
   * Mendapatkan beberapa item berdasarkan kumpulan ID
   * @param koleksi - Nama koleksi
   * @param ids - Array ID yang dicari
   * @returns Promise yang mengembalikan array item yang cocok dengan ID
   */
  ambilBanyak: async (koleksi: string, ids: (string | number)[]): Promise<any[]> => {
    const daftar = (await indexedDbService.dapatkanKoleksi(koleksi)) || [];
    return daftar.filter((item: any) => ids.includes(item.id));
  },

  /**
   * Helper migrasi sederhana yang memindahkan kunci `localStorage` dengan prefiks tertentu
   * @param prefiks - Prefiks kunci localStorage yang akan dimigrasi (default: "api_sim_db_")
   * @returns Promise yang mengembalikan hasil migrasi
   *
   * @catatan
   * Fungsi ini mengambil snapshot kunci yang ada untuk menghindari masalah jika localStorage
   * berubah selama iterasi.
   */
  migrasiDariLocalStorage: async (prefiks: string = "api_sim_db_"): Promise<HasilMigrasi> => {
    // Jika localStorage tidak tersedia, tidak ada yang bisa dimigrasi
    const apakahLocalStorageTersedia =
      typeof (globalThis as any).localStorage !== 'undefined' &&
      (globalThis as any).localStorage !== null;

    if (!apakahLocalStorageTersedia) {
      return {
        dimigrasi: false,
        kunciYangDimigrasi: [],
        error: []
      } as const;
    }

    const kunciYangDimigrasi: string[] = [];
    const error: { kunci: string; pesan: string }[] = [];
    const localStorage = (globalThis as any).localStorage as Storage;

    // Ambil snapshot kunci yang ada untuk menghindari perubahan selama iterasi
    const kunci: string[] = [];
    for (let indeks = 0; indeks < localStorage.length; indeks++) {
      const k = localStorage.key(indeks);
      if (k !== null) {
        kunci.push(k);
      }
    }

    for (const kunciItem of kunci) {
      if (!kunciItem.startsWith(prefiks)) {
        continue;
      }

      const namaKoleksi = kunciItem.replace(prefiks, "");

      try {
        const dataMentah = localStorage.getItem(kunciItem);
        const data = dataMentah ? JSON.parse(dataMentah) : null;

        await indexedDbService.simpanKoleksi(namaKoleksi, data || []);
        kunciYangDimigrasi.push(namaKoleksi);
      } catch (errorParsing: any) {
        // Catat data yang rusak dan lanjutkan ke kunci berikutnya
        error.push({
          kunci: kunciItem,
          pesan: String(errorParsing?.message || errorParsing)
        });
        continue;
      }
    }

    return {
      dimigrasi: kunciYangDimigrasi.length > 0,
      kunciYangDimigrasi,
      error
    } as const;
  },
};
