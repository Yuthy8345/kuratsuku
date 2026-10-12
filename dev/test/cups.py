# Cups (天皇杯・Lカップ), special matches (derby / players on fire), counter tactics, scouting
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
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
        await page.click('text=新しく始める'); await page.click('[data-id="mito"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        # cup view
        await page.click('[data-tab="league"]'); await page.click('[data-act="lgView"][data-k="cups"]'); await page.wait_for_timeout(250)
        await page.screenshot(path=str(OUT/'c-ec.png'))
        print('ec rounds', await page.locator('.sec-h').count(), '| ties', await page.locator('[data-act="fxDetail"]').count())
        await page.click('[data-act="cupPick"][data-k="lc"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'c-lc.png'))
        # counter tactics
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="ment"][data-k="def"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="ctr"]'); await page.wait_for_timeout(200)
        print('posture:', await page.locator('.ctlrow:has([data-act="ment"]) .fine').inner_text(), '| counter on:', await page.locator('[data-act="ctr"]').get_attribute('aria-checked'))
        await page.evaluate('document.querySelector(\'[data-act="ment"]\').scrollIntoView({block:"center"})'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'c-tactics.png'))
        # scouting
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="scout"][data-k="dom"]'); await page.wait_for_timeout(200)
        print('scout card:', (await page.locator('text=派遣中').count()) > 0)
        seen = {'story': False, 'fire': False, 'cup': False, 'report': False, 'signed': False, 'pk': False}
        for step in range(70):
            await page.click('[data-act="go"]'); await page.wait_for_timeout(250)
            if await page.locator('#sheet .card.alert').count():
                await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(250); await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
                await page.click('[data-act="go"]'); await page.wait_for_timeout(300)
            if await page.locator('#sheet [data-act="quick"]').count():
                eb = await page.locator('#sheet .eyebrow >> nth=0').inner_text()
                if not seen['cup'] and ('杯' in eb or 'カップ' in eb):
                    seen['cup'] = True; await page.screenshot(path=str(OUT/'c-pre-cup.png')); print('cup prematch:', eb)
                if not seen['story'] and await page.locator('#sheet .chip.story').count() and 'カップ' not in eb and '杯' not in eb:
                    seen['story'] = True; await page.screenshot(path=str(OUT/'c-pre-story.png')); print('story prematch:', eb, await page.locator('#sheet .chip.story').all_inner_texts())
                if not seen['fire'] and await page.locator('#sheet .card.fire').count():
                    seen['fire'] = True; await page.screenshot(path=str(OUT/'c-pre-fire.png')); print('fire:', await page.locator('#sheet .card.fire').inner_text())
                cup = '杯' in eb or 'カップ' in eb
                if cup and not seen['pk']:
                    await page.click('#sheet [data-act="kickoff"]'); await page.wait_for_timeout(400)
                    await page.click('[data-act="mSpeed"]'); await page.click('[data-act="mSpeed"]')
                    for _ in range(500):
                        if await page.locator('[data-act="mClose"]').count(): break
                        if await page.locator('[data-act="mSkip"]').count(): await page.click('[data-act="mSkip"]')
                        elif await page.locator('[data-act="mResult"]').count(): await page.click('[data-act="mResult"]')
                        await page.wait_for_timeout(250)
                    res = await page.locator('.result .row >> nth=0').inner_text()
                    if 'PK' in res: seen['pk'] = True; await page.screenshot(path=str(OUT/'c-pk.png'))
                    print('cup live result:', res.replace('\n', ' '))
                    await page.click('[data-act="mClose"]'); await page.wait_for_timeout(200)
                else:
                    await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(250); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(200)
            elif await page.locator('#sheet [data-act="closeSheet"]').count():
                await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(200)
            if not seen['report'] and await page.locator('text=スカウトレポート').count():
                seen['report'] = True
                await page.screenshot(path=str(OUT/'c-report.png'))
                await page.click('.card:has-text("スカウトレポート") [data-act="player"] >> nth=0'); await page.wait_for_timeout(400)
                await page.screenshot(path=str(OUT/'c-prospect.png'))
                if await page.locator('#sheet [data-act="sign"]').count():
                    await page.click('#sheet [data-act="sign"]'); await page.wait_for_timeout(300); seen['signed'] = True
                elif await page.locator('#sheet [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]')
            st = await page.evaluate(LOAD)
            if all(seen[k] for k in ('story', 'fire', 'cup', 'report')) and st['date'] > '2026-10-20': break
        st = await page.evaluate(LOAD)
        print('seen', seen, '| date', st['date'])
        await page.click('[data-tab="league"]'); await page.click('[data-act="lgView"][data-k="cups"]'); await page.wait_for_timeout(250)
        await page.click('[data-act="cupPick"][data-k="lc"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'c-lc-later.png'), full_page=True)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
