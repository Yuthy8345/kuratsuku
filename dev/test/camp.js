// キャンプ (2026-10-16, 作業7): when (1/4 she asks and the days stop; 10 days ending 11 days before the first league match
// after New Year, inside the break every season; not chosen → 宮崎 on the first day), what it costs (mine and the AI
// clubs'), what it does (growth = wk weeks of devWeek at once, 連携 = pm practice matches for the XI, 調子, minor injuries,
// 沖縄's rehab, my できごと, the report and its stop), who isn't there (the アジアカップ until he is back, the injured,
// on loan, a winter signing from the day he comes), the AI clubs (the standard camp), a new job, the next season,
// old saves (v16 = b9f4f3a, be3e2da: before the camp → asked; in or after it → none this season).
// usage: node dev/test/camp.js
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
const CP = E.CAMP;
const playDay = (S, X, onSec) => {
  X = X || E;
  const st = X.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); X.autoLineup(S, S.my, X.compOf ? { comp: X.compOf(f) } : undefined); const M = X.createMatch(S, f); X.simulateFull(S, M); X.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') X.rejectOffer(S, y.id); });
  else if (st.stop === 'fired') X.takeJob(S, S.fired.offers[0]);
  else if (st.stop === 'sec' && onSec) onSec(S);
  else if (st.stop === 'camp') X.campSeen(S);
  else if (st.stop && st.stop !== 'seasonEnd') { if (S.sec && X.secSeen) X.secSeen(S); S.cele = []; if (S.spon && X.sponPending && X.sponPending(S)) X.sponAuto(S); }
  return st;
};
const playTo = (S, until, X, onSec) => { const stops = []; for (let g = 0; g < 9000 && S.date < until && !S.seasonEnd; g++) { const st = playDay(S, X, onSec); if (st.stop) stops.push([S.date, st.stop]); } return stops; };
const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

/* the dates: 2026/27 and the next seasons, inside the break */
gen = seed(1);
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-16'); E.sponAuto(S);
{
  const C = E.campOf(S);
  ok(C.ask === '2027-01-04' && C.from === '2027-01-24' && C.to === '2027-02-02' && C.re === '2027-02-13', `2026/27: asked 1/4, the camp ${C.from}〜${C.to}, the restart ${C.re}`);
  ok(E.D.diff(C.to, C.from) + 1 === CP.len && E.D.diff(C.re, C.to) === CP.gap, `${CP.len} days, ${CP.gap} days before the restart`);
  for (const sy of [2027, 2028, 2029, 2030, 2031]) {
    const T = { season: sy, fixtures: E.seasonDates(sy).map((d, i) => ({ date: d, r: i + 1 })) };
    const P = E.campPlan(T), lg = T.fixtures.map(f => f.date);
    const inBreak = !lg.some(d => d >= P.from && d <= P.to) && lg.filter(d => d < P.from).pop() < `${sy}-12-31`;
    ok(!P.skip && inBreak && P.from > `${sy + 1}-01-14` && P.to < `${sy + 1}-02-10`, `${E.seasonLabel(sy)}: ${P.from}〜${P.to}, restart ${P.re}, inside the winter break`);
  }
}

