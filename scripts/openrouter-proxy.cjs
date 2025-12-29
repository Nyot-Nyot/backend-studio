"use strict";

/**
 * Proksi OpenRouter untuk aplikasi klien
 * File ini menyediakan server proxy yang aman untuk mengakses API OpenRouter
 * dengan penanganan kunci API, batas kecepatan, dan fallback yang tepat
 */

// ============================================
// LOAD KONFIGURASI ENVIRONMENT
// ============================================

/**
 * Memuat konfigurasi dari file .env untuk pengembangan lokal
 * Pengguna dapat menyetel variabel di file .env di repositori
 */
let _dotenvDimuat = false;

try {
	const dotenv = require("dotenv");
	dotenv.config();
	_dotenvDimuat = true;
} catch (error) {
	// dotenv tidak terinstal; coba parser manual sederhana sebagai fallback
	try {
		const fs = require("fs");
		const path = require("path");
		const jalurEnv = path.resolve(process.cwd(), ".env");

		if (fs.existsSync(jalurEnv)) {
			const kontenMentah = fs.readFileSync(jalurEnv, "utf8");

			kontenMentah.split(/\r?\n/).forEach(baris => {
				const barisTrim = baris.trim();

				if (!barisTrim || barisTrim.startsWith("#")) return;

				const indexSamaDengan = barisTrim.indexOf("=");
				if (indexSamaDengan === -1) return;

				const kunci = barisTrim.slice(0, indexSamaDengan).trim();
				let nilai = barisTrim.slice(indexSamaDengan + 1).trim();

				// Hapus tanda kutip di sekitar nilai
				if ((nilai.startsWith('"') && nilai.endsWith('"')) || (nilai.startsWith("'") && nilai.endsWith("'"))) {
					nilai = nilai.slice(1, -1);
				}

				if (typeof process.env[kunci] === "undefined") {
					process.env[kunci] = nilai;
				}
			});

			_dotenvDimuat = true;
		}
	} catch (errorFallback) {
		// Abaikan error fallback
	}
}

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// ============================================
// KONFIGURASI UTAMA
// ============================================

const PORT = process.env.OPENROUTER_HELPER_PORT || 3002;
const KUNCI_API_OPENROUTER = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_KEY;

// ============================================
// FUNGSI UTAMA UNTUK MEMBUAT APLIKASI
// ============================================

/**
 * Membuat dan mengkonfigurasi aplikasi Express untuk proksi OpenRouter
 * @param {Object} opsi - Opsi konfigurasi tambahan
 * @returns {Object} Aplikasi Express yang sudah dikonfigurasi
 */
