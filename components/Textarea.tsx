import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string | null;
	id?: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, error = null, id, className = "", ...rest }) => {
	const inputId = id || (label ? label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : undefined);
	return (
		<div>
			{label && (
				<label htmlFor={inputId} className="block text-xs text-slate-300 mb-2">
					{label}
				</label>
			)}
			<textarea id={inputId} className={`textarea ${error ? "textarea--invalid" : ""} ${className}`} {...rest} />
			{error && <div className="text-xs text-red-400 mt-1">{error}</div>}
		</div>
	);
};

export default Textarea;
