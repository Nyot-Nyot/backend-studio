import {
	AlertTriangle,
	Cloud,
	Copy,
	Download,
	Eye,
	EyeOff,
	FileCode,
	FileText,
	Globe,
	Info,
	Key,
	Mail,
	Package,
	Plus,
	RefreshCw,
	Rocket,
	Server,
	ShieldCheck,
	Terminal,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import EmailExportModal from "./components/EmailExportModal";
import ExportModal from "./components/ExportModal";
import LandingPage from "./components/LandingPage";
import { PenampilLog } from "./components/LogViewer";
import { MockEditor } from "./components/MockEditor";
import { Sidebar } from "./components/Sidebar";
import { KonsolPengujian } from "./components/TestConsole";
import { KontainerToast, PesanToast, TipeToast } from "./components/Toast";
import { FEATURES } from "./config/featureFlags";
import { sendEmailViaEmailJS } from "./services/emailService";
import { generateServerCode as buildServerCode } from "./services/exportService";
import { simulateRequest } from "./services/mockEngine";
import { generateOpenApiSpec } from "./services/openApiService";
import socketClient from "./services/socketClient";
import { postErrorResponseToPort } from "./services/swHelpers";
import type { ParameterEksporEmail as EmailExportParams } from "./types";
import {
	EntriLog,
	KonfigurasiAutentikasi,
	MetodeHttp,
	MockEndpoint,
	Proyek,
	StateKonsolPengujian,
	StateTampilan,
	VariabelLingkungan,
} from "./types";

const STORAGE_KEY_PROJECTS = "api_sim_projects";
const STORAGE_KEY_MOCKS = "api_sim_mocks";
const STORAGE_KEY_ACTIVE_PROJECT = "api_sim_active_project";
const STORAGE_KEY_ENV_VARS = "api_sim_env_vars";

// Alias dengan nama Bahasa Indonesia agar kode lebih mudah dibaca
// dan kompatibel dengan nama variabel yang sudah digunakan sebelumnya.
const KUNCI_PENYIMPANAN_PROYEK = STORAGE_KEY_PROJECTS;
const KUNCI_PENYIMPANAN_MOCK = STORAGE_KEY_MOCKS;
const KUNCI_PROYEK_AKTIF = STORAGE_KEY_ACTIVE_PROJECT;
const KUNCI_VARIABEL_LINGKUNGAN = STORAGE_KEY_ENV_VARS;

const PROYEK_DEFAULT: Proyek = {
	id: "default",
	nama: "Workspace Default",
	createdAt: Date.now(),
};

// Normalisasi ringan untuk kompatibilitas runtime antara properti berbahasa
// Indonesia (`nama`, `metode`) dan yang digunakan di beberapa komponen
// dalam Bahasa Inggris (`name`, `method`). Fungsi ini memastikan UI tidak
// crash ketika ada variasi struktur data (mis. hasil impor, versi lama, dll.).
const normalizeProject = (p: any): Proyek & { name?: string } => ({
	id: p.id ?? crypto.randomUUID(),
	nama: p.nama ?? p.name ?? "",
	name: p.name ?? p.nama ?? "",
	createdAt: p.createdAt ?? Date.now(),
});

const normalizeMock = (m: any): MockEndpoint & { name?: string; method?: MetodeHttp } => ({
	id: m.id ?? crypto.randomUUID(),
	projectId: m.projectId ?? PROYEK_DEFAULT.id,
	nama: m.nama ?? m.name ?? "",
	name: m.name ?? m.nama ?? "",
	path: m.path ?? m.url ?? "/",
	metode: (m.metode ?? m.method ?? MetodeHttp.GET) as MetodeHttp,
	method: (m.method ?? m.metode ?? MetodeHttp.GET) as any,
	statusCode: m.statusCode ?? 200,
	delay: m.delay ?? 0,
	responseBody: m.responseBody ?? "",
	isActive: typeof m.isActive === "boolean" ? m.isActive : true,
	versi: m.versi ?? "1.0",
	createdAt: m.createdAt ?? Date.now(),
	requestCount: m.requestCount ?? 0,
	headers: m.headers ?? [],
	storeName: m.storeName ?? "",
	authConfig: m.authConfig ?? ({ jenis: "NONE" } as KonfigurasiAutentikasi),
});

import { dbService } from "./services/dbService";

function Aplikasi() {
	// Toggle penggunaan modal ekspor baru. Jika true, gunakan `ExportModal` dan jangan render `EmailExportModal` lama.
	const PAKAI_EXPORT_MODAL_BARU = true;

	// --- STATE APLIKASI --- //

	// State untuk tampilan aktif (dashboard, editor, pengaturan, dll)
	const [tampilanAktif, setTampilanAktif] = useState<StateTampilan>("dashboard");

	// Daftar semua proyek/workspace yang tersedia
	const [daftarProyek, setDaftarProyek] = useState<Proyek[]>([]);

	// ID proyek yang sedang aktif (dipilih pengguna)
	const [idProyekAktif, setIdProyekAktif] = useState<string>("");

	// Landing page: tunjukkan UI landing sebelum memasuki studio
	const [tampilkanLanding, setTampilkanLanding] = useState<boolean>(true);

	const handleStartStudio = () => {
		setTampilkanLanding(false);
		setTampilanAktif("dashboard");
		// Pastikan ada proyek aktif
		if (daftarProyek.length === 0) {
			setDaftarProyek([PROYEK_DEFAULT]);
			setIdProyekAktif(PROYEK_DEFAULT.id);
		} else if (!idProyekAktif) {
			setIdProyekAktif(daftarProyek[0].id);
		}
	};

	// Semua endpoint mock yang telah dibuat pengguna
	const [daftarMock, setDaftarMock] = useState<MockEndpoint[]>([]);

	// Variabel lingkungan untuk digunakan dalam response mock
	const [variabelLingkungan, setVariabelLingkungan] = useState<VariabelLingkungan[]>([]);

	// Log permintaan yang tercatat
	const [logAplikasi, setLogAplikasi] = useState<EntriLog[]>([]);

	// Daftar toast notifikasi untuk pengguna
	const [daftarToast, setDaftarToast] = useState<PesanToast[]>([]);

	// Status koneksi socket untuk real-time logging
	const [statusSocket, setStatusSocket] = useState<"connected" | "connecting" | "disconnected">("disconnected");

	// Mock yang sedang diedit (null jika membuat baru)
	const [mockYangDiedit, setMockYangDiedit] = useState<MockEndpoint | null>(null);

	// State modal untuk ekspor/deploy
	const [apakahModalDeployTerbuka, setApakahModalDeployTerbuka] = useState(false);
	const [apakahModalEmailTerbuka, setApakahModalEmailTerbuka] = useState(false);

	// State untuk proses pengiriman email
	const [sedangMengirimEmail, setSedangMengirimEmail] = useState(false);

	// API Key pengguna untuk layanan OpenRouter (disimpan di localStorage)
	const [kunciApiPengguna, setKunciApiPengguna] = useState(
		() => localStorage.getItem("api_sim_user_openrouter_key") || ""
	);

	// Untuk toggle visibility API key di input field
	const [tampilkanKunciApi, setTampilkanKunciApi] = useState(false);

	// Counter untuk memaksa re-render saat feature flag berubah
	const [penghitungFeatureFlag, setPenghitungFeatureFlag] = useState(0);

	// Status kesehatan proxy AI (null = belum dicek)
	const [statusKesehatanProxy, setStatusKesehatanProxy] = useState<boolean | null>(null);

	// Ref untuk input file import
	const refInputFile = useRef<HTMLInputElement>(null);

	// State untuk konsol pengujian
	const [stateKonsolPengujian, setStateKonsolPengujian] = useState<StateKonsolPengujian>({
		metode: MetodeHttp.GET,
		path: "/api/v1/resource",
		response: null,
	});

	// Refs untuk mencegah closure stale dalam komunikasi dengan Service Worker
	const daftarMockRef = useRef(daftarMock);
	const variabelLingkunganRef = useRef(variabelLingkungan);

	// Sinkronisasi refs dengan state terbaru
	useEffect(() => {
		daftarMockRef.current = daftarMock;
	}, [daftarMock]);

	useEffect(() => {
		variabelLingkunganRef.current = variabelLingkungan;
	}, [variabelLingkungan]);

	// --- EFEK SAMPING: PERSISTENSI PENYIMPANAN --- //

	/**
	 * Meminta browser untuk menggunakan persistent storage,
	 * mengurangi kemungkinan data dihapus oleh browser saat storage penuh.
	 */
	useEffect(() => {
		const KUNGI_SUDAH_DICEK = "api_sim_persist_checked";
		const sudahDicek = localStorage.getItem(KUNGI_SUDAH_DICEK);

		if (sudahDicek) return;

		const mintaPersistensiPenyimpanan = async () => {
			try {
				// Hanya berjalan jika browser mendukung StorageManager API
				if (navigator.storage && navigator.storage.persist) {
					const apakahSudahPersisten = await navigator.storage.persisted?.();

					if (!apakahSudahPersisten) {
						const diberikan = await navigator.storage.persist();

						if (diberikan) {
							tampilkanToast(
								"Penyimpanan persisten diaktifkan. Data Anda lebih kecil kemungkinannya terhapus.",
								"success"
							);
						} else if (import.meta.env?.DEV) {
							tampilkanToast("Browser menolak permintaan penyimpanan persisten.", "info");
						}
					}
				}
			} catch (error) {
				// Silent fail jika browser tidak mendukung API
				console.debug("API persistensi tidak didukung:", error);
			} finally {
				// Tandai bahwa kita sudah mencoba, terlepas dari dukungan browser
				localStorage.setItem(KUNGI_SUDAH_DICEK, "1");
			}
		};

		mintaPersistensiPenyimpanan();
	}, []);

	// --- EFEK SAMPING: INISIALISASI DATA AWAL --- //

	/**
	 * Memuat data dari localStorage saat aplikasi pertama kali dimuat.
	 * Membuat proyek default jika belum ada data.
	 */
	useEffect(() => {
		const muatDataDariPenyimpanan = () => {
			const proyekTersimpanRaw = JSON.parse(localStorage.getItem(KUNCI_PENYIMPANAN_PROYEK) || "[]");
			const mockTersimpanRaw = JSON.parse(localStorage.getItem(KUNCI_PENYIMPANAN_MOCK) || "[]");
			const variabelLingkunganTersimpan = JSON.parse(localStorage.getItem(KUNCI_VARIABEL_LINGKUNGAN) || "[]");
			const idProyekTerakhir = localStorage.getItem(KUNCI_PROYEK_AKTIF);

			// Tentukan proyek mana yang akan digunakan
			let proyekBerikutnya: (Proyek & { name?: string })[];
			let idProyekAktifBerikutnya: string;

			if (!Array.isArray(proyekTersimpanRaw) || proyekTersimpanRaw.length === 0) {
				proyekBerikutnya = [PROYEK_DEFAULT];
				idProyekAktifBerikutnya = PROYEK_DEFAULT.id;
			} else {
				proyekBerikutnya = proyekTersimpanRaw.map(normalizeProject);
				idProyekAktifBerikutnya = idProyekTerakhir || proyekTersimpanRaw[0].id;
			}

			setDaftarProyek(proyekBerikutnya as Proyek[]);
			setIdProyekAktif(idProyekAktifBerikutnya);

			// Inisialisasi mock endpoints
			if (!Array.isArray(mockTersimpanRaw) || mockTersimpanRaw.length === 0) {
				const mockPing = normalizeMock({
					id: crypto.randomUUID(),
					projectId: idProyekAktifBerikutnya,
					nama: "Ping",
					path: "/api/ping",
					metode: MetodeHttp.GET,
					statusCode: 200,
					delay: 0,
					responseBody: JSON.stringify({ pong: true }),
					isActive: true,
					versi: "1.0",
					createdAt: Date.now(),
					requestCount: 0,
					headers: [{ key: "Content-Type", value: "application/json" }],
					storeName: "",
					authConfig: { jenis: "NONE" } as KonfigurasiAutentikasi,
				});
				setDaftarMock([mockPing] as MockEndpoint[]);
			} else {
				setDaftarMock((mockTersimpanRaw || []).map(normalizeMock) as MockEndpoint[]);
			}

			setVariabelLingkungan(variabelLingkunganTersimpan);
		};

		muatDataDariPenyimpanan();
	}, []);

	// --- EFEK SAMPING: PERSISTENSI KE LOCALSTORAGE --- //

	// Menyimpan data proyek ke localStorage saat berubah
	useEffect(() => {
		if (daftarProyek.length > 0) {
			localStorage.setItem(KUNCI_PENYIMPANAN_PROYEK, JSON.stringify(daftarProyek));
		}
	}, [daftarProyek]);

	// Menyimpan mock endpoints ke localStorage saat berubah
	useEffect(() => {
		localStorage.setItem(KUNCI_PENYIMPANAN_MOCK, JSON.stringify(daftarMock));
	}, [daftarMock]);

	// Menyimpan variabel lingkungan ke localStorage saat berubah
	useEffect(() => {
		localStorage.setItem(KUNCI_VARIABEL_LINGKUNGAN, JSON.stringify(variabelLingkungan));
	}, [variabelLingkungan]);

	// Menyimpan proyek aktif ke localStorage saat berubah
	useEffect(() => {
		if (idProyekAktif) {
			localStorage.setItem(KUNCI_PROYEK_AKTIF, idProyekAktif);
		}
	}, [idProyekAktif]);

	// --- EFEK SAMPING: PEMANTAUAN KESEHATAN PROXY AI --- //

	/**
	 * Memeriksa kesehatan proxy OpenRouter secara berkala
	 * hanya ketika fitur AI aktif. Hasil digunakan untuk indikator UI.
	 */
	useEffect(() => {
		let masihTerpasang = true;

		if (!FEATURES.AI()) return;

		const periksaKesehatanProxy = async () => {
			try {
				const response = await fetch("/openrouter/health");
				if (!masihTerpasang) return;
				setStatusKesehatanProxy(response.ok);
			} catch (error) {
				if (!masihTerpasang) return;
				setStatusKesehatanProxy(false);
			}
		};

		periksaKesehatanProxy();
		const idInterval = setInterval(periksaKesehatanProxy, 10000);

		return () => {
			masihTerpasang = false;
			clearInterval(idInterval);
		};
	}, [penghitungFeatureFlag]);

	// --- EFEK SAMPING: INISIALISASI FITUR EMAIL (DEV) --- //

	/**
	 * Di mode development, jika fitur email diaktifkan melalui environment variable,
	 * pastikan flag di localStorage juga diatur agar UI langsung muncul.
	 */
	useEffect(() => {
		if (typeof window !== "undefined" && (import.meta.env as any).VITE_ENABLE_EMAIL === "true") {
			if (window.localStorage.getItem("feature_email_export") !== "true") {
				window.localStorage.setItem("feature_email_export", "true");
				setPenghitungFeatureFlag(c => c + 1);
			}
		}
	}, []);

	// --- EFEK SAMPING: PENDETEKSI PERMINTAAN DARI SERVICE WORKER --- //

	/**
	 * Mendengarkan pesan 'INTERCEPT_REQUEST' dari Service Worker
	 * dan menangani simulasi permintaan API.
	 */
	useEffect(() => {
		const tanganiPesanDariServiceWorker = async (event: MessageEvent) => {
			if (event.data && event.data.type === "INTERCEPT_REQUEST") {
				const { payload } = event.data;
				const port = event.ports[0];

				// Debug di mode development
				if (import.meta.env?.DEV) {
					console.debug("Payload dari Service Worker:", {
						method: payload.method,
						url: payload.url,
						headers: payload.headers,
						sampleBody: (payload.body || "").slice(0, 200),
					});
				}

				let hasilSimulasi: any;
				try {
					hasilSimulasi = await simulateRequest(
						payload.method,
						payload.url,
						payload.headers,
						payload.body,
						daftarMockRef.current,
						variabelLingkunganRef.current
					);
				} catch (error) {
					console.error("[Aplikasi] Error saat menangani INTERCEPT_REQUEST", error);
					if (event.ports && event.ports[0]) {
						postErrorResponseToPort(event.ports[0], "Kesalahan server internal");
					}
					return;
				}

				// Normalisasi response dari mockEngine (support bahasa Indonesia/Inggris)
				const rawResp = hasilSimulasi?.response ?? hasilSimulasi?.respons ?? null;
				let respForSW: any = null;
				if (rawResp) {
					respForSW = {
						status: rawResp.status ?? rawResp.kodeStatus ?? 200,
						body: rawResp.body ?? rawResp.badan ?? null,
						delay: rawResp.delay ?? rawResp.penundaan ?? 0,
						headers: Array.isArray(rawResp.headers)
							? rawResp.headers.map((h: any) => ({ key: h.key ?? h.kunci, value: h.value ?? h.nilai }))
							: rawResp.headers || {},
					};
				} else {
					// Tidak ada response valid dari simulator
					if (event.ports && event.ports[0]) {
						postErrorResponseToPort(event.ports[0], "Mock engine tidak menghasilkan response");
					}
					return;
				}

				// Tambahkan log lokal
				const logBaru: EntriLog = {
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					metode: payload.method as MetodeHttp,
					path: new URL(payload.url).pathname,
					statusCode: respForSW.status,
					duration: respForSW.delay,
					ip: "127.0.0.1", // Alamat IP simulasi
				};
				setLogAplikasi(prev => [logBaru, ...prev].slice(0, 500));

				// Kirim log ke server socket untuk klien lain
				const payloadLog = {
					id: logBaru.id,
					ts: logBaru.timestamp,
					method: logBaru.metode,
					path: logBaru.path,
					statusCode: logBaru.statusCode,
					duration: logBaru.duration,
					ip: logBaru.ip,
					workspaceId: idProyekAktif || undefined,
				};

				try {
					if (socketClient.isConnected()) {
						socketClient.emit("log:publish", payloadLog);
						console.info("[Aplikasi] Log diteruskan via socket", payloadLog.id);
					} else {
						// Fallback HTTP jika socket tidak terhubung
						const portDefault =
							typeof import.meta !== "undefined" && (import.meta.env as any)?.VITE_SOCKET_PORT
								? String((import.meta.env as any).VITE_SOCKET_PORT)
								: "9150";
						const baseUrl =
							typeof window !== "undefined"
								? `${window.location.protocol}//${window.location.hostname}:${portDefault}`
								: "http://localhost:9150";

						fetch(`${baseUrl}/emit-log`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify(payloadLog),
						}).catch(error => console.info("[Aplikasi] Fallback emit-log gagal", error));
					}
				} catch (error) {
					console.debug("[Aplikasi] Gagal meneruskan ke socket", error);
				}

				// Kirim response kembali ke Service Worker
				if (port) {
					port.postMessage({ response: respForSW });
				}
			}
		};

		navigator.serviceWorker.addEventListener("message", tanganiPesanDariServiceWorker);

		return () => {
			navigator.serviceWorker.removeEventListener("message", tanganiPesanDariServiceWorker);
		};
	}, [idProyekAktif]);

	// --- EFEK SAMPING: KONEKSI SOCKET UNTUK LOG REAL-TIME --- //

	/**
	 * Menghubungkan ke socket server untuk menerima log real-time
	 * dan meneruskannya ke UI.
	 */
	useEffect(() => {
		if (!FEATURES.LOG_VIEWER()) return;

		try {
			setStatusSocket("connecting");

			const saatTerhubung = () => {
				console.info("[Aplikasi] Socket terhubung");
				setStatusSocket("connected");

				if (idProyekAktif) {
					socketClient.join(`logs:${idProyekAktif}`);
					console.info("[Aplikasi] Bergabung ke ruang", `logs:${idProyekAktif}`);
				}
			};

			const saatTerputus = () => {
				console.info("[Aplikasi] Socket terputus");
				setStatusSocket("disconnected");
			};

			const saatErrorKoneksi = (error: any) => {
				console.info("[Aplikasi] Error koneksi socket", error?.message || error);
				setStatusSocket("disconnected");
			};

			// Daftarkan handler SEBELUM menghubungkan untuk menghindari kehilangan event awal
			socketClient.on("connect", saatTerhubung);
			socketClient.on("disconnect", saatTerputus);
			socketClient.on("connect_error", saatErrorKoneksi);

			// Hubungkan ke socket server
			socketClient.connect();

			const handlerLogBaru = (payload: any) => {
				const logBaru: EntriLog = {
					id: payload.id || crypto.randomUUID(),
					timestamp: payload.ts || Date.now(),
					metode: (payload.method as MetodeHttp) || MetodeHttp.GET,
					path: payload.path || payload.url || "/",
					statusCode: payload.statusCode || 0,
					duration: payload.duration || 0,
					ip: payload.ip || payload.ipAddress || "0.0.0.0",
				};

				setLogAplikasi(prev => {
					if (prev.some(log => log.id === logBaru.id)) return prev;
					return [logBaru, ...prev].slice(0, 500);
				});
			};

			socketClient.on("log:new", handlerLogBaru);

			return () => {
				socketClient.off("log:new", handlerLogBaru);
				socketClient.off("connect", saatTerhubung);
				socketClient.off("disconnect", saatTerputus);
				socketClient.off("connect_error", saatErrorKoneksi);

				if (idProyekAktif) socketClient.leave(`logs:${idProyekAktif}`);
				socketClient.disconnect();
				setStatusSocket("disconnected");
			};
		} catch (error) {
			console.error("Stream log via socket gagal", error);
		}
	}, [idProyekAktif]);

	// --- FUNGSI UTILITAS: TOAST NOTIFIKASI --- //

	/**
	 * Menampilkan toast notifikasi kepada pengguna.
	 * @param pesan - Teks yang akan ditampilkan
	 * @param tipe - Jenis toast (success, error, info, warning)
	 * @param opsi - Opsi tambahan seperti durasi
	 */
	const tampilkanToast = (pesan: string, tipe: TipeToast, opsi?: { duration?: number }): void => {
		const id = crypto.randomUUID();
		setDaftarToast(prev => [...prev, { id, pesan, tipe, durasi: opsi?.duration }]);
	};

	const hapusToast = (id: string): void => {
		setDaftarToast(prev => prev.filter(toast => toast.id !== id));
	};

	// --- HANDLER: MANAJEMEN PROYEK --- //

	/**
	 * Membuat proyek/workspace baru.
	 * @param nama - Nama proyek yang akan dibuat
	 */
	const handleBuatProyek = (nama: string): void => {
		const proyekBaru = normalizeProject({
			id: crypto.randomUUID(),
			nama,
			createdAt: Date.now(),
		});

		setDaftarProyek(prev => [...prev, proyekBaru as Proyek]);
		setIdProyekAktif(proyekBaru.id);
		tampilkanToast(`Workspace "${nama}" berhasil dibuat`, "success");
	};

	/**
	 * Menghapus proyek/workspace.
	 * @param id - ID proyek yang akan dihapus
	 */
	const handleHapusProyek = (id: string): void => {
		if (daftarProyek.length <= 1) {
			tampilkanToast("Tidak dapat menghapus workspace terakhir", "error");
			return;
		}

		setDaftarProyek(prev => prev.filter(proyek => proyek.id !== id));
		setDaftarMock(prev => prev.filter(mock => mock.projectId !== id));

		if (idProyekAktif === id) {
			setIdProyekAktif(daftarProyek.find(proyek => proyek.id !== id)?.id || "");
		}

		tampilkanToast("Workspace berhasil dihapus", "info");
	};

	// --- HANDLER: MANAJEMEN MOCK ENDPOINT --- //

	/**
	 * Menyimpan atau memperbarui mock endpoint.
	 * @param mock - Data mock endpoint yang akan disimpan
	 */
	const handleSimpanMock = (mock: MockEndpoint): void => {
		setDaftarMock(prev => {
			const sudahAda = prev.find(m => m.id === mock.id);

			const mockTersimpan = normalizeMock({
				...mock,
				id: mock.id || crypto.randomUUID(),
				projectId: idProyekAktif,
			});

			if (sudahAda) {
				return prev.map(m => (m.id === mock.id ? (mockTersimpan as MockEndpoint) : m));
			}

			return [...prev, mockTersimpan as MockEndpoint];
		});

		setMockYangDiedit(null);
		setTampilanAktif("dashboard");
		tampilkanToast("Route berhasil disimpan", "success");
	};

	/**
	 * Menghapus mock endpoint.
	 * @param id - ID mock yang akan dihapus
	 */
	const handleHapusMock = (id: string): void => {
		setDaftarMock(prev => prev.filter(mock => mock.id !== id));

		if (mockYangDiedit?.id === id) {
			setMockYangDiedit(null);
			setTampilanAktif("dashboard");
		}

		tampilkanToast("Route berhasil dihapus", "info");
	};

	// --- HANDLER: FITUR AI (PEMBUATAN OTOMATIS) --- //

	/**
	 * Membuat konfigurasi endpoint secara otomatis menggunakan AI.
	 * Meminta prompt dari pengguna lalu menggunakan layanan AI untuk membuat draft.
	 */
	const handlePembuatanOtomatis = async (): Promise<void> => {
		if (!FEATURES.AI()) {
			tampilkanToast("Fitur AI dinonaktifkan. Aktifkan melalui Pengaturan atau feature flags.", "info");
			return;
		}

		const prompt = window.prompt(
			"Jelaskan endpoint yang ingin Anda buat (contoh: 'GET daftar pengguna dengan pagination')"
		);

		if (!prompt) return;

		try {
			tampilkanToast("Membuat konfigurasi...", "info");
			const { generateEndpointConfig } = await import("./services/aiService");
			const config = await generateEndpointConfig(prompt);

			const mockBaru = normalizeMock({
				id: crypto.randomUUID(),
				projectId: idProyekAktif,
				nama: config.name,
				name: config.name,
				path: config.path,
				metode: (config.method as MetodeHttp) || MetodeHttp.GET,
				method: (config.method as MetodeHttp) || MetodeHttp.GET,
				statusCode: config.statusCode,
				delay: 50,
				responseBody: config.responseBody,
				isActive: true,
				versi: "1.0",
				createdAt: Date.now(),
				requestCount: 0,
				headers: [],
				storeName: "",
				authConfig: { jenis: "NONE" } as KonfigurasiAutentikasi,
			});

			setMockYangDiedit(mockBaru);
			setTampilanAktif("editor");
			tampilkanToast("Draft berhasil dibuat dengan AI", "success");
		} catch (error) {
			const err = error as any;
			console.error("AI generate endpoint failed:", err);

			if (err?.code === "OPENROUTER_DISABLED") {
				tampilkanToast("Penyedia OpenRouter dinonaktifkan. Aktifkan di Pengaturan.", "error");
			} else if (err?.code === "OPENROUTER_TIMEOUT") {
				tampilkanToast(
					"Permintaan OpenRouter timeout. Periksa jaringan atau tingkatkan timeout proxy (OPENROUTER_TIMEOUT_MS)",
					"error"
				);
			} else if (
				(err?.message && err.message.includes("OPENROUTER_API_KEY not configured")) ||
				err?.code === "OPENROUTER_UNAUTHORIZED"
			) {
				tampilkanToast(
					"API Key OpenRouter tidak ada atau proxy tidak berjalan. Konfigurasi atau mulai proxy.",
					"error"
				);
			} else {
				const detil = err?.message ? `: ${String(err.message).slice(0, 200)}` : "";
				tampilkanToast(`Gagal membuat endpoint${detil}`, "error");
			}
		}
	};

	// --- HANDLER: PENGATURAN API KEY --- //

	/**
	 * Menyimpan API Key pengguna ke localStorage.
	 */
	const handleSimpanKunciApi = (): void => {
		localStorage.setItem("api_sim_user_openrouter_key", kunciApiPengguna);
		tampilkanToast("API Key berhasil disimpan secara aman", "success");
	};

	// --- HANDLER: MANAJEMEN VARIABEL LINGKUNGAN --- //

	/**
	 * Menambahkan variabel lingkungan baru (kosong).
	 */
	const handleTambahVariabelLingkungan = (): void => {
		setVariabelLingkungan([
			...variabelLingkungan,
			{
				id: crypto.randomUUID(),
				kunci: "",
				nilai: "",
			},
		]);
	};

	/**
	 * Memperbarui nilai variabel lingkungan.
	 * @param id - ID variabel yang akan diperbarui
	 * @param field - Field yang akan diperbarui (kunci atau nilai)
	 * @param nilai - Nilai baru
	 */
	const handlePerbaruiVariabelLingkungan = (id: string, field: "kunci" | "nilai", nilai: string): void => {
		setVariabelLingkungan(prev =>
			prev.map(variabel => (variabel.id === id ? { ...variabel, [field]: nilai } : variabel))
		);
	};

	/**
	 * Menghapus variabel lingkungan.
	 * @param id - ID variabel yang akan dihapus
	 */
	const handleHapusVariabelLingkungan = (id: string): void => {
		setVariabelLingkungan(prev => prev.filter(variabel => variabel.id !== id));
	};

	// --- HANDLER: IMPORT/EXPORT DATA --- //

	/**
	 * Mengekspor seluruh konfigurasi workspace ke file JSON.
	 */
	const handleEksporData = (): void => {
		const data = {
			version: "1.0",
			timestamp: Date.now(),
			projects: daftarProyek,
			mocks: daftarMock,
			envVars: variabelLingkungan,
		};

		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});

		const url = URL.createObjectURL(blob);
		const tautan = document.createElement("a");
		tautan.href = url;
		tautan.download = `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(tautan);
		tautan.click();
		document.body.removeChild(tautan);
		URL.revokeObjectURL(url);

		tampilkanToast("Konfigurasi berhasil diekspor", "success");
	};

	/**
	 * Mengimpor konfigurasi workspace dari file JSON.
	 * @param event - Event perubahan input file
	 */
	const handleImporData = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		if (!file) return;

		const pembacaFile = new FileReader();

		pembacaFile.onload = async e => {
			try {
				const konten = e.target?.result as string;
				const data = JSON.parse(konten);

				// Validasi struktur data yang diimpor
				try {
					await import("./services/validation").then(modul => modul.validateWorkspaceImport(data));
				} catch (errorValidasi) {
					throw errorValidasi;
				}

				if (
					confirm(
						`Ganti workspace saat ini dengan ${data.projects.length} proyek dan ${data.mocks.length} route?`
					)
				) {
					setDaftarProyek((data.projects || []).map(normalizeProject) as Proyek[]);

					const mockDiimpor = (data.mocks || []).map((mock: any) =>
						normalizeMock({
							...mock,
							headers: mock.headers || [],
						})
					);

					setDaftarMock(mockDiimpor as MockEndpoint[]);

					if (data.envVars && Array.isArray(data.envVars)) {
						setVariabelLingkungan(data.envVars);
					}

					if (data.projects.length > 0) {
						const proyekAktifMasihAda = data.projects.find((proyek: Proyek) => proyek.id === idProyekAktif);
						if (!proyekAktifMasihAda) setIdProyekAktif(data.projects[0].id);
					}

					tampilkanToast("Import workspace berhasil", "success");
				}
			} catch (error) {
				tampilkanToast("Gagal mengimpor: " + (error as Error).message, "error");
			}
		};

		pembacaFile.readAsText(file);
		event.target.value = ""; // Reset input file
	};

	// --- HANDLER: EKSPOR OPENAPI SPECIFICATION --- //

	/**
	 * Mengekspor spesifikasi OpenAPI 3.0 dari mock endpoints yang ada.
	 */
	const handleEksporOpenApi = (): void => {
		const proyekSaatIni = daftarProyek.find(proyek => proyek.id === idProyekAktif);
		if (!proyekSaatIni) return;

		const spec = generateOpenApiSpec(proyekSaatIni, daftarMock);
		const blob = new Blob([JSON.stringify(spec, null, 2)], {
			type: "application/json",
		});

		const url = URL.createObjectURL(blob);
		const tautan = document.createElement("a");
		tautan.href = url;
		tautan.download = `openapi-${proyekSaatIni.nama.toLowerCase().replace(/\s+/g, "-")}.json`;
		document.body.appendChild(tautan);
		tautan.click();
		document.body.removeChild(tautan);
		URL.revokeObjectURL(url);

		tampilkanToast("Spesifikasi OpenAPI berhasil diekspor!", "success");
	};

	// --- HANDLER: GENERASI KODE SERVER --- //

	/**
	 * Menghasilkan kode server Node.js/Express dari mock endpoints yang aktif.
	 * @returns String kode server JavaScript
	 */
	const hasilkanKodeServer = useCallback((): string => {
		const mockAktif = daftarMock.filter(mock => mock.projectId === idProyekAktif && mock.isActive);
		return buildServerCode(mockAktif);
	}, [daftarMock, idProyekAktif]);

	/**
	 * Menghasilkan file package.json untuk server yang akan diekspor.
	 * @returns String JSON untuk package.json
	 */
	const hasilkanPackageJson = (): string => {
		const namaProyek = daftarProyek.find(proyek => proyek.id === idProyekAktif)?.nama || "backend-api";
		const namaAman = namaProyek.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		return JSON.stringify(
			{
				name: namaAman,
				version: "1.0.0",
				description: "Dibuat dengan Backend Studio",
				main: "server.js",
				scripts: {
					start: "node server.js",
				},
				dependencies: {
					express: "^4.18.2",
					cors: "^2.8.5",
				},
				engines: {
					node: ">=14.0.0",
				},
			},
			null,
			2
		);
	};

	/**
	 * Mengunduh file server.js yang berisi kode server.
	 */
	const handleUnduhServer = (): void => {
		const kode = hasilkanKodeServer();
		const blob = new Blob([kode], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const tautan = document.createElement("a");
		tautan.href = url;
		tautan.download = "server.js";
		document.body.appendChild(tautan);
		tautan.click();
		document.body.removeChild(tautan);
		URL.revokeObjectURL(url);

		tampilkanToast("server.js berhasil diunduh!", "success");
	};

	/**
	 * Mengunduh file package.json.
	 */
	const handleUnduhPackageJson = (): void => {
		const kode = hasilkanPackageJson();
		const blob = new Blob([kode], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const tautan = document.createElement("a");
		tautan.href = url;
		tautan.download = "package.json";
		document.body.appendChild(tautan);
		tautan.click();
		document.body.removeChild(tautan);
		URL.revokeObjectURL(url);

		tampilkanToast("package.json berhasil diunduh!", "success");
	};

	/**
	 * Menyalin kode server ke clipboard.
	 */
	const salinKodeServer = (): void => {
		const kode = hasilkanKodeServer();
		navigator.clipboard.writeText(kode);
		tampilkanToast("Kode server disalin ke clipboard", "info");
	};

	// --- HANDLER: EMAIL EXPORT --- //

	/**
	 * Mendapatkan preview attachment untuk modal email.
	 */
	const dapatkanPreviewAttachment = async (opsi: {
		includeWorkspace: boolean;
		includeOpenApi: boolean;
		includeServer: boolean;
	}): Promise<{ nama: string; ukuran: number }[]> => {
		const files: { name: string; blob: Blob }[] = [];

		if (opsi.includeWorkspace) {
			files.push({
				name: `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
				blob: new Blob(
					[
						JSON.stringify(
							{
								version: "1.0",
								timestamp: Date.now(),
								projects: daftarProyek,
								mocks: daftarMock,
								envVars: variabelLingkungan,
							},
							null,
							2
						),
					],
					{ type: "application/json" }
				),
			});
		}

		if (opsi.includeOpenApi) {
			const proyekSaatIni = daftarProyek.find(proyek => proyek.id === idProyekAktif);
			if (proyekSaatIni) {
				const spec = generateOpenApiSpec(proyekSaatIni, daftarMock);
				files.push({
					name: `openapi-${proyekSaatIni.nama.toLowerCase().replace(/\s+/g, "-")}.json`,
					blob: new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
				});
			}
		}

		if (opsi.includeServer) {
			const kode = hasilkanKodeServer();
			files.push({ name: "server.js", blob: new Blob([kode], { type: "text/javascript" }) });
		}

		if (files.length === 0) return [];

		if (files.length > 1) {
			const { createZipBlob } = await import("./services/zipService");
			const zipBlob = (await createZipBlob(files)) as Blob;
			return [
				{
					nama: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`,
					ukuran: zipBlob.size,
				},
			];
		}

		return files.map(file => ({ nama: file.name, ukuran: file.blob.size || 0 }));
	};

	/**
	 * Mengirim email dengan attachment ekspor.
	 * @param params - Parameter untuk pengiriman email
	 */
	const kirimEmail = async (params: EmailExportParams): Promise<void> => {
		setSedangMengirimEmail(true);

		try {
			const { recipients, subject, message: pesanAsli, includeWorkspace, includeOpenApi, includeServer } = params;
			let pesanUntukDikirim = pesanAsli;
			const files: { name: string; blob: Blob }[] = [];

			// Siapkan attachment berdasarkan opsi yang dipilih
			if (includeWorkspace) {
				const data = {
					version: "1.0",
					timestamp: Date.now(),
					projects: daftarProyek,
					mocks: daftarMock,
					envVars: variabelLingkungan,
				};
				files.push({
					name: `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
					blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
				});
			}

			if (includeOpenApi) {
				const proyekSaatIni = daftarProyek.find(proyek => proyek.id === idProyekAktif);
				if (proyekSaatIni) {
					const spec = generateOpenApiSpec(proyekSaatIni, daftarMock);
					files.push({
						name: `openapi-${proyekSaatIni.nama.toLowerCase().replace(/\s+/g, "-")}.json`,
						blob: new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
					});
				}
			}

			if (includeServer) {
				const kode = hasilkanKodeServer();
				files.push({ name: "server.js", blob: new Blob([kode], { type: "text/javascript" }) });
			}

			// Jika lebih dari satu file, bundle ke dalam ZIP
			let filesUntukDikirim = files;
			if (files.length > 1) {
				const { createZipBlob } = await import("./services/zipService");
				const zipBlob = (await createZipBlob(files)) as Blob;
				filesUntukDikirim = [
					{ name: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`, blob: zipBlob },
				];
			}

			// Cek ukuran total (maks 20MB)
			const totalBytes = filesUntukDikirim.reduce((total, file) => total + (file.blob.size || 0), 0);
			if (totalBytes > 20 * 1024 * 1024) {
				throw new Error("Attachment melebihi batas 20 MB. Kurangi ukuran attachment.");
			}

			// Unggah file ke layanan sementara dan dapatkan tautan unduh
			let tautanUnduh: string | null = null;
			if (filesUntukDikirim.length > 0) {
				try {
					const uploadService = await import("./services/uploadService");
					const hasil = await uploadService.uploadTempFile(
						filesUntukDikirim[0].blob,
						filesUntukDikirim[0].name
					);
					tautanUnduh = hasil.url;
					pesanUntukDikirim = `${pesanUntukDikirim}\n\nUnduh file ekspor: ${tautanUnduh} (kadaluarsa ${new Date(
						hasil.expiresAt
					).toLocaleString()})`;
				} catch (error: any) {
					tampilkanToast("Upload gagal: " + (error?.message || "error tidak diketahui"), "error");
					throw error;
				}
			}

			// Konfigurasi EmailJS
			const serviceId = (import.meta.env as any).VITE_EMAILJS_SERVICE_ID;
			const templateId = (import.meta.env as any).VITE_EMAILJS_TEMPLATE_ID;
			const publicKey = (import.meta.env as any).VITE_EMAILJS_PUBLIC_KEY;
			const modeDemo =
				(typeof (import.meta as any).env !== "undefined" &&
					(import.meta as any).env.VITE_EMAILJS_DEMO === "true") ||
				process.env.VITE_EMAILJS_DEMO === "true";

			if (!serviceId || !templateId || !publicKey) {
				if (!modeDemo) {
					throw new Error(
						"EmailJS tidak dikonfigurasi. Atur VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY."
					);
				}
			}

			// Kirim email (tanpa attachment, sudah menggunakan tautan)
			await sendEmailViaEmailJS(
				serviceId,
				templateId,
				publicKey,
				Array.isArray(recipients) ? recipients.join(", ") : String(recipients),
				subject,
				pesanUntukDikirim,
				[]
			);
			tampilkanToast("Email berhasil dikirim!", "success");
			setApakahModalEmailTerbuka(false);
		} catch (error: any) {
			tampilkanToast(error?.message || "Pengiriman email gagal", "error");
			throw error;
		} finally {
			setSedangMengirimEmail(false);
		}
	};

	// --- HANDLER: RESET PABRIK --- //

	/**
	 * Melakukan reset pabrik: menghapus semua data dan memuat ulang aplikasi.
	 */
	const handleResetPabrik = async (): Promise<void> => {
		if (confirm("Apakah Anda yakin ingin mereset semua data? Tindakan ini tidak dapat dibatalkan.")) {
			try {
				// Hapus data dari database
				await dbService.clearAllCollectionsAsync();
				// Hapus localStorage
				localStorage.clear();
				tampilkanToast("Reset berhasil", "success");
			} catch (error) {
				console.error("Reset pabrik gagal:", error);
				tampilkanToast("Reset pabrik gagal", "error");
			}
			// Muat ulang halaman untuk menerapkan workspace default
			window.location.reload();
		}
	};

	// Filter mock endpoints untuk proyek yang aktif
	const mockProyekAktif = daftarMock.filter(mock => mock.projectId === idProyekAktif);

	// Jika landing belum ditutup, tampilkan landing page dan jangan render UI utama
	if (tampilkanLanding) {
		return <LandingPage onStart={handleStartStudio} />;
	}

	return (
		<div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
			<Sidebar
				tampilanSaatIni={tampilanAktif}
				padaUbahTampilan={setTampilanAktif}
				padaMockBaru={() => {
					setMockYangDiedit(null);
					setTampilanAktif("editor");
				}}
				padaPembuatanAjaib={handlePembuatanOtomatis}
				daftarProyek={daftarProyek}
				idProyekAktif={idProyekAktif}
				padaPilihProyek={setIdProyekAktif}
				padaBuatProyek={handleBuatProyek}
				padaHapusProyek={handleHapusProyek}
				padaTriggerPaletPerintah={() => tampilkanToast("Command Palette akan segera hadir", "info")}
				padaDeploy={() => setApakahModalDeployTerbuka(true)}
				onShowLanding={() => setTampilkanLanding(true)}
			/>

			<main className="flex-1 overflow-auto relative bg-[#f8fafc]">
				{tampilanAktif === "dashboard" && (
					<Dashboard
						mocks={mockProyekAktif}
						onEdit={mock => {
							setMockYangDiedit(mock);
							setTampilanAktif("editor");
						}}
						onDelete={handleHapusMock}
						onBulkDelete={ids => setDaftarMock(prev => prev.filter(mock => !ids.includes(mock.id)))}
						onToggle={id =>
							setDaftarMock(prev =>
								prev.map(mock => (mock.id === id ? { ...mock, isActive: !mock.isActive } : mock))
							)
						}
						onDuplicate={mock => {
							const mockSalinan = {
								...mock,
								id: crypto.randomUUID(),
								nama: `${mock.nama ?? (mock as any).name} (Salinan)`,
								name: `${(mock as any).name ?? mock.nama} (Salinan)`,

								path: `${mock.path}-salinan`,
							};
							setDaftarMock(prev => [...prev, normalizeMock(mockSalinan) as MockEndpoint]);
							tampilkanToast("Route berhasil disalin", "success");
						}}
						addToast={tampilkanToast}
					/>
				)}
				{tampilanAktif === "editor" && (
					<MockEditor
						initialData={mockYangDiedit}
						existingMocks={mockProyekAktif}
						onSave={handleSimpanMock}
						onDelete={handleHapusMock}
						onCancel={() => setTampilanAktif("dashboard")}
						addToast={tampilkanToast}
					/>
				)}
				{tampilanAktif === "test" && (
					<KonsolPengujian
						mocks={mockProyekAktif}
						state={stateKonsolPengujian}
						setState={setStateKonsolPengujian}
					/>
				)}
				{tampilanAktif === "logs" && FEATURES.LOG_VIEWER() && (
					<PenampilLog
						log={logAplikasi}
						padaHapusLog={() => setLogAplikasi([])}
						statusSocket={statusSocket}
					/>
				)}

				{tampilanAktif === "settings" && (
					<PanelPengaturan
						variabelLingkungan={variabelLingkungan}
						onTambahVariabel={handleTambahVariabelLingkungan}
						onPerbaruiVariabel={handlePerbaruiVariabelLingkungan}
						onHapusVariabel={handleHapusVariabelLingkungan}
						fiturAI={FEATURES.AI()}
						statusKesehatanProxy={statusKesehatanProxy}
						kunciApiPengguna={kunciApiPengguna}
						onUbahKunciApi={setKunciApiPengguna}
						tampilkanKunciApi={tampilkanKunciApi}
						onUbahVisibilitasKunci={() => setTampilkanKunciApi(!tampilkanKunciApi)}
						onSimpanKunciApi={handleSimpanKunciApi}
						fiturEksporServer={FEATURES.EXPORT_SERVER()}
						onBukaModalDeploy={() => setApakahModalDeployTerbuka(true)}
						onEksporOpenApi={handleEksporOpenApi}
						onEksporData={handleEksporData}
						onBukaModalEmail={() => setApakahModalEmailTerbuka(true)}
						fiturEmail={FEATURES.EMAIL_EXPORT()}
						refInputFile={refInputFile}
						onImporData={handleImporData}
						onResetPabrik={handleResetPabrik}
					/>
				)}
			</main>

			{/* Modal Ekspor & Deploy */}
			{apakahModalDeployTerbuka && (
				<ModalEkspor
					onTutup={() => setApakahModalDeployTerbuka(false)}
					onUnduhServer={handleUnduhServer}
					onUnduhPackageJson={handleUnduhPackageJson}
					onBukaModalEmail={() => setApakahModalEmailTerbuka(true)}
					fiturEmail={FEATURES.EMAIL_EXPORT()}
					onSalinKodeServer={salinKodeServer}
				/>
			)}

			{!PAKAI_EXPORT_MODAL_BARU && (
				<EmailExportModal
					terbuka={apakahModalEmailTerbuka}
					padaTutup={() => setApakahModalEmailTerbuka(false)}
					padaKirim={kirimEmail}
					sedangMengirim={sedangMengirimEmail}
					dapatkanPratinjauLampiran={opsi =>
						dapatkanPreviewAttachment({
							includeWorkspace: (opsi as any).sertakanWorkspace,
							includeOpenApi: (opsi as any).sertakanOpenApi,
							includeServer: (opsi as any).sertakanServer,
						})
					}
				/>
			)}

			{/* New ExportModal (experimental UI) */}
			{PAKAI_EXPORT_MODAL_BARU && apakahModalEmailTerbuka && (
				<ExportModal
					project={daftarProyek.find(p => p.id === idProyekAktif)}
					endpoints={daftarMock.filter(m => m.projectId === idProyekAktif)}
					onClose={() => setApakahModalEmailTerbuka(false)}
					onToast={tampilkanToast}
					onSend={async (recipients, subject, message) => {
						// Reuse existing kirimEmail handler by mapping to EmailExportParams
						await kirimEmail({
							recipients,
							subject,
							message,
							includeWorkspace: true,
							includeOpenApi: true,
							includeServer: false,
						});
					}}
					isSending={sedangMengirimEmail}
				/>
			)}

			<KontainerToast daftarToast={daftarToast} hapusToast={hapusToast} />
		</div>
	);
}

export default Aplikasi;

/**
 * Komponen PanelPengaturan untuk halaman pengaturan aplikasi.
 * Memisahkan UI pengaturan dari logika bisnis utama.
 */
function PanelPengaturan({
	variabelLingkungan,
	onTambahVariabel,
	onPerbaruiVariabel,
	onHapusVariabel,
	fiturAI,
	statusKesehatanProxy,
	kunciApiPengguna,
	onUbahKunciApi,
	tampilkanKunciApi,
	onUbahVisibilitasKunci,
	onSimpanKunciApi,
	fiturEksporServer,
	onBukaModalDeploy,
	onEksporOpenApi,
	onEksporData,
	onBukaModalEmail,
	fiturEmail,
	refInputFile,
	onImporData,
	onResetPabrik,
}: {
	variabelLingkungan: VariabelLingkungan[];
	onTambahVariabel: () => void;
	onPerbaruiVariabel: (id: string, field: "kunci" | "nilai", value: string) => void;
	onHapusVariabel: (id: string) => void;
	fiturAI: boolean;
	statusKesehatanProxy: boolean | null;
	kunciApiPengguna: string;
	onUbahKunciApi: (value: string) => void;
	tampilkanKunciApi: boolean;
	onUbahVisibilitasKunci: () => void;
	onSimpanKunciApi: () => void;
	fiturEksporServer: boolean;
	onBukaModalDeploy: () => void;
	onEksporOpenApi: () => void;
	onEksporData: () => void;
	onBukaModalEmail: () => void;
	fiturEmail: boolean;
	refInputFile: React.RefObject<HTMLInputElement>;
	onImporData: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onResetPabrik: () => Promise<void>;
}) {
	return (
		<div className="p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
			<div className="flex items-center space-x-3 mb-6">
				<h2 className="text-3xl font-bold text-slate-800 tracking-tight">Pengaturan Sistem</h2>
			</div>

			{/* Bagian Variabel Lingkungan */}
			<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-xl font-semibold text-slate-800 flex items-center">
						<Globe className="w-5 h-5 mr-3 text-emerald-600" />
						Variabel Lingkungan Global
					</h3>
					<button
						onClick={onTambahVariabel}
						className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
					>
						<Plus className="w-4 h-4" />
						<span>Tambah Variabel</span>
					</button>
				</div>
				<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
					Tentukan variabel global (seperti <code>base_url</code> atau <code>api_token</code>) yang dapat
					digunakan kembali dalam response endpoint menggunakan sintaks <code>{`{{nama_variabel}}`}</code>.
				</p>

				<div className="space-y-3">
					{variabelLingkungan.length === 0 ? (
						<div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
							Belum ada variabel lingkungan yang didefinisikan.
						</div>
					) : (
						<div className="grid grid-cols-12 gap-3 mb-2 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
							<div className="col-span-4">Nama Variabel</div>
							<div className="col-span-7">Nilai Awal</div>
							<div className="col-span-1"></div>
						</div>
					)}

					{variabelLingkungan.map(variabel => (
						<div key={variabel.id} className="grid grid-cols-12 gap-3 items-center group">
							<div className="col-span-4 relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono select-none">{`{{`}</span>
								<input
									type="text"
									value={variabel.kunci}
									onChange={e => onPerbaruiVariabel(variabel.id, "kunci", e.target.value)}
									placeholder="nama_variabel"
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-7 pr-7 text-sm font-mono text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
								/>
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono select-none">{`}}`}</span>
							</div>
							<div className="col-span-7">
								<input
									type="text"
									value={variabel.nilai}
									onChange={e => onPerbaruiVariabel(variabel.id, "nilai", e.target.value)}
									placeholder="Nilai"
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
								/>
							</div>
							<div className="col-span-1 flex justify-end">
								<button
									onClick={() => onHapusVariabel(variabel.id)}
									className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Bagian Konfigurasi AI */}
			{fiturAI && (
				<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
					<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center justify-between">
						<div className="flex items-center">
							<Key className="w-5 h-5 mr-3 text-violet-600" />
							Konfigurasi AI
						</div>
						<div className="text-sm">
							{statusKesehatanProxy === null ? (
								<span className="text-slate-400">Memeriksa proxy…</span>
							) : statusKesehatanProxy ? (
								<span className="text-emerald-600">Proxy: berjalan</span>
							) : (
								<span className="text-rose-500">Proxy: tidak tersedia</span>
							)}
						</div>
					</h3>
					<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
						Opsional: berikan API Key OpenRouter untuk panggilan langsung (disarankan: jalankan proxy lokal
						dan atur kunci di sisi server). Simpan kunci hanya jika Anda memahami bahwa kunci tersebut
						terlihat oleh localStorage browser Anda.
					</p>

					<div className="max-w-xl space-y-4">
						<div>
							<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
								OpenRouter API Key (opsional)
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<ShieldCheck className="h-5 w-5 text-slate-400" />
								</div>
								<input
									type={tampilkanKunciApi ? "text" : "password"}
									value={kunciApiPengguna}
									onChange={e => onUbahKunciApi(e.target.value)}
									className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all text-sm font-mono"
									placeholder="sk-or-..."
								/>
								<button
									onClick={onUbahVisibilitasKunci}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
								>
									{tampilkanKunciApi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<a
								href="https://openrouter.ai/docs"
								target="_blank"
								rel="noreferrer"
								className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline"
							>
								Dapatkan API Key gratis
							</a>
							<button
								onClick={onSimpanKunciApi}
								className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-sm transition-all shadow-md shadow-violet-200 active:scale-95"
							>
								Simpan Kunci
							</button>
						</div>
					</div>
				</div>
			)}

			{fiturEksporServer && (
				<div className="bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-700 text-white relative overflow-hidden group">
					<div className="relative z-10">
						<h3 className="text-xl font-bold mb-2 flex items-center">
							<Server className="w-5 h-5 mr-3 text-brand-400" />
							Runtime Server
						</h3>
						<p className="text-slate-400 text-sm mb-6 max-w-2xl leading-relaxed">
							Ekspor endpoint Anda sebagai server Node.js mandiri. Berguna untuk pengembangan lokal atau
							deploy ke penyedia cloud.
						</p>

						<button
							onClick={onBukaModalDeploy}
							className="flex items-center justify-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-900/50 active:scale-95"
						>
							<Rocket className="w-4 h-4" />
							<span>Buka Hub Ekspor</span>
						</button>
					</div>
				</div>
			)}

			{/* Bagian Spesifikasi API */}
			<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
				<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
					<FileText className="w-5 h-5 mr-3 text-indigo-600" />
					Spesifikasi API
				</h3>
				<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
					Ekspor desain API Anda sebagai file OpenAPI 3.0 (Swagger) standar.
				</p>

				<button
					onClick={onEksporOpenApi}
					className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-all font-medium active:scale-95"
				>
					<FileCode className="w-4 h-4" />
					<span>Unduh openapi.json</span>
				</button>
			</div>

			{/* Bagian Manajemen Data */}
			<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
				<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
					<Download className="w-5 h-5 mr-3 text-brand-600" />
					Data Workspace
				</h3>
				<p className="text-slate-500 text-sm mb-8 max-w-2xl leading-relaxed">
					Ekspor seluruh workspace Anda termasuk semua proyek dan konfigurasi route.
				</p>

				<div className="flex flex-col sm:flex-row gap-4">
					<button
						onClick={onEksporData}
						className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95"
					>
						<Download className="w-4 h-4" />
						<span>Ekspor Konfigurasi</span>
					</button>

					{fiturEmail && (
						<button
							onClick={onBukaModalEmail}
							className="flex items-center justify-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-600 text-white rounded-xl border border-sky-800 transition-all font-medium active:scale-95 w-full sm:w-auto"
						>
							<Mail className="w-4 h-4 text-white" />
							<span>Kirim via Email</span>
						</button>
					)}

					<div className="relative">
						<input
							type="file"
							ref={refInputFile}
							onChange={onImporData}
							className="hidden"
							accept=".json"
						/>
						<button
							onClick={() => refInputFile.current?.click()}
							className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95 w-full sm:w-auto"
						>
							<Upload className="w-4 h-4" />
							<span>Impor Konfigurasi</span>
						</button>
					</div>
				</div>

				<div className="mt-6 p-4 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start border border-amber-100">
					<AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
					<span className="leading-5">
						<strong>Peringatan:</strong> Mengimpor data akan sepenuhnya mengganti workspace saat ini.
					</span>
				</div>
			</div>

			{/* Zona Bahaya */}
			<div className="bg-red-50 p-8 rounded-2xl shadow-sm border border-red-100">
				<h3 className="text-xl font-semibold text-red-900 mb-2 flex items-center">
					<RefreshCw className="w-5 h-5 mr-3" />
					Zona Bahaya
				</h3>
				<p className="text-red-700/80 text-sm mb-6 max-w-2xl leading-relaxed">
					Mereset aplikasi akan menghapus semua data penyimpanan lokal.
				</p>

				<button
					onClick={onResetPabrik}
					className="flex items-center justify-center space-x-2 px-6 py-3 bg-white hover:bg-red-100 text-red-600 rounded-xl border border-red-200 hover:border-red-300 transition-all font-bold active:scale-95 shadow-sm"
				>
					<AlertTriangle className="w-4 h-4" />
					<span>Reset Pabrik</span>
				</button>
			</div>
		</div>
	);
}

/**
 * Komponen ModalEkspor untuk menampilkan dialog ekspor dan deploy.
 */
function ModalEkspor({
	onTutup,
	onUnduhServer,
	onUnduhPackageJson,
	onBukaModalEmail,
	fiturEmail,
	onSalinKodeServer,
}: {
	onTutup: () => void;
	onUnduhServer: () => void;
	onUnduhPackageJson: () => void;
	onBukaModalEmail: () => void;
	fiturEmail: boolean;
	onSalinKodeServer: () => void;
}) {
	return (
		<div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
			<div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-700 flex flex-col overflow-hidden max-h-[90vh]">
				<div className="p-6 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h2 className="text-xl font-bold text-white flex items-center">
							<Rocket className="w-5 h-5 mr-3 text-emerald-400" />
							Hub Ekspor & Deploy
						</h2>
						<p className="text-slate-400 text-sm mt-1">
							Ekspor endpoint Anda sebagai aplikasi Node.js mandiri.
						</p>
					</div>
					<button onClick={onTutup} className="text-slate-500 hover:text-white transition-colors">
						<X className="w-6 h-6" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-8">
					{/* Pengantar */}
					<div className="flex items-start gap-4 mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
						<div className="bg-slate-700 p-2 rounded-lg">
							<Info className="w-5 h-5 text-slate-300" />
						</div>
						<div>
							<h4 className="text-slate-200 font-bold text-sm mb-1">Cara kerja</h4>
							<p className="text-slate-400 text-sm leading-relaxed">
								Karena Backend Studio berjalan sepenuhnya di browser Anda, alat eksternal tidak dapat
								mengaksesnya langsung. Untuk deploy ke cloud (atau menjalankan lokal), Anda harus
								mengekspor file <code>server.js</code> yang dihasilkan.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{/* Setup Lokal */}
						<div>
							<label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
								<Terminal className="w-3.5 h-3.5" /> Setup Localhost
							</label>
							<div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs relative group mb-4">
								<div className="p-4 text-slate-300 space-y-2">
									<div className="flex gap-2 opacity-50">
										<span className="select-none"># 1. Buat folder & unduh file</span>
									</div>
									<div className="flex gap-2">
										<span className="text-emerald-500 select-none">$</span>
										<span>npm install</span>
									</div>
									<div className="flex gap-2">
										<span className="text-emerald-500 select-none">$</span>
										<span>node server.js</span>
									</div>
								</div>
							</div>
							<p className="text-slate-500 text-xs mb-4">
								Unduh kedua file di bawah untuk memulai server lokal nyata di port 3000.
							</p>
							<div className="flex flex-col gap-2">
								<button
									onClick={onUnduhServer}
									className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all flex items-center justify-between group border border-slate-700"
								>
									<span className="flex items-center gap-2">
										<FileCode className="w-4 h-4 text-emerald-500" /> Unduh server.js
									</span>
									<Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
								</button>
								<button
									onClick={onUnduhPackageJson}
									className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all flex items-center justify-between group border border-slate-700"
								>
									<span className="flex items-center gap-2">
										<Package className="w-4 h-4 text-orange-400" /> Unduh package.json
									</span>
									<Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
								</button>
								{fiturEmail && (
									<button
										onClick={onBukaModalEmail}
										className="px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-medium transition-all flex items-center justify-between group border border-sky-800"
									>
										<span className="flex items-center gap-2">
											<Mail className="w-4 h-4 text-white" /> Kirim via Email
										</span>
									</button>
								)}
							</div>
						</div>
						{/* Setup Cloud */}
						<div>
							<label className="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center gap-2">
								<Cloud className="w-3.5 h-3.5" /> Deploy ke Cloud
							</label>
							<div className="space-y-3">
								<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
									<h5 className="text-slate-200 font-bold text-xs mb-1">1. Siapkan File</h5>
									<p className="text-slate-400 text-xs">
										Unduh kedua file <code>server.js</code> dan <code>package.json</code> dari panel
										kiri.
									</p>
								</div>
								<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
									<h5 className="text-slate-200 font-bold text-xs mb-1">2. Push ke Git</h5>
									<p className="text-slate-400 text-xs">
										Commit file-file ini ke repository GitHub/GitLab.
									</p>
								</div>
								<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
									<h5 className="text-slate-200 font-bold text-xs mb-1">3. Hubungkan Provider</h5>
									<p className="text-slate-400 text-xs">
										Hubungkan repo Anda ke <strong>Render, Railway, atau Vercel</strong>. Mereka
										akan mendeteksi otomatis aplikasi Node.js.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
					<button
						onClick={onSalinKodeServer}
						className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all font-medium flex items-center"
					>
						<Copy className="w-4 h-4 mr-2" />
						Salin Kode Server
					</button>
					<button
						onClick={onTutup}
						className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors"
					>
						Selesai
					</button>
				</div>
			</div>
		</div>
	);
}
