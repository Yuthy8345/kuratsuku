# 作業7（2026-10-16）キャンプの画面イメージ: 実際のアプリ（ホームの秘書の帯・秘書のシートの器）に案A〜C を重ねてスクショ
# usage: cd dev/test/mock_camp && node make_save.js > save.json && node gen.js
#        && KTK_FONTS=<@fontsource のフォルダ> python3 shoot.py <A|B|C|all> [chalk|white] [w] [h]  → out/*.png
# dev/dist/touchline.html はビルド済みのものを使う（ソースは変えていない）
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
MOCK = json.loads((HERE / 'mock.json').read_text())

def font_css():
    if not FONTS.name: return ''
    css = ''.join((FONTS / f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css', 'dotgothic16/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)

PUT = '''([m, which]) => {
  const aki = document.querySelector('.aki');
  const md = aki ? aki.outerHTML.replace(/class="aki [^"]*"/, 'class="aki md"') : '';
  const sm = aki ? aki.outerHTML.replace(/class="aki [^"]*"/, 'class="aki sm"').replace(/<i class="aki-badge">.*?<\\/i>/, '') : '';
  const fix = s => s.split('{{AKISM}}').join(sm).split('{{AKI}}').join(md.replace(/<i class="aki-badge">.*?<\\/i>/, ''));
  const v = m[which];
  const sh = document.getElementById('sheet');
  sh.innerHTML = '<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-body">' + fix(v.body) + '</div>' + (v.foot ? '<div class="sheet-foot">' + v.foot + '</div>' : '');
  sh.querySelector('.sheet-body').scrollTop = 0;
}'''

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
        await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(600)
        await page.evaluate('document.fonts.ready')
        await page.add_style_tag(content=MOCK['css'])
        # home: her band says it's time to choose the camp
        await page.evaluate('''t => { const b = document.querySelector('.sec-band .sec-bub b'); if (b) b.textContent = t; const s = document.querySelector('.sec-band .sec-bub small'); if (s) s.textContent = '秘書 あき'; const g = document.querySelector('.sec-band .aki-badge'); if (g) g.textContent = '1'; }''', MOCK['band'])
        await page.wait_for_timeout(200)
        tag0 = f'{board}-{vw}'
        await page.screenshot(path=str(OUT / f'home-{tag0}.png'))
        for v in variants:
            for which in ['sheet', 'report']:
                tag = f'{v}-{which}-{board}-{vw}'
                await page.click('.sec-band [data-act="secOpen"]'); await page.wait_for_timeout(500)
                await page.evaluate(PUT, [MOCK[v], which]); await page.wait_for_timeout(1800 if which == 'report' else 300)
                await page.screenshot(path=str(OUT / f'{tag}-1.png'))
                n = 2
                while True:
                    more = await page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); const before = b.scrollTop; b.scrollTop = before + b.clientHeight - 60; return b.scrollTop > before + 4; }")
                    if not more or n > 5: break
                    await page.wait_for_timeout(250); await page.screenshot(path=str(OUT / f'{tag}-{n}.png')); n += 1
                # the whole sheet, for the side-by-side pictures
                await page.set_viewport_size({'width': vw, 'height': 4000})
                await page.evaluate("() => { const s = document.getElementById('sheet'); s.style.maxHeight = 'none'; s.querySelector('.sheet-body').scrollTop = 0; }")
                await page.wait_for_timeout(300)
                await page.locator('#sheet').screenshot(path=str(OUT / f'{tag}-full.png'))
                await page.evaluate("() => { document.getElementById('sheet').style.maxHeight = ''; }")
                await page.set_viewport_size({'width': vw, 'height': vh})
                await page.evaluate("() => { const s = document.getElementById('sheet'); s.classList.remove('on'); document.getElementById('scrim').classList.remove('on'); s.hidden = true; document.getElementById('scrim').hidden = true; s.innerHTML = ''; }")
                await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
                await page.add_style_tag(content=MOCK['css'])
                await page.evaluate('''t => { const b = document.querySelector('.sec-band .sec-bub b'); if (b) b.textContent = t; const s = document.querySelector('.sec-band .sec-bub small'); if (s) s.textContent = '秘書 あき'; }''', MOCK['band'])
        print('\n'.join(errs) or 'no errors')
        await b.close()

v = sys.argv[1] if len(sys.argv) > 1 else 'A'
variants = ['A', 'B', 'C'] if v == 'all' else [v]
board = sys.argv[2] if len(sys.argv) > 2 else 'chalk'
vw = int(sys.argv[3]) if len(sys.argv) > 3 else 393; vh = int(sys.argv[4]) if len(sys.argv) > 4 else 852
asyncio.run(main(variants, board, vw, vh))
