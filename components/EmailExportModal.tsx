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
	if (unique.length === 0) return { error: "Enter at least one recipient email.", recipients: [] };
	const invalid = unique.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
	if (invalid.length > 0)
		return {
			error: `Invalid email(s): ${invalid.slice(0, 5).join(", ")}${
				invalid.length > 5 ? ` (+${invalid.length - 5} more)` : ""
			}.`,
			recipients: [],
		};
	if (unique.length > 10) return { error: `Too many recipients: ${unique.length}. Maximum is 10.`, recipients: [] };
	return { error: null, recipients: unique };
}

export default function EmailExportModal({ isOpen, onClose, onSend, sending, getAttachmentPreview }: Props) {
	const titleId = React.useId?.() || "email-export-modal-title";
	const descId = React.useId?.() || "email-export-modal-desc";

	const [recipients, setRecipients] = useState("");
	const [subject, setSubject] = useState("My Backend Studio export");
	const [message, setMessage] = useState("Hello! Please find the exported project attached.");
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
			setPreviewError(err?.message || "Failed to calculate preview.");
		} finally {
			setPreviewLoading(false);
		}
	}, [getAttachmentPreview, includeWorkspace, includeOpenApi, includeServer]);

	React.useEffect(() => {
		if (!isOpen) return;
		fetchPreview();
	}, [isOpen, fetchPreview]);

	if (!isOpen) return null;

	const handleSend = async () => {
		setError(null);
		const result = validateAndNormalizeRecipients(recipients);
		if (result.error) return setError(result.error);
		if (!includeWorkspace && !includeOpenApi && !includeServer) return setError("Select at least one attachment.");
		try {
			const normalized = result.recipients.join(", ");
			await onSend({ recipients: normalized, subject, message, includeWorkspace, includeOpenApi, includeServer });
		} catch (err: any) {
			setError(err?.message || "Send failed");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={<span id={titleId}>Send Project via Email</span>}
			description={<span id={descId}>Send your workspace and related files to chosen recipients.</span>}
			ariaLabelledBy={titleId}
			ariaDescribedBy={descId}
		>
			<div className="space-y-4">
				{/* Recipients */}
				<div>
					<Textarea
						label="Recipients"
						rows={3}
						placeholder="recipient@example.com, another@example.com"
						value={recipients}
						onChange={e => setRecipients(e.target.value)}
					/>
					<p className="text-xs text-slate-500 mt-1">
						Separate multiple addresses with commas, semicolons, or new lines. Max 10 recipients.
					</p>
				</div>

				{/* Subject & Message */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
					</div>
					<div>
						<Input label="Message" value={message} onChange={e => setMessage(e.target.value)} />
					</div>
				</div>

				{/* Attachments */}
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
							<input type="checkbox" checked={includeServer} onChange={() => setIncludeServer(s => !s)} />
							<span>server.js</span>
						</label>
					</div>
					<div className="mt-3 p-3 bg-amber-50 text-amber-800 text-xs rounded-md border border-amber-100">
						<strong>Warning:</strong> Attachments may contain sensitive data or credentials. Verify the
						recipients before sending.
					</div>
				</div>

				{/* Error */}
				{error && <div className="text-red-400 text-sm">{error}</div>}

				{/* Attachment preview */}
				<div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-300">
					<div className="font-medium mb-1">Attachment preview</div>
					{previewLoading ? (
						<div className="text-slate-500 text-xs">Calculating size…</div>
					) : previewError ? (
						<div className="text-amber-200 text-xs">
							<div className="mb-2">{previewError}</div>
							<button
								type="button"
								onClick={() => fetchPreview()}
								className="px-3 py-1 rounded bg-amber-600 text-white text-xs"
							>
								Retry
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
								Note: attachments will be uploaded to a temporary server and a short-lived download link
								will be included in the email body.
							</div>
						</div>
					) : (
						<div className="text-slate-500 text-xs">No attachments selected.</div>
					)}
				</div>
			</div>
			<footer>
				<Button variant="ghost" onClick={onClose} disabled={sending}>
					Cancel
				</Button>
				<Button variant="primary" onClick={handleSend} disabled={sending}>
					{sending ? "Sending…" : "Send Email"}
				</Button>
			</footer>
		</Modal>
	);
}
