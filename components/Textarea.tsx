// Textarea.tsx
import React from "react";

/**
 * Properti untuk komponen Textarea
 * Meng-extend properti dasar HTML textarea element dan menambahkan fitur khusus
 */
interface PropertiTextarea extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	/**
	 * Label untuk textarea
	 * Jika disediakan, akan menampilkan label di atas textarea
	 */
	label?: string;

	/**
	 * Pesan error untuk validasi textarea
	 * Jika disediakan, akan menampilkan pesan error di bawah textarea
	 */
	error?: string | null;

	/**
	 * ID unik untuk textarea element
	 * Jika tidak disediakan, akan di-generate otomatis dari label
	 */
	id?: string;

	/**
	 * Kelas CSS tambahan untuk kustomisasi
	 * Akan digabungkan dengan kelas dasar textarea
	 */
	className?: string;
}

/**
 * Komponen Textarea yang dapat digunakan kembali (reusable)
 * Mendukung label, error handling, dan properti HTML textarea standar
 *
 * Fitur:
 * - Label opsional dengan htmlFor yang otomatis terhubung
 * - Validasi dengan pesan error yang jelas
 * - ID otomatis dari label jika tidak disediakan
 * - Mendukung semua properti HTML textarea standar
 * - Aksesibilitas: label yang terhubung dengan benar, error yang dapat diakses
 *
 * Contoh penggunaan:
 * ```
 * // Textarea dengan label
 * <Textarea
 *   label="Deskripsi Produk"
 *   placeholder="Masukkan deskripsi lengkap produk"
 *   value={deskripsi}
 *   onChange={(e) => setDeskripsi(e.target.value)}
 *   rows={5}
 * />
 *
 * // Textarea dengan validasi error
 * <Textarea
 *   label="Komentar"
 *   error={errors.komentar}
 *   value={komentar}
 *   onChange={(e) => setKomentar(e.target.value)}
 * />
 *
 * // Textarea tanpa label
 * <Textarea
 *   placeholder="Tulis pesan Anda di sini..."
 *   className="custom-textarea"
 * />
 * ```
 */
const Textarea: React.FC<PropertiTextarea> = ({ label, error = null, id, className = "", ...propertiLainnya }) => {
	/**
	 * Menghasilkan ID untuk textarea element
	 * Prioritas:
	 * 1. Gunakan ID yang diberikan secara eksplisit
	 * 2. Jika ada label, generate ID dari label
	 * 3. Jika tidak ada keduanya, undefined (biarkan browser generate)
	 *
	 * Format generated ID: lowercase dengan dash separator
	 * Contoh: "Komentar Pengguna" -> "komentar-pengguna"
	 */
	const idTextarea =
		id ||
		(label
			? label
					.replace(/[^a-z0-9]+/gi, "-") // Ganti karakter non-alphanumeric dengan dash
					.toLowerCase()
			: undefined);

	return (
		<div className="textarea-wrapper">
			{/* Label untuk textarea (jika disediakan) */}
			{label && (
				<label htmlFor={idTextarea} className="block text-xs text-slate-300 mb-2">
					{label}
				</label>
			)}

			{/* Textarea element dengan properti yang diberikan */}
			<textarea
				id={idTextarea}
				className={`textarea ${error ? "textarea--invalid" : ""} ${className}`.trim()}
				aria-invalid={!!error}
				aria-describedby={error ? `${idTextarea}-error` : undefined}
				{...propertiLainnya}
			/>

			{/* Pesan error (jika ada) */}
			{error && (
				<div id={`${idTextarea}-error`} className="text-xs text-red-400 mt-1" role="alert">
					{error}
				</div>
			)}
		</div>
	);
};

export default Textarea;

/**
 * CATATAN TAMBAHAN:
 *
 * 1. STYLING CSS:
 *    Komponen ini mengharapkan file CSS dengan kelas berikut:
 *    - .textarea-wrapper (container untuk textarea dan label/error)
 *    - .textarea (base style untuk textarea element)
 *    - .textarea--invalid (untuk state error/validasi gagal)
 *    - Label dan error message sudah distyling inline dengan Tailwind classes
 *
 * 2. AKSESIBILITAS:
 *    - Label terhubung dengan textarea menggunakan htmlFor dan id
 *    - Textarea dengan error memiliki aria-invalid="true"
 *    - Error message memiliki role="alert" untuk screen readers
 *    - Error message terhubung dengan textarea via aria-describedby
 *
 * 3. VALIDASI:
 *    - Error message hanya ditampilkan jika properti error tidak null/undefined
 *    - Pesan error harus jelas dan membantu pengguna memperbaiki input
 *
 * 4. PERBEDAAN DENGAN INPUT:
 *    - Textarea digunakan untuk input teks multi-baris
 *    - Mendukung properti rows dan cols untuk mengatur ukuran
 *    - Tidak mendukung type attribute seperti input
 *
 * 5. PENGEMBANGAN:
 *    Untuk menambahkan fitur baru:
 *    1. Tambahkan properti baru ke interface PropertiTextarea
 *    2. Implementasikan logika di komponen
 *    3. Dokumentasikan dengan baik di komentar
 *    4. Update contoh penggunaan
 *
 * 6. BEST PRACTICES:
 *    - Selalu sediakan label untuk textarea kecuali ada alasan khusus
 *    - Untuk textarea tanpa label visual, gunakan aria-label atau aria-labelledby
 *    - Hindari placeholder sebagai pengganti label
 *    - Pertimbangkan untuk menambahkan pembatas karakter jika diperlukan
 */
