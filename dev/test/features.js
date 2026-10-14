// 2026-10-13 features: ② 背番号の変更 / ③ 海外組 / ⑤ フォーメーション・詳しい指示 / ⑥ 優勝のお祝い (engine side)
// usage: node dev/test/features.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- ② 背番号 ---------- */
{
  const S = E.newGame(DATA, 'kashima', 't', '2026-10-13');
  const sq = E.squad(S, S.my).sort((a, b) => b.ovr - a.ovr); const a = sq[0], b = sq[1];
  ok(E.numOpen(S), `before the first league match (${S.date}): open`);
  const na = a.num, nb = b.num;
  let r = E.setNum(S, a.id, nb); ok(r.ok && a.num === nb && b.num === na, `taken number swaps (${a.short} ${na}→${a.num}, ${b.short} ${nb}→${b.num})`);
  const used = new Set(E.squad(S, S.my).map(p => p.num)); let free = 1; while (used.has(free)) free++;
  r = E.setNum(S, a.id, free); ok(r.ok && a.num === free && !r.swap, `free number (${free})`);
  ok(!E.setNum(S, a.id, 0).ok && !E.setNum(S, a.id, 100).ok && !E.setNum(S, a.id, 7.5).ok, '0 / 100 / 7.5 refused');
  ok(!E.setNum(S, a.id, a.num).ok, 'same number refused');
  const other = Object.values(S.players).find(p => p.club !== S.my && S.clubs[p.club]);
  ok(!E.setNum(S, other.id, 77).ok, "another club's player refused");
  const nums = E.squad(S, S.my).map(p => p.num); ok(new Set(nums).size === nums.length, 'no duplicate numbers in the squad');
  const mf = S.fixtures.filter(f => !f.cup && (f.h === S.my || f.a === S.my)).sort((x, y) => x.date.localeCompare(y.date))[0];
  mf.played = true; mf.hg = 1; mf.ag = 0; ok(!E.numOpen(S), `after my first league match (${mf.date}): closed`);
  S.date = '2026-11-10'; ok(!E.numOpen(S) && E.numNext(S) === '12/20から' && !E.setNum(S, a.id, 88).ok, 'November: closed, next 12/20');
  S.date = '2026-12-20'; ok(E.numOpen(S), '12/20 (winter window): open');
  S.date = '2027-02-26'; ok(E.numOpen(S), '2/26: open');
  S.date = '2027-03-10'; ok(!E.numOpen(S) && E.numNext(S) === 'シーズン終了後', 'March: closed, next after the season');
  S.seasonEnd = { label: 'x' }; ok(E.numOpen(S), 'season review: open');
}

