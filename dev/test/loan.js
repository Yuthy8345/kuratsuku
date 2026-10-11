// 期限付き移籍: options, loan out, growth while away (vs staying on the bench), J2 record and return at the season end;
// loanees are out of the market, AI transfers and their parent club's cup ties.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const S = E.newGame(DATA, 'okayama', 'テスト', '2026-10-10');
const young = E.squad(S, S.my).filter(p => E.age(p, S.date) <= 21 && p.pos !== 'GK').sort((a, b) => a.ovr - b.ovr);
const [lent, stay] = [young[0], young[1]];
console.log('lend', lent.name, E.age(lent, S.date) + '歳', lent.ovr.toFixed(1) + '/' + Math.round(lent.pot), '| stays', stay.name, stay.ovr.toFixed(1) + '/' + Math.round(stay.pot));
const opts = E.loanOptions(S, lent.id);
console.log('options', opts.map(o => `${S.clubs[o.cid].short} ${Math.round(o.share * 100)}%`).join(' / '));
ok(opts.length === 3 && opts[0].share >= opts[2].share, '3 J2 clubs, most playing time first');
const old = E.newGame(DATA, 'okayama', 'テスト', '2026-10-10'); old.date = '2026-10-01';
ok(!E.loanCan(old, old.players[lent.id]).ok, 'outside the window: not possible');
const vet = E.squad(S, S.my).find(p => E.age(p, S.date) >= 28); ok(!E.loanCan(S, vet).ok, 'over 23: not possible');
S.clubs[S.my].tac.bench.push(lent.id);
const r = E.loanOut(S, lent.id, opts[0].cid);
ok(r.ok && lent.club === opts[0].cid && lent.loan.from === S.my, r.msg);
ok(!E.squad(S, S.my).includes(lent) && !S.clubs[S.my].tac.bench.includes(lent.id), 'off my squad and bench');
ok(E.myLoans(S).length === 1, 'listed as my loan');
ok(!E.marketList(S, {}).includes(lent) && !E.bid(S, lent.id, 3).ok, 'not on the market, cannot be bought');
const o0 = { l: lent.ovr, lp: lent.pot, s: stay.ovr, sp: stay.pot };
// play the season out
let g = 0, cupClash = 0;
while (g++ < 5000) {
  const st = E.advance(S);
  if (st.stop === 'match') {
    const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx);
    if (fx.cup && [fx.h, fx.a].includes(lent.club) && M.h.slots.concat(M.a.slots).some(x => x.pid === lent.id) && [fx.h, fx.a].includes(lent.loan && lent.loan.from)) cupClash++;
    E.simulateFull(S, M); E.finishMatch(S, M);
  } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
  else if (st.stop === 'seasonEnd') break;
  else if (st.stop === 'fired') E.takeJob(S, S.fired.offers[0]);
}
ok(cupClash === 0, 'never played against his parent club');
ok(lent.loan && lent.club !== S.my, 'still away until the season is over');
const grewL = lent.ovr - o0.l, grewS = stay.ovr - o0.s;
console.log(`season: lent ${o0.l.toFixed(1)}→${lent.ovr.toFixed(1)} (pot ${o0.lp.toFixed(1)}→${lent.pot.toFixed(1)}) | stayed ${o0.s.toFixed(1)}→${stay.ovr.toFixed(1)} (pot ${o0.sp.toFixed(1)}→${stay.pot.toFixed(1)}, played ${Math.round((E.playShare(S, stay) || 0) * 100)}%)`);
ok(lent.pot > o0.lp, 'potential rose while playing on loan (開花)');
E.rollover(S);
ok(lent.club === S.my && !lent.loan, 'back at the end of the season');
const h = lent.hist[0]; ok(h && h.c === opts[0].cid && h.apps > 0, `J2 record kept: ${h && h.apps}試合 ${h && h.g}得点`);
ok(S.news.some(n => n.text.includes(lent.name) && n.text.includes('復帰')), 'news on his return');
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
