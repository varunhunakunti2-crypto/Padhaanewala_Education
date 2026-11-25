
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
        
        # -> Enter the provided student email and password, then submit the â€œSign inâ€ form.
        # priya@example.com email field
        elem = page.get_by_role("textbox", name="Email address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_EMAIL)
        
        # -> Enter the provided student email and password, then submit the â€œSign inâ€ form.
        # Your password password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill(TEST_PASSWORD)
        
        # -> Enter the provided student email and password, then submit the â€œSign inâ€ form.
        # Sign in button
        elem = page.get_by_role("button", name="Sign in")
        await elem.click(timeout=10000)
        
        # -> Open the Mock Tests catalog from the dashboard navigation.
        # Mock Tests link
        elem = page.get_by_label("Primary").get_by_role("link", name="Mock Tests")
        await elem.click(timeout=10000)
        
        # -> Start â€œHardcore JEE Mock Test â€” Paper 2â€ using its â€œTake testâ€ button and verify the attempt interface appears.
        # Take test link
        elem = page.locator("div").filter(has_text=re.compile(r"^5 attempts Take test$")).get_by_role("link")
        await elem.click(timeout=10000)
        
        # -> Click â€œBegin testâ€ to start the mock test and verify the attempt interface is displayed.
        # Begin test button
        elem = page.get_by_role("button", name="Begin test")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The active mock test attempt interface is displayed.
        await page.locator("xpath=/html/body/main/div/div[2]/div[1]/div[2]/button").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified â€” the export-time check could not be evaluated
        # Assert: The active attemptâ€™s Submit button is visible.
        await expect(page.locator("xpath=/html/body/main/div/div[2]/div[1]/div[2]/button").nth(0)).to_be_visible(timeout=15000), "The active attempt\u2019s Submit button is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    