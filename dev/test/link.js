// 連携とコンボ (2026-10-15, 作業6): neighbours on the board, how 連携 grows (minutes together, faster next to each other,
// slower the higher it is, a sub or a red card counts his minutes only), how it falls (a club match apart, gone when he
// leaves; a loan keeps it), the XI's average and what it adds, the nine combos (each one forced, up to three count, the
// strongest first), the match (the numbers, the kick-off line, the first time one of mine holds), every club the same,
// birthplaces (地元の星), old saves (v15, be3e2da: 連携 from this season's minutes), a season's numbers.
// usage: node dev/test/link.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const near = (a, b, e) => Math.abs(a - b) <= e;
const L = E.LINK;
const playDay = (S, X) => {
  X = X || E;
  const st = X.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); X.autoLineup(S, S.my, X.compOf ? { comp: X.compOf(f) } : undefined); const M = X.createMatch(S, f); X.simulateFull(S, M); X.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') X.rejectOffer(S, y.id); });
  else if (st.stop === 'fired') X.takeJob(S, S.fired.offers[0]);
  else if (st.stop && st.stop !== 'seasonEnd') { if (S.sec && X.secSeen) X.secSeen(S); S.cele = []; if (S.spon && X.sponPending && X.sponPending(S)) X.sponAuto(S); }
  return st;
};
const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

/* the board's neighbours */
{
  let all = true, sym = true; const bad = [];
  for (const f of Object.keys(E.FORMATIONS)) {
    const A = E.linkAdj(f), deg = Array(11).fill(0);
    for (const [i, j] of A) { deg[i]++; deg[j]++; if (i >= j) sym = false; }
    if (deg.some(d => d < 2)) { all = false; bad.push(f); }
    if (A.length < 18 || A.length > 26) { all = false; bad.push(f + ':' + A.length); }
  }
  ok(all && sym, `every formation: 18〜26 neighbouring pairs, every slot has at least two ${bad.join(' ')}`);
  const A = E.linkAdj('4-4-2'), has = (i, j) => A.some(e => e[0] === i && e[1] === j);
  ok(has(0, 2) && has(0, 3) && has(2, 3) && has(1, 5) && has(9, 10) && !has(1, 4) && !has(0, 9), '4-4-2: GK–CB, CB–CB, LB–LM, ST–SS are neighbours; LB–RB and GK–ST are not');
  const A5 = E.linkAdj('5-4-1'); ok(A5.filter(e => e[0] === 10 || e[1] === 10).length >= 2, '5-4-1: the lone striker has neighbours too');
}

