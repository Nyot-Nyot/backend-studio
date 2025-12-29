/**
 * Utilitas untuk manajemen tema (light/dark mode) di aplikasi Backend Studio.
 * Menyediakan fungsi untuk menyimpan, mengambil, dan menerapkan preferensi tema pengguna.
 */

// ================================
// TIPE DATA DAN KONSTANTA
// ================================

/**
 * Nama tema yang didukung oleh aplikasi.
 * @type {'light' | 'dark'}
 */
export type NamaTema = 'light' | 'dark';

/**
 * Kunci untuk menyimpan preferensi tema di localStorage.
 * @constant {string}
 */
const KUNCI_PENYIMPANAN_TEMA = 'ui-theme';

/**
 * Nilai atribut data-theme yang valid untuk elemen HTML.
 * @type {NamaTema}
 */
type NilaiAtributTema = NamaTema | null;

// ================================
// FUNGSI UTILITAS PENYIMPANAN
// ================================

/**
 * Mengambil tema yang disimpan pengguna dari localStorage.
 * Mengembalikan null jika tidak ada tema yang disimpan atau terjadi error.
 *
 * @returns {NamaTema | null} Nama tema yang disimpan atau null
 *
 * @example
 * const temaTersimpan = dapatkanTemaTersimpan();
 * // Returns: 'dark', 'light', atau null
 */
export const dapatkanTemaTersimpan = (): NamaTema | null => {
  try {
    const temaDariPenyimpanan = localStorage.getItem(KUNCI_PENYIMPANAN_TEMA);

    // Validasi bahwa nilai yang disimpan adalah tema yang valid
    if (temaDariPenyimpanan === 'light' || temaDariPenyimpanan === 'dark') {
      return temaDariPenyimpanan as NamaTema;
    }

    return null;
  } catch (error) {
    // Silent fail: localStorage mungkin tidak tersedia (misal: di environment testing)
    console.warn('Gagal mengakses localStorage untuk tema:', error);
    return null;
  }
};

/**
 * Menyimpan preferensi tema pengguna ke localStorage.
 * Menangani error secara graceful jika localStorage tidak tersedia.
 *
 * @param {NamaTema} tema - Tema yang akan disimpan ('light' atau 'dark')
 *
 * @example
 * simpanTema('dark');
 */
export const simpanTema = (tema: NamaTema): void => {
  try {
    localStorage.setItem(KUNCI_PENYIMPANAN_TEMA, tema);
  } catch (error) {
    // Silent fail: jangan ganggu UX jika penyimpanan gagal
    console.warn('Gagal menyimpan tema ke localStorage:', error);
  }
};

// ================================
// FUNGSI UTILITAS PREFERENSI SISTEM
// ================================

/**
 * Mendeteksi apakah sistem operasi pengguna menggunakan mode gelap (dark mode).
 * Menggunakan prefers-color-scheme media query.
 *
 * @returns {boolean} true jika sistem menggunakan dark mode, false jika light mode
 *
 * @example
 * const sistemModeGelap = preferensiSistemModeGelap();
 * // Returns: true atau false
 */
export const preferensiSistemModeGelap = (): boolean => {
  try {
    // Periksa apakah window tersedia (untuk SSR/SSG)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (error) {
    // Fallback ke light mode jika terjadi error
    console.warn('Gagal mendeteksi preferensi tema sistem:', error);
    return false;
  }
};

/**
 * Mendapatkan tema berdasarkan preferensi sistem.
 *
 * @returns {NamaTema} 'dark' jika sistem menggunakan dark mode, 'light' jika tidak
 */
export const dapatkanTemaDariPreferensiSistem = (): NamaTema => {
  return preferensiSistemModeGelap() ? 'dark' : 'light';
};

// ================================
// FUNGSI UTILITAS PENERAPAN TEMA
// ================================

/**
 * Menerapkan tema ke elemen root (html) dokumen.
 * Menambahkan atribut data-theme untuk styling CSS.
 *
 * @param {NamaTema} tema - Tema yang akan diterapkan ('light' atau 'dark')
 *
 * @example
 * terapkanTema('dark');
 * // Menambahkan <html data-theme="dark"> ... </html>
 */
export const terapkanTema = (tema: NamaTema): void => {
  // Periksa apakah document tersedia (untuk SSR/SSG)
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  const elemenRoot = document.documentElement;

  // Hanya terapkan jika tema berbeda dengan yang saat ini
  const temaSaatIni = elemenRoot.getAttribute('data-theme');
  if (temaSaatIni !== tema) {
    elemenRoot.setAttribute('data-theme', tema);

    // Emit event kustom untuk komponen yang perlu merespons perubahan tema
    try {
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: { tema } }));
    } catch (error) {
      // Abaikan jika window tidak tersedia
    }
  }
};

