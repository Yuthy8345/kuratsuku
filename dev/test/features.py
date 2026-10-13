# 2026-10-13 features in the browser: ② 背番号の変更 / ③ 海外組 (market + player sheet) / ④ 他チーム情報 (ticket, table,
# pre-match, back navigation) / ⑤ 12 shapes + 詳しい指示 (tactics screen, saved) / ⑥ 優勝のお祝い (league + cup pop-ups).
# Screenshots go to dev/test/shots/feat-*.png. usage: python3 dev/test/features.py   (KTK_FONTS=... for the real fonts)
import asyncio, pathlib, os, re, json, subprocess
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
# saves made with the engine: a new game, and one where the league title was just won (+ a cup final, for the second pop-up)
MAKE = r"""
const E = require('/home/claude/kuratsuku/dev/src/engine.js'); const D = require('/home/claude/kuratsuku/dev/data.json');
const fresh = E.newGame(D, 'kashima', 'ソーイ', '2026-10-13');
const S = E.newGame(D, 'kashima', 'ソーイ', '2026-10-13');
for (const p of E.squad(S, S.my)) { p.at = p.at.map(x => x + 14); p.ovr = E.calcOvr(p); p.pot = Math.max(p.pot, Math.ceil(p.ovr)); }
for (let g = 0; g < 3000 && !(S.cele || []).some(c => c.k === 'j1'); g++) {
  const st = E.advance(S);
  if (st.stop === 'match') { const f = S.fixtures.find(x => x.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); }
  else if (st.stop === 'inbox') S.inbox.forEach(x => { x.seen = true; if (x.type === 'offer') E.rejectOffer(S, x.id); });
  else if (st.stop === 'seasonEnd') break;
}
S.cele = S.cele.filter(c => c.k === 'j1');
const sc = E.squad(S, S.my).sort((a, b) => b.st.g - a.st.g);
S.cele.push({ k: 'ec', season: S.season, d: '2027-01-01', opp: 'urawa', my: 2, op: 1, pk: null, goals: [{ m: 23, name: sc[0].name }, { m: 88, name: sc[1].name }], n: 6, venue: '国立競技場', mgr: S.manager });
console.log(JSON.stringify({ fresh, cele: S }));
"""
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css', 'dotgothic16/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
SAVES = json.loads(subprocess.run(['node', '-e', MAKE], capture_output=True, text=True, check=True).stdout)

