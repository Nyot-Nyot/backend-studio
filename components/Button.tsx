// Button.tsx
import React from "react";

/**
 * Properti untuk komponen Tombol
 * Meng-extend properti dasar HTML button element dan menambahkan varian kustom
 */
interface TombolProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * Varian tampilan tombol
	 * - default: Tombol standar dengan gaya netral
	 * - primary: Tombol utama untuk aksi utama
	 * - ghost: Tombol transparan untuk aksi sekunder
	 * - danger: Tombol untuk aksi berbahaya (hapus, batalkan)
	 * - icon: Tombol khusus untuk ikon tanpa teks
	 */
	varian?: "default" | "primary" | "ghost" | "danger" | "icon";

	/**
	 * Kelas CSS tambahan untuk kustomisasi
	 * Akan digabungkan dengan kelas varian
	 */
	className?: string;

	/**
	 * Konten tombol (teks, ikon, atau elemen React lainnya)
	 */
	children?: React.ReactNode;
}

/**
 * Fungsi helper untuk mendapatkan kelas CSS berdasarkan varian tombol
 * @param varian - Varian tombol (default, primary, ghost, danger, icon)
 * @returns String kelas CSS untuk varian yang diminta
 *
 * Contoh penggunaan:
 * ```
 * kelasVarian("primary") // Mengembalikan "btn btn--primary"
 * kelasVarian("danger")  // Mengembalikan "btn btn--danger"
 * ```
 */
const kelasVarian = (varian?: TombolProps["varian"]): string => {
	switch (varian) {
		case "primary":
			return "btn btn--primary";
		case "ghost":
			return "btn btn--ghost";
		case "danger":
			return "btn btn--danger";
		case "icon":
			return "btn btn--icon";
		default:
			return "btn";
	}
};

/**
 * Komponen Tombol yang dapat digunakan kembali (reusable)
 * Mendukung berbagai varian tampilan dan properti HTML button standar
 *
 * Fitur:
 * - 5 varian tampilan (default, primary, ghost, danger, icon)
 * - Mendukung semua properti HTML button standar
 * - Dapat dikustomisasi dengan kelas CSS tambahan
 * - Aksesibilitas: Mendukung properti ARIA dan keyboard navigation
 *
 * Contoh penggunaan:
 * ```
 * // Tombol default
 * <Tombol onClick={() => console.log('Diklik')}>
 *   Simpan
 * </Tombol>
 *
 * // Tombol primary
 * <Tombol varian="primary" type="submit">
 *   Kirim
 * </Tombol>
 *
 * // Tombol dengan ikon
 * <Tombol varian="icon" aria-label="Hapus item">
 *   <TrashIcon />
 * </Tombol>
 * ```
 */
const Tombol: React.FC<TombolProps> = ({ varian = "default", className = "", children, ...propertiLainnya }) => {
	// Gabungkan kelas varian dengan kelas tambahan dari pengguna
	const kelasGabungan = `${kelasVarian(varian)} ${className}`.trim();

	return (
		<button className={kelasGabungan} {...propertiLainnya}>
			{children}
		</button>
	);
};

export default Tombol;

/**
 * CATATAN TAMBAHAN:
 *
 * 1. STYLING CSS:
 *    Komponen ini mengharapkan file CSS dengan kelas berikut:
 *    - .btn (base style untuk semua tombol)
 *    - .btn--primary (untuk varian primary)
 *    - .btn--ghost (untuk varian ghost/transparan)
 *    - .btn--danger (untuk varian danger/berbahaya)
 *    - .btn--icon (untuk tombol ikon)
 *
 * 2. AKSESIBILITAS:
 *    Pastikan untuk selalu menyediakan:
 *    - Teks yang jelas untuk tombol non-ikon
 *    - aria-label untuk tombol ikon
 *    - Keyboard navigation support (tabindex default sudah disediakan oleh browser)
 *
 * 3. PERFORMANCE:
 *    Komponen ini menggunakan React.memo secara implisit karena functional component
 *    Untuk optimasi lebih lanjut, pertimbangkan menggunakan React.memo() jika diperlukan
 *
 * 4. PENGEMBANGAN:
 *    Untuk menambahkan varian baru, cukup:
 *    1. Tambahkan ke tipe varian di interface TombolProps
 *    2. Tambahkan case baru di fungsi kelasVarian
 *    3. Tambahkan styling CSS untuk varian baru
 */
