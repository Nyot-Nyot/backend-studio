// utils/jsonHighlighter.ts
// Pencatat sintaks JSON ringan dan aman yang menghasilkan HTML dengan kelas span untuk penataan gaya.
// Menjaga string tetap utuh (menangani kutipan yang di-escape), angka, boolean, dan null.

/**
 * Meloloskan karakter khusus HTML untuk mencegah injeksi HTML
 * @param teksTidakAman - Teks yang mungkin mengandung karakter HTML berbahaya
 * @returns Teks yang sudah diloloskan dengan aman
 */
const loloskanHtml = (teksTidakAman: string): string => {
  const penggantianKarakter: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  return teksTidakAman.replace(/[&<>]/g, (karakter) => penggantianKarakter[karakter]);
};

/**
 * Pola regex untuk mencocokkan token-token JSON
 * - String (dengan escape) diikuti opsional oleh titik dua (untuk kunci)
 * - Boolean (true/false) dan null sebagai kata utuh
 * - Angka (termasuk desimal dan notasi ilmiah)
 */
const POLA_TOKEN_JSON = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g;

/**
 * Memproses teks dan menambahkan kelas CSS untuk penyorotan sintaks
 * @param teksSumber - Teks JSON yang akan diproses
 * @returns HTML dengan span yang memiliki kelas untuk penataan gaya
 */
const prosesTeksDanTambahkanSintaks = (teksSumber: string): string => {
  // Pertama, loloskan semua karakter HTML untuk keamanan
  const teksTerloloskan = loloskanHtml(teksSumber);

  // Ganti setiap token yang cocok dengan span yang memiliki kelas CSS
  return teksTerloloskan.replace(
    POLA_TOKEN_JSON,
    (tokenYangCocok: string): string => {
      // Tentukan kelas CSS berdasarkan jenis token
      let kelasCss = 'text-slate-400'; // Nilai default untuk berjaga-jaga

      const adalahString = tokenYangCocok.startsWith('"');
      const adalahKunci = /\"\s*:$/.test(tokenYangCocok);
      const adalahBoolean = /true|false/.test(tokenYangCocok);
      const adalahNull = tokenYangCocok === 'null';
      const adalahAngka = /^-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?$/.test(tokenYangCocok);

      if (adalahString) {
        if (adalahKunci) {
          // String yang diikuti titik dua adalah kunci JSON
          kelasCss = 'text-sky-300 font-bold';
        } else {
          // String tanpa titik dua adalah nilai string
          kelasCss = 'text-emerald-300';
        }
      } else if (adalahBoolean) {
        kelasCss = 'text-rose-300 font-bold';
      } else if (adalahNull) {
        kelasCss = 'text-slate-500 italic';
      } else if (adalahAngka) {
        kelasCss = 'text-amber-300';
      }
      // Jika tidak ada yang cocok, gunakan kelas default

      return `<span class="${kelasCss}">${tokenYangCocok}</span>`;
    }
  );
};

/**
 * Menyoroti teks JSON dengan menambahkan kelas CSS untuk penataan gaya visual
 * @param masukan - String JSON yang akan disorot
 * @returns HTML dengan span yang memiliki kelas untuk penataan gaya
 *
 * @contohPenggunaan
 * ```
 * const json = '{"nama": "Budi", "umur": 25}';
 * const html = highlightJson(json);
 * // Hasil: <span class="text-sky-300 font-bold">"nama"</span>: <span class="text-emerald-300">"Budi"</span>, ...
 * ```
 */
export const highlightJson = (masukan: string): string => {
  try {
    // Coba parse JSON untuk memastikan validitas dan melakukan format ulang
    const jsonYangSudahDiParse = JSON.parse(masukan);
    const jsonYangSudahDiformat = JSON.stringify(jsonYangSudahDiParse, null, 2);
    return prosesTeksDanTambahkanSintaks(jsonYangSudahDiformat);
  } catch (errorParsing) {
    // Jika JSON tidak valid, tetap coba soroti token yang mungkin ada
    // Pendekatan ini berguna untuk menampilkan JSON yang sebagian atau sedang diketik
    return prosesTeksDanTambahkanSintaks(masukan);
  }
};
