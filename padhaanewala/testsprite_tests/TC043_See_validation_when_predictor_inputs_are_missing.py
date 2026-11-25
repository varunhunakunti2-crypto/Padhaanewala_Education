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
        
        # -> Open the College Predictor page and inspect the course step and its available controls.
        await page.goto("http://localhost:3000/college-predictor")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click “Next” on the empty course step and verify the validation message remains visible without any predicted colleges.
        # Next button
        elem = page.get_by_role("button", name="Next")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Submitting the empty course step marks the course selector invalid.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The course selector should be marked invalid after an empty submission.
        await expect(page.get_by_label("Which course are you").nth(0)).to_have_attribute("aria-invalid", "true", timeout=15000), "The course selector should be marked invalid after an empty submission."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    