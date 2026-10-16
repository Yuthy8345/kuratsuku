# キャンプ in the browser (2026-10-16, 作業7, the user's 案A: 北海道・九州・沖縄 in chalk on the board, the destinations
# as magnets; the camp report reviews the 14 days; the summer camp before the opening, the real calendar since 2026/27):
# three weeks before (6/21 of 2027) her question stops the days and opens the map sheet (her pick chosen, the card, who
# can't come), a tap on another magnet changes the card, the pick → the home card; through the camp (the home card on
# its 4th day) to the report (the 14 days, the board's lines, who grew, what happened, the practice matches, the opening)
# and back from the home card; クラブ → 経営 shows the cost; an old save (be3e2da) of 2026/27 has none that season (its
# camp was before the game began). iPhone 16 chalkboard, iPhone SE whiteboard.
# Screenshots dev/test/shots/cp-*.png.
# usage: python3 dev/test/camp.py   (KTK_FONTS=<node_modules/@fontsource> for the real fonts)
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
const tidy = S => { if (S.sec) { E.secSeen(S); S.sec.notes = []; S.sec.back = []; } S.inbox.forEach(y => { y.seen = true; y.done = true; }); if (S.reborn) delete S.reborn.show; };
const play = (S, until, A) => { const X = A || E;
  for (let g = 0; g < 9000 && S.date < until; g++) {
    const st = X.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); X.autoLineup(S, S.my, X.compOf ? { comp: X.compOf(f) } : undefined); const M = X.createMatch(S, f); X.simulateFull(S, M); X.finishMatch(S, M); S.board = Math.max(S.board, 50); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') X.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') X.rollover(S);
    else if (st.stop === 'fired') X.takeJob(S, S.fired.offers[0]);
    else if (st.stop === 'sec' && X.campPending && X.campPending(S)) { X.secSeen(S); }
    else if (st.stop === 'camp') X.campSeen(S);
    else if (st.stop) { if (S.sec && X.secSeen) X.secSeen(S); S.cele = []; if (S.spon && X.sponPending && X.sponPending(S)) X.sponAuto(S); }
  } };