/* ---------- ⑤ フォーメーション・詳しい指示 ---------- */
{
  const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-13');
  ok(Object.keys(E.FORMATIONS).length === 12 && Object.keys(E.FORMATIONS).every(f => E.FORM_DESC[f]), '12 shapes, each with a description');
  for (const f of Object.keys(E.FORMATIONS)) {
    const F = E.FORMATIONS[f];
    if (F.length !== 11 || F.filter(s => s[0] === 'GK').length !== 1 || F.some(s => !E.ROLE[s[0]])) { ok(false, f + ' slots'); continue; }
    S.clubs[S.my].tac.form = f; E.autoLineup(S, S.my);
    const r = E.clubRating(S, S.my);
    if (![r.att, r.mid, r.def].every(Number.isFinite) || S.clubs[S.my].tac.xi.filter(Boolean).length !== 11) ok(false, f + ' lineup / rating');
  }
  ok(true, 'every shape picks a full XI and rates');
  const t = S.clubs[S.my].tac;
  ok(t.line === 'mid' && t.build === 'mix' && t.width === 'mix' && !t.mark && !t.kill, 'new game: standard instructions');
  const old = { form: '4-4-2', ment: 'bal', press: 'mid' };
  const x = E.tacX(old); ok(x.line === 'mid' && x.build === 'mix' && x.width === 'mix' && !x.mark && !x.kill && E.tacLabel(old) === '', 'old save without the fields: defaults');
  Object.assign(t, { form: '5-3-2', line: 'low', build: 'long', width: 'wide', mark: true, kill: true }); E.autoLineup(S, S.my);
  ok(E.tacLabel(t) === 'ライン低・ロングボール・サイド攻撃・マンマーク・時間を使う', 'label: ' + E.tacLabel(t));
  E.savePreset(S, null, 'テスト'); Object.assign(t, { line: 'high', build: 'short', width: 'center', mark: false, kill: false });
  E.loadPreset(S, 0); ok(t.line === 'low' && t.build === 'long' && t.width === 'wide' && t.mark && t.kill && t.form === '5-3-2', 'preset keeps the instructions');
  const pr = clone(S.presets[0]); delete pr.line; delete pr.build; delete pr.width; delete pr.mark; delete pr.kill; S.presets.push(pr);
  E.loadPreset(S, 1); ok(t.line === 'mid' && t.build === 'mix' && !t.mark, 'an old preset loads the standard instructions');
  // AI plans are valid
  let bad = 0; const seen = { line: {}, build: {}, width: {} };
  for (let i = 0; i < 400; i++) { const a = S.order[i % 20], b = S.order[(i * 7 + 3) % 20]; if (a === b) continue; const p = E.aiPlan(S, a, b); if (!E.LINE[p.line] || !E.BUILD[p.build] || !E.WIDTH[p.width] || !E.PRESS[p.press]) bad++; for (const k of ['line', 'build', 'width']) seen[k][p[k]] = 1; }
  ok(!bad && Object.keys(seen.line).length === 3 && Object.keys(seen.build).length === 3 && Object.keys(seen.width).length === 3, 'AI plans valid and varied ' + JSON.stringify(seen));
  ok(E.aiPlan(S, 'machida', 'kashima').build === 'long', 'club style: 町田 long ball');
  // width reads the other shape
  const side = form => ({ slots: E.FORMATIONS[form].map((s, i) => ({ role: s[0], pid: i + 1 })), sent: [] });
  ok(E.widthFit('wide', side('4-1-2-1-2')) > 1 && E.widthFit('wide', side('4-4-2')) === 1, 'wide attack works against a diamond (few wide defenders)');
  ok(E.widthFit('center', side('5-3-2')) < 1 && E.widthFit('center', side('4-4-2')) >= 1, 'central attack is blunted by a back five');
  // a match with every instruction on both sides runs and finishes
  const S2 = E.newGame(DATA, 'kashima', 't', '2026-10-13');
  for (const cid of S2.order) { const c = S2.clubs[cid]; c.tac.form = Object.keys(E.FORMATIONS)[S2.order.indexOf(cid) % 12]; Object.assign(c.tac, { line: 'high', build: 'short', width: 'center', mark: true, kill: true }); E.autoLineup(S2, cid); }
  const fx = S2.fixtures[0]; const M = E.createMatch(S2, fx);
  E.setTac(M, 'h', 'line', 'low'); E.setTac(M, 'h', 'build', 'bogus'); ok(M.h.line === 'low' && M.h.build === 'short', 'setTac changes valid values only');
  E.simulateFull(S2, M); E.finishMatch(S2, M); ok(fx.played && Number.isFinite(fx.hg) && Number.isFinite(fx.ag), `match with everything on: ${fx.hg}-${fx.ag}`);
  ok(E.markTarget(S2, M, 'h') != null, 'man-marking finds a target');
}

