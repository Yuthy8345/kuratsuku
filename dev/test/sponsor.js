// スポンサー契約 (2026-10-15): the five offers (made-up local companies, one condition each, a mix of difficulties set
// from the club's strength, the money following the chance), three at most and their places on the kit, the secretary's
// pick at kick-off, the fixed sponsors and the guarantees every month, each condition (met / missed, the bonus the day it
// is met), the season's end, the next season's offers, a new job, AI clubs unchanged, old saves (v13 and a save made with
// the engine of 91d0519).
// usage: node dev/test/sponsor.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const playDay = S => {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); if (E.lineupIssues(S, S.my, E.compOf(f)).block) E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'fired') E.takeJob(S, S.fired.offers[0]);
  return st;
};
const SP = E.SPON;

/* the offers */
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-15');
const c = S.clubs[S.my];
ok(S.v >= 14 && S.spon && S.spon.s === S.season && !S.spon.old && S.spon.offer.length === SP.n, `new game: ${SP.n} offers for ${E.seasonLabel(S.season)}`);
ok(E.secNotes(S)[0].k === 'hello' && E.secNotes(S).some(n => n.k === 'spon' && !n.seen), 'the secretary brings them (a note under her hello)');
const kinds = S.spon.offer.map(x => x.k);
ok(new Set(kinds).size === SP.n && !(kinds.includes('pts') && kinds.includes('rank')), `five different conditions, not both 勝点 and 順位 (${kinds.join(' ')})`);
const city = c.short.replace(/[A-Za-z・]/g, '');
ok(S.spon.offer.every(x => (x.co.startsWith(city) || x.co.startsWith(c.area)) && SP.words.some(w => x.co.includes(w)) && x.br && x.co.endsWith(x.br)), `made-up local companies (${S.spon.offer.map(x => x.co).join('・')})`);
ok(new Set(S.spon.offer.map(x => SP.words.find(w => x.co.includes(w)))).size === SP.n, 'no coined word twice');
ok(S.spon.offer.every(x => x.lv === SP.lv(x.p) && x.g > 0 && x.b > 0 && x.p >= SP.pMin && x.p <= SP.pMax), 'difficulty ●〜●●● from the chance, guarantee and bonus > 0');
const value = c.spon * S.spon.months * SP.card;
ok(S.spon.offer.every(x => Math.abs(x.g + x.p * x.b - value) / value < 0.03), `every card is worth the same on average (${E.money(Math.round(value))}: ${S.spon.offer.map(x => E.money(Math.round(x.g + x.p * x.b))).join(' ')})`);
ok(S.spon.offer.every(x => x.lv === 1 || x.b > x.g), 'a harder card pays more as its bonus');
ok(S.spon.months === 10 && S.spon.end === E.D.add('2027-06-06', 0), `first season: 10 paydays to the last match (${S.spon.end})`);
ok(S.spon.offer.every(x => E.sponText(x) && E.sponShort(x)), `texts: ${S.spon.offer.map(E.sponText).join('／')}`);
// a mix of difficulties over many games
{
  let mix = 0, lv3 = 0, n = 0, both = 0;
  for (let i = 0; i < 20; i++) { const T = E.newGame(DATA, ['mito', 'kashima', 'urawa', 'okayama', 'kobe'][i % 5], 't', '2026-10-15'); const lvs = new Set(T.spon.offer.map(x => x.lv)); if (lvs.size >= 2) mix++; lv3 += T.spon.offer.filter(x => x.lv === 3).length; n++; const k = T.spon.offer.map(x => x.k); if (k.includes('pts') && k.includes('rank')) both++; }
  ok(mix === n && lv3 >= n * 0.6, `20 new games: every offer mixes difficulties, ●●● about one per offer (${lv3})`);
  ok(!both, '20 new games: never both 勝点 and 順位');
}
// stronger clubs are asked for more
{
  const W = E.newGame(DATA, 'mito', 't', '2026-10-15'), K = E.newGame(DATA, 'kashima', 't', '2026-10-15');
  const ew = E.sponEst(W), ek = E.sponEst(K);
  const tw = E.sponTarget('pts', 2, ew).n, tk = E.sponTarget('pts', 2, ek).n, rw = E.sponTarget('rank', 2, ew).n, rk = E.sponTarget('rank', 2, ek).n;
  ok(ek.pw > ew.pw && tk > tw + 5 && rk < rw, `●● for 鹿島 vs 水戸: 勝点${tk} vs ${tw}, ${rk}位以内 vs ${rw}位以内`);
  ok(E.sponTarget('pts', 1, ek).n < E.sponTarget('pts', 2, ek).n && E.sponTarget('pts', 2, ek).n < E.sponTarget('pts', 3, ek).n, 'harder = a higher target');
  ok(E.sponTarget('hl', 1, ek).n > E.sponTarget('hl', 3, ek).n, 'ホームの負け: harder = fewer');
  ok(ek.cup.p > ew.cup.p, `ベスト4: 鹿島 ${Math.round(ek.cup.p * 100)}% vs 水戸 ${Math.round(ew.cup.p * 100)}%`);
}
// no academy players yet → no ユース出身 card; a club with three of them in the team gets one now and then
{
  ok(!S.spon.offer.some(x => x.k === 'yo'), 'no academy players marked yet: no ユース出身 card');
  const T = E.newGame(DATA, 'urawa', 't', '2026-10-15'); const tc = T.clubs[T.my];
  const ps = E.squad(T, T.my).filter(p => tc.tac.xi.includes(p.id)).slice(0, 3); for (const p of ps) p.yo = T.my;
  const e = E.sponEst(T);
  const t1 = E.sponTarget('yo', 1, e), t3 = E.sponTarget('yo', 3, e);
  ok(e.yo.m === 3 && e.yo.k === 3 && t1.n === 3 && t1.p === SP.yo[0] && t3.n === 3, `3 academy players starting: ● = start the 3 (p ${t1.p})`);
}

