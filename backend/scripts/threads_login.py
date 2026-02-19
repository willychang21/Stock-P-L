"""
Threads Login Helper — saves session cookies for the scraper.
Run this once to login to Threads via browser, then the scraper will use the saved session.
"""
import asyncio
from playwright.async_api import async_playwright

SESSION_PATH = "/tmp/threads_session"

async def main():
    print("🔐 Threads Login Helper")
    print("=" * 50)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )

        page = await context.new_page()

        # Step 1: Navigate to login page
        print("[1/5] Navigating to login page...")
        try:
            await page.goto("https://www.threads.net/login", wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"[WARN] Navigation: {e}")

        await asyncio.sleep(2)  # Let React hydrate

        # Step 2: Auto-fill login form using type() for human-like input
        login_submitted = False
        try:
            print("[2/5] Looking for login fields...")
            await page.wait_for_selector('input[type="text"], input[name="username"]', timeout=15000)

            # Click on username field first, then type character by character
            user_input = page.locator('input[type="text"], input[name="username"]').first
            await user_input.click()
            await asyncio.sleep(0.5)
            await user_input.type("goose.2378392", delay=50)  # 50ms between chars
            print("[2/5] ✅ Typed username")

            await asyncio.sleep(0.5)

            # Click on password field, then type
            pass_input = page.locator('input[type="password"]').first
            await pass_input.click()
            await asyncio.sleep(0.5)
            await pass_input.type("cugjYm-kovgir-wobwy3", delay=50)
            print("[2/5] ✅ Typed password")

            await asyncio.sleep(1)

            # Submit login - try multiple methods
            print("[3/5] Submitting login...")
            
            # Method 1: Try clicking visible "Log in" / "登入" button
            try:
                login_btn = page.locator('div[role="button"]:has-text("登入"), div[role="button"]:has-text("Log in"), button:has-text("登入"), button:has-text("Log in")').first
                if await login_btn.count() > 0:
                    await login_btn.click()
                    print("[3/5] ✅ Clicked login button!")
                else:
                    raise Exception("No visible login button found")
            except Exception:
                # Method 2: Press Enter on password field
                print("[3/5] Pressing Enter to submit...")
                await pass_input.press("Enter")
                print("[3/5] ✅ Enter pressed!")
            
            login_submitted = True

        except Exception as e:
            print(f"[WARN] Auto-login failed: {e}")
            print("\n👉 Please login MANUALLY in the browser window.")
            print("   After you see the home feed, come back here and press Enter.")
            input("Press Enter after manual login...")
            login_submitted = True

        # Step 4: Wait for login to process
        if login_submitted:
            print("[4/5] Waiting for login to complete (15s)...")
            await asyncio.sleep(15)

            # Navigate to a Threads profile page to verify & get cookies
            print("[4/5] Navigating to threads.net profile to verify...")
            try:
                await page.goto("https://www.threads.net/@okaneinu", wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"[WARN] Navigation: {e}")

            current_url = page.url
            print(f"[4/5] Current URL: {current_url}")

        # Step 5: Save session
        await context.storage_state(path=SESSION_PATH)
        print(f"\n[5/5] ✅ Session saved to: {SESSION_PATH}")
        print("     Scraper is ready! Restart backend and try auto-track.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
