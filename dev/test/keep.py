# 放出不可 button in the player sheet: next to 放出リスト, the two are exclusive, the squad row gets a chip,
# it survives a reload and can be undone. (Offers / window / selling: test/keep.js)
import asyncio, pathlib, os, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
async def main(vw=390, vh=844, tag=''):
    css = font_css(); bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        async def route(r):
            u = r.request.url
            if 'lz-string' in u: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            elif 'fonts.googleapis.com' in u and css: await r.fulfill(status=200, content_type='text/css', body=css)
            elif 'fonts.gstatic.com/fs/' in u:
                fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one'] if fn.startswith(x))
                await r.fulfill(status=200, content_type='font/woff2', body=(FONTS/fam/'files'/fn).read_bytes())
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        async def squad():
            await page.click('[data-tab="squad"]'); await page.wait_for_timeout(150)
            await page.click('[data-act="sqView"][data-k="list"]'); await page.wait_for_timeout(200)
        btn = lambda a: page.locator(f'#sheet [data-act="{a}"]')
        async def labels(): return (await btn('toggleList').inner_text()).strip(), (await btn('toggleKeep').inner_text()).strip()
        await squad()
        row = page.locator('.list .prow').first; name = await row.locator('.nm b').inner_text()
        await row.click(); await page.wait_for_timeout(400)
        L = await labels(); print('start:', name, L); bad += [] if L == ('放出リストに載せる', '放出不可にする') else ['labels 0']
        await btn('toggleList').click(); await page.wait_for_timeout(300)
        L = await labels(); print('listed:', L); bad += [] if L == ('放出リストから外す', '放出不可にする') else ['labels listed']
        await btn('toggleKeep').click(); await page.wait_for_timeout(300)
        toast = await page.locator('.toast, #toast').first.inner_text()
        L = await labels(); stat = await page.locator('#sheet .row.wrap').first.inner_text()
        print('keep:', L, '| toast:', toast, '| status:', stat.replace('\n', ' '))
        bad += [] if L == ('放出リストに載せる', '放出不可を解除') and '放出リストから外し' in toast and '放出不可' in stat and '放出リスト登録中' not in stat else ['keep']
        await page.wait_for_timeout(2700)  # let the toast fade
        await page.screenshot(path=str(OUT/f'keep-sheet{tag}.png'))
        # foot fits: all three buttons visible on screen
        for a in ('toggleList', 'toggleKeep', 'closeSheet'):
            bb = await btn(a).bounding_box()
            if not bb or bb['y'] + bb['height'] > vh: bad.append('offscreen ' + a)
        await btn('closeSheet').click(); await page.wait_for_timeout(300)
        rowtxt = await page.locator('.prow', has_text=name).first.inner_text()
        print('row chips:', rowtxt.replace('\n', ' ')[:60]); bad += [] if '放出不可' in rowtxt and '放出リスト' not in rowtxt.replace('放出不可', '') else ['row chip']
        await page.screenshot(path=str(OUT/f'keep-list{tag}.png'))
        # survives a reload
        await page.goto('about:blank'); await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); kept = [p['name'] for p in st['players'].values() if p.get('keep')]
        print('saved 放出不可:', kept); bad += [] if kept == [name] else ['save']
        # list him again -> 放出不可 is lifted; then undo
        await squad(); await page.locator('.prow', has_text=name).first.click(); await page.wait_for_timeout(400)
        await btn('toggleList').click(); await page.wait_for_timeout(300)
        toast = await page.locator('.toast, #toast').first.inner_text(); L = await labels()
        print('relist:', L, '| toast:', toast); bad += [] if L == ('放出リストから外す', '放出不可にする') and '放出不可を解除し' in toast else ['relist']
        await btn('toggleKeep').click(); await page.wait_for_timeout(200); await btn('toggleKeep').click(); await page.wait_for_timeout(300)
        toast = await page.locator('.toast, #toast').first.inner_text(); L = await labels()
        print('undo:', L, '| toast:', toast); bad += [] if L == ('放出リストに載せる', '放出不可にする') and toast == '放出不可を解除しました' else ['undo']
        # whiteboard look
        await btn('toggleKeep').click(); await page.wait_for_timeout(200)
        await page.evaluate("localStorage.setItem('kuratsuku.board','white')"); await page.reload(); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400); await squad()
        await page.locator('.prow', has_text=name).first.click(); await page.wait_for_timeout(3000)
        await page.screenshot(path=str(OUT/f'keep-sheet-white{tag}.png'))
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
        return not bad and not errs
ok1 = asyncio.run(main())
ok2 = asyncio.run(main(375, 667, '-se'))  # iPhone SE
raise SystemExit(0 if ok1 and ok2 else 1)
