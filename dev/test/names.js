// 架空選手の名前（2026-10-15）: 実在選手（J1・海外組）とゲーム内の選手と同姓同名にならない／旧セーブ（v11）の移行
// usage: node dev/test/names.js [新しいゲームの回数=50]
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const key = s => s.replace(/\s/g, '');
const REAL = new Set([...DATA.players, ...DATA.abroad.players].map(p => key(p.name)));
const N = +process.argv[2] || 50;
const AB = DATA.abroad.players.length;
const abroadN = S => Object.values(S.players).filter(p => E.abroadOf(S, p)).length;
// names shared by two players, at least one of them generated (real players can share a name: 田中 雄大 at 広島 and 横浜FM)
const dups = S => { const c = {}; for (const p of Object.values(S.players)) (c[key(p.name)] = c[key(p.name)] || []).push(p); return Object.entries(c).filter(([, ps]) => ps.length > 1 && ps.some(p => p.gen)).map(([k]) => k); };
const genReal = S => Object.values(S.players).filter(p => p.gen && !p.reborn && REAL.has(key(p.name)));
const clubs = DATA.clubs.map(c => c.id);

/* ---------- 新しいゲーム ---------- */
{
  let bad = 0, dup = 0, abShort = 0;
  for (let i = 0; i < N; i++) {
    const S = E.newGame(DATA, clubs[i % clubs.length], 't', '2026-10-15');
    bad += genReal(S).length; dup += dups(S).length; if (abroadN(S) !== AB) abShort++;
  }
  ok(bad === 0, `${N} new games: no generated player named like a real one (${bad})`);
  ok(dup === 0, `${N} new games: no two players with the same name (${dup})`);
  ok(abShort === 0, `${N} new games: all ${AB} players abroad every time (short in ${abShort})`);
}

/* ---------- 名前の引き方 ---------- */
{
  const S = E.newGame(DATA, 'mito', 't', '2026-10-15');
  // 300 more foreign-style names (the pool has 240): never a real name, duplicates only once the pool runs out
  let real = 0; for (let i = 0; i < 300; i++) { const p = E.genPlayer(S, 'FA', { foreign: true, age: 25, ovr: 60 }); if (REAL.has(key(p.name))) real++; }
  ok(real === 0, 'a used-up pool still avoids real names');
  const legends = Object.values(E.LEGENDS).flat().map(L => key(L.name));
  ok(legends.every(k => E.reservedNames(S).has(k)) && ['遠藤航', '田中碧', '佐々木翔'].every(k => E.reservedNames(S).has(k)), 'reserved: real players and the legends');
}

/* ---------- 長く遊んでも ---------- */
{
  const V = E.newGame(DATA, 'yokohamafm', 't', '2026-10-15');
  for (let s = 0; s < 2; s++) {
    for (let g = 0; g < 3000; g++) {
      const st = E.advance(V);
      if (st.stop === 'match') { const f = V.fixtures.find(x => x.id === st.fid); const M = E.createMatch(V, f); E.simulateFull(V, M); E.finishMatch(V, M); }
      else if (st.stop === 'inbox') V.inbox.forEach(x => { x.seen = true; if (x.type === 'offer') E.rejectOffer(V, x.id); });
      else if (st.stop === 'seasonEnd') break;
      else if (st.stop === 'fired') E.takeJob(V, V.fired.offers[0]);
    }
    E.rollover(V); if (V.fired) E.takeJob(V, V.fired.offers[0]);
  }
  const g = Object.values(V.players).filter(p => p.gen).length;
  ok(!genReal(V).length && !dups(V).length, `after 2 seasons (${g} generated players): no real names, no duplicates`);
}

