import { CheckCircle, Database, Download, Info, RefreshCw, Upload, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { exportAllData, importAllData, isIndexedDBAvailable } from "../services/indexedDB";
import { getLocalStorageBackup, getMigrationStatus, resetMigrationState, runMigration } from "../services/migration";
import { StorageService } from "../services/storageService";
import { Project } from "../types";

interface DatabaseMigrationPanelProps {
	addToast: (message: string, type: "success" | "error" | "info") => void;
}

export const DatabaseMigrationPanel: React.FC<DatabaseMigrationPanelProps> = ({ addToast }) => {
	const [migrationStatus, setMigrationStatus] = useState(getMigrationStatus());
	const [isLoading, setIsLoading] = useState(false);
	const [currentBackend, setCurrentBackend] = useState<string>("localStorage");
	const [migrationProgress, setMigrationProgress] = useState({ stage: "", progress: 0 });

	const refreshStatus = () => {
		setMigrationStatus(getMigrationStatus());
		setCurrentBackend(StorageService.getBackend());
	};

	useEffect(() => {
		refreshStatus();
	}, []);

	const handleRunMigration = async () => {
		setIsLoading(true);
		setMigrationProgress({ stage: "Starting migration...", progress: 0 });

		try {
			const result = await runMigration((stage, progress) => {
				setMigrationProgress({ stage, progress });
			});

			if (result.success) {
				addToast(`Migration completed! ${result.totalRecords} records migrated.`, "success");
				refreshStatus();
			} else {
				addToast(`Migration failed: ${result.errors.join(", ")}`, "error");
			}
		} catch (error) {
			addToast(`Migration error: ${error}`, "error");
		} finally {
			setIsLoading(false);
			setMigrationProgress({ stage: "", progress: 0 });
		}
	};

	const handleResetMigration = () => {
		resetMigrationState();
		refreshStatus();
		addToast("Migration state reset", "info");
	};

	const handleExportData = async () => {
		setIsLoading(true);
		try {
			const data = await exportAllData();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `backend-studio-backup-${Date.now()}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			addToast("Data exported successfully", "success");
		} catch (error) {
			addToast(`Export failed: ${error}`, "error");
		} finally {
			setIsLoading(false);
		}
	};

	const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsLoading(true);
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			// Import into IndexedDB stores
			await importAllData(data);

			// Mark migration as completed so StorageService prefers IndexedDB on reload
			localStorage.setItem("api_sim_migration_completed", Date.now().toString());
			localStorage.removeItem("api_sim_migration_in_progress");
			localStorage.removeItem("api_sim_migration_failed");

			// Update LocalStorage mirrors to match imported data for backward compatibility
			if (data.projects) {
				localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(data.projects));
				// Choose a preferred active project: prefer the first non-default imported project; fall back to first
				if (Array.isArray(data.projects) && data.projects.length > 0) {
					const preferred = data.projects.find((p: Project) => p.id !== "default") || data.projects[0];
					localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, preferred.id);
				}
			}
			if (data.mocks) localStorage.setItem(STORAGE_KEYS.MOCKS, JSON.stringify(data.mocks));
			if (data.envVars) localStorage.setItem(STORAGE_KEYS.ENV_VARS, JSON.stringify(data.envVars));
			if (data.logs) localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs));
			if (data.emailOutbox) localStorage.setItem(STORAGE_KEYS.EMAIL_OUTBOX, JSON.stringify(data.emailOutbox));
			if (data.emailInbox) localStorage.setItem(STORAGE_KEYS.EMAIL_INBOX, JSON.stringify(data.emailInbox));

			addToast("Data imported successfully", "success");
			// Instead of forcing a full reload (which can race with IndexedDB commits), dispatch a
			// custom event that the app can respond to by re-reading storage and updating state.
			window.dispatchEvent(new CustomEvent("backend-studio-imported"));
		} catch (error) {
			addToast(`Import failed: ${error}`, "error");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDownloadLocalStorageBackup = () => {
		const backup = getLocalStorageBackup();
		if (!backup) {
			addToast("No localStorage backup found", "info");
			return;
		}

		const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `localstorage-backup-${new Date(backup.timestamp).toISOString().split("T")[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		addToast("localStorage backup downloaded", "success");
	};

	const getStatusIcon = () => {
		if (migrationStatus.completed) return <CheckCircle className="w-5 h-5 text-green-500" />;
		if (migrationStatus.failed) return <XCircle className="w-5 h-5 text-red-500" />;
		if (migrationStatus.inProgress) return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
		return <Database className="w-5 h-5 text-slate-500" />;
	};

	const getStatusText = () => {
		if (migrationStatus.completed) return "Migration Completed";
		if (migrationStatus.failed) return "Migration Failed";
		if (migrationStatus.inProgress) return "Migration In Progress";
		return "Migration Not Started";
	};

	const getStatusColor = () => {
		if (migrationStatus.completed) return "text-green-700 bg-green-50 border-green-200";
		if (migrationStatus.failed) return "text-red-700 bg-red-50 border-red-200";
		if (migrationStatus.inProgress) return "text-blue-700 bg-blue-50 border-blue-200";
		return "text-slate-700 bg-slate-50 border-slate-200";
	};

	return (
		<div className="bg-white rounded-xl border p-6 space-y-6">
			<div className="flex items-center space-x-3">
				<div className="p-2 bg-blue-100 rounded-lg">
					<Database className="w-5 h-5 text-blue-600" />
				</div>
				<div>
					<h3 className="text-lg font-bold">Database Management</h3>
					<p className="text-sm text-slate-600">Manage IndexedDB migration and data backup</p>
				</div>
			</div>

			{/* Current Status */}
			<div className={`p-4 rounded-lg border ${getStatusColor()}`}>
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center space-x-2">
						{getStatusIcon()}
						<span className="font-bold">{getStatusText()}</span>
					</div>
					<span className="text-xs font-mono">Backend: {currentBackend}</span>
				</div>

				{migrationStatus.failed && migrationStatus.errors && (
					<div className="mt-2 text-sm">
						<span className="font-medium">Errors:</span>
						<ul className="list-disc list-inside mt-1">
							{migrationStatus.errors.map((error, index) => (
								<li key={index}>{error}</li>
							))}
						</ul>
					</div>
				)}

				{migrationProgress.stage && (
					<div className="mt-2">
						<div className="flex items-center justify-between text-sm mb-1">
							<span>{migrationProgress.stage}</span>
							<span>{migrationProgress.progress}%</span>
						</div>
						<div className="w-full bg-slate-200 rounded-full h-2">
							<div
								className="bg-blue-500 h-2 rounded-full transition-all duration-300"
								style={{ width: `${migrationProgress.progress}%` }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* IndexedDB Availability */}
			<div
				className={`p-3 rounded-lg border flex items-start space-x-2 ${
					isIndexedDBAvailable()
						? "bg-green-50 border-green-200 text-green-700"
						: "bg-amber-50 border-amber-200 text-amber-700"
				}`}
			>
				<Info className="w-4 h-4 mt-0.5" />
				<div className="text-sm">
					<span className="font-medium">IndexedDB:</span>{" "}
					{isIndexedDBAvailable()
						? "Available - Enhanced database features enabled"
						: "Not available - Using localStorage fallback"}
				</div>
			</div>

			{/* Migration Controls */}
			{isIndexedDBAvailable() && (
				<div className="space-y-3">
					<h4 className="font-bold text-slate-800">Migration Controls</h4>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button
							onClick={handleRunMigration}
							disabled={isLoading || migrationStatus.completed || migrationStatus.inProgress}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
						>
							{isLoading ? (
								<RefreshCw className="w-4 h-4 animate-spin" />
							) : (
								<Database className="w-4 h-4" />
							)}
							{migrationStatus.completed ? "Already Migrated" : "Run Migration"}
						</button>

						<button
							onClick={handleResetMigration}
							disabled={isLoading}
							className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 font-bold rounded-lg transition-all flex items-center justify-center gap-2"
						>
							<RefreshCw className="w-4 h-4" />
							Reset Migration
						</button>
					</div>
				</div>
			)}

			{/* Backup/Restore Controls */}
			<div className="space-y-3">
				<h4 className="font-bold text-slate-800">Backup & Restore</h4>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<button
						onClick={handleExportData}
						disabled={isLoading}
						className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
					>
						<Download className="w-4 h-4" />
						Export All Data
					</button>

					<label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
						<Upload className="w-4 h-4" />
						Import Data
						<input
							type="file"
							accept=".json"
							onChange={handleImportData}
							className="hidden"
							disabled={isLoading}
						/>
					</label>

					{getLocalStorageBackup() && (
						<button
							onClick={handleDownloadLocalStorageBackup}
							disabled={isLoading}
							className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
						>
							<Download className="w-4 h-4" />
							Download LS Backup
						</button>
					)}
				</div>
			</div>

			{/* Info */}
			<div className="text-xs text-slate-500 space-y-1">
				<p>• Migration moves data from localStorage to IndexedDB for better performance</p>
				<p>• Export creates a backup of all current data</p>
				<p>• Import replaces all current data with imported data</p>
				<p>• localStorage backup is created automatically during migration</p>
			</div>
		</div>
	);
};
