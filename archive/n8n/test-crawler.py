#!/usr/bin/env python3
"""
Crawl4AI Demo Script - Job Search Platform
Demonstrates basic usage of AsyncWebCrawler for web scraping

Usage:
    python scripts/test-crawler.py

Requirements:
    - Crawl4AI properly installed and configured
    - Environment variables set (CRAWL4AI_BASE_DIRECTORY, CRAWL4AI_MODE)
"""

import asyncio
import sys
import os
from typing import Optional

def setup_environment():
    """Setup required environment variables for Crawl4AI"""
    # Set base directory relative to project root
    base_dir = os.path.join(os.getcwd(), '.crawl4ai-data')
    os.environ['CRAWL4AI_BASE_DIRECTORY'] = base_dir
    os.environ['CRAWL4AI_MODE'] = 'api'

    print(f"✓ CRAWL4AI_BASE_DIRECTORY: {base_dir}")
    print(f"✓ CRAWL4AI_MODE: api")

async def simple_crawl_demo(url: str) -> Optional[dict]:
    """
    Demonstrate basic web crawling functionality

    Args:
        url: URL to crawl

    Returns:
        Dictionary with crawl results or None if failed
    """
    try:
        # Import here to catch import errors gracefully
        from crawl4ai import AsyncWebCrawler

        print(f"\n🕷️ Starting crawl of: {url}")

        async with AsyncWebCrawler(verbose=True) as crawler:
            result = await crawler.arun(url=url)

            if result.success:
                print(f"✅ Crawl successful!")
                print(f"📄 Title: {result.metadata.get('title', 'N/A')}")
                print(f"📊 Content length: {len(result.markdown) if result.markdown else 0} characters")
                print(f"🔗 Links found: {len(result.links) if result.links else 0}")

                # Return summary
                return {
                    "url": url,
                    "title": result.metadata.get('title'),
                    "content_length": len(result.markdown) if result.markdown else 0,
                    "links_count": len(result.links) if result.links else 0,
                    "success": True
                }
            else:
                print(f"❌ Crawl failed: {result.error_message}")
                return {"url": url, "success": False, "error": result.error_message}

    except ImportError:
        print("❌ Error: crawl4ai module not found. Please ensure it's properly installed.")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return None

async def job_site_crawl_demo():
    """
    Demonstrate crawling job-related websites
    """
    print("\n🎯 Job Site Crawling Demo")
    print("=" * 50)

    # Example job sites (use public, non-intrusive URLs)
    test_urls = [
        "https://example.com",  # Safe test URL
        "https://httpbin.org/html",  # Simple HTML test
    ]

    results = []
    for url in test_urls:
        result = await simple_crawl_demo(url)
        if result:
            results.append(result)

        # Be respectful - add delay between requests
        await asyncio.sleep(2)

    return results

def print_summary(results: list):
    """Print a summary of crawling results"""
    if not results:
        print("\n❌ No successful crawls to summarize")
        return

    print("\n📈 Crawl Summary")
    print("=" * 30)

    successful = [r for r in results if r.get('success', False)]
    failed = [r for r in results if not r.get('success', False)]

    print(f"✅ Successful crawls: {len(successful)}")
    print(f"❌ Failed crawls: {len(failed)}")

    if successful:
        total_content = sum(r.get('content_length', 0) for r in successful)
        total_links = sum(r.get('links_count', 0) for r in successful)

        print(f"📊 Total content extracted: {total_content:,} characters")
        print(f"🔗 Total links found: {total_links}")

async def main():
    """Main function to run the Crawl4AI demo"""
    print("🚀 Crawl4AI Demo Script Starting...")
    print("=" * 50)

    # Setup environment
    setup_environment()

    try:
        # Run demo crawls
        results = await job_site_crawl_demo()

        # Print summary
        print_summary(results)

        print("\n✅ Demo completed successfully!")
        print("\nNext steps:")
        print("1. Modify test URLs for your specific use case")
        print("2. Implement extraction patterns for job listings")
        print("3. Add data storage and processing logic")
        print("4. Integrate with your job search automation system")

    except Exception as e:
        print(f"\n❌ Demo failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Check if we can run the demo
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required for this demo")
        sys.exit(1)

    # Run the async demo
    asyncio.run(main())