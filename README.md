# Eric Kazee - Professional Portfolio

AI Adoption Specialist | Legal Technology | Training & Consulting

## About
12+ years helping law firms and businesses leverage AI and technology while maintaining privilege, compliance, and security standards.

## Live Site
🌐 [View Portfolio](https://ekazee01.github.io/jobsearch/)

## Connect
- 💼 [LinkedIn](https://linkedin.com/in/erickazee)
- 📧 [ekazee.careers@gmail.com](mailto:ekazee.careers@gmail.com)
- 🐦 [Twitter/X](https://x.com/ekazee)

## Tech Stack
- Frontend: HTML5, CSS3, JavaScript
- Backend: Python 3.x
- Automation: n8n, Crawl4AI
- AI: Anthropic Claude (generation), OpenAI / OpenRouter (scoring — swappable)

## 🕷️ Crawl4AI Setup

This project includes Crawl4AI for advanced web scraping and data extraction. Follow these steps for setup:

### Prerequisites
- Ubuntu/WSL2 environment
- Python 3.8+
- Virtual environment activated

### Installation & Setup
```bash
# 1. Navigate to project directory
cd /mnt/c/Users/ekaze/Github_Job_Search/jobsearch

# 2. Activate virtual environment
source .venv/bin/activate

# 3. Set required environment variables
export CRAWL4AI_BASE_DIRECTORY="$PWD/.crawl4ai-data"
export CRAWL4AI_MODE="api"

# 4. Create data directory
mkdir -p "$CRAWL4AI_BASE_DIRECTORY"

# 5. Install Playwright browsers and dependencies
python -m playwright install chromium
sudo python -m playwright install-deps chromium

# 6. Run Crawl4AI setup
crawl4ai-setup --verbose
```

### Usage
The Crawl4AI installation provides:
- CLI tool: `.venv/bin/crawl4ai`
- Python API: `from crawl4ai import AsyncWebCrawler`
- Database storage in `.crawl4ai-data/`
- Browser automation with Chromium

### Testing Installation
```bash
# Verify end-to-end functionality
crawl4ai-doctor

# Test basic crawling
python scripts/test-crawler.py
```

---

*Currently building: Job search automation and application tracking system*
