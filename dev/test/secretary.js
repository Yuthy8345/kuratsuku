// 秘書 (2026-10-15): the stand-ins she suggests (fit, same role first, a goalkeeper for a goalkeeper, the bench filled from
// the reserves), nothing changes until the manager taps (one place / all), she remembers who was swapped out and offers to
// put him back when he is fit (injury, suspension, national team), the month's summary, notes that stop the days, her
// name, old saves (v12 and a save made with the engine of be3e2da).
// usage: node dev/test/secretary.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
let seed = 5; Math.random = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const playDay = S => {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  return st;
};
const fresh = () => { for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(S, S.my); S.sec.back = []; };

/* new game */
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-14');
ok(S.v >= 13 && E.secName(S) === 'あき' && E.secNotes(S)[0].k === 'hello' && E.secNotes(S).every(n => n.k === 'hello' || n.k === 'spon'), 'new game: v13+, the secretary あき says hello (the sponsor offers under it, 2026-10-15)');
ok(!E.secFix(S).items.length && !E.secReturns(S).length, 'nothing to fix at the start');
const c = S.clubs[S.my]; const F = () => E.FORMATIONS[c.tac.form];
const comp = E.nextComp(S, S.my);

/* players who can't play: injury, suspension, national team, a goalkeeper */
fresh();
const gkI = F().findIndex(s => s[0] === 'GK');
const cbI = F().findIndex(s => s[0] === 'CB');
const fwI = F().length - 1;
const gk = S.players[c.tac.xi[gkI]], cb = S.players[c.tac.xi[cbI]], fw = S.players[c.tac.xi[fwI]], bp = S.players[c.tac.bench.find(id => S.players[id].pos !== 'GK')];
gk.inj = 6; E.addBan(cb, { c: comp, n: 1, y: 1 }); fw.away = { cc: 'JPN', to: E.D.add(S.date, 5) }; bp.inj = 3;
const xi0 = c.tac.xi.slice(), b0 = c.tac.bench.slice();
const fx = E.secFix(S);
ok(fx.items.length === 4 && E.lineupIssues(S, S.my).block, `4 places to fix (GK, CB, ${E.ROLE[F()[fwI][0]].jp}, bench)`);
ok(c.tac.xi.join() === xi0.join() && c.tac.bench.join() === b0.join(), 'suggesting changes nothing');
const fit = p => p.club === S.my && E.available(p, comp);
ok(fx.items.every(it => it.cand && fit(S.players[it.cand]) && !xi0.includes(it.cand)), 'every stand-in can play and is not starting');
ok(new Set(fx.items.map(it => it.cand).concat(fx.items.map(it => it.fill).filter(Boolean))).size === fx.items.length + fx.items.filter(it => it.fill).length, 'no player suggested twice');
const gkIt = fx.items.find(it => it.out === gk.id);
ok(gkIt && S.players[gkIt.cand].pos === 'GK' && gkIt.i === gkI, 'a goalkeeper for the goalkeeper');
const val = (p, role) => E.effective(p, role) - Math.max(0, 72 - p.cond) * 0.4;
const cbIt = fx.items.find(it => it.out === cb.id);
const pool = E.squad(S, S.my).filter(p => fit(p) && !xi0.includes(p.id) && !fx.items.some(it => it !== cbIt && (it.cand === p.id || it.fill === p.id)));
ok(cbIt && pool.every(p => val(p, 'CB') <= val(S.players[cbIt.cand], 'CB') + 1e-9) && cbIt.apt === Math.round(E.roleApt(S.players[cbIt.cand], 'CB')), `the CB stand-in is the best fit for the role (${S.players[cbIt.cand].name}, 適性${cbIt.apt})`);
ok(fx.items.find(it => it.out === fw.id).why === 'nt' && gkIt.why === 'inj' && cbIt.why === 'sus', 'reasons: national team / injury / suspension');
const bIt = fx.items.find(it => it.k === 'bench');
ok(bIt && bIt.out === bp.id && !c.tac.bench.includes(bIt.cand) && S.players[bIt.cand].pos === bp.pos, 'bench: a reserve of the same position');
ok(fx.items.filter(it => it.from === 'bench').every(it => it.fill && !b0.includes(it.fill)), 'a bench player moving up leaves his place to a reserve');

/* one tap: one place */
const one = E.secSwap(S, cbIt.id);
ok(one && c.tac.xi[cbI] === cbIt.cand && c.tac.xi.filter((id, i) => i !== cbI).join() === xi0.filter((id, i) => i !== cbI).join(), 'one place: only that place changes');
ok(!c.tac.bench.includes(cb.id) && !c.tac.xi.includes(cb.id) && c.tac.bench.length === E.BENCH_SIZE && new Set(c.tac.bench).size === c.tac.bench.length, 'the suspended player leaves the team, the bench stays full');
ok(E.secFix(S).items.length === 3 && E.lineupIssues(S, S.my).block, 'three left');
ok(S.sec.back.length === 1 && S.sec.back[0].out === cb.id && S.sec.back[0].sub === cbIt.cand && S.sec.back[0].why === 'sus', 'she remembers who stood in for whom');

