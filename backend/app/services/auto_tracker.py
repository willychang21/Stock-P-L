from __future__ import annotations
"""
Auto-Tracker Service — Redesigned Pipeline
Scrapes influencer posts → deduplicates → classifies → extracts assets → creates pending reviews.
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import json
import hashlib
from app.services.social_scraper import social_scraper
from app.services.sentiment_analyzer import sentiment_analyzer
from app.db.session import get_db


class AutoTrackerService:
    """Service to automatically track influencer posts and extract recommendations."""
    
    async def track_influencer(self, influencer_id: str, platform: str, url: str, limit: int = 5) -> Dict:
        """
        Full pipeline: scrape → deduplicate → classify → extract → store.
        """
        results = {
            "influencer_id": influencer_id,
            "platform": platform,
            "posts_scraped": 0,
            "posts_analyzed": 0,
            "posts_skipped_duplicate": 0,
            "posts_skipped_irrelevant": 0,
            "recommendations_found": 0,
            "pending_review_ids": [],
            "errors": []
        }
        
        # ── Step 1: Scrape posts ──
        posts = await self._scrape_posts(platform, url, limit)
        results["posts_scraped"] = len(posts)
        
        if not posts:
            results["errors"].append("No posts found to analyze")
            return results
        
        # ── Step 2: Deduplicate against history ──
        new_posts = self._filter_already_analyzed(influencer_id, posts)
        results["posts_skipped_duplicate"] = len(posts) - len(new_posts)
        
        if not new_posts:
            results["errors"].append("All posts have already been analyzed")
            return results
        
        # ── Step 3: Analyze each new post ──
        for post in new_posts:
            content = post.get("content", "")
            content_hash = post.get("content_hash") or hashlib.md5(content.encode()).hexdigest()
            
            try:
                # Phase 1: Quick classify using background thread to avoid blocking event loop
                analysis = await asyncio.to_thread(sentiment_analyzer.analyze_post, content)
                results["posts_analyzed"] += 1
                
                # Check for errors
                if "error" in analysis:
                    results["errors"].append(f"AI error: {analysis['error']}")
                    self._record_scraped_post(influencer_id, content_hash, post, False, "error")
                    continue
                
                post_type = analysis.get("post_type", "irrelevant")
                assets = analysis.get("assets", [])
                
                # If irrelevant, record and skip
                if post_type in ["irrelevant", "lifestyle", "other"] or not assets:
                    results["posts_skipped_irrelevant"] += 1
                    self._record_scraped_post(influencer_id, content_hash, post, False, post_type)
                    continue
                
                # ── Step 4: Create pending review for EACH asset ──
                self._record_scraped_post(influencer_id, content_hash, post, True, post_type)
                
                for asset in assets:
                    symbol = asset.get("symbol")
                    if not symbol or symbol in ["None", "", "N/A", "null"]:
                        continue
                    
                    # Build per-asset analysis object
                    asset_analysis = {
                        "post_type": post_type,
                        "symbol": symbol,
                        "category": asset.get("category", ""),
                        "signal": asset.get("signal", "HOLD"),
                        "market": asset.get("market", "US"),
                        "note": asset.get("note", ""),
                        "overall_sentiment": analysis.get("overall_sentiment", "Neutral"),
                        "confidence": analysis.get("confidence", 0.5),
                        "summary": analysis.get("summary", ""),
                        "key_points": analysis.get("key_points", [])
                    }
                    
                    pending_id = await self._create_pending_review(
                        influencer_id=influencer_id,
                        source=f"AUTO_{platform.upper()}",
                        source_url=post.get("url", url),
                        original_content=content[:500],
                        ai_analysis=asset_analysis,
                        suggested_symbol=symbol,
                        suggested_signal=asset.get("signal", "HOLD"),
                        content_hash=content_hash,
                        post_date=post.get("date")
                    )
                    
                    if pending_id:
                        results["pending_review_ids"].append(pending_id)
                        results["recommendations_found"] += 1
                    
            except Exception as e:
                results["errors"].append(f"Post analysis error: {str(e)}")
                continue
        
        return results
    
    # ──────────────────────────────────────────
    # Scraping
    # ──────────────────────────────────────────
    async def _scrape_posts(self, platform: str, url: str, limit: int) -> List[Dict]:
        """Scrape posts from the given platform."""
        platform = platform.lower().strip()
        
        if platform in ["threads", "thread"]:
            username = url
            if "threads.net/@" in url or "threads.com/@" in url:
                username = url.split("@")[-1].split("/")[0].split("?")[0]
            elif "@" in url:
                username = url.replace("@", "").strip()
            
            print(f"[AutoTracker] Scraping Threads for: {username} (limit={limit})")
            return await social_scraper.fetch_threads_posts(username, limit)
            
        elif platform == "substack":
            print(f"[AutoTracker] Scraping Substack: {url} (limit={limit})")
            return social_scraper.fetch_substack_posts(url, limit)
            
        else:
            print(f"[AutoTracker] Unknown platform: {platform}")
            return []
    
    # ──────────────────────────────────────────
    # Deduplication
    # ──────────────────────────────────────────
    def _filter_already_analyzed(self, influencer_id: str, posts: List[Dict]) -> List[Dict]:
        """Filter out posts that have already been scraped and analyzed."""
        try:
            db = next(get_db())
            
            # Get all known content hashes for this influencer
            rows = db.execute(
                "SELECT content_hash FROM scraped_posts WHERE influencer_id = ?",
                [influencer_id]
            ).fetchall()
            known_hashes = {r[0] for r in rows}
            
            new_posts = []
            for post in posts:
                content_hash = post.get("content_hash") or hashlib.md5(post.get("content", "").encode()).hexdigest()
                post["content_hash"] = content_hash
                
                if content_hash not in known_hashes:
                    new_posts.append(post)
                else:
                    print(f"[AutoTracker] Skipping duplicate: {post.get('content', '')[:40]}...")
            
            print(f"[AutoTracker] {len(new_posts)} new posts out of {len(posts)} total")
            return new_posts
            
        except Exception as e:
            print(f"[AutoTracker] Dedup check failed: {e}, processing all posts")
            return posts
    
    def _record_scraped_post(self, influencer_id: str, content_hash: str, post: Dict, is_investment: bool, post_type: str):
        """Record a scraped post to prevent future re-analysis."""
        try:
            db = next(get_db())
            db.execute(
                """
                INSERT INTO scraped_posts 
                (id, influencer_id, content_hash, source, source_url, original_content, is_investment_related, post_type, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (influencer_id, content_hash) DO NOTHING
                """,
                [
                    str(uuid.uuid4()),
                    influencer_id,
                    content_hash,
                    post.get("source", ""),
                    post.get("url", ""),
                    post.get("content", "")[:1000],
                    is_investment,
                    post_type,
                    datetime.now()
                ]
            )
        except Exception as e:
            print(f"[AutoTracker] Failed to record scraped post: {e}")
    
    # ──────────────────────────────────────────
    # Pending Review Creation
    # ──────────────────────────────────────────
    async def _create_pending_review(
        self,
        influencer_id: str,
        source: str,
        source_url: str,
        original_content: str,
        ai_analysis: Dict,
        suggested_symbol: str | None = None,
        suggested_signal: str | None = None,
        content_hash: str | None = None,
        post_date: str | None = None
    ) -> str | None:
        """Store a pending review record in the database."""
        try:
            db = next(get_db())
            pending_id = str(uuid.uuid4())
            now = datetime.now()
            
            # Determine signal
            signal = suggested_signal or "HOLD"
            symbol = suggested_symbol or ai_analysis.get("symbol")

            db.execute(
                """
                INSERT INTO pending_reviews 
                (id, influencer_id, source, source_url, original_content, 
                 ai_analysis, suggested_symbol, suggested_signal, suggested_timeframe,
                 confidence, status, created_at, content_hash, post_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
                """,
                [
                    pending_id,
                    influencer_id,
                    source,
                    source_url,
                    original_content[:1000],
                    json.dumps(ai_analysis, ensure_ascii=False),
                    symbol,
                    signal,
                    "MID",
                    ai_analysis.get("confidence", 0.5),
                    now,
                    content_hash,
                    post_date
                ]
            )
            
            return pending_id
            
        except Exception as e:
            print(f"[ERROR] Failed to create pending review: {e}")
            return None


auto_tracker = AutoTrackerService()