function buatAplikasi(opsi = {}) {
	const memilikiOverride = Object.prototype.hasOwnProperty.call(opsi, "openRouterApiKey");
	const OVERRIDE_KUNCI_API_OPENROUTER = opsi.openRouterApiKey;

	const MODE_SENYAP =
		opsi.quiet || process.env.OPENROUTER_PROXY_QUIET === "1" || process.env.OPENROUTER_PROXY_QUIET === "true";

	const IZINKAN_KUNCI_KLIEN = opsi.allowClientKey || process.env.DEV_ALLOW_CLIENT_KEY === "1";

	// Hook untuk testing
	const fungsiPanggilOpenRouter = opsi.callOpenRouter || null;

	// Hitung keberadaan kunci server secara dinamis agar testing dapat mengubah process.env
	const kunciServerAda = !!(memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY);

	// Format kunci untuk log (redaksi sebagian untuk keamanan)
	const kunciServerTeredaksi = (memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY)
		? String(memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY).length > 8
			? `${String(memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY).slice(
					0,
					4
			  )}...` +
			  `${String(memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY).slice(-4)}`
			: "***"
		: null;

	// Log konfigurasi jika tidak dalam mode senyap
	if (!MODE_SENYAP) {
		if (!kunciServerAda) {
			console.warn(
				"Peringatan: OPENROUTER_API_KEY tidak disetel. " +
					"Proxy akan merespons dengan 401 kecuali kunci diberikan atau " +
					"DEV_ALLOW_CLIENT_KEY diaktifkan untuk pengembangan."
			);
		} else {
			console.log(`Proksi OpenRouter: menggunakan kunci server ${kunciServerTeredaksi}`);
		}
	}

	// ============================================
	// INISIALISASI APLIKASI EXPRESS
	// ============================================

	const aplikasi = express();
	aplikasi.use(cors());
	aplikasi.use(bodyParser.json());

	// ============================================
	// ENDPOINT KESEHATAN
	// ============================================

	/**
	 * Endpoint untuk memeriksa kesehatan server
	 */
	aplikasi.get("/health", (permintaan, respon) => {
		respon.json({ ok: true });
	});

	/**
	 * Endpoint kesehatan khusus untuk OpenRouter
	 * Digunakan oleh Vite dev proxy untuk pengecekan kesehatan
	 */
	aplikasi.get("/openrouter/health", (permintaan, respon) => {
		const kunciAda = !!(memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY);
		respon.json({ ok: true, kunciAda });
	});

	// ============================================
	// FUNGSI BANTUAN UNTUK PANGGIL OPENROUTER
	// ============================================

	/**
	 * Memanggil API Chat Completions OpenRouter
	 * @param {Array} pesan - Array pesan untuk model AI
	 * @param {string} model - Model AI yang akan digunakan
	 * @param {string} kunciApi - Kunci API untuk autentikasi
	 * @returns {Promise<Object>} Respons dari API OpenRouter
	 */
	async function panggilOpenRouter(pesan, model = "deepseek/deepseek-r1-0528:free", kunciApi) {
		const kunciUntukDigunakan =
			kunciApi || (memilikiOverride ? OVERRIDE_KUNCI_API_OPENROUTER : process.env.OPENROUTER_API_KEY);

		if (!kunciUntukDigunakan) {
			throw new Error("OPENROUTER_API_KEY tidak dikonfigurasi");
		}

		const retryUtil = require("../services/retry.cjs");

		const eksekusiFetch = async () => {
			const respon = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${kunciUntukDigunakan}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ model, messages: pesan }),
			});

			if (!respon) {
				throw new Error("Tidak ada respons dari fetch");
			}

			// Tangani status error
			if (respon.status >= 400) {
				let badanRespon = null;

				try {
					badanRespon = await respon.json();
				} catch (errorParse) {
					// Abaikan error parsing
				}

				// Error batas kecepatan (rate limit)
				if (respon.status === 429) {
					const pesanError =
						badanRespon?.message || badanRespon?.error || JSON.stringify(badanRespon) || "batas kecepatan";

					const retrySetelah =
						respon.headers && typeof respon.headers.get === "function"
							? respon.headers.get("retry-after")
							: null;

					const error = new Error(`rate_limit:${pesanError}`);
					error.status = 429;
					error.noRetry = true; // Jangan ulangi untuk error batas kecepatan
					error.retryAfter = retrySetelah;

					throw error;
				}

				// Error klien 4xx lainnya
				if (respon.status >= 400 && respon.status < 500) {
					const error = new Error(`client_error:${respon.status}:${JSON.stringify(badanRespon)}`);
					error.status = respon.status;
					error.noRetry = true;

					throw error;
				}

				// Error server 5xx
				if (respon.status >= 500) {
					throw new Error(`server_error:${respon.status}`);
				}
			}

			const json = await respon.json();
			return { status: respon.status, body: json };
		};

		// Konfigurasi timeout dari environment atau default 60 detik
		const timeoutMsEnv = process.env.OPENROUTER_TIMEOUT_MS
			? parseInt(process.env.OPENROUTER_TIMEOUT_MS, 10)
			: undefined;

		const timeoutMs = typeof timeoutMsEnv === "number" && !Number.isNaN(timeoutMsEnv) ? timeoutMsEnv : 60000; // Default 60 detik per percobaan

		if (process.env.DEBUG_OPENROUTER === "1" && !MODE_SENYAP) {
			console.log(`Panggilan OpenRouter: timeoutMs=${timeoutMs}`);
		}

		const hasil = await retryUtil.retry(eksekusiFetch, {
			retries: 3,
			baseDelayMs: 200,
			factor: 2,
			maxDelayMs: 1500,
			timeoutMs: timeoutMs,
		});

		return hasil;
	}

	// Ekspos fungsi internal untuk testing
	aplikasi._isTest_callOpenRouter = (pesan, model, kunciApi) => panggilOpenRouter(pesan, model, kunciApi);

	// ============================================
	// ENDPOINT UNTUK MEMBANGKITKAN DATA MOCK
	// ============================================

	/**
	 * Endpoint untuk membangkitkan respons API mock menggunakan AI
	 */
	aplikasi.post("/openrouter/generate-mock", async (permintaan, respon) => {
		const { path, context } = permintaan.body || {};

		// Tentukan kunci yang akan digunakan
		const kunciDariHeader = permintaan.get("x-openrouter-key");
		let kunciKandidat = null;

		if (memilikiOverride) {
			// Override eksplisit dari factory
			kunciKandidat = OVERRIDE_KUNCI_API_OPENROUTER === null ? null : OVERRIDE_KUNCI_API_OPENROUTER;
		} else {
			kunciKandidat = process.env.OPENROUTER_API_KEY || null;
		}

		const kunci =
			kunciKandidat ||
			(IZINKAN_KUNCI_KLIEN && process.env.NODE_ENV !== "production" && kunciDariHeader ? kunciDariHeader : null);

		if (!kunci) {
			return respon.status(401).json({
				error: "OPENROUTER_API_KEY tidak dikonfigurasi",
			});
		}

		if (!path) {
			return respon.status(400).json({
				error: "Path tidak diberikan",
			});
		}

		// Log peringatan jika menggunakan kunci dari klien di lingkungan development
		if (
			kunciDariHeader &&
			kunciDariHeader === kunci &&
			IZINKAN_KUNCI_KLIEN &&
			process.env.NODE_ENV !== "production" &&
			!MODE_SENYAP
		) {
			console.warn(
				"Proksi OpenRouter: menggunakan kunci API dari klien " +
					"(DEV_ALLOW_CLIENT_KEY diaktifkan) — hati-hati jangan membocorkan " +
					"kunci Anda di produksi"
			);
		}

		// Siapkan prompt untuk model AI
		const promptPengguna = [
			"Anda adalah asisten pengembang backend. Bangkitkan respons JSON yang realistis ",
			"untuk endpoint API REST.",
			`Endpoint Path: "${path}"`,
			`Context/Description: "${context}"`,
			"Persyaratan:",
			"1) Hanya keluarkan JSON yang valid.",
			"2) Jangan sertakan tanda kode markdown; kembalikan hanya JSON polos.",
			"3) Jika path mengimplikasikan daftar (contoh: /users), kembalikan array 3-5 item.",
			"4) Jika path mengimplikasikan sumber daya tunggal (contoh: /users/1), ",
			"kembalikan objek tunggal.",
			"5) Gunakan data realistis (nama, tanggal, email).",
		].join(" ");

		try {
			const pesan = [{ role: "user", content: promptPengguna }];

			const hasil = fungsiPanggilOpenRouter
				? await fungsiPanggilOpenRouter(pesan, undefined, kunci)
				: await panggilOpenRouter(pesan, undefined, kunci);

			if (hasil.status !== 200) {
				return respon.status(hasil.status).json({
					error: hasil.body,
				});
			}

			// Ekstrak teks konten dari respons
			const teks =
				hasil.body?.choices?.[0]?.message?.content ||
				hasil.body?.choices?.[0]?.content ||
				JSON.stringify(hasil.body);

			// Bersihkan tanda kode markdown jika ada
			const teksBersih = String(teks)
				.replace(/```json/g, "")
				.replace(/```/g, "")
				.trim();

			// Validasi dan parse output JSON
			try {
				const terparse = JSON.parse(teksBersih);
				return respon.json({ json: terparse });
			} catch (errorParse) {
				if (!MODE_SENYAP) {
					console.warn("Proksi OpenRouter: model mengembalikan JSON tidak valid untuk generate-mock");
				}

				return respon.status(502).json({
					error: "invalid_model_output",
					raw: teksBersih,
				});
			}
		} catch (error) {
			console.error("Error proksi OpenRouter (generate-mock):", error);
			respon.status(500).json({
				error: "proxy_error",
				details: String(error),
			});
		}
	});

	// ============================================
	// ENDPOINT UNTUK MEMBANGKITKAN ENDPOINT API
	// ============================================

	/**
	 * Endpoint untuk membangkitkan konfigurasi endpoint API lengkap
	 */
	aplikasi.post("/openrouter/generate-endpoint", async (permintaan, respon) => {
		const { prompt } = permintaan.body || {};

		// Tentukan kunci yang akan digunakan
		const kunciDariHeader = permintaan.get("x-openrouter-key");
		let kunciKandidat = null;

		if (memilikiOverride) {
			// Override eksplisit dari factory
			kunciKandidat = OVERRIDE_KUNCI_API_OPENROUTER === null ? null : OVERRIDE_KUNCI_API_OPENROUTER;
		} else {
			kunciKandidat = process.env.OPENROUTER_API_KEY || null;
		}

		const kunci =
			kunciKandidat ||
			(IZINKAN_KUNCI_KLIEN && process.env.NODE_ENV !== "production" && kunciDariHeader ? kunciDariHeader : null);

		if (!kunci) {
			return respon.status(401).json({
				error: "OPENROUTER_API_KEY tidak dikonfigurasi",
			});
		}

		if (!prompt) {
			return respon.status(400).json({
				error: "Prompt tidak diberikan",
			});
		}

		// Log peringatan jika menggunakan kunci dari klien di lingkungan development
		if (
			kunciDariHeader &&
			kunciDariHeader === kunci &&
			IZINKAN_KUNCI_KLIEN &&
			process.env.NODE_ENV !== "production" &&
			!MODE_SENYAP
		) {
			console.warn(
				"Proksi OpenRouter: menggunakan kunci API dari klien " +
					"(DEV_ALLOW_CLIENT_KEY diaktifkan) — hati-hati jangan membocorkan " +
					"kunci Anda di produksi"
			);
		}

		// Siapkan prompt sistem untuk model AI
		const promptSistem = [
			"Anda adalah Arsitek API. Berdasarkan deskripsi pengguna, ",
			"bangkitkan konfigurasi endpoint REST API yang lengkap.",
			`Deskripsi Pengguna: "${prompt}"`,
			"Kembalikan HANYA objek JSON mentah (tanpa markdown) dengan struktur ini: ",
			'{ "name": "Nama deskriptif singkat", ',
			'"path": "/api/v1/nama-sumber-daya", ',
			'"method": "GET|POST|PUT|DELETE|PATCH", ',
			'"statusCode": 200, ',
			'"responseBody": "String JSON dari data respons (dalam bentuk string)" }',
			"Pastikan path menggunakan praktik terbaik (kebab-case). ",
			"Pastikan responseBody adalah JSON string yang valid.",
		].join(" ");

		try {
			const pesan = [{ role: "user", content: promptSistem }];
			const hasil = await panggilOpenRouter(pesan, undefined, kunci);

			if (hasil.status !== 200) {
				return respon.status(hasil.status).json({
					error: hasil.body,
				});
			}

			const teks =
				hasil.body?.choices?.[0]?.message?.content ||
				hasil.body?.choices?.[0]?.content ||
				JSON.stringify(hasil.body);

			const teksBersih = String(teks)
				.replace(/```json/g, "")
				.replace(/```/g, "")
				.trim();

			// Coba parse JSON
			try {
				const terparse = JSON.parse(teksBersih);
				return respon.json(terparse);
			} catch (errorParse) {
				return respon.status(502).json({
					error: "invalid_model_output",
					raw: teksBersih,
				});
			}
		} catch (error) {
			console.error("Error proksi OpenRouter (generate-endpoint):", error);
			respon.status(500).json({
				error: "proxy_error",
				details: String(error),
			});
		}
	});

	return aplikasi;
}

// ============================================
// MENJALANKAN SERVER JIKA DIEKSEKUSI LANGSUNG
// ============================================

if (require.main === module) {
	const aplikasi = buatAplikasi();

	aplikasi.listen(PORT, () => {
		console.log(`Proksi OpenRouter berjalan di port ${PORT}`);
		console.log(`Endpoint: POST http://localhost:${PORT}/openrouter/generate-mock`);
		console.log(`         POST http://localhost:${PORT}/openrouter/generate-endpoint`);
	});
}

// ============================================
// EKSPOR MODUL
// ============================================

module.exports = {
	buatAplikasi,
	PORT,
	KUNCI_API_OPENROUTER,
};
