# 連携の線を WebKit（iPhone の Safari と同じエンジンの Linux 版 WebKitGTK）で描いて、どの線も本当に画面に出ているか（2026-10-17）。
# iPhone では 4-1-4-1 の右SH–右SBの線が消えていた（選手を入れ替えても、実線でも点線でも）。Chromium の画面のテストは
# DOM に線があるかしか見ていなかったので気づけなかった。WebKit がチョークのフィルターの絵を線の端点の範囲で切っていて、
# いちばん右の縦線がその外に落ちていた（app.js の LK_BOX）。
# 12のフォーメーションで、横浜FM・隣どうし全部の連携 55（実線）と 25（点線）のセーブを作り、戦術画面を開き、各線の
# 25〜75% を1pxごとに見て（選手の札とピッチの白線は隠す）、線の色（明るい）が出ていない線を数える
# （実線は7割、点線は1割2分より少なければ出ていない）。
# 必要: apt-get install gir1.2-webkit2-4.1 python3-gi python3-gi-cairo xvfb  （Ubuntu 24.04 で WebKitGTK 2.52）
# usage: xvfb-run -a /usr/bin/python3.12 dev/test/webkit.py   （KTK_PAGE=<touchline.html> で別のビルド。スクショ dev/test/shots/wk-*.png）
import sys, os, json, subprocess, pathlib, gi
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib
import cairo
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT/'test'/'shots'; OUT.mkdir(exist_ok=True)
PAGE = pathlib.Path(os.environ.get('KTK_PAGE', str(ROOT/'dist/touchline.html'))).read_text()
MAKE = r"""
const E = require(process.argv[1] + '/src/engine.js'), D = require(process.argv[1] + '/data.json');
const S = E.newGame(D, 'yokohamafm', 'x', '2026-10-15'); E.sponPick(S, E.sponRec(S)); E.secSeen(S); S.sec.notes = [];
const out = [];
for (const f of Object.keys(E.FORMATIONS)) for (const v of [55, 25]) {
  const c = S.clubs[S.my]; c.tac.form = f; E.autoLineup(S, S.my);
  for (const id of c.tac.xi) { const p = S.players[id]; p.inj = 0; delete p.bans; delete p.away; p.cond = 100; }
  c.lk = {}; E.linkAdj(f).forEach(([i, j]) => { c.lk[[c.tac.xi[i], c.tac.xi[j]].sort((a, b) => a - b).join('-')] = [v, 900]; });
  out.push({ f, v, n: E.linkAdj(f).length, save: JSON.stringify(S) });
}
console.log(JSON.stringify(out));
"""
CASES = json.loads(subprocess.run(['node', '-e', MAKE, str(ROOT)], capture_output=True, text=True, check=True).stdout)
TMP = ROOT/'test'/'page_webkit.html'
OPEN = "(async()=>{const w=t=>new Promise(r=>setTimeout(r,t));await w(700);document.querySelector('[data-act=continue]')?.click();await w(500);document.querySelector('[data-act=tab][data-tab=tactics]')?.click();await w(500);const p=document.querySelector('#view .pitch');window.scrollTo(0,p.getBoundingClientRect().top+scrollY-70);document.head.insertAdjacentHTML('beforeend','<style>#view .pitch .tok,#view .pitch svg.lines{visibility:hidden}</style>');})();1"
LINES = """JSON.stringify([...document.querySelectorAll('#view .pitch svg.lk-lines line:not(.glow)')].map(l => { const m = l.ownerSVGElement.getScreenCTM(), P = (x, y) => { const q = l.ownerSVGElement.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(m); return [r.x, r.y]; };
  return [P(+l.getAttribute('x1'), +l.getAttribute('y1')), P(+l.getAttribute('x2'), +l.getAttribute('y2')), l.getAttribute('class')]; }))"""
W, H = 393, 852
win = Gtk.OffscreenWindow(); win.set_default_size(W, H)
wv = WebKit2.WebView(); st = wv.get_settings()
st.set_property('allow-file-access-from-file-urls', True); st.set_property('allow-universal-access-from-file-urls', True)
win.add(wv); win.show_all()
results, k = [], [0]
def run_case():
    if k[0] >= len(CASES): Gtk.main_quit(); return False
    c = CASES[k[0]]
    pre = '<script>try{localStorage.setItem("touchline.j1.save",' + json.dumps(c['save']) + ')}catch(e){}</script>'
    TMP.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + pre + PAGE + '</body></html>')
    wv.load_uri('file://' + str(TMP)); return False
def loaded(v, ev):
    if ev != WebKit2.LoadEvent.FINISHED: return
    wv.evaluate_javascript(OPEN, -1, None, None, None, lambda v, r: GLib.timeout_add(2200, measure))
def measure():
    def got(v, r):
        lines = json.loads(v.evaluate_javascript_finish(r).to_string())
        def shot(v, r):
            surf = v.get_snapshot_finish(r); c = CASES[k[0]]
            png = OUT/f"wk-{c['f']}-{c['v']}.png"; surf.write_to_png(str(png))
            img = cairo.ImageSurface.create_from_png(str(png)); data, stride, w, h = img.get_data(), img.get_stride(), img.get_width(), img.get_height()
            def lum(x, y):   # brightest pixel in a 3×3 box (BGRA)
                best = 0
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        X, Y = int(round(x)) + dx, int(round(y)) + dy
                        if 0 <= X < w and 0 <= Y < h: o = Y * stride + X * 4; best = max(best, data[o] + data[o + 1] + data[o + 2])
                return best
            miss = []
            for (a, b, cls) in lines:
                n = max(10, int(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 * 0.5))
                pts = [(a[0] + (b[0] - a[0]) * (0.25 + 0.5 * t / n), a[1] + (b[1] - a[1]) * (0.25 + 0.5 * t / n)) for t in range(n + 1)]
                lit = sum(1 for (x, y) in pts if lum(x, y) > 330) / len(pts)
                if lit < (0.12 if 't1' in cls else 0.7): miss.append(f"({a[0]:.0f},{a[1]:.0f})-({b[0]:.0f},{b[1]:.0f}) {cls} {lit:.0%}")
            results.append((c, len(lines), miss)); k[0] += 1; GLib.idle_add(run_case)
        wv.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, shot)
    wv.evaluate_javascript(LINES, -1, None, None, None, got); return False
wv.connect('load-changed', loaded)
GLib.timeout_add(600000, lambda: (print('timeout'), Gtk.main_quit()))
GLib.idle_add(run_case); Gtk.main()
TMP.unlink(missing_ok=True)
fails = 0
for c, n, miss in results:
    ok = n == c['n'] and not miss
    fails += 0 if ok else 1
    print(('ok   ' if ok else 'FAIL ') + f"{c['f']} 連携{c['v']}: {n}/{c['n']} lines in the page, " + (f"{len(miss)} not on the screen: " + ' | '.join(miss) if miss else 'all on the screen'))
print('cases', len(results), 'of', len(CASES)); print('FAILS', fails + (len(CASES) - len(results))); sys.exit(1 if fails or len(results) < len(CASES) else 0)
