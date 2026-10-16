"""仕込みセーブ（2026-10-16）: 引き継ぎコードやセーブに HTML が仕込まれていても、画面でタグとして動かないか。
ゲームの中の日本語の文字列すべて（選手・クラブ・監督・秘書の名前、ニュース、記録など約4,000個）の後ろに
  "'><img src=x onerror=console.error(/XSSFIRED/)>
を付けたセーブを engine で作り（横浜FM・数か月進めたところ）、タイトル画面の「引き継ぎコードで復元」に貼り付けて読み込む。
そのあと、①見て回る（タブ・サブ画面・選手シート・他チーム・秘書・戦術の保存・試合の詳細などをランダムに押す）、
②遊ぶ（次へ進む・キックオフ＝ライブの試合・秘書のおすすめを優先して押す）。押すのは JS の click()（長い文字列で
レイアウトが崩れても止まらない）。1回押すごとに、on〜 属性に仕込みの文字が入った要素・<img src="x"> が無いかを見る。
合格: 仕込みが一度も動かない・タグにならない・仕込みの文字が画面に文字として出ている（仕込みが届いている確認）。
usage: python3 dev/test/inject.py [見て回る回数=500] [遊ぶ回数=400] [seed=1]   （既定で約2分半）
`KTK_PAGE=<touchline.html>` で別のビルド（テストが見張れているかの確認: esc() を素通しにしたビルドなら FAIL になる）"""
import asyncio, pathlib, sys, random, json, subprocess, time, os
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/kuratsuku/dev'); OUT = ROOT / 'test' / 'shots' / 'inject'; OUT.mkdir(parents=True, exist_ok=True)
BROWSE = int(sys.argv[1]) if len(sys.argv) > 1 else 500; PLAY = int(sys.argv[2]) if len(sys.argv) > 2 else 400
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 1; random.seed(SEED)
PAY = '"\'><img src=x onerror=console.error(/XSSFIRED/)>'
MAKE = r'''
const E = require('./src/engine.js'), DATA = require('./data.json');
let seed = Number(process.argv[1]); Math.random = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-14');
for (let i = 0; i < 140; i++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
}
const PAY = process.argv[2]; let n = 0;
const walk = o => { for (const k of Object.keys(o)) { const v = o[k];
  if (typeof v === 'string' && /[^\x00-\x7f]/.test(v)) { o[k] = v + PAY; n++; } else if (v && typeof v === 'object') walk(v); } };
walk(S); S.sec.name = PAY;
process.stdout.write(JSON.stringify({ n, date: S.date, save: S }));
'''
made = json.loads(subprocess.run(['node', '-e', MAKE, str(SEED + 6), PAY], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
LZ = (ROOT / 'test/vendor/lz-string.min.js').read_text()
PAGE = ROOT / 'test' / 'page_inject.html'   # page.html はほかの画面のテストが使うので別の名前
PAGE.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + pathlib.Path(os.environ.get('KTK_PAGE') or ROOT / 'dist/touchline.html').read_text() + '</body></html>')
# 押してよいもの（セーブを消す・タイトルに戻る・契約や移籍を決めるものは押さない）
OK = set('''tab sqView lgView clView mkView player team teamTab teamPlayer teamBack playerBack secOpen secPre fxDetail sponOpen
  campOpen presets presetEdit presetRename presetSave secName closeSheet go quick kickoff mClose mSkip mResult round training plan
  numSheet loanSheet htOpen youthOpen job board boardLv sqSort sqPos devFilter mkPos exportOpen aboutOpen cupPick spTap campRep
  nego toggleList slot benchPick secAll secOne secBack secKeep secDone offerNo retNext celeDone rebornDone campRepDone closeOut
  continue subRate'''.split())
PLAYS = ('go', 'kickoff', 'secAll', 'mSkip', 'mResult', 'mClose', 'offerNo', 'retNext', 'celeDone', 'rebornDone', 'campRepDone', 'continue')
PROBE = '''() => { const bad = [];
  for (const e of document.querySelectorAll('*')) for (const a of e.attributes) if (/^on/i.test(a.name) && /XSSFIRED/.test(a.value)) bad.push(e.tagName + ' ' + a.name);
  for (const e of document.querySelectorAll('img[src="x"]')) bad.push('IMG src=x');
  return { bad: bad.slice(0, 5), shown: (document.body.innerText.match(/XSSFIRED/g) || []).length }; }'''
ACTS = '''() => { const all = [...document.querySelectorAll('[data-act]')], s = document.querySelector('#sheet.on');
  return all.map((e, i) => [e.dataset.act, i, !s || s.contains(e) || !!e.closest('#match')]).filter(a => a[2]).map(a => [a[0], a[1]]); }'''

async def main():
    t0 = time.time()
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True)
        page = await ctx.new_page(); fired = []; errs = []
        page.on('console', lambda m: fired.append(m.text) if 'XSSFIRED' in m.text else (errs.append('CONSOLE: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text else None))
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        async def route(r):
            if 'lz-string' in r.request.url: await r.fulfill(status=200, content_type='application/javascript', body=LZ)
            else: await r.abort()
        await page.route('https://**/*', route)
        await page.goto('file://' + str(PAGE)); await page.wait_for_timeout(300)
        await page.evaluate('() => localStorage.clear()'); await page.reload(); await page.wait_for_timeout(300)
        # 引き継ぎコードで復元（タイトル画面から、実際の貼り付けと同じ道すじ）
        code = await page.evaluate('s => "KTK1.lz:" + LZString.compressToBase64(JSON.stringify(s))', made['save'])
        await page.click('[data-act="importOpen"]'); await page.fill('#imp-code', code); await page.click('#sheet [data-act="doImport"]'); await page.wait_for_timeout(400)
        imported = await page.evaluate("() => !!localStorage.getItem('touchline.j1.save')")
        r0 = await page.evaluate(PROBE); bad = [(0, 'import', r0['bad'])] if r0['bad'] else []
        await page.screenshot(path=str(OUT / 'title.png'))
        if await page.locator('text=つづきから').count(): await page.click('text=つづきから'); await page.wait_for_timeout(500)   # 復元するとそのままホームへ
        seen = {}; shown = r0['shown']
        for i in range(BROWSE + PLAY):
            acts = [a for a in await page.evaluate(ACTS) if a[0] in OK]
            if not acts: await page.keyboard.press('Escape'); await page.wait_for_timeout(100); continue
            if i < BROWSE: pool = [a for a in acts if a[0] not in ('go', 'quick', 'kickoff')] if random.random() < 0.8 else acts
            else: pool = [a for a in acts if a[0] in PLAYS] if random.random() < 0.7 else acts
            act, idx = random.choice(pool or acts); seen[act] = seen.get(act, 0) + 1
            try: await page.evaluate('i => document.querySelectorAll("[data-act]")[i].click()', idx)
            except Exception: pass
            await page.wait_for_timeout(250 if act in ('go', 'kickoff') else 90)
            r = await page.evaluate(PROBE); shown = max(shown, r['shown'])
            if r['bad']:
                bad.append((i, act, r['bad']))
                if len(bad) <= 5: await page.screenshot(path=str(OUT / f'bad-{len(bad)}.png'))
            if i in (BROWSE // 2, BROWSE + PLAY // 2): await page.screenshot(path=str(OUT / f'step-{i}.png'))
        date = await page.evaluate("() => JSON.parse(LZString.decompressFromBase64(localStorage.getItem('touchline.j1.save').slice(3))).date")
        await b.close()
    print(f"仕込んだ文字列 {made['n']}・{made['date']} → {date}（{BROWSE}+{PLAY}回押した、{time.time() - t0:.0f}秒）")
    print('押したもの:', json.dumps(dict(sorted(seen.items(), key=lambda x: -x[1])), ensure_ascii=False))
    print('ほかのエラー:', len(errs), '\n'.join(list(dict.fromkeys(errs))[:6]))
    checks = [
        (imported, '引き継ぎコードで復元できた'),
        (not fired, f'仕込みが動いた回数 {len(fired)}'),
        (not bad, f'タグになった場所 {bad[:5]}'),
        (shown > 0, f'仕込みの文字が画面に文字として出ている（最大 {shown} か所）'),
        (seen.get('kickoff', 0) > 0, f"ライブの試合も見た（キックオフ {seen.get('kickoff', 0)} 回）"),
    ]
    fails = 0
    for ok, msg in checks:
        print(('ok   ' if ok else 'FAIL ') + msg); fails += not ok
    print('ALL OK' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
asyncio.run(main())
