// お金の流れ（2026-10-15）: 自動采配で毎シーズン回し、自クラブとリーグの資金・収支・施設を1行ずつ出す。
// 2026-10-15 の確認（横浜FM、施設を上げない、12季）: 自クラブ 19.9億 → 121.6億、リーグの中央値 17.1億 → 62.5億・最大 149.6億。
// 施設を全部Lv5にしても約38億（facCost）なので、5季目ごろからお金の使い道がなくなる。
// usage: node dev/test/econ.js [club] [seasons] [none|auto]   auto = 資金がコストの1.6倍あれば施設を上げる（inflation.js と同じ）
//        1シーズン約5秒。解任されたら最初のオファーのクラブへ移る（フロントはやさしい）
const E = require('../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 10), mode = process.argv[4] || 'none';
const S = E.newGame(DATA, club, 't', '2026-10-15'); S.settings.boardLv = 'easy';
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const FAC = ['train', 'youth', 'stadium', 'medical', 'scout'];
const ups = () => { if (mode !== 'auto') return; for (let k = 0; k < 3; k++) for (const key of FAC) { const c = S.clubs[S.my]; if (c.fac[key] < 5 && c.funds > E.facCost(c.fac[key]) * 1.6) E.upgrade(S, key); } };
let s = 0, g = 0; const t0 = Date.now(); const spon = [], hits = [];
ups();
while (g++ < 300000 && s < N) {
  const st = E.advance(S);
  if (st.stop === 'match') {
    if (E.lineupIssues(S, S.my).block) E.autoLineup(S, S.my, { rotate: true });
    const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
  } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
  else if (st.stop === 'fired') { console.log('fired mid-season', S.fired.reason); E.takeJob(S, S.fired.offers[0]); }
  else if (st.stop === 'seasonEnd') {
    const my = S.clubs[S.my], f = S.order.map(c => S.clubs[c].funds);
    const sp = S.seasonEnd.spon;   // スポンサー契約 (2026-10-15): the old fixed sponsors would have been base / 0.6
    if (sp) { const base = my.fin.spon - sp.guar - sp.bonus, old = base / E.SPON.base; spon.push(my.fin.spon / old); hits.push(...sp.deals.map(d => d.st === 'done' ? 1 : 0)); }
    const spTxt = sp ? ` | スポンサー ${E.money(my.fin.spon)}（以前の ${Math.round(spon[spon.length - 1] * 100)}%・達成 ${sp.deals.filter(d => d.st === 'done').length}/${sp.deals.length}：${sp.deals.map(d => `${E.SPON.slot[d.slot].jp}${d.k}${d.st === 'done' ? '○' : '×'}`).join(' ')}）` : ' | スポンサー 以前の形';
    console.log(`S${s + 1} ${S.seasonEnd.label} ${my.short} ${S.seasonEnd.myPos}位 | 自クラブ ${E.money(my.funds)} | リーグ 中央値 ${E.money(med(f))} 最大 ${E.money(Math.max(...f))} 最小 ${E.money(Math.min(...f))} | 収支 ${JSON.stringify(my.fin)} ${spTxt} | 施設 ${FAC.map(k => my.fac[k]).join('')} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    E.rollover(S); if (S.fired) { console.log('FIRED', S.fired.reason); E.takeJob(S, S.fired.offers[0]); }
    ups(); s++;
  }
}
if (spon.length) console.log(`スポンサー（契約のあった${spon.length}季）: 以前の形の ${Math.round(spon.reduce((a, b) => a + b, 0) / spon.length * 1000) / 10}%・達成 ${Math.round(hits.reduce((a, b) => a + b, 0) / Math.max(1, hits.length) * 100)}%（${hits.length}件）`);