/* one tap: all */
const all = E.secSwapAll(S);
ok(all.length === 3 && !E.lineupIssues(S, S.my).block, 'おすすめどおり: everything fixed, ready to play');
ok(c.tac.xi.every(id => fit(S.players[id])) && c.tac.bench.every(id => fit(S.players[id])) && new Set(c.tac.xi.concat(c.tac.bench)).size === 11 + c.tac.bench.length, 'everyone in the team can play, nobody twice');
ok(S.sec.back.length === 4, 'four memories');
ok(!E.secReturns(S).length, 'nobody back yet');

/* back: suspension served after the match, injuries heal, the national team goes home */
const seen = {};
for (let d = 0; d < 20; d++) { playDay(S); if (fw.away && S.date > fw.away.to) delete fw.away; for (const m of E.secReturns(S)) seen[m.out] = seen[m.out] || S.date; }
ok(seen[cb.id] && seen[gk.id] && seen[fw.id] && seen[bp.id], 'all four come back: suspension, injury, national team, bench');
const rs = E.secReturns(S);
const mcb = rs.find(m => m.out === cb.id);
if (mcb) {
  const sub = mcb.sub, i = c.tac.xi.indexOf(sub), b1 = c.tac.bench.slice();
  const r = E.secRestore(S, cb.id);
  ok(r && c.tac.xi[i] === cb.id && (r.to === 'bench' ? c.tac.bench.includes(sub) : !c.tac.bench.includes(sub)), `戻す: back in his place, the stand-in to the ${r && r.to}`);
  ok(c.tac.bench.length <= E.BENCH_SIZE && new Set(c.tac.xi.concat(c.tac.bench)).size === 11 + c.tac.bench.length && !S.sec.back.some(m => m.out === cb.id), 'no duplicates, memory gone');
} else ok(false, 'CB memory');
const mk = E.secReturns(S)[0];
if (mk) { const xi1 = c.tac.xi.slice(); E.secKeep(S, mk.out); ok(c.tac.xi.join() === xi1.join() && !E.secReturns(S).some(m => m.out === mk.out), 'このまま: nothing changes, she forgets'); }

/* the manager swaps by hand (the app calls secTook): remembered too; a stand-in replaced passes the memory on */
fresh();
const P = S.players[c.tac.xi[cbI]]; P.inj = 4;
const Q = E.squad(S, S.my).find(p => fit(p) && !c.tac.xi.includes(p.id) && p.pos === 'DF');
c.tac.xi[cbI] = Q.id; c.tac.bench = c.tac.bench.filter(id => id !== Q.id); E.secTook(S, P.id, Q.id, 'xi');
ok(S.sec.back.some(m => m.out === P.id && m.sub === Q.id), 'a swap by hand is remembered');
Q.inj = 10;
E.secSwapAll(S);
const R = c.tac.xi[cbI];
ok(R !== Q.id && S.sec.back.some(m => m.out === P.id && m.sub === R), 'the stand-in hurt and replaced: the memory follows to the new stand-in');
for (let d = 0; d < 6; d++) playDay(S);
const rP = E.secRestore(S, P.id);
ok(rP && c.tac.xi[cbI] === P.id, 'chain: the first player goes back where the team is now');

/* a player fit for the next match is no problem: league ban before a cup tie */
fresh();
const nx = S.fixtures.filter(f => !f.played && (f.h === S.my || f.a === S.my)).sort((a, b) => a.date.localeCompare(b.date));
const cupF = nx.find(f => f.cup), lgF = nx.find(f => !f.cup);
if (cupF && lgF) {
  const p = S.players[c.tac.xi[1]]; E.addBan(p, { c: 'lg', n: 1, y: 1 });
  ok(!E.secFix(S, E.compOf(cupF)).items.length && E.secFix(S, 'lg').items.some(it => it.out === p.id), 'banned in the league: nothing for the cup tie, a stand-in for the league');
  delete p.bans;
}

/* an empty place, and nobody left to play */
fresh();
c.tac.xi[2] = null;
const e = E.secFix(S).items;
ok(e.length === 1 && e[0].id === 'e2' && !e[0].out && e[0].cand, 'an empty place gets a player');
E.secSwapAll(S); ok(c.tac.xi[2] && !E.lineupIssues(S, S.my).block && !S.sec.back.length, 'filled (nobody to remember)');
fresh();
const keep = new Set(c.tac.xi);
for (const p of E.squad(S, S.my)) if (!keep.has(p.id)) p.inj = 30;
const lone = S.players[c.tac.xi[4]]; lone.inj = 5;
const nf = E.secFix(S).items;
ok(nf.filter(it => it.k === 'xi').length === 1 && nf.every(it => it.cand === null), `nobody fit left: no stand-in (and the injured bench goes: ${nf.length - 1})`);
E.secSwap(S, nf.find(it => it.k === 'xi').id); ok(c.tac.xi[4] === null, '外す: the place is left empty');
E.secSwapAll(S); ok(!E.lineupIssues(S, S.my).block && !c.tac.bench.length, 'the injured bench goes too: the match can be played with ten');
for (const p of E.squad(S, S.my)) p.inj = 0;

