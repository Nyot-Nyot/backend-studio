import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

// Allow callers to specify an optional duration (ms) per toast.
export interface ToastMessage {
	id: string;
	type: ToastType;
	message: string;
	duration?: number; // milliseconds; if omitted, a default based on type is used. 0 or negative -> persistent until manual dismiss
}

interface ToastProps {
	toasts: ToastMessage[];
	removeToast: (id: string) => void;
	defaultDuration?: number; // optional global override
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
	return (
		<div
			className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
			aria-live="polite"
			aria-atomic="true"
			role="region"
		>
			{toasts.map(toast => (
				<ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
			))}
		</div>
	);
};

// Default durations per type (ms)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
	success: 4000,
	info: 4000,
	// errors are important; give them a longer default so users have time to read
	error: 8000,
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
	const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];

	useEffect(() => {
		if (typeof duration === "number" && duration > 0) {
			const timer = setTimeout(() => {
				onRemove();
			}, duration);
			return () => clearTimeout(timer);
		}
		return;
	}, [onRemove, duration]);

	const bgColors = {
		success: "bg-white border-green-200",
		error: "bg-white border-red-200",
		info: "bg-white border-blue-200",
	};

	const icons = {
		success: <CheckCircle className="w-5 h-5 text-green-500" />,
		error: <AlertCircle className="w-5 h-5 text-red-500" />,
		info: <Info className="w-5 h-5 text-brand-500" />,
	};

	const ariaLive = toast.type === "error" ? "assertive" : "polite";

	return (
		<div
			role="status"
			aria-live={ariaLive}
			aria-atomic="true"
			className={`pointer-events-auto flex items-center p-4 rounded-xl shadow-lg border ${
				bgColors[toast.type]
			} min-w-[300px] animate-in slide-in-from-right-10 fade-in duration-300`}
		>
			<div className="flex-shrink-0 mr-3">{icons[toast.type]}</div>
			<p className="text-sm font-medium text-slate-700 flex-1">{toast.message}</p>
			<button
				aria-label="Dismiss notification"
				type="button"
				onClick={onRemove}
				className="ml-3 text-slate-400 hover:text-slate-600 transition-colors"
			>
				<X className="w-4 h-4" />
			</button>
		</div>
	);
};
