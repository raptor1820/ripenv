"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-16">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="text-xs uppercase tracking-[0.3em] text-slate-500 hover:text-slate-300">
                        Back
                    </button>
                    <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                        {projectName || "Project"}
                    </h1>
                    <p className="text-xs text-slate-500">
                        Project ID: {projectId}
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
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
                    />
                    <Button type="submit" className="sm:w-40">
                        Add member
                    </Button>
                </form>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </Card>

            <Card
                title="Project members"
                description="Members with public keys can decrypt the project manifest.">
                {loading ? (
                    <p className="text-sm text-slate-400">Loading members...</p>
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
                                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-red-400 hover:text-red-300">
                                        Remove
                                    </button>
                                }>
                                <p className="font-semibold text-slate-100">
                                    {member.email}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {member.public_key
                                        ? "Public key registered"
                                        : "No public key yet"}
                                </p>
                            </TableRow>
                        ))}
                    </Table>
                ) : (
                    <p className="text-sm text-slate-400">No members found.</p>
                )}
            </Card>
        </main>
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
            <ProjectPageInner />
        </AuthGate>
    );
}
