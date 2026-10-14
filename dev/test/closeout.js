// 逃げ切りはおまかせ (S.settings.closeOut): 75分以降にリードしたら 守備的・ライン低い・時間を使う、追いつかれたら元に戻す。
// 自分で3つのどれかを変えたらその試合は止まり、オンにし直すと再開。オフにしたら今の作戦のまま。AIクラブは変わらない。
// 最後に、75分に1点リードしていた試合の勝率をオフ／オンで比べる（node dev/test/closeout.js [試合数]）。
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const S = E.newGame(DATA, 'yokohamafm', 't', '2026-10-10');
const mine = S.fixtures.filter(f => !f.cup && (f.h === S.my || f.a === S.my));
ok(!S.settings.closeOut, 'off by default (new game)');

// a match frozen at a given minute and score (no goals in between: we set the score by hand before each step)
function at(min, my, opp, opts = {}) {
  const M = E.createMatch(S, mine[0]); const k = M.userSide;
  const sd = M[k]; sd.ment = opts.ment || 'bal'; sd.line = opts.line || 'mid'; sd.kill = !!opts.kill; sd.ctr = !!opts.ctr;
  M.min = min - 1; set(M, my, opp); return M;
}
function set(M, my, opp) { if (M.userSide === 'h') { M.hg = my; M.ag = opp; } else { M.ag = my; M.hg = opp; } }
function step(M, my, opp) { set(M, my, opp); const g = [M.hg, M.ag]; const ev = E.stepMatch(S, M); M.hg = g[0]; M.ag = g[1]; return ev.filter(e => e.t === 'tac'); }
const plan = sd => `${sd.ment}/${sd.line}/${sd.kill ? 'kill' : '-'}/${sd.ctr ? 'ctr' : '-'}`;

S.settings.closeOut = false;
let M = at(80, 1, 0); step(M, 1, 0);
ok(plan(M[M.userSide]) === 'bal/mid/-/-', 'setting off: nothing changes while ahead');

S.settings.closeOut = true;
M = at(60, 1, 0); step(M, 1, 0);
ok(plan(M[M.userSide]) === 'bal/mid/-/-', 'before 75: nothing changes');
M = at(74, 1, 0); step(M, 1, 0);
const sd0 = M[M.userSide];
ok(M.min === 74 && plan(sd0) === 'bal/mid/-/-', '74th minute: not yet');
step(M, 1, 0);
ok(M.min === 75 && plan(sd0) === 'def/low/kill/-', 'ahead in the 75th: 守備的・ライン低い・時間を使う -> ' + plan(sd0));

M = at(75, 1, 0, { ment: 'att', line: 'high', ctr: true });
let ev = step(M, 1, 0); const sd = M[M.userSide];
ok(plan(sd) === 'def/low/kill/ctr' && ev.length === 1 && /逃げ切り/.test(ev[0].text) && ev[0].side === M.userSide, 'switch at 75 with an event: ' + (ev[0] || {}).text);
ok(plan(M[M.userSide === 'h' ? 'a' : 'h']) === plan(E.createMatch(S, mine[0])[M.userSide === 'h' ? 'a' : 'h']), 'the other side (AI) is untouched');
ev = step(M, 1, 0); ok(ev.length === 0 && plan(sd) === 'def/low/kill/ctr', 'stays while still ahead, no repeated event');
ev = step(M, 2, 0); ok(ev.length === 0 && plan(sd) === 'def/low/kill/ctr', 'two goals ahead: still on');
ev = step(M, 2, 2); ok(plan(sd) === 'att/high/-/ctr' && ev.length === 1 && /元の作戦/.test(ev[0].text), 'equalised: back to the plan before (攻撃的・ライン高い・カウンター) -> ' + (ev[0] || {}).text);
ev = step(M, 3, 2); ok(plan(sd) === 'def/low/kill/ctr' && ev.length === 1, 'ahead again: on again');

// already playing that way: nothing to say
M = at(75, 1, 0, { ment: 'def', line: 'low', kill: true });
ev = step(M, 1, 0); ok(ev.length === 0 && !M[M.userSide].close, 'already 守備的・低い・時間を使う: no switch, no event');

// the manager changes one of the three himself: stops for this match
M = at(75, 1, 0); step(M, 1, 0);
const s2 = M[M.userSide];
E.setMentality(M, M.userSide, 'def');  // tapping what is already chosen does nothing
ok(!!s2.close && !s2.closeOff, 'tapping the posture already chosen does not stop it');
E.setTac(M, M.userSide, 'build', 'long');
ok(!!s2.close && !s2.closeOff, 'changing 組み立て (not one of the three) does not stop it');
E.setMentality(M, M.userSide, 'bal');
ok(!s2.close && s2.closeOff, 'changing the posture himself stops it');
ev = step(M, 1, 1); ok(plan(s2) === 'bal/low/kill/-' && ev.length === 0, 'then equalised: his plan stays (no going back) -> ' + plan(s2));
ev = step(M, 2, 1); ok(ev.length === 0 && plan(s2) === 'bal/low/kill/-', 'and ahead again: no switch for the rest of the match');
E.setCloseOut(S, true, M, M.userSide);
ev = step(M, 2, 1); ok(plan(s2) === 'def/low/kill/-' && ev.length === 1, 'turned on again in the match: starts again');
M = at(75, 1, 0); step(M, 1, 0); E.setTac(M, M.userSide, 'kill', false);
ok(M[M.userSide].closeOff, 'turning 時間を使う off himself also stops it');
M = at(75, 1, 0); step(M, 1, 0); E.setTac(M, M.userSide, 'line', 'high');
ok(M[M.userSide].closeOff, 'changing the line himself also stops it');

// switched off during the match: the plan stays as it is now
M = at(75, 1, 0); step(M, 1, 0); E.setCloseOut(S, false, M, M.userSide);
ev = step(M, 1, 1); ok(plan(M[M.userSide]) === 'def/low/kill/-' && ev.length === 0 && !S.settings.closeOut, 'switched off: stays as it is, no going back');
S.settings.closeOut = true;

// AI-only match (not my club): never
const other = S.fixtures.find(f => !f.cup && f.h !== S.my && f.a !== S.my);
M = E.createMatch(S, other); M.min = 79; M.hg = 1; M.ag = 0; const before = plan(M.h); E.stepMatch(S, M);
ok(plan(M.h) === before && !M.ev.some(e => e.t === 'tac'), 'a match without my club: nothing changes');

// whole matches: tactics are back to the club's own after the match (the match sides are separate objects)
const t0 = JSON.stringify(S.clubs[S.my].tac);
for (const f of mine.slice(0, 8)) { const MM = E.createMatch(S, f); E.simulateFull(S, MM); }
ok(JSON.stringify(S.clubs[S.my].tac) === t0, "the club's saved tactics are not changed by it");

// how much it helps: the same one-goal-up 75th-minute positions played out with it off and on (dev/test/latekit.js)
const K = require('./latekit.js');
const N = Number(process.argv[2] || 4000);
const res = K.compare(K.setup(), { off: { closeOut: false }, on: { closeOut: true } }, { N, reps: 4 });
console.log("75分に1点リードしていた場面から:"); for (const [k2, r] of Object.entries(res)) console.log('  ' + K.line(k2 === 'on' ? 'オン' : 'オフ', r));
const gain = res.on.w / res.on.n - res.off.w / res.off.n;
ok(gain > 0.02, `wins more often with it on (+${(gain * 100).toFixed(1)} points)`);
ok(res.on.l <= res.off.l * 1.05, 'and does not lose more often');
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
