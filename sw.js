/**
 * Service Worker untuk Backend Studio.
 * Bertanggung jawab untuk meng-intercept permintaan API dan meneruskannya ke aplikasi utama.
 * File ini berjalan di thread terpisah dan tidak memiliki akses ke DOM.
 */

// ================================
// KONSTANTA KONFIGURASI
// ================================

/**
 * Prefix untuk endpoint API yang akan di-intercept.
 * Hanya permintaan yang dimulai dengan prefix ini yang akan diproses oleh Service Worker.
 */
const PREFIX_ENDPOINT_API = "/api/";

/**
 * Waktu tunggu maksimum (dalam milidetik) untuk response dari aplikasi utama
 * sebelum fallback ke jaringan.
 */
const WAKTU_TUNGGU_RESPONSE_MS = 3000;

/**
 * Pola regex untuk mengenali file statis yang tidak boleh di-intercept.
 * Termasuk ekstensi file umum untuk assets dan source code.
 */
const POLA_FILE_STATIS = /\.(js|css|png|jpg|jpeg|gif|ico|json|map|tsx|ts|woff2?|svg|webp|avif)$/;

/**
 * Daftar path yang menandakan HMR (Hot Module Replacement) atau alat development.
 * Request ke path ini akan dilewatkan langsung ke jaringan.
 */
const PATH_PENGEMBANGAN = [
	"/__", // Webpack dev server
	"/@", // Vite HMR
	"sockjs", // SockJS untuk WebSocket
	"/node_modules/",
];

// ================================
// REGISTRASI SERVICE WORKER
// ================================

/**
 * Event handler untuk fase install Service Worker.
 * Mempercepat aktivasi dengan melewati fase waiting.
 */
self.addEventListener("install", event => {
	console.info("[Service Worker] Fase install dimulai");
	self.skipWaiting();
});

/**
 * Event handler untuk fase activate Service Worker.
 * Mengklaim kontrol langsung atas semua klien yang aktif.
 */
self.addEventListener("activate", event => {
	console.info("[Service Worker] Fase activate dimulai");
	event.waitUntil(self.clients.claim());
});

// ================================
// INTERCEPT PERMINTAAN
// ================================

/**
 * Event handler untuk permintaan jaringan (fetch).
 * Mengintercept permintaan API dan meneruskannya ke aplikasi utama.
 */
self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);

	// Tentukan apakah permintaan ini harus di-intercept atau dilewatkan
	const apakahHarusDiIntercept = apakahPermintaanHarusDiIntercept(url, event.request);

	if (!apakahHarusDiIntercept) {
		// Biarkan permintaan langsung ke jaringan tanpa processing
		return;
	}

	console.info(`[Service Worker] Mengintercept: ${event.request.method} ${url.pathname}`);
	event.respondWith(prosesPermintaan(event));
});

/**
 * Menentukan apakah sebuah permintaan harus di-intercept oleh Service Worker.
 *
 * @param {URL} url - URL objek dari permintaan
 * @param {Request} request - Objek Request asli
 * @returns {boolean} true jika harus di-intercept, false jika tidak
 */
function apakahPermintaanHarusDiIntercept(url, request) {
	// Cek jika ini adalah file statis
	if (POLA_FILE_STATIS.test(url.pathname)) {
		return false;
	}

	// Cek jika ini adalah path pengembangan/HMR
	const adalahPathPengembangan = PATH_PENGEMBANGAN.some(
		path => url.pathname.startsWith(path) || url.pathname.includes(path)
	);

	if (adalahPathPengembangan) {
		return false;
	}

	// Cek jika ini adalah cross-origin request
	const adalahCrossOrigin = url.hostname !== self.location.hostname;
	if (adalahCrossOrigin) {
		return false;
	}

	// Cek jika ini adalah API endpoint
	const adalahEndpointApi = url.pathname.startsWith(PREFIX_ENDPOINT_API);
	if (!adalahEndpointApi) {
		return false;
	}

	return true;
}

// ================================
// PEMROSESAN PERMINTAAN UTAMA
// ================================

/**
 * Memproses permintaan yang di-intercept dengan strategi fallback bertingkat:
 * 1. Coba dapatkan response dari aplikasi utama (klien)
 * 2. Jika timeout, coba cache
 * 3. Jika tidak ada di cache, coba jaringan
 * 4. Jika semua gagal, kembalikan error fallback
 *
 * @param {FetchEvent} event - Event fetch yang di-intercept
 * @returns {Promise<Response>} Response untuk permintaan
 */
