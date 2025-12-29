// mesinMock.ts
// Mesin untuk menangani pencocokan rute, pemrosesan respons dinamis, dan simulasi permintaan HTTP

import { EnvironmentVariable, HttpMethod, MockEndpoint } from "../types";
import { layananDatabase } from "./dbService";
import { logger } from "./logger";

/**
 * Interface untuk hasil pencocokan rute
 */
interface HasilPencocokanRute {
  cocok: boolean;
  parameter: Record<string, string | undefined>;
}

/**
 * Interface untuk hasil simulasi permintaan
 */
interface HasilSimulasi {
  respons: {
    status: number;
    badan: string;
    header: { kunci: string; nilai: string }[];
    penundaan: number;
  };
  idMockYangCocok?: string;
}

/**
 * Variabel sistem yang tersedia untuk digunakan dalam templat respons
 */
const VARIABEL_SISTEM_BANTUAN = [
  { label: '{{$uuid}}', deskripsi: 'UUID v4 acak' },
  { label: '{{$randomInt}}', deskripsi: 'Angka acak (0-1000)' },
  { label: '{{$randomName}}', deskripsi: 'Nama depan acak' },
  { label: '{{$randomCity}}', deskripsi: 'Kota acak' },
  { label: '{{$isoDate}}', deskripsi: 'Tanggal ISO 8601 saat ini' },
  { label: '{{$fakerName}}', deskripsi: 'Alias seperti Faker untuk nama acak' },
  { label: '{{$fakerCity}}', deskripsi: 'Alias seperti Faker untuk kota acak' },
  { label: '{{@param.id}}', deskripsi: 'Nilai dari jalur URL /:id' },
  { label: '{{@query.page}}', deskripsi: 'Nilai dari string kueri misalnya ?page=2' },
  { label: '{{@body.name}}', deskripsi: 'Nilai dari badan permintaan JSON' },
  { label: '{{my_var}}', deskripsi: 'Variabel Lingkungan yang ditentukan pengguna' },
];

/**
 * Mencocokkan jalur permintaan dengan pola rute
 * @param pola - Pola rute (misalnya '/users/:id')
 * @param jalurPermintaan - Jalur permintaan aktual
 * @returns Hasil pencocokan termasuk parameter yang diekstrak
 *
 * @logikaPencocokan
 * 1. Mendukung parameter dinamis (:id)
 * 2. Mendukung parameter opsional (:id?)
 * 3. Mendukung wildcard satu segmen (*)
 * 4. Mendukung wildcard akhir (*) untuk menangkap sisa jalur
 * 5. Mengembalikan parameter yang diekstrak dalam objek
 */
export const cocokkanRute = (pola: string, jalurPermintaan: string): HasilPencocokanRute => {
  // Normalisasi jalur (hapus slash di akhir, pastikan tidak ada multiple slashes)
  const jalurBersih = jalurPermintaan.split('?')[0].replace(/\/+$/, '');
  const polaBersih = pola.replace(/\/+$/, '');

  const segmenPola = polaBersih.split('/').filter(Boolean);
  const segmenJalur = jalurBersih.split('/').filter(Boolean);
  const parameter: Record<string, string | undefined> = {};

  // Pendekatan dua pointer untuk mendukung parameter opsional, wildcard tunggal,
  // dan wildcard akhir yang mencocokkan sisa jalur.
  let p = 0; // indeks di segmenPola
  let i = 0; // indeks di segmenJalur

  while (p < segmenPola.length) {
    const segmen = segmenPola[p];

    // Wildcard akhir: cocokkan sisanya
    if (segmen === '*' && p === segmenPola.length - 1) {
      // tangkap sisanya sebagai parameter wildcard jika diinginkan;
      // di sini kita hanya mencocokkan
      return { cocok: true, parameter };
    }

    const segmenJalurSaatIni = segmenJalur[i];

    // Jika kita kehabisan segmen jalur
    if (segmenJalurSaatIni === undefined) {
      // Segmen masih bisa cocok jika itu parameter opsional seperti ':id?'
      if (segmen.startsWith(':') && segmen.endsWith('?')) {
        const namaParameter = segmen.substring(1, segmen.length - 1);
        parameter[namaParameter] = undefined;
        p++;
        continue;
      }
      // jika tidak, tidak cocok
      return { cocok: false, parameter: {} };
    }

    if (segmen === '*') {
      // wildcard satu segmen
      p++;
      i++;
      continue;
    }

    if (segmen.startsWith(':')) {
      const adalahOpsional = segmen.endsWith('?');
      const namaParameter = adalahOpsional ? segmen.substring(1, segmen.length - 1) : segmen.substring(1);
      parameter[namaParameter] = segmenJalurSaatIni;
      p++;
      i++;
      continue;
    }

    // pencocokan eksak
    if (segmen === segmenJalurSaatIni) {
      p++;
      i++;
      continue;
    }

    // tidak cocok
    return { cocok: false, parameter: {} };
  }

  // Hanya cocok jika semua segmen jalur telah dikonsumsi
  if (i !== segmenJalur.length) {
    return { cocok: false, parameter: {} };
  }

  return { cocok: true, parameter };
};

