"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { magicLinkSchema } from "@/lib/z";

export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadUser() {
            const { data, error: userError } = await supabase.auth.getUser();
            if (!mounted) return;
            if (!userError && data.user) {
                setSessionEmail(data.user.email ?? null);
            }
            setChecking(false);
        }

        loadUser();
        return () => {
            mounted = false;
        };
    }, []);

    async function handleSignIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setMessage(null);

        const parsed = magicLinkSchema.safeParse({ email });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid email");
            return;
        }

        const { error: authError } = await supabase.auth.signInWithOtp({
            email: parsed.data.email,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard`,
            },
        });

        if (authError) {
            setError(authError.message);
        } else {
            setMessage("Check your inbox for a magic link.");
        }
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16">
            <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-xs text-slate-400">
                    <span>ripenv MVP</span>
                    <span className="h-1 w-1 rounded-full bg-brand-500" />
                    <span>Encrypted envs, local-first</span>
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl">
                    Encrypt your secrets locally.
                </h1>
                <p className="mt-4 max-w-2xl text-base text-slate-400">
                    ripenv keeps `.env` files encrypted end-to-end. Generate
                    keys in the browser, export recipient manifests, and use the
                    Python CLI to perform all cryptographic operations on your
                    machine.
                </p>
            </div>

            <div className="grid w-full gap-6 lg:grid-cols-[2fr,3fr]">
                <Card
                    title="Sign in with magic link"
                    description="We only need your email to send a sign-in link via Supabase Auth.">
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <label className="block text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setEmail(event.target.value)
                            }
                            required
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
                            placeholder="you@example.com"
                        />
                        <Button type="submit" className="w-full">
                            Send magic link
                        </Button>
                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}
                        {message && (
                            <p className="text-sm text-emerald-400">
                                {message}
                            </p>
                        )}
                    </form>
                </Card>

                <Card
                    title="Already signed in?"
                    description={
                        checking
                            ? "Checking your session..."
                            : sessionEmail
                            ? `Logged in as ${sessionEmail}`
                            : "You will see your projects and keys once authenticated."
                    }>
                    <div className="space-y-4">
                        <p>
                            Head over to your dashboard to manage projects and
                            export recipients for the CLI.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-brand-500 hover:bg-brand-500/10">
                            Open dashboard
                        </Link>
                    </div>
                </Card>
            </div>
        </main>
    );
}
