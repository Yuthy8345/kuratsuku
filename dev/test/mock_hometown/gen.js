// writes mock_A.html (街の地図ボード), mock_B.html (スタジアムが育つ), mock_C.html (チョークのリスト) from the save
const fs = require('fs'), path = require('path');
const I = require('./icons.js');
const { save: S, info } = require('./save.json');
const c = S.clubs[S.my];
const ic = (k, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const n = v => Math.round(v).toLocaleString('ja-JP');
const man = v => v >= 10000 ? `${Math.floor(v / 10000)}万${v % 10000 ? n(v % 10000) : ''}` : n(v);
const oku = v => v >= 10000 ? `${(v / 10000).toFixed(v % 10000 ? (v % 1000 ? 2 : 1) : 0).replace(/\.?0+$/, '')}億` : `${n(v)}万`;
const job = info.job, pct = Math.round((1 - job.left / job.days) * 100);
const fans = info.fans, cap = info.cap, att = info.att;
const B = {
  roof: { jp: '屋根と大型ビジョン', short: '屋根・ビジョン', cost: 120000, mo: 8, up: 350, fx: ['観客 +6%', '1人あたり +100円', 'サポーター +3%'] },
  food: { jp: 'スタジアムグルメ', short: 'グルメ', cost: 20000, mo: 2, up: 60, fx: ['観客 +2%', '1人あたり +200円'] },
  shop: { jp: 'グッズショップ', short: 'ショップ', cost: 30000, mo: 3, up: 80, fx: ['1人あたり +250円'] },
  sclub: { jp: 'サポーターズクラブ', short: 'サポーターズ', cost: 15000, mo: 2, up: 100, fx: ['サポーターの伸び ×1.3', '減り方 ×0.7', 'サポーター +5%'] },
  house: { jp: 'クラブハウス', short: 'クラブハウス', cost: 60000, mo: 5, up: 150, fx: ['コンディションの戻り +0.6/日', '移籍の意思 +5%'] },
  dorm: { jp: '選手寮', short: '選手寮', cost: 50000, mo: 4, up: 120, fx: ['21歳以下の成長 ×1.06', 'ユース昇格 伸びしろ +1'] },
  indoor: { jp: '室内練習場', short: '室内練習場', cost: 80000, mo: 6, up: 200, fx: ['ケガ ×0.85'] },
};
const built = k => !!(c.town && c.town.b && c.town.b[k]);
const FAC = { train: ['練習場', 'train'], youth: ['ユース', 'youth'], medical: ['メディカル', 'medical'], scout: ['スカウト網', 'scout'] };
const common = `
.ht-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ht-stats > div { display: grid; gap: 1px; }
.ht-stats small { font-size: 11px; color: var(--muted); font-weight: 700; }
.ht-stats b { font-family: var(--f-display); font-weight: 400; font-size: 22px; line-height: 1.15; letter-spacing: .01em; }
.ht-stats b span { font-family: var(--f-body); font-size: 12px; font-weight: 700; margin-left: 2px; }
.ht-stats i { font-style: normal; font-size: 11px; color: var(--muted); }
.ht-stats i.up { color: var(--win); font-weight: 700; }
.ht-note { margin: 0; font-size: 12px; color: var(--accent); font-family: var(--f-chalk); }
.ht-prog { position: relative; height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--ink) 12%, transparent); overflow: hidden; }
.ht-prog i { position: absolute; inset: 0 auto 0 0; border-radius: 5px; background: repeating-linear-gradient(135deg, var(--accent-bg) 0 7px, #2b2410 7px 12px); }
.ht-sheet { position: fixed; inset: 0; z-index: 80; }
.ht-sheet .scrim { position: absolute; inset: 0; background: var(--scrim); }
.ht-sheet .sh { position: absolute; left: 0; right: 0; bottom: 0; background-color: var(--bg); background-image: var(--tex); background-size: auto, auto, 4px 4px; border-radius: 16px 16px 0 0; border-top: 3px solid #C9CDD1; padding: 18px 16px calc(18px + var(--sab)); display: grid; gap: 12px; box-shadow: var(--shadow); }
.ht-sheet .grab { width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: -8px auto 0; }
.ht-kv { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ht-kv > div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 2px; }
.ht-kv small { font-size: 11px; color: var(--muted); font-weight: 700; } .ht-kv b { font-family: var(--f-display); font-weight: 400; font-size: 17px; }
.ht-fx { display: flex; flex-wrap: wrap; gap: 6px; } .ht-fx .chip { font-size: 12px; padding: 3px 9px; }
.ic { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
`;
const sheet = k => { const b = B[k]; return `<div class="ht-sheet" id="mock-sheet" hidden><div class="scrim"></div><div class="sh"><div class="grab"></div>
  <div class="row" style="gap:12px"><span class="ht-mag sm built" style="position:static;transform:none">${ic(k)}</span><div style="flex:1;min-width:0"><div class="eyebrow">建てる</div><b style="font-family:var(--f-display);font-weight:400;font-size:20px">${b.jp}</b></div></div>
  <div class="ht-kv"><div><small>費用</small><b>${oku(b.cost)}円</b></div><div><small>工期</small><b>${b.mo}か月</b></div><div><small>維持費</small><b>月${oku(b.up)}</b></div></div>
  <div class="ht-fx">${b.fx.map(x => `<span class="chip acc">${x}</span>`).join('')}</div>
  <p class="fine" style="margin:0">練習の合間に体を休める場所。選手のコンディションが毎日少し早く戻り、移籍の交渉で「行ってもいい」と思われやすくなります。</p>
  <div class="card" style="padding:10px 12px;display:flex;gap:10px;align-items:center"><span class="small" style="flex:1">工事は1つずつ。いまは<b>スタジアム増築</b>の工事中（5/20 完成予定）</span></div>
  <button class="btn primary block" disabled style="opacity:.55">5/20 の完成後に建てられます</button>
  <button class="btn block">閉じる</button></div></div>`; };

/* ---------- 案A 街の地図ボード ---------- */
{
  const W = 361, H = 432;
  // three bands: the club's training ground (top, blue Lv magnets) / the stadium and its buildings / the town (plots)
  const P = {
    stad: [158, 202], exp: [236, 156],
    train: [52, 60], youth: [134, 60], medical: [216, 60], scout: [298, 60],
    shop: [40, 178], food: [40, 252], roof: [306, 176],
    house: [52, 330], dorm: [134, 330], indoor: [216, 330], sclub: [298, 330],
  };
  const lv = k => c.fac[k];
  const mag = (k, x, y, label, st, sub) => `<div class="ht-tok ${st}" style="left:${x}px;top:${y}px"><span class="ht-mag ${st}">${ic(st === 'empty' ? k : k)}${st === 'fac' ? `<em>Lv${sub}</em>` : ''}</span><span class="lbl">${label}</span>${st === 'empty' ? `<span class="pr">${sub}</span>` : ''}</div>`;
  const tokens = [
    mag('train', ...P.train, '練習場', 'fac', lv('train')), mag('youth', ...P.youth, 'ユース', 'fac', lv('youth')),
    mag('medical', ...P.medical, 'メディカル', 'fac', lv('medical')), mag('scout', ...P.scout, 'スカウト網', 'fac', lv('scout')),
    mag('shop', ...P.shop, 'ショップ', 'built'), mag('food', ...P.food, 'グルメ', 'built'),
    mag('roof', ...P.roof, '屋根・ビジョン', 'empty', '12億'),
    mag('house', ...P.house, 'クラブハウス', 'empty', '6億'), mag('dorm', ...P.dorm, '選手寮', 'empty', '5億'),
    mag('indoor', ...P.indoor, '室内練習場', 'empty', '8億'), mag('sclub', ...P.sclub, 'サポーターズ', 'empty', '1.5億'),
  ].join('');
  const html = `<style>${common}
.ht-board { position: relative; width: 100%; height: ${H}px; border-radius: 12px; overflow: hidden; background: radial-gradient(ellipse at 50% 50%, var(--pitch2) 0%, var(--pitch) 72%); box-shadow: inset 0 0 0 1px var(--line), inset 0 0 40px rgba(0,0,0,.18); }
.ht-board svg.map { position: absolute; inset: 0; width: 100%; height: 100%; }
.ht-board .ch { fill: none; stroke: var(--pitch-line); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.ht-board .ch.thin { stroke-width: 1; opacity: .45; }
.ht-board .rail { stroke: var(--pitch-line); stroke-width: 1; opacity: .6; fill: none; }
.ht-board .zone { fill: none; stroke: var(--pitch-line); stroke-width: 1; stroke-dasharray: 3 5; opacity: .5; }
.ht-board .lab { font-family: var(--f-chalk); font-size: 11px; fill: var(--pitch-ink); opacity: .75; }
.ht-tok { position: absolute; transform: translate(-50%, -22px); display: grid; justify-items: center; gap: 2px; width: 84px; pointer-events: none; }
.ht-mag { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; position: relative; }
.ht-mag.built { background: radial-gradient(circle at 34% 28%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 48%), #F2EFE4; color: #1F2A24; box-shadow: 0 3px 0 rgba(0,0,0,.35), 0 6px 10px rgba(0,0,0,.25); border: 3px solid #F2D500; }
.ht-mag.fac { background: radial-gradient(circle at 34% 28%, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 48%), #2F6FD6; color: #fff; box-shadow: 0 3px 0 rgba(0,0,0,.35), 0 6px 10px rgba(0,0,0,.25); width: 40px; height: 40px; }
.ht-mag.fac em { position: absolute; right: -12px; top: -6px; font: 700 10px/16px var(--f-body); font-style: normal; background: #F2EFE4; color: #1F2A24; border-radius: 8px; padding: 0 5px; box-shadow: 0 1px 0 rgba(0,0,0,.3); }
.ht-mag.empty { border: 2px dashed var(--pitch-line); color: var(--pitch-ink); width: 40px; height: 40px; opacity: .7; }
.ht-mag.empty .ic { width: 19px; height: 19px; }
.ht-mag.sm { width: 46px; height: 46px; flex: none; }
.ht-tok .lbl { font-size: 10.5px; line-height: 16px; font-weight: 700; color: #fff; background: rgba(0,0,0,.55); padding: 0 6px; border-radius: 5px; white-space: nowrap; }
.ht-tok.empty .lbl { background: transparent; color: var(--pitch-ink); font-family: var(--f-chalk); font-weight: 400; padding: 0; line-height: 14px; opacity: .9; }
.ht-tok .pr { font-size: 10px; color: var(--accent); font-weight: 700; line-height: 12px; }
.ht-stad { position: absolute; left: ${P.stad[0]}px; top: ${P.stad[1]}px; width: 0; height: 0; }
.ht-stad .bowl { position: absolute; left: -62px; top: -42px; width: 124px; height: 84px; border-radius: 50%; background: radial-gradient(ellipse at 50% 50%, #2d7a4f 0 35%, transparent 36%), repeating-conic-gradient(from 0deg, #F2D500 0 4deg, #c9b100 4deg 8deg); box-shadow: 0 0 0 3px #111, 0 4px 0 rgba(0,0,0,.35), 0 8px 16px rgba(0,0,0,.3); }
.ht-stad .bowl::before { content: ''; position: absolute; inset: 23px 32px; border: 1.5px solid rgba(255,255,255,.75); border-radius: 3px; }
.ht-stad .bowl::after { content: ''; position: absolute; left: 50%; top: 23px; bottom: 23px; border-left: 1.5px solid rgba(255,255,255,.75); }
.ht-stad .ring { position: absolute; left: -80px; top: -57px; width: 160px; height: 114px; border-radius: 50%; border: 7px solid transparent; background: repeating-linear-gradient(135deg, #F2C230 0 6px, #2b2410 6px 11px) border-box; -webkit-mask: linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0); mask: linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0); }
.ht-stad .cap { position: absolute; left: 50%; top: 62px; transform: translateX(-50%); font-size: 11px; font-weight: 900; color: #1F1A08; background: #F2D500; border-radius: 6px; padding: 1px 8px; box-shadow: 0 2px 0 rgba(0,0,0,.35); white-space: nowrap; }
.ht-crane { position: absolute; left: ${P.exp[0]}px; top: ${P.exp[1]}px; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 2px; }
.ht-crane .ht-mag { background: repeating-linear-gradient(135deg, #F2C230 0 7px, #2b2410 7px 12px); color: #1F1A08; box-shadow: 0 3px 0 rgba(0,0,0,.35), 0 6px 10px rgba(0,0,0,.25); }
.ht-crane .ht-mag::before { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: #F2C230; }
.ht-crane .ht-mag .ic { position: relative; }
.ht-crane .lbl { font-size: 10.5px; line-height: 16px; font-weight: 700; color: #1F1A08; background: #F2C230; padding: 0 6px; border-radius: 5px; white-space: nowrap; box-shadow: 0 1px 0 rgba(0,0,0,.3); }
.ht-stats2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ht-stats2 > div { display: grid; gap: 0; }
.ht-stats2 small { font-size: 11px; color: var(--muted); font-weight: 700; }
.ht-stats2 b { font-family: var(--f-display); font-weight: 400; font-size: 20px; line-height: 1.2; }
.ht-stats2 b span { font-family: var(--f-body); font-size: 11px; font-weight: 700; margin-left: 2px; }
.ht-stats2 i { font-style: normal; font-size: 11px; color: var(--muted); } .ht-stats2 i.up { color: var(--win); font-weight: 700; }
</style>
<section class="card" style="display:grid;gap:8px;padding:12px 14px">
  <div class="ht-stats2">
    <div><small>サポーター</small><b>${man(fans)}<span>人</span></b><i class="up">今季 +1,880</i></div>
    <div><small>スタジアム</small><b>${man(cap)}<span>席</span></b><i>平均 ${man(att)}人・${Math.round(info.full * 100)}%</i></div>
  </div>
  <p class="ht-note">満員の試合は、席が取れないサポーターがおよそ${man(Math.round((fans - cap) / 100) * 100)}人。</p>
</section>
<div class="ht-board">
  <svg class="map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><filter id="chalk"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs>
    <g filter="url(#chalk)">
      <rect class="zone" x="8" y="12" width="345" height="94" rx="10"/>
      <path class="ch" d="M-5 122 C 40 106, 80 134, 130 118 S 210 102, 250 116 S 320 130, 370 110"/>
      <path class="ch" d="M-5 133 C 40 117, 80 145, 130 129 S 210 113, 250 127 S 320 141, 370 121"/>
      <path class="rail" d="M-5 283 L 370 275"/><path class="rail" d="M-5 289 L 370 281" />
      ${Array.from({ length: 26 }, (_, i) => { const x = i * 15; const y = 286 - x * 0.021; return `<path class="rail" d="M${x} ${y - 5} L ${x + 1} ${y + 5}"/>`; }).join('')}
      <path class="ch thin" d="M95 400 L 102 300 L 92 140"/><path class="ch thin" d="M361 240 L 270 240 L 250 300"/><path class="ch thin" d="M258 400 L 262 300"/>
    </g>
    <text class="lab" x="18" y="28">クラブの施設</text><text class="lab" x="330" y="150">川</text><text class="lab" x="318" y="304">駅 →</text>
  </svg>
  <div class="ht-stad"><span class="ring"></span><span class="bowl"></span><span class="cap">${n(cap)}席</span></div>
  <div class="ht-crane"><span class="ht-mag">${ic('crane')}</span><span class="lbl">増築 1期 ${pct}%</span></div>
  ${tokens}
</div>
<section class="card" style="display:grid;gap:8px">
  <div class="row"><div class="eyebrow">工事中</div><span class="spacer"></span><span class="chip acc">あと${job.left}日</span></div>
  <div class="row" style="gap:10px"><b style="font-size:15px">スタジアム増築 1期</b><span class="small muted">+5,000席 → ${n(cap + 5000)}席</span></div>
  <div class="ht-prog"><i style="width:${pct}%"></i></div>
  <div class="small muted">5/20 完成予定・工事中のホーム戦は観客 −10%</div>
</section>
<section class="card" style="display:grid;gap:4px"><dl class="kv"><dt>観客1人あたり</dt><dd>${n(info.per * 10000)}円</dd><dt>維持費</dt><dd>月${oku(info.upkeep)}円</dd></dl><p class="fine" style="margin:0">マグネットをタップすると、費用・工期・効果を見て建てられます。工事は1つずつです。</p></section>
${sheet('house')}`;
  fs.writeFileSync(path.join(__dirname, 'mock_A.html'), html);
}

/* ---------- 案B スタジアムが育つ（上から見た図＋図面カード） ---------- */
{
  const rings = [ // inner → outer: now, works, 2期, 3期, 4期
    { r: 0, t: 'now' }, { r: 1, t: 'job' }, { r: 2, t: 'plan', cost: '22億' }, { r: 3, t: 'plan', cost: '30億' }, { r: 4, t: 'plan', cost: '40億' },
  ];
  const cx = 180, cy = 132;
  const rx0 = 84, ry0 = 56, step = 13;
  const ell = (i, cls, extra) => `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${rx0 + i * step}" ry="${ry0 + i * step * 0.78}" ${extra || ''}/>`;
  // seats of the current stand: dots (a full house: 95%)
  let dots = ''; for (let k = 0; k < 120; k++) { const a = (k / 120) * Math.PI * 2; const fill = k % 20 !== 7; for (const d of [-4, 3]) dots += `<circle class="${fill ? 'cr' : 'cr off'}" cx="${(cx + (rx0 - 6 + d) * Math.cos(a)).toFixed(1)}" cy="${(cy + (ry0 - 5 + d * 0.78) * Math.sin(a)).toFixed(1)}" r="1.5"/>`; }
  const cards = [
    { k: 'roof', st: 'can' }, { k: 'sclub', st: 'can' }, { k: 'house', st: 'can' }, { k: 'dorm', st: 'can' }, { k: 'indoor', st: 'can' }, { k: 'shop', st: 'done' }, { k: 'food', st: 'done' },
  ];
  const card = ({ k, st }) => { const b = B[k]; return `<div class="bp ${st}"><span class="pin"></span>
    <div class="bh">${ic(k)}<b>${b.jp}</b>${st === 'done' ? '<span class="seal">完成</span>' : ''}</div>
    <div class="bfx">${b.fx.join('・')}</div>
    ${st === 'done' ? `<div class="bm">維持費 月${oku(b.up)}円</div>` : `<div class="bm"><span>${oku(b.cost)}円</span><span>${b.mo}か月</span><span>月${oku(b.up)}</span></div>`}</div>`; };
  const html = `<style>${common}
.st-top { position: relative; width: 100%; aspect-ratio: 361 / 270; border-radius: 12px; overflow: hidden; background: radial-gradient(ellipse at 50% 45%, var(--pitch2) 0%, var(--pitch) 75%); box-shadow: inset 0 0 0 1px var(--line), inset 0 0 40px rgba(0,0,0,.18); }
.st-top svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.st-top .pitchg { fill: #2a7a4d; stroke: rgba(255,255,255,.75); stroke-width: 1.2; }
.st-top .pl { fill: none; stroke: rgba(255,255,255,.75); stroke-width: 1.1; }
.st-top .now { fill: none; stroke: #F2D500; stroke-width: 15; }
.st-top .now2 { fill: none; stroke: #111; stroke-width: 1.5; }
.st-top .cr { fill: #1F1A08; } .st-top .cr.off { fill: #F2D500; }
.st-top .job { fill: none; stroke: url(#haz); stroke-width: 11; }
.st-top .plan { fill: none; stroke: var(--pitch-line); stroke-width: 1.4; stroke-dasharray: 5 5; }
.st-top .lab { font-family: var(--f-chalk); font-size: 11px; fill: var(--pitch-ink); }
.st-top .lab.y { fill: var(--accent); font-family: var(--f-body); font-weight: 700; font-size: 11px; }
.st-top .tag { font: 900 11px var(--f-body); fill: #1F1A08; }
.st-cap { position: absolute; left: 10px; top: 10px; display: grid; gap: 2px; }
.st-cap small { font-size: 10px; color: var(--muted); font-weight: 700; }
.st-cap b { font-family: var(--f-display); font-weight: 400; font-size: 18px; color: var(--ink); }
.st-cap b em { font-style: normal; color: var(--accent); }
.fanbar { display: grid; gap: 6px; }
.fanbar .row2 { display: grid; grid-template-columns: 76px 1fr 64px; align-items: center; gap: 8px; font-size: 12px; }
.fanbar .tr { position: relative; height: 14px; border-radius: 7px; background: color-mix(in srgb, var(--ink) 10%, transparent); overflow: hidden; }
.fanbar .tr i { position: absolute; inset: 0 auto 0 0; border-radius: 7px; }
.fanbar .tr i.f { background: linear-gradient(90deg, #5CCB8A, #3fae73); }
.fanbar .tr i.s { background: #F2D500; } .fanbar .tr i.j { background: repeating-linear-gradient(135deg, #F2C230 0 5px, #2b2410 5px 9px); opacity: .9; }
.fanbar b { text-align: right; font-weight: 900; }
.bps { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 10px; padding-top: 6px; }
.bp { position: relative; border-radius: 4px; padding: 12px 10px 9px; color: #E8F0FF; display: grid; gap: 6px;
  background: linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 12px 12px, #1F4F9C;
  box-shadow: 0 1px 0 rgba(0,0,0,.25), 0 6px 12px rgba(0,0,0,.22); }
.bp .pin { position: absolute; left: 50%; top: -7px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.55) 0, rgba(255,255,255,0) 50%), #F2D500; box-shadow: 0 2px 0 rgba(0,0,0,.35); }
.bp .bh { display: flex; align-items: center; gap: 6px; } .bp .bh b { font-size: 12.5px; line-height: 1.25; flex: 1; min-width: 0; }
.bp .bh .ic { width: 20px; height: 20px; flex: none; }
.bp .bfx { font-size: 10.5px; line-height: 1.45; color: #C7D8FA; min-height: 30px; }
.bp .bm { display: flex; gap: 8px; font-size: 11px; font-weight: 700; } .bp .bm span:first-child { color: #FFE27A; }
.bp.done { background: linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px) 0 0 / 12px 12px, #F3ECD8; color: #2B2620; }
.bp.done .bfx { color: #5C5446; } .bp.done .bm { color: #5C5446; font-weight: 500; }
.bp .seal { position: absolute; right: 8px; bottom: 8px; width: 40px; height: 40px; border-radius: 50%; border: 2.5px solid #C42A22; color: #C42A22; display: grid; place-items: center; font: 900 12px var(--f-body); transform: rotate(-12deg); opacity: .9; }
</style>
<section class="card" style="display:grid;gap:10px">
  <div class="row"><div class="eyebrow">ホームタウン</div><span class="spacer"></span><span class="small muted">${c.stadium}</span></div>
  <div class="st-top">
    <svg viewBox="0 0 361 270" preserveAspectRatio="none">
      <defs><pattern id="haz" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#2b2410"/><rect width="5" height="10" fill="#F2C230"/></pattern></defs>
      ${ell(4, 'plan')}${ell(3, 'plan')}${ell(2, 'plan')}${ell(1, 'job')}
      ${ell(0, 'now')}${ell(-0.6, 'now2')}${ell(0.6, 'now2')}${dots}
      <rect class="pitchg" x="${cx - 50}" y="${cy - 32}" width="100" height="64" rx="2"/>
      <path class="pl" d="M${cx} ${cy - 32}V${cy + 32}"/><circle class="pl" cx="${cx}" cy="${cy}" r="9"/>
      <rect class="pl" x="${cx - 50}" y="${cy - 14}" width="14" height="28"/><rect class="pl" x="${cx + 36}" y="${cy - 14}" width="14" height="28"/>
      <text class="lab y" x="${cx + rx0 + step * 1 + 6}" y="${cy + 4}" text-anchor="start"></text>
      <g transform="translate(${cx + 52} ${cy - ry0 - step * 0.78 - 12})"><rect x="-4" y="-12" width="96" height="17" rx="5" fill="#F2C230"/><text class="tag" x="44" y="1" text-anchor="middle">1期 工事中 ${pct}%</text></g>
      <text class="lab" x="${cx}" y="${cy + ry0 + step * 4 * 0.78 + 14}" text-anchor="middle">2期 22億　3期 30億　4期 40億（+5,000席ずつ）</text>
    </svg>
    <div class="st-cap"><small>収容</small><b>${n(cap)} <em>→ ${n(cap + 5000)}</em></b></div>
  </div>
  <div class="fanbar">
    <div class="row2"><span>サポーター</span><span class="tr"><i class="f" style="width:${Math.round(fans / 30000 * 100)}%"></i></span><b>${n(fans)}</b></div>
    <div class="row2"><span>いまの席</span><span class="tr"><i class="j" style="width:${Math.round((cap + 5000) / 30000 * 100)}%"></i><i class="s" style="width:${Math.round(cap / 30000 * 100)}%"></i></span><b>${n(cap)}</b></div>
    <div class="small muted">平均 ${n(att)}人（${Math.round(info.full * 100)}%）・満員の試合は約${man(Math.round((fans - cap) / 100) * 100)}人が入れない／5/20 に ${n(cap + 5000)}席</div>
  </div>
</section>
<h3 class="sec-h">建てられるもの<small>工事は1つずつ・費用／工期／維持費</small></h3>
<div class="bps">${cards.map(card).join('')}</div>
<h3 class="sec-h">クラブの施設<small>レベル1〜5</small></h3>
<section class="card" style="display:grid;gap:6px;padding:10px 12px">${Object.entries(FAC).map(([k, [jp, i]]) => `<div class="row" style="gap:10px">${ic(i)}<b style="flex:1">${jp}</b><span class="stars">${'■'.repeat(c.fac[k])}${'□'.repeat(5 - c.fac[k])}</span></div>`).join('')}</section>
${sheet('house')}`;
  fs.writeFileSync(path.join(__dirname, 'mock_B.html'), html);
}

/* ---------- 案C チョークのリスト（シンプル） ---------- */
{
  // supporters over the last 12 months (chalk line)
  const hist = [19000, 19100, 19060, 19420, 19800, 20100, 19950, 20300, 20680, 20900, 21150, 21400];
  const W = 320, H = 70, lo = 14000, hi = 22000;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1) * W).toFixed(1)},${(H - (v - lo) / (hi - lo) * H).toFixed(1)}`).join(' ');
  const capY = (H - (cap - lo) / (hi - lo) * H);
  const row = (k, st, label, sub) => {
    const b = B[k] || {};
    const right = st === 'done' ? '<span class="ck">完成</span>' : st === 'job' ? `<span class="chip acc">工事中 ${pct}%</span>` : st === 'fac' ? `<button class="btn" style="min-height:40px;padding:0 10px;font-size:12px">Lv${sub + 1}へ<br><span class="small">${oku([0, 4000, 12100, 23200, 36800][sub])}円</span></button>` : `<button class="btn" style="min-height:40px;padding:0 10px;font-size:12px">建てる<br><span class="small">${oku(b.cost)}円</span></button>`;
    return `<li class="cl ${st}">${ic(k === 'exp' ? 'exp' : k)}<div class="t"><b>${label}</b><small>${st === 'fac' ? `<span class="stars">${'■'.repeat(sub)}${'□'.repeat(5 - sub)}</span>` : (b.fx || ['+5,000席']).join('・')}${st !== 'done' && st !== 'fac' && b.mo ? `・${b.mo}か月・月${oku(b.up)}` : ''}</small></div>${right}</li>`;
  };
  const html = `<style>${common}
