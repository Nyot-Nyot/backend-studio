import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Code2,
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

interface MockEditorProps {
	initialData?: MockEndpoint | null;
	existingMocks?: MockEndpoint[]; // List of other mocks to check conflicts against
	onSave: (mock: MockEndpoint) => void;
	onDelete: (id: string) => void;
	onCancel: () => void;
	addToast: (message: string, type: ToastType) => void;
}

const DEFAULT_MOCK: MockEndpoint = {
	id: "",
	projectId: "",
	name: "New Route",
	path: "/api/v1/resource",
	method: HttpMethod.GET,
	statusCode: 200,
	delay: 0,
	responseBody: '{\n  "id": "{{$uuid}}",\n  "name": "{{$randomName}}",\n  "createdAt": "{{$isoDate}}"\n}',
	isActive: true,
	version: "1.0",
	createdAt: Date.now(),
	requestCount: 0,
	headers: [],
	storeName: "",
	authConfig: { type: "NONE" },
	proxy: { enabled: false, target: "", timeout: 5000, fallbackToMock: false },
};

const Label = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
	<label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${className || ""}`}>
		{children}
	</label>
);

// Types for the Visual Editor
interface SchemaField {
	id: string;
	key: string;
	value: string;
	type: "string" | "number" | "boolean" | "object" | "array" | "null";
	children?: SchemaField[]; // Recursive children for objects
	isCollapsed?: boolean; // UI state for collapsing objects
}

interface FieldRowContextProps {
	dragSourceId: string | null;
	dragTargetId: string | null;
	activeGeneratorDropdown: string | null;
	onDragStart: (e: React.DragEvent, id: string) => void;
	onDragEnter: (e: React.DragEvent, id: string) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragEnd: (e: React.DragEvent) => void;
	onUpdateField: (id: string, updates: Partial<SchemaField>) => void;
	onAddField: (parentId: string | null) => void;
	onRemoveFieldRequest: (id: string) => void; // Renamed to request
	onSetActiveGeneratorDropdown: (id: string | null) => void;
	onInsertVariable: (variable: string) => void;
	onToggleCollapse: (id: string) => void;
}

const FieldRow: React.FC<{
	field: SchemaField;
	depth?: number;
	ctx: FieldRowContextProps;
}> = ({ field, depth = 0, ctx }) => {
	const isDragging = ctx.dragSourceId === field.id;
	const isTarget = ctx.dragTargetId === field.id;
	const hasChildren = field.type === "object" && field.children && field.children.length > 0;

	return (
		<div
			className={`relative transition-all duration-300 ease-out transform ${
				isDragging ? "opacity-40 scale-[0.98] z-0" : "opacity-100 scale-100 z-10"
			}`}
			draggable
			onDragStart={e => ctx.onDragStart(e, field.id)}
			onDragEnter={e => ctx.onDragEnter(e, field.id)}
			onDragOver={ctx.onDragOver}
			onDragEnd={ctx.onDragEnd}
		>
			<div
				className={`
                group flex items-center gap-3 bg-white p-2 pr-3 rounded-lg border mb-2 transition-all duration-200
                ${
					isTarget
						? "border-brand-500 ring-1 ring-brand-500 bg-brand-50/30 translate-x-2 shadow-md"
						: "border-slate-200 hover:border-brand-300 hover:shadow-sm"
				}
            `}
			>
				{/* Drag Handle */}
				<div
					className={`
                    p-1 flex-shrink-0 cursor-grab active:cursor-grabbing transition-colors
                    ${isTarget ? "text-brand-400" : "text-slate-300 group-hover:text-slate-500"}
                `}
				>
					<GripVertical className="w-5 h-5" />
				</div>

				{/* Collapse Toggle for Objects */}
				{field.type === "object" ? (
					<button
						type="button"
						onClick={() => ctx.onToggleCollapse(field.id)}
						className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors -ml-1"
					>
						{field.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
					</button>
				) : (
					<div className="w-6 -ml-1" /> // Spacer
				)}

				<div className="flex-1 grid grid-cols-12 gap-3 items-center">
					{/* Key Input */}
					<div className="col-span-4 flex items-center">
						<input
							type="text"
							placeholder="key_name"
							value={field.key}
							onChange={e => ctx.onUpdateField(field.id, { key: e.target.value })}
							className={`w-full text-sm font-semibold text-slate-700 bg-slate-50 focus:bg-white border border-transparent focus:border-brand-500 rounded-md py-1.5 px-2.5 outline-none transition-colors ${
								field.key === "" ? "border-red-200 bg-red-50" : ""
							}`}
						/>
					</div>

					{/* Type Selector */}
					<div className="col-span-3">
						<div className="relative">
							<select
								value={field.type}
								onChange={e => ctx.onUpdateField(field.id, { type: e.target.value as any })}
								className="w-full appearance-none text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md py-2 px-2.5 pl-8 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none cursor-pointer"
							>
								<option value="string">String</option>
								<option value="number">Number</option>
								<option value="boolean">Boolean</option>
								<option value="object">Object</option>
								<option value="array">Array (Simple)</option>
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

					{/* Value Input or Add Property Button */}
					<div className="col-span-5 relative">
						{field.type === "object" ? (
							<button
								type="button"
								onClick={() => ctx.onAddField(field.id)}
								className="flex items-center space-x-2 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md border border-brand-200 transition-colors w-full justify-center"
							>
								<Plus className="w-3.5 h-3.5" />
								<span>Add Property</span>
							</button>
						) : field.type === "boolean" ? (
							<div className="flex items-center h-9">
								<button
									type="button"
									onClick={() =>
										ctx.onUpdateField(field.id, {
											value: field.value === "true" ? "false" : "true",
										})
									}
									className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border text-xs font-bold transition-all ${
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
							<div className="text-xs text-slate-400 italic py-2 px-2 bg-slate-50 rounded border border-slate-100">
								null
							</div>
						) : (
							<div className="relative flex items-center">
								<input
									type={field.type === "number" ? "number" : "text"}
									placeholder={field.type === "array" ? '["item1", "item2"]' : "Value"}
									value={field.value}
									onChange={e => ctx.onUpdateField(field.id, { value: e.target.value })}
									disabled={field.type === "array"} // Arrays handled as strings in basic input for now
									className={`w-full text-sm text-slate-600 bg-white border border-slate-200 rounded-md py-1.5 px-2.5 pr-8 font-mono focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors ${
										field.value.includes("{{") ? "text-brand-600 font-bold" : ""
									} ${field.type === "array" ? "bg-slate-100 text-slate-500" : ""}`}
								/>
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
												ctx.activeGeneratorDropdown === field.id ? null : field.id
											)
										}
										className={`absolute right-1.5 p-1 rounded hover:bg-slate-100 transition-colors ${
											field.value.includes("{{") ? "text-brand-500" : "text-slate-400"
										}`}
										title="Insert Generator"
									>
										<Sparkles className="w-3.5 h-3.5" />
									</button>
								)}

								{/* Generator Dropdown */}
								{ctx.activeGeneratorDropdown === field.id && (
									<div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
										<div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
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
										<div className="max-h-48 overflow-y-auto p-1">
											{MOCK_VARIABLES_HELP.map(v => (
												<button
													type="button"
													key={v.label}
													onClick={() => ctx.onInsertVariable(v.label)}
													className="w-full text-left px-3 py-2 hover:bg-brand-50 rounded-md flex flex-col group/item"
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
					className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
					title="Delete Field"
				>
					<Trash2 className="w-4 h-4" />
				</button>
			</div>

			{/* Render Children if Object */}
			{field.type === "object" && hasChildren && !field.isCollapsed && (
				<div className="pl-6 ml-5 border-l-2 border-slate-100 relative">
					{/* Connector visual fix */}
					<div className="absolute -top-3 left-0 w-4 h-4 border-l-2 border-b-2 border-slate-100 rounded-bl-lg -z-10" />

					{field.children?.map(child => (
						<FieldRow key={child.id} field={child} depth={depth + 1} ctx={ctx} />
					))}
				</div>
			)}
			{field.type === "object" && !field.isCollapsed && (!field.children || field.children.length === 0) && (
				<div className="pl-12 pb-2 text-[10px] text-slate-400 italic">Empty object</div>
			)}
			{field.type === "object" && field.isCollapsed && (
				<div className="pl-12 pb-2 text-[10px] text-slate-400 italic flex items-center gap-2">
					<span className="w-1 h-1 rounded-full bg-slate-300"></span>
					<span>{field.children?.length || 0} hidden properties</span>
				</div>
			)}
		</div>
	);
};

// ... (Rest of imports and helpers same as original) ...

const JsonHighlightOverlay = ({ code, fontSize }: { code: string; fontSize: number }) => {
	const tokens = code.split(/(".*?"|:|\d+|true|false|null)/g);
	return (
		<pre
			className="absolute inset-0 pointer-events-none p-5 pl-4 font-mono leading-relaxed whitespace-pre-wrap break-all"
			style={{ fontSize: `${fontSize}px`, lineHeight: "1.6" }}
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

// Strict JSON Validation Helper
const validateJsonStructure = (jsonString: string): string | null => {
	try {
		const parsed = JSON.parse(jsonString);
		if (parsed === null) return "Root cannot be null for Visual Editor";
		if (typeof parsed !== "object") {
			return "Root element must be an Object {} or Array [] for Visual Editing";
		}
		return null;
	} catch (e) {
		return (e as Error).message;
	}
};

export const MockEditor: React.FC<MockEditorProps> = ({
	initialData,
	existingMocks = [],
	onSave,
	onDelete,
	onCancel,
	addToast,
}) => {
	const [formData, setFormData] = useState<MockEndpoint>(DEFAULT_MOCK);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [conflictError, setConflictError] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	// Editor State
	const [editorMode, setEditorMode] = useState<"code" | "visual">("visual");
	const [visualFields, setVisualFields] = useState<SchemaField[]>([]);
	const [isRootArray, setIsRootArray] = useState(false); // NEW: Track if root is array
	const [showVariables, setShowVariables] = useState(false);
	const [activeGeneratorDropdown, setActiveGeneratorDropdown] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [fontSize, setFontSize] = useState(14);
	const [showSearch, setShowSearch] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [matchCount, setMatchCount] = useState({ current: 0, total: 0 });
	const [fieldToDelete, setFieldToDelete] = useState<{
		id: string;
		type: string;
		childrenCount: number;
	} | null>(null);

	// Drag and Drop State
	const [dragSourceId, setDragSourceId] = useState<string | null>(null);
	const [dragTargetId, setDragTargetId] = useState<string | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumbersRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const STATUS_PRESETS = [200, 201, 204, 400, 401, 404, 500];
	const LATENCY_PRESETS = [0, 150, 500, 1000, 2500];

	const generateId = () => crypto.randomUUID();

	// Recursively parse JSON to Schema
	const parseJsonToSchema = (data: any): SchemaField[] => {
		if (typeof data !== "object" || data === null) return [];

		return Object.entries(data).map(([key, value]) => {
			const field: SchemaField = {
				id: generateId(),
				key,
				value: "",
				type: "string",
				children: [],
				isCollapsed: false,
			};

			if (value === null) {
				field.type = "null";
				field.value = "null";
			} else if (Array.isArray(value)) {
				field.type = "array";
				field.value = JSON.stringify(value);
			} else if (typeof value === "object") {
				field.type = "object";
				field.children = parseJsonToSchema(value);
			} else if (typeof value === "number") {
				field.type = "number";
				field.value = String(value);
			} else if (typeof value === "boolean") {
				field.type = "boolean";
				field.value = String(value);
			} else {
				field.type = "string";
				field.value = String(value);
			}
			return field;
		});
	};

	const convertSchemaToJson = (fields: SchemaField[]): any => {
		const obj: any = {};
		fields.forEach(field => {
			if (!field.key) return;

			if (field.type === "object") {
				obj[field.key] = convertSchemaToJson(field.children || []);
			} else if (field.type === "number") {
				obj[field.key] = Number(field.value) || 0;
			} else if (field.type === "boolean") {
				obj[field.key] = field.value === "true";
			} else if (field.type === "array") {
				try {
					obj[field.key] = JSON.parse(field.value);
				} catch {
					obj[field.key] = [];
				}
			} else if (field.type === "null") {
				obj[field.key] = null;
			} else {
				obj[field.key] = field.value;
			}
		});
		return obj;
	};

	// --- Effects ---

	useEffect(() => {
		if (initialData) {
			setFormData({
				...initialData,
				headers: initialData.headers ? initialData.headers.map(h => ({ ...h })) : [],
				authConfig: initialData.authConfig || { type: "NONE" },
				proxy: initialData.proxy || { enabled: false, target: "", timeout: 5000, fallbackToMock: false },
			});
			// Strict check for initial load
			const structureError = validateJsonStructure(initialData.responseBody);
			if (!structureError) {
				try {
					const parsed = JSON.parse(initialData.responseBody);
					setVisualFields(parseJsonToSchema(parsed));
					setIsRootArray(Array.isArray(parsed));
				} catch (e) {
					setEditorMode("code");
				}
			} else {
				setEditorMode("code");
			}
		} else {
			setFormData({
				...DEFAULT_MOCK,
				id: crypto.randomUUID(),
				createdAt: Date.now(),
			});
			setIsRootArray(false);
			setVisualFields([
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

	// Conflict Detection Effect
	useEffect(() => {
		if (formData.path && formData.method) {
			const isConflict = (existingMocks || []).some(
				m =>
					m.id !== formData.id && // Don't match self
					m.method === formData.method &&
					patternsConflict(m.path, formData.path)
			);

			if (isConflict) {
				setConflictError(`Route conflict: ${formData.method} ${formData.path} already exists.`);
			} else {
				setConflictError(null);
			}
		}
	}, [formData.method, formData.path, formData.id, existingMocks]);

	// Sync Visual -> JSON
	useEffect(() => {
		if (editorMode === "visual") {
			const jsonObj = convertSchemaToJson(visualFields);
			// If root was array, convert object back to array values (ignores specific keys)
			const finalJson = isRootArray ? Object.values(jsonObj) : jsonObj;
			setFormData(prev => ({
				...prev,
				responseBody: JSON.stringify(finalJson, null, 2),
			}));
			setJsonError(null);
		}
	}, [visualFields, editorMode, isRootArray]);

	useEffect(() => {
		if (showSearch && searchInputRef.current) searchInputRef.current.focus();
		if (!showSearch) {
			setSearchTerm("");
			setMatchCount({ current: 0, total: 0 });
		}
	}, [showSearch]);

	const handleChange = (field: keyof MockEndpoint, value: any) => {
		if (field === "path") {
			value = value.toString().replace(/\s+/g, "");
		}
		setFormData(prev => ({ ...prev, [field]: value }));

		// Strict Structure Validation on Change
		if (field === "responseBody") {
			const structureError = validateJsonStructure(value);
			setJsonError(structureError);
		}
	};

	const handleModeSwitch = (mode: "code" | "visual") => {
		if (mode === "visual") {
			// Strict Validation before switching
			const structureError = validateJsonStructure(formData.responseBody);
			if (structureError) {
				addToast(structureError, "error");
				return;
			}

			try {
				const parsed = JSON.parse(formData.responseBody);
				setVisualFields(parseJsonToSchema(parsed));
				setIsRootArray(Array.isArray(parsed));
				setEditorMode("visual");
			} catch {
				addToast("Unexpected error parsing JSON", "error");
			}
		} else {
			setEditorMode("code");
		}
	};

	// --- Handlers (Drag & Drop Fixed) ---

	const handleDragStart = (e: React.DragEvent, id: string) => {
		e.stopPropagation();
		setDragSourceId(id);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnter = (e: React.DragEvent, id: string) => {
		e.stopPropagation();
		if (dragSourceId && dragSourceId !== id) {
			setDragTargetId(id);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDragEnd = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (dragSourceId && dragTargetId && dragSourceId !== dragTargetId) {
			setVisualFields(prevFields => {
				const newFields = JSON.parse(JSON.stringify(prevFields));
				let sourceNode: SchemaField | null = null;
				const removeNode = (list: SchemaField[]): boolean => {
					const idx = list.findIndex(f => f.id === dragSourceId);
					if (idx !== -1) {
						sourceNode = list[idx];
						list.splice(idx, 1);
						return true;
					}
					for (const item of list) {
						if (item.children && removeNode(item.children)) return true;
					}
					return false;
				};
				if (!removeNode(newFields) || !sourceNode) return prevFields;
				const insertNode = (list: SchemaField[]): boolean => {
					const idx = list.findIndex(f => f.id === dragTargetId);
					if (idx !== -1) {
						list.splice(idx + 1, 0, sourceNode!);
						return true;
					}
					for (const item of list) {
						if (item.children && insertNode(item.children)) return true;
					}
					return false;
				};
				insertNode(newFields);
				return newFields;
			});
		}
		setDragSourceId(null);
		setDragTargetId(null);
	};

	// --- Field Manipulation ---

	const updateField = (id: string, updates: Partial<SchemaField>) => {
		const updateRecursive = (list: SchemaField[]): SchemaField[] => {
			return list.map(field => {
				if (field.id === id) {
					const updatedField = { ...field, ...updates };
					if (updates.type === "object" && field.type !== "object" && !field.children) {
						updatedField.children = [];
					}
					if (updates.type === "array" && field.type !== "array") {
						updatedField.value = "[]";
					}
					return updatedField;
				}
				if (field.children) return { ...field, children: updateRecursive(field.children) };
				return field;
			});
		};
		setVisualFields(prev => updateRecursive(prev));
	};

	const handleAddField = (parentId: string | null = null) => {
		// If root array, auto key to next index
		const nextKey = parentId === null && isRootArray ? String(visualFields.length) : "new_field";

		const newField: SchemaField = {
			id: generateId(),
			key: nextKey,
			value: "",
			type: "string",
			isCollapsed: false,
			children: [],
		};

		if (parentId === null) {
			setVisualFields(prev => [...prev, newField]);
		} else {
			const addRecursive = (list: SchemaField[]): SchemaField[] => {
				return list.map(field => {
					if (field.id === parentId) {
						return {
							...field,
							children: [...(field.children || []), newField],
							isCollapsed: false,
						};
					}
					if (field.children) {
						return { ...field, children: addRecursive(field.children) };
					}
					return field;
				});
			};
			setVisualFields(prev => addRecursive(prev));
		}
	};

	const findFieldRecursive = (list: SchemaField[], id: string): SchemaField | null => {
		for (const field of list) {
			if (field.id === id) return field;
			if (field.children) {
				const found = findFieldRecursive(field.children, id);
				if (found) return found;
			}
		}
		return null;
	};

	const handleRemoveFieldRequest = (id: string) => {
		const field = findFieldRecursive(visualFields, id);
		if (!field) return;
		if (field.type === "object" && field.children && field.children.length > 0) {
			setFieldToDelete({
				id: field.id,
				type: "object",
				childrenCount: field.children.length,
			});
		} else {
			executeRemoveField(id);
		}
	};

	const executeRemoveField = (id: string) => {
		const removeRecursive = (list: SchemaField[]): SchemaField[] => {
			return list
				.filter(f => f.id !== id)
				.map(field => {
					if (field.children) return { ...field, children: removeRecursive(field.children) };
					return field;
				});
		};
		setVisualFields(prev => removeRecursive(prev));
		setFieldToDelete(null);
	};

	const handleToggleCollapse = (id: string) => {
		const toggleRecursive = (list: SchemaField[]): SchemaField[] => {
			return list.map(f => {
				if (f.id === id) return { ...f, isCollapsed: !f.isCollapsed };
				if (f.children) return { ...f, children: toggleRecursive(f.children) };
				return f;
			});
		};
		setVisualFields(prev => toggleRecursive(prev));
	};

	const insertVariable = (variable: string) => {
		if (activeGeneratorDropdown) {
			updateField(activeGeneratorDropdown, { value: variable });
			setActiveGeneratorDropdown(null);
		} else if (editorMode === "code" && textareaRef.current) {
			const textarea = textareaRef.current;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = formData.responseBody;
			const newText = text.substring(0, start) + variable + text.substring(end);
			handleChange("responseBody", newText);
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + variable.length, start + variable.length);
			}, 0);
		}
	};

	const addHeader = () => {
		setFormData(prev => ({
			...prev,
			headers: [...(prev.headers || []), { key: "", value: "" }],
		}));
	};

	const updateHeader = (index: number, key: "key" | "value", value: string) => {
		setFormData(prev => {
			const h = [...(prev.headers || [])];
			h[index] = { ...h[index], [key]: value };
			return { ...prev, headers: h };
		});
	};

	const removeHeader = (index: number) => {
		setFormData(prev => ({
			...prev,
			headers: (prev.headers || []).filter((_, i) => i !== index),
		}));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (jsonError) {
			addToast("Please fix JSON errors first", "error");
			return;
		}
		if (conflictError) {
			addToast("Cannot save: Route conflict detected", "error");
			return;
		}
		onSave(formData);
	};

	const handleAiGenerate = async () => {
		if (!formData.name && !formData.path) {
			addToast("Context needed: Please fill Name or Path", "error");
			return;
		}
		setIsGenerating(true);
		try {
			const context = `Name: ${formData.name}, Method: ${formData.method}, Path: ${formData.path}`;
			if (!FEATURES.GEMINI()) {
				addToast("AI features are disabled. Enable via Settings or feature flags.", "info");
				setIsGenerating(false);
				return;
			}
			const { generateMockData } = await import("../services/geminiService");
			const json = await generateMockData(formData.path, context);
			handleChange("responseBody", json);

			if (editorMode === "visual") {
				try {
					const parsed = JSON.parse(json);
					// Strict check also for AI generation
					if (typeof parsed === "object" && parsed !== null) {
						setVisualFields(parseJsonToSchema(parsed));
						setIsRootArray(Array.isArray(parsed));
					}
				} catch {}
			}
			addToast("Generated response body", "success");
		} catch (e) {
			if ((e as Error).message.includes("MISSING_API_KEY")) {
				addToast("Gemini API Key missing. Configure in Settings.", "error");
			} else {
				addToast("Failed to generate", "error");
			}
		} finally {
			setIsGenerating(false);
		}
	};

	const formatJSON = () => {
		try {
			const parsed = JSON.parse(formData.responseBody);
			handleChange("responseBody", JSON.stringify(parsed, null, 2));
			addToast("JSON formatted", "success");
		} catch {
			addToast("Invalid JSON cannot be formatted", "error");
		}
	};

	const minifyJSON = () => {
		try {
			const parsed = JSON.parse(formData.responseBody);
			handleChange("responseBody", JSON.stringify(parsed));
			addToast("JSON minified", "info");
		} catch {
			addToast("Invalid JSON cannot be minified", "error");
		}
	};

	const copyToClipboard = () => {
		navigator.clipboard.writeText(formData.responseBody);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
		addToast("JSON copied to clipboard", "info");
	};

	const findNext = (direction: "next" | "prev" = "next") => {
		if (!searchTerm || !textareaRef.current) return;
		const text = formData.responseBody.toLowerCase();
		const term = searchTerm.toLowerCase();
		const currentPos = textareaRef.current.selectionStart;
		let nextPos = -1;

		if (direction === "next") {
			nextPos = text.indexOf(term, currentPos + 1);
			if (nextPos === -1) nextPos = text.indexOf(term, 0);
		} else {
			nextPos = text.lastIndexOf(term, currentPos - 1);
			if (nextPos === -1) nextPos = text.lastIndexOf(term);
		}

		if (nextPos !== -1) {
			textareaRef.current.focus();
			textareaRef.current.setSelectionRange(nextPos, nextPos + term.length);
			const matches = text.split(term).length - 1;
			const precedingMatches = text.substring(0, nextPos).split(term).length;
			setMatchCount({ current: precedingMatches, total: matches });
		} else {
			setMatchCount({ current: 0, total: 0 });
		}
	};

	const handleScroll = () => {
		if (textareaRef.current && lineNumbersRef.current) {
			lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// ... (Keep existing key handler logic) ...
		if ((e.metaKey || e.ctrlKey) && e.key === "f") {
			e.preventDefault();
			setShowSearch(true);
			return;
		}
		if (e.key === "Tab") {
			e.preventDefault();
			const textarea = e.currentTarget;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const value = textarea.value;
			const newValue = value.substring(0, start) + "  " + value.substring(end);
			handleChange("responseBody", newValue);
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
			handleChange("responseBody", newValue);
			requestAnimationFrame(() => {
				if (textareaRef.current)
					textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1 + indent.length;
			});
			return;
		}
	};

	const getErrorLine = (): number | null => {
		if (!jsonError) return null;
		const match = jsonError.match(/at position (\d+)/);
		if (match && match[1]) {
			const pos = parseInt(match[1]);
			const textUpToError = formData.responseBody.substring(0, pos);
			return textUpToError.split("\n").length;
		}
		return null;
	};

	const errorLine = getErrorLine();

	const fieldCtx: FieldRowContextProps = {
		dragSourceId,
		dragTargetId,
		activeGeneratorDropdown,
		onDragStart: handleDragStart,
		onDragEnter: handleDragEnter,
		onDragOver: handleDragOver,
		onDragEnd: handleDragEnd,
		onUpdateField: updateField,
		onAddField: handleAddField,
		onRemoveFieldRequest: handleRemoveFieldRequest,
		onSetActiveGeneratorDropdown: setActiveGeneratorDropdown,
		onInsertVariable: insertVariable,
		onToggleCollapse: handleToggleCollapse,
	};

	return (
		<div className="max-w-7xl mx-auto p-6 md:p-8 animate-enter h-full flex flex-col relative">
			<div className="flex items-center justify-between mb-6 flex-shrink-0">
				<div className="flex items-center space-x-4">
					<button
						type="button"
						onClick={onCancel}
						className="p-2.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl transition-all group"
					>
						<ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-800" />
					</button>
					<div>
						<h1 className="text-2xl font-bold text-slate-900 tracking-tight">
							{initialData ? "Edit Definition" : "Design New Route"}
						</h1>
						<p className="text-slate-500 text-sm mt-0.5">Configure endpoint behavior and data structure.</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{initialData && (
						<button
							type="button"
							onClick={() => onDelete(formData.id)}
							className="px-4 py-2.5 rounded-xl text-red-500 font-medium hover:bg-red-50 transition-colors text-sm border border-transparent hover:border-red-100 mr-2"
						>
							<Trash2 className="w-4 h-4 inline-block mr-2" />
							Delete
						</button>
					)}
					<button
						type="button"
						onClick={onCancel}
						className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-200/50 transition-colors text-sm"
					>
						Cancel
					</button>
					<button
						type="submit"
						onClick={handleSubmit}
						disabled={!!jsonError || !!conflictError}
						className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg active:scale-95 ${
							jsonError || conflictError
								? "bg-slate-400 cursor-not-allowed shadow-none"
								: "bg-brand-600 hover:bg-brand-50 shadow-brand-500/25"
						}`}
					>
						<Save className="w-4 h-4" />
						<span>Save Route</span>
					</button>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
				{/* Left Column: Config */}
				<div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
					{/* Main Info Card */}
					<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Settings className="w-4 h-4 text-brand-500" /> General Settings
						</h3>

						<div className="space-y-5">
							<div>
								<Label>HTTP Method</Label>
								<div className="grid grid-cols-3 gap-2">
									{Object.values(HttpMethod).map(m => (
										<button
											key={m}
											type="button"
											onClick={() => handleChange("method", m)}
											className={`text-xs font-bold py-2.5 rounded-lg border transition-all ${
												formData.method === m
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
								<Label>Resource Path</Label>
								<div className="relative group">
									<input
										type="text"
										value={formData.path}
										onChange={e => handleChange("path", e.target.value)}
										className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:border-transparent outline-none transition-all placeholder:text-slate-400 ${
											conflictError
												? "border-red-300 focus:ring-red-200 bg-red-50 text-red-700"
												: "border-slate-200 focus:ring-brand-500/20 focus:border-brand-500"
										}`}
										placeholder="/api/v1/resource/:id"
									/>
								</div>
								{conflictError ? (
									<div className="flex items-center text-[10px] text-red-500 mt-1.5 ml-1 font-bold animate-in fade-in slide-in-from-left-2">
										<AlertTriangle className="w-3 h-3 mr-1" />
										{conflictError}
									</div>
								) : (
									<div className="text-[10px] text-slate-400 mt-1.5 ml-1">
										Supports dynamic parameters (e.g. :id)
									</div>
								)}
							</div>

							<div>
								<Label>Internal Name</Label>
								<input
									type="text"
									value={formData.name}
									onChange={e => handleChange("name", e.target.value)}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
									placeholder="e.g. Fetch User Profile"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label>Status Code</Label>
									<input
										type="number"
										value={formData.statusCode}
										onChange={e => handleChange("statusCode", parseInt(e.target.value))}
										className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-mono font-bold outline-none focus:ring-2 transition-all ${
											formData.statusCode >= 400
												? "text-red-600 border-red-200 focus:border-red-500 focus:ring-red-500/20"
												: "text-emerald-600 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
										}`}
									/>
									<div className="flex flex-wrap gap-1.5 mt-2">
										{STATUS_PRESETS.map(code => (
											<button
												key={code}
												type="button"
												onClick={() => handleChange("statusCode", code)}
												className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
											>
												{code}
											</button>
										))}
									</div>
								</div>
								<div>
									<Label>State</Label>
									<div className="flex items-center justify-between bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 h-[46px]">
										<span className="text-xs font-semibold text-slate-600">
											{formData.isActive ? "Active" : "Disabled"}
										</span>
										<button
											type="button"
											onClick={() => handleChange("isActive", !formData.isActive)}
											className={`w-9 h-5 flex items-center rounded-full transition-colors duration-200 ease-in-out px-0.5 ${
												formData.isActive ? "bg-green-500" : "bg-slate-300"
											}`}
										>
											<div
												className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
													formData.isActive ? "translate-x-4" : "translate-x-0"
												}`}
											/>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Security & Auth Config */}
					<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Shield className="w-4 h-4 text-rose-500" /> Authentication & Security
						</h3>

						<p className="text-xs text-slate-500 leading-relaxed">
							Protect your endpoint by requiring authentication credentials. Requests without valid
							credentials will return{" "}
							<span className="font-semibold text-slate-700">401 Unauthorized</span>.
						</p>

						<div>
							<Label>Authentication Type</Label>
							<select
								value={formData.authConfig?.type || "NONE"}
								onChange={e =>
									setFormData(prev => ({
										...prev,
										authConfig: {
											...prev.authConfig,
											type: e.target.value as any,
										},
									}))
								}
								className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all cursor-pointer"
							>
								<option value="NONE">❌ No Authentication (Public)</option>
								<option value="BEARER_TOKEN">🔑 Bearer Token (Authorization Header)</option>
								<option value="API_KEY">🗝️ API Key (Custom Header)</option>
							</select>
						</div>

						{formData.authConfig?.type === "BEARER_TOKEN" && (
							<div className="space-y-4 p-4 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2">
								<div>
									<Label>Bearer Token Value</Label>
									<div className="relative">
										<Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="text"
											value={formData.authConfig?.token || ""}
											onChange={e =>
												setFormData(prev => ({
													...prev,
													authConfig: {
														...prev.authConfig!,
														token: e.target.value,
													},
												}))
											}
											className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
											placeholder="my-secret-token-12345"
										/>
									</div>
									<p className="text-[11px] text-slate-600 mt-2 ml-1 space-y-1">
										<div>
											📋 <strong>Expected Header:</strong>
										</div>
										<div className="font-mono bg-slate-900 text-emerald-400 px-3 py-2 rounded-md overflow-x-auto text-[10px] mt-1">
											{formatAuthPreview(formData.authConfig)}
										</div>
									</p>
								</div>
							</div>
						)}

						{formData.authConfig?.type === "API_KEY" && (
							<div className="space-y-4 p-4 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2">
								<div>
									<Label>Header Name</Label>
									<input
										type="text"
										value={formData.authConfig?.headerKey || "x-api-key"}
										onChange={e =>
											setFormData(prev => ({
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
										Name of the header that will contain your API key (e.g.,{" "}
										<span className="font-mono font-bold">x-api-key</span>,{" "}
										<span className="font-mono font-bold">X-API-Token</span>)
									</p>
								</div>

								<div>
									<Label>API Key Value</Label>
									<div className="relative">
										<Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="text"
											value={formData.authConfig?.token || ""}
											onChange={e =>
												setFormData(prev => ({
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
											📋 <strong>Expected Header:</strong>
										</div>
										<div className="font-mono bg-slate-900 text-emerald-400 px-3 py-2 rounded-md overflow-x-auto text-[10px] mt-1">
											{formData.authConfig?.headerKey || "x-api-key"}:{" "}
											{formData.authConfig?.token || "sk-api-1234567890abcdef"}
										</div>
									</p>
								</div>
							</div>
						)}

						{formData.authConfig?.type === "NONE" && (
							<div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
								<p className="text-xs text-slate-600 flex items-start gap-2">
									<span className="text-lg leading-none">🌐</span>
									<span>
										This endpoint is <strong>public</strong> and accessible without authentication.
									</span>
								</p>
							</div>
						)}

						{FEATURES.PROXY() && (
							<div className="bg-white p-4 rounded-lg border border-slate-200">
								<Label>Proxy / Passthrough</Label>
								<div className="flex items-center gap-3 mb-2">
									<button
										onClick={() =>
											setFormData(prev => ({
												...prev,
												proxy: { ...(prev.proxy || {}), enabled: !prev.proxy?.enabled },
											}))
										}
										className={`w-9 h-5 flex items-center rounded-full transition-colors duration-200 ease-in-out px-0.5 ${
											formData.proxy?.enabled ? "bg-emerald-500" : "bg-slate-300"
										}`}
									>
										<div
											className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
												formData.proxy?.enabled ? "translate-x-4" : "translate-x-0"
											}`}
										/>
									</button>
									<div className="text-sm text-slate-700 font-medium">Enable Proxy</div>
								</div>

								{formData.proxy?.enabled && (
									<div className="space-y-3 p-2 border border-slate-100 rounded-md bg-emerald-50">
										<div>
											<Label>Proxy Target (Base URL)</Label>
											<input
												type="text"
												value={formData.proxy?.target || ""}
												onChange={e =>
													setFormData(prev => ({
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
												Requests to this route will be forwarded to the configured target base
												URL (path preserved).
											</p>
										</div>

										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label>Timeout (ms)</Label>
												<input
													type="number"
													value={formData.proxy?.timeout ?? 5000}
													onChange={e =>
														setFormData(prev => ({
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
												<Label>Fallback to Mock</Label>
												<select
													value={String(formData.proxy?.fallbackToMock || false)}
													onChange={e =>
														setFormData(prev => ({
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
													<option value="false">Disabled</option>
													<option value="true">Enabled</option>
												</select>
											</div>
										</div>
									</div>
								)}
							</div>
						)}

						<div>
							<Label>Collection Name</Label>
							<input
								type="text"
								value={formData.storeName || ""}
								onChange={e => handleChange("storeName", e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
								placeholder="e.g. users (leave empty for static)"
							/>
						</div>
					</div>

					{/* Response Config Card */}
					<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
						<h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
							<Gauge className="w-4 h-4 text-brand-500" /> Response Behavior
						</h3>

						<div>
							<div className="flex justify-between items-center mb-4">
								<Label className="mb-0">Simulated Latency</Label>
								<span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
									{formData.delay}ms
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="5000"
								step="50"
								value={formData.delay}
								onChange={e => handleChange("delay", parseInt(e.target.value))}
								className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 hover:accent-brand-500"
							/>
							{/* Latency Presets */}
							<div className="flex flex-wrap gap-1.5 mt-3">
								{LATENCY_PRESETS.map(ms => (
									<button
										key={ms}
										type="button"
										onClick={() => handleChange("delay", ms)}
										className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
									>
										{ms === 0 ? "None" : `${ms}ms`}
									</button>
								))}
							</div>
						</div>

						{/* Headers Config */}
						<div className="pt-2">
							<div className="flex items-center justify-between mb-3">
								<Label className="mb-0">Custom Headers</Label>
								<button
									type="button"
									onClick={addHeader}
									className="text-[10px] font-bold uppercase tracking-wide flex items-center text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded border border-brand-100 transition-colors"
								>
									<Plus className="w-3 h-3 mr-1" /> Add Header
								</button>
							</div>

							<div className="space-y-2">
								{(formData.headers || []).map((header, index) => (
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
												placeholder="Value"
												value={header.value}
												onChange={e => updateHeader(index, "value", e.target.value)}
												className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400"
											/>
										</div>
										<button
											type="button"
											onClick={() => removeHeader(index)}
											className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
								{(formData.headers || []).length === 0 && (
									<div className="text-xs text-slate-400 py-4 text-center bg-slate-50/50 rounded-lg border border-slate-100 border-dashed">
										No custom headers defined
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Right Column: JSON Editor (Same as before) */}
				<div className="lg:col-span-8 flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
					{/* Editor Toolbar */}
					<div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
						<div className="flex items-center space-x-4">
							<h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
								<Database className="w-4 h-4 text-brand-500" /> Response Schema
							</h3>

							<div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
								<button
									type="button"
									onClick={() => handleModeSwitch("visual")}
									className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
										editorMode === "visual"
											? "bg-white text-brand-600 shadow-sm"
											: "text-slate-500 hover:text-slate-700"
									}`}
								>
									<Table2 className="w-3 h-3" />
									<span>Visual</span>
								</button>
								<button
									type="button"
									onClick={() => handleModeSwitch("code")}
									className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
										editorMode === "code"
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
								onClick={handleAiGenerate}
								disabled={isGenerating}
								className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
							>
								<Wand2 className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
								<span>{isGenerating ? "Generating..." : "AI Generate"}</span>
							</button>
						</div>
					</div>

					<div className="relative flex-1 bg-white flex overflow-hidden">
						{editorMode === "visual" ? (
							<div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
								<div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
									{visualFields.length > 0 && (
										<div className="grid grid-cols-12 gap-3 px-10 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
											<div className="col-span-4">Field Name</div>
											<div className="col-span-3">Type</div>
											<div className="col-span-5">Value / Structure</div>
										</div>
									)}

									{visualFields.length === 0 && (
										<div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
											<Table2 className="w-10 h-10 mb-3 text-slate-300" />
											<p className="text-sm font-medium text-slate-600">No fields defined yet</p>
											<button
												type="button"
												onClick={() => handleAddField()}
												className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg text-xs font-bold transition-colors"
											>
												+ Add First Field
											</button>
										</div>
									)}

									{visualFields.map(field => (
										<FieldRow key={field.id} field={field} ctx={fieldCtx} />
									))}
								</div>

								<div className="p-4 border-t border-slate-200 bg-white">
									<button
										type="button"
										onClick={() => handleAddField()}
										className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 text-slate-500 hover:text-brand-600 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
									>
										<div className="bg-slate-100 group-hover:bg-brand-100 rounded-full p-0.5 transition-colors">
											<Plus className="w-4 h-4" />
										</div>
										<span>Add New Root Field</span>
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
										{formData.responseBody.split("\n").map((_, i) => (
											<div
												key={i}
												className={`transition-colors cursor-default ${
													i + 1 === errorLine
														? "text-red-500 font-bold bg-red-500/10"
														: "hover:text-slate-400"
												}`}
												style={{ fontSize: `${fontSize}px` }}
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
											<JsonHighlightOverlay code={formData.responseBody} fontSize={fontSize} />
										</div>

										<textarea
											ref={textareaRef}
											onScroll={handleScroll}
											onKeyDown={handleKeyDown}
											value={formData.responseBody}
											onChange={e => handleChange("responseBody", e.target.value)}
											className="absolute inset-0 w-full h-full p-5 pl-4 font-mono text-transparent bg-transparent resize-none outline-none focus:ring-0 leading-relaxed selection:bg-brand-500/30 caret-white z-10"
											style={{ fontSize: `${fontSize}px`, lineHeight: "1.6" }}
											spellCheck={false}
										/>
									</div>
								</div>
							</div>
						)}
					</div>

					<div
						className={`px-5 py-2.5 text-xs flex items-center border-t justify-between font-medium ${
							jsonError
								? "bg-red-50 text-red-600 border-red-200"
								: "bg-slate-50 text-slate-500 border-slate-200"
						}`}
					>
						<span className="flex items-center">
							{jsonError ? (
								<>
									<AlertCircle className="w-4 h-4 mr-2" />
									Syntax Error: {jsonError}
								</>
							) : conflictError ? (
								<>
									<AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
									<span className="text-red-500">Route Conflict Detected</span>
								</>
							) : (
								<>
									<CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
									Schema Validated
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
							{editorMode === "visual" ? "Generated JSON" : "Raw JSON"}
						</span>
					</div>
				</div>
			</form>

			{fieldToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div
						className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-200"
						onClick={e => e.stopPropagation()}
					>
						<div className="flex flex-col items-center text-center">
							<div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
								<AlertTriangle className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-bold text-slate-900 mb-2">Delete Field?</h3>
							<p className="text-sm text-slate-600 mb-6">
								This field contains{" "}
								<strong className="text-slate-800">{fieldToDelete.childrenCount} nested items</strong>.
								Deleting it will permanently remove all child fields.
							</p>

							<div className="grid grid-cols-2 gap-3 w-full">
								<button
									type="button"
									onClick={() => setFieldToDelete(null)}
									className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => executeRemoveField(fieldToDelete.id)}
									className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
