// layananEmail.ts
// Layanan untuk mengirim email menggunakan EmailJS dengan dukungan lampiran

import emailjs from "@emailjs/browser";

/**
 * Tipe data untuk lampiran email
 */
export type Lampiran = {
  /** Nama file lampiran */
  nama: string;
  /** Tipe MIME file */
  mime: string;
  /** Data file dalam format base64 */
  b64: string
};

/**
 * Batasan ukuran lampiran (dalam bytes)
 */
const BATAS_UKURAN_PER_LAMPIRAN = 1_000_000; // 1MB per file
const BATAS_UKURAN_TOTAL_LAMPIRAN = 5_000_000; // 5MB total semua lampiran

/**
 * Konversi Blob ke string base64 dengan validasi ukuran
 * @param blob - Blob file yang akan dikonversi
 * @returns Promise yang mengembalikan string base64 (data URL)
 * @throws Error jika ukuran file melebihi batas
 *
 * @catatan
 * Hasil konversi berupa data URL dengan format: "data:application/json;base64,XXXXX"
 */
function konversiBlobKeBase64(blob: Blob): Promise<string> {
  if (blob.size > BATAS_UKURAN_PER_LAMPIRAN) {
    throw new Error(
      `Lampiran terlalu besar: ${blob.size} bytes (batas ${BATAS_UKURAN_PER_LAMPIRAN} bytes). ` +
      `Silakan gunakan file yang lebih kecil.`
    );
  }

  return new Promise((selesaikan, tolak) => {
    const pembaca = new FileReader();

    pembaca.onload = () => {
      const hasil = pembaca.result as string;
      selesaikan(hasil); // Mengembalikan data URL lengkap
    };

    pembaca.onerror = tolak;
    pembaca.readAsDataURL(blob);
  });
}

/**
 * Memeriksa apakah aplikasi berjalan dalam mode demo
 * @returns boolean - true jika dalam mode demo
 */
const periksaApakahModeDemo = (): boolean => {
  // Cek di lingkungan Vite (browser) atau Node.js
  if (typeof import.meta !== 'undefined' &&
    typeof (import.meta as any).env !== 'undefined' &&
    (import.meta as any).env.VITE_EMAILJS_DEMO === 'true') {
    return true;
  }

  if (process.env.VITE_EMAILJS_DEMO === 'true') {
    return true;
  }

  return false;
};

/**
 * Memvalidasi konfigurasi EmailJS yang diperlukan
 * @param idLayanan - ID layanan EmailJS
 * @param idTemplate - ID template EmailJS
 * @param kunciPublik - Kunci publik EmailJS
 * @throws Error jika ada konfigurasi yang tidak lengkap
 */
const validasiKonfigurasiEmailJS = (
  idLayanan: string,
  idTemplate: string,
  kunciPublik: string
): void => {
  const konfigurasiLengkap = idLayanan && idTemplate && kunciPublik;

  if (!konfigurasiLengkap) {
    throw new Error(
      "Konfigurasi EmailJS tidak ditemukan (VITE_EMAILJS_*). " +
      "Harap konfigurasi serviceId/templateId/publicKey, atau aktifkan mode demo untuk pengujian lokal."
    );
  }
};

/**
 * Menghitung total ukuran semua file lampiran
 * @param fileLampiran - Array file lampiran
 * @returns Total ukuran dalam bytes
 */
const hitungTotalUkuranLampiran = (
  fileLampiran: { nama: string; blob: Blob }[]
): number => {
  return fileLampiran.reduce(
    (total, file) => total + (file.blob.size || 0),
    0
  );
};

/**
 * Memproses semua lampiran menjadi format base64
 * @param fileLampiran - Array file lampiran mentah
 * @returns Promise yang mengembalikan array lampiran dalam format siap kirim
 */
const prosesSemuaLampiran = async (
  fileLampiran: { nama: string; blob: Blob }[]
): Promise<Lampiran[]> => {
  const hasilLampiran: Lampiran[] = [];

  for (const file of fileLampiran) {
    const dataUrl = await konversiBlobKeBase64(file.blob);

    hasilLampiran.push({
      nama: file.nama,
      mime: file.blob.type || "application/octet-stream",
      b64: dataUrl
    });
  }

  return hasilLampiran;
};

