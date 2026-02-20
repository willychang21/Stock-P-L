import feedparser
from playwright.async_api import async_playwright
from typing import List, Dict, Optional
import os
import asyncio
import hashlib
from dotenv import load_dotenv

# Load Threads credentials
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.threads')
load_dotenv(dotenv_path)

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
                if not os.path.exists(session_path):
                    print(f"[DEBUG] No saved session found, performing auto-login...")
                    await self._perform_threads_login(browser, session_path)

                if os.path.exists(session_path):
                    print(f"[DEBUG] Loading saved session from: {session_path}")
                    context = await browser.new_context(
                        storage_state=session_path,
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        viewport={"width": 1280, "height": 720}
                    )
                else:
                    print(f"[DEBUG] Login failed or skipped, using anonymous access")
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
                seen_prefixes = set()  # For similarity-based dedup
                seen_texts = set()     # For substring containment dedup
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
                            
                            if len(clean_text) < 10:
                                continue
                            
                            # Deduplicate: exact hash match
                            content_hash = hashlib.md5(clean_text.encode()).hexdigest()
                            if content_hash in seen_hashes:
                                continue
                            
                            # Deduplicate: prefix similarity (catches reposts that embed original)
                            # If first 50 chars match any seen post, it's a duplicate
                            prefix = clean_text[:50]
                            if any(prefix.startswith(sp) or sp.startswith(prefix) for sp in seen_prefixes):
                                continue
                            
                            # Deduplicate: substring containment (catches quote-posts)
                            # If a seen post's text is fully contained in this one (or vice versa),
                            # it's a repost/quote that embedded the original
                            is_contained = False
                            for seen_text in seen_texts:
                                if len(clean_text) > 30 and len(seen_text) > 30:
                                    if seen_text in clean_text or clean_text in seen_text:
                                        is_contained = True
                                        break
                            if is_contained:
                                continue
                            
                            seen_prefixes.add(prefix)
                            seen_texts.add(clean_text)
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
                            # Try to extract post date from <time> element
                            post_date = "Recent"
                            try:
                                time_elem = container.locator("time").first
                                if await time_elem.count() > 0:
                                    dt = await time_elem.get_attribute("datetime")
                                    if dt:
                                        # Extract just the YYYY-MM-DD part
                                        post_date = dt.split("T")[0]
                            except Exception:
                                pass
                                
                            collected_posts.append({
                                "source": "Threads",
                                "author": username,
                                "content": clean_text,
                                "content_hash": content_hash,
                                "url": post_url,
                                "date": post_date
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
        Clean Threads post text — remove ALL UI noise so hashing is deterministic.

        Threads text_content() produces concatenated strings like:
          "Follow okaneinu 3d Edited More 那天買DDOG... Translate Like102 Reply4 Repost Share 2"
        or even worse (with reposts embedded):
          "okaneinu期權解說 - 01...Like207Reply18Repost9Share49Like16Reply2Repost"

        We aggressively strip all engagement metadata so the same post
        always produces the same MD5 hash regardless of engagement counts.
        """
        import re
        
        # Step 1: Remove "Follow" + username prefix (may appear multiple times for reposts)
        text = re.sub(rf'(Follow\s*)?{re.escape(username)}\s*', '', text, flags=re.IGNORECASE)
        
        # Step 2: Remove ALL engagement tokens anywhere in text (the core fix)
        # These appear concatenated: "Like207Reply18Repost9Share49"
        # Use global replacement, not just trailing
        text = re.sub(r'Translate\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Like\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Reply\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Repost\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Share\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Comment\s*\d*', '', text, flags=re.IGNORECASE)
        
        # Step 3: Remove time+metadata block (often concatenated: "14hEditedMore", "6hEdited")
        # MUST come before individual keyword removal.
        # No \b boundaries — Threads concatenates these without spaces
        text = re.sub(r'\d{1,3}[hdwm]\s*(?:Edited\s*)?(?:More\s*)?', '', text, flags=re.IGNORECASE)
        # Standalone "Edited" and "More" that weren't caught above
        text = re.sub(r'Edited\s*(?:More\s*)?', '', text, flags=re.IGNORECASE)
        # "More" at the very start (e.g., "More期權解說...")
        text = re.sub(r'^More\s*', '', text, flags=re.IGNORECASE)
        # "Verified" and "Follow" (no word boundary needed)
        text = re.sub(r'Verified\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Follow\s*', '', text, flags=re.IGNORECASE)
        
        # Step 4: Remove carousel indicators "1 / 2", "2 / 2"
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

    async def _perform_threads_login(self, browser, session_path: str):
        username = os.environ.get("THREADS_USERNAME")
        password = os.environ.get("THREADS_PASSWORD")
        if not username or not password:
            print("[WARN] THREADS_USERNAME or THREADS_PASSWORD not found in environment.")
            return

        print("[DEBUG] Logging into Threads...")
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()

        try:
            await page.goto("https://www.threads.net/login", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)

            await page.wait_for_selector('input[type="text"], input[name="username"]', timeout=15000)
            user_input = page.locator('input[type="text"], input[name="username"]').first
            await user_input.click()
            await asyncio.sleep(0.5)
            await user_input.type(username, delay=50)

            await asyncio.sleep(0.5)
            pass_input = page.locator('input[type="password"]').first
            await pass_input.click()
            await asyncio.sleep(0.5)
            await pass_input.type(password, delay=50)

            await asyncio.sleep(1)
            
            try:
                login_btn = page.locator('div[role="button"]:has-text("登入"), div[role="button"]:has-text("Log in"), button:has-text("登入"), button:has-text("Log in")').first
                if await login_btn.count() > 0:
                    await login_btn.click()
                else:
                    raise Exception("No visible login button")
            except Exception:
                await pass_input.press("Enter")
            
            print("[DEBUG] Submitted login form. Waiting 15s...")
            await asyncio.sleep(15)
            
            # Navigate to verify
            print("[DEBUG] Navigating to threads.net to verify session...")
            await page.goto("https://www.threads.net/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            # Save state
            await context.storage_state(path=session_path)
            print(f"[DEBUG] ✅ Saved session to {session_path}")
            
        except Exception as e:
            print(f"[ERROR] Auto-login failed: {e}")
        finally:
            await context.close()

social_scraper = SocialScraperService()
