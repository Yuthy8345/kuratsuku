// 先発の手直し（2026-10-15）: 自クラブの先発を「試合に進めない（lineupIssues が block）ときだけ」ベストメンバーに直して
// 回し、何試合で手直しが要ったかと理由（先発／ベンチ × 負傷 inj・出場停止 sus・代表 nt）を数える。
// 2026-10-15 の確認: 横浜FM 132試合中57回（43%、1季19回）・鹿島 130試合中54回（42%）。先発の理由は出場停止が8割。
// usage: node dev/test/blocks.js [club] [seasons] [runs]   （1シーズン約5秒）
const E = require('../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 1), runs = +(process.argv[4] || 3);
const tot = { games: 0, blocked: 0, xi: { inj: 0, sus: 0, nt: 0 }, bench: { inj: 0, sus: 0, nt: 0 }, benchOnly: 0 };
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, club, 't', '2026-10-15'); S.settings.boardLv = 'easy'; E.autoLineup(S, S.my);
  let s = 0, g = 0;
  while (g++ < 200000 && s < N) {
    const st = E.advance(S);
    if (st.stop === 'match') {
      tot.games++;
      const iss = E.lineupIssues(S, S.my);
      if (iss.block) {
        tot.blocked++;
        for (const x of iss.xi) if (tot.xi[x.why] != null) tot.xi[x.why]++;
        for (const x of iss.bench) if (tot.bench[x.why] != null) tot.bench[x.why]++;
        if (!iss.xi.length) tot.benchOnly++;
        E.autoLineup(S, S.my);
      }
      const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
    } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'fired') { E.takeJob(S, S.fired.offers[0]); }
    else if (st.stop === 'seasonEnd') { s++; E.rollover(S); if (S.fired) E.takeJob(S, S.fired.offers[0]); }
  }
}
console.log(club, JSON.stringify(tot));
console.log(`手直しが要った試合 ${tot.blocked}/${tot.games}（${(tot.blocked / tot.games * 100).toFixed(0)}%）・1シーズン ${(tot.blocked / runs / N).toFixed(1)}回`);
