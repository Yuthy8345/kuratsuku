# Shortlist in the transfer market: bids land on it (with the result), market rows are marked 入札済み,
# the list survives a reload, and a player can be taken off from his sheet. (Signing / retiring: test/shortlist.js)
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
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="okayama"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        async def market(view):
            await page.click('[data-tab="club"]'); await page.wait_for_timeout(150)
            await page.click('[data-act="clView"][data-k="market"]'); await page.wait_for_timeout(150)
            await page.click(f'[data-act="mkView"][data-k="{view}"]'); await page.wait_for_timeout(200)
        await market('short')
        empty = await page.locator('.empty').first.inner_text()
        print('empty state:', empty[:30]); bad += [] if 'まだ入札した選手はいません' in empty else ['empty state']
        # bid low on the top three of the market
        await market('find')
        names = []
        for i in range(3):
            row = page.locator('#mk-list .prow').nth(i)
            names.append(await row.locator('.nm b').inner_text())
            await row.click(); await page.wait_for_timeout(350)
            await page.click('#sheet [data-act="nego"]'); await page.wait_for_timeout(300)
            await page.click('#sheet [data-act="ngSet"][data-k="v"]'); await page.wait_for_timeout(150)   # offer the market price
            await page.click('#sheet [data-act="ngOffer"]'); await page.wait_for_timeout(350)
            await page.click('#sheet [data-act="ngBack"]'); await page.wait_for_timeout(300)
            sheet = await page.locator('#sheet').inner_text()
            if i == 0:
                await page.wait_for_timeout(2600)  # let the toast fade
                await page.screenshot(path=str(OUT/'sl-sheet.png'))
            last = re.search(r'前回[^\n]*', sheet)
            print(f'offer to {names[-1]}:', last.group(0) if last else '(no status)', '| chip', 'ショートリスト' in sheet, '| continue', '交渉を続ける' in sheet or '交渉不可' in sheet)
            if not last or 'ショートリスト' not in sheet: bad.append(f'sheet {i}')
            await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        marked = await page.locator('#mk-list .chip:text("交渉中")').count()
        print('market rows marked 交渉中:', marked); bad += [] if marked == 3 else ['marked']
        await page.click('[data-act="mkView"][data-k="short"]'); await page.wait_for_timeout(250)
        rows = await page.locator('.list .prow').all_inner_texts()
        tab = await page.locator('[data-act="mkView"][data-k="short"]').inner_text()
        print('tab:', tab, '| rows:', len(rows)); bad += [] if len(rows) == 3 and tab.strip().endswith('3') else ['list']
        await page.screenshot(path=str(OUT/'sl-list.png'))
        # survives a reload
        await page.goto('about:blank'); await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        await market('short')
        n = await page.locator('.list .prow').count(); print('after reload:', n); bad += [] if n == 3 else ['reload']
        # take one off from his sheet
        await page.locator('.list .prow').first.click(); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="unshort"]'); await page.wait_for_timeout(300)
        chip = 'ショートリスト' in await page.locator('#sheet .row.wrap').first.inner_text() if await page.locator('#sheet .row.wrap').count() else False
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        n2 = await page.locator('.list .prow').count()
        st = await page.evaluate(LOAD)
        print('after removing one:', n2, '| saved', len(st['shortlist']), '| chip gone', not chip); bad += [] if n2 == 2 and len(st['shortlist']) == 2 and not chip else ['remove']
        # whiteboard look
        await page.evaluate("localStorage.setItem('kuratsuku.board','white')"); await page.reload(); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400); await market('short')
        await page.screenshot(path=str(OUT/'sl-list-white.png'))
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
