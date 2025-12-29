// TestConsole.tsx
import { AlertCircle, ArrowRight, CheckCircle, Clock, Code, Play, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import { MetodeHttp, MockEndpoint, TestConsoleState } from "../types";

interface TestConsoleProps {
	mocks: MockEndpoint[]; // Hanya untuk saran, tidak untuk logika eksekusi
	state: TestConsoleState;
	setState: (state: TestConsoleState) => void;
}

import { highlightJson } from "../utils/jsonHighlighter";

/**
 * Komponen untuk menampilkan JSON dengan syntax highlighting
 * @param json - String JSON yang akan ditampilkan
 */
const PenampilJson = ({ json }: { json: string }) => {
	try {
		const html = highlightJson(json);
		return (
			<pre
				className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	} catch {
		// Fallback jika highlight gagal
		return <pre className="text-slate-300">{json}</pre>;
	}
};

/**
 * Komponen utama untuk konsol pengujian API
 * Memungkinkan pengguna mengirim request HTTP dan melihat response
 */
export const KonsolPengujian: React.FC<TestConsoleProps> = ({ mocks, state, setState }) => {
	const [sedangMemuat, setSedangMemuat] = useState(false);
	const [permintaanTerakhir, setPermintaanTerakhir] = useState<{
		metode: MetodeHttp;
		path: string;
		body?: string;
	} | null>(null);

	/**
	 * Mengupdate state dengan perubahan partial
	 * @param perubahan - Bagian dari state yang akan diupdate
	 */
	const updateState = (perubahan: Partial<TestConsoleState>) => {
		setState({ ...state, ...perubahan });
	};

	/**
	 * Tipe untuk opsi pengiriman request
	 */
	type OpsiPengiriman = {
		metode?: MetodeHttp;
		path?: string;
		body?: string;
		_jumlahRetry?: number;
	};

	/**
	 * Handler untuk mengirim request HTTP
	 * @param override - Opsi override untuk request (method, path, body)
	 */
	const handleKirim = async (override?: OpsiPengiriman) => {
		const method = override?.metode ?? state.metode;
		const path = override?.path ?? state.path;
		const body = override?.body ?? state.body;

		// Validasi JSON dasar untuk method yang membutuhkan body
		if ((method === MetodeHttp.POST || method === MetodeHttp.PUT || method === MetodeHttp.PATCH) && body) {
			try {
				JSON.parse(body);
			} catch (error) {
				updateState({
					response: {
						status: 0,
						body: JSON.stringify(
							{
								error: "Body JSON tidak valid",
								detail: (error as Error).message,
							},
							null,
							2
						),
						time: 0,
						headers: [],
						error: "Body JSON tidak valid",
					},
				});
				return;
			}
		}

		setSedangMemuat(true);
		// Hapus response sebelumnya saat loading
		updateState({ response: null });

		const waktuMulai = Date.now();

		try {
			const options: RequestInit = {
				method,
				headers: {
					"Content-Type": "application/json",
					// Tambah flag agar Service Worker tahu ini request untuk mock
					"X-Mock-Request": "true",
				},
			};

			// Tambahkan body untuk method POST, PUT, PATCH
			if (method === MetodeHttp.POST || method === MetodeHttp.PUT || method === MetodeHttp.PATCH) {
				options.body = body;
			}

			// Simpan request terakhir untuk fitur re-run
			setPermintaanTerakhir({ metode: method, path, body });

			// REAL FETCH CALL!
			// Ini akan diintercept oleh sw.js -> App.tsx logic
			const response = await fetch(path, options);

			const teksResponse = await response.text();
			const durasi = Date.now() - waktuMulai;

			// Kumpulkan headers
			const headersResponse: { key: string; value: string }[] = [];
			response.headers.forEach((value, key) => {
				headersResponse.push({ key, value });
			});

			updateState({
				metode: method,
				path,
				body,
				response: {
					status: response.status,
					body: teksResponse,
					time: durasi, // Durasi jaringan sebenarnya (termasuk delay simulasi)
					headers: headersResponse,
				},
			});
		} catch (error) {
			const pesanError = (error as Error).message || "Error tidak diketahui";
			updateState({
				response: {
					status: 0,
					body: JSON.stringify(
						{
							error: "Error Jaringan",
							detail: pesanError,
						},
						null,
						2
					),
					time: Date.now() - waktuMulai,
					headers: [],
					error: "Koneksi jaringan gagal",
				},
			});

			// Retry otomatis dengan exponential backoff maksimal 2 retry
			const harusRetry = true; // Bisa ditambahkan logika heuristik nanti
			if (harusRetry && !override?._jumlahRetry) {
				const percobaanRetry = 1;
				const backoff = Math.min(2000, 200 * Math.pow(2, percobaanRetry));
				setTimeout(() => handleKirim({ ...override, _jumlahRetry: percobaanRetry }), backoff);
			} else if (harusRetry && override?._jumlahRetry && override._jumlahRetry < 2) {
				const percobaanRetry = override._jumlahRetry + 1;
				const backoff = Math.min(2000, 200 * Math.pow(2, percobaanRetry));
				setTimeout(() => handleKirim({ ...override, _jumlahRetry: percobaanRetry }), backoff);
			}
		} finally {
			setSedangMemuat(false);
		}
	};

	/**
	 * Handler untuk menjalankan ulang request terakhir
	 */
	const handleJalankanUlang = async () => {
		if (!permintaanTerakhir) return;
		await handleKirim(permintaanTerakhir);
	};

	return (
		<div className="flex flex-col h-full bg-slate-50 animate-enter">
			{/* Header */}
			<div className="bg-white border-b border-slate-200 px-8 py-8 shadow-sm z-10">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-bold text-slate-800 flex items-center mb-2">
						<div className="p-2.5 bg-brand-500 rounded-xl mr-4 shadow-lg shadow-brand-500/20">
							<Code className="w-6 h-6 text-white" />
						</div>
						Lab Prototipe API
					</h1>
					<p className="text-slate-500 ml-[66px] text-sm max-w-2xl">
						Uji desain route Anda secara instan. Mendukung parameter URL dinamis (contoh:{" "}
						<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/users/:id</code>) dan injeksi
						variabel. Request yang dikirim di sini akan muncul di Monitor Traffic.
					</p>
				</div>
			</div>

			<div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8 overflow-y-auto">
				{/* Panel Request */}
				<div className="flex flex-col gap-4">
					<div className="bg-white p-2 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 flex flex-col md:flex-row gap-2">
						{/* Selektor Method HTTP */}
						<div className="relative min-w-[140px]">
							<select
								value={state.metode}
								onChange={e => updateState({ metode: e.target.value as MetodeHttp })}
								className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none cursor-pointer hover:bg-slate-100 transition-colors appearance-none"
							>
								{Object.values(MetodeHttp).map(method => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</select>
							<div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
								<ArrowRight className="w-4 h-4 rotate-90" />
							</div>
						</div>

						{/* Input Path */}
						<input
							type="text"
							value={state.path}
							onChange={e => updateState({ path: e.target.value })}
							onKeyDown={e => e.key === "Enter" && handleKirim()}
							placeholder="Masukkan path endpoint (contoh: /api/v1/users)"
							className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
						/>

						{/* Tombol Aksi */}
						<div className="flex gap-2">
							<button
								onClick={() => handleKirim()}
								disabled={sedangMemuat || !state.path}
								className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center min-w-[110px]"
							>
								{sedangMemuat ? (
									<RotateCcw className="w-5 h-5 animate-spin" />
								) : (
									<>
										<Play className="w-5 h-5 mr-2" />
										Kirim
									</>
								)}
							</button>
							<button
								onClick={handleJalankanUlang}
								disabled={sedangMemuat || !permintaanTerakhir}
								className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-800 font-bold px-6 rounded-xl transition-all shadow active:scale-95 flex items-center justify-center min-w-[110px]"
								title={
									permintaanTerakhir
										? `${permintaanTerakhir.metode} ${permintaanTerakhir.path}`
										: "Tidak ada request sebelumnya"
								}
							>
								<RotateCcw className="w-5 h-5 mr-2" />
								Jalankan Ulang
							</button>
						</div>
					</div>

					{/* Input Request Body (untuk POST/PUT/PATCH) */}
					{(state.metode === MetodeHttp.POST ||
						state.metode === MetodeHttp.PUT ||
						state.metode === MetodeHttp.PATCH) && (
						<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
							<div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
								Body Request (JSON)
							</div>
							<textarea
								value={state.body || ""}
								onChange={e => updateState({ body: e.target.value })}
								className="w-full h-32 p-4 font-mono text-sm outline-none resize-none"
								placeholder='{"key": "value"}'
							/>
						</div>
					)}
				</div>

				{/* Panel Response */}
				{state.response && (
					<div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
						{/* Status Bar */}
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								{/* Badge Status Code */}
								<div
									className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
										state.response.status >= 400 || state.response.error
											? "bg-red-50 text-red-700 border-red-200"
											: "bg-emerald-50 text-emerald-700 border-emerald-200"
									}`}
								>
									{state.response.status >= 400 || state.response.error ? (
										<AlertCircle className="w-4 h-4" />
									) : (
										<CheckCircle className="w-4 h-4" />
									)}
									<span className="font-bold text-sm">{state.response.status}</span>
								</div>

								{/* Badge Durasi */}
								<div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
									<Clock className="w-3.5 h-3.5" />
									<span className="font-mono text-xs font-medium">
										{Math.round(state.response.time)}ms
									</span>
								</div>
							</div>
							<div className="text-xs text-slate-400">
								Ukuran: {new Blob([state.response.body]).size} B
							</div>
						</div>

						{/* Banner Error */}
						{state.response.error && (
							<div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
								<AlertCircle className="w-4 h-4 mt-0.5" />
								<div>
									<div className="text-sm font-bold">{state.response.error}</div>
									<div className="text-xs opacity-80">
										Periksa koneksi jaringan atau format body request Anda.
									</div>
								</div>
							</div>
						)}

						{/* Response Body & Headers */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Panel Response Body */}
							<div className="lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-xl flex flex-col min-h-[400px]">
								<div className="bg-[#0f172a] px-4 py-2 border-b border-slate-800 flex items-center justify-between">
									<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
										Body Response
									</span>
									<div className="flex items-center space-x-2">
										<span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
											JSON
										</span>
									</div>
								</div>
								<div className="p-4 overflow-auto flex-1 dark-scroll">
									<PenampilJson json={state.response.body} />
								</div>
							</div>

							{/* Panel Headers */}
							<div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
								<div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
									<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Headers Response
									</span>
								</div>
								<div className="p-2">
									{state.response.headers.map(header => (
										<div
											key={`${header.key}:${header.value}`}
											className="flex flex-col py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-dashed border-slate-100 last:border-0"
										>
											<span className="text-[11px] font-bold text-slate-700 mb-0.5">
												{header.key}
											</span>
											<span className="text-xs text-slate-500 font-mono break-all">
												{header.value}
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* State Awal (Belum ada response) */}
				{!state.response && !sedangMemuat && (
					<div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
						<div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
							<ArrowRight className="w-8 h-8 text-slate-300" />
						</div>
						<p className="font-medium">Siap untuk menguji</p>
						<p className="text-sm opacity-75">Masukkan endpoint dan tekan kirim</p>
					</div>
				)}
			</div>
		</div>
	);
};
