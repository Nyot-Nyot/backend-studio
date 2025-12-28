import React from "react";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: React.ReactNode;
	description?: React.ReactNode;
	children?: React.ReactNode;
	footer?: React.ReactNode;
	ariaLabelledBy?: string;
	ariaDescribedBy?: string;
	maxWidth?: string; // css string like '600px' or 'max-w-2xl'
};

export default function Modal({
	isOpen,
	onClose,
	title,
	description,
	children,
	footer,
	ariaLabelledBy,
	ariaDescribedBy,
	maxWidth = "680px",
}: ModalProps) {
	const dialogRef = React.useRef<HTMLDivElement | null>(null);
	const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

	React.useEffect(() => {
		if (!isOpen) return;
		previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
		const el = dialogRef.current;
		setTimeout(() => {
			if (!el) return;
			const focusable = el.querySelectorAll<HTMLElement>(
				'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length) focusable[0].focus();
			else el.focus();
		}, 0);

		const onOverlayClick = (ev: MouseEvent) => {
			if (!dialogRef.current) return;
			if (!dialogRef.current.contains(ev.target as Node)) onClose();
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				return;
			}
			if (e.key === "Tab") {
				const dialog = dialogRef.current;
				if (!dialog) return;
				const focusable = Array.from(
					dialog.querySelectorAll<HTMLElement>(
						'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
					)
				).filter(f => !f.hasAttribute("disabled"));
				if (focusable.length === 0) {
					e.preventDefault();
					return;
				}
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (e.shiftKey) {
					if (document.activeElement === first) {
						e.preventDefault();
						last.focus();
					}
				} else {
					if (document.activeElement === last) {
						e.preventDefault();
						first.focus();
					}
				}
			}
		};

		document.addEventListener("mousedown", onOverlayClick);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onOverlayClick);
			document.removeEventListener("keydown", onKeyDown);
			if (previouslyFocusedRef.current && document.contains(previouslyFocusedRef.current))
				previouslyFocusedRef.current.focus();
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center" aria-hidden={!isOpen}>
			<div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={ariaLabelledBy}
				aria-describedby={ariaDescribedBy}
				className="rounded-2xl shadow-2xl border overflow-hidden theme-surface theme-border"
				style={{ width: "100%", maxWidth, padding: "var(--space-4)" }}
			>
				<div style={{ padding: "calc(var(--space-4) - 4px)" }}>
					{title && (
						<div className="mb-2">
							<h2 className="text-lg font-bold theme-text">{title}</h2>
							{description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
						</div>
					)}

					<div className="mb-4">{children}</div>

					{footer && <div className="flex justify-end gap-3">{footer}</div>}
				</div>
			</div>
		</div>
	);
}
