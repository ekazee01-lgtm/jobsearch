# Playwright Testing Suite

This directory contains comprehensive end-to-end tests for the Job Search Platform using Playwright.

## Test Files

### 🔐 `auth.spec.js` - Authentication Flow Tests
- Login/Signup modal functionality
- Form validation and error handling
- Navigation anchor scrolling
- Responsive design at different breakpoints
- External link behavior (email, LinkedIn)

### 📊 `tracker.spec.js` - Job Tracker Dashboard Tests
- Authentication-protected access control
- Job CRUD operations
- Kanban board functionality
- Column filtering and search
- Bulk operations
- Local storage persistence
- Session management

### 🤖 `e2e-job-ai.spec.js` - AI Resume Generation End-to-End
**Complete workflow test including:**
1. Adding a new job posting
2. Initializing master resume (if needed)
3. AI-powered resume tailoring
4. Cover letter generation
5. Application preview and validation
6. Event tracking and audit trail

### 📱 `responsive.spec.js` - Responsive Design Tests
- Cross-browser compatibility
- Multiple viewport testing (320px to 1920px)
- Touch device interactions
- Mobile navigation patterns
- Modal responsiveness
- Content readability
- Performance on different screen sizes

### 🛠️ `test-helper.js` - Utility Functions
- Login automation
- Test data management
- Screenshot capture
- Console error checking
- Responsive layout validation
- Job creation/cleanup helpers

## Setup and Configuration

### 1. Install Dependencies
```bash
npm install
npx playwright install
```

### 2. Configure Test Environment
1. Copy `.env.test` to `.env.test.local`
2. Update with your actual test credentials:
```bash
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
```

### 3. Test Data Requirements
The tests expect:
- A valid Supabase test account
- Access to the live site at `https://ekazee01-lgtm.github.io/jobsearch/`
- Properly configured AI integration (for AI tests)

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Authentication tests only
npm run test:auth

# Job tracker functionality
npm run test:tracker

# End-to-end AI workflow
npm run test:e2e

# Responsive design tests
npm run test:responsive
```

### Debug Mode
```bash
# Run with browser visible
npm run test:headed

# Interactive debugging
npm run test:debug

# UI Mode for test development
npm run test:ui
```

### Test Reports
```bash
# Generate and view HTML report
npm run test:report
```

## Test Coverage

### ✅ Authentication & Security
- [x] Modal open/close functionality
- [x] Login/signup form validation
- [x] Session management
- [x] Protected route access
- [x] Error handling for invalid credentials

### ✅ Job Tracker Features
- [x] CRUD operations for job applications
- [x] Kanban board status management
- [x] Search and filtering
- [x] Column visibility settings
- [x] Bulk operations
- [x] Data persistence

### ✅ AI Integration
- [x] Master resume initialization
- [x] Job description processing
- [x] Resume tailoring workflow
- [x] Cover letter generation
- [x] Application preview
- [x] Event logging and audit trail

### ✅ User Experience
- [x] Responsive design (320px - 1920px)
- [x] Touch device compatibility
- [x] Cross-browser functionality
- [x] Loading states and error handling
- [x] Navigation and accessibility

### ✅ Data Management
- [x] Supabase integration
- [x] Real-time updates
- [x] Data validation
- [x] Error recovery
- [x] Performance optimization

## Test Data Management

### Cleanup Strategy
Tests automatically clean up created data using:
- `afterEach` hooks for immediate cleanup
- Company name-based identification
- Graceful error handling for missing elements

### Sample Data
Tests use realistic job posting data:
- Technology companies (Microsoft, etc.)
- Relevant job descriptions with AI/ML keywords
- Proper salary ranges and deadlines
- Complete application workflows

## Performance Benchmarks

### Expected Load Times
- **Homepage**: < 3 seconds
- **Dashboard**: < 5 seconds
- **AI Processing**: < 60 seconds
- **Modal Interactions**: < 1 second

### Viewport Testing
- **Mobile**: 320px, 375px, 414px widths
- **Tablet**: 768px, 1024px widths
- **Desktop**: 1280px, 1440px, 1920px widths

## Troubleshooting

### Common Issues

**Authentication Failures**
- Verify test credentials in `.env.test.local`
- Check Supabase connection
- Ensure test user account exists

**AI Test Timeouts**
- Verify OpenAI API keys are configured
- Check Supabase Edge Function deployment
- Monitor network connectivity during AI processing

**Responsive Test Failures**
- Clear browser cache
- Check CSS Grid/Flexbox support
- Verify viewport meta tag implementation

**Flaky Tests**
- Increase wait timeouts for slow networks
- Use `waitForLoadState('networkidle')` for dynamic content
- Add explicit waits for Supabase operations

### Debug Tools
```bash
# Run single test with full logging
npx playwright test auth.spec.js --headed --debug

# Generate trace files for failed tests
npx playwright test --trace on

# Screenshot on failure (automatic)
npx playwright test --screenshot only-on-failure
```

## CI/CD Integration

Tests are configured for:
- **Parallel execution** across multiple browsers
- **Retry logic** for flaky network conditions
- **HTML reports** with screenshots and traces
- **Headless mode** for automated environments

### GitHub Actions Example
```yaml
- name: Run Playwright Tests
  run: |
    npm ci
    npx playwright install
    npm test
  env:
    TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
    TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## Contributing

When adding new tests:

1. **Follow naming conventions**: `feature.spec.js`
2. **Use test helpers**: Import from `test-helper.js`
3. **Clean up test data**: Implement proper cleanup in `afterEach`
4. **Document test purpose**: Add clear descriptions for complex workflows
5. **Test responsive behavior**: Include mobile/tablet/desktop viewports
6. **Handle async operations**: Use proper waits for Supabase/AI operations

## Test Architecture

```
tests/
├── auth.spec.js           # Authentication flows
├── tracker.spec.js        # Dashboard functionality
├── e2e-job-ai.spec.js     # Complete AI workflow
├── responsive.spec.js     # Cross-device compatibility
├── test-helper.js         # Shared utilities
└── README.md             # This documentation
```

The test suite provides comprehensive coverage of all critical user journeys while maintaining fast execution times and reliable results across different environments.