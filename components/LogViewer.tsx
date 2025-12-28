import { Pause, Play, Search, Terminal, Trash, Wifi } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { LogEntry } from "../types";

// Format timestamp in a locale-aware way and include milliseconds for precision
export const formatTime = (timestamp: string | number | Date) => {
	const dt = new Date(timestamp);
	const fmt = new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const ms = dt.getMilliseconds().toString().padStart(3, "0");
	return `${fmt.format(dt)}.${ms}`;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface LogViewerProps {
	logs: LogEntry[];
	onClearLogs: () => void;
	socketStatus?: "connected" | "connecting" | "disconnected";
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClearLogs, socketStatus }) => {
	const [isPaused, setIsPaused] = useState(false);
	const [filter, setFilter] = useState("");
	const logsEndRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isFollowing, setIsFollowing] = useState(true);
	const prevLogsLength = useRef<number>(logs.length);
	const [newCount, setNewCount] = useState(0);

	// Render batching for long streams (show last N by default)
	const BATCH = 300;
	const [displayedCount, setDisplayedCount] = useState(Math.min(BATCH, logs.length));

	// Auto-scroll to bottom when following and not paused; track new items when not following
	useEffect(() => {
		const added = logs.length - prevLogsLength.current;
		if (added > 0 && !isFollowing) {
			setNewCount(prev => prev + added);
		} else if (isFollowing) {
			setNewCount(0);
		}
		prevLogsLength.current = logs.length;

		if (!isPaused && isFollowing && logsEndRef.current) {
			logsEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [logs, isPaused, isFollowing]);

	const onScroll = () => {
		const el = containerRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
		setIsFollowing(atBottom);
		if (atBottom) setNewCount(0);
	};

	const jumpToBottom = () => {
		if (!containerRef.current) return;
		containerRef.current.scrollTop = containerRef.current.scrollHeight;
		setIsFollowing(true);
		setNewCount(0);
	};

	const lowerFilter = filter.toLowerCase();
	const filteredLogs = logs.filter(
		l =>
			l.path.toLowerCase().includes(lowerFilter) ||
			l.method.toLowerCase().includes(lowerFilter) ||
			l.statusCode.toString().includes(lowerFilter) ||
			l.ip.toLowerCase().includes(lowerFilter)
	);

	// Show only last `displayedCount` logs by default for performance; when filtering, show all matches
	const displayLogs = filter ? filteredLogs : filteredLogs.slice(-displayedCount);

	const highlightMatch = (text: string, q: string) => {
		if (!q) return text;
		try {
			const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
			const parts = text.split(re);
			return parts.map((p, i) =>
				re.test(p) ? (
					<mark key={i} className="bg-amber-500/20 text-amber-200 px-0.5 rounded">
						{p}
					</mark>
				) : (
					<span key={i}>{p}</span>
				)
			);
		} catch (e) {
			return text;
		}
	};

	return (
		<div className="flex flex-col h-screen bg-[#0f172a] text-slate-300 font-mono text-sm animate-enter">
			{/* Header */}
			<div className="px-6 py-4 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between shadow-md z-10">
				<div className="flex items-center space-x-4">
					<div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
						<Terminal className="w-5 h-5 text-brand-400" />
					</div>
					<div>
						<h2 className="font-bold text-slate-100 tracking-tight">Traffic Monitor</h2>
						<div className="flex items-center space-x-2 mt-0.5">
							<span className="relative flex h-2 w-2">
								<span
									className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
										isPaused ? "bg-amber-400" : "bg-emerald-400"
									}`}
								></span>
								<span
									className={`relative inline-flex rounded-full h-2 w-2 ${
										isPaused ? "bg-amber-500" : "bg-emerald-500"
									}`}
								></span>
							</span>
							<span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
								{isPaused ? "Paused" : "Listening..."}
							</span>{" "}
							{socketStatus && (
								<span className="ml-3 inline-flex items-center text-[10px] font-semibold">
									<span
										className={`inline-block w-2 h-2 rounded-full mr-2 ${
											socketStatus === "connected"
												? "bg-emerald-400"
												: socketStatus === "connecting"
												? "bg-amber-400"
												: "bg-red-400"
										}`}
									></span>
									<span
										className={`${
											socketStatus === "connected"
												? "text-emerald-400"
												: socketStatus === "connecting"
												? "text-amber-400"
												: "text-red-400"
										}`}
									>
										{socketStatus === "connected"
											? "Connected"
											: socketStatus === "connecting"
											? "Connecting"
											: "Disconnected"}
									</span>
								</span>
							)}{" "}
						</div>
					</div>
				</div>

				<div className="flex items-center space-x-3">
					<div className="relative group">
						<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-slate-300 transition-colors" />
						<input
							type="text"
							placeholder="Filter logs..."
							value={filter}
							onChange={e => setFilter(e.target.value)}
							className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-64 transition-all"
						/>
					</div>

					<div className="h-6 w-px bg-slate-700 mx-2"></div>

					{/* Follow / Jump controls */}
					<button
						onClick={() => {
							if (!isFollowing) jumpToBottom();
							setIsFollowing(prev => !prev);
						}}
						aria-pressed={isFollowing}
						className={`p-2 rounded-lg transition-colors border ${
							isFollowing
								? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
								: "bg-slate-700/30 text-slate-400 border-slate-700"
						}`}
						title={isFollowing ? "Following new logs" : "Not following; click to enable follow"}
					>
						<span className="text-xs font-medium">{isFollowing ? "Follow" : "Paused"}</span>
					</button>

					{newCount > 0 && (
						<button
							onClick={jumpToBottom}
							className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs"
						>
							Jump to newest ({newCount})
						</button>
					)}

					<button
						onClick={async () => {
							const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
							const url = URL.createObjectURL(blob);
							const a = document.createElement("a");
							a.href = url;
							a.download = `logs-${Date.now()}.json`;
							a.click();
							URL.revokeObjectURL(url);
						}}
						className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
						title="Export logs as JSON"
					>
						Export
					</button>

					<button
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
							} catch (e) {
								console.warn("Copy failed", e);
							}
						}}
						className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
						title="Copy all logs to clipboard"
					>
						Copy
					</button>

					<button
						onClick={() => setIsPaused(!isPaused)}
						className={`p-2 rounded-lg transition-colors border ${
							isPaused
								? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
								: "bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700"
						}`}
						title={isPaused ? "Resume" : "Pause"}
					>
						{isPaused ? (
							<Play className="w-4 h-4 fill-current" />
						) : (
							<Pause className="w-4 h-4 fill-current" />
						)}
					</button>
					<button
						onClick={onClearLogs}
						className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
						title="Clear Logs"
					>
						<Trash className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Log Table Header */}
			<div className="grid grid-cols-12 gap-4 px-6 py-2 bg-[#0f172a] border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
				<div className="col-span-2">Timestamp</div>
				<div className="col-span-1">Method</div>
				<div className="col-span-1">Status</div>
				<div className="col-span-5">Path</div>
				<div className="col-span-1 text-right">Latency</div>
				<div className="col-span-2 text-right">Client IP</div>
			</div>

			{/* Logs Body */}
			<div
				className="flex-1 overflow-y-auto p-2 space-y-0.5 dark-scroll scroll-smooth"
				ref={containerRef}
				onScroll={onScroll}
			>
				{displayLogs.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
						<div className="p-4 bg-slate-800/50 rounded-full">
							<Wifi className="w-8 h-8 opacity-50" />
						</div>
						<p className="text-xs">Waiting for incoming traffic from Prototype Lab...</p>
					</div>
				) : (
					<div>
						{/* Load older for long streams */}
						{displayedCount < logs.length && !filter && (
							<div className="flex justify-center mb-2">
								<button
									onClick={() => setDisplayedCount(prev => Math.min(prev + BATCH, logs.length))}
									className="px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
								>
									Load older
								</button>
							</div>
						)}

						{displayLogs.map(log => (
							<div
								key={log.id}
								className="grid grid-cols-12 gap-4 px-4 py-2 hover:bg-[#1e293b] rounded-lg transition-colors border border-transparent hover:border-slate-700/50 items-center text-xs group"
							>
								<div className="col-span-2 text-slate-500 group-hover:text-slate-400">
									{formatTime(log.timestamp)}
								</div>

								<div className="col-span-1">
									<span
										className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
											log.method === "GET"
												? "bg-blue-500/10 text-blue-400"
												: log.method === "POST"
												? "bg-emerald-500/10 text-emerald-400"
												: log.method === "DELETE"
												? "bg-red-500/10 text-red-400"
												: "bg-amber-500/10 text-amber-400"
										}`}
									>
										{log.method}
									</span>
								</div>

								<div className="col-span-1">
									<span
										className={`font-bold ${
											log.statusCode >= 400 ? "text-red-400" : "text-emerald-400"
										}`}
									>
										{log.statusCode}
									</span>
								</div>

								<div className="col-span-5 text-slate-300 truncate font-medium" title={log.path}>
									{highlightMatch(log.path, filter)}
								</div>

								<div className="col-span-1 text-right text-slate-500">{log.duration}ms</div>

								<div className="col-span-1 text-right text-slate-600">
									{highlightMatch(log.ip, filter)}
								</div>

								<div className="col-span-1 pl-2 text-right">
									<button
										onClick={async () => {
											try {
												await navigator.clipboard.writeText(JSON.stringify(log));
											} catch (e) {
												console.warn("Copy failed", e);
											}
										}}
										className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
										title="Copy log line"
									>
										Copy
									</button>
								</div>
							</div>
						))}
					</div>
				)}
				<div ref={logsEndRef} />
			</div>
		</div>
	);
};
