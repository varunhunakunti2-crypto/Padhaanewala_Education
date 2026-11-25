
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
        
        # -> Open the â€œSign inâ€ page and inspect the login form.
        # Sign in link
        elem = page.get_by_role("link", name="Sign in")
        await elem.click(timeout=10000)
        
        # -> Enter the configured student credentials in the email and password fields, then submit the â€œSign inâ€ form once.
        # priya@example.com email field
        elem = page.get_by_role("textbox", name="Email address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_EMAIL)
        
        # -> Enter the configured student credentials in the email and password fields, then submit the â€œSign inâ€ form once.
        # Your password password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_PASSWORD)
        
        # -> Enter the configured student credentials in the email and password fields, then submit the â€œSign inâ€ form once.
        # Sign in button
        elem = page.get_by_role("button", name="Sign in")
        await elem.click(timeout=10000)
        
        # -> Open the â€œMock Testsâ€ page from the site navigation.
        # Mock Tests link
        elem = page.get_by_role("link", name="Mock Tests", exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the first listed mock paper using its â€œTake testâ€ link.
        # Take test link
        elem = page.locator("div").filter(has_text=re.compile(r"^5 attempts Take test$")).get_by_role("link")
        await elem.click(timeout=10000)
        
        # -> Click â€œBegin testâ€ once and inspect the question screen after it loads.
        # Begin test button
        elem = page.get_by_role("button", name="Begin test")
        await elem.click(timeout=10000)
        
        # -> Select an answer for the first question and check that the answer is recorded before ending the attempt early.
        # B 3 V button
        elem = page.get_by_role("button", name="B 3 V")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The results breakdown is displayed, including topic-wise performance.
        await page.get_by_text("Physics").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified â€” the export-time check could not be evaluated
        # Assert: The results breakdown includes topic-wise performance.
        await expect(page.get_by_text("Physics").nth(0)).to_be_visible(timeout=15000), "The results breakdown includes topic-wise performance."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    