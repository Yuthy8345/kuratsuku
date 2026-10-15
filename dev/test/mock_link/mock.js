// 作業6（2026-10-15）連携とコンボの画面イメージ。実際の戦術画面と選手シートの上に、案A〜C を描き足す（ブラウザで実行）
window.MOCK = (() => {
  const CSS = `
:root { --lk1: rgba(242,239,228,.42); --lk2: rgba(242,239,228,.74); --lk3: rgba(242,239,228,.97); --lk4: #F2C230; --lkc1: rgba(140,190,255,.75); --lkc4: #FF9DB8; --seal: #E0563F; }
:root[data-board="white"] { --lk1: rgba(36,64,47,.32); --lk2: rgba(36,64,47,.6); --lk3: #24402F; --lk4: #D2402F; --lkc1: rgba(47,111,214,.6); --lkc4: #C2187A; --seal: #C9372A; }
.pitch .lk-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.lk-svg line { stroke-linecap: round; fill: none; }
.lk-svg .t1 { stroke: var(--lk1); stroke-width: 1.6; stroke-dasharray: 2 5; }
.lk-svg .t2 { stroke: var(--lk2); stroke-width: 2.4; }
.lk-svg .t3 { stroke: var(--lk3); stroke-width: 4; }
.lk-svg .t4 { stroke: var(--lk3); stroke-width: 5; }
.lk-svg .cb { stroke: var(--lk4); }
.lk-svg .glow { stroke: var(--lk4); stroke-width: 12; opacity: .22; }
:root[data-board="white"] .lk-svg .glow { opacity: .14; }
/* 案A: the card under the board */
.lk-a { display: grid; gap: 10px; }
.lk-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lk-sum { font-size: 13px; color: var(--muted); }
.lk-sum b { font-family: var(--f-display); font-weight: 400; font-size: 22px; color: var(--ink); margin: 0 2px; }
.lk-plus { margin-left: 6px; padding: 2px 7px; border-radius: 6px; background: color-mix(in srgb, var(--win) 22%, transparent); color: var(--win); font-weight: 700; font-size: 12px; }
.lk-leg { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--muted); }
.lk-leg span { display: inline-flex; align-items: center; gap: 5px; }
.lk-leg svg { width: 24px; height: 8px; overflow: visible; }
.lk-plates { display: grid; gap: 8px; }
.lk-plate { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; background: var(--accent-bg); color: var(--on-accent); box-shadow: 0 4px 0 var(--plate-edge), 0 8px 16px rgba(0,0,0,.25); }
.lk-plate .ic { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(31,26,8,.12); }
.lk-plate .ic svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.lk-plate b { display: block; font-family: var(--f-display); font-weight: 400; font-size: 16px; letter-spacing: .04em; line-height: 1.2; }
.lk-plate small { display: block; font-size: 12px; opacity: .8; font-weight: 700; }
.lk-plate .lk-fx { font-weight: 900; font-size: 13px; white-space: nowrap; }
.lk-wait { display: grid; gap: 6px; }
.lk-wrow { display: grid; grid-template-columns: 1fr 86px; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; border: 1.5px dashed var(--line); color: var(--muted); font-size: 12px; }
:root[data-board="white"] .lk-wrow { border-color: #C3CCD4; }
.lk-wrow b { color: var(--ink); font-size: 13px; margin-right: 6px; }
.lk-bar { position: relative; height: 6px; border-radius: 3px; background: var(--line); }
.lk-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--muted); }
.lk-bar + span { display: block; text-align: right; font-size: 11px; margin-top: 2px; }
/* 案A: player sheet */
.lk-pl { display: grid; gap: 7px; }
.lk-prow { display: grid; grid-template-columns: 30px 1fr 92px 26px; align-items: center; gap: 9px; font-size: 13px; }
.lk-mag { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 12px; border: 2.5px solid var(--k2); background: radial-gradient(circle at 34% 28%, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 48%), var(--k1); color: var(--kt); box-shadow: var(--mag-shadow); }
.lk-prow .nm b { display: block; line-height: 1.2; }
.lk-prow .nm span { font-size: 11px; color: var(--muted); }
.lk-prow .v { font-family: var(--f-display); font-weight: 400; font-size: 16px; text-align: right; }
.lk-cbar { position: relative; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.lk-cbar i { position: absolute; inset: 0 auto 0 0; background: var(--ink); opacity: .85; border-radius: 4px; }
.lk-cbar.hi i { background: var(--lk4); opacity: 1; }
.lk-tag { display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 4px; background: var(--accent-bg); color: var(--on-accent); font-size: 10px; font-weight: 900; vertical-align: 1px; color: #1F1A08 !important; }
/* 案B: numbers on the lines, seals under the board */
.lk-n { position: absolute; transform: translate(-50%, -50%); min-width: 22px; height: 22px; padding: 0 3px; border-radius: 11px; display: grid; place-items: center; font: 900 11px/1 var(--f-body); pointer-events: none; box-shadow: 0 2px 0 rgba(0,0,0,.3); }
.lk-n.n1 { background: rgba(0,0,0,.55); color: rgba(255,255,255,.8); }
.lk-n.n2 { background: #F4F1E6; color: #1E2A24; }
.lk-n.n3 { background: var(--accent-bg); color: var(--on-accent); }
:root[data-board="white"] .lk-n.n1 { background: #DDE3E8; color: #45505E; }
:root[data-board="white"] .lk-n.n2 { background: #fff; color: #18233A; box-shadow: 0 0 0 1.5px #24402F, 0 2px 0 rgba(0,0,0,.15); }
.lk-svg .u { stroke: var(--lk2); stroke-width: 2.2; }
.lk-svg .u.t1 { stroke: var(--lk1); stroke-width: 1.6; stroke-dasharray: 2 5; }
.lk-b { display: grid; gap: 10px; min-width: 0; }
.lk-seals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 4px 6px; }
.lk-seal { aspect-ratio: 1; border-radius: 16px; border: 3px solid var(--seal); color: var(--seal); display: grid; place-items: center; align-content: center; gap: 4px; text-align: center; transform: rotate(-4deg); position: relative; background: color-mix(in srgb, var(--seal) 7%, transparent); }
.lk-seal:nth-child(2) { transform: rotate(3deg); } .lk-seal:nth-child(3) { transform: rotate(-2deg); }
.lk-seal::before { content: ""; position: absolute; inset: 4px; border: 1.2px solid var(--seal); border-radius: 11px; opacity: .7; }
.lk-seal b { font-family: var(--f-display); font-weight: 400; font-size: 17px; line-height: 1.15; letter-spacing: .06em; }
.lk-seal small { font-family: var(--f-chalk); font-size: 12px; color: var(--ink); }
.lk-seal.off { border-style: dashed; border-color: var(--line); color: var(--muted); background: none; transform: none; }
:root[data-board="white"] .lk-seal.off { border-color: #C3CCD4; }
.lk-seal.off::before { display: none; }
.lk-seal.off b { font-size: 14px; }
.lk-seal.off small { color: var(--muted); }
.lk-bhead { display: flex; justify-content: space-between; align-items: baseline; }
/* 案B: player sheet mini board */
.lk-mini { position: relative; height: 300px; border-radius: 12px; overflow: hidden; background: radial-gradient(ellipse at 50% 50%, var(--pitch2) 0%, var(--pitch) 72%); box-shadow: inset 0 0 0 1px var(--line); }
.lk-mini .m { position: absolute; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 11px; border: 2.5px solid var(--k2); background: var(--k1); color: var(--kt); box-shadow: var(--mag-shadow); }
.lk-mini .m.me { width: 40px; height: 40px; font-size: 15px; box-shadow: 0 0 0 4px var(--lk4), var(--mag-shadow); }
.lk-mini .m.dim { opacity: .45; }
.lk-mini .nm { position: absolute; transform: translate(-50%, 0); font-size: 10px; font-weight: 700; color: #fff; background: rgba(0,0,0,.5); padding: 0 4px; border-radius: 4px; white-space: nowrap; }
:root[data-board="white"] .lk-mini .nm { background: rgba(24,35,58,.75); }
.lk-mini svg { position: absolute; inset: 0; width: 100%; height: 100%; }
/* 案C: a toggle, colour by strength, rings on the magnets, a chalk list */
.lk-toggle { margin-bottom: -4px; }
.lk-svg .c1 { stroke: var(--lkc1); stroke-width: 1.8; stroke-dasharray: 3 5; }
.lk-svg .c2 { stroke: var(--lk2); stroke-width: 2.6; }
.lk-svg .c3 { stroke: var(--lk4); stroke-width: 3.6; }
.lk-svg .c4 { stroke: var(--lkc4); stroke-width: 4.8; }
.tok .lk-ring { position: absolute; left: 50%; top: -4px; width: 48px; height: 48px; margin-left: -24px; border-radius: 50%; background: conic-gradient(var(--lk4) calc(var(--p) * 1%), rgba(255,255,255,.14) 0); -webkit-mask: radial-gradient(circle, transparent 20px, #000 20.5px); mask: radial-gradient(circle, transparent 20px, #000 20.5px); }
:root[data-board="white"] .tok .lk-ring { background: conic-gradient(var(--lk4) calc(var(--p) * 1%), rgba(24,35,58,.12) 0); }
.tok .shirt { z-index: 1; }
.tok .ov.lk { color: var(--lk4); font-weight: 900; }
.lk-pill { position: absolute; left: 8px; top: 8px; z-index: 3; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--on-accent); font-size: 12px; font-weight: 900; box-shadow: 0 3px 0 var(--plate-edge); }
.lk-c { display: grid; gap: 8px; }
.lk-clist { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.lk-clist li { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; padding: 7px 2px; border-bottom: 1px dashed var(--line); font-size: 12px; color: var(--muted); }
.lk-clist li b { font-family: var(--f-chalk); font-weight: 400; font-size: 16px; color: var(--ink); margin-right: 6px; }
.lk-clist li.on b { color: var(--lk4); }
.lk-clist .mk { font-family: var(--f-chalk); font-size: 18px; color: var(--lk4); text-align: center; }
.lk-clist li.off .mk { color: var(--muted); }
.lk-clist .lk-fx { font-weight: 900; color: var(--ink); white-space: nowrap; }
.lk-clist li.off .lk-fx { color: var(--muted); font-weight: 700; }
.lk-crow { display: grid; grid-template-columns: 26px 1fr auto; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 13px; }
.lk-crow .mk { font-family: var(--f-chalk); font-size: 20px; color: var(--lk4); text-align: center; }
.lk-crow .mk.m2 { color: var(--ink); } .lk-crow .mk.m3 { color: var(--muted); }
.lk-crow small { display: block; color: var(--muted); font-size: 11px; }
.lk-crow .v { font-family: var(--f-display); font-weight: 400; font-size: 17px; }
`;
  const ICON = {
    hot: '<path d="M4 18 L12 6 L20 18"/><path d="M14 4 l2 -1 M17 7 l2 0"/><circle cx="12" cy="6" r="2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v7M15 12v7"/>',
    yo: '<path d="M12 21V11"/><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
    nat: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  };
  const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const style = () => { if (!document.getElementById('lk-css')) document.head.insertAdjacentHTML('beforeend', `<style id="lk-css">${CSS}</style>`); };
  const pitch = () => document.querySelector('#view .pitch');
  // magnet centres in px (the tok sits at left/top %, its 40px magnet is the first row: centre = top − 1px)
  const centres = pt => { const r = pt.getBoundingClientRect(); return [...pt.querySelectorAll('.tok')].map(t => ({ x: parseFloat(t.style.left) / 100 * r.width, y: parseFloat(t.style.top) / 100 * r.height - 1, t })); };
  const cut = (a, b, r) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); return [a.x + dx / l * r, a.y + dy / l * r, b.x - dx / l * r, b.y - dy / l * r]; };
  const comboLines = D => { const s = new Set(); for (const x of D.combos) if (x.on && x.line) s.add(Math.min(...x.line) + '-' + Math.max(...x.line)); return s; };
  const svgOf = (pt, inner) => { const r = pt.getBoundingClientRect(); return `<svg class="lk-svg" viewBox="0 0 ${r.width} ${r.height}" aria-hidden="true"><defs><filter id="lk-chalk"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter></defs><g filter="url(#lk-chalk)">${inner}</g></svg>`; };
  const tierA = v => v >= 90 ? 't4' : v >= 70 ? 't3' : v >= 40 ? 't2' : 't1';
  const afterBoard = html => { const pt = pitch(); const fine = pt.nextElementSibling; (fine && fine.matches('p.fine') ? fine : pt).insertAdjacentHTML('afterend', html); };
  const kitVars = D => { const lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }; return `--k1:${D.kit.c1};--k2:${D.kit.c2};--kt:${lum(D.kit.c1) > 0.6 ? '#141414' : '#fff'}`; };
  const prog = x => `${x.val}${x.unit || ''}／${x.need}${x.unit || ''}`;

  function A(D) {
    style(); const pt = pitch(), C = centres(pt), cb = comboLines(D);
    const lines = D.pairs.map(p => { const [x1, y1, x2, y2] = cut(C[p.i], C[p.j], 21); const isCb = cb.has(p.i + '-' + p.j); return `${isCb ? `<line class="glow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` : ''}<line class="${tierA(p.v)}${isCb ? ' cb' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
    pt.querySelector('svg.lines').insertAdjacentHTML('afterend', svgOf(pt, lines));
    const leg = (cls, t) => `<span><svg viewBox="0 0 24 8"><line class="${cls}" x1="2" y1="4" x2="22" y2="4" style="stroke-linecap:round"/></svg>${t}</span>`;
    const legSvgCss = '<style>.lk-leg line.t1{stroke:var(--lk1);stroke-width:1.6;stroke-dasharray:2 4}.lk-leg line.t2{stroke:var(--lk2);stroke-width:2.4}.lk-leg line.t3{stroke:var(--lk3);stroke-width:4}.lk-leg line.cb{stroke:var(--lk4);stroke-width:4}</style>';
    const plates = D.combos.filter(x => x.on).map(x => `<div class="lk-plate"><span class="ic">${ic(x.k)}</span><span><b>${x.name}</b><small>${x.who}・${x.val}</small></span><span class="lk-fx">${x.fx}</span></div>`).join('');
    const wait = D.combos.filter(x => !x.on).map(x => `<div class="lk-wrow"><span><b>${x.name}</b>${x.cond}</span><span><span class="lk-bar"><i style="width:${Math.min(100, x.val / x.need * 100)}%"></i></span><span>${prog(x)}</span></span></div>`).join('');
    afterBoard(`${legSvgCss}<section class="card lk-a">
      <div class="lk-head"><span class="eyebrow">連携（隣り合う${D.pairs.length}組）</span><span class="lk-sum">平均<b>${D.avg}</b><span class="lk-plus">チーム力 +${D.bonus}</span></span></div>
      <div class="lk-leg">${leg('t1', '〜39')}${leg('t2', '40〜')}${leg('t3', '70〜')}${leg('cb', 'コンボ')}</div>
      <div class="lk-head" style="margin-top:2px"><span class="eyebrow">コンボ ${D.on}/3</span><span class="small muted">先発のときに発動</span></div>
      <div class="lk-plates">${plates}</div>
      <div class="lk-wait">${wait}</div>
    </section>`);
  }
  function sheetA(D) {
    style(); const kv = kitVars(D);
    const rows = D.part.slice(0, 5).map(x => `<div class="lk-prow"><span class="lk-mag" style="${kv}">${x.num}</span><span class="nm"><b>${x.short}${x.v >= 80 && x.adj ? '<span class="lk-tag">ホットライン</span>' : ''}</b><span>${x.pp}・一緒に約${x.mins.toLocaleString('ja-JP')}分</span></span><span class="lk-cbar${x.v >= 80 ? ' hi' : ''}"><i style="width:${x.v}%"></i></span><span class="v">${x.v}</span></div>`).join('');
    insertSheet(`<div><div class="eyebrow" style="margin-bottom:8px">相性のいい選手（連携）</div><div class="lk-pl">${rows}</div><p class="fine" style="margin:8px 0 0">一緒にピッチに立つほど上がり、離れていると少しずつ下がります。</p></div>`);
  }
  function B(D) {
    style(); const pt = pitch(), C = centres(pt);
    const lines = D.pairs.map(p => { const [x1, y1, x2, y2] = cut(C[p.i], C[p.j], 21); return `<line class="u${p.v < 40 ? ' t1' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
    pt.querySelector('svg.lines').insertAdjacentHTML('afterend', svgOf(pt, lines));
    const pr = pt.getBoundingClientRect();
    const busy = [...pt.querySelectorAll('.tok .shirt, .tok .lbl, .tok .ov')].map(e => { const r = e.getBoundingClientRect(); return [r.left - pr.left - 2, r.top - pr.top - 2, r.right - pr.left + 2, r.bottom - pr.top + 2]; });
    const hit = (x, y) => busy.some(r => x + 12 > r[0] && x - 12 < r[2] && y + 11 > r[1] && y - 11 < r[3]);
    const nums = D.pairs.map(p => { const a = C[p.i], b = C[p.j]; let x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      for (const t of [0.5, 0.43, 0.57, 0.37, 0.63, 0.32, 0.68]) { const xx = a.x + (b.x - a.x) * t, yy = a.y + (b.y - a.y) * t; if (!hit(xx, yy)) { x = xx; y = yy; break; } }
      busy.push([x - 12, y - 11, x + 12, y + 11]);
      return `<span class="lk-n ${p.v >= 80 ? 'n3' : p.v >= 50 ? 'n2' : 'n1'}" style="left:${x}px;top:${y}px">${p.v}</span>`; }).join('');
    pt.querySelector('.lk-svg').insertAdjacentHTML('afterend', nums);
    const seals = D.combos.slice(0, 3).map(x => x.on ? `<div class="lk-seal"><b>${x.name.length > 4 ? x.name.replace(/^(.{3})/, '$1<br>') : x.name}</b><small>${x.fx}</small></div>` : `<div class="lk-seal off"><b>${x.name}</b><small>${prog(x)}</small></div>`).join('');
    afterBoard(`<section class="lk-b">
      <div class="lk-bhead"><span class="eyebrow">コンボ ${D.on}/3</span><span class="small muted">連携の平均 <b style="color:var(--ink)">${D.avg}</b>（チーム力 +${D.bonus}）</span></div>
      <div class="lk-seals">${seals}</div>
      <p class="fine" style="margin:0">線の数字が連携（0〜100）。80を超える組は黄色。あと「生え抜きの誇り」「異国の絆」など。</p>
    </section>`);
  }
  function sheetB(D) {
    style(); const kv = kitVars(D);
    insertSheet(`<div><div class="eyebrow" style="margin-bottom:8px">連携マップ（今の先発）</div><div class="lk-mini" id="lk-mini"></div>
      <p class="fine" style="margin:8px 0 0">いちばん合うのは <b style="color:var(--ink)">${D.part[0].short}（${D.part[0].v}）</b>。線の数字が連携（0〜100）。</p></div>`);
    // a small board: the XI where they stand, this player's lines to each team-mate with the number on it
    const box = document.getElementById('lk-mini'), W = box.getBoundingClientRect().width, H = 300;
    const pos = D.slots.map(s => { const tok = document.querySelectorAll('#view .pitch .tok')[s.i]; return { x: (parseFloat(tok.style.left) / 100 * 0.9 + 0.05) * W, y: (parseFloat(tok.style.top) / 100 * 0.84 + 0.06) * H }; });
    const me = pos[D.tg.si];
    const vOf = s => { const x = D.part.find(y => y.si === s.i); return x ? x.v : 0; };
    const ln = D.slots.filter(s => s.i !== D.tg.si).map(s => { const v = vOf(s), q = pos[s.i]; const dx = q.x - me.x, dy = q.y - me.y, l = Math.hypot(dx, dy); return `<line class="${v >= 80 ? 't4 cb' : v >= 50 ? 't2' : 't1'}" x1="${me.x + dx / l * 25}" y1="${me.y + dy / l * 25}" x2="${q.x - dx / l * 16}" y2="${q.y - dy / l * 16}"/>`; }).join('');
    box.innerHTML = svgMini(W, H, ln) + D.slots.map(s => { const v = vOf(s), isMe = s.i === D.tg.si, p = pos[s.i]; return `<span class="m${isMe ? ' me' : v < 50 ? ' dim' : ''}" style="left:${p.x}px;top:${p.y}px;${kv}">${s.num}</span><span class="nm" style="left:${p.x}px;top:${p.y + (isMe ? 24 : 16)}px">${s.short}</span>`; }).join('');
    const br = box.getBoundingClientRect();
    const busy = [...box.querySelectorAll('.m, .nm')].map(e => { const r = e.getBoundingClientRect(); return [r.left - br.left - 2, r.top - br.top - 2, r.right - br.left + 2, r.bottom - br.top + 2]; });
    const hit = (x, y) => busy.some(r => x + 12 > r[0] && x - 12 < r[2] && y + 11 > r[1] && y - 11 < r[3]);
    box.insertAdjacentHTML('beforeend', D.slots.filter(s => s.i !== D.tg.si).map(s => { const v = vOf(s), q = pos[s.i]; let x = (me.x + q.x) / 2, y = (me.y + q.y) / 2;
      for (const t of [0.55, 0.62, 0.48, 0.7, 0.42, 0.76]) { const xx = me.x + (q.x - me.x) * t, yy = me.y + (q.y - me.y) * t; if (!hit(xx, yy)) { x = xx; y = yy; break; } }
      busy.push([x - 12, y - 11, x + 12, y + 11]);
      return `<span class="lk-n ${v >= 80 ? 'n3' : v >= 50 ? 'n2' : 'n1'}" style="left:${x}px;top:${y}px">${v}</span>`; }).join(''));
  }
  const svgMini = (W, H, inner) => `<svg class="lk-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><filter id="lk-chalk2"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs><g filter="url(#lk-chalk2)">${inner}</g></svg>`;
  function C(D) {
    style(); const pt = pitch(), Cn = centres(pt);
    const tier = v => v >= 90 ? 'c4' : v >= 70 ? 'c3' : v >= 40 ? 'c2' : 'c1';
    const lines = D.pairs.map(p => { const [x1, y1, x2, y2] = cut(Cn[p.i], Cn[p.j], 25); return `<line class="${tier(p.v)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
    pt.querySelector('svg.lines').insertAdjacentHTML('afterend', svgOf(pt, lines));
    D.slots.forEach(s => { const t = Cn[s.i].t; t.insertAdjacentHTML('afterbegin', `<span class="lk-ring" style="--p:${s.avg}"></span>`); const ov = t.querySelector('.ov'); ov.textContent = `連携 ${s.avg}`; ov.classList.add('lk'); });
    pt.insertAdjacentHTML('beforeend', `<span class="lk-pill">コンボ ${D.on}/3 ▸</span>`);
    pt.insertAdjacentHTML('beforebegin', '<div class="seg lk-toggle"><button aria-pressed="false">メンバー</button><button aria-pressed="true">連携を見る</button></div>');
    const items = D.combos.map(x => `<li class="${x.on ? 'on' : 'off'}"><span class="mk">${x.on ? '✓' : '・'}</span><span><b>${x.name}</b>${x.on ? `${x.who}（${x.val}）` : `${x.cond}　${prog(x)}`}</span><span class="lk-fx">${x.fx}</span></li>`).join('');
    const leg = '<div class="lk-leg"><span style="color:var(--lkc1)">┄ 〜39</span><span>― 40〜</span><span style="color:var(--lk4)">━ 70〜</span><span style="color:var(--lkc4)">━ 90〜</span><span>輪＝その選手の平均</span></div>';
    afterBoard(`<section class="card lk-c"><div class="lk-head"><span class="eyebrow">コンボ（最大3つ）</span><span class="lk-sum">連携の平均<b>${D.avg}</b><span class="lk-plus">+${D.bonus}</span></span></div>${leg}<ul class="lk-clist">${items}</ul></section>`);
  }
  function sheetC(D) {
    style();
    const mk = v => v >= 80 ? ['◎', ''] : v >= 60 ? ['○', 'm2'] : ['△', 'm3'];
    const rows = D.part.slice(0, 5).map(x => { const [m, c] = mk(x.v); return `<div class="lk-crow"><span class="mk ${c}">${m}</span><span><b>${x.name}</b><small>${x.pp}・一緒に約${x.mins.toLocaleString('ja-JP')}分${x.v >= 80 && x.adj ? '・ホットライン' : ''}</small></span><span class="v">${x.v}</span></div>`; }).join('');
    insertSheet(`<div><div class="eyebrow" style="margin-bottom:4px">相性</div>${rows}<p class="fine" style="margin:8px 0 0">◎80以上・○60以上・△それ以下。一緒に出るほど上がります。</p></div>`);
  }
  // the player sheet: the new block goes just above ポジション
  function insertSheet(html) {
    const body = document.querySelector('#sheet .sheet-body');
    const pos = [...body.querySelectorAll('.eyebrow')].find(e => e.textContent.trim() === 'ポジション');
    (pos ? pos.parentElement : body.lastElementChild).insertAdjacentHTML('beforebegin', `<div id="lk-sb">${html}</div>`);
  }
  return { A, B, C, sheetA, sheetB, sheetC };
})();