/**
 * Memeriksa apakah dua pola rute mungkin konflik (yaitu, ada setidaknya satu jalur
 * yang akan dicocokkan oleh kedua pola). Ini adalah pemeriksaan konservatif yang digunakan
 * oleh editor untuk mencegah penyimpanan rute yang tumpang tindih.
 *
 * @param polaA - Pola rute pertama
 * @param polaB - Pola rute kedua
 * @returns boolean - true jika ada kemungkinan konflik
 */
export const apakahPolaBerkonflik = (polaA: string, polaB: string): boolean => {
  const bersihkan = (s: string) => s.replace(/\/+$/g, '').split('/').filter(Boolean);
  const segmenA = bersihkan(polaA);
  const segmenB = bersihkan(polaB);

  // Pemeriksaan kesetaraan cepat
  if (polaA.trim().toLowerCase() === polaB.trim().toLowerCase()) return true;

  const BATAS_PENCOCOKAN = 10; // batas wajar untuk eksplorasi panjang jalur

  const hitungPanjangMinimal = (segmen: string[]) => segmen.filter(s => !(s.startsWith(':') && s.endsWith('?'))).length;
  const memilikiWildcardAkhir = (segmen: string[]) => segmen.length > 0 && segmen[segmen.length - 1] === '*';
  const hitungPanjangMaksimal = (segmen: string[]) => memilikiWildcardAkhir(segmen) ? BATAS_PENCOCOKAN : segmen.length;

  const panjangMinimalA = hitungPanjangMinimal(segmenA);
  const panjangMinimalB = hitungPanjangMinimal(segmenB);
  const panjangMaksimalA = hitungPanjangMaksimal(segmenA);
  const panjangMaksimalB = hitungPanjangMaksimal(segmenB);

  const mulai = Math.max(panjangMinimalA, panjangMinimalB);
  const akhir = Math.min(panjangMaksimalA, panjangMaksimalB);
  const indeksWildcardAkhirA = memilikiWildcardAkhir(segmenA) ? segmenA.length - 1 : -1;
  const indeksWildcardAkhirB = memilikiWildcardAkhir(segmenB) ? segmenB.length - 1 : -1;

  for (let n = mulai; n <= akhir; n++) {
    let oke = true;

    for (let i = 0; i < n; i++) {
      const segmenAA = segmenA[i];
      const segmenBB = segmenB[i];

      const segmenAAdalahWildcardAkhir = segmenAA === '*' && i === segmenA.length - 1;
      const segmenBBAdalahWildcardAkhir = segmenBB === '*' && i === segmenB.length - 1;

      const segmenAAAda = segmenAA !== undefined && !segmenAAdalahWildcardAkhir;
      const segmenBBAda = segmenBB !== undefined && !segmenBBAdalahWildcardAkhir;

      // Jika segmen di A tidak terdefinisi
      if (!segmenAAAda) {
        // Jika A memiliki wildcard akhir lebih awal, itu dapat menyerap segmen yang tersisa
        if (indeksWildcardAkhirA >= 0 && indeksWildcardAkhirA <= i) {
          // oke, wildcard di akhir A mencakup posisi ini
        } else if (segmenAAdalahWildcardAkhir) {
          // wildcard di akhir A dapat mencocokkan segmen yang tersisa
        } else {
          oke = false;
          break;
        }
      }

      if (!segmenBBAda) {
        if (indeksWildcardAkhirB >= 0 && indeksWildcardAkhirB <= i) {
          // oke, wildcard di akhir B mencakup posisi ini
        } else if (segmenBBAdalahWildcardAkhir) {
          // wildcard di akhir B
        } else {
          oke = false;
          break;
        }
      }

      // Perlakukan wildcard akhir yang lebih awal sebagai '*' yang efektif untuk pencocokan
      const segmenAAEfektif = (indeksWildcardAkhirA >= 0 && indeksWildcardAkhirA <= i) ? '*' : segmenAA;
      const segmenBBEfektif = (indeksWildcardAkhirB >= 0 && indeksWildcardAkhirB <= i) ? '*' : segmenBB;

      // Jika salah satunya adalah wildcard sisa di posisi ini, posisi ini dapat dicocokkan
      if (segmenAAdalahWildcardAkhir || segmenBBAdalahWildcardAkhir) continue;

      // Jika salah satunya adalah wildcard tunggal '*', itu baik-baik saja
      if (segmenAAEfektif === '*' || segmenBBEfektif === '*') continue;

      // Jika salah satunya adalah parameter (termasuk opsional), itu baik-baik saja
      if ((segmenAAEfektif && segmenAAEfektif.startsWith(':')) || (segmenBBEfektif && segmenBBEfektif.startsWith(':'))) continue;

      // Kedua literal harus cocok untuk kompatibel di posisi ini
      if (segmenAAEfektif !== segmenBBEfektif) {
        oke = false;
        break;
      }
    }

    if (oke) return true;
  }

  return false;
};

