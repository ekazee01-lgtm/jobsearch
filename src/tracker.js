// Your Supabase credentials
const SUPABASE_URL = 'https://hndkhpwzvybbiagnjkdr.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_gGSkycyet1bMedqzYPwoug_pFm_Z8j-'

// Must be `var`, not `const`: the supabase-js UMD bundle declares a global
// `var supabase` for its namespace, and a `const` redeclaration is a
// page-killing SyntaxError. `var` legally redeclares and replaces the
// namespace with the client instance.
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let jobs = [];
let filteredJobs = [];
let aiFeatures = null;
let currentJobId = null;
let activeFilters = {};
let columnSettings = {
    showSalary: true,
    showExcitement: true,
    showDeadline: true,
    showAppliedDate: true,
    showFollowUp: true,
    showAiMatch: true,
    showSource: true,
    showLocation: true
};

function formatAiMatchPercent(score) {
    if (score === null || score === undefined || score === '') {
        return '';
    }
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) {
        return '';
    }
    const percent = numericScore <= 1 ? numericScore * 100 : numericScore * 10;
    return `${Math.round(percent)}%`;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadColumnSettings();
    await checkAuth();
    setupEventListeners();
});

// Load column settings from localStorage
function loadColumnSettings() {
    const saved = localStorage.getItem('jobTrackerColumnSettings');
    if (saved) {
        columnSettings = { ...columnSettings, ...JSON.parse(saved) };
    }
}

// Check authentication
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        showAuthRequired();
        return;
    }

    currentUser = session.user;

    // Initialize AI features
    aiFeatures = new AIFeaturesSecure(supabase);

    // Initialize master materials on first login
    try {
        await aiFeatures.initializeMasterMaterials(currentUser.id);
        console.log('Master materials initialized/verified');
    } catch (error) {
        console.error('Error initializing master materials:', error);
        // Continue anyway - this isn't critical for basic functionality
    }

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
    filteredJobs = [...jobs]; // Initialize filtered jobs
    renderJobs();
    updateStats();
    updateAlerts();
}

