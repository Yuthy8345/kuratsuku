# Title screen on every current iPhone: home-screen app (standalone, notch / home-bar safe areas) and Safari.
# The board must fill exactly one screen (no scrolling), the buttons must be inside it and clear of the logo.
# Serves the repo root (the real PWA index.html). Chromium has no safe areas, so they are injected as px.
# 'launch' = the iOS 26/27 home-screen bug (WebKit 301994): at launch the viewport is short by the status bar until the
# first swipe. Reproduced with a viewport that short and navigator.standalone / screen size of the real phone;
# the board and the dock must still reach the real screen bottom.
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
    h = functools.partial(Quiet, directory=str(REPO))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8766), h); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv
def font_css():
    if not FONTS.exists(): return None
    css = ''
    for f in ['dela-gothic-one/400.css', 'dotgothic16/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)]:
        css += (FONTS/f).read_text()
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
SAVE_JS = '''() => { localStorage.setItem('touchline.j1.save', 'x'); }'''
async def main():
    srv = serve(); css = font_css(); bad = []
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
                    await page.click('[data-act="startClub"]'); await page.wait_for_timeout(300)
                    await page.goto('http://127.0.0.1:8766/index.html')
                await page.wait_for_timeout(600 if css else 250)
                m = await page.evaluate('''() => { const r = s => document.querySelector(s).getBoundingClientRect();
                  const board = r('.tboard'), logo = r('.tb-logo h1'), menu = r('.tb-menu'), links = r('.tb-links');
                  return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth,
                    pos: getComputedStyle(document.querySelector('.tb-wrap')).position,
                    board: [board.top, board.bottom, board.width], logoBottom: r('.tb-logo svg').bottom, logoW: logo.width, menuTop: menu.top, linksBottom: links.bottom,
                    plates: document.querySelectorAll('.tb-menu .plate').length }; }''')
                problems = []
                if m['pos'] != 'fixed': problems.append('title not position:fixed (vh/dvh are wrong at launch in iOS home-screen apps)')
                if abs(m['board'][1] - (h - bot - 10)) > 1: problems.append(f"board bottom {m['board'][1]:.0f} not 10px above the home bar ({h - bot - 10})")
                if m['sh'] > m['ih'] + 1: problems.append(f"scrolls {m['sh']}>{m['ih']}")
                if m['sw'] > m['iw'] + 1: problems.append('horizontal scroll')
                if m['board'][1] > h - bot + 0.5: problems.append(f"board bottom {m['board'][1]:.0f} under home bar ({h - bot})")
                if m['board'][0] < top - 0.5: problems.append(f"board top {m['board'][0]:.0f} under notch ({top})")
                if m['logoBottom'] > m['menuTop'] - 8: problems.append(f"logo {m['logoBottom']:.0f} touches buttons {m['menuTop']:.0f}")
                if m['linksBottom'] > m['board'][1]: problems.append('links outside the board')
                if m['logoW'] > m['board'][2]: problems.append('logo wider than the board')
                tag = f"{'save' if save else 'new'} {mode} {name} {w}x{h}"
                print(f"{tag:41s} board {m['board'][0]:.0f}-{m['board'][1]:.0f} logo-bottom {m['logoBottom']:.0f} buttons {m['menuTop']:.0f} | {'OK' if not problems else ' / '.join(problems)}")
                if problems: bad.append(tag)
                await page.screenshot(path=str(OUT/f"ip-{'save' if save else 'new'}-{mode}-{w}x{h}.png"))
                if save:  # the club screens too: header below the notch, dock on the home bar, no sideways scroll
                    await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
                    for tab in ('home', 'squad', 'tactics', 'league', 'club'):
                        await page.locator(f'[data-tab="{tab}"]').dispatch_event('click'); await page.wait_for_timeout(150)  # launch: the dock is below the short viewport
                        g = await page.evaluate('''() => { const hd = document.querySelector('.hdr').getBoundingClientRect(), dk = document.querySelector('.dock').getBoundingClientRect();
                          return { hdrTop: hd.top, dockBottom: dk.bottom, sw: document.scrollingElement.scrollWidth, iw: innerWidth }; }''')
                        q = []
                        if g['hdrTop'] < top - 0.5: q.append(f"header under notch {g['hdrTop']:.0f}")
                        if abs(g['dockBottom'] - h) > 1: q.append(f"dock bottom {g['dockBottom']:.0f}")
                        if g['sw'] > g['iw'] + 1: q.append('horizontal scroll')
                        if q: print(f"   {name} {tab}: {' / '.join(q)}"); bad.append(f'{tag} {tab}')
                    await page.locator('[data-tab="home"]').dispatch_event('click'); await page.wait_for_timeout(150)
                    await page.screenshot(path=str(OUT/f"ip-home-{mode}-{w}x{h}.png"))
                await ctx.close()
        await b.close()
    srv.shutdown()
    print('ALL OK' if not bad else f'PROBLEMS: {bad}')
asyncio.run(main())
