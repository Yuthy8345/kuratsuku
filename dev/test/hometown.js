// ホームタウン (2026-10-15, 作業4): the supporters (c.fans) and the crowd, the buildings (cost, works, one at a time,
// upkeep, effects), the AI clubs' spare money, a couple of seasons of money, old saves (v14, and saves made with the
// engines of be3e2da and 1addd7a).
// usage: node dev/test/hometown.js
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
const T = E.TOWN, B = T.b;
const FB = [0, 8000, 13000, 19000, 25000, 34000];
const oku = v => E.money(v);

/* a new game */
const S = E.newGame(DATA, 'kashiwa', 'テスト', '2026-10-15');
const c = S.clubs[S.my];
ok(S.v >= 15, `new game: S.v ${S.v}`);
ok(Object.values(S.clubs).filter(x => !x.ab).every(x => x.fans === FB[x.fan] && x.fan0 === FB[x.fan] && x.fanP === x.pres), 'every club starts with the supporters of its fan level (8,000〜34,000)');
ok(!('stadium' in E.FACILITY) && Object.values(S.clubs).every(x => !('stadium' in x.fac)) && !E.upgrade(S, 'stadium').ok, 'スタジアム設備 is gone from the facilities (4 left)');
ok(E.gatePer(c) === T.per && E.townUpkeep(c) === 0 && E.fansTarget(c) === c.fans, `no buildings: ${T.per * 10000}円 a spectator, no upkeep, the supporters at their level`);
ok(TOWN_OK(), 'the table: 8 kinds, expansion 15〜40億 in 6〜12 months, the one-offs cheaper');
function TOWN_OK() { return Object.keys(B).length === 8 && B.exp.cost[0] === 150000 && B.exp.cost[B.exp.cost.length - 1] === 400000 && B.exp.mo[0] === 6 && B.exp.mo[B.exp.mo.length - 1] === 12 && Object.entries(B).every(([k, b]) => k === 'exp' || (b.cost < 150000 && b.mo >= 2 && b.up > 0)); }

/* the crowd: the supporters, the stadium, the buildings, the works */
{
  const X = clone(S), xc = X.clubs[X.my], opp = 'mito';
  const mean = n => { let a = 0; for (let i = 0; i < n; i++) a += E.attendance(X, X.my, opp); return a / n; };
  xc.fans = 100000;
  ok(E.attendance(X, X.my, opp) === Math.round(xc.cap * 0.97), `more supporters than seats: a full house (${Math.round(xc.cap * 0.97).toLocaleString()})`);
  xc.fans = 10000; const m0 = mean(3000);
  ok(m0 > 9500 && m0 < 10500, `10,000 supporters: about 10,000 come (${Math.round(m0)})`);
  xc.fans = 12000; const m1 = mean(3000);
  ok(Math.abs(m1 / m0 - 1.2) < 0.03, `20% more supporters, 20% more people (${(m1 / m0).toFixed(3)})`);
  E.townOf(xc).b.roof = X.date; E.townOf(xc).b.food = X.date; const m2 = mean(3000);
  ok(Math.abs(m2 / m1 - (1 + B.roof.att + B.food.att)) < 0.03, `屋根と大型ビジョン + スタジアムグルメ: +${Math.round((B.roof.att + B.food.att) * 100)}% (${(m2 / m1).toFixed(3)})`);
  xc.fans = 100000; xc.town.job = { k: 'exp', from: X.date, to: E.D.add(X.date, 100), cost: 0 };
  ok(E.attendance(X, X.my, opp) === Math.round(xc.cap * 0.97 * T.works), `while a stand is being built: ${Math.round((1 - T.works) * 100)}% fewer (${E.attendance(X, X.my, opp).toLocaleString()})`);
  xc.town.job = { k: 'shop', from: X.date, to: E.D.add(X.date, 100), cost: 0 };
  ok(E.attendance(X, X.my, opp) === Math.round(xc.cap * 0.97), 'other works don\'t take seats');
}

