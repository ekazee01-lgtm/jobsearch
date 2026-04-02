-- Corrected Application Materials Setup
-- Based on Supabase AI Assistant feedback

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for application_materials
DROP TRIGGER IF EXISTS update_application_materials_updated_at ON application_materials;
CREATE TRIGGER update_application_materials_updated_at
  BEFORE UPDATE ON application_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (idempotent if already enabled)
ALTER TABLE application_materials ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (explicit per-operation, recommended)
DROP POLICY IF EXISTS "application_materials_select_own" ON application_materials;
CREATE POLICY "application_materials_select_own" ON application_materials
  FOR SELECT TO authenticated
  USING ( (SELECT auth.uid()) = user_id );

DROP POLICY IF EXISTS "application_materials_insert_own" ON application_materials;
CREATE POLICY "application_materials_insert_own" ON application_materials
  FOR INSERT TO authenticated
  WITH CHECK ( (SELECT auth.uid()) = user_id );

DROP POLICY IF EXISTS "application_materials_update_own" ON application_materials;
CREATE POLICY "application_materials_update_own" ON application_materials
  FOR UPDATE TO authenticated
  USING ( (SELECT auth.uid()) = user_id )
  WITH CHECK ( (SELECT auth.uid()) = user_id );

DROP POLICY IF EXISTS "application_materials_delete_own" ON application_materials;
CREATE POLICY "application_materials_delete_own" ON application_materials
  FOR DELETE TO authenticated
  USING ( (SELECT auth.uid()) = user_id );

-- Create indexes (using correct column name 'type' not 'material_type')
CREATE INDEX IF NOT EXISTS idx_application_materials_user_id ON application_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_application_materials_application_id ON application_materials(application_id);
CREATE INDEX IF NOT EXISTS idx_application_materials_type ON application_materials(type);

-- Grant minimal permissions (following security best practices)
GRANT SELECT, INSERT, UPDATE, DELETE ON application_materials TO authenticated;
GRANT ALL ON application_materials TO service_role;

SELECT 'Application materials setup completed successfully!' as message;