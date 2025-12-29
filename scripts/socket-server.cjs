"use strict";

/**
 * Server Socket.IO untuk aplikasi real-time logging dan broadcasting
 * Server ini menyediakan koneksi WebSocket dengan autentikasi, batas kecepatan, dan manajemen ruangan
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ============================================
// KONFIGURASI UTAMA
// ============================================

const PORT = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 9150;
const TOKEN_AUTENTIKASI = process.env.SOCKET_AUTH_TOKEN || "";

// ============================================
// INISIALISASI APLIKASI EXPRESS
// ============================================

const aplikasi = express();

/**
 * Mengonfigurasi CORS (Cross-Origin Resource Sharing)
 * Mengizinkan penentuan asal yang diizinkan melalui SOCKET_ALLOWED_ORIGINS (dipisahkan koma)
 */
const daftarAsalDiizinkan = (process.env.SOCKET_ALLOWED_ORIGINS || "")
	.split(",")
	.map(string => string.trim())
	.filter(Boolean);

const isProduksi = process.env.NODE_ENV === "production";
const MODE_SENYAP_SOCKET = process.env.SOCKET_SERVER_QUIET === "1" || process.env.SOCKET_SERVER_QUIET === "true";

/**
 * Strategi CORS:
 * - Jika SOCKET_ALLOWED_ORIGINS disetel, gunakan daftar izin eksplisit
 * - Dalam produksi tanpa asal yang diizinkan, blokir secara default (tolak asal tidak dikenal)
 * - Dalam pengembangan, izinkan semua asal untuk kemudahan
 */
function konfigurasikanCORS() {
	if (daftarAsalDiizinkan.length > 0) {
		if (!MODE_SENYAP_SOCKET) {
			console.log("[socket-server] Daftar izin CORS:", daftarAsalDiizinkan.join(","));
		}

		aplikasi.use(
			cors({
				origin: (asal, callback) => {
					// Izinkan permintaan tanpa asal (seperti server-ke-server)
					if (!asal) {
						return callback(null, true);
					}

					if (daftarAsalDiizinkan.includes(asal)) {
						return callback(null, true);
					}

					return callback(new Error("Tidak diizinkan oleh CORS"), false);
				},
			})
		);
	} else {
		// Dalam produksi, bersikap ketat dan blokir asal tidak dikenal
		if (isProduksi) {
			if (!MODE_SENYAP_SOCKET) {
				console.warn(
					"[socket-server] SOCKET_ALLOWED_ORIGINS tidak disetel dan berjalan dalam produksi - " +
						"semua permintaan lintas asal akan diblokir"
				);
			}

			aplikasi.use(cors({ origin: false }));
		} else {
			if (!MODE_SENYAP_SOCKET) {
				console.log("[socket-server] Berjalan dalam mode pengembangan - mengizinkan semua asal");
			}

			aplikasi.use(cors());
		}
	}
}

konfigurasikanCORS();
aplikasi.use(express.json());

// ============================================
// INISIALISASI SERVER SOCKET.IO
// ============================================

const server = http.createServer(aplikasi);
const io = new Server(server, {
	cors: {
		origin: daftarAsalDiizinkan.length > 0 ? daftarAsalDiizinkan : isProduksi ? [] : "*",
	},
	// allowEIO3: true // Jika memerlukan klien engine.io lama
});

// ============================================
// MANAJEMEN BATAS KECEPATAN UNTUK SOCKET
// ============================================

/**
 * Peta untuk melacak batas kecepatan per socket: socketId -> stempel waktu
 */
const jendelaWaktuBatasSocketMs = Number(process.env.SOCKET_RATE_WINDOW_MS || 5000); // Default 5 detik
const batasMaksimalSocket = Number(process.env.SOCKET_RATE_LIMIT || 5); // Default 5 pesan per jendela
const petaBatasKecepatanSocket = new Map();

/**
 * Memeriksa apakah socket melebihi batas kecepatan
 * @param {string} idSocket - ID socket yang akan diperiksa
 * @returns {boolean} True jika melebihi batas, false jika tidak
 */
function apakahSocketMelebihiBatasKecepatan(idSocket) {
	const waktuSekarang = Date.now();
	const arrayStempelWaktu = petaBatasKecepatanSocket.get(idSocket) || [];

	// Filter stempel waktu yang masih dalam jendela waktu
	const stempelWaktuTerbaru = arrayStempelWaktu.filter(
		stempelWaktu => waktuSekarang - stempelWaktu < jendelaWaktuBatasSocketMs
	);

	// Tambahkan stempel waktu saat ini
	stempelWaktuTerbaru.push(waktuSekarang);

	// Simpan dengan batasan jumlah untuk mencegah penggunaan memori berlebihan
	petaBatasKecepatanSocket.set(idSocket, stempelWaktuTerbaru.slice(-batasMaksimalSocket * 2));

	return stempelWaktuTerbaru.length > batasMaksimalSocket;
}

