"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    UserPlus,
    Download,
    ArrowLeft,
    Trash2,
    Copy,
    Bell,
    Clock,
} from "lucide-react";

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
    const [projectOwner, setProjectOwner] = useState<string>("");
    const [projectLastEdited, setProjectLastEdited] = useState<string | null>(
        null
    );
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [rotationSettings, setRotationSettings] = useState<{
        enabled: boolean;
        interval_days: number;
        interval_hours: number;
        interval_minutes: number;
        id?: string;
    } | null>(null);
    const [rotationLoading, setRotationLoading] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy to clipboard:", err);
        }
    };

    useEffect(() => {
        async function load() {
            // Get current user
            const { data: userData, error: userError } =
                await supabase.auth.getUser();
            if (userError || !userData.user) {
                setError("Unable to load user session");
                setLoading(false);
                return;
            }
            setCurrentUserId(userData.user.id);

            const [
                { data: project, error: projectError },
                { data: memberRows, error: memberError },
                { data: rotationData, error: rotationError },
            ] = await Promise.all([
                supabase
                    .from("projects")
                    .select("name, owner, last_edited_at")
                    .eq("id", projectId)
                    .single(),
                supabase
                    .from("project_members")
                    .select("email, public_key, created_at")
                    .eq("project_id", projectId),
                supabase
                    .from("rotation_settings")
                    .select(
                        "id, enabled, interval_days, interval_hours, interval_minutes, last_reminder_sent"
                    )
                    .eq("project_id", projectId)
                    .eq("user_id", userData.user.id)
                    .single(),
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
            setProjectOwner(project?.owner ?? "");
            setProjectLastEdited(project?.last_edited_at ?? null);

            // Set rotation settings (may be null if not configured)
            if (rotationData && !rotationError) {
                setRotationSettings({
                    id: rotationData.id,
                    enabled: rotationData.enabled,
                    interval_days: rotationData.interval_days || 0,
                    interval_hours: rotationData.interval_hours || 0,
                    interval_minutes: rotationData.interval_minutes || 0,
                });
            }

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

                // Sync public keys from profiles to project_members table
                // This ensures the CLI can find public keys in project_members
                const syncUpdates = mergedMembers
                    .filter(
                        (member) =>
                            member.public_key && member.public_key !== null
                    )
                    .map(async (member) => {
                        if (member.public_key !== null) {
                            return supabase
                                .from("project_members")
                                .update({ public_key: member.public_key })
                                .eq("project_id", projectId)
                                .eq("email", member.email);
                        }
                    })
                    .filter(Boolean);

                if (syncUpdates.length > 0) {
                    try {
                        await Promise.all(syncUpdates);
                    } catch (syncError) {
                        console.warn(
                            "Failed to sync some public keys to project_members:",
                            syncError
                        );
                        // Don't fail the page load for sync issues
                    }
                }
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
        // Only allow project owners to remove members
        if (currentUserId !== projectOwner) {
            setError("Only project owners can remove members");
            return;
        }

        if (
            !confirm(
                `Are you sure you want to remove ${memberEmail} from the project?`
            )
        ) {
            return;
        }

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

    async function handleDeleteProject() {
        if (currentUserId !== projectOwner) {
            setError("Only project owners can delete projects");
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete the project "${projectName}"? This action cannot be undone and will remove all members and data.`
            )
        ) {
            return;
        }

        const { error: deleteError } = await supabase
            .from("projects")
            .delete()
            .eq("id", projectId)
            .eq("owner", currentUserId);

        if (deleteError) {
            setError(`Failed to delete project: ${deleteError.message}`);
            return;
        }

        // Redirect to dashboard after successful deletion
        router.push("/dashboard");
    }

    async function handleRotationSettingsUpdate(
        enabled: boolean,
        intervalDays: number,
        intervalHours: number = 0,
        intervalMinutes: number = 0
    ) {
        if (!currentUserId) return;

        setRotationLoading(true);
        try {
            const settingsData = {
                project_id: projectId,
                user_id: currentUserId,
                enabled,
                interval_days: intervalDays,
                interval_hours: intervalHours,
                interval_minutes: intervalMinutes,
            };

            let result;
            if (rotationSettings?.id) {
                // Update existing settings
                result = await supabase
                    .from("rotation_settings")
                    .update({
                        enabled,
                        interval_days: intervalDays,
                        interval_hours: intervalHours,
                        interval_minutes: intervalMinutes,
                    })
                    .eq("id", rotationSettings.id)
                    .select(
                        "id, enabled, interval_days, interval_hours, interval_minutes"
                    )
                    .single();
            } else {
                // Insert new settings
                result = await supabase
                    .from("rotation_settings")
                    .insert(settingsData)
                    .select(
                        "id, enabled, interval_days, interval_hours, interval_minutes"
                    )
                    .single();
            }

            if (result.error) {
                setError(
                    `Failed to update rotation settings: ${result.error.message}`
                );
                return;
            }

            setRotationSettings({
                id: result.data.id,
                enabled: result.data.enabled,
                interval_days: result.data.interval_days,
                interval_hours: result.data.interval_hours,
                interval_minutes: result.data.interval_minutes,
            });

            // If enabling test mode (0 days), create an immediate notification
            if (enabled && intervalDays === 0) {
                await createTestNotification();
            }
        } catch (error) {
            setError(`Failed to update rotation settings: ${error}`);
        } finally {
            setRotationLoading(false);
        }
    }

    async function createTestNotification() {
        if (!currentUserId) return;

        try {
            const { error } = await supabase.from("notifications").insert({
                user_id: currentUserId,
                project_id: projectId,
                type: "rotation_reminder",
                title: "🧪 TEST: Rotation Reminder",
                message: `Test notification for project "${projectName}". This is a manual test to verify the notification system is working.`,
            });

            if (error) {
                setError(
                    `Failed to create test notification: ${error.message}`
                );
            } else {
                console.log("Test notification created successfully");
            }
        } catch (error) {
            setError(`Failed to create test notification: ${error}`);
        }
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

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-slate-100">
                            {projectName || "Project"}
                        </h1>
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">
                                    PROJECT ID
                                </p>
                                <p className="font-mono text-sm text-slate-200 font-semibold">
                                    {projectId}
                                </p>
                            </div>
                            <button
                                onClick={() => copyToClipboard(projectId)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-700/50 transition-colors"
                                title="Copy project ID to clipboard">
                                {copied ? (
                                    <>
                                        <div className="h-3 w-3 rounded-full bg-green-500" />
                                        <span className="text-green-400">
                                            Copied!
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3 w-3" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {projectLastEdited && (
                            <div className="mt-3 rounded-lg bg-slate-800/30 p-3 border border-slate-700/30">
                                <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">
                                    Last Environment Update
                                </p>
                                <p className="text-sm text-slate-200">
                                    {new Date(
                                        projectLastEdited
                                    ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                        )}

                        <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                            {currentUserId === projectOwner
                                ? "Owner"
                                : "Member"}
                        </p>
                    </div>

                    {currentUserId === projectOwner && (
                        <button
                            onClick={handleDeleteProject}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400 hover:bg-red-500/20"
                            title="Delete entire project">
                            <Trash2 className="mr-1 inline h-4 w-4" />
                            Delete Project
                        </button>
                    )}
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

            {currentUserId === projectOwner && (
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
                    {error && (
                        <p className="mt-3 text-sm text-red-400">{error}</p>
                    )}
                </Card>
            )}

            {currentUserId !== projectOwner && (
                <Card
                    title="Project Member"
                    description="You are a member of this project. Only the project owner can add or remove members.">
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                        <div className="h-2 w-2 rounded-full bg-blue-400" />
                        <span>
                            Contact the project owner to make changes to project
                            membership.
                        </span>
                    </div>
                </Card>
            )}

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
                                    currentUserId === projectOwner ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveMember(member.email)
                                            }
                                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-red-300 transition hover:border-red-400 hover:bg-red-500/20"
                                            title="Remove member from project">
                                            Remove
                                        </button>
                                    ) : null
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

            <Card
                title="Key Rotation Reminders"
                description="Configure automatic notifications to rotate your environment secrets for enhanced security.">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                        <div className="flex items-center gap-3">
                            <Bell className="h-5 w-5 text-slate-400" />
                            <div>
                                <p className="font-semibold text-slate-200">
                                    Notifications
                                </p>
                                <p className="text-sm text-slate-400">
                                    Get notified when it's time to rotate
                                    secrets
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() =>
                                handleRotationSettingsUpdate(
                                    !(rotationSettings?.enabled ?? false),
                                    rotationSettings?.interval_days ?? 0,
                                    rotationSettings?.interval_hours ?? 0,
                                    rotationSettings?.interval_minutes ?? 30
                                )
                            }
                            disabled={rotationLoading}
                            title={`${
                                rotationSettings?.enabled ? "Disable" : "Enable"
                            } notifications`}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                rotationSettings?.enabled
                                    ? "bg-brand-500"
                                    : "bg-slate-600"
                            } ${
                                rotationLoading
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}>
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    rotationSettings?.enabled
                                        ? "translate-x-6"
                                        : "translate-x-1"
                                }`}
                            />
                        </button>
                    </div>

                    {rotationSettings?.enabled && (
                        <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <label className="font-semibold text-slate-200">
                                    Reminder Interval
                                </label>
                            </div>

                            <div className="space-y-4">
                                {/* Time inputs */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">
                                            Days
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="365"
                                                value={
                                                    rotationSettings.interval_days
                                                }
                                                onChange={(e) => {
                                                    const days =
                                                        parseInt(
                                                            e.target.value
                                                        ) || 0;
                                                    handleRotationSettingsUpdate(
                                                        true,
                                                        days,
                                                        rotationSettings.interval_hours,
                                                        rotationSettings.interval_minutes
                                                    );
                                                }}
                                                disabled={rotationLoading}
                                                title="Number of days"
                                                placeholder="0"
                                                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">
                                            Hours
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="23"
                                                value={
                                                    rotationSettings.interval_hours
                                                }
                                                onChange={(e) => {
                                                    const hours =
                                                        parseInt(
                                                            e.target.value
                                                        ) || 0;
                                                    handleRotationSettingsUpdate(
                                                        true,
                                                        rotationSettings.interval_days,
                                                        hours,
                                                        rotationSettings.interval_minutes
                                                    );
                                                }}
                                                disabled={rotationLoading}
                                                title="Number of hours (0-23)"
                                                placeholder="0"
                                                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">
                                            Minutes
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                value={
                                                    rotationSettings.interval_minutes
                                                }
                                                onChange={(e) => {
                                                    const minutes =
                                                        parseInt(
                                                            e.target.value
                                                        ) || 0;
                                                    handleRotationSettingsUpdate(
                                                        true,
                                                        rotationSettings.interval_days,
                                                        rotationSettings.interval_hours,
                                                        minutes
                                                    );
                                                }}
                                                disabled={rotationLoading}
                                                title="Number of minutes (0-59)"
                                                placeholder="0"
                                                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Quick preset buttons */}
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400">
                                        Quick presets:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <button
                                            onClick={() =>
                                                handleRotationSettingsUpdate(
                                                    true,
                                                    0,
                                                    0,
                                                    1
                                                )
                                            }
                                            disabled={rotationLoading}
                                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                                rotationSettings.interval_days ===
                                                    0 &&
                                                rotationSettings.interval_hours ===
                                                    0 &&
                                                rotationSettings.interval_minutes ===
                                                    1
                                                    ? "border-red-500 bg-red-500/20 text-red-300"
                                                    : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                                            }`}>
                                            1 min (test)
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleRotationSettingsUpdate(
                                                    true,
                                                    0,
                                                    1,
                                                    0
                                                )
                                            }
                                            disabled={rotationLoading}
                                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                                rotationSettings.interval_days ===
                                                    0 &&
                                                rotationSettings.interval_hours ===
                                                    1 &&
                                                rotationSettings.interval_minutes ===
                                                    0
                                                    ? "border-brand-500 bg-brand-500/20 text-brand-300"
                                                    : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                                            }`}>
                                            1 hour
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleRotationSettingsUpdate(
                                                    true,
                                                    7,
                                                    0,
                                                    0
                                                )
                                            }
                                            disabled={rotationLoading}
                                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                                rotationSettings.interval_days ===
                                                    7 &&
                                                rotationSettings.interval_hours ===
                                                    0 &&
                                                rotationSettings.interval_minutes ===
                                                    0
                                                    ? "border-brand-500 bg-brand-500/20 text-brand-300"
                                                    : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                                            }`}>
                                            7 days
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleRotationSettingsUpdate(
                                                    true,
                                                    30,
                                                    0,
                                                    0
                                                )
                                            }
                                            disabled={rotationLoading}
                                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                                                rotationSettings.interval_days ===
                                                    30 &&
                                                rotationSettings.interval_hours ===
                                                    0 &&
                                                rotationSettings.interval_minutes ===
                                                    0
                                                    ? "border-brand-500 bg-brand-500/20 text-brand-300"
                                                    : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                                            }`}>
                                            30 days
                                        </button>
                                    </div>
                                </div>

                                {/* Current interval display */}
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <p className="text-sm text-blue-300 font-semibold mb-1">
                                        Current interval:{" "}
                                        {rotationSettings.interval_days}d{" "}
                                        {rotationSettings.interval_hours}h{" "}
                                        {rotationSettings.interval_minutes}m
                                    </p>
                                    <p className="text-xs text-blue-200/90">
                                        You'll receive notifications when it's
                                        time to rotate your secrets.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!rotationSettings?.enabled && (
                        <div className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/20">
                            <p className="text-sm text-slate-400 text-center">
                                Enable notifications to get reminded about key
                                rotation schedules.
                            </p>
                        </div>
                    )}
                </div>
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
