import React from "react";
import ReactDOM from "react-dom/client";
import Aplikasi from "./App";
import "./theme/tokens.css";

import { FEATURES } from "./config/featureFlags";
import { dbService } from "./services/dbService";
import { terapkanTemaTersimpanAtauPreferensi } from "./src/theme/themeUtils";

/**
 * Poin masuk utama aplikasi Backend Studio.
 * File ini bertanggung jawab untuk:
 * 1. Mendaftarkan Service Worker untuk simulasi jaringan
 * 2. Menginisialisasi database
 * 3. Menerapkan tema yang tersimpan atau dipilih pengguna
 * 4. Merender aplikasi React ke DOM
 */

// ================================
// KONSTANTA DAN VARIABEL UTAMA
// ================================

/**
 * ID elemen root di index.html tempat aplikasi akan dirender.
 */
const ID_ELEMEN_ROOT = "root";

// ================================
// FUNGSI UTILITAS
// ================================

/**
 * Mendaftarkan Service Worker jika browser mendukung dan fitur diaktifkan.
 * Service Worker digunakan untuk meng-intercept permintaan jaringan dan mensimulasikan API.
 *
 * @async
 * @returns {Promise<void>} Promise yang menyelesaikan saat pendaftaran selesai
 */
const daftarkanServiceWorker = async (): Promise<void> => {
	if (!("serviceWorker" in navigator) || !FEATURES.SERVICE_WORKER()) {
		console.info("Service Worker dinonaktifkan atau tidak didukung");
		return;
	}

	try {
		const pendaftaran = await navigator.serviceWorker.register("/sw.js");
		console.info("Service Worker berhasil didaftarkan:", pendaftaran);
	} catch (errorPendaftaran) {
		console.error("Pendaftaran Service Worker gagal:", errorPendaftaran);

		// Hanya tampilkan peringatan di development untuk menghindari kebingungan pengguna
		if (import.meta.env?.DEV) {
			console.warn(
				"Service Worker gagal didaftarkan. Fitur intercept request mungkin tidak berfungsi.",
				"Penyebab umum:",
				"1. Aplikasi tidak diakses via HTTPS (atau localhost)",
				"2. File sw.js tidak ditemukan atau ada error di dalamnya",
				"3. Browser tidak mendukung semua API yang digunakan"
			);
		}
	}
};

/**
 * Menginisialisasi database aplikasi.
 * Mencoba backend yang tersedia (IndexedDB, localStorage) secara otomatis.
 *
 * @async
 * @returns {Promise<void>} Promise yang menyelesaikan saat inisialisasi selesai
 */
const inisialisasiDatabase = async (): Promise<void> => {
	try {
		await dbService.init({ backend: "auto" });
		console.info("Database berhasil diinisialisasi");
	} catch (error) {
		console.warn("Inisialisasi database gagal:", error);

		// Database gagal diinisialisasi bukanlah error fatal
		// Aplikasi masih bisa berjalan dengan localStorage fallback
		console.info("Aplikasi akan berjalan dengan fallback ke localStorage");
	}
};

/**
 * Memastikan elemen root ada di DOM sebelum aplikasi dirender.
 * Jika tidak ditemukan, akan melempar error yang jelas.
 *
 * @returns {HTMLElement} Elemen root yang ditemukan
 * @throws {Error} Jika elemen root tidak ditemukan
 */
const dapatkanElemenRoot = (): HTMLElement => {
	const elemenRoot = document.getElementById(ID_ELEMEN_ROOT);

	if (!elemenRoot) {
		const pesanError = `Tidak dapat menemukan elemen dengan ID "${ID_ELEMEN_ROOT}" di DOM.
                        Pastikan file index.html memiliki elemen <div id="${ID_ELEMEN_ROOT}"></div>`;

		console.error(pesanError);
		throw new Error(pesanError);
	}

	return elemenRoot;
};

/**
 * Menginisialisasi dan menjalankan aplikasi.
 * Fungsi utama yang mengkoordinasikan semua inisialisasi.
 *
 * @async
 * @returns {Promise<void>} Promise yang menyelesaikan saat aplikasi berjalan
 */
