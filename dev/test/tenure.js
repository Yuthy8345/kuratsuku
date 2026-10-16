// How long does a manager last? An auto-picked lineup plays every match; counts firings by cause.
// usage: node test/tenure.js <club> <runs> <seasons> <easy|mid|hard>   (V=1 prints every run). Slow: ~5 s a season.
// MGR=best (2026-10-16): the best XI every match and the AI's game plan (a fair manager; the default rotates the XI every
// match and keeps the default plan, which loses more than its squad suggests)
const E = require(process.env.ENG || '../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', runs = +(process.argv[3] || 10), maxS = +(process.argv[4] || 3), pat = process.argv[5] || 'mid';

const MGR = process.env.MGR || 'rotate';
const out = []; let tot = { s: 0, fired: 0, rel: 0, mid: 0, end: 0 };
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, club, 't', '2026-10-12'); S.settings.boardLv = pat;
  const c = S.clubs[club];
  const pw = S.order.map(id => [id, E.power(S, id), E.strength(S, id)]).sort((a, b) => b[1] - a[1]);
  if (r === 0) console.log(`${c.short}: target ${c.target.jp}, pred ${c.pred}, power rank ${pw.findIndex(x => x[0] === club) + 1}, strength ${E.strength(S, club).toFixed(1)} pres ${c.pres}`);
  let g = 0, seasons = 0; const log = []; let minB = 100, boardAtHalf = null, games = 0;
  while (g++ < 30000) {
    const st = E.advance(S);
    if (st.stop === 'match') { const fx = S.fixtures.find(f => f.id === st.fid);
      if (MGR === 'best') { E.autoLineup(S, S.my, { comp: E.compOf(fx) }); Object.assign(S.clubs[S.my].tac, E.aiPlan(S, S.my, fx.h === S.my ? fx.a : fx.h)); } else E.autoLineup(S, S.my, { rotate: true }); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M); if (!fx.cup) { games++; if (games === 19) boardAtHalf = S.board; } minB = Math.min(minB, S.board); }
    else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'fired') { log.push(`FIRED mid-season (${S.fired.reason}) after ${games} games, board ${S.board}`); tot.fired++; tot.mid++; break; }
    else if (st.stop === 'seasonEnd') {
      const se = S.seasonEnd; seasons++;
      log.push(`s${seasons}: ${se.myPos}位 (target ${se.target}) ${se.verdict} | board half ${boardAtHalf} min ${minB} end ${S.board}`);
      E.rollover(S); games = 0; minB = 100;
      if (S.fired) { log.push(`FIRED at season end: ${S.fired.reason}`); tot.fired++; if (/降格/.test(S.fired.reason)) tot.rel++; else tot.end++; break; }
      if (seasons >= maxS) break;
    }
  }
  tot.s += seasons;
  if (process.env.V) console.log(`run ${r + 1}: ` + log.join(' / '));
}
console.log(`[${club} ${pat}] avg seasons ${(tot.s / runs).toFixed(1)}, fired ${tot.fired}/${runs} (relegated ${tot.rel}, season end ${tot.end}, mid-season ${tot.mid})`);