/* picking: three at most, places on the kit */
{
  const T = clone(S);
  const ids = T.spon.offer.map(x => x.id);
  ok(!E.sponPick(T, [ids[0], ids[0]]), 'the same offer twice: refused');
  ok(!E.sponPick(T, [999]), 'an unknown offer: refused');
  ok(E.sponPick(T, [ids[0], null, ids[1], ids[2]]) && T.spon.deals.length === 2 && T.spon.deals.map(d => d.slot).join() === '0,2', 'three places at most: 胸 and 袖 signed, 背中 left empty, a fourth ignored');
  ok(!T.spon.offer && !E.sponPending(T) && !E.sponPick(T, [ids[3]]), 'signed: no more offers');
  ok(!T.sec.notes.some(n => n.k === 'spon') && T.news[0].text.includes('スポンサー2社と契約'), 'her offer note goes, the news says who');
  const rec = E.sponRec(S);
  const ps = rec.map(id => S.spon.offer.find(x => x.id === id).p);
  ok(rec.length === 3 && ps[0] >= ps[1] && ps[1] >= ps[2] && Math.min(...ps) >= Math.max(...S.spon.offer.filter(x => !rec.includes(x.id)).map(x => x.p)), `her pick: the three likeliest, the likeliest on the chest (${ps.join(' ')})`);
}

/* kick-off without a choice: her pick */
{
  const T = clone(S);
  for (let g = 0; g < 5 && !T.fixtures.some(f => f.played && (f.h === T.my || f.a === T.my)); g++) playDay(T);
  const rec = E.sponRec(S);
  ok(!E.sponPending(T) && T.spon.deals.map(d => d.id).join() === rec.join() && T.spon.deals.map(d => d.slot).join() === '0,1,2', 'the first match without a choice: her three are signed (胸・背中・袖)');
  const n = T.sec.notes.find(x => x.k === 'spon');
  ok(n && n.data.auto && !n.seen && T.news.some(x => x.text.includes('秘書のおすすめ')), 'she says so (a note, the news)');
}

