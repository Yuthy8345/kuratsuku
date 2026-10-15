// 作業7（2026-10-16）キャンプの画面イメージ: 案A〜C の「行き先を選ぶシート」と「キャンプ・レポート」を HTML にして mock.json へ。
// 数字は試作（エンジンにはまだ無い）。shoot.py が実際のアプリ（ホームと秘書のシートの器）に重ねてスクショを撮る。
// usage: cd dev/test/mock_camp && node make_save.js > save.json && node gen.js && KTK_FONTS=... python3 shoot.py all chalk
const fs = require('fs');
const E = require('../../src/engine.js');
const M = require('./save.json');
const S = M.save, c = S.clubs[S.my], P = id => S.players[id];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const kt = '#ffffff';
const KV = `--k1:${c.c1};--k2:${c.c2};--kt:${kt}`;
const pm = (p, cls) => `<span class="cp-pm ${cls || ''}" style="${KV}">${p.num}</span>`;
const nf = E.nextMyFixture(S), opp = S.clubs[nf.h === S.my ? nf.a : nf.h];
const hurt = P(M.hurt); hurt.inj = 40;   // on 1/4: 40 days → 20 days left on 1/24
const away = M.away.map(a => ({ ...a, p: P(a.id) }));
// ---------- the destinations (trial numbers) ----------
const DEST = [
  { k: 'miya', jp: '宮崎', tag: '標準', col: '#2E8B57', ch: '宮', cost: 4000, grow: [2, '3週間分'], link: [2, '練習試合3試合分'], form: [2, '再開時 +0.2'], inj: [1, '少ない'], line: '暖かくグラウンドも多い、定番のキャンプ地。どれもふつうに伸びる。ほかのクラブもここが標準。' },
  { k: 'oki', jp: '沖縄', col: '#1C8FB5', ch: '沖', cost: 7000, grow: [2, '3週間分'], link: [2, '練習試合3試合分'], form: [3, '再開時 +0.4'], inj: [0, 'ほとんどない'], line: 'いちばん暖かい。体を作り直せて調子が上がる。負傷中の選手も連れて行き、リハビリが2倍の速さで進む。' },
  { k: 'kago', jp: '鹿児島', col: '#C8402F', ch: '鹿', cost: 5000, grow: [2, '3週間分'], link: [3, '練習試合5試合分'], form: [2, '再開時 +0.3'], inj: [2, '少し多い'], line: '練習試合の相手が多く、連携が深まる。新しいポジションを試す「できごと」も起きやすい。' },
  { k: 'abr', jp: '海外', sub: 'スペイン', col: '#D99A1E', ch: '海', cost: 18000, grow: [3, '6週間分'], link: [2, '練習試合4試合分'], form: [0, '再開時 −0.2'], inj: [3, '多い'], line: '欧州のクラブと練習試合。若手がいちばん伸びるが、費用が大きく、長旅の疲れが再開まで残る。' },
  { k: 'none', jp: '行かない', col: '#7F868C', ch: '', cost: 0, grow: [0, 'なし'], link: [0, 'なし'], form: [0, '±0'], inj: [0, 'なし'], line: 'クラブハウスで調整。お金はかからないが、ほかのクラブより一歩遅れる。' },
];
const pick = DEST[2];
const man = v => v === 0 ? '0円' : v >= 10000 ? `${(v / 10000).toFixed(1).replace(/\.0$/, '')}億円` : `${v.toLocaleString('ja-JP')}万円`;
const dots = (n, warn) => `<span class="cp-dots${warn ? ' warn' : ''}">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const MET = [['grow', '成長'], ['link', '連携'], ['form', '調子'], ['inj', 'ケガ']];
const meters = d => `<div class="cp-meters">${MET.map(([k, l]) => `<div><span class="l">${l}</span>${dots(d[k][0], k === 'inj')}<small>${d[k][1]}</small></div>`).join('')}</div>`;
const AKI = '{{AKI}}';
const head = `<div class="sec-head">${AKI}<div style="min-width:0;flex:1"><div class="eyebrow">秘書からの連絡</div><b class="sec-name">秘書 あき</b></div></div>`;
const period = '1/24（土）〜2/2（火）';
const intro = `<p class="small" style="margin:0">冬のキャンプの行き先を決めましょう。<b>${period}の10日間</b>で、第21節（2/13 ${esc(opp.short)}戦）の11日前に戻ります。</p>`;
const absent = `<section class="sec-sec"><h4>キャンプに来られない選手</h4>
  <div class="cp-abs">${pm(away[0].p)}<span><b>${esc(away[0].p.name)}</b><small>アジアカップに参加中（${E.natJp(away[0].cc)}代表）。戻ったら途中から合流</small></span></div>
  <div class="cp-abs">${pm(hurt, 'out')}<span><b>${esc(hurt.name)}</b><small>負傷中（あと20日）。沖縄なら連れて行き、リハビリが2倍の速さに</small></span></div></section>`;
const rec = `<div class="cp-rec">${AKI.replace('{{AKI}}', '{{AKISM}}')}<p><b>おすすめは鹿児島です。</b>連携の平均がまだ${Math.round(M.avg0)}なので、練習試合で深めましょう。</p></div>`;
const note = `<p class="fine" style="margin:0">決めないまま1/24になると、宮崎（標準）にします。費用はキャンプインの日に払います。ほかのクラブも宮崎と同じだけのキャンプをします。</p>`;
const foot = `<button class="btn primary block" style="min-height:54px;font-size:16px">${pick.jp}に決める（${man(pick.cost)}）</button><button class="btn ghost block">あとで決める</button>`;

// ---------- 案A: the map board ----------
// Kyushu and Okinawa from lon/lat (a rough outline, chalk)
const KY = [[130.96, 33.96], [131.03, 33.86], [131.17, 33.63], [131.43, 33.57], [131.66, 33.66], [131.74, 33.47], [131.6, 33.3], [131.86, 33.27], [131.86, 33.06], [132.06, 32.93], [131.88, 32.8], [131.72, 32.58], [131.63, 32.42], [131.5, 32.12], [131.47, 31.92], [131.4, 31.6], [131.33, 31.37], [131.06, 31.42], [130.95, 31.23], [130.8, 31.08], [130.66, 30.99], [130.7, 31.25], [130.78, 31.45], [130.75, 31.68], [130.57, 31.6], [130.55, 31.4], [130.65, 31.22], [130.52, 31.17], [130.3, 31.25], [130.18, 31.4], [130.28, 31.7], [130.2, 31.98], [130.38, 32.17], [130.55, 32.45], [130.62, 32.65], [130.55, 32.8], [130.5, 32.95], [130.42, 33.05], [130.3, 33.15], [130.2, 33.05], [130.25, 32.88], [130.37, 32.77], [130.3, 32.6], [130.15, 32.62], [130.1, 32.78], [130.0, 32.86], [129.85, 32.72], [129.8, 32.58], [129.73, 32.8], [129.65, 33.0], [129.7, 33.15], [129.6, 33.3], [129.88, 33.43], [130.18, 33.58], [130.38, 33.62], [130.5, 33.85], [130.75, 33.92], [130.96, 33.96]];
const OK = [[127.68, 26.08], [127.67, 26.21], [127.71, 26.44], [127.86, 26.52], [127.86, 26.68], [127.97, 26.62], [128.12, 26.75], [128.26, 26.87], [128.33, 26.75], [128.25, 26.62], [128.05, 26.5], [127.98, 26.32], [127.82, 26.17], [127.68, 26.08]];
const kx = lon => 152 + (lon - 129.5) * 70, ky = lat => 22 + (34 - lat) * 82;
const ox = lon => 73 + (lon - 127.97) * 101.5, oy = lat => 237 - (lat - 26.47) * 119;   // the inset: larger than the scale of Kyushu
// a closed Catmull-Rom curve through the points (a chalk line looks drawn by hand rather than ruled)
const path = (pts, fx, fy) => { const q = pts.slice(0, -1).map(([a, b]) => [fx(a), fy(b)]), n = q.length, f = v => v.toFixed(1);
  let d = `M${f(q[0][0])} ${f(q[0][1])}`;
  for (let i = 0; i < n; i++) { const p0 = q[(i - 1 + n) % n], p1 = q[i], p2 = q[(i + 1) % n], p3 = q[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`; }
  return d + ' Z'; };
