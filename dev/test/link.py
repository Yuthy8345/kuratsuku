# 連携とコンボ in the browser (2026-10-15, 作業6, the user's 案A: chalk lines on the board, a card with the combos under
# it, 相性のいい選手 on the player sheet): a new game (every line dotted, nothing yet), the same club from March (thick lines,
# yellow for a combo, the plates and 「あと少し」, the numbers above the board include them), a player's sheet (his partners,
# a tap opens one), the pre-match sheet (連携 and combos, theirs too), the kick-off line in the feed, an old save (be3e2da:
# 連携 estimated from this season's minutes). iPhone 16 chalkboard, iPhone SE whiteboard. Screenshots dev/test/shots/lk-*.png.
# usage: python3 dev/test/link.py   (KTK_FONTS=<node_modules/@fontsource> for the real fonts)
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
const tidy = S => { if (S.sec) { E.secSeen(S); S.sec.notes = []; S.sec.back = []; } S.inbox.forEach(y => { y.seen = true; }); };
// until the day before a date, then on to the manager's next match day (stopped there, not played) where ready(S) holds.
// fix: like a manager who keeps his XI (the secretary's fix when someone is out) instead of the best XI every match
const play = (S, until, A, fix, ready) => { const X = A || E; let at = null;
  for (let g = 0; g < 9000; g++) {
    const st = X.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); if (S.date >= until && (!ready || ready(S))) { at = f; break; }
      const o = X.compOf ? { comp: X.compOf(f) } : undefined;
      if (!fix) X.autoLineup(S, S.my, o); else if (X.lineupIssues(S, S.my).block) { X.secSwapAll(S); if (X.lineupIssues(S, S.my).block) X.autoLineup(S, S.my, o); }
      const M = X.createMatch(S, f); X.simulateFull(S, M); X.finishMatch(S, M); S.board = Math.max(S.board, 50); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') X.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') break;
    else if (st.stop) { if (S.sec && X.secSeen) X.secSeen(S); S.cele = []; if (S.spon && X.sponPending && X.sponPending(S)) X.sponAuto(S); }
  } return at; };
// start: a new game at 横浜FM, her sponsors signed
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-15'); E.sponPick(S, E.sponRec(S)); tidy(S);
out.start = clone(S); info.startAdj = E.linkAdj(S.clubs[S.my].tac.form).length;
// mid: the same club from March, the manager keeping his XI, stopped on the first match day the XI makes a pair combo
// (yellow lines; mid-May usually — 2026-10-16: one run in a few has none by then, so until the last weeks), nobody out
const M = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-15'); E.sponPick(M, E.sponRec(M));
const PAIR = ['hot', 'heart', 'wall', 'wings', 'mentor'];
const fx = play(M, '2027-03-01', null, true, X => { const c = X.clubs[X.my]; return X.date >= '2027-05-26' || E.linkEval(X, X.my, c.tac.form, c.tac.xi).combos.some(it => PAIR.includes(it.k)); }); tidy(M);
// 2026-10-16: in about one run in four no pair combo comes in the whole season (link.js tests the curve) → the nearest one is
// completed here (its pairs at 85) so that the screen can still be checked
info.forced = null;
{ const c = M.clubs[M.my];
  if (!E.linkEval(M, M.my, c.tac.form, c.tac.xi).combos.some(it => PAIR.includes(it.k))) {
    const nr = E.linkEval(M, M.my, c.tac.form, c.tac.xi, { near: true }).near.find(it => PAIR.includes(it.k));
    if (nr) { const w = nr.who; c.lk = c.lk || {}; for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) { const k = Math.min(w[i], w[j]) + '-' + Math.max(w[i], w[j]), e = c.lk[k] || [0, 0]; c.lk[k] = [Math.max(e[0], 85), e[1]]; } info.forced = nr.jp; } } }
