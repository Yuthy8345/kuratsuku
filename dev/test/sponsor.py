# スポンサー契約 in the browser (2026-10-15, 案A＋B): the offers as contracts on paper with the kit (胸・背中・袖), her three
# filled in, tap to take one out / put one in, 「場所」 to move it, 3 at most, signing; the pre-match line and kick-off with her
# pick; the progress on the home screen and クラブ → 経営 (a bonus met, a condition at risk); the season review; the next
# season's offers (she stops the days); an old save (the old fixed sponsors this season). iPhone 16 chalkboard, iPhone SE
# whiteboard (the first contract whole on opening; on the SE the kits go small beside the text). Screenshots: dev/test/shots/spon-*.png. usage: python3 dev/test/sponsor.py   (KTK_FONTS=<node_modules/@fontsource>)
import asyncio, pathlib, os, re, json, subprocess, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
MAKE = r"""
const E = require(process.argv[1] + '/src/engine.js'); const D = require(process.argv[1] + '/data.json');
const clone = o => { const c = JSON.parse(JSON.stringify(o)); c.cele = []; return c; };
const out = {}, info = {};
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-15');
out.start = clone(S); info.rec = E.sponRec(S); info.ids = S.spon.offer.map(x => x.id);
const play = until => { for (let g = 0; g < 9000 && (until ? S.date < until : !S.seasonEnd); g++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') break;
} };
play('2026-11-10'); E.secSeen(S);
// one contract met on the next league points, one close to missing (to see both on the screen)
const st = E.sponStat(S); const ds = S.spon.deals;
Object.assign(ds[0], { k: 'pts', n: st.pts + 1, st: 'run', got: 0 }); Object.assign(ds[1], { k: 'hl', n: st.hl + 1, st: 'run', got: 0 });
if (ds[2].st !== 'run') Object.assign(ds[2], { k: 'gf', n: st.gf + 30, st: 'run', got: 0 });
for (let g = 0; g < 60 && ds[0].st !== 'done'; g++) play(E.D.add(S.date, 1));
for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(S, S.my); S.sec.back = [];
S.sec.notes = S.sec.notes.filter(n => n.k === 'sponHit');
info.hit = ds[0].co; info.got = ds[0].got;
out.mid = clone(S);
play(null);
out.end = clone(S);
E.rollover(S);
out.next = clone(S);
const O = clone(out.start); O.v = 13; delete O.spon; O.sec.notes = O.sec.notes.filter(n => n.k !== 'spon');
out.old = O;
console.log(JSON.stringify({ saves: out, info }));
"""
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css', 'dotgothic16/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
DATA = json.loads(subprocess.run(['node', '-e', MAKE, str(ROOT)], capture_output=True, text=True, check=True).stdout)
SAVES, INFO = DATA['saves'], DATA['info']
fails = 0
def ok(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails += 1
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"

async def main(vw, vh, board):
    css = font_css()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append('CONSOLE: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        async def route(r):
            u = r.request.url
            if 'lz-string' in u: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            elif 'fonts.googleapis.com' in u and css: await r.fulfill(status=200, content_type='text/css', body=css)
            elif 'fonts.gstatic.com/fs/' in u:
                fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one', 'dotgothic16'] if fn.startswith(x))
                await r.fulfill(status=200, content_type='font/woff2', body=(FONTS/fam/'files'/fn).read_bytes())
            else: await r.abort()
        await page.route('https://**/*', route)
        tag = f'-{board}-{vw}'
        async def load(st):
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(250)
            await page.evaluate("b => localStorage.setItem('kuratsuku.board', b)", board)
            await page.evaluate("s => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))", json.dumps(st))
            await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
            if css: await page.evaluate('document.fonts.ready')
        async def shot(name): await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/f'spon-{name}{tag}.png'))
        async def state(): return await page.evaluate(LOAD)
        sheet = page.locator('#sheet')
        async def seals(): return await page.evaluate("() => [...document.querySelectorAll('#sheet .sp-paper')].map(e => { const s = e.querySelector('.sp-seal'); return s ? s.firstChild.textContent : ''; })")
        async def overflow():
            """nothing in the sheet is wider than the screen or cut short"""
            return await page.evaluate('''() => { const W = innerWidth; const bad = [];
              for (const e of document.querySelectorAll('#sheet .sp-paper, #sheet .sp-paper .cond, #sheet .sp-paper .h b, #sheet .sp-kits, #sheet .sp-sum, #sheet .sp-mv'))
                { const r = e.getBoundingClientRect(); if (r.right > W + 0.5 || r.left < -0.5 || e.scrollWidth > e.clientWidth + 1) bad.push(e.className + ':' + e.textContent.slice(0, 20)); }
              return bad; }''')

        # ---- a new game: her hello, the offers under it; the home card
        await load(SAVES['start'])
        bub = await page.locator('#sec-float .sec-bub').inner_text()
        ok('はじめまして' in bub and 'ほか1件' in bub, f'home: her hello first, the offers counted ({bub.splitlines()[0]})')
        ok(await page.locator('.sp-home [data-act="sponOpen"]').count() == 1, 'home: the sponsor card with スポンサーを選ぶ')
        await page.evaluate("document.querySelector('.sp-home').scrollIntoView({block:'center'})"); await shot('home-start')
        await page.evaluate("scrollTo(0,0)")
        await page.click('.sp-home [data-act="sponOpen"]'); await page.wait_for_timeout(450)
        ok(await page.locator('#sheet .sp-paper').count() == 5 and await page.locator('#sheet .sp-seal').count() == 3, 'the sheet: five contracts, her three sealed')
        vis = await page.evaluate('''() => { const b = document.querySelector('#sheet .sheet-body').getBoundingClientRect(), r = document.querySelector('#sheet .sp-paper').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(b.top), Math.round(b.bottom)]; }''')
        ok(vis[0] >= vis[2] and vis[1] <= vis[3], f'the first contract shows whole on opening (top {vis[0]}, bottom {vis[1]}, visible {vis[2]}-{vis[3]})')
        st0 = await state(); off = st0['spon']['offer']
        sl = await seals()
        ok([off[i]['id'] for i in range(5) if sl[i] == '胸'] == [INFO['rec'][0]] and [off[i]['id'] for i in range(5) if sl[i] == '袖'] == [INFO['rec'][2]], 'her likeliest on the chest, the third on the sleeve')
        ok(await page.locator('#sheet .sp-slot:not(.empty)').count() == 3 and '契約 3 / 3社' in await sheet.inner_text(), 'the kit shows all three, 契約 3 / 3社')
        ok(not await overflow(), f'nothing wider than the screen or cut short {await overflow()}')
        ok(await page.evaluate('''() => { const r = document.querySelector('#sheet [data-act="spSign"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }'''), 'この3社と契約する is on screen')
        await shot('sheet')
        # take the sleeve one out, put a fourth in, try a fifth
        i_sleeve = sl.index('袖'); i_free = [i for i in range(5) if not sl[i]]
        await page.locator('#sheet [data-act="spTap"]').nth(i_sleeve).click(); await page.wait_for_timeout(250)
        ok(await page.locator('#sheet .sp-seal').count() == 2 and 'この2社と契約する' in await page.locator('#sheet [data-act="spSign"]').inner_text() and await page.locator('#sheet .sp-slot.empty').count() == 1, 'tap a sealed one: out (2 left, the sleeve empty)')
        await page.locator('#sheet [data-act="spTap"]').nth(i_free[0]).click(); await page.wait_for_timeout(250)
        sl2 = await seals(); ok(sl2[i_free[0]] == '袖', 'tap another: it takes the free place (袖)')
        await page.locator('#sheet [data-act="spTap"]').nth(i_free[1]).click(); await page.wait_for_timeout(300)
        ok(await page.locator('#toast').inner_text() in ('3社まで。外してから選んでください',) or '3社まで' in await page.locator('body').inner_text(), 'a fourth: 3社まで')
        ok((await seals())[i_free[1]] == '', 'and it stays out')
        # move the sleeve one to the chest (the chest one goes to the sleeve)
        chest = sl2.index('胸')
        await page.locator(f'#sheet .sp-paper >> nth={i_free[0]}').locator('[data-act="spSlot"][data-s="0"]').click(); await page.wait_for_timeout(250)
        sl3 = await seals(); ok(sl3[i_free[0]] == '胸' and sl3[chest] == '袖', '場所 胸: the two swap')
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); b.scrollTop = b.scrollHeight; }"); await shot('sheet-end')
        st = await state(); ok(st['spon']['offer'] and not st['spon']['deals'], 'nothing signed until the button')
        await page.click('#sheet [data-act="spSign"]'); await page.wait_for_timeout(450)
        st = await state(); ds = sorted(st['spon']['deals'], key=lambda d: d['slot'])
        ok(not st['spon']['offer'] and [d['id'] for d in ds] == [off[i_free[0]]['id'], next(x['id'] for x in off if x['id'] == INFO['rec'][1]), off[chest]['id']] and [d['slot'] for d in ds] == [0, 1, 2], 'signed: the three in their places')
        ok(await page.locator('#sheet.on').count() == 0, 'the sheet closes')
        ok(await page.locator('.sp-home .sp-row').count() == 3 and [t.strip() for t in await page.locator('.sp-home .sp-tag').all_inner_texts()] == ['胸', '背中', '袖'], 'home: three contracts, 胸・背中・袖')
        await page.evaluate("document.querySelector('.sp-home').scrollIntoView({block:'center'})"); await shot('home-signed')
        await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        st = await state(); ok(len(st['spon']['deals']) == 3, 'saved')

        # ---- kick-off without a choice: the pre-match line, back and forth, her pick
        await load(SAVES['start'])
        await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        ok(await page.locator('#sheet .sec-line [data-act], #sheet [data-act="sponOpen"]').count() >= 1 and 'スポンサーがまだ決まっていません' in await sheet.inner_text(), 'pre-match: her line, スポンサーを選ぶ')
        ok(await page.evaluate('''() => { const r = document.querySelector('#sheet [data-act="sponOpen"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }'''), 'the button is on screen without scrolling')
        await shot('prematch')
        await page.click('#sheet [data-act="sponOpen"]'); await page.wait_for_timeout(400)
        ok(await page.locator('#sheet [data-act="secPre"]').count() == 1, 'from the pre-match sheet: 試合前に戻る')
        await page.click('#sheet [data-act="secPre"]'); await page.wait_for_timeout(400)
        ok(await page.locator('#sheet [data-act="kickoff"]').count() == 1, 'back to the pre-match sheet')
        await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(500)
        if await page.locator('[data-act="mClose"]').count(): await page.click('[data-act="mClose"]'); await page.wait_for_timeout(300)
        st = await state()
        ok(sorted(st['spon']['deals'], key=lambda d: d['slot']) and [d['id'] for d in sorted(st['spon']['deals'], key=lambda d: d['slot'])] == INFO['rec'], 'kicked off without a choice: her three are signed')
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        note = next((n for n in st['sec']['notes'] if n['k'] == 'spon'), None)
        ok(note and note['data'].get('auto') and not note['seen'] and ('おすすめの3社と契約しました' in bub or '出られない選手' in bub), f'she says so (a note; the bubble: {bub.splitlines()[0] if bub else "-"})')

        # ---- the season: a bonus met, a condition at risk; クラブ → 経営
        await load(SAVES['mid'])
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        ok('約束を達成' in bub and INFO['hit'] in bub, f'home: {bub.splitlines()[0] if bub else "-"}')
        ok(await page.locator('.sp-home .sp-mini-seal').count() == 1 and await page.locator('.sp-home .sp-bar.warn').count() >= 1, 'home: 達成 sealed, the one at risk in red')
        await page.evaluate("document.querySelector('.sp-home').scrollIntoView({block:'center'})"); await shot('home-mid')
        await page.click('#sec-float .sec-bub'); await page.wait_for_timeout(400)
        ok('約束を達成' in await sheet.inner_text(), 'her sheet: the bonus')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(300)
        t = await page.locator('#view').inner_text()
        ok(await page.locator('#view .sp-home').count() == 1 and '保証は受け取り済み' in t and '月のスポンサー収入' in t, 'クラブ → 経営: the contracts and the money')
        await page.evaluate("document.querySelector('.sp-home').scrollIntoView({block:'start'}); scrollBy(0, -70)"); await shot('club')

        # ---- the season review
        await load(SAVES['end'])
        await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        t = await sheet.inner_text()
        ok('スポンサー契約' in t and await page.locator('#sheet .sp-res li').count() == 3 and ('達成 +' in t or '届かず' in t), 'season review: the three contracts, met or missed')
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const e = b.querySelector('.sp-res'); b.scrollTop = e.offsetTop - 120; }"); await shot('season')

        # ---- next season: she stops the days to bring the offers
        await load(SAVES['next'])
        presses = 0
        for _ in range(4):   # an offer from Europe or the window opening may stop the day first
            if await page.locator('#sheet .sp-paper').count(): break
            if await page.locator('#sheet [data-act="rebornDone"]').count(): await page.click('#sheet [data-act="rebornDone"]'); await page.wait_for_timeout(300); continue   # a 転生 player may come with the new season
            if await page.locator('#sheet.on').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
            while await page.locator('[data-act="offerNo"]').count(): await page.locator('[data-act="offerNo"]').first.click(); await page.wait_for_timeout(200)
            await page.click('[data-act="go"]'); await page.wait_for_timeout(600); presses += 1
        ok(await page.locator('#sheet .sp-paper').count() == 5 and presses <= 3, f'next season: 次へ進む brings her offers ({presses} presses: the next day)')
        await shot('next')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        ok(await page.locator('.sp-home [data-act="sponOpen"]').count() == 1, 'あとで決める: the home card waits')

        # ---- an old save: the old fixed sponsors this season
        await load(SAVES['old'])
        ok(await page.locator('.sp-home').count() == 0, 'old save: no sponsor card at home')
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(300)
        ok('今季はこれまでどおりの固定のスポンサー収入' in await page.locator('#view').inner_text(), 'クラブ → 経営: this season as before, offers next season')
        print('\n'.join(errs) or 'no page errors'); ok(not errs, 'no page errors')
        await b.close()

for vw, vh, board in [(393, 852, 'chalk'), (375, 667, 'white')]:
    print(f'--- {vw}x{vh} {board}')
    asyncio.run(main(vw, vh, board))
print(f'\n{fails} FAILED' if fails else '\nall ok'); sys.exit(1 if fails else 0)
