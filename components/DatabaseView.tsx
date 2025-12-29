// DatabaseView.tsx
import { Database, RefreshCw, Save, Table, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DbItem, dbService } from "../services/dbService";

/**
 * Komponen untuk melihat dan mengelola data dalam memory store (database sementara)
 * Menampilkan koleksi data dari endpoint yang stateful
 */
export const DatabaseView = () => {
	// Daftar koleksi yang tersedia
	const [daftarKoleksi, setDaftarKoleksi] = useState<string[]>([]);

	// Koleksi yang sedang aktif dilihat
	const [koleksiAktif, setKoleksiAktif] = useState<string | null>(null);

	// Data dalam koleksi aktif
	const [data, setData] = useState<DbItem[]>([]);

	// Editor raw JSON untuk koleksi
	const [editorRaw, setEditorRaw] = useState("");

	// State sebelumnya untuk editor raw (untuk diff/undo)
	const [editorRawSebelumnya, setEditorRawSebelumnya] = useState<string | null>(null);

	// Apakah sedang dalam mode edit raw JSON
	const [sedangEdit, setSedangEdit] = useState(false);

	// Error validasi JSON
	const [errorJson, setErrorJson] = useState<string | null>(null);

	// Menampilkan perbedaan (diff) antara data lama dan baru
	const [tampilkanDiff, setTampilkanDiff] = useState(false);

	// Halaman saat ini untuk pagination
	const [halaman, setHalaman] = useState(1);

	// Jumlah item per halaman
	const [ukuranHalaman, setUkuranHalaman] = useState(50);

	// Error umum
	const [error, setError] = useState<string | null>(null);

	/**
	 * Memuat daftar koleksi dari service
	 */
	const muatKoleksi = () => {
		const koleksi = dbService.listCollections();
		setDaftarKoleksi(koleksi);

		// Jika tidak ada koleksi aktif dan ada koleksi tersedia, pilih koleksi pertama
		if (!koleksiAktif && koleksi.length > 0) {
			handlePilihKoleksi(koleksi[0]);
		}
	};

	/**
	 * Menangani pemilihan koleksi untuk dilihat/diedit
	 * @param nama - Nama koleksi yang dipilih
	 */
	const handlePilihKoleksi = (nama: string) => {
		setKoleksiAktif(nama);

		// Ambil data koleksi dari service
		const dataKoleksi = dbService.getCollection(nama) as DbItem[];
		setData(dataKoleksi);

		// Set editor raw dengan data yang diformat
		setEditorRaw(JSON.stringify(dataKoleksi, null, 2));
		setEditorRawSebelumnya(null);
		setSedangEdit(false);
		setErrorJson(null);
		setTampilkanDiff(false);
		setHalaman(1);
		setError(null);
	};

	// Muat koleksi saat komponen pertama kali di-render
	useEffect(() => {
		muatKoleksi();
	}, []);

	/**
	 * Mendapatkan header (nama kolom) dari data
	 * Mengambil semua kunci unik dari semua item dalam data
	 */
	const headers = useMemo(() => {
		const kunci = new Set<string>();

		// Kumpulkan semua kunci dari setiap item
		data.forEach(item => {
			if (item) {
				Object.keys(item).forEach(k => kunci.add(k));
			}
		});

		const arrayKunci = Array.from(kunci);

		// Jika ada kolom 'id', pastikan dia menjadi kolom pertama
		if (arrayKunci.includes("id")) {
			return ["id", ...arrayKunci.filter(k => k !== "id").sort()];
		}

		return arrayKunci.sort();
	}, [data]);

	/**
	 * Menghitung total halaman berdasarkan jumlah data dan ukuran halaman
	 */
	const totalHalaman = Math.max(1, Math.ceil(data.length / ukuranHalaman));

	/**
	 * Data untuk halaman saat ini (pagination)
	 */
	const dataHalaman = useMemo(
		() => data.slice((halaman - 1) * ukuranHalaman, halaman * ukuranHalaman),
		[data, halaman, ukuranHalaman]
	);

	/**
	 * Menyesuaikan halaman saat ini jika total halaman berubah
	 * (misalnya saat data berkurang)
	 */
	useEffect(() => {
		setHalaman(halamanSaatIni => Math.min(halamanSaatIni, totalHalaman));
	}, [totalHalaman]);

	/**
	 * Menangani refresh data dan daftar koleksi
	 */
	const handleRefresh = () => {
		if (koleksiAktif) {
			handlePilihKoleksi(koleksiAktif);
		}
		muatKoleksi();
	};

	/**
	 * Menangani penghapusan semua data dalam koleksi aktif
	 */
	const handleHapusKoleksi = () => {
		if (koleksiAktif && window.confirm(`Hapus semua data dalam koleksi '${koleksiAktif}'?`)) {
			dbService.clearCollection(koleksiAktif);
			handleRefresh();
		}
	};

	/**
	 * Menetapkan ID yang stabil untuk semua item dalam koleksi
	 * @param koleksi - Nama koleksi yang akan diberi ID stabil
	 */
	const tetapkanIdStabil = (koleksi: string) => {
		const dataBaru = data.map((item, indeks) => {
			// Jika item tidak memiliki id, buat id baru
			if (item.id === undefined || item.id === null) {
				return {
					...item,
					id:
						typeof crypto !== "undefined" && crypto.randomUUID
							? crypto.randomUUID().split("-")[0] // Ambil bagian pertama UUID
							: `id-${Date.now()}-${indeks}`, // Fallback ID
				};
			}
			return item;
		});

		// Simpan koleksi dengan ID baru
		dbService.saveCollection(koleksi, dataBaru);
		setData(dataBaru);
		setEditorRaw(JSON.stringify(dataBaru, null, 2));
	};

	/**
	 * Menangani penghapusan item berdasarkan indeks
	 * @param indeks - Indeks item yang akan dihapus
	 */
	const handleHapusItem = (indeks: number) => {
		if (!koleksiAktif || !data[indeks]) return;

		const item = data[indeks];
		const idItem = item.id;

		// Jika item tidak memiliki ID yang stabil
		if (idItem === undefined || idItem === null) {
			const setujui = window.confirm(
				"Data ini tidak memiliki ID yang stabil.\n\nOK = Berikan ID stabil untuk semua data (disarankan).\nBatal = Hapus berdasarkan indeks (tidak aman)."
			);

			if (setujui) {
				// Berikan ID stabil untuk semua item lalu hapus berdasarkan ID
				tetapkanIdStabil(koleksiAktif);

				const dataDenganId = dbService.getCollection(koleksiAktif);
				const idUntukDihapus = dataDenganId[indeks]?.id;

				if (idUntukDihapus !== undefined) {
					dbService.delete(koleksiAktif, idUntukDihapus as any);
					setData(dataDenganId.filter((_, i) => i !== indeks));
				}
				return;
			}

			// Pengguna memilih untuk menghapus berdasarkan indeks
			if (window.confirm(`Hapus item (indeks ${indeks})? Penghapusan berdasarkan indeks mungkin tidak aman.`)) {
				const dataBaru = data.filter((_, i) => i !== indeks);
				dbService.saveCollection(koleksiAktif, dataBaru);
				setData(dataBaru);
			}
			return;
		}

		// Jika item memiliki ID, hapus berdasarkan ID
		if (window.confirm(`Hapus item dengan ID ${String(idItem)}?`)) {
			const terhapus = dbService.delete(koleksiAktif, idItem as any);

			if (terhapus) {
				// Perbarui UI dengan menghapus item berdasarkan ID
				setData(prev => prev.filter(d => d.id != idItem));
			} else {
				// Fallback: muat ulang data dari penyimpanan
				const dataDimuatUlang = dbService.getCollection(koleksiAktif);
				setData(dataDimuatUlang as DbItem[]);
			}
		}
	};

	/**
	 * Menangani penghapusan semua koleksi dan data
	 */
	const handleHapusSemuaDatabase = () => {
		if (window.confirm("Hapus SEMUA koleksi dan data? Tindakan ini tidak dapat dibatalkan.")) {
			dbService.clearAllCollections();
			setDaftarKoleksi([]);
			setKoleksiAktif(null);
			setData([]);
			setEditorRaw("");
		}
	};

	/**
	 * Menangani penyimpanan perubahan dari editor raw JSON
	 */
	const handleSimpan = () => {
		if (!koleksiAktif) return;

		try {
			const terparse = JSON.parse(editorRaw);

			// Validasi: data harus berupa array
			if (!Array.isArray(terparse)) {
				throw new Error("Data harus berupa array");
			}

			// Validasi: setiap item harus berupa object
			if (!terparse.every((item: any) => typeof item === "object" && item !== null && !Array.isArray(item))) {
				throw new Error("Setiap item harus berupa object");
			}

			// Simpan ke service
			dbService.saveCollection(koleksiAktif, terparse as DbItem[]);

			// Perbarui state
			setData(terparse as DbItem[]);
			setSedangEdit(false);
			setEditorRawSebelumnya(null);
			setErrorJson(null);
			setError(null);
		} catch (error) {
			setError((error as Error).message);
		}
	};

	return (
		<div
			className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in"
			style={{ padding: "var(--space-6)" }}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold text-slate-900 flex items-center">
						<Database className="w-6 h-6 mr-3 text-brand-500" />
						Memory Store
					</h1>
					<p className="text-slate-500 mt-1">Lihat dan kelola data stateful untuk endpoint aktif Anda.</p>
				</div>
				<div className="flex items-center gap-2">
					{/* Tombol Refresh */}
					<button
						onClick={handleRefresh}
						className="hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition-colors"
						style={{ padding: "var(--space-1)" }}
						title="Refresh"
					>
						<RefreshCw className="w-5 h-5" />
					</button>

					{/* Tombol Hapus Semua Database */}
					<button
						onClick={handleHapusSemuaDatabase}
						className="hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
						style={{ padding: "var(--space-1)" }}
						title="Hapus semua koleksi"
					>
						<Trash2 className="w-5 h-5" />
					</button>
				</div>
			</div>

			{/* Konten Utama: Daftar Koleksi dan Editor */}
			<div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
				{/* Sidebar: Daftar Koleksi */}
				<div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
					<div className="border-b border-slate-100 bg-slate-50/50" style={{ padding: "var(--space-2)" }}>
						<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koleksi</h3>
					</div>
					<div className="flex-1 overflow-y-auto p-2">
						{daftarKoleksi.length === 0 ? (
							<div className="text-center text-slate-400 text-sm" style={{ padding: "var(--space-2)" }}>
								Tidak ada data bucket aktif. Aktifkan "Stateful" pada endpoint untuk membuat koleksi.
							</div>
						) : (
							daftarKoleksi.map(koleksi => (
								<button
									key={koleksi}
									onClick={() => handlePilihKoleksi(koleksi)}
									className={`w-full text-left rounded-xl mb-1 text-sm font-medium transition-all flex items-center justify-between ${
										koleksiAktif === koleksi
											? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
											: "text-slate-600 hover:bg-slate-50"
									}`}
									style={{ padding: "var(--space-3) var(--space-4)" }}
								>
									<span className="truncate">{koleksi}</span>
									{koleksiAktif === koleksi && <div className="w-2 h-2 rounded-full bg-brand-500" />}
								</button>
							))
						)}
					</div>
				</div>

				{/* Area Editor */}
				<div className="col-span-9 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
					{koleksiAktif ? (
						<>
							{/* Header Editor */}
							<div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
								<div className="flex items-center gap-2">
									<Table className="w-4 h-4 text-slate-400" />
									<span className="font-mono text-sm font-bold text-slate-700">{koleksiAktif}</span>
									<div className="flex items-center gap-2">
										<span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
											{data.length} data
										</span>
										{!sedangEdit && data.length > 0 && (
											<>
												{/* Navigasi Halaman */}
												<button
													onClick={() => setHalaman(h => Math.max(1, h - 1))}
													className="rounded bg-white border text-slate-600 text-xs"
													style={{ padding: "var(--space-1) var(--space-2)" }}
													disabled={halaman <= 1}
												>
													Sebelumnya
												</button>
												<span className="text-xs text-slate-500">
													Halaman {halaman}/{totalHalaman}
												</span>
												<button
													onClick={() => setHalaman(h => Math.min(totalHalaman, h + 1))}
													className="rounded bg-white border text-slate-600 text-xs"
													style={{ padding: "var(--space-1) var(--space-2)" }}
													disabled={halaman >= totalHalaman}
												>
													Berikutnya
												</button>
											</>
										)}
									</div>
								</div>
								<div className="flex items-center gap-2">
									{sedangEdit ? (
										<>
											{/* Mode Edit: Tombol Batal dan Simpan */}
											<button
												onClick={() => {
													setSedangEdit(false);
													setEditorRaw(JSON.stringify(data, null, 2));
													setError(null);
												}}
												className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
											>
												Batal
											</button>
											<button
												onClick={handleSimpan}
												className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm"
											>
												<Save className="w-3.5 h-3.5 mr-1.5" /> Simpan Perubahan
											</button>
										</>
									) : (
										<>
											{/* Mode View: Tombol Edit dan Hapus */}
											<button
												onClick={() => {
													setEditorRawSebelumnya(editorRaw);
													setSedangEdit(true);
												}}
												className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
											>
												Edit JSON Mentah
											</button>
											<button
												onClick={handleHapusKoleksi}
												className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
												title="Hapus Data"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</>
									)}
								</div>
							</div>

							{/* Konten Editor/Tabel */}
							<div className="flex-1 relative">
								{sedangEdit ? (
									// Mode Edit: Textarea untuk edit JSON mentah
									<textarea
										value={editorRaw}
										onChange={e => setEditorRaw(e.target.value)}
										className="w-full h-full p-4 font-mono text-sm text-slate-700 bg-slate-50 focus:outline-none resize-none"
									/>
								) : (
									// Mode View: Tampilkan data dalam tabel
									<div className="p-0 h-full overflow-y-auto">
										{data.length === 0 ? (
											<div className="h-full flex flex-col items-center justify-center text-slate-400">
												<p className="text-sm">Koleksi kosong.</p>
												<p className="text-xs mt-1">
													Request POST ke endpoint ini akan mengisi koleksi ini.
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
															Aksi
														</th>
													</tr>
												</thead>
												<tbody className="text-sm">
													{dataHalaman.map((row, i) => (
														<tr
															key={(row as any).id ?? (halaman - 1) * ukuranHalaman + i}
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
																		handleHapusItem(
																			(halaman - 1) * ukuranHalaman + i
																		)
																	}
																	className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
																	title="Hapus item"
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

								{/* Tampilkan error jika ada */}
								{error && (
									<div className="absolute bottom-4 left-4 right-4 bg-red-100 text-red-700 p-3 rounded-lg text-sm border border-red-200 shadow-lg flex items-center">
										<span className="font-bold mr-2">Error:</span> {error}
									</div>
								)}
							</div>
						</>
					) : (
						// State saat tidak ada koleksi yang dipilih
						<div className="flex-1 flex flex-col items-center justify-center text-slate-400">
							<Database className="w-12 h-12 mb-4 opacity-20" />
							<p>Pilih koleksi untuk melihat data</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
