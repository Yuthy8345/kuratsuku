// Suspensions are served in the competition they were given in (2026-10-14): league bans only by league games, 天皇杯 bans
// only by 天皇杯 ties, Lカップ bans only by Lカップ ties. Cup yellows add up per cup (2 = one game, a single one is wiped after
// the quarter-final). At the end of the season one unserved game lapses, two or more carry over to the same competition.
// usage: node dev/test/cards.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-10');
const P = id => S.players[id];
const bans = p => [E.susIn(p, 'lg'), E.susIn(p, 'ec'), E.susIn(p, 'lc')].join('/');

// play days until my next match is today (inbox items are just marked seen)
function toMyMatch(st) {
  for (let i = 0; i < 400; i++) {
    const r = E.advance(st);
    if (r.stop === 'match') return st.fixtures.find(f => f.id === r.fid);
    if (r.stop === 'inbox') for (const it of st.inbox) it.seen = true;
    if (r.stop === 'seasonEnd' || r.stop === 'fired') return null;
  }
  return null;
}
// play my match; the test players get no cards or injuries of their own unless `edit` gives them some
function playMine(st, fx, keep, edit) {
  const M = E.createMatch(st, fx); E.simulateFull(st, M);
  for (const id of keep || []) if (M.pm[id]) { M.pm[id].yc = 0; M.pm[id].rc = 0; M.pm[id].inj = 0; }
  if (edit) edit(M);
  E.finishMatch(st, M); return M;
}
const inXI = (st, id) => st.clubs[st.my].tac.xi.includes(id);
const issueIds = (st, comp) => E.lineupIssues(st, st.my, comp).xi.filter(x => x.why === 'sus').map(x => x.pid);

// pick three starters: A (league ban), B (天皇杯 ban), C (Lカップ ban)
const xi0 = S.clubs[S.my].tac.xi.slice();
const sq = E.squad(S, S.my).filter(p => p.pos !== 'GK' && xi0.includes(p.id));
const [A, B, C] = sq.slice(0, 3).map(p => p.id);
const T = [A, B, C];
console.log('A', P(A).name, '| B', P(B).name, '| C', P(C).name);

// 1) the next match decides the competition
let fx = toMyMatch(S);
ok(fx && !fx.cup && E.nextComp(S, S.my) === 'lg', `next match is the league (${fx && E.fxLabel(fx)})`);
E.setSus(P(A), 'lg', 1); E.setSus(P(B), 'ec', 1); E.setSus(P(C), 'lc', 1);
ok(!E.available(P(A), 'lg') && E.available(P(A), 'ec') && E.available(P(A), 'lc'), 'league ban: out of the league, fine for the cups');
ok(E.available(P(B), 'lg') && !E.available(P(B), 'ec') && E.available(P(B), 'lc'), '天皇杯 ban: out of the 天皇杯 only');
let ids = issueIds(S);
ok(ids.length === 1 && ids[0] === A, `before a league game only A blocks (${ids.map(id => P(id).short)})`);
ok(E.lineupIssues(S, S.my).block, 'kickoff is blocked while A is in the XI');
E.autoLineup(S, S.my);
ok(!inXI(S, A) && E.squad(S, S.my).every(p => !p.inj || !inXI(S, p.id)), 'best XI leaves A out');
playMine(S, fx, T);
ok(bans(P(A)) === '0/0/0', `A served his league ban in the league (${bans(P(A))})`);
ok(bans(P(B)) === '0/1/0' && bans(P(C)) === '0/0/1', `a league game doesn't serve cup bans (B ${bans(P(B))}, C ${bans(P(C))})`);

// 2) league games up to the 天皇杯 tie leave the cup bans alone
let league = 1;
for (;;) {
  fx = toMyMatch(S); if (!fx) break;
  if (fx.cup) break;
  E.autoLineup(S, S.my); playMine(S, fx, T); league++;
}
ok(fx && fx.cup === 'ec', `first cup tie: ${fx && E.fxLabel(fx)} after ${league} league games`);
ok(bans(P(B)) === '0/1/0' && bans(P(C)) === '0/0/1', `cup bans untouched by ${league} league games (B ${bans(P(B))}, C ${bans(P(C))})`);

