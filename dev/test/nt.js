// 代表 (2026-10-14): the calendar (J1 stops for the FIFA windows), the Lカップ as the real ルヴァンカップ (1stラウンド groups,
// two-legged quarter- and semi-finals, the final at 国立), call-ups (Japan with the 活躍枠, other nations by their bar),
// players away for their country (not in any club match), the Asian Cup 2027, offers from Europe, nationalities, old saves.
// usage: node dev/test/nt.js [seasons for the long check (default 2)]
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const E = require('../src/engine.js'); const DATA = require('../data.json');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('NG', m); } };
let x = 11; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const play = (S, until, cb) => {
  for (let g = 0; g < 20000; g++) {
    if (until && S.date >= until) break;
    const st = E.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { rotate: true }); const M = E.createMatch(S, f); if (cb) cb(S, M, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 40); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') return 'end';
    else if (st.stop === 'fired') return 'fired';
  }
};

// ---------- calendar ----------
{
  const d26 = E.seasonDates(2026);
  ok(d26.length === 38 && d26.join() === E.J1_2026.join(), '2026/27 = the real J1 dates');
  for (let sy = 2026; sy <= 2036; sy++) {
    const d = E.seasonDates(sy);
    ok(d.length === 38 && new Set(d).size === 38 && d.every((v, i) => !i || v > d[i - 1]), `${sy}: 38 rounds in order`);
    ok(!d.some(v => E.inNtWindow(sy, v)), `${sy}: no league round in a FIFA window`);
    ok(d.filter(v => v.slice(5) >= '12-20' || (v.slice(5) <= '02-05')).length === 0, `${sy}: the winter break`);
    const T0 = { season: sy, date: sy + '-06-08', fixtures: d.map((v, i) => ({ date: v, r: i + 1 })) };
    const cs = E.cupSchedule ? E.cupSchedule(T0) : null;
    if (cs) ok(cs.ec[4] === `${sy + 1}-01-01` && E.D.diff(cs.ec[4], cs.ec[3]) >= 4 && E.D.diff(cs.ec[3], cs.ec[2]) === 4 && cs.ec[2] > d[19], `${sy}: 天皇杯 late December after the league`);
  }
  const w = E.ntWindows(2026);
  ok(w[0].from === '2026-09-21' && w[0].to === '2026-10-06' && w[0].n === 4 && w[1].from === '2026-11-09' && w[2].from === '2027-03-22' && w[3].from === '2027-06-07', 'FIFA windows 2026/27');
  ok(E.ntWindows(2030).every(v => E.D.dow(v.from) === 1), 'estimated windows start on a Monday');
}

// ---------- a new game: cups ----------
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-14');
{
  const lc = S.cups.lc;
  ok(E.lcNew(lc) && lc.groups.length === 4 && lc.groups.every(g => g.length === 7), 'Lカップ: four groups of 7 (J1 14 + J2 14)');
  ok(lc.prime.join() === 'kashima,kobe', 'プライムラウンドから 鹿島・神戸');
  const afc = S.fixtures.filter(f => f.cup === 'lc' && f.grp === 'afc');
  ok(afc.length === 2 && afc.every(f => f.date === '2026-10-03') && afc.map(f => f.h + '-' + f.a).join() === 'machida-kyoto,kashiwa-gosaka', '4回戦 10/3: 町田-京都, 柏-G大阪');
  ok(JSON.stringify(lc.dates) === JSON.stringify({ r: ['2026-09-29', '2026-10-14', '2026-10-28'], afc: '2026-10-03', qf: ['2026-11-11', '2026-11-15'], sf: ['2027-03-24', '2027-03-28'], f: '2027-05-05' }), 'Lカップの日程');
  ok(S.cups.ec.dates.join() === '2026-08-26,2026-10-07,2026-12-23,2026-12-27,2027-01-01', '天皇杯の日程');
  const r2 = S.fixtures.filter(f => f.cup === 'lc' && f.cr === 0);
  ok(r2.length === 12 && r2.every(f => !S.order.includes(f.h) && S.order.includes(f.a)), '2回戦: J1 v J2, the J2 club at home');
  ok(r2.every(f => E.compOf(f) === 'lc1') && afc.every(f => E.compOf(f) === 'lc1'), '1stラウンド = lc1');
  const lg = S.fixtures.filter(f => !f.cup);
  const wins = E.ntWindows(2026);
  ok(!lg.some(f => wins.some(w => f.date >= w.from && f.date <= w.to)), 'no league match in a window');
}