const POS = { miya: [kx(131.42), ky(31.91)], kago: [kx(130.56), ky(31.6)], oki: [ox(127.86), oy(26.45)], abr: [62, 42], none: [62, 130] };
const pct = (x, y) => `left:${(x / 360 * 100).toFixed(2)}%;top:${(y / 300 * 100).toFixed(2)}%`;
const mapTok = d => { const [x, y] = POS[d.k]; const on = d === pick;
  const inner = d.k === 'none' ? `<span class="kit lg k-tr cpA-club" style="--c1:#0B3B8C;--c2:#F2F2F2;--c3:#D22630;--r:#F2F2F2" aria-hidden="true"></span>` : `<span class="cpA-mag" style="--dc:${d.col}">${d.ch}</span>`;
  return `<button class="cpA-tok${on ? ' on' : ''}${d.k === 'oki' ? ' r' : ''}" style="${pct(x, y)}">${inner}<span class="cpA-lbl"><b>${d.jp}${d.sub ? `<small>（${d.sub}）</small>` : ''}</b><small>${d.cost ? man(d.cost).replace('円', '') : 'クラブで調整'}</small></span></button>`; };
const mapA = `<div class="cpA-map">
  <svg viewBox="0 0 360 300" class="cpA-svg" aria-hidden="true">
    <defs><filter id="cp-chalk"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs>
    <g filter="url(#cp-chalk)">
      <path class="cpA-land" d="${path(KY, kx, ky)}"/>
      <path class="cpA-land" d="${path(OK, ox, oy)}"/>
      <rect class="cpA-inset" x="12" y="178" width="124" height="114" rx="6"/>
      <path class="cpA-air" d="M ${POS.abr[0] + 4} ${POS.abr[1] + 26} C 60 120, 110 150, ${POS.kago[0] - 30} ${POS.kago[1] - 6}"/>
      <path class="cpA-ring" d="M ${POS.kago[0] - 30} ${POS.kago[1] - 2} C ${POS.kago[0] - 30} ${POS.kago[1] - 30}, ${POS.kago[0] + 30} ${POS.kago[1] - 30}, ${POS.kago[0] + 30} ${POS.kago[1] - 2} S ${POS.kago[0] - 20} ${POS.kago[1] + 30}, ${POS.kago[0] - 32} ${POS.kago[1] - 8}"/>
    </g>
  </svg>
  <span class="cpA-note" style="${pct(146, 280)}">沖縄（縮尺は別）</span>
  <span class="cpA-note" style="${pct(170, 14)}">九州</span>
  <span class="cpA-note faint" style="${pct(300, 128)}">日向灘</span>
  ${DEST.map(mapTok).join('')}
</div>`;
const pickCard = `<section class="card cpA-pick"><div class="cpA-ph"><span class="cpA-mag sm" style="--dc:${pick.col}">${pick.ch}</span><div style="flex:1;min-width:0"><b class="nm">${pick.jp}キャンプ</b><small>${period}・10日間</small></div><b class="cost">${man(pick.cost)}</b></div>
  ${meters(pick)}<p class="small" style="margin:0">${pick.line}</p></section>`;
