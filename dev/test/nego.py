# 移籍交渉 in the browser: the player sheet has one 交渉する button, the negotiation sheet shows the club's asking price
# (要求額), its patience (3 magnets), the chips, what was said, my offer (− / ＋ / quick amounts), the club answers, the
# patience runs out (today's ask is final), the negotiation survives a reload, agreeing signs him; the shortlist and the
# market say 交渉中 / 要求額; offers for my players: 増額を求める (raised, or withdrawn). iPhone SE: everything reachable.
# Whiteboard look. Shots: test/shots/nego-*.png
import asyncio, pathlib, os, re, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
FONTS = pathlib.Path(os.environ.get('KTK_FONTS', '/nonexistent'))
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped)
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
SAVE = "s => localStorage.setItem('touchline.j1.save', 'lz:' + LZString.compressToBase64(s))"
PID = '289'  # 細谷 真大（柏）
def font_css():
    if not FONTS.exists(): return None
    css = ''.join((FONTS/f).read_text() for f in ['dela-gothic-one/400.css', 'yusei-magic/400.css'] + [f'zen-kaku-gothic-new/{w}.css' for w in (400, 500, 700, 900)])
    return re.sub(r"url\(\./files/([^)]+)\)", lambda m: f"url(https://fonts.gstatic.com/fs/{m.group(1)})", css)
def yen(t):  # '3.5億円' / '9,800万円' -> 万円
    t = t.replace(',', '').strip()
    m = re.search(r'([\d.]+)億', t); n = re.search(r'([\d.]+)万', t)
    return round((float(m.group(1)) * 10000 if m else 0) + (float(n.group(1)) if n and not m else 0))