/* growth: a match made by hand (linkMatch reads M.h / M.a, M.pm and M.min) */
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-15');
const c = S.clubs[S.my];
ok(S.v >= 16 && Object.values(S.clubs).every(x => !x.lk || !Object.keys(x.lk).length), 'new game: S.v 16, no 連携 anywhere (everyone starts at 0, the user\'s choice)');
const xi = c.tac.xi.slice(), F = E.FORMATIONS[c.tac.form], A = E.linkAdj(c.tac.form);
const nb = A[0], far = (() => { for (let i = 1; i < 11; i++) for (let j = i + 1; j < 11; j++) if (!A.some(e => e[0] === i && e[1] === j)) return [i, j]; })();
const opp = S.order.find(x => x !== S.my), oc = S.clubs[opp];
function fakeMatch(over) {
  const M = { h: { cid: S.my, form: c.tac.form }, a: { cid: opp, form: oc.tac.form }, pm: {}, min: 93 };
  xi.forEach((id, si) => { M.pm[id] = { side: 'h', on: 0, off: null, si }; });
  oc.tac.xi.forEach((id, si) => { if (id) M.pm[id] = { side: 'a', on: 0, off: null, si }; });
  if (over) over(M);
  return M;
}
E.linkMatch(S, fakeMatch());
const v = (a, b) => (c.lk[key(a, b)] || [0, 0]);
ok(v(xi[nb[0]], xi[nb[1]])[0] === L.adj && v(xi[nb[0]], xi[nb[1]])[1] === 90, `90 minutes next to each other: ${v(xi[nb[0]], xi[nb[1]]).join(' / ')} (${L.adj}, 90分)`);
ok(v(xi[far[0]], xi[far[1]])[0] === L.far, `90 minutes apart on the board: ${v(xi[far[0]], xi[far[1]])[0]} (${L.far})`);
ok(Object.keys(c.lk).length === 55 && Object.keys(oc.lk).length === 55, 'every pair of both XIs (55 each)');
// a sub on at 60 (his slot's neighbour gets 30 minutes), a red card at 30
const bench = c.tac.bench.find(id => S.players[id]), out = xi[nb[1]];
E.linkMatch(S, fakeMatch(M => { M.pm[out].off = 60; M.pm[bench] = { side: 'h', on: 60, off: null, si: nb[1] }; M.pm[xi[far[1]]].so = 30; }));
ok(near(v(xi[nb[0]], bench)[0], L.adj * 30 / 90, 0.05) && v(xi[nb[0]], bench)[1] === 30, `a sub on at 60: ${v(xi[nb[0]], bench).join(' / ')} (30分 of ${L.adj})`);
const r0 = L.far, r1 = r0 + 30 / 90 * L.far * (1 - r0 / L.top);
ok(near(v(xi[far[0]], xi[far[1]])[0], r1, 0.06), `sent off at 30: ${v(xi[far[0]], xi[far[1]])[0]} (≈${r1.toFixed(2)}, slower as it rises)`);
// the curve: every match side by side from 0
{
  const T = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-15'), tc = T.clubs[T.my], tx = tc.tac.xi.slice(), ta = E.linkAdj(tc.tac.form)[0];
  const seen = {};
  for (let n = 1; n <= 40; n++) {
    const M = { h: { cid: T.my, form: tc.tac.form }, a: { cid: 'FA', form: '4-4-2' }, pm: {}, min: 90 };
    tx.forEach((id, si) => { M.pm[id] = { side: 'h', on: 0, off: null, si }; });
    E.linkMatch(T, M);
    if ([10, 20, 30, 40].includes(n)) seen[n] = tc.lk[key(tx[ta[0]], tx[ta[1]])][0];
  }
  ok(near(seen[10], 40, 2) && near(seen[20], 66, 2) && near(seen[30], 82, 2) && seen[40] >= 88 && seen[40] <= 100, `side by side every match: 10試合 ${seen[10]}・20試合 ${seen[20]}・30試合 ${seen[30]}・40試合 ${seen[40]}`);
  // apart: a match of the club without them
  const k0 = key(tx[ta[0]], tx[ta[1]]), v0 = tc.lk[k0][0];
  const M = { h: { cid: T.my, form: tc.tac.form }, a: { cid: 'FA', form: '4-4-2' }, pm: {}, min: 90 };
  tx.forEach((id, si) => { if (si !== ta[0]) M.pm[id] = { side: 'h', on: 0, off: null, si }; });
  E.linkMatch(T, M);
  ok(near(tc.lk[k0][0], v0 - L.decay, 0.01), `a match apart: ${v0} → ${tc.lk[k0][0]} (−${L.decay})`);
  tc.lk[k0][0] = 1.1; E.linkMatch(T, M); ok(!tc.lk[k0], 'down to nothing: the pair goes');
  // he leaves: his pairs go; a loan keeps them
  const p = T.players[tx[ta[1]]], q = T.players[tx.find((id, i) => i !== ta[0] && i !== ta[1])];
  const nP = Object.keys(tc.lk).filter(k => k.split('-').includes(String(p.id))).length;
  E.moveP(T, p, opp, 0);
  ok(nP > 0 && !Object.keys(tc.lk).some(k => k.split('-').includes(String(p.id))), `transferred: his ${nP} pairs at the club go`);
  q.loan = { from: T.my, to: 'sapporo' }; q.club = 'sapporo';
  E.linkSweep(T);
  ok(Object.keys(tc.lk).some(k => k.split('-').includes(String(q.id))), 'out on loan: his pairs stay (they fall a little each match)');
  q.club = 'RET'; delete q.loan; E.linkSweep(T);
  ok(!Object.keys(tc.lk).some(k => k.split('-').includes(String(q.id))), 'retired: the season-end sweep takes his pairs');
}

