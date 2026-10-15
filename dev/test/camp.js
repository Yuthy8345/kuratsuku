// キャンプ (2026-10-16, 作業7; the summer camp before the opening, the real calendar since 2026/27): when (none in the
// first season — the game starts after it; then 14 days ending 13 days before the season's first league match, before
// every opening up to 2031/32 with nothing else on those days; three weeks before she asks and the days stop; not chosen
// → 北海道 on the first day), what it costs (mine and the AI clubs'), what it does (growth = wk weeks of devWeek at once,
// 連携 = pm practice matches for the XI, 調子, minor injuries, 宮崎's rehab, my できごと, the report and its stop), who
// isn't there (away with his national team until he is back, the injured, on loan, a summer signing from the day he
// comes), the AI clubs (the standard camp), a new job, the season after, old saves (v16 = b9f4f3a, be3e2da: none in
// 2026/27, then as usual).
// usage: node dev/test/camp.js   (about a minute: it plays the first season through)
// a seeded Math.random (the engine takes it when it loads): branches from the same state start from the same numbers
let gen = null; const seed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd0 = Math.random; Math.random = () => (gen ? gen() : rnd0());
const E = require('../src/engine.js');
const DATA = require('../data.json');
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const near = (a, b, e) => Math.abs(a - b) <= e;
const CP = E.CAMP, STD = CP.std, RH = CP.keys.find(k => CP.d[k].rehab), D = E.D;
const playDay = (S, X, onSec) => {
  X = X || E;
  const st = X.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); X.autoLineup(S, S.my, X.compOf ? { comp: X.compOf(f) } : undefined); const M = X.createMatch(S, f); X.simulateFull(S, M); X.finishMatch(S, M); S.board = Math.max(S.board, 60); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') X.rejectOffer(S, y.id); });
  else if (st.stop === 'fired') X.takeJob(S, S.fired.offers[0]);
  else if (st.stop === 'seasonEnd') { X.rollover(S); if (S.reborn) delete S.reborn.show; }
  else if (st.stop === 'sec' && onSec) onSec(S);
  else if (st.stop === 'camp') X.campSeen(S);
  else if (st.stop) { if (S.sec && X.secSeen) X.secSeen(S); S.cele = []; if (S.spon && X.sponPending && X.sponPending(S)) X.sponAuto(S); }
  return st;
};
const playTo = (S, until, X, onSec) => { const stops = []; for (let g = 0; g < 9000 && S.date < until; g++) { const st = playDay(S, X, onSec); if (st.stop) stops.push([S.date, st.stop]); } return stops; };
const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

/* the dates: none in 2026/27 (the game starts 8/7, after the camps); 2027/28 and the next ones before the opening */
gen = seed(1);
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-16'); E.sponAuto(S);
{
  const C = E.campOf(S);
  ok(C.skip && S.date === '2026-08-07', `2026/27: no camp (the game starts on ${S.date}, the camp would have been ${C.from}〜${C.to})`);
  for (const sy of [2027, 2028, 2029, 2030, 2031]) {
    const T = { season: sy, date: `${sy}-06-08`, fixtures: E.seasonDates(sy).map((d, i) => ({ date: d, r: i + 1 })) };
    const P = E.campPlan(T), lg = T.fixtures.map(f => f.date);
    ok(!P.skip && P.re === lg[0] && D.diff(P.to, P.from) + 1 === CP.len && D.diff(P.re, P.to) === CP.gap && P.ask > T.date && P.from >= `${sy}-07-01` && P.to <= `${sy}-07-31`,
      `${E.seasonLabel(sy)}: asked ${P.ask}, the camp ${P.from}〜${P.to} (${CP.len} days), the opening ${P.re}`);
  }
}
// the first season through to the day before her question (sponsors: hers; a 転生 pop-up skipped)
for (let g = 0; g < 9000 && S.season === 2026; g++) playDay(S);   // through the season's end and the rollover (6/8)
const C27 = E.campOf(S);
ok(S.season === 2027 && C27.ask === '2027-06-21' && C27.from === '2027-07-12' && C27.to === '2027-07-25' && C27.re === '2027-08-07', `2027/28: asked ${C27.ask}, the camp ${C27.from}〜${C27.to}, the opening ${C27.re}`);
ok(!S.fixtures.some(f => f.date >= C27.from && f.date <= C27.to), 'no match during the camp');
playTo(S, D.add(C27.ask, -1)); if (S.sec) E.secSeen(S);
const eve = clone(S);