/* building: money, one job at a time, the works, completion, upkeep */
{
  const X = clone(S), xc = X.clubs[X.my];
  xc.funds = 100000;
  const r0 = E.townCan(X, 'exp');
  ok(!r0.ok && r0.short && r0.cost === B.exp.cost[0], `not enough money: ${r0.msg}`);
  xc.funds = 500000; const f0 = xc.funds, fac0 = xc.fin.fac, cap0 = xc.cap;
  const r1 = E.townBuild(X, 'exp');
  ok(r1.ok && xc.funds === f0 - B.exp.cost[0] && xc.fin.fac === fac0 + B.exp.cost[0], `${r1.msg}; paid ${oku(B.exp.cost[0])} up front (施設投資)`);
  ok(xc.town.job.to === '2027-02-07' && xc.town.job.step === 1, `ready in ${B.exp.mo[0]} months (${xc.town.job.to})`);
  const r2 = E.townBuild(X, 'shop');
  ok(!r2.ok && r2.busy, `one job at a time: ${r2.msg}`);
  ok(X.news[0].text.includes('工事を始めた'), `news: ${X.news[0].text}`);
  // play until it is ready: the home crowd is smaller meanwhile
  let done = null, sec = false, n = 0;
  for (let g = 0; g < 400 && !done; g++) { const day = X.date; const st = playDay(X); if (!xc.town.job) { done = day; sec = st.stop === 'sec'; } n++; }
  const home = X.fixtures.filter(f => f.played && !f.cup && f.h === X.my);
  ok(done && X.date >= '2027-02-07' && xc.cap === cap0 + B.exp.seats && xc.town.exp === 1, `ready on ${X.date}: ${cap0.toLocaleString()} → ${xc.cap.toLocaleString()} seats`);
  ok(home.length > 3 && home.every(f => f.att <= Math.round(cap0 * 0.97 * T.works)), `the ${home.length} home league matches during the works: at most ${Math.round(cap0 * 0.97 * T.works).toLocaleString()} (${home.map(f => f.att).join(' ')})`);
  ok(sec && E.secNotes(X)[0].k === 'built' && E.secNotes(X)[0].data.cap === xc.cap, `the secretary stops the day: 「${E.secNotes(X)[0].data.text}」`);
  ok(X.news.some(x => x.text.startsWith('【完成】')), 'news: 【完成】');
  // upkeep: from the next month
  const up0 = xc.fin.up || 0; let paid = null;
  for (let g = 0; g < 40 && paid == null; g++) { const d0 = X.date; playDay(X); if (E.D.d(X.date) === 1 && E.D.d(d0) !== 1) paid = (xc.fin.up || 0) - up0; }
  ok(paid === B.exp.up && E.townUpkeep(xc) === B.exp.up, `a month's upkeep: ${oku(paid)} (in the books as fin.up)`);
  ok(X.news.some(x => /月の収支：.*維持費/.test(x.text)), 'the month\'s money news shows the upkeep');
}

