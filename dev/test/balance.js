// Rating balance (2026-10-13): ceilings stop at 90 except rare talents / 三井寺 / 転生 (100+), real players have room to grow
// and close it faster, academy graduates are rated against the club's academy (not the current squad), old saves.
// The long run (does the level keep climbing?) is test/inflation.js.
const E = require('../src/engine.js'); const DATA = require('../data.json');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok ' : '  NG ') + m); if (!c) fails++; };
const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

// --- the data: real players keep some room, nobody but 三井寺 above 90
const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12');
const real = Object.values(S.players).filter(p => !p.gen);
const mid = real.filter(p => { const a = E.age(p, S.date); return a >= 24 && a <= 29; });
ok(mid.every(p => p.pot - p.ovr >= 2.5), `24〜29歳の実在選手 ${mid.length}人: 全員に伸びしろ（平均 +${avg(mid.map(p => p.pot - p.ovr)).toFixed(1)}）`);
ok(real.every(p => p.pot <= 90 || p.cap), `実在選手の最大は90まで（最高 ${Math.max(...real.filter(p => !p.cap).map(p => p.pot))}）`);
const mi = real.find(p => p.name.startsWith('三井寺'));
ok(mi && mi.pot === 88 && E.potCap(mi) === 93, `三井寺は例外: ${mi.ovr.toFixed(0)}/${mi.pot}、開花で ${E.potCap(mi)} まで`);

// --- real players grow faster than a generated player of the same age and gap
function grow(p, weeks, share) {
  const q = JSON.parse(JSON.stringify(p)); q.id = 9e6; q._share = share; const T = Object.create(S); let d = Date.parse(S.date);
  T.players = Object.assign({}, S.players, { [q.id]: q });
  for (let w = 0; w < weeks; w++) { T.date = new Date(d).toISOString().slice(0, 10); d += 7 * 864e5; E.devWeek(T, q, false); }
  return q;
}
const r26 = mid.filter(p => E.age(p, S.date) <= 27 && p.pot - p.ovr >= 4)[0];
const g26 = { ...r26, gen: true };
const dr = grow(r26, 52, 0.7).ovr - r26.ovr, dg = grow(g26, 52, 0.7).ovr - r26.ovr;
ok(dr > dg * 2 && dr >= 2, `実在 ${r26.name}（${E.age(r26, S.date)}歳 ${r26.ovr.toFixed(0)}/${r26.pot}）1季 +${dr.toFixed(1)}（同じ条件の架空選手 +${dg.toFixed(1)}）`);

// --- 転生: 100+ ceiling, grows even from the bench, gets past 97 in the attributes
S.reborn = { used: [], wait: 0, club: S.my };
const rb = E.makeReborn(S, E.LEGENDS.yokohamafm[0]);
ok(rb.pot >= 100 && E.potCap(rb) === rb.pot, `転生 ${rb.name}: ${rb.ovr.toFixed(0)}/${rb.pot}`);
const b3 = grow(rb, 52 * 3, 0.1), b7 = grow(rb, 52 * 7, 0.1), r5 = grow(rb, 52 * 5, 0.7);
ok(b3.ovr >= 80, `ベンチ中心（出場10%）でも3季で ${b3.ovr.toFixed(1)}`);
// 2026-10-16: 主力で5季は 98.8〜101.2 とぶれる（乱数の成長）ので 98.5 から
ok(b7.ovr >= 97 && r5.ovr >= 98.5, `100に届く: ベンチ中心7季 ${b7.ovr.toFixed(1)}・主力で5季 ${r5.ovr.toFixed(1)}`);
ok(Math.max(...r5.at) > 97 && r5.ovr <= rb.pot + 0.01, `能力値は97を超えられる（最高 ${Math.max(...r5.at).toFixed(0)}）、総合力は最大 ${rb.pot} まで`);
delete S.players[rb.id];

