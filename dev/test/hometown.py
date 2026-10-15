# ホームタウン in the browser (2026-10-15, 作業5, 案A＝作戦ボードの街の地図): クラブ → ホームタウン in the switch bar (4 buttons
# that fit, with her magnet too), the board (facilities with their level, the stadium, the buildings: not yet / works / built),
# a building's sheet → 建てる (paid up front, the works on the map and in a card, one job at a time), a facility's next
# level, 経営 (施設・建設, 維持費, the way to ホームタウン), the days to the end of the works (the pre-match crowd, the result's
# supporters), her note when it is done (→ ホームタウンを見る), the upkeep the month after, the month's summary (supporters,
# works), the season's chart; a save with a stand being built; an old save (be3e2da: her note, スタジアム設備 Lv4 → 屋根と
# 大型ビジョン・スタジアムグルメ, the days go on). iPhone 16 chalkboard, iPhone SE whiteboard. Screenshots dev/test/shots/ht-*.png.
# usage: python3 dev/test/hometown.py   (KTK_FONTS=<node_modules/@fontsource> for the real fonts)
import asyncio, pathlib, os, re, json, subprocess, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
MAKE = r"""
const path = require('path'), fs = require('fs'), os = require('os'), { execSync } = require('child_process');
const root = process.argv[1];
const E = require(root + '/src/engine.js'); const D = require(root + '/data.json');
const clone = o => { const c = JSON.parse(JSON.stringify(o)); c.cele = []; return c; };
const out = {}, info = {};
const play = (S, until) => { for (let g = 0; g < 9000 && S.date < until; g++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') break;
} };
// start: a new game at 柏 (a ground that fills up), her three sponsors signed, 20億 more to build with
const S = E.newGame(D, 'kashiwa', 'ソーイ', '2026-10-15');
E.sponPick(S, E.sponRec(S)); S.clubs[S.my].funds += 200000;
out.start = clone(S); info.fans = S.clubs[S.my].fans; info.cap = S.clubs[S.my].cap; info.funds = S.clubs[S.my].funds;
// mid: shop and food built, the first stand being built, the month's summary (the mock of 作業4)
const M = E.newGame(D, 'kashiwa', 'ソーイ', '2026-10-15'); const mc = M.clubs[M.my];
mc.funds += 400000; E.sponPick(M, E.sponRec(M));
play(M, '2026-09-01');
for (const k of ['shop', 'food']) { E.townBuild(M, k); mc.town.job.to = M.date; E.townDay(M); }
play(M, '2026-11-20'); E.townBuild(M, 'exp'); play(M, '2027-02-12');
E.secSeen(M); M.sec.notes = M.sec.notes.filter(n => n.k === 'month'); M.sec.notes.forEach(n => { n.seen = false; });
for (const p of E.squad(M, M.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(M, M.my); M.sec.back = [];
out.mid = clone(M); info.mid = E.townInfo(M);
// old: a save of be3e2da (before the hometown) with スタジアム設備 Lv4
const tmp = path.join(os.tmpdir(), `engine_be3e2da_${process.pid}.js`);
fs.writeFileSync(tmp, execSync('git show be3e2da:dev/src/engine.js', { cwd: path.join(root, '..') }));
const old = require(tmp);
const A = old.newGame(D, 'machida', '旧', '2026-10-14');
for (let g = 0; g < 60; g++) { const st = old.advance(A, 1); if (st.stop === 'match') { const f = A.fixtures.find(y => y.id === st.fid); old.autoLineup(A, A.my); const X = old.createMatch(A, f); old.simulateFull(A, X); old.finishMatch(A, X); } else if (st.stop === 'inbox') A.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') old.rejectOffer(A, y.id); }); }
A.clubs[A.my].fac.stadium = 4; A.clubs[A.my].fac.train = 4;
for (const p of Object.values(A.players)) if (p.club === A.my) { p.inj = 0; p.sus = 0; delete p.away; }
out.old = clone(A); info.oldDate = A.date;
fs.unlinkSync(tmp);
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
def money(v):   # Engine.money
    s = '-' if v < 0 else ''; v = abs(v)
    if v >= 10000: return s + re.sub(r'\.?0+$', '', f"{v / 10000:.{1 if v >= 100000 else 2}f}") + '億円'
    return s + f'{round(v):,}万円'
def ppl(n):
    n = round(n); r = n % 10000
    return f'{n // 10000}万{f"{r:,}" if r else ""}' if n >= 10000 else f'{n:,}'
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"

async def main(vw, vh, board, full):
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
        async def shot(name):   # (a toast left from a tap before is taken away)
            await page.wait_for_timeout(300); await page.evaluate("document.querySelector('#toast').classList.remove('on')"); await page.wait_for_timeout(250)
            await page.screenshot(path=str(OUT/f'ht-{name}{tag}.png'))
        async def state(): return await page.evaluate(LOAD)
        async def has(sel): return await page.locator(sel).count() > 0
        async def click(sel, w=350): await page.locator(sel).first.click(); await page.wait_for_timeout(w)
        sheet = page.locator('#sheet')
        async def fix_xi():
            """the pre-match sheet says the XI can't play: her one tap, else 戦術画面へ → ベストメンバー (as e2e.py)"""
            if await has('#sheet [data-act="secAll"]'): await click('#sheet [data-act="secAll"]', 300)
            if await has('#sheet .card.alert') and await has('#sheet [data-act="toTactics"]'):
                await click('#sheet [data-act="toTactics"]', 300)
                if await has('[data-act="fillEmpty"]'): await click('[data-act="fillEmpty"]', 200)
                await click('[data-act="autoXI"]', 250)
        async def town():
            await click('[data-act="tab"][data-tab="club"]', 250); await click('[data-act="clView"][data-k="town"]', 300)
        async def bar():
            """the switch bar: 経営・ホームタウン・移籍市場・記録, every label whole, her magnet (if any) inside the bar"""
            return await page.evaluate('''() => { const s = document.querySelector('#view > .subnav'), g = s.querySelector('.seg');
              const bs = [...g.querySelectorAll('button')]; const sr = s.getBoundingClientRect();
              return { labels: bs.map(b => b.textContent.trim()), cut: bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()),
                inside: bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5; }),
                sec: !!s.querySelector('#sec-float'), minW: Math.min(...bs.map(b => b.getBoundingClientRect().width)), hscroll: document.scrollingElement.scrollWidth > innerWidth + 1 }; }''')
        async def on_screen(sel):
            return await page.evaluate(f'''() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 && r.left >= -0.5; }}''')
        async def board_ok():
            """no magnet or label outside the board"""
            return await page.evaluate('''() => { const B = document.querySelector('.ht-board').getBoundingClientRect(); const bad = [];
              for (const e of document.querySelectorAll('.ht-board .ht-tok, .ht-board .ht-tok .lbl, .ht-board .ht-stad .cap')) { const r = e.getBoundingClientRect(); if (r.left < B.left - 0.5 || r.right > B.right + 0.5 || r.bottom > B.bottom + 0.5) bad.push((e.dataset.k || e.className) + ' ' + e.textContent.trim()); }
              return bad; }''')

        # ---- a new game: クラブ → ホームタウン
        await load(SAVES['start'])
        await click('[data-act="tab"][data-tab="club"]', 250)
        bb = await bar()
        ok(bb['labels'] == ['経営', 'ホームタウン', '移籍市場', '記録'] and not bb['cut'] and bb['inside'] and not bb['hscroll'], f"the switch bar: {'・'.join(bb['labels'])}, every label whole{'（with her magnet）' if bb['sec'] else ''} (narrowest {bb['minW']:.0f}px)")
        if vw < 390:   # the first iPhone SE (320px): the four buttons and her magnet still fit
            await page.set_viewport_size({'width': 320, 'height': 568}); await page.wait_for_timeout(200)
            b3 = await bar(); ok(not b3['cut'] and b3['inside'] and not b3['hscroll'], f"320px: every label whole (narrowest {b3['minW']:.0f}px)")
            await page.locator('[data-act="clView"][data-k="records"]').click(timeout=3000); await page.wait_for_timeout(200)
            ok(await page.locator('[data-act="clView"][data-k="records"][aria-pressed="true"]').count() == 1, '320px: 記録 can be tapped (her magnet beside it, not on it)')
            await page.locator('[data-act="clView"][data-k="main"]').click(); await page.wait_for_timeout(200)
            await page.set_viewport_size({'width': vw, 'height': vh}); await page.wait_for_timeout(200)
        t = await page.locator('#view').inner_text()
        ok('維持費' in t and '施設・建設' in t and await has('#view .ht-link [data-act="clView"][data-k="town"]') and not await has('#view [data-act="upgrade"]'), '経営: 施設・建設 and 維持費 in the books; the facilities moved to ホームタウン (a card with the way there)')
        await page.evaluate("document.querySelector('.ht-link').scrollIntoView({block:'center'})"); await shot('club')
        await click('#view .ht-link [data-act="clView"]', 300)
        ok(await has('.ht-board') and await page.locator('[data-act="clView"][data-k="town"][aria-pressed="true"]').count() == 1, 'its button opens ホームタウン')
        await page.evaluate('scrollTo(0, 0)')
        t = await page.locator('#view').inner_text()
        over = round((INFO['fans'] - INFO['cap']) / 100) * 100
        ok(ppl(INFO['fans']) in t and ppl(INFO['cap']) in t and f'満員の試合は、席が取れないサポーターがおよそ{ppl(over)}人' in t, f"top: サポーター {ppl(INFO['fans'])}人・スタジアム {ppl(INFO['cap'])}席, 満員の試合は…およそ{ppl(over)}人")
        ok(await page.locator('.ht-tok.fac').count() == 4 and await page.locator('.ht-tok.empty').count() == 8 and await page.locator('.ht-tok.built, .ht-tok.job').count() == 0 and await has('.ht-stad:not(.works)'),
           'the board: 4 facilities, 7 buildings and the first stand not built yet, the stadium')
        ok([x.strip() for x in await page.locator('.ht-tok.fac em').all_inner_texts()] == ['Lv2', 'Lv2', 'Lv2', 'Lv1'], 'the facilities with their level (Lv2・Lv2・Lv2・Lv1)')
        bo = await board_ok(); ok(not bo, f'every magnet and label inside the board {bo}')
        ok(await page.locator('.ht-chart polyline').count() == 1 and await page.locator('.ht-chart rect.g').count() == 0, 'the chart: the supporters, no home crowd yet')
        await shot('start')
        # a building's sheet → 建てる
        await click('[data-act="htOpen"][data-k="food"]', 450)
        t = await sheet.inner_text()
        ok('スタジアムグルメ' in t and '2億' in t and '2か月' in t and '月60万' in t and '観客 +2%' in t and '1人あたり +200円' in t, 'スタジアムグルメ: 費用 2億・工期 2か月・維持費 月60万, 観客 +2%・1人あたり +200円')
        ok(await on_screen('#sheet [data-act="htBuild"]'), 'its 建てる button is on screen')
        await shot('sheet')
        st = await state(); ok(not (st['clubs'][st['my']].get('town') or {}).get('job'), 'nothing built until the button')
        await click('#sheet [data-act="htBuild"]', 500)
        st = await state(); c = st['clubs'][st['my']]
        ok(c['town']['job']['k'] == 'food' and c['funds'] == INFO['funds'] - 20000 and not await has('#sheet.on'), f"built: 2億 paid up front ({money(c['funds'])} left), the sheet closes")
        ok(await page.locator('.ht-tok.job[data-k="food"]').count() == 1 and '工事中' in await page.locator('.ht-tok.job[data-k="food"]').inner_text() and 'スタジアムグルメ' in await page.locator('.ht-job').inner_text(), 'the works: striped magnet (工事中) and the card')
        await click('[data-act="htOpen"][data-k="house"]', 450)
        ok('の完成後に建てられます' in await page.locator('#sheet .sheet-foot').inner_text() and await page.locator('#sheet .sheet-foot button[disabled]').count() == 1 and 'スタジアムグルメの工事中' in await sheet.inner_text(), 'one job at a time: クラブハウス waits (〜の完成後に建てられます)')
        await click('#sheet [data-act="closeSheet"]', 300)
        await click('[data-act="htOpen"][data-k="train"]', 450)
        ok('練習場' in await sheet.inner_text() and 'Lv3に強化する' in await sheet.inner_text(), 'a facility: 練習場, Lv3に強化する')
        await click('#sheet [data-act="htUp"]', 450)
        st = await state(); ok(st['clubs'][st['my']]['fac']['train'] == 3 and 'Lv4に強化する' in await sheet.inner_text(), 'Lv3 (the sheet offers Lv4 next)')
        await click('#sheet [data-act="closeSheet"]', 300)
        ok(await page.locator('.ht-tok.fac em').first.inner_text() == 'Lv3' and '施設 月80万円' in await page.locator('#view').inner_text(), 'the board says Lv3; the upkeep line: 施設 月80万円')
        if full:
            await page.evaluate('scrollTo(0, 0)'); await shot('works')
            # the days go by: the pre-match crowd, my supporters after the match, her note when it is done
            pre = res = done = False; n = 0
            while n < 160:
                n += 1
                st = await state()
                if st['date'] >= '2026-11-02': break
                if not await has('#sheet.on'):
                    while await has('[data-act="offerNo"]'): await click('[data-act="offerNo"]', 200)
                    await click('[data-act="go"]', 350)
                for _ in range(6):
                    if not await has('#sheet.on'): break
                    if await has('#sheet .ht-done'):
                        t = await sheet.inner_text()
                        ok(not done and 'スタジアムグルメが完成' in t and '維持費 月60万円（来月から）' in t, 'done: her note — スタジアムグルメが完成, 維持費 月60万円（来月から）')
                        await page.evaluate("document.querySelector('#sheet .ht-done').scrollIntoView({block:'center'})"); await shot('done')
                        done = True; await click('#sheet [data-act="htGo"]', 450)
                        ok(await page.locator('.ht-tok.built[data-k="food"]').count() == 1 and not await has('.ht-job') and not await has('#sheet.on'), 'ホームタウンを見る: the board shows グルメ built (white, yellow rim)')
                    elif await has('#sheet [data-act="quick"]'):
                        if not pre:
                            t = await page.locator('#sheet .pre-att').inner_text() if await has('#sheet .pre-att') else ''
                            ok('観客の見込み' in t and '人' in t, f"pre-match: {t.strip()}"); pre = True
                            await page.evaluate("document.querySelector('#sheet .pre-att').scrollIntoView({block:'center'})"); await shot('prematch')
                        await click('#sheet [data-act="quick"]', 600)
                        if await has('[data-act="mClose"]'):
                            if not res:
                                t = await page.locator('.res-town').inner_text() if await has('.res-town') else ''
                                ok('サポーター' in t and '人（' in t, f"result: {t.strip()}"); res = True; await shot('result')
                            await click('[data-act="mClose"]', 350)
                    elif await has('#sheet .card.alert'): await fix_xi()
                    elif await has('#sheet .sec-head'):
                        if await has('#sheet [data-act="secAll"]'): await click('#sheet [data-act="secAll"]', 300)
                        await click('#sheet [data-act="closeSheet"]', 300)
                    elif await has('#sheet [data-act="spSign"]'): await click('#sheet [data-act="spSign"]', 300)
                    elif await has('#sheet [data-act="celeDone"]'): await click('#sheet [data-act="celeDone"]', 300)
                    elif await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 300)
                    else:
                        print('?? sheet', (await sheet.inner_text())[:120].replace('\n', ' ')); await page.keyboard.press('Escape'); await page.wait_for_timeout(200); break
                if not await has('#sheet.on') and not await has('[data-act="go"]'): print('?? no go button', (await page.locator('body').inner_text())[:200].replace('\n', ' ')); break
            ok(done and pre and res, f'played to {st["date"]}: the pre-match line, the result line, her note')
            st = await state(); c = st['clubs'][st['my']]
            ok(c['fin']['up'] == 80 * 3 + 60, f"the upkeep: 練習場 Lv3 from 9/1 (月80万) + グルメ from 11/1 (月60万) = {money(c['fin']['up'])}")
            ok(len(c.get('fanH') or []) >= 4, f"the supporters' history: {len(c.get('fanH') or [])} points")
            await click('[data-act="tab"][data-tab="club"]', 250); await click('[data-act="clView"][data-k="main"]', 300)
            ok(f"-{money(c['fin']['up'])}" in await page.locator('#view').inner_text(), f"経営: 維持費 -{money(c['fin']['up'])}")
            await click('[data-act="clView"][data-k="town"]', 300)
            hg = [f for f in st['fixtures'] if f.get('played') and f['h'] == st['my'] and not f.get('neutral') and f.get('att')]
            ok(await page.locator('.ht-chart rect.g').count() == len(hg) and len(hg) >= 3, f'the chart: {len(hg)} home games as bars')
            await page.evaluate("document.querySelector('.ht-chart').scrollIntoView({block:'center'})"); await shot('chart')
            await click('[data-act="tab"][data-tab="home"]', 300)
            if await has('#sec-float .sec-mag'):
                await click('#sec-float .sec-mag', 450)
                t = await sheet.inner_text()
                ok('月のまとめ' in t and 'サポーター' in t and '先月から' in t, "the month's summary: サポーター（先月から …）")
                await click('#sheet [data-act="closeSheet"]', 300)

        # ---- a stand being built (the save of the 作業4 mock): the stadium in stripes, the crane, the chart
        await load(SAVES['mid'])
        await town()
        ok(await has('.ht-stad.works') and '増築 1期' in await page.locator('.ht-tok.job[data-k="exp"]').inner_text() and await page.locator('.ht-tok.built').count() == 2, 'the stand being built: the stadium in stripes, the crane (増築 1期 N%), shop and food built')
        t = await page.locator('#view').inner_text()
        ok('満員の試合は、席が取れないサポーターがおよそ' in t and 'スタジアム増築 1期' in t and '工事中のホーム戦は観客 −10%' in t, 'the note (満員の試合は…) and the works card (−10%)')
        bo = await board_ok(); ok(not bo, f'every magnet and label inside the board {bo}')
        await shot('mid')
        await page.evaluate("document.querySelector('.ht-chart').scrollIntoView({block:'end'}); scrollBy(0, 120)"); await shot('mid-chart')
        ok(await page.locator('.ht-chart rect.g.full').count() >= 1, 'the chart: full houses in yellow')
        await page.evaluate('scrollTo(0, 0)')
        await click('button.ht-stad', 450)
        t = await sheet.inner_text()
        ok('工事中' in t and 'スタジアム増築 1期' in t and '完成予定' in t and '+5,000席' in t and await page.locator('#sheet .sheet-foot [data-act="htBuild"]').count() == 0, 'the stadium: its sheet (工事中・完成予定・+5,000席, no button)')
        await shot('stand')
        await click('#sheet [data-act="closeSheet"]', 300)
        await click('[data-act="tab"][data-tab="home"]', 300)
        await click('#sec-float .sec-mag', 450)
        t = await sheet.inner_text(); ok('工事' in t and 'スタジアム増築 1期' in t and 'サポーター' in t, "the month's summary: 工事 スタジアム増築 1期 N%")
        await click('#sheet [data-act="closeSheet"]', 300)

        # ---- an old save (be3e2da): her note, the old スタジアム設備 Lv4 as buildings, the days go on
        await load(SAVES['old'])
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await has('#sec-float .sec-bub') else ''
        ok(bub and ('ホームタウン' in bub or 'ほか' in bub), f"old save: her bubble ({bub.splitlines()[0] if bub else '-'})")
        await click('#sec-float .sec-mag', 450)
        t = await sheet.inner_text()
        ok('これまでのスタジアム設備（Lv4）は、屋根と大型ビジョン・スタジアムグルメになりました' in t and '来月から月' in t, 'the note: Lv4 → 屋根と大型ビジョン・スタジアムグルメ, the upkeep from next month')
        await page.evaluate("[...document.querySelectorAll('#sheet .sec-sec')].find(e => e.textContent.includes('スタジアム設備')).scrollIntoView({block:'center'})"); await shot('old-note')
        await page.locator('#sheet .sec-sec', has_text='スタジアム設備').locator('[data-act="htGo"]').click(); await page.wait_for_timeout(450)
        ok(await page.locator('.ht-tok.built').count() == 2 and await page.locator('.ht-tok.built[data-k="roof"]').count() == 1 and await page.locator('.ht-tok.empty[data-k="shop"]').count() == 1 and await page.locator('.ht-tok.fac em').first.inner_text() == 'Lv4',
           'ホームタウン: 屋根と大型ビジョン and グルメ built, ショップ not yet, 練習場 Lv4')
        await shot('old')
        n = 0; d0 = INFO['oldDate']
        while n < 40:
            n += 1; st = await state()
            if st['date'] >= '2026-11-03': break
            if not await has('#sheet.on'):
                while await has('[data-act="offerNo"]'): await click('[data-act="offerNo"]', 200)
                await click('[data-act="go"]', 300)
            for _ in range(5):
                if not await has('#sheet.on'): break
                if await has('#sheet [data-act="quick"]'):
                    await click('#sheet [data-act="quick"]', 500)
                    if await has('[data-act="mClose"]'): await click('[data-act="mClose"]', 300)
                elif await has('#sheet .card.alert'): await fix_xi()
                elif await has('#sheet [data-act="secAll"]'): await click('#sheet [data-act="secAll"]', 300)
                elif await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 300)
                else: await page.keyboard.press('Escape'); await page.wait_for_timeout(200); break
        st = await state(); c = st['clubs'][st['my']]
        ok(st['date'] >= '2026-11-01' and c['fin']['up'] > 0 and len(c.get('fanH') or []) >= 2, f"old save played on {d0} → {st['date']}: upkeep {money(c['fin']['up'])}, the supporters' history {len(c.get('fanH') or [])} points")

        print('\n'.join(errs) or 'no page errors'); ok(not errs, 'no page errors')
        await b.close()

for vw, vh, board, full in [(393, 852, 'chalk', True), (375, 667, 'white', False)]:
    print(f'--- {vw}x{vh} {board}')
    asyncio.run(main(vw, vh, board, full))
print(f'\n{fails} FAILED' if fails else '\nall ok'); sys.exit(1 if fails else 0)
