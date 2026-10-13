// 転生選手: not in the first season at a club, a draw each season after that (more after a good season / titles), certain
// after REBORN.pity misses, each legend once, the guarantee restarts at a new club, the legend's number, traits (大舞台に強い,
// no unsolicited bids, fans upset when he is sold, a few more fans), and every J1 club has at least one legend.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const fresh = (club) => { const S = E.newGame(DATA, club || 'yokohamafm', 't', '2026-10-12'); return S; };
const seasonDone = (S, verdict, cups) => { S.history.unshift({ season: 'x', club: S.my }); return { verdict, cups: cups || null }; };

ok(DATA.clubs.every(c => (E.LEGENDS[c.id] || []).length), 'every J1 club has a legend');
const all = Object.values(E.LEGENDS).flat();
ok(new Set(all.map(l => l.id)).size === all.length && all.every(l => E.DP_CAT[l.pp] && l.pot >= 100 && l.pot <= 110 && l.epi && l.line && l.era), `${all.length} legends, ids unique, positions valid`);
const real = new Set(DATA.players.map(p => p.name));
ok(all.every(l => !real.has(l.name)), 'made-up names (none is a registered player)');

// not in the first season
let S = fresh(); S.reborn = { used: [], wait: 5, club: S.my };
ok(E.rebornCheck(S, { verdict: 'met' }) === null, 'no legend while it is still my first season at the club');
// guaranteed after `pity` misses
S = fresh(); S.reborn = { used: [], wait: E.REBORN.pity, club: S.my };
let p = E.rebornCheck(S, seasonDone(S, 'missed'));
ok(p && p.reborn && E.age(p, S.date) <= 17 && p.club === S.my && S.reborn.show === p.id && S.reborn.wait === 0, `guaranteed: ${p && p.name} (${p && p.pp}, ${p && p.ovr.toFixed(0)}/${p && p.pot})`);
ok(E.bigGame(p), '転生 → 大舞台に強い');
const L = E.legendOf(p.reborn);
ok(p.pp === L.pp && p.pot === L.pot && E.potCap(p) === L.pot && (L.sty ? p.sty === L.sty : true), 'position, potential and style from the legend');
// chance: ~25% after a poor season, higher after meeting the target and winning a cup
function rate(verdict, cups, n) {
  let hit = 0;
  for (let i = 0; i < n; i++) { const T = fresh(); T.reborn = { used: [], wait: 0, club: T.my }; if (E.rebornCheck(T, seasonDone(T, verdict, cups))) hit++; }
  return hit / n;
}
const r0 = rate('missed', null, 300), r1 = rate('met', { ec: { champ: 'yokohamafm' } }, 300);
console.log(`  chance: poor season ${(r0 * 100).toFixed(0)}% | target met + 天皇杯 ${(r1 * 100).toFixed(0)}%`);
ok(r0 > 0.15 && r0 < 0.36 && r1 > r0 + 0.2, 'a good season with a title makes it likelier');
// each legend once, then nobody
S = fresh(); S.reborn = { used: [], wait: 9, club: S.my };
const got = [];
for (let i = 0; i < 6; i++) { S.reborn.wait = 9; const q = E.rebornCheck(S, seasonDone(S, 'met')); if (q) got.push(q.reborn); }
ok(got.length === E.LEGENDS.yokohamafm.length && new Set(got).size === got.length, `all ${got.length} 横浜FM legends once each, then none`);
// a new club: the wait starts over, the first season there does not count
S = fresh(); S.reborn = { used: [], wait: 5, club: 'kashima' }; S.history = [{ club: 'kashima' }];
ok(E.rebornCheck(S, { verdict: 'met' }) === null && S.reborn.wait === 0 && S.reborn.club === S.my, 'moving to another club resets the guarantee');
// the legend's number: handed over, the wearer takes the old one
S = fresh(); S.reborn = { used: ['yfm2', 'yfm3', 'yfm4'], wait: 9, club: S.my };
p = E.rebornCheck(S, seasonDone(S, 'met'));  // only 外町 left: number 25
const holder = E.squad(S, S.my).find(q => q.id !== p.id && q.num === 25);
const mine = p.num; const r = E.rebornNum(S, p.id);
ok(r.ok && p.num === 25 && (!holder || holder.num === mine), `背番号25: ${p.name} ${mine}→${p.num}${holder ? `, ${holder.name} 25→${holder.num}` : ''}`);
// no unsolicited bids, fans upset when sold
const bids = []; for (let i = 0; i < 3000; i++) { const before = S.inbox.length; E.nextDay(S); if (S.inbox.length > before && S.inbox[0].type === 'offer') bids.push(S.inbox[0].pid); if (S.fired) break; }
ok(!bids.includes(p.id), `no unsolicited bids for him (${bids.length} bids for others)`);
S.inbox.unshift({ id: 9999, type: 'offer', pid: p.id, from: 'kashima', fee: 50000, d: S.date, exp: S.date, seen: true, done: false });
S.board = 60; const b0 = S.board; E.acceptOffer(S, 9999);
ok(S.board === Math.max(0, b0 - 10) && /落胆/.test(S.news[0].text), `sold → フロントの信頼 ${b0}→${S.board}`);
// rollover path: a forced arrival through the real season change
S = fresh(); S.reborn = { used: [], wait: E.REBORN.pity, club: S.my }; S.board = 80;
for (const f of S.fixtures) if (!f.cup) { f.played = true; const me = f.h === S.my ? 'hg' : f.a === S.my ? 'ag' : null; f.hg = me === 'hg' ? 2 : 1; f.ag = me === 'ag' ? 2 : 1; }
S.date = '2027-05-30'; E.endSeason(S); E.rollover(S);
const arrived = Object.values(S.players).find(x => x.reborn && x.club === S.my);
ok(!S.fired && arrived && S.reborn.show === arrived.id, `through rollover: ${arrived && arrived.name} joins for ${E.seasonLabel(S.season)}`);
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
