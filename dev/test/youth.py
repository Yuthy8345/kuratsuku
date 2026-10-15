# Youth development UI: 成長の記録 (chart + 主力級まで), 期限付き移籍 (sheet, loanee view, squad/dev sections),
# the monthly 若手の成長レポート on the home screen, and old saves (v6) getting a growth chart.
# (Growth numbers, loans, gems: test/youth.js and test/loan.js)
import asyncio, pathlib, os, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'dotgothic16/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
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
                fn = u.split('/fs/')[1]; fam = next(x for x in ['yusei-magic', 'zen-kaku-gothic-new', 'dela-gothic-one', 'dotgothic16'] if fn.startswith(x))
                await r.fulfill(status=200, content_type='font/woff2', body=(FONTS/fam/'files'/fn).read_bytes())
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        st = await page.evaluate(LOAD); print('start', st['date'])
        async def squad(view='list'):
            await page.click('[data-tab="squad"]'); await page.wait_for_timeout(150)
            await page.click(f'[data-act="sqView"][data-k="{view}"]'); await page.wait_for_timeout(200)
        async def open_player(name):
            if name == 'youngest':
                await page.click('[data-act="sqSort"][data-k="age"]'); await page.wait_for_timeout(200)
                await page.locator('.list .prow').first.click(); await page.wait_for_timeout(400); return
            await page.locator('.prow', has_text=name).first.click(); await page.wait_for_timeout(400)
        # --- 三井寺: growth block in his sheet
        await squad()
        await open_player('三井寺')
        body = await page.locator('#sheet').inner_text()
        print('三井寺 sheet:', re.search(r'主力級（.*?(?=\n23歳|\n期限)', body, re.S).group(0).replace('\n', ' ') if '主力級' in body else '(no ETA)')
        bad += [] if '成長の記録' in body and '期限付き移籍（J2）を検討する' in body else ['growth block']
        # --- loan sheet: three J2 clubs, the stay-home reference
        await page.click('#sheet [data-act="loanSheet"]'); await page.wait_for_timeout(400)
        body = await page.locator('#sheet').inner_text()
        opts = await page.locator('#sheet [data-act="loanGo"]').count()
        print('loan sheet: options', opts, '| stay ref', '残った場合' in body, '| enabled', await page.locator('#sheet [data-act="loanGo"]:not([disabled])').count())
        bad += [] if opts == 3 and '残った場合' in body else ['loan sheet']
        await page.wait_for_timeout(2700); await page.screenshot(path=str(OUT/'y-loan.png'))
        club = await page.locator('#sheet [data-act="loanGo"]').first.get_attribute('data-k')
        await page.click('#sheet [data-act="loanGo"] >> nth=0'); await page.wait_for_timeout(450)
        body = await page.locator('#sheet').inner_text(); st = await page.evaluate(LOAD)
        mitsui = next(x for x in st['players'].values() if '三井寺' in x['name'])
        print('loaned to', club, '| saved', mitsui['club'], mitsui.get('loan', {}).get('share'), '| chip', '期限付き移籍中' in body, '| bid buttons', await page.locator('#sheet [data-act="bid"]').count())
        bad += [] if mitsui['club'] == club and mitsui.get('loan') and '期限付き移籍中' in body and not await page.locator('#sheet [data-act="bid"]').count() else ['loan out']
        await page.wait_for_timeout(2700); await page.screenshot(path=str(OUT/'y-lent.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # --- squad + dev views list him under 期限付き移籍中, and he is out of the XI
        sec = await page.locator('.sec-h', has_text='期限付き移籍中').count()
        rows = await page.locator('.sec-h:has-text("期限付き移籍中") + ul .prow').count()
        xi = mitsui['id'] in (st['clubs']['yokohamafm']['tac']['xi'] + st['clubs']['yokohamafm']['tac']['bench'])
        print('squad section', sec, 'rows', rows, '| still in XI/bench', xi); bad += [] if sec == 1 and rows == 1 and not xi else ['squad section']
        await squad('dev'); n = await page.locator('.sec-h:has-text("期限付き移籍中") + ul .prow').count()
        print('dev view loan rows', n); bad += [] if n == 1 else ['dev section']
        # --- advance past the 1st of the month: 若手の成長レポート
        m0 = st['date'][:7]
        for i in range(60):
            st = await page.evaluate(LOAD)
            if st['date'][:7] != m0: break
            await page.click('[data-act="go"]'); await page.wait_for_timeout(200)
            if await page.locator('#sheet .card.alert').count():
                await page.click('#sheet [data-act="toTactics"]'); await page.wait_for_timeout(250); await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
                await page.click('[data-act="go"]'); await page.wait_for_timeout(300)
            if await page.locator('#sheet [data-act="quick"]').count():
                await page.click('#sheet [data-act="quick"]'); await page.wait_for_timeout(200); await page.click('[data-act="mClose"]'); await page.wait_for_timeout(150)
            elif await page.locator('#sheet.on [data-act="closeSheet"]').count(): await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(250)
        # the report is in the secretary's summary of the month (2026-10-15〜; before, a card on the home screen)
        await page.click('[data-tab="home"]'); await page.wait_for_timeout(250)
        bub = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
        print('secretary:', bub.split('\n')[0] if bub else '(none)')
        txt = ''
        if await page.locator('#sec-float .sec-mag').count():
            await page.click('#sec-float .sec-mag'); await page.wait_for_timeout(350)
            if await page.locator('#sheet [data-act="youthOpen"]').count():
                await page.click('#sheet [data-act="youthOpen"]'); await page.wait_for_timeout(350)
                txt = await page.locator('#sheet').inner_text()
        print('date', st['date'], '| youth report:', txt.split('\n')[0] if txt else '(none)', '| rows', await page.locator('#sheet .prow').count() if txt else 0, '| loanee listed', 'レンタル中' in txt)
        bad += [] if txt and '若手の成長レポート' in txt and 'レンタル中' in txt else ['youth report']
        if txt:
            await page.screenshot(path=str(OUT/'y-report.png'))
            await page.click('#sheet [data-act="secOpen"]'); await page.wait_for_timeout(300)
            await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
            b2 = await page.locator('#sec-float .sec-bub').inner_text() if await page.locator('#sec-float .sec-bub').count() else ''
            gone = '月になりました' not in b2
            print('read: the summary leaves the bubble', gone); bad += [] if gone else ['close report']
        # --- a young player at home now has a chart (two points)
        await squad()
        await open_player('youngest')
        svg = await page.locator('#sheet svg.gchart').count(); print('chart in the youngest player sheet:', svg); bad += [] if svg == 1 else ['chart']
        await page.locator('#sheet .gchart').scroll_into_view_if_needed(); await page.wait_for_timeout(2700)
        await page.screenshot(path=str(OUT/'y-chart.png'))
        await page.evaluate("localStorage.setItem('kuratsuku.board','white')"); await page.reload(); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400); await squad(); await open_player('youngest')
        await page.locator('#sheet .gchart').scroll_into_view_if_needed(); await page.wait_for_timeout(300)
        await page.screenshot(path=str(OUT/'y-chart-white.png'))
        await page.evaluate("localStorage.removeItem('kuratsuku.board')")
        # --- an old save (v6, no charts) gets one started
        await page.goto('about:blank')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''() => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          for (const p of Object.values(st.players)) delete p.trk; st.v = 6; st.inbox = st.inbox.filter(x => x.type !== 'youth'); localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''')
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(500)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        await squad(); await open_player('youngest'); body = await page.locator('#sheet').inner_text()
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        await page.click('[data-act="go"]'); await page.wait_for_timeout(300)   # anything that saves
        st = await page.evaluate(LOAD); n = sum(1 for x in st['players'].values() if x.get('trk') and (x['club'] == st['my'] or (x.get('loan') or {}).get('from') == st['my']))
        print('old save -> v', st['v'], '| players with a chart', n, '| sheet ok', '成長の記録' in body); bad += [] if st['v'] >= 7 and n >= 20 and '成長の記録' in body else ['old save']
        print('\n'.join(errs) or 'no errors')
        print('ALL OK' if not bad and not errs else f'PROBLEMS: {bad}')
        await b.close()
asyncio.run(main())