const sheetA = { body: `${head}${intro}${mapA}${pickCard}${rec}${absent}${note}`, foot };

// ---------- the trial camp result (shared by the reports) ----------
const GW = 3 / (10 / 7);   // the trial run gave 10 days at ×2 (=10/7 week); the proposal is 3 weeks' worth
const grow = M.grow.filter(g => g.days > 0).map(g => ({ ...g, add: g.add * GW })).sort((a, b) => b.add - a.add);
const top5 = grow.slice(0, 5), gsum = grow.reduce((s, g) => s + g.add, 0);
const nIn = M.grow.filter(g => g.days > 0).length;
const pairs = M.pairs.map(x => ({ ...x }));
const yk = pairs.find(x => [x.a, x.b].includes(701) && [x.a, x.b].includes(698)); if (yk) yk.v = Math.min(100, yk.v + 10);   // できごと: 意気投合
const avg1 = pairs.reduce((s, x) => s + x.v, 0) / pairs.length;
const tier = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 40 ? 2 : 1;
const hi = x => x.v >= 70 && x.v0 < 70;   // yellow on the board: past 70 at the camp
const EV = [
  { d: '1/25', ic: 'up', p: P(696), t: '紅白戦で2得点の大アピール', fx: '伸びしろ 71 → 72' },
  { d: '1/27', ic: 'pos', p: P(688), t: 'CBの練習で手応え', fx: 'CBの適性 50 → 65' },
  { d: '1/28', ic: 'inj', p: P(700), t: '練習中に足首をひねった', fx: '全治6日（2/3に復帰）' },
  { d: '1/29', ic: 'lk', p: P(701), q: P(698), t: '中盤の2人の息が合ってきた', fx: `連携 ${Math.floor(yk.v - 10)} → ${Math.floor(yk.v)}` },
  { d: '1/31', ic: 'join', p: away[0].p, t: 'アジアカップから合流', fx: `${E.natJp(away[0].cc)}代表・3日間` },
];
const PM = [['1/25', '大学選抜', 4, 0], ['1/27', '鳥栖', 2, 1], ['1/29', '福岡', 1, 1], ['1/31', '大分', 3, 2], ['2/2', '湘南', 0, 1]];
const pmJp = (h, a) => h > a ? '勝' : h < a ? '負' : '分';
const days = Array.from({ length: 10 }, (_, i) => { const d = E.D.add('2027-01-24', i); return { d, md: `${E.D.m(d)}/${E.D.d(d)}`, w: '日月火水木金土'[E.D.dow(d)] }; });
const pmDays = new Set(PM.map(x => x[0]));
const IC = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  pos: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/></svg>',
  inj: '<svg viewBox="0 0 24 24"><path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/></svg>',
  lk: '<svg viewBox="0 0 24 24"><path d="M9 15l6-6M8 11l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2"/></svg>',
  join: '<svg viewBox="0 0 24 24"><path d="M4 12h13M12 6l6 6-6 6"/></svg>',
  ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z"/></svg>',
};
const cal = (cls, plan) => `<div class="cp-cal ${cls || ''}">${days.map(x => { const ev = plan ? [] : EV.filter(e => e.d === x.md); return `<div class="${x.w === '土' ? 'sat' : x.w === '日' ? 'sun' : ''}"><b>${x.md}</b><small>${x.w}</small><span class="ics">${pmDays.has(x.md) ? `<i class="ball">${IC.ball}</i>` : ''}${ev.filter(e => e.ic === 'inj' || e.ic === 'join').map(e => `<i class="${e.ic}">${IC[e.ic]}</i>`).join('')}</span></div>`; }).join('')}</div>`;
const calLeg = `<div class="cp-calleg"><span><i class="ball">${IC.ball}</i>練習試合</span><span><i class="join">${IC.join}</i>合流</span><span><i class="inj">${IC.inj}</i>ケガ</span></div>`;
const r1 = v => (Math.round(v * 10) / 10).toFixed(1);
const growRows = cls => `<div class="cp-grow ${cls || ''}">${top5.map(g => { const p = P(g.id); return `<div class="r">${pm(p)}<span class="n"><b>${esc(p.name)}</b><small>${E.age(p, S.date)}歳・${p.pp}</small></span><span class="v">${r1(p.ovr)}<i>→</i>${r1(p.ovr + g.add)}</span><b class="d">+${r1(g.add)}</b></div>`; }).join('')}</div>`;
const evRows = cls => `<div class="cp-ev ${cls || ''}">${EV.map(e => `<div class="r ev-${e.ic}"><span class="ic">${IC[e.ic]}</span><span class="t"><small>${e.d}</small><b>${esc(e.p.short)}${e.q ? `・${esc(e.q.short)}` : ''}　${e.t}</b><em>${e.fx}</em></span></div>`).join('')}</div>`;
const pmRows = cls => `<div class="cp-pmt ${cls || ''}">${PM.map(([d, o, h, a]) => `<div class="r"><small>${d}</small><span>${o}</span><b>${h}-${a}</b><i class="${pmJp(h, a) === '勝' ? 'w' : pmJp(h, a) === '負' ? 'l' : 'd'}">${pmJp(h, a)}</i></div>`).join('')}</div>`;
// the board with the XI and the chalk lines after the camp (yellow = thicker than before the camp)
const F = E.FORMATIONS[M.form], XI = c.tac.xi.map(P);
const topY = y => 88 - (y - 7) * 1.04;
const lines = pairs.map(x => { const a = F[x.i], b = F[x.j]; const up = hi(x); return (up ? `<line class="glow" x1="${a[1]}" y1="${(topY(a[2]) * 1.275).toFixed(2)}" x2="${b[1]}" y2="${(topY(b[2]) * 1.275).toFixed(2)}"/>` : '') + `<line class="t${tier(x.v)}${up ? ' cb' : ''}" x1="${a[1]}" y1="${(topY(a[2]) * 1.275).toFixed(2)}" x2="${b[1]}" y2="${(topY(b[2]) * 1.275).toFixed(2)}"/>`; }).join('');
const toks = XI.map((p, i) => `<div class="tok" style="left:${F[i][1]}%;top:${topY(F[i][2])}%;${KV}"><span class="shirt">${p.num}</span><span class="lbl">${esc(p.short)}</span></div>`).join('');
const boardA = `<div class="pitch cp-pitch" style="${KV}"><svg class="lines" viewBox="0 0 100 115" preserveAspectRatio="none" aria-hidden="true"><rect x="3" y="3" width="94" height="109" rx="1"/><line x1="3" y1="57.5" x2="97" y2="57.5"/><circle cx="50" cy="57.5" r="9"/><rect x="25" y="3" width="50" height="16"/><rect x="38" y="3" width="24" height="6"/><rect x="25" y="96" width="50" height="16"/><rect x="38" y="106" width="24" height="6"/></svg>
  <svg class="lk-lines cp-lk" viewBox="0 0 100 127.5" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${toks}</div>`;