/* every building, the limits, the effects */
{
  const X = clone(S), xc = X.clubs[X.my];
  xc.funds = 3000000;
  const finish = () => { xc.town.job.to = X.date; E.townDay(X); };
  for (const k of ['roof', 'food', 'shop', 'sclub', 'house', 'dorm', 'indoor']) { const r = E.townBuild(X, k); if (r.ok) finish(); }
  ok(['roof', 'food', 'shop', 'sclub', 'house', 'dorm', 'indoor'].every(k => E.built(xc, k)), 'all seven one-off buildings built');
  ok(!E.townCan(X, 'shop').ok && E.townCan(X, 'shop').msg === 'すでに建っています', 'a building only once');
  const per = T.per + B.roof.per + B.food.per + B.shop.per;
  ok(Math.abs(E.gatePer(xc) - per) < 1e-9, `a spectator brings ${Math.round(per * 10000)}円 (tickets ${T.per * 10000}円 + food, goods, the screen)`);
  ok(Math.abs(E.townAtt(xc) - (B.roof.att + B.food.att)) < 1e-9 && E.townInj(xc) === B.indoor.inj, 'attendance +8%, injuries ×0.85');
  const ups = ['roof', 'food', 'shop', 'sclub', 'house', 'dorm', 'indoor'].reduce((a, k) => a + B[k].up, 0);
  ok(E.townUpkeep(xc) === ups, `upkeep of the seven: ${oku(ups)} a month (${oku(ups * 12)} a year)`);
  xc.fac.train = 5; xc.fac.scout = 3;
  ok(E.townUpkeep(xc) === ups + 3 * T.facUp.train + 2 * T.facUp.scout, `facility levels above the start add upkeep (練習場 Lv5 + スカウト網 Lv3: +${oku(3 * T.facUp.train + 2 * T.facUp.scout)})`);
  // stands: four at most, never past capMax
  let steps = 0; while (E.townBuild(X, 'exp').ok) { finish(); steps++; }
  ok(steps === B.exp.cost.length && xc.cap === S.clubs[S.my].cap + steps * B.exp.seats && E.townCan(X, 'exp').msg === 'これ以上は増築できません', `four stands at most (${steps}, ${xc.cap.toLocaleString()} seats)`);
  const big = X.clubs.yokohamafm; ok(!E.townNext(big, 'exp') && big.cap + B.exp.seats > B.exp.capMax, `no stand past ${B.exp.capMax.toLocaleString()} seats (横浜FM ${big.cap.toLocaleString()})`);
  const add = B.roof.tgt + B.food.tgt + B.shop.tgt + B.sclub.tgt + steps * B.exp.tgt;
  ok(Math.abs(E.fansTarget(xc) / xc.fan0 - (1 + add)) < 1e-9, `the buildings raise the supporters' level +${Math.round(add * 100)}% (${xc.fan0.toLocaleString()} → ${Math.round(E.fansTarget(xc)).toLocaleString()})`);
}
{
  // クラブハウス: condition comes back faster; players are a little more willing to come
  const X = clone(S), Y = clone(S); E.townOf(Y.clubs[Y.my]).b.house = Y.date;
  const pid = E.squad(X, X.my).find(p => p.inj <= 0 && E.age(p, X.date) < 31).id;
  X.players[pid].cond = 40; Y.players[pid].cond = 40;
  E.nextDay(X); E.nextDay(Y);
  ok(Math.abs((Y.players[pid].cond - X.players[pid].cond) - B.house.rec) < 1e-9, `クラブハウス: +${B.house.rec} condition a day (${X.players[pid].cond} → ${Y.players[pid].cond})`);
  const tgt = Object.values(X.players).filter(p => S.order.includes(p.club) && p.club !== X.my).find(p => E.negoWill(X, p).r > 0.2);
  ok(tgt && Math.abs(E.negoWill(X, tgt).r - E.negoWill(Y, Y.players[tgt.id]).r - B.house.will) < 1e-9, `クラブハウス: a player is ${B.house.will * 100}% more willing (${tgt && tgt.name})`);
  // 選手寮: young players grow a little faster, the academy's graduates a point better
  E.townOf(Y.clubs[Y.my]).b.dorm = Y.date;
  const yp = E.squad(X, X.my).find(p => E.age(p, X.date) <= B.dorm.age && p.pot - p.ovr > 3);
  const g0 = E.devWeek(X, X.players[yp.id], true).dOvr, g1 = E.devWeek(Y, Y.players[yp.id], true).dOvr;
  ok(yp && g1 > g0 * 1.03 && g1 < g0 * 1.09, `選手寮: ${yp.name}（${E.age(yp, X.date)}歳）grows ×${(g1 / g0).toFixed(3)} a week`);
  let a = 0, b = 0; for (let i = 0; i < 4000; i++) { a += E.intakePot(X, X.my, 2).pot; b += E.intakePot(Y, Y.my, 2).pot; }
  ok((b - a) / 4000 > 0.7 && (b - a) / 4000 < 1.3, `選手寮: academy graduates +${((b - a) / 4000).toFixed(2)} potential`);
}