/* ---------- ⑥ 優勝のお祝い ---------- */
const D0 = '2027-05-20', D1 = '2027-05-21';
{
  // a much stronger squad wins the league early and (usually) a cup
  const S = E.newGame(DATA, 'kashima', 't', '2026-10-13');
  for (const p of E.squad(S, S.my)) { p.at = p.at.map(x => x + 14); p.ovr = E.calcOvr(p); p.pot = Math.max(p.pot, Math.ceil(p.ovr)); }
  let celeAt = null, stops = {}, clinchOk = true;
  for (let g = 0; g < 3000; g++) {
    const st = E.advance(S); stops[st.stop] = (stops[st.stop] || 0) + 1;
    if (st.stop === 'match') { const f = S.fixtures.find(x => x.id === st.fid); const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M); }
    else if (st.stop === 'inbox') S.inbox.forEach(x => { x.seen = true; if (x.type === 'offer') E.rejectOffer(S, x.id); });
    else if (st.stop === 'seasonEnd') break;
    for (const c of S.cele || []) if (c.k === 'j1' && !celeAt) {
      celeAt = { date: S.date, c };
      // at the moment of the clinch nobody can reach my points any more
      const t = E.table(S); const me = t.find(r => r.id === S.my);
      for (const r of t) if (r.id !== S.my && r.pts + 3 * E.leagueLeft(S, r.id) >= me.pts) clinchOk = false;
    }
  }
  const j1 = (S.cele || []).find(c => c.k === 'j1');
  ok(!!j1 && clinchOk, `league title celebrated when certain (${celeAt && celeAt.date}, ${j1 && j1.left} games left, ${j1 && j1.pts}pt, ${j1 && j1.w}-${j1 && j1.dr}-${j1 && j1.l})`);
  ok((S.cele || []).filter(c => c.k === 'j1').length === 1, 'only once a season');
  ok(S.seasonEnd && S.seasonEnd.verdict === 'champion', 'the season review agrees: champion');
  const cups = (S.cele || []).filter(c => c.k !== 'j1');
  const won = ['ec', 'lc'].filter(k => S.cups[k].champ === S.my);
  ok(cups.length === won.length && cups.every(c => won.includes(c.k) && c.opp && Number.isFinite(c.my) && c.my >= c.op), `cup celebrations match the cups won (${won.join(',') || 'none'}) ${JSON.stringify(cups.map(c => [c.k, c.my, c.op, c.pk]))}`);
  // the title settled by the other results on a day I don't play: advance stops for the pop-up
  {
    const T = E.newGame(DATA, 'kashima', 't', '2026-10-13'); const rival = T.order.find(c => c !== T.my);
    const lg = T.fixtures.filter(f => !f.cup);
    const mine = lg.filter(f => f.h === T.my || f.a === T.my).sort((a, b) => b.r - a.r)[0];
    const theirs = lg.filter(f => (f.h === rival || f.a === rival) && f !== mine && f.h !== T.my && f.a !== T.my).sort((a, b) => b.r - a.r)[0];
    for (const f of lg) { if (f === mine || f === theirs) continue; f.played = true; const me = f.h === T.my ? 'h' : f.a === T.my ? 'a' : null; f.hg = me === 'h' ? 3 : me === 'a' ? 0 : 1; f.ag = me === 'a' ? 3 : me === 'h' ? 0 : 1; }
    T.fixtures = T.fixtures.filter(f => !f.cup); T.cups = null;
    theirs.date = D1; mine.date = '2027-05-30'; T.date = D0;
    let st = null; for (let i = 0; i < 5; i++) { st = E.advance(T); if (st.stop !== 'note' && st.stop !== 'inbox') break; }
    ok(st.stop === 'cele' && T.cele.length === 1 && T.cele[0].k === 'j1' && T.cele[0].left === 1, `title settled while I rest: advance stops (${st.stop}, ${T.cele && T.cele[0] && T.cele[0].left} left)`);
  }
  ok(!!stops.match, 'advance stops: ' + JSON.stringify(stops));
  // a final is crowned right after the match (not the next morning)
  const T = E.newGame(DATA, 'kashima', 't', '2026-10-13');
  const lc = T.cups.lc; lc.r = 5; T.fixtures = T.fixtures.filter(f => f.cup !== 'lc');
  const opp = T.order.find(c => c !== T.my); lc.alive = [T.my, opp];
  const fin = { id: 9999, cup: 'lc', cr: 5, st: 2, date: T.date, h: T.my, a: opp, hg: null, ag: null, played: false, neutral: true }; T.fixtures.push(fin);
  for (let i = 0; i < 30 && !(T.cele || []).length; i++) { fin.played = false; delete fin.hype; const M = E.createMatch(T, fin); E.simulateFull(T, M); M.hg = 2; M.ag = 1; E.finishMatch(T, M); }
  ok(T.cups.lc.champ === T.my && (T.cele || []).some(c => c.k === 'lc' && c.my === 2 && c.op === 1), 'final won → Lカップ celebration at once');
  ok(T.clubs[T.my].titles.lc >= 1 && T.cele[0].n === T.clubs[T.my].titles.lc, `title count on the pop-up (${T.cele[0].n})`);
}

