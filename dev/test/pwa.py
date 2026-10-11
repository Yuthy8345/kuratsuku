import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1) old (artifact) build: start a game, play a little, make a transfer code
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True)
        pg = await ctx.new_page()
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await pg.route('https://**/*', route)
        await pg.goto('file://' + str(ROOT/'test/page.html')); await pg.wait_for_timeout(300)
        await pg.click('text=新しく始める'); await pg.click('[data-id="yokohamafm"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="startClub"]'); await pg.wait_for_timeout(300)
        for i in range(3):
            await pg.click('[data-act="go"]'); await pg.wait_for_timeout(150)
            if await pg.locator('#sheet .card.alert').count():
                await pg.click('#sheet [data-act="toTactics"]'); await pg.wait_for_timeout(250); await pg.click('[data-act="autoXI"]'); await pg.wait_for_timeout(200)
                await pg.click('[data-act="go"]'); await pg.wait_for_timeout(300)
            if await pg.locator('#sheet [data-act="quick"]').count():
                await pg.click('#sheet [data-act="quick"]'); await pg.wait_for_timeout(150); await pg.click('[data-act="mClose"]'); await pg.wait_for_timeout(120)
        await pg.click('[data-tab="club"]'); await pg.wait_for_timeout(150)
        await pg.click('[data-act="exportOpen"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT/'x-export.png'))
        code = await pg.input_value('#exp-code')
        date_old = await pg.evaluate("document.querySelector('.hdr-date strong').textContent")
        print('code length', len(code), code[:12], 'old date', date_old)
        await ctx.close()
        # 2) the home-screen app on a real http origin
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(1200)
        sw = await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => !!(r && (r.active || r.installing || r.waiting)))")
        man = await pg.evaluate("fetch('manifest.webmanifest').then(r => r.json()).then(j => j.name + ' / ' + j.display + ' / icons ' + j.icons.length)")
        touch = await pg.evaluate("document.querySelector('link[rel=apple-touch-icon]').href")
        title = await pg.title()
        print('SW', sw, '| manifest', man, '| title', title, '| touch icon', touch)
        await pg.click('[data-act="importOpen"]'); await pg.wait_for_timeout(400)
        await pg.fill('#imp-code', code); await pg.wait_for_timeout(100)
        await pg.screenshot(path=str(OUT/'x-import.png'))
        await pg.click('[data-act="doImport"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT/'x-imported-title.png'))
        date_new = await pg.evaluate("document.querySelector('.hdr-date strong').textContent")
        club = await pg.evaluate("document.querySelector('.hdr-club b').textContent")
        print('restored', club, date_new, 'same date', date_new == date_old)
        # bad code is rejected politely
        await pg.click('[data-tab="club"]'); await pg.click('[data-act="importOpen"]'); await pg.wait_for_timeout(300)
        await pg.fill('#imp-code', 'KTK1.lz:garbage'); await pg.click('[data-act="doImport"]'); await pg.wait_for_timeout(200)
        print('bad code msg:', await pg.text_content('#imp-msg'))
        await pg.click('#sheet [data-act="closeSheet"]'); await pg.wait_for_timeout(300)
        # 3) offline launch
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(800)
        ok = await pg.evaluate("!!document.querySelector('.title h1') && document.querySelector('.title h1').textContent")
        print('offline reload title:', ok)
        await pg.screenshot(path=str(OUT/'x-offline.png'))
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
