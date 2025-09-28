"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowRight, Shield, Zap, Lock, Eye } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TerminalCursor } from "@/components/TerminalCursor";
import { MatrixRain } from "@/components/MatrixRain";
import { CyberGrid } from "@/components/CyberGrid";
import { DecryptedText } from "@/components/DecryptedText";
import { supabase } from "@/lib/supabase";
import { magicLinkSchema } from "@/lib/z";

export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

        const updateMousePos = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        document.addEventListener("mousemove", updateMousePos);
        document.body.style.cursor = "none";

        loadUser();
        return () => {
            mounted = false;
            document.removeEventListener("mousemove", updateMousePos);
            document.body.style.cursor = "auto";
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
        <>
            <TerminalCursor />
            <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-gray-900 to-black">
                <MatrixRain />
                <CyberGrid />

                {/* Cyber glitch effects */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="cyber-orb absolute left-[15%] top-[25%] h-80 w-80 rounded-full bg-gradient-to-r from-green-500/10 to-cyan-500/20 blur-3xl animate-pulse" />
                    <div className="cyber-orb absolute right-[10%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-r from-cyan-400/15 to-green-400/10 blur-3xl animate-pulse delay-1000" />
                    <div className="cyber-orb absolute left-[65%] bottom-[25%] h-64 w-64 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/15 blur-3xl animate-pulse delay-500" />
                </div>

                {/* Main content */}
                <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-6 py-16">
                    <div className="text-center space-y-8">
                        {/* Badge */}
                        <div className="group inline-flex cursor-hover items-center gap-3 rounded-lg border border-green-500/20 bg-black/80 px-6 py-3 backdrop-blur-xl transition-all hover:border-green-400/50 hover:bg-green-900/20">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-green-400 animate-pulse" />
                                <span className="text-2xl font-semibold text-green-300 font-mono">
                                    ripenv
                                </span>
                                <div className="h-1 w-1 rounded-full bg-green-400 animate-ping" />
                                <span className="text-lg text-green-500/80 font-mono">
                                    End-to-end encrypted environments
                                </span>
                            </div>
                        </div>

                        {/* Hero title with decrypted text effect */}
                        <div className="space-y-6">
                            <h1 className="hero-text text-4xl font-black tracking-tight sm:text-6xl">
                                <div className="block text-white">
                                    <DecryptedText
                                        text="Git maintains your code."
                                        className="block bg-gradient-to-r from-green-400 via-cyan-300 to-green-400 bg-clip-text text-transparent font-mono"
                                        interval={30}
                                        enableHover={true}
                                    />
                                </div>
                                <div className="block text-white mt-2">
                                    <DecryptedText
                                        text="We protect your secrets."
                                        className="block bg-gradient-to-r from-cyan-400 via-green-300 to-cyan-400 bg-clip-text text-transparent font-mono"
                                        interval={30}
                                        enableHover={true}
                                    />
                                </div>
                            </h1>

                            <div className="relative">
                                <div className="mx-auto max-w-3xl text-xl text-green-100 leading-relaxed font-mono">
                                    Zero-trust environment management with{" "}
                                    <span className="relative inline-block">
                                        <span className="text-green-300 font-semibold">
                                            client-side encryption
                                        </span>
                                        <div className="absolute -bottom-1 left-0 h-0.5 w-full bg-gradient-to-r from-green-400 to-cyan-400 animate-pulse" />
                                    </span>
                                    , local key generation, and cryptographic
                                    operations that never leave your machine.
                                </div>
                            </div>
                        </div>

                        {/* Feature highlights */}
                        <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
                            {[
                                { icon: Lock, text: "Local-first crypto" },
                                {
                                    icon: Zap,
                                    text: "Zero-knowledge architecture",
                                },
                                { icon: Eye, text: "Transparent operations" },
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="group flex cursor-hover items-center gap-2 rounded-lg border border-green-500/20 bg-black/40 px-4 py-2 backdrop-blur transition-all hover:border-green-400/50 hover:bg-green-900/30">
                                    <feature.icon className="h-4 w-4 text-green-400 group-hover:text-green-300 transition-colors" />
                                    <span className="text-green-200 group-hover:text-green-100 transition-colors font-mono text-sm">
                                        {feature.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interactive cards */}
                    <div className="mt-20 grid w-full max-w-6xl gap-8 lg:grid-cols-2">
                        <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 backdrop-blur-xl transition-all hover:border-brand-400/50 hover:bg-slate-800/60">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-brand-400/30 bg-brand-500/10 p-3">
                                        <Shield className="h-6 w-6 text-brand-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">
                                        Secure Access
                                    </h3>
                                </div>

                                <p className="text-slate-300">
                                    Magic link authentication via Supabase. No
                                    passwords, no security risks.
                                </p>

                                <form
                                    onSubmit={handleSignIn}
                                    className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(
                                                event: ChangeEvent<HTMLInputElement>
                                            ) => setEmail(event.target.value)}
                                            required
                                            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-4 text-white placeholder-slate-400 backdrop-blur transition-all focus:border-brand-400 focus:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                                            placeholder="Enter your email address"
                                        />
                                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-400/20 to-cyan-400/20 opacity-0 transition-opacity focus-within:opacity-100" />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="group w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-4 text-lg font-semibold transition-all hover:from-brand-400 hover:to-brand-500 hover:scale-105 hover:shadow-lg hover:shadow-brand-500/25">
                                        <span>Launch Dashboard</span>
                                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </Button>

                                    {error && (
                                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                                            <p className="text-sm text-red-300">
                                                {error}
                                            </p>
                                        </div>
                                    )}
                                    {message && (
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                            <p className="text-sm text-emerald-300">
                                                {message}
                                            </p>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 backdrop-blur-xl transition-all hover:border-purple-400/50 hover:bg-slate-800/60">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
                                        <Zap className="h-6 w-6 text-purple-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">
                                        {checking
                                            ? "Detecting Session..."
                                            : sessionEmail
                                            ? "Welcome Back"
                                            : "Ready to Deploy"}
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    {sessionEmail ? (
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                            <p className="text-sm text-emerald-300">
                                                Authenticated as{" "}
                                                <span className="font-mono font-semibold">
                                                    {sessionEmail}
                                                </span>
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-slate-300">
                                            Access your encrypted environment
                                            projects and cryptographic key
                                            management system.
                                        </p>
                                    )}

                                    <Link
                                        href="/dashboard"
                                        className="group flex cursor-hover w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-800/60 px-8 py-4 text-lg font-semibold text-white transition-all hover:border-purple-400/50 hover:bg-purple-500/10 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25">
                                        <span>Open Dashboard</span>
                                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom gradient */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-slate-950 to-transparent" />
            </main>
        </>
    );
}
