"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type AuthGateProps = PropsWithChildren<{
    fallback?: ReactNode;
}>;

export function AuthGate({ children, fallback }: AuthGateProps) {
    const [status, setStatus] = useState<"loading" | "authed" | "guest">(
        "loading"
    );

    useEffect(() => {
        let cancelled = false;

        supabase.auth.getSession().then(({ data }) => {
            if (!cancelled) {
                setStatus(data.session ? "authed" : "guest");
            }
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setStatus(session ? "authed" : "guest");
            }
        );

        return () => {
            cancelled = true;
            listener?.subscription.unsubscribe();
        };
    }, []);

    if (status === "loading") {
        return (
            <div className="flex min-h-[200px] items-center justify-center text-slate-400">
                Checking your session...
            </div>
        );
    }

    if (status === "guest") {
        return (
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-300">
                {fallback ?? "You need to sign in to view this content."}
            </div>
        );
    }

    return <>{children}</>;
}
