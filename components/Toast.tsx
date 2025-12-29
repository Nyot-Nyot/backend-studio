// Toast.tsx
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import React, { useEffect } from "react";

/**
 * Tipe notifikasi Toast yang tersedia
 * - success: Untuk pesan sukses
 * - error: Untuk pesan error
 * - info: Untuk pesan informasi
 */
export type TipeToast = "success" | "error" | "info";

/**
 * Interface untuk pesan Toast
 * Memungkinkan pemanggil menentukan durasi opsional (ms) per toast
 */
export interface PesanToast {
	id: string; // ID unik untuk toast
	tipe: TipeToast; // Tipe toast
	pesan: string; // Pesan yang akan ditampilkan
	durasi?: number; // Durasi dalam milidetik; jika tidak disediakan, akan digunakan default berdasarkan tipe. 0 atau negatif -> tetap tampil sampai ditutup manual
}

/**
 * Properti untuk komponen KontainerToast
 */
interface PropertiToast {
	daftarToast: PesanToast[]; // Daftar toast yang akan ditampilkan
	hapusToast: (id: string) => void; // Fungsi untuk menghapus toast berdasarkan ID
	durasiDefault?: number; // Override global opsional untuk durasi default
}

/**
 * Durasi default per tipe toast (dalam milidetik)
 */
const DURASI_DEFAULT: Record<TipeToast, number> = {
	success: 4000, // 4 detik untuk pesan sukses
	info: 4000, // 4 detik untuk pesan info
	error: 8000, // 8 detik untuk pesan error (lebih lama karena penting)
};

/**
 * Komponen kontainer untuk menampilkan semua toast
 * Toast akan ditampilkan di sudut kanan bawah layar
 */
export const KontainerToast: React.FC<PropertiToast> = ({ daftarToast, hapusToast }) => {
	return (
		<div
			className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
			aria-live="polite" // Untuk screen reader, membaca toast secara sopan
			aria-atomic="true" // Membaca seluruh konten toast sebagai satu unit
			role="region" // Menandakan area khusus untuk toast
		>
			{daftarToast.map(toast => (
				<ItemToast key={toast.id} toast={toast} onHapus={() => hapusToast(toast.id)} />
			))}
		</div>
	);
};

/**
 * Komponen untuk setiap item toast individual
 * Menangani logika penghapusan otomatis berdasarkan durasi
 */
const ItemToast: React.FC<{
	toast: PesanToast;
	onHapus: () => void;
}> = ({ toast, onHapus }) => {
	/**
	 * Menentukan durasi toast:
	 * 1. Gunakan durasi yang disediakan dalam toast jika ada
	 * 2. Jika tidak, gunakan durasi default berdasarkan tipe
	 */
	const durasi = toast.durasi ?? DURASI_DEFAULT[toast.tipe];

	/**
	 * Efek untuk menghapus toast secara otomatis setelah durasi tertentu
	 * Hanya berjalan jika durasi > 0
	 */
	useEffect(() => {
		if (typeof durasi === "number" && durasi > 0) {
			const timer = setTimeout(() => {
				onHapus();
			}, durasi);

			// Cleanup: hapus timer jika komponen unmount atau durasi berubah
			return () => clearTimeout(timer);
		}
		return;
	}, [onHapus, durasi]);

	/**
	 * Warna latar belakang untuk setiap tipe toast
	 * Menggunakan kombinasi theme dan border color untuk konsistensi
	 */
	const warnaLatar: Record<TipeToast, string> = {
		success: "theme-surface theme-border border-green-200",
		error: "theme-surface theme-border border-red-200",
		info: "theme-surface theme-border border-blue-200",
	};

	/**
	 * Ikon untuk setiap tipe toast
	 * Menggunakan ikon dari lucide-react yang sesuai
	 */
	const ikonToast: Record<TipeToast, React.ReactNode> = {
		success: <CheckCircle className="w-5 h-5 text-green-500" />,
		error: <AlertCircle className="w-5 h-5 text-red-500" />,
		info: <Info className="w-5 h-5 text-brand-500" />,
	};

	/**
	 * Menentukan aria-live untuk aksesibilitas:
	 * - error: assertive (akan dibaca segera)
	 * - lainnya: polite (akan dibaca saat sibuk)
	 */
	const ariaLive = toast.tipe === "error" ? "assertive" : "polite";

	return (
		<div
			role="status" // Role untuk elemen yang memberikan status
			aria-live={ariaLive} // Atribut aksesibilitas untuk screen reader
			aria-atomic="true" // Membaca seluruh konten sebagai satu unit
			className={`pointer-events-auto flex items-center p-4 rounded-xl shadow-lg border ${
				warnaLatar[toast.tipe]
			} min-w-[300px] animate-in slide-in-from-right-10 fade-in duration-300`}
		>
			{/* Ikon toast */}
			<div className="flex-shrink-0 mr-3">{ikonToast[toast.tipe]}</div>

			{/* Pesan toast */}
			<p className="text-sm font-medium text-slate-700 flex-1">{toast.pesan}</p>

			{/* Tombol tutup */}
			<button
				aria-label="Tutup notifikasi"
				type="button"
				onClick={onHapus}
				className="ml-3 text-slate-400 hover:text-slate-600 transition-colors"
			>
				<X className="w-4 h-4" />
			</button>
		</div>
	);
};