// 3) before the 天皇杯 tie: B is out, A (now banned in the league again) and C may play
E.setSus(P(A), 'lg', 1);
ok(E.nextComp(S, S.my) === 'ec', 'next match is the 天皇杯');
const c = S.clubs[S.my]; c.tac.xi[c.tac.xi.indexOf(xi0.find(id => !T.includes(id) && P(id).pos !== 'GK' && inXI(S, id)))] = null;
for (const id of T) if (!inXI(S, id)) { const i = c.tac.xi.indexOf(null) >= 0 ? c.tac.xi.indexOf(null) : c.tac.xi.findIndex(x => !T.includes(x) && P(x).pos !== 'GK'); c.tac.xi[i] = id; c.tac.bench = c.tac.bench.filter(b => b !== id); }
ids = issueIds(S);
ok(ids.length === 1 && ids[0] === B, `before the 天皇杯 only B blocks (${ids.map(id => P(id).short)})`);
const tagged = E.lineupIssues(S, S.my); ok(tagged.comp === 'ec', 'lineupIssues reports the competition');
E.autoLineup(S, S.my);
ok(!inXI(S, B), 'best XI for the cup leaves B out');
ok(E.squad(S, S.my).filter(p => E.available(p, 'ec')).some(p => p.id === A), 'A is available for the cup');
// a cup yellow for A and a league-only effect check on a copy first
{
  const S2 = clone(S); const f2 = S2.fixtures.find(f => f.id === fx.id); const a = S2.players[A]; const acc = a.ycAcc;
  if (!S2.clubs[S2.my].tac.xi.includes(A)) { const i = S2.clubs[S2.my].tac.xi.findIndex(x => S2.players[x].pos !== 'GK'); S2.clubs[S2.my].tac.xi[i] = A; }
  playMine(S2, f2, T, M => { if (M.pm[A]) M.pm[A].yc = 1; });
  ok(a.cyc && a.cyc.ec === 1 && a.ycAcc === acc && E.susIn(a, 'lg') === 1, `cup yellow counts in the 天皇杯 only (cyc ${JSON.stringify(a.cyc)}, league yellows ${a.ycAcc}), league ban still 1`);
}
playMine(S, fx, T);
ok(bans(P(B)) === '0/0/0', `B served his 天皇杯 ban in the 天皇杯 (${bans(P(B))})`);
ok(bans(P(A)) === '1/0/0', `a cup tie doesn't serve a league ban (A ${bans(P(A))})`);
ok(bans(P(C)) === '0/0/1', `the 天皇杯 doesn't serve an Lカップ ban (C ${bans(P(C))})`);

// 4) on to the Lカップ: A serves in the next league game, C in the Lカップ
for (;;) {
  fx = toMyMatch(S); if (!fx) break;
  if (fx.cup === 'lc') break;
  E.autoLineup(S, S.my); playMine(S, fx, T);
  if (!fx.cup) ok(bans(P(A)) === '0/0/0', `A served in ${E.fxLabel(fx)}`);
}
ok(fx && fx.cup === 'lc', `Lカップ tie: ${fx && E.fxLabel(fx)}`);
ok(bans(P(C)) === '0/0/1', `C still banned for the Lカップ (${bans(P(C))})`);
ids = issueIds(S); ok(!ids.length || (ids.length === 1 && ids[0] === C), 'before the Lカップ only C can block');
E.autoLineup(S, S.my); ok(!inXI(S, C), 'best XI for the Lカップ leaves C out');
const lcFx = fx, lcState = clone(S);
playMine(S, fx, T);
ok(bans(P(C)) === '0/0/0', `C served his Lカップ ban in the Lカップ (${bans(P(C))})`);

