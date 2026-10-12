import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
html = (ROOT/'dist/touchline.html').read_text()
(ROOT/'test/page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await pg.route('https://**/*', route)
        await pg.goto('file://' + str(ROOT/'test/page.html')); await pg.wait_for_timeout(300)
        await pg.click('text=新しく始める'); await pg.click('[data-id="yokohamafm"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="nameClub"]'); await pg.wait_for_timeout(250); await pg.click('#sheet [data-act="startClub"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="go"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-act="kickoff"]'); await pg.wait_for_timeout(300)
        cv = pg.locator('#cv')
        for i in range(6):
            await pg.wait_for_timeout(1300)
            await cv.screenshot(path=str(OUT/f'm2d-{i}.png'))
        # watch until full time at x2 and make sure it finishes and the score matches
        await pg.click('[data-act="mSpeed"]')
        import time; t0 = time.time(); ht = None
        for _ in range(400):
            await pg.wait_for_timeout(500)
            if await pg.locator('[data-act="m2nd"]').count():
                ht = round(time.time() - t0); await pg.screenshot(path=str(OUT/'m2d-ht.png')); await pg.click('[data-act="m2nd"]')
            if await pg.locator('[data-act="mResult"]').count(): break
        print('x2: half time after', ht, 's, full time after', round(time.time() - t0), 's')
        sb = await pg.text_content('#sb-score'); clock = await pg.text_content('#sb-clock')
        await pg.screenshot(path=str(OUT/'m2d-ft.png'))
        await pg.click('[data-act="mResult"]'); await pg.wait_for_timeout(400)
        final = await pg.text_content('#sb-score')
        print('at full time board', sb, clock, '| result', final, '| match', sb == final)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
