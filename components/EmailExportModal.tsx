import React, { useState } from "react";

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

export default function EmailExportModal({ isOpen, onClose, onSend, sending, getAttachmentPreview }: Props) {
	const [recipients, setRecipients] = useState("");
	const [subject, setSubject] = useState("My Backend Studio export");
	const [message, setMessage] = useState("Hello! Please find the exported project attached.");
	const [includeWorkspace, setIncludeWorkspace] = useState(true);
	const [includeOpenApi, setIncludeOpenApi] = useState(true);
	const [includeServer, setIncludeServer] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<{ name: string; size: number }[] | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);

	const fetchPreview = async () => {
		if (!getAttachmentPreview) return setPreview(null);
		setPreviewLoading(true);
		try {
			const p = await getAttachmentPreview({ includeWorkspace, includeOpenApi, includeServer });
			setPreview(p);
		} catch (err) {
			setPreview(null);
		} finally {
			setPreviewLoading(false);
		}
	};

	React.useEffect(() => {
		if (isOpen) fetchPreview();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, includeWorkspace, includeOpenApi, includeServer]);

	if (!isOpen) return null;

	const validateRecipients = (raw: string) => {
		const list = raw
			.split(/[\n,;]+/)
			.map(s => s.trim())
			.filter(Boolean);
		if (list.length === 0) return "Enter at least one recipient email.";
		const bad = list.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
		if (bad) return `Invalid email: ${bad}`;
		if (list.length > 10) return "Max 10 recipients supported.";
		return null;
	};

	const handleSend = async () => {
		setError(null);
		const v = validateRecipients(recipients);
		if (v) return setError(v);
		if (!includeWorkspace && !includeOpenApi && !includeServer) return setError("Select at least one attachment.");
		try {
			await onSend({ recipients, subject, message, includeWorkspace, includeOpenApi, includeServer });
		} catch (err: any) {
			setError(err?.message || "Send failed");
		}
	};

	return (
		<div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
			<div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden">
				<div className="p-6 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-bold text-white">Send Project via Email</h2>
						<p className="text-slate-400 text-sm mt-1">
							Send your workspace and related files to chosen recipients.
						</p>
					</div>
					<button onClick={onClose} className="text-slate-500 hover:text-white">
						×
					</button>
				</div>

				<div className="p-6 space-y-4">
					<div>
						<label className="block text-xs text-slate-300 mb-2">Recipients</label>
						<textarea
							className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-200 text-sm resize-none"
							rows={3}
							placeholder="recipient@example.com, another@example.com"
							value={recipients}
							onChange={e => setRecipients(e.target.value)}
						/>
						<p className="text-xs text-slate-500 mt-1">
							Separate multiple addresses with commas, semicolons, or new lines. Max 10 recipients.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="block text-xs text-slate-300 mb-2">Subject</label>
							<input
								className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-200 text-sm"
								value={subject}
								onChange={e => setSubject(e.target.value)}
							/>
						</div>

						<div>
							<label className="block text-xs text-slate-300 mb-2">Message</label>
							<input
								className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-200 text-sm"
								value={message}
								onChange={e => setMessage(e.target.value)}
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs text-slate-300 mb-2">Attachments</label>
						<div className="flex flex-col gap-2">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={includeWorkspace}
									onChange={() => setIncludeWorkspace(s => !s)}
								/>
								<span>Workspace JSON</span>
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={includeOpenApi}
									onChange={() => setIncludeOpenApi(s => !s)}
								/>
								<span>OpenAPI JSON</span>
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={includeServer}
									onChange={() => setIncludeServer(s => !s)}
								/>
								<span>server.js</span>
							</label>
						</div>

						<div className="mt-3 p-3 bg-amber-50 text-amber-800 text-xs rounded-md border border-amber-100">
							<strong>Warning:</strong> Attachments may contain sensitive data or credentials. Verify the
							recipients before sending.
						</div>
					</div>

					{error && <div className="text-red-400 text-sm">{error}</div>}

					<div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-300">
						<div className="font-medium mb-1">Attachment preview</div>
						{previewLoading ? (
							<div className="text-slate-500 text-xs">Calculating size…</div>
						) : preview && preview.length > 0 ? (
							<div className="text-slate-400 text-xs">
								<ul className="list-disc pl-4 space-y-1">
									{preview.map(p => (
										<li key={p.name} className="flex justify-between">
											<span>{p.name}</span>
											<span className="text-slate-500">{(p.size / 1024).toFixed(1)} KB</span>
										</li>
									))}
								</ul>{" "}
								<div className="mt-2 text-slate-500 text-xs">
									Note: attachments will be uploaded to a temporary server and a short-lived download
									link will be included in the email body.
								</div>{" "}
							</div>
						) : (
							<div className="text-slate-500 text-xs">No attachments selected.</div>
						)}
					</div>
				</div>

				<div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
					<button
						onClick={onClose}
						className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
						disabled={sending}
					>
						Cancel
					</button>
					<button
						onClick={handleSend}
						className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-200 transition-colors"
						disabled={sending}
					>
						{sending ? "Sending…" : "Send Email"}
					</button>
				</div>
			</div>
		</div>
	);
}