const upN = pairs.filter(hi).length;
const ykN = Math.floor(yk.v);
const near = `<div class="lk-wrow cp-near"><span><b>中盤の心臓</b>${esc(P(701).short)}・${esc(P(698).short)}が あと${80 - ykN}</span><span class="pg"><span class="lk-bar"><i style="width:${Math.floor(yk.v) / 80 * 100}%"></i></span><span>${Math.floor(yk.v)}／80</span></span></div>`;
const sumLine = `参加${nIn}人・費用${man(pick.cost)}`;
const reportA = { body: `<div class="cpA-rh"><div class="eyebrow">キャンプ・レポート</div><h2>${pick.jp}キャンプ</h2><div class="small muted">${period}・10日間・${sumLine}</div></div>
  ${cal('chalk')}${calLeg}
  <section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">連携</span><span class="lk-sum">平均 ${Math.round(M.avg0)} → <b>${Math.round(avg1)}</b><span class="lk-plus">+${Math.round(avg1 - M.avg0)}</span></span></div>
    ${boardA}<p class="fine" style="margin:0">黄色の線は、キャンプで70を超えた組（${upN}組）。ほかの線も練習試合5試合分だけ太くなっています。</p>${near}</section>
  <section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">伸びた選手</span><span class="lk-sum">チーム全体で <b>+${r1(gsum)}</b></span></div>${growRows()}</section>
  <section class="card cpA-sec"><div class="eyebrow">できごと</div>${evRows()}</section>
  <section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">練習試合</span><span class="lk-sum">2勝1分2敗</span></div>${pmRows()}</section>
  <section class="card cpA-sec cpA-go"><div class="eyebrow">再開に向けて</div><p class="small" style="margin:0">調子が上がって戻ってきました（再開から数試合 <b>調子 +0.3</b>）。第21節は 2/13（土）${esc(opp.short)}戦、あと11日です。</p></section>`,
  foot: '<button class="btn primary block" style="min-height:54px;font-size:16px">わかりました</button>' };

