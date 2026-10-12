# Detailed positions: training grid, player sheet, learning progress, old-save migration
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
DATA = json.loads((ROOT/'data.json').read_text())
pid = lambda name: next(p['id'] for p in DATA['players'] if p['name'] == name)
UEDA, BUENO = pid('植田 直通'), pid('マテウス ブエノ')
READ = '''(id) => { const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3))); const p = st.players[id]; return { pp: p.pp, ap: p.ap || null, learn: p.learn || null, pos2: p.pos2 || null, v: st.v }; }'''
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
        await page.screenshot(path=str(OUT/'p-club.png'))
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'p-squad.png'))
        print('badges', await page.evaluate('[...document.querySelectorAll(".prow .pos")].slice(0,14).map(e=>e.textContent).join(" ")'))
        # training sheet of a CB: learn SB
        await page.click('[data-act="sqView"][data-k="dev"]'); await page.wait_for_timeout(200)
        await page.click(f'[data-act="train"][data-id="{UEDA}"]'); await page.wait_for_timeout(400)
        cells = await page.evaluate('[...document.querySelectorAll("#sheet .apc")].map(e=>e.textContent.trim()+(e.disabled?"(x)":"")).join(" | ")')
        print('grid', cells)
        await page.click('#sheet .apc[data-k="SB"]'); await page.wait_for_timeout(250)
        await page.evaluate('document.querySelector("#sheet .aptgrid").scrollIntoView({block:"center"})'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'p-train.png'))
        st0 = await page.evaluate(READ, UEDA); print('after tap', st0)
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        for i in range(4):
            await page.click('[data-act="go"]'); await page.wait_for_timeout(200)
            if await page.locator('#sheet .card.alert').count():
                await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(250); await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
                await page.click('[data-act="go"]'); await page.wait_for_timeout(300)
            if await page.locator('#sheet [data-act="quick"]').count():
                await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(200); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(150)
        st1 = await page.evaluate(READ, UEDA); print('4 steps later', st1)
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        await page.screenshot(path=str(OUT/'p-devlist.png'))
        await page.click('[data-act="sqView"][data-k="list"]'); await page.wait_for_timeout(150)
        await page.click(f'[data-act="player"][data-id="{UEDA}"]'); await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector("#sheet .aptgrid").scrollIntoView({block:"center"})'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'p-player.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # tactics: slot labels + slot sheet shows aptitude
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        print('slots', await page.evaluate('[...document.querySelectorAll(".tok .ov")].map(e=>e.textContent).join(" ")'))
        await page.click('.formrow [data-k="3-4-2-1"]'); await page.wait_for_timeout(250)
        print('3-4-2-1', await page.evaluate('[...document.querySelectorAll(".tok .ov")].map(e=>e.textContent).join(" ")'))
        await page.screenshot(path=str(OUT/'p-tactics.png'))
        await page.click('.tok >> nth=4'); await page.wait_for_timeout(400)
        await page.screenshot(path=str(OUT/'p-slot.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # --- old v2 save: category retraining (pos2 / learn) and no detailed positions
        # edit the save while the app is not running (it saves on unload)
        await page.goto('about:blank'); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html'))
        await ed.add_script_tag(content=LZ)
        await ed.evaluate('''([a, b]) => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          for (const p of Object.values(st.players)) { delete p.pp; delete p.ap; delete p.learn; }
          st.players[a].pos2 = ['MF']; st.players[b].learn = { pos: 'FW', prog: 50 }; st.v = 2;
          for (const c of Object.values(st.clubs)) c.tac.form = '4-4-2';
          localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''', [UEDA, BUENO])
        print('edited save', await ed.evaluate(READ, UEDA)); await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="sqView"][data-k="dev"]'); await page.wait_for_timeout(200)
        await page.click(f'[data-act="train"][data-id="{BUENO}"]'); await page.wait_for_timeout(400)
        await page.evaluate('document.querySelector("#sheet .aptgrid").scrollIntoView({block:"center"})'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'p-migrated.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="go"]'); await page.wait_for_timeout(300)  # forces a save
        if await page.locator('#sheet .card.alert').count():
            await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(250); await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
            await page.click('[data-act="go"]'); await page.wait_for_timeout(300)
        if await page.locator('#sheet [data-act="quick"]').count():
            await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(200); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(150)
        print('migrated CB with old MF', await page.evaluate(READ, UEDA))
        print('migrated learner', await page.evaluate(READ, BUENO))
        forms = await page.evaluate('''() => { const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3))); return Object.values(st.clubs).filter(c => st.order.includes(c.id)).map(c => c.short + ':' + c.tac.form).join(' '); }''')
        print('forms', forms)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
