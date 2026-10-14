# Saved tactics: save, load (suspended players stay in the team and block kickoff), rename, delete;
# carried into a new game at another club (empty places, fill button), kept on the device after the save is deleted
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT/'test'/'shots'
page_html = (ROOT/'dist/touchline.html').read_text()
wrapped = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page_html + '</body></html>'
(ROOT/'test/page.html').write_text(wrapped); (ROOT/'test/blank.html').write_text('<!doctype html><title>b</title>')
LZ = (ROOT/'test/vendor/lz-string.min.js').read_text()
LOAD = "() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3)))"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(300)
        await page.click('text=新しく始める'); await page.click('[data-id="urawa"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        # preset A: the opening XI, counter
        await page.click('.plancard'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="ment"][data-k="def"]'); await page.wait_for_timeout(150)
        await page.click('#sheet [data-act="ctr"]'); await page.wait_for_timeout(150)
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        await page.fill('#pr-new', '格上用カウンター'); await page.click('#sheet [data-act="presetSave"]'); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD); A = st['presets'][0]
        print('saved A', A['name'], A['form'], A['ment'], 'ctr', A.get('ctr'), len([x for x in A['xi'] if x]), 'bench', len(A['bench']))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # preset B: another shape and best XI, attacking
        await page.select_option('select[data-chg="form"]', '3-4-2-1'); await page.wait_for_timeout(200)
        await page.click('[data-act="autoXI"]'); await page.wait_for_timeout(200)
        await page.click('.plancard'); await page.wait_for_timeout(400)
        await page.click('#sheet [data-act="ment"][data-k="att"]'); await page.wait_for_timeout(150)
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="presetSave"]:not([data-i])'); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD); print('presets', [(x['name'], x['form']) for x in st['presets']])
        await page.screenshot(path=str(OUT/'t-presets.png'))
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # suspend / injure two players of preset A while the app is closed
        SUS, INJ = A['xi'][3], A['xi'][9]
        await page.goto('about:blank')
        ed = await ctx.new_page(); await ed.route('https://**/*', route); await ed.goto('file://' + str(ROOT/'test/blank.html')); await ed.add_script_tag(content=LZ)
        await ed.evaluate('''([s, i]) => { const k='touchline.j1.save'; const st = JSON.parse(LZString.decompressFromBase64(localStorage.getItem(k).slice(3)));
          st.players[s].sus = 1; st.players[i].inj = 6; localStorage.setItem(k, 'lz:' + LZString.compressToBase64(JSON.stringify(st))); }''', [SUS, INJ])
        await ed.close()
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('[data-act="continue"]'); await page.wait_for_timeout(300)
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        print('status chips', await page.locator('#sheet .preset >> nth=0').locator('.chip').all_inner_texts())
        await page.screenshot(path=str(OUT/'t-presets2.png'))
        await page.click('#sheet [data-act="presetLoad"][data-i="0"]'); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); c = st['clubs']['urawa']
        print('loaded A: same XI', c['tac']['xi'] == A['xi'], '| form', c['tac']['form'], '| ment', c['tac']['ment'], 'ctr', c['tac'].get('ctr'), '| suspended kept', SUS in c['tac']['xi'], '| injured kept', INJ in c['tac']['xi'])
        print('banner', await page.locator('.card.alert').count(), '| out tokens', await page.locator('.tok.out').count(), '| toast', await page.locator('#toast, .toast').first.inner_text() if await page.locator('#toast, .toast').count() else '')
        await page.screenshot(path=str(OUT/'t-loaded.png'))
        await page.click('[data-act="go"]'); await page.wait_for_timeout(400)
        print('kickoff blocked', await page.locator('#sheet [data-act="kickoff"]').count() == 0)
        await page.click('#sheet [data-act="closeSheet"]'); await page.wait_for_timeout(300)
        # rename + delete
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="presetEdit"][data-i="1"]'); await page.wait_for_timeout(200)
        await page.fill('#pr-name', '格下用・攻撃的'); await page.click('#sheet [data-act="presetRename"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-act="presetDel"][data-i="0"]'); await page.wait_for_timeout(200)
        btn = await page.locator('#sheet [data-act="presetDel"][data-i="0"]').inner_text()
        await page.click('#sheet [data-act="presetDel"][data-i="0"]'); await page.wait_for_timeout(250)
        st = await page.evaluate(LOAD); print('confirm label', btn, '| presets now', [x['name'] for x in st['presets']])
        bad = []
        # a new game at another club: the saved tactics come along
        await page.goto('file://' + str(ROOT/'test/page.html')); await page.wait_for_timeout(400)
        await page.click('text=新しく始める'); await page.click('[data-id="kashima"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250)
        note = await page.locator('#sheet .mgr-card').inner_text(); print('name sheet note:', '保存した戦術（1件）' in note)
        bad += [] if '保存した戦術（1件）は新しいゲームでも使えます' in note else ['name sheet note']
        await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); print('carried', [(x['name'], x['club'], x.get('at') is not None) for x in st['presets']])
        bad += [] if st['my'] == 'kashima' and len(st['presets']) == 1 and st['presets'][0]['club'] == 'urawa' else ['carried']
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        fs = await page.locator('.formsel .fs-now b').inner_text(); print('formation plate', fs)
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        meta = await page.locator('#sheet .preset >> nth=0').inner_text(); print('row:', meta.replace('\n', ' | '))
        bad += [] if '浦和（ほかのクラブ）' in meta.replace('\n', '') and 'いない選手' in meta and ' 保存' in meta and 'ゲーム内' not in meta else ['row text']
        await page.screenshot(path=str(OUT/'t-presets-carry.png'))
        await page.click('#sheet [data-act="presetLoad"][data-i="0"]'); await page.wait_for_timeout(300)
        toast = await page.locator('.toast').first.inner_text(); print('toast', toast)
        bad += [] if '先発の11枠が空いています' in toast else ['toast']
        await page.wait_for_timeout(2600)
        ban = await page.locator('.card.alert').inner_text(); print('banner', ban.replace('\n', ' | '))
        bad += [] if '先発の11枠が空いています' in ban and await page.locator('.card.alert [data-act="fillEmpty"]').count() == 1 else ['banner']
        await page.screenshot(path=str(OUT/'t-presets-empty.png'))
        await page.click('[data-act="fillEmpty"]'); await page.wait_for_timeout(300)
        st = await page.evaluate(LOAD); t = st['clubs']['kashima']['tac']
        print('filled', len([x for x in t['xi'] if x]), 'bench', len(t['bench']), '| form', t['form'], '| banner', await page.locator('.card.alert').count())
        bad += [] if all(t['xi']) and t['form'] == st['presets'][0]['form'] and await page.locator('.card.alert').count() == 0 else ['fill']
        # delete the save: the tactics stay on the device and come into the next game
        await page.click('[data-tab="club"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="askReset"]'); await page.wait_for_timeout(300)
        rs = await page.locator('#sheet').inner_text(); bad += [] if '保存した戦術（1件）はこの端末に残り' in rs else ['reset note']
        await page.click('#sheet [data-act="doReset"]'); await page.wait_for_timeout(400)
        lib = await page.evaluate("() => JSON.parse(localStorage.getItem('kuratsuku.tactics') || 'null')"); print('device copy', lib and [x['name'] for x in lib])
        await page.click('text=新しく始める'); await page.click('[data-id="urawa"]'); await page.wait_for_timeout(350)
        await page.click('[data-act="nameClub"]'); await page.wait_for_timeout(250); await page.click('#sheet [data-act="startClub"]'); await page.wait_for_timeout(400)
        st = await page.evaluate(LOAD); print('after reset', [x['name'] for x in st['presets']])
        bad += [] if lib and len(st['presets']) == 1 else ['after reset']
        await page.click('[data-tab="tactics"]'); await page.wait_for_timeout(200)
        await page.click('[data-act="presets"]'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-act="presetLoad"][data-i="0"]'); await page.wait_for_timeout(300)
        st = await page.evaluate(LOAD); t = st['clubs']['urawa']['tac']; print('back at urawa: XI', len([x for x in t['xi'] if x]))
        bad += [] if all(t['xi']) else ['urawa XI']
        print('\n'.join(errs) or 'no errors')
        print('FAILED: ' + ', '.join(bad) if bad or errs else 'all ok')
        await b.close()
asyncio.run(main())
