// 終盤の失点（リードを守れるか）の計測。シーズンを進めずに、開幕時点の全カードを何度も回す（finishMatch しないので状態は変わらない）。
// node dev/test/late.js [試合数] [club]
// 出力: 時間帯ごとの得点の割合、75分・80分・85分に1点リードしていたチームの最終結果、自クラブとして戦ったとき（交代の頻度ごと）とAIとして戦ったときの比較
const E = require('../src/engine.js');
const DATA = require('../data.json');
const N = Number(process.argv[2] || 4000);
const club = process.argv[3] || 'yokohamafm';
const S = E.newGame(DATA, club, 'テスト', '2026-10-10');
const league = S.fixtures.filter(f => !f.cup);

const bins = [15, 30, 45, 60, 75, 999], binLab = ['1-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'];
function run(opts) {
  const goalBins = new Array(6).fill(0); let goals = 0, games = 0;
  const lead = { 60: [0, 0, 0], 75: [0, 0, 0], 80: [0, 0, 0], 85: [0, 0, 0] };  // [勝, 分, 負] of the side leading by exactly one
  const leadMy = { 75: [0, 0, 0] };
  const after = { lateG: 0, lateLeaderG: 0, lateChaserG: 0 };
  for (let i = 0; i < N; i++) {
    const fx = league[i % league.length];
    for (const p of Object.values(S.players)) if (p.hot) delete p.hot;  // finishMatch is never called, so clear who was on fire
    const M = E.createMatch(S, fx);
    // who is "me" in this match: opts.user = 'h' | 'a' | 'both' | null
    M.userSide = opts.user === 'h' ? 'h' : opts.user === 'a' ? 'a' : null;
    const snap = {};
    let last = 0;
    while (!M.done) {
      const evs = E.stepMatch(S, M);
      for (const e of evs) if (e.t === 'goal') {
        goals++; const m = e.m; goalBins[bins.findIndex(b => m <= b)]++;
        if (m > 75) {
          after.lateG++;
          // was the scoring side behind/level or ahead before this goal?
          const hg = M.hg - (e.side === 'h' ? 1 : 0), ag = M.ag - (e.side === 'a' ? 1 : 0);
          const own = e.side === 'h' ? hg : ag, oth = e.side === 'h' ? ag : hg;
          if (own > oth) after.lateLeaderG++; else if (own < oth) after.lateChaserG++;
        }
      }
      if (M.min in lead && !(M.min in snap)) snap[M.min] = [M.hg, M.ag];
    }
    games++;
    for (const m of Object.keys(lead)) {
      const [h, a] = snap[m]; if (Math.abs(h - a) !== 1) continue;
      const ld = h > a ? 'h' : 'a';
      const fl = ld === 'h' ? M.hg - M.ag : M.ag - M.hg;
      lead[m][fl > 0 ? 0 : fl === 0 ? 1 : 2]++;
      if (m === '75' && opts.user && ld === opts.user) leadMy[75][fl > 0 ? 0 : fl === 0 ? 1 : 2]++;
    }
  }
  return { goalBins, goals, games, lead, leadMy, after };
}
const pct = (a, b) => (a / b * 100).toFixed(1);
function show(name, r) {
  console.log(`\n== ${name}  ${r.games}試合  1試合 ${(r.goals / r.games).toFixed(2)}点`);
  console.log('時間帯の得点割合 ' + r.goalBins.map((g, i) => `${binLab[i]} ${pct(g, r.goals)}%`).join(' / '));
  console.log(`76分以降の得点: リードしている側 ${pct(r.after.lateLeaderG, r.after.lateG)}% / 同点 ${pct(r.after.lateG - r.after.lateLeaderG - r.after.lateChaserG, r.after.lateG)}% / 負けている側 ${pct(r.after.lateChaserG, r.after.lateG)}%`);
  for (const m of Object.keys(r.lead)) { const [w, d, l] = r.lead[m], n = w + d + l; console.log(`${m}分に1点リード (${n}) → 勝 ${pct(w, n)}% 分 ${pct(d, n)}% 負 ${pct(l, n)}%`); }
  if (r.leadMy[75].some(x => x)) { const [w, d, l] = r.leadMy[75], n = w + d + l; console.log(`  うち自クラブ側が75分に1点リード (${n}) → 勝 ${pct(w, n)}% 分 ${pct(d, n)}% 負 ${pct(l, n)}%`); }
}
const mode = process.argv[4] || 'all';
if (mode === 'all' || mode === 'ai') show('全員AI（交代はAIのやり方）', run({ user: null }));
if (mode === 'all' || mode === 'user') {
  for (const rate of ['low', 'mid', 'high']) {
    S.settings.autoSubs = true; S.settings.subRate = rate;
    show(`ホーム側を自クラブ扱い・交代おまかせ ${E.SUB_RATE[rate].jp}`, run({ user: 'h' }));
  }
  S.settings.autoSubs = false;
  show('ホーム側を自クラブ扱い・交代しない（おまかせオフで手動交代なし）', run({ user: 'h' }));
}
module.exports = { run };
