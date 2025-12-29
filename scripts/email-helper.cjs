"use strict";

/**
 * Server helper untuk mengelola unggahan file sementara untuk keperluan email
 * Modul CommonJS ini menyediakan server web sederhana untuk menerima upload file
 * dengan batas waktu berlaku (TTL) dan kemampuan unggah ke layanan publik.
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");

// ============================================
// KONFIGURASI APLIKASI
// ============================================

const PORT = process.env.EMAIL_HELPER_PORT || process.env.VITE_EMAIL_HELPER_PORT || 3001;
const DIREKTORI_UPLOAD = path.resolve(process.cwd(), "tmp", "email-uploads");
const JAM_MASA_BERLAKU = Number(process.env.EMAIL_HELPER_TTL_HOURS || 24);

// Mode senyap untuk menekan log yang berpotensi sensitif
const argumenBarisPerintah = process.argv.slice(2);
const MODE_SENYAP = argumenBarisPerintah.includes("--quiet") || process.env.EMAIL_HELPER_QUIET === "true";

/**
 * Fungsi untuk mencatat log dengan aman (hanya jika tidak dalam mode senyap)
 */
function catatLogAman() {
	if (!MODE_SENYAP) console.log.apply(console, arguments);
}

/**
 * Fungsi untuk mencatat peringatan dengan aman
 */
function catatPeringatanAman() {
	if (!MODE_SENYAP) console.warn.apply(console, arguments);
}

/**
 * Fungsi untuk mencatat error (selalu ditampilkan)
 */
function catatError() {
	console.error.apply(console, arguments);
}

// ============================================
// INISIALISASI DIREKTORI DAN PENYIMPANAN
// ============================================

/**
 * Memastikan direktori upload ada, membuatnya jika belum ada
 */
function pastikanDirektoriUploadAda() {
	if (!fs.existsSync(DIREKTORI_UPLOAD)) {
		fs.mkdirSync(DIREKTORI_UPLOAD, { recursive: true });
		catatLogAman(`Direktori upload dibuat: ${DIREKTORI_UPLOAD}`);
	}
}

pastikanDirektoriUploadAda();

/**
 * Konfigurasi penyimpanan untuk multer
 */
const konfigurasiPenyimpanan = multer.diskStorage({
	destination: (permintaan, file, callback) => callback(null, DIREKTORI_UPLOAD),
	filename: (permintaan, file, callback) => {
		const idUnik = crypto.randomBytes(8).toString("hex");
		const ekstensiFile = path.extname(file.originalname) || ".zip";
		const namaFile = `${idUnik}${ekstensiFile}`;
		callback(null, namaFile);
	},
});

// ============================================
// KONFIGURASI VALIDASI FILE
// ============================================

/**
 * Daftar ekstensi file yang diperbolehkan untuk keamanan
 */
const EKSTENSI_DIIZINKAN = new Set([".zip", ".json", ".txt", ".png", ".jpg", ".jpeg"]);

// ============================================
// MIDDLEWARE BATAS LAJU UPLOAD
// ============================================

/**
 * Konfigurasi untuk membatasi jumlah upload per alamat IP
 */
const BATAS_LAJU_UPLOAD = Number(process.env.EMAIL_HELPER_RATE_LIMIT || 20);
const JENDELA_WAKTU_BATAS_LAJU_MS = Number(process.env.EMAIL_HELPER_RATE_WINDOW_HOURS || 1) * 60 * 60 * 1000;
const petaBatasLaju = new Map();

/**
 * Middleware untuk menerapkan batas laju upload berdasarkan alamat IP
 */
