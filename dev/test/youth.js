// Youth development: playing time drives growth, a prodigy's big gap closes over seasons (GROW.gMax), 開花 raises the
// ceiling only when he plays, the 若手育成 team menu, ユースの逸材 by academy level, the growth chart + monthly report,
// and the data revision (三井寺 & co.) reaching old saves. (Loans: test/loan.js, screens: test/youth.py)
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const find = (S, nm) => Object.values(S.players).find(p => p.name.includes(nm));
const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12');

// --- the data: 三井寺 (16) is rated like the starter he is, with a technician's profile
const mi = find(S, '三井寺');
ok(E.age(mi, S.date) === 16 && mi.ovr >= 68 && mi.pot >= 85, `三井寺 ${E.age(mi, S.date)}歳 ${mi.ovr.toFixed(1)}/${mi.pot} (data)`);
ok(mi.sty === 'tech' && mi.at[1] > mi.at[5], `style tech: パス ${mi.at[1].toFixed(0)} > パワー ${mi.at[5].toFixed(0)}`);

// --- playing time: one season ahead, regular vs bench
const yr = (p, sh) => E.growthOutlook(S, p, sh, 52);
for (const nm of ['三井寺', '森 壮一朗', '嶋本', '荒木 琉偉']) {
  const p = find(S, nm); if (!p) continue;
  const b = yr(p, 0).ovr - p.ovr, r = yr(p, 0.85).ovr - p.ovr;
  console.log(`  ${p.name} ${E.age(p, S.date)}歳 ${p.ovr.toFixed(0)}/${p.pot}: bench +${b.toFixed(1)} / regular +${r.toFixed(1)}`);
  ok(r >= 2 * b && b >= 1.5, `${p.name}: a regular grows at least twice as fast as on the bench`);
}
const g16 = yr(mi, 0.85).ovr - mi.ovr;
ok(g16 >= 6 && g16 <= 10, `prodigy as a regular: +${g16.toFixed(1)} in a season (a big gap closes over a few seasons)`);
const old = Object.values(S.players).find(p => p.club === S.my && E.age(p, S.date) >= 27 && p.pot - p.ovr > 1);
if (old) ok(yr(old, 0.85).ovr - old.ovr < 2, `${old.name} (${E.age(old, S.date)}): veterans barely move (+${(yr(old, 0.85).ovr - old.ovr).toFixed(1)})`);

// --- 開花: the ceiling rises only for young players who play
ok(yr(mi, 0.85).pot > mi.pot + 1 && yr(mi, 0).pot === mi.pot, `開花: pot ${mi.pot} → ${yr(mi, 0.85).pot.toFixed(1)} as a regular, unchanged on the bench`);

// --- 若手育成: young players faster, the rest a bit slower
const vet = Object.values(S.players).filter(p => p.club === S.my && E.age(p, S.date) >= 24 && p.pot - p.ovr > 2)[0];
const pv = (p, t) => { S.training = t; const r = E.devPreview(S, p).dOvr; S.training = 'bal'; return r; };
ok(pv(mi, 'youth') > pv(mi, 'bal') * 1.3, `若手育成: 三井寺 ${pv(mi, 'bal').toFixed(3)} → ${pv(mi, 'youth').toFixed(3)} a week`);
if (vet) ok(pv(vet, 'youth') < pv(vet, 'bal'), `若手育成: ${vet.name} (${E.age(vet, S.date)}) ${pv(vet, 'bal').toFixed(3)} → ${pv(vet, 'youth').toFixed(3)}`);

// --- monthly: chart point + 若手の成長レポート (stops nothing: seen=true)
S.date = '2026-09-30'; S.inbox = [];
for (const p of E.squad(S, S.my)) p.trk = [['2026-09', Math.round(p.ovr * 10) / 10 - 1, p.pot]];
E.nextDay(S);  // October 1st: the monthly report
const rep = S.inbox.find(x => x.type === 'youth');
ok(rep && rep.seen && rep.rows.length >= 5 && rep.rows.every(r => E.age(S.players[r.pid], S.date) <= 23), `youth report: ${rep ? rep.rows.length : 0} young players, month ${rep && rep.m}`);
ok(mi.trk.some(x => x[0] === '2026-10'), 'growth chart got this month\'s point');

// --- ユースの逸材: more often with a better academy; 16-17 with 80+ potential
function seasons(lv, n) {
  const T = E.newGame(DATA, 'kashima', 't', '2026-10-12'); const gems = [];
  for (let i = 0; i < n; i++) {
    T.clubs[T.my].fac.youth = lv; T.board = 100;
    for (const f of T.fixtures) if (!f.cup && (f.h === T.my || f.a === T.my)) { f.played = true; f.hg = f.h === T.my ? 3 : 0; f.ag = f.a === T.my ? 3 : 0; }
    T.date = `${T.season + 1}-05-30`;  // the last matchday
    E.endSeason(T); T.board = 100;
    const before = new Set(Object.keys(T.players));
    E.rollover(T);
    for (const p of Object.values(T.players)) if (!before.has(String(p.id)) && p.gem) gems.push({ mine: p.club === T.my, age: E.age(p, T.date), pot: p.pot });
    // keep the save small between seasons
    for (const p of Object.values(T.players)) if (p.club === 'FA' && !p.gem) delete T.players[p.id];
  }
  return gems;
}
const g1 = seasons(1, 50), g5 = seasons(5, 50);
const m1 = g1.filter(g => g.mine).length, m5 = g5.filter(g => g.mine).length, ai = g1.filter(g => !g.mine).length;
console.log(`  gems in 50 seasons: my club Lv1 ${m1}, Lv5 ${m5} | other clubs ${ai} (${(ai / 50).toFixed(1)}/season)`);
ok(m5 > m1 && m5 >= 8 && m1 <= 12, 'a better youth academy finds more gems');
const all = g1.concat(g5);
ok(all.every(g => g.age >= 16 && g.age <= 17 && g.pot >= 80), `gems are 16-17 with potential 80+ (ages ${[...new Set(all.map(g => g.age))].sort().join('/')}, pot ${Math.min(...all.map(g => g.pot))}〜${Math.max(...all.map(g => g.pot))})`);

// --- an old save (data rev 1): the re-rated youngsters arrive, growth kept, not counted as 開花
const O = E.newGame(DATA, 'urawa', 't', '2026-10-12');
const om = find(O, '三井寺'); const fix = DATA.players.find(d => d.id === om.id).fix;
om.at = om.at.map(x => x - fix.d + 0.8); om.ovr = E.calcOvr(om); om.pot = 60; om.pot0 = 60; delete om.sty; O.dataRev = 1;
const before = om.ovr;
E.migrate(O, DATA);
ok(Math.abs(om.ovr - (before + fix.d)) < 0.6 && om.pot >= 85 && O.dataRev === DATA.rev, `old save: 三井寺 ${before.toFixed(1)} → ${om.ovr.toFixed(1)} (pot ${om.pot}), the growth he had is kept`);
ok(Math.round(om.pot0) === Math.round(om.pot), 'the correction is not shown as 開花');
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
