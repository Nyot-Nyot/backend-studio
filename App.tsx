import { AlertTriangle, Download, FileCode, FileText, Mail, Rocket, Server, Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import EmailExportModal, { EmailExportParams } from "./components/EmailExportModal";
import { Sidebar } from "./components/Sidebar";
import { ToastContainer, ToastMessage, ToastType } from "./components/Toast";
import { FEATURES } from "./config/featureFlags";
import { generateServerCode as buildServerCode } from "./services/exportService";
import { simulateRequest } from "./services/mockEngine";
import { generateOpenApiSpec } from "./services/openApiService";
import socketClient from "./services/socketClient";
import { postErrorResponseToPort } from "./services/swHelpers";
import { kirimEmailDenganEmailJS } from "./services/wrappers"; // wrapper Bahasa Indonesia (non-breaking)
import {
	EnvironmentVariable,
	HttpMethod,
	LogEntry,
	MockEndpoint,
	Project,
	SwInterceptRequestPayload,
	SwMessageTypes,
	TestConsoleState,
	ViewState,
} from "./types";

// Storage keys dipindahkan ke src/config/storageKeys.ts untuk konsistensi dan kemudahan migrasi

const DEFAULT_PROJECT: Project = {
	id: "default",
	name: "Workspace Bawaan",
	createdAt: Date.now(),
};

import {
	STORAGE_KEY_MOCKS,
	STORAGE_KEY_PROYEK,
	STORAGE_KEY_PROYEK_AKTIF,
	STORAGE_KEY_VARIABEL_LINGKUNGAN,
} from "./config/storageKeys.ts";
import { dbService } from "./services/dbService";
import { bungkusMenjadiZipJikaPerlu, siapkanLampiranExport, validasiUkuranLampiran } from "./services/emailHelpers";
import { unduhBlob } from "./utils/download"; // util untuk memicu unduhan dan membersihkan ObjectURL

function App() {
	// --- STATUS APLIKASI ---
	const [tampilan, setTampilan] = useState<ViewState>("dashboard");
	const [proyek, setProyek] = useState<Project[]>([]);
	const [proyekAktifId, setProyekAktifId] = useState<string>("");
	const [rute, setRute] = useState<MockEndpoint[]>([]);

	// Variabel Lingkungan
	const [variabelLingkungan, setVariabelLingkungan] = useState<EnvironmentVariable[]>([]);

	const [catatanLog, setCatatanLog] = useState<LogEntry[]>([]);
	const [pesanToast, setPesanToast] = useState<ToastMessage[]>([]);
	// Status koneksi socket untuk indikator UI
	const [statusSocket, setStatusSocket] = useState<"connected" | "connecting" | "disconnected">("disconnected");
	const [mockSedangDiedit, setMockSedangDiedit] = useState<MockEndpoint | null>(null);

	// Status modal
	const [modalDeployTerbuka, setModalDeployTerbuka] = useState(false);
	// Status modal ekspor email
	const [modalEmailTerbuka, setModalEmailTerbuka] = useState(false);
	const [mengirimEmail, setMengirimEmail] = useState(false);

	// State UI API Key (kunci OpenRouter jika pengguna memilih memasukkan)
	const [kunciApiPengguna, setKunciApiPengguna] = useState(
		() => localStorage.getItem("api_sim_user_openrouter_key") || ""
	);
	const [tampilkanKunciApi, setTampilkanKunciApi] = useState(false);
	// Digunakan untuk memaksa re-render saat feature flag diganti di localStorage
	const [penghitungFitur, setPenghitungFitur] = useState(0);
	// Status kesehatan proxy: null = belum diketahui/periksa, true = sehat, false = tidak terjangkau
	const [proxySehat, setProxySehat] = useState<boolean | null>(null);

	// Pantau kesehatan proxy saat development atau ketika fitur AI terlihat
	React.useEffect(() => {
		let mounted = true;
		if (!FEATURES.AI()) return;
		const check = async () => {
			try {
				const res = await fetch("/openrouter/health");
				if (!mounted) return;
				setProxySehat(res.ok);
			} catch (e) {
				if (!mounted) return;
				setProxySehat(false);
			}
		};
		check();
		const id = setInterval(check, 10000);
		return () => {
			mounted = false;
			clearInterval(id);
		};
	}, [penghitungFitur]);

	// DEV: jika env mengaktifkan ekspor email, pastikan flag localStorage di-set agar UI langsung muncul
	React.useEffect(() => {
		if (typeof window !== "undefined" && (import.meta.env as any).VITE_ENABLE_EMAIL === "true") {
			if (window.localStorage.getItem("feature_email_export") !== "true") {
				window.localStorage.setItem("feature_email_export", "true");
				setPenghitungFitur(c => c + 1);
			}
		}
	}, []);
	const referensiInputBerkas = useRef<HTMLInputElement>(null);

	// Status Test Console
	const [statusKonsolUji, setStatusKonsolUji] = useState<TestConsoleState>({
		method: HttpMethod.GET,
		path: "/api/v1/resource",
		response: null,
	});

	// Refs untuk komunikasi Service Worker (menghindari closure yang usang)
	const referensiRute = useRef(rute);
	const referensiVariabelLingkungan = useRef(variabelLingkungan);

	useEffect(() => {
		referensiRute.current = rute;
	}, [rute]);
	useEffect(() => {
		referensiVariabelLingkungan.current = variabelLingkungan;
	}, [variabelLingkungan]);

	// --- INISIALISASI AWAL ---
	useEffect(() => {
		const loadedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY_PROYEK) || "[]");
		const loadedMocks = JSON.parse(localStorage.getItem(STORAGE_KEY_MOCKS) || "[]");
		const loadedEnvVars = JSON.parse(localStorage.getItem(STORAGE_KEY_VARIABEL_LINGKUNGAN) || "[]");
		const lastProjectId = localStorage.getItem(STORAGE_KEY_PROYEK_AKTIF);

		// Tentukan daftar proyek dan ID proyek aktif terlebih dahulu
		let nextProjects: Project[];
		let nextActiveProjectId: string;
		if (loadedProjects.length === 0) {
			nextProjects = [DEFAULT_PROJECT];
			nextActiveProjectId = DEFAULT_PROJECT.id;
		} else {
			nextProjects = loadedProjects;
			nextActiveProjectId = lastProjectId || loadedProjects[0].id;
		}
		setProyek(nextProjects);
		setProyekAktifId(nextActiveProjectId);

		// Inisialisasi mock; pastikan mock default dibuat di bawah proyek aktif
		if (!loadedMocks || loadedMocks.length === 0) {
			const pingMock: MockEndpoint = {
				id: crypto.randomUUID(),
				projectId: nextActiveProjectId,
				name: "Ping",
				path: "/api/ping",
				method: HttpMethod.GET,
				statusCode: 200,
				delay: 0,
				responseBody: JSON.stringify({ pong: true }),
				isActive: true,
				version: "1.0",
				createdAt: Date.now(),
				requestCount: 0,
				headers: [{ key: "Content-Type", value: "application/json" }],
				storeName: "",
				authConfig: { type: "NONE" },
			};
			setRute([pingMock]);
		} else {
			setRute(loadedMocks);
		}
		setVariabelLingkungan(loadedEnvVars);
	}, []);

	// Minta persistent storage (untuk mengurangi kemungkinan data dihapus oleh browser)
	useEffect(() => {
		const FLAG_KEY = "api_sim_persist_checked";
		const alreadyChecked = localStorage.getItem(FLAG_KEY);
		if (alreadyChecked) return;
		(async () => {
			try {
				// Only run if StorageManager API is available
				if (navigator.storage && navigator.storage.persist) {
					const isPersisted = await navigator.storage.persisted?.();
					if (!isPersisted) {
						const granted = await navigator.storage.persist();
						if (granted) {
							tambahToast(
								"Persistent storage diizinkan. Data Anda lebih kecil kemungkinannya akan terhapus.",
								"success"
							);
						} else if (import.meta.env?.DEV) {
							tambahToast("Persistent storage ditolak oleh browser.", "info");
						}
					}
				}
			} catch (e) {
				// Silent fail; no persistence on this browser
			} finally {
				// Mark that we've attempted the persistence check regardless of API support
				localStorage.setItem(FLAG_KEY, "1");
			}
		})();
	}, []);

	// --- PERSISTENSI ---
	useEffect(() => {
		if (proyek.length > 0) localStorage.setItem(STORAGE_KEY_PROYEK, JSON.stringify(proyek));
	}, [proyek]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_MOCKS, JSON.stringify(rute));
	}, [rute]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_VARIABEL_LINGKUNGAN, JSON.stringify(variabelLingkungan));
	}, [variabelLingkungan]);

	useEffect(() => {
		if (proyekAktifId) localStorage.setItem(STORAGE_KEY_PROYEK_AKTIF, proyekAktifId);
	}, [proyekAktifId]);

	// Ekspos helper khusus test untuk menyuntik data fixture selama e2e (DEV-only)
	if (import.meta.env?.DEV) {
		// Pasang implementasi internal yang dapat dipanggil oleh helper DEV
		(window as any).__internalSimulateRequestImpl = async (
			method: string,
			url: string,
			headersObj: Record<string, string> = {},
			body: string = ""
		) => {
			return await simulateRequest(
				method as any,
				url,
				headersObj,
				body,
				referensiRute.current,
				referensiVariabelLingkungan.current
			);
		};

		// Pasang helper dari modul devHelpers secara dinamis (hanya di DEV)
		import("./dev/devHelpers")
			.then(mod => {
				mod.pasangDevHelpers({
					setProyek,
					setRute,
					setProyekAktifId,
					referensiRute,
					referensiVariabelLingkungan,
					setPenghitungFitur,
				});
			})
			.catch(e => console.error("Gagal memuat devHelpers:", e));
	}

	// --- PENDENGAR SERVICE WORKER ---
	useEffect(() => {
		const handleMessage = async (event: MessageEvent) => {
			if (event.data && event.data.type === SwMessageTypes.INTERCEPT_REQUEST) {
				const { payload } = event.data as { payload: SwInterceptRequestPayload };
				const port = event.ports[0];

				// Debug: log incoming payload to help diagnose placeholder replacement (dev only)
				if (import.meta.env?.DEV) {
					console.debug("SW INTERCEPT payload:", {
						method: payload.method,
						url: payload.url,
						headers: payload.headers,
						bodySample: (payload.body || "").slice(0, 200),
					});
				}

				let result: any;
				try {
					result = await simulateRequest(
						payload.method,
						payload.url,
						payload.headers,
						payload.body,
						referensiRute.current,
						referensiVariabelLingkungan.current // Pass restored env vars
					);
				} catch (err) {
					console.error("[App] Error while handling INTERCEPT_REQUEST", err);
					if (event.ports && event.ports[0]) {
						postErrorResponseToPort(event.ports[0], "Kesalahan internal server");
					}
					return;
				}

				// Add Log (local)
				const newLog: LogEntry = {
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					method: payload.method as HttpMethod,
					path: new URL(payload.url).pathname,
					statusCode: result.response.status,
					duration: result.response.delay,
					ip: "127.0.0.1", // simulated
				};
				setCatatanLog(prev => [newLog, ...prev].slice(0, 500));

				// Forward log to socket server so other connected clients receive it
				const forwardPayload = {
					id: newLog.id,
					ts: newLog.timestamp,
					method: newLog.method,
					path: newLog.path,
					statusCode: newLog.statusCode,
					duration: newLog.duration,
					ip: newLog.ip,
					workspaceId: proyekAktifId || undefined,
				};

				try {
					if (socketClient.isConnected()) {
						socketClient.emit("log:publish", forwardPayload);
						console.info("[App] log diteruskan lewat socket", forwardPayload.id);
					} else {
						// HTTP fallback: call server's /emit-log endpoint (build from hostname to avoid double-port like http://localhost:3000:9150)
						const defaultPort =
							typeof import.meta !== "undefined" && (import.meta.env as any)?.VITE_SOCKET_PORT
								? String((import.meta.env as any).VITE_SOCKET_PORT)
								: "9150";
						const base =
							typeof window !== "undefined"
								? `${window.location.protocol}//${window.location.hostname}:${defaultPort}`
								: "http://localhost:9150";
						console.info("[App] url fallback emit-log", `${base}/emit-log`);
						fetch(`${base}/emit-log`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify(forwardPayload),
						}).catch(e => console.info("[App] fallback emit-log gagal", e));
					}
				} catch (e) {
					console.debug("[App] forward to socket failed", e);
				}

				if (port) {
					port.postMessage({ response: result.response });
				}
			}
		};

		navigator.serviceWorker.addEventListener("message", handleMessage);
		return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
	}, []);

	// --- ALIRAN LOG VIA SOCKET ---
	useEffect(() => {
		if (!FEATURES.LOG_VIEWER()) return;
		try {
			setStatusSocket("connecting");

			const onConnect = () => {
				console.info("[App] socket connected");
				setStatusSocket("connected");
				if (proyekAktifId) {
					socketClient.join(`logs:${proyekAktifId}`);
					console.info("[App] joined room", `logs:${proyekAktifId}`);
				}
			};
			const onDisconnect = () => {
				console.info("[App] socket disconnected");
				setStatusSocket("disconnected");
			};
			const onConnectError = (err: any) => {
				console.info("[App] socket connect_error", err?.message || err);
				setStatusSocket("disconnected");
			};
			// Register handlers BEFORE connecting to avoid missing early events
			socketClient.on("connect", onConnect);
			socketClient.on("disconnect", onDisconnect);
			socketClient.on("connect_error", onConnectError);

			// then connect
			socketClient.connect();

			const handler = (payload: any) => {
				const newLog: LogEntry = {
					id: payload.id || crypto.randomUUID(),
					timestamp: payload.ts || Date.now(),
					method: (payload.method as any) || "GET",
					path: payload.path || payload.url || "/",
					statusCode: payload.statusCode || 0,
					duration: payload.duration || 0,
					ip: payload.ip || payload.ipAddress || "0.0.0.0",
				};
				setCatatanLog(prev => {
					if (prev.some(l => l.id === newLog.id)) return prev;
					return [newLog, ...prev].slice(0, 500);
				});
			};
			socketClient.on("log:new", handler);
			return () => {
				socketClient.off("log:new", handler);
				socketClient.off("connect", onConnect);
				socketClient.off("disconnect", onDisconnect);
				socketClient.off("connect_error", onConnectError);
				if (proyekAktifId) socketClient.leave(`logs:${proyekAktifId}`);
				socketClient.disconnect();
				setStatusSocket("disconnected");
			};
		} catch (e) {
			console.error("Aliran log socket gagal", e);
		}
	}, [proyekAktifId]);

	// --- HELPERS ---
	const tambahToast = (message: string, type: ToastType, opts?: { duration?: number }) => {
		const id = crypto.randomUUID();
		setPesanToast(prev => [...prev, { id, message, type, duration: opts?.duration }]);
	};

	const hapusToast = (id: string) => {
		setPesanToast(prev => prev.filter(t => t.id !== id));
	};

	// --- HANDLERS: PROJECTS & MOCKS ---
	const buatWorkspaceBaru = (name: string) => {
		const newProject: Project = {
			id: crypto.randomUUID(),
			name,
			createdAt: Date.now(),
		};
		setProyek(prev => [...prev, newProject]);
		setProyekAktifId(newProject.id);
		tambahToast(`Workspace "${name}" dibuat`, "success");
	};

	const hapusWorkspace = (id: string) => {
		if (proyek.length <= 1) {
			tambahToast("Tidak dapat menghapus workspace terakhir", "error");
			return;
		}
		setProyek(prev => prev.filter(p => p.id !== id));
		setRute(prev => prev.filter(m => m.projectId !== id));
		if (proyekAktifId === id) {
			setProyekAktifId(proyek.find(p => p.id !== id)?.id || "");
		}
		tambahToast("Workspace berhasil dihapus", "info");
	};

	const simpanRute = (mock: MockEndpoint) => {
		setRute(prev => {
			const exists = prev.find(m => m.id === mock.id);
			if (exists) {
				return prev.map(m => (m.id === mock.id ? { ...mock, projectId: proyekAktifId } : m));
			}
			return [
				...prev,
				{
					...mock,
					id: mock.id || crypto.randomUUID(),
					projectId: proyekAktifId,
				},
			];
		});
		setMockSedangDiedit(null);
		setTampilan("dashboard");
		tambahToast("Rute berhasil disimpan", "success");
	};

	const hapusRute = (id: string) => {
		setRute(prev => prev.filter(m => m.id !== id));
		if (mockSedangDiedit?.id === id) {
			setMockSedangDiedit(null);
			setTampilan("dashboard");
		}
		tambahToast("Rute dihapus", "info");
	};

	// --- HANDLERS: AI & GENERATION ---
	const buatDenganAI = async () => {
		if (!FEATURES.AI()) {
			tambahToast("Fitur AI dinonaktifkan. Aktifkan via Pengaturan atau feature flags.", "info");
			return;
		}

		const prompt = window.prompt(
			"Describe the endpoint you want to create (e.g. 'A GET users list with pagination')"
		);
		if (!prompt) return;

		try {
			tambahToast("Menghasilkan konfigurasi...", "info");
			const { generateEndpointConfig } = await import("./services/aiService");
			const config = await generateEndpointConfig(prompt);

			const newMock: MockEndpoint = {
				id: crypto.randomUUID(),
				projectId: proyekAktifId,
				name: config.name,
				path: config.path,
				method: (config.method as any) || HttpMethod.GET,
				statusCode: config.statusCode,
				delay: 50,
				responseBody: config.responseBody,
				isActive: true,
				version: "1.0",
				createdAt: Date.now(),
				requestCount: 0,
				headers: [],
				storeName: "",
				authConfig: { type: "NONE" },
			};

			setMockSedangDiedit(newMock);
			setTampilan("editor");
			tambahToast("Draf dibuat oleh AI", "success");
		} catch (e) {
			const err = e as any;
			if (err?.code === "OPENROUTER_DISABLED") {
				tambahToast("Provider OpenRouter dinonaktifkan. Aktifkan di Pengaturan.", "error");
			} else if (err?.code === "OPENROUTER_TIMEOUT") {
				tambahToast(
					"Permintaan OpenRouter timeout. Periksa jaringan atau tingkatkan waktu tunggu proxy (OPENROUTER_TIMEOUT_MS)",
					"error"
				);
			} else {
				tambahToast("Gagal membuat endpoint. Periksa Kunci API atau proxy.", "error");
			}
		}
	};

	// --- HANDLERS: SETTINGS & DATA ---
	const simpanKunciApi = () => {
		localStorage.setItem("api_sim_user_openrouter_key", kunciApiPengguna);
		tambahToast("Kunci API disimpan", "success");
	};

	const handleAddEnvVar = () => {
		setVariabelLingkungan([...variabelLingkungan, { id: crypto.randomUUID(), key: "", value: "" }]);
	};

	const handleUpdateEnvVar = (id: string, field: "key" | "value", value: string) => {
		setVariabelLingkungan(prev => prev.map(v => (v.id === id ? { ...v, [field]: value } : v)));
	};

	const handleDeleteEnvVar = (id: string) => {
		setVariabelLingkungan(prev => prev.filter(v => v.id !== id));
	};

	const handleExportData = () => {
		const data = {
			version: "1.0",
			timestamp: Date.now(),
			proyek,
			rute,
			variabelLingkungan,
		};
		unduhBlob(
			new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
			`backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`
		);
		tambahToast("Konfigurasi diekspor", "success");
	};

	const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async e => {
			try {
				const content = e.target?.result as string;
				const data = JSON.parse(content);
				// Validate imported structure strictly
				try {
					await import("./services/validation").then(mod => mod.validateWorkspaceImport(data));
				} catch (vErr) {
					throw vErr;
				}
				if (
					confirm(
						`Ganti workspace saat ini dengan ${
							((data.proyek || data.projects) as any[]).length
						} workspace dan ${((data.rute || data.mocks) as any[]).length} rute?`
					)
				) {
					const importedProjects = data.proyek || data.projects || [];
					const importedMocks = (data.rute || data.mocks || []).map((m: any) => ({
						...m,
						headers: m.headers || [],
					}));
					setProyek(importedProjects);
					setRute(importedMocks);
					const importedEnvVars = data.variabelLingkungan || data.envVars || [];
					if (Array.isArray(importedEnvVars) && importedEnvVars.length > 0)
						setVariabelLingkungan(importedEnvVars);
					if (importedProjects.length > 0) {
						const currentActiveExists = importedProjects.find((p: Project) => p.id === proyekAktifId);
						if (!currentActiveExists) setProyekAktifId(importedProjects[0].id);
					}
					tambahToast("Impor workspace berhasil", "success");
				}
			} catch (error) {
				tambahToast("Gagal mengimpor: " + (error as Error).message, "error");
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	const handleExportOpenApi = () => {
		const currentProject = proyek.find(p => p.id === proyekAktifId);
		if (!currentProject) return;
		const spec = generateOpenApiSpec(currentProject, rute);
		unduhBlob(
			new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
			`openapi-${currentProject.name.toLowerCase().replace(/\s+/g, "-")}.json`
		);
		tambahToast("Spesifikasi OpenAPI diekspor!", "success");
	};

	// --- EXPORT SERVER & PACKAGE.JSON HANDLERS ---
	const buatKodeServer = useCallback(() => {
		const activeMocks = rute.filter(m => m.projectId === proyekAktifId && m.isActive);
		return buildServerCode(activeMocks);
	}, [rute, proyekAktifId]);
	// Alias backward-compatible: jangan gunakan alias baru di luar modul ini sebelum migrasi tests
	const generateServerCode = buatKodeServer;

	const generatePackageJson = () => {
		const currentProjectName = proyek.find(p => p.id === proyekAktifId)?.name || "backend-api";
		const safeName = currentProjectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		return JSON.stringify(
			{
				name: safeName,
				version: "1.0.0",
				description: "Dihasilkan oleh Backend Studio",
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

	const handleGenerateServer = () => {
		const code = generateServerCode();
		unduhBlob(new Blob([code], { type: "text/javascript" }), "server.js");
		tambahToast("server.js berhasil diunduh!", "success");
	};

	const handleDownloadPackageJson = () => {
		const code = generatePackageJson();
		unduhBlob(new Blob([code], { type: "application/json" }), "package.json");
		tambahToast("package.json berhasil diunduh!", "success");
	};

	const copyServerCode = () => {
		const code = generateServerCode();
		navigator.clipboard.writeText(code);
		tambahToast("Kode server disalin ke clipboard", "info");
	};

	const getAttachmentPreview = async ({
		includeWorkspace,
		includeOpenApi,
		includeServer,
	}: {
		includeWorkspace: boolean;
		includeOpenApi: boolean;
		includeServer: boolean;
	}) => {
		const files: { name: string; blob: Blob }[] = [];
		if (includeWorkspace) {
			files.push({
				name: `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
				blob: new Blob(
					[
						JSON.stringify(
							{ version: "1.0", timestamp: Date.now(), proyek, rute, variabelLingkungan },
							null,
							2
						),
					],
					{ type: "application/json" }
				),
			});
		}
		if (includeOpenApi) {
			const currentProject = proyek.find(p => p.id === proyekAktifId);
			if (currentProject) {
				const spec = generateOpenApiSpec(currentProject, rute);
				files.push({
					name: `openapi-${currentProject.name.toLowerCase().replace(/\s+/g, "-")}.json`,
					blob: new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
				});
			}
		}
		if (includeServer) {
			const code = generateServerCode();
			files.push({ name: "server.js", blob: new Blob([code], { type: "text/javascript" }) });
		}
		if (files.length === 0) return [];
		if (files.length > 1) {
			const { createZipBlob } = await import("./services/zipService");
			const zipBlob = (await createZipBlob(files)) as Blob;
			return [{ name: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`, size: zipBlob.size }];
		}
		return files.map(f => ({ name: f.name, size: f.blob.size || 0 }));
	};

	const sendEmail = async (params: EmailExportParams) => {
		setMengirimEmail(true);
		try {
			const {
				recipients,
				subject,
				message: originalMessage,
				includeWorkspace,
				includeOpenApi,
				includeServer,
			} = params;
			let messageToSend = originalMessage;
			let files: { name: string; blob: Blob }[] = [];

			if (includeWorkspace) {
				const workspaceFiles = await siapkanLampiranExport({
					includeWorkspace: true,
					includeOpenApi: false,
					includeServer: false,
					proyek,
					rute,
					variabelLingkungan,
					proyekAktifId,
				});
				files.push(...workspaceFiles);
			}

			if (includeOpenApi) {
				const currentProject = proyek.find(p => p.id === proyekAktifId);
				if (currentProject) {
					const spec = generateOpenApiSpec(currentProject, rute);
					files.push({
						name: `openapi-${currentProject.name.toLowerCase().replace(/\s+/g, "-")}.json`,
						blob: new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
					});
				}
			}

			if (includeServer) {
				const code = generateServerCode();
				files.push({ name: "server.js", blob: new Blob([code], { type: "text/javascript" }) });
			}

			// Jika lebih dari satu file, bungkus menjadi ZIP (menghasilkan satu attachment)
			let filesToSend = await bungkusMenjadiZipJikaPerlu(files);

			// Validasi ukuran total lampiran
			validasiUkuranLampiran(filesToSend);

			// Upload the single file to the helper and include a download link in the message
			let downloadUrl: string | null = null;
			if (filesToSend.length > 0) {
				try {
					const uploadService = await import("./services/uploadService");
					const res = await uploadService.uploadTempFile(filesToSend[0].blob, filesToSend[0].name);
					downloadUrl = res.url;
					messageToSend = `${messageToSend}\n\nUnduh berkas ekspor: ${downloadUrl} (kadaluarsa ${new Date(
						res.expiresAt
					).toLocaleString()})`;
				} catch (e: any) {
					tambahToast("Unggah gagal: " + (e?.message || "kesalahan tidak diketahui"), "error");
					throw e;
				}
			}
			const serviceId = (import.meta.env as any).VITE_EMAILJS_SERVICE_ID;
			const templateId = (import.meta.env as any).VITE_EMAILJS_TEMPLATE_ID;
			const publicKey = (import.meta.env as any).VITE_EMAILJS_PUBLIC_KEY;
			const demoMode =
				(typeof (import.meta as any).env !== "undefined" &&
					(import.meta as any).env.VITE_EMAILJS_DEMO === "true") ||
				process.env.VITE_EMAILJS_DEMO === "true";
			if (!serviceId || !templateId || !publicKey) {
				if (!demoMode) {
					throw new Error(
						"EmailJS not configured. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY."
					);
				}
			}

			// Send without attachments (we included a link instead)
			await kirimEmailDenganEmailJS(serviceId, templateId, publicKey, recipients, subject, messageToSend, []);
			tambahToast("Email terkirim!", "success");
			setModalEmailTerbuka(false);
		} catch (err: any) {
			tambahToast(err?.message || "Pengiriman email gagal", "error");
			throw err;
		} finally {
			setMengirimEmail(false);
		}
	};

	const handleFactoryReset = async () => {
		if (confirm("Anda yakin ingin mereset semuanya? Tindakan ini tidak dapat dibatalkan.")) {
			try {
				// Pastikan koleksi berbasis DB dibersihkan dan dipersistenkan
				await dbService.clearAllCollectionsAsync();
				// Bersihkan localStorage (feature flags, kunci aplikasi, dll.) untuk menyesuaikan perilaku sebelumnya
				localStorage.clear();
				tambahToast("Reset selesai", "success");
			} catch (err) {
				console.error("Reset pabrik gagal:", err);
				tambahToast("Reset pabrik gagal", "error");
			}
			// Muat ulang untuk menerapkan workspace bawaan
			window.location.reload();
		}
	};

	const ruteProyek = rute.filter(m => m.projectId === proyekAktifId);

	return (
		<div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
			<Sidebar
				currentView={tampilan}
				onChangeView={setTampilan}
				onNewMock={() => {
					setMockSedangDiedit(null);
					setTampilan("editor");
				}}
				onMagicCreate={buatDenganAI}
				proyek={proyek}
				proyekAktifId={proyekAktifId}
				onPilihProyek={setProyekAktifId}
				onBuatProyek={buatWorkspaceBaru}
				onHapusProyek={hapusWorkspace}
				onTriggerCommandPalette={() => tambahToast("Command Palette segera hadir", "info")}
				onDeploy={() => setModalDeployTerbuka(true)}
			/>

			<main className="flex-1 overflow-auto relative bg-[#f8fafc]">
				{tampilan === "settings" && (
					<div className="p-10">
						<div className="text-slate-400">Panel pengaturan sementara dinonaktifkan.</div>
					</div>
				)}

				{/* Konfigurasi AI Section */}
				{FEATURES.AI() && (
					<div className="p-8 max-w-4xl mx-auto text-slate-400">Konfigurasi AI sementara dinonaktifkan.</div>
				)}

				{FEATURES.EXPORT_SERVER() && (
					<div className="bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-700 text-white relative overflow-hidden group">
						{/* Export Runtime Section */}
						<div className="relative z-10">
							<h3 className="text-xl font-bold mb-2 flex items-center">
								<Server className="w-5 h-5 mr-3 text-brand-400" />
								Server Runtime
							</h3>
							<p className="text-slate-400 text-sm mb-6 max-w-2xl leading-relaxed">
								Export your endpoints as a standalone Node.js server. Useful for local development or
								deploying to cloud providers.{" "}
							</p>
							<button
								onClick={() => setModalDeployTerbuka(true)}
								className="flex items-center justify-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-900/50 active:scale-95"
							>
								<Rocket className="w-4 h-4" />
								<span>Buka Export Hub</span>
							</button>
						</div>{" "}
					</div>
				)}

				{/* Export Specification Section */}
				<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
					<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
						<FileText className="w-5 h-5 mr-3 text-indigo-600" />
						Spesifikasi API
					</h3>
					<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
						Ekspor desain API Anda sebagai berkas OpenAPI 3.0 (Swagger).
					</p>

					<button
						onClick={handleExportOpenApi}
						className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-all font-medium active:scale-95"
					>
						<FileCode className="w-4 h-4" />
						<span>Unduh openapi.json</span>
					</button>
				</div>

				{/* Data Management Section */}
				<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
					<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
						<Download className="w-5 h-5 mr-3 text-brand-600" />
						Data Ruang Kerja
					</h3>
					<p className="text-slate-500 text-sm mb-8 max-w-2xl leading-relaxed">
						Ekspor seluruh workspace termasuk semua proyek dan konfigurasi rute.
					</p>

					<div className="flex flex-col sm:flex-row gap-4">
						<button
							onClick={handleExportData}
							className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95"
						>
							<Download className="w-4 h-4" />
							<span>Ekspor Konfigurasi</span>
						</button>

						{FEATURES.EMAIL_EXPORT() && (
							<button
								onClick={() => setModalEmailTerbuka(true)}
								className="flex items-center justify-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-600 text-white rounded-xl border border-sky-800 transition-all font-medium active:scale-95 w-full sm:w-auto"
							>
								<Mail className="w-4 h-4 text-white" />
								<span>Kirim lewat Email</span>
							</button>
						)}

						<div className="relative">
							<input
								type="file"
								ref={referensiInputBerkas}
								onChange={handleImportData}
								className="hidden"
								accept=".json"
							/>
							<button
								onClick={() => referensiInputBerkas.current?.click()}
								className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95 w-full sm:w-auto"
							>
								<Upload className="w-4 h-4" />
								<span>Import Konfigurasi</span>
							</button>
						</div>
					</div>

					<div className="mt-6 p-4 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start border border-amber-100">
						<AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
						<span className="leading-5">
							<strong>Peringatan:</strong> Mengimpor data akan menggantikan semua workspace saat ini.
						</span>
					</div>
				</div>
			</main>

			{/* Export & Deploy Modal */}
			{modalDeployTerbuka && (
				<div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
					<div className="p-8 max-w-3xl mx-auto text-slate-400">
						Export & Deploy hub sementara dinonaktifkan untuk perbaikan parsing.
					</div>
				</div>
			)}

			<EmailExportModal
				isOpen={modalEmailTerbuka}
				onClose={() => setModalEmailTerbuka(false)}
				onSend={sendEmail}
				sending={mengirimEmail}
				getAttachmentPreview={getAttachmentPreview}
			/>
			<ToastContainer toasts={pesanToast} removeToast={hapusToast} />
		</div>
	);
}

export default App;
