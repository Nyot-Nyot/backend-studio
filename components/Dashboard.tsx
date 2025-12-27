import {
	ArrowRight,
	BarChart2,
	CheckSquare,
	Clock,
	Copy,
	GitBranch,
	Layers,
	Link,
	Pause,
	Play,
	Search,
	Trash2,
	X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { HttpMethod, MockEndpoint } from "../types";
import { ToastType } from "./Toast";

interface DashboardProps {
	mocks: MockEndpoint[];
	onEdit: (mock: MockEndpoint) => void;
	onDelete: (id: string) => void;
	onBulkDelete: (ids: string[]) => void;
	onToggle: (id: string) => void;
	onDuplicate: (mock: MockEndpoint) => void;
	addToast: (message: string, type: ToastType) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
	mocks,
	onEdit,
	onDelete,
	onBulkDelete,
	onToggle,
	onDuplicate,
	addToast,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

	// Sync selectedIds with mocks to ensure deleted items are removed from selection
	useEffect(() => {
		setSelectedIds(prev => prev.filter(id => mocks.some(m => m.id === id)));
	}, [mocks]);

	const filteredMocks = mocks.filter(
		m =>
			m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			m.path.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const totalRequests = mocks.reduce((acc, m) => acc + m.requestCount, 0);
	const activeCount = mocks.filter(m => m.isActive).length;

	// handleCopyPath: tries navigator.clipboard, falls back to execCommand for older contexts
	const handleCopyPath = async (e: React.MouseEvent, path: string) => {
		e.stopPropagation();
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(path);
			} else {
				const ta = document.createElement('textarea');
				ta.value = path;
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			addToast('Route path copied to clipboard', 'info');
		} catch (err) {
			console.error('copy failed', err);
			addToast('Failed to copy route path', 'error');
		}
	};

	const handleDelete = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		onDelete(id);
	};

	const handleDuplicate = (e: React.MouseEvent, mock: MockEndpoint) => {
		e.stopPropagation();
		onDuplicate(mock);
	};

	const handleToggle = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		onToggle(id);
	};

	// toggleSelect: toggles single selection or adds a range when Shift is held
	const toggleSelect = (id: string, index?: number, shiftKey?: boolean) => {
		setSelectedIds(prev => {
			if (shiftKey && lastSelectedIndex !== null && typeof index === "number") {
				const start = Math.min(lastSelectedIndex, index);
				const end = Math.max(lastSelectedIndex, index);
				const idsInRange = filteredMocks.slice(start, end + 1).map(m => m.id);
				const newSet = new Set(prev);
				idsInRange.forEach(iid => newSet.add(iid));
				return Array.from(newSet);
			} else {
				if (prev.includes(id)) {
					return prev.filter(i => i !== id);
				} else {
					return [...prev, id];
				}
			}
		});
		if (typeof index === "number") {
			setLastSelectedIndex(index);
		}
	};

	const handleSelect = (e: React.MouseEvent | React.ChangeEvent | React.KeyboardEvent, id: string, index?: number) => {
		if ('stopPropagation' in e && typeof e.stopPropagation === 'function') e.stopPropagation();
		const shiftKey = (e as any).shiftKey || false;
		toggleSelect(id, index, !!shiftKey);
	};

	const handleSelectAll = () => {
		if (selectedIds.length === filteredMocks.length) {
			setSelectedIds([]);
		} else {
			setSelectedIds(filteredMocks.map(m => m.id));
		}
	};

	const executeBulkDelete = () => {
		onBulkDelete(selectedIds);
		setSelectedIds([]);
	};

	const METHOD_STYLE_MAP: Partial<Record<HttpMethod, string>> = {
		[HttpMethod.GET]: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/10",
		[HttpMethod.POST]: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/10",
		[HttpMethod.PUT]: "bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/10",
		[HttpMethod.DELETE]: "bg-red-50 text-red-700 border-red-200 ring-red-500/10",
	};

	const getMethodStyle = (method: HttpMethod) => METHOD_STYLE_MAP[method] ?? "bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/10";

	return (
		<div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-enter pb-20 relative">
			{/* Header & Stats */}
			<div className="space-y-6">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<h2 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h2>
						<p className="text-slate-500 mt-1">Manage your API contracts and monitor simulated traffic.</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<StatCard
						icon={<Layers className="w-6 h-6 text-brand-600" />}
						label="Designed Routes"
						value={mocks.length}
						bg="bg-brand-50"
						border="border-brand-100"
					/>
					<StatCard
						icon={<GitBranch className="w-6 h-6 text-violet-600" />}
						label="Active Contracts"
						value={activeCount}
						bg="bg-violet-50"
						border="border-violet-100"
					/>
					<StatCard
						icon={<BarChart2 className="w-6 h-6 text-emerald-600" />}
						label="Total Hits"
						value={totalRequests.toLocaleString()}
						bg="bg-emerald-50"
						border="border-emerald-100"
					/>
				</div>
			</div>

			{/* Toolbar */}
			<div className="flex items-center justify-between sticky top-0 z-20 bg-[#f8fafc]/95 backdrop-blur-md py-4 border-b border-slate-200/50 -mx-8 px-8 transition-all">
				<div className="flex items-center space-x-2 text-sm text-slate-500">
					<span className="font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full text-xs">
						{filteredMocks.length}
					</span>{" "}
					results found
				</div>
				<div className="relative w-80 group">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl leading-5 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 sm:text-sm transition-all shadow-sm group-hover:border-slate-300"
						placeholder="Search routes by name or path..."
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
					/>
				</div>
			</div>

			{/* Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
				{filteredMocks.map((mock, index) => {
					const isSelected = selectedIds.includes(mock.id);
					return (
						<div
							key={mock.id}
							data-testid={`mock-card-${mock.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
							onClick={() => onEdit(mock)}
						tabIndex={0}
						onKeyDown={e => {
							if (e.key === "Enter") {
								onEdit(mock);
							} else if (e.key === " " || e.key === "Spacebar") {
								e.preventDefault();
								handleSelect(e, mock.id, index);
							}
						}}
						aria-selected={isSelected}
						className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 cursor-pointer overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards focus:outline-none focus:ring-2 focus:ring-brand-500 ${
								mock.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50/50 opacity-80"
							} ${isSelected ? "ring-2 ring-brand-500 border-brand-500" : ""}`}
							style={{ animationDelay: `${index * 50}ms` }}
						>
							{/* Status Line */}
							<div
								className={`h-1 w-full transition-colors duration-300 ${
									mock.isActive ? "bg-gradient-to-r from-brand-500 to-brand-400" : "bg-slate-300"
								}`}
							/>

							<div className="p-5 flex-1 flex flex-col relative">
								{/* Selection Checkbox */}
								<div
									className={`absolute top-4 left-4 z-20 transition-opacity duration-200 ${
										isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
									}`}
					>
						<input
							type="checkbox"
							checked={isSelected}
							onChange={e => handleSelect(e, mock.id, index)}
							onClick={e => e.stopPropagation()}
							aria-label={`Select ${mock.name}`}
							aria-checked={isSelected}
							className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-500 cursor-pointer accent-brand-600"
						/>
								</div>
								<div className="flex justify-between items-start mb-4 pl-6">
									<div className="flex flex-col gap-1.5 min-w-0 pr-12">
										<h3 className="font-bold text-slate-800 truncate text-base group-hover:text-brand-600 transition-colors">
											{mock.name}
										</h3>
										<div className="flex items-center space-x-2">
											<span
												className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ring-1 ring-inset ${getMethodStyle(
													mock.method
												)}`}
											>
												{mock.method}
											</span>
											<span
												className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
													mock.statusCode < 400
														? "bg-emerald-50 text-emerald-700 border-emerald-100"
														: "bg-red-50 text-red-700 border-red-100"
												}`}
											>
												{mock.statusCode}
											</span>
										</div>
									</div>

						{/* Actions (visible on hover/active) - place inline to avoid overlapping content */}
								<div className="flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-100 pointer-events-none group-hover:pointer-events-auto">
										<ActionButton
											onClick={e => handleToggle(e, mock.id)}
											icon={
												mock.isActive ? (
													<Pause className="w-3.5 h-3.5" />
												) : (
													<Play className="w-3.5 h-3.5" />
												)
											}
											color={
												mock.isActive
													? "text-amber-500 hover:bg-amber-50"
													: "text-emerald-500 hover:bg-emerald-50"
											}
											title={mock.isActive ? "Pause" : "Activate"}
										/>
										<div className="w-px h-3 bg-slate-200 mx-0.5" />
										<ActionButton
											onClick={e => handleDuplicate(e, mock)}
											icon={<Copy className="w-3.5 h-3.5" />}
											color="text-slate-400 hover:text-brand-600 hover:bg-brand-50"
											title="Duplicate"
										/>
										<ActionButton
											onClick={e => handleDelete(e, mock.id)}
											icon={<Trash2 className="w-3.5 h-3.5" />}
											color="text-slate-400 hover:text-red-600 hover:bg-red-50"
											title="Delete"
										/>
									</div>
								</div>

								{/* Path */}
								<div className="mt-auto pt-2">
									<div
										className="group/path flex items-center text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 hover:border-brand-200 hover:bg-brand-50/30 transition-colors relative"
										onClick={e => handleCopyPath(e, mock.path)}
										title="Click to copy"
									>
										<span className="truncate flex-1">{mock.path}</span>
										<Link className="w-3 h-3 text-slate-400 opacity-0 group-hover/path:opacity-100 transition-opacity ml-2 flex-shrink-0" />
									</div>
								</div>
							</div>

							{/* Footer Stats */}
							<div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
								<div className="flex items-center space-x-4">
									<div className="flex items-center" title="Response Delay">
										<Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
										{mock.delay}ms
									</div>
								</div>
								<div className="font-medium flex items-center group/hits">
									<span className="bg-slate-200 group-hover/hits:bg-brand-100 group-hover/hits:text-brand-700 transition-colors rounded-full px-2 py-0.5 text-[10px] text-slate-600">
										{mock.requestCount} hits
									</span>
								</div>
							</div>
						</div>
					);
				})}

				{/* Empty State */}
				{filteredMocks.length === 0 && (
					<div className="col-span-full py-24 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
						<div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
							<Search className="w-10 h-10 text-slate-300" />
						</div>
						<h3 className="text-xl font-bold text-slate-900 mb-2">No routes found</h3>
						<p className="text-slate-500 max-w-sm mx-auto mb-8">
							We couldn't find any endpoints matching "{searchTerm}". Try adjusting your search or create
							a new one.
						</p>
						<button
							onClick={() => setSearchTerm("")}
							className="text-brand-600 font-medium hover:text-brand-700 hover:underline underline-offset-4 flex items-center"
						>
							Clear search filter <ArrowRight className="w-4 h-4 ml-1" />
						</button>
					</div>
				)}
			</div>

			{/* Floating Bulk Actions Bar */}
			{selectedIds.length > 0 && (
				<div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
					<div className="bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-900/50 py-3 px-6 flex items-center gap-6 border border-slate-700">
						<div className="flex items-center gap-3 border-r border-slate-700 pr-6">
							<span className="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
								{selectedIds.length}
							</span>
							<span className="text-sm font-medium">Selected</span>
						</div>

						<div className="flex items-center gap-3">
							<button
								onClick={handleSelectAll}
								className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800"
							>
								<CheckSquare className="w-4 h-4" />
								{selectedIds.length === filteredMocks.length ? "Deselect All" : "Select All"}
							</button>
						<div className="hidden sm:block text-xs text-slate-400 ml-3">Tip: use Shift+Click to select a range</div>

							<button
								onClick={() => setSelectedIds([])}
								className="ml-2 p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
								title="Cancel selection"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const StatCard = ({
	icon,
	label,
	value,
	bg,
	border,
}: {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	bg: string;
	border: string;
}) => (
	<div
		className={`p-6 rounded-2xl bg-white border shadow-sm flex items-center space-x-5 transition-transform hover:scale-[1.01] duration-300 ${border}`}
	>
		<div className={`p-4 rounded-xl ${bg}`}>{icon}</div>
		<div>
			<p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
			<h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
		</div>
	</div>
);

const ActionButton = ({
	onClick,
	icon,
	color,
	title,
}: {
	onClick: (e: React.MouseEvent) => void;
	icon: React.ReactNode;
	color: string;
	title: string;
}) => (
	<button onClick={onClick} className={`p-1.5 rounded-md transition-all active:scale-90 ${color}`} title={title}>
		{icon}
	</button>
);
