"""1シーズンを画面から通しで遊ぶ（岡山）: 放出リスト → 試合はクイック、オファーは断る → シーズン総括 → 次のシーズン
（引退・転生・優勝などのポップアップを閉じる。2026-10-15〜 e2e.py の resolve() と同じ処理）→ 記録 → 再読み込み。
スクショ dev/test/shots/s-*.png。usage: python3 dev/test/season.py"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(parents=True, exist_ok=True)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
PAGE = ROOT/'test'/'page.html'; PAGE.write_text(wrapped)
async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text and 'ERR_TUNNEL' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        async def has(sel): return await page.locator(sel).count() > 0
        async def click(sel, w=120):
            await page.locator(sel).first.click(); await page.wait_for_timeout(w)
        st = {'matches': 0, 'offers': 0, 'xi': 0, 'ret': 0, 'cele': 0, 'reborn': 0, 'jobs': 0, 'closed': 0, 'seasons': 0, 'spon': 0}
        # every pop-up the game can show, as in e2e.py. stop_at_end: leave the season review open (for its screenshot)
        async def resolve(stop_at_end=False):
            for _ in range(15):
                if not await has('#sheet.on'):
                    await page.wait_for_timeout(450)  # some pop-ups open a moment later (the farewells → 解任 → offers)
                    if not await has('#sheet.on'): return
                if await has('#sheet [data-act="quick"]'):
                    await click('#sheet [data-act="quick"]', 150); st['matches'] += 1
                    if await has('[data-act="mClose"]'): await click('[data-act="mClose"]', 120)
                elif await has('#sheet .card.alert') and await has('#sheet [data-act="toTactics"]'):
                    await click('#sheet [data-act="toTactics"]', 200); st['xi'] += 1
                    if await has('[data-act="fillEmpty"]'): await click('[data-act="fillEmpty"]', 150)
                    await click('[data-act="autoXI"]', 150)
                elif await has('#sheet [data-act="retNext"]'): await click('#sheet [data-act="retNext"]', 150); st['ret'] += 1
                elif await has('#sheet [data-act="celeDone"]'): await click('#sheet [data-act="celeDone"]', 150); st['cele'] += 1
                elif await has('#sheet [data-act="rebornDone"]'): await click('#sheet [data-act="rebornDone"]', 150); st['reborn'] += 1
                elif await has('#sheet [data-act="youthDone"]'): await click('#sheet [data-act="youthDone"]', 150)
                elif await has('#sheet [data-act="nextSeason"]'):
                    if stop_at_end: return 'end'
                    await click('#sheet [data-act="nextSeason"]', 500); st['seasons'] += 1
                elif await has('#sheet [data-act="job"]'):
                    await page.screenshot(path=str(OUT/'s-fired.png')); await click('#sheet [data-act="job"]', 250); st['jobs'] += 1
                elif await has('#sheet [data-act="spSign"]'): await click('#sheet [data-act="spSign"]', 250); st['spon'] += 1   # スポンサー契約: her three
                elif await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 120); st['closed'] += 1
                else:
                    txt = (await page.locator('#sheet').inner_text())[:80].replace('\n', ' ')
                    fails.append('cannot resolve sheet: ' + txt); await page.keyboard.press('Escape'); await page.wait_for_timeout(150); return
            if await has('#sheet.on'): fails.append('sheet still open after 15 steps')

        await page.goto('file://' + str(PAGE)); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click('[data-id="okayama"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(350)
        # sell attempt: list a player
        await click('[data-tab="squad"]'); await click('.prow >> nth=5', 350)
        await click('#sheet [data-act="toggleList"]', 200)
        await click('#sheet [data-act="closeSheet"]', 300)
        end = False
        for i in range(400):
            if await has('[data-act="offerNo"]') and not await has('#sheet.on'):
                st['offers'] += 1
                if st['offers'] == 1: await page.screenshot(path=str(OUT/'s-offer.png'))
                await click('[data-act="offerNo"]', 100); continue
            if not await has('#sheet.on'):
                if not await has('[data-act="go"]'): await click('[data-act="tab"][data-tab="home"]', 100)
                await click('[data-act="go"]', 120)
            if await resolve(stop_at_end=True) == 'end': end = True; break
        if not end: fails.append('the season did not end')
        await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/'s-seasonend.png'))
        print('matches', st['matches'], 'offers', st['offers'], 'xi', st['xi'])
        # next season: farewells, a 転生 player, a new job… then the home screen
        await resolve()
        if await has('#sheet.on'): fails.append('a pop-up is still open after the season change: ' + (await page.locator('#sheet').inner_text())[:120].replace('\n', ' '))
        if not st['seasons']: fails.append('next season not reached')
        await page.screenshot(path=str(OUT/'s-newseason.png'))
        await click('[data-act="tab"][data-tab="club"]', 150); await click('[data-act="clView"][data-k="records"]', 200)
        rec = await page.locator('.view').first.inner_text()
        if '26/27' not in rec: fails.append('records: no 26/27 season')
        await page.screenshot(path=str(OUT/'s-records.png'))
        await page.reload(); await page.wait_for_timeout(500)
        if not await has('text=つづきから'): fails.append('title after reload: no つづきから')
        await page.screenshot(path=str(OUT/'s-title-reload.png'))
        print('season change:', {k: st[k] for k in ['ret', 'cele', 'reborn', 'jobs', 'closed', 'seasons']})
        await b.close()
    fails += errs
    print('\n'.join(fails) if fails else 'ok: one season through the screens, next season reached, records, reload')
    sys.exit(1 if fails else 0)
asyncio.run(main())