/* the money: fixed sponsors + guarantees every month; bonuses the day a condition is met; AI clubs as before */
{
  const T = clone(S); const tc = T.clubs[T.my];
  const ids = T.spon.offer.map(x => x.id);
  E.sponPick(T, [ids[0], ids[1], ids[2]]);
  const d0 = T.spon.deals[0];
  // make the chest one easy to watch: 1 point in the league
  Object.assign(d0, { k: 'pts', n: 1 });
  const d2 = T.spon.deals[2]; Object.assign(d2, { k: 'hl', n: 0 });   // the sleeve: lose no home game
  const ai = T.order.find(x => x !== T.my); const ac = T.clubs[ai]; const aiSp0 = ac.spon;
  let f0 = tc.funds, hit = null, miss = null, missNews = false, months = 0, first = null;
  const base = Math.round(tc.spon * SP.base);   // before the season ends (a top-3 finish raises c.spon)
  for (let g = 0; g < 400 && !T.seasonEnd; g++) {
    const before = tc.fin.spon, fb = tc.funds;
    const day = T.date;
    const st = playDay(T);
    if (E.D.d(T.date) === 1 && E.D.d(day) !== 1) { months++; if (!first) first = tc.fin.spon - before; }
    if (!hit && d0.st === 'done') hit = { date: T.date, got: d0.got };
    if (!miss && d2.st === 'fail') { miss = T.date; missNews = T.news.some(x => x.text.includes(d2.co) && x.text.includes('届かなかった')) && T.sec.notes.some(n => n.k === 'sponMiss' && n.data.co === d2.co); }
    if (st.stop === 'seasonEnd') break;
  }
  ok(first != null && Math.abs(first - (base + T.spon.deals.reduce((a, d) => a + Math.round(d.g * SP.slot[d.slot].f / T.spon.months), 0))) <= 3, `a month: fixed ${E.money(base)} + the guarantees' share (${E.money(first)})`);
  ok(hit && hit.got === Math.round(d0.b * SP.slot[0].f), `勝点1以上 met on ${hit && hit.date}: the bonus × 1.2 (胸) the same day (${hit && E.money(hit.got)})`);
  ok(T.sec.notes.some(n => n.k === 'sponHit' && n.data.co === d0.co) || T.news.some(x => x.text.includes(d0.co) && x.text.includes('達成')), 'she tells (a note / the news)');
  const hd = T.fixtures.filter(f => !f.cup && f.played && f.h === T.my && f.hg < f.ag).sort((a, b) => a.date.localeCompare(b.date))[0];
  ok(miss && hd && miss === hd.date && missNews, `ホームの負け0以下 missed on ${miss}, the day of the first home defeat (news and her note)`);
  ok(T.seasonEnd && T.seasonEnd.spon, 'season review: the contracts');
  const sp = T.seasonEnd.spon;
  ok(T.spon.deals.every(d => d.paid === Math.round(d.g * SP.slot[d.slot].f)), `every guarantee paid in full by the end (${sp.deals.map(d => E.money(d.paid)).join(' ')})`);
  ok(T.spon.deals.every(d => d.st !== 'run'), 'no condition left open at the end');
  ok(tc.fin.spon === base * T.spon.months + sp.guar + sp.bonus, `fin.spon = fixed × ${T.spon.months} + guarantees + bonuses (${E.money(tc.fin.spon)})`);
  ok(ac.fin.spon === aiSp0 * T.spon.months, `AI club: the same fixed sponsors as before (${E.money(ac.fin.spon)})`);
  ok(T.spon.hist.length === 1 && T.spon.hist[0].s === 2026, 'kept in the history');
  // next season: new offers, she stops the days to bring them
  T.board = 100; E.rollover(T);
  if (T.fired) { console.log(`(skip the next season's checks: sacked at the season end — ${T.fired.reason})`); } else {
  ok(T.spon.s === T.season && T.spon.offer.length === SP.n && T.spon.months >= 11 && T.spon.months === E.payMonths(E.D.add(T.date, 1), T.spon.end) && T.spon.u23 === 0 && !T.spon.yo.length, `${E.seasonLabel(T.season)}: five new offers, ${T.spon.months} paydays to ${T.spon.end}, counters back to 0`);
  const U = clone(T); E.sponPick(U, E.sponRec(U));
  const st = E.advance(T, 3);
  ok(st.stop === 'sec', `she stops the days to bring them (${st.stop} on ${T.date})`);
  const su = E.advance(U, 3);
  ok(su.stop !== 'sec', `signed before the next day: no stop for them (${su.stop})`);
  ok(T.spon.offer.every(x => !sp.deals.some(d => d.co === x.co)), 'new companies');
  }
}

