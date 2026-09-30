import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        print("Navigating to map...")
        await page.goto('http://localhost:5174/')
        await page.wait_for_timeout(3000)
        await page.screenshot(path='/home/kakarot/.gemini/antigravity-ide/brain/d64b0a3a-5ea0-4c0f-b140-0735417b8b08/geovista_map.png')
        
        print("Switching to Analytics tab...")
        await page.evaluate("document.querySelectorAll('.tab-btn')[1].click()")
        await page.wait_for_timeout(3000)
        await page.screenshot(path='/home/kakarot/.gemini/antigravity-ide/brain/d64b0a3a-5ea0-4c0f-b140-0735417b8b08/geovista_analytics.png')
        
        await browser.close()

asyncio.run(main())
