// Your Supabase credentials
const SUPABASE_URL = 'https://snmdcbrvvzasubdnnsbd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubWRjYnJ2dnphc3ViZG5uc2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTIwNTQsImV4cCI6MjA3Nzc2ODA1NH0.4-9MrZgla1YDzCR3hrRMygYxphDGNOmEmgDmnH6e6L0'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let jobs = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
});

// Check authentication
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        showAuthRequired();
        return;
    }

    currentUser = session.user;
    await loadJobs();
    showDashboard();
}

function showAuthRequired() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('auth-required').style.display = 'block';
}

function showDashboard() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}

// Load jobs from Supabase (using job_applications table)
async function loadJobs() {
    const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading jobs:', error);
        return;
    }

    jobs = data || [];
    renderJobs();
    updateStats();
}

// Render jobs in pipeline
function renderJobs() {
    // Clear all columns
    document.querySelectorAll('.job-cards').forEach(el => el.innerHTML = '');

    // Reset counts
    document.querySelectorAll('.pipeline-column .count').forEach(el => el.textContent = '0');

    // Group jobs by status
    const grouped = jobs.reduce((acc, job) => {
        const status = job.status || 'To Review';
        if (!acc[status]) acc[status] = [];
        acc[status].push(job);
        return acc;
    }, {});

    // Render each group
    Object.entries(grouped).forEach(([status, statusJobs]) => {
        // Map status to column ID
        const columnId = status.toLowerCase().replace(/\s+/g, '-');
        const container = document.getElementById(`${columnId}-cards`);

        if (container) {
            statusJobs.forEach(job => {
                container.appendChild(createJobCard(job));
            });

            // Update count
            const column = document.querySelector(`[data-status="${columnId}"] .count`);
            if (column) column.textContent = statusJobs.length;
        }
    });
}

// Create job card element
function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';
    card.dataset.jobId = job.id;

    const daysAgo = Math.floor((Date.now() - new Date(job.created_at)) / (1000 * 60 * 60 * 24));

    // Show AI match score if available
    const matchScore = job.ai_match_score
        ? `<span>🎯 ${Math.round(job.ai_match_score * 100)}% match</span>`
        : '';

    card.innerHTML = `
        <h4>${job.role}</h4>
        <div class="company">${job.company}</div>
        <div class="meta">
            ${job.location ? `<span>📍 ${job.location}</span>` : ''}
            <span>📅 ${daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
            ${job.source ? `<span>🔗 ${job.source}</span>` : ''}
            ${matchScore}
        </div>
        ${job.description ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}</div>` : ''}
        <div class="actions">
            <button class="edit-btn" onclick="editJob('${job.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteJob('${job.id}')">Delete</button>
        </div>
    `;

    return card;
}

// Update stats
function updateStats() {
    const total = jobs.length;
    const active = jobs.filter(j => ['Applying', 'Applied', 'Interview'].includes(j.status)).length;
    const interviews = jobs.filter(j => j.status === 'Interview').length;
    const responses = jobs.filter(j => ['Interview', 'Offer'].includes(j.status)).length;
    const responseRate = total > 0 ? Math.round((responses / total) * 100) : 0;

    document.getElementById('total-apps').textContent = total;
    document.getElementById('active-apps').textContent = active;
    document.getElementById('interview-count').textContent = interviews;
    document.getElementById('response-rate').textContent = `${responseRate}%`;
}

// Event listeners
function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // Add job button
    document.getElementById('add-job-btn').addEventListener('click', () => openJobModal());

    // Modal close
    document.querySelector('.close').addEventListener('click', closeJobModal);
    document.getElementById('cancel-btn').addEventListener('click', closeJobModal);

    // Form submit
    document.getElementById('job-form').addEventListener('submit', handleJobSubmit);

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('job-modal');
        if (e.target === modal) closeJobModal();
    });
}

// Modal functions
function openJobModal(jobId = null) {
    const modal = document.getElementById('job-modal');
    const form = document.getElementById('job-form');
    const title = document.getElementById('modal-title');

    form.reset();

    if (jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            title.textContent = 'Edit Job Application';
            document.getElementById('job-id').value = job.id;
            document.getElementById('company').value = job.company;
            document.getElementById('role').value = job.role;
            document.getElementById('location').value = job.location || '';
            document.getElementById('source').value = job.source || '';
            document.getElementById('job-url').value = job.url || '';
            document.getElementById('status').value = job.status || 'To Review';
            document.getElementById('description').value = job.description || '';
        }
    } else {
        title.textContent = 'Add New Job Application';
        document.getElementById('job-id').value = '';
    }

    modal.style.display = 'block';
}

function closeJobModal() {
    document.getElementById('job-modal').style.display = 'none';
}

// Handle form submit
async function handleJobSubmit(e) {
    e.preventDefault();

    const jobId = document.getElementById('job-id').value;
    const jobData = {
        company: document.getElementById('company').value,
        role: document.getElementById('role').value,
        location: document.getElementById('location').value || null,
        source: document.getElementById('source').value || null,
        url: document.getElementById('job-url').value || null,
        status: document.getElementById('status').value,
        description: document.getElementById('description').value || null,
        user_id: currentUser.id,
        updated_at: new Date().toISOString()
    };

    if (jobId) {
        // Update existing
        const { error } = await supabase
            .from('job_applications')
            .update(jobData)
            .eq('id', jobId);

        if (error) {
            alert('Error updating job: ' + error.message);
            console.error(error);
            return;
        }
    } else {
        // Insert new
        const { error } = await supabase
            .from('job_applications')
            .insert([jobData]);

        if (error) {
            alert('Error adding job: ' + error.message);
            console.error(error);
            return;
        }
    }

    closeJobModal();
    await loadJobs();
}

// Edit job
window.editJob = function(jobId) {
    openJobModal(jobId);
}

// Delete job
window.deleteJob = async function(jobId) {
    if (!confirm('Are you sure you want to delete this job application?')) return;

    const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', jobId);

    if (error) {
        alert('Error deleting job: ' + error.message);
        console.error(error);
        return;
    }

    await loadJobs();
}