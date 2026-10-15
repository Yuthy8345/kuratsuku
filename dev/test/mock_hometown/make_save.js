// 作業4（2026-10-15）の画面イメージ 案A〜C の作り方: cd dev/test/mock_hometown && node make_save.js > save.json && node gen.js
//   && KTK_FONTS=<@fontsource のフォルダ> python3 shoot.py all chalk（white、幅 高さ も渡せる）→ out/*.png。dev/dist/touchline.html を先にビルドしておく
// a mid-season save for the hometown mocks: 柏 (a full house), a few buildings, a stand being built
const E = require('../../src/engine.js'); const D = require('../../data.json');
const club = process.argv[2] || 'kashiwa';
const S = E.newGame(D, club, 'ソーイ', '2026-10-15');
const clone = o => { const c = JSON.parse(JSON.stringify(o)); c.cele = []; return c; };
const play = until => { for (let g = 0; g < 9000 && S.date < until; g++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') break;
} };
const c = S.clubs[S.my];
c.funds += 400000;
E.sponAuto && E.sponPending(S) && E.sponAuto(S);
play('2026-09-01');
for (const k of ['shop', 'food']) { E.townBuild(S, k); c.town.job.to = S.date; E.townDay(S); }
play('2026-11-20');
E.townBuild(S, 'exp');
play('2027-02-12');
c.fans = Math.max(c.fans, 21400);
E.secSeen(S); S.sec.notes = S.sec.notes.filter(n => n.k === 'month');
for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(S, S.my); S.sec.back = [];
const info = E.townInfo(S);
console.log(JSON.stringify({ save: clone(S), info }));
