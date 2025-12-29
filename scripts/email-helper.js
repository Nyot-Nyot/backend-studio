#!/usr/bin/env node

/**
 * Helper untuk mengunggah file sementara yang digunakan oleh aplikasi email
 * File ini menyediakan server sederhana untuk menerima upload file dengan TTL (masa berlaku)
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");

// ============================================
// KONFIGURASI
// ============================================

const PORT = process.env.EMAIL_HELPER_PORT || process.env.VITE_EMAIL_HELPER_PORT || 3001;
const DIREKTORI_UPLOAD = path.resolve(process.cwd(), "tmp", "email-uploads");
const JAM_MASA_BERLAKU = Number(process.env.EMAIL_HELPER_TTL_HOURS || 24);

// Mode senyap untuk menekan log yang berpotensi sensitif
const argumenBarisPerintah = process.argv.slice(2);
const MODE_SENYAP = argumenBarisPerintah.includes("--quiet") || process.env.EMAIL_HELPER_QUIET === "true";

/**
 * Fungsi untuk log yang aman (hanya menampilkan jika tidak dalam mode senyap)
 */
function logAman(...args) {
	if (!MODE_SENYAP) console.log(...args);
}

/**
 * Fungsi untuk log peringatan yang aman
 */
function logPeringatanAman(...args) {
	if (!MODE_SENYAP) console.warn(...args);
}

/**
 * Fungsi untuk log error (selalu ditampilkan)
 */
function logError(...args) {
	console.error(...args);
}

// ============================================
// INISIALISASI DIREKTORI UPLOAD
// ============================================

/**
 * Membuat direktori upload jika belum ada
 */
function inisialisasiDirektoriUpload() {
	if (!fs.existsSync(DIREKTORI_UPLOAD)) {
		fs.mkdirSync(DIREKTORI_UPLOAD, { recursive: true });
		logAman(`Direktori upload dibuat: ${DIREKTORI_UPLOAD}`);
	}
}

inisialisasiDirektoriUpload();

// ============================================
// KONFIGURASI MULTER (HANDLER UPLOAD)
// ============================================

/**
 * Daftar ekstensi file yang diperbolehkan untuk keamanan
 */
const EKSTENSI_DIIZINKAN = new Set([".zip", ".json", ".txt", ".eml", ".png", ".jpg", ".jpeg", ".gif"]);

/**
 * Konfigurasi penyimpanan untuk multer
 */
const konfigurasiPenyimpanan = multer.diskStorage({
	destination: (permintaan, file, callback) => {
		callback(null, DIREKTORI_UPLOAD);
	},
	filename: (permintaan, file, callback) => {
		const idFile = crypto.randomBytes(8).toString("hex");
		const ekstensiFile = path.extname(file.originalname) || ".zip";
		const namaFile = `${idFile}${ekstensiFile}`;
		callback(null, namaFile);
	},
});

/**
 * Middleware untuk membatasi jumlah upload per IP
 */
const BATAS_UPLOAD_PER_JAM = Number(process.env.EMAIL_HELPER_RATE_LIMIT || 20);
const JENDELA_WAKTU_BATAS_JAM = Number(process.env.EMAIL_HELPER_RATE_WINDOW_HOURS || 1) * 60 * 60 * 1000;
const petaBatasUpload = new Map();

/**
 * Middleware untuk menerapkan batas kecepatan upload
 */
function middlewareBatasKecepatan(permintaan, respon, lanjutkan) {
	const alamatIP =
		permintaan.ip || (permintaan.connection && permintaan.connection.remoteAddress) || "tidak-diketahui";

	let entriUpload = petaBatasUpload.get(alamatIP);
	const waktuSekarang = Date.now();

	// Reset jika sudah melewati jendela waktu
	if (!entriUpload || waktuSekarang - entriUpload.waktuMulai > JENDELA_WAKTU_BATAS_JAM) {
		entriUpload = {
			jumlah: 0,
			waktuMulai: waktuSekarang,
		};
	}

	entriUpload.jumlah += 1;
	petaBatasUpload.set(alamatIP, entriUpload);

	if (entriUpload.jumlah > BATAS_UPLOAD_PER_JAM) {
		logPeringatanAman(
			`Batas kecepatan upload terlampaui untuk ${alamatIP} ` + `(${entriUpload.jumlah} > ${BATAS_UPLOAD_PER_JAM})`
		);
		return respon.status(429).json({
			error: "Terlalu banyak permintaan upload",
		});
	}

	lanjutkan();
}

/**
 * Membersihkan entri batas kecepatan yang sudah kadaluarsa
 */
