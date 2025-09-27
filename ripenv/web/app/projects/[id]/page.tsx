"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserPlus, Download, ArrowLeft } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AppChrome } from "@/components/AppChrome";
import { AuthGate } from "@/components/AuthGate";
import { Table, TableRow } from "@/components/Table";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { downloadRecipientsExport } from "@/lib/export/recs";
import { memberSchema } from "@/lib/z";

type MemberRow = Pick<
    Database["public"]["Tables"]["project_members"]["Row"],
    "email" | "public_key" | "created_at"
>;
type ProfileRow = Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "email" | "public_key"
>;

function ProjectPageInner() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const projectId = params?.id ?? "";

    const [projectName, setProjectName] = useState<string>("");
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [
                { data: project, error: projectError },
                { data: memberRows, error: memberError },
            ] = await Promise.all([
                supabase
                    .from("projects")
                    .select("name")
                    .eq("id", projectId)
                    .single(),
                supabase
                    .from("project_members")
                    .select("email, public_key, created_at")
                    .eq("project_id", projectId),
            ]);

            if (projectError) {
                setError(projectError.message);
                setLoading(false);
                return;
            }
            if (memberError) {
                setError(memberError.message);
                setLoading(false);
                return;
            }

            setProjectName(project?.name ?? "");

            const emails = (memberRows ?? []).map((member) => member.email);
            let mergedMembers = memberRows ?? [];
            if (emails.length) {
                const { data: profileRows, error: profileError } =
                    await supabase
                        .from("profiles")
                        .select("email, public_key")
                        .in("email", emails);
                if (profileError) {
                    setError(profileError.message);
                    setLoading(false);
                    return;
                }
                const profileMap = new Map<string, string | null>();
                (profileRows as ProfileRow[] | null)?.forEach((profile) => {
                    if (profile.email) {
                        profileMap.set(
                            profile.email.toLowerCase(),
                            profile.public_key
                        );
                    }
                });
                mergedMembers = mergedMembers.map((member) => ({
                    ...member,
                    public_key:
                        profileMap.get(member.email.toLowerCase()) ??
                        member.public_key ??
                        null,
                }));
            }

            setMembers(mergedMembers);
            setLoading(false);
        }

        if (projectId) {
            load();
        }
    }, [projectId]);

    async function handleAddMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const parsed = memberSchema.safeParse({ email });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid email");
            return;
        }

        const { error: insertError } = await supabase
            .from("project_members")
            .upsert(
                { project_id: projectId, email: parsed.data.email },
                { onConflict: "project_id,email" }
            );

        if (insertError) {
            setError(insertError.message);
            return;
        }

        setMembers((prev: MemberRow[]) => {
            const exists = prev.find(
                (member) =>
                    member.email.toLowerCase() ===
                    parsed.data.email.toLowerCase()
            );
            if (exists) {
                return prev;
            }
            return [
                {
                    email: parsed.data.email,
                    public_key: null,
                    created_at: new Date().toISOString(),
                },
                ...prev,
            ];
        });
        setEmail("");
    }

    async function handleRemoveMember(memberEmail: string) {
        const { error: deleteError } = await supabase
            .from("project_members")
            .delete()
            .match({ project_id: projectId, email: memberEmail });
        if (deleteError) {
            setError(deleteError.message);
            return;
        }

        setMembers((prev: MemberRow[]) =>
            prev.filter((member) => member.email !== memberEmail)
        );
    }

    const approvedMembers = useMemo(
        () => members.filter((member: MemberRow) => Boolean(member.public_key)),
        [members]
    );

    return (
        <div className="space-y-10">
            <header className="space-y-4">
                <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                    <ArrowLeft className="h-4 w-4" />
                    Back to dashboard
                </button>

                <div>
                    <h1 className="text-3xl font-semibold text-slate-100">
                        {projectName || "Project"}
                    </h1>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                        ID: {projectId}
                    </p>
                </div>

                <Button
                    onClick={() => downloadRecipientsExport(projectId, members)}
                    disabled={!approvedMembers.length}
                    title={
                        approvedMembers.length
                            ? "Download recipients.export.json for CLI"
                            : "Recipients export requires members with public keys"
                    }>
                    <Download className="h-4 w-4" />
                    Export recipients JSON
                </Button>
            </header>

            <Card
                title="Add member"
                description="Invite collaborators by email. They appear once they accept the magic link and upload a public key.">
                <form
                    onSubmit={handleAddMember}
                    className="flex flex-col gap-3 sm:flex-row">
                    <input
                        type="email"
                        value={email}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setEmail(event.target.value)
                        }
                        placeholder="teammate@example.com"
                        required
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-400 focus:border-brand-500 focus:outline-none"
                    />
                    <Button type="submit" className="sm:w-32">
                        <UserPlus className="h-4 w-4" />
                        Add member
                    </Button>
                </form>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </Card>

            <Card
                title="Authorized members"
                description="Team members with active public keys can decrypt the project manifest and environment files.">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
                            <p className="text-slate-400">Loading members...</p>
                        </div>
                    </div>
                ) : members.length ? (
                    <Table>
                        {members.map((member: MemberRow) => (
                            <TableRow
                                key={member.email}
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleRemoveMember(member.email)
                                        }
                                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-red-300 transition hover:border-red-400 hover:bg-red-500/20">
                                        Remove
                                    </button>
                                }>
                                <div className="space-y-2">
                                    <p className="font-semibold text-slate-100">
                                        {member.email}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`h-2 w-2 rounded-full ${
                                                member.public_key
                                                    ? "bg-emerald-400"
                                                    : "bg-yellow-400"
                                            }`}
                                        />
                                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                                            {member.public_key
                                                ? "Key registered • Authorized"
                                                : "Awaiting key upload"}
                                        </p>
                                    </div>
                                </div>
                            </TableRow>
                        ))}
                    </Table>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-6 rounded-full border border-white/10 bg-slate-900/40 p-6">
                            <UserPlus className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-300">
                            No team members yet
                        </h3>
                        <p className="mt-2 text-slate-400">
                            Recruit your first collaborator above
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
}

export default function ProjectPage() {
    return (
        <AuthGate
            fallback={
                <p className="p-10 text-center text-slate-300">
                    Sign in to manage project members.
                </p>
            }>
            <AppChrome>
                <ProjectPageInner />
            </AppChrome>
        </AuthGate>
    );
}