// Render jobs in pipeline
function renderJobs() {
    // Clear all columns
    document.querySelectorAll('.job-cards').forEach(el => el.innerHTML = '');

    // Reset counts
    document.querySelectorAll('.pipeline-column .count').forEach(el => el.textContent = '0');

    // Group filtered jobs by status
    const grouped = filteredJobs.reduce((acc, job) => {
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
        ? `<span>🎯 ${formatAiMatchPercent(job.ai_match_score)} match</span>`
        : '';

    // Show excitement level
    const excitement = job.excitement
        ? `<span>${'⭐'.repeat(job.excitement)}</span>`
        : '';

    // Show salary range if available (including $0)
    const salaryRange = (job.min_salary !== null && job.min_salary !== undefined) || (job.max_salary !== null && job.max_salary !== undefined)
        ? `<span>💰 ${formatSalaryRange(job.min_salary, job.max_salary)}</span>`
        : '';

    // Show deadline warning if close
    const deadlineWarning = job.deadline
        ? getDeadlineWarning(job.deadline)
        : '';

    // Show follow-up indicator
    const followUpIndicator = job.follow_up_date && new Date(job.follow_up_date) >= new Date()
        ? `<span>🔔 Follow-up due</span>`
        : '';

    card.innerHTML = `
        <div class="job-card-header">
            <input type="checkbox" class="job-select-checkbox" data-job-id="${job.id}" onchange="handleJobSelection()">
            <h4>${job.role}</h4>
        </div>
        <div class="company">${job.company}</div>
        <div class="meta">
            ${columnSettings.showLocation && job.location ? `<span>📍 ${job.location}</span>` : ''}
            <span>📅 ${daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
            ${columnSettings.showAppliedDate && job.date_applied ? `<span>✅ Applied ${formatDate(job.date_applied)}</span>` : ''}
            ${columnSettings.showSource && job.source ? `<span>🔗 ${job.source}</span>` : ''}
            ${columnSettings.showSalary ? salaryRange : ''}
            ${columnSettings.showExcitement ? excitement : ''}
            ${columnSettings.showAiMatch ? matchScore : ''}
            ${columnSettings.showDeadline ? deadlineWarning : ''}
            ${columnSettings.showFollowUp ? followUpIndicator : ''}
        </div>
        ${job.description ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}</div>` : ''}
        <div class="actions">
            <button class="edit-btn" onclick="editJob('${job.id}')">Edit</button>
            <button class="ai-btn" onclick="openAIActions('${job.id}')">🤖 AI</button>
            <button class="delete-btn" onclick="deleteJob('${job.id}')">Delete</button>
        </div>
    `;

    return card;
}

// Helper functions for job card display
function formatSalaryRange(minSalary, maxSalary) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    const hasMin = minSalary !== null && minSalary !== undefined;
    const hasMax = maxSalary !== null && maxSalary !== undefined;

    if (hasMin && hasMax) {
        return `${formatter.format(minSalary)} - ${formatter.format(maxSalary)}`;
    } else if (hasMin) {
        return `${formatter.format(minSalary)}+`;
    } else if (hasMax) {
        return `Up to ${formatter.format(maxSalary)}`;
    }
    return '';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getDeadlineWarning(deadlineString) {
    const deadline = new Date(deadlineString);
    const today = new Date();
    const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
        return '<span style="color: #dc3545;">⚠️ Deadline passed</span>';
    } else if (daysUntil === 0) {
        return '<span style="color: #fd7e14;">🔥 Due today</span>';
    } else if (daysUntil <= 3) {
        return `<span style="color: #fd7e14;">⏰ Due in ${daysUntil}d</span>`;
    } else if (daysUntil <= 7) {
        return `<span style="color: #ffc107;">📅 Due in ${daysUntil}d</span>`;
    }
    return `<span>📅 Due ${formatDate(deadlineString)}</span>`;
}

// Update stats
function updateStats() {
    const total = jobs.length;
    const active = jobs.filter(j => ['Applying', 'Applied', 'Interview', 'Offer', 'Negotiating'].includes(j.status)).length;
    const interviews = jobs.filter(j => j.status === 'Interview').length;
    const responses = jobs.filter(j => ['Interview', 'Offer', 'Negotiating', 'Accepted'].includes(j.status)).length;
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

    // AI Features buttons
    document.getElementById('setup-ai-btn').addEventListener('click', setupAIFeatures);
    document.getElementById('manage-resume-btn').addEventListener('click', openResumeManagement);

    // Filter buttons
    document.getElementById('toggle-filters-btn').addEventListener('click', toggleFilters);
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);

    // Bulk actions
    document.getElementById('bulk-actions-btn').addEventListener('click', openBulkActionsModal);

    // Column customization
    document.getElementById('columns-btn').addEventListener('click', toggleColumns);
    document.getElementById('apply-columns-btn').addEventListener('click', applyColumnSettings);
    document.getElementById('reset-columns-btn').addEventListener('click', resetColumnSettings);

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
        const job = jobs.find(j => j.id.toString() === jobId.toString());
        if (job) {
            title.textContent = 'Edit Job Application';
            document.getElementById('job-id').value = job.id;
            document.getElementById('company').value = job.company;
            document.getElementById('role').value = job.role;
            document.getElementById('location').value = job.location || '';
            document.getElementById('source').value = job.source || '';
            document.getElementById('job-url').value = job.url || '';
            document.getElementById('min-salary').value = job.min_salary || '';
            document.getElementById('max-salary').value = job.max_salary || '';
            document.getElementById('date-applied').value = job.date_applied ? job.date_applied.split('T')[0] : '';
            document.getElementById('deadline').value = job.deadline ? job.deadline.split('T')[0] : '';
            document.getElementById('excitement').value = job.excitement || '';
            document.getElementById('status').value = job.status || 'To Review';
            document.getElementById('follow-up-date').value = job.follow_up_date ? job.follow_up_date.split('T')[0] : '';
            document.getElementById('follow-up-notes').value = job.follow_up_notes || '';
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
        min_salary: document.getElementById('min-salary').value ? parseFloat(document.getElementById('min-salary').value) : null,
        max_salary: document.getElementById('max-salary').value ? parseFloat(document.getElementById('max-salary').value) : null,
        date_applied: document.getElementById('date-applied').value || null,
        deadline: document.getElementById('deadline').value || null,
        excitement: document.getElementById('excitement').value ? parseInt(document.getElementById('excitement').value) : null,
        status: document.getElementById('status').value,
        follow_up_date: document.getElementById('follow-up-date').value || null,
        follow_up_notes: document.getElementById('follow-up-notes').value || null,
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

// ============================================================================
// FILTERING AND SEARCH FUNCTIONALITY
// ============================================================================

// Toggle filters panel
function toggleFilters() {
    const panel = document.getElementById('filters-panel');
    const btn = document.getElementById('toggle-filters-btn');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.textContent = '🔍 Hide Filters';
    } else {
        panel.style.display = 'none';
        btn.textContent = '🔍 Filters';
    }
}

// Apply filters
function applyFilters() {
    const excitement = document.getElementById('filter-excitement').value;
    const minSalary = document.getElementById('filter-min-salary').value;
    const deadline = document.getElementById('filter-deadline').value;
    const company = document.getElementById('filter-company').value.toLowerCase();

    activeFilters = {
        excitement: excitement ? parseInt(excitement) : null,
        minSalary: minSalary ? parseFloat(minSalary) : null,
        deadline: deadline || null,
        company: company || null
    };

    filteredJobs = jobs.filter(job => {
        // Excitement filter
        if (activeFilters.excitement && job.excitement !== activeFilters.excitement) {
            return false;
        }

        // Salary filter (check if job's max salary meets the minimum requirement)
        if (activeFilters.minSalary && (job.max_salary === null || job.max_salary === undefined || job.max_salary < activeFilters.minSalary)) {
            return false;
        }

        // Company filter
        if (activeFilters.company && !job.company.toLowerCase().includes(activeFilters.company)) {
            return false;
        }

        // Deadline filter
        if (activeFilters.deadline && job.deadline) {
            const deadline = new Date(job.deadline);
            const today = new Date();
            const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            switch (activeFilters.deadline) {
                case 'overdue':
                    if (daysUntil >= 0) return false;
                    break;
                case 'today':
                    if (daysUntil !== 0) return false;
                    break;
                case 'week':
                    if (daysUntil < 0 || daysUntil > 7) return false;
                    break;
                case 'month':
                    if (daysUntil < 0 || daysUntil > 30) return false;
                    break;
            }
        } else if (activeFilters.deadline && !job.deadline) {
            return false; // Filter requires deadline but job doesn't have one
        }

        return true;
    });

    renderJobs();
    updateFilteredStats();
}

// Clear all filters
function clearFilters() {
    document.getElementById('filter-excitement').value = '';
    document.getElementById('filter-min-salary').value = '';
    document.getElementById('filter-deadline').value = '';
    document.getElementById('filter-company').value = '';

    activeFilters = {};
    filteredJobs = [...jobs];
    renderJobs();
    updateStats();
}

// Update stats with filtered data
function updateFilteredStats() {
    const total = filteredJobs.length;
    const active = filteredJobs.filter(j => ['Applying', 'Applied', 'Interview', 'Offer', 'Negotiating'].includes(j.status)).length;
    const interviews = filteredJobs.filter(j => j.status === 'Interview').length;
    const responses = filteredJobs.filter(j => ['Interview', 'Offer', 'Negotiating', 'Accepted'].includes(j.status)).length;
    const responseRate = total > 0 ? Math.round((responses / total) * 100) : 0;

    document.getElementById('total-apps').textContent = total;
    document.getElementById('active-apps').textContent = active;
    document.getElementById('interview-count').textContent = interviews;
    document.getElementById('response-rate').textContent = `${responseRate}%`;
}

// ============================================================================
// BULK OPERATIONS FUNCTIONALITY
// ============================================================================

// Handle job selection
window.handleJobSelection = function() {
    const checkboxes = document.querySelectorAll('.job-select-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

    const bulkBtn = document.getElementById('bulk-actions-btn');
    bulkBtn.disabled = selectedCount === 0;
    bulkBtn.textContent = selectedCount > 0 ? `Bulk Actions (${selectedCount})` : 'Bulk Actions';
}

// Open bulk actions modal
function openBulkActionsModal() {
    const checkboxes = document.querySelectorAll('.job-select-checkbox:checked');
    const selectedCount = checkboxes.length;

    if (selectedCount === 0) return;

    document.getElementById('selected-count').textContent = selectedCount;
    document.getElementById('bulk-actions-modal').style.display = 'block';
}

// Close bulk actions modal
window.closeBulkActionsModal = function() {
    document.getElementById('bulk-actions-modal').style.display = 'none';
    document.getElementById('bulk-status-selection').style.display = 'none';
}

// Bulk change status
window.bulkChangeStatus = function() {
    document.getElementById('bulk-status-selection').style.display = 'block';
}

// Cancel bulk status change
window.cancelBulkStatusChange = function() {
    document.getElementById('bulk-status-selection').style.display = 'none';
}

// Confirm bulk status change
window.confirmBulkStatusChange = async function() {
    const newStatus = document.getElementById('bulk-status').value;
    const checkboxes = document.querySelectorAll('.job-select-checkbox:checked');
    const selectedJobIds = Array.from(checkboxes).map(cb => cb.dataset.jobId);

    if (!newStatus || selectedJobIds.length === 0) return;

    try {
        // Update all selected jobs in database
        const { error } = await supabase
            .from('job_applications')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .in('id', selectedJobIds);

        if (error) {
            alert('Error updating jobs: ' + error.message);
            return;
        }

        // Clear selections
        checkboxes.forEach(cb => cb.checked = false);
        handleJobSelection();

        // Reload jobs
        await loadJobs();

        closeBulkActionsModal();
        config.showMessage(`✅ Updated ${selectedJobIds.length} job(s) to ${newStatus}`, 'success');

    } catch (error) {
        console.error('Bulk status update error:', error);
        alert('Error updating jobs: ' + error.message);
    }
}

// Bulk delete
window.bulkDelete = async function() {
    const checkboxes = document.querySelectorAll('.job-select-checkbox:checked');
    const selectedJobIds = Array.from(checkboxes).map(cb => cb.dataset.jobId);

    if (selectedJobIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedJobIds.length} job application(s)? This cannot be undone.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('job_applications')
            .delete()
            .in('id', selectedJobIds);

        if (error) {
            alert('Error deleting jobs: ' + error.message);
            return;
        }

        await loadJobs();
        closeBulkActionsModal();
        config.showMessage(`✅ Deleted ${selectedJobIds.length} job(s)`, 'success');

    } catch (error) {
        console.error('Bulk delete error:', error);
        alert('Error deleting jobs: ' + error.message);
    }
}

// Bulk export
window.bulkExport = function() {
    const checkboxes = document.querySelectorAll('.job-select-checkbox:checked');
    const selectedJobIds = Array.from(checkboxes).map(cb => cb.dataset.jobId);

    if (selectedJobIds.length === 0) return;

    const selectedJobs = jobs.filter(job => selectedJobIds.includes(job.id.toString()));

    // Create CSV content with all fields
    const headers = [
        'Company', 'Role', 'Location', 'Status', 'Source', 'URL',
        'Min Salary', 'Max Salary', 'Date Applied', 'Deadline', 'Excitement',
        'Follow-up Date', 'Follow-up Notes', 'AI Match Score', 'Description',
        'Created Date', 'Updated Date'
    ];

    const csvContent = [
        headers.join(','),
        ...selectedJobs.map(job => [
            job.company || '',
            job.role || '',
            job.location || '',
            job.status || '',
            job.source || '',
            job.url || '',
            job.min_salary !== null && job.min_salary !== undefined ? job.min_salary : '',
            job.max_salary !== null && job.max_salary !== undefined ? job.max_salary : '',
            job.date_applied ? formatDate(job.date_applied) : '',
            job.deadline ? formatDate(job.deadline) : '',
            job.excitement || '',
            job.follow_up_date ? formatDate(job.follow_up_date) : '',
            job.follow_up_notes || '',
            job.ai_match_score ? formatAiMatchPercent(job.ai_match_score) : '',
            job.description || '',
            formatDate(job.created_at),
            job.updated_at ? formatDate(job.updated_at) : ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    closeBulkActionsModal();
    config.showMessage(`📊 Exported ${selectedJobs.length} job(s) to CSV`, 'success');
}

// ============================================================================
// COLUMN CUSTOMIZATION FUNCTIONALITY
// ============================================================================

// Toggle columns panel
function toggleColumns() {
    const panel = document.getElementById('columns-panel');
    const btn = document.getElementById('columns-btn');

    if (panel.style.display === 'none') {
        // Sync checkboxes with current settings
        document.getElementById('show-salary').checked = columnSettings.showSalary;
        document.getElementById('show-excitement').checked = columnSettings.showExcitement;
        document.getElementById('show-deadline').checked = columnSettings.showDeadline;
        document.getElementById('show-applied-date').checked = columnSettings.showAppliedDate;
        document.getElementById('show-follow-up').checked = columnSettings.showFollowUp;
        document.getElementById('show-ai-match').checked = columnSettings.showAiMatch;
        document.getElementById('show-source').checked = columnSettings.showSource;
        document.getElementById('show-location').checked = columnSettings.showLocation;

        panel.style.display = 'block';
        btn.textContent = '📊 Hide Columns';
    } else {
        panel.style.display = 'none';
        btn.textContent = '📊 Columns';
    }
}

// Apply column settings
function applyColumnSettings() {
    columnSettings = {
        showSalary: document.getElementById('show-salary').checked,
        showExcitement: document.getElementById('show-excitement').checked,
        showDeadline: document.getElementById('show-deadline').checked,
        showAppliedDate: document.getElementById('show-applied-date').checked,
        showFollowUp: document.getElementById('show-follow-up').checked,
        showAiMatch: document.getElementById('show-ai-match').checked,
        showSource: document.getElementById('show-source').checked,
        showLocation: document.getElementById('show-location').checked
    };

    // Save to localStorage
    localStorage.setItem('jobTrackerColumnSettings', JSON.stringify(columnSettings));

    // Re-render jobs with new settings
    renderJobs();

    config.showMessage('✅ Column settings updated!', 'success');
}

// Reset column settings to default
function resetColumnSettings() {
    columnSettings = {
        showSalary: true,
        showExcitement: true,
        showDeadline: true,
        showAppliedDate: true,
        showFollowUp: true,
        showAiMatch: true,
        showSource: true,
        showLocation: true
    };

    // Update checkboxes
    document.getElementById('show-salary').checked = true;
    document.getElementById('show-excitement').checked = true;
    document.getElementById('show-deadline').checked = true;
    document.getElementById('show-applied-date').checked = true;
    document.getElementById('show-follow-up').checked = true;
    document.getElementById('show-ai-match').checked = true;
    document.getElementById('show-source').checked = true;
    document.getElementById('show-location').checked = true;

    // Remove from localStorage
    localStorage.removeItem('jobTrackerColumnSettings');

    // Re-render jobs
    renderJobs();

    config.showMessage('✅ Column settings reset to default!', 'success');
}

// ============================================================================
// ALERTS AND NOTIFICATIONS
// ============================================================================

// Update alerts section
function updateAlerts() {
    const today = new Date();
    const followUpAlerts = [];
    const deadlineAlerts = [];

    jobs.forEach(job => {
        // Check follow-up dates
        if (job.follow_up_date) {
            const followUpDate = new Date(job.follow_up_date);
            const daysUntil = Math.ceil((followUpDate - today) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 0) {
                followUpAlerts.push({
                    job,
                    message: `Follow-up ${daysUntil === 0 ? 'due today' : `overdue by ${Math.abs(daysUntil)} day(s)`}`,
                    type: daysUntil === 0 ? 'warning' : 'danger'
                });
            } else if (daysUntil <= 3) {
                followUpAlerts.push({
                    job,
                    message: `Follow-up due in ${daysUntil} day(s)`,
                    type: 'info'
                });
            }
        }

        // Check deadlines
        if (job.deadline) {
            const deadline = new Date(job.deadline);
            const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 0) {
                deadlineAlerts.push({
                    job,
                    message: `Application deadline ${daysUntil === 0 ? 'is today' : `passed ${Math.abs(daysUntil)} day(s) ago`}`,
                    type: daysUntil === 0 ? 'warning' : 'danger'
                });
            } else if (daysUntil <= 7) {
                deadlineAlerts.push({
                    job,
                    message: `Application deadline in ${daysUntil} day(s)`,
                    type: daysUntil <= 3 ? 'warning' : 'info'
                });
            }
        }
    });

    // Render alerts
    renderAlerts('follow-up-alerts', followUpAlerts);
    renderAlerts('deadline-alerts', deadlineAlerts);

    // Show/hide alerts section
    const alertsSection = document.getElementById('alerts-section');
    if (followUpAlerts.length > 0 || deadlineAlerts.length > 0) {
        alertsSection.style.display = 'block';
    } else {
        alertsSection.style.display = 'none';
    }
}

// Render alerts in container
function renderAlerts(containerId, alerts) {
    const container = document.getElementById(containerId);

    if (alerts.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">No alerts</p>';
        return;
    }

    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type}">
            <div class="alert-title">${alert.job.role} at ${alert.job.company}</div>
            <div class="alert-meta">${alert.message}</div>
            ${alert.job.follow_up_notes ? `<div class="alert-meta">Note: ${alert.job.follow_up_notes}</div>` : ''}
        </div>
    `).join('');
}

