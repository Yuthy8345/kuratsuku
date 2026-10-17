# フロントの厳しさ: the switch on the club screen (ふつう by default and for old saves, saved when changed) and the warning
# on the home screen when the board's confidence is low. (Rules and firing: test/board.js)
import asyncio, pathlib, os, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        async def club():
            await page.click('[data-tab="club"]'); await page.wait_for_timeout(150)
            await page.click('[data-act="clView"][data-k="main"]'); await page.wait_for_timeout(200)
        async def pressed(): return [await x.inner_text() for x in await page.locator('[data-act="boardLv"][aria-pressed="true"]').all()]
        await club(); pr = await pressed(); print('default:', pr); bad += [] if pr == ['ふつう'] else ['default']
        await page.click('[data-act="boardLv"][data-k="hard"]'); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD); pr = await pressed(); sub = await page.locator('[data-act="boardLv"]').first.locator('xpath=ancestor::div[contains(@class,"ctlrow")]').locator('.fine').inner_text()
        print('picked:', pr, '| saved', st['settings'].get('boardLv'), '|', sub); bad += [] if pr == ['きびしい'] and st['settings'].get('boardLv') == 'hard' else ['pick']
        await page.locator('[data-act="boardLv"]').first.scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'board-club.png'))
        # an old save without the setting, with low confidence: ふつう + the warning on the home screen
        async def edit(js):   # change the save while the game page is away (it saves when it leaves)
            await page.goto('about:blank')
            ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
            await ed.evaluate("() => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3))); " + js + "; localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }")
            await ed.close()
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(500)
            await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        async def home_card():
            card = page.locator('section.card', has_text='フロントの信頼').first
            return card, (await card.inner_text()).replace('\n', ' | ')
        # ふつう's first season at a club has no firing but relegation (2026-10-18: no mid-season firing), so the warning says
        # the grace is this season only
        await edit('delete st.settings.boardLv; st.board = 12')
        card, txt = await home_card(); print('home (1年目):', txt); bad += [] if '猶予' in txt and '解任の危機' not in txt else ['home alert (grace)']
        await club(); pr = await pressed(); print('old save:', pr); bad += [] if pr == ['ふつう'] else ['old save']
        # the second season at the club: the end of the season can fire
        await edit("st.history = [{ season: '2026/27', club: st.my, pos: 15, pts: 40, champ: 'kashima', verdict: 'missed' }]")
        card, txt = await home_card(); print('home (2年目):', txt); bad += [] if '解任の危機' in txt else ['home alert']
        await card.scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'board-home.png'))
        # やさしい (2026-10-18): only relegation fires, so no warning on the home screen even with low confidence
        await club()
        await page.click('[data-act="boardLv"][data-k="easy"]'); await page.wait_for_timeout(250)
        sub = await page.locator('[data-act="boardLv"]').first.locator('xpath=ancestor::div[contains(@class,"ctlrow")]').locator('.fine').inner_text()
        print('easy:', sub); bad += [] if '降格のときだけ' in sub else ['easy sub']
        await page.click('[data-tab="home"]'); await page.wait_for_timeout(300)
        card, txt = await home_card(); print('home (easy):', txt)
        bad += [] if '解任' not in txt and '不安視' not in txt else ['easy home alert']
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