/* the question: she asks and the days stop; not chosen → 北海道 on the first day */
{
  const A = clone(eve);
  ok(!E.campPending(A) && !E.secNotes(A).some(n => n.k === 'camp'), `${A.date}: nothing yet`);
  const st = playDay(A);
  ok(A.date === C27.ask && st.stop === 'sec' && E.campPending(A) && E.secNotes(A).some(n => n.k === 'camp'), `${A.date}: her question, the days stop`);
  const m0 = A.clubs[A.my].funds, ai = A.order.find(c => c !== A.my), a0 = A.clubs[ai].funds;
  playTo(A, C27.from);
  ok(A.camp.dest === STD && A.camp.auto && A.camp.st === 'run', `not chosen: ${CP.d[STD].jp} on ${A.date}`);
  ok(A.clubs[A.my].fin.camp === CP.d[STD].cost && A.clubs[ai].fin.camp === CP.d[STD].cost, `the cost on the first day: mine ${A.clubs[A.my].fin.camp}万, the AI clubs ${A.clubs[ai].fin.camp}万`);
  ok(A.news.some(n => new RegExp(`${CP.d[STD].jp}キャンプがスタート`).test(n.text) && /標準の/.test(n.text)), `news: the camp starts (${CP.d[STD].jp} because nothing was chosen)`);
  const st2 = playTo(A, C27.to);
  ok(st2.some(x => x[0] === C27.to && x[1] === 'camp') && A.camp.st === 'done' && A.camp.rep && A.camp.rep.auto, 'the last day: the report stops the days (auto)');
  ok(A.clubs[A.my].fin.camp === CP.d[STD].cost && m0 !== A.clubs[A.my].funds && a0 !== A.clubs[ai].funds, 'the funds paid it');
}

/* picking: the five, the money, changing it, not after it started */
const ask = (() => { const A = clone(eve); playDay(A); return A; })();
{
  const A = clone(ask);
  for (const k of CP.keys) { const r = E.campPick(A, k); ok(r.ok && A.camp.dest === k, `pick ${CP.d[k].jp}: ${r.msg}`); }
  ok(!E.secNotes(A).some(n => n.k === 'camp'), 'picked: her question is gone');
  const B = clone(A); B.clubs[B.my].funds = 5000; ok(!E.campPick(B, 'abr').ok && E.campPick(B, 'miya').ok, 'not enough money for 海外 (1.8億); 宮崎 (4,000万) is fine');
  E.campPick(A, 'oki'); playTo(A, D.add(C27.from, 1));
  ok(!E.campPick(A, 'hok').ok && A.camp.dest === 'oki', 'once it started it can\'t be changed');
}

