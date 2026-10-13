// League size and fixtures over many seasons: J1 always has 20 clubs (relegated clubs can come back up), nobody is
// ever drawn against himself, and old saves lose any club-vs-itself fixture.
// usage: node test/selfmatch.js [seasons] [runs]   (ENG=path to test another engine)
const E = require(process.env.ENG || '../src/engine.js'); const DATA = require('../data.json');
const N = +(process.argv[2] || 14), runs = +(process.argv[3] || 1);
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('NG', m); } };
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12'); S.settings.boardLv = 'easy';
  let s = 0, g = 0; const sizes = [], origLeft = []; const orig = new Set(S.order);
  const check = tag => {
    const lg = S.fixtures.filter(f => !f.cup);
    const self = S.fixtures.filter(f => f.h === f.a);
    ok(!self.length, `${tag}: club vs itself ${self.map(f => f.h + ' r' + (f.cr != null ? f.cup + f.cr : f.r)).join(', ')}`);
    ok(new Set(S.order).size === S.order.length, `${tag}: duplicate club in the league`);
    // a double round robin: every club meets every other club once at home and once away, one match a round
    const n = S.order.length;
    for (const c of S.order) {
      const mine = lg.filter(f => f.h === c || f.a === c);
      ok(mine.length === 2 * (n - 1), `${tag}: ${c} plays ${mine.length} league matches (want ${2 * (n - 1)})`);
      const rounds = new Set(mine.map(f => f.r)); ok(rounds.size === mine.length, `${tag}: ${c} twice in one round`);
    }
    ok(lg.every(f => S.order.includes(f.h) && S.order.includes(f.a)), `${tag}: league match with a club outside J1`);
  };
  check('season 1'); sizes.push(S.order.length);
  while (g++ < 300000 && s < N) {
    const st = E.advance(S);
    if (st.stop === 'match') {
      const fx = S.fixtures.find(f => f.id === st.fid); E.autoLineup(S, S.my, { rotate: true });
      const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 40);
    } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'seasonEnd') {
      const se = S.seasonEnd;  // keep the manager in a job: if my club goes down, the next club up goes instead
      if (se.rel.includes(S.my)) { const t = E.table(S).map(x => x.id).filter(c => !se.rel.includes(c)); se.rel = se.rel.map(c => c === S.my ? t[t.length - 1] : c); }
      S.board = Math.max(S.board, 60); E.rollover(S); s++;
      if (S.fired) { console.log('fired', S.fired.reason); break; }
      sizes.push(S.order.length); origLeft.push(S.order.filter(c => orig.has(c)).length); check(`season ${s + 1}`);
      ok(S.order.length === 20, `season ${s + 1}: J1 has ${S.order.length} clubs`);
    }
  }
  console.log(`run ${r + 1}: J1 size by season ${sizes.join(' ')} | original J1 clubs left ${origLeft.join(' ')}`);
}
// an old save that already had 19 clubs and a club-vs-itself fixture: migrate drops that fixture (played or not)
{
  const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12');
  const drop = S.order.find(c => c !== S.my); S.order = S.order.filter(c => c !== drop);
  S.fixtures = S.fixtures.filter(f => f.cup || (f.h !== drop && f.a !== drop));
  S.fixtures.push({ id: 9001, r: 5, date: S.fixtures[4].date, h: S.my, a: S.my, hg: 2, ag: 1, played: true });
  S.fixtures.push({ id: 9002, r: 30, date: S.fixtures[200].date, h: S.my, a: S.my, hg: null, ag: null, played: false });
  const before = E.table(S).find(x => x.id === S.my).p;
  E.migrate(S, DATA);
  ok(!S.fixtures.some(f => f.h === f.a), 'migrate leaves a club-vs-itself fixture');
  ok(E.table(S).find(x => x.id === S.my).p === before - 2, 'the played self match still counts in the table');
}
console.log(bad ? `PROBLEMS: ${bad}` : 'ALL OK');
