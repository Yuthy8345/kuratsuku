// お金の流れ（2026-10-15）: 自動采配で毎シーズン回し、自クラブとリーグの資金・収支・施設・ホームタウンを1行ずつ出す。
// 2026-10-15 の確認（横浜FM、施設を上げない、12季）: 自クラブ 19.9億 → 121.6億、リーグの中央値 17.1億 → 62.5億・最大 149.6億。
// 施設を全部Lv5にしても約38億（facCost）なので、5季目ごろからお金の使い道がなくなる → ホームタウン（作業4）。
// usage: node dev/test/econ.js [club] [seasons] [none|auto] [runs]
//   none = 施設も建物も買わない、auto = 資金がコストの1.6倍あれば施設を上げ（inflation.js と同じ）、建物も建てる
//   （スタジアムが満員（平均が収容の90%以上）なら増築を優先して貯める）。1シーズン約5秒。
//   解任されたら最初のオファーのクラブへ移る（フロントはやさしい）。runs が2以上なら最後に季ごとの中央値。
const E = require(process.env.ENG || '../src/engine.js'); const DATA = require('../data.json');
const club = process.argv[2] || 'yokohamafm', N = +(process.argv[3] || 10), mode = process.argv[4] || 'none', RUNS = +(process.argv[5] || 1);
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : 0; };
const FAC = ['train', 'youth', 'medical', 'scout'];
const BUILD = ['shop', 'food', 'sclub', 'house', 'dorm', 'indoor', 'roof'];
const AB = { exp: '増', roof: '屋', food: '食', shop: '店', sclub: 'サ', house: 'ハ', dorm: '寮', indoor: '室' };
const oku = v => (v / 10000).toFixed(1);
const per = [];   // per season: [my funds, league median, league max, my fans, upkeep]
for (let run = 0; run < RUNS; run++) {
  const S = E.newGame(DATA, club, 't', '2026-10-15'); S.settings.boardLv = 'easy';
  // a full house (the season's home crowd at 90% of the seats or more): save for the next stand first
  const saving = () => { if (!E.townInfo) return 0; const inf = E.townInfo(S), ex = E.townCan(S, 'exp'); return inf.full != null && inf.full >= 0.9 && ex.cost ? ex.cost : 0; };
  const ups = () => { if (mode !== 'auto') return; const sv = saving(); for (let k = 0; k < 3; k++) for (const key of FAC) { const c = S.clubs[S.my]; if (c.fac[key] < 5 && c.funds > E.facCost(c.fac[key]) * 1.6 + sv) E.upgrade(S, key); } };
  const builds = () => {
    if (mode !== 'auto' || !E.townBuild) return;
    const c = S.clubs[S.my]; if (c.town && c.town.job) return;
    const sv = saving();
    if (sv && c.funds > sv * 1.2) { E.townBuild(S, 'exp'); return; }
    for (const k of BUILD) { const r = E.townCan(S, k); if (r.cost && c.funds > r.cost * 1.6 + sv) { E.townBuild(S, k); return; } }
  };
  let s = 0, g = 0; const t0 = Date.now(); const spon = [], hits = [];
  ups(); builds();
  while (g++ < 300000 && s < N) {
    const st = E.advance(S);
    if (st.stop === 'match') {
      if (E.lineupIssues(S, S.my).block) E.autoLineup(S, S.my, { rotate: true });
      const fx = S.fixtures.find(f => f.id === st.fid); const M = E.createMatch(S, fx); E.simulateFull(S, M); E.finishMatch(S, M);
      builds();
    } else if (st.stop === 'inbox') { for (const it of S.inbox.filter(x => !x.seen)) { it.seen = true; if (it.type === 'offer') E.rejectOffer(S, it.id); } }
    else if (st.stop === 'fired') { console.log('fired mid-season', S.fired.reason); E.takeJob(S, S.fired.offers[0]); }
    else if (st.stop === 'seasonEnd') {
      const my = S.clubs[S.my], f = S.order.map(c => S.clubs[c].funds);
      const sp = S.seasonEnd.spon;   // スポンサー契約 (2026-10-15): the old fixed sponsors would have been base / 0.6
      if (sp) { const base = my.fin.spon - sp.guar - sp.bonus, old = base / E.SPON.base; spon.push(my.fin.spon / old); hits.push(...sp.deals.map(d => d.st === 'done' ? 1 : 0)); }
      const spTxt = sp ? ` | スポンサー ${E.money(my.fin.spon)}（以前の ${Math.round(spon[spon.length - 1] * 100)}%・達成 ${sp.deals.filter(d => d.st === 'done').length}/${sp.deals.length}）` : ' | スポンサー 以前の形';
      const inf = E.townInfo ? E.townInfo(S) : null;
      const town = inf ? ` | サポーター ${inf.fans.toLocaleString()}・観客 ${inf.att == null ? '-' : inf.att.toLocaleString()}/${inf.cap.toLocaleString()} | 建物 ${inf.b.filter(b => b.built).map(b => AB[b.k] + (b.k === 'exp' ? b.built : '')).join('') || 'なし'}${inf.job ? `（工事中 ${AB[inf.job.k]}）` : ''}・維持費 年${oku(my.fin.up || 0)}億` : '';
      const fin = `入場 ${oku(my.fin.gate)} スポ ${oku(my.fin.spon)} 賞金 ${oku(my.fin.prize)} 移籍 ${oku(my.fin.trans)} 人件 ${oku(my.fin.wages)} 投資 ${oku(my.fin.fac)}`;
      console.log(`S${s + 1} ${S.seasonEnd.label} ${my.short} ${S.seasonEnd.myPos}位 | 自クラブ ${E.money(my.funds)} | リーグ 中央値 ${E.money(med(f))} 最大 ${E.money(Math.max(...f))} 最小 ${E.money(Math.min(...f))} | ${fin}${spTxt} | 施設 ${FAC.map(k => my.fac[k]).join('')}${town} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      (per[s] || (per[s] = [])).push([my.funds, med(f), Math.max(...f), inf ? inf.fans : 0, my.fin.up || 0]);
      E.rollover(S); if (S.fired) { console.log('FIRED', S.fired.reason); E.takeJob(S, S.fired.offers[0]); }
      ups(); builds(); s++;
    }
  }
  if (spon.length) console.log(`スポンサー（契約のあった${spon.length}季）: 以前の形の ${Math.round(spon.reduce((a, b) => a + b, 0) / spon.length * 1000) / 10}%・達成 ${Math.round(hits.reduce((a, b) => a + b, 0) / Math.max(1, hits.length) * 100)}%（${hits.length}件）`);
}
if (RUNS > 1) {
  console.log(`--- ${RUNS}回の中央値（${club}・${mode}）`);
  per.forEach((rows, i) => console.log(`S${i + 1} 自クラブ ${oku(med(rows.map(r => r[0])))}億 | リーグ 中央値 ${oku(med(rows.map(r => r[1])))}億 最大 ${oku(med(rows.map(r => r[2])))}億 | サポーター ${Math.round(med(rows.map(r => r[3]))).toLocaleString()} | 維持費 年${oku(med(rows.map(r => r[4])))}億`));
}
