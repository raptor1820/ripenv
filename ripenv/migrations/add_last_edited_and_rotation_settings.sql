-- Add last_edited_at column to projects table
ALTER TABLE projects ADD COLUMN last_edited_at TIMESTAMPTZ;

-- Create rotation_settings table
CREATE TABLE rotation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    interval_days INTEGER NOT NULL DEFAULT 30,
    enabled BOOLEAN NOT NULL DEFAULT false,
    last_reminder_sent TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one setting per user per project
    UNIQUE(project_id, user_id)
);

-- Add indexes for performance
CREATE INDEX idx_rotation_settings_project_id ON rotation_settings(project_id);
CREATE INDEX idx_rotation_settings_user_id ON rotation_settings(user_id);
CREATE INDEX idx_rotation_settings_enabled ON rotation_settings(enabled);
CREATE INDEX idx_rotation_settings_reminder_check ON rotation_settings(enabled, last_reminder_sent, interval_days) 
    WHERE enabled = true;

-- Add comment explaining the last_edited_at field
COMMENT ON COLUMN projects.last_edited_at IS 'Timestamp when the project environment files were last modified via CLI';
COMMENT ON TABLE rotation_settings IS 'User-specific settings for key rotation reminder emails';