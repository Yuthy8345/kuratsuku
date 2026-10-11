# Farewell pop-ups for my retiring players at the end of the season
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:SCHEME}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
(ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
DATA = json.loads((ROOT/'data.json').read_text())
pid = lambda name: next(p['id'] for p in DATA['players'] if p['name'] == name)
OSAKO, SAKAI = pid('大迫 勇也'), pid('酒井 高徳')
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
async def run(scheme):
    (ROOT/'test/page.html').write_text(wrapped.replace('SCHEME', scheme, 1))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, color_scheme=scheme)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click('[data-id="kobe"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="startClub"]'); await page.wait_for_timeout(400)
        # jump to the end of the season: mark every fixture played and open the season-end state (an old-style save: no retirements decided yet)
        await page.goto('about:blank')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''([a, b]) => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          for (const f of st.fixtures) { f.played = true; f.hg = 1; f.ag = 1; }
          // a veteran who is sure to retire (not in the data file, so the save keeps his birthday)
          const v = JSON.parse(JSON.stringify(st.players[a])); Object.assign(v, { id: 990001, name: '外町 俊之輔', short: '外町', num: 99, birth: '1984-04-01', gen: true, nat: 'JPN',
            st: { apps: 34, g: 21, a: 4, yc: 2, rc: 0, rt: 240, mins: 2800 }, hist: [{ s: '2025/26', c: 'kobe', ovr: 74, apps: 30, g: 12, a: 6 }] }); st.players[990001] = v;
          st.seasonEnd = { label: '2026/27', champ: 'kashima', myPos: 4, rel: ['mito', 'chiba', 'okayama'], scorers: [], verdict: 'met', prize: 3000, pts: 61, target: '5位以内' };
          localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''', [OSAKO, SAKAI])
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="nextSeason"]'); await page.wait_for_timeout(500)
        names = []
        for k in range(10):
            if not await page.locator('#sheet .farewell').count(): break
            names.append(await page.locator('#sheet .fw-name').inner_text())
            await page.wait_for_timeout(900)
            await page.screenshot(path=str(OUT/f'r-{scheme}-{k}.png'))
            btn = await page.locator('#sheet [data-act="retNext"]').inner_text()
            await page.click('#sheet [data-act="retNext"]'); await page.wait_for_timeout(450)
        st = await page.evaluate(LOAD)
        left = {q['name'] for q in st['players'].values() if q['club'] == 'kobe'}
        print(scheme, 'farewells', names, '| last button', btn, '| season now', st['season'], '| farewell players gone', not any(n in left for n in names), '| veteran shown', '外町 俊之輔' in names)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(run('light')); asyncio.run(run('dark'))