/**
 * Generator untuk variabel dinamis sistem
 */
const generatorVariabel: Record<string, () => any> = {
  '$uuid': () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)),
  '$randomInt': () => Math.floor(Math.random() * 1000),
  '$timestamp': () => Date.now(),
  '$isoDate': () => new Date().toISOString(),
  '$randomName': () => {
    const daftarNama = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan'];
    return daftarNama[Math.floor(Math.random() * daftarNama.length)];
  },
  '$randomCity': () => {
    const daftarKota = ['New York', 'London', 'Tokyo', 'Jakarta', 'Berlin', 'Paris', 'Sydney'];
    return daftarKota[Math.floor(Math.random() * daftarKota.length)];
  },
  '$randomBool': () => Math.random() > 0.5,

  // Alias seperti Faker
  '$fakerName': () => generatorVariabel['$randomName'](),
  '$fakerCity': () => generatorVariabel['$randomCity'](),
};

/**
 * Memeriksa apakah karakter pada indeks tertentu berada di dalam tanda kutip
 * @param teks - Teks untuk diperiksa
 * @param indeks - Indeks karakter yang diperiksa
 * @returns boolean - true jika berada di dalam tanda kutip
 */
const apakahDiDalamTandaKutip = (teks: string, indeks: number): boolean => {
  // Pemeriksaan naif: hitung tanda kutip ganda yang tidak di-escape sebelum indeks
  let hitung = 0;
  for (let i = 0; i < indeks; i++) {
    if (teks[i] === '"') {
      // lewati yang di-escape
      if (i > 0 && teks[i - 1] === '\\') continue;
      hitung++;
    }
  }
  return (hitung % 2) === 1;
};

/**
 * Mengganti token dalam string dengan nilai yang sesuai
 * @param string - String yang akan diproses
 * @param tokenRegex - Regex untuk menemukan token
 * @param resolverToken - Fungsi untuk mengatasi nilai token
 * @returns String dengan token yang telah diganti
 */
const gantiTokenDalamString = (
  string: string,
  tokenRegex: RegExp,
  resolverToken: (token: string) => any
): string => {
  let keluaran = string;
  // hindari infinite loop; lakukan hingga 3 kali
  for (let iterasi = 0; iterasi < 3; iterasi++) {
    let berubah = false;

    keluaran = keluaran.replace(tokenRegex, (cocokan, token, offset) => {
      const nilai = resolverToken(token);
      if (nilai === undefined) return cocokan; // biarkan tidak berubah

      const diDalamKutip = apakahDiDalamTandaKutip(keluaran, offset);
      let pengganti: string;

      if (diDalamKutip) {
        if (typeof nilai === 'object') {
          pengganti = JSON.stringify(nilai);
        } else {
          pengganti = String(nilai);
        }
      } else {
        // tempatkan JSON mentah untuk objek/array/boolean/angka
        if (typeof nilai === 'object') {
          pengganti = JSON.stringify(nilai);
        } else if (typeof nilai === 'boolean') {
          pengganti = nilai ? 'true' : 'false';
        } else {
          pengganti = String(nilai);
        }
      }

      berubah = true;
      return pengganti;
    });

    if (!berubah) break;
  }

  return keluaran;
};

