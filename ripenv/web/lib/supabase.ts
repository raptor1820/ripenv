import { createClient } from "@supabase/supabase-js";

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    created_at: string | null;
                    email: string | null;
                    enc_private_key: string | null;
                    id: string;
                    public_key: string | null;
                    salt: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    email?: string | null;
                    enc_private_key?: string | null;
                    id: string;
                    public_key?: string | null;
                    salt?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    email?: string | null;
                    enc_private_key?: string | null;
                    id?: string;
                    public_key?: string | null;
                    salt?: string | null;
                };
                Relationships: [];
            };
            project_members: {
                Row: {
                    created_at: string | null;
                    email: string;
                    id: string;
                    public_key: string | null;
                    project_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    email: string;
                    id?: string;
                    public_key?: string | null;
                    project_id: string;
                };
                Update: {
                    created_at?: string | null;
                    email?: string;
                    id?: string;
                    public_key?: string | null;
                    project_id?: string;
                };
                Relationships: [
                    {
                        columns: ["project_id"];
                        referencedColumns: ["id"];
                        referencedRelation: "projects";
                        foreignKeyName: "project_members_project_id_fkey";
                    }
                ];
            };
            projects: {
                Row: {
                    created_at: string | null;
                    id: string;
                    last_edited_at: string | null;
                    name: string;
                    owner: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    last_edited_at?: string | null;
                    name: string;
                    owner: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    last_edited_at?: string | null;
                    name?: string;
                    owner?: string;
                };
                Relationships: [
                    {
                        columns: ["owner"];
                        referencedColumns: ["id"];
                        referencedRelation: "profiles";
                        foreignKeyName: "projects_owner_fkey";
                    }
                ];
            };
            rotation_settings: {
                Row: {
                    created_at: string | null;
                    enabled: boolean;
                    id: string;
                    interval_days: number;
                    interval_hours: number;
                    interval_minutes: number;
                    last_reminder_sent: string | null;
                    project_id: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    enabled?: boolean;
                    id?: string;
                    interval_days: number;
                    interval_hours?: number;
                    interval_minutes?: number;
                    last_reminder_sent?: string | null;
                    project_id: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    enabled?: boolean;
                    id?: string;
                    interval_days?: number;
                    interval_hours?: number;
                    interval_minutes?: number;
                    last_reminder_sent?: string | null;
                    project_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        columns: ["project_id"];
                        referencedColumns: ["id"];
                        referencedRelation: "projects";
                        foreignKeyName: "rotation_settings_project_id_fkey";
                    },
                    {
                        columns: ["user_id"];
                        referencedColumns: ["id"];
                        referencedRelation: "profiles";
                        foreignKeyName: "rotation_settings_user_id_fkey";
                    }
                ];
            };
            notifications: {
                Row: {
                    created_at: string | null;
                    id: string;
                    message: string;
                    project_id: string | null;
                    read: boolean;
                    title: string;
                    type: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    message: string;
                    project_id?: string | null;
                    read?: boolean;
                    title: string;
                    type: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    message?: string;
                    project_id?: string | null;
                    read?: boolean;
                    title?: string;
                    type?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        columns: ["project_id"];
                        referencedColumns: ["id"];
                        referencedRelation: "projects";
                        foreignKeyName: "notifications_project_id_fkey";
                    },
                    {
                        columns: ["user_id"];
                        referencedColumns: ["id"];
                        referencedRelation: "profiles";
                        foreignKeyName: "notifications_user_id_fkey";
                    }
                ];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
