// saved tactics belong to the manager (2026-10-14): they go into a new game and to another club, players are matched by
// id and name, old saves (presets per club) are moved over, empty places can be filled on request
// usage: node dev/test/presets.js
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));

/* new game, saving */
const A = E.newGame(DATA, 'kashima', 't', '2026-10-14');
ok(A.v >= 11 && Array.isArray(A.presets) && A.presets.length === 0, 'new game: v11+, no saved tactics');
const ta = A.clubs[A.my].tac;
Object.assign(ta, { ment: 'def', ctr: true, press: 'high', line: 'low', mark: true });
E.savePreset(A, null, '格上用', 1760400000000);
const pr = A.presets[0];
ok(pr.club === 'kashima' && pr.cn === A.clubs.kashima.short && pr.k1 && pr.at === 1760400000000 && pr.d === A.date, `club / real date / game date kept (${pr.cn})`);
ok(pr.xn.length === 11 && pr.xn.every((n, i) => n === A.players[pr.xi[i]].name) && pr.bn.length === pr.bench.length, 'players\' names kept next to their ids');
ok(!A.clubs[A.my].presets, 'nothing stored on the club any more');
ok(E.savePreset(A, null, '') === 1 && A.presets[1].name === `${ta.form}・${E.mentLabel(ta)}`, 'default name');
for (let i = 2; i < E.PRESET_MAX; i++) E.savePreset(A, null, 'x' + i);
ok(E.savePreset(A, null, 'over') === -1 && A.presets.length === E.PRESET_MAX, `at most ${E.PRESET_MAX}`);
ok(E.savePreset(A, 1, '', 1760500000000) === 1 && A.presets[1].name === `${ta.form}・${E.mentLabel(ta)}` && A.presets[1].at === 1760500000000, 'overwrite keeps the name, new date');
E.renamePreset(A, 2, '  リネーム  '); ok(A.presets[2].name === 'リネーム', 'rename');
E.deletePreset(A, 4); E.deletePreset(A, 3); E.deletePreset(A, 2); ok(A.presets.length === 2, 'delete');

/* a new game at the same club: the real players come back where they were */
const carry = E.presetsOf(A);
ok(carry.length === 2 && carry !== A.presets && carry[0] !== A.presets[0], 'presetsOf copies');
const B = E.newGame(DATA, 'kashima', 't', '2026-10-14'); B.presets = carry;
const tb = B.clubs[B.my].tac; tb.form = '4-4-2'; tb.ment = 'att'; tb.ctr = false; E.autoLineup(B, B.my);
let st = E.loadPreset(B, 0);
ok(tb.form === pr.form && tb.ment === 'def' && tb.ctr && tb.press === 'high' && tb.line === 'low' && tb.mark, 'formation and instructions');
ok(tb.xi.every((id, i) => id === pr.xi[i]) && tb.bench.join() === pr.bench.join() && !st.gone.length && !st.other && st.empty === 0, 'same club in a new game: the same XI and bench');
ok(!E.lineupIssues(B, B.my).block, 'ready to play');

/* players made in-game get their ids again in a new game: matched by name too */
const gen = Object.values(A.players).find(p => p.id >= 100000 && p.club !== 'RET');
const C = clone(A); const cpr = E.presetsOf(A)[0];
cpr.xi[3] = gen.id; cpr.xn[3] = 'ちがう 名前';
C.presets = [cpr]; const pl = C.players[gen.id]; pl.club = C.my;
st = E.loadPreset(C, 0);
ok(C.clubs[C.my].tac.xi[3] === null && st.gone.includes(gen.id) && st.empty === 1, `same id, another name (${pl.name}): left empty`);
cpr.xn[3] = pl.name; st = E.loadPreset(C, 0);
ok(C.clubs[C.my].tac.xi[3] === gen.id && st.empty === 0, 'same id and name: placed');