/* ---------- 旧セーブ（v11） ---------- */
{
  const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-15');
  const O = clone(S); O.v = 11;
  const endo = Object.values(O.players).find(p => p.name === '遠藤 航'), tanaka = Object.values(O.players).find(p => p.name === '田中 碧');
  const sasaki = Object.values(O.players).find(p => p.name === '佐々木 翔' && !p.gen);
  // the clash as it happened before: a generated player took the name, so the real player abroad never joined
  delete O.players[endo.id]; delete O.players[tanaka.id];
  const mine = E.squad(O, O.my).filter(p => p.gen && (!p.nat || p.nat === 'JPN'))[0] || (() => { const q = clone(Object.values(O.players).find(p => p.gen && p.club === 'FA' && (!p.nat || p.nat === 'JPN'))); q.club = O.my; O.players[q.id] = q; return q; })();
  mine.name = '遠藤 航'; mine.short = '遠藤';
  const fa = Object.values(O.players).find(p => p.gen && p.club === 'FA' && p.id !== mine.id); fa.name = '佐々木 翔'; fa.short = '佐々木';
  const other = Object.values(O.players).find(p => p.gen && p.club !== O.my && p.club !== 'FA' && !O.clubs[p.club].ab); other.name = '田中 碧'; other.short = '田中';
  // he is in a saved tactic and in last season's scorers
  O.clubs[O.my].tac.xi[1] = mine.id; E.savePreset(O, null, 'テスト');
  O.history.unshift({ season: '2025', club: O.my, scorers: [{ id: mine.id, name: '遠藤 航', club: O.my, g: 9 }] });
  E.migrate(O, DATA);
  ok(O.v >= 12, 'migrated to v12');
  ok(!genReal(O).length && !dups(O).length, 'no generated player keeps a real name, no duplicates');
  ok(mine.name !== '遠藤 航' && fa.name !== '佐々木 翔' && other.name !== '田中 碧' && mine.short === mine.name.split(' ')[0], `renamed: ${mine.name} / ${fa.name} / ${other.name}`);
  ok(sasaki && O.players[sasaki.id].name === '佐々木 翔', 'the real 佐々木 翔 keeps his name');
  ok(O.players[endo.id] && O.players[tanaka.id] && E.abroadOf(O, O.players[endo.id]) && abroadN(O) === AB, `遠藤 航・田中 碧 join the players abroad (${abroadN(O)})`);
  const nw = O.news.find(x => x.text.includes('実在の選手と同じ名前'));
  ok(nw && nw.text.includes('遠藤 航 → ' + mine.name) && !nw.text.includes(fa.name) && !nw.text.includes(other.name), 'news names only my player: ' + (nw && nw.text));
  ok(O.news.some(x => x.text.includes('これまで加わっていなかった選手（2人）')), 'news: 2 players abroad joined');
  O.clubs[O.my].tac.xi[1] = null; E.loadPreset(O, 0);
  ok(O.presets[0].xn[1] === mine.name && O.clubs[O.my].tac.xi[1] === mine.id, 'saved tactic follows the new name (loads him)');
  ok(O.history[0].scorers[0].name === mine.name, 'records follow the new name');
  const n0 = Object.keys(O.players).length, news0 = O.news.length, nm0 = mine.name;
  E.migrate(O, DATA);
  ok(Object.keys(O.players).length === n0 && O.news.length === news0 && mine.name === nm0, 'migrating again changes nothing');

  // a later season: a player abroad who is gone (retired) is not brought back; one whose name a generated player had is
  const L = clone(S); L.v = 11; L.season = 2029;
  const yoshida = Object.values(L.players).find(p => p.name === '吉田 麻也'); delete L.players[yoshida.id];
  const t2 = Object.values(L.players).find(p => p.name === '田中 碧'); delete L.players[t2.id];
  const g2 = Object.values(L.players).find(p => p.gen && p.club === 'FA'); g2.name = '田中 碧';
  E.migrate(L, DATA);
  ok(!L.players[yoshida.id] && L.players[t2.id] && g2.name !== '田中 碧', 'later season: the retired one stays gone, the one kept out by a name joins');

  // v8 save: every player abroad joins even when a generated player has the name (only real players count)
  const V8 = clone(S); for (const p of Object.values(V8.players)) if (E.abroadOf(V8, p)) delete V8.players[p.id];
  for (const c of Object.keys(V8.clubs)) if (V8.clubs[c].ab) delete V8.clubs[c];
  Object.values(V8.players).find(p => p.gen && p.club === 'FA').name = '遠藤 航'; V8.v = 8;
  E.migrate(V8, DATA);
  ok(abroadN(V8) === AB && !genReal(V8).length, `v8 save: all ${AB} abroad, the generated 遠藤 航 renamed`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