// ============================================
// MIDDLEWARE AUTENTIKASI SOCKET.IO
// ============================================

/**
 * Middleware untuk memeriksa token autentikasi
 * Jika SOCKET_AUTH_TOKEN disetel di environment, token diperlukan
 * Token dapat dikirim melalui query, auth, atau header Authorization
 */
io.use((socket, lanjutkan) => {
	try {
		// Jika tidak ada token yang dikonfigurasi, lanjutkan tanpa autentikasi
		if (!TOKEN_AUTENTIKASI) {
			return lanjutkan();
		}

		// Ambil token dari berbagai sumber
		const token =
			socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization;

		// Normalisasi token (hapus awalan "Bearer" jika ada)
		const tokenTernormalisasi = (token || "").replace(/^Bearer\s+/i, "");

		if (tokenTernormalisasi && tokenTernormalisasi === TOKEN_AUTENTIKASI) {
			return lanjutkan();
		}

		const error = new Error("Tidak terotorisasi");
		error.data = { status: 401 };
		return lanjutkan(error);
	} catch (error) {
		return lanjutkan(error);
	}
});

// ============================================
// HANDLER KONEKSI SOCKET.IO
// ============================================

/**
 * Menangani koneksi socket baru
 */
io.on("connection", socket => {
	console.log("[socket] Klien terhubung", socket.id);

	/**
	 * Handler untuk bergabung ke ruangan (room)
	 */
	socket.on("join", ruangan => {
		socket.join(ruangan);
		console.log("[socket] Bergabung", socket.id, ruangan);
	});

	/**
	 * Handler untuk meninggalkan ruangan (room)
	 */
	socket.on("leave", ruangan => {
		socket.leave(ruangan);
		console.log("[socket] Meninggalkan", socket.id, ruangan);
	});

	/**
	 * Handler untuk menerbitkan log ke server
	 * Server akan menyiarkan ke klien lain di ruangan yang sama
	 */
	socket.on("log:publish", payload => {
		try {
			// Terapkan batas kecepatan per socket
			if (apakahSocketMelebihiBatasKecepatan(socket.id)) {
				if (!MODE_SENYAP_SOCKET) {
					console.warn(`[socket] Batas kecepatan terlampaui untuk ${socket.id}`);
				}

				socket.emit("error", { error: "rate_limited" });
				return;
			}

			// Validasi dasar dan sanitasi payload
			let payloadTersanitasi = {};

			try {
				const ukuranPayload = JSON.stringify(payload).length;

				if (ukuranPayload > 20 * 1024) {
					// Maksimal 20KB
					socket.emit("error", { error: "payload_too_large" });
					return;
				}
			} catch (errorValidasi) {
				socket.emit("error", { error: "invalid_payload" });
				return;
			}

			// Hanya izinkan field yang diharapkan dan tipe data yang sesuai
			const fieldDiizinkan = ["id", "workspaceId", "source", "level", "message", "ts"];

			for (const field of fieldDiizinkan) {
				if (field in (payload || {})) {
					payloadTersanitasi[field] = payload[field];
				}
			}

			// Validasi tipe data timestamp
			if (payloadTersanitasi.ts && typeof payloadTersanitasi.ts !== "number") {
				socket.emit("error", { error: "invalid_ts" });
				return;
			}

			// Tentukan ruangan berdasarkan workspaceId atau gunakan ruangan default
			const ruangan = payloadTersanitasi.workspaceId ? `logs:${payloadTersanitasi.workspaceId}` : "logs:all";

			if (!MODE_SENYAP_SOCKET) {
				console.info("[socket] Menerbitkan", socket.id, "ruangan", ruangan, "id", payloadTersanitasi.id);
			}

			// Siarkan payload tersanitasi ke ruangan yang sesuai
			socket.broadcast.to(ruangan).emit("log:new", payloadTersanitasi);
			socket.broadcast.to("logs:all").emit("log:new", payloadTersanitasi);

			// Kirim konfirmasi ke pengirim
			socket.emit("log:ack", { ok: true });
		} catch (error) {
			console.error("[socket] Error handler penerbitan:", error);
		}
	});

	/**
	 * Handler untuk pemutusan koneksi
	 */
	socket.on("disconnect", () => {
		console.log("[socket] Terputus", socket.id);

		// Bersihkan data batas kecepatan untuk socket ini
		petaBatasKecepatanSocket.delete(socket.id);
	});
});

// ============================================
// BATAS KECEPATAN DAN VALIDASI UNTUK ENDPOINT HTTP
// ============================================