// the day before her question of 2027/28 at 横浜FM: a regular out for a while (only 宮崎's rehab gets him back for the
// opening); the first season has no camp (the game starts after it)
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-16'); E.sponPick(S, E.sponRec(S));
info.first = E.campOf(S).skip;
play(S, '2027-06-20'); if (S.spon && E.sponPending(S)) E.sponPick(S, E.sponRec(S)); tidy(S);
// 2026-10-16: no offer for my players on her day (an offer stops the days first and her sheet comes a day later — fine in
// the game, but this test checks the day she asks)
for (const p of E.squad(S, S.my)) p.keep = true;
const c = S.clubs[S.my];
for (const p of E.squad(S, S.my)) { delete p.bans; if (!p.away) p.inj = 0; p.cond = 100; }
E.autoLineup(S, S.my);
const C = E.campOf(S);
const hurt = S.players[c.tac.xi.find(id => S.players[id].pos !== 'GK' && !S.players[id].away)]; hurt.inj = E.D.diff(C.re, S.date) + 5;
info.jan = { date: S.date, ask: C.ask, from: C.from, to: C.to, re: C.re, rec: E.campRec(S), hurt: hurt.short, away: E.squad(S, S.my).filter(p => p.away).map(p => p.short), funds: c.funds, adj: E.linkAdj(c.tac.form).length };
out.jan = clone(S);
// the 4th day of a 沖縄 camp (the home card)
const R = clone(S); play(R, C.ask); E.secSeen(R); E.campPick(R, 'oki'); play(R, E.D.add(C.from, 3)); tidy(R); out.run = clone(R);
// a new job before her day (2026-10-16): the sponsors of the new club are still to choose (sponJob, no stop) → on her day
// the sponsor sheet opens first, and once they're signed her map follows
const B = clone(S); E.sponOffer(B); out.both = clone(B);
// old saves (be3e2da) of 2026/27: no camp that season
const tmp = path.join(os.tmpdir(), `engine_be3e2da_cp_${process.pid}.js`);
fs.writeFileSync(tmp, execSync('git show be3e2da:dev/src/engine.js', { cwd: path.join(root, '..') }));
const old = require(tmp);
const A = old.newGame(D, 'urawa', '旧', '2026-10-14');
play(A, '2026-12-01', old); for (const p of Object.values(A.players)) if (p.club === A.my) { p.inj = 0; p.sus = 0; } tidy(A);
out.old2 = clone(A); info.old2 = A.date;
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
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
JP = {'hok': '北海道', 'miya': '宮崎', 'oki': '沖縄', 'abr': '海外', 'none': '行かない'}

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
        async def shot(name):
            await page.wait_for_timeout(300); await page.evaluate("document.querySelector('#toast').classList.remove('on')"); await page.wait_for_timeout(200)
            await page.screenshot(path=str(OUT/f'cp-{name}{tag}.png'))
        async def has(sel): return await page.locator(sel).count() > 0
        async def click(sel, w=350): await page.locator(sel).first.click(); await page.wait_for_timeout(w)
        async def txt(sel): return (await page.locator(sel).first.inner_text()).replace('\n', ' ')
        async def save(): return await page.evaluate(LOAD)
        async def top(sel):   # scroll the sheet so that sel is near the top
            await page.evaluate(f"() => {{ const b = document.querySelector('#sheet .sheet-body'); const n = b.querySelector('{sel}'); b.scrollTop = n.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 10; }}")
        async def fits():
            """the map's magnets and labels inside the map, the sheet's text inside the screen, no sideways scroll"""
            return await page.evaluate('''() => { const W = innerWidth, bad = [];
              const m = document.querySelector('#sheet .cpA-map'); if (m) { const q = m.getBoundingClientRect();
                for (const e of m.querySelectorAll('.cpA-tok')) { const r = e.getBoundingClientRect(); if (r.left < q.left - 0.5 || r.right > q.right + 0.5 || r.top < q.top - 0.5 || r.bottom > q.bottom + 0.5) bad.push('tok ' + e.textContent); }
                const t = [...m.querySelectorAll('.cpA-tok')].map(e => e.getBoundingClientRect());
                for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i], b = t[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push('overlap ' + i + '-' + j); } }
              for (const e of document.querySelectorAll('#sheet .sheet-body > *, #sheet .cp-grow .r, #sheet .cp-cal')) { const r = e.getBoundingClientRect(); if (r.left < -0.5 || r.right > W + 0.5) bad.push(e.className); }
              return { bad, hs: document.scrollingElement.scrollWidth > W + 1 }; }''')
        I = INFO['jan']

        # ---- the day before: no card yet; the next day she asks (the days stop) and the map sheet opens on her pick
        ok(INFO['first'], 'the first season (the game starts on 8/7) has no camp')
        await load(SAVES['jan'])
        ok(not await has('.cp-home'), f"{I['date']}: no camp card yet")
        await click('[data-act="go"]', 700)
        st = await save()
        ok(st['date'] == I['ask'] and await has('#sheet .cpA-map'), f"{I['ask']}: the days stop ({st['date']}) and the map sheet opens")
        if not await has('#sheet .cpA-map'): print('   shown instead:', (await page.locator('#sheet.on').inner_text())[:120] if await has('#sheet.on') else 'no sheet', [x.get('type') for x in st['inbox'] if not x.get('seen')])
        toks = await page.locator('#sheet .cpA-tok').count()
        on = await page.locator('#sheet .cpA-tok.on .cpA-lbl b').all_inner_texts()
        rec = I['rec']['k']
        ok(toks == 5 and on and on[0].startswith(JP[rec]), f"five magnets, her pick {JP[rec]} chosen ({on}) — {I['rec']['why']}")
        rl = await txt('#sheet .cp-rec')
        ok(f'おすすめは{JP[rec]}' in rl and (rec != 'oki' or I['hurt'] in rl), f"her suggestion: {rl}")
        card = await txt('#sheet .cpA-pick')
        ok(f'{JP[rec]}キャンプ' in card and '4,000万円' in card and '成長' in card and 'ケガ' in card, f"the card: {card[:60]}…")
        ab = await txt('#sheet .sec-sec')
        ok(I['hurt'] in ab.replace(' ', '') or any(I['hurt'] in x for x in [ab]), f"who can't come: {ab[:90]}…")
        ok(all(a in ab.replace(' ', '') for a in I['away']), f"the Asian Cup players are listed: {I['away']}")
        f = await fits(); ok(not f['bad'] and not f['hs'], f"the map and the sheet fit the screen {f['bad']}")
        intro = await txt('#sheet .sheet-body > p.small')
        ok('7/12' in intro and '7/25' in intro and '14日間' in intro and '開幕' in intro and '13日前' in intro, f"the dates: {intro}")
        await shot('sheet')
        # another magnet: the card follows; then pick it
        await click('#sheet .cpA-tok[data-k="oki"]', 400)
        card = await txt('#sheet .cpA-pick'); btn = await txt('#sheet [data-act="campPick"]')
        ok('沖縄キャンプ' in card and '練習試合5試合分' in card and btn == '沖縄に決める（6,000万円）', f"沖縄: {btn}")
        await shot('sheet-oki')
        await top('.cp-rec'); await shot('sheet-low')
        await click('#sheet [data-act="campPick"]', 500)
        st = await save()
        ok(st['camp']['dest'] == 'oki' and not await has('#sheet.on'), "picked: 沖縄, the sheet closes")
        ok(await has('.cp-home') and '沖縄キャンプ' in await txt('.cp-home'), f"home card: {await txt('.cp-home')}")
        await page.evaluate("() => { const h = document.querySelector('.cp-home'); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 120); }")
        await shot('home-picked')
        # change it from the card: the sheet opens on 沖縄 and says it's decided
        await click('.cp-home [data-act="campOpen"]', 500)
        ok('沖縄に決まっています' in await txt('#sheet .sheet-foot'), 'the sheet again: 沖縄に決まっています')
        await click('#sheet [data-act="closeSheet"]', 300)

        # ---- through the camp to the report
        funds0 = st['clubs'][st['my']]['funds']
        for _ in range(40):
            if await has('#sheet [data-act="campRepDone"]'): break
            if await has('#sheet.on'):
                if await has('#sheet [data-act="quick"]'): await click('#sheet [data-act="quick"]', 200)
                elif await has('#sheet [data-act="closeSheet"]'): await click('#sheet [data-act="closeSheet"]', 200)
                else: await page.evaluate("document.querySelector('#scrim').click()"); await page.wait_for_timeout(250)
                continue
            await click('[data-act="go"]', 500)
        st = await save()
        ok(await has('#sheet [data-act="campRepDone"]') and st['date'] == I['to'], f"the report on the last day ({st['date']})")
        rep = st['camp']['rep']
        ok(st['clubs'][st['my']]['fin']['camp'] == 6000, f"cost paid: {st['clubs'][st['my']]['fin']['camp']}万")
        cells = await page.locator('#sheet .cp-cal > div').count(); balls = await page.locator('#sheet .cp-cal i.ball').count()
        ok(cells == 14 and balls == 5, f"the 14 days: {cells} cells, {balls} practice matches")
        h = await txt('#sheet .cpA-rh')
        ok('沖縄キャンプ' in h and f"参加{rep['n']}人" in h and '6,000万円' in h, f"head: {h}")
        lines = await page.locator('#sheet .cp-pitch svg.lk-lines line:not(.glow)').count()
        ok(lines == len(rep['lk']) and len(rep['lk']) == I['adj'], f"the board: {lines} lines (the XI's {I['adj']} neighbours)")
        ylw = await page.locator('#sheet .cp-pitch svg.lk-lines line.cb').count()
        ok(ylw == sum(1 for x in rep['lk'] if x[3] >= 70 > x[2]), f"yellow = past 70 at the camp: {ylw}")
        sm = await txt('#sheet .cpA-sec .lk-sum')
        ok(f"{int(rep['avg0'])} → {int(rep['avg1'])}" in sm, f"連携: {sm}")
        gr = await page.locator('#sheet .cp-grow .r').count()
        ok(gr == min(5, len(rep['grow'])) and gr > 0, f"who grew: {gr} rows, team +{rep['gsum']}")
        evs = await page.locator('#sheet .cp-ev .r').count()
        ok(evs == len(rep['ev']) and evs >= 2, f"what happened: {evs} ({', '.join(e['k'] for e in rep['ev'])})")
        pmr = await page.locator('#sheet .cp-pmt .r').count()
        ok(pmr == 5, f"practice matches: {pmr}")
        go_ = await txt('#sheet .cpA-go')
        ok('調子 +0.2' in go_ and '開幕は' in go_ and 'あと13日' in go_, f"the opening: {go_}")
        f = await fits(); ok(not f['bad'] and not f['hs'], f"the report fits the screen {f['bad']}")
        await shot('rep')
        await top('.cpA-sec'); await shot('rep-board')
        await top('.cp-grow'); await shot('rep-grow')
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); b.scrollTop = b.scrollHeight; }"); await shot('rep-end')
        await click('#sheet [data-act="campRepDone"]', 400)
        st = await save()
        ok(not st['camp'].get('show') and '沖縄キャンプ 終了' in await txt('.cp-home'), f"after: {await txt('.cp-home')}")
        await click('.cp-home [data-act="campRep"]', 500)
        ok(await has('#sheet [data-act="campRepDone"]'), 'the report again from the home card')
        await page.evaluate("document.querySelector('#scrim').click()"); await page.wait_for_timeout(300)
        # クラブ → 経営
        await click('[data-act="tab"][data-tab="club"]', 400)
        fin = await page.evaluate("() => [...document.querySelectorAll('#view dl.kv dt')].map(d => d.textContent + ' ' + d.nextElementSibling.textContent).join(' / ')")
        ok('キャンプ -6,000万円' in fin, f"経営: {fin[-60:]}")
        await click('[data-act="tab"][data-tab="home"]', 300)

        # ---- the 4th day of the camp: the home card
        await load(SAVES['run'])
        ht = await txt('.cp-home')
        ok('沖縄キャンプ中' in ht and '4日目／14日' in ht, f"in the camp: {ht}")
        await page.evaluate("() => { const h = document.querySelector('.cp-home'); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 120); }")
        await shot('home-run')

        # ---- sponsors still to choose on her day: the sponsor sheet first, then (signed) her map
        await load(SAVES['both'])
        await click('[data-act="go"]', 700)
        ok(await has('#sheet [data-act="spSign"]'), 'sponsors still open on her day: the sponsor sheet first')
        await click('#sheet [data-act="spSign"]', 900)
        ok(await has('#sheet.on .cpA-map'), 'signed → her map sheet follows')

        # ---- an old save (be3e2da) of 2026/27: no camp that season (it was before the game began)
        await load(SAVES['old2'])
        ok(not await has('.cp-home'), f"old save ({INFO['old2']}): no camp card")
        for _ in range(3):
            if await has('#sheet.on'): await page.evaluate("document.querySelector('#scrim').click()"); await page.wait_for_timeout(250)
            await click('[data-act="go"]', 500)
        st = await save()
        ok(st['camp']['skip'] and st['camp']['s'] == 2026 and not st['camp'].get('rep') and st['clubs'][st['my']]['fin'].get('camp', 0) == 0, f"old save: no camp this season ({st['date']})")
        ok(not errs, 'no page errors' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
        await b.close()

asyncio.run(main(393, 852, 'chalk'))
asyncio.run(main(375, 667, 'white'))
print('FAILS', fails); sys.exit(1 if fails else 0)
