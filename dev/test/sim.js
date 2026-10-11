// Headless season simulation to calibrate the engine
const E = require('../src/engine.js');
const DATA = require('../data.json');
const seasons = Number(process.argv[2] || 2);
const club = process.argv[3] || 'mito';
const S = E.newGame(DATA, club, 'テスト', '2026-10-10');
console.log('start', S.date, 'fixtures', S.fixtures.length, 'FA', Object.values(S.players).filter(p => p.club === 'FA').length);
// fixture sanity
const homeCount = {};
for (const f of S.fixtures) homeCount[f.h] = (homeCount[f.h] || 0) + 1;
console.log('home games per club', [...new Set(Object.values(homeCount))]);
console.log('dates', S.fixtures.filter(f => f.r === 1).map(f => f.date + ' ' + f.h + '-' + f.a).slice(0, 3), 'r20', S.fixtures.find(f => f.r === 20).date, 'r21', S.fixtures.find(f => f.r === 21).date, 'r38', S.fixtures.find(f => f.r === 38).date);
let goals = 0, games = 0, hw = 0, dr = 0, aw = 0, stops = {};
const fund0 = Object.fromEntries(S.order.map(c => [c, S.clubs[c].funds]));
for (let s = 0; s < seasons; s++) {
  let guard = 0;
  while (guard++ < 2000) {
    const st = E.advance(S);
    stops[st.stop] = (stops[st.stop] || 0) + 1;
    if (st.stop === 'match') {
      const fx = S.fixtures.find(f => f.id === st.fid);
      const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
    } else if (st.stop === 'inbox') {
      for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; E.rejectOffer(S, it.id); }
    } else if (st.stop === 'seasonEnd') {
      for (const f of S.fixtures) { games++; goals += f.hg + f.ag; if (f.hg > f.ag) hw++; else if (f.hg < f.ag) aw++; else dr++; }
      const t = E.table(S);
      console.log('\n== season', S.seasonEnd.label, 'champ', S.clubs[t[0].id].short, t[0].pts, 'pts | last', S.clubs[t[19].id].short, t[19].pts, '| my pos', S.seasonEnd.myPos, S.seasonEnd.verdict, 'board', S.board);
      console.log(t.map(r => S.clubs[r.id].short + ':' + r.pts).join(' '));
      console.log('top scorers', S.seasonEnd.scorers.map(x => x.name + ' ' + x.g).join(', '));
      console.log('funds Δ', S.order.map(c => S.clubs[c].short + ':' + E.money(S.clubs[c].funds - (fund0[c] || 0))).join(' '));
      const my = S.clubs[S.my]; console.log('my fin', JSON.stringify(my.fin));
      E.rollover(S);
      if (S.fired) { console.log('FIRED', S.fired.reason, 'offers', S.fired.offers); E.takeJob(S, S.fired.offers[0]); }
      break;
    } else if (st.stop === 'fired') { console.log('FIRED midseason', S.fired.reason, S.date); E.takeJob(S, S.fired.offers[0]); }
  }
}
console.log('\ngoals/game', (goals / games).toFixed(2), 'H/D/A %', (hw / games * 100).toFixed(0), (dr / games * 100).toFixed(0), (aw / games * 100).toFixed(0));
console.log('stops', stops, 'date', S.date, 'players', Object.keys(S.players).length, 'save KB', (JSON.stringify(S).length / 1024).toFixed(0));
const sq = E.squad(S, S.my); console.log('my squad size', sq.length, 'avg ovr', (sq.reduce((a, p) => a + p.ovr, 0) / sq.length).toFixed(1));
// growth check on youngsters
const kids = Object.values(S.players).filter(p => !p.gen && E.age(p, S.date) <= 21).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
console.log('top youngsters', kids.map(p => p.name + ' ' + p.ovr.toFixed(1) + '/' + p.pot).join(', '));
