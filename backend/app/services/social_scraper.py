from __future__ import annotations
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
                            clean_text, part_num, total_parts = self._clean_threads_post(full_text, username)
                            
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
                            post_datetime = None
                            try:
                                time_elem = container.locator("time").first
                                if await time_elem.count() > 0:
                                    dt = await time_elem.get_attribute("datetime")
                                    if dt:
                                        post_datetime = dt
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
                                "date": post_date,
                                "datetime": post_datetime,
                                "part_num": part_num,
                                "total_parts": total_parts
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
                
                results = self._merge_multipart_posts(collected_posts)
                
                await browser.close()
                print(f"[DEBUG] Successfully extracted and merged to {len(results)} valid posts")
                
        except Exception as e:
            print(f"[ERROR] fetch_threads_posts failed: {e}")
            import traceback
            traceback.print_exc()
            # Return empty list, NOT an error dict
            return []
            
        return results

    def _clean_threads_post(self, text: str, username: str) -> tuple[str, int | None, int | None]:
        """
        Clean Threads post text — remove ALL UI noise so hashing is deterministic.
        Returns a tuple: (cleaned_text, part_num, total_parts)
        """
        import re
        
        part_num = None
        total_parts = None
        
        # Clean engagement/UI tokens first so markers at the end of text aren't buried
        text = re.sub(r'Audio is muted\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Translate\s*', '', text, flags=re.IGNORECASE)
        
        # Detect multi-part markers
        match = re.search(r'(?<!\d)(\d+)\s*(?:/|of)\s*(\d+)(?!\d)', text, flags=re.IGNORECASE)
        if match:
            part_num = int(match.group(1))
            total_parts = int(match.group(2))
        else:
            match2 = re.search(r'(?<!\w)(?:part|day)\s+(\d+)(?!\d)', text, flags=re.IGNORECASE)
            if match2:
                part_num = int(match2.group(1))
            else:
                match3 = re.search(r'\(\s*(\d+)\s*\)\s*$', text)
                if match3:
                    part_num = int(match3.group(1))

        # Step 1: Remove "Follow" + username prefix
        text = re.sub(rf'(Follow\s*)?{re.escape(username)}\s*', '', text, flags=re.IGNORECASE)
        
        # Step 2: Remove ALL engagement tokens anywhere in text
        text = re.sub(r'Translate\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Like\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Reply\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Repost\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Share\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Comment\s*\d*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Audio is muted\s*', '', text, flags=re.IGNORECASE)
        
        # Step 3: Remove time+metadata block
        text = re.sub(r'\d{1,3}[hdwm]\s*(?:Edited\s*)?(?:More\s*)?', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Edited\s*(?:More\s*)?', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^More\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Verified\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Follow\s*', '', text, flags=re.IGNORECASE)
        
        # Step 4: Remove multi-part indicators
        text = re.sub(r'(?<!\d)\d+\s*(?:/|of)\s*\d+(?!\d)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'(?<!\w)(?:part|day)\s+\d+(?!\d)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\(\s*\d+\s*\)\s*$', '', text)
        
        # Step 5: Clean excessive whitespace
        text = ' '.join(text.split())
        
        return text.strip(), part_num, total_parts

    def _merge_multipart_posts(self, posts: List[Dict]) -> List[Dict]:
        """
        Merge sequential multi-part posts from the same author into single posts.
        Handles non-adjacent posts (e.g., if part 2 is pinned).
        """
        if not posts:
            return posts
            
        from datetime import datetime, timezone
        import hashlib
        
        merged_results = []
        author_groups = {}
        
        # Group posts by author
        for p in posts:
            author = p.get('author', 'Unknown')
            if author not in author_groups:
                author_groups[author] = []
            author_groups[author].append(p)
            
        def parse_dt(post):
            dt_str = post.get('datetime')
            if dt_str:
                try:
                    return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                except Exception:
                    pass
            return None

        for author, author_posts in author_groups.items():
            # Separate multipart posts from single ones
            multipart_posts = []
            single_posts = []
            
            for p in author_posts:
                if p.get('part_num') is not None:
                    multipart_posts.append(p)
                else:
                    single_posts.append(p)
                    
            # Try to build complete sequences
            # Since threads without datetimes might be tricky, we'll sort them 
            # by part_num descending, and try to find part n-1 within 5 minutes.
            # However, if one part is pinned, they might have 0-24h gap in retrieval time
            # but their authored `datetime` is close. If `datetime` is missing, 
            # we rely purely on sequential numbering.
            
            # Sort all multipart posts by part number ascending
            multipart_posts.sort(key=lambda x: x.get('part_num', 0))
            
            used_indices = set()
            clusters = []
            
            for i, p in enumerate(multipart_posts):
                if i in used_indices:
                    continue
                
                if p.get('part_num') == 1:
                    # Start a new sequence
                    current_cluster = [p]
                    used_indices.add(i)
                    
                    expected_next = 2
                    last_post = p
                    
                    # Look for subsequent parts
                    while True:
                        found_next = False
                        for j, candidate in enumerate(multipart_posts):
                            if j in used_indices:
                                continue
                                
                            if candidate.get('part_num') == expected_next:
                                # Check time difference if both have datetimes
                                dt_last = parse_dt(last_post)
                                dt_cand = parse_dt(candidate)
                                time_ok = True
                                if dt_last and dt_cand:
                                    if abs((dt_cand - dt_last).total_seconds()) > 86400: # 24 hour relax constraint
                                        # If gap > 24h, probably not the same thread, especially if same author recycles "1/2"
                                        time_ok = False
                                
                                if time_ok:
                                    current_cluster.append(candidate)
                                    used_indices.add(j)
                                    last_post = candidate
                                    expected_next += 1
                                    found_next = True
                                    break
                        
                        if not found_next:
                            break
                    
                    # Cluster built, wait. Is it complete or standalone?
                    expected_total = current_cluster[0].get('total_parts')
                    if expected_total and len(current_cluster) < expected_total:
                        is_complete = False
                    else:
                        is_complete = True
                        
                    if len(current_cluster) > 1 and is_complete:
                        clusters.append(current_cluster)
                    else:
                        # Revert usage if it didn't form a valid cluster
                        for cp in current_cluster:
                            single_posts.append(cp)
                            
            # Add any unmatched multi-part posts back to single list
            for i, p in enumerate(multipart_posts):
                if i not in used_indices:
                    single_posts.append(p)
                    
            # Merge logic for successful clusters
            for cluster in clusters:
                merged_content = "\n\n".join(p['content'] for p in cluster)
                merged_hash = hashlib.md5(merged_content.encode()).hexdigest()
                
                merged_post = cluster[0].copy()
                merged_post['content'] = merged_content
                merged_post['content_hash'] = merged_hash
                
                # Keep the date/time from the first post
                single_posts.append(merged_post)
                
            merged_results.extend(single_posts)
                
        # Sort back to newest-first across all authors
        def get_original_order(p):
            dt = parse_dt(p)
            if dt:
                return dt
            return datetime.fromtimestamp(0, timezone.utc)
            
        merged_results.sort(key=get_original_order, reverse=True)
        
        # Clean up temporary fields
        for p in merged_results:
            p.pop('part_num', None)
            p.pop('total_parts', None)
            p.pop('datetime', None)
            
        return merged_results


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
