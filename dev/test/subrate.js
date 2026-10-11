// 交代はおまかせ: how many changes each frequency (少なめ・ふつう・多め) makes for my side, and AI clubs keep their old pattern.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const res = {};
for (const lv of ['low', 'mid', 'high']) {
  const r = res[lv] = { n: 0, own: 0, first: [], five: 0, ai: 0 };
  for (const club of ['kashima', 'okayama', 'kawasakif']) {
    const S = E.newGame(DATA, club, 't', '2026-10-10');
    S.settings.autoSubs = true; S.settings.subRate = lv;
    for (const f of S.fixtures.filter(f => !f.cup && (f.h === S.my || f.a === S.my)).slice(0, 30)) {
      const M = E.createMatch(S, f); E.simulateFull(S, M);
      const sd = M[M.userSide], ai = M[M.userSide === 'h' ? 'a' : 'h'];
      r.n++; r.own += sd.subLog.filter(([o]) => !M.pm[o].inj).length; r.five += sd.subs >= 5;
      r.ai += ai.subLog.filter(([o]) => !M.pm[o].inj).length;
      const on = sd.subLog.map(([, i]) => M.pm[i].on); if (on.length) r.first.push(Math.min(...on));
    }
  }
  r.first.sort((a, b) => a - b);
  console.log(`${E.SUB_RATE[lv].jp}: ${(r.own / r.n).toFixed(2)} changes/match, first ${r.first[r.first.length >> 1]}', all 5 used ${(r.five / r.n * 100).toFixed(0)}% | AI side ${(r.ai / r.n).toFixed(2)}`);
}
ok(res.low.own / res.low.n >= 0.8 && res.low.own / res.low.n <= 2, '少なめ: 1-2 changes');
ok(res.mid.own / res.mid.n >= 2.5 && res.mid.own / res.mid.n <= 4, 'ふつう: 3-4 changes');
ok(res.high.own / res.high.n >= 4.2, '多め: 4-5 changes');
ok(res.low.first[res.low.first.length >> 1] >= 68 && res.high.first[res.high.first.length >> 1] <= 58, '少なめ starts late, 多め early');
const ai = ['low', 'mid', 'high'].map(l => res[l].ai / res[l].n);
ok(Math.max(...ai) - Math.min(...ai) < 0.35, 'AI clubs do not follow my setting: ' + ai.map(x => x.toFixed(2)).join(' / '));
// old saves have no subRate: ふつう
const S = E.newGame(DATA, 'mito', 't', '2026-10-10'); delete S.settings.subRate;
ok(E.subRate(S) === E.SUB_RATE.mid, 'no setting -> ふつう');
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
