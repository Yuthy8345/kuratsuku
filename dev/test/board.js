// フロントの厳しさ (S.settings.boardLv): first-season grace, two bad seasons in a row, relegation, mid-season firing only
// in the bottom of the table, warnings, the new-season reset, and old saves (no setting → ふつう).
// Long-run firing rates: run the season sim with S.settings.boardLv set (see CLAUDE.md).
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
// play out the league table quickly: my club wins (w=3) or loses (w=0) every game, the rest unplayed (0 points)
function season(S, myPts, board) {
  for (const f of S.fixtures) if (!f.cup && !f.played) { if (f.h === S.my || f.a === S.my) { f.played = true; const me = f.h === S.my ? 'hg' : 'ag', op = me === 'hg' ? 'ag' : 'hg'; f[me] = myPts ? 2 : 0; f[op] = myPts ? 0 : 2; } }
  S.date = `${S.season + 1}-05-30`;
  if (board != null) S.board = board;
  E.endSeason(S);
  const se = S.seasonEnd; E.rollover(S); return se;
}
// a mid-table finish: my club draws every game, `place - 1` clubs beat everyone else and draw among themselves
function midTable(S, place) {
  const hi = S.order.filter(c => c !== S.my).slice(0, place - 1);
  for (const f of S.fixtures) if (!f.cup && !f.played) {
    const mine = f.h === S.my || f.a === S.my, hw = hi.includes(f.h), aw = hi.includes(f.a);
    if (mine || (hw && aw)) { f.played = true; f.hg = 1; f.ag = 1; }
    else if (hw || aw) { f.played = true; f.hg = hw ? 2 : 0; f.ag = aw ? 2 : 0; }
  }
}
ok(E.boardLv({ settings: {} }) === E.BOARD_LV.mid, 'no setting (old saves) → ふつう');

// ふつう: missing the target badly in the first season is forgiven, a second one is not
let S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12');
midTable(S, 14); let se = season(S, null, 30);
ok(se.verdict === 'missed' && !S.fired, `ふつう 1年目: ${se.myPos}位（目標 ${se.target}）でも続投、信頼 → ${S.board}`);
ok(S.board > 20 && S.board < 55, `new season starts nearer the middle (${S.board})`);
midTable(S, 14); se = season(S, null, 20);
ok(!!S.fired && /目標未達/.test(S.fired.reason), `ふつう 2年目も ${se.myPos}位 → ${S.fired && S.fired.reason}`);

// きびしい: fired after the first missed season
S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12'); S.settings.boardLv = 'hard';
midTable(S, 14); se = season(S, null, 30);
ok(!!S.fired, `きびしい 1年目 ${se.myPos}位 → ${S.fired ? S.fired.reason : '続投'}`);

// やさしい: even a poor second season is survived
S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12'); S.settings.boardLv = 'easy';
midTable(S, 14); season(S, null, 30); midTable(S, 14); se = season(S, null, 30);
ok(!S.fired, `やさしい 2年続けて ${se.myPos}位でも続投（信頼 ${S.board}）`);

// relegation: fired at every level
for (const lv of ['easy', 'mid', 'hard']) {
  S = E.newGame(DATA, 'mito', 't', '2026-10-12'); S.settings.boardLv = lv;
  se = season(S, 0, 90);
  ok(se.verdict === 'relegated' && S.fired && /降格/.test(S.fired.reason), `${E.BOARD_LV[lv].jp}: J2降格 → 解任`);
}

// mid-season: only in the bottom of the table
function midSeason(lv, win) {
  const T = E.newGame(DATA, 'yokohamafm', 't', '2026-10-12'); T.settings.boardLv = lv;
  let n = 0;
  for (const f of T.fixtures) if (!f.cup && (f.h === T.my || f.a === T.my) && n < 16) { n++; f.played = true; const me = f.h === T.my ? 'hg' : 'ag'; f[me] = win ? 2 : 0; f[me === 'hg' ? 'ag' : 'hg'] = win ? 0 : 2; }
  for (const f of T.fixtures) if (!f.cup && !f.played && f.date <= T.fixtures.filter(x => x.played).map(x => x.date).sort().pop() && f.h !== T.my && f.a !== T.my) { f.played = true; f.hg = 1; f.ag = 1; }
  T.board = 4; T.date = T.fixtures.filter(x => x.played).map(x => x.date).sort().pop();
  E.nextDay(T); return T;
}
ok(!!midSeason('mid', false).fired, 'ふつう: 降格圏で信頼が尽きると途中解任');
ok(!midSeason('mid', true).fired, 'ふつう: 上位にいれば信頼が低くても途中解任しない');
ok(!!midSeason('hard', true).fired, 'きびしい: 順位に関係なく信頼が尽きると途中解任（以前のルール）');

// warnings: once on the way down, with a stop note
S = E.newGame(DATA, 'kashima', 't', '2026-10-12');
let warned = null;
for (const f of S.fixtures.filter(f => !f.cup && (f.h === S.my || f.a === S.my)).slice(0, 25)) {
  S.board = 31; S.boardWarn = 0; S._stopNote = null;
  const M = E.createMatch(S, f); E.simulateFull(S, M); E.finishMatch(S, M);
  if (S.board <= 30) { warned = { board: S.board, note: S._stopNote, news: S.news[0].text }; break; }
}
ok(warned && warned.note && /フロント/.test(warned.news), `warning at ${warned && warned.board}: 「${warned && warned.news}」`);
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