/* what it does: the same state, the same numbers, each destination */
const runTo = (k, until, sd) => { const A = clone(ask); gen = seed(sd || 7); if (k) E.campPick(A, k); playTo(A, until); return A; };
const R = {};
for (const k of CP.keys) {
  // up to the day before the last, then the last day alone (campEnd)
  const A = runTo(k, D.add(C27.to, -1));
  const C = A.camp, c = A.clubs[A.my];
  const ai = A.order.find(x => x !== A.my), ac = A.clubs[ai];
  const before = {}; for (const p of E.squad(A, A.my).concat(E.squad(A, ai))) before[p.id] = { ovr: p.ovr, form: p.form, dry: p.at ? E.devWeek(A, p, true) : null, d: C.dd ? C.dd[p.id] || 0 : 0, inj: p.inj };
  const xi = c.tac.xi.slice(), lk0 = clone(c.lk || {});
  const axi = ac.tac.xi.slice(), alk0 = clone(ac.lk || {});
  E.nextDay(A);   // the last day (7/25); the stop comes from the next advance (on a copy: it would move on a day)
  const st = E.advance(clone(A), 1);
  R[k] = { A, before, xi, lk0, ai, axi, alk0, st };
}
{
  // growth: wk weeks of devWeek at once for whoever was there every day (young players: no ageing in the way)
  // (行かない: nobody of mine is there, and nobody of mine grows on that day)
  const chk = (k, cid, wk) => { const { A, before } = R[k]; let n = 0, bad = 0, sum = 0;
    for (const p of E.squad(A, cid)) { const b = before[p.id]; if (!b || !b.dry || (k !== 'none' || cid !== A.my ? b.d !== CP.len - 1 : b.d !== 0) || b.inj > 0 || p.inj > 0 || E.age(p, A.date) > 29) continue;
      const want = b.dry.dOvr * wk, got = p.ovr - b.ovr; n++; sum += got; if (!near(got, want, 0.03 + Math.abs(want) * 0.05)) bad++; }
    return { n, bad, sum }; };
  for (const k of CP.keys) { const r = chk(k, R[k].A.my, CP.d[k].wk); ok(r.n > 10 && !r.bad, `${CP.d[k].jp}: ${r.n} young players grew ${CP.d[k].wk} weeks' worth (+${r.sum.toFixed(2)} together)${r.bad ? `, ${r.bad} off` : ''}`); }
  const g = k => chk(k, R[k].A.my, CP.d[k].wk).sum;
  ok(g('abr') > g(STD) * 1.7 && g('none') === 0, `海外 grows about twice ${CP.d[STD].jp} (${g('abr').toFixed(2)} / ${g(STD).toFixed(2)}), 行かない nothing`);
  const ai = chk('none', R.none.ai, CP.d[STD].wk); ok(ai.n > 5 && !ai.bad, `the AI club (${R.none.ai}) had the standard camp even when I stayed home: ${ai.n} grew ${CP.d[STD].wk} weeks' worth`);
}
{
  // 連携: the XI's neighbours get pm practice matches (the curve of linkMatch); できごと pairs aside
  for (const k of ['hok', 'oki', 'abr']) {
    const { A, before, xi, lk0 } = R[k], c = A.clubs[A.my], ev = new Set((A.camp.rep.ev || []).filter(e => e.q).map(e => key(e.pid, e.q)));
    let n = 0, bad = 0;
    for (const [i, j] of E.linkAdj(c.tac.form)) {
      const a = xi[i], b = xi[j], kk = key(a, b); if (!before[a] || !before[b] || ev.has(kk) || before[a].d !== CP.len - 1 || before[b].d !== CP.len - 1 || A.players[a].inj > 0 || A.players[b].inj > 0) continue;
      let v = lk0[kk] ? lk0[kk][0] : 0; for (let m = 0; m < CP.d[k].pm; m++) v = Math.min(100, v + E.LINK.adj * Math.max(E.LINK.floor, 1 - v / E.LINK.top));
      n++; if (!near(c.lk[kk][0], v, 0.25)) bad++;
    }
    ok(n > 8 && !bad, `${CP.d[k].jp}: ${n} neighbouring pairs got ${CP.d[k].pm} practice matches${bad ? ` (${bad} off)` : ''}`);
  }
  const { A, axi, alk0, ai } = R.hok, ac = A.clubs[ai];
  const up = E.linkAdj(ac.tac.form).filter(([i, j]) => { const kk = key(axi[i], axi[j]); return ac.lk[kk] && ac.lk[kk][0] > (alk0[kk] ? alk0[kk][0] : 0); }).length;
  ok(up > 10, `the AI club's neighbours too (${up} pairs up)`);
  const ro = R.oki.A.camp.rep, rm = R.miya.A.camp.rep;
  ok(ro.avg1 - ro.avg0 > rm.avg1 - rm.avg0, `沖縄 builds more 連携 than 宮崎 (+${(ro.avg1 - ro.avg0).toFixed(1)} / +${(rm.avg1 - rm.avg0).toFixed(1)})`);
}
{
  // 調子: + form × his share
  for (const k of CP.keys) {
    const { A, before } = R[k]; let n = 0, bad = 0;
    for (const p of E.squad(A, A.my)) { const b = before[p.id]; if (!b || b.d !== (k === 'none' ? 0 : CP.len - 1) || b.inj > 0 || p.inj > 0) continue; n++; if (!near(p.form - b.form, CP.d[k].form, 1e-6)) bad++; }
    ok(n > 10 && !bad, `${CP.d[k].jp}: 調子 ${CP.d[k].form >= 0 ? '+' : ''}${CP.d[k].form} for the ${n} who were there every day`);
  }
}
{
  // the report, its stop
  for (const k of CP.keys) {
    const { A, st } = R[k], r = A.camp.rep;
    ok(k === 'none' ? (!A.camp.show && st.stop !== 'camp') : (st.stop === 'camp' && r && r.k === k && r.grow.length === 5 && r.lk.length === E.linkAdj(r.form).filter(([i, j]) => r.xi[i] && r.xi[j]).length && r.pm.length === CP.d[k].pm && r.re === C27.re),
      k === 'none' ? '行かない: no report, no stop' : `${CP.d[k].jp}: the report stops the days (grew ${r.grow.length}, ${r.lk.length} pairs, ${r.pm.length} practice matches, ${r.ev.length} events)`);
  }
  const abr = R.abr.A.camp.rep.pm, home = R.oki.A.camp.rep.pm;
  ok(abr.every(m => R.abr.A.clubs[m.cid] && R.abr.A.clubs[m.cid].ab && R.abr.A.clubs[m.cid].ab.cc === 'ESP') && home[0].cid === null && home.slice(1).every(m => !R.oki.A.order.includes(m.cid)), 'practice matches: Spanish clubs abroad; a 大学選抜 and J2 clubs at home');
}
{
  // できごと over many camps: each kind changes what it says, 沖縄 favours positions, 海外 youngsters
  const cnt = {}; let bad = 0;
  for (let s = 0; s < 24; s++) for (const k of ['oki', 'abr', 'hok']) {
    const A = runTo(k, C27.to, 100 + s), r = A.camp.rep; if (!r) continue;
    const mine = r.ev.filter(e => !['inj', 'join'].includes(e.k));
    if (mine.length < CP.d[k].ev[0] - 1 || mine.length > CP.d[k].ev[1]) bad++;
    for (const e of mine) {
      cnt[k + e.k] = (cnt[k + e.k] || 0) + 1;
      const p = A.players[e.pid];
      if (e.k === 'pot' && !(e.b === e.a + 1 || p.pot >= E.potCap(p))) bad++;
      if (e.k === 'pos' && !(e.b === Math.min(E.LEARN_MAX, e.a + 15) && Math.round(E.apt(p, e.dp)) === e.b)) bad++;
      if ((e.k === 'lk' || e.k === 'mentor') && !(e.b - e.a >= (e.k === 'lk' ? 9 : 7))) bad++;
    }
  }
  ok(!bad, `できごと: the counts and what each changes are right (${Object.entries(cnt).map(([k, v]) => k + v).join(' ')})`);
  ok((cnt.okipos || 0) > (cnt.hokpos || 0) && (cnt.abrpot || 0) > (cnt.hokpot || 0), `沖縄 favours positions (${cnt.okipos} / 北海道 ${cnt.hokpos}), 海外 youngsters (${cnt.abrpot} / 北海道 ${cnt.hokpot})`);
}
{
  // injuries: about inj per player over the camp (the AI clubs, the standard camp); 宮崎's rehab and her suggestion
  const B = clone(ask); gen = seed(9); E.campPick(B, 'none');
  const inj0 = {}; for (const p of Object.values(B.players)) inj0[p.id] = p.inj;
  let got = 0, players = 0; const seen = new Set(), hit = new Set();
  for (let g = 0; g < 60 && B.date < C27.to; g++) { playDay(B); if (B.date >= C27.from && B.camp.st) for (const cid of B.order) if (cid !== B.my) for (const p of E.squad(B, cid)) { if (!seen.has(p.id)) { seen.add(p.id); players++; } if (p.inj > 0 && !(inj0[p.id] > 0) && !p.away && !hit.has(p.id)) { hit.add(p.id); got++; } } }
  ok(near(got / players, CP.d[STD].inj, 0.02), `the AI clubs' knocks at the camp: ${got} of ${players} players (${(got / players * 100).toFixed(1)}%, ${CP.d[STD].jp} ${CP.d[STD].inj * 100}%)`);
  const mk = k => { const A = clone(ask); gen = seed(11); const c = A.clubs[A.my]; const p = A.players[c.tac.xi[5]]; p.inj = 60; E.campPick(A, k); playTo(A, D.add(C27.to, 1)); return A.players[p.id].inj; };
  const io = mk(RH), im = mk(STD);
  ok(im - io === CP.len * (CP.d[RH].rehab - 1), `${CP.d[RH].jp}'s rehab: ${io} days left (${CP.d[STD].jp} ${im})`);
  const A = clone(ask); const p = A.players[A.clubs[A.my].tac.xi[5]]; p.inj = D.diff(C27.re, A.date) + 5;
  ok(E.campRec(A).k === RH && E.campRec(A).why === 'rehab', `her suggestion with a regular out until after the opening: ${CP.d[RH].jp}`);
}
{
  // who isn't there: away with his national team until back (then a join), the injured until healed, on loan, a summer
  // signing from the day he comes
  const A = clone(ask); gen = seed(13);
  const c = A.clubs[A.my], sq = E.squad(A, A.my).filter(p => !c.tac.xi.includes(p.id) && !(p.inj > 0));
  const nt = sq[0], hurt = sq[1]; nt.away = { cc: 'JPN', to: D.add(C27.from, 3) }; hurt.inj = D.diff(C27.from, A.date) + 5;
  ok(E.campAbsent(A).some(x => x.pid === nt.id && x.why === 'nt') && E.campAbsent(A).some(x => x.pid === hurt.id && x.why === 'inj' && x.left === 5), `before: ${nt.short} away, ${hurt.short} injured (5 days into the camp)`);
  const yg = E.squad(A, A.my).filter(p => E.age(p, A.date) <= 23 && !c.tac.xi.includes(p.id) && p !== nt && p !== hurt).sort((a, b) => a.ovr - b.ovr)[0];
  const lo = E.loanOptions(A, yg.id), lr = lo.length ? E.loanOut(A, yg.id, lo[0].cid) : null;
  ok(lr && lr.ok && E.campAbsent(A).some(x => x.pid === yg.id && x.why === 'loan'), `on loan: ${yg.short} listed`);
  E.campPick(A, 'hok');
  playTo(A, D.add(C27.from, 3)); delete A.players[nt.id].away;   // back from his national team on the 4th day
  const fa = Object.values(A.players).find(p => p.club === 'FA' && p.ovr > 60);
  if (fa) E.bid(A, fa.id, 2);
  const signed = fa && A.players[fa.id].club === A.my, sd = A.date;
  playTo(A, C27.to);
  const r = A.camp.rep, jn = r.ev.filter(e => e.k === 'join');
  ok(jn.some(e => e.pid === nt.id && e.why === 'nt' && e.d === D.add(C27.from, 4)), `back from the national team: joins on ${D.add(C27.from, 4)}`);
  ok(jn.some(e => e.pid === hurt.id && e.why === 'inj'), `healed: ${hurt.short} joins on ${(jn.find(e => e.pid === hurt.id) || {}).d}`);
  ok(!r.grow.concat(r.none).some(x => x.pid === yg.id), 'the loan player isn\'t in the camp');
  ok(!signed || jn.some(e => e.pid === fa.id && e.why === 'new' && e.d === D.add(sd, 1)), `a summer signing joins the next day${signed ? ` (${fa.short})` : ' (no signing this time)'}`);
}