// ---------- 案B: キャンプのしおり (papers pinned to the board) and the 報告書 ----------
const paper = d => { const on = d === pick;
  return `<div class="cpB-paper${on ? ' on' : ''}${d.k === 'none' ? ' plain' : ''}" style="--lc:${d.col}">
    <div class="h"><span class="ttl">${d.jp}${d.sub ? `<small>${d.sub}</small>` : ''}${d.tag ? `<em>${d.tag}</em>` : ''}</span><span class="cost">${d.cost ? man(d.cost) : '0円'}</span></div>
    ${d.k === 'none' ? `<p class="ln">${d.line}</p>` : `${meters(d)}<p class="ln">${d.line}</p>`}
    ${on ? '<span class="cpB-seal">決定</span>' : '<span class="tap">タップで決める</span>'}</div>`; };
const sheetB = { body: `${head}${intro}<div class="row"><span class="eyebrow">キャンプのしおり（${period}）</span></div>${DEST.map(paper).join('')}${rec}${absent}${note}`, foot };
const reportB = { body: `<div class="cpB-doc">
    <div class="cpB-pin"></div>
    <div class="cpB-dh"><small>${E.seasonLabel(S.season)}　冬季キャンプ</small><h2>キャンプ報告書</h2><span class="cpB-done">完了</span></div>
    <dl class="cpB-kv"><dt>行き先</dt><dd>${pick.jp}</dd><dt>期間</dt><dd>${period}（10日間）</dd><dt>参加</dt><dd>${nIn}人（${esc(away[0].p.short)}は1/31から合流）</dd><dt>費用</dt><dd>${man(pick.cost)}</dd></dl>
    <h3>1　成長</h3>${growRows('paper')}<p class="cpB-sum">チーム全体で +${r1(gsum)}</p>
    <h3>2　連携</h3><p class="cpB-p">練習試合5試合分。先発の隣どうしの平均 <b>${Math.round(M.avg0)} → ${Math.round(avg1)}</b>。「中盤の心臓」まで あと${80 - ykN}（${esc(P(701).short)}・${esc(P(698).short)} ${Math.floor(yk.v)}／80）。</p>
    <h3>3　できごと</h3>${evRows('paper')}
    <h3>4　練習試合</h3>${pmRows('paper')}
    <div class="cpB-memo">${'{{AKISM}}'}<p>再開の${esc(opp.short)}戦（2/13）まで あと11日。調子は上向きです（+0.3）。<span>— あき</span></p></div>
  </div>`, foot: reportA.foot };