// ---------- one season: who plays where, call-ups, away players, the Asian Cup ----------
const seen = { calls: [], awayIn: 0, matchesInWindow: 0, lcInWindow: 0, sameDay: 0, legs: [], acJp: null };
{
  let lastK = null;
  const check = (S2, M, f) => {
    const ids = Object.keys(M.pm).map(Number).concat(M.h.bench, M.a.bench);
    if (ids.some(id => S2.players[id] && S2.players[id].away)) seen.awayIn++;
    if (E.inNtWindow(S2.season, f.date)) { seen.matchesInWindow++; if (f.cup === 'lc') seen.lcInWindow++; }
  };
  for (let g = 0; g < 30000; g++) {
    const C = S.nt && S.nt.cur;
    if (C && C.k !== lastK) {
      lastK = C.k;
      const jp = C.sq.JPN.map(id => S.players[id]);
      seen.calls.push({ k: C.k, n: jp.length, kat: C.kat.length, j1: jp.filter(p => S.order.includes(p.club)).length, jpn: jp.every(p => p.nat === 'JPN'), others: Object.entries(C.sq).filter(([cc]) => cc !== 'JPN').every(([cc, ids]) => ids.every(id => S.players[id].nat === cc && S.order.includes(S.players[id].club) && E.NATIONS[cc].bar != null)), ann: S.date });
      if (C.kind === 'ac') seen.acJp = C.games.filter(gm => gm.cc === 'JPN' && gm.stage === 'グループF').map(gm => gm.opp).sort().join();
    }
    const st = E.advance(S, 1);
    if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { rotate: true }); const M = E.createMatch(S, f); check(S, M, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 40); }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') break;
    // nobody away plays for his club: the AI clubs' sides for today's matches (set in the morning)
    for (const f of S.fixtures.filter(f => f.date === S.date && !f.played)) for (const cid of [f.h, f.a]) {
      const c = S.clubs[cid]; if (cid === S.my || !c) continue;
      if (c.tac.xi.concat(c.tac.bench).some(id => id && S.players[id] && S.players[id].away)) seen.awayIn++;
    }
  }
  ok(!!S.seasonEnd, 'the season finished');
  ok(seen.calls.length === 5 && seen.calls.map(c => c.k).join() === '2026w0,2026w1,ac2027,2026w2,2026w3', 'five call-ups: 4 windows + the Asian Cup ' + seen.calls.map(c => c.k));
  ok(seen.calls.every(c => c.jpn && c.others), 'Japan: all Japanese; others: their J1 players');
  ok(seen.calls.map(c => c.n).join() === '28,26,26,26,26', 'squad sizes 28/26 ' + seen.calls.map(c => c.n));
  ok(seen.calls.every(c => c.kat >= 0 && c.kat <= 2), '活躍枠 at most 2');
  ok(seen.calls.every(c => c.j1 >= 1 && c.j1 <= 9), 'J1 players in the Japan squad ' + seen.calls.map(c => c.j1));
  ok(seen.calls[0].ann === '2026-09-17', 'named 4 days before (9/17) ' + seen.calls[0].ann);
  ok(seen.awayIn === 0, 'nobody plays for his club while away: ' + seen.awayIn);
  ok(seen.acJp === 'IDN,QAT,THA', 'Asian Cup 2027: Japan with カタール・タイ・インドネシア ' + seen.acJp);
  const lc = S.cups.lc;
  ok(!!lc.champ && !!S.cups.ec.champ, 'both cups finished');
  const qf = S.fixtures.filter(f => f.cup === 'lc' && f.cr === 3), sf = S.fixtures.filter(f => f.cup === 'lc' && f.cr === 4), fin = S.fixtures.filter(f => f.cup === 'lc' && f.cr === 5);
  ok(qf.length === 8 && qf.every(f => f.date === (f.leg === 1 ? '2026-11-11' : '2026-11-15')), '準々決勝 4 ties, 11/11 and 11/15');
  ok(sf.length === 4 && sf.every(f => f.date === (f.leg === 1 ? '2027-03-24' : '2027-03-28')), '準決勝 2 ties, 3/24 and 3/28');
  ok(fin.length === 1 && fin[0].neutral && fin[0].date === '2027-05-05', '決勝 5/5 国立');
  ok(qf.concat(sf).every(f => E.compOf(f) === 'lc2') && E.compOf(fin[0]) === 'lc2', 'プライムラウンド = lc2');
  for (const f2 of qf.concat(sf).filter(f => f.leg === 2)) {
    const f1 = S.fixtures.find(y => y.tie === f2.tie && y.leg === 1);
    ok(f1.h === f2.a && f1.a === f2.h, 'legs swap home');
    ok(!f1.pk, 'no shootout after a first leg');
    const gx = f1.ag + f2.hg, gy = f1.hg + f2.ag;   // f2.h's goals, f2.a's goals
    ok(f2.agg && f2.agg[0] === gx && f2.agg[1] === gy, 'aggregate stored');
    ok(!!f2.pk === (gx === gy), 'a shootout only when level on aggregate');
    const w = E.cupWinner(f2), exp = gx > gy ? f2.h : gx < gy ? f2.a : (f2.pk[0] > f2.pk[1] ? f2.h : f2.a);
    ok(w === exp, 'the tie goes to the aggregate');
    ok(lc.out[w === f2.h ? f2.a : f2.h] === f2.cr, 'the loser is out in that round');
  }
  ok(E.cupWinner(qf.find(f => f.leg === 1)) === null, 'a first leg decides nothing');
  // no club plays twice on a day
  const day = {}; for (const f of S.fixtures) for (const c of [f.h, f.a]) { const k = c + f.date; day[k] = (day[k] || 0) + 1; }
  ok(Object.values(day).every(n => n === 1), 'no club plays twice on one day');
  // national-team records
  const ints = Object.values(S.players).filter(p => p.nt && p.nt.calls);
  ok(ints.length > 30 && ints.every(p => p.nt.first && p.nt.last && p.nt.caps >= 0), 'records of internationals ' + ints.length);
  ok(ints.some(p => p.nt.caps > 0 && p.nt.g > 0), 'caps and goals');
  ok(!Object.values(S.players).some(p => p.away), 'everyone is back at the end of the season');
  ok((S.nt.res || []).length >= 12, 'Japan results kept ' + (S.nt.res || []).length);
  const p0 = ints.find(p => E.recentNt(p, S.date) && E.age(p, S.date) < 30);
  if (p0) { const v1 = E.value(p0, S.date), keep = p0.nt.last; p0.nt.last = '2000-01-01'; const v0 = E.value(p0, S.date); p0.nt.last = keep; ok(v1 > v0, 'a current international is worth more'); }
}

