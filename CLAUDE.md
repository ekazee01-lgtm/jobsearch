# CLAUDE.md - AI Assistant Context

## 🤖 Project Context for Claude

This file provides context for Claude AI assistant sessions working on Eric Kazee's Job Search Platform.

---

## 📋 Current Project State

### ✅ COMPLETED (Phase 1)
- **Portfolio Website**: Professional homepage deployed to GitHub Pages
- **Supabase Backend**: Database schema, auth, and RLS policies implemented
- **Authentication**: Working login/signup system with Supabase
- **Repository**: Clean git history, professional documentation

### 🏗️ CURRENT ARCHITECTURE
- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages
- **Backend**: Supabase (PostgreSQL + Auth + Vector)
- **URLs**:
  - Live Site: https://ekazee01-lgtm.github.io/jobsearch/
  - Repo: https://github.com/ekazee01-lgtm/jobsearch

---

## 🛠️ Development Commands

### Git Workflow
```bash
# Stage all changes
git add .

# Commit with Claude signature
git commit -m "Feature description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push origin main
```

### Local Development
```bash
# Serve locally (if needed)
python -m http.server 8000
# Open: http://localhost:8000

# Check git status
git status
git log --oneline -5
```

---

## 📊 Database Schema (Supabase)

### Tables Created
```sql
-- User profiles
profiles (id, user_id, display_name, headline, location, avatar_url, created_at)

-- Job applications with AI support
job_applications (id, user_id, company, role, location, source, url, description,
                  jd_embedding vector(1536), ai_match_score numeric, status,
                  created_at, updated_at)

-- Resume versions (master + tailored)
resume_versions (id, user_id, job_id, label, resume_md, cover_letter_md, created_at)

-- Event audit trail
application_events (id, job_id, user_id, type, payload, created_at)
```

### Authentication
- **User**: ekazee.career@gmail.com (test account created)
- **Auth State**: Working - login/logout functional
- **RLS**: Enabled on all tables with `auth.uid() = user_id` policies

---

## 🎯 Next Phase Priorities

### Phase 2: Job Application Tracker
1. **Dashboard Page** (`/dashboard.html`)
   - Protected route (auth required)
   - Job applications list/grid
   - Add new application form
   - Status filtering and search

2. **API Layer** (JavaScript functions)
   - CRUD operations for job_applications
   - Status updates and tracking
   - Supabase client integration

3. **UI Components**
   - Application cards
   - Status badges
   - Form validation
   - Loading states

---

## 💡 Development Patterns

### Supabase Client Usage
```javascript
// Initialize (already in index.html)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Insert job application
const { data, error } = await supabase
  .from('job_applications')
  .insert({
    company: 'Company Name',
    role: 'Role Title',
    status: 'To Review',
    user_id: user.id
  })

// Fetch user's applications
const { data: jobs } = await supabase
  .from('job_applications')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

### File Organization
```
├── index.html          # Portfolio homepage (✅ done)
├── src/
│   ├── styles.css      # Main styles (✅ done)
│   └── dashboard.css   # Dashboard-specific styles (📋 todo)
├── js/
│   ├── auth.js         # Auth utilities (📋 todo)
│   ├── api.js          # Supabase operations (📋 todo)
│   └── dashboard.js    # Dashboard functionality (📋 todo)
├── dashboard.html      # Protected dashboard page (📋 todo)
└── docs/
    ├── README.md       # Public project info (✅ done)
    ├── README.dev.md   # Developer setup (✅ done)
    ├── PROGRESS.md     # Development tracking (✅ done)
    └── CLAUDE.md       # This file (🏗️ current)
```

---

## 🔐 Security Considerations

### Environment Variables
```javascript
// Already configured in index.html
const SUPABASE_URL = 'https://snmdcbrvvzasubdnnsbd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Row Level Security
- All tables enforce `auth.uid() = user_id`
- Users can only access their own data
- No admin override needed for MVP

---

## 📝 Code Style Guidelines

### CSS
- Use existing color scheme: `#0066cc` (primary), `#1a1a1a` (dark)
- Maintain responsive design patterns
- Follow existing card-based layout system

### JavaScript
- Use async/await for Supabase operations
- Handle errors gracefully with user feedback
- Maintain consistent naming conventions
- Add loading states for better UX

### HTML
- Semantic markup
- Accessibility considerations
- Mobile-responsive viewport
- Clean, readable structure

---

## 🎨 Design System

### Colors
```css
:root {
  --primary: #0066cc;
  --primary-hover: #0052a3;
  --dark: #1a1a1a;
  --background: #f5f5f5;
  --card: #ffffff;
  --text: #333;
  --muted: #666;
}
```

### Typography
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Line height: `1.6`
- Responsive sizing

---

## 🚀 Deployment Notes

### GitHub Pages
- Auto-deploys from `main` branch
- Static files only (no server-side rendering)
- HTTPS enabled
- Custom domain ready if needed

### Supabase Integration
- Database hosted on Supabase cloud
- Authentication managed by Supabase Auth
- Vector extension enabled for AI features
- Automatic backups included

---

## 📋 Common Tasks for Claude

### Adding New Features
1. Check current authentication state
2. Update relevant HTML/CSS/JS files
3. Test Supabase integration
4. Update PROGRESS.md with changes
5. Commit with proper message format

### Debugging Authentication
```javascript
// Check current session
const { data: { session } } = await supabase.auth.getSession()
console.log('Current session:', session)

// Check RLS policies
const { data, error } = await supabase
  .from('job_applications')
  .select('count')
console.log('Data access test:', { data, error })
```

### Database Operations
- Always use `user_id` from `auth.uid()`
- Handle errors with user-friendly messages
- Use optimistic updates where appropriate
- Implement proper loading states

---

## 🎯 Success Metrics

### Technical
- [ ] Authentication working (✅ DONE)
- [ ] CRUD operations functional
- [ ] Responsive design maintained
- [ ] Error handling implemented

### User Experience
- [ ] Intuitive job application workflow
- [ ] Fast page loads and interactions
- [ ] Clear status tracking
- [ ] Professional appearance

---

## 📚 Reference Documentation

### Links
- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [GitHub Pages](https://docs.github.com/en/pages)

### Project Files
- `README.dev.md` - Comprehensive developer setup
- `job-search-PRD.md` - Product requirements
- `PROGRESS.md` - Development milestone tracking

---

*This file should be updated as the project evolves. Keep it current for optimal Claude assistance.*

---

**Last Updated**: November 3, 2024
**Current Phase**: Phase 1 Complete → Starting Phase 2
**Next Session**: Implement job application dashboard