// Suspensions as in the real rules (2026-10-14): J.League 出場停止の細則 2026/27, JFA 懲罰規程 別紙1・2, 天皇杯 開催規程 第18条.
// - served in the next matches of the competition they were given in (league / 天皇杯 / Lカップ 1st round / prime round)
// - yellows: league 4 = 1 game, cups 2 = 1 game, a single cup yellow wiped after the QF; 2 yellows in a match not counted
//   (1 game), a yellow before a straight red counted
// - straight red: next game at once, the committee's total the next day; same kind again in the same competition = x2
//   (not DOGSO); sending-off games served first
// - competition over for the club: sending-off bans go to the next official match of any competition, yellow bans lapse
// - end of season: 1 game lapses, 2+ (not counting the doubled part) carry over to the league and Lカップ; J2 season clears
// usage: node dev/test/cards.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-10');
const P = id => S.players[id];
const show = p => JSON.stringify(E.bansOf(p).map(b => `${b.c}${b.n}${b.y ? 'y' : ''}${b.tot ? '?' + b.tot : ''}`));
const sumNonY = p => { const m = {}; for (const b of E.bansOf(p)) if (!b.y) m[b.c] = (m[b.c] || 0) + b.n; return m; };

function toMyMatch(st) {
  for (let i = 0; i < 400; i++) {
    const r = E.advance(st);
    if (r.stop === 'match') return st.fixtures.find(f => f.id === r.fid);
    if (r.stop === 'inbox') for (const it of st.inbox) it.seen = true;
    if (r.stop === 'seasonEnd' || r.stop === 'fired') return null;
  }
  return null;
}
// play my match; the test players get no cards or injuries unless `edit` gives them some
function playMine(st, fx, keep, edit) {
  const M = E.createMatch(st, fx); E.simulateFull(st, M);
  for (const id of keep || []) if (M.pm[id]) { M.pm[id].yc = 0; M.pm[id].rc = 0; M.pm[id].inj = 0; delete M.pm[id].rr; }
  if (edit) edit(M);
  E.finishMatch(st, M); return M;
}
// the next morning (the committee's decisions, competitions that are over)
const morning = st => { st.date = E.D.add(st.date, 1); E.banSweep(st); };
const inXI = (st, id) => st.clubs[st.my].tac.xi.includes(id);
const issueIds = (st, comp) => E.lineupIssues(st, st.my, comp).xi.filter(x => x.why === 'sus').map(x => x.pid);
const fieldXI = st => st.clubs[st.my].tac.xi.filter(id => id && st.players[id].pos !== 'GK');

const xi0 = S.clubs[S.my].tac.xi.slice();
const [A, B, C] = E.squad(S, S.my).filter(p => p.pos !== 'GK' && xi0.includes(p.id)).slice(0, 3).map(p => p.id);
const T = [A, B, C];
console.log('A', P(A).name, '| B', P(B).name, '| C', P(C).name);

// an Lカップ 1st-round club's player: banned for 2 games in the 1st round (red) + 1 (yellows)
const r1 = S.fixtures.find(f => f.cup === 'lc' && f.cr === 0);
const X = E.squad(S, r1.h).filter(p => p.pos !== 'GK').sort((a, b) => b.ovr - a.ovr)[0];
E.addBan(X, { c: 'lc1', n: 10, r: 'vc' }); E.addBan(X, { c: 'lc1', n: 1, y: 1 }); X.cyc = { lc1: 1 };

// 1) same competition only
let fx = toMyMatch(S);
ok(fx && !fx.cup && E.nextComp(S, S.my) === 'lg', `next match is the league (${fx && E.fxLabel(fx)})`);
E.setSus(P(A), 'lg', 1); E.setSus(P(B), 'ec', 1); E.setSus(P(C), 'lc2', 1);
ok(!E.available(P(A), 'lg') && E.available(P(A), 'ec') && E.available(P(A), 'lc2'), 'league ban: out of the league only');
ok(E.available(P(B), 'lg') && !E.available(P(B), 'ec') && E.available(P(B), 'lc1'), '天皇杯 ban: out of the 天皇杯 only');
let ids = issueIds(S); ok(ids.length === 1 && ids[0] === A, `before a league game only A blocks (${ids.map(id => P(id).short)})`);
E.autoLineup(S, S.my); ok(!inXI(S, A), 'best XI leaves A out');
playMine(S, fx, T);
ok(show(P(A)) === '[]' && show(P(B)) === '["ec1"]' && show(P(C)) === '["lc21"]', `league game served A only (A ${show(P(A))} B ${show(P(B))} C ${show(P(C))})`);
let league = 1;
for (;;) { fx = toMyMatch(S); if (!fx || fx.cup) break; E.autoLineup(S, S.my); playMine(S, fx, T); league++; }
ok(fx && fx.cup === 'ec', `first cup tie: ${fx && E.fxLabel(fx)} after ${league} league games`);
ok(show(P(B)) === '["ec1"]' && show(P(C)) === '["lc21"]', `cup bans untouched by league games (B ${show(P(B))}, C ${show(P(C))})`);