function bersihkanEntriBatasKecepatan() {
	const waktuSekarang = Date.now();
	petaBatasUpload.forEach((nilai, kunci) => {
		if (waktuSekarang - nilai.waktuMulai > JENDELA_WAKTU_BATAS_JAM * 2) {
			petaBatasUpload.delete(kunci);
		}
	});
}

// Jadwalkan pembersihan berkala
setInterval(bersihkanEntriBatasKecepatan, JENDELA_WAKTU_BATAS_JAM);

/**
 * Konfigurasi multer untuk menangani upload file
 */
const handlerUpload = multer({
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

// Middleware untuk menyajikan file yang sudah diupload
aplikasi.use("/files", express.static(DIREKTORI_UPLOAD, { index: false }));

/**
 * Handler error untuk upload yang gagal
 */
aplikasi.use((error, permintaan, respon, lanjutkan) => {
	if (!error) return lanjutkan();

	// Error ukuran file dari multer
	if (error.code === "LIMIT_FILE_SIZE") {
		return respon.status(413).json({
			error: "File terlalu besar",
		});
	}

	// Error validasi tipe file
	if (error.message && error.message.includes("Tipe file tidak diizinkan")) {
		return respon.status(400).json({
			error: "Tipe file tidak diizinkan",
		});
	}

	logError("Error upload file:", error);
	return respon.status(500).json({
		error: "Error internal saat upload",
	});
});

// ============================================
// FUNGSI UTILITAS
// ============================================

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

/**
 * Menyimpan metadata file dalam format JSON
 */
function simpanMetadataFile(namaFile, metadata) {
	const jalurMetadata = path.join(DIREKTORI_UPLOAD, `${namaFile}.json`);
	fs.writeFileSync(jalurMetadata, JSON.stringify(metadata, null, 2));
}

/**
 * Membaca metadata file
 */
function bacaMetadataFile(namaFile) {
	const jalurMetadata = path.join(DIREKTORI_UPLOAD, `${namaFile}.json`);

	if (!fs.existsSync(jalurMetadata)) {
		return null;
	}

	const kontenMetadata = fs.readFileSync(jalurMetadata, "utf8");
	return JSON.parse(kontenMetadata);
}

/**
 * Mengunggah file ke layanan publik 0x0.st
 */
async function unggahKeLayananPublik(jalurFileLokal, namaFileAsli) {
	try {
		const FormData = require("form-data");
		const formData = new FormData();

		formData.append("file", fs.createReadStream(jalurFileLokal), {
			filename: namaFileAsli,
		});

		const responUnggah = await fetch("https://0x0.st", {
			method: "POST",
			body: formData,
			headers: formData.getHeaders(),
		});

		const teksRespon = (await responUnggah.text()).trim();

		if (responUnggah.ok && teksRespon && teksRespon.startsWith("http")) {
			return teksRespon; // URL publik file
		} else {
			logPeringatanAman(`Unggah ke 0x0.st gagal dengan status: ${responUnggah.status}`);
			return null;
		}
	} catch (error) {
		logError("Error saat mengunggah ke layanan publik:", error);
		return null;
	}
}

// ============================================
// ENDPOINT API
// ============================================

/**
 * Endpoint untuk mengupload file sementara
 */
aplikasi.post(
	"/upload-temp",
	middlewareBatasKecepatan,
	(permintaan, respon, lanjutkan) => {
		// Gunakan handler upload dari multer
		handlerUpload.single("file")(permintaan, respon, error => {
			if (error) {
				if (error.code === "LIMIT_FILE_SIZE") {
					return respon.status(413).json({
						error: "File terlalu besar",
					});
				}
				logError("Error upload tak terduga:", error);
				return respon.status(500).json({
					error: "Error internal saat upload",
				});
			}

			// Periksa error validasi dari fileFilter
			if (permintaan._errorValidasiFile) {
				return respon.status(400).json({
					error: permintaan._errorValidasiFile,
				});
			}

			lanjutkan();
		});
	},
	async (permintaan, respon) => {
		// Validasi: pastikan file berhasil diupload
		if (!permintaan.file) {
			return respon.status(400).json({
				error: "Tidak ada file yang diunggah",
			});
		}

		// Validasi ukuran file (double-check)
		if (permintaan.file.size > 50 * 1024 * 1024) {
			return respon.status(413).json({
				error: "File terlalu besar",
			});
		}

		// Hitung waktu kedaluwarsa
		const waktuKedaluwarsa = Date.now() + JAM_MASA_BERLAKU * 60 * 60 * 1000;

		// Siapkan metadata file
		const namaBersih = bersihkanNamaFileAsli(permintaan.file.originalname);
		const metadataFile = {
			namaAsli: namaBersih,
			namaFile: permintaan.file.filename,
			ukuran: permintaan.file.size,
			waktuKedaluwarsa: waktuKedaluwarsa,
			waktuUpload: Date.now(),
		};

		// Simpan metadata
		simpanMetadataFile(permintaan.file.filename, metadataFile);

		// Coba unggah ke layanan publik jika diaktifkan
		const GUNAKAN_LAYANAN_PUBLIK =
			process.env.EMAIL_HELPER_UPLOAD_TO_0X0 === "true" || process.env.EMAIL_HELPER_PUBLIC_HOST === "0x0.st";

		if (GUNAKAN_LAYANAN_PUBLIK) {
			const jalurFileLokal = path.join(DIREKTORI_UPLOAD, permintaan.file.filename);
			const urlPublik = await unggahKeLayananPublik(jalurFileLokal, permintaan.file.originalname);

			if (urlPublik) {
				// Update metadata dengan URL publik
				metadataFile.urlPublik = urlPublik;
				simpanMetadataFile(permintaan.file.filename, metadataFile);

				// Hapus file lokal untuk menghemat ruang disk
				try {
					fs.unlinkSync(jalurFileLokal);
				} catch (error) {
					// Abaikan error jika gagal menghapus
				}

				return respon.json({
					url: urlPublik,
					waktuKedaluwarsa: waktuKedaluwarsa,
					menggunakanLayananPublik: true,
				});
			}
		}

		// Fallback ke URL lokal
		const urlLokal = `${permintaan.protocol}://${permintaan.get("host")}/files/${permintaan.file.filename}`;

		respon.json({
			url: urlLokal,
			waktuKedaluwarsa: waktuKedaluwarsa,
			menggunakanLayananPublik: false,
		});
	}
);

/**
 * Endpoint kesehatan untuk monitoring
 */
aplikasi.get("/health", (permintaan, respon) => {
	respon.json({
		status: "sehat",
		waktu: new Date().toISOString(),
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

			// Periksa berdasarkan metadata
			if (fs.existsSync(jalurMetadata)) {
				const metadata = bacaMetadataFile(namaFile);
				if (metadata && metadata.waktuKedaluwarsa && metadata.waktuKedaluwarsa < waktuSekarang) {
					harusDihapus = true;
				}
			} else {
				// Jika tidak ada metadata, hapus file yang lebih lama dari 7 hari
				try {
					const statistik = fs.statSync(jalurFile);
					const umurFile = waktuSekarang - statistik.mtimeMs;
					const BATAS_UMUR_TANPA_METADATA = 7 * 24 * 60 * 60 * 1000; // 7 hari

					if (umurFile > BATAS_UMUR_TANPA_METADATA) {
						harusDihapus = true;
					}
				} catch (error) {
					// Jika error saat membaca statistik, anggap harus dihapus
					harusDihapus = true;
				}
			}

			// Hapus file dan metadata jika diperlukan
			if (harusDihapus) {
				try {
					if (fs.existsSync(jalurFile)) {
						fs.unlinkSync(jalurFile);
						logAman(`File kadaluarsa dihapus: ${namaFile}`);
					}
				} catch (error) {
					logPeringatanAman(`Gagal menghapus file: ${namaFile}`, error);
				}

				try {
					if (fs.existsSync(jalurMetadata)) {
						fs.unlinkSync(jalurMetadata);
					}
				} catch (error) {
					// Abaikan error saat menghapus metadata
				}
			}
		});
	} catch (error) {
		logError("Error saat membersihkan file kadaluarsa:", error);
	}
}

// Jadwalkan pembersihan setiap jam
setInterval(bersihkanFileKadaluarsa, 60 * 60 * 1000);

// ============================================
// MENJALANKAN SERVER
// ============================================

aplikasi.listen(PORT, () => {
	logAman(`Server helper email berjalan di port ${PORT}`);
	logAman(`Endpoint upload: POST http://localhost:${PORT}/upload-temp`);
	logAman(`(gunakan field form dengan nama 'file')`);
	logAman(`Masa berlaku file: ${JAM_MASA_BERLAKU} jam`);
	logAman(`Mode senyap: ${MODE_SENYAP ? "YA" : "TIDAK"}`);
});

// Ekspor untuk keperluan testing
module.exports = {
	aplikasi,
	DIREKTORI_UPLOAD,
	bersihkanFileKadaluarsa,
	bersihkanNamaFileAsli,
};
