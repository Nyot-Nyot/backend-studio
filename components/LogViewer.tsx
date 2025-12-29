// LogViewer.tsx
import { Pause, Play, Search, Terminal, Trash, Wifi } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { EntriLog } from "../types";

/**
 * Memformat timestamp dengan locale-aware dan menyertakan milidetik untuk presisi
 * @param timestamp - String, number, atau Date object yang akan diformat
 * @returns String timestamp yang diformat (contoh: "14:30:25.123")
 */
export const formatWaktu = (timestamp: string | number | Date) => {
	const waktu = new Date(timestamp);
	const formatter = new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const milidetik = waktu.getMilliseconds().toString().padStart(3, "0");
	return `${formatter.format(waktu)}.${milidetik}`;
};

/**
 * Meloloskan karakter khusus untuk regular expression
 * @param string - String yang akan diloloskan
 * @returns String yang sudah diloloskan karakter khususnya
 */
const loloskanKarakterKhususRegex = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Properti untuk komponen PenampilLog
 */
interface PropertiPenampilLog {
	/**
	 * Array log yang akan ditampilkan
	 */
	log: EntriLog[];

	/**
	 * Fungsi untuk menghapus semua log
	 */
	padaHapusLog: () => void;

	/**
	 * Status koneksi socket (opsional)
	 */
	statusSocket?: "connected" | "connecting" | "disconnected";
}

/**
 * Komponen untuk menampilkan dan mengelola log traffic HTTP
 * Menyediakan fitur filter, pause/resume, export, dan pencarian real-time
 */