// 2) the 天皇杯 tie: B is out, A (league-banned again) may play
E.setSus(P(A), 'lg', 1);
ok(E.nextComp(S, S.my) === 'ec', 'next match is the 天皇杯');
const c = S.clubs[S.my];
for (const id of T) if (!inXI(S, id)) { const i = c.tac.xi.findIndex(x => x && !T.includes(x) && P(x).pos !== 'GK'); c.tac.xi[i] = id; c.tac.bench = c.tac.bench.filter(b => b !== id); }
ids = issueIds(S); ok(ids.length === 1 && ids[0] === B, `before the 天皇杯 only B blocks (${ids.map(id => P(id).short)})`);
ok(E.lineupIssues(S, S.my).comp === 'ec', 'lineupIssues reports the competition');
E.autoLineup(S, S.my); ok(!inXI(S, B), 'best XI for the cup leaves B out');
const ecFx = fx, ecState = clone(S);
playMine(S, fx, T);
ok(show(P(B)) === '[]' && show(P(A)) === '["lg1"]' && show(P(C)) === '["lc21"]', `天皇杯 served B only (A ${show(P(A))} C ${show(P(C))})`);

// 3) cards (on copies of the 天皇杯 tie)
const cp = () => { const S2 = clone(ecState); return [S2, S2.fixtures.find(f => f.id === ecFx.id), fieldXI(S2).filter(id => !T.includes(id))]; };
{
  const [S2, f2, [u, v, w, z]] = cp(); const pu = S2.players[u], pv = S2.players[v], pw = S2.players[w], pz = S2.players[z];
  pw.ycAcc = 3; const acc = pv.ycAcc;
  playMine(S2, f2, [u, v, w, z], M => { M.pm[u].rc = 1; M.pm[u].rr = 'sfp'; M.pm[v].yc = 2; M.pm[v].rc = 1; M.pm[w].yc = 1; M.pm[w].rc = 1; M.pm[w].rr = 'dogso'; M.pm[z].yc = 1; });
  const b = E.bansOf(pu)[0];
  ok(E.susIn(pu, 'ec') === 1 && b.tot >= 2 && b.tot <= 4 && E.banPending(pu), `straight red (serious foul play): 1 game at once, committee total ${b.tot} pending`);
  ok(E.susIn(pu, 'lg') === 0, '...in the 天皇杯 only');
  ok(show(pv) === '["ec1"]' && pv.ycAcc === acc && !pv.cyc, `two yellows in one match: 1 game, the yellows not counted (${show(pv)})`);
  ok(pw.cyc && pw.cyc.ec === 1 && pw.ycAcc === 3, 'a yellow before a straight red counts (in the 天皇杯 count, not the league one)');
  ok(pz.cyc && pz.cyc.ec === 1 && E.susIn(pz, 'ec') === 0, 'first 天皇杯 yellow: counted, no ban');
  const tot = b.tot; morning(S2);
  ok(E.susIn(pu, 'ec') === tot && !E.banPending(pu), `next morning the committee decides: ${E.susIn(pu, 'ec')} games`);
  ok(S2.news.slice(0, 6).some(n => /規律委員会/.test(n.text)), 'news of the decision');
}
{
  // repeat offences in the same competition double the games (not DOGSO); another competition doesn't count
  const [S2, f2, [u, v]] = cp(); const pu = S2.players[u], pv = S2.players[v];
  pu.rch = { ec: ['sfp'] }; pv.rch = { lg: ['sfp'], ec: ['dogso'] };
  playMine(S2, f2, [u, v], M => { M.pm[u].rc = 1; M.pm[u].rr = 'sfp'; M.pm[v].rc = 1; M.pm[v].rr = 'dogso'; });
  const bu = E.bansOf(pu)[0], bv = E.bansOf(pv)[0];
  ok(bu.x > 0 && bu.tot === 2 * bu.x, `second serious foul play in the 天皇杯: doubled (${bu.tot} = 2 x ${bu.x})`);
  ok(!bv.x && bv.tot === 1, 'second DOGSO: not doubled, 1 game');
  const [S3, f3, [w]] = cp(); const pw = S3.players[w]; pw.rch = { lg: ['sfp'] };
  playMine(S3, f3, [w], M => { M.pm[w].rc = 1; M.pm[w].rr = 'sfp'; });
  ok(!E.bansOf(pw)[0].x, 'serious foul play in the league before: not a repeat in the 天皇杯');
}
{
  // sending-off games are served before yellow-card ones; yellow 4 in the league
  const p = { inj: 0, bans: [{ c: 'lg', n: 1, y: 1 }, { c: 'lg', n: 1, r: 'dogso' }] };
  E.serveBan(p, 'lg'); ok(show(p) === '["lg1y"]', 'the sending-off game is served first');
  const [S2, f0] = cp(); playMine(S2, f0, T); const f2 = toMyMatch(S2);
  if (f2 && !f2.cup) {
    const [u] = fieldXI(S2).filter(id => !T.includes(id)); const pu = S2.players[u]; pu.ycAcc = 3;
    playMine(S2, f2, [u], M => { M.pm[u].yc = 1; M.pm[u].rc = 1; M.pm[u].rr = 'dogso'; });
    morning(S2);
    ok(E.susIn(pu, 'lg') === 2 && pu.ycAcc === 0 && show(pu) === '["lg1","lg1y"]', `yellow no.4 then a straight red: red + yellow ban (${show(pu)})`);
  } else ok(false, 'expected a league game after the 天皇杯 tie');
}
// the quarter-final wipes single cup yellows; Lカップ stages count apart
{
  const [S2, f2, [u, v, w]] = cp(); f2.cr = E.CUPS.ec.rounds.length - 3;
  S2.players[u].cyc = { ec: 1 }; S2.players[v].cyc = { ec: 1 }; S2.players[w].cyc = { lc2: 1 };
  const bench = E.squad(S2, S2.my).find(p => !S2.clubs[S2.my].tac.xi.includes(p.id) && !S2.clubs[S2.my].tac.bench.includes(p.id));
  if (bench) bench.cyc = { ec: 1 };
  playMine(S2, f2, [u, v, w], M => { M.pm[v].yc = 1; });
  ok(!S2.players[u].cyc, 'QF: a single 天皇杯 yellow is wiped');
  ok(E.susIn(S2.players[v], 'ec') === 1, 'QF: a second one means the semi-final');
  ok(S2.players[w].cyc && S2.players[w].cyc.lc2 === 1, 'the 天皇杯 QF leaves Lカップ yellows alone');
  if (bench) ok(!bench.cyc, 'QF: also for players who did not play');
}