const jalankanAplikasi = async (): Promise<void> => {
	console.info("Memulai inisialisasi Backend Studio...");

	// Langkah 1: Terapkan tema yang disimpan atau preferensi pengguna
	// Dilakukan sedini mungkin untuk menghindari flash of unstyled content
	terapkanTemaTersimpanAtauPreferensi();

	// Langkah 2: Inisialisasi database (non-blocking, bisa gagal)
	// Tidak menggunakan await untuk mempercepat render pertama
	inisialisasiDatabase().catch(() => {
		/* Error sudah ditangani di dalam fungsi */
	});

	// Langkah 3: Daftarkan Service Worker (non-blocking)
	// Hanya jika fitur diaktifkan dan browser mendukung
	if (FEATURES.SERVICE_WORKER()) {
		daftarkanServiceWorker().catch(() => {
			/* Error sudah ditangani di dalam fungsi */
		});
	}

	// Langkah 4: Siapkan root React dan render aplikasi
	const elemenRoot = dapatkanElemenRoot();
	const rootReact = ReactDOM.createRoot(elemenRoot);

	rootReact.render(
		<React.StrictMode>
			<Aplikasi />
		</React.StrictMode>
	);

	console.info("Aplikasi Backend Studio berhasil dirender");
};

// ================================
// EKSEKUSI APLIKASI
// ================================

/**
 * Menangani error yang tidak tertangkap selama inisialisasi aplikasi.
 * Menampilkan pesan error yang informatif kepada pengguna.
 *
 * @param {Error} error - Error yang terjadi
 */
const tanganiErrorStartup = (error: Error): void => {
	console.error("Error fatal selama startup aplikasi:", error);

	// Coba tampilkan pesan error kepada pengguna
	const elemenRoot = document.getElementById(ID_ELEMEN_ROOT);
	if (elemenRoot) {
		elemenRoot.innerHTML = `
      <div style="
        padding: 2rem;
        max-width: 600px;
        margin: 2rem auto;
        font-family: system-ui, sans-serif;
        color: #dc2626;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
      ">
        <h2 style="margin-top: 0; color: #b91c1c;">
          ⚠️ Gagal Memuat Aplikasi
        </h2>
        <p>
          Terjadi error saat memuat Backend Studio. Silakan:
        </p>
        <ul>
          <li>Refresh halaman</li>
          <li>Periksa koneksi internet</li>
          <li>Pastikan browser Anda mendukung fitur yang diperlukan</li>
        </ul>
        <details style="margin-top: 1rem; color: #7f1d1d;">
          <summary style="cursor: pointer; font-weight: bold;">
            Detail Teknis (untuk debugging)
          </summary>
          <pre style="
            background: #fee2e2;
            padding: 1rem;
            border-radius: 0.25rem;
            overflow: auto;
            font-size: 0.875rem;
            margin-top: 0.5rem;
          ">
${error.stack || error.message}
          </pre>
        </details>
      </div>
    `;
	}
};

/**
 * Titik masuk utama aplikasi.
 * Membungkus eksekusi aplikasi dalam blok try-catch untuk menangani error startup.
 */
(async (): Promise<void> => {
	try {
		await jalankanAplikasi();
	} catch (error) {
		tanganiErrorStartup(error as Error);
	}
})();

/**
 * Event listener untuk mendaftarkan Service Worker saat halaman selesai dimuat.
 * Hanya dipanggil jika Service Worker belum didaftarkan secara asynchronous.
 */
if (FEATURES.SERVICE_WORKER() && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		// Jika Service Worker belum didaftarkan, coba daftarkan lagi
		// (fallback untuk skenario tertentu)
		navigator.serviceWorker.getRegistration().then(pendaftaran => {
			if (!pendaftaran) {
				daftarkanServiceWorker().catch(() => {
					/* Error sudah ditangani di dalam fungsi */
				});
			}
		});
	});
}

/**
 * Ekspor untuk testing (hanya di development).
 * Memungkinkan pengujian fungsi-fungsi utama secara terpisah.
 */
if (import.meta.env?.DEV) {
	// @ts-ignore - Hanya untuk development
	window.__BACKEND_STUDIO_TEST__ = {
		daftarkanServiceWorker,
		inisialisasiDatabase,
		dapatkanElemenRoot,
	};
}
