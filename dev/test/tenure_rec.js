// フロントの規則を比べるための記録（2026-10-16）: 解任しないで N 季回し、1試合ごとの [勝点, 能力差（自クラブ − 相手）,
// ホーム ±1, カップ戦, リーグの試合数, その時点の順位] と、季ごとの目標の順位（rk＝能力＋格×0.5 の順位、old＝以前の決め方の目標）・
// 最終順位・降格を JSON 1行／回で書く。規則は board_replay.py が後から当てはめる（同じ試合結果どうしで比べられる）。
// usage: node dev/test/tenure_rec.js <club> <runs> <seasons> <best|rotate|keep> > rec.jsonl   （1季約5秒）
//   best＝毎試合ベストの先発とAIの作戦、rotate＝毎試合ローテーション（tenure.js と同じ）、keep＝開幕の先発のまま（欠場は秘書の案）
const E = require(process.env.ENG || '../src/engine.js'), D = require('../data.json');
const [club, runs, N, mgr] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] || 'rotate'];
const tpos = r => r <= 3 ? 3 : r <= 7 ? 7 : r <= 13 ? 13 : 17;
const targets = S => {   // my target's position under each way of ranking
  const pres = c => (S.clubs[c].pres || 2) - 3, st = c => E.strength(S, c), pw = c => E.power(S, c);
  const rank = f => [...S.order].sort((a, b) => f(b) - f(a)).indexOf(S.my) + 1;
  return { rk: rank(c => st(c) + pres(c) * 0.5), old: tpos(rank(c => pw(c) + pres(c) * 0.9)), a0: tpos(rank(c => st(c) + pres(c) * 0.25)), a25: tpos(rank(c => st(c) + pres(c) * 0.5)), a50: tpos(rank(c => st(c) + pres(c) * 0.75)), str: tpos(rank(st)) };
};
for (let r = 0; r < runs; r++) {
  const S = E.newGame(D, club, 't', '2026-10-12');
  const out = { seasons: [] }; let cur = { t: targets(S), m: [] };
  for (let g = 0; g < 40000; g++) {
    const st = E.advance(S);
    if (st.stop === 'match') {
      const fx = S.fixtures.find(f => f.id === st.fid), k = fx.h === S.my ? 'h' : 'a', opp = k === 'h' ? fx.a : fx.h;
      if (mgr === 'rotate') E.autoLineup(S, S.my, { rotate: true });
      else if (mgr === 'best') { E.autoLineup(S, S.my, { comp: E.compOf(fx) }); Object.assign(S.clubs[S.my].tac, E.aiPlan(S, S.my, opp)); }
      else if (E.lineupIssues(S, S.my).block) { E.secSwapAll(S); if (E.lineupIssues(S, S.my).block) E.autoLineup(S, S.my, { comp: E.compOf(fx) }); }
      const myS = E.strength(S, S.my), opS = E.strength(S, opp) - (k === 'h' ? 1 : -1);
      const exp = Math.min(2.4, Math.max(0.4, 1.35 + (myS - opS) * 0.18));
      const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
      const my = k === 'h' ? fx.hg : fx.ag, th = k === 'h' ? fx.ag : fx.hg;
      let pts = my > th ? 3 : my < th ? 0 : 1; if (fx.cup && my === th && fx.pk) pts = 1;
      const lg = !fx.cup ? S.fixtures.filter(f => f.played && !f.cup && (f.h === S.my || f.a === S.my)).length : null;
      const rk = !fx.cup ? E.table(S).findIndex(x => x.id === S.my) + 1 : null;
      cur.m.push([pts, Math.round((E.strength(S, S.my) - E.strength(S, opp)) * 1000) / 1000, k === 'h' ? 1 : -1, fx.cup ? 1 : 0, lg, rk]);
      S.board = 60;
    }
    else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
    else if (st.stop === 'seasonEnd') {
      const se = S.seasonEnd; cur.pos = se.myPos; cur.rel = se.rel.includes(S.my) ? 1 : 0;
      cur.cups = ['ec', 'lc'].filter(k => se.cups && se.cups[k] && /優勝/.test(String(se.cups[k].my || ''))).length;
      out.seasons.push(cur);
      if (cur.rel || out.seasons.length >= N) break;
      S.board = 100; E.rollover(S); if (S.fired) break; S.board = 60; cur = { t: targets(S), m: [] };
    }
    else if (st.stop === 'fired') break;
    else if (st.stop) { E.secSeen(S); S.cele = []; if (E.sponPending(S)) E.sponAuto(S); }
  }
  console.log(JSON.stringify(out));
}
