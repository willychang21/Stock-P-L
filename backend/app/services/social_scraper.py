import feedparser
from playwright.async_api import async_playwright
from typing import List, Dict, Optional
import os
import asyncio
import hashlib

class SocialScraperService:
    def fetch_substack_posts(self, url: str, limit: int = 5) -> List[Dict]:
        """
        Fetches latest posts from a Substack RSS feed.
        """
        try:
            # Handle URLs: ensure it ends with /feed
            feed_url = url.rstrip("/")
            if not feed_url.endswith("/feed"):
                feed_url += "/feed"
            
            feed = feedparser.parse(feed_url)
            
            posts = []
            for entry in feed.entries[:limit]:
                posts.append({
                    "source": "Substack",
                    "author": feed.feed.get("title", "Unknown"),
                    "content": self._clean_html(entry.get("summary", "") or entry.get("description", "")),
                    "url": entry.link,
                    "date": entry.get("published", "")
                })
            return posts
        except Exception as e:
            print(f"Error fetching Substack: {e}")
            return []

    async def fetch_threads_posts(self, username: str, limit: int = 5) -> List[Dict]:
        """
        Fetches latest posts from a Threads profile using Playwright (async).
        Uses saved session cookies if available for authenticated access.
        """
        results = []
        session_path = "/tmp/threads_session"
        
        try:
            async with async_playwright() as p:
                # Launch headless browser
                browser = await p.chromium.launch(headless=True) 
                
                # Check if we have a saved session
                if os.path.exists(session_path):
                    print(f"[DEBUG] Loading saved session from: {session_path}")
                    context = await browser.new_context(
                        storage_state=session_path,
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        viewport={"width": 1280, "height": 720}
                    )
                else:
                    print(f"[DEBUG] No saved session found, using anonymous access")
                    context = await browser.new_context(
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        viewport={"width": 1280, "height": 720}
                    )
                
                page = await context.new_page()

                
                url = f"https://www.threads.net/@{username}"
                print(f"[DEBUG] Loading: {url}")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Wait for content to load
                await asyncio.sleep(5)
                
                # Save HTML for debugging
                html_content = await page.content()
                debug_path = f"/tmp/threads_{username}_debug.html"
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                print(f"[DEBUG] HTML saved to: {debug_path}")
                
                # Scroll and collect posts
                collected_posts = []
                seen_hashes = set()
                scroll_attempts = 0
                max_scrolls = 10  # Prevent infinite loops
                
                while len(collected_posts) < limit and scroll_attempts < max_scrolls:
                    # Find potential post containers
                    containers = await page.locator("div[data-pressable-container='true']").all()
                    print(f"[DEBUG] Found {len(containers)} containers on attempt {scroll_attempts}")
                    
                    new_posts_found = False
                    for container in containers:
                        if len(collected_posts) >= limit:
                            break
                            
                        try:
                            # Try clicking "More" / "更多" to expand truncated posts
                            try:
                                more_btn = container.locator("span:text-is('More'), span:text-is('更多')").first
                                if await more_btn.count() > 0:
                                    await more_btn.click()
                                    await asyncio.sleep(0.5)
                            except Exception:
                                pass
                            
                            # Extract text
                            full_text = await container.text_content()
                            if not full_text:
                                continue
                            
                            # Skip unavailable content
                            if "This content is unavailable" in full_text:
                                continue
                            
                            # Clean the text
                            clean_text = self._clean_threads_post(full_text, username)
                            
                            # Deduplicate by content hash
                            content_hash = hashlib.md5(clean_text.encode()).hexdigest()
                            if content_hash in seen_hashes or len(clean_text) < 10:
                                continue
                            seen_hashes.add(content_hash)
                            
                            # Try to extract individual post URL
                            post_url = url  # Fallback to profile URL
                            try:
                                link = container.locator("a[href*='/post/']").first
                                if await link.count() > 0:
                                    href = await link.get_attribute("href")
                                    if href:
                                        post_url = f"https://www.threads.net{href}" if href.startswith("/") else href
                            except Exception:
                                pass
                            
                            collected_posts.append({
                                "source": "Threads",
                                "author": username,
                                "content": clean_text,
                                "content_hash": content_hash,
                                "url": post_url,
                                "date": "Recent"
                            })
                            new_posts_found = True
                            print(f"[DEBUG] Extracted post #{len(collected_posts)}: {clean_text[:60]}...")
                            
                        except Exception as e:
                            print(f"[DEBUG] Error extracting post: {e}")
                            continue

                    if len(collected_posts) >= limit:
                        break
                        
                    # Scroll down to load more
                    print(f"[DEBUG] Scrolling down... ({len(collected_posts)}/{limit} collected)")
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await asyncio.sleep(2)  # Wait for content to load
                    scroll_attempts += 1
                    
                    if not new_posts_found and scroll_attempts > 3:
                        print("[DEBUG] No new posts found after scrolling, stopping.")
                        break
                
                results = collected_posts
                
                await browser.close()
                print(f"[DEBUG] Successfully extracted {len(results)} valid posts")
                
        except Exception as e:
            print(f"[ERROR] fetch_threads_posts failed: {e}")
            import traceback
            traceback.print_exc()
            # Return empty list, NOT an error dict
            return []
            
        return results

    def _clean_threads_post(self, text: str, username: str) -> str:
        """
        Clean Threads post text — remove UI noise but preserve financial content.

        Threads text_content() produces concatenated strings like:
          "Follow okaneinu 3d Edited More 那天買DDOG... Translate Like102 Comment4 Repost Share 2"
        We need to strip all the UI artifacts and keep only the post body.
        """
        import re
        
        # Step 1: Remove "Follow" + username prefix
        text = re.sub(rf'^(Follow\s*)?{re.escape(username)}', '', text, flags=re.IGNORECASE)
        
        # Step 2: Remove leading metadata block: "Verified", time like "3d"/"14h", "Edited", "More"
        # These appear concatenated at the start: "Verified 3d Edited More" or "3dEditedMore"
        text = re.sub(r'^\s*Verified\s*', '', text, flags=re.IGNORECASE)
        # Remove leading time indicator (1-3 chars) + optional Edited + More
        text = re.sub(r'^\s*\d{1,2}[hdwm]\s*(Edited\s*)?(More\s*)?', '', text, flags=re.IGNORECASE)
        # If "Edited" or "More" still at the start
        text = re.sub(r'^\s*Edited\s*(More\s*)?', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^\s*More\s+', '', text, flags=re.IGNORECASE)
        
        # Step 3: Remove trailing interaction bar (concatenated without spaces)
        # Pattern: "Translate" + "Like123" + "Comment4" + "Repost" + "Share" + optional number
        # Must handle: "TranslateLike102Comment4RepostShare2"
        # and: "Like12Comment1RepostShare"
        text = re.sub(
            r'\s*Translate\s*(Like\s*\d*\s*)?(Comment\s*\d*\s*)?(Repost\s*\d*\s*)?(Share\s*\d*\s*)?$',
            '', text, flags=re.IGNORECASE
        )
        text = re.sub(
            r'\s*(Like\s*\d+\s*)(Comment\s*\d*\s*)?(Repost\s*\d*\s*)?(Share\s*\d*\s*)?$',
            '', text, flags=re.IGNORECASE
        )
        # Catch remaining trailing "Share", "Repost", etc.
        text = re.sub(r'\s*(Like|Comment|Repost|Share)\s*\d*\s*$', '', text, flags=re.IGNORECASE)
        
        # Step 4: Remove "n / m" carousel indicators like "1 / 2" or "2 / 2"
        text = re.sub(r'\d+\s*/\s*\d+', '', text)
        
        # Step 5: Clean excessive whitespace
        text = ' '.join(text.split())
        
        return text.strip()


    def _clean_html(self, raw_html: str) -> str:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(raw_html, "html.parser")
        return soup.get_text(separator=" ", strip=True)

    def _clean_text(self, text: str) -> str:
        # Basic cleanup
        return " ".join(text.split())

social_scraper = SocialScraperService()
