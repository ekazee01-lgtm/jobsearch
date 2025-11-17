-- Enhanced database schema for interview scheduling automation

-- Add interview-related columns to existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_datetime TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_status TEXT DEFAULT 'none';
-- Values: none, requested, scheduled, completed, cancelled

-- Create interview_schedule table for detailed tracking
CREATE TABLE IF NOT EXISTS interview_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    contact_person TEXT,
    recruiter_email TEXT,
    interview_type TEXT DEFAULT 'video', -- video, phone, in_person
    interview_datetime TIMESTAMP NOT NULL,
    calendar_event_id TEXT, -- Google Calendar event ID
    selection_token TEXT, -- For tracking slot selections
    status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced communication_history table for better email tracking
ALTER TABLE communication_history ADD COLUMN IF NOT EXISTS classification_confidence INTEGER;
ALTER TABLE communication_history ADD COLUMN IF NOT EXISTS auto_replied BOOLEAN DEFAULT FALSE;
ALTER TABLE communication_history ADD COLUMN IF NOT EXISTS selection_token TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_interview_schedule_datetime ON interview_schedule(interview_datetime);
CREATE INDEX IF NOT EXISTS idx_interview_schedule_company ON interview_schedule(company);
CREATE INDEX IF NOT EXISTS idx_jobs_interview_status ON jobs(interview_status);
CREATE INDEX IF NOT EXISTS idx_communication_classification ON communication_history(response_type);

-- Create notification triggers for interview events
CREATE OR REPLACE FUNCTION notify_interview_scheduled()
RETURNS trigger AS $$
BEGIN
    -- Notify external systems when interview is scheduled
    PERFORM pg_notify('interview_scheduled',
        json_build_object(
            'interview_id', NEW.id,
            'company', NEW.company,
            'position', NEW.position,
            'datetime', NEW.interview_datetime,
            'status', NEW.status
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER interview_scheduled_trigger
    AFTER INSERT ON interview_schedule
    FOR EACH ROW
    EXECUTE FUNCTION notify_interview_scheduled();

-- Sample data view for dashboard
CREATE OR REPLACE VIEW upcoming_interviews AS
SELECT
    i.id,
    i.company,
    i.position,
    i.contact_person,
    i.interview_datetime,
    i.interview_type,
    i.status,
    j.job_title,
    j.url as job_url,
    j.ai_match_score,
    EXTRACT(EPOCH FROM (i.interview_datetime - NOW())) / 3600 as hours_until_interview
FROM interview_schedule i
LEFT JOIN jobs j ON i.job_id = j.id
WHERE i.interview_datetime >= NOW()
    AND i.status = 'scheduled'
ORDER BY i.interview_datetime ASC;

-- Analytics view for reporting
CREATE OR REPLACE VIEW interview_analytics AS
SELECT
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as total_interviews,
    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_interviews,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_interviews,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_interviews,
    AVG(EXTRACT(EPOCH FROM (interview_datetime - created_at)) / 3600) as avg_hours_to_schedule
FROM interview_schedule
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY week
ORDER BY week DESC;

-- Email processing statistics
CREATE OR REPLACE VIEW email_processing_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN response_type = 'interview_request' THEN 1 END) as interview_requests,
    COUNT(CASE WHEN response_type = 'rejection' THEN 1 END) as rejections,
    COUNT(CASE WHEN response_type = 'acknowledgment' THEN 1 END) as acknowledgments,
    COUNT(CASE WHEN auto_replied = true THEN 1 END) as auto_replies_sent,
    AVG(classification_confidence) as avg_classification_confidence
FROM communication_history
WHERE created_at > NOW() - INTERVAL '2 weeks'
GROUP BY DATE(created_at)
ORDER BY date DESC;