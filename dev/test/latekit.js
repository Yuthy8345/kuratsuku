// 終盤の采配を比べるための道具。開幕時点の全カードを回し、74分の終わりに自クラブ扱いの側が lead 点リードしている
// 試合だけ、その場面を写して75分から先を何通りかのやり方で reps 回ずつやり直す（同じ場面どうしで比べるので、試合数の割に差がはっきり出る）。
// finishMatch はしないので状態は変わらない。燃えている選手（p.hot）は試合ごとに付け直す。
const E = require('../src/engine.js');
const DATA = require('../data.json');
function setup(club = 'yokohamafm') {
  const S = E.newGame(DATA, club, 'テスト', '2026-10-10');
  S.settings.autoSubs = true; S.settings.subRate = 'mid';
  return S;
}
// ways: { name: { closeOut: bool, hook(S, M, k) called before every minute from 75 } }
function compare(S, ways, { N = 6000, reps = 4, lead = 1, from = 75 } = {}) {
  const league = S.fixtures.filter(f => !f.cup);
  const res = Object.fromEntries(Object.keys(ways).map(w => [w, { n: 0, w: 0, d: 0, l: 0, extra: 0 }]));
  for (let i = 0; i < N; i++) {
    for (const p of Object.values(S.players)) if (p.hot) delete p.hot;
    const M0 = E.createMatch(S, league[i % league.length]);
    const k = i % 2 ? 'a' : 'h'; M0.userSide = k;
    const save = S.settings.closeOut; S.settings.closeOut = false;
    while (!M0.done && M0.min < from - 1) E.stepMatch(S, M0);
    S.settings.closeOut = save;
    if ((k === 'h' ? M0.hg - M0.ag : M0.ag - M0.hg) !== lead) continue;
    for (const [name, way] of Object.entries(ways)) {
      const r = res[name];
      for (let j = 0; j < reps; j++) {
        const M = structuredClone(M0);
        S.settings.closeOut = !!way.closeOut;
        while (!M.done) { if (way.hook) way.hook(S, M, k, r); E.stepMatch(S, M); }
        const fl = k === 'h' ? M.hg - M.ag : M.ag - M.hg;
        r.n++; if (fl > 0) r.w++; else if (fl === 0) r.d++; else r.l++;
      }
    }
    S.settings.closeOut = save;
  }
  return res;
}
const line = (name, r) => `${name}  (${r.n}) 勝 ${(r.w / r.n * 100).toFixed(1)}% 分 ${(r.d / r.n * 100).toFixed(1)}% 負 ${(r.l / r.n * 100).toFixed(1)}%  勝点 ${((3 * r.w + r.d) / r.n).toFixed(3)}`;
module.exports = { E, DATA, setup, compare, line };
