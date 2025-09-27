"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { KeyRound, LayoutDashboard, LogOut } from "lucide-react";

import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
    {
        href: "/dashboard",
        label: "Dashboard",
        description: "Projects",
        icon: LayoutDashboard,
    },
    {
        href: "/keys",
        label: "Keys",
        description: "Manage keys",
        icon: KeyRound,
    },
] as const;

export function AppChrome({ children }: PropsWithChildren) {
    const pathname = usePathname();
    const [signingOut, setSigningOut] = useState(false);

    const activeHref = useMemo(() => {
        const current = NAV_ITEMS.find((item) => {
            return (
                pathname === item.href || pathname.startsWith(`${item.href}/`)
            );
        });
        return current?.href ?? "/dashboard";
    }, [pathname]);

    async function handleSignOut() {
        setSigningOut(true);
        try {
            await supabase.auth.signOut();
            window.location.href = "/";
        } finally {
            setSigningOut(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black text-green-100">
            <div className="flex min-h-screen flex-col">
                <div className="border-b border-green-500/20 bg-black/50 px-6 py-4 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
                        <Link
                            href="/dashboard"
                            className="text-xl font-semibold text-green-300 font-mono">
                            ripenv
                        </Link>

                        <div className="flex items-center gap-4">
                            {NAV_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeHref === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium font-mono transition-colors",
                                            isActive
                                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                                : "text-green-500/80 hover:bg-green-500/10 hover:text-green-300"
                                        )}>
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <Button
                                variant="outline"
                                onClick={handleSignOut}
                                disabled={signingOut}
                                className="text-sm border-green-500/30 text-green-400 hover:border-green-400 hover:text-green-300">
                                <LogOut className="h-4 w-4" />
                                {signingOut ? "Signing out..." : "Sign out"}
                            </Button>
                        </div>
                    </div>
                </div>

                <main className="flex-1">
                    <div className="mx-auto w-full max-w-6xl px-6 py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
