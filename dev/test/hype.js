// Big-player patterns: how often teams catch fire, how many players, and what it does to upsets / goals / title points.
// usage: node dev/test/hype.js <now|old|A|B|C|D12> <seasons> [club]   (patterns override Engine.HYPE for this run only)
const E = require('../src/engine.js'); const DATA = require('../data.json');
const PAT = {
  now: {},                                                                                           // current defaults (D, +10)
  old: { k: 0.25, cap: 0.75, maxN: 1, more: 0, decay: 0.5, upTag: 0, floor: 0, boost: 12 },            // before 2026-10-12
  A: { k: 0.35, cap: 0.85, maxN: 2, more: 0.35, decay: 0.5, upTag: 0, floor: 0, boost: 12 },
  B: { k: 0.35, cap: 0.85, maxN: 3, more: 0.5, decay: 0.5, upTag: 0.5, floor: 0, boost: 12 },
  C: { k: 0.35, cap: 0.85, maxN: 2, more: 0.4, decay: 0.5, upTag: 0.5, floor: 0.2, boost: 12 },
  D12: { k: 0.45, cap: 0.9, maxN: 3, more: 0.5, decay: 0.6, upTag: 0.6, floor: 0.3, boost: 12 },
};
const name = process.argv[2] || 'now', runs = +(process.argv[3] || 3), club = process.argv[4] || 'kashima';
Object.assign(E.HYPE, PAT[name]);
const side = { top5: { n: 0, fire: 0, hot: 0, multi: 0 }, mid: { n: 0, fire: 0, hot: 0, multi: 0 }, bottom5: { n: 0, fire: 0, hot: 0, multi: 0 } };
const agg = {}; let goals = 0, games = 0, champ = [], perClub = [], hotWin = { w: 0, d: 0, l: 0 };
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, club, 't', '2026-10-10');
  const str = Object.fromEntries(S.order.map(c => [c, E.power(S, c)]));
  const rank = [...S.order].sort((a, b) => str[b] - str[a]);
  const tier = c => { const i = rank.indexOf(c); return i < 0 ? null : i < 5 ? 'top5' : i < 15 ? 'mid' : 'bottom5'; };
  let g = 0;
  while (g++ < 3000) {
    const st = E.advance(S);
    if (st.stop === 'match') { const fx = S.fixtures.find(f => f.id === st.fid); E.autoLineup(S, S.my, { rotate: true }); const opp = fx.h === S.my ? fx.a : fx.h; const gp = E.power(S, opp) - E.power(S, S.my); S.clubs[S.my].tac.ment = gp >= 3 ? 'def' : 'bal'; S.clubs[S.my].tac.ctr = gp >= 3; const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M); }
    else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'seasonEnd') break;
    else if (st.stop === 'fired') E.takeJob(S, S.fired.offers[0]);
  }
  const fireCount = {};
  for (const f of S.fixtures) {
    if (!f.played && !f.pk) continue;
    for (const sd of ['h', 'a']) {
      const cid = f[sd], t = tier(cid); if (!t) continue;
      const n = f.hype ? f.hype.hot.filter(h => h.side === sd).length : 0;
      side[t].n++; if (n) { side[t].fire++; side[t].hot += n; if (n >= 2) side[t].multi++; fireCount[cid] = (fireCount[cid] || 0) + 1; }
      if (n && tier(f[sd === 'h' ? 'a' : 'h'])) { const gf = sd === 'h' ? f.hg : f.ag, ga = sd === 'h' ? f.ag : f.hg; hotWin[gf > ga ? 'w' : gf < ga ? 'l' : 'd']++; }
    }
    if (f.cup) continue;
    goals += f.hg + f.ag; games++;
    for (const [me, op, gf, ga] of [[f.h, f.a, f.hg, f.ag], [f.a, f.h, f.ag, f.hg]]) {
      if (tier(me) !== 'bottom5' || tier(op) !== 'top5') continue;
      agg.w = (agg.w || 0) + (gf > ga); agg.d = (agg.d || 0) + (gf === ga); agg.l = (agg.l || 0) + (gf < ga);
    }
  }
  perClub.push(...rank.slice(15).map(c => fireCount[c] || 0));
  const t = E.table(S); champ.push(t[0].pts);
}
const pc = x => (x * 100).toFixed(0) + '%';
const out = { pattern: name, runs };
for (const [t, v] of Object.entries(side)) out[t] = `${pc(v.fire / v.n)} of matches, ${(v.hot / Math.max(1, v.fire)).toFixed(2)} players, 2+ in ${pc(v.multi / v.n)}`;
const n = agg.w + agg.d + agg.l;
out.bottom5PerSeason = (perClub.reduce((a, b) => a + b, 0) / perClub.length).toFixed(1) + ' matches with fire (league+cups)';
out.bottom5vsTop5 = `W${pc(agg.w / n)} D${pc(agg.d / n)} L${pc(agg.l / n)} (n=${n})`;
out.hotTeamResult = `W${pc(hotWin.w / (hotWin.w + hotWin.d + hotWin.l))}`;
out.goals = (goals / games).toFixed(2); out.champ = Math.round(champ.reduce((a, b) => a + b) / champ.length) + ` (${champ.join(',')})`;
console.log(JSON.stringify(out, null, 1));
