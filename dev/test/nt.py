# 代表 in the browser (2026-10-14): the home card from the day squads are named (my players, 初選出 / 活躍枠, Japan's matches),
# players away (the tactics warning, the squad list, the player sheet's 代表 record), the Lカップ as the ルヴァンカップ
# (プライムラウンド ties over two legs, the 1stラウンド by group), the Asian Cup card, an offer from Europe (accept → he goes),
# the records (my internationals, Japan's last matches), iPhone SE and the whiteboard.
# Screenshots: dev/test/shots/nt-*.png. usage: python3 dev/test/nt.py   (KTK_FONTS=<node_modules/@fontsource> for real fonts)
import asyncio, pathlib, os, re, json, subprocess
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
MAKE = r"""
const E = require(process.argv[1] + '/src/engine.js'); const D = require(process.argv[1] + '/data.json');
let x = 7; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-14');
const out = {};
const run = until => {
  for (let g = 0; g < 4000 && S.date < until; g++) {
    const st = E.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { rotate: true }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { if (y.type !== 'nt') y.seen = true; if (y.type === 'offer' && !y.euro) E.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') break;
  }
};
const snap = k => { const c = JSON.parse(JSON.stringify(S)); c.cele = []; out[k] = c; };
// make sure one of mine is in a squad: Thomas Deng (Australia) has the form
const deng = Object.values(S.players).find(p => p.name === 'トーマス デン'); if (deng) { deng.ovr += 3; deng.at = deng.at.map(v => v + 3); }
run('2026-09-17'); snap('call');
run('2026-09-29'); E.autoLineup(S, S.my);
const away = E.squad(S, S.my).find(p => p.away);
if (away) { const c = S.clubs[S.my]; if (!c.tac.xi.includes(away.id)) { const F = E.FORMATIONS[c.tac.form]; let i = F.findIndex(s0 => E.ROLE[s0[0]].dp === E.ppOf(away)); if (i < 0) i = F.length - 1; c.tac.xi[i] = away.id; } }   // in his own position
snap('window');
run('2026-11-16'); snap('qf');
run('2027-01-17'); snap('ac');
const cand = E.squad(S, S.my).filter(p => p.nat === 'JPN' && !p.away && E.age(p, S.date) <= 28).sort((a, b) => b.ovr - a.ovr)[0];
cand.nt = cand.nt || { cc: 'JPN', caps: 1, g: 0, calls: 1, first: '2026-11-05', last: '2026-11-05', ks: ['2026-11-05'] };
E.euroOffer(S, cand); snap('euro');
run('2027-03-30'); snap('sf');
console.log(JSON.stringify({ saves: out, away: away ? away.id : null, cand: cand.id }));
"""
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css', 'dotgothic16/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
DATA = json.loads(subprocess.run(['node', '-e', MAKE, str(ROOT)], capture_output=True, text=True, check=True).stdout)
SAVES = DATA['saves']

async def main(vw, vh, board, bad):
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
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
            await page.evaluate("b => localStorage.setItem('kuratsuku.board', b)", 'white' if board == 'white' else 'chalk')
            await page.evaluate("s => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))", json.dumps(st))
            await page.reload(); await page.wait_for_timeout(500); await page.click('[data-act="continue"]'); await page.wait_for_timeout(600)
        sheet = page.locator('#sheet'); view = page.locator('#view')
        async def shot(name): await page.screenshot(path=str(OUT/f'nt-{name}{tag}.png'))
        async def scroll_to(text, sel='.eyebrow'):
            await page.evaluate("([t, s]) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)); if (el) el.scrollIntoView({block: 'start'}); window.scrollBy(0, -70); }", [text, sel])
            await page.wait_for_timeout(250)
        async def no_overflow(sel, what):
            o = await page.evaluate("s => [...document.querySelectorAll(s)].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 1).length", sel)
            if o: bad.append(f'{what}: {o} overflow ({vw}px)')
        # the call-up: the home card
        await load(SAVES['call'])
        t = await view.inner_text()
        for need in ('代表ウィーク', '日本代表の試合', 'ウルグアイ', 'Jリーグから', 'リーグ戦が中断'):
            if need not in t: bad.append('call card: ' + need)
        if await page.locator('.ntrow').count() < 1: bad.append('call card: my players')
        if '初選出' not in t: bad.append('call card: 初選出')
        await no_overflow('.ntrow', 'nt rows')
        await scroll_to('代表ウィーク'); await shot('call')
        # away: the tactics warning, the squad list, the player sheet
        await load(SAVES['window'])
        await scroll_to('代表ウィーク'); await shot('window')
        if '試合' not in await view.inner_text(): bad.append('window card: results')
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(400)
        if '代表に参加中' not in await view.inner_text(): bad.append('tactics: the away player is flagged')
        await shot('tactics')
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(400)
        if await page.locator('.prow .chip.ntchip').count() < 1: bad.append('squad list: 代表 chip')
        await page.locator('.prow', has=page.locator('.chip.ntchip')).first.click(); await page.wait_for_timeout(400)
        st = await sheet.inner_text()
        if '参加中' not in st or '招集' not in st: bad.append('player sheet: away + 代表 record')
        await sheet.evaluate("e => { const el = [...e.querySelectorAll('.eyebrow')].find(x => x.textContent === '代表'); if (el) el.scrollIntoView({block: 'center'}); }"); await page.wait_for_timeout(200)
        await shot('player'); await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        # the Lカップ after the quarter-finals
        await load(SAVES['qf'])
        await page.click('[data-tab="league"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="lgView"][data-k="cups"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="cupPick"][data-k="lc"]'); await page.wait_for_timeout(400)
        t = await view.inner_text()
        for need in ('プライムラウンド', '準々決勝', '第1戦', '第2戦', '2試合合計', '1stラウンド', 'グループA', '4回戦から', '決勝の日付は'):
            if need not in t: bad.append('Lカップ: ' + need)
        await no_overflow('.cuphead', 'cup head')
        await shot('lcup')
        await page.click('[data-act="cupPick"][data-k="ec"]'); await page.wait_for_timeout(300)
        if '12/23' not in await view.inner_text(): bad.append('天皇杯: the real dates')
        # the Asian Cup
        await load(SAVES['ac'])
        if 'アジアカップ2027' not in await view.inner_text(): bad.append('Asian Cup card')
        await scroll_to('アジアカップ'); await shot('ac')
        # an offer from Europe: accept and he goes
        await load(SAVES['euro'])
        t = await view.inner_text()
        if '本人は海外挑戦を望んでいる' not in t: bad.append('euro offer card')
        await scroll_to('移籍オファー', '.sec-h'); await shot('euro')
        await page.locator('[data-act="offerYes"]').first.click(); await page.wait_for_timeout(500)
        moved = await page.evaluate("id => { const S = " + "JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))" + "; return S.players[id].club; }", DATA['cand'])
        if moved == 'yokohamafm': bad.append('euro offer accepted: the player moved')
        # records
        await load(SAVES['sf'])
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="clView"][data-k="records"]'); await page.wait_for_timeout(300)
        t = await view.inner_text()
        if '日本代表の最近の試合' not in t or 'オーストラリア代表' not in t: bad.append('records: 代表')
        await scroll_to('代表', '.sec-h'); await shot('records')
        for e in errs: bad.append(e)
        await b.close()

bad = []
for vw, vh, board in [(390, 844, 'chalk'), (320, 568, 'chalk'), (390, 844, 'white')]:
    asyncio.run(main(vw, vh, board, bad))
print('\n'.join(bad) if bad else 'nt.py: all OK'); raise SystemExit(1 if bad else 0)
