// Long-run balance of player ratings: does the level keep climbing season after season, do the real players and the
// 転生 players keep their places, does my club run away with the league?
// The manager plays like a youth-minded human: the academy and training ground are upgraded whenever money allows,
// the auto-picked XI plays every match. Prints one line a season.
// usage: node test/inflation.js <club> <seasons> <runs>   (ENG=path to test another engine; TOWN=all: my club starts with
//        every one-off building of ホームタウン — クラブハウス・選手寮・室内練習場 among them — to see they barely move the team)
const E = require(process.env.ENG || '../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 8), runs = +(process.argv[4] || 1);
const real = new Set(DATA.players.map(p => p.id));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const f1 = x => x.toFixed(1);
const agg = [];  // per season: summed over runs
for (let r = 0; r < runs; r++) {
  const S = E.newGame(DATA, club, 't', '2026-10-12'); S.settings.boardLv = 'easy';
  if (process.env.TOWN === 'all' && E.townOf) for (const k of Object.keys(E.TOWN.b)) if (k !== 'exp') E.townOf(S.clubs[S.my]).b[k] = S.date;
  const origin = {};  // pid → real / intake / gem / reborn / other
  for (const p of Object.values(S.players)) origin[p.id] = real.has(p.id) ? 'real' : 'other';
  const tag = () => { for (const p of Object.values(S.players)) if (!origin[p.id]) origin[p.id] = p.reborn ? 'reborn' : p.gem ? 'gem' : (p.gen && E.age(p, S.date) <= 18 && S.clubs[p.club]) ? 'intake' : 'other'; };
  const ups = () => { for (let k = 0; k < 3; k++) for (const key of ['youth', 'train']) if (S.clubs[S.my].fac[key] < 5 && S.clubs[S.my].funds > E.facCost(S.clubs[S.my].fac[key]) * 1.6) E.upgrade(S, key); };
  ups();
  let s = 0, g = 0, mins = {};
  while (g++ < 200000 && s < N) {
    const st = E.advance(S);
    if (st.stop === 'match') {
      const fx = S.fixtures.find(f => f.id === st.fid); E.autoLineup(S, S.my, { rotate: true });
      const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
      S.board = Math.max(S.board, 40);  // the board never sacks this manager: we only look at the players
    } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'fired') { console.log('fired mid-season'); break; }
    else if (st.stop === 'seasonEnd') {
      const se = S.seasonEnd, t = E.table(S);
      const sq = E.squad(S, S.my), gp = t.find(x => x.id === S.my).p || 38;
      const tot = sq.reduce((a, p) => a + (p.st.mins || 0), 0) || 1;
      const share = o => sq.filter(p => origin[p.id] === o).reduce((a, p) => a + (p.st.mins || 0), 0) / tot;
      const lg = S.order.map(c => E.strength(S, c));
      const all = Object.values(S.players).filter(p => S.clubs[p.club] && S.order.includes(p.club));
      const top = all.slice().sort((a, b) => b.ovr - a.ovr);
      const rb = sq.filter(p => p.reborn);
      const row = {
        s: s + 1, lg: avg(lg), lgTop: Math.max(...lg), my: E.strength(S, S.my), pos: se.myPos, pts: t.find(x => x.id === S.my).pts,
        gap: t[0].id === S.my ? t[0].pts - t[1].pts : t[0].pts - t.find(x => x.id === S.my).pts * 1, champ: t[0].id === S.my ? 1 : 0,
        real: share('real'), intake: share('intake') + share('gem'), reb: share('reborn'), other: share('other'),
        maxOvr: top[0].ovr, maxPot: Math.max(...all.map(p => p.pot)), pot91: all.filter(p => p.pot >= 90.5).length, ovr80: all.filter(p => p.ovr >= 80).length,
        rb: rb.map(p => `${p.short}${E.age(p, S.date)}:${Math.round(p.ovr)}/${Math.round(p.pot)}`).join(' '),
        int: (() => { const k = sq.filter(p => origin[p.id] === 'intake' || origin[p.id] === 'gem').sort((a, b) => b.ovr - a.ovr).slice(0, 3); return k.map(p => `${Math.round(p.ovr)}/${Math.round(p.pot)}`).join(' '); })(),
        realTop: (() => { const k = sq.filter(p => origin[p.id] === 'real').sort((a, b) => b.ovr - a.ovr).slice(0, 3); return k.map(p => `${Math.round(p.ovr)}/${Math.round(p.pot)}`).join(' '); })(),
      };
      if (!agg[s]) agg[s] = []; agg[s].push(row);
      if (runs === 1 || process.env.V) console.log(`s${row.s} 平均${f1(row.lg)} 最強${f1(row.lgTop)} 自${f1(row.my)} ${row.pos}位${row.pts}点(差${row.gap}) 出場:実在${(row.real * 100).toFixed(0)}% ユース${(row.intake * 100).toFixed(0)}% 転生${(row.reb * 100).toFixed(0)}% | 最高${f1(row.maxOvr)} 最大伸びしろ${f1(row.maxPot)} 91+:${row.pot91} 80+:${row.ovr80} | 実在上位 ${row.realTop} | ユース上位 ${row.int} | 転生 ${row.rb}`);
      S.board = Math.max(S.board, 60); E.rollover(S); tag(); ups(); s++;
      if (S.fired) { console.log('fired:', S.fired.reason); break; }
    }
  }
}
if (runs > 1) {
  console.log(`\n[${club}] ${runs} runs`);
  for (const rows of agg) {
    const m = k => avg(rows.map(x => x[k]));
    console.log(`s${rows[0].s} n${rows.length} 平均${f1(m('lg'))} 最強${f1(m('lgTop'))} 自${f1(m('my'))} 順位${f1(m('pos'))} 優勝${rows.filter(x => x.champ).length} 差${f1(m('gap'))} 出場:実在${(m('real') * 100).toFixed(0)}% ユース${(m('intake') * 100).toFixed(0)}% 転生${(m('reb') * 100).toFixed(0)}% | 最高${f1(m('maxOvr'))} 最大伸びしろ${f1(m('maxPot'))} 91+:${f1(m('pot91'))} 80+:${f1(m('ovr80'))}`);
  }
}
