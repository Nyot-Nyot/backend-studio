import { Database, RefreshCw, Save, Table, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DbItem, dbService } from "../services/dbService";

export const DatabaseView = () => {
	const [collections, setCollections] = useState<string[]>([]);
	const [activeCollection, setActiveCollection] = useState<string | null>(null);
	const [data, setData] = useState<DbItem[]>([]);
	const [rawEditor, setRawEditor] = useState("");
	const [prevRawEditor, setPrevRawEditor] = useState<string | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [showDiff, setShowDiff] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [error, setError] = useState<string | null>(null);

	const loadCollections = () => {
		const cols = dbService.listCollections();
		setCollections(cols);
		if (!activeCollection && cols.length > 0) {
			handleSelectCollection(cols[0]);
		}
	};

	const handleSelectCollection = (name: string) => {
		setActiveCollection(name);
		const colData = dbService.getCollection(name) as DbItem[];
		setData(colData);
		setRawEditor(JSON.stringify(colData, null, 2));
		setPrevRawEditor(null);
		setIsEditing(false);
		setJsonError(null);
		setShowDiff(false);
		setPage(1);
		setError(null);
	};

	useEffect(() => {
		loadCollections();
	}, []);

	const headers = useMemo(() => {
		const keys = new Set<string>();
		data.forEach(item => Object.keys(item || {}).forEach(k => keys.add(k)));
		const arr = Array.from(keys);
		if (arr.includes("id")) return ["id", ...arr.filter(k => k !== "id").sort()];
		return arr.sort();
	}, [data]);

	const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
	const pageData = useMemo(() => data.slice((page - 1) * pageSize, page * pageSize), [data, page, pageSize]);

	useEffect(() => {
		setPage(p => Math.min(p, totalPages));
	}, [totalPages]);

	const handleRefresh = () => {
		if (activeCollection) handleSelectCollection(activeCollection);
		loadCollections();
	};

	const handleClearCollection = () => {
		if (activeCollection && window.confirm(`Clear all data in '${activeCollection}'?`)) {
			dbService.clearCollection(activeCollection);
			handleRefresh();
		}
	};

	const assignStableIds = (collection: string) => {
		const newData = data.map((item, idx) => {
			if (item.id === undefined || item.id === null) {
				return {
					...item,
					id:
						typeof crypto !== "undefined" && (crypto as any).randomUUID
							? (crypto as any).randomUUID().split("-")[0]
							: `id-${Date.now()}-${idx}`,
				};
			}
			return item;
		});
		dbService.saveCollection(collection, newData);
		setData(newData);
		setRawEditor(JSON.stringify(newData, null, 2));
	};

	const handleDeleteItem = (index: number) => {
		if (!activeCollection || !data[index]) return;

		const item = data[index];
		const itemId = (item as DbItem).id;

		if (itemId === undefined || itemId === null) {
			const assign = window.confirm(
				"This record does not have a stable `id`.\n\nOK = Assign stable IDs to all records (recommended).\nCancel = Delete by index (unsafe)."
			);

			if (assign) {
				assignStableIds(activeCollection);
				// After assigning ids, delete by id
				const assigned = dbService.getCollection(activeCollection);
				const idToDelete = assigned[index]?.id;
				if (idToDelete !== undefined) {
					dbService.delete(activeCollection, idToDelete as any);
					setData(assigned.filter((_, i) => i !== index));
				}
				return;
			}

			// user chose to delete by index
			if (window.confirm(`Delete item (index ${index})? This is index-based and may be fragile.`)) {
				const newData = data.filter((_, i) => i !== index);
				dbService.saveCollection(activeCollection, newData);
				setData(newData);
			}
			return;
		}

		if (window.confirm(`Delete item ${String(itemId)}?`)) {
			const deleted = dbService.delete(activeCollection, itemId as any);
			if (deleted) {
				// Keep UI in sync by removing the item by id
				setData(prev => prev.filter(d => d.id != itemId));
			} else {
				// As a safety fallback, reload collection from storage
				const reloaded = dbService.getCollection(activeCollection);
				setData(reloaded as DbItem[]);
			}
		}
	};

	const handleClearAllDB = () => {
		if (window.confirm("Delete ALL collections and data? This cannot be undone.")) {
			dbService.clearAllCollections();
			setCollections([]);
			setActiveCollection(null);
			setData([]);
			setRawEditor("");
		}
	};

	const handleSave = () => {
		if (!activeCollection) return;
		try {
			const parsed = JSON.parse(rawEditor);
			if (!Array.isArray(parsed)) throw new Error("Data must be an array");
			// Ensure parsed items are objects
			if (!parsed.every((p: any) => typeof p === "object" && p !== null && !Array.isArray(p)))
				throw new Error("Each item must be an object");
			dbService.saveCollection(activeCollection, parsed as DbItem[]);
			setData(parsed as DbItem[]);
			setIsEditing(false);
			setPrevRawEditor(null);
			setJsonError(null);
			setError(null);
		} catch (e) {
			setError((e as Error).message);
		}
	};

	return (
		<div className="p-8 max-w-6xl mx-auto h-full flex flex-col animate-in fade-in">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold text-slate-900 flex items-center">
						<Database className="w-6 h-6 mr-3 text-brand-500" />
						Memory Store
					</h1>
					<p className="text-slate-500 mt-1">View and manage the stateful data for your active endpoints.</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={handleRefresh}
						className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition-colors"
						title="Refresh"
					>
						<RefreshCw className="w-5 h-5" />
					</button>
					<button
						onClick={handleClearAllDB}
						className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
						title="Clear all collections"
					>
						<Trash2 className="w-5 h-5" />
					</button>
				</div>
			</div>

			<div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
				{/* Sidebar List */}
				<div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
					<div className="p-4 border-b border-slate-100 bg-slate-50/50">
						<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collections</h3>
					</div>
					<div className="flex-1 overflow-y-auto p-2">
						{collections.length === 0 ? (
							<div className="p-4 text-center text-slate-400 text-sm">
								No active data buckets. Enable "Stateful" on an endpoint to create one.
							</div>
						) : (
							collections.map(col => (
								<button
									key={col}
									onClick={() => handleSelectCollection(col)}
									className={`w-full text-left px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-all flex items-center justify-between ${
										activeCollection === col
											? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
											: "text-slate-600 hover:bg-slate-50"
									}`}
								>
									<span className="truncate">{col}</span>
									{activeCollection === col && <div className="w-2 h-2 rounded-full bg-brand-500" />}
								</button>
							))
						)}
					</div>
				</div>

				{/* Editor Area */}
				<div className="col-span-9 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
					{activeCollection ? (
						<>
							<div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
								<div className="flex items-center gap-2">
									<Table className="w-4 h-4 text-slate-400" />
									<span className="font-mono text-sm font-bold text-slate-700">
										{activeCollection}
									</span>
									<div className="flex items-center gap-2">
										<span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
											{data.length} records
										</span>
										{!isEditing && data.length > 0 && (
											<>
												<button
													onClick={() => setPage(p => Math.max(1, p - 1))}
													className="px-2 py-1 rounded bg-white border text-slate-600 text-xs"
													disabled={page <= 1}
												>
													Prev
												</button>
												<span className="text-xs text-slate-500">
													Page {page}/{totalPages}
												</span>
												<button
													onClick={() => setPage(p => Math.min(totalPages, p + 1))}
													className="px-2 py-1 rounded bg-white border text-slate-600 text-xs"
													disabled={page >= totalPages}
												>
													Next
												</button>
											</>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{isEditing ? (
										<>
											<button
												onClick={() => {
													setIsEditing(false);
													setRawEditor(JSON.stringify(data, null, 2));
													setError(null);
												}}
												className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
											>
												Cancel
											</button>
											<button
												onClick={handleSave}
												className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm"
											>
												<Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
											</button>
										</>
									) : (
										<>
											<button
												onClick={() => {
													setPrevRawEditor(rawEditor);
													setIsEditing(true);
												}}
												className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
											>
												Edit Raw JSON
											</button>
											<button
												onClick={handleClearCollection}
												className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
												title="Clear Data"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</>
									)}
								</div>
							</div>

							<div className="flex-1 relative">
								{isEditing ? (
									<textarea
										value={rawEditor}
										onChange={e => setRawEditor(e.target.value)}
										className="w-full h-full p-4 font-mono text-sm text-slate-700 bg-slate-50 focus:outline-none resize-none"
									/>
								) : (
									<div className="p-0 h-full overflow-y-auto">
										{data.length === 0 ? (
											<div className="h-full flex flex-col items-center justify-center text-slate-400">
												<p className="text-sm">Collection is empty.</p>
												<p className="text-xs mt-1">
													POST requests to this endpoint will populate this list.
												</p>
											</div>
										) : (
											<table className="w-full text-left border-collapse">
												<thead className="bg-slate-50 sticky top-0 shadow-sm">
													<tr>
														{headers
															.slice(0, Math.max(1, Math.min(headers.length, 5)))
															.map(key => (
																<th
																	key={key}
																	className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200"
																>
																	{key}
																</th>
															))}
														<th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-12">
															Action
														</th>
													</tr>
												</thead>
												<tbody className="text-sm">
													{pageData.map((row, i) => (
														<tr
															key={(row as any).id ?? (page - 1) * pageSize + i}
															className="border-b border-slate-100 hover:bg-slate-50/50 font-mono text-xs"
														>
															{headers.slice(0, 5).map(key => (
																<td
																	key={key}
																	className="p-3 text-slate-600 truncate max-w-[200px]"
																>
																	{typeof row[key] === "object"
																		? JSON.stringify(row[key])
																		: String(row[key])}
																</td>
															))}
															<td className="p-3 w-12">
																<button
																	onClick={() =>
																		handleDeleteItem((page - 1) * pageSize + i)
																	}
																	className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
																	title="Delete item"
																>
																	<X className="w-4 h-4" />
																</button>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										)}
									</div>
								)}
								{error && (
									<div className="absolute bottom-4 left-4 right-4 bg-red-100 text-red-700 p-3 rounded-lg text-sm border border-red-200 shadow-lg flex items-center">
										<span className="font-bold mr-2">Error:</span> {error}
									</div>
								)}
							</div>
						</>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center text-slate-400">
							<Database className="w-12 h-12 mb-4 opacity-20" />
							<p>Select a collection to view data</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
