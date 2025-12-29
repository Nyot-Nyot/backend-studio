// MockEditor.tsx
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Code2,
	Copy,
	Database,
	FileJson,
	FolderOpen,
	Gauge,
	GripVertical,
	Hash,
	Key,
	Plus,
	Save,
	Settings,
	Shield,
	Sparkles,
	Table2,
	ToggleLeft,
	ToggleRight,
	Trash2,
	Type,
	Wand2,
	X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { FEATURES } from "../config/featureFlags";
import { formatAuthPreview } from "../services/authUtils";
import { MOCK_VARIABLES_HELP, patternsConflict } from "../services/mockEngine";
import { HttpMethod, MockEndpoint } from "../types";
import { ToastType } from "./Toast";
import { klonDalam, konversiSkemaKeJson, parseJsonKeSkema, SchemaField, validasiStrukturJson } from "./mockEditorUtils";

// Properti untuk komponen MockEditor
interface MockEditorProps {
	initialData?: MockEndpoint | null; // Data mock yang akan diedit (null untuk membuat baru)
	existingMocks?: MockEndpoint[]; // Daftar mock lain untuk mendeteksi konflik
	onSave: (mock: MockEndpoint) => void; // Handler untuk menyimpan mock
	onDelete: (id: string) => void; // Handler untuk menghapus mock
	onCancel: () => void; // Handler untuk membatalkan edit
	addToast: (message: string, type: ToastType) => void; // Handler untuk menampilkan toast
}

// Data default untuk mock baru
const DEFAULT_MOCK: MockEndpoint = {
	id: "",
	projectId: "",
	nama: "Route Baru",
	path: "/api/v1/resource",
	metode: HttpMethod.GET,
	statusCode: 200,
	delay: 0,
	responseBody: '{\n  "id": "{{$uuid}}",\n  "name": "{{$randomName}}",\n  "createdAt": "{{$isoDate}}"\n}',
	isActive: true,
	versi: "1.0",
	createdAt: Date.now(),
	requestCount: 0,
	headers: [],
	storeName: "",
	authConfig: { jenis: "NONE" },
	proxy: { enabled: false, target: "", timeout: 5000, fallbackToMock: false },
};

