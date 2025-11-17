/**
 * AI Features Module (Secure Version)
 * Handles resume tailoring and application automation via secure backend functions
 * This version uses Supabase Edge Functions instead of direct OpenAI API calls
 */

class AIFeaturesSecure {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        // Use Supabase Edge Functions instead of direct OpenAI calls
        this.functionsUrl = `${supabaseClient.supabaseUrl}/functions/v1`;
    }

    /**
     * Get user's master resume
     */
    async getMasterResume(userId) {
        const { data, error } = await this.supabase
            .from('resume_versions')
            .select('*')
            .eq('user_id', userId)
            .eq('label', 'Master')
            .single();

        if (error) {
            console.error('Error fetching master resume:', error);
            return null;
        }

        return data;
    }

    /**
     * Create or update master resume
     */
    async saveMasterResume(userId, resumeMarkdown, coverLetterTemplate = '') {
        const { data, error } = await this.supabase
            .from('resume_versions')
            .upsert({
                user_id: userId,
                label: 'Master',
                resume_md: resumeMarkdown,
                cover_letter_md: coverLetterTemplate
            }, {
                onConflict: 'user_id,label'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving master resume:', error);
            throw error;
        }

        return data;
    }

    /**
     * Initialize master materials from the assets folder
     */
    async initializeMasterMaterials(userId) {
        try {
            // Check if master resume already exists
            const existingResume = await this.getMasterResume(userId);
            if (existingResume) {
                console.log('Master resume already exists');
                return existingResume;
            }

            // Load master resume from assets (relative path for GitHub Pages)
            const basePath = window.location.pathname.replace(/[^/]+$/, '');
            const resumeResponse = await fetch(`${basePath}assets/master-resume.md`);
            const masterResumeContent = await resumeResponse.text();

            // Load cover letter templates from assets
            const templateResponse = await fetch(`${basePath}assets/cover-letter-templates.md`);
            const coverLetterTemplates = await templateResponse.text();

            // Save master resume
            const masterResume = await this.saveMasterResume(userId, masterResumeContent);

            // Save cover letter template as separate entry
            const { data: templateData, error: templateError } = await this.supabase
                .from('resume_versions')
                .upsert({
                    user_id: userId,
                    label: 'Cover Letter Template',
                    resume_md: '',
                    cover_letter_md: coverLetterTemplates
                }, {
                    onConflict: 'user_id,label'
                })
                .select()
                .single();

            if (templateError) {
                console.error('Error saving cover letter template:', templateError);
            }

            // Log initialization event
            await this.logEvent(null, userId, 'master_materials_initialized', {
                master_resume_id: masterResume.id,
                template_id: templateData?.id
            });

            return masterResume;

        } catch (error) {
            console.error('Error initializing master materials:', error);
            throw error;
        }
    }

    /**
     * Tailor resume for specific job using secure Edge Function
     */
    async tailorResume(jobId, userId) {
        try {
            // Get current session token for authentication
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session) {
                throw new Error('User not authenticated');
            }

            // Call the secure Edge Function
            const response = await fetch(`${this.functionsUrl}/tailor-resume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    jobId: jobId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to tailor resume');
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Resume tailoring failed');
            }

            // Return the result with the expected format
            return {
                id: result.resume_version_id,
                label: result.label
            };

        } catch (error) {
            console.error('Error tailoring resume:', error);
            throw error;
        }
    }

    /**
     * Prepare application (no OpenAI API needed - just data preparation)
     */
    async prepareApplication(jobId, resumeVersionId, userId) {
        try {
            // Get job and resume data
            const { data: job } = await this.supabase
                .from('job_applications')
                .select('*')
                .eq('id', jobId)
                .single();

            const { data: resume } = await this.supabase
                .from('resume_versions')
                .select('*')
                .eq('id', resumeVersionId)
                .single();

            if (!job || !resume) {
                throw new Error('Job or resume data not found');
            }

            // Prepare email content
            const emailContent = {
                subject: `Application: ${job.role} - ${job.company} (Eric Kazee)`,
                body: resume.cover_letter_md || '',
                resume: resume.resume_md || '',
                jobUrl: job.url || '',
                company: job.company,
                role: job.role
            };

            // Log event
            await this.logEvent(jobId, userId, 'prepared_for_submission', {
                resume_version_id: resumeVersionId,
                email_prepared: true
            });

            return emailContent;

        } catch (error) {
            console.error('Error preparing application:', error);
            throw error;
        }
    }

    /**
     * Calculate AI match score for job description
     * This is a simplified version - in production you'd use embeddings
     */
    async calculateMatchScore(jobDescription, userSkills = []) {
        const keywords = [
            'ai', 'artificial intelligence', 'machine learning', 'rag', 'retrieval augmented generation',
            'prompt engineering', 'automation', 'enablement', 'adoption', 'implementation',
            'governance', 'compliance', 'web3', 'blockchain', 'change management',
            'training', 'coaching', 'product management', 'program management',
            'supabase', 'openai', 'claude', 'chatgpt', 'llm', 'large language model',
            'workflow automation', 'ai transformation', 'organizational change'
        ];

        if (!jobDescription) return 0;

        const jobText = jobDescription.toLowerCase();
        const matches = keywords.filter(keyword => jobText.includes(keyword));
        const score = Math.min(matches.length / keywords.length, 1);

        return Math.round(score * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Log application events
     */
    async logEvent(jobId, userId, eventType, payload = {}) {
        const { error } = await this.supabase
            .from('application_events')
            .insert({
                job_id: jobId,
                user_id: userId,
                type: eventType,
                payload: payload
            });

        if (error) {
            console.error('Error logging event:', error);
        }
    }

    /**
     * Get application history for a job
     */
    async getJobEvents(jobId) {
        const { data, error } = await this.supabase
            .from('application_events')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching job events:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get all resume versions for a user
     */
    async getResumeVersions(userId, jobId = null) {
        let query = this.supabase
            .from('resume_versions')
            .select('*')
            .eq('user_id', userId);

        if (jobId) {
            query = query.eq('job_id', jobId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching resume versions:', error);
            return [];
        }

        return data || [];
    }
}

// Export for use in other modules
window.AIFeaturesSecure = AIFeaturesSecure;