// 5) cards in finishMatch (on copies of the Lカップ tie and of a league game)
{
  const S2 = clone(lcState); const f2 = S2.fixtures.find(f => f.id === lcFx.id); const x = S2.clubs[S2.my].tac.xi.find(id => id && !T.includes(id) && S2.players[id].pos !== 'GK');
  const y = S2.clubs[S2.my].tac.xi.find(id => id && id !== x && !T.includes(id) && S2.players[id].pos !== 'GK');
  const z = S2.clubs[S2.my].tac.xi.find(id => id && id !== x && id !== y && !T.includes(id) && S2.players[id].pos !== 'GK');
  S2.players[y].cyc = { lc: 1 }; const lg0 = S2.players[x].sus;
  playMine(S2, f2, [x, y, z], M => { M.pm[x].rc = 1; M.pm[y].yc = 1; M.pm[z].yc = 2; M.pm[z].rc = 1; });
  const px = S2.players[x], py = S2.players[y], pz = S2.players[z];
  ok(E.susIn(px, 'lc') === 2 && px.sus === lg0 && !E.susIn(px, 'ec'), `straight red in the Lカップ: 2 Lカップ games, nothing else (${bans(px)})`);
  ok(E.susIn(py, 'lc') === 1 && !py.cyc, `second Lカップ yellow: next Lカップ tie (${bans(py)}, cyc ${JSON.stringify(py.cyc)})`);
  ok(E.susIn(pz, 'lc') === 1 && pz.sus === 0, `two yellows in one game: 1 Lカップ game (${bans(pz)})`);
  const nw = S2.news.slice(0, 8).map(n => n.text || n.t || '').join(' / ');
  ok(/Lカップの2試合/.test(nw) && /Lカップの累積警告/.test(nw), 'news names the competition');
  ok(E.nextComp(S2, S2.my) === 'lg' || E.nextComp(S2, S2.my) === 'lc' || E.nextComp(S2, S2.my) === 'ec', 'nextComp after the tie');
  if (E.nextComp(S2, S2.my) === 'lg') ok(E.available(px, E.nextComp(S2, S2.my)), 'he may play the next league game');
}
{
  // a league game: straight red = 2 league games; cup bans untouched
  const S2 = clone(S); const f2 = toMyMatch(S2); const x = S2.clubs[S2.my].tac.xi.find(id => id && !T.includes(id) && S2.players[id].pos !== 'GK');
  if (f2 && !f2.cup) {
    E.setSus(S2.players[x], 'ec', 1);
    playMine(S2, f2, [x], M => { M.pm[x].rc = 1; });
    ok(E.susIn(S2.players[x], 'lg') === 2 && E.susIn(S2.players[x], 'ec') === 1, `straight red in the league: 2 league games (${bans(S2.players[x])})`);
  } else ok(true, 'league red check skipped (next match is a cup)');
}
// the quarter-final wipes single cup yellows (a copy of the Lカップ tie made to look like a quarter-final)
{
  const S2 = clone(lcState); const f2 = S2.fixtures.find(f => f.id === lcFx.id); f2.cr = E.CUPS.lc.rounds.length - 3;
  const xi = S2.clubs[S2.my].tac.xi.filter(id => id && !T.includes(id) && S2.players[id].pos !== 'GK');
  const [u, v, w] = xi; S2.players[u].cyc = { lc: 1 }; S2.players[v].cyc = { lc: 1 }; S2.players[w].cyc = { ec: 1 };
  const bench = E.squad(S2, S2.my).find(p => !S2.clubs[S2.my].tac.xi.includes(p.id) && !S2.clubs[S2.my].tac.bench.includes(p.id));
  if (bench) bench.cyc = { lc: 1 };
  playMine(S2, f2, [u, v, w], M => { M.pm[v].yc = 1; });
  ok(!S2.players[u].cyc, 'QF: a single Lカップ yellow is wiped');
  ok(E.susIn(S2.players[v], 'lc') === 1, 'QF: a second yellow there still means the semi-final');
  ok(S2.players[w].cyc && S2.players[w].cyc.ec === 1, 'QF of the Lカップ leaves 天皇杯 yellows alone');
  if (bench) ok(!bench.cyc, 'QF: also for players who did not play');
}

// 6) AI clubs pick their XI for the competition of the match
{
  const S2 = clone(S); const opp = S2.order.find(id => id !== S2.my);
  const star = E.squad(S2, opp).filter(p => p.pos !== 'GK').sort((a, b) => b.ovr - a.ovr)[0];
  E.setSus(star, 'lg', 1);
  E.autoLineup(S2, opp, { comp: 'ec' }); const inCup = S2.clubs[opp].tac.xi.includes(star.id);
  E.autoLineup(S2, opp, { comp: 'lg' }); const inLeague = S2.clubs[opp].tac.xi.includes(star.id);
  ok(inCup && !inLeague, `AI: a league-banned star plays the cup (${inCup}) but not the league (${inLeague})`);
  E.setSus(star, 'lg', 0); E.setSus(star, 'lc', 1);
  E.autoLineup(S2, opp, { comp: 'lc' }); ok(!S2.clubs[opp].tac.xi.includes(star.id), 'AI: Lカップ-banned star sits out the Lカップ');
}