/**
 * Menerapkan tema dan menyimpannya sekaligus.
 * Fungsi ini menggabungkan terapkanTema() dan simpanTema().
 *
 * @param {NamaTema} tema - Tema yang akan diterapkan dan disimpan
 *
 * @example
 * aturTema('light');
 */
export const aturTema = (tema: NamaTema): void => {
  terapkanTema(tema);
  simpanTema(tema);
};

// ================================
// FUNGSI UTILITAS LOGIKA TEMA
// ================================

/**
 * Menerapkan tema berdasarkan urutan prioritas:
 * 1. Tema yang disimpan pengguna (jika valid)
 * 2. Preferensi sistem (jika terdeteksi)
 * 3. Fallback ke light mode
 *
 * @returns {NamaTema} Tema yang berhasil diterapkan
 *
 * @example
 * const temaYangDiterapkan = terapkanTemaTersimpanAtauPreferensi();
 * // Returns: 'light' atau 'dark'
 */
export const terapkanTemaTersimpanAtauPreferensi = (): NamaTema => {
  // Coba gunakan tema yang disimpan pengguna
  const temaTersimpan = dapatkanTemaTersimpan();

  if (temaTersimpan === 'light' || temaTersimpan === 'dark') {
    terapkanTema(temaTersimpan);
    return temaTersimpan;
  }

  // Fallback ke preferensi sistem
  const temaDariSistem = dapatkanTemaDariPreferensiSistem();
  terapkanTema(temaDariSistem);
  return temaDariSistem;
};

/**
 * Mendapatkan tema yang sedang aktif di dokumen.
 *
 * @returns {NamaTema} Tema yang sedang aktif ('light' atau 'dark')
 *
 * @example
 * const temaSaatIni = dapatkanTemaSaatIni();
 * // Returns: 'light' atau 'dark'
 */
export const dapatkanTemaSaatIni = (): NamaTema => {
  if (typeof document === 'undefined' || !document.documentElement) {
    return 'light'; // Default untuk SSR
  }

  const temaDariAtribut = document.documentElement.getAttribute('data-theme') as NamaTema;

  // Validasi nilai atribut
  if (temaDariAtribut === 'light' || temaDariAtribut === 'dark') {
    return temaDariAtribut;
  }

  return 'light'; // Fallback default
};

/**
 * Mengganti tema antara light dan dark mode.
 * Mengembalikan tema baru yang diterapkan.
 *
 * @returns {NamaTema} Tema baru setelah toggle
 *
 * @example
 * const temaBaru = toggleTema();
 * // Jika sebelumnya 'light', returns: 'dark'
 */
export const toggleTema = (): NamaTema => {
  const temaSaatIni = dapatkanTemaSaatIni();
  const temaBerikutnya = temaSaatIni === 'dark' ? 'light' : 'dark';

  aturTema(temaBerikutnya);
  return temaBerikutnya;
};

/**
 * Mendengarkan perubahan preferensi tema sistem dan memperbarui tema secara otomatis.
 * Hanya jika pengguna belum menyimpan preferensi tema secara manual.
 *
 * @returns {Function} Fungsi untuk berhenti mendengarkan perubahan
 *
 * @example
 * const stopListening = dengarkanPerubahanPreferensiSistem();
 * // ... nanti
 * stopListening();
 */
export const dengarkanPerubahanPreferensiSistem = (): (() => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => { }; // No-op jika tidak didukung
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handlerPerubahanPreferensi = (event: MediaQueryListEvent) => {
    // Hanya terapkan perubahan jika pengguna belum menyimpan preferensi manual
    const temaTersimpan = dapatkanTemaTersimpan();
    if (!temaTersimpan) {
      const temaBaru = event.matches ? 'dark' : 'light';
      terapkanTema(temaBaru);
    }
  };

  // Untuk browser modern
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handlerPerubahanPreferensi);
    return () => mediaQuery.removeEventListener('change', handlerPerubahanPreferensi);
  }
  // Untuk browser lama (deprecated)
  else if (mediaQuery.addListener) {
    mediaQuery.addListener(handlerPerubahanPreferensi);
    return () => mediaQuery.removeListener(handlerPerubahanPreferensi);
  }

  return () => { }; // Fallback
};

// ================================
// INISIALISASI TEMA
// ================================

/**
 * Menginisialisasi tema saat aplikasi pertama kali dimuat.
 * Harus dipanggil sedini mungkin untuk menghindari flash of unstyled content (FOUC).
 *
 * @returns {NamaTema} Tema yang diterapkan
 *
 * @example
 * // Panggil di entry point aplikasi
 * const temaAwal = inisialisasiTema();
 */
export const inisialisasiTema = (): NamaTema => {
  return terapkanTemaTersimpanAtauPreferensi();
};
