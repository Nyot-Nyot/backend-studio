// Input.tsx
import React from "react";

/**
 * Properti untuk komponen Input
 * Meng-extend properti dasar HTML input element dan menambahkan fitur khusus
 */
interface PropertiInput extends React.InputHTMLAttributes<HTMLInputElement> {
	/**
	 * Label untuk input field
	 * Jika disediakan, akan menampilkan label di atas input
	 */
	label?: string;

	/**
	 * Pesan error untuk validasi input
	 * Jika disediakan, akan menampilkan pesan error di bawah input
	 */
	error?: string | null;

	/**
	 * ID unik untuk input element
	 * Jika tidak disediakan, akan di-generate otomatis dari label
	 */
	id?: string;

	/**
	 * Kelas CSS tambahan untuk kustomisasi
	 * Akan digabungkan dengan kelas dasar input
	 */
	className?: string;
}

/**
 * Komponen Input yang dapat digunakan kembali (reusable)
 * Mendukung label, error handling, dan properti HTML input standar
 *
 * Fitur:
 * - Label opsional dengan htmlFor yang otomatis terhubung
 * - Validasi dengan pesan error yang jelas
 * - ID otomatis dari label jika tidak disediakan
 * - Mendukung semua properti HTML input standar
 * - Aksesibilitas: label yang terhubung dengan benar, error yang dapat diakses
 *
 * Contoh penggunaan:
 * ```
 * // Input dengan label
 * <Input
 *   label="Nama Lengkap"
 *   placeholder="Masukkan nama lengkap"
 *   value={nama}
 *   onChange={(e) => setNama(e.target.value)}
 * />
 *
 * // Input dengan validasi error
 * <Input
 *   label="Email"
 *   type="email"
 *   error={errors.email}
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 *
 * // Input tanpa label
 * <Input
 *   placeholder="Cari..."
 *   className="search-input"
 * />
 * ```
 */
const Input: React.FC<PropertiInput> = ({ label, error = null, id, className = "", ...propertiLainnya }) => {
	/**
	 * Menghasilkan ID untuk input element
	 * Prioritas:
	 * 1. Gunakan ID yang diberikan secara eksplisit
	 * 2. Jika ada label, generate ID dari label
	 * 3. Jika tidak ada keduanya, undefined (biarkan browser generate)
	 *
	 * Format generated ID: lowercase dengan dash separator
	 * Contoh: "Email Pengguna" -> "email-pengguna"
	 */
	const idInput =
		id ||
		(label
			? label
					.replace(/[^a-z0-9]+/gi, "-") // Ganti karakter non-alphanumeric dengan dash
					.toLowerCase()
			: undefined);

	return (
		<div className="input-wrapper">
			{/* Label untuk input (jika disediakan) */}
			{label && (
				<label htmlFor={idInput} className="block text-xs text-slate-300 mb-2">
					{label}
				</label>
			)}

			{/* Input element dengan properti yang diberikan */}
			<input
				id={idInput}
				className={`input ${error ? "input--invalid" : ""} ${className}`.trim()}
				aria-invalid={!!error}
				aria-describedby={error ? `${idInput}-error` : undefined}
				{...propertiLainnya}
			/>

			{/* Pesan error (jika ada) */}
			{error && (
				<div id={`${idInput}-error`} className="text-xs text-red-400 mt-1" role="alert">
					{error}
				</div>
			)}
		</div>
	);
};

export default Input;

/**
 * CATATAN TAMBAHAN:
 *
 * 1. STYLING CSS:
 *    Komponen ini mengharapkan file CSS dengan kelas berikut:
 *    - .input-wrapper (container untuk input dan label/error)
 *    - .input (base style untuk input element)
 *    - .input--invalid (untuk state error/validasi gagal)
 *    - Label dan error message sudah distyling inline dengan Tailwind classes
 *
 * 2. AKSESIBILITAS:
 *    - Label terhubung dengan input menggunakan htmlFor dan id
 *    - Input dengan error memiliki aria-invalid="true"
 *    - Error message memiliki role="alert" untuk screen readers
 *    - Error message terhubung dengan input via aria-describedby
 *
 * 3. VALIDASI:
 *    - Error message hanya ditampilkan jika properti error tidak null/undefined
 *    - Pesan error harus jelas dan membantu pengguna memperbaiki input
 *
 * 4. PENGEMBANGAN:
 *    Untuk menambahkan fitur baru:
 *    1. Tambahkan properti baru ke interface PropertiInput
 *    2. Implementasikan logika di komponen
 *    3. Dokumentasikan dengan baik di komentar
 *    4. Update contoh penggunaan
 *
 * 5. BEST PRACTICES:
 *    - Selalu sediakan label untuk input kecuali ada alasan khusus
 *    - Untuk input tanpa label visual, gunakan aria-label atau aria-labelledby
 *    - Hindari placeholder sebagai pengganti label
 *    - Pastikan warna error memiliki contrast ratio yang cukup untuk aksesibilitas
 */
