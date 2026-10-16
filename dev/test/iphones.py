# Title screen on every current iPhone: home-screen app (standalone, notch / home-bar safe areas) and Safari.
# The board must fill exactly one screen (no scrolling), the buttons must be inside it and clear of the logo.
# Serves the repo root (the real PWA index.html). Chromium has no safe areas, so they are injected as px.
# Home-screen app ('app', 'launch'): navigator.standalone and the phone's screen size are faked. 'launch' = the iOS 26/27
# bug (WebKit 301994): the viewport starts short by the status bar and nothing is drawn below it. On the device iOS uses
# the right height while the page is taller than the viewport and goes short again when it is not; that rule is emulated
# here, and the title (laid out in the page at screen height + 1px) must settle at the right height without flipping
# back and forth (an earlier fix flickered ~12 times a second on an iPhone 16).
import asyncio, pathlib, os, re, threading, http.server, functools
from playwright.async_api import async_playwright
REPO = pathlib.Path('/home/claude/kuratsuku'); OUT = REPO/'dev/test/shots'
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))  # optional @fontsource node_modules for real glyphs
# name, css width, css height, safe top, safe bottom (standalone portrait)
DEVICES = [
    ('SE (2nd/3rd)', 375, 667, 20, 0), ('13 mini', 375, 812, 50, 34), ('13/14/16e', 390, 844, 47, 34),
    ('15/16', 393, 852, 59, 34), ('16 Pro/17/17 Pro', 402, 874, 62, 34), ('Air', 420, 912, 62, 34),
    ('14 Plus', 428, 926, 47, 34), ('15 Plus/16 Plus', 430, 932, 59, 34), ('16/17 Pro Max', 440, 956, 62, 34),
]
SAFARI = [('SE Safari', 375, 548), ('16 Safari', 393, 659), ('Pro Max Safari', 440, 763)]
def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=os.environ.get('KTK_SITE', str(REPO)))  # KTK_SITE: serve another build
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8766), h); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv
def font_css():
    if not FONTS.exists(): return None
    css = ''
    for f in ['dela-gothic-one/400.css', 'dotgothic16/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)]:
        css += (FONTS/f).read_text()
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
SAVE_JS = '''() => { localStorage.setItem('touchline.j1.save', 'x'); }'''
# キャンプ (2026-10-16, 作業8): two saves of 横浜FM in 2027/28 — the day before her question (6/21: the map sheet opens
# on 次へ進む) and the last day of a 沖縄 camp (次へ進む opens the report). Made with the current engine (about 15 s).
MAKE = r"""
const E = require(process.argv[1] + '/dev/src/engine.js'), D = require(process.argv[1] + '/dev/data.json');
const play = (S, until) => { for (let g = 0; g < 9000 && S.date < until; g++) { const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') E.rollover(S); else if (st.stop === 'fired') E.takeJob(S, S.fired.offers[0]);
  else if (st.stop === 'camp') { if (S.date < until) E.campSeen(S); else break; }
  else if (st.stop) { E.secSeen(S); S.cele = []; if (E.sponPending(S)) E.sponPick(S, E.sponRec(S)); } } };
const tidy = S => { E.secSeen(S); S.sec.notes = S.sec.notes.filter(n => n.k === 'camp' && !n.seen); S.sec.back = []; S.inbox.forEach(y => { y.seen = true; y.done = true; }); if (S.reborn) delete S.reborn.show; S.cele = [];
  for (const p of E.squad(S, S.my)) { delete p.bans; if (!p.away) p.inj = 0; } E.autoLineup(S, S.my); };
const S = E.newGame(D, 'yokohamafm', 'ソーイ', '2026-10-16'); E.sponPick(S, E.sponRec(S));
const C0 = E.campOf(S); play(S, '2027-06-20'); tidy(S); for (const p of E.squad(S, S.my)) p.keep = true;   // no offer on her day
const C = E.campOf(S); const ask = JSON.stringify(S);
play(S, C.ask); E.secSeen(S); E.campPick(S, 'oki'); play(S, C.to); tidy(S);
console.log(JSON.stringify({ ask, rep: JSON.stringify(S), info: [C.ask, C.from, C.to, S.date, S.camp.show] }));
"""
async def main():
    srv = serve(); css = font_css(); bad = []
    import subprocess, json
    CAMP = json.loads(subprocess.run(['node', '-e', MAKE, str(REPO)], capture_output=True, text=True, check=True).stdout)
    print('camp saves', CAMP['info'])
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for save in (False, True):
            for name, w, h, top, bot, mode in [d + ('app',) for d in DEVICES] + [d + ('launch',) for d in DEVICES] + [(n, w, h, 0, 0, 'safari') for n, w, h in SAFARI]:
                vh = h - top if mode == 'launch' else h
                ctx = await b.new_context(viewport={'width': w, 'height': vh}, device_scale_factor=2, has_touch=True, service_workers='block')
                page = await ctx.new_page()
                async def route(r):
                    u = r.request.url
                    if 'fonts.googleapis.com' in u and css: await r.fulfill(status=200, content_type='text/css', body=css)
                    elif 'fonts.gstatic.com/fs/' in u:
                        fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one', 'dotgothic16'] if fn.startswith(x))
                        await r.fulfill(status=200, content_type='font/woff2', body=(FONTS/fam/'files'/fn).read_bytes())
                    else: await r.abort()
                await page.route('https://**/*', route)
                if mode != 'safari':
                    await page.add_init_script(f'''Object.defineProperty(Navigator.prototype, 'standalone', {{ get: () => true }});
                      Object.defineProperty(screen, 'width', {{ get: () => {w} }}); Object.defineProperty(screen, 'height', {{ get: () => {h} }});''')
                await page.add_init_script(f'''document.addEventListener('DOMContentLoaded', () => {{ const s = document.createElement('style');
                  s.textContent = 'html:root{{padding-top:{top}px!important;padding-bottom:{bot}px!important;--sat:{top}px;--sab:{bot}px}} body::before{{height:{top}px!important}}';
                  document.head.appendChild(s); }});''')
                await page.goto('http://127.0.0.1:8766/index.html'); await page.wait_for_timeout(300)
                if save:
                    await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(300)
                    await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(300)
                    await page.goto('http://127.0.0.1:8766/index.html')
                await page.wait_for_timeout(600 if css else 250)
                m = await page.evaluate('''() => { const r = s => document.querySelector(s).getBoundingClientRect();
                  const board = r('.tboard'), logo = r('.tb-logo h1'), menu = r('.tb-menu'), links = r('.tb-links');
                  return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth,
                    pos: getComputedStyle(document.querySelector('.tb-wrap')).position,
                    board: [board.top, board.bottom, board.width], logoBottom: r('.tb-logo svg').bottom, logoW: logo.width, menuTop: menu.top, linksBottom: links.bottom,
                    plates: document.querySelectorAll('.tb-menu .plate').length }; }''')
                problems = []
                want = 'fixed' if mode == 'safari' else 'absolute'
                if m['pos'] != want: problems.append(f"title is {m['pos']}, want {want}")
                exp = h - 10 + (0 if mode == 'safari' else 1)  # 10px frame like the top (home-screen app: screen height + 1px)
                if abs(m['board'][1] - exp) > 1: problems.append(f"board bottom {m['board'][1]:.0f}, want {exp}")
                if m['sh'] > (m['ih'] if mode == 'safari' else h + 1) + 1: problems.append(f"scrolls {m['sh']}>{m['ih']}")
                if m['sw'] > m['iw'] + 1: problems.append('horizontal scroll')
                if m['linksBottom'] > h - bot + 0.5: problems.append(f"links {m['linksBottom']:.0f} under the home bar ({h - bot})")
                if abs((m['board'][0] - top) - (h - m['board'][1])) > 1.5: problems.append(f"frame above {m['board'][0] - top:.0f} / below {h - m['board'][1]:.0f} differ")
                if m['board'][0] < top - 0.5: problems.append(f"board top {m['board'][0]:.0f} under notch ({top})")
                if m['logoBottom'] > m['menuTop'] - 8: problems.append(f"logo {m['logoBottom']:.0f} touches buttons {m['menuTop']:.0f}")
                if m['linksBottom'] > m['board'][1]: problems.append('links outside the board')
                if m['logoW'] > m['board'][2]: problems.append('logo wider than the board')
                tag = f"{'save' if save else 'new'} {mode} {name} {w}x{h}"
                print(f"{tag:41s} board {m['board'][0]:.0f}-{m['board'][1]:.0f} logo-bottom {m['logoBottom']:.0f} buttons {m['menuTop']:.0f} | {'OK' if not problems else ' / '.join(problems)}")
                if problems: bad.append(tag)
                await page.screenshot(path=str(OUT/f"ip-{'save' if save else 'new'}-{mode}-{w}x{h}.png"))
                if mode == 'launch':  # emulate iOS: right height while the page is taller than the viewport, short again when not
                    cur, flips = vh, 0
                    for _ in range(8):
                        sh_ = await page.evaluate('document.scrollingElement.scrollHeight')
                        nxt = h if sh_ > cur else h - top
                        if nxt != cur:
                            flips += 1; cur = nxt; await page.set_viewport_size({'width': w, 'height': cur}); await page.wait_for_timeout(120)
                    f = await page.evaluate('''() => ({ pos: getComputedStyle(document.querySelector('.tb-wrap')).position,
                      bottom: document.querySelector('.tboard').getBoundingClientRect().bottom, sh: document.scrollingElement.scrollHeight })''')
                    if cur != h or flips > 1 or f['pos'] != 'absolute' or abs(f['bottom'] - exp) > 1 or f['sh'] > h + 1:
                        print(f"   {name} settle: viewport {cur} flips {flips} {f}"); bad.append(f'{tag} settle')
                    vh = cur
                if save:  # the club screens too: header below the notch, dock on the home bar, no sideways scroll
                    # launch: after every screen change iOS is asked again (page taller than the viewport → full height,
                    # else short). Every screen — short ones, an open sheet, the match — must keep the full screen
                    # (2026-10-13: a short screen used to drop back and lift the dock by the status bar, 画像①②③).
                    async def again(where):
                        nonlocal vh
                        if mode != 'launch': return
                        flips = 0
                        for _ in range(8):
                            sh_ = await page.evaluate('document.scrollingElement.scrollHeight')
                            nxt = h if sh_ > vh else h - top
                            if nxt == vh: break
                            flips += 1; vh = nxt; await page.set_viewport_size({'width': w, 'height': vh}); await page.wait_for_timeout(120)
                        if vh != h or flips: print(f"   {name} {where}: viewport {vh} (screen {h}) after {flips} change(s)"); bad.append(f'{tag} {where} viewport')
                    async def subnav(where):  # the sub-nav sits right on the dock at the top and at the end of the page
                        for to in (0, 10**6):
                            await page.evaluate(f'scrollTo(0, {to})'); await page.wait_for_timeout(60)
                            r_ = await page.evaluate('''() => { const s = document.querySelector('.view > .subnav'); if (!s) return null;
                              return [s.getBoundingClientRect().bottom, innerHeight - parseFloat(getComputedStyle(s).bottom)]; }''')
                            if r_ and abs(r_[0] - r_[1]) > 1: print(f"   {name} {where}: sub-nav bottom {r_[0]:.0f}, want {r_[1]:.0f} ({'end' if to else 'top'})"); bad.append(f'{tag} {where} subnav')
                        await page.evaluate('scrollTo(0, 0)')
                    async def bottom_of(sel, where):
                        await again(where)
                        for _ in range(10):   # a sheet still sliding in (slow when the machine is busy): wait up to 1.5 s
                            b_ = await page.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().bottom")
                            if abs(b_ - h) <= 1: break
                            await page.wait_for_timeout(150)
                        if abs(b_ - h) > 1: print(f"   {name} {where}: {sel} bottom {b_:.0f}, screen {h}"); bad.append(f'{tag} {where}')
                    await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
                    for tab in ('home', 'squad', 'tactics', 'league', 'club'):
                        await page.locator(f'[data-tab="{tab}"]').dispatch_event('click'); await page.wait_for_timeout(150)  # launch: the dock is below the short viewport
                        await again(tab)
                        g = await page.evaluate('''() => { const hd = document.querySelector('.hdr').getBoundingClientRect(), dk = document.querySelector('.dock').getBoundingClientRect();
                          return { hdrTop: hd.top, dockBottom: dk.bottom, sw: document.scrollingElement.scrollWidth, iw: innerWidth }; }''')
                        q = []
                        if g['hdrTop'] < top - 0.5: q.append(f"header under notch {g['hdrTop']:.0f}")
                        if abs(g['dockBottom'] - h) > 1: q.append(f"dock bottom {g['dockBottom']:.0f} (screen {h})")
                        if g['sw'] > g['iw'] + 1: q.append('horizontal scroll')
                        if q: print(f"   {name} {tab}: {' / '.join(q)}"); bad.append(f'{tag} {tab}')
                        await subnav(tab)
                        # the secretary (2026-10-15): at home a band on top of the dock (inside it); elsewhere her magnet beside the
                        # switch bar (inside it, right of its buttons), or just above the dock when a screen has no bar
                        sg = await page.evaluate('''() => { const m = document.querySelector('#sec-float .sec-mag'); if (!m) return null; const r = m.getBoundingClientRect();
                          const d = document.querySelector('.dock').getBoundingClientRect(), band = document.querySelector('.dock #sec-float.sec-band');
                          if (band) { const b = band.getBoundingClientRect(); return { k: 'band', ok: b.top >= d.top - 0.5 && b.bottom <= d.bottom + 0.5, top: b.top }; }
                          const s = document.querySelector('#view > .subnav');
                          if (s && s.contains(m)) { const sr = s.getBoundingClientRect(), f = s.firstElementChild.getBoundingClientRect();
                            return { k: 'bar', ok: r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5 && f.right <= r.left + 0.5, top: r.top }; }
                          return { k: 'float', ok: d.top - r.bottom >= 0 && d.top - r.bottom <= 24, top: r.top }; }''')
                        if sg is None and tab == 'home': print(f"   {name} {tab}: no secretary"); bad.append(f'{tag} {tab} secretary')
                        elif sg and not (sg['ok'] and sg['top'] > top): print(f"   {name} {tab}: secretary {sg}"); bad.append(f'{tag} {tab} secretary')
                    # a short screen: club → 移籍市場 → ショートリスト (empty); its 経営/移籍市場/記録 bar used to float halfway up
                    await page.locator('[data-act="clView"][data-k="market"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await subnav('market')
                    await page.locator('[data-act="mkView"][data-k="short"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await bottom_of('.dock', 'shortlist')
                    await subnav('shortlist')
                    if w == 393: await page.screenshot(path=str(OUT/f"ip-short-{mode}-{w}x{h}.png"))
                    # ホームタウン (2026-10-15): the board, the switch bar of four (every label whole, her magnet inside), a building's sheet
                    await page.locator('[data-act="clView"][data-k="town"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await again('hometown')
                    await subnav('hometown')
                    cut = await page.evaluate('''() => { const s = document.querySelector('#view > .subnav'); const sr = s.getBoundingClientRect();
                      return [...s.querySelectorAll('.seg button')].filter(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > sr.right + 0.5).map(b => b.textContent.trim())
                        .concat(document.scrollingElement.scrollWidth > innerWidth + 1 ? ['horizontal scroll'] : []); }''')
                    if cut: print(f"   {name} hometown: {cut}"); bad.append(f'{tag} hometown bar')
                    await page.locator('[data-act="htOpen"][data-k="house"]').dispatch_event('click'); await page.wait_for_timeout(350)
                    await bottom_of('#sheet', 'hometown sheet')
                    if w == 393: await page.screenshot(path=str(OUT/f"ip-town-{mode}-{w}x{h}.png"))
                    await page.locator('#sheet [data-act="closeSheet"]').last.dispatch_event('click'); await page.wait_for_timeout(300)
                    await page.locator('[data-act="clView"][data-k="main"]').dispatch_event('click'); await page.wait_for_timeout(100)
                    # an open sheet (the page is pinned while it is open)
                    await page.locator('[data-tab="squad"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await page.locator('[data-act="player"]').first.dispatch_event('click'); await page.wait_for_timeout(350)
                    await bottom_of('#sheet', 'sheet')
                    await page.locator('#sheet [data-act="closeSheet"]').last.dispatch_event('click'); await page.wait_for_timeout(300)
                    # the secretary's sheet
                    await page.locator('[data-tab="home"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    if await page.locator('#sec-float .sec-mag').count():
                        await page.locator('#sec-float .sec-mag').dispatch_event('click'); await page.wait_for_timeout(350)
                        await bottom_of('#sheet', 'secretary sheet')
                        if w == 393: await page.screenshot(path=str(OUT/f"ip-sec-{mode}-{w}x{h}.png"))
                        await page.locator('#sheet [data-act="closeSheet"]').last.dispatch_event('click'); await page.wait_for_timeout(300)
                    # スポンサー契約 (2026-10-15): the sheet with the contracts and the kit, from the home card
                    await page.locator('[data-tab="home"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    if await page.locator('[data-act="sponOpen"]').count():
                        await page.locator('[data-act="sponOpen"]').first.dispatch_event('click'); await page.wait_for_timeout(600)
                        await bottom_of('#sheet', 'sponsor sheet')
                        if w == 393: await page.screenshot(path=str(OUT/f"ip-spon-{mode}-{w}x{h}.png"))
                        await page.locator('#sheet [data-act="closeSheet"]').last.dispatch_event('click'); await page.wait_for_timeout(300)
                    else: print(f"   {name}: no sponsor card"); bad.append(f'{tag} sponsor card')
                    await page.locator('[data-tab="home"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await again('home again')
                    await page.screenshot(path=str(OUT/f"ip-home-{mode}-{w}x{h}.png"))
                    # the match: the pre-match sheet (連携・観客), then the controls sit on the home bar
                    await page.locator('[data-act="go"]').dispatch_event('click'); await page.wait_for_timeout(300)
                    await bottom_of('#sheet', 'pre-match sheet')
                    await page.locator('#sheet [data-act="kickoff"]').dispatch_event('click'); await page.wait_for_timeout(500)
                    await bottom_of('#mlayer', 'match')
                    mb = await page.evaluate("document.querySelector('#mctl').getBoundingClientRect().bottom")
                    if abs(mb - h) > 1: print(f"   {name} match: controls bottom {mb:.0f}, screen {h}"); bad.append(f'{tag} match controls')
                    if w == 393: await page.screenshot(path=str(OUT/f"ip-match-{mode}-{w}x{h}.png"))
                    # キャンプ (2026-10-16): her question opens the map sheet, the report after the last day; both reach the bottom
                    # of the screen and the map sits inside it; the home card during the run-up
                    for k, sel, where in (('ask', '.cpA-map', 'camp sheet'), ('rep', '.cp-cal', 'camp report')):
                        # leave the game first: leaving a page with a game open saves it (pagehide) over the save put in
                        await page.goto('http://127.0.0.1:8766/index.html'); await page.wait_for_timeout(200)
                        await page.evaluate('s => localStorage.setItem("touchline.j1.save", s)', CAMP[k])
                        await page.goto('http://127.0.0.1:8766/index.html'); await page.wait_for_timeout(300)
                        await page.locator('[data-act="continue"]').dispatch_event('click'); await page.wait_for_timeout(400)
                        await again(f'{where} home')
                        # her question: 次へ進む (the next day she asks); the report: the home card's button (the day it ended)
                        await page.locator('[data-act="go"]' if k == 'ask' else '[data-act="campRep"]').first.dispatch_event('click'); await page.wait_for_timeout(750)   # the map / the report take a moment longer
                        if not await page.locator(f'#sheet.on {sel}').count(): print(f"   {name}: no {where}"); bad.append(f'{tag} {where}'); continue
                        await bottom_of('#sheet', where)
                        fit = await page.evaluate(f'''() => {{ const m = document.querySelector('#sheet {sel}').getBoundingClientRect();
                          return m.left >= -0.5 && m.right <= innerWidth + 0.5 && document.scrollingElement.scrollWidth <= innerWidth + 1; }}''')
                        if not fit: print(f"   {name} {where}: wider than the screen"); bad.append(f'{tag} {where} width')
                        if w == 393 or w == 375: await page.screenshot(path=str(OUT/f"ip-camp-{k}-{mode}-{w}x{h}.png"))
                        await page.locator('#sheet [data-act="closeSheet"], #sheet [data-act="campRepDone"]').last.dispatch_event('click'); await page.wait_for_timeout(300)
                        if not await page.locator('.cp-home, [data-act="campRep"], [data-act="campOpen"]').count(): print(f"   {name}: no camp card ({k})"); bad.append(f'{tag} camp card {k}')
                await ctx.close()
        await b.close()
    srv.shutdown()
    print('ALL OK' if not bad else f'PROBLEMS: {bad}')
asyncio.run(main())
