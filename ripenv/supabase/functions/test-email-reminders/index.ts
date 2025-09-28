import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// Replace with your actual admin email
const ADMIN_EMAIL = "ritwicverma@gmail.com";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("Starting rotation reminders check...");

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const now = new Date();

        // Get enabled rotation settings with project and user info
        const { data: settings, error: fetchError } = await supabaseClient
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
            .eq("enabled", true);

        if (fetchError) {
            console.error("Fetch error:", fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!settings || settings.length === 0) {
            console.log("No enabled rotation settings found");
            return new Response(
                JSON.stringify({ message: "No settings found", count: 0 }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        console.log(`Found ${settings.length} enabled settings`);
        let sentCount = 0;

        for (const setting of settings) {
            const shouldSend = checkShouldSendReminder(setting, now);
            console.log(`Setting ${setting.id}: shouldSend = ${shouldSend}`);

            if (shouldSend) {
                try {
                    await sendEmail(setting);

                    // Update last_reminder_sent
                    await supabaseClient
                        .from("rotation_settings")
                        .update({ last_reminder_sent: now.toISOString() })
                        .eq("id", setting.id);

                    sentCount++;
                    console.log(`Email sent to ${setting.profiles.email}`);
                } catch (emailError) {
                    console.error(
                        `Failed to send email to ${setting.profiles.email}:`,
                        emailError
                    );
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: `Processed ${settings.length} settings, sent ${sentCount} reminders`,
                processed: settings.length,
                sent: sentCount,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

function checkShouldSendReminder(setting: any, now: Date): boolean {
    // Test mode: interval_days = 0 means 1 minute
    if (setting.interval_days === 0) {
        const oneMinute = 60 * 1000;

        if (!setting.last_reminder_sent) {
            console.log(
                `No previous reminder for ${setting.profiles.email}, sending now`
            );
            return true;
        }

        const lastSent = new Date(setting.last_reminder_sent);
        const timeDiff = now.getTime() - lastSent.getTime();
        console.log(
            `Time since last reminder: ${timeDiff}ms (need ${oneMinute}ms)`
        );

        return timeDiff >= oneMinute;
    }

    // Normal mode: use days
    const intervalMs = setting.interval_days * 24 * 60 * 60 * 1000;

    if (!setting.last_reminder_sent) {
        if (!setting.projects.last_edited_at) {
            console.log(
                `No last edit time for project ${setting.projects.name}`
            );
            return false;
        }

        const lastEdit = new Date(setting.projects.last_edited_at);
        const timeDiff = now.getTime() - lastEdit.getTime();
        console.log(
            `Time since last edit: ${timeDiff}ms (need ${intervalMs}ms)`
        );

        return timeDiff >= intervalMs;
    }

    const lastSent = new Date(setting.last_reminder_sent);
    const timeDiff = now.getTime() - lastSent.getTime();
    console.log(
        `Time since last reminder: ${timeDiff}ms (need ${intervalMs}ms)`
    );

    return timeDiff >= intervalMs;
}

async function sendEmail(setting: any) {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
        throw new Error("RESEND_API_KEY not configured");
    }

    const isTestMode = setting.interval_days === 0;
    const intervalText = isTestMode
        ? "1 minute (TEST)"
        : `${setting.interval_days} days`;

    const lastEditText = setting.projects.last_edited_at
        ? new Date(setting.projects.last_edited_at).toLocaleString()
        : "Never";

    const emailData = {
        from: "Ripenv Security <test@ripenv.com>",
        to: [setting.profiles.email],
        subject: `${
            isTestMode ? "🧪 TEST: " : "🔐 "
        }Time to rotate secrets for "${setting.projects.name}"`,
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <h1>${isTestMode ? "🧪 TEST REMINDER" : "🔐 Security Alert"}</h1>
          <p>Key rotation reminder</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2>Project: ${setting.projects.name}</h2>
          <p><strong>Last Updated:</strong> ${lastEditText}</p>
          <p><strong>Reminder Interval:</strong> ${intervalText}</p>
          <p><strong>Status:</strong> ${
              isTestMode ? "Testing Mode" : "Action Required"
          }</p>
        </div>
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px;">
          <h3 style="color: #1e40af; margin: 0 0 10px;">🛡️ Security Reminder</h3>
          <p style="color: #1e40af; margin: 0;">
            ${
                isTestMode
                    ? "This is a test notification sent every minute. In production, reminders are sent based on your configured interval."
                    : "Consider rotating your environment secrets to maintain security. Regular rotation helps minimize exposure risk."
            }
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${
              Deno.env.get("FRONTEND_URL") || "http://localhost:3000"
          }/projects/${setting.project_id}" 
             style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Manage Project Security
          </a>
        </div>
        
        <p style="text-align: center; color: #64748b; font-size: 12px;">
          <a href="${
              Deno.env.get("FRONTEND_URL") || "http://localhost:3000"
          }/projects/${setting.project_id}" style="color: #0ea5e9;">
            Update notification settings
          </a>
        </p>
      </div>
    `,
    };

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailData),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Email sent successfully:`, result);

    // Also send admin notification
    await sendAdminEmail(setting);
}

async function sendAdminEmail(setting: any) {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey || ADMIN_EMAIL === "admin@yourapp.com") return;

    const isTestMode = setting.interval_days === 0;

    const adminEmailData = {
        from: "Ripenv Admin <admin@ripenv.com>",
        to: [ADMIN_EMAIL],
        subject: `${isTestMode ? "[TEST] " : "[ADMIN] "}Reminder sent to ${
            setting.profiles.email
        }`,
        html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>${isTestMode ? "🧪 Test" : "📊 Admin"} Notification</h2>
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px;">
          <p><strong>User:</strong> ${setting.profiles.email}</p>
          <p><strong>Project:</strong> ${setting.projects.name}</p>
          <p><strong>Interval:</strong> ${
              isTestMode ? "1 minute (TEST)" : setting.interval_days + " days"
          }</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      </div>
    `,
    };

    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(adminEmailData),
        });
    } catch (error) {
        console.error("Admin email failed:", error);
    }
}
