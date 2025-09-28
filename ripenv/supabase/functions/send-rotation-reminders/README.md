# Configuration for the send-rotation-reminders Edge Function

## Environment Variables Required

The following environment variables must be set in your Supabase project:

-   `RESEND_API_KEY`: Your Resend API key for sending emails
-   `FRONTEND_URL`: Your frontend application URL (e.g., https://your-app.com)

## Deployment

1. Deploy the edge function:

```bash
supabase functions deploy send-rotation-reminders
```

2. Set the required environment variables:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
supabase secrets set FRONTEND_URL=https://your-app.com
```

## Scheduled Execution

To run this function on a schedule, you can:

1. **Use Supabase Cron Jobs** (recommended):

    - Set up a database function that calls the edge function
    - Use pg_cron to schedule it

2. **Use External Cron** (alternative):
    - Set up a cron job on your server to call the function
    - Use a service like GitHub Actions with scheduled workflows

### Example Cron Setup

Create a SQL function to call the edge function:

```sql
CREATE OR REPLACE FUNCTION trigger_rotation_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-rotation-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    );
END;
$$;
```

Then schedule it with pg_cron (daily at 9 AM UTC):

```sql
SELECT cron.schedule(
  'rotation-reminders-daily',
  '0 9 * * *',
  'SELECT trigger_rotation_reminders();'
);
```

## Manual Testing

You can test the function manually by calling it:

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/send-rotation-reminders" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"
```

## Function Logic

The function:

1. Queries all enabled rotation settings
2. Checks if reminders should be sent based on:
    - Time since last environment update
    - Time since last reminder sent
    - Configured interval
3. Sends beautiful HTML email reminders using Resend
4. Updates the last_reminder_sent timestamp for successful sends

## Security

-   Uses service role key for database operations
-   Only sends reminders to users who have explicitly enabled them
-   Includes unsubscribe links in emails
-   Follows email best practices for deliverability
