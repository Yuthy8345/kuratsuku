# 逃げ切りはおまかせ: the switch on the 戦術 sheet (off by default, saved, shown on the 戦術 plate), and in a live match
# (leading after 75': the feed says so, the 采配 sheet shows 守備的・ライン低い・時間を使う and 「いま逃げ切り中」; changing the
# posture himself stops it for the match and the switch shows off; turning it on again restarts it). The lead is forced by
# wrapping Engine.stepMatch (1-0 to my side from the 73rd to the 85th minute). How much it helps: test/closeout.js
import asyncio, pathlib, os, re, time
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'dotgothic16/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
FORCE = '''() => { const E = window.Engine, orig = E.stepMatch;
  E.stepMatch = (S, M) => { if (M.userSide && M.min >= 72 && M.min < 85) { const my = M.userSide === 'h'; M.hg = my ? 1 : 0; M.ag = my ? 0 : 1; } return orig(S, M); }; }'''
async def main():
    css = font_css(); bad = []
    def check(cond, msg):
        print(('ok   ' if cond else 'FAIL ') + msg)
        if not cond: bad.append(msg)
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
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(250)
        plate = await page.locator('.plancard').inner_text()
        check('逃げ切り' not in plate, 'plate: no 逃げ切り row while off')
        await page.click('.plancard'); await page.wait_for_timeout(400)
        tg = page.locator('#sheet [data-act="closeOut"]')
        check(await tg.count() == 1 and await tg.get_attribute('aria-checked') == 'false', '戦術 sheet: switch there, off by default')
        await tg.click(); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD)
        check(st['settings'].get('closeOut') is True and await tg.get_attribute('aria-checked') == 'true', 'turned on: saved')
        await tg.scroll_into_view_if_needed(); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'close-plan.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        plate = await page.locator('.plancard').inner_text()
        check('逃げ切り' in plate and 'おまかせ' in plate, 'plate: 逃げ切り おまかせ')
        await page.locator('.plancard').screenshot(path=str(OUT/'close-plate.png'))
        ment0 = st['clubs'][st['my']]['tac']['ment']
        # live match with the lead forced
        await page.evaluate(FORCE)
        for i in range(10):
            if await page.locator('#sheet.on [data-act="kickoff"]').count(): break
            if await page.locator('#sheet.on [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(250)
            await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="kickoff"]'); await page.wait_for_timeout(500)
        await page.click('[data-act="mSpeed"]'); await page.click('[data-act="mSpeed"]')
        t0 = time.time(); minute = 0
        while time.time() - t0 < 60:
            await page.wait_for_timeout(150)
            if await page.locator('[data-act="m2nd"]').count(): await page.click('[data-act="m2nd"]'); continue
            m = re.match(r"(\d+)'", await page.locator('#sb-clock').inner_text())
            minute = int(m.group(1)) if m else minute
            if minute >= 79: break
        await page.click('[data-act="mTac"]'); await page.wait_for_timeout(400)
        feed = await page.locator('#feed').inner_text()
        check('【逃げ切り】守備的・ライン低い・時間を使う に切り替え' in feed and "75'" in feed, f'feed at {minute}\': the switch at 75\'')
        tg = page.locator('#sheet [data-act="closeOut"]')
        txt = await tg.inner_text()
        pressed = lambda sel: page.locator(f'#sheet {sel}[aria-pressed="true"]').count()
        check(await tg.get_attribute('aria-checked') == 'true' and 'いま逃げ切り中' in txt, '采配 sheet: on, 「いま逃げ切り中」')
        check(await pressed('[data-act="mMent"][data-k="def"]') == 1 and await pressed('[data-key="line"][data-k="low"]') == 1
              and await page.locator('#sheet [data-key="kill"]').get_attribute('aria-checked') == 'true', '采配 sheet shows 守備的・ライン低い・時間を使う')
        await tg.scroll_into_view_if_needed(); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'close-match.png'))
        await page.locator('#sheet [data-act="mMent"]').first.scroll_into_view_if_needed()
        await page.click('#sheet [data-act="mMent"][data-k="att"]'); await page.wait_for_timeout(300)
        tg = page.locator('#sheet [data-act="closeOut"]'); txt = await tg.inner_text()
        check(await tg.get_attribute('aria-checked') == 'false' and '自分で変えた' in txt, 'changed the posture himself: stopped for this match')
        st = await page.evaluate(LOAD)
        check(st['settings'].get('closeOut') is True, '...but the setting itself stays on')
        await tg.scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'close-stopped.png'))
        await tg.click(); await page.wait_for_timeout(300)
        tg = page.locator('#sheet [data-act="closeOut"]')
        check(await tg.get_attribute('aria-checked') == 'true', 'tapped again: on')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(120)
        await page.click('[data-act="mTac"]'); await page.wait_for_timeout(400)
        txt = await page.locator('#sheet [data-act="closeOut"]').inner_text()
        check('いま逃げ切り中' in txt and await pressed('[data-act="mMent"][data-k="def"]') == 1, 'a minute later: 逃げ切り again')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # ×4 is 50 ms a minute: the last minutes can run out while the sheets open and close (2026-10-16) → skip or the result
        await page.evaluate('''() => (document.querySelector('[data-act="mSkip"]') || document.querySelector('[data-act="mResult"]')).click()''')
        await page.wait_for_timeout(800)
        st = await page.evaluate(LOAD)
        check(st['clubs'][st['my']]['tac']['ment'] == ment0, "after the match the club's own plan is unchanged")
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