/* 1/4: she asks and the days stop; not chosen → 宮崎 on the first day */
const jan3 = (() => { playTo(S, '2027-01-03'); if (S.sec) E.secSeen(S); return clone(S); })();
{
  const A = clone(jan3);
  ok(!E.campPending(A) && !E.secNotes(A).some(n => n.k === 'camp'), '1/3: nothing yet');
  const st = playDay(A);
  ok(A.date === '2027-01-04' && st.stop === 'sec' && E.campPending(A) && E.secNotes(A).some(n => n.k === 'camp'), '1/4: her question, the days stop');
  const m0 = A.clubs[A.my].funds, ai = A.order.find(c => c !== A.my), a0 = A.clubs[ai].funds;
  const stops = playTo(A, '2027-01-24');
  ok(A.camp.dest === 'miya' && A.camp.auto && A.camp.st === 'run' && !stops.some(x => x[1] === 'sec'), `not chosen: 宮崎 on ${A.date} (asked once)`);
  ok(A.clubs[A.my].fin.camp === CP.d.miya.cost && A.clubs[ai].fin.camp === CP.d.miya.cost, `the cost on the first day: mine ${A.clubs[A.my].fin.camp}万, the AI clubs ${A.clubs[ai].fin.camp}万`);
  ok(A.news.some(n => /宮崎キャンプがスタート/.test(n.text) && /標準の宮崎/.test(n.text)), 'news: the camp starts (宮崎 because nothing was chosen)');
  const st2 = playTo(A, '2027-02-02');
  ok(st2.some(x => x[0] === '2027-02-02' && x[1] === 'camp') && A.camp.st === 'done' && A.camp.rep && A.camp.rep.auto, 'the last day: the report stops the days (auto)');
  ok(m0 - A.clubs[A.my].funds >= CP.d.miya.cost && a0 - A.clubs[ai].funds >= CP.d.miya.cost - 1000, 'the funds went down by the cost');
}

/* picking: the five, the money, changing it, not after it started */
{
  const A = clone(jan3); playDay(A);
  for (const k of CP.keys) { const r = E.campPick(A, k); ok(r.ok && A.camp.dest === k, `pick ${CP.d[k].jp}: ${r.msg}`); }
  ok(!E.secNotes(A).some(n => n.k === 'camp'), 'picked: her question is gone');
  const B = clone(A); B.clubs[B.my].funds = 5000; ok(!E.campPick(B, 'abr').ok && E.campPick(B, 'miya').ok, 'not enough money for 海外 (1.8億); 宮崎 is fine');
  E.campPick(A, 'kago'); playTo(A, '2027-01-25');
  ok(!E.campPick(A, 'miya').ok && A.camp.dest === 'kago', 'once it started it can\'t be changed');
}

