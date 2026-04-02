-- Debug: Check what tables exist and their structure

-- 1. List all tables in the public schema
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. If application_materials exists, show its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'application_materials'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if the table exists at all
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'application_materials'
    AND table_schema = 'public'
) as table_exists;