/* the supporters */
{
  const X = clone(S), xc = X.clubs[X.my], F = T.fan, t0 = E.fansTarget(xc);
  let f = xc.fans; E.fansMatch(X, X.my, 'W'); ok(xc.fans === Math.round(f + t0 * F.w), `a win: +${Math.round(t0 * F.w)} (${f} → ${xc.fans})`);
  f = xc.fans; E.fansMatch(X, X.my, 'D'); ok(xc.fans === Math.round(f + t0 * F.d), `a draw: +${Math.round(t0 * F.d)}`);
  f = xc.fans; E.fansMatch(X, X.my, 'L'); E.fansMatch(X, X.my, 'L'); const two = f - xc.fans; f = xc.fans; E.fansMatch(X, X.my, 'L'); const third = f - xc.fans;
  ok(two === -2 * Math.round(t0 * F.l) && third === Math.round(-t0 * (F.l + F.run)), `losses: −${-Math.round(t0 * F.l)} each, from the 3rd in a row −${third}`);
  E.fansMatch(X, X.my, 'W'); ok(xc.lrun === 0, 'a win ends the run');
  xc.fans = 30000; E.fansMonth(X); ok(xc.fans === Math.round(30000 + (t0 - 30000) * F.back), `each month they drift back towards the club's level (30,000 → ${xc.fans.toLocaleString()}, level ${Math.round(t0).toLocaleString()})`);
  const t1 = E.fansTarget(xc); xc.pres += 0.5; ok(Math.abs(E.fansTarget(xc) / t1 - (1 + 0.5 * F.pres)) < 1e-9, `a club whose 格 rose by 0.5: the level ×${1 + 0.5 * F.pres}`); xc.pres -= 0.5;
  // the season: champions and relegated
  const tb = E.table(X); f = xc.fans; const other = X.clubs[tb[19].id], fo = other.fans;
  E.fansSeason(X, [{ id: X.my }].concat(tb.filter(r => r.id !== X.my)), [tb[19].id]);
  ok(xc.fans - f === Math.round(t0 * F.top[0]) && fo - other.fans === Math.round(-E.fansTarget(other) * F.rel), `the season: champions +${Math.round(F.top[0] * 100)}%, relegated ${Math.round(F.rel * 100)}%`);
  // サポーターズクラブ
  E.townOf(xc).b.sclub = X.date; const t2 = E.fansTarget(xc);
  ok(Math.abs(t2 / t0 - (1 + B.sclub.tgt)) < 1e-9, `サポーターズクラブ: the level +${B.sclub.tgt * 100}%`);
  f = xc.fans; E.fansMatch(X, X.my, 'W'); const gw = xc.fans - f; f = xc.fans; E.fansMatch(X, X.my, 'L'); const gl = f - xc.fans;
  ok(gw === Math.round(t2 * F.w * B.sclub.gain) && gl === Math.round(-t2 * F.l * B.sclub.loss), `サポーターズクラブ: a win +${gw} (×${B.sclub.gain}), a loss −${gl} (×${B.sclub.loss})`);
  // a reborn legend
  const L = E.LEGENDS[X.my] && E.LEGENDS[X.my][0]; f = xc.fans; X.reborn = X.reborn || { used: [] };
  if (L) { E.makeReborn(X, L); ok(xc.fans - f === Math.round(E.fansTarget(xc) * F.reborn * B.sclub.gain), `a reborn legend: +${xc.fans - f}`); }
}

