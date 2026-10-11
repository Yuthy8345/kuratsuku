import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click('[data-id="okayama"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="startClub"]'); await page.wait_for_timeout(350)
        # sell attempt: list a player
        await page.click('[data-tab="squad"]'); await page.click('.prow >> nth=5'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="toggleList"]'); await page.wait_for_timeout(200)
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        n = 0; offers = 0
        for i in range(140):
            await page.click('[data-act="go"]'); await page.wait_for_timeout(120)
            if await page.locator('#sheet .card.alert').count():
                await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(250); await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
                await page.click('[data-act="go"]'); await page.wait_for_timeout(300)
            if await page.locator('#sheet [data-act="quick"]').count():
                await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(150)
                await page.click('[data-act="mClose"]'); await page.wait_for_timeout(100); n += 1
            elif await page.locator('[data-act="offerNo"]').count():
                offers += 1
                if offers == 1: await page.screenshot(path=str(OUT/'s-offer.png'))
                await page.click('[data-act="offerNo"] >> nth=0'); await page.wait_for_timeout(100)
            elif await page.locator('#sheet [data-act="nextSeason"]').count():
                await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/'s-seasonend.png')); break
            elif await page.locator('#sheet [data-act="job"]').count():
                await page.screenshot(path=str(OUT/'s-fired-mid.png')); await page.click('#sheet [data-act="job"] >> nth=0'); await page.wait_for_timeout(200)
        print('matches', n, 'offers', offers)
        await page.click('#sheet [data-act="nextSeason"]'); await page.wait_for_timeout(600)
        await page.screenshot(path=str(OUT/'s-newseason.png'))
        if await page.locator('#sheet [data-act="job"]').count():
            await page.click('#sheet [data-act="job"] >> nth=0'); await page.wait_for_timeout(300)
            await page.screenshot(path=str(OUT/'s-newjob.png'))
        await page.click('[data-tab="club"]'); await page.click('[data-act="clView"][data-k="records"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'s-records.png'))
        await page.reload(); await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT/'s-title-reload.png'))
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