function middlewareBatasLaju(permintaan, respon, lanjutkan) {
	const alamatIP =
		permintaan.ip || (permintaan.connection && permintaan.connection.remoteAddress) || "tidak-diketahui";

	let entriLaju = petaBatasLaju.get(alamatIP);
	const waktuSekarang = Date.now();

	if (!entriLaju || waktuSekarang - entriLaju.waktuMulai > JENDELA_WAKTU_BATAS_LAJU_MS) {
		entriLaju = { jumlah: 0, waktuMulai: waktuSekarang };
	}

	entriLaju.jumlah += 1;
	petaBatasLaju.set(alamatIP, entriLaju);

	if (entriLaju.jumlah > BATAS_LAJU_UPLOAD) {
		catatPeringatanAman(
			`Batas laju upload terlampaui untuk ${alamatIP} ` + `(${entriLaju.jumlah} > ${BATAS_LAJU_UPLOAD})`
		);
		return respon.status(429).json({
			error: "Terlalu banyak permintaan upload",
		});
	}

	lanjutkan();
}

/**
 * Membersihkan entri batas laju yang sudah kadaluarsa
 */
function bersihkanEntriBatasLaju() {
	const waktuSekarang = Date.now();
	petaBatasLaju.forEach((nilai, kunci) => {
		if (waktuSekarang - nilai.waktuMulai > JENDELA_WAKTU_BATAS_LAJU_MS * 2) {
			petaBatasLaju.delete(kunci);
		}
	});
}

// Jadwalkan pembersihan berkala untuk entri batas laju
setInterval(bersihkanEntriBatasLaju, JENDELA_WAKTU_BATAS_LAJU_MS);

// ============================================
// KONFIGURASI MULTER UNTUK UPLOAD
// ============================================

/**
 * Konfigurasi multer untuk menangani upload file
 */
const konfigurasiUnggah = multer({
	storage: konfigurasiPenyimpanan,
	limits: {
		fileSize: 50 * 1024 * 1024, // Maksimal 50MB
	},
	fileFilter: (permintaan, file, callback) => {
		const ekstensiFile = path.extname(file.originalname || "").toLowerCase();

		if (!EKSTENSI_DIIZINKAN.has(ekstensiFile)) {
			// Tandai error validasi di objek permintaan
			permintaan._errorValidasiFile = "Tipe file tidak diizinkan";
			return callback(null, false);
		}

		callback(null, true);
	},
});

// ============================================
// INISIALISASI APLIKASI EXPRESS
// ============================================

const aplikasi = express();

// Middleware dasar
aplikasi.use(cors());
aplikasi.use(express.json());

// Middleware untuk menyajikan file yang sudah diunggah
aplikasi.use("/files", express.static(DIREKTORI_UPLOAD, { index: false }));

// ============================================
// KONFIGURASI UNGGAH KE LAYANAN PUBLIK
// ============================================

/**
 * Menentukan apakah akan menggunakan layanan publik 0x0.st
 */
const GUNAKAN_LAYANAN_0X0 =
	process.env.EMAIL_HELPER_UPLOAD_TO_0X0 === "true" || process.env.EMAIL_HELPER_PUBLIC_HOST === "0x0.st";

// ============================================
// HANDLER UNGGAH DENGAN ERROR WRAPPER
// ============================================

/**
 * Handler untuk upload file dengan penanganan error yang lebih baik
 */
function handlerUnggahFile(permintaan, respon, lanjutkan) {
	konfigurasiUnggah.single("file")(permintaan, respon, function (error) {
		if (error) {
			if (error.code === "LIMIT_FILE_SIZE") {
				return respon.status(413).json({
					error: "File terlalu besar",
				});
			}

			if (error.message && error.message.includes("Tipe file tidak diizinkan")) {
				return respon.status(400).json({
					error: "Tipe file tidak diizinkan",
				});
			}

			catatError("Error upload (tak terduga):", error);
			return respon.status(500).json({
				error: "Error internal saat upload",
			});
		}

		lanjutkan();
	});
}

// ============================================
// ENDPOINT UNTUK UPLOAD FILE SEMENTARA
// ============================================

/**
 * Endpoint untuk mengunggah file sementara
 */