async function prosesPermintaan(event) {
	try {
		// Coba dapatkan response dari aplikasi utama (klien)
		const responseDariKlien = await dapatkanResponseDariKlien(event);

		if (responseDariKlien) {
			console.info(`[Service Worker] Response dari klien: ${responseDariKlien.status}`);
			return responseDariKlien;
		}

		// Jika klien tidak merespons, coba cache
		const responseDariCache = await dapatkanResponseDariCache(event.request);
		if (responseDariCache) {
			console.info("[Service Worker] Response dari cache");
			return responseDariCache;
		}

		// Jika tidak ada di cache, coba jaringan dengan fallback
		const responseDariJaringan = await dapatkanResponseDariJaringan(event);
		if (responseDariJaringan) {
			console.info(`[Service Worker] Response dari jaringan: ${responseDariJaringan.status}`);
			return responseDariJaringan;
		}

		// Jika semua gagal, kembalikan error fallback
		return buatResponseErrorFallback(event.request);
	} catch (error) {
		console.error("[Service Worker] Error saat memproses permintaan:", error);
		return buatResponseErrorFallback(event.request, error.message);
	}
}

// ================================
// STRATEGI 1: RESPONSE DARI APLIKASI UTAMA (KLIEN)
// ================================

/**
 * Mencoba mendapatkan response dari aplikasi utama (klien) melalui MessageChannel.
 * Menggunakan timeout untuk mencegah blocking jika klien tidak merespons.
 *
 * @param {FetchEvent} event - Event fetch yang di-intercept
 * @returns {Promise<Response|null>} Response dari klien atau null jika timeout/gagal
 */
async function dapatkanResponseDariKlien(event) {
	// Dapatkan semua klien (tab) yang aktif
	const semuaKlien = await self.clients.matchAll({ type: "window" });

	// Prioritaskan tab yang visible, fallback ke tab pertama yang ditemukan
	const klienAktif = semuaKlien.find(klien => klien.visibilityState === "visible") || semuaKlien[0];

	if (!klienAktif) {
		console.info("[Service Worker] Tidak ada klien aktif yang ditemukan");
		return null;
	}

	// Siapkan data permintaan untuk dikirim ke klien
	const dataPermintaan = await siapkanDataPermintaan(event);

	// Kirim permintaan ke klien dan tunggu response
	return new Promise(resolve => {
		const channel = new MessageChannel();
		let sudahSelesai = false;

		// Setup timeout untuk mencegah blocking tak terbatas
		const idTimeout = setTimeout(() => {
			if (sudahSelesai) return;
			sudahSelesai = true;
			channel.port1.onmessage = null;
			console.warn(`[Service Worker] Timeout menunggu response dari klien (${WAKTU_TUNGGU_RESPONSE_MS}ms)`);
			resolve(null);
		}, WAKTU_TUNGGU_RESPONSE_MS);

		// Handler untuk message dari klien
		channel.port1.onmessage = pesan => {
			if (sudahSelesai) return; // Abaikan response yang datang terlambat
			clearTimeout(idTimeout);
			sudahSelesai = true;

			try {
				const responseKlien = prosesResponseDariKlien(pesan.data);
				resolve(responseKlien);
			} catch (error) {
				console.error("[Service Worker] Error memproses response dari klien:", error);
				resolve(null);
			}
		};

		// Kirim permintaan ke klien
		try {
			klienAktif.postMessage(
				{
					type: "INTERCEPT_REQUEST",
					payload: {
						id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
						url: event.request.url,
						method: event.request.method,
						headers: dataPermintaan.headers,
						body: dataPermintaan.body,
					},
				},
				[channel.port2]
			);
		} catch (error) {
			clearTimeout(idTimeout);
			console.warn("[Service Worker] Gagal mengirim pesan ke klien:", error);
			resolve(null);
		}
	});
}

/**
 * Mempersiapkan data permintaan untuk dikirim ke klien.
 * Mengekstrak body dan headers dari Request objek.
 *
 * @param {FetchEvent} event - Event fetch yang di-intercept
 * @returns {Promise<Object>} Data permintaan yang sudah disiapkan
 */
async function siapkanDataPermintaan(event) {
	const method = (event.request.method || "GET").toUpperCase();
	const methodMemilikiBody = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

	let body = "";
	if (methodMemilikiBody) {
		try {
			// Clone request untuk membaca body tanpa mengonsumsi yang asli
			const clonedRequest = event.request.clone();
			body = await clonedRequest.text();
		} catch (error) {
			console.warn("[Service Worker] Gagal membaca body request:", error);
			body = "";
		}
	}

	// Ekstrak headers ke objek biasa
	const headers = {};
	for (const [key, value] of event.request.headers.entries()) {
		headers[key] = value;
	}

	return { body, headers };
}

/**
 * Memproses data response dari klien menjadi Response objek.
 *
 * @param {Object} data - Data response dari klien
 * @returns {Response|null} Response objek atau null jika data tidak valid
 */
function prosesResponseDariKlien(data) {
	if (!data || !data.response) {
		return null;
	}

	const { response } = data;

	// Bangun headers dari response klien
	const headers = new Headers();

	if (Array.isArray(response.headers)) {
		// Format: [{ key: 'Content-Type', value: 'application/json' }]
		response.headers.forEach(header => {
			if (header && header.key) {
				headers.append(String(header.key), String(header.value || ""));
			}
		});
	} else if (response.headers && typeof response.headers === "object") {
		// Format: { 'Content-Type': 'application/json' }
		Object.entries(response.headers).forEach(([key, value]) => {
			headers.append(key, String(value || ""));
		});
	}

	// Siapkan body response
	let body = null;
	if (response.body !== null && response.body !== undefined) {
		body = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
	}

	// Bangun Response objek
	return new Response(body, {
		status: response.status || 200,
		headers: headers,
	});
}