// ============================================================================
// LEGACY AUTOMATION WEBHOOKS
// ============================================================================

// Handle legacy automation webhook notifications
window.handleAutomationWebhook = function(payload) {
    switch (payload.type) {
        case 'new_jobs':
            handleNewJobsFound(payload);
            break;
        case 'application_prepared':
            handleApplicationPrepared(payload);
            break;
        case 'follow_up_due':
            handleFollowUpAlert(payload);
            break;
        default:
            console.log('Unknown webhook type:', payload.type);
    }
};

function handleNewJobsFound(payload) {
    // Refresh the job list
    loadJobs();

    // Show notification
    const message = `🔍 ${payload.count} new jobs found from ${payload.source}`;
    config.showMessage(message, 'success');

    // Update stats immediately
    updateStats();

    // Show alert if high-scoring jobs found
    if (payload.highScoring && payload.highScoring > 0) {
        const alertMessage = `⭐ ${payload.highScoring} high-scoring matches need your review!`;
        showAlert(alertMessage, 'warning');
    }
}

function handleApplicationPrepared(payload) {
    // Update job status
    const job = jobs.find(j => j.id === payload.jobId);
    if (job) {
        job.status = 'Applying';
        renderJobs();

        const message = `📝 Application prepared for ${payload.company} - ${payload.role}`;
        config.showMessage(message, 'info');
    }
}

