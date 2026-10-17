# フロントの規則（期待勝点・目標の決め方・やさしい／ふつう／きびしいの数字）を、tenure_rec.js の記録に当てはめて比べる（2026-10-16）。
# 解任・降格の割合と平均の在任。w＝目標で前の季の順位を見る重み（エンジンの EXPECT.last）。
# usage: python3 dev/test/board_replay.py rec1.jsonl [rec2.jsonl …]
import sys, json, itertools
def load(fs): return [json.loads(l) for f in fs for l in open(f) if l.strip()]
def tpos(r): return 3 if r <= 3 else 7 if r <= 7 else 13 if r <= 13 else 17
def exp_new(d, h): return min(2.4, max(0.4, 1.37 + 0.12 * d + 0.13 * h))
def exp_old(d, h): return min(2.4, max(0.4, 1.35 + (d + h) * 0.18))
def target(rec, i, w):
    s = rec['seasons'][i]; rk = s['t']['rk']
    if i == 0 or w == 0: return tpos(rk)
    return tpos(round((1 - w) * rk + w * rec['seasons'][i - 1]['pos']))
def run(rec, P, expf, w, old=False):
    b = P['start']
    for i, s in enumerate(rec['seasons']):
        for pts, d, h, cup, lg, rk in s['m']:
            b = max(0, min(100, round(b + (pts - expf(d, h)) * P['match'] * (0.5 if cup else 1))))
            if not cup and b <= P['fireMid'] and lg >= P['fireAfter'] and rk > 20 - P['zone']: return i + 0.5, 'mid'
        if s['rel']: return i + 1, 'rel'
        t = s['t']['old'] if old else target(rec, i, w); pos = s['pos']
        b += 12 * s.get('cups', 0)
        if pos <= t: b += P['met']
        elif pos <= t + P['nearBand']: b += P['near']
        else: b -= min(P['missMax'], P['perPos'] * (pos - t))
        b = max(0, min(100, b))
        if b < P['fireEnd'] and i + 1 > P['grace']: return i + 1, 'end'
        b = round(55 + (b - 55) * P['keep'])
    return len(rec['seasons']), None
def summ(recs, P, expf, w, old=False):
    out = [run(r, P, expf, w, old) for r in recs]; n = len(out)
    by = {k: sum(1 for o in out if o[1] == k) for k in ('rel', 'end', 'mid')}
    f = sum(by.values())
    return f / n, (by['end'] + by['mid']) / n, sum(o[0] for o in out) / n, by
# 2026-10-18: やさしい は降格だけ（fireEnd 0・fireMid −1）、ふつう は途中解任なし（fireMid −1）。OLD_* は 2026-10-16〜17 の数字
OLD_MID = dict(match=1.6, met=20, near=0, nearBand=3, perPos=4, missMax=16, keep=0.6, fireEnd=10, grace=1, fireMid=8, fireAfter=15, zone=4, start=60)
OLD_EASY = dict(OLD_MID, match=1.4, perPos=3, missMax=12, keep=0.5, fireEnd=5, fireMid=5, fireAfter=19, zone=3)
MID = dict(OLD_MID, fireMid=-1)
EASY = dict(OLD_EASY, fireEnd=0, fireMid=-1)
HARD = dict(OLD_MID, match=3.2, near=-5, perPos=0, missMax=25, keep=1, fireEnd=15, grace=0, fireMid=8, fireAfter=10, zone=99)
if __name__ == '__main__':
    groups = {f.split('/')[-1]: load([f]) for f in sys.argv[1:]}
    for name, recs in groups.items():
        print(f'== {name}: {len(recs)} runs, relegated within 4 seasons (no firing) {sum(1 for r in recs if any(s["rel"] for s in r["seasons"]))}')
        r = summ(recs, OLD_MID, exp_old, 0, True); print(f'  以前（期待 以前・目標 以前・ふつう）  fired {r[0]:.0%} (降格以外 {r[1]:.0%}) avg {r[2]:.2f} {r[3]}')
        for lvn, LV in (('やさしい', EASY), ('ふつう', MID), ('きびしい', HARD), ('旧やさしい', OLD_EASY), ('旧ふつう', OLD_MID)):
            for w in (0, 0.5):
                r = summ(recs, LV, exp_new, w); print(f'  期待 新・目標 w{w} {lvn:4s}      fired {r[0]:.0%} (降格以外 {r[1]:.0%}) avg {r[2]:.2f} {r[3]}')
        for match, perPos, missMax, keep in itertools.product([1.2, 1.6], [3, 4], [12, 16], [0.5, 0.6]):
            P = dict(MID, match=match, perPos=perPos, missMax=missMax, keep=keep)
            r = summ(recs, P, exp_new, 0.5); print(f'  w0.5 match {match} perPos {perPos} missMax {missMax} keep {keep}: fired {r[0]:.0%} (降格以外 {r[1]:.0%}) avg {r[2]:.2f}')
