"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AppChrome } from "@/components/AppChrome";
import { AuthGate } from "@/components/AuthGate";
import {
    buildKeyfile,
    deriveKEK,
    downloadJSON,
    encryptPrivateKey,
    generateKeypair,
    randomSalt,
    toBase64,
} from "@/lib/crypto/keys";
import { supabase } from "@/lib/supabase";
import { passwordSchema } from "@/lib/z";

function KeysInner() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleGenerate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus(null);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        const parsed = passwordSchema.safeParse({ password });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Password too weak");
            return;
        }

        setLoading(true);

        const { data: userData, error: userError } =
            await supabase.auth.getUser();
        if (userError || !userData.user) {
            setError(userError?.message ?? "Missing authenticated user");
            setLoading(false);
            return;
        }

        try {
            const saltBytes = randomSalt();
            const kek = await deriveKEK(password, saltBytes);
            const { publicKeyBase64, privateKeyBytes } = generateKeypair();
            const encPrivateKey = encryptPrivateKey(kek, privateKeyBytes);
            const keyfile = buildKeyfile(
                publicKeyBase64,
                encPrivateKey,
                toBase64(saltBytes)
            );

            const { error: upsertError } = await supabase
                .from("profiles")
                .upsert(
                    {
                        id: userData.user.id,
                        email: userData.user.email,
                        public_key: keyfile.publicKey,
                        enc_private_key: keyfile.encPrivateKey,
                        salt: keyfile.salt,
                    },
                    { onConflict: "id" }
                );

            if (upsertError) {
                throw new Error(upsertError.message);
            }

            downloadJSON(keyfile, "mykey.enc.json");
            setStatus(
                "Keypair generated. Your encrypted keyfile has downloaded."
            );
            setPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to generate keys"
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-semibold text-slate-100">
                    Generate and upload your keypair
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                    Keys are generated locally using TweetNaCl, encrypted with
                    Argon2id + SecretBox, and uploaded to Supabase with only the
                    encrypted private key.
                </p>
            </header>

            <Card
                title="Generate keypair"
                description="Choose a strong password to protect your private key. You will download a local JSON keyfile.">
                <form onSubmit={handleGenerate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="block text-xs uppercase tracking-wide text-slate-400">
                                Password
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(
                                    event: ChangeEvent<HTMLInputElement>
                                ) => setPassword(event.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
                                placeholder="Enter secure password"
                                required
                            />
                        </label>
                        <label className="space-y-2 text-sm text-slate-300">
                            <span className="block text-xs uppercase tracking-wide text-slate-400">
                                Confirm password
                            </span>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(
                                    event: ChangeEvent<HTMLInputElement>
                                ) => setConfirmPassword(event.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
                                placeholder="Confirm password"
                                required
                            />
                        </label>
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading
                            ? "Generating..."
                            : "Generate and download keyfile"}
                    </Button>
                    {status && (
                        <p className="text-sm text-emerald-400">{status}</p>
                    )}
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </form>
            </Card>
        </div>
    );
}

export default function KeysPage() {
    return (
        <AuthGate
            fallback={
                <p className="p-8 text-center text-slate-300">
                    Sign in to manage keys.
                </p>
            }>
            <AppChrome>
                <KeysInner />
            </AppChrome>
        </AuthGate>
    );
}