async def main(vw=390, vh=844, tag=''):
    css = font_css(); bad = []
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
        async def load(st):
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
            await page.evaluate("s => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))", json.dumps(st))
            await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
        sheet = page.locator('#sheet')
        async def shot(name, full=False): await page.screenshot(path=str(OUT/f'feat-{name}{tag}.png'), full_page=full)
        def fits(bb): return bb and bb['y'] >= 0 and bb['y'] + bb['height'] <= vh + 1

        # ---------- ④ the next opponent from the home ticket ----------
        await load(SAVES['fresh'])
        await shot('home')
        await page.click('.ticket-scout'); await page.wait_for_timeout(450)
        h2 = await sheet.locator('h2').first.inner_text(); print('team sheet:', h2)
        if '横浜' not in h2: bad.append('ticket -> team sheet')
        for need in ('チーム力の比較', '戦い方', '主力選手', '今季の対戦'):
            if need not in await sheet.inner_text(): bad.append('team sheet: ' + need)
        await shot('team')
        await sheet.locator('[data-act="teamTab"][data-k="squad"]').click(); await page.wait_for_timeout(300)
        n = await sheet.locator('.prow').count(); print('squad rows', n); bad += [] if n >= 20 else ['team squad tab']
        await shot('team-squad')
        await sheet.locator('.prow').first.click(); await page.wait_for_timeout(300)
        back = sheet.locator('[data-act="playerBack"]'); bad += [] if await back.count() else ['player -> back to team']
        await back.click(); await page.wait_for_timeout(300)
        if await sheet.locator('[data-act="teamTab"][data-k="squad"][aria-pressed="true"]').count() != 1: bad.append('back keeps the squad tab')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(350)
        # from the league table
        await page.click('[data-tab="league"]'); await page.wait_for_timeout(250)
        await page.locator('.tbl tr[data-act="team"]').nth(5).click(); await page.wait_for_timeout(400)
        bad += [] if await sheet.locator('.team-head').count() else ['table row -> team sheet']
        await page.keyboard.press('Escape'); await page.wait_for_timeout(350)

        # ---------- ⑤ shapes and instructions ----------
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(250)
        nf = await page.locator('.formgrid button').count(); print('shapes', nf); bad += [] if nf == 12 else ['12 shapes']
        bb = await page.locator('.formgrid').bounding_box(); bad += [] if bb and bb['width'] <= vw else ['formgrid width']
        await page.click('.formgrid [data-k="5-3-2"]'); await page.wait_for_timeout(250)
        await shot('tactics')
        await page.locator('[data-act="tacx"][data-key="line"][data-k="low"]').click(); await page.wait_for_timeout(150)
        await page.locator('[data-act="tacx"][data-key="build"][data-k="long"]').click(); await page.wait_for_timeout(150)
        await page.locator('[data-act="tacx"][data-key="mark"]').click(); await page.wait_for_timeout(150)
        await page.locator('.card.tacx').scroll_into_view_if_needed(); await page.wait_for_timeout(150)
        await shot('tactics-x')
        st = await page.evaluate(LOAD); t = st['clubs'][st['my']]['tac']
        print('saved tac:', t['form'], t.get('line'), t.get('build'), t.get('width'), t.get('mark'), t.get('kill'))
        bad += [] if (t['form'], t.get('line'), t.get('build'), t.get('mark')) == ('5-3-2', 'low', 'long', True) else ['tactics saved']
        mt = await page.locator('[data-act="tacx"][data-key="mark"]').inner_text(); print('mark note:', mt.replace('\n', ' ')[:70])
        bad += [] if '次の横浜FMなら' in mt else ['mark note names the ace']
        # pre-match: both plans, the opponent's sheet and back
        await page.click('[data-act="go"]'); await page.wait_for_timeout(450)
        plans = await sheet.locator('.plans').inner_text(); print('plans:', plans.replace('\n', ' | '))
        bad += [] if 'ライン低・ロングボール・マンマーク' in plans else ['pre-match shows my instructions']
        await sheet.locator('[data-act="team"]').click(); await page.wait_for_timeout(400)
        await sheet.locator('[data-act="teamBack"]').click(); await page.wait_for_timeout(400)
        bad += [] if await sheet.locator('[data-act="kickoff"]').count() else ['team -> back to pre-match']
        await page.keyboard.press('Escape'); await page.wait_for_timeout(350)

        # ---------- ② shirt numbers ----------
        await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="sqView"][data-k="list"]'); await page.wait_for_timeout(200)
        row = page.locator('.list .prow').first; name = await row.locator('.nm b').inner_text()
        await row.click(); await page.wait_for_timeout(400)
        await sheet.locator('[data-act="numSheet"]').click(); await page.wait_for_timeout(350)
        cells = await sheet.locator('.numcell').count(); bad += [] if cells == 99 else ['99 cells']
        taken = sheet.locator('.numcell.taken').nth(3); tn = int(await taken.locator('b').inner_text()); who = await taken.locator('small').inner_text()
        await taken.click(); await page.wait_for_timeout(300)
        note = await sheet.locator('.numnow').inner_text(); print('pick', tn, who, '|', note.replace('\n', ' '))
        bad += [] if '入れ替え' in note else ['swap note']
        await shot('number')
        gb = await sheet.locator('.numgrid').bounding_box(); bad += [] if gb and gb['width'] <= vw else ['numgrid width']
        bb = await sheet.locator('[data-act="numSet"]').bounding_box(); bad += [] if fits(bb) else ['numSet button on screen']
        await sheet.locator('[data-act="numSet"]').click(); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); me = next(q for q in st['players'].values() if q['name'] == name); other = [q for q in st['players'].values() if q['club'] == st['my'] and q['short'] == who]
        print('after:', name, me['num'], '/', who, [q['num'] for q in other]); bad += [] if me['num'] == tn else ['number saved']
        btxt = await sheet.locator('.numbtn').inner_text(); bad += [] if str(tn) in btxt else ['sheet shows the new number']
        await page.keyboard.press('Escape'); await page.wait_for_timeout(350)

        # ---------- ③ overseas players ----------
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="clView"][data-k="market"]'); await page.wait_for_timeout(250)
        await page.click('[data-act="mkWhere"][data-k="ab"]'); await page.wait_for_timeout(300)
        rows = await page.locator('#mk-list .prow').count(); print('overseas rows', rows); bad += [] if rows >= 100 else ['overseas list']
        await shot('market-ab')
        first = page.locator('#mk-list .prow').first; fname = await first.locator('.nm b').inner_text()
        await first.click(); await page.wait_for_timeout(400)
        txt = await sheet.inner_text(); print('overseas sheet:', fname, '|', ' '.join(l for l in txt.split('\n') if '相場' in l or '海外組' in l)[:80])
        bad += [] if '移籍金の相場' in txt and '海外組' in txt else ['overseas player sheet']
        await shot('player-ab')
        for i in range(4):
            bb = await sheet.locator('[data-act="bid"]').nth(i).bounding_box()
            if not fits(bb): bad.append(f'bid button {i} off screen')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(350)

        # ---------- ⑥ celebrations ----------
        await load(SAVES['cele']); await page.wait_for_timeout(3200)
        txt = await sheet.inner_text(); print('pop-up 1:', ' '.join(txt.split('\n')[:6]))
        bad += [] if 'J1リーグ' in txt and '優勝' in txt else ['league pop-up']
        await shot('cele-league')
        go = sheet.locator('[data-act="celeDone"]'); bad += [] if fits(await go.bounding_box()) else ['cele button on screen']
        await go.click(); await page.wait_for_timeout(3200)
        txt = await sheet.inner_text(); print('pop-up 2:', ' '.join(txt.split('\n')[:6]))
        bad += [] if '天皇杯' in txt and '浦和' in txt else ['cup pop-up']
        await shot('cele-cup')
        await sheet.locator('[data-act="celeDone"]').click(); await page.wait_for_timeout(500)
        st = await page.evaluate(LOAD); print('queue after:', len(st.get('cele') or [])); bad += [] if not st.get('cele') else ['queue emptied']
        await page.reload(); await page.wait_for_timeout(300); await page.click('[data-act="continue"]'); await page.wait_for_timeout(900)
        bad += [] if not await page.locator('#sheet .cele').count() else ['pop-up comes back after reload']
        # whiteboard look: the team sheet and the tactics card
        await page.evaluate("localStorage.setItem('kuratsuku.board','white')"); await page.reload(); await page.wait_for_timeout(300)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
        await page.click('.ticket-scout'); await page.wait_for_timeout(500); await shot('team-white')
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
        return not bad and not errs
ok1 = asyncio.run(main())
ok2 = asyncio.run(main(375, 667, '-se'))  # iPhone SE
raise SystemExit(0 if ok1 and ok2 else 1)
