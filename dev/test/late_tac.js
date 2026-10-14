// リードしている終盤に、自クラブが何をすると逃げ切りやすいか（試合中の采配の比較）。
// node dev/test/late_tac.js [試合数] [club]
// 75分に1点リードしている場面から先を、作戦ごとにやり直して比べる（latekit.js）。リードしているあいだだけ作戦を切り替え、追いつかれたら元に戻す。
// 環境変数: LEAD=2（2点リード）、KILL_OPP/KILL_OWN（時間を使うの強さを試す）、PLANS=名前の頭,…（一部だけ回す）
const K = require('./latekit.js');
const { E } = K;
const N = Number(process.argv[2] || 12000);
const club = process.argv[3] || 'yokohamafm';
if (process.env.KILL_OPP) E.KILL.opp = Number(process.env.KILL_OPP);
if (process.env.KILL_OWN) E.KILL.own = Number(process.env.KILL_OWN);
const only = process.env.PLANS ? process.env.PLANS.split(',') : null;
const PLANS = {
  'そのまま': {},
  '時間を使う': { kill: true },
  '守備的': { ment: 'def' },
  '守備的＋時間を使う': { ment: 'def', kill: true },
  '守備的＋ライン低い＋時間を使う': { ment: 'def', kill: true, line: 'low' },
  '守備的＋カウンター＋時間を使う': { ment: 'def', ctr: true, kill: true },
  '攻撃的': { ment: 'att' },
  '逃げ切りはおまかせ': 'auto',
};
const ways = {};
for (const [name, plan] of Object.entries(PLANS)) {
  if (only && !only.some(o => name.startsWith(o))) continue;
  if (plan === 'auto') { ways[name] = { closeOut: true }; continue; }
  ways[name] = {
    hook(S, M, k) {
      const sd = M[k]; if (!M._base) M._base = { ment: sd.ment, ctr: sd.ctr, line: sd.line, kill: sd.kill };
      const on = (k === 'h' ? M.hg - M.ag : M.ag - M.hg) > 0, b = M._base;
      sd.ment = on && plan.ment ? plan.ment : b.ment; sd.ctr = on && plan.ctr != null ? plan.ctr : b.ctr;
      sd.line = on && plan.line ? plan.line : b.line; sd.kill = on && plan.kill != null ? plan.kill : b.kill;
    },
  };
}
const res = K.compare(K.setup(club), ways, { N, reps: 4, lead: Number(process.env.LEAD || 1) });
for (const [name, r] of Object.entries(res)) console.log(K.line(name, r));
