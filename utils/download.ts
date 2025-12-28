/**
 * unduhBlob - memicu unduhan file di browser dan membersihkan ObjectURL.
 *
 * Mengapa: menghindari duplikasi pembuatan <a>, klik, dan revoke di banyak handler.
 * Kontrak: menerima Blob atau string data yang telah dibungkus sebagai Blob, dan nama berkas.
 * Contoh penggunaan:
 *   unduhBlob(new Blob([jsonString], { type: 'application/json' }), 'backup.json')
 */
export function unduhBlob(blob: Blob, namaBerkas: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = namaBerkas;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Pastikan URL dibersihkan agar tidak bocor memori
  URL.revokeObjectURL(url);
}