// ---------- 案C: the chalk table, and a night-ground report ----------
const mk = (n, k) => k === 'inj' ? ['ー', '△', '○', '◎'][n] : ['ー', '△', '○', '◎'][n];
const rowC = d => `<button class="cpC-r${d === pick ? ' on' : ''}"><span class="d"><b>${d.jp}</b>${d.sub ? `<small>${d.sub}</small>` : d.tag ? `<small>${d.tag}</small>` : ''}</span><span class="c">${d.cost ? man(d.cost).replace('万円', '万').replace('億円', '億') : '0'}</span>${MET.map(([k]) => d.k === 'abr' && k === 'form' ? '<span class="m form bad">×</span>' : `<span class="m ${k}${k === 'inj' && d.inj[0] >= 2 ? ' bad' : ''}">${mk(d[k][0], k)}</span>`).join('')}</button>`;
const tableC = `<div class="cpC-board"><svg class="cpC-circle" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 11 C 3 2, 97 1, 97 10 S 6 20, 2 8"/></svg>
  <div class="cpC-h"><span class="d">行き先</span><span class="c">費用</span><span class="m">成長</span><span class="m">連携</span><span class="m">調子</span><span class="m">ケガ</span></div>
  ${DEST.map(rowC).join('')}
  <p class="cpC-legend">◎ とても　○ ふつう　△ 少し　ー なし　× 下がる（ケガは赤いほど多い）</p></div>`;
