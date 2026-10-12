# 監督名: the club sheet has no name field any more; 「◯◯で始める」 opens the nameplate (no focus until tapped), Enter only
# closes the keyboard, 「就任する」 starts, 「戻る」 goes back to the club, and an empty name starts as 「あなた」.
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
async def main():
    css = font_css(); bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for board in ['chalk', 'white']:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
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
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
            if board == 'white': await page.evaluate("localStorage.setItem('kuratsuku.board','white')"); await page.reload(); await page.wait_for_timeout(300)
            await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(400)
            inputs = await page.locator('#sheet input').count(); btn = await page.locator('#sheet [data-act="nameClub"]').inner_text()
            print(board, '| club sheet inputs', inputs, '| button', btn); bad += [] if inputs == 0 and btn.endswith('で始める') else ['club sheet']
            await page.click('#sheet [data-act="nameClub"]'); await page.wait_for_timeout(400)
            focused = await page.evaluate("document.activeElement && document.activeElement.id")
            print('nameplate shown, focus on', focused); bad += [] if focused != 'mgr-name' else ['focus']
            if board == 'chalk':
                # 戻る → the club again, then forward
                await page.click('#sheet [data-act="pickClub"]'); await page.wait_for_timeout(300)
                back = await page.locator('#sheet [data-act="nameClub"]').count(); print('back to the club:', back); bad += [] if back else ['back']
                await page.click('#sheet [data-act="nameClub"]'); await page.wait_for_timeout(300)
                await page.click('#mgr-name'); await page.keyboard.type('ソーイ'); await page.wait_for_timeout(200)
                await page.keyboard.press('Enter'); await page.wait_for_timeout(400)
                still = await page.locator('#sheet [data-act="startClub"]').count(); blurred = await page.evaluate("document.activeElement && document.activeElement.id") != 'mgr-name'
                print('Enter -> still on the nameplate', bool(still), '| keyboard closed', blurred); bad += [] if still and blurred else ['enter']
                await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/'mgr-name.png'))
                await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(600)
                st = await page.evaluate(LOAD); print('就任 -> manager', st['manager'], '| club', st['my']); bad += [] if st['manager'] == 'ソーイ' and st['my'] == 'yokohamafm' else ['start']
            else:
                await page.wait_for_timeout(300); await page.screenshot(path=str(OUT/'mgr-name-white.png'))
                await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(600)
                st = await page.evaluate(LOAD); print('empty -> manager', st['manager']); bad += [] if st['manager'] == 'あなた' else ['empty']
            print('\n'.join(errs) or 'no errors'); bad += ['errors'] if errs else []
            await ctx.close()
        print('ALL OK' if not bad else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
