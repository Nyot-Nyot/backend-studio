import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string | null;
	id?: string;
}

const Input: React.FC<InputProps> = ({ label, error = null, id, className = "", ...rest }) => {
	const inputId = id || (label ? label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : undefined);
	return (
		<div>
			{label && (
				<label htmlFor={inputId} className="block text-xs text-slate-300 mb-2">
					{label}
				</label>
			)}
			<input id={inputId} className={`input ${error ? "input--invalid" : ""} ${className}`} {...rest} />
			{error && <div className="text-xs text-red-400 mt-1">{error}</div>}
		</div>
	);
};

export default Input;