// ================================
// STRATEGI 2: RESPONSE DARI CACHE
// ================================

/**
 * Mencoba mendapatkan response dari cache.
 *
 * @param {Request} request - Request objek asli
 * @returns {Promise<Response|null>} Response dari cache atau null jika tidak ditemukan
 */
async function dapatkanResponseDariCache(request) {
	try {
		if (typeof caches !== "undefined" && typeof caches.match === "function") {
			const responseTersimpan = await caches.match(request);
			if (responseTersimpan) {
				return responseTersimpan;
			}
		}
	} catch (error) {
		console.warn("[Service Worker] Error saat mengakses cache:", error);
	}

	return null;
}

// ================================
// STRATEGI 3: RESPONSE DARI JARINGAN
// ================================

/**
 * Mencoba mendapatkan response dari jaringan dengan penanganan khusus untuk testing.
 *
 * @param {FetchEvent} event - Event fetch yang di-intercept
 * @returns {Promise<Response|null>} Response dari jaringan atau null jika gagal
 */
async function dapatkanResponseDariJaringan(event) {
	// Periksa header khusus untuk testing
	const delayTestingMs = Number(event.request.headers.get("x-sw-test-delay") || 0);
	const urlTesting = event.request.headers.get("x-sw-test-network-url");

	// Terapkan delay jika diperlukan untuk testing
	if (delayTestingMs > 0) {
		await new Promise(resolve => setTimeout(resolve, delayTestingMs));
	}

	try {
		let requestUntukFetch = event.request;

		// Gunakan URL khusus untuk testing jika disediakan
		if (urlTesting) {
			console.info(`[Service Worker] Menggunakan URL testing: ${urlTesting}`);
			requestUntukFetch = new Request(urlTesting, {
				method: event.request.method,
				headers: event.request.headers,
				body: event.request.body,
				mode: event.request.mode,
				credentials: event.request.credentials,
				cache: event.request.cache,
				redirect: event.request.redirect,
				referrer: event.request.referrer,
				integrity: event.request.integrity,
			});
		}

		const responseJaringan = await fetch(requestUntukFetch);

		// Tambahkan header untuk identifikasi source (hanya untuk testing/debugging)
		const headersDenganMetadata = new Headers(responseJaringan.headers);
		headersDenganMetadata.set("x-sw-source", "jaringan");

		// Clone response untuk mengambil body
		const body = await responseJaringan.clone().text();

		return new Response(body, {
			status: responseJaringan.status,
			statusText: responseJaringan.statusText,
			headers: headersDenganMetadata,
		});
	} catch (error) {
		console.warn("[Service Worker] Fetch ke jaringan gagal:", error);
		return null;
	}
}

// ================================
// FALLBACK DAN ERROR HANDLING
// ================================

/**
 * Membuat response error fallback ketika semua strategi gagal.
 *
 * @param {Request} request - Request objek asli
 * @param {string} detailError - Detail error (opsional)
 * @returns {Response} Response error dengan format JSON
 */
function buatResponseErrorFallback(request, detailError = "") {
	const pesanError = {
		error: true,
		message: "Service Worker tidak dapat memproses permintaan",
		detail: detailError,
		timestamp: new Date().toISOString(),
		path: new URL(request.url).pathname,
		method: request.method,
	};

	return new Response(JSON.stringify(pesanError, null, 2), {
		status: 503, // Service Unavailable
		statusText: "Service Worker Error",
		headers: {
			"Content-Type": "application/json",
			"x-sw-error": "fallback",
		},
	});
}

// ================================
// UTILITAS UNTUK TESTING
// ================================

/**
 * Mengekspos handler utama untuk keperluan testing.
 * Hanya tersedia di lingkungan development/testing.
 */
if (typeof globalThis !== "undefined") {
	globalThis.__sw_handleRequest = prosesPermintaan;
	globalThis.__sw_konfigurasi = {
		PREFIX_ENDPOINT_API,
		WAKTU_TUNGGU_RESPONSE_MS,
	};
}

/**
 * Handler untuk message global dari lingkungan testing.
 * Memungkinkan testing framework untuk mengirim response langsung ke Service Worker.
 */
self.addEventListener("message", event => {
	try {
		const { type, id, response } = event.data || {};

		if (type === "TEST_RESPONSE" && id && response) {
			// Handler untuk testing framework
			const eventTesting = {
				request: {
					url: response.url || "http://localhost/test",
					method: response.method || "GET",
				},
			};

			// Log untuk debugging testing
			console.info(`[Service Worker] Menerima response testing: ${id}`);
		}
	} catch (error) {
		// Abaikan error di message handler
	}
});

/**
 * Log saat Service Worker berhasil dimuat.
 */
console.info("[Service Worker] Backend Studio Service Worker berhasil dimuat");