/* a new job: before the camp the new club chooses again; in the camp the new club has the standard one (no report) */
{
  const A = clone(ask); E.campPick(A, 'abr'); const to = A.order.find(c => c !== A.my); E.takeJob(A, to);
  ok(A.camp.dest === null && !A.camp.asked, 'a new job before the camp: chosen again');
  playTo(A, D.add(A.date, 2), null, X => { if (E.campPending(X)) E.campPick(X, 'miya'); E.secSeen(X); });
  ok(A.camp.dest === 'miya', 'and she asks again (宮崎 picked)');
  const B = clone(ask); E.campPick(B, 'oki'); playTo(B, D.add(C27.from, 3)); const old = B.my, nw = B.order.find(c => c !== B.my);
  E.takeJob(B, nw); const st = playTo(B, D.add(C27.to, 1));
  ok(!st.some(x => x[1] === 'camp') && !B.camp.rep && B.clubs[old].fin.camp === CP.d.oki.cost && B.clubs[nw].fin.camp === CP.d[STD].cost, 'a new job in the camp: no report, both clubs paid theirs');
}

/* the season after: planned again from its fixtures */
{
  const A = clone(R.oki.A); gen = seed(21);
  playTo(A, '2028-06-15');
  const C = E.campOf(A);
  ok(A.season === 2028 && C.s === 2028 && !C.skip && !C.dest && !C.st && C.from > '2028-07-01', `2028/29: a new camp ${C.from}〜${C.to} (asked ${C.ask})`);
  ok(A.order.every(id => A.clubs[id].fin.camp === 0), 'the new season\'s accounts start at 0');
}

