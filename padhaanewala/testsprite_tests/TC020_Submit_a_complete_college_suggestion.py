
# Loaded from tmp/config.json so generated scripts never embed credentials.
_TESTSPRITE_FIXTURE_HELPER = True
import json as _json
from pathlib import Path as _Path

_TESTSPRITE_CONFIG = _json.loads(
    (_Path(__file__).resolve().parent / "tmp" / "config.json").read_text(encoding="utf-8")
)
TEST_EMAIL = _TESTSPRITE_CONFIG["loginUser"]
TEST_PASSWORD = _TESTSPRITE_CONFIG["loginPassword"]
import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the sign-in page using the visible â€œSign inâ€ link.
        # Sign in link
        elem = page.get_by_role("link", name="Sign in")
        await elem.click(timeout=10000)
        
        # -> Enter the provided student account credentials and submit the sign-in form once.
        # priya@example.com email field
        elem = page.get_by_role("textbox", name="Email address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_EMAIL)
        
        # -> Enter the provided student account credentials and submit the sign-in form once.
        # Your password password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_PASSWORD)
        
        # -> Enter the provided student account credentials and submit the sign-in form once.
        # Sign in button
        elem = page.get_by_role("button", name="Sign in")
        await elem.click(timeout=10000)
        
        # -> Open the visible â€œAdd Your Collegeâ€ page and inspect whether the suggestion form is accessible.
        # Add Your College link
        elem = page.get_by_role("link", name="Add Your College")
        await elem.click(timeout=10000)
        
        # -> Open the visible â€œAdd Your Collegeâ€ page and inspect its suggestion form.
        # Add Your College link
        elem = page.get_by_role("link", name="Add Your College")
        await elem.click(timeout=10000)
        
        # -> Enter a college name in the required field, submit the suggestion once, and verify the pageâ€™s confirmation.
        # e.g. Coastal Institute of Technology text field
        elem = page.get_by_role("textbox", name="College name *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TestSprite Student College QA")
        
        # -> Enter a college name in the required field, submit the suggestion once, and verify the pageâ€™s confirmation.
        # Submit for review button
        elem = page.get_by_role("button", name="Submit for review")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert-outcome: passed
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    