// 7) rest of the season, day by day: a ban only goes down in a competition the player's club just played in, and
//    nobody banned in a competition scores or is sent off in it
let bad = 0, served = { lg: 0, ec: 0, lc: 0 }, given = { lg: 0, ec: 0, lc: 0 }, scoredBanned = 0;
for (let i = 0; i < 600 && !S.seasonEnd; i++) {
  const snap = {}; for (const p of Object.values(S.players)) { const l = E.susList(p); if (l.length) snap[p.id] = Object.fromEntries(l); }
  const before = new Set(S.fixtures.filter(f => f.played).map(f => f.id));
  const r = E.advance(S, 1);
  if (r.stop === 'match') { const f = S.fixtures.find(x => x.id === r.fid); E.autoLineup(S, S.my); playMine(S, f); }
  else if (r.stop === 'inbox') for (const it of S.inbox) it.seen = true;
  else if (r.stop === 'fired') { E.takeJob(S, S.fired.offers[0]); }
  const now = S.fixtures.filter(f => f.played && !before.has(f.id));
  for (const p of Object.values(S.players)) for (const k of ['lg', 'ec', 'lc']) {
    const b0 = (snap[p.id] || {})[k] || 0, b1 = E.susIn(p, k);
    if (b1 === b0) continue;
    const mine = now.filter(f => E.compOf(f) === k && (f.h === p.club || f.a === p.club));
    if (!mine.length) { bad++; if (bad < 5) console.log('  ban changed without a match:', p.name, k, b0, '->', b1); }
    if (b1 < b0) served[k]++; else given[k]++;
  }
  for (const f of now) for (const e of f.sc || []) { const b = (snap[e[3]] || {})[E.compOf(f)] || 0; if (b > 0 && P(e[3]) && P(e[3]).club && (f.h === P(e[3]).club || f.a === P(e[3]).club)) scoredBanned++; }
}
ok(bad === 0, `bans only change in their own competition (${bad} wrong)`);
ok(scoredBanned === 0, `no banned player scored or was sent off in that competition (${scoredBanned})`);
console.log(`  bans given lg ${given.lg} / 天皇杯 ${given.ec} / Lカップ ${given.lc}, games served lg ${served.lg} / 天皇杯 ${served.ec} / Lカップ ${served.lc}`);
ok(given.lg > 0 && given.ec + given.lc > 0, 'bans are given in the league and in the cups');

// 8) the end of the season: one game lapses, two or more carry over to the same competition
if (!S.seasonEnd) { for (let i = 0; i < 400 && !S.seasonEnd; i++) { const r = E.advance(S); if (r.stop === 'match') { const f = S.fixtures.find(x => x.id === r.fid); playMine(S, f); } else if (r.stop === 'inbox') for (const it of S.inbox) it.seen = true; } }
ok(!!S.seasonEnd, 'season over');
const mine = E.squad(S, S.my).filter(p => !p.retire && !p.loan).sort((a, b) => b.ovr - a.ovr);
const [p1, p2, p3, p4, p5] = mine;
for (const p of mine) for (const k of ['lg', 'ec', 'lc']) E.setSus(p, k, 0);
E.setSus(p1, 'lg', 1); E.setSus(p2, 'lg', 2); E.setSus(p3, 'ec', 2); E.setSus(p4, 'lc', 1); p5.cyc = { ec: 1 }; p5.ycAcc = 3;
const n0 = S.news.length;
E.rollover(S);
if (S.fired) E.takeJob(S, S.fired.offers[0]);
ok(E.susIn(p1, 'lg') === 0 && E.susIn(p4, 'lc') === 0, 'one unserved game lapses');
ok(E.susIn(p2, 'lg') === 2 && E.susIn(p3, 'ec') === 2, 'two or more carry over to the same competition');
ok(!p5.cyc && p5.ycAcc === 0, 'yellow cards start again from zero');
const nn = S.news.slice(0, S.news.length - n0 + 5).map(n => n.text || '').join(' / ');
ok(nn.includes(p2.name) && nn.includes(p3.name) && !nn.includes(p1.name + 'は前季'), 'news for the carried bans only');
if (p2.club === S.my) {
  ok(E.nextComp(S, S.my) === 'lg', 'new season starts with the league');
  ok(!E.available(p2, 'lg') && E.available(p3, 'lg'), 'carried league ban counts in the league, the 天皇杯 one does not');
}

// 9) old saves: a ban from before is a league ban
const old = clone(P(A)); delete old.csus; old.sus = 1;
ok(!E.available(old, 'lg') && E.available(old, 'ec') && E.available(old, 'lc'), 'old save: p.sus is a league ban');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
