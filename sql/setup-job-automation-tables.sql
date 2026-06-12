-- Job Search Automation Database Setup
-- Run this in Supabase SQL Editor to create required tables

-- 1. Job Raw Data Table (from RSS feeds and job boards)
CREATE TABLE IF NOT EXISTS job_raw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'rss', 'indeed', 'linkedin', etc.
    job_url TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    description TEXT,
    posted_date TIMESTAMPTZ,
    salary_range TEXT,
    job_type TEXT, -- 'full-time', 'contract', 'remote', etc.
    raw_data JSONB, -- Store original job posting data
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate jobs from same source
    UNIQUE(source_url, job_url)
);

-- 2. Enhanced Job Applications Table (user-specific applications)
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Job details
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    job_url TEXT,
    location TEXT,
    salary_range TEXT,
    job_type TEXT,
    description TEXT,

    -- Application tracking
    status TEXT NOT NULL DEFAULT 'Ready to Apply',
    ai_relevance_score INTEGER, -- 1-10 score from OpenAI
    ai_reasoning TEXT, -- Why this job was selected/scored

    -- Application materials
    resume_version TEXT, -- Which resume version was used
    cover_letter_version TEXT, -- Which cover letter version was used

    -- Timeline tracking
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    interview_scheduled_at TIMESTAMPTZ,
    outcome TEXT, -- 'hired', 'rejected', 'no-response', 'withdrew'

    -- Notes and tracking
    notes TEXT,
    application_method TEXT, -- 'email', 'website', 'recruiter', etc.
    recruiter_contact TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Reference to raw job data if applicable
    source_job_id UUID REFERENCES job_raw(id) ON DELETE SET NULL
);

-- 3. Application Materials Storage (resumes and cover letters)
CREATE TABLE IF NOT EXISTS application_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,

    -- Material details
    material_type TEXT NOT NULL, -- 'resume', 'cover_letter'
    label TEXT NOT NULL, -- Human-readable name
    content TEXT NOT NULL, -- Full text content
    format TEXT DEFAULT 'markdown', -- 'markdown', 'html', 'pdf'

    -- Generation metadata
    generated_by TEXT, -- 'manual', 'ai-claude', 'ai-openai', etc.
    generation_prompt TEXT, -- Prompt used for AI generation

    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one of each type per application
    UNIQUE(application_id, material_type)
);

-- Create updated_at trigger for job_applications
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_materials_updated_at
    BEFORE UPDATE ON application_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE job_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_materials ENABLE ROW LEVEL SECURITY;

-- job_raw: Read-only for all authenticated users (shared job feed)
CREATE POLICY "Public job_raw read access" ON job_raw
    FOR SELECT TO authenticated
    USING (true);

-- job_raw: Only system/service role can insert
CREATE POLICY "Service job_raw write access" ON job_raw
    FOR ALL TO service_role
    USING (true);

-- job_applications: Users can only access their own applications
CREATE POLICY "Users can access own job_applications" ON job_applications
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- application_materials: Users can only access their own materials
CREATE POLICY "Users can access own application_materials" ON application_materials
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_raw_source_type ON job_raw(source_type);
CREATE INDEX IF NOT EXISTS idx_job_raw_posted_date ON job_raw(posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_raw_processed_at ON job_raw(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_ai_score ON job_applications(ai_relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_discovered_at ON job_applications(discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_materials_user_id ON application_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_application_materials_application_id ON application_materials(application_id);
CREATE INDEX IF NOT EXISTS idx_application_materials_type ON application_materials(material_type);

-- Insert sample data for testing (optional)
-- This will help verify the tables work correctly

-- Sample job raw data
INSERT INTO job_raw (source_url, source_type, job_url, title, company, location, description, job_type)
VALUES
    ('https://www.google.com/alerts/feeds/14300375354423668492/10755734950416799199', 'rss', 'https://example.com/job1', 'AI Implementation Specialist', 'Tech Corp', 'Remote', 'Looking for AI implementation expert...', 'full-time'),
    ('https://www.google.com/alerts/feeds/14300375354423668492/9346164383827631766', 'rss', 'https://example.com/job2', 'AI Product Manager', 'StartupCo', 'San Francisco, CA', 'Seeking AI product management leader...', 'full-time')
ON CONFLICT (source_url, job_url) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON job_raw TO authenticated;
GRANT ALL ON job_applications TO authenticated;
GRANT ALL ON application_materials TO authenticated;

-- Grant service role full access for serverless automation
GRANT ALL ON job_raw TO service_role;
GRANT ALL ON job_applications TO service_role;
GRANT ALL ON application_materials TO service_role;

-- Success message
SELECT 'Job automation database setup completed successfully!' as message;