for (const p of E.squad(M, M.my)) { p.inj = 0; delete p.bans; delete p.away; p.cond = 100; }
if (E.lineupIssues(M, M.my).block) E.autoLineup(M, M.my);
const mc = M.clubs[M.my], L = E.linkEval(M, M.my, mc.tac.form, mc.tac.xi, { near: true });
const opp = fx.h === M.my ? fx.a : fx.h, oc = M.clubs[opp], OL = E.linkEval(M, opp, oc.tac.form, oc.tac.xi);
const reg = mc.tac.xi.map(id => M.players[id]).sort((a, b) => E.linkPartners(M, b)[0].v - E.linkPartners(M, a)[0].v)[0];
info.mid = { avg: Math.round(L.avg), bonus: L.bonus.toFixed(1), n: L.n, combos: L.combos.map(x => x.jp), near: L.near.slice(0, 3).map(x => x.jp), pairs: L.pairs.map(x => x.slice(0, 3)),
  tiers: L.pairs.map(x => x[2] >= 90 ? 't4' : x[2] >= 70 ? 't3' : x[2] >= 40 ? 't2' : 't1'), rating: E.clubRating(M, M.my), opp: oc.short, oppAvg: Math.round(OL.avg), oppCombos: OL.combos.map(x => x.jp),
  reg: { id: reg.id, short: reg.short, part: E.linkPartners(M, reg).slice(0, 5).map(x => ({ id: x.pid, short: M.players[x.pid].short, v: Math.floor(x.v) })) }, date: M.date };