/* each condition */
{
  const T = clone(S); E.sponPick(T, E.sponRec(T));
  const d = (k, n) => ({ k, n, st: 'run' });
  const st = (o) => Object.assign({ pts: 0, rank: null, gf: 0, cs: 0, hl: 0, att: null, an: 0, left: 10, sf: false, alive: true, u23: 0, yo: 0, played: 0 }, o);
  const v = (k, n, o) => E.sponNow(T, d(k, n), st(o)).st;
  ok(v('pts', 50, { pts: 50 }) === 'done' && v('pts', 50, { pts: 30, left: 6 }) === 'fail' && v('pts', 50, { pts: 40, left: 4 }) === 'run', '勝点: met / out of reach / still possible');
  ok(v('gf', 40, { gf: 40 }) === 'done' && v('gf', 40, { gf: 39, left: 0 }) === 'fail' && v('cs', 10, { cs: 10 }) === 'done', '得点・無失点: met / missed at the end');
  ok(v('hl', 3, { hl: 4 }) === 'fail' && v('hl', 3, { hl: 3 }) === 'run' && v('hl', 3, { hl: 3, left: 0 }) === 'done', 'ホームの負け: missed on one too many, met at the end');
  ok(v('rank', 5, { rank: 3 }) === 'run' && v('rank', 5, { rank: 5, left: 0 }) === 'done' && v('rank', 5, { rank: 6, left: 0 }) === 'fail', '順位: only at the end');
  ok(v('att', 20000, { att: 25000 }) === 'run' && v('att', 20000, { att: 20000, left: 0 }) === 'done' && v('att', 20000, { att: 19900, left: 0 }) === 'fail', '観客: only at the end');
  ok(v('cup', 4, { sf: true }) === 'done' && v('cup', 4, { alive: false }) === 'fail' && v('cup', 4, {}) === 'run', 'ベスト4: in the semi-finals / out of both cups / still in');
  ok(v('u23', 40, { u23: 40 }) === 'done' && v('u23', 40, { u23: 5, left: 3 }) === 'fail' && v('yo', 2, { yo: 2 }) === 'done' && v('yo', 2, { yo: 1, left: 0 }) === 'fail', '23歳以下・ユース出身: met / out of reach');
  // starters counted from real matches: 23 and under in the league, academy players everywhere
  const tc = T.clubs[T.my];
  const young = E.squad(T, T.my).filter(p => tc.tac.xi.includes(p.id) && E.age(p, T.date) <= 23).length;
  const acad = E.squad(T, T.my).find(p => tc.tac.xi.includes(p.id)); acad.yo = T.my;
  let lg = 0, u0 = T.spon.u23;
  for (let g = 0; g < 10 && !lg; g++) {
    const st2 = E.advance(T, 1);
    if (st2.stop === 'match') { const f = T.fixtures.find(y => y.id === st2.fid); const M = E.createMatch(T, f); const starters = Object.entries(M.pm).filter(([id, pm]) => pm.side === M.userSide && pm.on === 0).map(([id]) => T.players[id]); E.simulateFull(T, M); E.finishMatch(T, M); if (!f.cup) lg = starters.filter(p => E.age(p, T.date) <= 23).length || -1; }
  }
  ok(T.spon.u23 - u0 === Math.max(0, lg) && T.spon.yo.includes(acad.id), `a league match: ${Math.max(0, lg)} starters 23 and under counted, the academy player listed`);
}

