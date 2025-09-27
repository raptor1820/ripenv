"use client";

import type { MouseEventHandler, ReactNode } from "react";

export interface ButtonProps {
    variant?: "primary" | "outline";
    className?: string;
    type?: "button" | "submit" | "reset";
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    children?: ReactNode;
}

const baseStyles =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

export function Button({
    variant = "primary",
    className,
    children,
    ...props
}: ButtonProps) {
    const variantStyles =
        variant === "primary"
            ? "bg-brand-500 hover:bg-brand-600 text-white focus-visible:outline-brand-500"
            : "border border-slate-700 bg-transparent text-slate-200 hover:border-brand-500 focus-visible:outline-brand-500";

    const classes = `${baseStyles} ${variantStyles} ${className ?? ""}`.trim();

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    );
}
