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
        
        # -> Open the “Admission Assistance” page from the home page.
        # Admission Assistance Free counselling to plan... link
        elem = page.get_by_role("link", name="Admission Assistance Free")
        await elem.click(timeout=10000)
        
        # -> Inspect the available course options in the required course-of-interest field.
        # [internal] get_dropdown_options: index=
        
        # -> Choose Bachelor of Technology in Computer Science as the course of interest.
        # Select a course Bachelor of Arts Bachelor of... dropdown
        elem = page.locator("xpath=/html/body/main/section/div/div[2]/form/div[4]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill the admission enquiry name, mobile, email, and message fields with valid test details.
        # e.g. Rahul Sharma text field
        elem = page.get_by_role("textbox", name="Full name *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Aarav Sharma")
        
        # -> Fill the admission enquiry name, mobile, email, and message fields with valid test details.
        # 10-digit mobile number text field
        elem = page.get_by_role("textbox", name="Mobile *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("9876543210")
        
        # -> Fill the admission enquiry name, mobile, email, and message fields with valid test details.
        # you@example.com email field
        elem = page.get_by_role("textbox", name="Email (optional)")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("aarav.sharma@example.com")
        
        # -> Fill the admission enquiry name, mobile, email, and message fields with valid test details.
        # Tell us about your goals or questions text area
        elem = page.get_by_role("textbox", name="Message (optional)")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("I would like guidance about admission requirements, eligibility, and application timelines.")
        
        # -> Inspect the available state choices for the required state field.
        # [internal] get_dropdown_options: index=
        
        # -> Set the preferred state to Karnataka and review the form after the state selection.
        # Select your state Andaman and Nicobar Islands... dropdown
        elem = page.locator("xpath=/html/body/main/section/div/div[2]/form/div[6]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select “I am 18 or older” and accept the consent checkbox on the admission enquiry form.
        # enq-age radio button
        elem = page.get_by_role("radio", name="I am 18 or older")
        await elem.click(timeout=10000)
        
        # -> Select “I am 18 or older” and accept the consent checkbox on the admission enquiry form.
        # consent checkbox
        elem = page.get_by_role("checkbox", name="I consent to Padhaanewala")
        await elem.click(timeout=10000)
        
        # -> Submit the completed admission enquiry and check for a visible success confirmation.
        # Submit enquiry button
        elem = page.get_by_role("button", name="Submit enquiry")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A success confirmation appears after the admission enquiry is submitted.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The admission enquiry success confirmation is visible.
        await expect(page.locator("xpath=/html/body/div[3]/button[1]").nth(0)).to_contain_text("Enquiry submitted", timeout=15000), "The admission enquiry success confirmation is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    