/* the month's summary (doesn't stop the days); a note that stops them */
fresh();
let stopped = null;
for (let d = 0; d < 60 && !(E.D.d(S.date) === 1 && S.sec.notes.some(n => n.k === 'month')); d++) { const st = playDay(S); if (st.stop === 'sec') stopped = st; }
const mn = S.sec.notes.find(n => n.k === 'month');
ok(mn && mn.data.m === E.D.m(S.date) && 'rank' in mn.data && mn.data.funds === c.funds && 'big' in mn.data && 'youth' in mn.data, `month summary on the 1st (${S.date}: ${JSON.stringify(mn && mn.data)})`);
ok(!stopped && !S.sec.stop, 'the summary does not stop the days');
ok(mn.data.big === null || (S.fixtures.find(f => f.id === mn.data.big.fid) && mn.data.big.tag), 'the next big match has a fixture and a tag');
for (let d = 0; d < 40 && S.sec.notes.find(n => n.k === 'month').data.m === mn.data.m; d++) playDay(S);
const mn2 = S.sec.notes.filter(n => n.k === 'month');
ok(mn2.length === 1 && mn2[0].data.m !== mn.data.m, 'next month replaces it (one summary)');
ok(mn2[0].data.delta === mn2[0].data.funds - mn.data.funds, `money: the change over the month (${mn2[0].data.delta})`);
E.secSeen(S); ok(S.sec.notes.every(n => n.seen), 'seen');
const t = E.secPost(S, 'test', { text: 'キャンプの行き先を決めてください' }, { stop: true });
ok(E.advance(S, 3).stop === 'sec' && !S.sec.stop, 'a note with stop: true stops the days once');
E.secDone(S, t.id); ok(!S.sec.notes.some(n => n.id === t.id), 'done: the note goes');

/* her name */
ok(E.setSecName(S, '  みさき  ') === 'みさき' && E.secName(S) === 'みさき', 'rename');
ok(E.setSecName(S, 'あいうえおかきくけこ') === 'あいうえおかきく', `at most ${E.SEC.max} characters`);
ok(E.setSecName(S, '   ') === 'あき', 'empty: あき');

/* season end and a new job forget the stand-ins */
S.sec.back = [{ out: 1, sub: 2, k: 'xi', d: S.date }];
const other = S.order.find(id => id !== S.my); E.takeJob(S, other);
ok(!S.sec.back.length && S.sec.f0 === S.clubs[other].funds, 'new job: memories go, the money count starts again');

/* old saves */
const O = clone(E.newGame(DATA, 'kashima', 'テスト', '2026-10-14')); delete O.sec; O.v = 12;
const M = E.migrate(O, DATA);
ok(M.v >= 13 && E.secName(M) === 'あき' && M.sec.notes.filter(n => n.k !== 'town').length === 1 && M.sec.notes[0].k === 'hello' && M.sec.notes[0].data.old && M.sec.f0 === M.clubs[M.my].funds, 'v12 → v13: she introduces herself (first; the hometown note of v15 under it)');
E.migrate(M, DATA); ok(M.sec.notes.filter(n => n.k === 'hello').length === 1 && M.sec.notes.length === 2, 'migrating twice: one hello');
{
  const tmp = path.join(require('os').tmpdir(), 'engine_be3e2da_' + process.pid + '.js');
  let old = null;
  try { fs.writeFileSync(tmp, execSync('git show be3e2da:dev/src/engine.js', { cwd: path.join(__dirname, '..', '..') })); old = require(tmp); } catch (e) { console.log('(skip be3e2da save: no git history)'); }
  if (old) {
    const A = old.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-14');
    for (let g = 0; g < 400 && A.date < '2026-09-20'; g++) {
      const st = old.advance(A, 1);
      if (st.stop === 'match') { const f = A.fixtures.find(y => y.id === st.fid); old.autoLineup(A, A.my); const MM = old.createMatch(A, f); old.simulateFull(A, MM); old.finishMatch(A, MM); }
      else if (st.stop === 'inbox') A.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') old.rejectOffer(A, y.id); });
    }
    const B = E.migrate(clone(A), DATA);
    ok(B.v >= 13 && B.sec && B.sec.notes[0].k === 'hello', `be3e2da save (${A.date}): migrated to v13+`);
    const bc = B.clubs[B.my]; const p = B.players[bc.tac.xi[3]]; p.inj = 5;
    const n = E.secSwapAll(B).length;
    ok(n === 1 && !E.lineupIssues(B, B.my).block, 'be3e2da save: one tap fixes the team');
    let err = null, matches = 0;
    try { for (let d = 0; d < 45; d++) { const st = playDay(B); if (st.stop === 'match') matches++; if (E.lineupIssues(B, B.my).block) E.secSwapAll(B); for (const m of E.secReturns(B)) E.secRestore(B, m.out); } } catch (e) { err = e; }
    ok(!err && matches > 3 && B.sec.notes.some(x => x.k === 'month'), `be3e2da save: 45 days played (${matches} matches), a month summary${err ? ' ' + err.stack : ''}`);
    fs.unlinkSync(tmp);
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
