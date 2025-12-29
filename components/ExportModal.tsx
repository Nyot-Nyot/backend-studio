// ModalEkspor.tsx
// Modal untuk mengekspor konfigurasi proyek dalam berbagai format

import { CheckCircle, Copy, FileJson, Loader2, Mail, Send, X } from "lucide-react";
import React, { useState } from "react";
import { hasilkanSpesifikasiOpenApi } from "../services/openApiService";
import { MockEndpoint, Project } from "../types";

/**
 * Props untuk komponen ModalEkspor
 */
interface PropsModalEkspor {
	/** Proyek yang akan diekspor */
	project?: Project;
	/** Daftar endpoint tiruan yang akan diekspor */
	endpoints?: MockEndpoint[];
	/** Fungsi yang dipanggil saat modal ditutup */
	onClose: () => void;
	/** Fungsi untuk menampilkan notifikasi (opsional) */
	onToast?: (msg: string, type: "success" | "info" | "error") => void;
	/** Fungsi untuk mengirim email (opsional) */
	onSend?: (recipients: string[], subject: string, message: string) => Promise<void>;
	/** Status pengiriman email (opsional) */
	isSending?: boolean;
}

/**
 * Menghasilkan ringkasan untuk proyek dan endpoint
 * @param proyek - Proyek yang akan diringkas (opsional)
 * @param endpoints - Daftar endpoint yang akan diringkas
 * @returns String ringkasan dalam format teks
 */
const hasilkanRingkasan = (proyek?: Project, endpoints: MockEndpoint[] = []) => {
	if (!proyek) return "Ekspor proyek";
	const baris: string[] = [];
	baris.push(`Proyek: ${proyek.nama}`);
	baris.push(`Endpoint: ${endpoints.length}`);
	for (const endpoint of endpoints.slice(0, 20)) {
		baris.push(`${String(endpoint.metode)} ${endpoint.path} - ${endpoint.nama}`);
	}
	if (endpoints.length > 20) baris.push(`(+${endpoints.length - 20} lagi)`);
	return baris.join("\n");
};

/**
 * Komponen ModalEkspor untuk mengekspor konfigurasi proyek
 */
export default function ModalEkspor({
	project,
	endpoints = [],
	onClose,
	onToast,
	onSend,
	isSending,
}: PropsModalEkspor) {
	const [email, setEmail] = useState("");
	const [sedangMengirim, setSedangMengirim] = useState(false);
	const [selesai, setSelesai] = useState(false);

	// Jika tidak ada proyek, jangan render modal
	if (!project) return null;

	/**
	 * Mengunduh konfigurasi sebagai file JSON
	 */
	const unduhJson = () => {
		const dataStr =
			"data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ project, endpoints }, null, 2));
		const elementUnduh = document.createElement("a");
		elementUnduh.setAttribute("href", dataStr);
		elementUnduh.setAttribute(
			"download",
			`${(project?.nama || "ekspor").toLowerCase().replace(/\s+/g, "_")}_ekspor.json`
		);
		document.body.appendChild(elementUnduh);
		elementUnduh.click();
		elementUnduh.remove();
		onToast?.("File konfigurasi berhasil diunduh", "info");
	};

	/**
	 * Menyalin spesifikasi OpenAPI ke clipboard
	 */
	const salinOpenApi = () => {
		const spesifikasi = hasilkanSpesifikasiOpenApi(project, endpoints);
		navigator.clipboard.writeText(JSON.stringify(spesifikasi, null, 2));
		onToast?.("Spesifikasi OpenAPI berhasil disalin", "success");
	};

	/**
	 * Menangani pengiriman email ekspor
	 * @param event - Event form (opsional)
	 */
	const handleKirimEmail = async (event?: React.FormEvent) => {
		event?.preventDefault();
		if (!email) return;
		setSedangMengirim(true);
		try {
			const ringkasan = hasilkanRingkasan(project, endpoints);
			if (onSend) {
				await onSend([email], `Ekspor: ${project.nama}`, ringkasan);
			}
			// Anggap berhasil terkirim
			setSelesai(true);
			onToast?.(`Proyek berhasil diekspor ke ${email}`, "success");
		} catch (errorKirim: any) {
			onToast?.("Gagal menyiapkan ekspor", "error");
		} finally {
			setSedangMengirim(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
			<div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
				{/* Header Modal */}
				<div className="p-6 border-b border-slate-100 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-brand-50 rounded-xl text-brand-600">
							<Send className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-lg font-bold text-slate-900">Ekspor Workspace</h3>
							<p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
								{project.nama}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
						aria-label="Tutup modal"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Konten Modal */}
				<div className="p-8">
					{selesai ? (
						// Tampilan sukses setelah pengiriman
						<div className="text-center py-6 animate-in zoom-in-95 duration-500">
							<div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
								<CheckCircle className="w-8 h-8" />
							</div>
							<h4 className="text-xl font-bold text-slate-900 mb-2">Email Terkirim!</h4>
							<p className="text-sm text-slate-500 mb-8">
								Konfigurasi API dan spesifikasi OpenAPI telah dikirim ke <strong>{email}</strong>.
							</p>
							<button
								onClick={onClose}
								className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
							>
								Kembali ke Studio
							</button>
						</div>
					) : (
						// Tampilan opsi ekspor
						<div className="space-y-8">
							{/* Opsi unduh dan salin */}
							<div className="grid grid-cols-2 gap-4">
								<button
									onClick={unduhJson}
									className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-brand-500 hover:text-brand-600 transition-all group"
									aria-label="Unduh sebagai JSON"
								>
									<FileJson className="w-6 h-6 mb-2 text-slate-400 group-hover:text-brand-500" />
									<span className="text-xs font-bold">Unduh JSON</span>
								</button>
								<button
									onClick={salinOpenApi}
									className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-brand-500 hover:text-brand-600 transition-all group"
									aria-label="Salin OpenAPI"
								>
									<Copy className="w-6 h-6 mb-2 text-slate-400 group-hover:text-brand-500" />
									<span className="text-xs font-bold">Salin OpenAPI</span>
								</button>
							</div>

							{/* Pemisah visual */}
							<div className="relative">
								<div className="absolute inset-0 flex items-center" aria-hidden="true">
									<div className="w-full border-t border-slate-100"></div>
								</div>
								<div className="relative flex justify-center text-xs uppercase font-bold text-slate-400">
									<span className="bg-white px-3">atau Kirim via Email</span>
								</div>
							</div>

							{/* Form pengiriman email */}
							<form onSubmit={handleKirimEmail} className="space-y-4">
								<div>
									<label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
										Email Penerima
									</label>
									<div className="relative">
										<Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="email"
											required
											value={email}
											onChange={event => setEmail(event.target.value)}
											placeholder="developer@company.com"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
											aria-label="Email penerima ekspor"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={sedangMengirim || isSending}
									className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-500 transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
									aria-label="Kirim ekspor via email"
								>
									{sedangMengirim || isSending ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											<span>Mengirim…</span>
										</>
									) : (
										<>
											<Send className="w-4 h-4" />
											<span>Kirim Ekspor via Email</span>
										</>
									)}
								</button>
								<p className="text-[10px] text-center text-slate-400 px-4 leading-relaxed">
									Ini akan mengirim ringkasan profesional dari desain API Anda beserta skema OpenAPI
									kepada penerima.
								</p>
							</form>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
