// Shortlist (players I bid on): refused bids land on it, signing takes the player off, so does retiring;
// a player who moves to another club stays on with his new club; old saves are seeded from their bids.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const S = E.newGame(DATA, 'okayama', 'テスト', '2026-10-10');
S.clubs[S.my].funds = 5e6;  // plenty of money so only the clubs and players decide
const nextDay = () => { S.date = new Date(Date.parse(S.date) + 864e5).toISOString().slice(0, 10); };
ok(E.inWindow(S.date), `transfer window open on ${S.date}`);
ok(E.shortlist(S).length === 0, 'starts empty');

// 1) low bids on stars: refused by the club (with a guide fee) or by the player -> on the list
const stars = E.marketList(S, {}).filter(p => p.club !== 'FA').slice(0, 4);
for (const p of stars) E.bid(S, p.id, 0.5);
let L = E.shortlist(S);
ok(L.length === 4, `4 refused bids -> 4 on the list (${L.length})`);
ok(L.every(e => ['club', 'player', 'thin'].includes(e.res)), 'each has a result: ' + L.map(e => e.res).join(','));
const clubRef = L.find(e => e.res === 'club');
ok(!clubRef || clubRef.guide > 0, 'club refusal keeps the guide fee');
// same day again: not a new bid
const n0 = L[0].n; E.bid(S, L[0].pid, 0.5); ok(E.shortEntry(S, L[0].pid).n === n0, 'same-day re-bid is not counted');
nextDay(); E.bid(S, stars[0].id, 0.5);
const e0 = E.shortEntry(S, stars[0].id);
ok(e0.n === 2 || E.bidBlock(S, stars[0].id), `next day the count goes up (n=${e0.n}) unless the player refused`);

// 2) sign a listed player: first a refused low bid, then a big one the next day -> off the list
const weak = S.order.filter(c => c !== S.my && E.squad(S, c).length > 24)
  .flatMap(c => E.squad(S, c).sort((a, b) => b.ovr - a.ovr).slice(16)).sort((a, b) => a.ovr - b.ovr);
let signed = null;
for (const p of weak.slice(0, 12)) {
  E.bid(S, p.id, 0.3);
  if (!E.shortEntry(S, p.id)) continue;
  nextDay();
  const r = E.bid(S, p.id, 3);
  if (r.ok) { signed = p; break; }
}
ok(!!signed, 'signed one of the listed players' + (signed ? ` (${signed.name})` : ''));
if (signed) ok(!E.shortEntry(S, signed.id) && !E.shortlist(S).some(e => e.pid === signed.id), 'signed player is off the list');

// 3) a listed player moves to another club: stays on, the list shows where he went
L = E.shortlist(S);
const mover = S.players[L.find(e => S.players[e.pid].club !== 'FA').pid];
const from = mover.club, to = S.order.find(c => c !== S.my && c !== from);
mover.club = to;
ok(E.shortlist(S).some(e => e.pid === mover.id) && E.shortEntry(S, mover.id).club === from, 'moved player stays on (bid was to ' + from + ', now ' + to + ')');

// 4) retired players drop off
const ret = S.players[E.shortlist(S)[0].pid]; ret.club = 'RET';
ok(!E.shortlist(S).some(e => e.pid === ret.id), 'retired player is off the list');

// 5) free agent: a failed signing (no money) lands on the list, signing takes him off
const fa = Object.values(S.players).find(p => p.club === 'FA');
const funds = S.clubs[S.my].funds; S.clubs[S.my].funds = 0;
E.bid(S, fa.id, 1); ok(E.shortEntry(S, fa.id) && E.shortEntry(S, fa.id).res === 'funds', 'free agent without money -> on the list (funds)');
S.clubs[S.my].funds = funds; E.bid(S, fa.id, 1); ok(!E.shortEntry(S, fa.id), 'free agent signed -> off the list');

// 6) old save (v5): seeded from the bids it already made
const old = JSON.parse(JSON.stringify(S)); delete old.shortlist; old.v = 5;
const bids = Object.keys(old._bids).filter(pid => old.players[pid] && old.players[pid].club !== old.my);
E.migrate(old, DATA);
ok(old.v >= 6 && Array.isArray(old.shortlist), 'migrated to v' + old.v);
ok(E.shortlist(old).length === bids.filter(pid => old.clubs[old.players[pid].club] || old.players[pid].club === 'FA').length, `old bids seeded (${E.shortlist(old).length})`);
console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