/* old saves: b9f4f3a (v16) and be3e2da, in 2026/27 (none that season) and the next season as usual */
for (const sha of ['b9f4f3a', 'be3e2da']) {
  const tmp = path.join(os.tmpdir(), `engine_${sha}_camp_${process.pid}.js`);
  fs.writeFileSync(tmp, execSync(`git show ${sha}:dev/src/engine.js`, { cwd: path.join(__dirname, '..', '..') }));
  const old = require(tmp);
  gen = seed(31);
  const O = old.newGame(DATA, 'urawa', '旧', '2026-10-14');
  playTo(O, '2027-01-10', old);
  const A = E.migrate(clone(O), DATA);
  ok(A.v >= 17 && A.camp && A.camp.skip && A.camp.s === 2026 && A.clubs[A.my].fin.camp === 0, `${sha} (${O.date}): migrated, no camp in 2026/27`);
  const twice = E.migrate(clone(A), DATA); ok(JSON.stringify(twice.camp) === JSON.stringify(A.camp), `${sha}: migrating again changes nothing`);
  const st = playTo(A, '2027-08-01', null, X => { if (E.campPending(X)) E.campPick(X, 'miya'); E.secSeen(X); });
  ok(st.some(x => x[1] === 'camp') && A.camp.rep && A.camp.rep.k === 'miya' && A.camp.s === 2027, `${sha}: the next summer's camp and its report (${A.camp.rep && A.camp.rep.n} players)`);
  fs.unlinkSync(tmp);
}

console.log('FAILS', fails); process.exit(fails ? 1 : 0);
