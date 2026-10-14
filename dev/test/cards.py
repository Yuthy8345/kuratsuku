# Bans per competition on screen: the day of a 天皇杯 tie with starter A banned in the league and starter B in the 天皇杯.
# Only B blocks the tie, A may play it (his slot picker says リーグは出場停止); after the tie A blocks the next league game.
# Chips say which competition (出場停止（リーグ）), the player sheet how many games in each.
import asyncio, pathlib, json, subprocess
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
# a save on the morning of the first 天皇杯 tie (league games before it played with the best XI)
GEN = r'''
const E = require('./src/engine.js'), DATA = require('./data.json');
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-10');
for (let i = 0; i < 2000; i++) {
  const r = E.advance(S);
  if (r.stop === 'inbox') { for (const it of S.inbox) it.seen = true; continue; }
  if (r.stop !== 'match') continue;
  const f = S.fixtures.find(x => x.id === r.fid);
  if (f.cup === 'ec') break;
  E.autoLineup(S, S.my); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M);
}
for (const p of Object.values(S.players)) if (p.club === S.my) { p.sus = 0; delete p.csus; p.inj = 0; }
E.autoLineup(S, S.my);
const xi = S.clubs[S.my].tac.xi.filter(id => S.players[id].pos !== 'GK');
const A = xi[0], B = xi[1];
E.setSus(S.players[A], 'lg', 1); E.setSus(S.players[B], 'ec', 1);
// reserves: one waiting for the committee (league), one with a ban for any official match
const res = E.squad(S, S.my).filter(p => !S.clubs[S.my].tac.xi.includes(p.id) && !S.clubs[S.my].tac.bench.includes(p.id) && p.pos !== 'GK');
const K = res[0].id, W = res[1].id;
S.players[K].bans = [{ c: 'lg', n: 1, r: 'sfp', x: 0, tot: 3, dd: E.D.add(S.date, 1) }];
S.players[W].bans = [{ c: '*', n: 2, r: 'vc' }];
process.stdout.write(JSON.stringify({ A, B, K, W, S }));
'''
gen = json.loads(subprocess.run(['node', '-e', GEN], cwd=str(ROOT), capture_output=True, text=True, check=True).stdout)
A, B, K, W, SAVE = gen['A'], gen['B'], gen['K'], gen['W'], gen['S']
def bans(pl, c=None): return sum(b['n'] for b in pl.get('bans', []) if c is None or b['c'] == c)
fails = 0
def ok(c, m):
    global fails
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails += 1
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        async def state(): return await page.evaluate(LOAD)
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''(s) => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))''', json.dumps(SAVE))
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        st = await state(); nA, nB = st['players'][str(A)]['name'], st['players'][str(B)]['name']
        print('A (league ban)', nA, '| B (天皇杯 ban)', nB, '| date', st['date'])
        # tactics before the 天皇杯 tie: only B is out
        await page.click('[data-act="tab"][data-tab="tactics"]'); await page.wait_for_timeout(300)
        banner = await page.locator('.card.alert').inner_text() if await page.locator('.card.alert').count() else ''
        ok(nB in banner and '天皇杯であと1試合' in banner and nA not in banner, f'banner names B only: {banner.splitlines()[1:2]}')
        outs = await page.locator('.tok.out').count(); ok(outs == 1, f'one × on the board ({outs})')
        await page.evaluate('window.scrollTo(0, 0)'); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'cards-tactics-cup.png'))
        # B's slot: A's row says リーグは出場停止 and can still be picked
        await page.click('.tok.out'); await page.wait_for_timeout(350)
        rowA = page.locator(f'#sheet [data-act="assign"][data-id="{A}"]')
        ok('リーグは出場停止' in await rowA.inner_text() and await rowA.get_attribute('disabled') is None, 'slot picker: A shows リーグは出場停止 and is selectable')
        rowB = page.locator(f'#sheet [data-act="assign"][data-id="{B}"]')
        ok(await rowB.get_attribute('disabled') is not None, 'slot picker: B is disabled')
        await rowA.scroll_into_view_if_needed(); await page.wait_for_timeout(150)
        await page.screenshot(path=str(OUT/'cards-slot.png'))
        await page.evaluate('''(b) => [...document.querySelectorAll('#sheet [data-act="assign"]:not([disabled])')].find(e => !e.textContent.includes('先発') && !e.textContent.includes('ベンチ') ).click()''', B); await page.wait_for_timeout(300)
        ok(await page.locator('.card.alert').count() == 0, 'after swapping B out, the tie can start')
        # squad list chips
        await page.click('[data-act="tab"][data-tab="squad"]'); await page.wait_for_timeout(300)
        tA = await page.locator(f'[data-act="player"][data-id="{A}"]').inner_text(); tB = await page.locator(f'[data-act="player"][data-id="{B}"]').inner_text()
        ok('出場停止（リーグ）' in tA and '出場停止（天皇杯）' in tB, 'squad list: 出場停止（リーグ） / 出場停止（天皇杯）')
        tW = await page.locator(f'[data-act="player"][data-id="{W}"]').inner_text(); ok('出場停止（公式戦）' in tW, 'squad list: a ban for any official match says 出場停止（公式戦）')
        await page.click(f'[data-act="player"][data-id="{K}"]'); await page.wait_for_timeout(350)
        shk = await page.locator('#sheet').inner_text(); ok('出場停止（リーグ あと1試合・規律委員会で検討中）' in shk, 'player sheet: 規律委員会で検討中 before the decision')
        await page.screenshot(path=str(OUT/'cards-pending.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(200)
        await page.locator(f'[data-act="player"][data-id="{A}"]').scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'cards-squad.png'))
        await page.click(f'[data-act="player"][data-id="{A}"]'); await page.wait_for_timeout(350)
        sh = await page.locator('#sheet').inner_text(); ok('出場停止（リーグ あと1試合）' in sh, 'player sheet: 出場停止（リーグ あと1試合）')
        await page.screenshot(path=str(OUT/'cards-sheet.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(200)
        # play the tie
        await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        ok(await page.locator('#sheet [data-act="quick"]').count() == 1, 'prematch: the tie can be played')
        await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(300); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(300)
        st = await state(); pa, pb, pk, pw = (st['players'][str(i)] for i in (A, B, K, W))
        ok(bans(pa, 'lg') == 1 and bans(pb) == 0, f"after the tie: A still has his league ban ({pa.get('bans')}), B served his ({pb.get('bans')})")
        ok(bans(pk, 'lg') == 1 and any(b.get('tot') for b in pk.get('bans', [])), "K's straight red still waits for the committee on the day")
        ok(bans(pw, '*') == 1, f"the 天皇杯 tie served one game of W's ban for any official match ({pw.get('bans')})")
        # next league game: A blocks
        await page.click('[data-act="tab"][data-tab="tactics"]'); await page.wait_for_timeout(300)
        if A in st['clubs']['yokohamafm']['tac']['xi']:
            banner = await page.locator('.card.alert').inner_text() if await page.locator('.card.alert').count() else ''
            ok(nA in banner and 'リーグであと1試合' in banner, 'before the league game: A blocks (リーグであと1試合)')
            ok(await page.locator('[data-tab="tactics"] .dot').count() == 1, 'tactics tab shows the dot')
            await page.screenshot(path=str(OUT/'cards-tactics-league.png'))
        else: ok(False, 'A was not in the XI after the tie')
        # the next morning the committee decides
        await page.click('[data-act="go"]'); await page.wait_for_timeout(500)
        if await page.locator('#sheet [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(200)
        st = await state(); pk = st['players'][str(K)]
        ok(st['date'] > '2026-09-16' and bans(pk, 'lg') == 3 and not any(b.get('tot') for b in pk.get('bans', [])), f"next day the committee decided K's ban: {pk.get('bans')}")
        ok(any('規律委員会' in n['text'] for n in st['news'][:10]), 'news of the decision')
        # whiteboard look
        await page.evaluate("document.documentElement.dataset.board = 'white'"); await page.wait_for_timeout(150)
        await page.click('[data-act="tab"][data-tab="squad"]'); await page.wait_for_timeout(300)
        await page.locator(f'[data-act="player"][data-id="{A}"]').scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'cards-squad-white.png'))
        ok(not errs, '\n'.join(errs) or 'no page errors')
        await b.close()
asyncio.run(main())
print(f'\n{fails} FAILED' if fails else '\nall ok')