function handleFollowUpAlert(payload) {
    // Add to alerts section
    addFollowUpAlert(payload.jobId, payload.message);
    updateAlerts();
}

function showAlert(message, type = 'info') {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <div class="alert-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="alert-close">&times;</button>
        </div>
    `;

    // Add to page
    const container = document.querySelector('.stats-summary');
    if (container) {
        container.insertAdjacentElement('afterend', alert);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 10000);
    }
}

// ============================================================================
// AI FEATURES INTEGRATION
// ============================================================================

// Initialize AI features after auth (now using secure backend)
async function initializeAI() {
    if (!currentUser) return;

    // Initialize secure AI features class (no API key needed)
    aiFeatures = new AIFeaturesSecure(supabase);
}

// Setup AI Features
window.setupAIFeatures = function() {
    config.showSetupInstructions();
}

// Open AI Actions Modal (now using secure backend)
window.openAIActions = async function(jobId) {
    currentJobId = jobId;
    const job = jobs.find(j => j.id.toString() === jobId.toString());

    if (!job) return;

    // Initialize AI features if not already done
    if (!aiFeatures) {
        aiFeatures = new AIFeaturesSecure(supabase);
    }

    // Update modal title
    document.getElementById('ai-modal-title').textContent = `🤖 AI Actions: ${job.role} at ${job.company}`;

    // Load resume versions for this job
    await loadResumeVersions(jobId);

    // Load job events
    await loadJobEvents(jobId);

    // Show modal
    document.getElementById('ai-actions-modal').style.display = 'block';
}

// Close AI Actions Modal
window.closeAIActionsModal = function() {
    document.getElementById('ai-actions-modal').style.display = 'none';
    currentJobId = null;
}

// Tailor Resume for Job
window.tailorResumeForJob = async function() {
    if (!currentJobId || !aiFeatures) return;

    const statusDiv = document.getElementById('tailoring-status');
    const btn = document.getElementById('tailor-resume-btn');

    try {
        btn.disabled = true;
        btn.textContent = 'Tailoring...';
        statusDiv.innerHTML = '<div class="loading-spinner">🔄 AI is analyzing the job and tailoring your resume...</div>';

        const result = await aiFeatures.tailorResume(currentJobId, currentUser.id);

        statusDiv.innerHTML = `<div class="success">✅ Resume tailored successfully! Version: ${result.label}</div>`;
        btn.textContent = '✨ Tailor Resume with AI';

        // Reload resume versions and show application section
        await loadResumeVersions(currentJobId);
        document.getElementById('application-section').style.display = 'block';

        // Reload job events
        await loadJobEvents(currentJobId);

    } catch (error) {
        console.error('Error tailoring resume:', error);
        statusDiv.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
        btn.textContent = '✨ Tailor Resume with AI';
    } finally {
        btn.disabled = false;
    }
}

// Load Resume Versions
async function loadResumeVersions(jobId) {
    if (!aiFeatures) return;

    const select = document.getElementById('resume-version-select');
    const versions = await aiFeatures.getResumeVersions(currentUser.id, jobId);

    select.innerHTML = '<option value="">Select a resume version...</option>';

    versions.forEach(version => {
        const option = document.createElement('option');
        option.value = version.id;
        option.textContent = version.label;
        select.appendChild(option);
    });

    // Enable prepare button when version is selected (remove existing listener first)
    const existingListener = select.getAttribute('data-listener-added');
    if (!existingListener) {
        select.addEventListener('change', function() {
            const prepareBtn = document.getElementById('prepare-application-btn');
            prepareBtn.disabled = !this.value;
        });
        select.setAttribute('data-listener-added', 'true');
    }
}

// Prepare Application
window.prepareApplication = async function() {
    const resumeVersionId = document.getElementById('resume-version-select').value;
    if (!resumeVersionId || !currentJobId || !aiFeatures) return;

    const statusDiv = document.getElementById('application-status');
    const btn = document.getElementById('prepare-application-btn');

    try {
        btn.disabled = true;
        btn.textContent = 'Preparing...';
        statusDiv.innerHTML = '<div class="loading-spinner">🔄 Preparing application...</div>';

        const emailContent = await aiFeatures.prepareApplication(currentJobId, resumeVersionId, currentUser.id);

        statusDiv.innerHTML = '<div class="success">✅ Application prepared! Click to preview.</div>';

        // Show application preview
        showApplicationPreview(emailContent);

        await loadJobEvents(currentJobId);

    } catch (error) {
        console.error('Error preparing application:', error);
        statusDiv.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 Prepare Application';
    }
}

// Load Job Events
async function loadJobEvents(jobId) {
    if (!aiFeatures) return;

    const eventsDiv = document.getElementById('job-events');
    const events = await aiFeatures.getJobEvents(jobId);

    if (events.length === 0) {
        eventsDiv.innerHTML = '<p>No events yet.</p>';
        return;
    }

    const eventsHtml = events.map(event => {
        const date = new Date(event.created_at).toLocaleDateString();
        const time = new Date(event.created_at).toLocaleTimeString();
        const emoji = getEventEmoji(event.type);

        return `
            <div class="event-item">
                <span class="event-emoji">${emoji}</span>
                <span class="event-type">${event.type}</span>
                <span class="event-time">${date} ${time}</span>
            </div>
        `;
    }).join('');

    eventsDiv.innerHTML = eventsHtml;
}

function getEventEmoji(eventType) {
    const emojis = {
        'tailored': '✨',
        'prepared_for_submission': '📤',
        'submitted': '📧',
        'interview_scheduled': '📅',
        'application_viewed': '👀'
    };
    return emojis[eventType] || '📝';
}

// Resume Management
window.openResumeManagement = async function() {
    if (!currentUser) return;

    // Initialize AI features if needed
    if (!aiFeatures) {
        aiFeatures = new AIFeaturesSecure(supabase);
    }

    // Load existing master resume and cover letter template
    if (aiFeatures) {
        // Load master resume
        const masterResume = await aiFeatures.getMasterResume(currentUser.id);
        if (masterResume) {
            document.getElementById('master-resume').value = masterResume.resume_md || '';
        }

        // Load cover letter template from separate record
        const { data: coverTemplate, error } = await supabase
            .from('resume_versions')
            .select('cover_letter_md')
            .eq('user_id', currentUser.id)
            .eq('label', 'Cover Letter Template')
            .single();

        if (coverTemplate && !error) {
            document.getElementById('cover-letter-template').value = coverTemplate.cover_letter_md || '';
        }
    }

    document.getElementById('resume-modal').style.display = 'block';
}

window.closeResumeModal = function() {
    document.getElementById('resume-modal').style.display = 'none';
}

window.saveMasterResume = async function() {
    if (!currentUser) return;

    const resumeText = document.getElementById('master-resume').value;
    const coverLetterText = document.getElementById('cover-letter-template').value;

    if (!resumeText.trim()) {
        alert('Please enter your resume content');
        return;
    }

    // Initialize AI features if needed
    if (!aiFeatures) {
        aiFeatures = new AIFeaturesSecure(supabase);
    }

    try {
        // Save master resume
        const { error: resumeError } = await supabase
            .from('resume_versions')
            .upsert({
                user_id: currentUser.id,
                label: 'Master',
                resume_md: resumeText,
                cover_letter_md: ''
            }, {
                onConflict: 'user_id,label'
            });

        if (resumeError) {
            throw resumeError;
        }

        // Save cover letter template separately
        const { error: templateError } = await supabase
            .from('resume_versions')
            .upsert({
                user_id: currentUser.id,
                label: 'Cover Letter Template',
                resume_md: '',
                cover_letter_md: coverLetterText
            }, {
                onConflict: 'user_id,label'
            });

        if (templateError) {
            throw templateError;
        }

    } catch (error) {
        alert('Error saving materials: ' + error.message);
        return;
    }

    config.showMessage('✅ Master resume saved successfully!', 'success');
    closeResumeModal();
}

// Application Preview
function showApplicationPreview(emailContent) {
    document.getElementById('email-subject').textContent = emailContent.subject;
    document.getElementById('cover-letter-preview').innerHTML =
        emailContent.body.replace(/\n/g, '<br>');
    document.getElementById('resume-preview').innerHTML =
        emailContent.resume.replace(/\n/g, '<br>');

    document.getElementById('application-preview-modal').style.display = 'block';
}

window.closeApplicationPreview = function() {
    document.getElementById('application-preview-modal').style.display = 'none';
}

window.copyToClipboard = function() {
    const subject = document.getElementById('email-subject').textContent;
    const coverLetter = document.getElementById('cover-letter-preview').textContent;
    const resume = document.getElementById('resume-preview').textContent;

    const fullContent = `Subject: ${subject}\n\n${coverLetter}\n\n---\n\n${resume}`;

    navigator.clipboard.writeText(fullContent).then(() => {
        config.showMessage('📋 Application copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    });
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

