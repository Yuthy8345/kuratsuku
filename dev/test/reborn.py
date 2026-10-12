# 転生選手: at the start of the 2nd season a legend of my club arrives (forced here with wait = pity), the pop-up plays,
# the legend's number can be handed over, the pop-up does not come back after closing, and the player carries the
# 転生 chip. (Chances, guarantee, traits: test/reborn.js)
import asyncio, pathlib, os, re, json  # RB_USED=yfm1,yfm2 to choose who comes
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
        async def edit(js):
            await page.goto('about:blank')
            ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
            await ed.evaluate('''(js) => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
              (new Function('st', js))(st); localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''', js)
            await ed.close()
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="startClub"]'); await page.wait_for_timeout(400)
        # the end of my first season at the club, with the guarantee due
        await edit('''for (const f of st.fixtures) { f.played = true; f.hg = 1; f.ag = 1; }
          st.seasonEnd = { label: '2026/27', champ: 'kashima', myPos: 5, rel: ['mito', 'chiba', 'okayama'], scorers: [], verdict: 'met', prize: 3000, pts: 60, target: '7位以内', ret: [], retSeen: true };
          st.history.unshift({ season: '2026/27', club: st.my, pos: 5, pts: 60, champ: 'kashima', verdict: 'met' });
          st.reborn = { used: USED, wait: 2, club: st.my }; st.board = 70;'''.replace('USED', json.dumps([x for x in os.environ.get('RB_USED', '').split(',') if x])))
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="nextSeason"]'); await page.wait_for_timeout(500)
        for k in range(8):  # farewells first, if any
            if await page.locator('#sheet .reborn').count(): break
            if await page.locator('#sheet [data-act="retNext"]').count(): await page.click('#sheet [data-act="retNext"]'); await page.wait_for_timeout(600)
            else: await page.wait_for_timeout(300)
        shown = await page.locator('#sheet .reborn').count()
        print('pop-up after the new season:', shown); bad += [] if shown else ['pop-up']
        await page.wait_for_timeout(1000); await page.screenshot(path=str(OUT/'rb-1-ignite.png'))
        await page.wait_for_timeout(2600); await page.screenshot(path=str(OUT/'rb-2-done.png'))
        st = await page.evaluate(LOAD); pid = st['reborn']['show']; pl = st['players'][str(pid)]
        txt = await page.locator('#sheet').inner_text()
        print('arrived:', pl['name'], pl['pp'], 'num', pl['num'], '| ovr', round(pl['ovr'], 1), 'pot', pl['pot'], '| used', st['reborn']['used'])
        bad += [] if pl.get('reborn') and pl['name'] in txt and '転生' in txt else ['player']
        # hand over the legend's number if someone wears it
        if await page.locator('#sheet [data-act="rebornNum"]').count():
            lab = await page.locator('#sheet [data-act="rebornNum"]').inner_text(); want = int(re.search(r'背番号(\d+)', lab).group(1))
            holder = next(x for x in st['players'].values() if x['club'] == st['my'] and x['num'] == want)
            await page.click('#sheet [data-act="rebornNum"]'); await page.wait_for_timeout(1600)
            st = await page.evaluate(LOAD); pl = st['players'][str(pid)]; h2 = st['players'][str(holder['id'])]
            print('handed', want, '->', pl['num'], '|', holder['name'], holder['num'], '->', h2['num']); bad += [] if pl['num'] == want and h2['num'] != want else ['number']
            await page.wait_for_timeout(1500); await page.screenshot(path=str(OUT/'rb-3-number.png'))
        else: print('legend number was free:', pl['num'])
        await page.click('#sheet [data-act="rebornDone"]'); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); print('closed, pending:', st['reborn'].get('show')); bad += [] if st['reborn'].get('show') is None else ['close']
        # his sheet and the squad list
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        chips = await page.locator('.prow', has_text=pl['name']).locator('.chip.rbchip').count()
        await page.locator('.prow', has_text=pl['name']).first.click(); await page.wait_for_timeout(400)
        line = await page.locator('#sheet .rb-line').inner_text() if await page.locator('#sheet .rb-line').count() else ''
        print('squad chip', chips, '| sheet:', line[:60]); bad += [] if chips and '魂を継ぐ' in line else ['sheet']
        await page.screenshot(path=str(OUT/'rb-4-sheet.png'))
        # a reload does not bring the pop-up back
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(900)
        again = await page.locator('#sheet.on .reborn').count(); print('after reload:', again); bad += [] if not again else ['came back']
        # the same pop-up on the whiteboard look (pending again)
        await page.evaluate("localStorage.setItem('kuratsuku.board','white')")
        await edit(f'st.reborn.show = {pid};')
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(3800)
        await page.screenshot(path=str(OUT/'rb-5-white.png'))
        await page.evaluate("localStorage.removeItem('kuratsuku.board')")
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
