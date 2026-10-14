# Suspended / injured players: nothing is replaced automatically, kickoff is blocked until the manager swaps them,
# and players coming back don't walk back into the team.
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
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
        async def state(): return await page.evaluate(LOAD)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click('[data-id="kashima"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        st = await state(); c = st['clubs']['kashima']
        SUS, INJ = c['tac']['xi'][2], c['tac']['bench'][3]
        print('suspend', st['players'][str(SUS)]['name'], '| injure bench', st['players'][str(INJ)]['name'])
        # edit the save while the app is closed
        await page.goto('about:blank')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''([s, i]) => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          st.players[s].sus = 1; st.players[i].inj = 3; localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''', [SUS, INJ])
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        st = await state(); c = st['clubs']['kashima']
        print('after load: suspended still in XI', SUS in c['tac']['xi'], '| injured still on bench', INJ in c['tac']['bench'])
        print('tactics dot', await page.locator('[data-tab="tactics"] .dot').count())
        # try to play
        await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        print('prematch kickoff buttons', await page.locator('#sheet [data-act="kickoff"]').count(), await page.locator('#sheet [data-act="quick"]').count(),
              '| alert:', await page.locator('#sheet .card.alert').inner_text())
        await page.screenshot(path=str(OUT/'s-prematch.png'))
        await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(350)
        await page.evaluate('document.querySelector(".tok.out").scrollIntoView({block:"center"})'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'s-tactics.png'))
        print('out tokens', await page.locator('.tok.out').count())
        # swap the suspended starter for a reserve
        await page.click('.tok.out'); await page.wait_for_timeout(400)
        await page.evaluate('''() => [...document.querySelectorAll('#sheet [data-act="assign"]:not([disabled])')].find(e => !e.textContent.includes('先発')).click()'''); await page.wait_for_timeout(300)
        st = await state(); c = st['clubs']['kashima']
        print('after swap: suspended in XI', SUS in c['tac']['xi'], '| on bench', SUS in c['tac']['bench'], '| bench size', len(c['tac']['bench']))
        # injured bench player: take him off, then fill the gap
        await page.click(f'[data-act="benchPick"][data-id="{INJ}"]'); await page.wait_for_timeout(350)
        await page.screenshot(path=str(OUT/'s-benchsheet.png'))
        await page.click('#sheet [data-act="benchOut"]'); await page.wait_for_timeout(300)
        st = await state(); c = st['clubs']['kashima']; print('bench after removing injured', len(c['tac']['bench']))
        n_add = await page.locator('.addrow').count()
        await page.click('.addrow'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="benchIn"]:not([disabled]) >> nth=0'); await page.wait_for_timeout(300)
        st = await state(); c = st['clubs']['kashima']; print('add rows', n_add, '| bench after adding', len(c['tac']['bench']))
        print('tactics dot now', await page.locator('[data-tab="tactics"] .dot').count(), '| banner', await page.locator('.card.alert').count())
        xi_before, bench_before = list(c['tac']['xi']), list(c['tac']['bench'])
        # play two matchdays; the suspended / injured players come back but must not be put back by themselves
        for _ in range(12):
            await page.click('[data-act="go"]'); await page.wait_for_timeout(250)
            if await page.locator('#sheet [data-act="quick"]').count():
                await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(250); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(200)
            elif await page.locator('#sheet [data-act="toTactics"]').count() and await page.locator('#sheet .card.alert').count():
                print('blocked again:', await page.locator('#sheet .card.alert').inner_text()); break
            elif await page.locator('#sheet [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(200)
            st = await state()
            if not st['players'][str(SUS)].get('bans') and st['players'][str(INJ)]['inj'] == 0 and any(f['played'] and 'kashima' in (f['h'], f['a']) for f in st['fixtures']): break
        st = await state(); c = st['clubs']['kashima']
        print('back fit:', not st['players'][str(SUS)].get('bans'), st['players'][str(INJ)]['inj'] == 0, '| returned to XI', SUS in c['tac']['xi'], '| returned to bench', SUS in c['tac']['bench'] or INJ in c['tac']['bench'])
        print('XI unchanged by itself', [x for x in c['tac']['xi'] if x not in xi_before] == [] or 'changed (cards/injury in match?)')
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
