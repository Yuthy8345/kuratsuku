// 放出不可 (p.keep): no unsolicited bids for the player, pending offers are declined,
// exclusive with 放出リスト, cleared when he leaves or the manager changes clubs, not reset at window end.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const S = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-10-10');
const sq = () => E.squad(S, S.my).sort((a, b) => b.ovr - a.ovr);
const top = sq().slice(0, 6), star = top[0], other = sq()[10];
const pending = pid => S.inbox.filter(x => x.type === 'offer' && x.pid === pid && !x.done);

// 1) exclusive with the transfer list
E.setListed(S, star.id, true); ok(star.listed && !star.keep, 'listed');
let r = E.setKeep(S, star.id, true); ok(star.keep && !star.listed && r.wasListed, '放出不可 takes him off the list');
r = E.setListed(S, star.id, true); ok(star.listed && !star.keep && r.wasKeep, 'listing again clears 放出不可');
E.setListed(S, star.id, false); ok(!star.listed && !star.keep, 'off the list, not 放出不可');
ok(!E.setKeep(S, Object.values(S.players).find(p => p.club !== S.my && S.clubs[p.club]).id, true).ok, "can't mark another club's player");

// 2) pending offers are declined when he becomes 放出不可
S.inbox.unshift({ id: S.nextInboxId++, type: 'offer', pid: star.id, from: S.order.find(c => c !== S.my), fee: 100000, d: S.date, exp: S.date, seen: false, done: false });
r = E.setKeep(S, star.id, true); ok(r.n === 1 && pending(star.id).length === 0, `pending offer declined (n=${r.n})`);
ok(S.inbox.find(x => x.pid === star.id && x.type === 'offer').result === 'rejected', 'declined offer is marked rejected');

// 3) no unsolicited bids for 放出不可 players over many window days
for (const p of top) E.setKeep(S, p.id, true);
const keepIds = new Set(top.map(p => p.id));
let gotKeep = 0, days = 0;
// the unsolicited-bid roll passes on ~1.2% of days and always targets the top 6 -> ~48 tries
for (let i = 0; i < 4000; i++) {
  E.transferDay(S); days++;
  for (const it of S.inbox) if (it.type === 'offer' && !it.done) { if (keepIds.has(it.pid)) gotKeep++; it.done = true; }
}
ok(gotKeep === 0, `no offers for 放出不可 players in ${days} transfer days (${gotKeep})`);
// control: without the flag the same players do get bids
for (const p of top) E.setKeep(S, p.id, false);
let gotFree = 0;
for (let i = 0; i < 4000; i++) { E.transferDay(S); for (const it of S.inbox) if (it.type === 'offer' && !it.done) { if (keepIds.has(it.pid)) gotFree++; it.done = true; } }
ok(gotFree > 0, `control: same players get bids without the flag (${gotFree})`);

// 4) survives the end of the window (the list does not), cleared when he leaves
E.setKeep(S, star.id, true); E.setListed(S, other.id, true);
S.date = E.windowEnd(S.date); E.nextDay(S);
ok(!E.inWindow(S.date) && star.keep && !other.listed, `window closed (${S.date}): 放出不可 stays, the list is cleared`);
const buyer = S.order.find(c => c !== S.my);
S.inbox.unshift({ id: S.nextInboxId++, type: 'offer', pid: star.id, from: buyer, fee: 1, d: S.date, exp: S.date, seen: false, done: false });
E.acceptOffer(S, S.inbox[0].id);
ok(star.club === buyer && !star.keep, 'sold -> flag cleared');

// 5) old saves: no flag = normal
const old = JSON.parse(JSON.stringify(S)); for (const p of Object.values(old.players)) delete p.keep;
E.migrate(old, DATA); ok(Object.values(old.players).every(p => !p.keep), 'old save: nobody is 放出不可');

console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
