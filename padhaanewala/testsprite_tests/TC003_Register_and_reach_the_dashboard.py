
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
        
        # -> Open the account flow using the visible â€œGet Startedâ€ link.
        # Get Started link
        elem = page.get_by_role("link", name="Get Started")
        await elem.click(timeout=10000)
        
        # -> Open the registration flow using the visible â€œGet Startedâ€ link.
        # Get Started link
        elem = page.get_by_role("link", name="Get Started")
        await elem.click(timeout=10000)
        
        # -> Complete the visible account-creation form with valid-looking new-user details and select the 18-or-older option.
        # 10-digit mobile number tel field
        elem = page.get_by_role("textbox", name="Mobile number")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("9876543210")
        
        # -> Complete the visible account-creation form with valid-looking new-user details and select the 18-or-older option.
        # priya@example.com email field
        elem = page.get_by_role("textbox", name="Email address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("qa.student.20261122@example.com")
        
        # -> Complete the visible account-creation form with valid-looking new-user details and select the 18-or-older option.
        # Min. 8 characters password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_PASSWORD)
        
        # -> Complete the visible account-creation form with valid-looking new-user details and select the 18-or-older option.
        # I am 18 or older
        elem = page.get_by_text("I am 18 or older")
        await elem.click(timeout=10000)
        
        # -> Enter a full name in the registration form and submit it with the visible â€œCreate accountâ€ button.
        # Priya Sharma text field
        elem = page.get_by_role("textbox", name="Full name")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("QA Student")
        
        # -> Enter a full name in the registration form and submit it with the visible â€œCreate accountâ€ button.
        # Create account button
        elem = page.get_by_role("button", name="Create account")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The new account landed on the student dashboard.
        # Assert-outcome: not verified â€” the export-time check could not be evaluated
        # Assert: The page URL includes /dashboard.
        await expect(page).to_have_url(re.compile("/dashboard"), timeout=15000), "The page URL includes /dashboard."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    