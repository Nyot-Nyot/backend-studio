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
import { DatabaseView } from "./components/DatabaseView";
import EmailExportModal, { EmailExportParams } from "./components/EmailExportModal";
import { LogViewer } from "./components/LogViewer";
import { MockEditor } from "./components/MockEditor";
import { Sidebar } from "./components/Sidebar";
import { TestConsole } from "./components/TestConsole";
import { ToastContainer, ToastMessage, ToastType } from "./components/Toast";
import { FEATURES } from "./config/featureFlags";
import { sendEmailViaEmailJS } from "./services/emailService";
import { generateServerCode as buildServerCode } from "./services/exportService";
import { simulateRequest } from "./services/mockEngine";
import { generateOpenApiSpec } from "./services/openApiService";
import socketClient from "./services/socketClient";
import { EnvironmentVariable, HttpMethod, LogEntry, MockEndpoint, Project, TestConsoleState, ViewState } from "./types";

const STORAGE_KEY_PROJECTS = "api_sim_projects";
const STORAGE_KEY_MOCKS = "api_sim_mocks";
const STORAGE_KEY_ACTIVE_PROJECT = "api_sim_active_project";
const STORAGE_KEY_ENV_VARS = "api_sim_env_vars";

const DEFAULT_PROJECT: Project = {
	id: "default",
	name: "Default Workspace",
	createdAt: Date.now(),
};

