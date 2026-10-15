# mocks of the ホームタウン screen on top of the real app (the club tab), iPhone 16 / SE, chalkboard / whiteboard
# usage: python3 shoot.py <variant: base|A|B|C|all> [board] [w] [h]
import asyncio, pathlib, os, re, json, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', ''))   # @fontsource (HANDOFF §2)
OUT = HERE / 'out'; OUT.mkdir(exist_ok=True)
page_html = (ROOT / 'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(HERE / 'page.html').write_text(wrapped)
LZ = (ROOT / 'test/vendor/lz-string.min.js').read_text()
SAVE = json.loads((HERE / 'save.json').read_text())['save']
SAVE['clubs'][SAVE['my']]['funds'] = 84300

def font_css():
    css = ''.join((FONTS / f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css', 'dotgothic16/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)

async def main(variants, board, vw, vh):
    css = font_css()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        async def route(r):
            u = r.request.url
            if 'lz-string' in u: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            elif 'fonts.googleapis.com' in u: await r.fulfill(status=200, content_type='text/css', body=css)
            elif 'fonts.gstatic.com/fs/' in u:
                fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one', 'dotgothic16'] if fn.startswith(x))
                await r.fulfill(status=200, content_type='font/woff2', body=(FONTS / fam / 'files' / fn).read_bytes())
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(HERE / 'page.html')); await page.wait_for_timeout(250)
        await page.evaluate("b => localStorage.setItem('kuratsuku.board', b)", board)
        await page.evaluate("s => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))", json.dumps(SAVE))
        await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
        await page.evaluate('document.fonts.ready')
        await page.click('[data-act="tab"][data-tab="club"]'); await page.wait_for_timeout(400)
        for v in variants:
            if v != 'base':
                html = (HERE / f'mock_{v}.html').read_text()
                await page.evaluate('''html => {
                  const view = document.querySelector('#view');
                  view.innerHTML = html;
                  // the switch bar: 経営 / ホームタウン / 移籍市場 / 記録 (ホームタウン on)
                  view.insertAdjacentHTML('beforeend', '<div class="subnav"><div class="seg"><button aria-pressed="false">経営</button><button aria-pressed="true">ホームタウン</button><button aria-pressed="false">移籍市場</button><button aria-pressed="false">記録</button></div></div>');
                  window.scrollTo(0, 0);
                }''', html)
                await page.wait_for_timeout(300)
            tag = f'{v}-{board}-{vw}'
            await page.screenshot(path=str(OUT / f'{tag}.png'))
            full = await page.evaluate('document.documentElement.scrollHeight')
            if full > vh + 40 and v != 'base':
                await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)'); await page.wait_for_timeout(250)
                await page.screenshot(path=str(OUT / f'{tag}-2.png'))
                await page.evaluate('window.scrollTo(0, 0)')
            # the sheet (a building's details) when the mock has one
            if v != 'base' and await page.locator('#mock-sheet').count():
                await page.evaluate("document.querySelector('#mock-sheet').hidden = false")
                await page.wait_for_timeout(250)
                await page.screenshot(path=str(OUT / f'{tag}-sheet.png'))
                await page.evaluate("document.querySelector('#mock-sheet').hidden = true")
        print('\n'.join(errs) or 'no errors')
        await b.close()

v = sys.argv[1] if len(sys.argv) > 1 else 'base'
variants = ['A', 'B', 'C'] if v == 'all' else [v]
board = sys.argv[2] if len(sys.argv) > 2 else 'chalk'
vw = int(sys.argv[3]) if len(sys.argv) > 3 else 393; vh = int(sys.argv[4]) if len(sys.argv) > 4 else 852
asyncio.run(main(variants, board, vw, vh))
