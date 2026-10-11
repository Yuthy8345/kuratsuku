// Headless check of the 2D match view: every scripted chance must resolve, play must flow, scores must match.
const E = require('../src/engine.js'); const M2D = require('../src/match2d.js'); const DATA = require('../data.json');
const runs = Number(process.argv[2] || 5);
let worst = 0, totalShots = 0, totalVis = 0, owners = 0, passes = 0, mism = 0;
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, ['kashima', 'urawa', 'mito', 'kobe', 'kashiwa'][r % 5], 't', '2026-10-11');
  const f = S.fixtures.find(x => x.h === S.my || x.a === S.my);
  const M = E.createMatch(S, f);
  let hold = false, shown = { h: 0, a: 0 }, q = [];
  const viz = M2D.create(S, M, { resolved: e => { if (e.t === 'goal') shown[e.side]++; }, done: () => { hold = false; } });
  const dt = 1 / 60 * 1.7; let vis = 0; let lastOwner = null;
  const spin = secs => { for (let t = 0; t < secs; t += 1 / 60) { viz.step(dt); vis += dt; const o = viz.V.ball.owner; if (o && o !== lastOwner) { owners++; lastOwner = o; } if (viz.V.ball.fl && viz.V.ball.fl.kind === 'pass' && viz.V.ball.fl.t === 0) passes++; } };
  while (!M.done || q.length || hold) {
    if (!hold && !M.done) { q.push(...E.stepMatch(S, M)); viz.hint(M.pH); viz.sync(); }
    while (q.length && !hold) {
      const e = q.shift();
      if (M2D.SHOTS[e.t]) { hold = true; viz.shoot(e); totalShots++; let t = 0; while (hold && t < 30) { viz.step(dt); vis += dt; t += 1 / 60; } worst = Math.max(worst, t); if (hold) { console.log('STUCK on', e.t, e.m); hold = false; } }
      else if (e.t === 'ht') viz.restart('a');
      else if (e.t === 'yc' || e.t === 'red') viz.foul(e);
    }
    spin(0.43);
  }
  if (shown.h !== M.hg || shown.a !== M.ag) mism++;
  totalVis += vis;
  console.log(`match ${r + 1}: ${M.hg}-${M.ag} shown ${shown.h}-${shown.a} | chances ${M.st.h.sh + M.st.a.sh} | players on pitch ${viz.V.players.length}`);
}
console.log('worst real seconds for one chance', worst.toFixed(2), '| avg match visual seconds', (totalVis / runs / 1.7).toFixed(0), '| ball changed hands', owners, '| score mismatches', mism);