/* another club: tactics load, players don't */
const Y = E.newGame(DATA, 'yokohamafm', 't', '2026-10-14'); Y.presets = E.presetsOf(A);
st = E.loadPreset(Y, 0); const ty = Y.clubs.yokohamafm.tac;
ok(st.other && st.empty === 11 && st.gone.length === pr.xi.filter(Boolean).length + pr.bench.length && ty.form === pr.form && ty.ctr, `saved at another club: shape and instructions only (${st.gone.length} not here)`);
let iss = E.lineupIssues(Y, Y.my);
ok(iss.block && iss.spare && iss.xi.filter(x => x.why === 'empty').length === 11, 'the match is blocked: 11 empty places');
const f = E.fillEmpty(Y);
ok(f.xi === 11 && f.bench === E.BENCH_SIZE && ty.xi.every(id => id && Y.players[id].club === 'yokohamafm') && new Set(ty.xi.concat(ty.bench)).size === 11 + E.BENCH_SIZE, `fill the empty places: XI ${f.xi}, bench ${f.bench}`);
ok(!E.lineupIssues(Y, Y.my).block && ty.form === pr.form && ty.ctr, 'ready, shape and instructions kept');
ok(ty.bench.some(id => Y.players[id].pos === 'GK'), 'a keeper on the bench');

/* fill only the gaps: the players placed stay, injured ones too */
const Z = E.newGame(DATA, 'urawa', 't', '2026-10-14'); const tz = Z.clubs.urawa.tac;
const keep = tz.xi.slice(); const hurt = Z.players[tz.xi[5]]; hurt.inj = 10; tz.xi[2] = null; tz.xi[7] = null; tz.bench.pop();
E.fillEmpty(Z);
ok(tz.xi[5] === hurt.id && tz.xi.every((id, i) => id && (i === 2 || i === 7 || id === keep[i])) && tz.bench.length === E.BENCH_SIZE, 'only the empty places change (the injured starter stays)');
ok(E.lineupIssues(Z, Z.my).block, 'still blocked by the injured player (the manager swaps him)');

/* suspended players load as saved (as before) */
const B2 = clone(B); B2.players[pr.xi[4]].sus = 1; st = E.loadPreset(B2, 0);
ok(B2.clubs.kashima.tac.xi[4] === pr.xi[4] && st.out.includes(pr.xi[4]) && E.lineupIssues(B2, 'kashima').block, 'suspended starter stays in, listed, blocks');

/* moving to another club: the tactics go with the manager */
const J = clone(B); E.takeJob(J, 'nagoya');
ok(J.presets.length === 2 && E.presetStatus(J, J.presets[0]).other, 'after moving club: still there, marked as another club');

/* old save (v9): presets per club → the manager's, names filled in, my club first */
const O = clone(B); delete O.presets; O.v = 9;
const old1 = { name: '旧A', form: '4-4-2', ment: 'bal', press: 'mid', xi: O.clubs.kashima.tac.xi.slice(), bench: O.clubs.kashima.tac.bench.slice(), d: '2026-09-01' };
O.clubs.kashima.presets = [old1, Object.assign(clone(old1), { name: '旧B', ment: 'ctr' })];
O.clubs.nagoya.presets = [Object.assign(clone(old1), { name: '名古屋時代' })];
E.migrate(O, DATA);
ok(O.v >= 11 && O.presets.map(x => x.name).join() === '旧A,旧B,名古屋時代' && !O.clubs.kashima.presets && !O.clubs.nagoya.presets, `moved over: ${O.presets.map(x => x.name).join(' / ')}`);
ok(O.presets[0].club === 'kashima' && O.presets[0].cn === O.clubs.kashima.short && !O.presets[0].at && O.presets[0].xn.every((n, i) => !old1.xi[i] || n === O.players[old1.xi[i]].name), 'club and names filled in, no real date');
ok(O.presets[2].club === 'nagoya', 'the earlier club is remembered');
st = E.loadPreset(O, 1); ok(O.clubs.kashima.tac.ment === 'def' && O.clubs.kashima.tac.ctr && st.empty === 0, 'old posture (ctr) loads as 守備的 + カウンター');
E.migrate(O, DATA); ok(O.presets.length === 3, 'migrating twice changes nothing');
// an unmigrated old save can be carried straight into a new game
const raw = clone(B); delete raw.presets; raw.v = 9; raw.clubs.kashima.presets = [old1];
const cr = E.presetsOf(raw); ok(cr.length === 1 && cr[0].xn.length === 11 && cr[0].club === 'kashima', 'carry from an old save without migrating');
// players gone from an old save are unknown by name: never matched in a new game
const raw2 = clone(raw); delete raw2.players[old1.xi[0]]; const cr2 = E.presetsOf(raw2);
ok(cr2[0].xn[0] === '?', 'an unknown player is marked "?"');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
