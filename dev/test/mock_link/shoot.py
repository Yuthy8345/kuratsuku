# 作業6（2026-10-15）連携とコンボの画面イメージ: 実際の戦術画面と選手シートに案A〜C を描き足してスクショ
# usage: cd dev/test/mock_link && node make_save.js > save.json && node gen.js
#        && KTK_FONTS=<@fontsource のフォルダ> python3 shoot.py <A|B|C|all> [chalk|white] [w] [h]  → out/*.png
import asyncio, pathlib, os, re, json, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', ''))
OUT = HERE / 'out'; OUT.mkdir(exist_ok=True)
page_html = (ROOT / 'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(HERE / 'page.html').write_text(wrapped)
LZ = (ROOT / 'test/vendor/lz-string.min.js').read_text()
SAVE = json.loads((HERE / 'save.json').read_text())['save']
DATA = (HERE / 'data.json').read_text()
MOCK = (HERE / 'mock.js').read_text()

def font_css():
    if not FONTS.name: return ''
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
        for v in variants:
            await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
            await page.evaluate('document.fonts.ready')
            await page.click('[data-act="tab"][data-tab="tactics"]'); await page.wait_for_timeout(400)
            await page.evaluate(MOCK); await page.evaluate(f'D => MOCK.{v}(D)', json.loads(DATA)); await page.wait_for_timeout(250)
            tag = f'{v}-{board}-{vw}'
            # 1: the board (its top just under the header)
            await page.evaluate("() => { const p = document.querySelector('#view .pitch'); const h = document.querySelector('.hdr').getBoundingClientRect().height; window.scrollTo(0, p.getBoundingClientRect().top + scrollY - h - (document.querySelector('.lk-toggle') ? 120 : 112)); }")
            await page.wait_for_timeout(200); await page.screenshot(path=str(OUT / f'{tag}-1.png'))
            # 2: what comes under the board
            await page.evaluate("() => { const p = document.querySelector('#view .pitch'); const h = document.querySelector('.hdr').getBoundingClientRect().height; window.scrollTo(0, p.getBoundingClientRect().bottom + scrollY - h - 250); }")
            await page.wait_for_timeout(200); await page.screenshot(path=str(OUT / f'{tag}-2.png'))
            # parts for the side-by-side picture (header, dock and the sticky bar hidden)
            await page.add_style_tag(content='.hdr,.dock,.subnav,.sec-float{visibility:hidden!important}')
            if v == 'C':
                await page.evaluate("() => { const p = document.querySelector('#view .pitch'); p.parentElement.insertBefore(Object.assign(document.createElement('div'), { id: 'lk-bw' }), document.querySelector('.lk-toggle')); const w = document.getElementById('lk-bw'); w.append(document.querySelector('.lk-toggle'), p); w.style.display = 'grid'; w.style.gap = '12px'; }")
                await page.locator('#lk-bw').screenshot(path=str(OUT / f'{tag}-board.png'))
            else: await page.locator('#view .pitch').screenshot(path=str(OUT / f'{tag}-board.png'))
            await page.locator('.lk-a, .lk-b, .lk-c').first.screenshot(path=str(OUT / f'{tag}-card.png'))
            await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
            await page.click('[data-act="tab"][data-tab="tactics"]'); await page.wait_for_timeout(400)
            await page.evaluate(MOCK); await page.evaluate(f'D => MOCK.{v}(D)', json.loads(DATA)); await page.wait_for_timeout(250)
            await page.evaluate("() => { const p = document.querySelector('#view .pitch'); const h = document.querySelector('.hdr').getBoundingClientRect().height; window.scrollTo(0, p.getBoundingClientRect().top + scrollY - h - 112); }")
            # 3: the player sheet (the AM)
            pid = json.loads(DATA)['tg']['pid']
            await page.evaluate(f"() => {{ document.querySelector('#view').insertAdjacentHTML('beforeend', '<button id=\"mk-open\" data-act=\"player\" data-id=\"{pid}\">x</button>'); document.querySelector('#mk-open').click(); }}")
            await page.wait_for_timeout(600)
            await page.evaluate(f'D => MOCK.sheet{v}(D)', json.loads(DATA)); await page.wait_for_timeout(250)
            await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const n = [...b.querySelectorAll('.eyebrow')].find(e => /相性|連携マップ/.test(e.textContent)); b.scrollTop = n.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 12; }")
            await page.wait_for_timeout(250); await page.screenshot(path=str(OUT / f'{tag}-3.png'))
            await page.locator('#lk-sb').screenshot(path=str(OUT / f'{tag}-sheet.png'))
        print('\n'.join(errs) or 'no errors')
        await b.close()

v = sys.argv[1] if len(sys.argv) > 1 else 'A'
variants = ['A', 'B', 'C'] if v == 'all' else [v]
board = sys.argv[2] if len(sys.argv) > 2 else 'chalk'
vw = int(sys.argv[3]) if len(sys.argv) > 3 else 393; vh = int(sys.argv[4]) if len(sys.argv) > 4 else 852
asyncio.run(main(variants, board, vw, vh))
