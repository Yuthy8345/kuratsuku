// writes data.json for the mocks (mock.js draws 案A〜C on top of the real tactics screen and player sheet)
const fs = require('fs');
const E = require('../../src/engine.js');
const { save: S, links: L, adj, form } = require('./save.json');
const c = S.clubs[S.my], F = E.FORMATIONS[form];
const v = (a, b) => L[a < b ? a + '-' + b : b + '-' + a] || 0;
const P = id => S.players[id];
const slots = F.map((s, i) => { const p = P(c.tac.xi[i]); return { i, role: s[0], jp: E.ROLE[s[0]].jp, cat: E.ROLE[s[0]].cat, pid: p.id, num: p.num, short: p.short, name: p.name, nat: p.nat, yo: p.yo === S.my }; });
const pairs = adj.map(([i, j]) => ({ i, j, v: v(slots[i].pid, slots[j].pid) }));
const avg = pairs.reduce((a, x) => a + x.v, 0) / pairs.length;
// the per-player average over his board neighbours (案C rings)
for (const s of slots) { const mine = pairs.filter(x => x.i === s.i || x.j === s.i); s.avg = Math.round(mine.reduce((a, x) => a + x.v, 0) / Math.max(1, mine.length)); }
// combos (the trial rules)
const byRole = r => slots.filter(s => s.role === r);
const isAdj = (a, b) => pairs.find(x => (x.i === a.i && x.j === b.i) || (x.i === b.i && x.j === a.i));
const hot = pairs.filter(x => (slots[x.i].cat === 'FW') !== (slots[x.j].cat === 'FW') && slots[x.i].role !== 'GK' && slots[x.j].role !== 'GK').sort((a, b) => b.v - a.v)[0];
const hs = hot && (slots[hot.i].cat === 'FW' ? [slots[hot.j], slots[hot.i]] : [slots[hot.i], slots[hot.j]]);
const gk = byRole('GK')[0], cbs = byRole('CB').slice(0, 2);
const wall = [v(gk.pid, cbs[0].pid), v(gk.pid, cbs[1].pid), v(cbs[0].pid, cbs[1].pid)];
const wallAvg = Math.round(wall.reduce((a, b) => a + b, 0) / 3);
const mids = slots.filter(s => s.role === 'DM' || s.role === 'CM');
let heart = null; for (let a = 0; a < mids.length; a++) for (let b = a + 1; b < mids.length; b++) { const x = v(mids[a].pid, mids[b].pid); if (isAdj(mids[a], mids[b]) && (!heart || x > heart.v)) heart = { a: mids[a], b: mids[b], v: x }; }
const yo = slots.filter(s => s.yo).length;
const combos = [
  { k: 'hot', name: 'ホットライン', on: hot.v >= 80, who: `${hs[0].short} → ${hs[1].short}`, val: hot.v, need: 80, fx: '攻撃 +0.5', line: [hot.i, hot.j], cond: '出し手と点取り屋の連携 80以上' },
  { k: 'heart', name: '中盤の心臓', on: heart && heart.v >= 80, who: heart ? `${heart.a.short}・${heart.b.short}` : '', val: heart ? heart.v : 0, need: 80, fx: '中盤 +0.4', line: heart ? [heart.a.i, heart.b.i] : null, cond: '中央のMF2人の連携 80以上' },
  { k: 'wall', name: '鉄壁', on: wallAvg >= 75, who: `${gk.short}・${cbs[0].short}・${cbs[1].short}`, val: wallAvg, need: 75, fx: '守備 +0.5', cond: 'GKとCB2人の連携 平均75以上' },
  { k: 'yo', name: '生え抜きの誇り', on: yo >= 3, who: '', val: yo, need: 3, unit: '人', fx: '全体 +0.3', cond: 'ユース出身を3人先発' },
  { k: 'nat', name: '異国の絆', on: false, who: '', val: 1, need: 2, unit: '人', fx: '攻撃 +0.3', cond: '同じ国の外国籍を2人先発' },
];
const on = combos.filter(x => x.on);
const bonus = Math.round(avg / 100 * 10) / 10;
// the player sheet: クルークス (the AM)
const tg = slots.find(s => s.role === 'AM') || slots[8];
const part = Object.entries(L).filter(([k]) => k.split('-').includes(String(tg.pid))).map(([k, x]) => { const id = +k.split('-').find(y => y !== String(tg.pid)); const p = P(id); const sl = slots.find(s => s.pid === id); return { id, short: p.short, name: p.name, num: p.num, pp: p.pp, v: x, si: sl ? sl.i : -1, adj: !!(sl && isAdj(sl, tg)) }; }).sort((a, b) => b.v - a.v);
// minutes together (rough, for the label): link → minutes the trial formula needs
const minsOf = x => Math.round(-Math.log(1 - x / 110) * 110 / (6) * 90 / 10) * 10;
for (const x of part) x.mins = minsOf(Math.min(x.v, 105));
fs.writeFileSync(__dirname + '/data.json', JSON.stringify({ form, slots, pairs, avg: Math.round(avg), bonus, combos, on: on.length, tg: { pid: tg.pid, short: tg.short, name: tg.name, si: tg.i }, part, kit: { c1: c.c1, c2: c.c2 } }, null, 1));
console.log('avg', avg.toFixed(1), 'bonus', bonus, 'combos on', on.map(x => x.name).join(','), 'wall', wall, 'target', tg.short, part.slice(0, 5).map(x => x.short + x.v).join(' '));