// --- academy graduates: rated against the academy, not against the squad
function intake(club, lv, n, boost) {
  const T = E.newGame(DATA, club, 't', '2026-10-12'); const mine = [], ai = [], gems = [];
  if (boost) for (const p of E.squad(T, T.my)) { p.ovr += boost; p.at = p.at.map(x => x + boost); }
  for (let i = 0; i < n; i++) {
    T.clubs[T.my].fac.youth = lv; T.board = 100;
    for (const f of T.fixtures) if (!f.cup && (f.h === T.my || f.a === T.my)) { f.played = true; f.hg = f.h === T.my ? 3 : 0; f.ag = f.a === T.my ? 3 : 0; }
    T.date = `${T.season + 1}-05-30`;
    E.endSeason(T); T.board = 100;
    const before = new Set(Object.keys(T.players));
    E.rollover(T);
    for (const p of Object.values(T.players)) if (!before.has(String(p.id)) && !p.reborn && p.gen && T.order.includes(p.club) && E.age(p, T.date) <= 18) (p.gem ? gems : p.club === T.my ? mine : ai).push(p);
    for (const p of Object.values(T.players)) if (p.club === 'FA' || !T.order.includes(p.club)) delete T.players[p.id];
  }
  return { mine, ai, gems, T };
}
const A = intake('kashima', 5, 40, 0), B = intake('kashima', 5, 40, 15);
const pa = avg(A.mine.map(p => p.pot)), pb = avg(B.mine.map(p => p.pot));
ok(Math.abs(pa - pb) < 1.5, `自クラブが強くなっても昇格選手は同じ水準（伸びしろ平均 ${pa.toFixed(1)} → 戦力+15でも ${pb.toFixed(1)}）`);
const L2 = intake('kashima', 2, 25, 0);
const p2 = avg(L2.mine.map(p => p.pot)), pai = avg(A.ai.map(p => p.pot));
console.log(`  伸びしろ平均: ユースLv2 ${p2.toFixed(1)}・Lv5 ${pa.toFixed(1)}・他クラブ ${pai.toFixed(1)}・逸材 ${avg(A.gems.concat(B.gems).map(p => p.pot)).toFixed(1)}`);
ok(pa > p2 + 2 && pa < 82 && pai > 70 && pai < 76, 'ユースのレベルで上がるが、80前後まで');
const grads = A.mine.concat(B.mine, A.ai, B.ai, L2.mine, L2.ai);
const rare = grads.filter(p => p.cap);
ok(grads.every(p => p.pot <= 90 || (p.cap && p.pot <= p.cap)), `昇格選手 ${grads.length}人: 最大90、まれな才能だけ超える`);
ok(rare.length >= 3 && rare.length / grads.length < 0.03 && rare.every(p => p.cap >= 91 && p.cap <= 95), `まれな才能 ${rare.length}人（${(rare.length / grads.length * 100).toFixed(1)}%、上限 ${[...new Set(rare.map(p => p.cap))].sort().join('/')}）`);
const gm = A.gems.concat(B.gems);
ok(gm.length && gm.every(p => p.pot >= 80 && (p.pot <= 90 || p.cap)), `逸材 ${gm.length}人: 伸びしろ ${Math.min(...gm.map(p => p.pot))}〜${Math.max(...gm.map(p => p.pot))}`);

// --- 開花 stops at the ceiling
const T = A.T; const kid = E.squad(T, T.my).find(p => p.gen && !p.cap && !p.reborn && E.age(p, T.date) <= 20);
kid.pot = 89.5; kid.bloom = 0; kid.st.apps = 10; kid.st.rt = 75; kid._share = 0.9;
for (let w = 0; w < 30; w++) E.devWeek(T, kid, false);
ok(kid.pot <= 90 + 1e-9, `開花は90で止まる（${kid.pot.toFixed(2)}）`);

// --- an old save: ceilings above 90 stop at max(90, rating), 転生 get the legend's, real players' room arrives
const O = E.newGame(DATA, 'kashima', 't', '2026-10-12');
const big = E.squad(O, O.my).filter(p => p.pos !== 'GK').slice(0, 3);
big[0].pot = 96; big[0].pot0 = 94;                                        // inflated graduate, rating 7x
big[1].pot = 95; big[1].ovr = 92.4; big[1].pot0 = 95;                     // already better than 90
const OR = E.makeReborn(Object.assign(O, { reborn: { used: [], wait: 0, club: O.my } }), E.LEGENDS.kashima[0]);
OR.pot = 88; OR.pot0 = 88; delete OR.cap;                                   // made with the old ceiling
const vet = Object.values(O.players).find(p => !p.gen && !p.cap && E.age(p, O.date) >= 27 && E.age(p, O.date) <= 29);
const vd = DATA.players.find(d => d.id === vet.id);
vet.pot = Math.round(vet.ovr); vet.pot0 = vet.pot; const vo = vet.ovr;
O.v = 7; O.dataRev = 2; for (const c of Object.values(O.clubs)) delete c.base;
E.migrate(O, DATA);
ok(big[0].pot === 90 && big[0].pot0 === 90, `旧セーブ: 伸びしろ96 → 90`);
ok(big[1].pot === 93 && big[1].ovr === 92.4, `旧セーブ: すでに92.4の選手は下げない（最大 ${big[1].pot}）`);
ok(OR.pot === E.legendOf(OR.reborn).pot && E.potCap(OR) === OR.pot && OR.pot0 === OR.pot, `旧セーブ: 転生 ${OR.name} 88 → ${OR.pot}（開花扱いにしない）`);
ok(vet.pot === vd.pot && vet.ovr === vo && vet.pot > vo + 2, `旧セーブ: 実在 ${vet.name} 伸びしろ ${Math.round(vo)} → ${vet.pot}、能力はそのまま`);
ok(Object.values(O.clubs).every(c => c.base > 60) && O.v >= 8, `旧セーブ: クラブのユース水準（鹿島 ${O.clubs.kashima.base}）`);
const om = Object.values(O.players).find(p => p.name.startsWith('三井寺'));
ok(E.potCap(om) === 93, '旧セーブ: 三井寺の上限 93');
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