.cl-list { list-style: none; margin: 0; padding: 0; display: grid; }
.cl { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--line); }
.cl:first-child { border-top: 0; }
.cl .t { flex: 1; min-width: 0; display: grid; gap: 1px; } .cl .t b { font-size: 14px; } .cl .t small { font-size: 11px; color: var(--muted); }
.cl .ck { font-family: var(--f-chalk); color: var(--win); font-size: 14px; display: inline-flex; align-items: center; gap: 3px; }
.cl .ck::before { content: '✓'; font-family: var(--f-body); font-weight: 900; }
.cl.done .t b { color: var(--muted); }
.spark { width: 100%; height: 86px; }
.spark .ln { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.spark .cp { stroke: var(--pitch-line); stroke-dasharray: 4 4; stroke-width: 1.2; }
.spark text { font-family: var(--f-chalk); font-size: 10px; fill: var(--muted); }
</style>
<section class="card" style="display:grid;gap:8px">
  <div class="row"><div class="eyebrow">サポーター</div><span class="spacer"></span><span class="chip ok">この1年 +${n(fans - hist[0])}</span></div>
  <div class="ht-stats"><div><small>サポーター</small><b>${man(fans)}<span>人</span></b></div><div><small>平均観客／収容</small><b style="font-size:18px">${man(att)}<span>/ ${man(cap)}</span></b></div></div>
  <svg class="spark" viewBox="-4 -8 ${W + 8} ${H + 22}" preserveAspectRatio="none"><line class="cp" x1="0" x2="${W}" y1="${capY}" y2="${capY}"/><text x="${W}" y="${capY - 4}" text-anchor="end">収容 ${n(cap)}</text><polyline class="ln" points="${pts}"/><text x="0" y="${H + 12}">3月</text><text x="${W}" y="${H + 12}" text-anchor="end">2月</text></svg>
  <p class="ht-note">満員の試合は約${man(Math.round((fans - cap) / 100) * 100)}人が入れません。増築で席を増やしましょう。</p>
</section>
<h3 class="sec-h">スタジアム<small>${c.stadium}</small></h3>
<section class="card" style="padding:0"><ul class="cl-list">
  ${row('exp', 'job', 'スタジアム増築 1期', 0)}${row('roof', 'can', '屋根と大型ビジョン')}${row('food', 'done', 'スタジアムグルメ')}${row('shop', 'done', 'グッズショップ')}
</ul></section>
<h3 class="sec-h">クラブの施設</h3>
<section class="card" style="padding:0"><ul class="cl-list">
  ${row('house', 'can', 'クラブハウス')}${row('dorm', 'can', '選手寮')}${row('indoor', 'can', '室内練習場')}
  ${Object.entries(FAC).map(([k, [jp, i]]) => row(i, 'fac', jp, c.fac[k])).join('')}
</ul></section>
<h3 class="sec-h">街とサポーター</h3>
<section class="card" style="padding:0"><ul class="cl-list">${row('sclub', 'can', 'サポーターズクラブ')}</ul></section>
<p class="fine">工事は1つずつ。維持費 月${oku(info.upkeep)}円・観客1人あたり ${n(info.per * 10000)}円</p>
${sheet('house')}`;
  fs.writeFileSync(path.join(__dirname, 'mock_C.html'), html);
}
console.log('ok', info.att, info.full, pct);