/* the XI: average, bonus, combos */
{
  const T = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-15'), tc = T.clubs[T.my];
  tc.tac.form = '4-2-3-1'; E.autoLineup(T, T.my);
  const x = tc.tac.xi, f = E.FORMATIONS['4-2-3-1'], A2 = E.linkAdj('4-2-3-1');
  tc.lk = {}; for (const [i, j] of A2) tc.lk[key(x[i], x[j])] = [60, 900];
  let R = E.linkEval(T, T.my, '4-2-3-1', x);
  ok(near(R.avg, 60, 1e-9) && near(R.bonus, 0.6 * L.max, 1e-9) && R.n === A2.length && R.combos.length === 0, `every neighbour at 60: average 60, +${R.bonus.toFixed(2)} to attack, midfield and defence, no combo`);
  const base = E.clubRating(T, T.my); tc.lk = {}; const zero = E.clubRating(T, T.my);
  ok(near(base.att - zero.att, 0.6, 1e-6) && near(base.def - zero.def, 0.6, 1e-6), `the tactics screen's numbers include it (+${(base.att - zero.att).toFixed(2)})`);
  const set = (i, j, val) => { tc.lk[key(x[i], x[j])] = [val, 900]; };
  const slot = r => f.findIndex(s => s[0] === r), slots = r => f.map((s, i) => i).filter(i => f[i][0] === r);
  const ev = () => E.linkEval(T, T.my, '4-2-3-1', x, { near: true });
  const has = (Rr, k) => Rr.combos.some(it => it.k === k);
  // ホットライン: ST with the AM next to him
  tc.lk = {}; set(slot('AM'), slot('ST'), 79); ok(!has(ev(), 'hot') && ev().near.some(it => it.k === 'hot' && it.val === 79), 'ホットライン at 79: not yet (in 「あと少し」)');
  set(slot('AM'), slot('ST'), 80); R = ev(); const hot = R.combos.find(it => it.k === 'hot');
  ok(hot && hot.who[0] === x[slot('AM')] && hot.who[1] === x[slot('ST')] && hot.att === 0.5 && near(R.att - R.bonus, 0.5, 1e-9), `ホットライン at 80: ${E.comboText(T, hot)}, attack +0.5`);
  // 鉄壁: GK and both CBs average 75
  tc.lk = {}; const g = slot('GK'), [b1, b2] = slots('CB'); set(g, b1, 90); set(g, b2, 80); set(b1, b2, 55);
  R = ev(); ok(has(R, 'wall') && near(R.def - R.bonus, 0.5, 1e-9), `鉄壁: (90 + 80 + 55) / 3 = 75 → defence +0.5`);
  set(b1, b2, 54); ok(!has(ev(), 'wall'), '鉄壁: 74.7 is not');
  // 中盤の心臓: the two DMs
  tc.lk = {}; const [d1, d2] = slots('DM'); set(d1, d2, 80); R = ev(); ok(has(R, 'heart') && near(R.mid - R.bonus, 0.4, 1e-9), '中盤の心臓: the two DMs at 80 → midfield +0.4');
  // 両翼: LB–LAM and RB–RAM both at 75
  tc.lk = {}; set(slot('LB'), slot('LAM'), 75); ok(!has(ev(), 'wings'), '両翼: one side is not enough');
  set(slot('RB'), slot('RAM'), 75); R = ev(); ok(has(R, 'wings') && R.combos.find(it => it.k === 'wings').lines.length === 2, '両翼: both sides at 75 → attack +0.4, two lines');
  // 師弟: 32+ and 21- next to each other at 70
  tc.lk = {}; const old = T.players[x[slot('LB')]], kid = T.players[x[slot('LAM')]]; const ob = old.birth, kb = kid.birth;
  old.birth = '1990-01-01'; kid.birth = '2007-01-01'; set(slot('LB'), slot('LAM'), 70); R = ev();
  ok(has(R, 'mentor') && R.combos.find(it => it.k === 'mentor').who[0] === old.id, `師弟: ${E.comboText(T, R.combos.find(it => it.k === 'mentor'))}`);
  old.birth = ob; kid.birth = kb;
  // 生え抜きの誇り / 地元の星 / コネクション / 伝説の再来: who starts
  tc.lk = {};
  const keep = x.map(id => { const p = T.players[id]; return { id, yo: p.yo, bp: p.bp, nat: p.nat, reborn: p.reborn, num: p.num }; });
  const ps = x.map(id => T.players[id]).filter(p => p.pos !== 'GK');
  ps.forEach(p => { delete p.yo; p.bp = '北海道'; });
  ps.slice(0, 2).forEach(p => { p.yo = T.my; });
  ok(!has(ev(), 'yo'), 'ユース出身が2人: not yet');
  ps[2].yo = T.my; R = ev(); ok(has(R, 'yo') && near(R.att - R.bonus, 0.3, 1e-9) && near(R.def - R.bonus, 0.3, 1e-9), '生え抜きの誇り: 3 academy players → +0.3 to all three');
  ps.forEach(p => { delete p.yo; });
  ps.slice(3, 6).forEach(p => { p.bp = tc.area; }); R = ev(); const loc = R.combos.find(it => it.k === 'local');
  ok(loc && loc.who.length === 3 && loc.cond.startsWith(tc.area), `地元の星: three born in ${tc.area} (${loc && loc.cond})`);
  ps.forEach(p => { p.bp = '北海道'; });
  ps.forEach(p => { p.nat = 'JPN'; }); ps[6].nat = 'BRA'; ps[7].nat = 'BRA'; R = ev(); const con = R.combos.find(it => it.k === 'nat');
  ok(con && con.jp === 'ブラジル・コネクション' && con.att === 0.3, `${con && con.jp}: two Brazilians → attack +0.3`);
  ps[7].nat = 'KOR'; ok(!has(ev(), 'nat'), 'two different countries: no');
  const leg = E.LEGENDS.yokohamafm.find(l => l.num != null);
  ps[8].reborn = leg.id; ps[8].num = leg.num + 50; R = ev(); ok(!has(R, 'legend') && R.near.some(it => it.k === 'legend' && it.cond.includes(`背番号${leg.num}`)), `伝説の再来: 転生 but not wearing ${leg.num} → 「あと少し」`);
  ps[8].num = leg.num; R = ev(); ok(has(R, 'legend') && near(R.mid - R.bonus, 0.4, 1e-9), `伝説の再来: ${E.comboText(T, R.combos.find(it => it.k === 'legend'))} → +0.4 to all three`);
  // up to three count, the strongest first
  ps.slice(0, 3).forEach(p => { p.yo = T.my; }); ps.slice(3, 6).forEach(p => { p.bp = tc.area; }); ps[7].nat = 'BRA';
  set(slot('AM'), slot('ST'), 85); set(d1, d2, 85);
  R = ev();
  ok(R.combos.length === 3 && R.combos.map(it => it.k).join() === 'legend,yo,local' && R.over.length === 3 && near(R.att - R.bonus, 1.0, 1e-9), `six hold: ${R.combos.map(it => it.jp).join('・')} count, ${R.over.map(it => it.jp).join('・')} don't (attack +${(R.att - R.bonus).toFixed(1)})`);
  keep.forEach(k => { const p = T.players[k.id]; ['yo', 'bp', 'nat', 'reborn', 'num'].forEach(f2 => { if (k[f2] === undefined) delete p[f2]; else p[f2] = k[f2]; }); });
  // a player who's out (an empty slot) breaks his lines
  tc.lk = {}; for (const [i, j] of A2) tc.lk[key(x[i], x[j])] = [80, 900];
  const pids = x.slice(); pids[slot('AM')] = null; R = E.linkEval(T, T.my, '4-2-3-1', pids);
  ok(R.n === A2.length - A2.filter(([i, j]) => i === slot('AM') || j === slot('AM')).length && R.avg === 80, `an empty slot: its ${A2.length - R.n} pairs don't count (average of the rest)`);
}