/**
 * Konfigurasi batas kecepatan untuk endpoint HTTP /emit-log
 */
const jendelaWaktuBatasHttpMs = Number(process.env.SOCKET_RATE_WINDOW_MS || 60000);
const batasMaksimalHttp = Number(process.env.SOCKET_RATE_LIMIT || 60); // Default 60 permintaan per jendela
const petaBatasKecepatanHttp = new Map(); // alamatIP -> [stempelWaktu]

/**
 * Memeriksa apakah alamat IP melebihi batas kecepatan HTTP
 * @param {string} alamatIP - Alamat IP yang akan diperiksa
 * @returns {boolean} True jika melebihi batas, false jika tidak
 */
function apakahMelebihiBatasKecepatanHttp(alamatIP) {
	const waktuSekarang = Date.now();
	const arrayStempelWaktu = petaBatasKecepatanHttp.get(alamatIP) || [];

	// Hapus stempel waktu lama
	const stempelWaktuTerbaru = arrayStempelWaktu.filter(
		stempelWaktu => waktuSekarang - stempelWaktu < jendelaWaktuBatasHttpMs
	);

	// Tambahkan stempel waktu saat ini
	stempelWaktuTerbaru.push(waktuSekarang);

	// Simpan kembali
	petaBatasKecepatanHttp.set(alamatIP, stempelWaktuTerbaru);

	return stempelWaktuTerbaru.length > batasMaksimalHttp;
}

// ============================================
// ENDPOINT HTTP UNTUK EMIT LOG (UNTUK TESTING)
// ============================================

/**
 * Endpoint POST /emit-log untuk menyiarkan event log melalui HTTP
 * Berguna untuk testing dan integrasi dengan sistem lain
 */
aplikasi.post("/emit-log", (permintaan, respon) => {
	const alamatIP = permintaan.ip || permintaan.headers["x-forwarded-for"] || "tidak-diketahui";

	if (apakahMelebihiBatasKecepatanHttp(String(alamatIP))) {
		return respon.status(429).json({
			error: "rate_limited",
		});
	}

	const payload = permintaan.body || {};

	// Pemeriksaan ukuran payload dasar
	try {
		const ukuranPayload = JSON.stringify(payload).length;

		if (ukuranPayload > 20 * 1024) {
			return respon.status(413).json({
				error: "payload_too_large",
			});
		}
	} catch (error) {
		return respon.status(400).json({
			error: "invalid_payload",
		});
	}

	// Validasi dasar untuk field yang diharapkan
	if (payload && payload.statusCode && typeof payload.statusCode !== "number") {
		return respon.status(400).json({
			error: "invalid_statusCode",
		});
	}

	// Tentukan ruangan berdasarkan workspaceId atau gunakan ruangan default
	const ruangan = payload.workspaceId ? `logs:${payload.workspaceId}` : "logs:all";

	// Emit ke ruangan tertentu
	io.to(ruangan).emit("log:new", payload);
	io.to("logs:all").emit("log:new", payload);

	// Juga emit ke semua klien untuk kemudahan
	io.emit("log:new", payload);

	respon.status(200).json({
		ok: true,
		emitted: payload,
		ruangan: ruangan,
	});
});

// ============================================
// ENDPOINT KESEHATAN SERVER
// ============================================

/**
 * Endpoint GET /health untuk memeriksa kesehatan server
 */
aplikasi.get("/health", (permintaan, respon) => {
	const jumlahKlienTerhubung = io.engine?.clientsCount || 0;

	respon.json({
		ok: true,
		jumlahKlien: jumlahKlienTerhubung,
		waktu: new Date().toISOString(),
	});
});

// ============================================
// MENJALANKAN SERVER
// ============================================

server.listen(PORT, () => {
	console.log(`[socket-server] Mendengarkan di port :${PORT}`);
	console.log(`[socket-server] Mode: ${isProduksi ? "Produksi" : "Pengembangan"}`);
	console.log(`[socket-server] Autentikasi token: ${TOKEN_AUTENTIKASI ? "Diperlukan" : "Tidak diperlukan"}`);
});

// ============================================
// HANDLER PENUTUPAN SERVER
// ============================================

/**
 * Menangani sinyal SIGINT untuk penutupan server yang elegan
 */
process.on("SIGINT", () => {
	console.log("[socket-server] Mematikan server...");

	// Tutup semua koneksi socket
	io.disconnectSockets();

	server.close(() => {
		console.log("[socket-server] Server dimatikan");
		process.exit(0);
	});
});

// ============================================
// EKSPOR UNTUK TESTING
// ============================================

module.exports = {
	aplikasi,
	server,
	io,
	apakahSocketMelebihiBatasKecepatan,
	apakahMelebihiBatasKecepatanHttp,
};