aplikasi.post("/upload-temp", middlewareBatasLaju, handlerUnggahFile, async (permintaan, respon) => {
	// Validasi: periksa apakah file ditolak oleh validasi
	if (permintaan._errorValidasiFile) {
		return respon.status(400).json({
			error: permintaan._errorValidasiFile,
		});
	}

	// Validasi: pastikan ada file yang diunggah
	if (!permintaan.file) {
		return respon.status(400).json({
			error: "Tidak ada file yang diunggah",
		});
	}

	// Validasi ukuran file (double-check)
	if (permintaan.file && permintaan.file.size > 50 * 1024 * 1024) {
		return respon.status(413).json({
			error: "File terlalu besar",
		});
	}

	// Hitung waktu kedaluwarsa
	const waktuKedaluwarsa = Date.now() + JAM_MASA_BERLAKU * 60 * 60 * 1000;

	/**
	 * Membersihkan nama file asli untuk menghindari serangan path injection
	 */
	function bersihkanNamaFileAsli(namaFileAsli) {
		const namaDasar = path.basename(namaFileAsli || "");
		const namaBersih = namaDasar
			.replace(/[^\w.\-]+/g, "_") // Ganti karakter tidak aman dengan underscore
			.slice(0, 255); // Batasi panjang nama
		return namaBersih;
	}

	const namaBersih = bersihkanNamaFileAsli(permintaan.file.originalname);

	// Metadata file yang akan disimpan
	const metadataFile = {
		namaAsli: namaBersih,
		namaFile: permintaan.file.filename,
		ukuran: permintaan.file.size,
		waktuKedaluwarsa: waktuKedaluwarsa,
	};

	// Simpan metadata dalam file JSON terpisah
	fs.writeFileSync(path.join(DIREKTORI_UPLOAD, `${permintaan.file.filename}.json`), JSON.stringify(metadataFile));

	// Jika diaktifkan, coba unggah ke layanan publik 0x0.st
	if (GUNAKAN_LAYANAN_0X0) {
		try {
			const FormData = require("form-data");
			const formData = new FormData();
			const jalurFileLokal = path.join(DIREKTORI_UPLOAD, permintaan.file.filename);

			formData.append("file", fs.createReadStream(jalurFileLokal), {
				filename: permintaan.file.originalname,
			});

			const responFetch = await fetch("https://0x0.st", {
				method: "POST",
				body: formData,
				headers: formData.getHeaders(),
			});

			const teksRespon = (await responFetch.text()).trim();

			if (responFetch.ok && teksRespon && teksRespon.startsWith("http")) {
				const urlPublik = teksRespon;

				// Perbarui metadata dengan URL publik
				metadataFile.urlPublik = urlPublik;
				fs.writeFileSync(
					path.join(DIREKTORI_UPLOAD, `${permintaan.file.filename}.json`),
					JSON.stringify(metadataFile)
				);

				// Hapus file lokal untuk menghemat ruang disk
				try {
					fs.unlinkSync(jalurFileLokal);
				} catch (error) {
					// Abaikan error jika gagal menghapus
				}

				return respon.json({
					url: urlPublik,
					waktuKedaluwarsa: waktuKedaluwarsa,
				});
			} else {
				// Hindari mencatat isi respon yang mungkin sensitif
				catatPeringatanAman("Unggah ke 0x0.st gagal", responFetch.status);
			}
		} catch (error) {
			catatError("Error unggah publik:", error);
		}
	}

	// Fallback ke URL lokal jika unggah publik gagal atau tidak diaktifkan
	const urlLokal = `${permintaan.protocol}://${permintaan.get("host")}/files/${permintaan.file.filename}`;

	respon.json({
		url: urlLokal,
		waktuKedaluwarsa: waktuKedaluwarsa,
	});
});

// ============================================
// HANDLER ERROR UMUM UNTUK UPLOAD
// ============================================

/**
 * Handler error umum untuk menangani error upload dengan lebih baik
 */
aplikasi.use(function (error, permintaan, respon, lanjutkan) {
	if (!error) return lanjutkan();

	if (error.code === "LIMIT_FILE_SIZE") {
		return respon.status(413).json({
			error: "File terlalu besar",
		});
	}

	if (error.message && error.message.includes("Tipe file tidak diizinkan")) {
		return respon.status(400).json({
			error: "Tipe file tidak diizinkan",
		});
	}

	catatError("Error upload:", error);
	return respon.status(500).json({
		error: "Error internal saat upload",
	});
});

