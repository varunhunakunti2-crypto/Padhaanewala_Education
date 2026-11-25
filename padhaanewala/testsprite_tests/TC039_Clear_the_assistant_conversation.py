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
        
        # -> Open the AI assistant using the visible “Ask AI Assistant” link.
        # Ask AI Assistant link
        elem = page.get_by_role("link", name="Ask AI Assistant")
        await elem.click(timeout=10000)
        
        # -> Enter a non-empty question in the assistant message field and inspect the available send action.
        # Type your question text field
        elem = page.get_by_role("textbox", name="Type your question")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What are some factors to consider when choosing a college?")
        
        # -> Enter a non-empty question in the assistant’s message field and inspect the send action.
        # Type your question text field
        elem = page.get_by_role("textbox", name="Type your question")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("What are some factors to consider when choosing a college?")
        
        # -> Send the entered question using the chat’s Send button.
        # Send button
        elem = page.get_by_role("button", name="Send")
        await elem.click(timeout=10000)
        
        # -> Click “New conversation” to clear the transcript, then verify the chat is empty and ready for a new message.
        # New conversation button
        elem = page.get_by_role("button", name="New conversation")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The conversation reset to its initial greeting after the prior exchange was cleared.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The initial assistant greeting is visible after the conversation is reset.
        await expect(page.locator("section").nth(0)).to_contain_text("Namaste! I'm Padhaanewala AI", timeout=15000), "The initial assistant greeting is visible after the conversation is reset."
        
        # --> The chat input is empty and ready for a new message.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The chat input is empty and ready for a new message.
        await expect(page.get_by_role("textbox", name="Type your question").nth(0)).to_have_value("", timeout=15000), "The chat input is empty and ready for a new message."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    