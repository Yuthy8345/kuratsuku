// 警告・退場の頻度（2026-10-15）: 全クラブ自動でシーズンを回して、リーグ戦1試合あたりの警告・退場（両チーム合計）と、
// 自クラブの1シーズンの数を出す。数え方は Jリーグの反則ポイントの表と同じ: 警告は出た枚数（警告2枚の退場は「警告」2枚＋
// 「警告2回による退場」1回）、退場は 警告2枚＋一発。警告は選手のリーグ成績（p.st.yc＝警告2枚の退場を除いた枚数）、退場は
// p.st.rc、一発退場はそのシーズンの理由の記録（p.rch.lg）。
// 実際の J1（データサイトの反則ポイント、2024・2025 の 760試合）: 警告 2.56・退場 0.103（警告2枚 0.034・一発 0.068）。
// 1クラブ1シーズン（38試合）: 警告 48.6・退場 1.95。
// 2026-10-15 の調整前（横浜FM）: 警告 4.1・退場 0.49（警告2枚 0.40・一発 0.09）、自クラブの退場 7〜12回／季。
// usage: node dev/test/cardrate.js [club] [seasons]   （1シーズン約5秒）
const E = require('../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 1);
const S = E.newGame(DATA, club, 't', '2026-10-15'); S.settings.boardLv = 'easy';
let s = 0, g = 0; const acc = { lg: 0, yc: 0, rc: 0, red: 0, myY: 0, myR: 0, myRed: 0, teams: 0 };
const sum = (ps, f) => ps.reduce((a, p) => a + f(p), 0);
const straight = p => (p.rch && p.rch.lg ? p.rch.lg.length : 0);
while (g++ < 300000 && s < N) {
  const st = E.advance(S);
  if (st.stop === 'match') { E.autoLineup(S, S.my); const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M); }
  else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
  else if (st.stop === 'fired') { E.takeJob(S, S.fired.offers[0]); }
  else if (st.stop === 'seasonEnd') {
    const ps = Object.values(S.players), mine = E.squad(S, S.my);
    acc.lg += S.fixtures.filter(f => f.played && !f.cup).length; acc.teams += S.order.length;
    acc.yc += sum(ps, p => p.st.yc || 0); acc.rc += sum(ps, p => p.st.rc || 0); acc.red += sum(ps, straight);
    acc.myY += sum(mine, p => p.st.yc || 0); acc.myR += sum(mine, p => p.st.rc || 0); acc.myRed += sum(mine, straight);
    s++; E.rollover(S); if (S.fired) E.takeJob(S, S.fired.offers[0]);
  }
}
const yy = acc.rc - acc.red, myYY = acc.myR - acc.myRed;
const per = x => (x / acc.lg).toFixed(3);
console.log(`リーグ戦 ${acc.lg}試合（1試合・両チーム）: 警告 ${per(acc.yc + 2 * yy)}・退場 ${per(acc.rc)}（警告2枚 ${per(yy)}・一発 ${per(acc.red)}）| 実際 2.56・0.103（0.034・0.068）`);
console.log(`1クラブ1シーズン（全クラブ平均）: 警告 ${((acc.yc + 2 * yy) / acc.teams).toFixed(1)}・退場 ${(acc.rc / acc.teams).toFixed(2)} | 実際 48.6・1.95`);
console.log(`自クラブ（リーグ戦、1シーズンあたり）: 警告 ${((acc.myY + 2 * myYY) / N).toFixed(1)}・退場 ${(acc.myR / N).toFixed(1)}（警告2枚 ${(myYY / N).toFixed(1)}・一発 ${(acc.myRed / N).toFixed(1)}）`);