// ============================================
// TUGAS BERKALA: PEMBERSIHAN FILE KADALUARSA
// ============================================

/**
 * Membersihkan file yang sudah melewati masa berlaku
 */
function bersihkanFileKadaluarsa() {
	try {
		const daftarFile = fs.readdirSync(DIREKTORI_UPLOAD);
		const waktuSekarang = Date.now();

		daftarFile.forEach(namaFile => {
			// Lewati file metadata
			if (namaFile.endsWith(".json")) return;

			const jalurFile = path.join(DIREKTORI_UPLOAD, namaFile);
			const jalurMetadata = path.join(DIREKTORI_UPLOAD, `${namaFile}.json`);
			let harusDihapus = false;

			if (fs.existsSync(jalurMetadata)) {
				try {
					const metadata = JSON.parse(fs.readFileSync(jalurMetadata, "utf8"));
					if (metadata.waktuKedaluwarsa && metadata.waktuKedaluwarsa < waktuSekarang) {
						harusDihapus = true;
					}
				} catch (error) {
					// Jika metadata rusak, anggap file harus dihapus
					harusDihapus = true;
				}
			} else {
				// Jika tidak ada metadata, hapus file yang lebih lama dari 7 hari
				try {
					const statistik = fs.statSync(jalurFile);
					const batasWaktu = 7 * 24 * 60 * 60 * 1000; // 7 hari
					if (waktuSekarang - statistik.mtimeMs > batasWaktu) {
						harusDihapus = true;
					}
				} catch (error) {
					// Jika tidak bisa membaca statistik, anggap harus dihapus
					harusDihapus = true;
				}
			}

			if (harusDihapus) {
				try {
					fs.unlinkSync(jalurFile);
				} catch (error) {
					// Abaikan error jika gagal menghapus file
				}

				try {
					fs.unlinkSync(jalurMetadata);
				} catch (error) {
					// Abaikan error jika gagal menghapus metadata
				}
			}
		});
	} catch (error) {
		catatError("Error pembersihan:", error);
	}
}

// Jadwalkan pembersihan setiap jam
setInterval(bersihkanFileKadaluarsa, 60 * 60 * 1000);

// ============================================
// ENDPOINT KESEHATAN (HEALTH CHECK)
// ============================================

/**
 * Endpoint untuk memeriksa kesehatan server
 */
aplikasi.get("/health", (permintaan, respon) => {
	respon.json({
		ok: true,
		waktu: new Date().toISOString(),
		direktoriUpload: DIREKTORI_UPLOAD,
	});
});

// ============================================
// FUNGSI UNTUK MEMBUAT APLIKASI (UNTUK TESTING)
// ============================================

/**
 * Membuat dan mengembalikan instance aplikasi Express
 * Fungsi ini berguna untuk testing atau penggunaan sebagai modul
 * @returns {Object} Instance aplikasi Express yang sudah dikonfigurasi
 */
function buatAplikasi() {
	// Menggunakan instance aplikasi global yang sudah dikonfigurasi
	// yang sudah memiliki semua middleware, rute, dan handler
	return aplikasi;
}

// ============================================
// MENJALANKAN SERVER JIKA DIEKSEKUSI LANGSUNG
// ============================================

if (require.main === module) {
	const aplikasiServer = buatAplikasi();

	aplikasiServer.listen(PORT, () => {
		catatLogAman(`Server helper email berjalan di port ${PORT}`);
		catatLogAman(`Endpoint upload: POST http://localhost:${PORT}/upload-temp`);
		catatLogAman(`(gunakan field form dengan nama 'file')`);
		catatLogAman(`Unggah publik ke 0x0.st: ${GUNAKAN_LAYANAN_0X0 ? "YA" : "TIDAK"}`);
		catatLogAman(`Masa berlaku file: ${JAM_MASA_BERLAKU} jam`);
	});
}

// ============================================
// EKSPOR MODUL
// ============================================

module.exports = {
	buatAplikasi,
	DIREKTORI_UPLOAD,
	JAM_MASA_BERLAKU,
	EKSTENSI_DIIZINKAN,
};
