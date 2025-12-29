import {
	Activity,
	Box,
	Check,
	ChevronDown,
	FlaskConical,
	FolderPlus,
	LayoutDashboard,
	PanelLeftClose,
	PanelLeftOpen,
	PenTool,
	Rocket,
	Search,
	Settings,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { FEATURES } from "../config/featureFlags";
import { Proyek, StateTampilan } from "../types";

/**
 * Interface untuk props komponen Sidebar.
 * Mendefinisikan semua callback yang diperlukan untuk interaksi pengguna.
 */
interface PropsSidebar {
	/** Tampilan yang sedang aktif dalam aplikasi */
	tampilanSaatIni: StateTampilan;
	/** Callback saat pengguna mengganti tampilan */
	padaUbahTampilan: (tampilan: StateTampilan) => void;
	/** Callback saat pengguna ingin kembali ke landing page (opsional) */
	onShowLanding?: () => void;
	/** Callback saat pengguna membuat mock endpoint baru */
	padaMockBaru: () => void;
	/** Callback saat pengguna menggunakan fitur pembuatan otomatis dengan AI */
	padaPembuatanAjaib: () => void;
	/** Daftar semua proyek/workspace yang tersedia */
	daftarProyek: Proyek[];
	/** ID proyek yang sedang aktif (dipilih pengguna) */
	idProyekAktif: string;
	/** Callback saat pengguna memilih proyek lain */
	padaPilihProyek: (id: string) => void;
	/** Callback saat pengguna membuat proyek baru */
	padaBuatProyek: (nama: string) => void;
	/** Callback saat pengguna menghapus proyek */
	padaHapusProyek: (id: string) => void;
	/** Callback untuk membuka command palette (fitur pencarian) */
	padaTriggerPaletPerintah: () => void;
	/** Callback untuk membuka modal deploy/ekspor */
	padaDeploy: () => void;
}

/**
 * Komponen Sidebar untuk navigasi utama aplikasi Backend Studio.
 * Menyediakan akses ke berbagai fitur, proyek, dan tampilan aplikasi.
 * Mendukung mode collapsed (sembunyikan teks, hanya ikon) untuk menghemat ruang.
 */
export const Sidebar: React.FC<PropsSidebar> = ({
	tampilanSaatIni,
	padaUbahTampilan,
	padaMockBaru,
	padaPembuatanAjaib,
	daftarProyek,
	idProyekAktif,
	padaPilihProyek,
	padaBuatProyek,
	padaHapusProyek,
	padaTriggerPaletPerintah,
	padaDeploy,
	onShowLanding,
}) => {
	// --- STATE LOKAL --- //

	/** State untuk mode pembuatan proyek baru (menampilkan input) */
	const [sedangMembuat, setSedangMembuat] = useState(false);

	/** State untuk nama proyek baru yang sedang diketik */
	const [namaProyekBaru, setNamaProyekBaru] = useState("");

	/** State untuk mode sidebar collapsed (hanya ikon) */
	const [sedangCollapsed, setSedangCollapsed] = useState(false);

	// --- KONFIGURASI TAMPILAN --- //

	/**
	 * Mendapatkan kelas CSS untuk item navigasi berdasarkan state aktif/tidak.
	 * Menggunakan perbedaan styling untuk mode collapsed dan normal.
	 *
	 * @param {StateTampilan} tampilan - Tampilan yang direpresentasikan oleh item ini
	 * @returns {string} Kelas CSS yang sudah diformat
	 */
	const dapatkanKelasItemNavigasi = (tampilan: StateTampilan): string => {
		const kelasDasar =
			"relative flex items-center py-3 rounded-xl transition-all duration-200 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

		const kelasUkuran = sedangCollapsed ? "justify-center px-2" : "space-x-3 px-4";
		const kelasAktif =
			tampilanSaatIni === tampilan
				? "bg-slate-800 text-white shadow-lg shadow-black/20"
				: "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200";

		return `${kelasDasar} ${kelasUkuran} ${kelasAktif}`;
	};

	/**
	 * Komponen indikator visual untuk item navigasi yang sedang aktif.
	 * Menampilkan garis vertikal berwarna di sisi kiri item.
	 *
	 * @param {StateTampilan} tampilan - Tampilan yang akan dicek apakah aktif
	 * @returns {JSX.Element | null} Komponen indikator atau null jika tidak aktif
	 */
	const indikatorAktif = (tampilan: StateTampilan): JSX.Element | null => {
		if (tampilanSaatIni !== tampilan) return null;

		const tinggi = sedangCollapsed ? "h-4" : "h-6";

		return (
			<div
				className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full shadow-[0_0_12px_rgba(14,165,233,0.6)] animate-in fade-in duration-300 ${tinggi}`}
			/>
		);
	};

	// --- LOGIKA BISNIS --- //

	/**
	 * Mengevaluasi feature flags sekali dan menyimpannya dalam memo.
	 * Mencegah evaluasi berulang pada setiap render.
	 */
	const fitur = useMemo(
		() => ({
			ai: FEATURES.AI(),
			logs: FEATURES.LOG_VIEWER(),
			exportServer: FEATURES.EXPORT_SERVER(),
		}),
		[]
	);

	/**
	 * Menangani penghapusan proyek dengan konfirmasi dari pengguna.
	 * Mencegah penghapusan tanpa konfirmasi untuk menghindari kehilangan data.
	 *
	 * @param {string} id - ID proyek yang akan dihapus
	 */
	const tanganiHapusProyek = (id: string): void => {
		if (!id) return;

		const konfirmasi = window.confirm("Hapus workspace ini? Tindakan ini tidak dapat dibatalkan.");
		if (konfirmasi) {
			padaHapusProyek(id);
		}
	};

	/**
	 * Menangani submit pembuatan proyek baru.
	 * Memvalidasi input dan membersihkan state setelah berhasil.
	 */
	const tanganiSubmitPembuatan = (): void => {
		const namaProyekBersih = namaProyekBaru.trim();

		if (namaProyekBersih) {
			padaBuatProyek(namaProyekBersih);
			setNamaProyekBaru("");
			setSedangMembuat(false);
		}
	};

	/**
	 * Menangani event keyboard pada input pembuatan proyek.
	 * Enter untuk submit, Escape untuk cancel.
	 *
	 * @param {React.KeyboardEvent} event - Event keyboard dari input
	 */
	const tanganiTekanKeyboard = (event: React.KeyboardEvent): void => {
		if (event.key === "Enter") {
			tanganiSubmitPembuatan();
		}

		if (event.key === "Escape") {
			setSedangMembuat(false);
			setNamaProyekBaru("");
		}
	};

	// --- RENDER KOMPONEN --- //

	return (
		<div
			className={`${
				sedangCollapsed ? "w-20" : "w-72"
			} bg-slate-900 h-screen flex flex-col flex-shrink-0 text-slate-300 border-r border-slate-800 shadow-2xl z-30 transition-all duration-300 ease-in-out relative`}
			role="navigation"
			aria-label="Navigasi utama aplikasi"
		>
			{/* Tombol Toggle Collapse */}
			<button
				onClick={() => setSedangCollapsed(!sedangCollapsed)}
				aria-label={sedangCollapsed ? "Perluas sidebar" : "Sembunyikan sidebar"}
				aria-expanded={!sedangCollapsed}
				className="absolute -right-3 top-8 bg-slate-800 text-slate-400 border border-slate-700 rounded-full p-1 hover:text-white hover:bg-slate-700 transition-colors shadow-sm z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
				title={sedangCollapsed ? "Tampilkan teks navigasi" : "Sembunyikan teks navigasi"}
			>
				{sedangCollapsed ? <PanelLeftOpen className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
			</button>

			{/* Header Aplikasi */}
			<div
				className={`p-6 pb-8 flex items-center ${
					sedangCollapsed ? "justify-center" : "space-x-3"
				} transition-all`}
			>
				<button
					type="button"
					onClick={() => onShowLanding?.()}
					aria-label="Kembali ke landing"
					className="flex items-center gap-3 p-1 rounded-md hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
				>
					<div className="p-2.5 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-lg shadow-brand-900/20 ring-1 ring-white/10 flex-shrink-0">
						<Box className="w-6 h-6 text-white" strokeWidth={2.5} />
					</div>

					{!sedangCollapsed && (
						<div className="animate-in fade-in slide-in-from-left-2 duration-300 overflow-hidden whitespace-nowrap text-left">
							<h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">
								Backend Studio
							</h1>
							<p className="text-[11px] text-brand-400 font-medium tracking-wide uppercase opacity-90">
								Desain & Prototipe
							</p>
						</div>
					)}
				</button>
			</div>

			{/* Selektor Proyek dan Pencarian */}
			<div className={`px-6 mb-6 ${sedangCollapsed ? "px-3 flex flex-col items-center" : ""}`}>
				{!sedangCollapsed ? (
					<>
						{/* Label dan Tombol Hapus */}
						<div className="flex items-center justify-between px-1 mb-2">
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
								Workspace
							</span>

							{daftarProyek.length > 1 && (
								<button
									onClick={() => tanganiHapusProyek(idProyekAktif)}
									aria-label="Hapus workspace saat ini"
									className="text-slate-600 hover:text-red-400 transition-colors p-1 hover:bg-slate-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
									title="Hapus workspace saat ini"
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							)}
						</div>

						{/* Dropdown Seleksi Proyek */}
						<div className="relative group mb-3">
							<select
								value={idProyekAktif}
								onChange={event => padaPilihProyek(event.target.value)}
								className="w-full appearance-none bg-slate-800 text-slate-200 border border-slate-700/50 group-hover:border-slate-600 rounded-xl py-2.5 pl-3.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all cursor-pointer shadow-sm"
								aria-label="Pilih workspace"
							>
								{daftarProyek.map(proyek => (
									<option key={proyek.id} value={proyek.id}>
										{proyek.nama}
									</option>
								))}
							</select>

							<div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300 transition-colors">
								<ChevronDown className="w-4 h-4" />
							</div>
						</div>

						{/* Tombol Pencarian (Command Palette) */}
						<button
							onClick={padaTriggerPaletPerintah}
							aria-label="Buka palet perintah"
							aria-keyshortcuts="Meta+K"
							className="w-full flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 py-2 px-3 rounded-lg text-xs transition-colors border border-slate-800 hover:border-slate-700 mb-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
							title="Cari perintah dan fitur (Ctrl+K atau Cmd+K)"
						>
							<Search className="w-3.5 h-3.5" />
							<span>Cari...</span>
							<span className="ml-auto text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 group-hover:text-slate-400 font-mono">
								⌘K
							</span>
						</button>
					</>
				) : (
					/* Badge Proyek saat Collapsed */
					<div
						className="mb-6 w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-700"
						title={daftarProyek.find(proyek => proyek.id === idProyekAktif)?.nama || "Workspace"}
					>
						{daftarProyek.find(proyek => proyek.id === idProyekAktif)?.nama?.charAt(0) ?? "?"}
					</div>
				)}

				{/* Form Pembuatan Proyek Baru */}
				{sedangMembuat && !sedangCollapsed ? (
					<div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-200">
						<input
							autoFocus
							type="text"
							placeholder="Nama Workspace"
							value={namaProyekBaru}
							onChange={event => setNamaProyekBaru(event.target.value)}
							onKeyDown={tanganiTekanKeyboard}
							className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-brand-500 outline-none mb-3 transition-colors placeholder:text-slate-600"
							aria-label="Nama workspace baru"
						/>

						<div className="flex items-center space-x-2">
							<button
								onClick={tanganiSubmitPembuatan}
								aria-label="Buat workspace"
								disabled={!namaProyekBaru.trim()}
								className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
							>
								<Check className="w-3.5 h-3.5 mr-1.5" /> Buat
							</button>

							<button
								onClick={() => setSedangMembuat(false)}
								aria-label="Batal pembuatan workspace"
								className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>
					</div>
				) : (
					!sedangCollapsed && (
						<button
							onClick={() => setSedangMembuat(true)}
							aria-label="Buat workspace baru"
							className="w-full flex items-center justify-center space-x-2 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300 py-2 px-3 rounded-lg text-xs font-medium transition-all border border-dashed border-slate-700 hover:border-slate-600 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
						>
							<FolderPlus className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
							<span>Workspace Baru</span>
						</button>
					)
				)}
			</div>

			{/* Area Navigasi Utama */}
			<div className={`px-4 space-y-8 flex-1 overflow-y-auto dark-scroll ${sedangCollapsed ? "px-2" : ""}`}>
				{/* Tombol Aksi Utama */}
				<div className="space-y-3">
					<button
						onClick={padaMockBaru}
						aria-label="Desain Route"
						title={sedangCollapsed ? "Desain Route" : ""}
						className={`w-full flex items-center ${
							sedangCollapsed ? "justify-center" : "justify-center space-x-3"
						} bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md border border-slate-700 hover:border-slate-600 group active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50`}
					>
						<PenTool className="w-4 h-4 text-brand-400 group-hover:text-brand-300" />
						{!sedangCollapsed && <span className="font-medium text-sm">Desain Route</span>}
					</button>

					{fitur.ai && (
						<button
							onClick={padaPembuatanAjaib}
							aria-label="AI Architect"
							title={sedangCollapsed ? "AI Architect" : ""}
							className={`w-full flex items-center ${
								sedangCollapsed ? "justify-center" : "justify-center space-x-3"
							} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 hover:shadow-indigo-900/40 group relative overflow-hidden active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60`}
						>
							<div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
							<Sparkles className="w-4 h-4 text-violet-200 group-hover:text-white transition-colors" />
							{!sedangCollapsed && (
								<span className="font-medium text-sm relative z-10">AI Architect</span>
							)}
						</button>
					)}
				</div>

				{/* Menu Navigasi */}
				<div className="space-y-1.5">
					{!sedangCollapsed && (
						<div className="px-2 mb-2 animate-in fade-in duration-300">
							<span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
								Menu Utama
							</span>
						</div>
					)}

					<nav className="space-y-1" aria-label="Menu navigasi utama">
						{/* Item Dashboard */}
						<div
							role="button"
							tabIndex={0}
							onClick={() => padaUbahTampilan("dashboard")}
							onKeyDown={event =>
								(event.key === "Enter" || event.key === " ") && padaUbahTampilan("dashboard")
							}
							aria-pressed={tampilanSaatIni === "dashboard"}
							aria-label="Overview"
							className={dapatkanKelasItemNavigasi("dashboard")}
							title="Overview"
						>
							{indikatorAktif("dashboard")}
							<LayoutDashboard
								className={`w-5 h-5 ${
									tampilanSaatIni === "dashboard"
										? "text-brand-400"
										: "text-slate-500 group-hover:text-slate-300"
								}`}
							/>
							{!sedangCollapsed && <span className="font-medium">Overview</span>}
						</div>

						{/* Item Test Console */}
						<div
							role="button"
							tabIndex={0}
							onClick={() => padaUbahTampilan("test")}
							onKeyDown={event =>
								(event.key === "Enter" || event.key === " ") && padaUbahTampilan("test")
							}
							aria-pressed={tampilanSaatIni === "test"}
							aria-label="Prototype Lab"
							className={dapatkanKelasItemNavigasi("test")}
							title="Prototype Lab"
						>
							{indikatorAktif("test")}
							<FlaskConical
								className={`w-5 h-5 ${
									tampilanSaatIni === "test"
										? "text-brand-400"
										: "text-slate-500 group-hover:text-slate-300"
								}`}
							/>
							{!sedangCollapsed && <span className="font-medium">Prototype Lab</span>}
						</div>

						{/* Item Logs (kondisional) */}
						{fitur.logs && (
							<div
								role="button"
								tabIndex={0}
								onClick={() => padaUbahTampilan("logs")}
								onKeyDown={event =>
									(event.key === "Enter" || event.key === " ") && padaUbahTampilan("logs")
								}
								aria-pressed={tampilanSaatIni === "logs"}
								aria-label="Traffic Monitor"
								className={dapatkanKelasItemNavigasi("logs")}
								title="Traffic Monitor"
							>
								{indikatorAktif("logs")}
								<Activity
									className={`w-5 h-5 ${
										tampilanSaatIni === "logs"
											? "text-brand-400"
											: "text-slate-500 group-hover:text-slate-300"
									}`}
								/>
								{!sedangCollapsed && <span className="font-medium">Traffic Monitor</span>}
							</div>
						)}

						{/* Item Settings */}
						<div
							role="button"
							tabIndex={0}
							onClick={() => padaUbahTampilan("settings")}
							onKeyDown={event =>
								(event.key === "Enter" || event.key === " ") && padaUbahTampilan("settings")
							}
							aria-pressed={tampilanSaatIni === "settings"}
							aria-label="Configuration"
							className={dapatkanKelasItemNavigasi("settings")}
							title="Configuration"
						>
							{indikatorAktif("settings")}
							<Settings
								className={`w-5 h-5 ${
									tampilanSaatIni === "settings"
										? "text-brand-400"
										: "text-slate-500 group-hover:text-slate-300"
								}`}
							/>
							{!sedangCollapsed && <span className="font-medium">Configuration</span>}
						</div>
					</nav>
				</div>

				{/* Area Tombol Deploy/Ekspor */}
				{fitur.exportServer && (
					<div className="mt-auto pt-6">
						<button
							onClick={padaDeploy}
							aria-label="Export Server"
							title={sedangCollapsed ? "Export Server" : ""}
							className={`w-full flex items-center ${
								sedangCollapsed ? "justify-center" : "space-x-3 px-4"
							} py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40`}
						>
							<Rocket className="w-5 h-5 text-emerald-500" />

							{!sedangCollapsed && (
								<div className="text-left">
									<span className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
										Export Server
									</span>
									<span className="block text-[10px] text-emerald-600/80">Node.js Runtime</span>
								</div>
							)}
						</button>
					</div>
				)}
			</div>

			{/* Footer Status */}
			{!sedangCollapsed && (
				<div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
					<div className="flex items-center space-x-3 text-xs text-slate-500 px-2">
						<div className="w-2 h-2 rounded-full bg-emerald-500"></div>
						<span className="font-mono opacity-70">System Ready</span>
					</div>
				</div>
			)}
		</div>
	);
};
