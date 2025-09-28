-- Setup script for rotation reminder system
-- Run this after deploying the edge function and setting environment variables

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create a function to trigger the rotation reminders edge function
CREATE OR REPLACE FUNCTION trigger_rotation_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
  service_role_key text;
  response record;
BEGIN
  -- Get the Supabase project URL and service role key
  -- These should be set as database settings
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-rotation-reminders';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings are not configured, use environment variables or default
  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Supabase settings not configured. Please set app.settings.supabase_url and app.settings.service_role_key';
    RETURN;
  END IF;

  -- Make the HTTP request to the edge function
  SELECT INTO response * FROM http_post(
    function_url,
    '{}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || service_role_key),
      http_header('Content-Type', 'application/json')
    ]
  );

  -- Log the result
  IF response.status = 200 THEN
    RAISE NOTICE 'Rotation reminders triggered successfully: %', response.content;
  ELSE
    RAISE WARNING 'Failed to trigger rotation reminders. Status: %, Content: %', response.status, response.content;
  END IF;

EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error triggering rotation reminders: %', SQLERRM;
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION trigger_rotation_reminders() TO service_role;

-- Schedule the function to run daily at 9 AM UTC
-- Adjust the time as needed for your timezone
SELECT cron.schedule(
  'rotation-reminders-daily',
  '0 9 * * *',  -- Daily at 9:00 AM UTC
  'SELECT trigger_rotation_reminders();'
);

-- Alternative schedules (uncomment one if you prefer):
-- Every 6 hours:
-- SELECT cron.schedule('rotation-reminders-6h', '0 */6 * * *', 'SELECT trigger_rotation_reminders();');

-- Every Monday at 9 AM:
-- SELECT cron.schedule('rotation-reminders-weekly', '0 9 * * 1', 'SELECT trigger_rotation_reminders();');

-- View scheduled cron jobs
SELECT * FROM cron.job WHERE jobname LIKE '%rotation%';

-- To remove the scheduled job (if needed):
-- SELECT cron.unschedule('rotation-reminders-daily');

COMMENT ON FUNCTION trigger_rotation_reminders() IS 'Triggers the send-rotation-reminders edge function to check and send key rotation reminder emails';