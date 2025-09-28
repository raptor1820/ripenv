import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Calculate cutoff date - check for reminders that should be sent
        const now = new Date();

        // Query for enabled rotation settings that need reminders
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

        // Check each record to see if a reminder should be sent
        for (const record of reminderRecords) {
            const shouldSendReminder = checkShouldSendReminder(record, now);
            if (shouldSendReminder) {
                remindersToSend.push(record);
            }
        }

        console.log(`Found ${remindersToSend.length} reminders to send`);

        // Send email reminders
        const emailResults = await Promise.allSettled(
            remindersToSend.map((record) => sendReminderEmail(record))
        );

        // Update last_reminder_sent for successful sends
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
            `Sent ${successCount} reminders successfully, ${failedCount} failed`
        );

        return new Response(
            JSON.stringify({
                message: "Rotation reminders processed",
                sent_count: successCount,
                failed_count: failedCount,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error in send-rotation-reminders function:", error);
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
    const intervalMs = record.interval_days * 24 * 60 * 60 * 1000;

    // If never sent a reminder before, check based on project last edit
    if (!record.last_reminder_sent) {
        if (!record.projects.last_edited_at) {
            // No last edit time, don't send reminder yet
            return false;
        }

        const lastEditTime = new Date(record.projects.last_edited_at);
        const timeSinceLastEdit = now.getTime() - lastEditTime.getTime();

        return timeSinceLastEdit >= intervalMs;
    }

    // Check if enough time has passed since last reminder
    const lastReminderTime = new Date(record.last_reminder_sent);
    const timeSinceLastReminder = now.getTime() - lastReminderTime.getTime();

    return timeSinceLastReminder >= intervalMs;
}

async function sendReminderEmail(
    record: RotationReminderRecord
): Promise<void> {
    console.log(
        `Sending rotation reminder to ${record.profiles.email} for project ${record.projects.name}`
    );

    // Get the Resend API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
        throw new Error("RESEND_API_KEY environment variable not set");
    }

    const lastEditText = record.projects.last_edited_at
        ? new Date(record.projects.last_edited_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "Never";

    const emailPayload = {
        from: "Ripenv Security <security@ripenv.dev>",
        to: [record.profiles.email],
        subject: `🔐 Time to rotate secrets for "${record.projects.name}"`,
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Key Rotation Reminder</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px 20px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: bold;">🔐 Ripenv Security Alert</h1>
            <p style="margin: 0; opacity: 0.9;">Time for environment secret rotation</p>
          </div>

          <!-- Main Content -->
          <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #0ea5e9;">
            <h2 style="color: #1e293b; margin: 0 0 15px; font-size: 20px;">Project: ${
                record.projects.name
            }</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0 0 10px;"><strong>Last Environment Update:</strong> ${lastEditText}</p>
              <p style="margin: 0 0 10px;"><strong>Reminder Interval:</strong> Every ${
                  record.interval_days
              } days</p>
              <p style="margin: 0; color: #dc2626;"><strong>Action Required:</strong> Rotate your environment secrets</p>
            </div>
          </div>

          <!-- Action Section -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${
                Deno.env.get("FRONTEND_URL") || "https://your-app.com"
            }/projects/${record.project_id}" 
               style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              🛡️ Manage Project Security
            </a>
          </div>

          <!-- Security Tips -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 16px;">🛡️ Security Best Practices</h3>
            <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
              <li style="margin-bottom: 8px;">Rotate secrets regularly to minimize exposure risk</li>
              <li style="margin-bottom: 8px;">Use strong, unique passwords for each environment</li>
              <li style="margin-bottom: 8px;">Monitor access logs and remove unused keys</li>
              <li style="margin-bottom: 0;">Keep your team informed of rotation schedules</li>
            </ul>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e2e8f0; margin-top: 30px;">
            <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">
              This reminder was sent because you have rotation reminders enabled for this project.
            </p>
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              <a href="${
                  Deno.env.get("FRONTEND_URL") || "https://your-app.com"
              }/projects/${
            record.project_id
        }" style="color: #0ea5e9; text-decoration: none;">
                Manage notification settings
              </a> | 
              <a href="https://ripenv.dev" style="color: #0ea5e9; text-decoration: none;">Ripenv Security</a>
            </p>
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
        throw new Error(`Resend API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(
        `Email sent successfully to ${record.profiles.email}:`,
        result.id
    );
}