/* what it does: the same state, the same numbers, each destination */
const pre = (() => { const A = clone(jan3); playDay(A); return A; })();
const runTo = (k, until, sd) => { const A = clone(pre); gen = seed(sd || 7); if (k) E.campPick(A, k); playTo(A, until); return A; };
const R = {};
for (const k of CP.keys) {
  // up to the day before the last, then the last day alone (campEnd)
  const A = runTo(k, '2027-02-01');
  const C = A.camp, c = A.clubs[A.my];
  const before = {}; for (const p of E.squad(A, A.my).concat(E.squad(A, A.order.find(x => x !== A.my)))) before[p.id] = { ovr: p.ovr, form: p.form, dry: p.at ? E.devWeek(A, p, true) : null, d: C.dd ? C.dd[p.id] || 0 : 0, inj: p.inj };
  const xi = c.tac.xi.slice(), lk0 = clone(c.lk || {}), L0 = E.linkEval(A, A.my, c.tac.form, xi);
  const ai = A.order.find(x => x !== A.my), ac = A.clubs[ai], axi = ac.tac.xi.slice(), alk0 = clone(ac.lk || {});
  E.nextDay(A);
  const st = E.advance(A, 1);   // the stop is given on the next call
  R[k] = { A, before, xi, lk0, L0, ai, axi, alk0, st };
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
  ok(g('abr') > g('miya') * 1.7 && g('none') === 0, `海外 grows about twice 宮崎 (${g('abr').toFixed(2)} / ${g('miya').toFixed(2)}), 行かない nothing`);
  const ai = chk('none', R.none.ai, CP.d.miya.wk); ok(ai.n > 5 && !ai.bad, `the AI club (${R.none.ai}) had the standard camp even when I stayed home: ${ai.n} grew 3 weeks' worth`);
}
{
  // 連携: the XI's neighbours get pm practice matches (the curve of linkMatch); できごと pairs aside
  for (const k of ['miya', 'kago', 'abr']) {
    const { A, before, xi, lk0 } = R[k], c = A.clubs[A.my], ev = new Set((A.camp.rep.ev || []).filter(e => e.q).map(e => key(e.pid, e.q)));
    let n = 0, bad = 0;
    for (const [i, j] of E.linkAdj(c.tac.form)) {
      const a = xi[i], b = xi[j], kk = key(a, b); if (ev.has(kk) || before[a].d !== CP.len - 1 || before[b].d !== CP.len - 1 || A.players[a].inj > 0 || A.players[b].inj > 0) continue;
      let v = lk0[kk] ? lk0[kk][0] : 0; for (let m = 0; m < CP.d[k].pm; m++) v = Math.min(100, v + E.LINK.adj * Math.max(E.LINK.floor, 1 - v / E.LINK.top));
      n++; if (!near(c.lk[kk][0], v, 0.25)) bad++;
    }
    ok(n > 8 && !bad, `${CP.d[k].jp}: ${n} neighbouring pairs got ${CP.d[k].pm} practice matches${bad ? ` (${bad} off)` : ''}`);
  }
  const { A, axi, alk0, ai } = R.miya, ac = A.clubs[ai];
  const up = E.linkAdj(ac.tac.form).filter(([i, j]) => { const kk = key(axi[i], axi[j]); return ac.lk[kk] && ac.lk[kk][0] > (alk0[kk] ? alk0[kk][0] : 0); }).length;
  ok(up > 10, `the AI club's neighbours too (${up} pairs up)`);
  const rk = R.kago.A.camp.rep, rm = R.miya.A.camp.rep;
  ok(rk.avg1 - rk.avg0 > rm.avg1 - rm.avg0, `鹿児島 builds more 連携 than 宮崎 (+${(rk.avg1 - rk.avg0).toFixed(1)} / +${(rm.avg1 - rm.avg0).toFixed(1)})`);
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
  // the report, its stop, the news
  for (const k of CP.keys) {
    const { A, st } = R[k], r = A.camp.rep;
    ok(k === 'none' ? (!A.camp.show && st.stop !== 'camp') : (st.stop === 'camp' && r && r.k === k && r.grow.length === 5 && r.lk.length === E.linkAdj(r.form).length && r.pm.length === CP.d[k].pm),
      k === 'none' ? '行かない: no report, no stop' : `${CP.d[k].jp}: the report stops the days (grew ${r.grow.length}, ${r.lk.length} pairs, ${r.pm.length} practice matches, ${r.ev.length} events)`);
  }
  const abr = R.abr.A.camp.rep.pm, home = R.kago.A.camp.rep.pm;
  ok(abr.every(m => R.abr.A.clubs[m.cid] && R.abr.A.clubs[m.cid].ab && R.abr.A.clubs[m.cid].ab.cc === 'ESP') && home[0].cid === null && home.slice(1).every(m => !R.kago.A.order.includes(m.cid)), 'practice matches: Spanish clubs abroad; a 大学選抜 and J2 clubs at home');
}
{
  // できごと over many camps: each kind changes what it says, 鹿児島 favours positions, 海外 youngsters
  const cnt = {}, pot = {}; let bad = 0;
  for (let s = 0; s < 24; s++) for (const k of ['kago', 'abr', 'miya']) {
    const A = runTo(k, '2027-02-02', 100 + s), r = A.camp.rep; if (!r) continue;
    const mine = r.ev.filter(e => !['inj', 'join'].includes(e.k));
    if (mine.length < CP.d[k].ev[0] - 1 || mine.length > CP.d[k].ev[1]) bad++;
    for (const e of mine) {
      cnt[k + e.k] = (cnt[k + e.k] || 0) + 1;
      const p = A.players[e.pid];
      if (e.k === 'pot' && !(e.b === e.a + 1 || p.pot >= E.potCap(p))) bad++;
      if (e.k === 'pos' && !(e.b === Math.min(E.LEARN_MAX, e.a + 15) && Math.round(E.apt(p, e.dp)) === e.b)) bad++;
      if ((e.k === 'lk' || e.k === 'mentor') && !(e.b - e.a >= (e.k === 'lk' ? 9 : 7))) bad++;
      if (e.k === 'pot') pot[k] = (pot[k] || 0) + 1;
    }
  }
  ok(!bad, `できごと: the counts and what each changes are right (${Object.entries(cnt).map(([k, v]) => k + v).join(' ')})`);
  ok((cnt.kagopos || 0) > (cnt.miyapos || 0) && (cnt.abrpot || 0) > (cnt.miyapot || 0), `鹿児島 favours positions (${cnt.kagopos} / 宮崎 ${cnt.miyapos}), 海外 youngsters (${cnt.abrpot} / 宮崎 ${cnt.miyapot})`);
}
{
  // injuries: about inj per player over the camp (the AI clubs, 宮崎's 3%); 沖縄's rehab
  const B = clone(pre); gen = seed(9); E.campPick(B, 'none');
  const inj0 = {}; for (const p of Object.values(B.players)) inj0[p.id] = p.inj;
  let got = 0, players = 0; const seen = new Set();
  const hit = new Set();
  for (let g = 0; g < 60 && B.date < '2027-02-02'; g++) { playDay(B); if (B.date >= '2027-01-24' && B.camp.st) for (const cid of B.order) if (cid !== B.my) for (const p of E.squad(B, cid)) { if (!seen.has(p.id)) { seen.add(p.id); players++; } if (p.inj > 0 && !(inj0[p.id] > 0) && !p.away && !hit.has(p.id)) { hit.add(p.id); got++; } } }
  ok(near(got / players, CP.d.miya.inj, 0.03), `the AI clubs' knocks at the camp: ${got} of ${players} players (${(got / players * 100).toFixed(1)}%, 宮崎 ${CP.d.miya.inj * 100}%)`);
  // 沖縄: an injured player comes along and heals twice as fast; elsewhere one day a day
  const mk = k => { const A = clone(pre); gen = seed(11); const c = A.clubs[A.my]; const p = A.players[c.tac.xi[5]]; p.inj = 60; E.campPick(A, k); playTo(A, '2027-02-03'); return A.players[p.id].inj; };
  const io = mk('oki'), im = mk('miya');
  ok(im - io === CP.len * (CP.d.oki.rehab - 1), `沖縄's rehab: ${io} days left (宮崎 ${im})`);
}
{
  // who isn't there: the アジアカップ until back (then a join), on loan, a winter signing from the day he comes
  const A = clone(pre); gen = seed(13);
  const c = A.clubs[A.my], away = E.squad(A, A.my).filter(p => p.away);
  ok(away.length > 0 && E.campAbsent(A).filter(x => x.why === 'nt').length === away.length, `1/4: ${away.map(p => p.short + '(' + p.away.cc + ' 〜' + p.away.to + ')').join(' ')} listed as away`);
  const yg = E.squad(A, A.my).filter(p => E.age(p, A.date) <= 23 && !p.away && !c.tac.xi.includes(p.id)).sort((a, b) => a.ovr - b.ovr)[0];
  const lo = E.loanOptions(A, yg.id), lr = lo.length ? E.loanOut(A, yg.id, lo[0].cid) : null;
  ok(lr && lr.ok && (yg.loan && E.campAbsent(A).some(x => x.pid === yg.id && x.why === 'loan')), `on loan: ${yg.short} listed (${lr ? 'loaned' : 'loan not possible'})`);
  E.campPick(A, 'miya');
  playTo(A, '2027-01-27');
  const fa = Object.values(A.players).find(p => p.club === 'FA' && p.ovr > 60);
  if (fa) { E.bid(A, fa.id, 2); }
  const signed = fa && fa.club === A.my;
  playTo(A, '2027-02-02');
  const r = A.camp.rep, jn = r.ev.filter(e => e.k === 'join');
  ok(away.every(p => { const e = jn.find(x => x.pid === p.id); return e ? e.why === 'nt' && e.d > '2027-01-24' : (r.none.some(x => x.pid === p.id)); }), `the アジアカップ players join the day they're back: ${jn.filter(e => e.why === 'nt').map(e => A.players[e.pid].short + ' ' + e.d).join(', ') || 'none back in time'}`);
  ok(!yg.loan || !r.grow.concat(r.none).some(x => x.pid === yg.id), 'the loan player isn\'t in the camp');
  ok(!signed || jn.some(e => e.pid === fa.id && e.why === 'new' && e.d === '2027-01-28'), `a winter signing joins the next day${signed ? ` (${fa.short})` : ' (no signing this time)'}`);
}

