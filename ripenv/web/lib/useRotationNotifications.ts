"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

// Simple notification checker that runs client-side
export function useRotationNotifications() {
    const [lastCheck, setLastCheck] = useState<Date>(new Date());

    useEffect(() => {
        const checkRotationReminders = async () => {
            try {
                const { data: userData, error: userError } =
                    await supabase.auth.getUser();
                if (userError || !userData.user) return;

                // Get user's rotation settings
                const { data: settings, error: settingsError } = await supabase
                    .from("rotation_settings")
                    .select(
                        `
            id,
            project_id,
            interval_days,
            interval_hours,
            interval_minutes,
            last_reminder_sent,
            projects!inner(name, last_edited_at)
          `
                    )
                    .eq("user_id", userData.user.id)
                    .eq("enabled", true);

                if (settingsError || !settings) return;

                const now = new Date();

                for (const setting of settings) {
                    const shouldNotify = checkShouldNotify(setting, now);

                    if (shouldNotify) {
                        await createNotification(setting, userData.user.id);

                        // Update last_reminder_sent to avoid duplicate notifications
                        await supabase
                            .from("rotation_settings")
                            .update({ last_reminder_sent: now.toISOString() })
                            .eq("id", setting.id);
                    }
                }
            } catch (error) {
                console.error("Error checking rotation reminders:", error);
            }
        };

        // Check every minute
        const interval = setInterval(checkRotationReminders, 60000);

        // Check immediately
        checkRotationReminders();

        return () => clearInterval(interval);
    }, []);
}

function checkShouldNotify(setting: any, now: Date): boolean {
    // Calculate total interval in milliseconds
    const totalMs =
        setting.interval_days * 24 * 60 * 60 * 1000 +
        setting.interval_hours * 60 * 60 * 1000 +
        setting.interval_minutes * 60 * 1000;

    // If interval is 0 or very small, don't notify (invalid setting)
    if (totalMs < 60000) {
        // Less than 1 minute
        return false;
    }

    if (!setting.last_reminder_sent) {
        if (!setting.projects.last_edited_at) {
            return false;
        }

        const lastEdit = new Date(setting.projects.last_edited_at);
        return now.getTime() - lastEdit.getTime() >= totalMs;
    }

    const lastSent = new Date(setting.last_reminder_sent);
    return now.getTime() - lastSent.getTime() >= totalMs;
}

async function createNotification(setting: any, userId: string) {
    const totalMs =
        setting.interval_days * 24 * 60 * 60 * 1000 +
        setting.interval_hours * 60 * 60 * 1000 +
        setting.interval_minutes * 60 * 1000;

    const isTestMode = totalMs <= 60000; // 1 minute or less is test mode

    let intervalText = "";
    if (setting.interval_days > 0) intervalText += `${setting.interval_days}d `;
    if (setting.interval_hours > 0)
        intervalText += `${setting.interval_hours}h `;
    if (setting.interval_minutes > 0)
        intervalText += `${setting.interval_minutes}m`;
    intervalText = intervalText.trim();

    const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        project_id: setting.project_id,
        type: "rotation_reminder",
        title: `${isTestMode ? "TEST: " : ""}Time to rotate secrets`,
        message: `Key rotation reminder for "${
            setting.projects.name
        }". Interval: ${intervalText}. ${
            isTestMode
                ? "This is a test notification."
                : "Consider updating your environment secrets for security."
        }`,
    });

    if (error) {
        console.error("Failed to create notification:", error);
    } else {
        console.log(
            `Created rotation reminder notification for project: ${setting.projects.name}`
        );
    }
}