/* AI clubs */
{
  const X = clone(S); for (let g = 0; g < 60; g++) playDay(X);
  const ai = X.order.filter(id => id !== X.my);
  const rich = X.clubs[ai[0]], full = X.clubs[ai[1]], poor = X.clubs[ai[2]], me = X.clubs[X.my];
  rich.funds = 600000; full.funds = 500000; poor.funds = 100000; me.funds = 900000;
  const hf = X.fixtures.filter(f => f.played && !f.cup && f.h === full.id); hf.forEach(f => { f.att = Math.round(full.cap * 0.95); });
  for (const f of X.fixtures.filter(f => f.played && !f.cup && f.h === rich.id)) f.att = Math.round(rich.cap * 0.5);
  const cap1 = full.cap, fr = rich.fans;
  E.townSeason(X);
  const keep = T.ai.keep, inv = Math.round((600000 - keep) * T.ai.share);
  ok(rich.funds === 600000 - inv && Math.abs(rich.fanT - inv / 10000 * T.ai.fanPer) < 1e-9 && !rich.town.job, `an AI club with ${oku(600000)}: ${oku(inv)} into the supporters (level +${(rich.fanT * 100).toFixed(1)}%), no stand (its ground was half empty)`);
  ok(hf.length > 0 && full.town.job && full.town.job.k === 'exp' && full.funds === 500000 - B.exp.cost[0] - Math.round((500000 - keep - B.exp.cost[0]) * T.ai.share), `an AI club with a full ground: a stand (${oku(B.exp.cost[0])}) and the rest of the spare money`);
  ok(poor.funds === 100000 && !poor.fanT, 'an AI club below the reserve keeps its money');
  ok(me.funds === 900000 && !me.fanT, 'my club is not touched');
  for (let g = 0; g < 400 && full.town.job; g++) playDay(X);
  ok(!full.town.job && full.cap === cap1 + B.exp.seats && X.news.some(n => n.text.includes(`${full.short}のスタジアムが`)), `${full.short}: ${cap1.toLocaleString()} → ${full.cap.toLocaleString()} seats, in the news`);
  rich.fanT = 5; ok(E.fansTarget(rich) <= rich.fan0 * (1 + ((rich.pres) - rich.fanP) * T.fan.pres) * (1 + T.ai.fanMax) + 1, `their level rises at most +${T.ai.fanMax * 100}%`);
  rich.fanT = 0;
}

/* a new job: the buildings stay with the club */
{
  const X = clone(S), xc = X.clubs[X.my]; xc.funds = 500000;
  E.townBuild(X, 'shop'); xc.town.job.to = X.date; E.townDay(X);
  const from = X.my; E.takeJob(X, 'mito');
  ok(E.built(X.clubs[from], 'shop') && !E.built(X.clubs.mito, 'shop') && E.townCan(X, 'shop').msg !== 'すでに建っています', 'a new job: the shop stays at the old club, the new one has none');
}

/* two seasons: the money and the supporters stay in range */
{
  const X = E.newGame(DATA, 'kashiwa', 't', '2026-10-15'); X.settings.boardLv = 'easy';
  const f0 = Object.fromEntries(X.order.map(id => [id, X.clubs[id].fans]));
  let ends = 0, err = null;
  try { for (let g = 0; g < 3000 && ends < 2; g++) { const st = playDay(X); if (st.stop === 'seasonEnd') { ends++; E.rollover(X); if (X.fired) E.takeJob(X, X.fired.offers[0]); } } } catch (e) { err = e; }
  const ai = X.order.filter(id => id !== X.my && f0[id]).map(id => X.clubs[id]);
  const fs2 = ai.map(x => x.funds).sort((a, b) => a - b), med = fs2[fs2.length >> 1];
  const ratio = ai.map(x => x.fans / f0[x.id]).sort((a, b) => a - b);
  ok(!err && ends === 2, `two seasons played${err ? ' ' + err.stack : ''}`);
  ok(med > 100000 && med < 350000, `the league's median funds after two seasons: ${oku(med)}`);
  ok(ratio[0] > 0.6 && ratio[ratio.length - 1] < 1.6 && ratio[ratio.length >> 1] > 0.85 && ratio[ratio.length >> 1] < 1.2, `AI supporters after two seasons: ×${ratio[0].toFixed(2)}〜×${ratio[ratio.length - 1].toFixed(2)} (median ×${ratio[ratio.length >> 1].toFixed(2)})`);
  ok(Object.values(X.clubs).every(x => x.fans == null || (Number.isFinite(x.fans) && x.fans >= T.fan.min)), 'no broken numbers');
}