const pickC = `<div class="cpC-pick"><span class="cpC-chk">✓</span><div><b>${pick.jp}</b>　${pick.line}<div class="cpC-nums">成長 ${pick.grow[1]}・連携 ${pick.link[1]}・調子 ${pick.form[1]}・ケガ ${pick.inj[1]}</div></div></div>`;
const calC = `<section class="sec-sec"><h4>10日間の予定（鹿児島）</h4>${cal('chalk', true)}<div class="cp-calleg"><span><i class="ball">${IC.ball}</i>練習試合（5試合）</span></div><p class="fine" style="margin:0">アジアカップの選手は戻った日の翌日から合流します。</p></section>`;
const sheetC = { body: `${head}${intro}${tableC}${pickC}${rec}${calC}${absent}${note}`, foot };
const mvp = P(696);
const sparks = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 61 + 7) % 100}%;animation-delay:${((i * 37) % 40) / 10}s"></i>`).join('');
const reportC = { body: `<div class="cpC-rep" style="${KV}">
    <div class="cpC-beams" aria-hidden="true"><i></i><i></i></div><div class="rb-sparks" aria-hidden="true">${sparks}</div>
    <div class="cpC-led"><span>CAMP REPORT</span><span>KAGOSHIMA 2027</span></div>
    <div class="cpC-stage"><div class="cpC-mvp"><span class="cp-pm xl" style="${KV}">${mvp.num}</span><span class="cpC-seal">MVP</span></div></div>
    <div class="cpC-epi">キャンプでいちばん輝いた</div>
    <h2 class="cpC-name">${esc(mvp.name)}</h2>
    <div class="cpC-sub">${E.age(mvp, S.date)}歳・CB・紅白戦で2得点　伸びしろ 71 → 72</div>
    <div class="cpC-tiles"><div><small>成長</small><b>+${r1(gsum)}</b><i>${nIn}人</i></div><div><small>連携</small><b>${Math.round(M.avg0)}<em>→</em>${Math.round(avg1)}</b><i>平均</i></div><div><small>調子</small><b>+0.3</b><i>再開時</i></div><div><small>練習試合</small><b class="sm">2-1-2</b><i>勝分敗</i></div></div>
    <div class="cpC-list"><h4>伸びた選手</h4>${growRows('dark')}<h4>できごと</h4>${evRows('dark')}</div>
    <p class="cpC-foot">${pick.jp}・${period}・費用${man(pick.cost)}</p>
  </div>`, foot: '<button class="btn primary block" style="min-height:54px;font-size:16px">再開に向けて</button>' };

const css = fs.readFileSync(__dirname + '/mock.css', 'utf8');
fs.writeFileSync(__dirname + '/mock.json', JSON.stringify({ css, band: '冬のキャンプの行き先を決めましょう ›', A: { sheet: sheetA, report: reportA }, B: { sheet: sheetB, report: reportB }, C: { sheet: sheetC, report: reportC } }));
console.log('avg', M.avg0.toFixed(1), '→', avg1.toFixed(1), 'grow sum', gsum.toFixed(2), 'top', top5.map(g => g.short + ' +' + g.add.toFixed(2)).join(' '), 'in', nIn);