export const PenampilLog: React.FC<PropertiPenampilLog> = ({ log: logMasukan, padaHapusLog, statusSocket }) => {
	// State untuk kontrol penampilan log
	const [sedangJeda, setSedangJeda] = useState(false);
	const [filter, setFilter] = useState("");
	const [mengikutiLogBaru, setMengikutiLogBaru] = useState(true);
	const [jumlahLogBaru, setJumlahLogBaru] = useState(0);

	// Ref untuk scroll dan tracking
	const refAkhirLog = useRef<HTMLDivElement>(null);
	const refKontainer = useRef<HTMLDivElement>(null);
	const panjangLogSebelumnya = useRef<number>(logMasukan.length);

	// Render batching untuk performa (menampilkan N log terakhir secara default)
	const UKURAN_BATCH = 300;
	const [jumlahDitampilkan, setJumlahDitampilkan] = useState(Math.min(UKURAN_BATCH, logMasukan.length));

	/**
	 * Efek untuk auto-scroll dan tracking log baru
	 * - Auto-scroll ke bawah ketika mengikuti log dan tidak sedang di-pause
	 * - Tracking jumlah log baru ketika tidak mengikuti log baru
	 */
	useEffect(() => {
		const jumlahTambah = logMasukan.length - panjangLogSebelumnya.current;

		// Jika ada log baru dan tidak sedang mengikuti, tambah counter
		if (jumlahTambah > 0 && !mengikutiLogBaru) {
			setJumlahLogBaru(sebelumnya => sebelumnya + jumlahTambah);
		} else if (mengikutiLogBaru) {
			// Reset counter jika sedang mengikuti
			setJumlahLogBaru(0);
		}

		panjangLogSebelumnya.current = logMasukan.length;

		// Auto-scroll jika tidak pause dan sedang mengikuti
		if (!sedangJeda && mengikutiLogBaru && refAkhirLog.current) {
			refAkhirLog.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [logMasukan, sedangJeda, mengikutiLogBaru]);

	/**
	 * Handler untuk scroll event
	 * Mengecek apakah user sudah scroll sampai bawah
	 */
	const handleScroll = () => {
		const elemen = refKontainer.current;
		if (!elemen) return;

		const sudahDiBawah = elemen.scrollHeight - elemen.scrollTop - elemen.clientHeight < 80;
		setMengikutiLogBaru(sudahDiBawah);

		// Reset counter log baru jika sudah di bawah
		if (sudahDiBawah) {
			setJumlahLogBaru(0);
		}
	};

	/**
	 * Melompat ke bagian bawah log (log terbaru)
	 */
	const lompatKeBawah = () => {
		if (!refKontainer.current) return;

		refKontainer.current.scrollTop = refKontainer.current.scrollHeight;
		setMengikutiLogBaru(true);
		setJumlahLogBaru(0);
	};

	/**
	 * Memfilter log berdasarkan input filter
	 * Mencocokkan dengan path, method, status code, atau IP
	 */
	const filterHurufKecil = filter.toLowerCase();
	const logTersaring = logMasukan.filter(
		entriLog =>
			entriLog.path.toLowerCase().includes(filterHurufKecil) ||
			entriLog.metode.toLowerCase().includes(filterHurufKecil) ||
			entriLog.statusCode.toString().includes(filterHurufKecil) ||
			entriLog.ip.toLowerCase().includes(filterHurufKecil)
	);

	/**
	 * Log yang akan ditampilkan
	 * - Jika ada filter: tampilkan semua yang cocok
	 * - Jika tidak ada filter: tampilkan N log terakhir untuk performa
	 */
	const logUntukDitampilkan = filter ? logTersaring : logTersaring.slice(-jumlahDitampilkan);

	/**
	 * Fungsi untuk menyorot teks yang cocok dengan filter
	 * @param teks - Teks yang akan disorot
	 * @param kueri - Kueri pencarian
	 * @returns Array React element dengan teks yang disorot
	 */
	const sorotKecocokan = (teks: string, kueri: string) => {
		if (!kueri) return teks;

		try {
			const regex = new RegExp(`(${loloskanKarakterKhususRegex(kueri)})`, "ig");
			const bagian = teks.split(regex);

			return bagian.map((bagianTeks, indeks) =>
				regex.test(bagianTeks) ? (
					<mark key={indeks} className="bg-amber-500/20 text-amber-200 px-0.5 rounded">
						{bagianTeks}
					</mark>
				) : (
					<span key={indeks}>{bagianTeks}</span>
				)
			);
		} catch (error) {
			// Fallback jika regex error
			return teks;
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
						<h2 className="font-bold text-slate-100 tracking-tight">Monitor Traffic</h2>
						<div className="flex items-center space-x-2 mt-0.5">
							{/* Indikator status */}
							<span className="relative flex h-2 w-2">
								<span
									className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
										sedangJeda ? "bg-amber-400" : "bg-emerald-400"
									}`}
								></span>
								<span
									className={`relative inline-flex rounded-full h-2 w-2 ${
										sedangJeda ? "bg-amber-500" : "bg-emerald-500"
									}`}
								></span>
							</span>
							<span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
								{sedangJeda ? "Jeda" : "Mendengarkan..."}
							</span>

							{/* Status socket (jika ada) */}
							{statusSocket && (
								<span className="ml-3 inline-flex items-center text-[10px] font-semibold">
									<span
										className={`inline-block w-2 h-2 rounded-full mr-2 ${
											statusSocket === "connected"
												? "bg-emerald-400"
												: statusSocket === "connecting"
												? "bg-amber-400"
												: "bg-red-400"
										}`}
									></span>
									<span
										className={`${
											statusSocket === "connected"
												? "text-emerald-400"
												: statusSocket === "connecting"
												? "text-amber-400"
												: "text-red-400"
										}`}
									>
										{statusSocket === "connected"
											? "Terhubung"
											: statusSocket === "connecting"
											? "Menghubungkan"
											: "Terputus"}
									</span>
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Toolbar */}
				<div className="flex items-center space-x-3">
					{/* Input pencarian */}
					<div className="relative group">
						<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-slate-300 transition-colors" />
						<input
							type="text"
							placeholder="Filter log..."
							value={filter}
							onChange={e => setFilter(e.target.value)}
							className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-64 transition-all"
						/>
					</div>

					<div className="h-6 w-px bg-slate-700 mx-2"></div>

					{/* Tombol follow/jump */}
					<button
						onClick={() => {
							if (!mengikutiLogBaru) lompatKeBawah();
							setMengikutiLogBaru(sebelumnya => !sebelumnya);
						}}
						aria-pressed={mengikutiLogBaru}
						className={`p-2 rounded-lg transition-colors border ${
							mengikutiLogBaru
								? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
								: "bg-slate-700/30 text-slate-400 border-slate-700"
						}`}
						title={
							mengikutiLogBaru ? "Mengikuti log baru" : "Tidak mengikuti; klik untuk mengaktifkan follow"
						}
					>
						<span className="text-xs font-medium">{mengikutiLogBaru ? "Mengikuti" : "Berhenti"}</span>
					</button>

					{/* Tombol jump ke log baru (jika ada log baru) */}
					{jumlahLogBaru > 0 && (
						<button
							onClick={lompatKeBawah}
							className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs"
						>
							Lompat ke terbaru ({jumlahLogBaru})
						</button>
					)}

					{/* Tombol export JSON */}
					<button
						onClick={async () => {
							const blob = new Blob([JSON.stringify(logMasukan, null, 2)], {
								type: "application/json",
							});
							const url = URL.createObjectURL(blob);
							const link = document.createElement("a");
							link.href = url;
							link.download = `log-${Date.now()}.json`;
							link.click();
							URL.revokeObjectURL(url);
						}}
						className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
						title="Export log sebagai JSON"
					>
						Export
					</button>

					{/* Tombol copy semua log */}
					<button
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(JSON.stringify(logMasukan, null, 2));
							} catch (error) {
								console.warn("Gagal menyalin", error);
							}
						}}
						className="ml-2 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
						title="Salin semua log ke clipboard"
					>
						Salin
					</button>

					{/* Tombol pause/resume */}
					<button
						onClick={() => setSedangJeda(!sedangJeda)}
						className={`p-2 rounded-lg transition-colors border ${
							sedangJeda
								? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
								: "bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700"
						}`}
						title={sedangJeda ? "Lanjutkan" : "Jeda"}
					>
						{sedangJeda ? (
							<Play className="w-4 h-4 fill-current" />
						) : (
							<Pause className="w-4 h-4 fill-current" />
						)}
					</button>

					{/* Tombol hapus semua log */}
					<button
						onClick={padaHapusLog}
						className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
						title="Hapus Semua Log"
					>
						<Trash className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Header Tabel Log */}
			<div className="grid grid-cols-12 gap-4 px-6 py-2 bg-[#0f172a] border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
				<div className="col-span-2">Timestamp</div>
				<div className="col-span-1">Method</div>
				<div className="col-span-1">Status</div>
				<div className="col-span-5">Path</div>
				<div className="col-span-1 text-right">Latensi</div>
				<div className="col-span-2 text-right">IP Klien</div>
			</div>

			{/* Body Tabel Log */}
			<div
				className="flex-1 overflow-y-auto p-2 space-y-0.5 dark-scroll scroll-smooth"
				ref={refKontainer}
				onScroll={handleScroll}
			>
				{logUntukDitampilkan.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
						<div className="p-4 bg-slate-800/50 rounded-full">
							<Wifi className="w-8 h-8 opacity-50" />
						</div>
						<p className="text-xs">Menunggu traffic masuk dari Prototype Lab...</p>
					</div>
				) : (
					<div>
						{/* Tombol load lebih banyak (untuk log panjang tanpa filter) */}
						{jumlahDitampilkan < logMasukan.length && !filter && (
							<div className="flex justify-center mb-2">
								<button
									onClick={() =>
										setJumlahDitampilkan(sebelumnya =>
											Math.min(sebelumnya + UKURAN_BATCH, logMasukan.length)
										)
									}
									className="px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
								>
									Muat Lebih Banyak
								</button>
							</div>
						)}

						{/* List log */}
						{logUntukDitampilkan.map(entriLog => (
							<div
								key={entriLog.id}
								className="grid grid-cols-12 gap-4 px-4 py-2 hover:bg-[#1e293b] rounded-lg transition-colors border border-transparent hover:border-slate-700/50 items-center text-xs group"
							>
								{/* Timestamp */}
								<div className="col-span-2 text-slate-500 group-hover:text-slate-400">
									{formatWaktu(entriLog.timestamp)}
								</div>

								{/* HTTP Method */}
								<div className="col-span-1">
									<span
										className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
											entriLog.metode === "GET"
												? "bg-blue-500/10 text-blue-400"
												: entriLog.metode === "POST"
												? "bg-emerald-500/10 text-emerald-400"
												: entriLog.metode === "DELETE"
												? "bg-red-500/10 text-red-400"
												: "bg-amber-500/10 text-amber-400"
										}`}
									>
										{entriLog.metode}
									</span>
								</div>

								{/* Status Code */}
								<div className="col-span-1">
									<span
										className={`font-bold ${
											entriLog.statusCode >= 400 ? "text-red-400" : "text-emerald-400"
										}`}
									>
										{entriLog.statusCode}
									</span>
								</div>

								{/* Path */}
								<div className="col-span-5 text-slate-300 truncate font-medium" title={entriLog.path}>
									{sorotKecocokan(entriLog.path, filter)}
								</div>

								{/* Latensi */}
								<div className="col-span-1 text-right text-slate-500">{entriLog.duration}ms</div>

								{/* IP Klien */}
								<div className="col-span-1 text-right text-slate-600">
									{sorotKecocokan(entriLog.ip, filter)}
								</div>

								{/* Tombol copy per entri */}
								<div className="col-span-1 pl-2 text-right">
									<button
										onClick={async () => {
											try {
												await navigator.clipboard.writeText(JSON.stringify(entriLog));
											} catch (error) {
												console.warn("Gagal menyalin", error);
											}
										}}
										className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
										title="Salin entri log"
									>
										Salin
									</button>
								</div>
							</div>
						))}
					</div>
				)}
				{/* Elemen anchor untuk auto-scroll */}
				<div ref={refAkhirLog} />
			</div>
		</div>
	);
};
