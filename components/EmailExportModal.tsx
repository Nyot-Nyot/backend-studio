// EmailExportModal.tsx
import React, { useState } from "react";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";
import Textarea from "./Textarea";

/**
 * Parameter untuk ekspor email
 * Berisi konfigurasi penerima, subjek, pesan, dan lampiran
 */
export type ParameterEksporEmail = {
	/**
	 * Daftar penerima (dipisahkan koma atau baris baru)
	 */
	penerima: string;

	/**
	 * Subjek email
	 */
	subjek: string;

	/**
	 * Pesan email
	 */
	pesan: string;

	/**
	 * Apakah menyertakan workspace dalam lampiran
	 */
	sertakanWorkspace: boolean;

	/**
	 * Apakah menyertakan OpenAPI dalam lampiran
	 */
	sertakanOpenApi: boolean;

	/**
	 * Apakah menyertakan server.js dalam lampiran
	 */
	sertakanServer: boolean;
};

/**
 * Properti untuk komponen ModalEksporEmail
 */
import { ParameterEksporEmail as TypesParameterEksporEmail } from "../types";

interface PropertiModalEksporEmail {
	/**
	 * Status apakah modal terbuka
	 */
	terbuka: boolean;

	/**
	 * Fungsi untuk menutup modal
	 */
	padaTutup: () => void;

	/**
	 * Fungsi untuk mengirim email
	 * @param parameter - Parameter ekspor email (menggunakan tipe dari `types.ts` untuk kompatibilitas)
	 */
	padaKirim: (parameter: TypesParameterEksporEmail) => Promise<void>;

	/**
	 * Status apakah email sedang dikirim
	 */
	sedangMengirim?: boolean;

	/**
	 * Fungsi untuk mendapatkan pratinjau lampiran
	 * @param opsi - Opsi lampiran yang dipilih
	 * @returns Promise yang berisi daftar lampiran dengan nama dan ukuran
	 */
	dapatkanPratinjauLampiran?: (opsi: {
		sertakanWorkspace: boolean;
		sertakanOpenApi: boolean;
		sertakanServer: boolean;
	}) => Promise<{ nama: string; ukuran: number }[]>;
}

/**
 * Fungsi untuk memvalidasi dan menormalisasi daftar penerima email
 * @param teksMentah - String mentah yang berisi daftar penerima
 * @returns Objek dengan status error dan daftar penerima yang sudah dinormalisasi
 */