function App() {
	// --- STATE ---
	const [view, setView] = useState<ViewState>("dashboard");
	const [projects, setProjects] = useState<Project[]>([]);
	const [activeProjectId, setActiveProjectId] = useState<string>("");
	const [mocks, setMocks] = useState<MockEndpoint[]>([]);

	// Environment Variables
	const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);

	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	// Socket connection state for UI indicator
	const [socketStatus, setSocketStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
	const [editingMock, setEditingMock] = useState<MockEndpoint | null>(null);

	// Modals State
	const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
	// Email Export Modal State
	const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
	const [sendingEmail, setSendingEmail] = useState(false);

	// API Key UI State (OpenRouter key if user opts to provide one)
	const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("api_sim_user_openrouter_key") || "");
	const [showApiKey, setShowApiKey] = useState(false);
	// Used to force re-render when feature flags are toggled in localStorage
	const [featureClock, setFeatureClock] = useState(0);
	// Proxy health status: null = unknown/checking, true = healthy, false = unreachable
	const [proxyHealthy, setProxyHealthy] = useState<boolean | null>(null);

	// Poll proxy health while in dev / when AI feature is visible
	React.useEffect(() => {
		let mounted = true;
		if (!FEATURES.AI()) return;
		const check = async () => {
			try {
				const res = await fetch("/openrouter/health");
				if (!mounted) return;
				setProxyHealthy(res.ok);
			} catch (e) {
				if (!mounted) return;
				setProxyHealthy(false);
			}
		};
		check();
		const id = setInterval(check, 10000);
		return () => {
			mounted = false;
			clearInterval(id);
		};
	}, [featureClock]);

	// DEV: if env enables email export, ensure the localStorage flag is set so UI appears immediately
	React.useEffect(() => {
		if (typeof window !== "undefined" && (import.meta.env as any).VITE_ENABLE_EMAIL === "true") {
			if (window.localStorage.getItem("feature_email_export") !== "true") {
				window.localStorage.setItem("feature_email_export", "true");
				setFeatureClock(c => c + 1);
			}
		}
	}, []);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Test Console State
	const [testConsoleState, setTestConsoleState] = useState<TestConsoleState>({
		method: HttpMethod.GET,
		path: "/api/v1/resource",
		response: null,
	});

	// Refs for SW communication (to avoid stale closures)
	const mocksRef = useRef(mocks);
	const envVarsRef = useRef(envVars);

	useEffect(() => {
		mocksRef.current = mocks;
	}, [mocks]);
	useEffect(() => {
		envVarsRef.current = envVars;
	}, [envVars]);

	// --- INITIAL LOAD ---
	useEffect(() => {
		const loadedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY_PROJECTS) || "[]");
		const loadedMocks = JSON.parse(localStorage.getItem(STORAGE_KEY_MOCKS) || "[]");
		const loadedEnvVars = JSON.parse(localStorage.getItem(STORAGE_KEY_ENV_VARS) || "[]");
		const lastProjectId = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);

		// Determine projects and the active project ID first
		let nextProjects: Project[];
		let nextActiveProjectId: string;
		if (loadedProjects.length === 0) {
			nextProjects = [DEFAULT_PROJECT];
			nextActiveProjectId = DEFAULT_PROJECT.id;
		} else {
			nextProjects = loadedProjects;
			nextActiveProjectId = lastProjectId || loadedProjects[0].id;
		}
		setProjects(nextProjects);
		setActiveProjectId(nextActiveProjectId);

		// Initialize mocks; ensure default mock is created under the active project
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
			setMocks([pingMock]);
		} else {
			setMocks(loadedMocks);
		}
		setEnvVars(loadedEnvVars);
	}, []);

	// Request persistent storage (to reduce chance of data being wiped by the browser)
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
							addToast("Storage persistence granted. Your data is less likely to be cleared.", "success");
						} else if (import.meta.env?.DEV) {
							addToast("Storage persistence denied by the browser.", "info");
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

	// --- PERSISTENCE ---
	useEffect(() => {
		if (projects.length > 0) localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
	}, [projects]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_MOCKS, JSON.stringify(mocks));
	}, [mocks]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_ENV_VARS, JSON.stringify(envVars));
	}, [envVars]);

	useEffect(() => {
		if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, activeProjectId);
	}, [activeProjectId]);

	// Expose a test-only helper to inject fixture data during e2e tests (DEV-only)
	if (import.meta.env?.DEV) {
		// Attach a helper to the window that tests can call to set projects/mocks
		// Usage (page.evaluate): window.__applyTestFixtures(projects, mocks, activeProjectId)
		(window as any).__applyTestFixtures = (
			projectsValue: any[],
			mocksValue: any[],
			activeProjectIdValue?: string
		) => {
			try {
				setProjects(projectsValue);
				setMocks(mocksValue);
				if (activeProjectIdValue) setActiveProjectId(activeProjectIdValue);
				// Persist to localStorage as well
				localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projectsValue));
				localStorage.setItem(STORAGE_KEY_MOCKS, JSON.stringify(mocksValue));
				if (activeProjectIdValue) localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, activeProjectIdValue);
				return true;
			} catch (err) {
				console.error("applyTestFixtures failed", err);
				return false;
			}
		};

		// Also expose a test helper to directly call simulateRequest with the current in-memory mocks
		(window as any).__simulateRequest = async (
			method: string,
			url: string,
			headersObj: Record<string, string> = {},
			body: string = ""
		) => {
			try {
				const res = await simulateRequest(
					method as any,
					url,
					headersObj,
					body,
					mocksRef.current,
					envVarsRef.current
				);
				return res;
			} catch (err) {
				console.error("simulateRequest helper error", err);
				throw err;
			}
		};

		// Test helper to set mocks directly into the runtime (bypass storage races)
		(window as any).__setMocksDirect = (mocksValue: any[]) => {
			try {
				mocksRef.current = mocksValue;
				setMocks(mocksValue);
				localStorage.setItem(STORAGE_KEY_MOCKS, JSON.stringify(mocksValue));
				return true;
			} catch (e) {
				console.error("setMocksDirect failed", e);
				return false;
			}
		};
	}

	// --- SERVICE WORKER LISTENER ---
	useEffect(() => {
		const handleMessage = async (event: MessageEvent) => {
			if (event.data && event.data.type === "INTERCEPT_REQUEST") {
				const { payload } = event.data;
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

				const result = await simulateRequest(
					payload.method,
					payload.url,
					payload.headers,
					payload.body,
					mocksRef.current,
					envVarsRef.current // Pass restored env vars
				);

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
				setLogs(prev => [newLog, ...prev].slice(0, 500));

				// Forward log to socket server so other connected clients receive it
				const forwardPayload = {
					id: newLog.id,
					ts: newLog.timestamp,
					method: newLog.method,
					path: newLog.path,
					statusCode: newLog.statusCode,
					duration: newLog.duration,
					ip: newLog.ip,
					workspaceId: activeProjectId || undefined,
				};

				try {
					if (socketClient.isConnected()) {
						socketClient.emit("log:publish", forwardPayload);
						console.info("[App] forwarded log via socket", forwardPayload.id);
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
						console.info("[App] emit-log fallback url", `${base}/emit-log`);
						fetch(`${base}/emit-log`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify(forwardPayload),
						}).catch(e => console.info("[App] emit-log fallback failed", e));
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

	// --- SOCKET LOG STREAM ---
	useEffect(() => {
		if (!FEATURES.LOG_VIEWER()) return;
		try {
			setSocketStatus("connecting");

			const onConnect = () => {
				console.info("[App] socket connected");
				setSocketStatus("connected");
				if (activeProjectId) {
					socketClient.join(`logs:${activeProjectId}`);
					console.info("[App] joined room", `logs:${activeProjectId}`);
				}
			};
			const onDisconnect = () => {
				console.info("[App] socket disconnected");
				setSocketStatus("disconnected");
			};
			const onConnectError = (err: any) => {
				console.info("[App] socket connect_error", err?.message || err);
				setSocketStatus("disconnected");
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
				setLogs(prev => {
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
				if (activeProjectId) socketClient.leave(`logs:${activeProjectId}`);
				socketClient.disconnect();
				setSocketStatus("disconnected");
			};
		} catch (e) {
			console.error("Socket log stream failed", e);
		}
	}, [activeProjectId]);

	// --- HELPERS ---
	const addToast = (message: string, type: ToastType) => {
		const id = crypto.randomUUID();
		setToasts(prev => [...prev, { id, message, type }]);
	};

	const removeToast = (id: string) => {
		setToasts(prev => prev.filter(t => t.id !== id));
	};

	// --- HANDLERS: PROJECTS & MOCKS ---
	const handleCreateProject = (name: string) => {
		const newProject: Project = {
			id: crypto.randomUUID(),
			name,
			createdAt: Date.now(),
		};
		setProjects(prev => [...prev, newProject]);
		setActiveProjectId(newProject.id);
		addToast(`Workspace "${name}" created`, "success");
	};

	const handleDeleteProject = (id: string) => {
		if (projects.length <= 1) {
			addToast("Cannot delete the last workspace", "error");
			return;
		}
		setProjects(prev => prev.filter(p => p.id !== id));
		setMocks(prev => prev.filter(m => m.projectId !== id));
		if (activeProjectId === id) {
			setActiveProjectId(projects.find(p => p.id !== id)?.id || "");
		}
		addToast("Workspace deleted", "info");
	};

	const handleSaveMock = (mock: MockEndpoint) => {
		setMocks(prev => {
			const exists = prev.find(m => m.id === mock.id);
			if (exists) {
				return prev.map(m => (m.id === mock.id ? { ...mock, projectId: activeProjectId } : m));
			}
			return [
				...prev,
				{
					...mock,
					id: mock.id || crypto.randomUUID(),
					projectId: activeProjectId,
				},
			];
		});
		setEditingMock(null);
		setView("dashboard");
		addToast("Route saved successfully", "success");
	};

	const handleDeleteMock = (id: string) => {
		setMocks(prev => prev.filter(m => m.id !== id));
		if (editingMock?.id === id) {
			setEditingMock(null);
			setView("dashboard");
		}
		addToast("Route deleted", "info");
	};

	// --- HANDLERS: AI & GENERATION ---
	const handleMagicCreate = async () => {
		if (!FEATURES.AI()) {
			addToast("AI features are disabled. Enable via Settings or feature flags.", "info");
			return;
		}

		const prompt = window.prompt(
			"Describe the endpoint you want to create (e.g. 'A GET users list with pagination')"
		);
		if (!prompt) return;

		try {
			addToast("Generating configuration...", "info");
			const { generateEndpointConfig } = await import("./services/aiService");
			const config = await generateEndpointConfig(prompt);

			const newMock: MockEndpoint = {
				id: crypto.randomUUID(),
				projectId: activeProjectId,
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

			setEditingMock(newMock);
			setView("editor");
			addToast("Draft generated from AI", "success");
		} catch (e) {
			const msg = (e as Error).message || "";
			if (msg.includes("OPENROUTER_DISABLED"))
				addToast("OpenRouter provider disabled. Enable in Settings.", "error");
			else addToast("Failed to generate endpoint. Check API Key or proxy.", "error");
		}
	};

	// --- HANDLERS: SETTINGS & DATA ---
	const handleSaveApiKey = () => {
		localStorage.setItem("api_sim_user_openrouter_key", userApiKey);
		addToast("API Key saved securely", "success");
	};

	const handleAddEnvVar = () => {
		setEnvVars([...envVars, { id: crypto.randomUUID(), key: "", value: "" }]);
	};

	const handleUpdateEnvVar = (id: string, field: "key" | "value", value: string) => {
		setEnvVars(prev => prev.map(v => (v.id === id ? { ...v, [field]: value } : v)));
	};

	const handleDeleteEnvVar = (id: string) => {
		setEnvVars(prev => prev.filter(v => v.id !== id));
	};

	const handleExportData = () => {
		const data = {
			version: "1.0",
			timestamp: Date.now(),
			projects,
			mocks,
			envVars,
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		addToast("Configuration exported", "success");
	};

	const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = e => {
			try {
				const content = e.target?.result as string;
				const data = JSON.parse(content);
				if (!Array.isArray(data.projects) || !Array.isArray(data.mocks)) throw new Error("Invalid file format");
				if (
					confirm(
						`Replace current workspace with ${data.projects.length} projects and ${data.mocks.length} routes?`
					)
				) {
					setProjects(data.projects);
					const importedMocks = data.mocks.map((m: any) => ({
						...m,
						headers: m.headers || [],
					}));
					setMocks(importedMocks);
					if (data.envVars && Array.isArray(data.envVars)) setEnvVars(data.envVars);
					if (data.projects.length > 0) {
						const currentActiveExists = data.projects.find((p: Project) => p.id === activeProjectId);
						if (!currentActiveExists) setActiveProjectId(data.projects[0].id);
					}
					addToast("Workspace import successful", "success");
				}
			} catch (error) {
				addToast("Failed to import: " + (error as Error).message, "error");
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	const handleExportOpenApi = () => {
		const currentProject = projects.find(p => p.id === activeProjectId);
		if (!currentProject) return;
		const spec = generateOpenApiSpec(currentProject, mocks);
		const blob = new Blob([JSON.stringify(spec, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `openapi-${currentProject.name.toLowerCase().replace(/\s+/g, "-")}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		addToast("OpenAPI Specification exported!", "success");
	};

	// --- EXPORT SERVER & PACKAGE.JSON HANDLERS ---
	const generateServerCode = useCallback(() => {
		const activeMocks = mocks.filter(m => m.projectId === activeProjectId && m.isActive);
		return buildServerCode(activeMocks);
	}, [mocks, activeProjectId]);

	const generatePackageJson = () => {
		const currentProjectName = projects.find(p => p.id === activeProjectId)?.name || "backend-api";
		const safeName = currentProjectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

		return JSON.stringify(
			{
				name: safeName,
				version: "1.0.0",
				description: "Generated by Backend Studio",
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
		const blob = new Blob([code], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "server.js";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		addToast("server.js downloaded successfully!", "success");
	};

	const handleDownloadPackageJson = () => {
		const code = generatePackageJson();
		const blob = new Blob([code], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "package.json";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		addToast("package.json downloaded!", "success");
	};

	const copyServerCode = () => {
		const code = generateServerCode();
		navigator.clipboard.writeText(code);
		addToast("Server code copied to clipboard", "info");
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
					[JSON.stringify({ version: "1.0", timestamp: Date.now(), projects, mocks, envVars }, null, 2)],
					{ type: "application/json" }
				),
			});
		}
		if (includeOpenApi) {
			const currentProject = projects.find(p => p.id === activeProjectId);
			if (currentProject) {
				const spec = generateOpenApiSpec(currentProject, mocks);
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
			const zipBlob = await (await import("./services/zipService")).createZipBlob(files);
			return [{ name: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`, size: zipBlob.size }];
		}
		return files.map(f => ({ name: f.name, size: f.blob.size || 0 }));
	};

	const sendEmail = async (params: EmailExportParams) => {
		setSendingEmail(true);
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
			const files: { name: string; blob: Blob }[] = [];

			if (includeWorkspace) {
				const data = {
					version: "1.0",
					timestamp: Date.now(),
					projects,
					mocks,
					envVars,
				};
				files.push({
					name: `backend-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
					blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
				});
			}

			if (includeOpenApi) {
				const currentProject = projects.find(p => p.id === activeProjectId);
				if (currentProject) {
					const spec = generateOpenApiSpec(currentProject, mocks);
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

			// If multiple files are selected, bundle into a ZIP (keeps a single attachment)
			let filesToSend = files;
			if (files.length > 1) {
				const zipBlob = await (await import("./services/zipService")).createZipBlob(files);
				filesToSend = [
					{ name: `backend-studio-export-${new Date().toISOString().slice(0, 10)}.zip`, blob: zipBlob },
				];
			}

			// Size check: fail early if larger than 20MB
			const totalBytes = filesToSend.reduce((s, f) => s + (f.blob.size || 0), 0);
			if (totalBytes > 20 * 1024 * 1024)
				throw new Error("Attachments exceed 20 MB limit. Reduce attachment size.");

			// Upload the single file to the helper and include a download link in the message
			let downloadUrl: string | null = null;
			if (filesToSend.length > 0) {
				try {
					const uploadService = await import("./services/uploadService");
					const res = await uploadService.uploadTempFile(filesToSend[0].blob, filesToSend[0].name);
					downloadUrl = res.url;
					messageToSend = `${messageToSend}\n\nDownload exported files: ${downloadUrl} (expires ${new Date(
						res.expiresAt
					).toLocaleString()})`;
				} catch (e: any) {
					addToast("Upload failed: " + (e?.message || "unknown error"), "error");
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
			await sendEmailViaEmailJS(serviceId, templateId, publicKey, recipients, subject, messageToSend, []);
			addToast("Email sent!", "success");
			setIsEmailModalOpen(false);
		} catch (err: any) {
			addToast(err?.message || "Email send failed", "error");
			throw err;
		} finally {
			setSendingEmail(false);
		}
	};

	const handleFactoryReset = () => {
		if (confirm("Are you sure you want to reset everything? This cannot be undone.")) {
			localStorage.clear();
			window.location.reload();
		}
	};

	const projectMocks = mocks.filter(m => m.projectId === activeProjectId);

	return (
		<div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
			<Sidebar
				currentView={view}
				onChangeView={setView}
				onNewMock={() => {
					setEditingMock(null);
					setView("editor");
				}}
				onMagicCreate={handleMagicCreate}
				projects={projects}
				activeProjectId={activeProjectId}
				onSelectProject={setActiveProjectId}
				onCreateProject={handleCreateProject}
				onDeleteProject={handleDeleteProject}
				onTriggerCommandPalette={() => addToast("Command Palette coming soon", "info")}
				onDeploy={() => setIsDeployModalOpen(true)}
			/>

			<main className="flex-1 overflow-auto relative bg-[#f8fafc]">
				{view === "dashboard" && (
					<Dashboard
						mocks={projectMocks}
						onEdit={mock => {
							setEditingMock(mock);
							setView("editor");
						}}
						onDelete={handleDeleteMock}
						onBulkDelete={ids => setMocks(prev => prev.filter(m => !ids.includes(m.id)))}
						onToggle={id =>
							setMocks(prev => prev.map(m => (m.id === id ? { ...m, isActive: !m.isActive } : m)))
						}
						onDuplicate={mock => {
							const newMock = {
								...mock,
								id: crypto.randomUUID(),
								name: `${mock.name} (Copy)`,
								path: `${mock.path}-copy`,
							};
							setMocks(prev => [...prev, newMock]);
							addToast("Route duplicated", "success");
						}}
						addToast={addToast}
					/>
				)}

				{view === "editor" && (
					<MockEditor
						initialData={editingMock}
						existingMocks={projectMocks}
						onSave={handleSaveMock}
						onDelete={handleDeleteMock}
						onCancel={() => setView("dashboard")}
						addToast={addToast}
					/>
				)}

				{view === "test" && (
					<TestConsole mocks={projectMocks} state={testConsoleState} setState={setTestConsoleState} />
				)}

				{view === "logs" && FEATURES.LOG_VIEWER() && (
					<LogViewer logs={logs} onClearLogs={() => setLogs([])} socketStatus={socketStatus} />
				)}

				{view === "database" && <DatabaseView />}

				{view === "settings" && (
					<div className="p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
						<div className="flex items-center space-x-3 mb-6">
							<h2 className="text-3xl font-bold text-slate-800 tracking-tight">System Settings</h2>
						</div>

						{/* Environment Variables Section */}
						<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
							<div className="flex items-center justify-between mb-2">
								<h3 className="text-xl font-semibold text-slate-800 flex items-center">
									<Globe className="w-5 h-5 mr-3 text-emerald-600" />
									Global Environment Variables
								</h3>
								<button
									onClick={handleAddEnvVar}
									className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
								>
									<Plus className="w-4 h-4" />
									<span>Add Variable</span>
								</button>
							</div>
							<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
								Define global variables (like <code>base_url</code> or <code>api_token</code>) that can
								be reused in your endpoint responses using the syntax <code>{`{{variable_name}}`}</code>
								.
							</p>

							<div className="space-y-3">
								{envVars.length === 0 ? (
									<div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
										No environment variables defined.
									</div>
								) : (
									<div className="grid grid-cols-12 gap-3 mb-2 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
										<div className="col-span-4">Variable Name</div>
										<div className="col-span-7">Initial Value</div>
										<div className="col-span-1"></div>
									</div>
								)}

								{envVars.map(v => (
									<div key={v.id} className="grid grid-cols-12 gap-3 items-center group">
										<div className="col-span-4 relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono select-none">{`{{`}</span>
											<input
												type="text"
												value={v.key}
												onChange={e => handleUpdateEnvVar(v.id, "key", e.target.value)}
												placeholder="variable_name"
												className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-7 pr-7 text-sm font-mono text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono select-none">{`}}`}</span>
										</div>
										<div className="col-span-7">
											<input
												type="text"
												value={v.value}
												onChange={e => handleUpdateEnvVar(v.id, "value", e.target.value)}
												placeholder="Value"
												className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
											/>
										</div>
										<div className="col-span-1 flex justify-end">
											<button
												onClick={() => handleDeleteEnvVar(v.id)}
												className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* AI Configuration Section */}
						{FEATURES.AI() && (
							<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
								<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center justify-between">
									<div className="flex items-center">
										<Key className="w-5 h-5 mr-3 text-violet-600" />
										AI Configuration
									</div>
									<div className="text-sm">
										{proxyHealthy === null ? (
											<span className="text-slate-400">Checking proxy…</span>
										) : proxyHealthy ? (
											<span className="text-emerald-600">Proxy: running</span>
										) : (
											<span className="text-rose-500">Proxy: unavailable</span>
										)}
									</div>
								</h3>
								<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
									Optionally provide an OpenRouter API key for direct calls (recommended: run the
									local proxy and set a server-side key instead). Store keys only if you understand
									they are visible to your browser localStorage.
								</p>

								<div className="max-w-xl space-y-4">
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
											OpenRouter API Key (optional)
										</label>
										<div className="relative">
											<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
												<ShieldCheck className="h-5 w-5 text-slate-400" />
											</div>
											<input
												type={showApiKey ? "text" : "password"}
												value={userApiKey}
												onChange={e => setUserApiKey(e.target.value)}
												className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all text-sm font-mono"
												placeholder="sk-or-..."
											/>
											<button
												onClick={() => setShowApiKey(!showApiKey)}
												className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
											>
												{showApiKey ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
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
											Get a free API Key
										</a>
										<button
											onClick={handleSaveApiKey}
											className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-sm transition-all shadow-md shadow-violet-200 active:scale-95"
										>
											Save Key
										</button>
									</div>
								</div>
							</div>
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
										Export your endpoints as a standalone Node.js server. Useful for local
										development or deploying to cloud providers.
									</p>

									<button
										onClick={() => setIsDeployModalOpen(true)}
										className="flex items-center justify-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-900/50 active:scale-95"
									>
										<Rocket className="w-4 h-4" />
										<span>Open Export Hub</span>
									</button>
								</div>
							</div>
						)}

						{/* Export Specification Section */}
						<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
							<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
								<FileText className="w-5 h-5 mr-3 text-indigo-600" />
								API Specification
							</h3>
							<p className="text-slate-500 text-sm mb-6 max-w-2xl leading-relaxed">
								Export your API design as a standard OpenAPI 3.0 (Swagger) file.
							</p>

							<button
								onClick={handleExportOpenApi}
								className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-all font-medium active:scale-95"
							>
								<FileCode className="w-4 h-4" />
								<span>Download openapi.json</span>
							</button>
						</div>

						{/* Data Management Section */}
						<div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
							<h3 className="text-xl font-semibold text-slate-800 mb-2 flex items-center">
								<Download className="w-5 h-5 mr-3 text-brand-600" />
								Workspace Data
							</h3>
							<p className="text-slate-500 text-sm mb-8 max-w-2xl leading-relaxed">
								Export your entire workspace including all projects and route configurations.
							</p>

							<div className="flex flex-col sm:flex-row gap-4">
								<button
									onClick={handleExportData}
									className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95"
								>
									<Download className="w-4 h-4" />
									<span>Export Configuration</span>
								</button>

								{FEATURES.EMAIL_EXPORT() && (
									<button
										onClick={() => setIsEmailModalOpen(true)}
										className="flex items-center justify-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-600 text-white rounded-xl border border-sky-800 transition-all font-medium active:scale-95 w-full sm:w-auto"
									>
										<Mail className="w-4 h-4 text-white" />
										<span>Send via Email</span>
									</button>
								)}

								<div className="relative">
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImportData}
										className="hidden"
										accept=".json"
									/>
									<button
										onClick={() => fileInputRef.current?.click()}
										className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium active:scale-95 w-full sm:w-auto"
									>
										<Upload className="w-4 h-4" />
										<span>Import Configuration</span>
									</button>
								</div>
							</div>

							<div className="mt-6 p-4 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start border border-amber-100">
								<AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
								<span className="leading-5">
									<strong>Warning:</strong> Importing data will completely replace your current
									workspace.
								</span>
							</div>
						</div>

						{/* Danger Zone */}
						<div className="bg-red-50 p-8 rounded-2xl shadow-sm border border-red-100">
							<h3 className="text-xl font-semibold text-red-900 mb-2 flex items-center">
								<RefreshCw className="w-5 h-5 mr-3" />
								Danger Zone
							</h3>
							<p className="text-red-700/80 text-sm mb-6 max-w-2xl leading-relaxed">
								Resetting the application will clear all local storage data.
							</p>

							<button
								onClick={handleFactoryReset}
								className="flex items-center justify-center space-x-2 px-6 py-3 bg-white hover:bg-red-100 text-red-600 rounded-xl border border-red-200 hover:border-red-300 transition-all font-bold active:scale-95 shadow-sm"
							>
								<AlertTriangle className="w-4 h-4" />
								<span>Factory Reset</span>
							</button>
						</div>
					</div>
				)}
			</main>

			{/* Export & Deploy Modal */}
			{isDeployModalOpen && (
				<div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
					<div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-700 flex flex-col overflow-hidden max-h-[90vh]">
						<div className="p-6 border-b border-slate-800 flex items-center justify-between">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center">
									<Rocket className="w-5 h-5 mr-3 text-emerald-400" />
									Export & Deploy Hub
								</h2>
								<p className="text-slate-400 text-sm mt-1">
									Export your endpoints as a standalone Node.js application.
								</p>
							</div>
							<button
								onClick={() => setIsDeployModalOpen(false)}
								className="text-slate-500 hover:text-white transition-colors"
							>
								<X className="w-6 h-6" />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-8">
							{/* Intro */}
							<div className="flex items-start gap-4 mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
								<div className="bg-slate-700 p-2 rounded-lg">
									<Info className="w-5 h-5 text-slate-300" />
								</div>
								<div>
									<h4 className="text-slate-200 font-bold text-sm mb-1">How it works</h4>
									<p className="text-slate-400 text-sm leading-relaxed">
										Since Backend Studio runs entirely in your browser, external tools cannot access
										it directly. To deploy to the cloud (or run locally), you must export the
										generated <code>server.js</code> file.
									</p>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								{/* Local Setup */}
								<div>
									<label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
										<Terminal className="w-3.5 h-3.5" /> Localhost Setup
									</label>
									<div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs relative group mb-4">
										<div className="p-4 text-slate-300 space-y-2">
											<div className="flex gap-2 opacity-50">
												<span className="select-none"># 1. Create folder & download files</span>
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
										Download both files below to start a real local server on port 3000.
									</p>
									<div className="flex flex-col gap-2">
										<button
											onClick={handleGenerateServer}
											className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all flex items-center justify-between group border border-slate-700"
										>
											<span className="flex items-center gap-2">
												<FileCode className="w-4 h-4 text-emerald-500" /> Download server.js
											</span>
											<Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
										</button>
										<button
											onClick={handleDownloadPackageJson}
											className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all flex items-center justify-between group border border-slate-700"
										>
											<span className="flex items-center gap-2">
												<Package className="w-4 h-4 text-orange-400" /> Download package.json
											</span>
											<Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
										</button>
										{FEATURES.EMAIL_EXPORT() && (
											<button
												onClick={() => setIsEmailModalOpen(true)}
												className="px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-medium transition-all flex items-center justify-between group border border-sky-800"
											>
												<span className="flex items-center gap-2">
													<Mail className="w-4 h-4 text-white" /> Send via Email
												</span>
											</button>
										)}
									</div>
								</div>
								{/* Cloud Setup */}
								<div>
									<label className="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center gap-2">
										<Cloud className="w-3.5 h-3.5" /> Deploy to Cloud
									</label>
									<div className="space-y-3">
										<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
											<h5 className="text-slate-200 font-bold text-xs mb-1">1. Prepare Files</h5>
											<p className="text-slate-400 text-xs">
												Download both <code>server.js</code> and <code>package.json</code> from
												the left panel.
											</p>
										</div>
										<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
											<h5 className="text-slate-200 font-bold text-xs mb-1">2. Push to Git</h5>
											<p className="text-slate-400 text-xs">
												Commit these files to a GitHub/GitLab repository.
											</p>
										</div>
										<div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
											<h5 className="text-slate-200 font-bold text-xs mb-1">
												3. Connect Provider
											</h5>
											<p className="text-slate-400 text-xs">
												Link your repo to <strong>Render, Railway, or Vercel</strong>. They will
												auto-detect the Node.js app.
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
							<button
								onClick={copyServerCode}
								className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all font-medium flex items-center"
							>
								<Copy className="w-4 h-4 mr-2" />
								Copy Server Code
							</button>
							<button
								onClick={() => setIsDeployModalOpen(false)}
								className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors"
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

			<EmailExportModal
				isOpen={isEmailModalOpen}
				onClose={() => setIsEmailModalOpen(false)}
				onSend={sendEmail}
				sending={sendingEmail}
				getAttachmentPreview={getAttachmentPreview}
			/>
			<ToastContainer toasts={toasts} removeToast={removeToast} />
		</div>
	);
}

export default App;