// 4) knocked out of the 天皇杯: sending-off games go on to the next official match, yellow ones lapse
for (let i = 0; i < 20 && !(S.cups.ec.r > 0); i++) { const f = toMyMatch(S); if (!f) break; E.autoLineup(S, S.my); playMine(S, f, T); }
{
  const out = Object.keys(S.cups.ec.out).find(cid => S.clubs[cid] && S.order.includes(cid));
  const p = E.squad(S, out).filter(q => q.pos !== 'GK')[0]; delete p.bans;
  E.addBan(p, { c: 'ec', n: 2, r: 'vc' }); E.addBan(p, { c: 'ec', n: 1, y: 1 }); p.cyc = { ec: 1 };
  E.banSweep(S);
  ok(show(p) === '["*2"]' && !p.cyc, `knocked out (${S.clubs[out].short}): 天皇杯 red → next official matches, yellow ban and count gone (${show(p)})`);
  ok(!E.available(p, 'lg'), '...so he misses the next league game');
}

// 5) moving to a club in another league: league yellow ban sleeps, sending-off ban goes with him
{
  const S2 = clone(S); const p = S2.players[fieldXI(S2)[5]]; const j2 = Object.keys(S2.clubs).find(id => !S2.order.includes(id) && !S2.clubs[id].ab);
  E.addBan(p, { c: 'lg', n: 1, y: 1 }); E.addBan(p, { c: 'lg', n: 2, r: 'sfp' }); p.ycAcc = 2;
  const home = p.club; p.club = j2; E.banSweep(S2);
  ok(show(p) === '["lg1y","*2"]' && p.ycAcc === 2, `to J2 (${S2.clubs[j2].short}): yellow ban sleeps, red goes on (${show(p)})`);
  p.club = home; ok(E.susIn(p, 'lg') === 3, 'back in J1 the league yellow ban counts again');
}