// ---------- the 2nd season: the Lカップ seeds come from the table, the calendar again ----------
{
  const t = S.lastTable.filter(id => S.order.includes(id));
  S.board = 60; E.rollover(S);
  if (!S.fired) {
    const lc = S.cups.lc, top = t.filter(id => S.order.includes(id));
    ok(lc.prime.join() === top.slice(0, 2).join(), 'next season: last season\'s top two in the プライムラウンド');
    const afc = S.fixtures.filter(f => f.cup === 'lc' && f.grp === 'afc').map(f => [f.h, f.a]);
    ok(JSON.stringify(afc) === JSON.stringify([[top[2], top[5]], [top[3], top[4]]]), '3rd v 6th, 4th v 5th');
    const lg = S.fixtures.filter(f => !f.cup);
    ok(!lg.some(f => E.inNtWindow(S.season, f.date)), 'season 2: no league match in a window');
  }
}

// ---------- offers from Europe ----------
{
  const T = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-14'); T.date = '2027-07-01';
  const ai = Object.values(T.players).find(p => p.club === 'kashiwa' && p.nat === 'JPN' && E.age(p, T.date) <= 26 && p.ovr >= 74);
  ai.nt = { cc: 'JPN', caps: 3, g: 0, calls: 2, first: '2026-09-17', last: '2027-03-18', ks: ['2026-11-05', '2027-03-18'] };
  ok(E.euroWanted(T, ai), 'a Japan regular is wanted in Europe');
  const funds = T.clubs.kashiwa.funds, n0 = E.squad(T, 'kashiwa').length;
  E.euroOffer(T, ai);
  ok(T.clubs[ai.club] && T.clubs[ai.club].ab, 'an AI club\'s player goes to Europe');
  ok(T.clubs.kashiwa.funds > funds, 'the club takes the fee');
  ok(E.squad(T, 'kashiwa').length >= Math.min(n0, 26) - 1, 'the club signs someone if short');
  const me = E.squad(T, T.my).filter(p => p.nat === 'JPN' && E.age(p, T.date) <= 26).sort((a, b) => b.ovr - a.ovr)[0];
  me.nt = { cc: 'JPN', caps: 1, g: 0, calls: 1, first: '2027-03-18', last: '2027-03-18', ks: ['2027-03-18'] };
  ok(E.euroWanted(T, me), 'one call within a year is enough');
  E.euroOffer(T, me);
  const it = T.inbox.find(y => y.euro && y.pid === me.id);
  ok(it && me.club === T.my && T.clubs[it.from].ab, 'my player: the offer comes to me');
  E.rejectOffer(T, it.id);
  ok(me.euroNo === T.date, 'after a no he waits');
  let again = false; for (let i = 0; i < 40; i++) { T.date = E.D.add(T.date, 1); E.euroDay(T); if (T.inbox.some(y => y.euro && y.pid === me.id && !y.done)) again = true; }
  ok(!again, 'no new offer from Europe for a while');
  me.euroNo = '2020-01-01'; E.euroOffer(T, me);
  const it2 = T.inbox.find(y => y.euro && y.pid === me.id && !y.done);
  const r = E.acceptOffer(T, it2.id);
  ok(r.ok && T.clubs[me.club].ab, 'accepting: he moves to Europe');
  // the 海外組 grow by the minutes they can expect
  const ab = Object.values(T.players).find(p => T.clubs[p.club] && T.clubs[p.club].ab && E.age(p, T.date) <= 23 && p.pot > p.ovr + 2);
  ok(ab && E.shareFor(T, ab) != null && E.shareFor(T, ab) === E.abShare(T, ab), 'abroad: the expected share of minutes');
}

