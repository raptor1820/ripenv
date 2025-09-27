"use client";

import type { PropsWithChildren, ReactNode } from "react";

type CardProps = PropsWithChildren<{
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}>;

export function Card({ title, description, actions, children }: CardProps) {
    return (
        <section className="rounded-lg border border-green-500/20 bg-black/40 backdrop-blur p-6">
            {(title || description || actions) && (
                <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        {title && (
                            <h2 className="text-lg font-semibold text-green-300 font-mono">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="mt-1 text-sm text-green-500/80">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2">{actions}</div>
                    )}
                </header>
            )}
            <div className="space-y-4 text-sm text-green-100">{children}</div>
        </section>
    );
}
