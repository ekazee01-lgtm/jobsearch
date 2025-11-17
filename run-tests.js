#!/usr/bin/env node

/**
 * Test Runner Script for Job Search Platform
 *
 * This script provides an easy way to run specific test suites
 * with proper environment setup and reporting.
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader() {
  log('\n🎭 Job Search Platform - Playwright Test Suite', 'cyan');
  log('=' * 50, 'cyan');
}

function printUsage() {
  log('\nUsage:', 'bright');
  log('  node run-tests.js [test-type] [options]', 'yellow');

  log('\nTest Types:', 'bright');
  log('  all         - Run all tests (default)', 'green');
  log('  auth        - Authentication flow tests', 'green');
  log('  tracker     - Job tracker dashboard tests', 'green');
  log('  e2e         - End-to-end AI workflow tests', 'green');
  log('  responsive  - Responsive design tests', 'green');

  log('\nOptions:', 'bright');
  log('  --headed    - Run with browser visible', 'yellow');
  log('  --debug     - Run in debug mode', 'yellow');
  log('  --ui        - Open Playwright UI', 'yellow');
  log('  --report    - Show test report after completion', 'yellow');

  log('\nExamples:', 'bright');
  log('  node run-tests.js auth --headed', 'magenta');
  log('  node run-tests.js e2e --debug', 'magenta');
  log('  node run-tests.js all --report', 'magenta');
}

function validateEnvironment() {
  log('\n🔍 Validating test environment...', 'blue');

  // Check if required files exist
  const requiredFiles = [
    'playwright.config.js',
    'tests/auth.spec.js',
    'tests/tracker.spec.js',
    'tests/e2e-job-ai.spec.js',
    'tests/responsive.spec.js'
  ];

  const missing = requiredFiles.filter(file => {
    try {
      require.resolve(path.join(process.cwd(), file));
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length > 0) {
    log(`❌ Missing required files: ${missing.join(', ')}`, 'red');
    return false;
  }

  log('✅ All test files found', 'green');

  // Check for test environment file
  try {
    require.resolve(path.join(process.cwd(), '.env.test.local'));
    log('✅ Test environment configuration found', 'green');
  } catch {
    log('⚠️  .env.test.local not found - copy from .env.test and configure', 'yellow');
  }

  return true;
}

function runPlaywrightTest(testType, options = []) {
  return new Promise((resolve, reject) => {
    const args = ['playwright', 'test'];

    // Add test file based on type
    switch (testType) {
      case 'auth':
        args.push('auth.spec.js');
        break;
      case 'tracker':
        args.push('tracker.spec.js');
        break;
      case 'e2e':
        args.push('e2e-job-ai.spec.js');
        break;
      case 'responsive':
        args.push('responsive.spec.js');
        break;
      case 'all':
      default:
        // Run all tests (no specific file)
        break;
    }

    // Add options
    args.push(...options);

    log(`\n🚀 Running: npx ${args.join(' ')}`, 'blue');

    const child = spawn('npx', args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        log('\n✅ Tests completed successfully!', 'green');
        resolve(code);
      } else {
        log('\n❌ Tests failed!', 'red');
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      log(`\n❌ Error running tests: ${err.message}`, 'red');
      reject(err);
    });
  });
}

async function main() {
  printHeader();

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Parse arguments
  const testType = args.find(arg => !arg.startsWith('--')) || 'all';
  const options = args.filter(arg => arg.startsWith('--'));

  // Convert options to Playwright format
  const playwrightOptions = options.map(opt => {
    switch (opt) {
      case '--headed':
        return '--headed';
      case '--debug':
        return '--debug';
      case '--ui':
        return '--ui';
      default:
        return opt;
    }
  });

  try {
    await runPlaywrightTest(testType, playwrightOptions);

    // Show report if requested
    if (options.includes('--report')) {
      log('\n📊 Opening test report...', 'blue');
      spawn('npx', ['playwright', 'show-report'], { stdio: 'inherit', shell: true });
    }

  } catch (error) {
    log(`\n💥 Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n🛑 Test execution interrupted by user', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n\n🛑 Test execution terminated', 'yellow');
  process.exit(0);
});

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { runPlaywrightTest };