/* a match: the numbers, the kick-off line, the first time */
{
  const T = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-15'), tc = T.clubs[T.my];
  let st; for (let g = 0; g < 30; g++) { st = E.advance(T, 1); if (st.stop === 'match') break; if (st.stop) { if (T.sec) E.secSeen(T); if (E.sponPending(T)) E.sponAuto(T); } }
  const f = T.fixtures.find(y => y.id === st.fid); E.autoLineup(T, T.my, { comp: E.compOf(f) });
  const x = tc.tac.xi, A2 = E.linkAdj(tc.tac.form), f2 = E.FORMATIONS[tc.tac.form];
  tc.lk = {}; for (const [i, j] of A2) tc.lk[key(x[i], x[j])] = [92, 3000];
  const M = E.createMatch(T, f), side = M[M.userSide];
  const Lv = E.linkLive(T, side), line = M.ev.find(e => e.t === 'combo' && e.side === M.userSide);
  ok(Lv.combos.length >= 2 && line && line.text.startsWith('【コンボ】') && Lv.combos.every(it => line.text.includes(it.jp)), `kick-off: ${line && line.text}`);
  const first = T.news.filter(n => n.text.includes('初めて発動')).length;
  ok(first === Lv.combos.length && Object.keys(T.cmb).length === first, `the first time: ${first} news 「…が初めて発動」`);
  E.createMatch(T, f); ok(T.news.filter(n => n.text.includes('初めて発動')).length === first, 'the next match: no news again');
  // the side's ratings in the match carry it: compare the same side with and without
  const rA = Lv.att; tc.lk = {}; side._lk = null; const R2 = E.linkLive(T, side), rB = R2.att;
  ok(rA - rB > 1 && R2.bonus === 0 && R2.combos.every(it => ['yo', 'local', 'nat', 'legend'].includes(it.k)), `in the match: attack +${rA.toFixed(2)} (without 連携 +${rB.toFixed(2)}: only ${R2.combos.map(it => it.jp).join('・') || 'nothing'})`);
  // after the match: pairs grow for both clubs (the AI too)
  tc.lk = {}; for (const [i, j] of A2) tc.lk[key(x[i], x[j])] = [50, 900];
  const M2 = E.createMatch(T, f); E.simulateFull(T, M2); E.finishMatch(T, M2);
  const oc2 = T.clubs[f.h === T.my ? f.a : f.h];
  ok(Object.values(tc.lk).some(e => e[0] > 50) && Object.keys(oc2.lk || {}).length >= 55, `after the match: mine grew, ${oc2.short} has ${Object.keys(oc2.lk || {}).length} pairs`);
}

