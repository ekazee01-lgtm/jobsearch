-- Job Search Automation - Staging Table Setup
-- Add this to your Supabase SQL Editor

-- Staging table for raw job data before processing
CREATE TABLE IF NOT EXISTS job_raw (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on staging table
ALTER TABLE job_raw ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage their own raw job data
CREATE POLICY "Users can manage their raw job data"
ON job_raw FOR ALL
USING (auth.uid() = user_id);

-- Service role can manage all data (for automation)
CREATE POLICY "Service role full access"
ON job_raw FOR ALL
TO service_role
USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_job_raw_source ON job_raw(source);
CREATE INDEX IF NOT EXISTS idx_job_raw_processed ON job_raw(processed);
CREATE INDEX IF NOT EXISTS idx_job_raw_created ON job_raw(created_at DESC);

-- Function to safely extract job URL from raw payload
CREATE OR REPLACE FUNCTION extract_job_url(payload JSONB)
RETURNS TEXT AS $$
BEGIN
    -- Try different common URL field names
    RETURN COALESCE(
        payload->>'url',
        payload->>'jobUrl',
        payload->>'link',
        payload->>'jobLink',
        payload->>'apply_url',
        payload->'urls'->>'job'
    );
END;
$$ LANGUAGE plpgsql;

-- RPC function for duplicate checking
CREATE OR REPLACE FUNCTION check_job_duplicate(job_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if URL already exists in job_applications
    RETURN EXISTS (
        SELECT 1 FROM job_applications
        WHERE url = job_url
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get job stats for monitoring
CREATE OR REPLACE FUNCTION get_job_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    source TEXT,
    total_raw INTEGER,
    processed INTEGER,
    errors INTEGER,
    duplicates INTEGER,
    added_to_main INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH raw_stats AS (
        SELECT
            jr.source,
            COUNT(*) as total_raw,
            COUNT(*) FILTER (WHERE jr.processed = true) as processed,
            COUNT(*) FILTER (WHERE jr.error_message IS NOT NULL) as errors
        FROM job_raw jr
        WHERE jr.created_at >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY jr.source
    ),
    duplicate_stats AS (
        SELECT
            jr.source,
            COUNT(*) FILTER (WHERE check_job_duplicate(extract_job_url(jr.raw_payload))) as duplicates
        FROM job_raw jr
        WHERE jr.created_at >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY jr.source
    ),
    main_stats AS (
        SELECT
            ja.source,
            COUNT(*) as added_to_main
        FROM job_applications ja
        WHERE ja.created_at >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY ja.source
    )
    SELECT
        COALESCE(rs.source, ds.source, ms.source) as source,
        COALESCE(rs.total_raw, 0) as total_raw,
        COALESCE(rs.processed, 0) as processed,
        COALESCE(rs.errors, 0) as errors,
        COALESCE(ds.duplicates, 0) as duplicates,
        COALESCE(ms.added_to_main, 0) as added_to_main
    FROM raw_stats rs
    FULL OUTER JOIN duplicate_stats ds ON rs.source = ds.source
    FULL OUTER JOIN main_stats ms ON COALESCE(rs.source, ds.source) = ms.source;
END;
$$ LANGUAGE plpgsql;

-- View for monitoring raw job processing
CREATE OR REPLACE VIEW job_processing_monitor AS
SELECT
    source,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE processed = true) as processed,
    COUNT(*) FILTER (WHERE processed = false) as pending,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as errors,
    MIN(created_at) as oldest_unprocessed,
    MAX(created_at) as latest_received
FROM job_raw
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY total DESC;

-- Grant permissions
GRANT ALL ON job_raw TO authenticated;
GRANT EXECUTE ON FUNCTION extract_job_url(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION check_job_duplicate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_stats(INTEGER) TO authenticated;
GRANT SELECT ON job_processing_monitor TO authenticated;