/**
 * Mengganti token dalam objek JSON secara rekursif
 * @param obj - Objek yang akan diproses
 * @param resolverToken - Fungsi untuk mengatasi nilai token
 * @returns Objek dengan token yang telah diganti
 */
const gantiTokenDalamObjek = (obj: any, resolverToken: (token: string) => any): any => {
  if (typeof obj === 'string') {
    // jika seluruh string tepat adalah token seperti "{{@body.name}}",
    // dan token mengembalikan nilai non-string, ganti dengan nilai bertipe
    const cocokan = obj.match(/^{{\s*([@$]?[^{}\s]+)\s*}}$/);
    if (cocokan) {
      const nilai = resolverToken(cocokan[1]);
      return nilai === undefined ? obj : nilai;
    }
    // jika tidak, lakukan penggantian inline dan kembalikan string
    return gantiTokenDalamString(obj, /{{\s*([@$]?[^{}\s]+)\s*}}/g, resolverToken);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => gantiTokenDalamObjek(item, resolverToken));
  }

  if (obj && typeof obj === 'object') {
    const kunci = Object.keys(obj);
    for (const kunciItem of kunci) {
      obj[kunciItem] = gantiTokenDalamObjek(obj[kunciItem], resolverToken);
    }
    return obj;
  }

  return obj;
};

/**
 * Memproses templat respons mock dengan menyuntikkan nilai dinamis
 * @param templatBadan - Templat badan respons
 * @param jalurPermintaan - Jalur permintaan
 * @param polaRute - Pola rute
 * @param variabelLingkungan - Variabel lingkungan yang ditentukan pengguna
 * @param badanPermintaan - Badan permintaan (opsional)
 * @returns Badan respons yang telah diproses
 *
 * @logikaPemrosesan
 * 1. Penyuntikan variabel lingkungan pengguna ({{key}})
 * 2. Penyuntikan parameter rute ({{@param.id}})
 * 3. Penyuntikan parameter kueri ({{@query.page}})
 * 4. Penyuntikan dari badan permintaan ({{@body.name}})
 * 5. Penggantian variabel sistem ({{$uuid}}, dll.)
 */
