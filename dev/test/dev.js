const E = require('../src/engine.js');
const DATA = require('../data.json');
const S = E.newGame(DATA, 'kashima', 't', '2026-10-11');
// ovr drift after attribute init
let maxd = 0; for (const p of DATA.players) { const q = S.players[p.id]; maxd = Math.max(maxd, Math.abs(q.ovr - p.ovr)); }
console.log('max ovr drift after init', maxd.toFixed(2));
const show = name => { const p = Object.values(S.players).find(x => x.name === name); return p; };
const tok = show('徳田 誉'), yo = show('吉田 湊海'), sb = show('柴崎 岳'), lc = show('レオ セアラ'), ok = show('大川 佑梧');
tok.tf = 'shoot'; tok.ti = 'hard'; yo.tf = 'auto'; ok.tf = 'def'; ok.learn = { pos: 'MF', prog: 0 };
const fmt = p => `${p.name} ${p.pos} ovr ${p.ovr.toFixed(1)}/${p.pot} at[${p.at.map(x => Math.round(x)).join(',')}] roles ${E.bestRoles(p, 3).map(r => r.jp + ' ' + r.v.toFixed(0)).join(' ')}`;
for (const p of [tok, yo, sb, lc, ok]) console.log('START', fmt(p), 'preview/月', JSON.stringify(E.devPreview(S, p).dOvr.toFixed(2)));
let goals = 0, games = 0;
for (let i = 0; i < 2000; i++) {
  const st = E.advance(S);
  if (st.stop === 'match') { const f = S.fixtures.find(x => x.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); }
  else if (st.stop === 'inbox') S.inbox.forEach(x => { x.seen = true; E.rejectOffer(S, x.id); });
  else if (st.stop === 'seasonEnd') break;
}
for (const f of S.fixtures) { games++; goals += f.hg + f.ag; }
const t = E.table(S);
console.log('goals/game', (goals / games).toFixed(2), 'champ', S.clubs[t[0].id].short, t[0].pts, 'last', t[19].pts);
for (const p of [tok, yo, sb, lc, ok]) console.log('END  ', fmt(p), p.pos2 ? 'learned ' + p.pos2 : '', p.learn ? 'learn ' + p.learn.prog.toFixed(0) : '');
console.log('news grow sample:', S.news.filter(n => n.type === 'grow').slice(0, 4).map(n => n.text));
// league-wide youth growth
const young = Object.values(S.players).filter(p => !p.gen && S.clubs[p.club] && E.age(p, '2026-08-07') <= 20);
const g = young.map(p => p.ovr - p.ovr0); console.log('U20 avg ovr gain over season', (g.reduce((a, b) => a + b, 0) / g.length).toFixed(2), 'n', g.length);
const old = Object.values(S.players).filter(p => !p.gen && S.clubs[p.club] && E.age(p, '2026-08-07') >= 33);
const o = old.map(p => p.ovr - p.ovr0); console.log('33+ avg ovr change', (o.reduce((a, b) => a + b, 0) / o.length).toFixed(2), 'n', o.length);