// 6) AI clubs pick for the competition of the match
{
  const S2 = clone(S); const opp = S2.order.find(id => id !== S2.my);
  const star = E.squad(S2, opp).filter(p => p.pos !== 'GK').sort((a, b) => b.ovr - a.ovr)[0];
  star.inj = 0; star.cond = 100; delete star.bans; E.setSus(star, 'lg', 1);
  E.autoLineup(S2, opp, { comp: 'ec' }); const inCup = S2.clubs[opp].tac.xi.includes(star.id);
  E.autoLineup(S2, opp, { comp: 'lg' }); const inLeague = S2.clubs[opp].tac.xi.includes(star.id);
  ok(inCup && !inLeague, `AI: league-banned star plays the cup (${inCup}), not the league (${inLeague})`);
}

// 7) straight reds in the match: a reason in the commentary, shares close to RED
{
  const S2 = clone(S); const cnt = {}; let n = 0, txt = 0;
  const pool = S2.fixtures.filter(f => !f.played && !f.cup).slice(0, 40);
  for (let k = 0; k < 15; k++) for (const f of pool) {
    const M = E.createMatch(S2, f); E.simulateFull(S2, M);
    for (const e of M.ev) if (e.t === 'red' && /一発/.test(e.text)) { n++; if (/（.+）/.test(e.text)) txt++; const r = M.pm[e.pid].rr; cnt[r] = (cnt[r] || 0) + 1; }
  }
  console.log(`  ${n} straight reds in 600 matches:`, Object.entries(cnt).map(([k, v]) => `${E.RED[k].jp} ${Math.round(v / n * 100)}%`).join(', '));
  ok(n > 10 && txt === n, 'every straight red names the offence');
  ok(n < 30 || Math.abs((cnt.dogso || 0) / n - E.RED.dogso.w) < 0.15, 'DOGSO share close to the setting');
}

// 8) the rest of the season, day by day
let bad = [], played = 0, scoredBanned = 0, given = {}, decided = 0, xDone = false;
// the morning after X's club played its 2回戦 (9/29; the Lカップ 1stラウンド since 2026-10-14 has 2回戦〜4回戦): knocked out,
// the sending-off games left go on to any official match and the yellow ban and count lapse; through, they stay in the 1stラウンド
const xCheck = () => {
  xDone = true;
  const won = E.cupWinner(r1) === X.club;
  if (won) ok(show(X) === '["lc19","lc11y"]' && X.cyc && X.cyc.lc1 === 1, `Lカップ 2回戦 won: ${X.name} ${show(X)} (1 game served, still in the 1stラウンド)`);
  else {
    ok(show(X) === '["*9"]' && !X.cyc, `Lカップ 1stラウンド over (lost the 2回戦): ${X.name} ${show(X)} (1 game served, the rest to any official match; yellow ban and count gone)`);
    ok(!E.available(X, 'lg') && !E.available(X, 'ec') && !E.available(X, 'lc2'), '"*" ban counts for any competition');
  }
};
for (let i = 0; i < 700 && !S.seasonEnd; i++) {
  const snap = {}, kick = {};
  for (const p of Object.values(S.players)) if (E.bansOf(p).length) { snap[p.id] = sumNonY(p); kick[p.id] = clone(E.bansOf(p)); }
  const before = new Set(S.fixtures.filter(f => f.played).map(f => f.id));
  const r = E.advance(S, 1);
  if (r.stop === 'match') { const f = S.fixtures.find(x => x.id === r.fid); E.autoLineup(S, S.my); playMine(S, f); }
  else if (r.stop === 'inbox') for (const it of S.inbox) it.seen = true;
  else if (r.stop === 'fired') E.takeJob(S, S.fired.offers[0]);
  const now = S.fixtures.filter(f => f.played && !before.has(f.id)); played += now.length;
  if (!xDone && r1.played && S.date > r1.date) xCheck();
  for (const p of Object.values(S.players)) {
    const b0 = snap[p.id] || {}, b1 = sumNonY(p);
    const mine = now.filter(f => f.h === p.club || f.a === p.club).map(E.compOf);
    const t0 = Object.values(b0).reduce((a, x) => a + x, 0), t1 = Object.values(b1).reduce((a, x) => a + x, 0);
    if (t1 < t0 - mine.length) bad.push(`${p.name}: ${JSON.stringify(b0)} -> ${JSON.stringify(b1)} with ${mine.length} match(es)`);
    for (const k of ['lg', 'ec', 'lc1', 'lc2']) {
      const d = (b0[k] || 0) - (b1[k] || 0);
      if (d > 0 && !mine.includes(k) && (b1[k] || 0) !== 0) bad.push(`${p.name}: ${k} ${b0[k]} -> ${b1[k]} without a ${k} match`);
    }
    for (const b of E.bansOf(p)) if (b.tot) given[b.r] = (given[b.r] || 0) + 1;
    if ((kick[p.id] || []).some(b => b.tot) && !E.banPending(p)) decided++;
  }
  for (const f of now) for (const e of f.sc || []) {
    const kb = kick[e[3]]; if (!kb) continue;
    const pl = { inj: 0, bans: kb }; if (E.susIn(pl, E.compOf(f)) > 0) scoredBanned++;
  }
}
ok(!bad.length, `bans only go down in matches they count for (${bad.length} wrong)${bad.length ? '\n    ' + bad.slice(0, 4).join('\n    ') : ''}`);
ok(scoredBanned === 0, `nobody banned for a competition scored or was sent off in it (${scoredBanned})`);
ok(decided > 0, `committee decisions arrive the next morning (${decided})`);

