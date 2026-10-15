# 秘書 in the browser (2026-10-15): the magnet above the dock (on the home screen with what she has to say, elsewhere the
# magnet and a count), her sheet (one place at a time, おすすめどおり), the pre-match sheet (one tap and it's キックオフ),
# the tactics screen, a player back (戻す), the month's summary and the youth report, her name (club → 経営), a new game's
# hello, iPhone 16 / SE, chalkboard / whiteboard. Nothing changes until a button is pressed.
# Screenshots: dev/test/shots/sec-*.png. usage: python3 dev/test/secretary.py   (KTK_FONTS=<node_modules/@fontsource> for real fonts)
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
let x = 11; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const clone = o => { const c = JSON.parse(JSON.stringify(o)); c.cele = []; return c; };
const out = {};
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-14');
out.hello = clone(S);
const play = until => {
  for (let g = 0; g < 4000 && S.date < until; g++) {
    const st = E.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  }
};
play('2026-08-27'); E.secSeen(S);
const c = S.clubs[S.my]; E.autoLineup(S, S.my);
for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; }
const F = E.FORMATIONS[c.tac.form];
const cb = S.players[c.tac.xi[F.findIndex(s => s[0] === 'CB')]], fw = S.players[c.tac.xi[F.length - 1]], bp = S.players[c.tac.bench[2]];
E.addBan(cb, { c: 'lg', n: 1, y: 1 }); fw.inj = 9; bp.inj = 4;
out.out = clone(S);
const info = { cb: cb.id, fw: fw.id, bp: bp.id, fix: E.secFix(S).items.map(i => ({ id: i.id, out: i.out, cand: i.cand })) };
E.secSwapAll(S);
for (let g = 0; g < 30 && !E.secReturns(S).some(m => m.out === cb.id); g++) { const st = E.advance(S, 1); if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); } if (E.lineupIssues(S, S.my).block) E.secSwapAll(S); }
for (const p of E.squad(S, S.my)) if (p.id !== fw.id && p.id !== bp.id) p.inj = 0;
E.secSeen(S); info.backDate = S.date;
out.back = clone(S);
S.sec.back = []; E.autoLineup(S, S.my);
for (let g = 0; g < 60 && !(E.D.d(S.date) === 1); g++) { const st = E.advance(S, 1); if (st.stop === 'match') { E.autoLineup(S, S.my); const f = S.fixtures.find(y => y.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); } }
for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(S, S.my); S.sec.back = [];
out.month = clone(S);
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
        async def shot(name): await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/f'sec-{name}{tag}.png'))
        async def state(): return await page.evaluate(LOAD)
        sheet = page.locator('#sheet')
        async def fits(sel):
            """the element is inside the viewport and not under the dock"""
            r = await page.evaluate('''s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), d = document.querySelector('.dock').getBoundingClientRect(); return [r.top, r.bottom, d.top, innerHeight]; }''', sel)
            return r and r[0] >= 0 and r[1] <= min(r[2], r[3]) + 0.5

        # ---- a new game: hello
        await load(SAVES['hello'])
        txt = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        ok('はじめまして' in txt and 'あき' in txt, f'new game: she says hello ({txt.splitlines()[0] if txt else "-"})')
        ok(await fits('#sec-float .sec-bub') and await fits('#sec-float .sec-mag'), 'the bubble and the magnet are above the dock')
        await shot('hello')
        await page.click('#sec-float .sec-mag'); await page.wait_for_timeout(350)
        ok('はじめまして' in await sheet.inner_text(), 'her sheet: the hello note')
        await page.click('#sheet [data-act="secDone"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        ok(await page.locator('#sec-float').count() == 0, 'nothing more to say: no magnet')

        # ---- players who can't play: the bubble at home, nothing changed yet
        await load(SAVES['out'])
        st0 = await state(); xi0 = st0['clubs'][st0['my']]['tac']['xi']
        bub = await page.locator('#sec-float .sec-bub').inner_text()
        ok('出られない選手が3人' in bub, f'home: {bub.splitlines()[0]}')
        ok((await page.locator('#sec-float .aki-badge').inner_text()).strip() == '3', 'the magnet shows 3')
        ok(await fits('#sec-float .sec-bub'), 'the bubble is above the dock')
        await shot('home-out')
        for t in ['squad', 'tactics', 'league', 'club']:
            await page.click(f'[data-tab="{t}"]'); await page.wait_for_timeout(150)
            ok(await page.locator('#sec-float .sec-mag').count() == 1 and await page.locator('#sec-float .sec-bub').count() == 0 and await fits('#sec-float .sec-mag'), f'{t}: just the magnet, above the dock / switch bar')
            if t != 'home':
                sn = await page.evaluate("() => { const m = document.querySelector('#sec-float .sec-mag').getBoundingClientRect(), s = document.querySelector('#view > .subnav'); return s ? m.bottom <= s.getBoundingClientRect().top + 1 : true; }")
                ok(sn, f'{t}: the magnet sits above the switch bar')
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        ok(await page.locator('.card.alert .sec-line').count() == 1 and await page.locator('.card.alert [data-act="secAll"]').count() == 1, 'tactics: her line and the one-tap button in the warning')
        await page.evaluate('scrollTo(0,0)'); await shot('tactics')
        await page.click('[data-tab="home"]'); await page.wait_for_timeout(150)
        st = await state(); ok(st['clubs'][st['my']]['tac']['xi'] == xi0, 'nothing changed by looking')
        # her sheet: one place, then all
        await page.click('#sec-float .sec-bub'); await page.wait_for_timeout(400)
        ok(await page.locator('#sheet .sec-row').count() == 3, 'her sheet: three places with a stand-in each')
        await shot('sheet-out')
        one = INFO['fix'][0]
        await page.click(f'#sheet [data-act="secOne"][data-id="{one["id"]}"]'); await page.wait_for_timeout(350)
        st = await state(); xi = st['clubs'][st['my']]['tac']['xi']
        ok(one['cand'] in xi and one['out'] not in xi and sum(a != b for a, b in zip(xi, xi0)) == 1, '入れ替える: that place only')
        ok(await page.locator('#sheet .sec-row').count() == 2, 'two left')
        await page.click('#sheet [data-act="secAll"]'); await page.wait_for_timeout(400)
        st = await state(); c = st['clubs'][st['my']]
        ok(all(i not in c['tac']['xi'] + c['tac']['bench'] for i in (INFO['cb'], INFO['fw'], INFO['bp'])), 'おすすめどおり: the three are out of the team')
        ok(await page.locator('#sheet .sec-row').count() == 0 and await page.locator('[data-tab="tactics"] .dot').count() == 0, 'nothing left to fix, no dot on 戦術')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)

        # ---- the pre-match sheet: one tap and it's キックオフ
        await load(SAVES['out'])
        await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        if not await page.locator('#sheet [data-act="secAll"]').count(): await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        ok(await page.locator('#sheet .card.alert .sec-line').count() == 1 and await page.locator('#sheet [data-act="kickoff"]').count() == 0, 'pre-match: blocked, her line with the stand-ins')
        await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const a = b.querySelector('.card.alert'); b.scrollTop = a.offsetTop - 40; }")
        await shot('prematch')
        ok(await page.evaluate('''() => { const r = document.querySelector('#sheet [data-act="secAll"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }'''), 'the one-tap button is on screen')
        await page.click('#sheet [data-act="secAll"]'); await page.wait_for_timeout(450)
        ok(await page.locator('#sheet [data-act="kickoff"]').count() == 1 and await page.locator('#sheet .card.alert').count() == 0, 'one tap → キックオフ')
        await shot('prematch-fixed')
        # 1人ずつ選ぶ from the pre-match sheet comes back to it
        await load(SAVES['out'])
        await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        if not await page.locator('#sheet [data-act="secAll"]').count(): await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        await page.click('#sheet [data-act="secOpen"]'); await page.wait_for_timeout(400)
        ok(await page.locator('#sheet [data-act="secPre"]').count() == 1, '1人ずつ選ぶ: her sheet with 試合前に戻る')
        for _ in range(3):
            if await page.locator('#sheet [data-act="secOne"]').count(): await page.locator('#sheet [data-act="secOne"]').first.click(); await page.wait_for_timeout(350)
        ok(await page.locator('#sheet [data-act="kickoff"]').count() == 1, 'after the last one: back to the pre-match sheet, キックオフ')

        # ---- a player back: 戻す
        await load(SAVES['back'])
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        ok('戻しますか' in bub and '出場停止明け' in bub, f'home: {bub.splitlines()[0] if bub else "-"}')
        ok(await fits('#sec-float [data-act="secBack"]'), 'the 戻す button is above the dock')
        await shot('home-back')
        st = await state(); c = st['clubs'][st['my']]; m = next(x for x in st['sec']['back'] if x['out'] == INFO['cb'])
        i = c['tac']['xi'].index(m['sub'])
        to_bench = 'ベンチへ' in bub
        await page.click('#sec-float [data-act="secBack"]'); await page.wait_for_timeout(350)
        st = await state(); c = st['clubs'][st['my']]
        ok(c['tac']['xi'][i] == INFO['cb'] and (m['sub'] in c['tac']['bench']) == to_bench, f'戻す: back in the XI, the stand-in {"on the bench" if to_bench else "out of the squad"} as she said')
        ok(not await page.locator('#sec-float [data-act="secBack"]').count(), 'the bubble goes')

        # ---- the month's summary and the youth report
        await load(SAVES['month'])
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        ok('月になりました' in bub, f'home: {bub.splitlines()[0] if bub else "-"}')
        await shot('home-month')
        await page.click('#sec-float .sec-bub'); await page.wait_for_timeout(400)
        t = await sheet.inner_text()
        ok(all(k in t for k in ['順位', '次の大一番', '資金', '若手']), 'the summary: place, big match, money, young players')
        await shot('sheet-month')
        if await page.locator('#sheet [data-act="youthOpen"]').count():
            await page.click('#sheet [data-act="youthOpen"]'); await page.wait_for_timeout(350)
            ok('若手の成長レポート' in await sheet.inner_text(), 'the youth report opens')
            await page.click('#sheet [data-act="secOpen"]'); await page.wait_for_timeout(350)
            ok('のまとめ' in await sheet.inner_text(), 'back to her sheet')
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        ok(await page.locator('#sec-float').count() == 0, 'seen: the magnet goes')
        ok(await page.locator('[data-act="youthDone"]').count() == 0, 'no youth card on the home screen any more')

        # ---- her name: club → 経営
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(250)
        await page.evaluate("document.querySelector('.sec-card').scrollIntoView({block:'center'})"); await page.wait_for_timeout(150)
        ok('秘書 あき' in await page.locator('.sec-card').inner_text(), 'club → 経営: 秘書 あき')
        await shot('club')
        await page.click('.sec-card [data-act="secName"]'); await page.wait_for_timeout(350)
        ok(await page.evaluate("document.activeElement && document.activeElement.id") != 'sec-name', 'the name field is not focused by itself')
        await shot('name')
        await page.fill('#sec-name', 'みさき'); await page.press('#sec-name', 'Enter'); await page.wait_for_timeout(150)
        ok(await page.locator('#sheet.on').count() == 1, 'Enter only closes the keyboard')
        await page.click('#sheet [data-act="secNameSave"]'); await page.wait_for_timeout(350)
        st = await state(); ok(st['sec']['name'] == 'みさき' and '秘書 みさき' in await page.locator('.sec-card').inner_text(), 'renamed: みさき')
        await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        st = await state(); ok(st['sec']['name'] == 'みさき', 'the name is saved')
        print('\n'.join(errs) or 'no page errors'); ok(not errs, 'no page errors')
        await b.close()

for vw, vh, board in [(393, 852, 'chalk'), (375, 667, 'white')]:
    print(f'--- {vw}x{vh} {board}')
    asyncio.run(main(vw, vh, board, True))
print(f'\n{fails} FAILED' if fails else '\nall ok'); sys.exit(1 if fails else 0)
