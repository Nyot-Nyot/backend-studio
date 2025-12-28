import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "primary" | "ghost" | "danger" | "icon";
	className?: string;
}

const variantClass = (v?: ButtonProps["variant"]) => {
	switch (v) {
		case "primary":
			return "btn btn--primary";
		case "ghost":
			return "btn btn--ghost";
		case "danger":
			return "btn btn--danger";
		case "icon":
			return "btn btn--icon";
		default:
			return "btn";
	}
};

const Button: React.FC<ButtonProps> = ({ variant = "default", className = "", children, ...rest }) => {
	return (
		<button className={`${variantClass(variant)} ${className}`} {...rest}>
			{children}
		</button>
	);
};

export default Button;