// Komponen Label untuk form
const Label = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
	<label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${className || ""}`}>
		{children}
	</label>
);

// Interface untuk konteks FieldRow (untuk visual editor)
interface FieldRowContextProps {
	idSumberDrag: string | null;
	idTargetDrag: string | null;
	dropdownGeneratorAktif: string | null;
	onDragStart: (e: React.DragEvent, id: string) => void;
	onDragEnter: (e: React.DragEvent, id: string) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragEnd: (e: React.DragEvent) => void;
	onUpdateField: (id: string, updates: Partial<SchemaField>) => void;
	onAddField: (parentId: string | null) => void;
	onRemoveFieldRequest: (id: string) => void; // Permintaan penghapusan field
	onSetActiveGeneratorDropdown: (id: string | null) => void;
	onInsertVariable: (variable: string) => void;
	onToggleCollapse: (id: string) => void;
	onMoveField?: (id: string, direction: "up" | "down") => void;
}

/**
 * Komponen FieldRow untuk menampilkan dan mengelola field dalam visual editor
 * Menangani drag & drop, editing, dan struktur data bertingkat
 */
const FieldRow: React.FC<{
	field: SchemaField;
	depth?: number;
	ctx: FieldRowContextProps;
}> = ({ field, depth = 0, ctx }) => {
	const sedangDrag = ctx.idSumberDrag === field.id;
	const adalahTarget = ctx.idTargetDrag === field.id;
	const memilikiAnak = field.type === "object" && field.children && field.children.length > 0;

	return (
		<div
			className={`relative transition-all duration-300 ease-out transform ${
				sedangDrag ? "opacity-40 scale-[0.98] z-0" : "opacity-100 scale-100 z-10"
			}`}
			draggable
			onDragStart={e => ctx.onDragStart(e, field.id)}
			onDragEnter={e => ctx.onDragEnter(e, field.id)}
			onDragOver={ctx.onDragOver}
			onDragEnd={ctx.onDragEnd}
		>
			<div
				className={`
                group flex items-center gap-3 bg-white rounded-lg border mb-2 transition-all duration-200
                ${
					adalahTarget
						? "border-brand-500 ring-1 ring-brand-500 bg-brand-50/30 translate-x-2 shadow-md"
						: "border-slate-200 hover:border-brand-300 hover:shadow-sm"
				}
            `}
				style={{ padding: "var(--space-1) var(--space-2)" }}
			>
				{/* Handle untuk drag & drop */}
				<button
					type="button"
					aria-label="Drag field"
					onKeyDown={e => {
						if (e.key === "ArrowUp") ctx.onMoveField?.(field.id, "up");
						if (e.key === "ArrowDown") ctx.onMoveField?.(field.id, "down");
					}}
					className={`flex-shrink-0 cursor-grab active:cursor-grabbing transition-colors ${
						adalahTarget ? "text-brand-400" : "text-slate-300 group-hover:text-slate-500"
					}`}
					style={{ padding: "var(--space-1)" }}
				>
					<GripVertical className="w-5 h-5" />
				</button>

				{/* Tombol collapse untuk tipe object */}
				{field.type === "object" ? (
					<button
						type="button"
						onClick={() => ctx.onToggleCollapse(field.id)}
						className="rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors -ml-1"
						style={{ padding: "var(--space-1)" }}
					>
						{field.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
					</button>
				) : (
					<div className="w-6 -ml-1" /> // Spacer
				)}

				<div className="flex-1 grid grid-cols-12 gap-3 items-center">
					{/* Input untuk nama field */}
					<div className="col-span-4 flex items-center">
						<input
							type="text"
							placeholder="nama_field"
							value={field.key}
							onChange={e => ctx.onUpdateField(field.id, { key: e.target.value })}
							className={`w-full text-sm font-semibold text-slate-700 bg-slate-50 focus:bg-white border border-transparent rounded-md outline-none transition-colors ${
								field.key === "" ? "border-red-200 bg-red-50" : ""
							}`}
							style={{ padding: "var(--space-1) var(--space-2)" }}
						/>
					</div>

					{/* Selektor tipe data */}
					<div className="col-span-3">
						<div className="relative">
							<select
								value={field.type}
								onChange={e => ctx.onUpdateField(field.id, { type: e.target.value as any })}
								className="w-full appearance-none text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md outline-none cursor-pointer"
								style={{ padding: "var(--space-2)", paddingLeft: "var(--space-4)" }}
							>
								<option value="string">String</option>
								<option value="number">Number</option>
								<option value="boolean">Boolean</option>
								<option value="object">Object</option>
								<option value="array">Array (Sederhana)</option>
								<option value="null">Null</option>
							</select>
							<div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
								{field.type === "object" ? (
									<FolderOpen className="w-3.5 h-3.5" />
								) : field.type === "string" ? (
									<Type className="w-3.5 h-3.5" />
								) : field.type === "number" ? (
									<Hash className="w-3.5 h-3.5" />
								) : field.type === "boolean" ? (
									<ToggleRight className="w-3.5 h-3.5" />
								) : (
									<Code2 className="w-3.5 h-3.5" />
								)}
							</div>
							<ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
						</div>
					</div>

					{/* Input nilai atau tombol tambah properti */}
					<div className="col-span-5 relative">
						{field.type === "object" ? (
							<button
								type="button"
								aria-label="Add property"
								onClick={() => ctx.onAddField(field.id)}
								className="flex items-center space-x-2 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-md border border-brand-200 transition-colors w-full justify-center"
								style={{ padding: "var(--space-1) var(--space-3)" }}
							>
								<Plus className="w-3.5 h-3.5" />
								<span>Tambah Properti</span>
							</button>
						) : field.type === "boolean" ? (
							<div className="flex items-center h-9" style={{ padding: "var(--space-1) var(--space-3)" }}>
								<button
									type="button"
									onClick={() =>
										ctx.onUpdateField(field.id, {
											value: field.value === "true" ? "false" : "true",
										})
									}
									className={`flex items-center space-x-2 rounded-md border text-xs font-bold transition-all ${
										field.value === "true"
											? "bg-emerald-50 text-emerald-600 border-emerald-200"
											: "bg-slate-50 text-slate-500 border-slate-200"
									}`}
								>
									{field.value === "true" ? (
										<ToggleRight className="w-4 h-4" />
									) : (
										<ToggleLeft className="w-4 h-4" />
									)}
									<span>{field.value === "true" ? "True" : "False"}</span>
								</button>
							</div>
						) : field.type === "null" ? (
							<div
								className="text-xs text-slate-400 italic bg-slate-50 rounded border border-slate-100"
								style={{ padding: "var(--space-2)" }}
							>
								null
							</div>
						) : (
							<div className="relative flex items-center">
								<input
									type={field.type === "number" ? "number" : "text"}
									placeholder={field.type === "array" ? '["item1", "item2"]' : "Value"}
									value={field.value}
									onChange={e => ctx.onUpdateField(field.id, { value: e.target.value })}
									disabled={field.type === "array"} // Array ditangani sebagai string untuk input dasar
									className={`w-full text-sm text-slate-600 bg-white border border-slate-200 rounded-md font-mono focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors ${
										field.value.includes("{{") ? "text-brand-600 font-bold" : ""
									} ${field.type === "array" ? "bg-slate-100 text-slate-500" : ""}`}
									style={{ padding: "var(--space-1) var(--space-2)", paddingRight: "var(--space-3)" }}
								/>
								{field.error && <div className="text-xs text-rose-500 mt-1">{field.error}</div>}
								{field.type === "array" && (
									<span className="absolute right-3 text-xs text-slate-400 pointer-events-none">
										JSON
									</span>
								)}
								{field.type === "string" && (
									<button
										type="button"
										onClick={() =>
											ctx.onSetActiveGeneratorDropdown(
												ctx.dropdownGeneratorAktif === field.id ? null : field.id
											)
										}
										className={`absolute right-1.5 rounded hover:bg-slate-100 transition-colors ${
											field.value.includes("{{") ? "text-brand-500" : "text-slate-400"
										}`}
										style={{ padding: "var(--space-1)" }}
										title="Insert Generator"
										aria-label="Insert generator"
									>
										<Sparkles className="w-3.5 h-3.5" />
									</button>
								)}

								{/* Dropdown untuk generator variabel */}
								{ctx.dropdownGeneratorAktif === field.id && (
									<div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
										<div
											className="bg-slate-50 border-b border-slate-100 flex justify-between items-center"
											style={{ padding: "var(--space-1) var(--space-2)" }}
										>
											<span className="text-[10px] font-bold text-slate-500 uppercase">
												Generators
											</span>
											<button
												type="button"
												onClick={() => ctx.onSetActiveGeneratorDropdown(null)}
											>
												<X className="w-3 h-3 text-slate-400" />
											</button>
										</div>
										<div className="max-h-48 overflow-y-auto" style={{ padding: "var(--space-1)" }}>
											{MOCK_VARIABLES_HELP.map(v => (
												<button
													type="button"
													key={v.label}
													onClick={() => ctx.onInsertVariable(v.label)}
													className="w-full text-left hover:bg-brand-50 rounded-md flex flex-col group/item"
													style={{ padding: "var(--space-1) var(--space-2)" }}
												>
													<span className="text-xs font-mono font-medium text-brand-600">
														{v.label}
													</span>
													<span className="text-xs text-slate-400 group-hover/item:text-slate-500">
														{v.desc}
													</span>
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				<button
					type="button"
					onClick={() => ctx.onRemoveFieldRequest(field.id)}
					className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
					style={{ padding: "var(--space-1)" }}
					title="Delete Field"
					aria-label="Delete field"
				>
					<Trash2 className="w-4 h-4" />
				</button>
			</div>

			{/* Render children jika tipe object */}
			{field.type === "object" && memilikiAnak && !field.isCollapsed && (
				<div
					className="border-l-2 border-slate-100 relative"
					style={{ paddingLeft: "var(--space-5)", marginLeft: "var(--space-5)" }}
				>
					{/* Visual connector */}
					<div className="absolute -top-3 left-0 w-4 h-4 border-l-2 border-b-2 border-slate-100 rounded-bl-lg -z-10" />

					{field.children?.map(child => (
						<FieldRow key={child.id} field={child} depth={depth + 1} ctx={ctx} />
					))}
				</div>
			)}
			{field.type === "object" && !field.isCollapsed && (!field.children || field.children.length === 0) && (
				<div
					className="text-[10px] text-slate-400 italic"
					style={{ paddingLeft: "calc(var(--space-5) * 2)", paddingBottom: "var(--space-2)" }}
				>
					Object kosong
				</div>
			)}
			{field.type === "object" && field.isCollapsed && (
				<div
					className="text-[10px] text-slate-400 italic flex items-center gap-2"
					style={{ paddingLeft: "var(--space-4)", paddingBottom: "var(--space-2)" }}
				>
					<span className="w-1 h-1 rounded-full bg-slate-300"></span>
					<span>{field.children?.length || 0} properti tersembunyi</span>
				</div>
			)}
		</div>
	);
};

/**
 * Komponen untuk overlay highlight JSON (syntax highlighting)
 */
const JsonHighlightOverlay = ({ code, fontSize }: { code: string; fontSize: number }) => {
	const tokens = code.split(/(".*?"|:|\d+|true|false|null)/g);
	return (
		<pre
			className="absolute inset-0 pointer-events-none font-mono leading-relaxed whitespace-pre-wrap break-all"
			style={{
				fontSize: `${fontSize}px`,
				lineHeight: "1.6",
				padding: "var(--space-3)",
				paddingLeft: "var(--space-2)",
			}}
			aria-hidden="true"
		>
			{tokens.map((token, i) => {
				let className = "text-slate-400";
				if (token.startsWith('"')) {
					if (token.endsWith('":') || (tokens[i + 1] && tokens[i + 1].trim().startsWith(":"))) {
						className = "text-sky-300 font-bold";
					} else {
						className = "text-emerald-300";
					}
				} else if (/^-?\d+(\.\d+)?$/.test(token)) {
					className = "text-amber-300";
				} else if (/^(true|false)$/.test(token)) {
					className = "text-rose-300 font-bold";
				} else if (token === "null") {
					className = "text-slate-500 italic";
				}
				return (
					<span key={i} className={className}>
						{token}
					</span>
				);
			})}
			{code.endsWith("\n") && <br />}
		</pre>
	);
};

/**
 * Komponen utama MockEditor untuk membuat dan mengedit mock endpoint
 */
export const MockEditor: React.FC<MockEditorProps> = ({
	initialData,
	existingMocks = [],
	onSave,
	onDelete,
	onCancel,
	addToast,
}) => {
	// State untuk data form
	const [dataForm, setDataForm] = useState<MockEndpoint>(DEFAULT_MOCK);
	const [errorJson, setErrorJson] = useState<string | null>(null);
	const [barisErrorJson, setBarisErrorJson] = useState<number | null>(null);
	const [errorKonflik, setErrorKonflik] = useState<string | null>(null);
	const [sedangGenerate, setSedangGenerate] = useState(false);

	// State untuk editor
	const [modeEditor, setModeEditor] = useState<"code" | "visual">("visual");
	const [fieldVisual, setFieldVisual] = useState<SchemaField[]>([]);
	const [adalahRootArray, setAdalahRootArray] = useState(false); // Menandakan apakah root adalah array
	const [tampilkanVariabel, setTampilkanVariabel] = useState(false);
	const [dropdownGeneratorAktif, setDropdownGeneratorAktif] = useState<string | null>(null);
	const [terkopi, setTerkopi] = useState(false);
	const [ukuranFont, setUkuranFont] = useState(14);
	const [tampilkanPencarian, setTampilkanPencarian] = useState(false);
	const [istilahPencarian, setIstilahPencarian] = useState("");
	const [jumlahKecocokan, setJumlahKecocokan] = useState({ saatIni: 0, total: 0 });
	const [fieldUntukDihapus, setFieldUntukDihapus] = useState<{
		id: string;
		type: string;
		jumlahAnak: number;
	} | null>(null);

	// State untuk drag & drop
	const [idSumberDrag, setIdSumberDrag] = useState<string | null>(null);
	const [idTargetDrag, setIdTargetDrag] = useState<string | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumbersRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Preset konfigurasi
	const PRESET_STATUS = [200, 201, 204, 400, 401, 404, 500];
	const PRESET_LATENSI = [0, 150, 500, 1000, 2500];

	/**
	 * Fungsi untuk menghasilkan ID unik
	 */
	const generateId = () => crypto.randomUUID();

	/**
	 * Fungsi helper untuk menyalin teks ke clipboard dengan fallback
	 * @param teks - Teks yang akan disalin
	 * @param pesanSukses - Pesan toast untuk sukses
	 * @returns Promise<boolean> - True jika berhasil
	 */
	// Helper kecil untuk kompatibilitas property autentikasi
	const getAuthType = (cfg?: any) => (cfg as any)?.jenis ?? (cfg as any)?.type ?? "NONE";
	const salinKeClipboard = async (teks: string, pesanSukses = "Token disalin ke clipboard") => {
		if (!teks) {
			addToast("Token tidak tersedia untuk disalin", "error");
			return false;
		}
		try {
			if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
				await navigator.clipboard.writeText(teks);
				addToast(pesanSukses, "info");
				return true;
			} else {
				// Fallback untuk browser lama
				const textarea = document.createElement("textarea");
				textarea.value = teks;
				textarea.setAttribute("aria-hidden", "true");
				textarea.style.position = "fixed";
				textarea.style.left = "-9999px";
				document.body.appendChild(textarea);
				textarea.select();
				const berhasil = document.execCommand("copy");
				document.body.removeChild(textarea);
				if (berhasil) {
					addToast(pesanSukses, "info");
					return true;
				}
				addToast("Token tidak tersedia untuk disalin", "error");
				return false;
			}
		} catch (err) {
			addToast("Gagal menyalin token", "error");
			console.error(err);
			return false;
		}
	};

	// --- Efek Samping ---

	useEffect(() => {
		if (initialData) {
			setDataForm({
				...initialData,
				headers: initialData.headers ? initialData.headers.map(h => ({ ...h })) : [],
				authConfig: initialData.authConfig || { jenis: "NONE" },
				proxy: initialData.proxy || { enabled: false, target: "", timeout: 5000, fallbackToMock: false },
			});
			// Validasi struktur JSON untuk inisialisasi
			const errorStruktur = validasiStrukturJson(initialData.responseBody);
			if (!errorStruktur) {
				try {
					const parsed = JSON.parse(initialData.responseBody);
					setFieldVisual(parseJsonKeSkema(parsed, generateId));
					setAdalahRootArray(Array.isArray(parsed));
				} catch (e) {
					setModeEditor("code");
				}
			} else {
				setModeEditor("code");
			}
		} else {
			setDataForm({
				...DEFAULT_MOCK,
				id: crypto.randomUUID(),
				createdAt: Date.now(),
			});
			setAdalahRootArray(false);
			setFieldVisual([
				{ id: generateId(), key: "id", value: "{{$uuid}}", type: "string" },
				{
					id: generateId(),
					key: "name",
					value: "{{$randomName}}",
					type: "string",
				},
				{
					id: generateId(),
					key: "metadata",
					value: "",
					type: "object",
					children: [
						{
							id: generateId(),
							key: "created",
							value: "{{$isoDate}}",
							type: "string",
						},
					],
				},
			]);
		}
	}, [initialData]);

	// Efek untuk mendeteksi konflik rute
	useEffect(() => {
		if (dataForm.path && (dataForm as any).metode) {
			const adaKonflik = (existingMocks || []).some(
				m =>
					m.id !== dataForm.id && // Jangan cocokkan dengan diri sendiri
					m.metode === (dataForm as any).metode &&
					patternsConflict(m.path, dataForm.path)
			);

			if (adaKonflik) {
				setErrorKonflik(`Konflik rute: ${(dataForm as any).metode} ${dataForm.path} sudah ada.`);
			} else {
				setErrorKonflik(null);
			}
		}
	}, [(dataForm as any).metode, dataForm.path, dataForm.id, existingMocks]);

	// Sinkronisasi visual -> JSON
	useEffect(() => {
		if (modeEditor === "visual") {
			try {
				const jsonAkhir = konversiSkemaKeJson(fieldVisual, adalahRootArray);
				setDataForm(prev => ({
					...prev,
					responseBody: JSON.stringify(jsonAkhir, null, 2),
				}));
				setErrorJson(null);
				setBarisErrorJson(null);
			} catch (e) {
				setErrorJson((e as Error).message);
				setBarisErrorJson(null);
			}
		}
	}, [fieldVisual, modeEditor, adalahRootArray]);

	useEffect(() => {
		if (tampilkanPencarian && searchInputRef.current) searchInputRef.current.focus();
		if (!tampilkanPencarian) {
			setIstilahPencarian("");
			setJumlahKecocokan({ saatIni: 0, total: 0 });
		}
	}, [tampilkanPencarian]);

	/**
	 * Handler untuk perubahan data form
	 */
	const handlePerubahan = (field: keyof MockEndpoint, value: any) => {
		if (field === "path") {
			value = value.toString().replace(/\s+/g, "");
		}
		setDataForm(prev => ({ ...prev, [field]: value }));

		if (field === "responseBody") {
			const struktur = validasiStrukturJson(value);
			setErrorJson(struktur ? struktur.message : null);
			setBarisErrorJson(struktur ? struktur.line ?? null : null);
		}
	};

	/**
	 * Handler untuk berpindah mode editor
	 */
	const handleGantiMode = (mode: "code" | "visual") => {
		if (mode === "visual") {
			// Validasi ketat sebelum berpindah
			const errorStruktur = validasiStrukturJson(dataForm.responseBody);
			if (errorStruktur) {
				addToast(errorStruktur.message, "error");
				setErrorJson(errorStruktur.message);
				setBarisErrorJson(errorStruktur.line ?? null);
				return;
			}

			try {
				const parsed = JSON.parse(dataForm.responseBody);
				setFieldVisual(parseJsonKeSkema(parsed, generateId));
				setAdalahRootArray(Array.isArray(parsed));
				setModeEditor("visual");
			} catch {
				addToast("Error tak terduga saat parsing JSON", "error");
			}
		} else {
			setModeEditor("code");
		}
	};

	// --- Handlers untuk Drag & Drop ---

	const handleDragStart = (e: React.DragEvent, id: string) => {
		e.stopPropagation();
		setIdSumberDrag(id);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnter = (e: React.DragEvent, id: string) => {
		e.stopPropagation();
		if (idSumberDrag && idSumberDrag !== id) {
			setIdTargetDrag(id);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDragEnd = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (idSumberDrag && idTargetDrag && idSumberDrag !== idTargetDrag) {
			setFieldVisual(fieldSebelumnya => {
				const fieldBaru = klonDalam(fieldSebelumnya);
				let nodeSumber: SchemaField | null = null;
				const hapusNode = (list: SchemaField[]): boolean => {
					const idx = list.findIndex(f => f.id === idSumberDrag);
					if (idx !== -1) {
						nodeSumber = list[idx];
						list.splice(idx, 1);
						return true;
					}
					for (const item of list) {
						if (item.children && hapusNode(item.children)) return true;
					}
					return false;
				};
				if (!hapusNode(fieldBaru) || !nodeSumber) return fieldSebelumnya;
				const sisipkanNode = (list: SchemaField[]): boolean => {
					const idx = list.findIndex(f => f.id === idTargetDrag);
					if (idx !== -1) {
						list.splice(idx + 1, 0, nodeSumber!);
						return true;
					}
					for (const item of list) {
						if (item.children && sisipkanNode(item.children)) return true;
					}
					return false;
				};
				sisipkanNode(fieldBaru);
				return fieldBaru;
			});
		}
		setIdSumberDrag(null);
		setIdTargetDrag(null);
	};

	// --- Manipulasi Field ---

	/**
	 * Mengupdate field berdasarkan ID
	 */
	const updateField = (id: string, updates: Partial<SchemaField>) => {
		const updateRekursif = (list: SchemaField[]): SchemaField[] => {
			return list.map(field => {
				if (field.id === id) {
					const fieldDiupdate = { ...field, ...updates };
					if (updates.type === "object" && field.type !== "object" && !field.children) {
						fieldDiupdate.children = [];
					}
					if (updates.type === "array" && field.type !== "array") {
						fieldDiupdate.value = "[]";
					}

					// Validasi inline untuk number dan array
					if (fieldDiupdate.type === "number") {
						const n = parseFloat(String(fieldDiupdate.value));
						if (Number.isNaN(n)) {
							fieldDiupdate.error = `Angka tidak valid: ${fieldDiupdate.value}`;
						} else {
							delete fieldDiupdate.error;
						}
					}
					if (fieldDiupdate.type === "array") {
						try {
							JSON.parse(fieldDiupdate.value || "[]");
							delete fieldDiupdate.error;
						} catch (e) {
							fieldDiupdate.error = (e as Error).message || "Array JSON tidak valid";
						}
					}

					return fieldDiupdate;
				}
				if (field.children) return { ...field, children: updateRekursif(field.children) };
				return field;
			});
		};
		setFieldVisual(prev => updateRekursif(prev));
	};

	/**
	 * Menambah field baru
	 * @param parentId - ID parent (null untuk root)
	 */
	const handleTambahField = (parentId: string | null = null) => {
		// Jika root adalah array, kunci otomatis ke indeks berikutnya
		const kunciBerikutnya = parentId === null && adalahRootArray ? String(fieldVisual.length) : "field_baru";

		const fieldBaru: SchemaField = {
			id: generateId(),
			key: kunciBerikutnya,
			value: "",
			type: "string",
			isCollapsed: false,
			children: [],
		};

		if (parentId === null) {
			setFieldVisual(prev => [...prev, fieldBaru]);
		} else {
			const tambahRekursif = (list: SchemaField[]): SchemaField[] => {
				return list.map(field => {
					if (field.id === parentId) {
						return {
							...field,
							children: [...(field.children || []), fieldBaru],
							isCollapsed: false,
						};
					}
					if (field.children) {
						return { ...field, children: tambahRekursif(field.children) };
					}
					return field;
				});
			};
			setFieldVisual(prev => tambahRekursif(prev));
		}
	};

	/**
	 * Mencari field berdasarkan ID secara rekursif
	 */
	const cariFieldRekursif = (list: SchemaField[], id: string): SchemaField | null => {
		for (const field of list) {
			if (field.id === id) return field;
			if (field.children) {
				const ditemukan = cariFieldRekursif(field.children, id);
				if (ditemukan) return ditemukan;
			}
		}
		return null;
	};

	/**
	 * Permintaan penghapusan field (dengan konfirmasi jika ada anak)
	 */
	const handlePermintaanHapusField = (id: string) => {
		const field = cariFieldRekursif(fieldVisual, id);
		if (!field) return;
		if (field.type === "object" && field.children && field.children.length > 0) {
			setFieldUntukDihapus({
				id: field.id,
				type: "object",
				jumlahAnak: field.children.length,
			});
		} else {
			jalankanHapusField(id);
		}
	};

	/**
	 * Menjalankan penghapusan field setelah konfirmasi
	 */
	const jalankanHapusField = (id: string) => {
		const hapusRekursif = (list: SchemaField[]): SchemaField[] => {
			return list
				.filter(f => f.id !== id)
				.map(field => {
					if (field.children) return { ...field, children: hapusRekursif(field.children) };
					return field;
				});
		};
		setFieldVisual(prev => hapusRekursif(prev));
		setFieldUntukDihapus(null);
	};

	/**
	 * Toggle collapse untuk field bertipe object
	 */
	const handleToggleCollapse = (id: string) => {
		const toggleRekursif = (list: SchemaField[]): SchemaField[] => {
			return list.map(f => {
				if (f.id === id) return { ...f, isCollapsed: !f.isCollapsed };
				if (f.children) return { ...f, children: toggleRekursif(f.children) };
				return f;
			});
		};
		setFieldVisual(prev => toggleRekursif(prev));
	};

	/**
	 * Memindahkan field dalam daftar sibling
	 */
	const pindahkanField = (id: string, direction: "up" | "down") => {
		setFieldVisual(prev => {
			const fieldBaru = klonDalam(prev);
			let terpindah = false;

			const helper = (list: SchemaField[]): boolean => {
				const idx = list.findIndex(f => f.id === id);
				if (idx !== -1) {
					const swapIdx = direction === "up" ? idx - 1 : idx + 1;
					if (swapIdx >= 0 && swapIdx < list.length) {
						[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
						terpindah = true;
					}
					return true;
				}
				for (const item of list) {
					if (item.children && helper(item.children)) return true;
				}
				return false;
			};

			helper(fieldBaru);
			if (terpindah) return fieldBaru;
			return prev;
		});
	};

	/**
	 * Menyisipkan variabel generator ke dalam field
	 */
	const sisipkanVariabel = (variable: string) => {
		if (dropdownGeneratorAktif) {
			updateField(dropdownGeneratorAktif, { value: variable });
			setDropdownGeneratorAktif(null);
		} else if (modeEditor === "code" && textareaRef.current) {
			const textarea = textareaRef.current;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = dataForm.responseBody;
			const newText = text.substring(0, start) + variable + text.substring(end);
			handlePerubahan("responseBody", newText);
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + variable.length, start + variable.length);
			}, 0);
		}
	};

	/**
	 * Menambah header baru
	 */
	const tambahHeader = () => {
		setDataForm(prev => ({
			...prev,
			headers: [...(prev.headers || []), { key: "", value: "" }],
		}));
	};

	/**
	 * Mengupdate header berdasarkan indeks
	 */
	const updateHeader = (index: number, key: "key" | "value", value: string) => {
		setDataForm(prev => {
			const h = [...(prev.headers || [])];
			h[index] = { ...h[index], [key]: value };
			return { ...prev, headers: h };
		});
	};

	/**
	 * Menghapus header berdasarkan indeks
	 */
	const hapusHeader = (index: number) => {
		setDataForm(prev => ({
			...prev,
			headers: (prev.headers || []).filter((_, i) => i !== index),
		}));
	};

	/**
	 * Handler untuk submit form
	 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (errorJson) {
			addToast("Harap perbaiki error JSON terlebih dahulu", "error");
			return;
		}
		if (errorKonflik) {
			addToast("Tidak dapat menyimpan: Terdeteksi konflik rute", "error");
			return;
		}
		onSave(dataForm);
	};

	/**
	 * Handler untuk generate AI
	 */
	const handleGenerateAI = async () => {
		if (!(dataForm as any).nama && !dataForm.path) {
			addToast("Diperlukan konteks: Harap isi Nama atau Path", "error");
			return;
		}
		setSedangGenerate(true);
		try {
			const context = `Nama: ${(dataForm as any).nama}, Method: ${(dataForm as any).metode}, Path: ${
				dataForm.path
			}`;
			if (!FEATURES.AI()) {
				addToast("Fitur AI dinonaktifkan. Aktifkan melalui Settings atau feature flags.", "info");
				setSedangGenerate(false);
				return;
			}
			const { generateMockData } = await import("../services/aiService");
			const json = await generateMockData(dataForm.path, context);
			handlePerubahan("responseBody", json);

			if (modeEditor === "visual") {
				try {
					const parsed = JSON.parse(json);
					if (typeof parsed === "object" && parsed !== null) {
						setFieldVisual(parseJsonKeSkema(parsed, generateId));
						setAdalahRootArray(Array.isArray(parsed));
					}
				} catch {}
			}
			addToast("Response body berhasil digenerate", "success");
		} catch (e) {
			const err = e as any;
			if (err?.code === "OPENROUTER_DISABLED") {
				addToast("Provider OpenRouter dinonaktifkan. Aktifkan di Settings.", "error");
			} else if (err?.code === "OPENROUTER_TIMEOUT") {
				addToast(
					"Request OpenRouter timeout. Periksa jaringan atau tambah timeout proxy (OPENROUTER_TIMEOUT_MS)",
					"error"
				);
			} else if (
				(err?.message &&
					(err.message.includes("OPENROUTER_API_KEY not configured") || err.message.includes("401"))) ||
				err?.code === "OPENROUTER_UNAUTHORIZED"
			) {
				addToast(
					"API Key OpenRouter tidak ada atau proxy tidak berjalan. Konfigurasi atau mulai proxy.",
					"error"
				);
			} else {
				addToast("Gagal melakukan generate", "error");
			}
		} finally {
			setSedangGenerate(false);
		}
	};

	/**
	 * Format JSON dengan indentasi
	 */
	const formatJSON = () => {
		try {
			const parsed = JSON.parse(dataForm.responseBody);
			handlePerubahan("responseBody", JSON.stringify(parsed, null, 2));
			addToast("JSON telah diformat", "success");
		} catch {
			addToast("JSON tidak valid tidak dapat diformat", "error");
		}
	};

	/**
	 * Minify JSON (hapus whitespace)
	 */
	const minifyJSON = () => {
		try {
			const parsed = JSON.parse(dataForm.responseBody);
			handlePerubahan("responseBody", JSON.stringify(parsed));
			addToast("JSON telah diminify", "info");
		} catch {
			addToast("JSON tidak valid tidak dapat diminify", "error");
		}
	};

	/**
	 * Menyalin JSON ke clipboard
	 */
	const salinKeClipboardJSON = async () => {
		const ok = await salinKeClipboard(dataForm.responseBody, "JSON disalin ke clipboard");
		if (ok) {
			setTerkopi(true);
			setTimeout(() => setTerkopi(false), 2000);
		}
	};

	/**
	 * Mencari teks dalam editor
	 */
	const cariSelanjutnya = (direction: "next" | "prev" = "next") => {
		if (!istilahPencarian || !textareaRef.current) return;
		const text = dataForm.responseBody.toLowerCase();
		const term = istilahPencarian.toLowerCase();
		const posisiSaatIni = textareaRef.current.selectionStart;
		let posisiBerikutnya = -1;

		if (direction === "next") {
			posisiBerikutnya = text.indexOf(term, posisiSaatIni + 1);
			if (posisiBerikutnya === -1) posisiBerikutnya = text.indexOf(term, 0);
		} else {
			posisiBerikutnya = text.lastIndexOf(term, posisiSaatIni - 1);
			if (posisiBerikutnya === -1) posisiBerikutnya = text.lastIndexOf(term);
		}

		if (posisiBerikutnya !== -1) {
			textareaRef.current.focus();
			textareaRef.current.setSelectionRange(posisiBerikutnya, posisiBerikutnya + term.length);
			const kecocokan = text.split(term).length - 1;
			const kecocokanSebelum = text.substring(0, posisiBerikutnya).split(term).length;
			setJumlahKecocokan({ saatIni: kecocokanSebelum, total: kecocokan });
		} else {
			setJumlahKecocokan({ saatIni: 0, total: 0 });
		}
	};

	/**
	 * Handler untuk scroll sinkron
	 */
	const handleScroll = () => {
		if (textareaRef.current && lineNumbersRef.current) {
			lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
		}
	};

	/**
	 * Handler untuk keyboard shortcut
	 */
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "f") {
			e.preventDefault();
			setTampilkanPencarian(true);
			return;
		}
		if (e.key === "Tab") {
			e.preventDefault();
			const textarea = e.currentTarget;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const value = textarea.value;
			const newValue = value.substring(0, start) + "  " + value.substring(end);
			handlePerubahan("responseBody", newValue);
			requestAnimationFrame(() => {
				if (textareaRef.current) {
					textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
				}
			});
			return;
		}
		if (e.key === "Enter") {
			const textarea = e.currentTarget;
			const start = textarea.selectionStart;
			const value = textarea.value;
			const lineStart = value.lastIndexOf("\n", start - 1) + 1;
			const currentLine = value.substring(lineStart, start);
			const match = currentLine.match(/^(\s*)/);
			let indent = match ? match[1] : "";
			if (value[start - 1] === "{" || value[start - 1] === "[") indent += "  ";
			e.preventDefault();
			const newValue = value.substring(0, start) + "\n" + indent + value.substring(start);
			handlePerubahan("responseBody", newValue);
			requestAnimationFrame(() => {
				if (textareaRef.current)
					textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1 + indent.length;
			});
			return;
		}
	};

	/**
	 * Mendapatkan baris error JSON
	 */
	const dapatkanBarisError = (): number | null => {
		if (barisErrorJson) return barisErrorJson;
		if (!errorJson) return null;
		const match = errorJson.match(/at position (\d+)/);
		if (match && match[1]) {
			const pos = parseInt(match[1]);
			const textSampaiError = dataForm.responseBody.substring(0, pos);
			return textSampaiError.split("\n").length;
		}
		return null;
	};

	const barisError = dapatkanBarisError();

	// Konteks untuk FieldRow
	const konteksField: FieldRowContextProps = {
		idSumberDrag,
		idTargetDrag,
		dropdownGeneratorAktif,
		onDragStart: handleDragStart,
		onDragEnter: handleDragEnter,
		onDragOver: handleDragOver,
		onDragEnd: handleDragEnd,
		onUpdateField: updateField,
		onAddField: handleTambahField,
		onRemoveFieldRequest: handlePermintaanHapusField,
		onSetActiveGeneratorDropdown: setDropdownGeneratorAktif,
		onInsertVariable: sisipkanVariabel,
		onToggleCollapse: handleToggleCollapse,
		onMoveField: pindahkanField,
	};

	return (
		<div
			className="max-w-7xl mx-auto md:p-8 animate-enter h-full flex flex-col relative"
			style={{ padding: "var(--space-3)" }}
		>
			<div className="flex items-center justify-between mb-6 flex-shrink-0">
				<div className="flex items-center space-x-4">
					<button
						type="button"
						onClick={onCancel}
						className="hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl transition-all group"
						style={{ padding: "var(--space-2)" }}
					>
						<ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-800" />
					</button>
					<div>
						<h1 className="text-2xl font-bold text-slate-900 tracking-tight">
							{initialData ? "Edit Definisi" : "Desain Route Baru"}
						</h1>
						<p className="text-slate-500 text-sm mt-0.5">
							Konfigurasi perilaku endpoint dan struktur data.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{initialData && (
						<button
							type="button"
							onClick={() => onDelete(dataForm.id)}
							className="rounded-xl text-red-500 font-medium hover:bg-red-50 transition-colors text-sm border border-transparent hover:border-red-100 mr-2"
							style={{ padding: "var(--space-2) var(--space-4)" }}
						>
							<Trash2 className="w-4 h-4 inline-block mr-2" />
							Hapus
						</button>
					)}
					<button
						type="button"
						onClick={onCancel}
						className="rounded-xl text-slate-600 font-medium hover:bg-slate-200/50 transition-colors text-sm"
						style={{ padding: "var(--space-2) var(--space-5)" }}
					>
						Batal
					</button>
					<button
						type="submit"
						onClick={handleSubmit}
						disabled={!!errorJson || !!errorKonflik}
						className={`flex items-center space-x-2 rounded-xl text-white font-bold text-sm transition-all shadow-lg active:scale-95 ${
							errorJson || errorKonflik
								? "bg-slate-400 cursor-not-allowed shadow-none"
								: "bg-brand-600 hover:bg-brand-50 shadow-brand-500/25"
						}`}
						style={{ padding: "var(--space-2) var(--space-5)" }}
					>
						<Save className="w-4 h-4" />
						<span>Simpan Route</span>
					</button>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
				{/* Kolom Kiri: Konfigurasi */}
				<div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
					{/* Kartu Info Utama */}
					<div
						className="bg-white rounded-2xl border border-slate-200 shadow-sm space-y-6"
						style={{ padding: "var(--space-3)" }}
					>
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Settings className="w-4 h-4 text-brand-500" /> Pengaturan Umum
						</h3>

						<div className="space-y-5">
							<div>
								<Label>Metode HTTP</Label>
								<div className="grid grid-cols-3 gap-2">
									{Object.values(HttpMethod).map(m => (
										<button
											key={m}
											type="button"
											onClick={() => handlePerubahan("metode" as keyof MockEndpoint, m)}
											className={`text-xs font-bold py-2.5 rounded-lg border transition-all ${
												(dataForm as any).metode === m
													? "bg-brand-50 border-brand-500 text-brand-700 ring-1 ring-brand-500"
													: "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
											}`}
										>
											{m}
										</button>
									))}
								</div>
							</div>

							<div>
								<Label>Path Resource</Label>
								<div className="relative group">
									<input
										type="text"
										value={dataForm.path}
										onChange={e => handlePerubahan("path", e.target.value)}
										className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:border-transparent outline-none transition-all placeholder:text-slate-400 ${
											errorKonflik
												? "border-red-300 focus:ring-red-200 bg-red-50 text-red-700"
												: "border-slate-200 focus:ring-brand-500/20 focus:border-brand-500"
										}`}
										placeholder="/api/v1/resource/:id"
										style={{ padding: "var(--space-3) var(--space-4)" }}
									/>
								</div>
								{errorKonflik ? (
									<div className="flex items-center text-[10px] text-red-500 mt-1.5 ml-1 font-bold animate-in fade-in slide-in-from-left-2">
										<AlertTriangle className="w-3 h-3 mr-1" />
										{errorKonflik}
									</div>
								) : (
									<div className="text-[10px] text-slate-400 mt-1.5 ml-1">
										Mendukung parameter dinamis (contoh: :id)
									</div>
								)}
							</div>

							<div>
								<Label>Nama Internal</Label>
								<input
									type="text"
									value={(dataForm as any).nama}
									onChange={e => handlePerubahan("nama" as keyof MockEndpoint, e.target.value)}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
									style={{ padding: "var(--space-3) var(--space-4)" }}
									placeholder="contoh: Ambil Profil Pengguna"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label>Status Code</Label>
									<input
										type="number"
										value={dataForm.statusCode}
										onChange={e => handlePerubahan("statusCode", parseInt(e.target.value))}
										className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-mono font-bold outline-none focus:ring-2 transition-all ${
											dataForm.statusCode >= 400
												? "text-red-600 border-red-200 focus:border-red-500 focus:ring-red-500/20"
												: "text-emerald-600 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
										}`}
									/>
									<div className="flex flex-wrap gap-1.5 mt-2">
										{PRESET_STATUS.map(code => (
											<button
												key={code}
												type="button"
												onClick={() => handlePerubahan("statusCode", code)}
												className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
											>
												{code}
											</button>
										))}
									</div>
								</div>
								<div>
									<Label>Status</Label>
									<div className="flex items-center justify-between bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 h-[46px]">
										<span className="text-xs font-semibold text-slate-600">
											{dataForm.isActive ? "Aktif" : "Nonaktif"}
										</span>
										<button
											type="button"
											onClick={() => handlePerubahan("isActive", !dataForm.isActive)}
											className={`w-9 h-5 flex items-center rounded-full transition-colors duration-200 ease-in-out px-0.5 ${
												dataForm.isActive ? "bg-green-500" : "bg-slate-300"
											}`}
										>
											<div
												className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
													dataForm.isActive ? "translate-x-4" : "translate-x-0"
												}`}
											/>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Kartu Konfigurasi Autentikasi & Keamanan */}
					<div
						className="bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5"
						style={{ padding: "var(--space-3)" }}
					>
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Shield className="w-4 h-4 text-rose-500" /> Autentikasi & Keamanan
						</h3>

						<p className="text-xs text-slate-500 leading-relaxed">
							Lindungi endpoint Anda dengan mewajibkan kredensial autentikasi. Request tanpa kredensial
							yang valid akan mengembalikan{" "}
							<span className="font-semibold text-slate-700">401 Unauthorized</span>.
						</p>

						<div>
							<Label>Tipe Autentikasi</Label>
							<div className="mt-2">
								<button
									type="button"
									onClick={() => {
										void salinKeClipboard(dataForm.authConfig?.token || "");
									}}
									className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-700 text-white text-xs"
									aria-label="Salin token ke clipboard (robust)"
								>
									<Copy className="w-3.5 h-3.5" />
									<span>Salin</span>
								</button>
							</div>
							<select
								value={getAuthType(dataForm.authConfig)}
								onChange={e =>
									setDataForm(prev => ({
										...prev,
										authConfig: {
											...prev.authConfig,
											jenis: e.target.value as any,
										},
									}))
								}
								className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all cursor-pointer"
							>
								<option value="NONE">❌ Tanpa Autentikasi (Publik)</option>
								<option value="BEARER_TOKEN">🔑 Bearer Token (Header Authorization)</option>
								<option value="API_KEY">🗝️ API Key (Header Kustom)</option>
							</select>
						</div>

						{getAuthType(dataForm.authConfig) === "BEARER_TOKEN" && (
							<div
								className="space-y-4 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2"
								style={{ padding: "var(--space-2)" }}
							>
								<div>
									<Label>Nilai Bearer Token</Label>
									<div className="relative">
										<Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="text"
											value={dataForm.authConfig?.token || ""}
											onChange={e =>
												setDataForm(prev => ({
													...prev,
													authConfig: {
														...prev.authConfig!,
														token: e.target.value,
													},
												}))
											}
											className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
											placeholder="token-rahasia-saya-12345"
										/>
									</div>
									<p className="text-[11px] text-slate-600 mt-2 ml-1 space-y-1">
										<div>
											📋 <strong>Header yang Diharapkan:</strong>
										</div>
										<div className="font-mono bg-slate-900 text-emerald-400 px-3 py-2 rounded-md overflow-x-auto text-[10px] mt-1">
											<div className="flex items-center justify-between w-full">
												<div className="truncate">{formatAuthPreview(dataForm.authConfig)}</div>
												<button
													onClick={() => {
														const token = dataForm.authConfig?.token || "";
														if (token && navigator.clipboard) {
															navigator.clipboard.writeText(token);
															addToast("Token disalin ke clipboard", "info");
														} else {
															addToast("Token tidak tersedia untuk disalin", "error");
														}
													}}
													className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs"
													aria-label="Salin token ke clipboard"
												>
													<Copy className="w-3.5 h-3.5" />
													<span>Salin</span>
												</button>
											</div>
										</div>
									</p>
								</div>
							</div>
						)}

						{getAuthType(dataForm.authConfig) === "API_KEY" && (
							<div
								className="space-y-4 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2"
								style={{ padding: "var(--space-2)" }}
							>
								<div>
									<Label>Nama Header</Label>
									<input
										type="text"
										value={dataForm.authConfig?.headerKey || "x-api-key"}
										onChange={e =>
											setDataForm(prev => ({
												...prev,
												authConfig: {
													...prev.authConfig!,
													headerKey: e.target.value,
												},
											}))
										}
										className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
										placeholder="x-api-key"
									/>
									<p className="text-[10px] text-slate-500 mt-1.5 ml-1">
										Nama header yang akan berisi API key Anda (contoh:{" "}
										<span className="font-mono font-bold">x-api-key</span>,{" "}
										<span className="font-mono font-bold">X-API-Token</span>)
									</p>
								</div>

								<div>
									<Label>Nilai API Key</Label>
									<div className="relative">
										<Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="text"
											value={dataForm.authConfig?.token || ""}
											onChange={e =>
												setDataForm(prev => ({
													...prev,
													authConfig: {
														...prev.authConfig!,
														token: e.target.value,
													},
												}))
											}
											className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
											placeholder="sk-api-1234567890abcdef"
										/>
									</div>
									<p className="text-[11px] text-slate-600 mt-2 ml-1 space-y-1">
										<div>
											📋 <strong>Header yang Diharapkan:</strong>
										</div>
										<div className="font-mono bg-slate-900 text-emerald-400 px-3 py-2 rounded-md overflow-x-auto text-[10px] mt-1">
											<div className="flex items-center justify-between w-full">
												<div className="truncate">{formatAuthPreview(dataForm.authConfig)}</div>
												<button
													onClick={() => {
														const token = dataForm.authConfig?.token || "";
														if (token && navigator.clipboard) {
															navigator.clipboard.writeText(token);
															addToast("Token disalin ke clipboard", "info");
														} else {
															addToast("Token tidak tersedia untuk disalin", "error");
														}
													}}
													className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs"
													aria-label="Salin token ke clipboard"
												>
													<Copy className="w-3.5 h-3.5" />
													<span>Salin</span>
												</button>
											</div>
										</div>
									</p>
								</div>
							</div>
						)}

						{getAuthType(dataForm.authConfig) === "NONE" && (
							<div
								className="bg-slate-50 border border-slate-200 rounded-lg"
								style={{ padding: "var(--space-2)" }}
							>
								<p className="text-xs text-slate-600 flex items-start gap-2">
									<span className="text-lg leading-none">🌐</span>
									<span>
										Endpoint ini <strong>publik</strong> dan dapat diakses tanpa autentikasi.
									</span>
								</p>
							</div>
						)}

						{FEATURES.PROXY() && (
							<div
								className="bg-white rounded-lg border border-slate-200"
								style={{ padding: "var(--space-2)" }}
							>
								<Label>Proxy / Passthrough</Label>
								<div className="flex items-center gap-3 mb-2">
									<button
										onClick={() =>
											setDataForm(prev => ({
												...prev,
												proxy: { ...(prev.proxy || {}), enabled: !prev.proxy?.enabled },
											}))
										}
										className={`w-9 h-5 flex items-center rounded-full transition-colors duration-200 ease-in-out px-0.5 ${
											dataForm.proxy?.enabled ? "bg-emerald-500" : "bg-slate-300"
										}`}
									>
										<div
											className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
												dataForm.proxy?.enabled ? "translate-x-4" : "translate-x-0"
											}`}
										/>
									</button>
									<div className="text-sm text-slate-700 font-medium">Aktifkan Proxy</div>
								</div>

								{dataForm.proxy?.enabled && (
									<div
										className="space-y-3 border border-slate-100 rounded-md bg-emerald-50"
										style={{ padding: "var(--space-1)" }}
									>
										<div>
											<Label>Target Proxy (Base URL)</Label>
											<input
												type="text"
												value={dataForm.proxy?.target || ""}
												onChange={e =>
													setDataForm(prev => ({
														...prev,
														proxy: {
															...(prev.proxy || {}),
															enabled: prev.proxy?.enabled ?? false,
															target: e.target.value,
														},
													}))
												}
												placeholder="https://api.example.com"
												className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
											/>
											<p className="text-[10px] text-slate-500 mt-1">
												Request ke route ini akan diteruskan ke target base URL yang
												dikonfigurasi (path akan dipertahankan).
											</p>
										</div>

										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label>Timeout (ms)</Label>
												<input
													type="number"
													value={dataForm.proxy?.timeout ?? 5000}
													onChange={e =>
														setDataForm(prev => ({
															...prev,
															proxy: {
																...(prev.proxy || {}),
																enabled: prev.proxy?.enabled ?? false,
																timeout: Number(e.target.value),
															},
														}))
													}
													className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
												/>
											</div>

											<div>
												<Label>Fallback ke Mock</Label>
												<select
													value={String(dataForm.proxy?.fallbackToMock || false)}
													onChange={e =>
														setDataForm(prev => ({
															...prev,
															proxy: {
																...(prev.proxy || {}),
																enabled: prev.proxy?.enabled ?? false,
																fallbackToMock: e.target.value === "true",
															},
														}))
													}
													className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
												>
													<option value="false">Nonaktif</option>
													<option value="true">Aktif</option>
												</select>
											</div>
										</div>
									</div>
								)}
							</div>
						)}

						<div>
							<Label>Nama Koleksi</Label>
							<input
								type="text"
								value={dataForm.storeName || ""}
								onChange={e => handlePerubahan("storeName", e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
								placeholder="contoh: users (kosongkan untuk statis)"
							/>
						</div>
					</div>

					{/* Kartu Konfigurasi Response */}
					<div
						className="bg-white rounded-2xl border border-slate-200 shadow-sm space-y-6"
						style={{ padding: "var(--space-3)" }}
					>
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Gauge className="w-4 h-4 text-brand-500" /> Perilaku Response
						</h3>

						<div>
							<div className="flex justify-between items-center mb-4">
								<Label className="mb-0">Latensi Simulasi</Label>
								<span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
									{dataForm.delay}ms
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="5000"
								step="50"
								value={dataForm.delay}
								onChange={e => handlePerubahan("delay", parseInt(e.target.value))}
								className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 hover:accent-brand-500"
							/>
							{/* Preset latensi */}
							<div className="flex flex-wrap gap-1.5 mt-3">
								{PRESET_LATENSI.map(ms => (
									<button
										key={ms}
										type="button"
										onClick={() => handlePerubahan("delay", ms)}
										className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
									>
										{ms === 0 ? "Tidak ada" : `${ms}ms`}
									</button>
								))}
							</div>
						</div>

						{/* Konfigurasi Header Kustom */}
						<div className="pt-2">
							<div className="flex items-center justify-between mb-3">
								<Label className="mb-0">Header Kustom</Label>
								<button
									type="button"
									onClick={tambahHeader}
									className="text-[10px] font-bold uppercase tracking-wide flex items-center text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded border border-brand-100 transition-colors"
								>
									<Plus className="w-3 h-3 mr-1" /> Tambah Header
								</button>
							</div>

							<div className="space-y-2">
								{(dataForm.headers || []).map((header, index) => (
									<div key={index} className="flex items-center space-x-2 group">
										<div className="grid grid-cols-2 gap-2 flex-1">
											<input
												type="text"
												placeholder="Header"
												value={header.key}
												onChange={e => updateHeader(index, "key", e.target.value)}
												className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400"
											/>
											<input
												type="text"
												placeholder="Nilai"
												value={header.value}
												onChange={e => updateHeader(index, "value", e.target.value)}
												className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400"
											/>
										</div>
										<button
											type="button"
											onClick={() => hapusHeader(index)}
											className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
											style={{ padding: "var(--space-1)" }}
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
								{(dataForm.headers || []).length === 0 && (
									<div className="text-xs text-slate-400 py-4 text-center bg-slate-50/50 rounded-lg border border-slate-100 border-dashed">
										Tidak ada header kustom yang didefinisikan
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Kolom Kanan: Editor JSON */}
				<div className="lg:col-span-8 flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
					{/* Toolbar Editor */}
					<div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
						<div className="flex items-center space-x-4">
							<h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
								<Database className="w-4 h-4 text-brand-500" /> Skema Response
							</h3>

							<div
								className="bg-slate-100 rounded-lg flex items-center border border-slate-200"
								style={{ padding: "var(--space-1)" }}
							>
								<button
									type="button"
									onClick={() => handleGantiMode("visual")}
									className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
										modeEditor === "visual"
											? "bg-white text-brand-600 shadow-sm"
											: "text-slate-500 hover:text-slate-700"
									}`}
								>
									<Table2 className="w-3 h-3" />
									<span>Visual</span>
								</button>
								<button
									type="button"
									onClick={() => handleGantiMode("code")}
									className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
										modeEditor === "code"
											? "bg-white text-brand-600 shadow-sm"
											: "text-slate-500 hover:text-slate-700"
									}`}
								>
									<Code2 className="w-3 h-3" />
									<span>JSON</span>
								</button>
							</div>
						</div>

						<div className="flex items-center space-x-3">
							<button
								type="button"
								onClick={handleGenerateAI}
								disabled={sedangGenerate}
								className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
							>
								<Wand2 className={`w-3.5 h-3.5 ${sedangGenerate ? "animate-spin" : ""}`} />
								<span>{sedangGenerate ? "Mengenerate..." : "AI Generate"}</span>
							</button>
						</div>
					</div>

					<div className="relative flex-1 bg-white flex overflow-hidden">
						{modeEditor === "visual" ? (
							<div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
								<div
									className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar"
									style={{ padding: "var(--space-2)" }}
								>
									{fieldVisual.length > 0 && (
										<div className="grid grid-cols-12 gap-3 px-10 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
											<div className="col-span-4">Nama Field</div>
											<div className="col-span-3">Tipe</div>
											<div className="col-span-5">Nilai / Struktur</div>
										</div>
									)}

									{fieldVisual.length === 0 && (
										<div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
											<Table2 className="w-10 h-10 mb-3 text-slate-300" />
											<p className="text-sm font-medium text-slate-600">
												Belum ada field yang didefinisikan
											</p>
											<button
												type="button"
												onClick={() => handleTambahField()}
												className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg text-xs font-bold transition-colors"
											>
												+ Tambah Field Pertama
											</button>
										</div>
									)}

									{fieldVisual.map(field => (
										<FieldRow key={field.id} field={field} ctx={konteksField} />
									))}
								</div>

								<div
									className="border-t border-slate-200 bg-white"
									style={{ padding: "var(--space-2)" }}
								>
									<button
										type="button"
										onClick={() => handleTambahField()}
										className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 text-slate-500 hover:text-brand-600 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
									>
										<div
											className="bg-slate-100 group-hover:bg-brand-100 rounded-full transition-colors"
											style={{ padding: "calc(var(--space-1) / 2)" }}
										>
											<Plus className="w-4 h-4" />
										</div>
										<span>Tambah Field Root Baru</span>
									</button>
								</div>
							</div>
						) : (
							<div className="flex-1 w-full h-full flex flex-col bg-[#1e1e2e] relative group">
								<div className="flex-1 flex relative overflow-hidden">
									<div
										ref={lineNumbersRef}
										className="bg-[#1e1e2e] border-r border-slate-700/50 text-slate-600 text-xs font-mono pt-5 text-right pr-4 pl-2 select-none flex-shrink-0 leading-relaxed min-w-[3.5rem] overflow-hidden z-10"
										style={{ lineHeight: "1.6" }}
									>
										{dataForm.responseBody.split("\n").map((_, i) => (
											<div
												key={i}
												className={`transition-colors cursor-default ${
													i + 1 === barisError
														? "text-red-500 font-bold bg-red-500/10"
														: "hover:text-slate-400"
												}`}
												style={{ fontSize: `${ukuranFont}px` }}
											>
												{i + 1}
											</div>
										))}
									</div>

									<div className="flex-1 relative w-full h-full overflow-hidden">
										<div
											className="absolute inset-0 overflow-auto"
											style={{ scrollbarWidth: "none" }}
										>
											<JsonHighlightOverlay code={dataForm.responseBody} fontSize={ukuranFont} />
										</div>

										<textarea
											ref={textareaRef}
											onScroll={handleScroll}
											onKeyDown={handleKeyDown}
											value={dataForm.responseBody}
											onChange={e => handlePerubahan("responseBody", e.target.value)}
											className="absolute inset-0 w-full h-full font-mono text-transparent bg-transparent resize-none outline-none focus:ring-0 leading-relaxed selection:bg-brand-500/30 caret-white z-10"
											style={{
												fontSize: `${ukuranFont}px`,
												lineHeight: "1.6",
												padding: "var(--space-3)",
												paddingLeft: "var(--space-2)",
											}}
											spellCheck={false}
										/>
									</div>
								</div>
							</div>
						)}
					</div>

					<div
						className={`text-xs flex items-center border-t justify-between font-medium token-footer-padding ${
							errorJson
								? "bg-red-50 text-red-600 border-red-200"
								: "bg-slate-50 text-slate-500 border-slate-200"
						}`}
					>
						<span className="flex items-center">
							{errorJson ? (
								<>
									<AlertCircle className="w-4 h-4 mr-2" />
									Error Sintaks: {errorJson}
								</>
							) : errorKonflik ? (
								<>
									<AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
									<span className="text-red-500">Terdeteksi Konflik Rute</span>
								</>
							) : (
								<>
									<CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
									Skema Tervalidasi
								</>
							)}
						</span>
						<span className="font-mono text-slate-400 flex items-center gap-3 opacity-70">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={formatJSON}
									className="text-xs px-2 py-1 rounded bg-white border border-slate-200"
								>
									Format
								</button>
								<button
									type="button"
									onClick={minifyJSON}
									className="text-xs px-2 py-1 rounded bg-white border border-slate-200"
								>
									Minify
								</button>
							</div>
							<FileJson className="w-3.5 h-3.5" />{" "}
							{modeEditor === "visual" ? "JSON yang Digenerate" : "JSON Mentah"}
						</span>
					</div>
				</div>
			</form>

			{/* Modal Konfirmasi Penghapusan Field */}
			{fieldUntukDihapus && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
					style={{ padding: "var(--space-2)" }}
				>
					<div
						className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-200"
						style={{ padding: "var(--space-3)" }}
						onClick={e => e.stopPropagation()}
					>
						<div className="flex flex-col items-center text-center">
							<div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
								<AlertTriangle className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Field?</h3>
							<p className="text-sm text-slate-600 mb-6">
								Field ini berisi{" "}
								<strong className="text-slate-800">
									{fieldUntukDihapus.jumlahAnak} item bertingkat
								</strong>
								. Menghapusnya akan menghapus semua field anak secara permanen.
							</p>

							<div className="grid grid-cols-2 gap-3 w-full">
								<button
									type="button"
									onClick={() => setFieldUntukDihapus(null)}
									className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => jalankanHapusField(fieldUntukDihapus.id)}
									className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
								>
									Hapus
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
