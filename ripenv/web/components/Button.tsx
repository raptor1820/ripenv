"use client";

import type { MouseEventHandler, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface ButtonProps {
    variant?: "primary" | "outline" | "glass";
    className?: string;
    type?: "button" | "submit" | "reset";
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    children?: ReactNode;
}

const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60";

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
        "bg-green-500 text-black hover:bg-green-400 focus-visible:outline-green-500 font-mono font-semibold",
    outline:
        "border border-green-500/50 bg-transparent text-green-400 hover:border-green-400 hover:text-green-300 hover:bg-green-500/10 focus-visible:outline-green-500 font-mono",
    glass: "border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 focus-visible:outline-green-500 font-mono backdrop-blur",
};

export function Button({
    variant = "primary",
    className,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cn(baseStyles, variantStyles[variant], className)}
            {...props}>
            {children}
        </button>
    );
}
