"use client";

import type { PropsWithChildren, ReactNode } from "react";

type CardProps = PropsWithChildren<{
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}>;

export function Card({ title, description, actions, children }: CardProps) {
    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            {(title || description || actions) && (
                <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        {title && (
                            <h2 className="text-lg font-semibold text-slate-100">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="mt-1 text-sm text-slate-400">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2">{actions}</div>
                    )}
                </header>
            )}
            <div className="space-y-4 text-sm text-slate-200">{children}</div>
        </section>
    );
}