out.mid = clone(M);
// old: a save of be3e2da (before 連携) in December
const tmp = path.join(os.tmpdir(), `engine_be3e2da_lk_${process.pid}.js`);
fs.writeFileSync(tmp, execSync('git show be3e2da:dev/src/engine.js', { cwd: path.join(root, '..') }));
const old = require(tmp);
const A = old.newGame(D, 'urawa', '旧', '2026-10-14');
play(A, '2026-12-01', old);
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
        async def shot(name):
            await page.wait_for_timeout(300); await page.evaluate("document.querySelector('#toast').classList.remove('on')"); await page.wait_for_timeout(200)
            await page.screenshot(path=str(OUT/f'lk-{name}{tag}.png'))
        async def has(sel): return await page.locator(sel).count() > 0
        async def click(sel, w=350): await page.locator(sel).first.click(); await page.wait_for_timeout(w)
        async def to_board():   # the board's top just under the header
            await page.evaluate("() => { const p = document.querySelector('#view .pitch'); const h = document.querySelector('.hdr').getBoundingClientRect().height; window.scrollTo(0, p.getBoundingClientRect().top + scrollY - h - 8); }")
        async def to_card():
            await page.evaluate("() => { const p = document.querySelector('.lk-card'); const h = document.querySelector('.hdr').getBoundingClientRect().height; window.scrollTo(0, p.getBoundingClientRect().top + scrollY - h - 8); }")
        async def lines():
            return await page.evaluate("() => [...document.querySelectorAll('#view .pitch svg.lk-lines line:not(.glow)')].map(l => l.getAttribute('class'))")
        async def fits():
            """the card and the board inside the screen, no sideways scroll, every plate's text inside its plate"""
            return await page.evaluate('''() => { const W = innerWidth, bad = [];
              for (const e of document.querySelectorAll('.lk-card, .lk-plate, .lk-wrow, #view .pitch')) { const r = e.getBoundingClientRect(); if (r.left < -0.5 || r.right > W + 0.5) bad.push(e.className); }
              for (const e of document.querySelectorAll('.lk-plate b, .lk-plate .lk-fx, .lk-wrow b')) { const r = e.getBoundingClientRect(), q = e.closest('.lk-plate, .lk-wrow').getBoundingClientRect(); if (r.right > q.right + 0.5) bad.push('text ' + e.textContent); }
              return { bad, hs: document.scrollingElement.scrollWidth > W + 1 }; }''')

        # ---- a new game: the board's neighbours as dotted lines, nothing yet
        await load(SAVES['start'])
        await click('[data-act="tab"][data-tab="tactics"]', 400)
        ls = await lines()
        ok(len(ls) == INFO['startAdj'] and all(x == 't1' for x in ls), f"new game: {len(ls)} dotted lines between neighbours (formation has {INFO['startAdj']})")
        txt = await page.locator('.lk-card').inner_text()
        ok('平均0' in txt.replace(' ', '').replace('\n', '') and 'コンボ 0/3' in txt and 'まだありません' in txt, 'new game: average 0, コンボ 0/3, まだありません')
        if vw >= 390: await to_board(); await shot('start')

        # ---- mid-season: the lines, the card, the numbers above the board
        I = INFO['mid']
        await load(SAVES['mid'])
        await click('[data-act="tab"][data-tab="tactics"]', 400)
        ls = await lines()
        cb = await page.locator('#view .pitch svg.lk-lines line.cb').count()
        ok(len(ls) >= len(I['tiers']) and [x.split(' ')[0] for x in ls[:len(I['tiers'])]] == I['tiers'], f"mid-season ({I['date']}): {len(ls)} lines, thickness as the engine says ({', '.join(f'{t}×{I['tiers'].count(t)}' for t in ['t1', 't2', 't3', 't4'])})")
        pair = any(c in I['combos'] for c in ['ホットライン', '中盤の心臓', '鉄壁', '両翼', '師弟'])
        ok(pair and cb > 0, f"mid-season ({I['date']}): a pair combo ({'・'.join(I['combos'])}), {cb} yellow lines" + (f" — none came this season, {INFO['forced']} completed by hand" if INFO.get('forced') else ''))
        txt = (await page.locator('.lk-card').inner_text()).replace('\n', ' ')
        ok(f"平均{I['avg']}" in txt.replace(' ', '') and f"+{I['bonus']}" in txt, f"mid-season ({I['date']}): 平均 {I['avg']}・チーム力 +{I['bonus']}")
        plates = await page.locator('.lk-plate b').all_inner_texts()
        ok(plates == I['combos'], f"mid-season ({I['date']}): plates {plates} = engine {I['combos']}")
        subs = await page.locator('.lk-plate small').all_inner_texts()
        ok(all(('生まれ' in t) == (pl == '地元の星') and ('ユース出身' in t) == (pl == '生え抜きの誇り') for pl, t in zip(plates, subs)), f"the plates say who: {' / '.join(subs)}")
        near = await page.locator('.lk-wrow b').all_inner_texts()
        ok(near == I['near'], f"mid-season ({I['date']}): 「あと少し」 {near}")
        prog = await page.locator('.lk-wrow .pg > span:last-child').all_inner_texts()
        nums = [re.findall(r'\d+', t) for t in prog]
        ok(all(int(n[0]) < int(n[1]) for n in nums if len(n) == 2), f"「あと少し」 shows each below its bar ({', '.join(prog)}; 74.7 of 75 reads 74)")
        tr = await page.locator('.trate b').all_inner_texts()
        R = I['rating']
        ok([int(x) for x in tr] == [round(R['att']), round(R['mid']), round(R['def'])], f"the numbers above the board include 連携 and combos: {tr}")
        f = await fits(); ok(not f['bad'] and not f['hs'], f"the board and the card fit the screen {f['bad']}")
        # iPhone's Safari drew no dotted line that was exactly upright or level (2026-10-17: 4-1-4-1's RSH–RSB)
        flat = await page.evaluate("() => [...document.querySelectorAll('.lk-lines line, .lk-leg line')].filter(l => ['x', 'y'].some(a => +l.getAttribute(a + '1') === +l.getAttribute(a + '2'))).length")
        ok(flat == 0, f"no chalk line is exactly upright or level (Safari): {flat}")
        box = await page.evaluate("() => [...document.querySelectorAll('.lk-lines g[filter]')].map(g => g.firstElementChild && g.firstElementChild.matches('rect.lk-box') && g.firstElementChild.getAttribute('width') === '100')")
        ok(box and all(box), f"the chalk lines' group starts with the board-sized box (WebKit cut the rightmost upright line): {box}")
        await to_board(); await shot('board')
        await to_card(); await shot('card')

        # ---- a player's sheet: 相性のいい選手, a tap opens the partner
        rg = I['reg']
        await page.evaluate(f"() => {{ document.querySelector('#view').insertAdjacentHTML('beforeend', '<button id=\"lk-open\" data-act=\"player\" data-id=\"{rg['id']}\" hidden>x</button>'); document.querySelector('#lk-open').click(); }}")
        await page.wait_for_timeout(500)
        rows = await page.locator('#sheet .lk-prow .nm b').all_inner_texts()
        vals = await page.locator('#sheet .lk-prow .v').all_inner_texts()
        ok([re.sub(r'(ホットライン|中盤の心臓|鉄壁|両翼|師弟)', '', r) for r in rows] == [x['short'] for x in rg['part']] and [int(v) for v in vals] == [x['v'] for x in rg['part']], f"{rg['short']}'s sheet: {', '.join(f'{r} {v}' for r, v in zip(rows, vals))}")
        hi = await page.evaluate("() => [...document.querySelectorAll('#sheet .lk-prow')].map(r => [!!r.querySelector('.lk-tag'), r.querySelector('.lk-cbar').classList.contains('hi')])")
        ok(all(a == b for a, b in hi), f"the sheet: a yellow bar only with a combo tag ({sum(1 for a, b in hi if b)} of {len(hi)})")
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const n = [...b.querySelectorAll('.eyebrow')].find(e => e.textContent.includes('相性')); b.scrollTop = n.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 12; }")
        await shot('sheet')
        await page.locator('#sheet .lk-prow').first.click(); await page.wait_for_timeout(400)
        h2 = await page.locator('#sheet h2').inner_text()
        ok(rg['part'][0]['short'] in h2.replace(' ', '') or h2.startswith(rg['part'][0]['short']), f"a tap opens {h2}")
        await click('#sheet [data-act="closeSheet"]', 300)

        # ---- the pre-match sheet and the kick-off
        await click('[data-act="go"]', 600)
        ok(await has('#sheet .pre-lk'), 'the pre-match sheet: 連携 and combos')
        pre = (await page.locator('#sheet .pre-lk').inner_text()).replace('\n', ' ')
        mine = '・'.join(I['combos']) or 'なし'; theirs = '・'.join(I['oppCombos']) or 'なし'
        ok(f"連携 {I['avg']}" in pre and mine in pre and f"{I['opp']}：連携 {I['oppAvg']}" in pre and theirs in pre, f"pre-match: {pre}")
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const n = b.querySelector('.pre-lk'); b.scrollTop = n.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 160; }")
        await shot('pre')
        await click('#sheet [data-act="kickoff"]', 1500)
        feed = await page.locator('#feed li.combo').all_inner_texts()
        ok(bool(feed) == bool(I['combos'] or I['oppCombos']) and all('【コンボ】' in x for x in feed), f"kick-off: {' / '.join(x.replace(chr(10), ' ') for x in feed)}")
        await shot('feed')

        # ---- an old save (be3e2da): 連携 from this season's minutes (the board and a regular's sheet)
        await load(SAVES['old'])
        await click('[data-act="tab"][data-tab="tactics"]', 400)
        ls = await lines(); solid = sum(1 for x in ls if x.split(' ')[0] != 't1')
        avg = (await page.locator('.lk-sum b').inner_text()).strip()
        ok(solid >= len(ls) // 2 and int(avg) >= 30, f"old save ({INFO['oldDate']}): the board has solid lines ({solid} of {len(ls)}), average {avg}")
        if vw < 390: await to_board(); await shot('old')
        await click('[data-act="tab"][data-tab="squad"]', 400)
        await page.locator('#view .prow').first.click(); await page.wait_for_timeout(500)
        n = await page.locator('#sheet .lk-prow').count()
        ok(n == 5, f"old save: a regular's sheet lists {n} partners")
        await click('#sheet [data-act="closeSheet"]', 300)
        ok(not errs, 'no page errors' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
        await b.close()

asyncio.run(main(393, 852, 'chalk'))
asyncio.run(main(375, 667, 'white'))
print('FAILS', fails); sys.exit(1 if fails else 0)