export const prosesResponsMock = (
  templatBadan: string,
  jalurPermintaan: string,
  polaRute: string,
  variabelLingkungan: EnvironmentVariable[] = [],
  badanPermintaan: string | null = null
): string => {
  let badanTerproses = templatBadan;

  // Coba parsing badan permintaan JSON jika ada
  let badanTerparse: unknown = null;
  if (badanPermintaan) {
    try {
      badanTerparse = JSON.parse(badanPermintaan) as unknown;
    } catch (errorParsing) {
      badanTerparse = null;
    }
  }

  // Helper debug: jika badanTerparse null tetapi badanPermintaan ada,
  // catat peringatan sehingga kita dapat melihat JSON yang tidak valid (hanya dev)
  if (badanPermintaan && badanTerparse === null) {
    if (import.meta.env?.DEV) {
      try {
        logger('mesinMock').warn('mesinMock: gagal memparsing badanPermintaan sebagai JSON', String(badanPermintaan).slice(0, 200));
      } catch (errorPencatatan) { }
    }
  }

  // 0. Penyuntikan Variabel Lingkungan (Ditentukan Pengguna)
  // Mengganti {{key}} dengan nilai
  variabelLingkungan.forEach(variabel => {
    // Escape karakter regex khusus dalam kunci jika ada
    const kunciTerescape = variabel.kunci.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${kunciTerescape}}}`, 'g');
    badanTerproses = badanTerproses.replace(regex, variabel.nilai);
  });

  // 1. Penyuntikan Parameter Rute
  // Contoh: Pola /users/:id, Permintaan /users/123 -> Suntikkan {{@param.id}} dengan 123
  const [jalurBersih, stringKueri] = jalurPermintaan.split('?');
  const segmenPola = polaRute.split('/').filter(Boolean);
  const segmenJalur = jalurBersih.split('/').filter(Boolean);

  segmenPola.forEach((segmen, indeks) => {
    if (segmen.startsWith(':') && segmenJalur[indeks]) {
      const namaParameter = segmen.substring(1); // hapus :
      const nilaiParameter = segmenJalur[indeks];
      const regex = new RegExp(`{{@param.${namaParameter}}}`, 'g');
      badanTerproses = badanTerproses.replace(regex, nilaiParameter);
    }
  });

  // 2. Penyuntikan Parameter Kueri
  // Contoh: Permintaan /users?page=2&sort=asc -> Suntikkan {{@query.page}} dengan 2
  if (stringKueri) {
    const parameter = new URLSearchParams(stringKueri);
    parameter.forEach((nilai, kunci) => {
      const regex = new RegExp(`{{@query.${kunci}}}`, 'g');
      badanTerproses = badanTerproses.replace(regex, nilai);
    });
  }

  // 3. Penyuntikan Badan Permintaan
  // Memungkinkan placeholder seperti {{@body.name}} diganti dengan nilai dari badan JSON
  if (badanTerparse && typeof badanTerparse === 'object') {
    const jelajahiObjek = (obj: Record<string, unknown>, prefiks = '') => {
      Object.keys(obj).forEach(kunci => {
        const nilai = obj[kunci];
        const placeholder = `{{@body${prefiks}.${kunci}}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const pengganti = (nilai === undefined || nilai === null) ? '' : String(nilai);
        badanTerproses = badanTerproses.replace(regex, pengganti);

        if (typeof nilai === 'object' && nilai !== null) {
          jelajahiObjek(nilai as Record<string, unknown>, `${prefiks}.${kunci}`);
        }
      });
    };
    jelajahiObjek(badanTerparse as Record<string, unknown>, '');
  }

  // 4. Penggantian Variabel Dinamis (Sistem)
  const regexToken = /{{\s*([@$]?[^{}\s]+)\s*}}/g;

  // Pra-hitung parameter rute untuk token @param.*
  const hasilPencocokanRute = cocokkanRute(polaRute, jalurPermintaan);
  const parameterRute = hasilPencocokanRute.parameter || {};

  const selesaikanToken = (token: string) => {
    // contoh token: $uuid, @param.id, @query.page, @body.user.name, my_var
    if (token.startsWith('$')) {
      return generatorVariabel[token] ? generatorVariabel[token]() : undefined;
    }

    if (token.startsWith('@')) {
      const bagian = token.substring(1).split('.');
      const namespace = bagian[0];
      const sisanya = bagian.slice(1);

      if (namespace === 'param') {
        return sisanya.length ? parameterRute[sisanya.join('.')] : undefined;
      }

      if (namespace === 'query') {
        const nilai = new URLSearchParams(stringKueri || '').get(sisanya.join('.'));
        return nilai;
      }

      if (namespace === 'body') {
        // jelajahi badanTerparse
        let penunjuk: any = badanTerparse;
        for (const bagianDalam of sisanya) {
          if (!penunjuk || typeof penunjuk !== 'object') return undefined;
          penunjuk = (penunjuk as any)[bagianDalam];
        }
        return penunjuk;
      }

      return undefined;
    }

    // variabel lingkungan dari array variabelLingkungan
    const variabel = variabelLingkungan.find(e => e.kunci === token);
    return variabel ? variabel.nilai : undefined;
  };

  // Terapkan penggantian dengan hati-hati tergantung apakah badanTerproses adalah teks JSON atau teks biasa
  // Coba parsing; jika parsing gagal, jalankan penggantian token pada string (dengan kesadaran dalam-tanda-kutip)
  try {
    const kemungkinanJson = JSON.parse(badanTerproses);
    const diganti = gantiTokenDalamObjek(kemungkinanJson, selesaikanToken);
    badanTerproses = JSON.stringify(diganti, null, 2);
  } catch (errorParsing) {
    // bukan JSON -> ganti token dalam templat string
    badanTerproses = gantiTokenDalamString(badanTerproses, regexToken, selesaikanToken);
  }

  return badanTerproses;
};

/**
 * Logika inti yang bertindak sebagai "Server" untuk mensimulasikan permintaan HTTP
 * @param method - Metode HTTP (GET, POST, dll.)
 * @param url - URL permintaan
 * @param header - Header permintaan
 * @param badan - Badan permintaan
 * @param mock - Daftar endpoint mock yang tersedia
 * @param variabelLingkungan - Variabel lingkungan (BARU)
 * @returns Hasil simulasi permintaan
 *
 * @logikaSimulasi
 * 1. Mencari endpoint mock yang cocok dengan metode dan jalur
 * 2. Memeriksa autentikasi jika dikonfigurasi
 * 3. Menangani proxy/passthrough jika diaktifkan
 * 4. Menangani logika stateful (CRUD database) jika ada storeName
 * 5. Memproses respons dinamis dengan variabel
 * 6. Mengembalikan respons dengan header dan penundaan yang sesuai
 */