/* old saves */
{
  const O = clone(S); O.v = 14;
  for (const x of Object.values(O.clubs)) { delete x.fans; delete x.fan0; delete x.fanP; delete x.town; x.fac.stadium = 2; if (x.fin) delete x.fin.up; }
  O.clubs[O.my].fac.stadium = 4; O.clubs[O.my].pres += 0.5;
  const M = E.migrate(O, DATA), mc = M.clubs[M.my];
  ok(M.v >= 15 && Object.values(M.clubs).every(x => !('stadium' in x.fac)), 'v14 → v15: the スタジアム設備 level is gone');
  ok(E.built(mc, 'roof') && E.built(mc, 'food') && !E.built(mc, 'shop'), 'スタジアム設備 Lv4 → 屋根と大型ビジョン + スタジアムグルメ');
  ok(Math.abs(E.gatePer(mc) - (T.per + B.roof.per + B.food.per)) < 1e-9, 'a spectator brings what Lv4 brought, and a little more');
  ok(mc.fanP === S.clubs[S.my].pres && Math.abs(mc.fans / (mc.fan0 * (1 + 0.5 * T.fan.pres) * (1 + B.roof.tgt + B.food.tgt)) - 1) < 0.001, `the supporters from the fan level and the 格 gained since the data (${mc.fans.toLocaleString()})`);
  ok(Object.values(M.clubs).filter(x => x.id !== M.my && !x.ab && M.order.includes(x.id)).every(x => x.fans === Math.round(E.fansTarget(x)) && !x.town), 'the other clubs: supporters at their level, no buildings');
  ok(mc.fin.up === 0 && E.migrate(clone(M), DATA).clubs[M.my].fans === mc.fans, 'the books have an upkeep line; migrating twice changes nothing');
}
for (const sha of ['be3e2da', '1addd7a']) {
  const tmp = path.join(require('os').tmpdir(), `engine_${sha}_${process.pid}.js`);
  let old = null;
  try { fs.writeFileSync(tmp, execSync(`git show ${sha}:dev/src/engine.js`, { cwd: path.join(__dirname, '..', '..') })); old = require(tmp); } catch (e) { console.log(`(skip ${sha} save: no git history)`); }
  if (!old) continue;
  const A = old.newGame(DATA, 'machida', '旧', '2026-10-14');
  for (let g = 0; g < 80; g++) { const st = old.advance(A, 1); if (st.stop === 'match') { const f = A.fixtures.find(y => y.id === st.fid); old.autoLineup(A, A.my); const M = old.createMatch(A, f); old.simulateFull(A, M); old.finishMatch(A, M); } else if (st.stop === 'inbox') A.inbox.forEach(y => { y.seen = true; }); }
  A.clubs[A.my].fac.stadium = 5;
  const Bs = E.migrate(clone(A), DATA), bc = Bs.clubs[Bs.my];
  ok(Bs.v >= 15 && E.built(bc, 'roof') && E.built(bc, 'food') && E.built(bc, 'shop') && bc.fans > 0, `${sha} save (${A.date}): migrated, Lv5 → three stadium buildings, ${bc.fans.toLocaleString()} supporters`);
  bc.funds = Math.max(bc.funds, 300000);
  const r = E.townBuild(Bs, 'exp');
  let err = null, ends = 0;
  try { for (let g = 0; g < 2000 && !ends; g++) { const st = playDay(Bs); if (st.stop === 'seasonEnd') ends++; } E.rollover(Bs); for (let g = 0; g < 30; g++) playDay(Bs); } catch (e) { err = e; }
  ok(r.ok && !err && bc.town.exp === 1 && bc.cap === A.clubs[A.my].cap + B.exp.seats && Bs.season === A.season + 1, `${sha} save: a stand built, the season played out and the next one started${err ? ' ' + err.stack : ''}`);
  try { fs.unlinkSync(tmp); } catch (e) { }
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
