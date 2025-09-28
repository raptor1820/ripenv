import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// TEST VERSION - Sends reminders every minute for interval_days = 0
interface RotationReminderRecord {
    id: string;
    project_id: string;
    user_id: string;
    interval_days: number;
    last_reminder_sent: string | null;
    projects: {
        name: string;
        last_edited_at: string | null;
    };
    profiles: {
        email: string;
    };
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// Admin email for testing notifications
const ADMIN_EMAIL = "ritwicverma@gmail.com"; // Replace with your actual admin email

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const now = new Date();

        // Query for enabled rotation settings
        const { data: reminderRecords, error: fetchError } =
            (await supabaseClient
                .from("rotation_settings")
                .select(
                    `
        id,
        project_id,
        user_id,
        interval_days,
        last_reminder_sent,
        projects!inner(name, last_edited_at),
        profiles!inner(email)
      `
                )
                .eq("enabled", true)) as {
                data: RotationReminderRecord[] | null;
                error: any;
            };

        if (fetchError) {
            console.error("Failed to fetch reminder records:", fetchError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch reminder records" }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        if (!reminderRecords || reminderRecords.length === 0) {
            console.log("No enabled rotation reminders found");
            return new Response(
                JSON.stringify({
                    message: "No reminders to send",
                    sent_count: 0,
                }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        const remindersToSend: RotationReminderRecord[] = [];

        // Check each record
        for (const record of reminderRecords) {
            const shouldSendReminder = checkShouldSendReminder(record, now);
            if (shouldSendReminder) {
                remindersToSend.push(record);
            }
        }

        console.log(`Found ${remindersToSend.length} reminders to send`);

        // Process reminders
        const emailResults = await Promise.allSettled(
            remindersToSend.map((record) =>
                processReminder(record, supabaseClient)
            )
        );

        // Update timestamps for successful sends
        const updatePromises = remindersToSend.map(async (record, index) => {
            const emailResult = emailResults[index];
            if (emailResult.status === "fulfilled") {
                return supabaseClient
                    .from("rotation_settings")
                    .update({ last_reminder_sent: now.toISOString() })
                    .eq("id", record.id);
            }
            return null;
        });

        await Promise.allSettled(updatePromises);

        const successCount = emailResults.filter(
            (result) => result.status === "fulfilled"
        ).length;
        const failedCount = emailResults.filter(
            (result) => result.status === "rejected"
        ).length;

        console.log(
            `Processed ${successCount} reminders successfully, ${failedCount} failed`
        );

        return new Response(
            JSON.stringify({
                message: "Test rotation reminders processed",
                sent_count: successCount,
                failed_count: failedCount,
                test_mode: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in test send-rotation-reminders function:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

function checkShouldSendReminder(
    record: RotationReminderRecord,
    now: Date
): boolean {
    // TEST MODE: interval_days = 0 means 1 minute for testing
    if (record.interval_days === 0) {
        const oneMinute = 60 * 1000; // 1 minute in milliseconds

        if (!record.last_reminder_sent) {
            return true; // Send immediately if never sent
        }

        const lastReminderTime = new Date(record.last_reminder_sent);
        const timeSinceLastReminder =
            now.getTime() - lastReminderTime.getTime();

        return timeSinceLastReminder >= oneMinute;
    }

    // Normal mode: use days
    const intervalMs = record.interval_days * 24 * 60 * 60 * 1000;

    if (!record.last_reminder_sent) {
        if (!record.projects.last_edited_at) {
            return false;
        }

        const lastEditTime = new Date(record.projects.last_edited_at);
        const timeSinceLastEdit = now.getTime() - lastEditTime.getTime();

        return timeSinceLastEdit >= intervalMs;
    }

    const lastReminderTime = new Date(record.last_reminder_sent);
    const timeSinceLastReminder = now.getTime() - lastReminderTime.getTime();

    return timeSinceLastReminder >= intervalMs;
}

async function processReminder(
    record: RotationReminderRecord,
    supabaseClient: any
): Promise<void> {
    console.log(
        `Processing reminder for ${record.profiles.email} - project ${record.projects.name}`
    );

    // 1. Send email reminder
    await sendReminderEmail(record);

    // 2. Create in-app notification
    await createInAppNotification(record, supabaseClient);

    // 3. Send admin notification
    await sendAdminNotification(record);
}

async function sendReminderEmail(
    record: RotationReminderRecord
): Promise<void> {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
        console.warn("RESEND_API_KEY not set, skipping email");
        return;
    }

    const isTestMode = record.interval_days === 0;
    const intervalText = isTestMode
        ? "1 minute (TEST MODE)"
        : `${record.interval_days} days`;

    const emailPayload = {
        from: "Ripenv Test <test@ripenv.dev>",
        to: [record.profiles.email],
        subject: `${
            isTestMode ? "🧪 TEST: " : "🔐"
        } Time to rotate secrets for "${record.projects.name}"`,
        html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px; text-align: center;">
            <h1>${isTestMode ? "🧪 TEST MODE" : "🔐 Security Alert"}</h1>
            <p>Key rotation reminder for ${record.projects.name}</p>
          </div>
          
          <div style="padding: 20px; margin: 20px 0; background: #f8fafc; border-radius: 8px;">
            <h2>Project: ${record.projects.name}</h2>
            <p><strong>Interval:</strong> ${intervalText}</p>
            <p><strong>Status:</strong> ${
                isTestMode
                    ? "Testing 1-minute reminders"
                    : "Production reminder"
            }</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${
                Deno.env.get("FRONTEND_URL") || "http://localhost:3000"
            }/projects/${record.project_id}" 
               style="display: inline-block; background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px;">
              Manage Project Security
            </a>
          </div>
        </body>
      </html>
    `,
    };

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email failed: ${response.status} ${errorText}`);
    }

    console.log(`Email sent to ${record.profiles.email}`);
}

async function createInAppNotification(
    record: RotationReminderRecord,
    supabaseClient: any
): Promise<void> {
    const isTestMode = record.interval_days === 0;

    const { error } = await supabaseClient.from("notifications").insert({
        user_id: record.user_id,
        project_id: record.project_id,
        type: "rotation_reminder",
        title: `${isTestMode ? "TEST: " : ""}Time to rotate secrets`,
        message: `Key rotation reminder for "${record.projects.name}". ${
            isTestMode
                ? "This is a test notification sent every minute."
                : "Consider updating your environment secrets."
        }`,
    });

    if (error) {
        console.error("Failed to create in-app notification:", error);
    } else {
        console.log(`In-app notification created for user ${record.user_id}`);
    }
}

async function sendAdminNotification(
    record: RotationReminderRecord
): Promise<void> {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
        console.warn("RESEND_API_KEY not set, skipping admin notification");
        return;
    }

    const isTestMode = record.interval_days === 0;

    const emailPayload = {
        from: "Ripenv Admin <admin@ripenv.dev>",
        to: [ADMIN_EMAIL],
        subject: `${
            isTestMode ? "[TEST] " : "[ADMIN] "
        }Rotation reminder sent to ${record.profiles.email}`,
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${isTestMode ? "🧪 Test " : "📊 Admin "}Notification</h2>
        
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Reminder Details</h3>
          <p><strong>User:</strong> ${record.profiles.email}</p>
          <p><strong>Project:</strong> ${record.projects.name}</p>
          <p><strong>Interval:</strong> ${
              isTestMode ? "1 minute (TEST)" : record.interval_days + " days"
          }</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Mode:</strong> ${
              isTestMode ? "Test Mode - 1 minute intervals" : "Production"
          }</p>
        </div>
        
        <p><small>This is an automated admin notification from the Ripenv rotation reminder system.</small></p>
      </div>
    `,
    };

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayload),
        });

        if (response.ok) {
            console.log(`Admin notification sent to ${ADMIN_EMAIL}`);
        } else {
            console.error("Admin email failed:", response.status);
        }
    } catch (error) {
        console.error("Admin notification error:", error);
    }
}
