from __future__ import annotations
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

from app.services.social_scraper import social_scraper
from app.services.sentiment_analyzer import sentiment_analyzer

from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/api/social", tags=["Social Media Analysis"])

class SocialAnalysisRequest(BaseModel):
    source_type: str  # "threads" or "substack"
    target: str       # URL (for substack) or username (for threads)
    limit: int | None = 5

class SocialPostAnalysis(BaseModel):
    source: str
    author: str
    content: str
    url: str
    date: str
    analysis: dict | None = None

@router.post("/analyze", response_model=List[SocialPostAnalysis])
async def analyze_social_media(request: SocialAnalysisRequest):
    """
    Fetches posts from the specified source and analyzes sentiment using DeepSeek-R1.
    """
    posts = []
    
    # 1. Fetch Posts
    if request.source_type.lower() == "substack":
        # Run blocking substack scraper in threadpool
        posts = await run_in_threadpool(social_scraper.fetch_substack_posts, request.target, limit=request.limit)
    elif request.source_type.lower() == "threads":
        posts = await social_scraper.fetch_threads_posts(request.target, limit=request.limit)
    else:
        raise HTTPException(status_code=400, detail="Invalid source_type. Use 'threads' or 'substack'.")

    
    if not posts:
        return []
        
    results = []
    
    # 2. Analyze Sentiment for each post
    # Using run_in_threadpool because local LLM analysis is a blocking call.
    for post in posts:
        # Skip if error occurred during fetching
        if "error" in post:
            continue
            
        analysis_result = await run_in_threadpool(sentiment_analyzer.analyze_post, post["content"])
        
        results.append(SocialPostAnalysis(
            source=post["source"],
            author=post["author"],
            content=post["content"],
            url=post["url"],
            date=post["date"],
            analysis=analysis_result
        ))
        
    return results