// ---------- nationalities (kashima's file gave country codes) ----------
{
  const nat = n => Object.values(S.players).find(p => p.name === n) || DATA.players.find(p => p.name === n);
  ok(nat('レオ セアラ').nat === 'BRA' && nat('チャヴリッチ').nat === 'SRB' && nat('キム テヒョン').nat === 'KOR', 'nationalities from country codes');
  ok(DATA.players.filter(p => p.club === 'kashima' && p.nat !== 'JPN').length === 6, 'kashima: six foreign players');
}

// ---------- an old save (v10, made with the engine before this change) ----------
{
  const tmp = path.join(require('os').tmpdir(), 'engine_v10_' + process.pid + '.js');
  let old = null;
  try { fs.writeFileSync(tmp, execSync('git show 8522e66:dev/src/engine.js', { cwd: path.join(__dirname, '..', '..') })); old = require(tmp); } catch (e) { console.log('(skip old save: no git history)'); }
  if (old) {
    const oldData = JSON.parse(JSON.stringify(DATA)); for (const p of oldData.players) if (p.club === 'kashima' && p.nat !== 'JPN') p.nat = 'JPN';
    const O = old.newGame(oldData, 'yokohamafm', 'テスト', '2026-10-14');
    for (let g = 0; g < 3000 && O.date < '2026-11-03'; g++) {
      const st = old.advance(O, 1);
      if (st.stop === 'match') { const f = O.fixtures.find(y => y.id === st.fid); const M = old.createMatch(O, f); old.simulateFull(O, M); old.finishMatch(O, M); }
      else if (st.stop === 'inbox') O.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') old.rejectOffer(O, y.id); });
    }
    const before = O.fixtures.filter(f => !f.cup && f.date === '2026-11-14').length;
    const S2 = E.migrate(JSON.parse(JSON.stringify(O)), DATA);
    ok(before === 10 && S2.v >= 11, 'old save had a round on 11/14 (in the window); now v11+');
    const lg = S2.fixtures.filter(f => !f.cup && !f.played);
    ok(!lg.some(f => E.inNtWindow(2026, f.date)), 'old save: unplayed rounds moved out of the windows');
    ok(lg.filter(f => f.r === 15).every(f => f.date === '2026-11-21') && lg.filter(f => f.r === 16).every(f => f.date === '2026-11-25'), 'old save: 第15節 11/21, 第16節 11/25 (the real dates)');
    const day = {}; for (const f of S2.fixtures) for (const c of [f.h, f.a]) { const k = c + f.date; day[k] = (day[k] || 0) + 1; }
    ok(Object.values(day).every(n => n === 1), 'old save: no club plays twice on one day');
    ok(S2.players[Object.values(S2.players).find(p => p.name === 'レオ セアラ').id].nat === 'BRA', 'old save: nationality fixed');
    ok(!E.lcNew(S2.cups.lc), 'old save: this season\'s Lカップ stays as it was');
    // the season plays out (old Lカップ, national teams), then the new Lカップ
    const end = play(S2);
    ok(end === 'end' && S2.cups.lc.champ, 'old save: the season finishes with the old Lカップ');
    ok(S2.nt && Object.keys(S2.nt.done).includes('2026w1') && S2.nt.done['2026w0'], 'old save: the next window is played, the one already past skipped');
    S2.board = 60; E.rollover(S2);
    if (!S2.fired) ok(E.lcNew(S2.cups.lc), 'old save: next season the new Lカップ');
    fs.unlinkSync(tmp);
  }
}

// ---------- longer: the pool abroad and the Japan squad (optional) ----------
const N = +(process.argv[2] || 0);
if (N) {
  const L = E.newGame(DATA, 'kashima', 'テスト', '2026-10-14'); L.settings.boardLv = 'easy';
  for (let s = 0; s < N; s++) { const r = play(L); if (r !== 'end') break; L.board = 60; E.rollover(L); }
  const ab = Object.values(L.players).filter(p => L.clubs[p.club] && L.clubs[p.club].ab && p.nat === 'JPN').length;
  console.log(`after ${N} seasons: 海外組 ${ab}`);
}
console.log(bad ? `${bad} NG` : 'nt: all OK');
process.exit(bad ? 1 : 0);
