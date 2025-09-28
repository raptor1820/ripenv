"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AppChrome } from "@/components/AppChrome";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { projectSchema } from "@/lib/z";

type ProjectRow = Pick<
    Database["public"]["Tables"]["projects"]["Row"],
    "id" | "name" | "owner" | "last_edited_at"
>;

export default function DashboardPage() {
    return (
        <AuthGate fallback={<LandingFallback />}>
            <AppChrome>
                <DashboardInner />
            </AppChrome>
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
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600">
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
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = async (text: string, projectId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(projectId);
            setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

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
                    .select("id, name, owner, last_edited_at")
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
                    .select("id, name, owner, last_edited_at")
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
            .select("id, name, owner, last_edited_at")
            .single();

        if (insertError) {
            setError(insertError.message);
            return;
        }

        // Auto-add the project creator as a member
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.email) {
            const { error: memberError } = await supabase
                .from("project_members")
                .insert({
                    project_id: data.id,
                    email: userData.user.email,
                });

            if (memberError) {
                console.warn(
                    "Failed to add creator as member:",
                    memberError.message
                );
                // Don't fail the whole operation - project was created successfully
            }
        }

        setProjects((prev: ProjectRow[]) => [data, ...prev]);
        setName("");
    }

    async function handleDelete(projectId: string, projectName: string) {
        if (
            !confirm(
                `Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`
            )
        ) {
            return;
        }

        if (!userId) {
            setError("User session missing");
            return;
        }

        const { error: deleteError } = await supabase
            .from("projects")
            .delete()
            .eq("id", projectId)
            .eq("owner", userId); // Only allow owners to delete

        if (deleteError) {
            setError(`Failed to delete project: ${deleteError.message}`);
            return;
        }

        setProjects((prev: ProjectRow[]) =>
            prev.filter((p) => p.id !== projectId)
        );
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-semibold text-slate-100">
                    Projects
                </h1>
                <p className="mt-2 text-slate-400">
                    Manage your encrypted environment projects
                </p>
            </header>

            <Card title="Create new project">
                <form
                    onSubmit={handleCreate}
                    className="flex flex-col gap-3 sm:flex-row">
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Project name"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-brand-500 focus:outline-none"
                    />
                    <Button type="submit" className="sm:w-32">
                        <Plus className="h-4 w-4" />
                        Create
                    </Button>
                </form>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
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
                    <div className="grid gap-4 sm:grid-cols-2">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-slate-100">
                                            {project.name}
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                {project.owner === userId
                                                    ? "Owner"
                                                    : "Member"}
                                            </p>
                                            <div className="mt-3">
                                                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                                                    Project ID
                                                </p>
                                                <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 border border-slate-600">
                                                    <code className="flex-1 break-all text-sm font-mono text-slate-200">
                                                        {project.id}
                                                    </code>
                                                    <button
                                                        onClick={() =>
                                                            copyToClipboard(
                                                                project.id,
                                                                project.id
                                                            )
                                                        }
                                                        className="rounded-md border border-slate-600 bg-slate-700 p-1.5 text-slate-300 transition hover:border-slate-500 hover:bg-slate-600 hover:text-slate-100"
                                                        title="Copy project ID">
                                                        {copiedId ===
                                                        project.id ? (
                                                            <span className="text-xs text-green-400 px-1">
                                                                ✓
                                                            </span>
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>

                                                {project.last_edited_at && (
                                                    <div className="mt-3">
                                                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                                            Last Environment
                                                            Update
                                                        </p>
                                                        <p className="text-xs text-slate-300">
                                                            {new Date(
                                                                project.last_edited_at
                                                            ).toLocaleDateString(
                                                                "en-US",
                                                                {
                                                                    year: "numeric",
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                }
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {project.owner === userId && (
                                        <button
                                            onClick={() =>
                                                handleDelete(
                                                    project.id,
                                                    project.name
                                                )
                                            }
                                            className="ml-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:border-red-400 hover:bg-red-500/20"
                                            title="Delete project">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <Button
                                    className="mt-4 w-full"
                                    onClick={() =>
                                        (window.location.href = `/projects/${project.id}`)
                                    }>
                                    Manage members
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400">
                        No projects yet. Create one above to get started.
                    </p>
                )}
            </section>
        </div>
    );
}
