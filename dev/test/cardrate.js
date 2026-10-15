// 警告・退場の頻度（2026-10-15）: 1シーズン（全クラブ自動）回して、リーグ戦1試合あたりの警告・退場（両チーム合計）と、
// 自クラブの1シーズンの数を出す。退場は試合の記録（fx.sc の 'r'）、警告は選手のリーグ成績（p.st.yc＝1試合1枚まで数える）。
// 2026-10-15 の確認（横浜FM）: リーグ戦 警告 3.3・退場 0.47〜0.51 枚／試合、自クラブの退場 7〜12回／季。
// 実際の J1 の値と比べてから調整する（出場停止・先発の手直しの回数に直結する）。
// usage: node dev/test/cardrate.js [club] [seasons]   （1シーズン約5秒）
const E = require('../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 1);
const S = E.newGame(DATA, club, 't', '2026-10-15'); S.settings.boardLv = 'easy';
let s = 0, g = 0; const acc = { lg: 0, cup: 0, rLg: 0, rCup: 0, yLg: 0, myR: 0, myY: 0 };
const reds = f => (f.sc || []).filter(x => x[2] === 'r');
while (g++ < 300000 && s < N) {
  const st = E.advance(S);
  if (st.stop === 'match') { E.autoLineup(S, S.my); const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M); }
  else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
  else if (st.stop === 'fired') { E.takeJob(S, S.fired.offers[0]); }
  else if (st.stop === 'seasonEnd') {
    const lg = S.fixtures.filter(f => f.played && !f.cup), cup = S.fixtures.filter(f => f.played && f.cup);
    acc.lg += lg.length; acc.cup += cup.length;
    acc.rLg += lg.reduce((a, f) => a + reds(f).length, 0); acc.rCup += cup.reduce((a, f) => a + reds(f).length, 0);
    acc.yLg += Object.values(S.players).reduce((a, p) => a + (p.st.yc || 0), 0);
    acc.myR += lg.filter(f => f.h === S.my || f.a === S.my).reduce((a, f) => a + reds(f).filter(x => (x[1] === 'h') === (f.h === S.my)).length, 0);
    acc.myY += E.squad(S, S.my).reduce((a, p) => a + (p.st.yc || 0), 0);
    s++; E.rollover(S); if (S.fired) E.takeJob(S, S.fired.offers[0]);
  }
}
console.log(`リーグ戦 ${acc.lg}試合: 警告 ${(acc.yLg / acc.lg).toFixed(2)}・退場 ${(acc.rLg / acc.lg).toFixed(3)} 枚／試合（両チーム）| カップ戦 ${acc.cup}試合: 退場 ${(acc.rCup / Math.max(1, acc.cup)).toFixed(3)}`);
console.log(`自クラブ（リーグ戦、1シーズンあたり）: 警告 ${(acc.myY / N).toFixed(1)}・退場 ${(acc.myR / N).toFixed(1)}`);