// 9) end of the season
for (let i = 0; i < 400 && !S.seasonEnd; i++) { const r = E.advance(S); if (r.stop === 'match') playMine(S, S.fixtures.find(x => x.id === r.fid)); else if (r.stop === 'inbox') for (const it of S.inbox) it.seen = true; }
ok(!!S.seasonEnd, 'season over');
const mine = E.squad(S, S.my).filter(p => !p.retire && !p.loan).sort((a, b) => b.ovr - a.ovr);
const [p1, p2, p3, p4, p5] = mine;
for (const p of mine) delete p.bans;
p1.bans = [{ c: 'lg', n: 1, r: 'sfp' }];
p2.bans = [{ c: '*', n: 1, r: 'sfp' }, { c: 'lg', n: 1, r: 'dogso' }];
p3.bans = [{ c: 'lg', n: 3, r: 'sfp', x: 2 }];
p4.bans = [{ c: 'lg', n: 1, y: 1 }, { c: 'ec', n: 1, r: 'yy' }];
p5.cyc = { ec: 1 }; p5.ycAcc = 3; p5.rch = { lg: ['sfp'] };
const j2 = E.squad(S, Object.keys(S.clubs).find(id => !S.order.includes(id) && !S.clubs[id].ab && E.squad(S, id).length))[0];
if (j2) j2.bans = [{ c: '*', n: 3, r: 'vc' }];
const n0 = S.news.length;
E.rollover(S); if (S.fired) E.takeJob(S, S.fired.offers[0]);
ok(!p1.bans, 'one game left lapses');
ok(show(p2) === '["J1","J1"]', `two games left (any kind of sending-off) carry over to the league and Lカップ (${show(p2)})`);
ok(!p3.bans, '3 left of which 2 added for a repeat: only 1 counts → lapses');
ok(!p4.bans, 'yellow ban + 1 game: lapses');
ok(!p5.cyc && p5.ycAcc === 0 && !p5.rch, 'yellow counts and repeat records start again');
if (j2) ok(!j2.bans, 'a player outside J1 served his bans in the J2 season');
ok(S.news.some(n => n.text.includes(p2.name + 'は出場停止が')) && !S.news.some(n => n.text.includes(p1.name + 'は出場停止が')), 'news for the carried ban only');
ok(!E.available(p2, 'lg') && !E.available(p2, 'lc1') && E.available(p2, 'ec'), 'carried ban: league and Lカップ, not the 天皇杯');

// 10) old saves
const old = { inj: 0, sus: 2, csus: { ec: 1, lc: 1 }, cyc: { lc: 1 } };
ok(E.susIn(old, 'lg') === 2 && E.susIn(old, 'ec') === 1 && E.susIn(old, 'lc2') === 1 && old.cyc.lc2 === 1 && !old.sus && !old.csus, 'old save: p.sus / p.csus / cyc.lc turn into bans');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