/* old saves: v13 keeps the fixed sponsors this season, offers next season */
{
  const O = clone(S); O.v = 13; delete O.spon; O.sec.notes = O.sec.notes.filter(n => n.k !== 'spon');
  const M = E.migrate(O, DATA);
  ok(M.v >= 14 && M.spon && M.spon.old && !E.sponOn(M) && !E.sponPending(M), 'v13 → v14: this season on the old fixed sponsors');
  const mc = M.clubs[M.my]; let first = null;
  for (let g = 0; g < 40 && first == null; g++) { const b = mc.fin.spon; const day = M.date; playDay(M); if (E.D.d(M.date) === 1 && E.D.d(day) !== 1) first = mc.fin.spon - b; }
  ok(first === mc.spon, `a month: the whole fixed sponsors as before (${E.money(first)})`);
  ok(E.sponMonth(M).base === mc.spon && E.sponMonth(M).guar === 0, 'the club screen shows the old amount');
}
{
  const tmp = path.join(require('os').tmpdir(), 'engine_91d0519_' + process.pid + '.js');
  let old = null;
  try { fs.writeFileSync(tmp, execSync('git show 91d0519:dev/src/engine.js', { cwd: path.join(__dirname, '..', '..') })); old = require(tmp); } catch (e) { console.log('(skip 91d0519 save: no git history)'); }
  if (old) {
    const A = old.newGame(DATA, 'kashima', '旧', '2026-10-14');
    for (let g = 0; g < 70; g++) { const st = old.advance(A, 1); if (st.stop === 'match') { const f = A.fixtures.find(y => y.id === st.fid); old.autoLineup(A, A.my); const M = old.createMatch(A, f); old.simulateFull(A, M); old.finishMatch(A, M); } else if (st.stop === 'inbox') A.inbox.forEach(y => { y.seen = true; }); }
    const B = E.migrate(clone(A), DATA);
    ok(B.v >= 14 && B.spon.old && B.spon.s === B.season, `91d0519 save (${A.date}): migrated, the old fixed sponsors this season`);
    let err = null, ends = 0;
    try { for (let g = 0; g < 2000 && !ends; g++) { const st = playDay(B); if (st.stop === 'seasonEnd') ends++; } } catch (e) { err = e; }
    ok(!err && B.seasonEnd && B.seasonEnd.spon == null, `the season played out without contracts${err ? ' ' + err.stack : ''}`);
    E.rollover(B);
    ok(B.spon.s === B.season && !B.spon.old && B.spon.offer.length === SP.n, `${E.seasonLabel(B.season)}: the offers come`);
    try { fs.unlinkSync(tmp); } catch (e) { }
  }
}

/* a new job: mid-season → old fixed sponsors until the season ends; before the season → the new club's offers */
{
  const T = clone(S); E.sponPick(T, E.sponRec(T));
  for (let g = 0; g < 60; g++) playDay(T);
  const to = T.order.find(x => x !== T.my);
  E.takeJob(T, to);
  ok(T.my === to && T.spon.old && !E.sponOn(T) && !T.sec.notes.some(n => /^spon/.test(n.k)), 'a job taken mid-season: the old fixed sponsors at the new club, the old club\'s notes gone');
  const U = clone(S); const to2 = U.order.find(x => x !== U.my);
  E.takeJob(U, to2);
  ok(U.my === to2 && E.sponPending(U) && U.spon.offer.every(x => x.co.startsWith(U.clubs[to2].short.replace(/[A-Za-z・]/g, '')) || x.co.startsWith(U.clubs[to2].area)), `a job before the season: ${U.clubs[to2].short}'s own offers`);
}

/* the money over the season stays close to the old fixed sponsors (her pick, a few seasons of 鹿島 / 水戸) */
{
  const R = [];
  for (const cid of ['kashima', 'mito']) {
    const T = E.newGame(DATA, cid, 't', '2026-10-15'); T.settings.boardLv = 'easy';
    let seasons = 0;
    for (let g = 0; g < 3000 && seasons < 2; g++) {
      const st = playDay(T);
      if (st.stop === 'seasonEnd') {
        const sp = T.seasonEnd.spon, tc = T.clubs[T.my];
        if (sp) { const base = tc.fin.spon - sp.guar - sp.bonus; R.push(tc.fin.spon / (base / SP.base)); }
        E.rollover(T); if (T.fired) E.takeJob(T, T.fired.offers[0]); seasons++;
      }
    }
  }
  ok(R.length >= 3 && R.every(r => r > 0.75 && r < 1.4), `4 seasons: ${R.map(r => Math.round(r * 100) + '%').join(' ')} of the old fixed sponsors (all three missed ≈ 80%, all met ≈ 130%)`);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
