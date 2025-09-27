"use client";

import type { PropsWithChildren, ReactNode } from "react";

type TableProps = PropsWithChildren<{
    header?: ReactNode;
}>;

export function Table({ header, children }: TableProps) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
            {header && (
                <div className="border-b border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300">
                    {header}
                </div>
            )}
            <table className="min-w-full divide-y divide-slate-700 text-sm text-slate-200">
                <tbody className="divide-y divide-slate-700">{children}</tbody>
            </table>
        </div>
    );
}

type RowProps = PropsWithChildren<{
    actions?: ReactNode;
}>;

export function TableRow({ children, actions }: RowProps) {
    return (
        <tr className="hover:bg-slate-800">
            <td className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">{children}</div>
                    {actions && (
                        <div className="flex items-center gap-2 text-xs">
                            {actions}
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}