/* ---------- ③ 海外組 ---------- */
{
  const S = E.newGame(DATA, 'urawa', 't', '2026-10-13');
  const ab = E.marketList(S, { where: 'ab' });
  ok(ab.length === DATA.abroad.players.length && ab.length >= 100, `overseas players in the market: ${ab.length}`);
  ok(ab.every(p => p.nat === 'JPN' && E.abroadOf(S, p) && !S.order.includes(p.club)), 'all Japanese, clubs outside the league');
  ok(E.marketList(S, { where: 'j' }).every(p => !E.abroadOf(S, p) && p.club !== 'FA'), "'Jリーグ' filter has no overseas players");
  ok(E.marketList(S, { q: 'プレミア' }).length >= 9, 'search by league name (プレミア)');
  const j1names = new Set(DATA.players.map(p => p.name.replace(/\s/g, ''))); ok(DATA.abroad.players.every(p => !j1names.has(p.name.replace(/\s/g, ''))), 'nobody both in the J1 data and abroad');
  const kubo = Object.values(S.players).find(p => p.name === '久保 建英'), tani = Object.values(S.players).find(p => p.name === '谷口 彰悟');
  ok(E.price(S, kubo) > E.value(kubo, S.date) * 1.8, `price above value (久保 ${E.money(E.value(kubo, S.date))} → ${E.money(E.price(S, kubo))})`);
  ok(E.abroadReluct(S, kubo) > 0.8 && E.abroadReluct(S, tani) < 0.2, `a star in his prime says no, a veteran is willing (${E.abroadReluct(S, kubo).toFixed(2)} / ${E.abroadReluct(S, tani).toFixed(2)})`);
  // bids: window, funds, success / refusal rates
  S.date = '2026-11-10'; ok(!E.bid(S, tani.id, 1.5).ok, 'outside the window: no bid');
  S.date = '2026-08-10';
  const rate = (name, m, club) => { let n = 0; for (let i = 0; i < 300; i++) { const T = clone(S); if (club) { T.my = club; } T.clubs[T.my].funds = 1e7; const p = Object.values(T.players).find(x => x.name === name); if (E.bid(T, p.id, m).ok) n++; } return n / 300; };
  const rk = rate('久保 建英', 1.5), rt = rate('谷口 彰悟', 1.2), rk2 = rate('久保 建英', 1.0);
  ok(rk < 0.2 && rt > 0.6 && rk2 === 0, `success: 久保 x1.5 ${(rk * 100).toFixed(0)}% / x1.0 ${(rk2 * 100).toFixed(0)}%, 谷口 x1.2 ${(rt * 100).toFixed(0)}%`);
  const T = clone(S); T.clubs[T.my].funds = 1e7; const p = Object.values(T.players).find(x => x.name === '谷口 彰悟');
  let r; for (let i = 0; i < 20; i++) { r = E.bid(T, p.id, 1.5); if (r.ok) break; delete T._bids; }
  ok(r.ok && p.club === T.my && p.abFrom && p.abFrom.name === 'シント＝トロイデン' && T.news[0].text.includes('海外から加入'), `signed: ${r.msg}`);
  // AI clubs never buy them, the 天皇杯 never invites their clubs
  const U = E.newGame(DATA, 'kashima', 't', '2026-10-13'); const abIds = new Set(E.marketList(U, { where: 'ab' }).map(p => p.id));
  for (let i = 0; i < 3000; i++) E.transferDay(U);
  ok([...abIds].every(id => E.abroadOf(U, U.players[id])), 'AI transfers leave them alone (3000 transfer days)');
  ok(U.cups.ec.guests.every(c => !U.clubs[c].ab), 'no overseas club in the 天皇杯');
  // old save (v8): they are added once
  const O = clone(U); for (const id of abIds) delete O.players[id]; for (const c of Object.keys(O.clubs)) if (O.clubs[c].ab) delete O.clubs[c]; O.v = 8;
  E.migrate(O, DATA); const n1 = Object.values(O.players).filter(p => E.abroadOf(O, p)).length;
  E.migrate(O, DATA); const n2 = Object.values(O.players).filter(p => E.abroadOf(O, p)).length;
  ok(n1 === abIds.size && n2 === n1 && O.v >= 9 && O.news.some(x => x.text.includes('海外でプレーする日本人選手')), `old save: ${n1} added once, news`);
  // seasons roll over: they age, veterans retire, nothing breaks
  const V = E.newGame(DATA, 'mito', 't', '2026-10-13');
  for (let s = 0; s < 2; s++) { for (let g = 0; g < 3000; g++) { const st = E.advance(V); if (st.stop === 'match') { const f = V.fixtures.find(x => x.id === st.fid); const M = E.createMatch(V, f); E.simulateFull(V, M); E.finishMatch(V, M); } else if (st.stop === 'inbox') V.inbox.forEach(x => { x.seen = true; if (x.type === 'offer') E.rejectOffer(V, x.id); }); else if (st.stop === 'seasonEnd') break; else if (st.stop === 'fired') E.takeJob(V, V.fired.offers[0]); } E.rollover(V); if (V.fired) E.takeJob(V, V.fired.offers[0]); }
  const left = Object.values(V.players).filter(p => E.abroadOf(V, p)).length;
  const orig = [...abIds].filter(id => V.players[id] && E.abroadOf(V, V.players[id])).length;   // J1 players moving to Europe (2026-10-14) refill the pool
  ok(orig < abIds.size && left > abIds.size - 25 && !Object.values(V.players).some(p => p.name === '吉田 麻也' && E.abroadOf(V, p) && E.age(p, V.date) > 41), `after 2 seasons: ${orig} of the ${abIds.size} still abroad (veterans retired), ${left} in all`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
