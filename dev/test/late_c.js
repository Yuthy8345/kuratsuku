// C 守備固めの交代の試算（実装はしていない）。リードしている終盤に、疲れたアタッカーを守備の強い控え（DF・MF）に替える。
// node dev/test/late_c.js [試合数] [club] [A: on|off]
// 75分に1点リードしていた試合の最終結果を、交代のやり方ごとに比べる（ホーム／アウェーを交互に自クラブ扱い、交代おまかせ ふつう）。
//   none     守備固めをしない
//   same     入れた選手は下げた選手の役割のまま（FWの位置に守備の選手）
//   def1     入れた選手を守備の役割（CB・DMF・WB のうち一番合うところ）に置く＝形が変わる。リードしたら1人（75分以降）
//   def2     同じく、85分以降もリードしていればもう1人
const K = require('./latekit.js');
const { E } = K;
const N = Number(process.argv[2] || 20000);
const club = process.argv[3] || 'yokohamafm';
const only = process.env.PLANS ? process.env.PLANS.split(',') : null;
const S = K.setup(club);
const ATT = ['ST', 'SS', 'LW', 'RW'], ATT2 = ['AM', 'LAM', 'RAM', 'WAM'], ATT3 = ['LM', 'RM'];
const DEF_ROLES = ['CB', 'DM', 'DWB'];
const defScore = p => (p.at ? p.at[3] : p.ovr) + p.ovr * 0.25;   // 守備の能力（同じくらいなら総合力の高い方）
const seen = {};
function defSub(M, k, mode) {
  const sd = M[k];
  if (sd.subs >= 5) return false;
  const on = E.onPitch(sd);
  const pool = [ATT, ATT2, ATT3].map(rs => on.filter(s => rs.includes(s.role))).find(a => a.length);
  if (!pool) return false;
  const out = pool.sort((x, y) => sd.cond[x.pid] - sd.cond[y.pid])[0];        // いちばん疲れているアタッカー
  const cands = E.benchOptions(S, M, k).map(id => S.players[id]).filter(p => p.pos === 'DF' || p.pos === 'MF');
  if (!cands.length) return false;
  const inn = cands.sort((a, b) => defScore(b) - defScore(a))[0];
  const slot = sd.slots.find(s => s.pid === out.pid);
  let role = slot.role;
  if (mode !== 'same') { let bv = -1e9; for (const r of DEF_ROLES) { const v = E.effective(inn, r); if (v > bv) { bv = v; role = r; } } }
  const old = slot.role; slot.role = role;
  if (!E.doSub(S, M, k, out.pid, inn.id, null)) { slot.role = old; return false; }
  const key = `${old}→${inn.pp}(${role})`; seen[mode] = seen[mode] || {}; seen[mode][key] = (seen[mode][key] || 0) + 1;
  return true;
}
const hook = mode => (S0, M, k, r) => {
  const my = k === 'h' ? M.hg - M.ag : M.ag - M.hg;
  if (my <= 0) return;
  if (!M._c1) { if (defSub(M, k, mode)) { M._c1 = 1; r.extra++; } }
  else if (mode === 'def2' && !M._c2 && M.min >= 84) { if (defSub(M, k, mode)) { M._c2 = 1; r.extra++; } }
};
const ways = {};
for (const A of [false, true]) for (const mode of ['none', 'same', 'def1', 'def2']) {
  const name = `${A ? 'A' : '-'} ${mode}`;
  if (only && !only.includes(name)) continue;
  ways[name] = { closeOut: A, hook: mode === 'none' ? null : hook(mode) };
}
const res = K.compare(S, ways, { N, reps: 4 });
for (const [name, r] of Object.entries(res)) {
  console.log(K.line(name.padEnd(7), r) + `  守備固め ${(r.extra / r.n).toFixed(2)}人`);
  const mode = name.split(' ')[1];
  if (seen[mode] && !seen[mode].shown) { seen[mode].shown = 1; console.log('   例: ' + Object.entries(seen[mode]).filter(([k]) => k !== 'shown').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + v).join(', ')); }
}
