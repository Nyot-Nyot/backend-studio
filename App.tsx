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
import React, { useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { DatabaseView } from "./components/DatabaseView";
import { LogViewer } from "./components/LogViewer";
import { MockEditor } from "./components/MockEditor";
import { Sidebar } from "./components/Sidebar";
import { TestConsole } from "./components/TestConsole";
import { ToastContainer, ToastMessage, ToastType } from "./components/Toast";
import { generateEndpointConfig } from "./services/geminiService";
import { simulateRequest } from "./services/mockEngine";
import { generateOpenApiSpec } from "./services/openApiService";
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

	// Editor State
	const [editingMock, setEditingMock] = useState<MockEndpoint | null>(null);

	// Modals State
	const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

	// API Key UI State
	const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("api_sim_user_gemini_key") || "");
	const [showApiKey, setShowApiKey] = useState(false);
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

		if (loadedProjects.length === 0) {
			setProjects([DEFAULT_PROJECT]);
			setActiveProjectId(DEFAULT_PROJECT.id);
		} else {
			setProjects(loadedProjects);
			setActiveProjectId(lastProjectId || loadedProjects[0].id);
		}

		if (!loadedMocks || loadedMocks.length === 0) {
			const pingMock: MockEndpoint = {
				id: crypto.randomUUID(),
				projectId: DEFAULT_PROJECT.id,
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

	// --- SERVICE WORKER LISTENER ---
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data && event.data.type === "INTERCEPT_REQUEST") {
				const { payload } = event.data;
				const port = event.ports[0];

				// Debug: log incoming payload to help diagnose placeholder replacement
				console.debug("SW INTERCEPT payload:", {
					method: payload.method,
					url: payload.url,
					headers: payload.headers,
					bodySample: (payload.body || "").slice(0, 200),
				});

				const result = simulateRequest(
					payload.method,
					payload.url,
					payload.headers,
					payload.body,
					mocksRef.current,
					envVarsRef.current // Pass restored env vars
				);

				// Add Log
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

				if (port) {
					port.postMessage({ response: result.response });
				}
			}
		};

		navigator.serviceWorker.addEventListener("message", handleMessage);
		return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
	}, []);

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
			return [...prev, { ...mock, id: mock.id || crypto.randomUUID(), projectId: activeProjectId }];
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
		const prompt = window.prompt(
			"Describe the endpoint you want to create (e.g. 'A GET users list with pagination')"
		);
		if (!prompt) return;

		try {
			addToast("Generating configuration...", "info");
			const config = await generateEndpointConfig(prompt);

			const newMock: MockEndpoint = {
				id: crypto.randomUUID(),
				projectId: activeProjectId,
				name: config.name,
				path: config.path,
				method: config.method,
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
			addToast("Failed to generate endpoint. Check API Key.", "error");
		}
	};

	// --- HANDLERS: SETTINGS & DATA ---
	const handleSaveApiKey = () => {
		localStorage.setItem("api_sim_user_gemini_key", userApiKey);
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
		const data = { version: "1.0", timestamp: Date.now(), projects, mocks, envVars };
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
					const importedMocks = data.mocks.map((m: any) => ({ ...m, headers: m.headers || [] }));
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
		const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
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
	const generateServerCode = () => {
		const activeMocks = mocks.filter(m => m.projectId === activeProjectId && m.isActive);
		return `
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// In-Memory Database (Reset on restart)
const db = {};
const getCollection = (name) => { if (!db[name]) db[name] = []; return db[name]; };

// Mock Logic Helper
const matchesRoute = (routePath, reqPath) => {
    const routeParts = routePath.split('/').filter(Boolean);
    const reqParts = reqPath.split('/').filter(Boolean);
    if (routeParts.length !== reqParts.length) return false;
    const params = {};
    const match = routeParts.every((part, i) => {
        if (part.startsWith(':')) {
            params[part.substring(1)] = reqParts[i];
            return true;
        }
        return part === reqParts[i];
    });
    return match ? params : null;
};

// Routes
${activeMocks
	.map(
		m => `
app.${m.method.toLowerCase()}('${m.path}', async (req, res) => {
  // Logic for ${m.name}
  // Note: This is a static export. Dynamic simulation logic is simplified.
  res.status(${m.statusCode}).json(${m.responseBody});
});`
	)
	.join("\n")}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
`;
	};

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

				{view === "logs" && <LogViewer logs={logs} onClearLogs={() => setLogs([])} />}

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

... (file truncated for brevity in this API call)