/* birthplaces */
{
  const T = E.newGame(DATA, 'kashima', 'テスト', '2026-10-15');
  const real = Object.values(T.players).filter(p => !p.gen && p.club === 'kashima' && p.nat === 'JPN');
  ok(real.every(p => p.bp) && real.filter(p => p.bp === '茨城').length === 4, `鹿島: every Japanese player has a birthplace (J.League の出生地), 4 born in 茨城 (${real.filter(p => p.bp === '茨城').map(p => p.short).join('・')})`);
  ok(Object.values(T.players).filter(p => p.nat !== 'JPN').every(p => !p.bp), 'foreigners: none');
  let loc = 0, n = 2000; for (let i = 0; i < n; i++) if (E.bpFor(900000 + i, '茨城') === '茨城') loc++;
  let tok = 0; for (let i = 0; i < n; i++) if (E.bpFor(900000 + i, null) === '東京') tok++;
  ok(near(loc / n, 0.56, 0.04) && near(tok / n, 0.16, 0.03), `made-up players: academy ${Math.round(loc / n * 100)}% local, others from where J1 players come from (東京 ${Math.round(tok / n * 100)}%)`);
  ok(E.bpFor(123456, '茨城') === E.bpFor(123456, '茨城'), 'from his id: the same every time (the game\'s dice aren\'t used)');
}

