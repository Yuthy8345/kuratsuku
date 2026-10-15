"""通しプレイ（2026-10-15）: 画面から N シーズン遊び、ときどき全タブ・サブ画面・選手シート・他チーム情報を開いて、ページのエラーと
止まる画面がないかを見る。試合はクイック、オファーは断る、先発の警告は秘書の「おすすめどおりに入れ替える」（2026-10-15〜。
それで直らなければ戦術画面でベストメンバー）、ポップアップは閉じる。
xi＝先発を直した回数（試合に進めなかった回数）、taps＝そのために押した回数（秘書の1タップで直れば1回）、xi_left＝1タップで
直らなかった回数。新しいポップアップを足したら resolve() に1行足す。
usage: python3 dev/test/e2e.py [club] [seasons] [outdir]   （1シーズン約70秒）"""
import asyncio, pathlib, sys, time, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else str(ROOT / 'test' / 'shots' / 'e2e')); OUT.mkdir(parents=True, exist_ok=True)
CLUB = sys.argv[1] if len(sys.argv) > 1 else 'kashiwa'; SEASONS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
LZ = (ROOT / 'test/vendor/lz-string.min.js').read_text()
page_html = (ROOT / 'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
PAGE = ROOT / 'test' / 'page.html'; PAGE.write_text(wrapped)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append('CONSOLE: ' + m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text and 'ERR_TUNNEL' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(PAGE)); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click(f'[data-id="{CLUB}"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(200); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(300)
        async def has(sel): return await page.locator(sel).count() > 0
        async def click(sel, w=120):
            await page.locator(sel).first.click(); await page.wait_for_timeout(w)
        stats = {'matches': 0, 'offers': 0, 'ret': 0, 'cele': 0, 'reborn': 0, 'jobs': 0, 'closed': 0, 'xi': 0, 'taps': 0, 'xi_left': 0, 'tours': 0, 'stuck': 0, 'nt': 0, 'sec': 0, 'spon': 0, 'built': 0, 'done': 0, 'camp': 0, 'campRep': 0}
        LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
        unknown = {}
        seasons = 0; t0 = time.time(); it = 0
        async def resolve():
            nonlocal seasons
            for _ in range(12):
                if not await has('#sheet.on'): break
                if await has('#sheet [data-act="quick"]'):
                    await click('#sheet [data-act="quick"]', 150); stats['matches'] += 1
                    if await has('[data-act="mClose"]'): await click('[data-act="mClose"]', 150)
                elif await has('#sheet .card.alert') and await has('#sheet [data-act="secAll"]'):
                    if stats['xi'] == 0: await page.screenshot(path=str(OUT / 'prematch-blocked.png'))
                    await click('#sheet [data-act="secAll"]', 200); stats['xi'] += 1; stats['taps'] += 1
                    if await has('#sheet .card.alert') and await has('#sheet [data-act="toTactics"]'):
                        stats['xi_left'] += 1; stats['taps'] += 2
                        await click('#sheet [data-act="toTactics"]', 200); await click('[data-act="autoXI"]', 150)
                elif await has('#sheet .card.alert') and await has('#sheet [data-act="toTactics"]'):
                    await click('#sheet [data-act="toTactics"]', 200); stats['xi'] += 1; stats['xi_left'] += 1; stats['taps'] += 2
                    if await has('[data-act="fillEmpty"]'): await click('[data-act="fillEmpty"]', 150); stats['taps'] += 1
                    await click('[data-act="autoXI"]', 150)
                elif await has('#sheet [data-act="spSign"]'):   # スポンサー契約 (2026-10-15): sign her three
                    if stats['spon'] == 0: await page.screenshot(path=str(OUT / 'spon.png'))
                    await click('#sheet [data-act="spSign"]', 250); stats['spon'] += 1
                elif await has('#sheet .ht-done'):   # ホームタウン (2026-10-15): a building done → her note → the board
                    if stats['done'] == 0: await page.screenshot(path=str(OUT / 'built.png'))
                    stats['done'] += 1; await click('#sheet [data-act="htGo"]', 250)
                elif await has('#sheet [data-act="campPick"]:not([disabled])'):   # キャンプ (2026-10-16): her pick
                    if stats['camp'] == 0: await page.screenshot(path=str(OUT / 'camp.png'))
                    await click('#sheet [data-act="campPick"]', 250); stats['camp'] += 1
                elif await has('#sheet [data-act="campOpen"]'):   # her note read first (her sheet): open the map sheet from it
                    await click('#sheet [data-act="campOpen"]', 250)
                elif await has('#sheet [data-act="campRepDone"]'):   # the camp report
                    if stats['campRep'] == 0: await page.screenshot(path=str(OUT / 'camp-report.png'))
                    await click('#sheet [data-act="campRepDone"]', 250); stats['campRep'] += 1
                elif await has('#sheet .sec-head'):
                    stats['sec'] += 1
                    if await has('#sheet [data-act="secAll"]'): await click('#sheet [data-act="secAll"]', 200)
                    if await has('#sheet [data-act="secPre"]'): await click('#sheet [data-act="secPre"]', 200)
                    else: await click('#sheet [data-act="closeSheet"]', 150)
                elif await has('#sheet [data-act="retNext"]'): await click('#sheet [data-act="retNext"]', 150); stats['ret'] += 1
                elif await has('#sheet [data-act="celeDone"]'):
                    if stats['cele'] == 0: await page.screenshot(path=str(OUT / 'cele.png'))
                    await click('#sheet [data-act="celeDone"]', 150); stats['cele'] += 1
                elif await has('#sheet [data-act="rebornDone"]'): await click('#sheet [data-act="rebornDone"]', 150); stats['reborn'] += 1
                elif await has('#sheet [data-act="youthDone"]'): await click('#sheet [data-act="youthDone"]', 150)
                elif await has('#sheet [data-act="nextSeason"]'):
                    await page.screenshot(path=str(OUT / f'season-{seasons + 1}.png'))
                    await click('#sheet [data-act="nextSeason"]', 500); seasons += 1
                    print(f'season {seasons} done after {time.time() - t0:.0f}s', json.dumps(stats, ensure_ascii=False), flush=True)
                elif await has('#sheet [data-act="job"]'): await click('#sheet [data-act="job"]', 250); stats['jobs'] += 1
                elif await has('#sheet [data-act="closeSheet"]'):
                    txt = (await page.locator('#sheet').inner_text())[:60].replace('\n', ' ')
                    unknown[txt] = unknown.get(txt, 0) + 1
                    await click('#sheet [data-act="closeSheet"]', 120); stats['closed'] += 1
                else:
                    txt = (await page.locator('#sheet').inner_text())[:80].replace('\n', ' ')
                    print('cannot resolve sheet:', txt); await page.screenshot(path=str(OUT / f'sheet-{it}.png'))
                    await page.keyboard.press('Escape'); await page.wait_for_timeout(150); break
        async def tour():
            """visit every tab and sub-view, open a player sheet and a team sheet"""
            stats['tours'] += 1
            await resolve()
            await page.wait_for_timeout(450); await resolve()   # a pop-up that opens a moment later (the farewells → 解任 → offers)
            for tab in ['home', 'squad', 'tactics', 'league', 'club']:
                await click(f'[data-act="tab"][data-tab="{tab}"]', 60)
                if tab == 'squad':
                    for k in ['list', 'dev']: await click(f'[data-act="sqView"][data-k="{k}"]', 60)
                    if await has('[data-act="player"]'):
                        await click('[data-act="player"]', 150)
                        if await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 120)
                if tab == 'league':
                    for k in ['table', 'fixtures', 'cups', 'stats']: await click(f'[data-act="lgView"][data-k="{k}"]', 60)
                    await click('[data-act="lgView"][data-k="table"]', 60)
                    if await has('[data-act="team"]'):
                        await click('[data-act="team"] >> nth=3', 150)
                        if await has('#sheet [data-act="teamTab"][data-k="squad"]'): await click('#sheet [data-act="teamTab"][data-k="squad"]', 100)
                        if await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 120)
                if tab == 'club':
                    for k in ['main', 'town', 'market', 'records']: await click(f'[data-act="clView"][data-k="{k}"]', 60)
                    # ホームタウン: build the next thing when 10億 would be left (one job at a time), else just look at a sheet
                    await click('[data-act="clView"][data-k="town"]', 80)
                    st = await page.evaluate(LOAD); c = st['clubs'][st['my']]
                    nxt = None
                    for k in ['food', 'shop', 'sclub', 'dorm', 'house', 'roof', 'indoor', 'exp']:
                        if await has(f'.ht-tok.empty[data-k="{k}"]'): nxt = k; break
                    if nxt:
                        await click(f'[data-act="htOpen"][data-k="{nxt}"]', 150)
                        cost = {'food': 20000, 'shop': 30000, 'sclub': 15000, 'dorm': 50000, 'house': 60000, 'roof': 120000, 'indoor': 80000}.get(nxt) or [150000, 220000, 300000, 400000][min(3, (c.get('town') or {}).get('exp', 0))]
                        if await has('#sheet [data-act="htBuild"]') and c['funds'] - cost >= 100000:
                            await click('#sheet [data-act="htBuild"]', 150); stats['built'] += 1
                        elif await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 120)
                    await click('[data-act="clView"][data-k="main"]', 60)
            await click('[data-act="tab"][data-tab="home"]', 60)
        while seasons < SEASONS and it < 1200:
            it += 1
            if it % 25 == 1: await tour()
            if not await has('[data-act="go"]') and not await has('#sheet.on'):
                stats['stuck'] += 1; await page.screenshot(path=str(OUT / f'stuck-{it}.png')); await click('[data-act="tab"][data-tab="home"]', 100)
                if stats['stuck'] > 5: break
                continue
            if not await has('#sheet.on'): await click('[data-act="go"]', 140)
            await resolve()
            # her bubble: a player back → 戻す; otherwise open her sheet now and then (reads the month's summary)
            if not await has('#sheet.on') and await has('#sec-float [data-act="secBack"]'):
                await click('#sec-float [data-act="secBack"]', 150); stats['sec'] += 1
            elif not await has('#sheet.on') and it % 9 == 0 and await has('#sec-float .sec-mag'):
                await click('#sec-float .sec-mag', 250); stats['sec'] += 1; await resolve()
            # offers on home
            while await has('[data-act="offerNo"]') and not await has('#sheet.on'):
                await click('[data-act="offerNo"]', 120); stats['offers'] += 1
        await tour()
        print('stats', json.dumps(stats, ensure_ascii=False), 'iterations', it, f'{time.time() - t0:.0f}s')
        print(f"lineup fixes: {stats['xi']}, taps {stats['taps']} ({stats['taps'] / max(1, stats['xi']):.2f} per fix), not fixed by her one tap {stats['xi_left']}")
        print('sheets closed by closeSheet:', json.dumps(unknown, ensure_ascii=False)[:1500])
        # reload and continue works
        await page.reload(); await page.wait_for_timeout(500)
        await click('text=つづきから', 400)
        await page.screenshot(path=str(OUT / 'after-reload.png'))
        print('errors:', len(errs)); print('\n'.join(dict.fromkeys(errs)) or 'no errors')
        await b.close()
asyncio.run(main())