async def main():
    css = font_css(); bad = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        async def newpage(vw, vh):
            ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=True)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: bad.append('PAGEERROR: ' + str(e)))
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
            return page
        page = await newpage(393, 852); vh = 852
        sheet = page.locator('#sheet')
        fits = lambda bb, h=None: bb and bb['y'] >= 0 and bb['y'] + bb['height'] <= (h or vh) + 0.5
        async def calm(): await page.wait_for_timeout(2900)  # let the toast fade
        async def toast(): return (await page.locator('.toast').first.inner_text()) if await page.locator('.toast').count() else ''
        await page.click('text=新しく始める'); await page.click('[data-id="yokohamafm"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(500)
        async def market(view='find', where=None):
            await page.click('[data-tab="club"]'); await page.wait_for_timeout(150)
            await page.click('[data-act="clView"][data-k="market"]'); await page.wait_for_timeout(150)
            await page.click(f'[data-act="mkView"][data-k="{view}"]'); await page.wait_for_timeout(200)
            if where: await page.click(f'[data-act="mkWhere"][data-k="{where}"]'); await page.wait_for_timeout(250)
        await market('find', 'j')
        await page.locator(f'.prow[data-id="{PID}"]').first.click(); await page.wait_for_timeout(400)
        btn = sheet.locator('[data-act="nego"]')
        print('player sheet:', (await btn.inner_text()).strip(), '| old bid buttons', await sheet.locator('[data-act="bid"]').count())
        bad += [] if (await btn.inner_text()).strip() == '交渉する' and not await sheet.locator('[data-act="bid"]').count() else ['one 交渉する button']

        # ---- the negotiation sheet ----
        await btn.click(); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); n = st['nego'][PID]
        txt = await sheet.inner_text(); amt = lambda: page.locator('#sheet .ng-step .amt b').inner_text()
        ask = n['ask']; pr = yen(re.search(r'相場（市場価値）\s*([^\n]+)', txt).group(1))
        step = next(x for x in [10000, 5000, 3000, 2000, 1000, 500, 300, 200, 100] if x <= pr * 0.05)
        print('ask', ask, 'price', pr, 'step', step, '| shown', re.search(r'柏の要求額\s*([^\n]+)', txt).group(1), '| offer', await amt())
        bad += [] if '柏の要求額' in txt and yen(re.search(r'柏の要求額\s*([^\n]+)', txt).group(1)) == ask else ['ask shown']
        bad += [] if await page.locator('#sheet .ng-pat i').count() == 3 and not await page.locator('#sheet .ng-pat i.off').count() else ['patience 3']
        bad += [] if '本人：' in txt and '主力' in txt and 'まだ提示していません' in txt else ['chips / empty log']
        bad += [] if yen(await amt()) == min(ask, round(ask * 0.9 / step) * step) else ['starts at 90% of the ask']
        a0 = yen(await amt())
        await sheet.locator('[data-act="ngStep"][data-d="-1"]').click(); await sheet.locator('[data-act="ngStep"][data-d="-1"]').click(); await page.wait_for_timeout(150)
        a1 = yen(await amt()); await sheet.locator('[data-act="ngStep"][data-d="1"]').click(); await page.wait_for_timeout(150); a2 = yen(await amt())
        print('− − ＋:', a0, a1, a2); bad += [] if a1 == a0 - 2 * step and a2 == a0 - step else ['− / ＋ steps']
        await sheet.locator('[data-act="ngSet"][data-k="v"]').click(); await page.wait_for_timeout(150)
        av = yen(await amt()); print('相場:', av); bad += [] if abs(av - pr) <= step / 2 + 50 else ['quick: market price']
        await sheet.locator('[data-act="ngSet"][data-k="95"]').click(); await page.wait_for_timeout(150)
        a95 = yen(await amt()); bad += [] if abs(a95 - ask * 0.95) <= step / 2 + 50 else ['quick: 95%']
        # offer the market price (well below a top player's bottom line): the club answers
        await sheet.locator('[data-act="ngSet"][data-k="v"]').click(); await page.wait_for_timeout(150)
        await sheet.locator('[data-act="ngOffer"]').click(); await page.wait_for_timeout(300)
        t1 = await toast(); st = await page.evaluate(LOAD); n = st['nego'][PID]
        print('offer 相場 →', t1, '| patience', n['pat'], '| log', len(n['log']))
        bad += [] if t1.startswith('柏「') and n['pat'] < 3 and len(n['log']) == 2 and await page.locator('#sheet .ng-log li').count() == 2 else ['the club answers']
        sl = next((e for e in st['shortlist'] if str(e['pid']) == PID), None); bad += [] if sl and sl['guide'] == n['ask'] else ['on the shortlist with the ask']
        nxt = yen(await amt()); bad += [] if n['pat'] == 0 or (av < nxt <= n['ask']) else ['next suggestion between my offer and the ask']
        await calm(); await page.screenshot(path=str(OUT/'nego-sheet.png'))
        # far too low until the patience runs out → today's ask is final
        for _ in range(8):
            if await page.locator('#sheet .ng-fin').count(): break
            for _ in range(30):
                m = sheet.locator('[data-act="ngStep"][data-d="-1"]')
                if await m.is_disabled(): break
                await m.click()
            await sheet.locator('[data-act="ngOffer"]').click(); await page.wait_for_timeout(300)
        st = await page.evaluate(LOAD); n = st['nego'][PID]
        print('final:', n['fin'], n['pat'], '| offer button', await sheet.locator('[data-act="ngOffer"]').count(), '| agree', (await sheet.locator('[data-act="ngAgree"]').inner_text()).strip())
        bad += [] if n['fin'] and await page.locator('#sheet .ng-fin').count() and not await sheet.locator('[data-act="ngOffer"]').count() and await page.locator('#sheet .ng-pat i.off').count() == 3 else ['final ask']
        await calm(); await page.screenshot(path=str(OUT/'nego-final.png'))
        # back to the player: 交渉を続ける with the ask, and the last answer
        await sheet.locator('[data-act="ngBack"]').click(); await page.wait_for_timeout(300)
        txt = await sheet.inner_text(); line = re.search(r'前回[^\n]*', txt)
        print('player sheet:', line.group(0) if line else '-', '|', (await sheet.locator('[data-act="nego"]').inner_text()).strip())
        bad += [] if line and '柏の要求額' in line.group(0) and '交渉を続ける（要求額' in txt and 'ショートリスト' in txt else ['player sheet after']
        await sheet.locator('[data-act="closeSheet"]').last.click(); await page.wait_for_timeout(300)
        chip = await page.locator(f'.prow[data-id="{PID}"] .chip:text("交渉中")').count(); bad += [] if chip else ['market chip 交渉中']
        await market('short')
        row = await page.locator('.list .prow').first.inner_text(); print('shortlist row:', row.replace('\n', ' ')[:90])
        bad += [] if '要求額' in row and '柏と交渉中' in row else ['shortlist row']
        await page.screenshot(path=str(OUT/'nego-short.png'))
        # survives a reload (same day: still final), then agree
        await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(400)
        await market('short'); await page.locator('.list .prow').first.click(); await page.wait_for_timeout(350)
        await sheet.locator('[data-act="nego"]').click(); await page.wait_for_timeout(350)
        bad += [] if await page.locator('#sheet .ng-fin').count() and await page.locator('#sheet .ng-log li').count() >= 4 else ['reload keeps the negotiation']
        funds0 = (await page.evaluate(LOAD))['clubs']['yokohamafm']['funds']
        await sheet.locator('[data-act="ngAgree"]').click(); await page.wait_for_timeout(400)
        t2 = await toast(); st = await page.evaluate(LOAD); p = st['players'][PID]
        print('agree →', t2, '| club', p['club'], '| paid', funds0 - st['clubs']['yokohamafm']['funds'], '| sheet open', await page.locator('#sheet.on').count())
        bad += [] if p['club'] == 'yokohamafm' and '獲得' in t2 and funds0 - st['clubs']['yokohamafm']['funds'] == n['ask'] and not st.get('nego', {}).get(PID) else ['agree signs him']

        # ---- offers for my players: 増額を求める ----
        st = await page.evaluate(LOAD)
        mine = sorted([q for q in st['players'].values() if q['club'] == 'yokohamafm'], key=lambda q: -q['ovr'])
        def offer(q, walk, iid): return {'id': iid, 'type': 'offer', 'pid': q['id'], 'from': 'kashima', 'fee': 30000, 'top': 36000, 'walk': walk, 'd': st['date'], 'exp': st['date'], 'seen': False, 'done': False}
        st['inbox'] = [offer(mine[1], 0, 9001), offer(mine[2], 1, 9002)] + st['inbox']
        await page.goto('about:blank'); await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)  # no save pending
        await page.evaluate(SAVE, json.dumps(st)); await page.reload(); await page.wait_for_timeout(400); await page.click('[data-act="continue"]'); await page.wait_for_timeout(500)
        await page.click('[data-tab="home"]'); await page.wait_for_timeout(300)
        cards = page.locator('article.card:has([data-act="offerUp"])')
        print('offer cards with 増額を求める:', await cards.count()); bad += [] if await cards.count() == 2 else ['raise buttons']
        await cards.first.scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'nego-offer.png'))
        await page.click('[data-act="offerUp"][data-id="9001"]'); await page.wait_for_timeout(300)
        t3 = await toast(); card = await page.locator('article.card:has([data-id="9001"])').inner_text()
        print('raise →', t3, '|', ' '.join(l for l in card.split('\n') if '提示' in l or '増額' in l)[:80])
        bad += [] if '増額した' in t3 and '増額（+' in card and not await page.locator('[data-act="offerUp"][data-id="9001"]').count() else ['raised']
        await page.click('[data-act="offerUp"][data-id="9002"]'); await page.wait_for_timeout(300)
        t4 = await toast(); print('raise →', t4); bad += [] if '取り下げ' in t4 and not await page.locator('[data-id="9002"]').count() else ['withdrawn']
        await calm(); await page.locator('article.card:has([data-id="9001"])').scroll_into_view_if_needed(); await page.screenshot(path=str(OUT/'nego-offer-raised.png'))
        st = await page.evaluate(LOAD); it = next(x for x in st['inbox'] if x['id'] == 9001)
        bad += [] if it['raised'] and 30000 < it['fee'] <= 36000 and it['fee0'] == 30000 else ['raise saved']
        saved = await page.evaluate("() => localStorage.getItem('touchline.j1.save')")

        # ---- iPhone SE: a fresh negotiation, everything on screen ----
        se = await newpage(375, 667)
        await se.evaluate("s => localStorage.setItem('touchline.j1.save', s)", saved); await se.reload(); await se.wait_for_timeout(400)
        await se.click('[data-act="continue"]'); await se.wait_for_timeout(400)
        await se.click('[data-tab="club"]'); await se.click('[data-act="clView"][data-k="market"]'); await se.click('[data-act="mkView"][data-k="find"]'); await se.click('[data-act="mkWhere"][data-k="j"]'); await se.wait_for_timeout(300)
        await se.locator('#mk-list .prow').nth(1).click(); await se.wait_for_timeout(350)
        bad += [] if fits(await se.locator('#sheet [data-act="nego"]').bounding_box(), 667) else ['SE: 交渉する on screen']
        await se.locator('#sheet [data-act="nego"]').click(); await se.wait_for_timeout(400)
        for a in ('ngAgree', 'ngOffer', 'ngBack'):
            if not fits(await se.locator(f'#sheet [data-act="{a}"]').bounding_box(), 667): bad.append('SE: ' + a)
        await se.locator('#sheet .ng-step').scroll_into_view_if_needed()
        for k in ('-1', '1'):
            if not fits(await se.locator(f'#sheet [data-act="ngStep"][data-d="{k}"]').bounding_box(), 667): bad.append('SE: step ' + k)
        await se.screenshot(path=str(OUT/'nego-se.png'))
        # whiteboard
        await se.evaluate("localStorage.setItem('kuratsuku.board','white')"); await se.reload(); await se.wait_for_timeout(400)
        await se.click('[data-act="continue"]'); await se.wait_for_timeout(400)
        await se.click('[data-tab="club"]'); await se.click('[data-act="clView"][data-k="market"]'); await se.click('[data-act="mkView"][data-k="find"]'); await se.click('[data-act="mkWhere"][data-k="j"]'); await se.wait_for_timeout(300)
        await se.locator('#mk-list .prow').nth(1).click(); await se.wait_for_timeout(350)
        await se.locator('#sheet [data-act="nego"]').click(); await se.wait_for_timeout(400)
        await se.locator('#sheet [data-act="ngSet"][data-k="v"]').click(); await se.wait_for_timeout(150)
        await se.screenshot(path=str(OUT/'nego-white.png'))
        await b.close()
    print('\n' + ('ALL OK' if not bad else 'FAIL: ' + ', '.join(bad)))
    return 1 if bad else 0
raise SystemExit(asyncio.run(main()))
