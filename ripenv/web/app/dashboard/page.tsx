"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { projectSchema } from "@/lib/z";

type ProjectRow = Pick<
    Database["public"]["Tables"]["projects"]["Row"],
    "id" | "name" | "owner"
>;

export default function DashboardPage() {
    return (
        <AuthGate fallback={<LandingFallback />}>
            <DashboardInner />
        </AuthGate>
    );
}

function LandingFallback() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-3xl font-semibold text-slate-100">
                Sign in required
            </h1>
            <p className="max-w-md text-sm text-slate-400">
                You need to authenticate with Supabase magic links before
                accessing the ripenv dashboard.
            </p>
            <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-brand-500 hover:bg-brand-500/10">
                Back to landing
            </Link>
        </div>
    );
}

function DashboardInner() {
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            const { data: userData, error: userError } =
                await supabase.auth.getUser();
            if (userError || !userData.user) {
                if (!mounted) return;
                setError(userError?.message ?? "Unable to load user session");
                setLoading(false);
                return;
            }

            if (!mounted) return;
            setUserId(userData.user.id);
            const userEmail = userData.user.email ?? "";

            const [ownedRes, memberRes] = await Promise.all([
                supabase
                    .from("projects")
                    .select("id, name, owner")
                    .eq("owner", userData.user.id),
                supabase
                    .from("project_members")
                    .select("project_id")
                    .eq("email", userEmail),
            ]);

            if (ownedRes.error) {
                if (!mounted) return;
                setError(ownedRes.error.message);
                setLoading(false);
                return;
            }
            if (memberRes.error) {
                if (!mounted) return;
                setError(memberRes.error.message);
                setLoading(false);
                return;
            }

            const memberIds =
                memberRes.data?.map((row) => row.project_id) ?? [];
            let memberProjects: ProjectRow[] = [];
            if (memberIds.length) {
                const { data, error: projectError } = await supabase
                    .from("projects")
                    .select("id, name, owner")
                    .in("id", memberIds);
                if (projectError) {
                    if (!mounted) return;
                    setError(projectError.message);
                    setLoading(false);
                    return;
                }
                memberProjects = data ?? [];
            }

            const unique = [...(ownedRes.data ?? []), ...memberProjects];
            const deduped = Array.from(
                new Map(unique.map((p) => [p.id, p])).values()
            );
            if (!mounted) return;
            setProjects(deduped);
            setLoading(false);
        }

        load();
        return () => {
            mounted = false;
        };
    }, []);

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const parsed = projectSchema.safeParse({ name });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid project name");
            return;
        }

        if (!userId) {
            setError("User session missing");
            return;
        }

        const { data, error: insertError } = await supabase
            .from("projects")
            .insert({ name: parsed.data.name, owner: userId })
            .select("id, name, owner")
            .single();

        if (insertError) {
            setError(insertError.message);
            return;
        }

        setProjects((prev: ProjectRow[]) => [data, ...prev]);
        setName("");
    }

    async function handleSignOut() {
        await supabase.auth.signOut();
        window.location.href = "/";
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-16">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-brand-400">
                        Dashboard
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                        Projects
                    </h1>
                </div>
                <Button onClick={handleSignOut}>Sign out</Button>
            </header>

            <Card title="Create new project">
                <form
                    onSubmit={handleCreate}
                    className="flex flex-col gap-3 sm:flex-row">
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="My project"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
                    />
                    <Button type="submit" className="sm:w-40">
                        Create
                    </Button>
                </form>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </Card>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-200">
                    Your projects
                </h2>
                {loading ? (
                    <p className="text-sm text-slate-400">
                        Loading projects...
                    </p>
                ) : projects.length ? (
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {projects.map((project) => (
                            <li
                                key={project.id}
                                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                                <h3 className="text-base font-semibold text-slate-100">
                                    {project.name}
                                </h3>
                                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                    Project ID
                                </p>
                                <p className="break-all text-xs text-slate-400">
                                    {project.id}
                                </p>
                                <Button
                                    className="mt-4 w-full"
                                    onClick={() =>
                                        (window.location.href = `/projects/${project.id}`)
                                    }>
                                    Manage members
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-400">
                        No projects yet. Create one above to get started.
                    </p>
                )}
            </section>
        </main>
    );
}
