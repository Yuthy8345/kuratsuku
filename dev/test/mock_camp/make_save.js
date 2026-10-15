// 作業7（2026-10-16）キャンプの画面イメージ用のセーブ: 横浜FM で 1/4（天皇杯の決勝のあと、アジアカップ中）まで自動で進める。
// キャンプはまだエンジンに無いので、レポートの数字は試作の式で出す（gen.js がそれを画面に描く）。
// usage: cd dev/test/mock_camp && node make_save.js [club] > save.json
const E = require('../../src/engine.js'); const D = require('../../data.json');
const club = process.argv[2] || 'yokohamafm';
const S = E.newGame(D, club, 'ソーイ', '2026-10-16');
E.sponAuto && E.sponPending(S) && E.sponAuto(S);
for (let g = 0; g < 9000 && S.date < '2027-01-04'; g++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') { const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) }); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); S.board = Math.max(S.board, 50); }
  else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') break;
  else if (st.stop) { if (S.sec) E.secSeen(S); if (S.cele) S.cele = []; }
}
E.secSeen(S); S.sec.notes = S.sec.notes.filter(n => n.k === 'month');
const c = S.clubs[S.my];
// one injured player for the picture (a minor knock in the winter)
const sq = E.squad(S, S.my);
const xi = c.tac.xi.map(id => S.players[id]);
const hurt = sq.filter(p => !c.tac.xi.includes(p.id) && p.pos === 'MF' && !p.away).sort((a, b) => b.ovr - a.ovr)[0];
hurt.inj = 26;
// ---- the trial camp (鹿児島 1/24〜2/2, 10 days): growth ×2 (=+10/7 week), links = 5 practice matches for the XI's neighbours
const DEST = { k: 'kago', days: 10, from: '2027-01-24', to: '2027-02-02', grow: 2, matches: 5, form: 0.3 };
const S2 = JSON.parse(JSON.stringify(S)); S2.date = '2027-01-26';
const present = p => !(p.inj > 0) && !(p.away && p.away.to >= DEST.from);
const days = p => { if (p.inj > 0) return 0; if (p.away && p.away.to >= DEST.from) { const back = E.D.add(p.away.to, 1); return back > DEST.to ? 0 : E.D.diff(DEST.to, back) + 1; } return DEST.days; };
const grow = sq.map(p => { const r = E.devWeek(S2, S2.players[p.id], true); const d = days(p); const add = r ? r.dOvr * (DEST.grow - 1) * d / 7 : 0; return { id: p.id, short: p.short, name: p.name, num: p.num, age: E.age(p, S.date), ovr: p.ovr, add, days: d }; }).sort((a, b) => b.add - a.add);
// links
const F = E.FORMATIONS[c.tac.form], adj = E.linkAdj(c.tac.form);
const lv = (a, b) => E.linkOf(S, S.my, a, b);
const pairs = adj.map(([i, j]) => { const a = xi[i], b = xi[j]; let v = lv(a.id, b.id); const v0 = v; const n = Math.min(days(a), days(b)) / DEST.days * DEST.matches; for (let m = 0; m < Math.round(n); m++) v = Math.min(100, v + E.LINK.adj * Math.max(E.LINK.floor, 1 - v / E.LINK.top)); return { i, j, a: a.id, b: b.id, v0, v }; });
const avg0 = pairs.reduce((s, x) => s + x.v0, 0) / pairs.length, avg1 = pairs.reduce((s, x) => s + x.v, 0) / pairs.length;
const out = { save: JSON.parse(JSON.stringify(S)), dest: DEST, grow, pairs, avg0, avg1, form: c.tac.form, hurt: hurt.id,
  away: sq.filter(p => p.away).map(p => ({ id: p.id, cc: p.away.cc, to: p.away.to, days: days(p) })) };
out.save.cele = [];
console.log(JSON.stringify(out));
console.error('away', out.away, 'hurt', hurt.short, 'avg', avg0.toFixed(1), '->', avg1.toFixed(1));
console.error(grow.slice(0, 8).map(x => `${x.short}(${x.age}) ${x.ovr.toFixed(1)} +${x.add.toFixed(2)} d${x.days}`).join('\n'));
console.error('sum', grow.reduce((s, x) => s + x.add, 0).toFixed(2));
