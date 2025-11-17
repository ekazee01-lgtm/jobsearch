#!/usr/bin/env python3
"""
Crawl4AI API Wrapper for n8n Integration
This creates an HTTP endpoint that n8n can call to scrape job listings
"""

import os
import sys
import asyncio
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from contextlib import asynccontextmanager
import uvicorn

# Add parent directory to path for Crawl4AI imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Crawl4AI imports
from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

# FastAPI app
app = FastAPI(title="Crawl4AI Job Scraper API", version="1.0.0")

# Request/Response models
class ScrapeRequest(BaseModel):
    url: HttpUrl
    extraction_strategy: Optional[str] = "job_listing"
    wait_for: Optional[str] = None
    timeout: Optional[int] = 30

class ScrapeResponse(BaseModel):
    success: bool
    url: str
    title: Optional[str] = None
    content: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Extraction strategies for different job sites
EXTRACTION_STRATEGIES = {
    "job_listing": JsonCssExtractionStrategy(
        schema={
            "name": "Job Listings",
            "baseSelector": "[data-testid='job-card'], .job-listing, .job-post",
            "fields": [
                {"name": "title", "selector": ".job-title, h2, h3", "type": "text"},
                {"name": "company", "selector": ".company-name, .employer", "type": "text"},
                {"name": "location", "selector": ".location, .job-location", "type": "text"},
                {"name": "salary", "selector": ".salary, .compensation", "type": "text"},
                {"name": "description", "selector": ".description, .job-summary", "type": "text"},
                {"name": "posted_date", "selector": ".posted-date, .date", "type": "text"},
                {"name": "apply_link", "selector": "a[href*='apply'], .apply-button", "type": "attribute", "attribute": "href"}
            ]
        }
    ),
    "indeed": JsonCssExtractionStrategy(
        schema={
            "name": "Indeed Jobs",
            "baseSelector": ".jobsearch-ResultsList .result",
            "fields": [
                {"name": "title", "selector": ".jobTitle span[title]", "type": "text"},
                {"name": "company", "selector": ".companyName", "type": "text"},
                {"name": "location", "selector": ".locationsContainer", "type": "text"},
                {"name": "salary", "selector": ".salary-snippet", "type": "text"},
                {"name": "description", "selector": ".job-snippet", "type": "text"}
            ]
        }
    ),
    "linkedin": JsonCssExtractionStrategy(
        schema={
            "name": "LinkedIn Jobs",
            "baseSelector": ".jobs-search__results-list li",
            "fields": [
                {"name": "title", "selector": ".base-search-card__title", "type": "text"},
                {"name": "company", "selector": ".base-search-card__subtitle", "type": "text"},
                {"name": "location", "selector": ".job-search-card__location", "type": "text"},
                {"name": "posted_date", "selector": "time", "type": "text"}
            ]
        }
    )
}

@app.get("/")
async def root():
    """Health check and API info"""
    return {
        "status": "running",
        "service": "Crawl4AI Job Scraper",
        "endpoints": ["/scrape", "/strategies", "/health"],
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "crawl4ai"}

@app.get("/strategies")
async def list_strategies():
    """List available extraction strategies"""
    return {
        "strategies": list(EXTRACTION_STRATEGIES.keys()),
        "description": "Available extraction strategies for different job sites"
    }

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_job_site(request: ScrapeRequest):
    """
    Scrape a job site URL using Crawl4AI
    
    Args:
        request: ScrapeRequest with URL and optional parameters
        
    Returns:
        ScrapeResponse with extracted job data
    """
    try:
        # Get extraction strategy
        strategy = EXTRACTION_STRATEGIES.get(
            request.extraction_strategy, 
            EXTRACTION_STRATEGIES["job_listing"]
        )
        
        # Configure crawler
        async with AsyncWebCrawler(
            headless=True,
            verbose=False,
            # Add any proxy settings if needed
            # proxy="http://proxy:port"
        ) as crawler:
            
            # Scrape the page
            result = await crawler.arun(
                url=str(request.url),
                extraction_strategy=strategy,
                wait_for=request.wait_for,
                timeout=request.timeout,
                bypass_cache=True,  # Always get fresh data for job listings
                # Add anti-detection measures
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Language": "en-US,en;q=0.9"
                }
            )
            
            # Parse results
            extracted_data = None
            if result.extracted_content:
                import json
                try:
                    extracted_data = json.loads(result.extracted_content)
                except:
                    extracted_data = {"raw": result.extracted_content}
            
            return ScrapeResponse(
                success=result.success,
                url=str(request.url),
                title=result.title,
                content=result.markdown[:1000] if result.markdown else None,  # First 1000 chars
                extracted_data=extracted_data,
                error=result.error_message if hasattr(result, 'error_message') else None
            )
            
    except Exception as e:
        return ScrapeResponse(
            success=False,
            url=str(request.url),
            error=str(e)
        )

@app.post("/scrape/batch")
async def scrape_multiple_sites(urls: list[str], strategy: str = "job_listing"):
    """
    Scrape multiple job sites in parallel
    
    Args:
        urls: List of URLs to scrape
        strategy: Extraction strategy to use
        
    Returns:
        List of scrape results
    """
    tasks = []
    for url in urls:
        request = ScrapeRequest(url=url, extraction_strategy=strategy)
        tasks.append(scrape_job_site(request))
    
    results = await asyncio.gather(*tasks)
    return {"results": results, "total": len(results)}

if __name__ == "__main__":
    # Run the API server
    uvicorn.run(
        app, 
        host="0.0.0.0",  # Listen on all interfaces
        port=8000,       # Port for n8n to connect to
        log_level="info"
    )
