import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
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
        await page.click('text=新しく始める'); await page.click('[data-id="kashima"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="startClub"]'); await page.wait_for_timeout(400)
        # --- scroll lock check on the slot sheet
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        await page.evaluate('window.scrollTo(0, 120)'); await page.wait_for_timeout(100)
        y0 = await page.evaluate('window.scrollY')
        await page.click('.tok >> nth=5'); await page.wait_for_timeout(400)
        st = await page.evaluate('[document.body.style.position, document.body.style.top]')
        box = await page.locator('#sheet .sheet-body').bounding_box()
        await page.mouse.move(box['x'] + 100, box['y'] + 200)
        for _ in range(12): await page.mouse.wheel(0, 400); await page.wait_for_timeout(30)
        inner = await page.evaluate('document.querySelector("#sheet .sheet-body").scrollTop')
        during = await page.evaluate('[window.scrollY, document.body.getBoundingClientRect().top]')
        await page.screenshot(path=str(OUT/'d-slot-scrolled.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(350)
        y1 = await page.evaluate('window.scrollY')
        print('scroll before', y0, 'lock', st, 'sheet scrolled', inner, 'page during', during, 'after close', y1)
        # --- development view
        await page.click('[data-tab="squad"]'); await page.click('[data-act="sqView"][data-k="dev"]'); await page.wait_for_timeout(250)
        await page.screenshot(path=str(OUT/'d-devview.png'))
        await page.click('[data-act="train"] >> nth=1'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="setTf"][data-k="shoot"]'); await page.wait_for_timeout(150)
        await page.click('#sheet [data-act="setTi"][data-k="hard"]'); await page.wait_for_timeout(150)
        await page.click('#sheet [data-act="setLearn"] >> nth=1'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'d-train.png'))
        await page.evaluate('document.querySelector("#sheet .sheet-body").scrollTop = 2000'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'d-train2.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # advance a few weeks
        for i in range(5):
            await page.click('[data-act="go"]'); await page.wait_for_timeout(200)
            if await page.locator('#sheet [data-act="quick"]').count():
                await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(200); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(150)
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'d-devview2.png'))
        await page.click('[data-act="sqView"][data-k="list"]'); await page.click('.prow >> nth=8'); await page.wait_for_timeout(400)
        await page.screenshot(path=str(OUT/'d-player.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # --- migrate an old (v1) save: strip attribute data and reload
        await page.evaluate('''() => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3))); for (const p of Object.values(st.players)) { delete p.at; delete p.at0; delete p.ovr0; delete p.tf; delete p.ti; delete p.learn; } st.v = 1; localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''')
        await page.reload(); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        await page.click('[data-tab="squad"]'); await page.click('[data-act="sqView"][data-k="dev"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="train"] >> nth=0'); await page.wait_for_timeout(300)
        ok = await page.locator('#sheet .attr').count()
        print('migrated save attr rows', ok)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
