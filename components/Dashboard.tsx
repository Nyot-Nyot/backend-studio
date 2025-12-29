// Dashboard.tsx
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
import Button from "./Button";
import { ToastType } from "./Toast";

// Properti yang diterima oleh komponen Dashboard
interface DashboardProps {
	mocks: MockEndpoint[];
	onEdit: (mock: MockEndpoint) => void;
	onDelete: (id: string) => void;
	onBulkDelete: (ids: string[]) => void;
	onToggle: (id: string) => void;
	onDuplicate: (mock: MockEndpoint) => void;
	addToast: (message: string, type: ToastType) => void;
}

// Komponen utama Dashboard untuk menampilkan dan mengelola endpoint mock
export const Dashboard: React.FC<DashboardProps> = ({
	mocks,
	onEdit,
	onDelete,
	onBulkDelete,
	onToggle,
	onDuplicate,
	addToast,
}) => {
	// State untuk pencarian dan seleksi
	const [istilahPencarian, setIstilahPencarian] = useState("");
	const [idTerpilih, setIdTerpilih] = useState<string[]>([]);
	const [indeksTerpilihTerakhir, setIndeksTerpilihTerakhir] = useState<number | null>(null);

	// Sinkronisasi id terpilih dengan mock yang ada (menghapus id mock yang sudah dihapus)
	useEffect(() => {
		setIdTerpilih(sebelumnya => sebelumnya.filter(id => mocks.some(m => m.id === id)));
	}, [mocks]);

	// Filter mock berdasarkan istilah pencarian (nama atau path)
	const mockYangDifilter = mocks.filter(
		m =>
			m.nama.toLowerCase().includes(istilahPencarian.toLowerCase()) ||
			m.path.toLowerCase().includes(istilahPencarian.toLowerCase())
	);

	// Hitungan statistik
	const totalPermintaan = mocks.reduce((akumulator, m) => akumulator + m.requestCount, 0);
	const jumlahAktif = mocks.filter(m => m.isActive).length;

	/**
	 * Menangani penyalinan path ke clipboard
	 * Mencoba menggunakan navigator.clipboard, fallback ke execCommand untuk browser lama
	 */
	const handleSalinPath = async (event: React.MouseEvent, path: string) => {
		event.stopPropagation();
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(path);
			} else {
				// Fallback untuk browser yang tidak mendukung clipboard API
				const textarea = document.createElement("textarea");
				textarea.value = path;
				textarea.style.position = "fixed";
				textarea.style.left = "-9999px";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
			}
			addToast("Path rute berhasil disalin ke clipboard", "info");
		} catch (error) {
			console.error("Gagal menyalin", error);
			addToast("Gagal menyalin path rute", "error");
		}
	};

	/**
	 * Menangani penghapusan mock tunggal
	 * Mencegah event bubbling agar tidak memicu edit
	 */
	const handleHapus = (event: React.MouseEvent, id: string) => {
		event.stopPropagation();
		onDelete(id);
	};

	/**
	 * Menangani duplikasi mock
	 * Mencegah event bubbling agar tidak memicu edit
	 */
	const handleDuplikasi = (event: React.MouseEvent, mock: MockEndpoint) => {
		event.stopPropagation();
		onDuplicate(mock);
	};

	/**
	 * Menangali toggle status aktif/mati mock
	 * Mencegah event bubbling agar tidak memicu edit
	 */
	const handleToggle = (event: React.MouseEvent, id: string) => {
		event.stopPropagation();
		onToggle(id);
	};

	/**
	 * Menangani seleksi item (tunggal atau range dengan Shift)
	 * @param id - ID mock yang akan diseleksi
	 * @param indeks - Posisi mock dalam daftar yang difilter
	 * @param shiftKey - Apakah tombol Shift ditekan
	 */
	const toggleSeleksi = (id: string, indeks?: number, shiftKey?: boolean) => {
		setIdTerpilih(sebelumnya => {
			if (shiftKey && indeksTerpilihTerakhir !== null && typeof indeks === "number") {
				// Seleksi range saat Shift ditekan
				const awal = Math.min(indeksTerpilihTerakhir, indeks);
				const akhir = Math.max(indeksTerpilihTerakhir, indeks);
				const idDalamRange = mockYangDifilter.slice(awal, akhir + 1).map(m => m.id);
				const setBaru = new Set(sebelumnya);
				idDalamRange.forEach(idItem => setBaru.add(idItem));
				return Array.from(setBaru);
			} else {
				// Seleksi tunggal
				if (sebelumnya.includes(id)) {
					return sebelumnya.filter(itemId => itemId !== id);
				} else {
					return [...sebelumnya, id];
				}
			}
		});
		if (typeof indeks === "number") {
			setIndeksTerpilihTerakhir(indeks);
		}
	};

	/**
	 * Handler untuk event seleksi (klik, keyboard, atau change)
	 * Menyediakan interface yang konsisten untuk berbagai jenis event
	 */
	const handleSeleksi = (
		event: React.MouseEvent | React.ChangeEvent | React.KeyboardEvent,
		id: string,
		indeks?: number
	) => {
		if ("stopPropagation" in event && typeof event.stopPropagation === "function") event.stopPropagation();
		const shiftKey = (event as any).shiftKey || false;
		toggleSeleksi(id, indeks, !!shiftKey);
	};

	/**
	 * Menangani seleksi semua item (toggle)
	 * Jika semua sudah terpilih, kosongkan seleksi
	 * Jika belum semua terpilih, pilih semua
	 */
	const handleSeleksiSemua = () => {
		if (idTerpilih.length === mockYangDifilter.length) {
			setIdTerpilih([]);
		} else {
			setIdTerpilih(mockYangDifilter.map(m => m.id));
		}
	};

	/**
	 * Menjalankan penghapusan batch untuk item terpilih
	 */
	const jalankanHapusBatch = () => {
		onBulkDelete(idTerpilih);
		setIdTerpilih([]);
	};

	// Peta gaya visual untuk setiap metode HTTP
	const PETA_GAYA_METODE: Partial<Record<HttpMethod, string>> = {
		[HttpMethod.GET]: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/10",
		[HttpMethod.POST]: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/10",
		[HttpMethod.PUT]: "bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/10",
		[HttpMethod.DELETE]: "bg-red-50 text-red-700 border-red-200 ring-red-500/10",
	};

	/**
	 * Mendapatkan kelas CSS untuk menampilkan metode HTTP
	 * @param metode - Metode HTTP (GET, POST, PUT, DELETE, dll)
	 * @returns String kelas Tailwind CSS
	 */
	const dapatkanGayaMetode = (metode: HttpMethod) =>
		PETA_GAYA_METODE[metode] ?? "bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/10";

	return (
		<div
			className="max-w-[1600px] mx-auto space-y-10 animate-enter relative"
			style={{ padding: "var(--space-6)", paddingBottom: "calc(var(--space-6) * 2)" }}
		>
			{/* Header & Statistik */}
			<div className="space-y-6">
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<h2 className="text-3xl font-bold text-slate-900 tracking-tight">Ringkasan</h2>
						<p className="text-slate-500 mt-1">Kelola kontrak API dan pantau lalu lintas simulasi.</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<KartuStatistik
						ikon={<Layers className="w-6 h-6 text-brand-600" />}
						label="Route yang Dirancang"
						nilai={mocks.length}
						latarbelakang="bg-brand-50"
						border="border-brand-100"
					/>
					<KartuStatistik
						ikon={<GitBranch className="w-6 h-6 text-violet-600" />}
						label="Kontrak Aktif"
						nilai={jumlahAktif}
						latarbelakang="bg-violet-50"
						border="border-violet-100"
					/>
					<KartuStatistik
						ikon={<BarChart2 className="w-6 h-6 text-emerald-600" />}
						label="Total Permintaan"
						nilai={totalPermintaan.toLocaleString()}
						latarbelakang="bg-emerald-50"
						border="border-emerald-100"
					/>
				</div>
			</div>

			{/* Toolbar Pencarian */}
			<div className="flex items-center justify-between sticky top-0 z-20 bg-[#f8fafc]/95 backdrop-blur-md py-4 border-b border-slate-200/50 -mx-8 px-8 transition-all">
				<div className="flex items-center space-x-2 text-sm text-slate-500">
					<span className="font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full text-xs">
						{mockYangDifilter.length}
					</span>{" "}
					hasil ditemukan
				</div>
				<div className="relative w-80 group">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
					</div>
					<input
						type="text"
						className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl leading-5 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 sm:text-sm transition-all shadow-sm group-hover:border-slate-300"
						placeholder="Cari route berdasarkan nama atau path..."
						value={istilahPencarian}
						onChange={e => setIstilahPencarian(e.target.value)}
					/>
				</div>
			</div>

			{/* Grid Kartu Mock */}
			<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
				{mockYangDifilter.map((mock, indeks) => {
					const apakahTerpilih = idTerpilih.includes(mock.id);
					return (
						<div
							key={mock.id}
							data-testid={`mock-card-${mock.nama.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
							onClick={() => onEdit(mock)}
							tabIndex={0}
							onKeyDown={e => {
								if (e.key === "Enter") {
									onEdit(mock);
								} else if (e.key === " " || e.key === "Spacebar") {
									e.preventDefault();
									handleSeleksi(e, mock.id, indeks);
								}
							}}
							aria-selected={apakahTerpilih}
							className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 cursor-pointer overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards focus:outline-none focus:ring-2 focus:ring-brand-500 ${
								mock.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50/50 opacity-80"
							} ${apakahTerpilih ? "ring-2 ring-brand-500 border-brand-500" : ""}`}
							style={{ animationDelay: `${indeks * 50}ms` }}
						>
							{/* Garis Status (aktif/nonaktif) */}
							<div
								className={`h-1 w-full transition-colors duration-300 ${
									mock.isActive ? "bg-gradient-to-r from-brand-500 to-brand-400" : "bg-slate-300"
								}`}
							/>

							<div className="flex-1 flex flex-col relative" style={{ padding: "var(--space-4)" }}>
								{/* Checkbox Seleksi */}
								<div
									className={`absolute z-20 transition-opacity duration-200 checkbox-offset ${
										apakahTerpilih ? "opacity-100" : "opacity-0 group-hover:opacity-100"
									}`}
								>
									<input
										type="checkbox"
										checked={apakahTerpilih}
										onChange={e => handleSeleksi(e, mock.id, indeks)}
										onClick={e => e.stopPropagation()}
										aria-label={`Pilih ${mock.nama}`}
										aria-checked={apakahTerpilih}
										className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-500 cursor-pointer accent-brand-600"
									/>
								</div>
								<div
									className="flex justify-between items-start mb-4"
									style={{ paddingLeft: "var(--space-5)" }}
								>
									<div className="flex flex-col gap-1.5 min-w-0 pr-12">
										<h3 className="font-bold text-slate-800 truncate text-base group-hover:text-brand-600 transition-colors">
											{mock.nama}
										</h3>
										<div className="flex items-center space-x-2">
											<span
												className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ring-1 ring-inset ${dapatkanGayaMetode(
													mock.metode
												)}`}
											>
												{mock.metode}
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

									{/* Aksi (tampil saat hover/aktif) */}
									<div className="flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-100 pointer-events-none group-hover:pointer-events-auto">
										<TombolAksi
											onClick={e => handleToggle(e, mock.id)}
											ikon={
												mock.isActive ? (
													<Pause className="w-3.5 h-3.5" />
												) : (
													<Play className="w-3.5 h-3.5" />
												)
											}
											warna={
												mock.isActive
													? "text-amber-500 hover:bg-amber-50"
													: "text-emerald-500 hover:bg-emerald-50"
											}
											judul={mock.isActive ? "Jeda" : "Aktifkan"}
										/>
										<div className="w-px h-3 bg-slate-200 mx-0.5" />
										<TombolAksi
											onClick={e => handleDuplikasi(e, mock)}
											ikon={<Copy className="w-3.5 h-3.5" />}
											warna="text-slate-400 hover:text-brand-600 hover:bg-brand-50"
											judul="Duplikasi"
										/>
										<TombolAksi
											onClick={e => handleHapus(e, mock.id)}
											ikon={<Trash2 className="w-3.5 h-3.5" />}
											warna="text-slate-400 hover:text-red-600 hover:bg-red-50"
											judul="Hapus"
										/>
									</div>
								</div>

								{/* Path dengan kemampuan salin */}
								<div className="mt-auto pt-2">
									<div
										className="group/path flex items-center text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 hover:border-brand-200 hover:bg-brand-50/30 transition-colors relative"
										onClick={e => handleSalinPath(e, mock.path)}
										title="Klik untuk menyalin"
									>
										<span className="truncate flex-1">{mock.path}</span>
										<Link className="w-3 h-3 text-slate-400 opacity-0 group-hover/path:opacity-100 transition-opacity ml-2 flex-shrink-0" />
									</div>
								</div>
							</div>

							{/* Footer Statistik */}
							<div
								className="border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500"
								style={{
									paddingLeft: "var(--space-4)",
									paddingRight: "var(--space-4)",
									paddingTop: "var(--space-3)",
									paddingBottom: "var(--space-3)",
								}}
							>
								<div className="flex items-center space-x-4">
									<div className="flex items-center" title="Delay Respons">
										<Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
										{mock.delay}ms
									</div>
								</div>
								<div className="font-medium flex items-center group/hits">
									<span className="bg-slate-200 group-hover/hits:bg-brand-100 group-hover/hits:text-brand-700 transition-colors rounded-full px-2 py-0.5 text-[10px] text-slate-600">
										{mock.requestCount} permintaan
									</span>
								</div>
							</div>
						</div>
					);
				})}

				{/* State Kosong (tidak ada hasil pencarian) */}
				{mockYangDifilter.length === 0 && (
					<div className="col-span-full py-24 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
						<div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
							<Search className="w-10 h-10 text-slate-300" />
						</div>
						<h3 className="text-xl font-bold text-slate-900 mb-2">Tidak ada route ditemukan</h3>
						<p className="text-slate-500 max-w-sm mx-auto mb-8">
							Tidak ditemukan endpoint yang cocok dengan "{istilahPencarian}". Coba ubah pencarian atau
							buat endpoint baru.
						</p>
						<button
							onClick={() => setIstilahPencarian("")}
							className="text-brand-600 font-medium hover:text-brand-700 hover:underline underline-offset-4 flex items-center"
						>
							Hapus filter pencarian <ArrowRight className="w-4 h-4 ml-1" />
						</button>
					</div>
				)}
			</div>

			{/* Floating Bar Aksi Batch */}
			{idTerpilih.length > 0 && (
				<div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
					<div className="bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-900/50 py-3 px-6 flex items-center gap-6 border border-slate-700">
						<div className="flex items-center gap-3 border-r border-slate-700 pr-6">
							<span className="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
								{idTerpilih.length}
							</span>
							<span className="text-sm font-medium">Terpilih</span>
						</div>

						<div className="flex items-center gap-3">
							<button
								onClick={handleSeleksiSemua}
								className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800"
							>
								<CheckSquare className="w-4 h-4" />
								{idTerpilih.length === mockYangDifilter.length ? "Batalkan Semua" : "Pilih Semua"}
							</button>
							<div className="hidden sm:block text-xs text-slate-400 ml-3">
								Tips: gunakan Shift+Klik untuk memilih range
							</div>

							<button
								onClick={() => setIdTerpilih([])}
								className="ml-2 p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
								title="Batalkan seleksi"
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

// Komponen Kartu Statistik untuk menampilkan statistik dashboard
interface PropsKartuStatistik {
	ikon: React.ReactNode;
	label: string;
	nilai: string | number;
	latarbelakang: string;
	border: string;
}

const KartuStatistik: React.FC<PropsKartuStatistik> = ({ ikon, label, nilai, latarbelakang, border }) => (
	<div
		className={`p-6 rounded-2xl bg-white border shadow-sm flex items-center space-x-5 transition-transform hover:scale-[1.01] duration-300 ${border}`}
	>
		<div className={`p-4 rounded-xl ${latarbelakang}`}>{ikon}</div>
		<div>
			<p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
			<h3 className="text-3xl font-bold text-slate-900 tracking-tight">{nilai}</h3>
		</div>
	</div>
);

// Komponen Tombol Aksi untuk aksi pada kartu mock
interface PropsTombolAksi {
	onClick: (e: React.MouseEvent) => void;
	ikon: React.ReactNode;
	warna: string;
	judul: string;
}

const TombolAksi: React.FC<PropsTombolAksi> = ({ onClick, ikon, warna, judul }) => (
	<Button variant="icon" onClick={onClick} className={`transition-all active:scale-90 ${warna}`} title={judul}>
		{ikon}
	</Button>
);
