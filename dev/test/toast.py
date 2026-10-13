# Toasts (the short messages above the dock): a short one stays on one line, a long one breaks only between phrases
# (after 、。 or around brackets), never inside a word (2026-10-13: 「スタメン」を読み込みま／した — the toast was capped at
# half the screen by left:50%). Widths from the iPhone SE to the Pro Max, both boards.
# usage: python3 test/toast.py   (KTK_PAGE=path to another dist/touchline.html)
import asyncio, pathlib, os
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
html = pathlib.Path(os.environ.get('KTK_PAGE', ROOT/'dist/touchline.html')).read_text()
(ROOT/'test/page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
# the toast's text split into its rendered lines
LINES = '''() => { const el = document.getElementById('toast'), t = el.firstChild; if (!t) return [];
  const r = document.createRange(), out = []; let top = null, cur = '';
  for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getClientRects()[0]; if (!b) { cur += t.data[i]; continue; }
    if (top != null && b.top > top + 4) { out.push(cur); cur = ''; } if (top == null || b.top > top + 4) top = b.top; cur += t.data[i]; }
  if (cur) out.push(cur); return out; }'''
BOX = "() => { const b = document.getElementById('toast').getBoundingClientRect(); return [b.left, b.right, innerWidth]; }"
OK_END = tuple('、。）」！？')     # a line may end after these …
OK_NEXT = tuple('（「')            # … or just before these
async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, board in [(375, 'chalk'), (393, 'chalk'), (440, 'white'), (320, 'chalk')]:
            ctx = await b.new_context(viewport={'width': w, 'height': 800}, device_scale_factor=2, has_touch=True)
            page = await ctx.new_page(); errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            async def route(r):
                if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
                else: await r.abort()
            await page.route('https://**/*', route)
            await page.add_init_script(f"localStorage.setItem('kuratsuku.board', '{board}')")
            await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
            await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(300)
            await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(300)
            async def check(what, want_one):
                await page.wait_for_timeout(260)
                lines = await page.evaluate(LINES); l, r, iw = await page.evaluate(BOX)
                q = []
                if want_one and len(lines) != 1: q.append(f'{len(lines)} lines')
                for a, n in zip(lines, lines[1:]):
                    if not (a.endswith(OK_END) or n.startswith(OK_NEXT)): q.append(f'breaks inside a phrase: {a}／{n}')
                if l < 15.5 or r > iw - 15.5: q.append(f'outside the screen {l:.0f}-{r:.0f}')
                if abs((l + r) / 2 - iw / 2) > 1: q.append('not centred')
                print(f"{w}px {board:5s} {what:6s} {' ／ '.join(lines)} | {'OK' if not q else ' / '.join(q)}")
                if q: bad.append(f'{w} {what}')
            # load a saved tactic named スタメン
            await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
            await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
            await page.fill('#pr-new', 'スタメン'); await page.click('#sheet [data-act="presetSave"]'); await page.wait_for_timeout(250)
            await page.click('#sheet [data-act="presetLoad"][data-i="0"]')
            await check('load', True)
            if w == 375: await page.screenshot(path=str(OUT/f'toast-load-{w}.png'))
            await page.wait_for_timeout(2700)
            # a long one: 放出不可 on a player who was on the 放出リスト
            await page.click('[data-tab="squad"]'); await page.wait_for_timeout(200)
            await page.locator('[data-act="player"]').nth(3).click(); await page.wait_for_timeout(350)
            await page.click('#sheet [data-act="toggleList"]'); await page.wait_for_timeout(2900)
            await page.click('#sheet [data-act="toggleKeep"]')
            await check('long', False)
            if w == 375: await page.screenshot(path=str(OUT/f'toast-long-{w}.png'))
            if errs: print('errors:', errs); bad.append(f'{w} errors')
            await ctx.close()
        await b.close()
    print('ALL OK' if not bad else f'PROBLEMS: {bad}')
asyncio.run(main())