export const simulasiPermintaan = async (
  method: string,
  url: string,
  header: Record<string, string>,
  badan: string,
  mock: MockEndpoint[],
  variabelLingkungan: EnvironmentVariable[] = []
): Promise<HasilSimulasi> => {
  const objekUrl = new URL(url);
  const namaJalur = objekUrl.pathname;
  const metodeUpper = String(method || '').toUpperCase();

  let mockYangCocok: MockEndpoint | null = null;
  let parameterUrl: Record<string, string | undefined> = {};

  // Cari rute yang cocok
  for (const m of mock) {
    if (m.isActive && String(m.metode).toUpperCase() === metodeUpper) {
      const hasil = cocokkanRute(m.path, namaJalur);
      if (hasil.cocok) {
        mockYangCocok = m;
        parameterUrl = hasil.parameter;
        break;
      }
    }
  }

  if (!mockYangCocok) {
    return {
      respons: {
        status: 404,
        badan: JSON.stringify(
          { error: "Tidak Ditemukan", message: `Tidak ada rute aktif yang ditemukan untuk ${method} ${namaJalur}` },
          null, 2
        ),
        header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
        penundaan: 50
      }
    };
  }

  // --- PEMERIKSAAN KEAMANAN & AUTENTIKASI ---
  if (mockYangCocok.authConfig && mockYangCocok.authConfig.jenis !== 'NONE') {
    const auth = mockYangCocok.authConfig;
    const headerPermintaanLower = Object.keys(header).reduce((akumulator, kunci) => {
      akumulator[kunci.toLowerCase()] = header[kunci];
      return akumulator;
    }, {} as Record<string, string>);

    let terotorisasi = false;

    if (auth.jenis === 'BEARER_TOKEN') {
      const headerAuth = headerPermintaanLower['authorization'] || '';
      if (headerAuth.startsWith('Bearer ') && headerAuth.substring(7) === auth.token) {
        terotorisasi = true;
      }
    } else if (auth.jenis === 'API_KEY') {
      const kunciHeader = (auth.headerKey || 'x-api-key').toLowerCase();
      const kunciApi = headerPermintaanLower[kunciHeader];
      if (kunciApi === auth.token) {
        terotorisasi = true;
      }
    }

    if (!terotorisasi) {
      return {
        respons: {
          status: 401,
          badan: JSON.stringify(
            { error: "Tidak Terotorisasi", message: "Kredensial autentikasi tidak valid atau tidak ada" },
            null, 2
          ),
          header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
          penundaan: mockYangCocok.delay
        },
        idMockYangCocok: mockYangCocok.id
      };
    }
  }

  // --- PROXY / PASSTHROUGH ---
  if (mockYangCocok.proxy && mockYangCocok.proxy.enabled && mockYangCocok.proxy.target) {
    try {
      const targetProxy = mockYangCocok.proxy.target.replace(/\/+$/g, '');

      // Validasi dasar: hanya izinkan skema http(s) dan blokir host lokal/pribadi yang diketahui
      try {
        const urlTarget = new URL(targetProxy);
        const skema = urlTarget.protocol.replace(':', '').toLowerCase();
        const namaHost = urlTarget.hostname;

        // Hanya izinkan http atau https
        if (skema !== 'http' && skema !== 'https') {
          return {
            respons: {
              status: 400,
              badan: JSON.stringify(
                { error: 'Target Proxy Tidak Valid', message: 'Hanya target proxy http(s) yang diizinkan' },
                null, 2
              ),
              header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
              penundaan: mockYangCocok.delay,
            },
            idMockYangCocok: mockYangCocok.id,
          };
        }

        // Larang hostname lokal umum dan rentang IP (pemeriksaan yang ditingkatkan)
        const namaHostLower = namaHost.toLowerCase();
        const adalahIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(namaHostLower);
        const adalahIpv6 = /^[0-9a-f:]+$/.test(namaHostLower);

        const adalahIpv4Pribadi = adalahIpv4 && (() => {
          const bagian = namaHostLower.split('.').map(Number);
          if (bagian[0] === 10) return true; // 10/8
          if (bagian[0] === 172 && bagian[1] >= 16 && bagian[1] <= 31) return true; // 172.16/12
          if (bagian[0] === 192 && bagian[1] === 168) return true; // 192.168/16
          if (bagian[0] === 169 && bagian[1] === 254) return true; // link-local
          if (bagian[0] === 127) return true; // loopback
          return false;
        })();

        const adalahIpv6Pribadi = adalahIpv6 && (() => {
          // IPv6 loopback ::1, unique local fc00::/7, link-local fe80::/10
          if (namaHostLower === '::1') return true;
          if (namaHostLower.startsWith('fe80:')) return true;
          if (namaHostLower.startsWith('fc') || namaHostLower.startsWith('fd')) return true;
          return false;
        })();

        const memilikiAkhiranLokal = namaHostLower === 'localhost' || namaHostLower.endsWith('.local');

        if ((adalahIpv4 && adalahIpv4Pribadi) || (adalahIpv6 && adalahIpv6Pribadi) || memilikiAkhiranLokal) {
          return {
            respons: {
              status: 400,
              badan: JSON.stringify(
                { error: 'Target Proxy Tidak Valid', message: 'Target proxy mengarah ke alamat lokal/pribadi yang tidak diizinkan' },
                null, 2
              ),
              header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
              penundaan: mockYangCocok.delay,
            },
            idMockYangCocok: mockYangCocok.id,
          };
        }
      } catch (errorValidasi) {
        return {
          respons: {
            status: 400,
            badan: JSON.stringify(
              { error: 'Target Proxy Tidak Valid', message: 'Target proxy bukan URL yang valid' },
              null, 2
            ),
            header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
            penundaan: mockYangCocok.delay,
          },
          idMockYangCocok: mockYangCocok.id,
        };
      }

      const objekUrl = new URL(url);
      const urlProxy = targetProxy + objekUrl.pathname + (objekUrl.search || '');

      // Siapkan header untuk permintaan proxy (teruskan header yang ada)
      const headerProxy: Record<string, string> = { ...header };

      // Gunakan AbortController untuk timeout
      const controller = new AbortController();
      const timeout = typeof mockYangCocok.proxy.timeout === 'number' ? mockYangCocok.proxy.timeout : 5000;
      const idTimeout = setTimeout(() => controller.abort(), timeout);

      const responsFetch = await fetch(urlProxy, {
        method,
        headers: headerProxy,
        body: badan || undefined,
        signal: controller.signal,
      });

      clearTimeout(idTimeout);

      // Baca badan respons sebagai teks
      const badanProxy = await responsFetch.text();

      // Konversi header ke array
      const arrayHeaderAkhir: { kunci: string; nilai: string }[] = [];
      try {
        if (responsFetch.headers && typeof responsFetch.headers.forEach === 'function') {
          responsFetch.headers.forEach((nilai, kunci) => arrayHeaderAkhir.push({ kunci, nilai: String(nilai) }));
        }
      } catch (errorKonversi) {
        // abaikan error konversi header
      }

      return {
        respons: {
          status: responsFetch.status || 200,
          badan: badanProxy,
          header: arrayHeaderAkhir,
          penundaan: mockYangCocok.delay,
        },
        idMockYangCocok: mockYangCocok.id,
      };
    } catch (errorProxy: any) {
      // Jika gagal, baik fallback ke mock lokal atau kembalikan 502
      if (mockYangCocok.proxy.fallbackToMock) {
        // lanjutkan ke penanganan mock
      } else {
        return {
          respons: {
            status: 502,
            badan: JSON.stringify(
              { error: 'Bad Gateway', message: String(errorProxy.message || errorProxy) },
              null, 2
            ),
            header: [{ kunci: 'Content-Type', nilai: 'application/json' }],
            penundaan: mockYangCocok.delay,
          },
          idMockYangCocok: mockYangCocok.id,
        };
      }
    }
  }

  let badanDinamis = "";
  let statusAkhir = mockYangCocok.statusCode;

  // -- LOGIKA STATEFUL MULAI --
  if (mockYangCocok.storeName) {
    const koleksi = mockYangCocok.storeName;

    // GET
    if (metodeUpper === HttpMethod.GET) {
      const kunciParameter = Object.keys(parameterUrl);
      if (kunciParameter.length > 0) {
        const id = (parameterUrl as any)[kunciParameter[0]];
        const item = layananDatabase.temukan(koleksi, id);
        if (item) {
          badanDinamis = JSON.stringify(item, null, 2);
        } else {
          statusAkhir = 404;
          badanDinamis = JSON.stringify({ error: "Item tidak ditemukan" }, null, 2);
        }
      } else {
        const daftar = layananDatabase.dapatkanKoleksi(koleksi);
        badanDinamis = JSON.stringify(daftar, null, 2);
      }
    }
    // POST
    else if (metodeUpper === HttpMethod.POST) {
      try {
        const payload = badan ? JSON.parse(badan) : {};
        const itemBaru = layananDatabase.sisipkan(koleksi, payload);
        badanDinamis = JSON.stringify(itemBaru, null, 2);
      } catch (errorParsing) {
        statusAkhir = 400;
        badanDinamis = JSON.stringify({ error: "Badan JSON tidak valid" }, null, 2);
      }
    }
    // PUT / PATCH
    else if (metodeUpper === HttpMethod.PUT || metodeUpper === HttpMethod.PATCH) {
      const kunciParameter = Object.keys(parameterUrl);
      if (kunciParameter.length > 0) {
        const id = (parameterUrl as any)[kunciParameter[0]];
        try {
          const payload = badan ? JSON.parse(badan) : {};
          const diperbarui = layananDatabase.perbarui(koleksi, id, payload);
          if (diperbarui) {
            badanDinamis = JSON.stringify(diperbarui, null, 2);
          } else {
            statusAkhir = 404;
            badanDinamis = JSON.stringify({ error: "Item tidak ditemukan untuk diperbarui" }, null, 2);
          }
        } catch (errorParsing) {
          statusAkhir = 400;
          badanDinamis = JSON.stringify({ error: "Badan JSON tidak valid" }, null, 2);
        }
      } else {
        statusAkhir = 400;
        badanDinamis = JSON.stringify({ error: "Parameter ID tidak ada di URL" }, null, 2);
      }
    }
    // DELETE
    else if (metodeUpper === HttpMethod.DELETE) {
      const kunciParameter = Object.keys(parameterUrl);
      if (kunciParameter.length > 0) {
        const id = (parameterUrl as any)[kunciParameter[0]];
        const dihapus = layananDatabase.hapus(koleksi, id);
        if (dihapus) {
          statusAkhir = 200;
          badanDinamis = JSON.stringify({ success: true, message: "Item dihapus" }, null, 2);
        } else {
          statusAkhir = 404;
          badanDinamis = JSON.stringify({ error: "Item tidak ditemukan" }, null, 2);
        }
      } else {
        statusAkhir = 400;
        badanDinamis = JSON.stringify({ error: "Parameter ID tidak ada di URL" }, null, 2);
      }
    }
  }
  // -- LOGIKA STATELESS --
  else {
    // Kirim variabelLingkungan ke prosesor
    // Gunakan jalur lengkap dengan kueri untuk mengaktifkan penyuntikan {{@query.*}}
    const jalurPermintaanDenganKueri = objekUrl.pathname + (objekUrl.search || '');
    badanDinamis = prosesResponsMock(
      mockYangCocok.responseBody,
      jalurPermintaanDenganKueri,
      mockYangCocok.path,
      variabelLingkungan,
      badan
    );
  }

  // Gabungkan header dan tentukan Content-Type yang masuk akal ketika tidak disediakan oleh mock
  const tipeKontenYangAda = (mockYangCocok.headers || []).find(h => h.key.toLowerCase() === 'content-type');
  let tipeKontenTerduga = 'text/plain';
  try {
    JSON.parse(badanDinamis);
    tipeKontenTerduga = 'application/json';
  } catch (errorParsing) {
    tipeKontenTerduga = 'text/plain';
  }

  const headerAkhir = [
    ...(mockYangCocok.headers || []),
    // Hanya tambahkan Content-Type jika mock tidak menentukannya
    ...(tipeKontenYangAda ? [] : [{ key: 'Content-Type', value: tipeKontenTerduga }]),
    { key: 'X-Powered-By', value: 'BackendStudio' }
  ].map(h => ({ kunci: h.key, nilai: h.value }));

  return {
    respons: {
      status: statusAkhir,
      badan: badanDinamis,
      header: headerAkhir,
      penundaan: mockYangCocok.delay
    },
    idMockYangCocok: mockYangCocok.id
  };
};

/**
 * Ekspor konstanta bantuan untuk dokumentasi UI
 */
export { VARIABEL_SISTEM_BANTUAN as VARIABEL_BANTUAN };

// Backward-compatible English-shaped exports used by UI/older modules
export const MOCK_VARIABLES_HELP = VARIABEL_SISTEM_BANTUAN.map(v => ({ label: v.label, desc: v.deskripsi }));
export const patternsConflict = apakahPolaBerkonflik;
export const simulateRequest = simulasiPermintaan;
