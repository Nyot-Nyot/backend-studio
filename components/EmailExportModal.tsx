import React, { useState } from "react";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";
import Textarea from "./Textarea";

export type EmailExportParams = {
	recipients: string; // comma or newline separated
	subject: string;
	message: string;
	includeWorkspace: boolean;
	includeOpenApi: boolean;
	includeServer: boolean;
};

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSend: (params: EmailExportParams) => Promise<void>;
	sending?: boolean;
	getAttachmentPreview?: (opts: {
		includeWorkspace: boolean;
		includeOpenApi: boolean;
		includeServer: boolean;
	}) => Promise<{ name: string; size: number }[]>;
};

export function validateAndNormalizeRecipients(raw: string) {
	const list = raw
		.split(/[\n,;]+/)
		.map(s => s.trim())
		.filter(Boolean);
	const unique = Array.from(new Set(list));
	if (unique.length === 0) return { error: "Masukkan setidaknya satu email penerima.", recipients: [] };
	const invalid = unique.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
	if (invalid.length > 0)
		return {
			error: `Email tidak valid: ${invalid.slice(0, 5).join(", ")}${
				invalid.length > 5 ? ` (+${invalid.length - 5} lainnya)` : ""
			}.`,
			recipients: [],
		};
	if (unique.length > 10) return { error: `Terlalu banyak penerima: ${unique.length}. Maksimum 10.`, recipients: [] };
	return { error: null, recipients: unique };
}

export default function EmailExportModal({ isOpen, onClose, onSend, sending, getAttachmentPreview }: Props) {
	const titleId = React.useId?.() || "email-export-modal-title";
	const descId = React.useId?.() || "email-export-modal-desc";

	const [recipients, setRecipients] = useState("");
	const [subject, setSubject] = useState("Ekspor Backend Studio");
	const [message, setMessage] = useState("Halo! Silakan unduh berkas ekspor workspace pada tautan di bawah.");
	const [includeWorkspace, setIncludeWorkspace] = useState(true);
	const [includeOpenApi, setIncludeOpenApi] = useState(true);
	const [includeServer, setIncludeServer] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<{ name: string; size: number }[] | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	const fetchPreview = React.useCallback(async () => {
		if (!getAttachmentPreview) return setPreview(null);
		setPreviewError(null);
		setPreviewLoading(true);
		try {
			const p = await getAttachmentPreview({ includeWorkspace, includeOpenApi, includeServer });
			setPreview(p);
		} catch (err: any) {
			setPreview(null);
			setPreviewError((err as any)?.message || "Gagal menghitung pratinjau.");
		} finally {
			setPreviewLoading(false);
		}
	}, [getAttachmentPreview, includeWorkspace, includeOpenApi, includeServer]);

	React.useEffect(() => {
		if (!isOpen) return;
		fetchPreview();
	}, [isOpen, fetchPreview]);

	if (!isOpen) return null; // Modal tidak ditampilkan jika isOpen false

	const handleSend = async () => {
		setError(null);
		const result = validateAndNormalizeRecipients(recipients);
		if (result.error) return setError(result.error);
		if (!includeWorkspace && !includeOpenApi && !includeServer) return setError("Pilih setidaknya satu lampiran.");
		try {
			const normalized = result.recipients.join(", ");
			await onSend({ recipients: normalized, subject, message, includeWorkspace, includeOpenApi, includeServer });
		} catch (err: unknown) {
			const e = err as Error;
			setError(e?.message || "Pengiriman gagal");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={<span id={titleId}>Kirim Workspace lewat Email</span>}
			description={<span id={descId}>Kirim workspace dan berkas terkait ke alamat email yang dipilih.</span>}
			ariaLabelledBy={titleId}
			ariaDescribedBy={descId}
		>
			<div className="space-y-4">
				{/* Penerima */}
				<div>
					<Textarea
						label="Penerima"
						rows={3}
						placeholder="alamat@example.com, lain@example.com"
						value={recipients}
						onChange={e => setRecipients(e.target.value)}
					/>
					<p className="text-xs text-slate-500 mt-1">
						Pisahkan alamat dengan koma, titik koma, atau baris baru. Maksimum 10 penerima.
					</p>
				</div>

				{/* Subjek & Pesan */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<Input label="Subjek" value={subject} onChange={e => setSubject(e.target.value)} />
					</div>
					<div>
						<Input label="Pesan" value={message} onChange={e => setMessage(e.target.value)} />
					</div>
				</div>

				{/* Lampiran */}
				<div>
					<label className="block text-xs text-slate-300 mb-2">Lampiran</label>
					<div className="flex flex-col gap-2">
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={includeWorkspace}
								onChange={() => setIncludeWorkspace(s => !s)}
							/>
							<span>Workspace (JSON)</span>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={includeOpenApi}
								onChange={() => setIncludeOpenApi(s => !s)}
							/>
							<span>OpenAPI (JSON)</span>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={includeServer} onChange={() => setIncludeServer(s => !s)} />
							<span>server.js</span>
						</label>
					</div>
					<div className="mt-3 p-3 bg-amber-50 text-amber-800 text-xs rounded-md border border-amber-100">
						<strong>Peringatan:</strong> Lampiran bisa berisi data sensitif atau kredensial. Periksa
						penerima sebelum mengirim.
					</div>
				</div>

				{/* Error */}
				{error && <div className="text-red-400 text-sm">{error}</div>}

				{/* Attachment preview */}
				<div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-300">
					<div className="font-medium mb-1">Pratinjau Lampiran</div>
					{previewLoading ? (
						<div className="text-slate-500 text-xs">Menghitung ukuran…</div>
					) : previewError ? (
						<div className="text-amber-200 text-xs">
							<div className="mb-2">{previewError}</div>
							<button
								type="button"
								onClick={() => fetchPreview()}
								className="px-3 py-1 rounded bg-amber-600 text-white text-xs"
							>
								Coba lagi
							</button>
						</div>
					) : preview && preview.length > 0 ? (
						<div className="text-slate-400 text-xs">
							<ul className="list-disc pl-4 space-y-1">
								{preview.map(p => (
									<li key={p.name} className="flex justify-between">
										<span>{p.name}</span>
										<span className="text-slate-500">{(p.size / 1024).toFixed(1)} KB</span>
									</li>
								))}
							</ul>
							<div className="mt-2 text-slate-500 text-xs">
								Catatan: lampiran akan diunggah ke server sementara dan tautan unduhan yang berlaku
								singkat akan disertakan dalam isi email.
							</div>
						</div>
					) : (
						<div className="text-slate-500 text-xs">Tidak ada lampiran yang dipilih.</div>
					)}
				</div>
			</div>
			<footer>
				<Button variant="ghost" onClick={onClose} disabled={sending}>
					Batal
				</Button>
				<Button variant="primary" onClick={handleSend} disabled={sending}>
					{sending ? "Mengirim…" : "Kirim Email"}
				</Button>
			</footer>
		</Modal>
	);
}
