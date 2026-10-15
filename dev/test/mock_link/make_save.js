// 作業6（2026-10-15）の画面イメージ用のセーブ: 横浜FM で 4月まで自動で進め、連携を試作の式で数える（エンジンにはまだ無い）
// usage: cd dev/test/mock_link && node make_save.js [club] [until] > save.json
const E = require('../../src/engine.js'); const D = require('../../data.json');
const club = process.argv[2] || 'yokohamafm', until = process.argv[3] || '2027-04-12';
const S = E.newGame(D, club, 'ソーイ', '2026-10-15');
const c = S.clubs[S.my];
// 試作の連携: 一緒にピッチにいた分だけ上がる（隣り合う位置は多め）、一緒に出なかった試合は少し下がる
const LK = { adj: 6, far: 2.4, top: 110, decay: 0.8 };
const L = {};
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
// 隣り合う位置: 設計ボードでの距離（縦は画面の比率に合わせる）が近い組
function adjOf(form) {
  const F = E.FORMATIONS[form], out = [];
  const d = (a, b) => Math.hypot(a[1] - b[1], (a[2] - b[2]) * 1.326);
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) if (d(F[i], F[j]) <= 43) out.push([i, j]);
  return out;
}
function slotOf(sd, pid) {
  const i = sd.slots.findIndex(s => s.pid === pid); if (i >= 0) return i;
  const sub = sd.subLog.find(x => x[0] === pid); return sub ? slotOf(sd, sub[1]) : -1;
}
function linkMatch(M) {
  const k = M.userSide, sd = M[k];
  const on = Object.entries(M.pm).filter(([, pm]) => pm.side === k).map(([id, pm]) => ({ id: +id, on: pm.on, off: pm.off != null ? pm.off : Math.min(90, M.min), si: slotOf(sd, +id) }));
  const adj = new Set(adjOf(sd.form).map(([i, j]) => i + '-' + j));
  const together = new Set();
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
    const a = on[i], b = on[j]; const m = Math.min(a.off, b.off) - Math.max(a.on, b.on); if (m <= 0) continue;
    const isAdj = adj.has(Math.min(a.si, b.si) + '-' + Math.max(a.si, b.si));
    const kk = key(a.id, b.id), v = L[kk] || 0;
    L[kk] = Math.min(100, v + (m / 90) * (isAdj ? LK.adj : LK.far) * Math.max(0.12, 1 - v / LK.top));
    together.add(kk);
  }
  for (const kk of Object.keys(L)) if (!together.has(kk)) { L[kk] -= LK.decay; if (L[kk] < 1) delete L[kk]; }
}
const play = () => { for (let g = 0; g < 9000 && S.date < until; g++) {
  const st = E.advance(S, 1);
  if (st.stop === 'match') {
    const f = S.fixtures.find(y => y.id === st.fid); E.autoLineup(S, S.my, { comp: E.compOf(f) });
    const M = E.createMatch(S, f); E.simulateFull(S, M); linkMatch(M); E.finishMatch(S, M); S.board = Math.max(S.board, 50);
  } else if (st.stop === 'inbox') S.inbox.forEach(y => { y.seen = true; if (y.type === 'offer') E.rejectOffer(S, y.id); });
  else if (st.stop === 'seasonEnd') break;
  else if (st.stop) { if (S.sec) E.secSeen(S); if (S.cele) S.cele = []; if (S.spon && E.sponPending(S)) E.sponAuto(S); }
} };
E.sponAuto && E.sponPending(S) && E.sponAuto(S);
play();
E.secSeen(S); S.sec.notes = S.sec.notes.filter(n => n.k === 'month');
for (const p of E.squad(S, S.my)) { p.inj = 0; delete p.bans; delete p.away; } E.autoLineup(S, S.my); S.sec.back = [];
const clone = o => { const x = JSON.parse(JSON.stringify(o)); x.cele = []; return x; };
const games = S.fixtures.filter(f => f.played && (f.h === S.my || f.a === S.my)).length;
console.log(JSON.stringify({ save: clone(S), links: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, Math.round(v)])), adj: adjOf(c.tac.form), form: c.tac.form, games }));