/* a new job: before the camp the new club chooses again; in the camp the new club has the standard one (no report) */
{
  const A = clone(pre); E.campPick(A, 'abr'); const to = A.order.find(c => c !== A.my); E.takeJob(A, to);
  ok(A.camp.dest === null && !A.camp.asked, 'a new job before the camp: chosen again');
  playTo(A, '2027-01-06', null, X => { if (E.campPending(X)) E.campPick(X, 'oki'); E.secSeen(X); });
  ok(A.camp.dest === 'oki', 'and she asks again (沖縄 picked)');
  const B = clone(pre); E.campPick(B, 'kago'); playTo(B, '2027-01-27'); const old = B.my, nw = B.order.find(c => c !== B.my);
  E.takeJob(B, nw); const st = playTo(B, '2027-02-03');
  ok(!st.some(x => x[1] === 'camp') && !B.camp.rep && B.clubs[old].fin.camp === CP.d.kago.cost && B.clubs[nw].fin.camp === CP.d.miya.cost, 'a new job in the camp: no report, both clubs paid theirs');
}

/* the next season: planned again from its fixtures */
{
  const A = clone(R.kago.A); gen = seed(21);
  playTo(A, '2027-07-01'); if (A.seasonEnd) E.rollover(A);
  playTo(A, '2027-12-31');
  const C = E.campOf(A);
  ok(A.season === 2027 && C.s === 2027 && C.ask === '2028-01-04' && !C.dest && !C.st, `2027/28: a new camp ${C.from}〜${C.to}`);
  ok(Object.values(A.clubs).every(c => !c.fin || c.fin.camp === 0 || !A.order.includes(c.id)), 'the new season\'s accounts start at 0');
}