/**
 * Mengirim email menggunakan layanan EmailJS
 * @param idLayanan - ID layanan EmailJS
 * @param idTemplate - ID template EmailJS
 * @param kunciPublik - Kunci publik EmailJS
 * @param penerima - Daftar penerima email (dipisahkan koma, titik koma, atau spasi)
 * @param subjek - Subjek email
 * @param pesan - Isi pesan email
 * @param fileLampiran - Array file lampiran (default: array kosong)
 * @returns Promise yang mengembalikan respons dari EmailJS
 *
 * @throws Error dengan pesan yang sesuai jika:
 *   - Konfigurasi EmailJS tidak lengkap
 *   - Ukuran lampiran melebihi batas
 *   - Gagal mengirim email melalui EmailJS
 *
 * @contohPenggunaan
 * ```
 * await kirimEmailMelaluiEmailJS(
 *   'service_abc',
 *   'template_xyz',
 *   'public_key_123',
 *   'user@example.com',
 *   'Subjek Penting',
 *   'Isi pesan email',
 *   [{ nama: 'laporan.pdf', blob: fileBlob }]
 * );
 * ```
 *
 * @catatanModeDemo
 * Dalam mode demo, email tidak benar-benar dikirim. Fungsi ini hanya mencatat informasi
 * (jumlah penerima, jumlah lampiran, total ukuran) ke console dan mengembalikan respons simulasi.
 * Mode demo diaktifkan dengan mengatur VITE_EMAILJS_DEMO=true di environment.
 */
export async function kirimEmailMelaluiEmailJS(
  idLayanan: string,
  idTemplate: string,
  kunciPublik: string,
  penerima: string,
  subjek: string,
  pesan: string,
  fileLampiran: { nama: string; blob: Blob }[] = []
) {
  // Mode demo: memungkinkan pengujian di lingkungan pengembangan tanpa kredensial EmailJS asli
  const modeDemo = periksaApakahModeDemo();

  if (modeDemo) {
    // Hindari pencatatan informasi sensitif seperti daftar penerima lengkap atau data lampiran.
    // Hanya catat jumlah dan total ukuran sehingga pengembang dapat memvalidasi perilaku tanpa kebocoran data.
    const totalUkuran = hitungTotalUkuranLampiran(fileLampiran);
    const jumlahPenerima = penerima ? penerima.split(/[;,\s]+/).filter(Boolean).length : 0;

    // Simulasi penundaan jaringan
    await new Promise((selesaikan) => setTimeout(selesaikan, 500));

    console.info(
      '[layananEmail] Pengiriman demo: ',
      `jumlah_penerima=${jumlahPenerima}, `,
      `jumlah_lampiran=${fileLampiran.length}, `,
      `total_ukuran_lampiran=${totalUkuran}`
    );

    return { status: 'demo', ok: true } as any;
  }

  // Validasi konfigurasi EmailJS
  validasiKonfigurasiEmailJS(idLayanan, idTemplate, kunciPublik);

  // Terapkan batasan ukuran total lampiran sejak awal
  const totalUkuran = hitungTotalUkuranLampiran(fileLampiran);

  if (totalUkuran > BATAS_UKURAN_TOTAL_LAMPIRAN) {
    throw new Error(
      `Total ukuran lampiran terlalu besar: ${totalUkuran} bytes ` +
      `(batas ${BATAS_UKURAN_TOTAL_LAMPIRAN} bytes). ` +
      `Kurangi ukuran lampiran atau jumlah lampiran.`
    );
  }

  // Proses semua lampiran ke format base64
  const lampiran = await prosesSemuaLampiran(fileLampiran);

  // Siapkan parameter template. Template EmailJS dapat mengakses variabel ini.
  const parameterTemplate = {
    to_email: penerima,
    subject: subjek,
    message: pesan,
    attachments: JSON.stringify(lampiran),
  };

  try {
    const respons = await emailjs.send(
      idLayanan,
      idTemplate,
      parameterTemplate,
      kunciPublik
    );

    return respons;
  } catch (error: any) {
    // Normalisasi error untuk konsumsi pengguna
    const pesanError = error?.text || error?.message || "Gagal mengirim email";
    throw new Error(pesanError);
  }
}

// Backward-compatible English alias
export const sendEmailViaEmailJS = kirimEmailMelaluiEmailJS;
