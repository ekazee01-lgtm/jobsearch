-- Database Schema Updates for AI Features
-- Execute these SQL statements in your Supabase SQL editor

-- 0. Enable pgvector extension (required for vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Add new columns to existing job_applications table
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS jd_embedding vector(1536),
ADD COLUMN IF NOT EXISTS ai_match_score numeric;

-- 2. Create resume_versions table (if not exists)
CREATE TABLE IF NOT EXISTS resume_versions (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  job_id INTEGER REFERENCES job_applications(id),
  label VARCHAR(255) NOT NULL,
  resume_md TEXT,
  cover_letter_md TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create application_events table (if not exists)
CREATE TABLE IF NOT EXISTS application_events (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES job_applications(id),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_job_id ON resume_versions(job_id);
CREATE INDEX IF NOT EXISTS idx_application_events_job_id ON application_events(job_id);
CREATE INDEX IF NOT EXISTS idx_application_events_type ON application_events(type);

-- 4.1. Create UNIQUE constraint for upsert operations on resume_versions
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_versions_user_label
ON resume_versions(user_id, label);

-- 5. Set up Row Level Security (RLS) for new tables
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
CREATE POLICY "Users can manage their own resume versions" ON resume_versions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own application events" ON application_events
  FOR ALL USING (auth.uid() = user_id);

-- 7. Insert a master resume template (optional - update with your actual resume)
-- Uncomment and customize this section:
/*
INSERT INTO resume_versions (user_id, label, resume_md, cover_letter_md)
VALUES (
  auth.uid(),
  'Master',
  '# Eric Kazee
## AI Adoption & Legal Technology Specialist

**Contact Information:**
- Email: ekazee@outlook.com
- Phone: 214.728.0973
- Location: Aubrey, TX
- LinkedIn: linkedin.com/in/erickazee

### Professional Summary
Results-driven AI Adoption Specialist with 12+ years in legal technology and 3+ years pioneering generative AI implementation. Expert in translating complex AI capabilities into practical legal workflows for contract analysis, research, litigation support, and strategic advisory work.

### Core Competencies
- AI Strategy & Implementation
- Legal Technology Solutions
- Prompt Engineering & Libraries
- Training & Development
- ABA Model Rule 1.1 Compliance
- Contract Analysis Automation
- Legal Research AI Tools

### Professional Experience

#### AI Adoption & Venture Projects | Nov 2022 - Present
- Built comprehensive prompt libraries for contract analysis and legal research
- Created role-specific training modules for partners, paralegals, and administrators
- Implemented ABA Model Rule 1.1 compliance protocols for AI usage
- Developed automated workflows reducing contract review time by 60%
- Led cross-functional teams in AI tool evaluation and deployment

#### Legal Technology Specialist | Previous Roles
- 12+ years implementing technology solutions in legal environments
- Expertise in document management, case management, and litigation support
- Track record of successful system migrations and user adoption
- Strong understanding of legal workflows and confidentiality requirements

### Education & Certifications
- Relevant certifications and education details
- Continuous learning in AI and legal technology trends

### Technical Skills
- AI Tools: ChatGPT, Claude, GPT-4, Prompt Engineering
- Legal Software: [List relevant legal software]
- Technical: API Integration, Workflow Automation, Data Analysis
- Compliance: ABA Model Rules, Legal Ethics, Confidentiality Protocols',
  'Dear Hiring Manager,

I am writing to express my interest in joining your organization as an AI Adoption Specialist. With over 12 years of legal technology experience and 3+ years specializing in AI implementation, I bring a unique combination of technical expertise and deep understanding of legal workflows.

My experience includes:
- Successfully implementing AI solutions that reduced contract review time by 60%
- Building comprehensive prompt libraries for legal research and analysis
- Training legal professionals on AI tools while maintaining strict compliance standards
- Developing ABA Model Rule 1.1 compliant AI protocols

I am passionate about helping legal organizations harness the power of AI while maintaining the highest standards of client confidentiality and professional responsibility.

I would welcome the opportunity to discuss how my experience can contribute to your team''s success.

Best regards,
Eric Kazee'
) ON CONFLICT DO NOTHING;
*/