# 交代の頻度 (少なめ・ふつう・多め): shown only while 交代はおまかせ is on, on the tactics screen and in the in-match 采配 sheet,
# saved in the save, and old saves (no setting) show ふつう. (How many changes each makes: test/subrate.js)
import asyncio, pathlib, os, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'dotgothic16/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
async def main():
    css = font_css(); bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        async def route(r):
            u = r.request.url
            if 'lz-string' in u: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            elif 'fonts.googleapis.com' in u and css: await r.fulfill(status=200, content_type='text/css', body=css)
            elif 'fonts.gstatic.com/fs/' in u:
                fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one', 'dotgothic16'] if fn.startswith(x))
                await r.fulfill(status=200, content_type='font/woff2', body=(FONTS/fam/'files'/fn).read_bytes())
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="okayama"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(250)
        async def state(scope=''):  # in a match the tactics screen is still under the overlay, so look inside the sheet
            btns = await page.locator(f'{scope} [data-act="subRate"]'.strip()).all()
            pressed = [await x.inner_text() for x in btns if await x.get_attribute('aria-pressed') == 'true']
            return len(btns), pressed
        n, pr = await state(); print('tactics: buttons', n, 'pressed', pr); bad += [] if n == 3 and pr == ['ふつう'] else ['default']
        await page.click('[data-act="subRate"][data-k="high"]'); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD); n, pr = await state()
        desc = await page.locator('[data-act="subRate"][data-k="high"]').locator('xpath=ancestor::div[contains(@class,"ctlrow")]').locator('.fine').inner_text()
        print('picked 多め: saved', st['settings']['subRate'], '| pressed', pr, '|', desc); bad += [] if st['settings']['subRate'] == 'high' and pr == ['多め'] else ['pick']
        await page.locator('[data-act="subRate"]').first.scroll_into_view_if_needed(); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'sr-tactics.png'))
        await page.click('[data-act="autoSubs"]'); await page.wait_for_timeout(250)
        n, _ = await state(); print('おまかせ off -> buttons', n); bad += [] if n == 0 else ['hidden when off']
        await page.click('[data-act="autoSubs"]'); await page.wait_for_timeout(250)
        n, pr = await state(); print('back on ->', n, pr); bad += [] if n == 3 and pr == ['多め'] else ['kept']
        # in the match: 采配 sheet has it too, and a change there sticks
        for i in range(10):
            if await page.locator('#sheet.on [data-act="kickoff"]').count(): break
            if await page.locator('#sheet.on [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(250)
            await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="kickoff"]'); await page.wait_for_timeout(600)
        await page.click('[data-act="mTac"]'); await page.wait_for_timeout(400)
        n, pr = await state('#sheet'); print('采配 sheet:', n, pr); bad += [] if n == 3 and pr == ['多め'] else ['match sheet']
        await page.click('#sheet [data-act="subRate"][data-k="low"]'); await page.wait_for_timeout(300)
        n, pr = await state('#sheet'); st = await page.evaluate(LOAD)
        print('changed in match -> pressed', pr, 'saved', st['settings']['subRate']); bad += [] if pr == ['少なめ'] and st['settings']['subRate'] == 'low' else ['match change']
        await page.screenshot(path=str(OUT/'sr-match.png'))
        # an old save without the setting shows ふつう
        await page.goto('about:blank')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''() => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          delete st.settings.subRate; st.match = null; localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''')
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(500)
        if await page.locator('[data-act="continue"]').count(): await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        if await page.locator('[data-tab="tactics"]').count():
            await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(250)
            n, pr = await state(); print('old save ->', pr); bad += [] if pr == ['ふつう'] else ['old save']
        else: print('old save: not on the club screen (match in progress?)')
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