/* every club builds it; a season's numbers */
{
  const T = E.newGame(DATA, 'kawasakif', 'テスト', '2026-10-15');
  for (let g = 0; g < 400 && T.date < '2027-03-01'; g++) playDay(T);
  const avgs = T.order.map(cid => { const tc = T.clubs[cid]; return E.linkEval(T, cid, tc.tac.form, tc.tac.xi).avg; });
  const sizes = T.order.map(cid => Object.keys(T.clubs[cid].lk || {}).length);
  ok(avgs.every(a => a > 15) && Math.max(...avgs) < 100, `March: every club has 連携 (averages ${Math.round(Math.min(...avgs))}〜${Math.round(Math.max(...avgs))})`);
  ok(Math.max(...sizes) < 400, `pairs per club ${Math.min(...sizes)}〜${Math.max(...sizes)} (a save stays small)`);
}

/* old saves: v15 (this engine's save with S.v 15) and be3e2da */
{
  const T = E.newGame(DATA, 'urawa', 'テスト', '2026-10-15');
  for (let g = 0; g < 200 && T.date < '2026-12-01'; g++) playDay(T);
  const old = clone(T); old.v = 15; for (const cc of Object.values(old.clubs)) delete cc.lk; for (const p of Object.values(old.players)) delete p.bp; delete old.cmb;
  E.migrate(old, DATA);
  const oc = old.clubs[old.my], est = oc.lk || {};
  const xi = oc.tac.xi, A2 = E.linkAdj(oc.tac.form);
  const nbs = A2.map(([i, j]) => (est[key(xi[i], xi[j])] || [0])[0]);
  const real = T.clubs[T.my].lk, rv = A2.map(([i, j]) => (real[key(xi[i], xi[j])] || [0])[0]);
  const ma = a => a.reduce((s, y) => s + y, 0) / a.length;
  ok(old.v === 16 && Object.keys(est).length > 40 && near(ma(nbs), ma(rv), 15), `v15 → 16 (${old.date}): ${Object.keys(est).length} pairs from the minutes, neighbours ${ma(nbs).toFixed(0)} (played: ${ma(rv).toFixed(0)})`);
  const dbp = Object.fromEntries(DATA.players.filter(d => d.bp).map(d => [d.id, d.bp]));
  const rl = Object.values(old.players).filter(p => !p.gen && dbp[p.id]);
  ok(rl.length > 500 && rl.every(p => p.bp === dbp[p.id]), `v15 → 16: real players get their birthplace from the data (${rl.length}; born abroad, none)`);
  ok(Object.values(old.players).filter(p => p.gen && p.nat === 'JPN').every(p => p.bp), 'v15 → 16: made-up ones too (from their id)');
  const again = clone(old); E.migrate(again, DATA); ok(JSON.stringify(again.clubs[again.my].lk) === JSON.stringify(oc.lk), 'migrating twice changes nothing');
  // be3e2da
  const tmp = path.join(os.tmpdir(), `engine_be3e2da_link_${process.pid}.js`);
  fs.writeFileSync(tmp, execSync('git show be3e2da:dev/src/engine.js', { cwd: path.join(__dirname, '..', '..') }));
  const O = require(tmp);
  const B = O.newGame(DATA, 'machida', '旧', '2026-10-14');
  for (let g = 0; g < 200 && B.date < '2027-02-20'; g++) playDay(B, O);
  fs.unlinkSync(tmp);
  E.migrate(B, DATA);
  const bc = B.clubs[B.my], bl = E.linkEval(B, B.my, bc.tac.form, bc.tac.xi);
  ok(B.v === 16 && bl.avg > 30 && bl.avg < 95, `be3e2da (${B.date}): 連携 estimated, the XI's average ${bl.avg.toFixed(0)}`);
  for (let g = 0; g < 60; g++) playDay(B);
  ok(Object.values(bc.lk).some(e => e[1] > 0), `be3e2da: the season goes on (${B.date})`);
}

console.log(fails ? `FAILS ${fails}` : 'all ok');
process.exit(fails ? 1 : 0);
