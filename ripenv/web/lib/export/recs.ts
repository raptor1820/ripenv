import { downloadJSON } from "@/lib/crypto/keys";

export interface MemberRow {
    email: string;
    public_key: string | null;
}

export function buildRecipientsPayload(
    projectId: string,
    members: MemberRow[]
) {
    const recipients = members
        .filter((member) => Boolean(member.public_key))
        .map((member) => ({
            email: member.email,
            publicKey: member.public_key as string,
        }));

    return {
        projectId,
        recipients,
    };
}

export function downloadRecipientsExport(
    projectId: string,
    members: MemberRow[]
) {
    const payload = buildRecipientsPayload(projectId, members);
    downloadJSON(payload, "recipients.export.json");
}