export function validasiDanNormalisasiPenerima(teksMentah: string) {
	// Pisahkan berdasarkan berbagai pemisah (newline, koma, titik koma)
	const daftar = teksMentah
		.split(/[\n,;]+/)
		.map(teks => teks.trim()) // Hapus spasi di awal/akhir
		.filter(teks => teks.length > 0); // Hapus string kosong

	// Hapus duplikat
	const unik = Array.from(new Set(daftar));

	// Validasi: minimal ada satu penerima
	if (unik.length === 0) {
		return {
			error: "Masukkan minimal satu alamat email penerima.",
			penerima: [],
		};
	}

	// Validasi: format email harus valid
	const tidakValid = unik.filter(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

	if (tidakValid.length > 0) {
		return {
			error: `Email tidak valid: ${tidakValid.slice(0, 5).join(", ")}${
				tidakValid.length > 5 ? ` (+${tidakValid.length - 5} lainnya)` : ""
			}.`,
			penerima: [],
		};
	}

	// Validasi: maksimal 10 penerima
	if (unik.length > 10) {
		return {
			error: `Terlalu banyak penerima: ${unik.length}. Maksimal 10 penerima.`,
			penerima: [],
		};
	}

	// Jika semua valid, kembalikan daftar penerima
	return { error: null, penerima: unik };
}

/**
 * Komponen Modal untuk mengirim ekspor proyek via email
 * Menangani input penerima, subjek, pesan, dan pilihan lampiran
 */
export default function ModalEksporEmail({
	terbuka,
	padaTutup,
	padaKirim,
	sedangMengirim,
	dapatkanPratinjauLampiran,
}: PropertiModalEksporEmail) {
	// ID untuk aksesibilitas (aria-labelledby, aria-describedby)
	const idJudul = React.useId?.() || "modal-ekspor-email-judul";
	const idDeskripsi = React.useId?.() || "modal-ekspor-email-deskripsi";

	// State untuk form
	const [penerima, setPenerima] = useState("");
	const [subjek, setSubjek] = useState("Ekspor Backend Studio saya");
	const [pesan, setPesan] = useState("Halo! Silakan lihat proyek yang diekspor di lampiran.");
	const [sertakanWorkspace, setSertakanWorkspace] = useState(true);
	const [sertakanOpenApi, setSertakanOpenApi] = useState(true);
	const [sertakanServer, setSertakanServer] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pratinjau, setPratinjau] = useState<{ nama: string; ukuran: number }[] | null>(null);
	const [pratinjauLoading, setPratinjauLoading] = useState(false);
	const [pratinjauError, setPratinjauError] = useState<string | null>(null);

	/**
	 * Fungsi untuk mengambil pratinjau lampiran
	 */
	const ambilPratinjau = React.useCallback(async () => {
		if (!dapatkanPratinjauLampiran) {
			setPratinjau(null);
			return;
		}

		setPratinjauError(null);
		setPratinjauLoading(true);

		try {
			const hasilPratinjau = await dapatkanPratinjauLampiran({
				sertakanWorkspace,
				sertakanOpenApi,
				sertakanServer,
			});
			setPratinjau(hasilPratinjau);
		} catch (error: any) {
			setPratinjau(null);
			setPratinjauError(error?.message || "Gagal menghitung pratinjau.");
		} finally {
			setPratinjauLoading(false);
		}
	}, [dapatkanPratinjauLampiran, sertakanWorkspace, sertakanOpenApi, sertakanServer]);

	// Ambil pratinjau saat modal terbuka atau pilihan lampiran berubah
	React.useEffect(() => {
		if (!terbuka) return;
		ambilPratinjau();
	}, [terbuka, ambilPratinjau]);

	// Jika modal tidak terbuka, jangan render apa-apa
	if (!terbuka) return null;

	/**
	 * Handler untuk mengirim email
	 */
	const handleKirim = async () => {
		setError(null);

		// Validasi penerima
		const hasilValidasi = validasiDanNormalisasiPenerima(penerima);
		if (hasilValidasi.error) {
			return setError(hasilValidasi.error);
		}

		// Validasi: minimal satu lampiran dipilih
		if (!sertakanWorkspace && !sertakanOpenApi && !sertakanServer) {
			return setError("Pilih minimal satu lampiran.");
		}

		try {
			// Array penerima yang sudah ternormalisasi
			const penerimaTernormalisasi = hasilValidasi.penerima;

			// Panggil handler dengan bentuk parameter sesuai `types.ts` (bahasa Inggris)
			await padaKirim({
				recipients: penerimaTernormalisasi,
				subject: subjek,
				message: pesan,
				includeWorkspace: sertakanWorkspace,
				includeOpenApi: sertakanOpenApi,
				includeServer: sertakanServer,
			});
		} catch (error: any) {
			setError(error?.message || "Gagal mengirim email");
		}
	};

	return (
		<Modal
			isOpen={terbuka}
			onClose={padaTutup}
			title={<span id={idJudul}>Kirim Proyek via Email</span>}
			description={<span id={idDeskripsi}>Kirim workspace dan file terkait ke penerima yang dipilih.</span>}
			ariaLabelledBy={idJudul}
			ariaDescribedBy={idDeskripsi}
		>
			<div className="space-y-4">
				{/* Input Penerima */}
				<div>
					<Textarea
						label="Penerima"
						rows={3}
						placeholder="penerima@contoh.com, lainnya@contoh.com"
						value={penerima}
						onChange={e => setPenerima(e.target.value)}
					/>
					<p className="text-xs text-slate-500 mt-1">
						Pisahkan beberapa alamat dengan koma, titik koma, atau baris baru. Maksimal 10 penerima.
					</p>
				</div>

				{/* Input Subjek dan Pesan */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<Input label="Subjek" value={subjek} onChange={e => setSubjek(e.target.value)} />
					</div>
					<div>
						<Input label="Pesan" value={pesan} onChange={e => setPesan(e.target.value)} />
					</div>
				</div>

				{/* Pilihan Lampiran */}
				<div>
					<label className="block text-xs text-slate-300 mb-2">Lampiran</label>
					<div className="flex flex-col gap-2">
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={sertakanWorkspace}
								onChange={() => setSertakanWorkspace(sebelumnya => !sebelumnya)}
							/>
							<span>Workspace JSON</span>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={sertakanOpenApi}
								onChange={() => setSertakanOpenApi(sebelumnya => !sebelumnya)}
							/>
							<span>OpenAPI JSON</span>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={sertakanServer}
								onChange={() => setSertakanServer(sebelumnya => !sebelumnya)}
							/>
							<span>server.js</span>
						</label>
					</div>
					<div className="mt-3 p-3 bg-amber-50 text-amber-800 text-xs rounded-md border border-amber-100">
						<strong>Peringatan:</strong> Lampiran mungkin berisi data sensitif atau kredensial. Verifikasi
						penerima sebelum mengirim.
					</div>
				</div>

				{/* Tampilkan Error */}
				{error && <div className="text-red-400 text-sm">{error}</div>}

				{/* Pratinjau Lampiran */}
				<div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-300">
					<div className="font-medium mb-1">Pratinjau Lampiran</div>
					{pratinjauLoading ? (
						<div className="text-slate-500 text-xs">Menghitung ukuran…</div>
					) : pratinjauError ? (
						<div className="text-amber-200 text-xs">
							<div className="mb-2">{pratinjauError}</div>
							<button
								type="button"
								onClick={() => ambilPratinjau()}
								className="px-3 py-1 rounded bg-amber-600 text-white text-xs"
							>
								Coba Lagi
							</button>
						</div>
					) : pratinjau && pratinjau.length > 0 ? (
						<div className="text-slate-400 text-xs">
							<ul className="list-disc pl-4 space-y-1">
								{pratinjau.map(lampiran => (
									<li key={lampiran.nama} className="flex justify-between">
										<span>{lampiran.nama}</span>
										<span className="text-slate-500">{(lampiran.ukuran / 1024).toFixed(1)} KB</span>
									</li>
								))}
							</ul>
							<div className="mt-2 text-slate-500 text-xs">
								Catatan: lampiran akan diunggah ke server sementara dan tautan unduhan singkat akan
								disertakan dalam email.
							</div>
						</div>
					) : (
						<div className="text-slate-500 text-xs">Tidak ada lampiran yang dipilih.</div>
					)}
				</div>
			</div>

			{/* Footer Modal */}
			<footer>
				<Button varian="ghost" onClick={padaTutup} disabled={sedangMengirim}>
					Batal
				</Button>
				<Button varian="primary" onClick={handleKirim} disabled={sedangMengirim}>
					{sedangMengirim ? "Mengirim…" : "Kirim Email"}
				</Button>
			</footer>
		</Modal>
	);
}

// Backward-compatible alias: jika kode lain mengimpor dengan nama Bahasa Inggris
export type EmailExportParams = ParameterEksporEmail;
export type ModalExportProps = PropertiModalEksporEmail;