/* old saves: b9f4f3a (v16) and be3e2da, before the camp (asked the next day) and in it (none this season) */
for (const sha of ['b9f4f3a', 'be3e2da']) {
  const tmp = path.join(os.tmpdir(), `engine_${sha}_camp_${process.pid}.js`);
  fs.writeFileSync(tmp, execSync(`git show ${sha}:dev/src/engine.js`, { cwd: path.join(__dirname, '..', '..') }));
  const old = require(tmp);
  gen = seed(31);
  const O = old.newGame(DATA, 'urawa', '旧', '2026-10-14');
  playTo(O, '2027-01-10', old);
  const A = E.migrate(clone(O), DATA);
  ok(A.v >= 17 && A.camp && !A.camp.skip && A.camp.from === '2027-01-24' && A.clubs[A.my].fin.camp === 0, `${sha} (${O.date}): migrated, the camp still ahead`);
  const s1 = playDay(A);
  ok(s1.stop === 'sec' && E.campPending(A) && A.date === '2027-01-11', `${sha}: asked the next day (${A.date})`);
  const twice = E.migrate(clone(A), DATA); ok(JSON.stringify(twice.camp) === JSON.stringify(A.camp), `${sha}: migrating again changes nothing`);
  E.campPick(A, 'oki'); const st = playTo(A, '2027-02-14');
  ok(st.some(x => x[1] === 'camp') && A.camp.rep && A.camp.rep.k === 'oki', `${sha}: the camp and its report (${A.camp.rep && A.camp.rep.n} players)`);
  playTo(O, '2027-01-27', old);
  const B = E.migrate(clone(O), DATA);
  ok(B.camp && B.camp.skip, `${sha} (${O.date}, in the camp): none this season`);
  const st2 = playTo(B, '2027-02-14');
  ok(!st2.some(x => x[1] === 'camp') && !B.camp.rep && Object.values(B.clubs).every(c => !c.fin || !c.fin.camp), `${sha}: no costs, no report; the season goes on (${B.date})`);
  fs.unlinkSync(tmp);
}

console.log('FAILS', fails); process.exit(fails ? 1 : 0);
