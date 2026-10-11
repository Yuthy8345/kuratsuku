/* クラつく — UI layer */
(function () {
'use strict';
const E = window.Engine, DATA = window.GAME_DATA;
const LS_KEY = 'touchline.j1.save';
const root = document.getElementById('root');
const sheetEl = document.getElementById('sheet'), scrimEl = document.getElementById('scrim'), toastEl = document.getElementById('toast');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ORDER = ['kashima', 'mito', 'urawa', 'chiba', 'kashiwa', 'fctokyo', 'tokyov', 'machida', 'kawasakif', 'yokohamafm', 'shimizu', 'nagoya', 'kyoto', 'gosaka', 'cosaka', 'kobe', 'okayama', 'hiroshima', 'fukuoka', 'nagasaki'];
const WD = ['日', '月', '火', '水', '木', '金', '土'];

let S = null;
let UI = { screen: 'title', tab: 'home', sq: { pos: 'ALL', sort: 'pos' }, lg: { view: 'table', round: null, cup: 'ec' }, cl: { view: 'main' }, mk: { pos: '', q: '', fa: false } };
let sheetState = null;
let MATCH = null;
let PREVIEW = null;

function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const TODAY = todayISO();
const jd = s => E.jdate(s);
const jdw = s => E.jdate(s, true);
function fmtDate(s) { return `${E.D.y(s)}/${E.D.m(s)}/${E.D.d(s)}(${WD[E.D.dow(s)]})`; }
function fmtLong(s) { return `${E.D.y(s)}年${E.D.m(s)}月${E.D.d(s)}日`; }

/* ---------- save / load ---------- */
function serialize(st) { const json = JSON.stringify(st); try { if (window.LZString) return 'lz:' + window.LZString.compressToBase64(json); } catch (e) { /* fall through */ } return json; }
function deserialize(str) {
  if (!str) return null;
  try { if (str.startsWith('lz:')) return window.LZString ? JSON.parse(window.LZString.decompressFromBase64(str.slice(3))) : null; return JSON.parse(str); } catch (e) { return null; }
}
let saveT = null;
function saveLocalNow() { if (!S) return; S.savedAt = Date.now(); try { localStorage.setItem(LS_KEY, serialize(S)); UI.localOk = true; } catch (e) { UI.localOk = false; } }
function saveLocal() { clearTimeout(saveT); saveT = setTimeout(saveLocalNow, 60); }
window.addEventListener('pagehide', () => { if (saveT) { clearTimeout(saveT); saveLocalNow(); } });
function loadLocal() { try { return deserialize(localStorage.getItem(LS_KEY)); } catch (e) { return null; } }
function persist(cloud) { if (cloud) { clearTimeout(saveT); saveLocalNow(); setTimeout(cloudSave, 200); } else saveLocal(); }

const Cloud = { db: null, uid: null, busy: false, pending: false, status: 'checking', meta: null, cand: null, last: 0 };
async function cloudInit() {
  try {
    if (!window.claude || !window.claude.use) { Cloud.status = 'off'; return; }
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) { Cloud.status = 'off'; return; }
    const uid = await user.id();
    if (!uid) { Cloud.status = 'off'; return; }
    Cloud.db = db; Cloud.uid = uid; Cloud.status = 'on';
    const snap = await db.doc(`data/users/${uid}/meta`).get();
    if (snap.exists) Cloud.meta = snap.data();
    if (Cloud.meta && Cloud.meta.chunks && !Cloud.meta.deleted) {
      const local = loadLocal();
      if (!local || (Cloud.meta.savedAt || 0) > (local.savedAt || 0) + 1000) {
        const st = await cloudLoad();
        if (st) { Cloud.cand = st; if (!S) render(); }
      }
    }
  } catch (e) { Cloud.status = 'off'; }
  if (!S) render();
}
async function cloudLoad() {
  try {
    const n = Cloud.meta.chunks; let str = '';
    for (let i = 0; i < n; i++) { const sn = await Cloud.db.doc(`data/users/${Cloud.uid}/c${i}`).get(); if (!sn.exists) return null; str += sn.data().s; }
    return deserialize(str);
  } catch (e) { return null; }
}
async function cloudSave() {
  if (Cloud.status !== 'on' || !S) return;
  if (Cloud.busy) { Cloud.pending = true; return; }
  Cloud.busy = true;
  try {
    const str = serialize(S); const CH = str.startsWith('lz:') ? 200000 : 60000; const n = Math.ceil(str.length / CH);
    for (let i = 0; i < n; i++) await Cloud.db.doc(`data/users/${Cloud.uid}/c${i}`).set({ s: str.slice(i * CH, (i + 1) * CH) });
    const meta = { savedAt: S.savedAt || Date.now(), chunks: n, club: S.my, season: S.season, date: S.date };
    await Cloud.db.doc(`data/users/${Cloud.uid}/meta`).set(meta);
    Cloud.meta = meta; Cloud.last = Date.now(); Cloud.err = null;
  } catch (e) { Cloud.err = (e && e.code) || 'error'; }
  Cloud.busy = false;
  if (Cloud.pending) { Cloud.pending = false; setTimeout(cloudSave, 1500); }
}
async function cloudWipe() {
  if (Cloud.status !== 'on') return;
  try { await Cloud.db.doc(`data/users/${Cloud.uid}/meta`).set({ deleted: true, savedAt: Date.now() }); Cloud.meta = null; } catch (e) { /* ignore */ }
}

/* ---------- small renderers ---------- */
function lum(hex) { const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function kit(cid, size) { const c = S && S.clubs[cid] || (PREVIEW && PREVIEW.clubs[cid]); if (!c) return '<span class="kit"></span>'; return `<span class="kit ${size || ''}" style="--c1:${c.c1};--c2:${c.c2}" aria-hidden="true"></span>`; }
function oc(v) { return v >= 75 ? 'o-elite' : v >= 70 ? 'o-good' : v >= 64 ? 'o-mid' : 'o-low'; }
function condBar(c) { const cls = c >= 85 ? '' : c >= 70 ? 'mid' : 'low'; return `<span class="bar" title="コンディション ${Math.round(c)}%"><i class="${cls}" style="width:${Math.round(c)}%"></i></span>`; }
function formChips(arr) { return arr.length ? arr.map(r => `<span class="res res-${r}">${{ W: '勝', D: '分', L: '敗' }[r]}</span>`).join('') : '<span class="muted small">—</span>'; }
function natChip(p) { return p.nat && p.nat !== 'JPN' ? `<span class="chip">${esc(p.nat)}</span>` : ''; }
function potStars(p) { const g = p.pot - p.ovr; return g >= 10 ? '★★★' : g >= 5 ? '★★☆' : g >= 2 ? '★☆☆' : '☆☆☆'; }
function rankOf(cid) { const t = E.table(S); const i = t.findIndex(r => r.id === cid); if (i < 0 || !t[i].p) return '—'; return i + 1; }
function ratingCls(r) { return r >= 7.2 ? 'hi' : r < 6 ? 'lo' : ''; }

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
  squad: '<svg viewBox="0 0 24 24"><path d="M8.5 3.5L4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/></svg>',
  tactics: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M6.5 9.5l2.5 2.5m0-2.5L6.5 12"/><circle cx="16" cy="14.5" r="2"/></svg>',
  league: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4.2M16 6h3a3 3 0 0 1-3 4.2M12 13v3.5M8.5 20h7M10 16.5h4V20h-4z"/></svg>',
  club: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V10.5L12 5l7 5.5V20M9.5 20v-5h5v5M12 5V2.5h3"/></svg>',
};

/* ---------- title & club select ---------- */
function viewTitle() {
  const se = E.seasonForDate(TODAY, 2026);
  const local = loadLocal();
  const save = pickSave(local, Cloud.cand);
  const saveLine = save ? `<div class="card"><div class="eyebrow">セーブデータ</div><div class="row" style="margin-top:6px">${kitFor(save, save.my)}<div><b>${esc(save.clubs[save.my].name)}</b><div class="small muted">${E.seasonLabel(save.season)}・${fmtDate(save.date)}${save === Cloud.cand ? '・クラウド' : ''}</div></div></div></div>` : '';
  return `<div class="title">
    <div class="title-top">
      <div>
        <div class="eyebrow">J1 CLUB MANAGEMENT</div>
        <h1>クラつく</h1>
        <p class="lede">Jのクラブをつくろう。片手で回すクラブ経営。</p>
      </div>
      <div class="led" aria-label="シーズン情報">
        <div class="ln"><span>SEASON</span><span>KICK OFF</span></div>
        <div class="ln"><span class="big">26/27</span><span class="big">8.07</span></div>
        <div class="ln"><span>J1 20 CLUBS</span><span>38 ROUNDS</span></div>
      </div>
      <dl class="kv">
        <dt>開始日</dt><dd>${fmtLong(TODAY)}</dd>
        <dt>対象シーズン</dt><dd>2026/27（開幕 2026年8月7日）</dd>
      </dl>
      ${se.note ? `<p class="fine">今日の日付からは${E.seasonLabel(se.computed)}シーズンにあたりますが、収録データは2026/27シーズン版のため、2026/27の開幕から始まります。</p>` : `<p class="fine">開始日が含まれる2026/27シーズンの開幕（8月7日）からスタートします。</p>`}
      ${saveLine}
      <p class="fine">選手と在籍クラブはJリーグ公式サイトの2026/27シーズン登録選手（2026年9月時点）をもとにしています。能力値は独自の推定です。クラブのエンブレムは使用していません。非商用のファンメイドゲームです。</p>
    </div>
    <div class="title-actions">
      ${save ? `<button class="btn primary block" data-act="continue">続きから</button><button class="btn ghost block" data-act="toSelect">新しく始める</button>` : `<button class="btn primary block" data-act="toSelect">新しく始める</button>`}
      <button class="btn ghost block" data-act="importOpen" style="min-height:46px;font-size:14px">引き継ぎコードで復元</button>
    </div>
  </div>`;
}
function kitFor(st, cid) { const c = st.clubs[cid]; return `<span class="kit lg" style="--c1:${c.c1};--c2:${c.c2}" aria-hidden="true"></span>`; }
function pickSave(a, b) { if (a && b) return (b.savedAt || 0) > (a.savedAt || 0) ? b : a; return a || b || null; }
function presBadge(c) { const n = E.presStars(c.pres); return `<span class="stars" aria-label="クラブの格">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
function titlesText(c) {
  const t = c.titles || {}; const parts = [];
  if (t.j1) parts.push(`J1優勝${t.j1}回`); if (t.lc) parts.push(`Lカップ${t.lc}回`); if (t.ec) parts.push(`天皇杯${t.ec}回`); if (t.acl) parts.push(`アジア制覇${t.acl}回`);
  return parts.length ? parts.join('・') : '主要タイトルなし';
}
function stars(rank) { const n = rank <= 3 ? 5 : rank <= 7 ? 4 : rank <= 13 ? 3 : rank <= 17 ? 2 : 1; return '★'.repeat(n) + '☆'.repeat(5 - n); }
function viewSelect() {
  if (!PREVIEW) PREVIEW = E.newGame(DATA, 'kashima', '', TODAY);
  const P = PREVIEW;
  return `<div class="title"><div class="title-top" style="padding-top:8px">
    <div class="select-head"><div class="eyebrow">2026/27 明治安田J1リーグ</div><h2>率いるクラブを選ぶ</h2><p class="fine">右の★はチーム力（選手の実力にクラブの格を加えたもの）。格はタイトル歴とJ1在籍年数から決まり、選手の集まりやすさやフロントの期待にも影響します。</p></div>
    <ul class="list">${ORDER.map(id => {
      const c = P.clubs[id];
      return `<li><button class="crow" data-act="pickClub" data-id="${id}"><span class="kit lg" style="--c1:${c.c1};--c2:${c.c2}" aria-hidden="true"></span><span><b>${esc(c.name)}</b><span>${esc(c.area)}・資金 ${E.money(c.funds)}</span></span><span style="display:grid;justify-items:end;gap:2px"><span class="stars" aria-label="チーム力">${stars(c.pred)}</span><span class="small muted">格：${E.presLabel(c.pres)}</span></span></button></li>`;
    }).join('')}</ul>
  </div>
  <div class="title-actions"><button class="btn ghost block" data-act="toTitle">戻る</button></div></div>`;
}
function sheetClub(id) {
  const P = PREVIEW, c = P.clubs[id];
  const top = E.squad(P, id).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  sheetState = { type: 'club', id };
  openSheet(`<div class="row"><span class="kit lg" style="--c1:${c.c1};--c2:${c.c2}"></span><div><div class="eyebrow">${esc(c.area)}</div><h2>${esc(c.name)}</h2></div></div>
    <dl class="kv"><dt>ホーム</dt><dd>${esc(c.stadium)}</dd><dt>収容</dt><dd>${c.cap.toLocaleString('ja-JP')}人</dd><dt>資金</dt><dd>${E.money(c.funds)}</dd><dt>スポンサー収入</dt><dd>月 ${E.money(c.spon)}</dd><dt>チーム力</dt><dd><span class="stars">${stars(c.pred)}</span>（${c.pred}番手）</dd><dt>クラブの格</dt><dd>${presBadge(c)} ${E.presLabel(c.pres)}</dd><dt>クラブの目標</dt><dd>${esc(c.target.jp)}</dd></dl>
    <p class="fine" style="margin:-6px 0 0">${titlesText(c)}${c.o10 ? '・Jリーグ創設メンバー' : ''}</p>
    <div><div class="eyebrow" style="margin-bottom:6px">主力選手</div><ul class="list">${top.map(p => `<li><div class="prow" style="grid-template-columns:30px 1fr auto">${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, P.date)}歳 ${natChip(p)}</span></span><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></div></li>`).join('')}</ul></div>
    <label class="ctlrow"><span class="small muted">監督名（任意）</span><input class="input" id="mgr-name" maxlength="12" placeholder="あなた" autocomplete="off"></label>`,
    `<button class="btn primary block" data-act="startClub" data-id="${id}">${esc(c.short)}で始める</button><button class="btn ghost block" data-act="closeSheet">ほかのクラブを見る</button>`);
}

/* ---------- main shell ---------- */
function render() {
  if (!S) { root.innerHTML = UI.screen === 'select' ? viewSelect() : viewTitle(); return; }
  const views = { home: viewHome, squad: viewSquad, tactics: viewTactics, league: viewLeague, club: viewClub };
  if (S.clubs[S.my] && !S.fired) E.validateLineup(S, S.my);
  root.innerHTML = `<div class="app">${header()}<main class="view" id="view">${views[UI.tab]()}</main></div>${dock()}`;
}
function header() {
  const c = S.clubs[S.my]; const r = rankOf(S.my);
  return `<header class="hdr"><div class="hdr-club">${kit(S.my)}<div style="min-width:0"><b>${esc(c.short)}</b><div class="hdr-date"><strong>${fmtDate(S.date)}</strong>　${E.seasonLabel(S.season)}・${r === '—' ? '開幕前' : r + '位'}</div></div></div><div class="hdr-money">資金<b class="num ${c.funds < 0 ? 'neg' : ''}">${E.money(c.funds)}</b></div></header>`;
}
function goState() {
  if (S.fired) return { label: '新しいクラブへ', sub: 'オファーを確認' };
  if (S.seasonEnd) return { label: 'シーズン総括', sub: '最終結果を見る' };
  const mf = E.myFixtureToday(S);
  if (mf) { const opp = mf.h === S.my ? mf.a : mf.h; return { label: '試合へ', sub: `${E.fxLabel(mf)} vs ${esc(S.clubs[opp].short)}` }; }
  const nx = E.nextMyFixture(S);
  if (nx) { const d = E.D.diff(nx.date, S.date); return { label: '次へ進む', sub: `次の試合 ${jdw(nx.date)}<br>あと${d}日` }; }
  return { label: '次へ進む', sub: '' };
}
function dock() {
  const g = goState();
  const unseen = S.inbox.some(x => x.type === 'offer' && !x.done && !x.seen);
  const fix = !S.fired && S.clubs[S.my] && E.lineupIssues(S, S.my).block;
  const tabs = [['home', 'ホーム'], ['squad', '選手'], ['tactics', '戦術'], ['league', 'リーグ'], ['club', 'クラブ']];
  return `<nav class="dock" aria-label="メイン操作"><div class="dock-in">
    <button class="go" data-act="go"><b>${g.label}</b><span class="row"><small>${g.sub}</small><span class="arrow" aria-hidden="true">▶</span></span></button>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" data-act="tab" data-tab="${k}" ${UI.tab === k ? 'aria-current="page"' : ''}>${ICON[k]}<span>${l}</span>${(k === 'home' && unseen) || (k === 'tactics' && fix) ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>
  </div></nav>`;
}

/* ---------- home ---------- */
function ticket(f) {
  const H = S.clubs[f.h], A = S.clubs[f.a];
  const t = E.table(S); const opp = f.h === S.my ? f.a : f.h;
  const of = (t.find(r => r.id === opp) || { form: [] }).form.slice(-5);
  const rk = id => { if (!inJ1(id)) return 'J2'; const r = rankOf(id); return r === '—' ? '開幕前' : r + '位'; };
  const story = storyChips(f);
  return `<section class="ticket ${f.cup ? 'cup' : ''}" aria-label="次の試合">
    <div class="ticket-top"><span>${f.cup ? `${E.CUPS[f.cup].en} ${E.CUPS[f.cup].enr[f.cr]}` : `ROUND ${String(f.r).padStart(2, '0')}`}</span><span>${jdw(f.date)}${f.date === S.date ? ' TODAY' : ''}</span></div>
    <div class="ticket-mid">
      <div class="tside ${f.h === S.my ? 'me' : ''}">${kit(f.h, 'lg')}<b>${esc(H.short)}</b><small>${rk(f.h)}・${f.neutral ? '国立' : 'HOME'}</small></div>
      <div class="tvs">VS</div>
      <div class="tside ${f.a === S.my ? 'me' : ''}">${kit(f.a, 'lg')}<b>${esc(A.short)}</b><small>${rk(f.a)}・${f.neutral ? '国立' : 'AWAY'}</small></div>
    </div>
    ${story ? `<div class="ticket-story">${story}</div>` : ''}
    <div class="ticket-perf"></div>
    <div class="ticket-foot"><span>${E.fxLabel(f)}・${esc(venueOf(f))}</span>${inJ1(opp) ? `<span class="row">相手の直近 <span class="formline">${formChips(of)}</span></span>` : ''}</div>
  </section>`;
}
function offerCard(it) {
  const p = S.players[it.pid]; if (!p) return '';
  const v = E.value(p, S.date);
  return `<article class="card" style="display:grid;gap:10px">
    <div class="row">${kit(it.from)}<div style="min-width:0"><b>${esc(S.clubs[it.from].name)}</b><div class="small muted">${jd(it.d)}着・${jd(it.exp)}まで有効</div></div></div>
    <div>${esc(p.name)}（${p.pos}・${E.ovr(p)}）に <b>${E.money(it.fee)}</b> を提示。<span class="small muted">市場価値 ${E.money(v)}</span></div>
    <div class="grid2"><button class="btn ghost" data-act="offerNo" data-id="${it.id}">断る</button><button class="btn primary" data-act="offerYes" data-id="${it.id}">受ける</button></div>
  </article>`;
}
function viewHome() {
  const out = [];
  const nx = E.nextMyFixture(S);
  if (S.fired) out.push(`<div class="card"><div class="eyebrow">お知らせ</div><h3 style="margin-top:4px">監督を解任された</h3><p class="small muted" style="margin:6px 0 0">${esc(S.fired.reason)}。下の「新しいクラブへ」からオファーを確認できます。</p></div>`);
  else if (S.seasonEnd) out.push(`<div class="card"><div class="eyebrow">${S.seasonEnd.label}</div><h3 style="margin-top:4px">全日程が終了</h3><p class="small muted" style="margin:6px 0 0">${S.seasonEnd.myPos}位でフィニッシュ。下のボタンからシーズン総括へ。</p></div>`);
  else if (nx) out.push(ticket(nx));
  if (!S.history.length && !S.fired && !S.seasonEnd && !S.fixtures.some(f => f.played && (f.h === S.my || f.a === S.my))) out.push(`<section class="card" style="display:grid;gap:6px"><div class="eyebrow">はじめに</div><p class="small" style="margin:0">下の<b>「次へ進む」</b>で日付が進み、試合の日やオファーが届いた日に止まります。メンバーは「戦術」、補強は「クラブ → 移籍市場」から。8月28日までは夏の移籍期間です。</p></section>`);
  for (const it of S.inbox.filter(x => x.type === 'scout' && !x.done)) {
    const ps = it.pids.map(id => S.players[id]).filter(Boolean);
    if (!ps.some(p => p.club === 'FA')) { it.done = true; continue; }
    it.seen = true;
    out.push(`<section class="card" style="display:grid;gap:8px"><div class="row"><div class="eyebrow">スカウトレポート・${esc(E.SCOUT[it.at].jp)}</div><span class="spacer"></span><span class="small muted">${jd(it.exp)}まで</span></div>
      <ul class="list">${ps.map(p => p.club === 'FA' ? prow(p, 'market') : `<li><div class="row" style="padding:10px 12px">${posTag(p)}<b>${esc(p.name)}</b><span class="spacer"></span><span class="chip ok">${p.club === S.my ? '契約済み' : '移籍済み'}</span></div></li>`).join('')}</ul>
      <p class="fine" style="margin:0">タップして伸びしろを確認し、契約できます。</p></section>`);
  }
  const offers = S.inbox.filter(x => x.type === 'offer' && !x.done);
  if (offers.length) { out.push(`<h3 class="sec-h">移籍オファー<small>${offers.length}件</small></h3>`); offers.forEach(o => { out.push(offerCard(o)); o.seen = true; }); }
  if (S.lastResult) {
    const f = S.fixtures.find(x => x.id === S.lastResult.fid);
    if (f && f.played) out.push(`<button class="card" data-act="fxDetail" data-id="${f.id}" style="text-align:left;display:grid;gap:4px"><div class="eyebrow">前の試合の結果</div><div class="row"><span class="res res-${S.lastResult.res}">${{ W: '勝', D: '分', L: '敗' }[S.lastResult.res]}</span><b>${esc(S.clubs[f.h].short)} ${f.hg} - ${f.ag} ${esc(S.clubs[f.a].short)}${pkText(f)}</b><span class="spacer"></span><span class="small muted">${E.fxLabel(f)}</span></div></button>`);
  }
  // board + mini table
  const c = S.clubs[S.my];
  const t = E.table(S); const me = t.findIndex(r => r.id === S.my);
  const lo = Math.max(0, Math.min(me - 2, t.length - 5)); const mini = t.slice(lo, lo + 5);
  out.push(`<section class="card" style="display:grid;gap:10px">
    <div class="row"><div class="eyebrow">フロントの信頼</div><span class="spacer"></span><b class="tnum">${S.board}</b></div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.board}"><i style="left:${S.board}%"></i></div>
    <div class="small muted">目標：${esc(c.target.jp)}　／　開幕前予想 ${c.pred}位</div>
  </section>`);
  out.push(`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th style="text-align:left">クラブ</th><th>試</th><th>差</th><th>勝点</th></tr></thead><tbody>${mini.map(r => { const i = t.indexOf(r) + 1; return `<tr class="${r.id === S.my ? 'me' : ''}"><td>${r.p ? i : '—'}</td><td class="club"><div>${kit(r.id, 'sm')}${esc(S.clubs[r.id].short)}</div></td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`; }).join('')}</tbody></table></div>`);
  out.push(`<h3 class="sec-h">ニュース</h3><ul class="news">${S.news.slice(0, 18).map(n => `<li class="t-${n.type}"><time>${jd(n.d)}</time><span>${esc(n.text)}</span></li>`).join('')}</ul>`);
  return out.join('');
}

/* ---------- squad ---------- */
function prow(p, ctx) {
  const c = S.clubs[S.my]; const a = E.age(p, S.date);
  const chips = [];
  if (p.club === S.my) {
    if (c.tac.xi.includes(p.id)) chips.push('<span class="chip ok">先発</span>'); else if (c.tac.bench.includes(p.id)) chips.push('<span class="chip">ベンチ</span>');
    if (p.listed) chips.push('<span class="chip acc">放出リスト</span>');
  }
  const sp = subPos(p); if (sp.length) chips.push(`<span class="chip">+${sp.slice(0, 3).join('/')}</span>`);
  if (p.inj > 0) chips.push(`<span class="chip warn">負傷 ${p.inj}日</span>`);
  if (p.sus > 0) chips.push('<span class="chip warn">出場停止</span>');
  if (p.hot) chips.push('<span class="chip fire">燃えている</span>');
  const lead = ctx === 'market' ? (S.clubs[p.club] ? kit(p.club) : '<span class="chip">FA</span>') : `<span class="no">${p.num}</span>`;
  const sub = ctx === 'market' ? `${S.clubs[p.club] ? esc(S.clubs[p.club].short) : 'フリー'}・${a}歳・${E.money(E.value(p, S.date))}` : `${a}歳`;
  return `<li><button class="prow" data-act="player" data-id="${p.id}">${lead}${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${sub} ${natChip(p)}${chips.join('')}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${ctx === 'market' ? '' : condBar(p.cond)}</span></button></li>`;
}
const POS_ORD = { GK: 0, DF: 1, MF: 2, FW: 3 };
const inJ1 = id => S.order.includes(id);
const pkText = f => f.pk ? `（PK ${f.pk[0]}-${f.pk[1]}）` : '';
const venueOf = f => f.neutral ? E.NATIONAL.stadium : S.clubs[f.h].stadium;
// what makes a match special (derby, cup tie...) and who is on fire
function storyChips(f) {
  const tags = f.hype ? f.hype.tags.slice() : [E.rivalry(S, f.h, f.a), f.cup ? E.fxLabel(f) : null].filter(Boolean);
  if (f.hype && f.hype.rev && f.hype.rev.includes(S.my)) tags.push('リベンジマッチ');
  return tags.map(t => `<span class="chip story">${esc(t)}</span>`).join('');
}
// why a player can't play, e.g. 出場停止（あと1試合） / 負傷（あと5日）
const outText = p => p.inj > 0 ? `負傷（あと${p.inj}日）` : `出場停止（あと${p.sus}試合）`;
const outShort = p => p.inj > 0 ? '負傷' : '出場停止';
function issueLines(iss) {
  const c = S.clubs[S.my]; const F = E.FORMATIONS[c.tac.form];
  return iss.xi.map(x => x.pid ? `${E.ROLE[F[x.i][0]].jp}：${S.players[x.pid].name}が${outText(S.players[x.pid])}` : `${E.ROLE[F[x.i][0]].jp}が空いています`)
    .concat(iss.bench.map(x => `ベンチ：${S.players[x.pid].name}が${outText(S.players[x.pid])}`));
}
const dpOf = p => p.pp || (p.at ? E.ppOf(p) : p.pos);
const DP_ORD = p => { const i = E.DPOS.indexOf(dpOf(p)); return i < 0 ? 0 : i; };
function posTag(p, st) { const dp = dpOf(p); return `<span class="pos pos-${E.DP_CAT[dp] || p.pos}"${st ? ` style="${st}"` : ''}>${dp}</span>`; }
// other positions the player handles well (適性85以上)
function subPos(p) { if (p.pos === 'GK' || !p.at) return []; const pp = dpOf(p); return E.DPOS.filter(dp => dp !== 'GK' && dp !== pp && E.apt(p, dp) >= 85); }
const aptCls = a => a >= 90 ? 'hi' : a >= 70 ? 'mid' : 'low';
// aptitude for every position; interactive=true turns the cells into retraining buttons
function aptGrid(p, interactive) {
  const pp = dpOf(p); const rows = [['DF', ['CB', 'SB']], ['MF', ['DMF', 'CMF', 'OMF', 'SH']], ['FW', ['CF', 'ST', 'WG']]];
  const cell = dp => {
    const a = Math.round(E.apt(p, dp)); const own = dp === pp; const done = !own && a >= E.LEARN_MAX; const on = p.learn && p.learn.pos === dp;
    const tag = own ? '本職' : on ? `習得中 ${a}` : done ? '習得済' : String(a);
    const inner = `<b>${dp}</b><span class="apv">${tag}</span><span class="apbar"><i class="${aptCls(a)}" style="width:${a}%"></i></span>`;
    const cls = `apc ${own ? 'own' : ''} ${on ? 'on' : ''}`;
    if (!interactive) return `<div class="${cls}">${inner}</div>`;
    return `<button class="${cls}" data-act="setLearn" data-id="${p.id}" data-k="${on ? '' : dp}" aria-pressed="${!!on}" ${own || done ? 'disabled' : ''} aria-label="${dp} ${E.DP_JP[dp]} 適性${a}">${inner}</button>`;
  };
  return `<div class="aptgrid">${rows.map(([cat, dps]) => `<div class="aprow"><span class="apcat pos-${cat}">${cat}</span><div class="apcells" style="grid-template-columns:repeat(${dps.length},1fr)">${dps.map(cell).join('')}</div></div>`).join('')}</div>`;
}
const TEAM_TRAIN_DESC = { bal: '成長と回復のバランス型。', hard: '全員がよく伸びる代わりに疲れが抜けにくい。', tact: '連携が深まり試合で中盤がやや有利に。成長は控えめ。', rest: '疲労回復を最優先。成長はゆっくり。' };
// whole-number change; with soft=true a small move that doesn't change the shown number reads as 微増/微減
function dlt(x, soft) {
  const v = Math.round(x);
  if (!v) { if (soft && x >= 0.15) return '<span class="dlt up">微増</span>'; if (soft && x <= -0.15) return '<span class="dlt dn">微減</span>'; return '<span class="dlt">±0</span>'; }
  return `<span class="dlt ${v > 0 ? 'up' : 'dn'}">${v > 0 ? '+' : ''}${v}</span>`;
}
const shownDiff = (now, then) => Math.round(now) - Math.round(then);
function attrRows(p, withDelta) {
  const at = p.at || E.attrs(p); const idx = E.ATTR_SHOW[p.pos];
  return `<div style="display:grid;gap:7px">${idx.map(i => { const v = Math.round(at[i]); const d = withDelta && p.at0 ? shownDiff(at[i], p.at0[i]) : 0; return `<div class="attr"><span>${E.ATTR[i]}</span><span class="bar"><i class="${v >= 70 ? '' : v >= 55 ? 'mid' : 'low'}" style="width:${v}%"></i></span><b>${v}</b>${withDelta ? dlt(d) : ''}</div>`; }).join('')}</div>`;
}
function rolesLine(p) { return E.bestRoles(p, 3).map(r => `<span class="chip">${r.jp} <b style="color:var(--ink)">${Math.round(r.v)}</b></span>`).join(''); }
function devRow(p) {
  const a = E.age(p, S.date); const F = E.FOCUS[p.tf || 'auto']; const I = E.INTENS[p.ti || 'norm'];
  const chips = [`${a}歳`, `<span class="chip ${p.tf && p.tf !== 'auto' ? 'acc' : ''}">${F.jp}</span>`];
  if (p.ti && p.ti !== 'norm') chips.push(`<span class="chip ${p.ti === 'hard' ? 'warn' : ''}">${I.jp}</span>`);
  if (p.learn) chips.push(`<span class="chip ok">${p.learn.pos}習得中 ${Math.floor(E.apt(p, p.learn.pos))}</span>`);
  if (p.inj > 0) chips.push(`<span class="chip warn">負傷</span>`);
  const d = p.ovr0 != null ? shownDiff(p.ovr, p.ovr0) : 0;
  return `<li><button class="prow" data-act="train" data-id="${p.id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${chips.join('')}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${dlt(d)}</span></button></li>`;
}
function viewDev() {
  const c = S.clubs[S.my];
  let list = E.squad(S, S.my);
  if (UI.sq.dev === 'young') list = list.filter(p => E.age(p, S.date) <= 23);
  list.sort((a, b) => a.birth.localeCompare(b.birth) * -1);
  const custom = E.squad(S, S.my).filter(p => (p.tf && p.tf !== 'auto') || (p.ti && p.ti !== 'norm') || p.learn).length;
  return `<section class="card" style="display:grid;gap:10px">
      <div class="row"><div class="eyebrow">チーム練習</div><span class="spacer"></span><span class="small muted">練習場 Lv${c.fac.train}</span></div>
      <div class="seg" style="flex-wrap:wrap">${Object.entries(E.TRAINING).map(([k, t]) => `<button data-act="training" data-k="${k}" aria-pressed="${S.training === k}">${t.jp}</button>`).join('')}</div>
      <p class="fine">${TEAM_TRAIN_DESC[S.training]}選手ごとのメニューは下のリストから。成長は毎週月曜に反映されます。</p>
    </section>
    <div class="row"><div class="seg" style="flex:1">${[['all', '全員'], ['young', '23歳以下']].map(([k, l]) => `<button data-act="devFilter" data-k="${k}" aria-pressed="${(UI.sq.dev || 'all') === k}">${l}</button>`).join('')}</div>${custom ? `<button class="btn ghost" data-act="devReset" style="min-height:48px">全員おまかせ</button>` : ''}</div>
    <p class="fine" style="margin-top:-6px">右の数字は総合力と、今季開幕時からの増減です。</p>
    <ul class="list">${list.map(devRow).join('') || '<li class="empty">該当する選手がいません</li>'}</ul>`;
}
function viewSquad() {
  const sub = `<div class="subnav"><div class="seg">${[['list', '選手一覧'], ['dev', '育成']].map(([k, l]) => `<button data-act="sqView" data-k="${k}" aria-pressed="${(UI.sq.view || 'list') === k}">${l}</button>`).join('')}</div></div>`;
  if (UI.sq.view === 'dev') return viewDev() + sub;
  let list = E.squad(S, S.my);
  const all = list.length, avg = list.reduce((a, p) => a + p.ovr, 0) / Math.max(1, all), wages = list.reduce((a, p) => a + E.wage(p), 0);
  if (UI.sq.pos !== 'ALL') list = list.filter(p => p.pos === UI.sq.pos);
  const so = UI.sq.sort;
  list.sort((a, b) => so === 'ovr' ? b.ovr - a.ovr : so === 'age' ? a.birth.localeCompare(b.birth) * -1 : so === 'cond' ? a.cond - b.cond : (POS_ORD[a.pos] - POS_ORD[b.pos]) || (DP_ORD(a) - DP_ORD(b)) || a.num - b.num);
  const sorts = [['pos', 'ポジション'], ['ovr', '能力'], ['age', '若い順'], ['cond', '疲労']];
  return `<div class="row wrap" style="justify-content:space-between"><div><div class="eyebrow">トップチーム</div><b style="font-family:var(--f-display);font-weight:400;font-size:20px">${all}人</b><span class="small muted">　平均能力 ${Math.round(avg)}</span></div><div class="small muted" style="text-align:right">年俸総額<br><b style="color:var(--ink)">${E.money(wages)}</b></div></div>
    <div class="seg" role="group" aria-label="ポジション">${['ALL', 'GK', 'DF', 'MF', 'FW'].map(k => `<button data-act="sqPos" data-k="${k}" aria-pressed="${UI.sq.pos === k}">${k === 'ALL' ? '全員' : k}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="並び順">${sorts.map(([k, l]) => `<button data-act="sqSort" data-k="${k}" aria-pressed="${so === k}">${l}</button>`).join('')}</div>
    <ul class="list">${list.map(p => prow(p)).join('') || '<li class="empty">該当する選手がいません</li>'}</ul>
    ${sub}`;
}
function sheetPlayer(id) {
  const p = S.players[id]; if (!p) return;
  sheetState = { type: 'player', id };
  const mine = p.club === S.my; const club = S.clubs[p.club];
  const a = E.age(p, S.date); const v = E.value(p, S.date);
  const avgR = p.st.apps ? (p.st.rt / p.st.apps).toFixed(2) : '—';
  const status = [];
  if (p.inj > 0) status.push(`<span class="chip warn">負傷中（あと${p.inj}日）</span>`);
  if (p.sus > 0) status.push('<span class="chip warn">出場停止</span>');
  if (p.listed) status.push('<span class="chip acc">放出リスト登録中</span>');
  if (p.retire) status.push('<span class="chip">今季限りで引退</span>');
  if (p.hot) status.push(`<span class="chip fire">燃えている（${esc(p.hot.why)}）</span>`);
  if (E.bigGame(p)) status.push('<span class="chip">大舞台に強い</span>');
  if (p.found && p.club === 'FA') status.push('<span class="chip acc">スカウト推薦</span>');
  const hist = p.hist && p.hist.length ? `<div><div class="eyebrow" style="margin-bottom:6px">過去の成績</div><ul class="list">${p.hist.map(h => `<li><div class="row" style="padding:9px 12px;font-size:13px"><b>${h.s}</b><span class="muted">${esc(S.clubs[h.c] ? S.clubs[h.c].short : '')}</span><span class="spacer"></span><span class="tnum">${h.apps}試合 ${h.g}得点 ${h.a}A</span></div></li>`).join('')}</ul></div>` : '';
  let foot;
  if (mine) {
    foot = `<button class="btn primary block" data-act="train" data-id="${p.id}">トレーニングを設定</button><div class="grid2">${p.retire ? '<button class="btn ghost" disabled>引退が決まっています</button>' : `<button class="btn ghost" data-act="toggleList" data-id="${p.id}">${p.listed ? '放出リストから外す' : '放出リストに載せる'}</button>`}<button class="btn ghost" data-act="closeSheet">閉じる</button></div>`;
  } else if (p.club === 'FA') {
    const sign = Math.round(E.wage(p) * 0.5 / 10) * 10;
    foot = `<button class="btn primary block" data-act="sign" data-id="${p.id}">契約する（契約金 ${E.money(sign)}）</button><button class="btn ghost block" data-act="closeSheet">閉じる</button>`;
  } else {
    const open = E.inWindow(S.date);
    const mults = [0.9, 1.0, 1.2, 1.5];
    foot = open ? `<div class="small muted">移籍金を提示（${club ? esc(club.short) : ''}・〜${jd(E.windowEnd(S.date))}）</div><div class="grid2">${mults.map(m => `<button class="btn ${m === 1.2 ? 'primary' : ''}" data-act="bid" data-id="${p.id}" data-m="${m}">${E.money(Math.round(v * m / 100) * 100)}</button>`).join('')}</div><button class="btn ghost block" data-act="closeSheet">閉じる</button>`
      : `<div class="small muted">移籍期間外です。次の移籍期間は ${jd(E.nextWindowStart(S.date))} から。</div><button class="btn ghost block" data-act="closeSheet">閉じる</button>`;
  }
  openSheet(`<div class="row">${posTag(p)}<span class="small muted">#${p.num}・${club ? esc(club.name) : 'フリー'}・${a}歳 ${natChip(p)}</span></div>
    <h2>${esc(p.name)}</h2>
    ${status.length ? `<div class="row wrap">${status.join('')}</div>` : ''}
    <div class="bigovr"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span><dl class="kv" style="flex:1"><dt>伸びしろ</dt><dd><span class="stars">${potStars(p)}</span>${mine ? `（最大 ${p.pot}）` : p.found ? `（見立て ${p.pot - 3}〜${p.pot + 3}）` : ''}</dd><dt>市場価値</dt><dd>${E.money(v)}</dd><dt>年俸</dt><dd>${E.money(E.wage(p))}</dd></dl></div>
    ${attrRows(p, mine)}
    <div><div class="eyebrow" style="margin-bottom:6px">ポジション</div><div class="small" style="margin-bottom:8px">本職 <b>${dpOf(p)}</b>（${E.DP_JP[dpOf(p)]}）${p.learn ? `・<span class="muted">${p.learn.pos}を習得中</span>` : ''}</div>${p.pos === 'GK' ? '' : aptGrid(p, false)}
      <div class="row wrap" style="margin-top:8px"><span class="small muted">実力の目安</span>${rolesLine(p)}</div></div>
    <div><div class="eyebrow" style="margin-bottom:6px">今季の成績</div><div class="statgrid"><div><small>出場</small><b>${p.st.apps}</b></div><div><small>得点</small><b>${p.st.g}</b></div><div><small>アシスト</small><b>${p.st.a}</b></div><div><small>平均評価</small><b>${avgR}</b></div><div><small>警告</small><b>${p.st.yc}</b></div></div>${p.cs && p.cs.apps ? `<div class="small muted" style="margin-top:6px">カップ戦 ${p.cs.apps}試合 ${p.cs.g}得点 ${p.cs.a}アシスト</div>` : ''}</div>
    ${mine ? `<div class="row small muted">コンディション ${Math.round(p.cond)}%<span class="spacer"></span><span style="display:block;width:120px">${condBar(p.cond)}</span></div>` : ''}
    ${hist}`, foot);
}

function sheetTrain(id) {
  const p = S.players[id]; if (!p || p.club !== S.my) return;
  sheetState = { type: 'train', id };
  const a = E.age(p, S.date);
  const pv = E.devPreview(S, p);
  const tf = p.tf || 'auto', ti = p.ti || 'norm';
  const menus = Object.entries(E.FOCUS).filter(([k, f]) => p.pos === 'GK' ? ['auto', 'gk', 'pass', 'phys', 'mind'].includes(k) : !f.gk);
  const top = pv ? pv.dAt.map((d, i) => ({ i, d: Math.round(d) })).filter(x => x.d).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3) : [];
  const lp = p.learn && p.learn.pos; const lApt = lp ? E.apt(p, lp) : 0;
  const gap = p.pot - p.ovr;
  const note = gap <= 0.3 && a < 30 ? 'すでに伸びしろの上限近くまで成長しています。' : a >= 30 ? '30歳を過ぎるとスピードやスタミナから衰え始めます。判断力はまだ伸びます。' : '';
  openSheet(`<div class="row">${posTag(p)}<span class="small muted">#${p.num}・${a}歳・コンディション ${Math.round(p.cond)}%</span></div>
    <h2>${esc(p.name)}</h2>
    <div class="bigovr"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span><dl class="kv" style="flex:1"><dt>今季の増減</dt><dd>${dlt(shownDiff(p.ovr, p.ovr0 != null ? p.ovr0 : p.ovr))}</dd><dt>伸びしろ</dt><dd><span class="stars">${potStars(p)}</span>（最大 ${p.pot}）</dd><dt>1か月の見込み</dt><dd>${pv ? dlt(pv.dOvr, true) : '—'}</dd><dt>出場機会</dt><dd>${(() => { const sh = E.playShare(S, p); return sh == null ? '—' : Math.round(sh * 100) + '%'; })()}</dd></dl></div>
    ${top.length ? `<p class="fine" style="margin:-4px 0 0">このメニューだと1か月で ${top.map(x => `${E.ATTR[x.i]} ${x.d > 0 ? '+' : ''}${x.d}`).join('、')} ほど。</p>` : pv && pv.dAt.some(d => d >= 0.15) ? '<p class="fine" style="margin:-4px 0 0">1か月では目に見える変化は小さく、少しずつ伸びていきます。</p>' : ''}
    ${note ? `<p class="fine" style="margin:-4px 0 0">${note}</p>` : ''}
    <p class="fine" style="margin:-4px 0 0">出場機会はクラブの試合時間のうち出ていた割合。試合に出るほど成長が速く、23歳以下は特に伸びます。</p>
    <div class="ctlrow"><label>個別メニュー</label><div class="menu">${menus.map(([k, f]) => `<button data-act="setTf" data-id="${p.id}" data-k="${k}" aria-pressed="${tf === k}"><b>${f.jp}</b><span>${f.sub}</span></button>`).join('')}</div></div>
    <div class="ctlrow"><label>強度</label><div class="seg">${Object.entries(E.INTENS).map(([k, t]) => `<button data-act="setTi" data-id="${p.id}" data-k="${k}" aria-pressed="${ti === k}">${t.jp}</button>`).join('')}</div>
      <span class="fine">${{ light: '成長はゆっくり。疲れが早く抜けるので連戦向き。', norm: '標準の負荷。', hard: '成長が速い。疲れが抜けにくく、練習中のケガも起きやすい。' }[ti]}</span></div>
    ${p.pos !== 'GK' ? `<div class="ctlrow"><label>ポジション習得　<span class="muted" style="font-weight:400">本職 ${dpOf(p)}</span></label>
      ${aptGrid(p, true)}
      ${lp ? `<div class="row small" style="gap:10px"><span style="flex:1;min-width:0"><b>${lp}</b>（${E.DP_JP[lp]}）を習得中<br><span class="muted">適性 ${Math.floor(lApt)} → ${E.LEARN_MAX}・あと約${E.learnWeeks(S, p, lp)}週</span></span><button class="btn ghost" data-act="setLearn" data-id="${p.id}" data-k="" style="min-height:40px;padding:0 14px;white-space:nowrap;flex:none">やめる</button></div>` : ''}
      <span class="fine">鍛えたいポジションをタップ。数字は適性（本職=100）で、近いポジションほど早く覚えます。習得中は能力の伸びが少し落ちます。試合でそのポジションに起用しても、少しずつ慣れていきます（適性${E.PLAY_MAX}まで）。</span></div>` : ''}
    <div><div class="eyebrow" style="margin-bottom:6px">能力（右は今季の増減）</div>${attrRows(p, true)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">適性ポジション</div><div class="row wrap">${rolesLine(p)}</div></div>`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- tactics ---------- */
const PITCH_SVG = '<svg class="lines" viewBox="0 0 100 115" preserveAspectRatio="none" aria-hidden="true"><rect x="3" y="3" width="94" height="109" rx="1"/><line x1="3" y1="57.5" x2="97" y2="57.5"/><circle cx="50" cy="57.5" r="9"/><rect x="25" y="3" width="50" height="16"/><rect x="38" y="3" width="24" height="6"/><rect x="25" y="96" width="50" height="16"/><rect x="38" y="106" width="24" height="6"/></svg>';
function viewTactics() {
  const c = S.clubs[S.my]; const F = E.FORMATIONS[c.tac.form];
  E.validateLineup(S, S.my);
  const r = E.clubRating(S, S.my);
  const toks = F.map((s, i) => {
    const pid = c.tac.xi[i]; const p = pid && S.players[pid];
    const k1 = c.c1, k2 = c.c2, kt = lum(c.c1) > 0.6 ? '#141414' : '#ffffff';
    const style = `left:${s[1]}%;top:${88 - (s[2] - 7) * 1.04}%;--k1:${k1};--k2:${k2};--kt:${kt}`;
    if (!p) return `<button class="tok empty" style="${style}" data-act="slot" data-i="${i}"><span class="shirt">+</span><span class="lbl">${E.ROLE[s[0]].jp}</span></button>`;
    if (!E.available(p)) return `<button class="tok out" style="${style}" data-act="slot" data-i="${i}" aria-label="${E.ROLE[s[0]].jp} ${esc(p.name)} ${outShort(p)}"><span class="shirt">${p.num}</span><span class="lbl">${esc(p.short)}</span><span class="ov">${outShort(p)}</span></button>`;
    const warn = E.posPenalty(p, s[0]) <= -1.5 || p.cond < 70;
    return `<button class="tok ${p.hot ? 'hot' : ''}" style="${style}" data-act="slot" data-i="${i}" aria-label="${E.ROLE[s[0]].jp} ${esc(p.name)}${p.hot ? ' 燃えている' : ''}"><span class="shirt ${warn ? 'warn' : ''}">${p.num}</span><span class="lbl">${esc(p.short)}</span><span class="ov">${E.ROLE[s[0]].jp}・${E.ovr(p)}</span></button>`;
  }).join('');
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  const iss = E.lineupIssues(S, S.my);
  const banner = iss.block ? `<div class="card alert"><div class="eyebrow">試合の前に入れ替えが必要です</div><ul>${issueLines(iss).map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="fine" style="margin:6px 0 0">選手やベンチの行をタップして入れ替えてください。自動では入れ替わりません。</p></div>` : '';
  return `${banner}<div class="trate"><div><small>攻撃</small><b>${Math.round(r.att)}</b></div><div><small>中盤</small><b>${Math.round(r.mid)}</b></div><div><small>守備</small><b>${Math.round(r.def)}</b></div></div>
    <div class="formrow" role="group" aria-label="フォーメーション">${Object.keys(E.FORMATIONS).map(f => `<button data-act="form" data-k="${f}" aria-pressed="${c.tac.form === f}">${f}</button>`).join('')}</div>
    <div class="pitch">${PITCH_SVG}${toks}</div>
    <button class="btn ghost block" data-act="presets">戦術の保存・読み込み<span class="small muted">　${(c.presets || []).length}/${E.PRESET_MAX}</span></button>
    <p class="fine">選手をタップすると入れ替えられます。「!」は適性が低いポジションか疲れている選手、「×」はケガや出場停止で出られない選手です。</p>
    <div class="ctlrow"><label>攻撃の姿勢</label>${seg('ment', c.tac.ment, MENT_OPTS)}<span class="fine">${MENT_DESC[c.tac.ment] || ''}</span></div>
    <button class="toggle" role="switch" aria-checked="${!!c.tac.ctr}" data-act="ctr"><span><b>カウンターを狙う</b><br><span class="small muted">${CTR_DESC}</span></span><span class="sw"></span></button>
    <div class="ctlrow"><label>プレスの強度（高いほど中盤で優位、ただし消耗）</label>${seg('press', c.tac.press, [['low', '低'], ['mid', '中'], ['high', '高']])}</div>
    <button class="toggle" role="switch" aria-checked="${!!S.settings.autoSubs}" data-act="autoSubs"><span><b>交代はおまかせ</b><br><span class="small muted">オフにすると試合中に自分で交代を選びます</span></span><span class="sw"></span></button>
    <h3 class="sec-h">ベンチ（${c.tac.bench.length}/${E.BENCH_SIZE}人）<small>自動では入れ替わりません</small></h3>
    <p class="fine" style="margin:-6px 0 0">選手をタップすると、ベンチ外の選手と入れ替えられます。</p>
    <ul class="list">${c.tac.bench.map(id => benchRow(S.players[id])).join('')}${c.tac.bench.length < E.BENCH_SIZE ? `<li><button class="prow addrow" data-act="benchPick" data-id="0"><span class="no">+</span><span class="nm"><b>ベンチに加える</b><span>空き ${E.BENCH_SIZE - c.tac.bench.length}枠</span></span></button></li>` : ''}</ul>
    <button class="btn ghost block" data-act="benchAuto">ベンチをおまかせで組み直す</button>
    <div class="subnav"><button class="btn primary block" data-act="autoXI">おまかせでベストメンバーを組む</button></div>`;
}
function benchRow(p) {
  return prow(p).replace('data-act="player"', 'data-act="benchPick"').replace('<span class="chip">ベンチ</span>', '');
}
function sheetBench(outId) {
  const c = S.clubs[S.my]; const o = S.players[outId];
  sheetState = { type: 'bench', id: outId || 0 };
  const reserves = E.squad(S, S.my).filter(p => !c.tac.xi.includes(p.id) && !c.tac.bench.includes(p.id))
    .sort((a, b) => (E.available(b) - E.available(a)) || (POS_ORD[a.pos] - POS_ORD[b.pos]) || b.ovr - a.ovr);
  const row = p => {
    const av = E.available(p);
    const st = !av ? (p.inj > 0 ? `<span class="chip warn">負傷 ${p.inj}日</span>` : '<span class="chip warn">出場停止</span>') : '';
    return `<li><button class="prow" data-act="benchIn" data-id="${p.id}" ${av ? '' : 'disabled style="opacity:.5"'}><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, S.date)}歳・${Math.round(p.cond)}% ${st}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${condBar(p.cond)}</span></button></li>`;
  };
  const head = o ? `<div class="eyebrow">ベンチの入れ替え</div><h2>${esc(o.name)}（${dpOf(o)}・${E.ovr(o)}）と入れ替える選手</h2>${E.available(o) ? '' : `<p class="small" style="color:var(--loss);margin:0">${esc(o.short)}は${outText(o)}のため、この試合には出られません。</p>`}`
    : `<div class="eyebrow">ベンチの空き枠</div><h2>ベンチに加える選手</h2>`;
  openSheet(`${head}
    <p class="fine">ベンチ外の選手です。</p>
    <ul class="list">${reserves.map(row).join('') || '<li class="empty">ベンチ外の選手がいません</li>'}</ul>`,
    o ? `<div class="grid2"><button class="btn ghost" data-act="benchOut" data-id="${o.id}">ベンチから外す</button><button class="btn ghost" data-act="player" data-id="${o.id}">詳細を見る</button></div><button class="btn ghost block" data-act="closeSheet">閉じる</button>`
      : '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function reslot(newForm) {
  const c = S.clubs[S.my]; const keep = c.tac.xi.filter(Boolean);
  c.tac.form = newForm; const F = E.FORMATIONS[newForm];
  const xi = new Array(11).fill(null); const used = new Set();
  const order = F.map((s, i) => i).sort((a, b) => (F[a][0] === 'GK' ? -1 : 0) - (F[b][0] === 'GK' ? -1 : 0));
  for (const i of order) {
    let best = null, bv = -1e9;
    for (const id of keep) { if (used.has(id)) continue; const v = E.effective(S.players[id], F[i][0]); if (v > bv) { bv = v; best = id; } }
    if (best) { xi[i] = best; used.add(best); }
  }
  // then swap pairs while it helps (keeps a striker from ending up at wing-back)
  const val = (id, i) => E.effective(S.players[id], F[i][0]);
  for (let round = 0; round < 4; round++) {
    let better = false;
    for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) {
      if (!xi[i] || !xi[j]) continue;
      if (val(xi[i], j) + val(xi[j], i) > val(xi[i], i) + val(xi[j], j) + 0.01) { [xi[i], xi[j]] = [xi[j], xi[i]]; better = true; }
    }
    if (!better) break;
  }
  c.tac.xi = xi; E.validateLineup(S, S.my);
}
function sheetSlot(i) {
  const c = S.clubs[S.my]; const role = E.FORMATIONS[c.tac.form][i][0];
  sheetState = { type: 'slot', i };
  const cands = E.squad(S, S.my).map(p => ({ p, e: E.effective(p, role) }))
    .sort((a, b) => (E.available(b.p) - E.available(a.p)) || b.e - a.e);
  const cur = c.tac.xi[i];
  openSheet(`<div class="eyebrow">ポジション</div><h2>${E.ROLE[role].jp} に起用する選手</h2>
    <p class="fine">右の数字はこの位置での実力（能力・適性・疲労・調子を反映）。適性は本職=100。</p>
    <ul class="list">${cands.map(({ p, e }) => {
      const j = c.tac.xi.indexOf(p.id); const av = E.available(p);
      const st = !av ? (p.inj > 0 ? `<span class="chip warn">負傷 ${p.inj}日</span>` : '<span class="chip warn">出場停止</span>') : j >= 0 ? `<span class="chip ok">${E.ROLE[E.FORMATIONS[c.tac.form][j][0]].jp}で先発</span>` : c.tac.bench.includes(p.id) ? '<span class="chip">ベンチ</span>' : '';
      return `<li><button class="prow" data-act="assign" data-i="${i}" data-id="${p.id}" ${av ? '' : 'disabled'} style="${p.id === cur ? 'background:color-mix(in srgb,var(--accent-bg) 14%,transparent)' : ''}${av ? '' : ';opacity:.5'}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>能力 ${E.ovr(p)}・適性 ${Math.round(E.roleApt(p, role))}・${Math.round(p.cond)}% ${p.hot ? '<span class="chip fire">燃えている</span>' : ''}${st}</span></span><span class="rt"><span class="ovr ${oc(e)}">${Math.round(e)}</span></span></button></li>`;
    }).join('')}</ul>`, '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- league ---------- */
function curRound() { const nx = S.fixtures.filter(f => !f.cup && !f.played && (f.h === S.my || f.a === S.my)).sort((a, b) => a.date.localeCompare(b.date))[0]; return nx ? nx.r : 38; }
// a cup: my status, then every round (ties, results, dates)
function cupView() {
  const key = UI.lg.cup || 'ec'; const C = E.CUPS[key]; const cu = S.cups && S.cups[key];
  const seg = `<div class="seg">${Object.entries(E.CUPS).map(([k, x]) => `<button data-act="cupPick" data-k="${k}" aria-pressed="${key === k}">${x.jp}</button>`).join('')}</div>`;
  if (!cu) return seg + '<p class="fine">今季のカップ戦は開催されていません。次のシーズンから始まります。</p>';
  const my = E.cupResult(S, key, S.my);
  const last = C.rounds.length - 1;
  const head = `<section class="card cuphead"><div class="row"><div class="eyebrow">${S.cups.season}/${String((S.cups.season + 1) % 100).padStart(2, '0')} ${C.jp}</div><span class="spacer"></span>${cu.champ ? `<span class="chip ok">優勝 ${esc(S.clubs[cu.champ].short)}</span>` : `<span class="chip">${esc(C.rounds[cu.r])}</span>`}</div>
    <div class="row"><b>${esc(S.clubs[S.my].short)}</b><span class="chip ${my === '優勝' ? 'ok' : my === '勝ち残り' ? 'acc' : ''}">${esc(my || '—')}</span></div>
    <p class="fine" style="margin:0">${key === 'ec' ? 'J1の20クラブとJ2の12クラブによるトーナメント。' : 'J1の20クラブによるトーナメント。下位8クラブが1回戦から、残りはラウンド16から登場。'}一発勝負で、90分で決着がつかなければPK戦。決勝は国立競技場。優勝賞金 ${E.money(E.CUP_PRIZE.win)}。</p></section>`;
  const rounds = C.rounds.map((rn, i) => {
    const fx = S.fixtures.filter(f => f.cup === key && f.cr === i);
    const date = cu.dates[i];
    const list = fx.length ? `<ul class="list">${fx.map(f => {
      const w = f.played ? E.cupWinner(f) : null;
      return `<li><button class="fx ${f.h === S.my || f.a === S.my ? 'me' : ''}" style="width:100%" data-act="fxDetail" data-id="${f.id}"><span class="h ${w === f.h ? 'win' : ''}">${esc(S.clubs[f.h].short)}${inJ1(f.h) ? '' : '<small>J2</small>'}${kit(f.h, 'sm')}</span><span class="sc ${f.played ? '' : 'pending'}">${f.played ? `${f.hg}-${f.ag}${f.pk ? `<small>PK${f.pk[0]}-${f.pk[1]}</small>` : ''}` : jd(f.date)}</span><span class="a ${w === f.a ? 'win' : ''}">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}${inJ1(f.a) ? '' : '<small>J2</small>'}</span></button></li>`;
    }).join('')}</ul>` : `<p class="fine" style="margin:0">組み合わせは前のラウンドが終わってから決まります。</p>`;
    const seeds = key === 'lc' && i === 1 && cu.bye && !fx.length ? `<div class="row wrap">${cu.bye.map(id => `<span class="chip">${kit(id, 'sm')}${esc(S.clubs[id].short)}</span>`).join('')}</div><p class="fine" style="margin:0">シードの${cu.bye.length}クラブは、ここから登場します。</p>` : '';
    return `<h3 class="sec-h">${esc(rn)}<small>${jdw(date)}${i === last ? '・国立' : ''}</small></h3>${seeds}${list}`;
  }).join('');
  return seg + head + rounds;
}
function viewLeague() {
  const v = UI.lg.view; let body = '';
  if (v === 'table') {
    const t = E.table(S); const n = t.length;
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th style="text-align:left">クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得失</th><th>勝点</th></tr></thead><tbody>${t.map((r, i) => {
      const z = i === 0 ? 'z-champ' : i < 3 ? 'z-top' : i >= n - 3 ? 'z-rel' : '';
      return `<tr class="${z} ${r.id === S.my ? 'me' : ''}"><td>${i + 1}</td><td class="club"><div>${kit(r.id, 'sm')}${esc(S.clubs[r.id].short)}</div></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="legend"><span><i style="background:var(--accent-bg)"></i>優勝</span><span><i style="background:var(--zone-top)"></i>上位</span><span><i style="background:var(--loss)"></i>J2降格</span></div>`;
  } else if (v === 'fixtures') {
    const r = UI.lg.round || curRound();
    const fx = S.fixtures.filter(f => f.r === r).sort((a, b) => a.date.localeCompare(b.date));
    const date = fx.length ? fx[fx.length - 1].date : '';
    body = `<div class="roundnav"><button class="btn" data-act="round" data-d="-1" ${r <= 1 ? 'disabled' : ''} aria-label="前の節">◀</button><b>第${r}節<small>${date ? jdw(date) : ''}</small></b><button class="btn" data-act="round" data-d="1" ${r >= 38 ? 'disabled' : ''} aria-label="次の節">▶</button></div>
      <ul class="list">${fx.map(f => `<li><button class="fx ${f.h === S.my || f.a === S.my ? 'me' : ''}" style="width:100%" data-act="fxDetail" data-id="${f.id}"><span class="h">${esc(S.clubs[f.h].short)}${kit(f.h, 'sm')}</span><span class="sc ${f.played ? '' : 'pending'}">${f.played ? `${f.hg}-${f.ag}` : jd(f.date)}</span><span class="a">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}</span></button></li>`).join('')}</ul>`;
  } else if (v === 'cups') {
    body = cupView();
  } else {
    const ps = Object.values(S.players).filter(p => S.clubs[p.club] && S.order.includes(p.club));
    const g = ps.filter(p => p.st.g > 0).sort((a, b) => b.st.g - a.st.g || a.st.mins - b.st.mins).slice(0, 15);
    const as = ps.filter(p => p.st.a > 0).sort((a, b) => b.st.a - a.st.a).slice(0, 10);
    const rt = ps.filter(p => p.st.apps >= Math.max(3, Math.floor(E.table(S)[0].p * 0.5))).sort((a, b) => b.st.rt / b.st.apps - a.st.rt / a.st.apps).slice(0, 10);
    const tbl = (title, arr, val) => `<h3 class="sec-h">${title}</h3><div class="tbl-wrap"><table class="tbl"><tbody>${arr.map((p, i) => `<tr class="${p.club === S.my ? 'me' : ''}"><td>${i + 1}</td><td class="club"><div>${kit(p.club, 'sm')}<span style="overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</span></div></td><td class="pts">${val(p)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">まだ記録がありません</td></tr>'}</tbody></table></div>`;
    body = tbl('得点ランキング', g, p => p.st.g) + tbl('アシスト', as, p => p.st.a) + tbl('平均評価', rt, p => (p.st.rt / p.st.apps).toFixed(2));
  }
  return `${body}<div class="subnav"><div class="seg">${[['table', '順位表'], ['fixtures', '日程'], ['cups', 'カップ戦'], ['stats', '個人成績']].map(([k, l]) => `<button data-act="lgView" data-k="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div></div>`;
}
function sheetFixture(id) {
  const f = S.fixtures.find(x => x.id === id); if (!f) return;
  sheetState = { type: 'fx', id };
  const H = S.clubs[f.h], A = S.clubs[f.a];
  const goals = (f.sc || []).filter(e => e[2] === 'g');
  const line = side => goals.filter(e => e[1] === side).map(e => `<div>${e[0] > 90 ? '90+' + (e[0] - 90) : e[0]}' ${esc(S.players[e[3]] ? S.players[e[3]].name : '—')}</div>`).join('') || '<div class="muted">—</div>';
  openSheet(`<div class="eyebrow">${E.fxLabel(f)}・${jdw(f.date)}</div>
    <div class="sb" style="margin:0"><div class="team"><span>${esc(H.short)}</span><span class="kitline" style="background:${H.c1}"></span></div><div><div class="score">${f.played ? `${f.hg}-${f.ag}` : 'vs'}</div><div class="clock">${f.played ? (f.pk ? `PK ${f.pk[0]}-${f.pk[1]}` : 'FULL TIME') : jd(f.date)}</div></div><div class="team"><span>${esc(A.short)}</span><span class="kitline" style="background:${A.c1}"></span></div></div>
    ${f.played ? `<div class="scorers"><div>${line('h')}</div><div>${line('a')}</div></div><dl class="kv"><dt>会場</dt><dd>${esc(venueOf(f))}</dd><dt>入場者数</dt><dd>${(f.att || 0).toLocaleString('ja-JP')}人</dd></dl>` : `<dl class="kv"><dt>会場</dt><dd>${esc(venueOf(f))}</dd></dl>`}`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- club ---------- */
function viewClub() {
  const v = UI.cl.view; let body = '';
  const c = S.clubs[S.my];
  if (v === 'main') {
    const fin = c.fin; const inc = fin.gate + fin.spon + fin.prize + Math.max(0, fin.trans); const exp = fin.wages + fin.fac + Math.max(0, -fin.trans);
    const wages = E.squad(S, S.my).reduce((a, p) => a + E.wage(p), 0);
    body = `<section class="card" style="display:grid;gap:10px">
        <div class="row"><div class="eyebrow">フロントの信頼</div><span class="spacer"></span><b class="tnum">${S.board} / 100</b></div>
        <div class="meter"><i style="left:${S.board}%"></i></div>
        <dl class="kv"><dt>今季の目標</dt><dd>${esc(c.target.jp)}</dd><dt>開幕前の予想</dt><dd>${c.pred}位</dd><dt>現在</dt><dd>${rankOf(S.my)}${rankOf(S.my) === '—' ? '' : '位'}</dd></dl>
        <p class="fine">信頼が尽きると解任されます。J2降格でも解任です。</p>
      </section>
      <section class="card" style="display:grid;gap:8px">
        <div class="row"><div class="eyebrow">クラブの格</div><span class="spacer"></span>${presBadge(c)}<b>${E.presLabel(c.pres)}</b></div>
        <div class="small">${titlesText(c)}${c.o10 ? '・Jリーグ創設メンバー' : ''}</div>
        <p class="fine">格が高いほど試合終盤に粘り強く、選手も移籍に応じやすくなります。その分フロントの期待も高くなります。リーグ優勝や上位で上がり、降格で下がります。直近15年（2011年以降）のタイトルは上乗せして評価しています。天皇杯とアジアのタイトルは前身チーム時代を含みます。</p>
      </section>
      <section class="card" style="display:grid;gap:10px">
        <div class="row"><div class="eyebrow">資金</div><span class="spacer"></span><b style="font-family:var(--f-display);font-weight:400;font-size:22px" class="${c.funds < 0 ? 'o-low' : ''}">${E.money(c.funds)}</b></div>
        <dl class="kv"><dt>入場料収入</dt><dd>${E.money(fin.gate)}</dd><dt>スポンサー収入</dt><dd>${E.money(fin.spon)}</dd><dt>賞金</dt><dd>${E.money(fin.prize)}</dd><dt>移籍収支</dt><dd>${fin.trans >= 0 ? '+' : ''}${E.money(fin.trans)}</dd><dt>人件費</dt><dd>-${E.money(fin.wages)}</dd><dt>施設投資</dt><dd>-${E.money(fin.fac)}</dd></dl>
        <div class="small muted">今季の収支 ${inc - exp >= 0 ? '+' : ''}${E.money(inc - exp)}　／　年俸総額 ${E.money(wages)}・月のスポンサー収入 ${E.money(c.spon)}</div>
      </section>
      <h3 class="sec-h">クラブ施設<small>レベル1〜5</small></h3>
      <ul class="list">${Object.entries(E.FACILITY).map(([k, f]) => { const lv = c.fac[k]; const cost = E.facCost(lv); return `<li><div class="row" style="padding:12px;gap:12px"><div style="flex:1;min-width:0"><b>${f.jp}</b>　<span class="stars">${'■'.repeat(lv)}${'□'.repeat(5 - lv)}</span><div class="small muted">${f.desc}</div></div>${lv < 5 ? `<button class="btn" data-act="upgrade" data-k="${k}" ${c.funds < cost ? 'disabled' : ''}>強化<br><span class="small">${E.money(cost)}</span></button>` : '<span class="chip ok">最大</span>'}</div></li>`; }).join('')}</ul>
      <p class="fine">練習方針と選手ごとのトレーニングは「選手 → 育成」で設定します。</p>
      <h3 class="sec-h">スカウト<small>若手の発掘</small></h3>
      ${S.scout ? `<section class="card"><div class="row"><span class="chip acc">派遣中</span><b>${esc(E.SCOUT[S.scout.key].jp)}</b><span class="spacer"></span><span class="small muted">${jd(S.scout.back)}ごろ戻る</span></div></section>`
        : `<ul class="list">${Object.entries(E.SCOUT).map(([k, x]) => `<li><div class="row" style="padding:12px;gap:12px"><div style="flex:1;min-width:0"><b>${esc(x.jp)}</b><div class="small muted">${esc(x.sub)}・${x.days}日</div></div><button class="btn" data-act="scout" data-k="${k}" ${c.funds < x.cost ? 'disabled' : ''}>派遣<br><span class="small">${E.money(x.cost)}</span></button></div></li>`).join('')}</ul>`}
      <p class="fine">スカウトは有望な若手を3人見つけてきます。フリーの選手なので契約金だけで獲得できます。スカウト網のレベルが高いほど伸びしろの大きい選手が見つかります。レポートは30日で期限切れになり、残った選手はほかのクラブへ行きます。</p>
      <h3 class="sec-h">データ</h3>
      <section class="card" style="display:grid;gap:8px"><dl class="kv"><dt>この端末</dt><dd>${UI.localOk === false ? '保存できません' : '自動保存中'}</dd><dt>クラウド</dt><dd>${Cloud.status === 'on' ? (Cloud.err ? '保存に失敗（' + esc(Cloud.err) + '）' : Cloud.last ? '保存済み ' + new Date(Cloud.last).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '有効（試合後に保存）') : Cloud.status === 'checking' ? '確認中' : 'なし（引き継ぎコードで保管できます）'}</dd><dt>監督</dt><dd>${esc(S.manager)}</dd></dl>
      <div class="grid2"><button class="btn" data-act="exportOpen">引き継ぎコードを作る</button><button class="btn" data-act="importOpen">コードで復元</button></div>
      <p class="fine" style="margin:0">別の端末やホーム画面版のアプリにセーブを移すときに使います。</p>
      <button class="btn danger block" data-act="askReset">はじめからやり直す</button></section>`;
  } else if (v === 'market') {
    const open = E.inWindow(S.date);
    body = `<section class="card" style="display:grid;gap:6px"><div class="row"><div class="eyebrow">移籍期間</div><span class="spacer"></span>${open ? `<span class="chip ok">オープン〜${jd(E.windowEnd(S.date))}</span>` : `<span class="chip">クローズ（次は${jd(E.nextWindowStart(S.date))}〜）</span>`}</div><div class="small muted">資金 ${E.money(c.funds)}・登録 ${E.squad(S, S.my).length}/40人。フリーの選手はいつでも契約できます。</div></section>
      <input class="input" id="mk-q" type="search" placeholder="選手名・クラブで検索" value="${esc(UI.mk.q)}" autocomplete="off">
      <div class="seg">${[['', '全員'], ['GK', 'GK'], ['DF', 'DF'], ['MF', 'MF'], ['FW', 'FW']].map(([k, l]) => `<button data-act="mkPos" data-k="${k}" aria-pressed="${UI.mk.pos === k}">${l}</button>`).join('')}</div>
      <button class="toggle" role="switch" aria-checked="${UI.mk.fa}" data-act="mkFA"><span><b>フリーの選手だけ</b><br><span class="small muted">移籍金なし・契約金のみ（架空の選手です）</span></span><span class="sw"></span></button>
      <ul class="list" id="mk-list">${marketRows()}</ul>`;
  } else {
    const h = S.history;
    body = `<h3 class="sec-h">監督としての歩み</h3>${h.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>季</th><th style="text-align:left">クラブ</th><th>順位</th><th>勝点</th><th style="text-align:left">優勝</th></tr></thead><tbody>${h.map(r => `<tr><td>${r.season.slice(2)}</td><td class="club"><div>${kit(r.club, 'sm')}${esc(S.clubs[r.club].short)}</div></td><td>${r.pos}</td><td>${r.pts}</td><td class="club"><div>${esc(S.clubs[r.champ].short)}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">最初のシーズンを戦っているところです。</p>'}
      ${h.some(r => r.ec || r.lc) ? `<h3 class="sec-h">カップ戦</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>季</th><th style="text-align:left">天皇杯</th><th style="text-align:left">Lカップ</th></tr></thead><tbody>${h.filter(r => r.ec || r.lc).map(r => `<tr><td>${r.season.slice(2)}</td><td style="text-align:left">${esc(r.ec || '—')}</td><td style="text-align:left">${esc(r.lc || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <h3 class="sec-h">今季のクラブ記録</h3>${clubRecords()}`;
  }
  return `${body}<div class="subnav"><div class="seg">${[['main', '経営'], ['market', '移籍市場'], ['records', '記録']].map(([k, l]) => `<button data-act="clView" data-k="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div></div>`;
}
function marketRows() {
  let list = E.marketList(S, { pos: UI.mk.pos, q: UI.mk.q.trim() });
  if (UI.mk.fa) list = list.filter(p => p.club === 'FA');
  const n = list.length; list = list.slice(0, 60);
  return list.map(p => prow(p, 'market')).join('') + (n > 60 ? `<li class="empty">ほか${n - 60}人。検索で絞り込めます。</li>` : '') || '<li class="empty">見つかりませんでした</li>';
}
function clubRecords() {
  const my = S.fixtures.filter(f => f.played && !f.cup && (f.h === S.my || f.a === S.my));
  if (!my.length) return '<p class="empty">まだ試合がありません。</p>';
  let bigW = null, bigL = null, att = 0, homeN = 0;
  for (const f of my) {
    const gd = f.h === S.my ? f.hg - f.ag : f.ag - f.hg;
    if (!bigW || gd > bigW.gd) bigW = { f, gd }; if (!bigL || gd < bigL.gd) bigL = { f, gd };
    if (f.h === S.my) { att += f.att || 0; homeN++; }
  }
  const fl = x => `${esc(S.clubs[x.f.h].short)} ${x.f.hg}-${x.f.ag} ${esc(S.clubs[x.f.a].short)}（第${x.f.r}節）`;
  const top = E.squad(S, S.my).filter(p => p.st.g > 0).sort((a, b) => b.st.g - a.st.g)[0];
  return `<section class="card"><dl class="kv"><dt>最大得点差の勝利</dt><dd>${bigW && bigW.gd > 0 ? fl(bigW) : '—'}</dd><dt>最大失点差の敗戦</dt><dd>${bigL && bigL.gd < 0 ? fl(bigL) : '—'}</dd><dt>ホーム平均観客</dt><dd>${homeN ? Math.round(att / homeN).toLocaleString('ja-JP') + '人' : '—'}</dd><dt>チーム得点王</dt><dd>${top ? esc(top.name) + ' ' + top.st.g + '点' : '—'}</dd></dl></section>`;
}

/* ---------- pre-match, season end, fired, reset ---------- */
function sheetPrematch(fid) {
  const f = S.fixtures.find(x => x.id === fid); if (!f) return;
  sheetState = { type: 'pre', id: fid };
  const opp = f.h === S.my ? f.a : f.h;
  E.validateLineup(S, S.my);
  const me = E.clubRating(S, S.my), op = E.clubRating(S, opp);
  const c = S.clubs[S.my], o = S.clubs[opp];
  const row = (lab, a, b) => { const mx = Math.max(a, b, 1); return `<div class="cmp"><b class="l">${a.toFixed(0)}</b><span class="bar bl"><i style="width:${Math.max(8, 100 - (mx - a) * 9)}%;background:var(--accent-bg)"></i></span><span class="lab">${lab}</span><span class="bar"><i style="width:${Math.max(8, 100 - (mx - b) * 9)}%;background:var(--muted)"></i></span><b>${b.toFixed(0)}</b></div>`; };
  const warn = [];
  const F = E.FORMATIONS[c.tac.form];
  const iss = E.lineupIssues(S, S.my);
  c.tac.xi.forEach((id, i) => { const p = S.players[id]; if (!p || !E.available(p)) return; if (p.cond < 70) warn.push(`${p.name}が疲れています（${Math.round(p.cond)}%）`); if (E.posPenalty(p, F[i][0]) <= -1.5) warn.push(`${p.name}は${E.ROLE[F[i][0]].jp}の適性が低め（${Math.round(E.roleApt(p, F[i][0]))}）`); });
  const keys = o.tac.xi.map(id => S.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  const hy = E.hypeMatch(S, f); const story = storyChips(f);
  const mySide = f.h === S.my ? 'h' : 'a';
  const where = id => c.tac.xi.includes(id) ? '先発' : c.tac.bench.includes(id) ? 'ベンチ' : 'メンバー外';
  const hotMine = hy.hot.filter(h => h.side === mySide && S.players[h.pid] && S.players[h.pid].club === S.my);
  const hotOpp = hy.hot.filter(h => h.side !== mySide && S.players[h.pid]);
  const gap = E.power(S, opp) - E.power(S, S.my);
  const fire = hotMine.length || hotOpp.length ? `<div class="card fire"><div class="eyebrow">燃えている選手</div><ul>${hotMine.map(h => { const p = S.players[h.pid]; const w = where(p.id); return `<li><b>${esc(p.name)}</b>（${esc(h.why)}）<span class="chip ${w === '先発' ? 'ok' : 'warn'}">${w}</span></li>`; }).join('')}${hotOpp.map(h => `<li class="muted">相手の<b>${esc(S.players[h.pid].name)}</b>も燃えている（${esc(h.why)}）</li>`).join('')}</ul>${hotMine.some(h => where(h.pid) !== '先発') ? '<p class="fine" style="margin:6px 0 0">燃えている選手はこの試合だけ大きく力が上がります。先発させるなら戦術画面で。</p>' : ''}</div>` : '';
  openSheet(`<div class="eyebrow">${E.fxLabel(f)}・${jdw(f.date)}・${f.neutral ? '国立競技場' : f.h === S.my ? 'ホーム' : 'アウェイ'}</div>
    <h2>vs ${esc(o.name)}</h2>
    ${story ? `<div class="row wrap">${story}</div>` : ''}
    <div class="row small muted"><span>${esc(c.short)} ${c.tac.form}・${esc(E.mentLabel(c.tac))}</span><span class="spacer"></span><span>${esc(o.short)} ${o.tac.form}${o.tac.ment !== 'bal' || o.tac.ctr ? '・' + esc(E.mentLabel(o.tac)) : ''}</span></div>
    <div style="display:grid;gap:8px">${row('攻撃', me.att, op.att)}${row('中盤', me.mid, op.mid)}${row('守備', me.def, op.def)}</div>
    ${gap >= 3 && c.tac.ment !== 'def' && !c.tac.ctr ? '<p class="fine" style="margin:0">格上が相手です。「守備的」や「カウンターを狙う」で戦うと勝機が増えます（戦術画面）。</p>' : ''}
    ${fire}
    <div><div class="eyebrow" style="margin-bottom:6px">警戒する選手</div><div class="row wrap">${keys.map(p => `<span class="chip">${posTag(p, 'width:26px;height:16px;font-size:9px')}${esc(p.name)} ${E.ovr(p)}</span>`).join('')}</div></div>
    ${iss.block ? `<div class="card alert"><div class="eyebrow">このままでは試合に進めません</div><ul>${issueLines(iss).map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="fine" style="margin:6px 0 0">戦術画面で、出られない選手を自分で入れ替えてください。</p></div>` : ''}
    ${warn.length ? `<div class="card" style="padding:10px 12px"><div class="eyebrow" style="color:var(--loss)">メンバーの注意点</div><ul style="margin:6px 0 0;padding-left:18px;font-size:13px">${warn.slice(0, 5).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : iss.block ? '' : '<p class="fine">メンバーに問題はありません。</p>'}`,
    iss.block ? `<button class="btn primary block" data-act="toTactics" style="min-height:54px;font-size:16px">メンバーを入れ替える</button><button class="btn ghost block" data-act="closeSheet">閉じる</button>`
      : `<button class="btn primary block" data-act="kickoff" data-id="${fid}" style="min-height:54px;font-size:16px">キックオフ</button><div class="grid2"><button class="btn ghost" data-act="toTactics">戦術を調整</button><button class="btn ghost" data-act="quick" data-id="${fid}">結果だけ見る</button></div>`);
}
const VERDICT = { champion: 'リーグ優勝！', met: '目標達成', near: 'あと一歩', missed: '目標未達', relegated: 'J2降格' };
function sheetSeasonEnd() {
  const se = S.seasonEnd; if (!se) return;
  sheetState = { type: 'season' };
  openSheet(`<div class="led"><div class="ln"><span>${se.label} FINAL</span><span>${esc(S.clubs[S.my].abbr || '')}</span></div><div class="ln"><span class="big">${se.myPos}位</span><span class="big">${se.pts}pt</span></div><div class="ln"><span>${VERDICT[se.verdict]}</span><span>目標 ${esc(se.target.replace(/（.*）/, ''))}</span></div></div>
    <dl class="kv"><dt>優勝</dt><dd>${esc(S.clubs[se.champ].name)}</dd><dt>J2降格</dt><dd>${se.rel.map(id => esc(S.clubs[id].short)).join('・')}</dd><dt>順位賞金</dt><dd>${E.money(se.prize)}</dd><dt>フロントの信頼</dt><dd>${S.board}</dd></dl>
    ${se.cups ? `<dl class="kv">${Object.entries(se.cups).map(([k, x]) => `<dt>${E.CUPS[k].jp}</dt><dd>${x.champ ? `優勝 ${esc(S.clubs[x.champ].short)}` : '—'}　<span class="muted">${esc(S.clubs[S.my].short)}：${esc(x.my || '—')}</span></dd>`).join('')}</dl>` : ''}
    <div><div class="eyebrow" style="margin-bottom:6px">得点王争い</div><ul class="list">${se.scorers.map((x, i) => `<li><div class="row" style="padding:9px 12px"><b class="tnum">${i + 1}</b>${kit(x.club, 'sm')}<span>${esc(x.name)}</span><span class="spacer"></span><b class="tnum">${x.g}点</b></div></li>`).join('')}</ul></div>
    <p class="fine">次のシーズンに進むと、ベテランの引退、ユースからの昇格、J2との入れ替えが行われます。オフシーズン（6〜8月）は移籍期間です。</p>`,
    '<button class="btn primary block" data-act="nextSeason" style="min-height:54px">次のシーズンへ</button><button class="btn ghost block" data-act="closeSheet">あとで</button>');
}
// farewell pop-up for a player of mine who retires (instead of a ceremony)
const FAREWELL = {
  GK: ['最後尾からチームを支え続けた守護神。', 'そのセーブに何度も救われた。'],
  DF: ['体を張ってゴールを守り続けた。', '最終ラインに立つ背中が頼もしかった。'],
  MF: ['中盤でチームの舵を取り続けた。', 'そのパスがいつも攻撃の始まりだった。'],
  FW: ['ゴールでスタジアムを沸かせ続けた。', 'ここぞの場面で決めてくれるストライカーだった。'],
};
function sheetRetire(i) {
  const se = S.seasonEnd; const ret = se.ret.filter(r => S.players[r.id]); const r = ret[i]; if (!r) return;
  sheetState = { type: 'retire', i };
  const c = S.clubs[r.club] || S.clubs[S.my];
  const kt = lum(c.c1) > 0.6 ? '#141414' : '#ffffff';
  const lines = FAREWELL[r.pos] || FAREWELL.MF;
  const msg = r.g >= 20 ? `${S.clubs[S.my].short}で${r.g}ゴール。${lines[0]}` : r.apps >= 60 ? `${S.clubs[S.my].short}で${r.apps}試合に出場。${lines[0]}` : lines[r.id % 2];
  const left = ret.length - i - 1;
  openSheet(`<div class="farewell" style="--k1:${c.c1};--k2:${c.c2};--kt:${kt}">
      <div class="fw-lights" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      <div class="fw-head"><span>${esc(se.label)}</span><span>${ret.length > 1 ? `${i + 1} / ${ret.length}` : 'FAREWELL'}</span></div>
      <div class="fw-shirt">${r.num}</div>
      <div class="fw-tag">現役引退</div>
      <h2 class="fw-name">${esc(r.name)}</h2>
      <div class="fw-sub">${r.pp}・${r.age}歳・${esc(c.name)}</div>
      <p class="fw-msg">${esc(msg)}<br>背番号${r.num}、${esc(r.short)}。ありがとう。</p>
    </div>
    <div class="statgrid"><div><small>シーズン</small><b>${r.seasons}</b></div><div><small>出場</small><b>${r.apps}</b></div><div><small>得点</small><b>${r.g}</b></div><div><small>アシスト</small><b>${r.a}</b></div><div><small>最高能力</small><b>${r.peak}</b></div></div>
    ${r.rows.length > 1 ? `<div><div class="eyebrow" style="margin-bottom:6px">${esc(S.clubs[S.my].short)}での歩み</div><ul class="list">${r.rows.map(x => `<li><div class="row" style="padding:8px 12px;font-size:13px"><b>${esc(x.s)}</b><span class="spacer"></span><span class="tnum">${x.apps}試合 ${x.g}得点 ${x.a}A</span></div></li>`).join('')}</ul></div>` : ''}
    <p class="fine">シーズン数と成績は、あなたが監督になってから共に戦った記録です。</p>`,
    `<button class="btn primary block" data-act="retNext" data-i="${i + 1}" style="min-height:54px">${left ? `次へ（あと${left}人）` : '次のシーズンへ'}</button>`);
  const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = 0;
}
const MENT_OPTS = [['def', '守備的'], ['bal', 'バランス'], ['att', '攻撃的']];
const MENT_DESC = {
  def: '引いて守る。失点は減るが得点も減る。格上が相手ほど効果が大きい。',
  bal: '攻守のバランスを取る標準の戦い方。',
  att: '前に出て押し込む。得点も失点も増えやすい。格下相手に。',
};
const CTR_DESC = 'ボールを奪ったら素早く攻める。チャンスは減るが決まりやすい。相手がボールを持つほど、攻めてくるほど効く。「守備的」と組み合わせるのが定番。';
// saved tactics: load / overwrite / rename / delete, and save the current one
function sheetPresets() {
  const c = S.clubs[S.my]; const list = c.presets || [];
  sheetState = { type: 'presets' };
  const ui = UI.preset || (UI.preset = {});
  const row = (pr, i) => {
    const st = E.presetStatus(S, pr);
    const sus = st.out.filter(id => S.players[id].inj <= 0).length, inj = st.out.length - sus;
    const chips = [sus ? `<span class="chip warn">出場停止 ${sus}</span>` : '', inj ? `<span class="chip warn">負傷 ${inj}</span>` : '', st.gone.length ? `<span class="chip">移籍・退団 ${st.gone.length}</span>` : ''].join('');
    const head = ui.edit === i
      ? `<div class="row" style="gap:8px"><input class="input" id="pr-name" maxlength="16" value="${esc(pr.name)}" autocomplete="off" style="flex:1"><button class="btn" data-act="presetRename" data-i="${i}">決定</button></div>`
      : `<div class="row"><b>${esc(pr.name)}</b><span class="spacer"></span><span class="small muted">${jd(pr.d)}保存</span></div>`;
    return `<li><div class="preset">${head}
      <div class="small muted">${pr.form}・${esc(E.mentLabel(pr))}・プレス${esc(E.PRESS[pr.press].jp)}</div>
      ${chips ? `<div class="row wrap">${chips}</div>` : ''}
      <div class="preset-act"><button class="btn primary" data-act="presetLoad" data-i="${i}">読み込む</button><button class="btn ghost" data-act="presetSave" data-i="${i}">上書き</button><button class="btn ghost" data-act="presetEdit" data-i="${i}">名前</button><button class="btn ghost ${ui.del === i ? 'danger' : ''}" data-act="presetDel" data-i="${i}">${ui.del === i ? '本当に削除' : '削除'}</button></div>
    </div></li>`;
  };
  const full = list.length >= E.PRESET_MAX;
  openSheet(`<div class="eyebrow">戦術の保存・読み込み</div><h2>保存した戦術<small class="muted" style="font-size:14px">　${list.length}/${E.PRESET_MAX}</small></h2>
    ${list.length ? `<ul class="list">${list.map(row).join('')}</ul>` : '<p class="fine">まだ保存した戦術はありません。</p>'}
    <section class="card" style="display:grid;gap:8px"><div class="eyebrow">今の戦術を保存</div>
      <div class="small muted">${c.tac.form}・${esc(E.mentLabel(c.tac))}・プレス${esc(E.PRESS[c.tac.press].jp)}・先発とベンチ ${c.tac.xi.filter(Boolean).length + c.tac.bench.length}人</div>
      ${full ? '<p class="fine" style="margin:0">保存枠がいっぱいです。上の「上書き」で入れ替えてください。</p>' : `<div class="row" style="gap:8px"><input class="input" id="pr-new" maxlength="16" placeholder="名前（例：格上用カウンター）" autocomplete="off" style="flex:1"><button class="btn primary" data-act="presetSave">保存</button></div>`}
    </section>
    <p class="fine">読み込むと、保存したときのフォーメーション・進め方・プレス・先発・ベンチをそのまま反映します。ケガや出場停止の選手もそのまま入るので、試合の前に自分で入れ替えてください。移籍した選手の枠は空きになります。</p>`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function sheetFired() {
  const F = S.fired; if (!F) return;
  sheetState = { type: 'fired' };
  openSheet(`<div class="eyebrow">解任</div><h2>${esc(S.clubs[F.from].name)}を去ることに</h2><p class="fine">${esc(F.reason)}。ほかのクラブから監督就任のオファーが届いています。</p>
    <ul class="list">${F.offers.map(cid => { const c = S.clubs[cid]; return `<li><button class="crow" data-act="job" data-id="${cid}"><span class="kit lg" style="--c1:${c.c1};--c2:${c.c2}"></span><span><b>${esc(c.name)}</b><span>資金 ${E.money(c.funds)}・${E.position(S, cid)}位</span></span><span class="chip acc">就任</span></button></li>`; }).join('')}</ul>`,
    '<button class="btn danger block" data-act="askReset">はじめからやり直す</button>');
}
/* ---------- save transfer (引き継ぎコード) ---------- */
const CODE_PREFIX = 'KTK1.';
function makeCode() { saveLocalNow(); return CODE_PREFIX + serialize(S); }
function readCode(raw) {
  let c = String(raw || '').replace(/\s+/g, '');
  if (c.startsWith(CODE_PREFIX)) c = c.slice(CODE_PREFIX.length);
  const st = deserialize(c);
  if (!st || !st.clubs || !st.players || !st.my || !st.clubs[st.my]) return null;
  return st;
}
function sheetExport() {
  sheetState = { type: 'export' };
  const code = makeCode();
  openSheet(`<div class="eyebrow">引き継ぎコード</div><h2>セーブをコードにしました</h2>
    <p class="fine">「コピー」を押して、移したい先のアプリで「コードで復元」に貼り付けてください。${E.seasonLabel(S.season)}・${esc(S.clubs[S.my].short)}・${fmtDate(S.date)}時点のセーブです（${Math.round(code.length / 1024)}KB）。</p>
    <textarea id="exp-code" class="input" readonly style="height:120px;padding:10px;font-size:11px;font-family:ui-monospace,monospace;word-break:break-all">${esc(code)}</textarea>
    <p class="fine" id="exp-msg" style="margin:0"></p>`,
    '<button class="btn primary block" data-act="copyCode">コピー</button><button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function sheetImport() {
  sheetState = { type: 'import' };
  openSheet(`<div class="eyebrow">引き継ぎコード</div><h2>コードで復元</h2>
    <p class="fine">「引き継ぎコードを作る」でコピーしたコードを貼り付けてください。${S ? '<b>今のセーブは上書きされます。</b>' : ''}</p>
    <textarea id="imp-code" class="input" placeholder="KTK1. から始まるコード" style="height:140px;padding:10px;font-size:12px;font-family:ui-monospace,monospace;word-break:break-all" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <p class="fine" id="imp-msg" style="margin:0"></p>`,
    '<button class="btn primary block" data-act="doImport">復元する</button><button class="btn ghost block" data-act="closeSheet">やめる</button>');
}
function sheetReset() {
  sheetState = { type: 'reset' };
  openSheet('<h2>セーブデータを消しますか？</h2><p class="fine">この端末とクラウドのセーブを消して、タイトル画面に戻ります。元には戻せません。</p>',
    '<button class="btn danger block" data-act="doReset">消して最初から</button><button class="btn ghost block" data-act="closeSheet">やめる</button>');
}

/* ---------- scroll lock (background must not move while a sheet or the match is up) ---------- */
let lockCount = 0, lockY = 0;
function lockScroll() {
  if (lockCount++) return;
  lockY = window.scrollY || 0;
  const b = document.body.style;
  b.position = 'fixed'; b.top = -lockY + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden';
}
function unlockScroll() {
  if (!lockCount || --lockCount) return;
  const b = document.body.style;
  b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = ''; b.overflow = '';
  window.scrollTo(0, lockY);
}
// iOS: stop touch drags that start outside a scrollable area of the sheet from reaching the page
function guardTouch(e) {
  const body = e.target.closest && e.target.closest('.sheet-body, .feed, .result');
  if (!body) { e.preventDefault(); return; }
  if (body.scrollHeight <= body.clientHeight + 1) e.preventDefault();
}
scrimEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
sheetEl.addEventListener('touchmove', guardTouch, { passive: false });
let sheetOpen = false;

/* ---------- sheet & toast ---------- */
function openSheet(body, foot) {
  const wasOpen = !sheetEl.hidden && sheetEl.classList.contains('on');
  if (!sheetOpen) { sheetOpen = true; lockScroll(); }
  const sc = wasOpen ? (sheetEl.querySelector('.sheet-body') || {}).scrollTop : 0;
  sheetEl.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  sheetEl.hidden = false; scrimEl.hidden = false;
  if (wasOpen) { const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = sc || 0; return; }
  requestAnimationFrame(() => requestAnimationFrame(() => { sheetEl.classList.add('on'); scrimEl.classList.add('on'); }));
}
function closeSheet() {
  sheetEl.classList.remove('on'); scrimEl.classList.remove('on'); sheetState = null;
  if (sheetOpen) { sheetOpen = false; unlockScroll(); }
  setTimeout(() => { if (!sheetEl.classList.contains('on')) { sheetEl.hidden = true; scrimEl.hidden = true; sheetEl.innerHTML = ''; } }, 230);
  if (MATCH && MATCH.resumeOnClose) { MATCH.resumeOnClose = false; MATCH.paused = false; tickLoop(); renderMatchCtl(); }
}
function refreshSheet() {
  if (!sheetState) return;
  const s = sheetState;
  if (s.type === 'presets') return sheetPresets();
  if (s.type === 'player') sheetPlayer(s.id); else if (s.type === 'train') sheetTrain(s.id); else if (s.type === 'bench') sheetBench(s.id); else if (s.type === 'slot') sheetSlot(s.i); else if (s.type === 'pre') sheetPrematch(s.id); else if (s.type === 'msub') sheetMatchTactics();
}
let toastT = null;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); }

/* ---------- match ---------- */
const SPEEDS = { 1: 430, 2: 170, 4: 50 };   // real ms per match minute
const VIS_SPEED = { 1: 1.7, 2: 2.6, 4: 3.6 }; // how fast the 2D players move relative to real time
const SHOT_EV = { goal: 1, save: 1, miss: 1 };
function startMatch(fid, quick) {
  closeSheet();
  const fx = S.fixtures.find(f => f.id === fid); if (!fx || fx.played) return;
  E.validateLineup(S, S.my);
  if (E.lineupIssues(S, S.my).block) return sheetPrematch(fid);
  const M = E.createMatch(S, fx);
  const k = M.userSide;
  MATCH = { M, fx, k, speed: S.settings.speed || 1, paused: false, timer: null, raf: null, sel: null, evq: [], hold: false, shown: { h: 0, a: 0 }, ftShown: false };
  buildMatchLayer();
  if (quick) { E.simulateFull(S, M); finishLive(); return; }
  MATCH.viz = window.Match2D.create(S, M, { resolved: onShotResolved, done: onShotDone });
  M.ev.forEach(e => feedAdd(e));
  tickLoop(); drawLoop();
}
function buildMatchLayer() {
  const { M } = MATCH; const H = S.clubs[M.h.cid], A = S.clubs[M.a.cid];
  let el = document.getElementById('mlayer');
  if (!el) { el = document.createElement('div'); el.id = 'mlayer'; el.className = 'match'; document.body.appendChild(el); }
  el.innerHTML = `<div class="match-in">
    <div class="sb" id="sb"><div class="team"><span>${esc(H.short)}</span><span class="kitline" style="background:${H.c1}"></span></div><div><div class="score" id="sb-score">0-0</div><div class="clock" id="sb-clock">KICK OFF</div></div><div class="team"><span>${esc(A.short)}</span><span class="kitline" style="background:${A.c1}"></span></div></div>
    <div id="mbody" style="display:flex;flex-direction:column;flex:1;min-height:0">
      <div class="pitch2d"><canvas id="cv" aria-label="試合の2Dビュー"></canvas></div>
      <div class="possbar"><span id="ph">50%</span><span class="pb"><i id="pbh" style="width:50%;background:${H.c1}"></i><i id="pba" style="width:50%;background:${kitClash(H, A) ? A.c2 : A.c1}"></i></span><span id="pa">50%</span></div>
      <ol class="feed" id="feed" aria-live="polite"></ol>
    </div>
    <div class="mctl" id="mctl"></div>
  </div>`;
  if (!MATCH.locked) { MATCH.locked = true; lockScroll(); }
  renderMatchCtl();
}
function kitClash(H, A) {
  const d = (a, b) => { const x = a.replace('#', ''), y = b.replace('#', ''); let s = 0; for (let i = 0; i < 3; i++) s += Math.abs(parseInt(x.substr(i * 2, 2), 16) - parseInt(y.substr(i * 2, 2), 16)); return s; };
  return d(H.c1, A.c1) < 140;
}
function renderMatchCtl() {
  if (!MATCH) return;
  const el = document.getElementById('mctl'); if (!el) return;
  const { M } = MATCH;
  if (MATCH.finished) { el.innerHTML = '<button class="btn primary block" data-act="mClose" style="min-height:54px;font-size:16px">クラブに戻る</button>'; return; }
  if (M.done && MATCH.ftShown) { el.innerHTML = '<button class="btn primary block" data-act="mResult" style="min-height:54px;font-size:16px">試合結果を見る</button>'; return; }
  if (MATCH.ht) { el.innerHTML = `<div class="row"><button class="btn" data-act="mTac">采配</button><button class="btn primary" data-act="m2nd" style="flex:2">後半キックオフ</button></div><button class="btn ghost block" data-act="mSkip">結果までとばす</button>`; return; }
  el.innerHTML = `<div class="row"><button class="btn" data-act="mTac">采配${M[MATCH.k] ? `<span class="small muted">　交代${5 - M[MATCH.k].subs}</span>` : ''}</button><button class="btn" data-act="mSpeed" aria-label="試合速度">×${MATCH.speed}</button><button class="btn" data-act="mPause">${MATCH.paused ? '▶ 再開' : 'Ⅱ 停止'}</button></div><button class="btn ghost block" data-act="mSkip">結果までとばす</button>`;
}
function tickLoop() {
  if (!MATCH) return;
  clearTimeout(MATCH.timer);
  if (MATCH.paused || MATCH.ht || MATCH.M.done || MATCH.hold) return;
  MATCH.timer = setTimeout(() => { matchTick(); tickLoop(); }, SPEEDS[MATCH.speed] || 430);
}
function matchTick() {
  const { M } = MATCH; if (M.done) return;
  const evs = E.stepMatch(S, M);
  if (MATCH.viz) { MATCH.viz.hint(M.pH == null ? 0.5 : M.pH); MATCH.viz.sync(); }
  MATCH.evq.push(...evs);
  processQueue();
  updateScoreboard();
}
// Events wait in a queue so that a chance is shown in full (the clock stops) before the next one.
function processQueue() {
  while (MATCH && MATCH.evq.length && !MATCH.hold) {
    const e = MATCH.evq.shift();
    if (SHOT_EV[e.t] && MATCH.viz) {
      if (MATCH.speed >= 4 || document.hidden) { applyShot(e); MATCH.viz.instant(e); continue; }
      MATCH.hold = true; MATCH.viz.shoot(e); break;
    }
    if (SHOT_EV[e.t]) { applyShot(e); continue; }
    feedAdd(e);
    if (MATCH.viz) {
      if (e.t === 'yc' || e.t === 'red') MATCH.viz.foul(e);
      if (e.t === 'red' || e.t === 'sub' || e.t === 'inj') MATCH.viz.sync();
      if (e.t === 'ht') MATCH.viz.restart('a');
    }
    if (e.t === 'ht') { MATCH.ht = true; renderMatchCtl(); }
    if (e.t === 'ft') { MATCH.ftShown = true; renderMatchCtl(); }
  }
  updateScoreboard();
}
function applyShot(e) {
  feedAdd(e);
  if (e.t === 'goal') {
    MATCH.shown[e.side]++;
    const sb = document.getElementById('sb'); if (sb) { sb.classList.remove('flash'); void sb.offsetWidth; sb.classList.add('flash'); }
  }
  updateScoreboard();
}
function onShotResolved(e) { if (MATCH) applyShot(e); }
function onShotDone() {
  if (!MATCH) return;
  MATCH.hold = false;
  processQueue();
  renderMatchCtl();
  tickLoop();
}
function updateScoreboard() {
  const { M } = MATCH;
  const sc = document.getElementById('sb-score'), cl = document.getElementById('sb-clock');
  const live = !MATCH.finished && !(M.done && MATCH.ftShown) && MATCH.viz;
  if (sc) sc.textContent = live ? `${MATCH.shown.h}-${MATCH.shown.a}` : `${M.hg}-${M.ag}`;
  if (cl) cl.textContent = (M.done && (MATCH.ftShown || MATCH.finished)) ? (M.pk ? `PK ${M.pk[0]}-${M.pk[1]}` : 'FULL TIME') : MATCH.ht ? 'HALF TIME' : M.min > 90 ? `90+${M.min - 90}'` : `${M.min}'`;
  const tot = M.st.h.pos + M.st.a.pos || 1; const ph = Math.round(M.st.h.pos / tot * 100);
  const a = document.getElementById('ph'), b = document.getElementById('pa'), x = document.getElementById('pbh'), y = document.getElementById('pba');
  if (a) { a.textContent = ph + '%'; b.textContent = (100 - ph) + '%'; x.style.width = ph + '%'; y.style.width = (100 - ph) + '%'; }
}
function feedAdd(e) {
  const feed = document.getElementById('feed'); if (!feed) return;
  const { M } = MATCH;
  const li = document.createElement('li');
  const sys = ['ko', 'ht', 'ft'].includes(e.t);
  li.className = e.t === 'goal' ? 'goal' : e.t === 'red' ? 'red' : e.t === 'hot' ? 'hot' : e.t === 'pk' ? 'goal' : sys ? 'sys' : '';
  const c = e.side ? S.clubs[M[e.side].cid] : null;
  li.innerHTML = `<time>${e.m > 90 ? '90+' + (e.m - 90) : e.m}'</time><i class="pip" style="${c ? 'background:' + c.c1 : ''}"></i><span>${e.t === 'goal' ? '<b class="evb">GOAL</b>' : e.t === 'yc' ? '<i class="cardi y"></i>' : e.t === 'red' ? '<i class="cardi r"></i>' : ''}${esc(e.text)}</span>`;
  feed.prepend(li);
  while (feed.children.length > 70) feed.lastChild.remove();
}
function drawLoop() {
  if (!MATCH || !MATCH.viz) return;
  const cv = document.getElementById('cv');
  if (!cv) return;
  const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const ctx = cv.getContext('2d');
  const now = performance.now(); const dt = Math.min(0.05, (now - (MATCH.lastT || now)) / 1000); MATCH.lastT = now;
  const frozen = MATCH.paused || MATCH.ht || MATCH.finished || (MATCH.M.done && MATCH.ftShown);
  if (!frozen) MATCH.viz.step(dt * (VIS_SPEED[MATCH.speed] || 1.7));
  if (!MATCH.col || (MATCH.colT = (MATCH.colT || 0) + 1) % 120 === 0) {
    const cs = getComputedStyle(document.documentElement); const M = MATCH.M;
    const H = S.clubs[M.h.cid], A = S.clubs[M.a.cid]; const clash = kitClash(H, A);
    const txt = c => lum(c) > 0.6 ? '#141414' : '#FFFFFF';
    const ac1 = clash ? A.c2 : A.c1, ac2 = clash ? A.c1 : A.c2;
    MATCH.col = { g1: cs.getPropertyValue('--pitch').trim() || '#2E6A45', g2: cs.getPropertyValue('--pitch2').trim() || '#2A6140', line: cs.getPropertyValue('--pitch-line').trim() || 'rgba(255,255,255,.6)', led: cs.getPropertyValue('--led').trim() || '#F5B43C',
      home: { c1: H.c1, c2: H.c2, txt: txt(H.c1), gk: '#F28C28' }, away: { c1: ac1, c2: ac2, txt: txt(ac1), gk: '#B455E0' } };
  }
  MATCH.viz.draw(ctx, cv.width, cv.height, MATCH.col);
  MATCH.raf = requestAnimationFrame(drawLoop);
}
function finishLive() {
  const { M } = MATCH;
  if (!M.applied) E.finishMatch(S, M);
  E.simAIToday(S);
  persist(true);
  MATCH.finished = true;
  showResult();
}
function showResult() {
  const { M, fx } = MATCH; const k = MATCH.k;
  cancelAnimationFrame(MATCH.raf); clearTimeout(MATCH.timer);
  updateScoreboard();
  const H = S.clubs[M.h.cid], A = S.clubs[M.a.cid];
  const goals = side => M.ev.filter(e => e.t === 'goal' && e.side === side).map(e => `<div>${e.m > 90 ? '90+' + (e.m - 90) : e.m}' ${esc(S.players[e.pid].name)}</div>`).join('') || '<div class="muted">—</div>';
  const tot = M.st.h.pos + M.st.a.pos || 1;
  const stl = (lab, a, b) => `<div class="stline"><span class="tnum">${a}</span><span>${lab}</span><span class="tnum">${b}</span></div>`;
  const mine = Object.entries(M.pm).filter(([, pm]) => pm.side === k).sort((a, b) => (b[1].final || 0) - (a[1].final || 0));
  const others = S.fixtures.filter(f => f.date === fx.date && f.id !== fx.id && f.played);
  const res = M.pk ? ((M.pk[0] > M.pk[1]) === (k === 'h') ? 'W' : 'L') : M.hg === M.ag ? 'D' : ((M.hg > M.ag) === (k === 'h') ? 'W' : 'L');
  const body = document.getElementById('mbody');
  body.innerHTML = `<div class="result">
    <div class="row"><span class="res res-${res}">${{ W: '勝', D: '分', L: '敗' }[res]}</span><b>${fx.cup ? { W: '勝ち抜け！', L: '敗退' }[res] : { W: '勝利！', D: '引き分け', L: '敗戦' }[res]}${M.pk ? `<small class="muted">（PK ${M.pk[0]}-${M.pk[1]}）</small>` : ''}</b><span class="spacer"></span><span class="small muted">${E.fxLabel(fx)}・観客 ${(fx.att || 0).toLocaleString('ja-JP')}人</span></div>
    <div class="scorers"><div>${goals('h')}</div><div>${goals('a')}</div></div>
    <div>${stl('支配率', Math.round(M.st.h.pos / tot * 100) + '%', Math.round(M.st.a.pos / tot * 100) + '%')}${stl('シュート', M.st.h.sh, M.st.a.sh)}${stl('枠内', M.st.h.ot, M.st.a.ot)}${stl('ファウル', M.st.h.fo, M.st.a.fo)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">${esc(S.clubs[S.my].short)}の採点</div><ul class="list">${mine.map(([id, pm]) => { const p = S.players[id]; return `<li><div class="row" style="padding:8px 12px">${posTag(p)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)} ${pm.g ? `<b class="evb">G${pm.g > 1 ? '×' + pm.g : ''}</b>` : ''}${pm.a ? `<b class="evb a">A${pm.a > 1 ? '×' + pm.a : ''}</b>` : ''}${pm.rc ? '<i class="cardi r"></i>' : pm.yc ? '<i class="cardi y"></i>' : ''}${pm.inj ? '<span class="chip warn">負傷</span>' : ''}</span><span class="small muted">${pm.on ? pm.on + "'〜" : ''}</span><span class="rating ${ratingCls(pm.final)}">${(pm.final || 6).toFixed(1)}</span></div></li>`; }).join('')}</ul></div>
    ${others.length ? `<div><div class="eyebrow" style="margin-bottom:6px">他会場</div><ul class="list">${others.map(f => `<li><div class="fx"><span class="h">${esc(S.clubs[f.h].short)}${kit(f.h, 'sm')}</span><span class="sc">${f.hg}-${f.ag}${f.pk ? `<small>PK${f.pk[0]}-${f.pk[1]}</small>` : ''}</span><span class="a">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}</span></div></li>`).join('')}</ul></div>` : ''}
  </div>`;
  renderMatchCtl();
}
function closeMatch() {
  if (MATCH) { clearTimeout(MATCH.timer); cancelAnimationFrame(MATCH.raf); }
  const wasLocked = MATCH && MATCH.locked;
  MATCH = null;
  const el = document.getElementById('mlayer'); if (el) el.remove();
  if (wasLocked) unlockScroll();
  UI.tab = 'home'; render(); window.scrollTo(0, 0);
}
function sheetMatchTactics() {
  if (!MATCH) return;
  const { M, k } = MATCH; const sd = M[k];
  sheetState = { type: 'msub' };
  const onp = E.onPitch(sd);
  const bench = E.benchOptions(S, M, k);
  const left = 5 - sd.subs;
  const sel = MATCH.sel;
  openSheet(`<div class="eyebrow">${M.min}分・${M.hg}-${M.ag}</div><h2>采配</h2>
    <div class="ctlrow"><label>攻撃の姿勢</label><div class="seg">${MENT_OPTS.map(([x, l]) => `<button data-act="mMent" data-k="${x}" aria-pressed="${sd.ment === x}">${l}</button>`).join('')}</div><span class="fine">${MENT_DESC[sd.ment] || ''}</span></div>
    <button class="toggle" role="switch" aria-checked="${!!sd.ctr}" data-act="mCtr"><span><b>カウンターを狙う</b><br><span class="small muted">${CTR_DESC}</span></span><span class="sw"></span></button>
    <button class="toggle" role="switch" aria-checked="${!!S.settings.autoSubs}" data-act="autoSubs"><span><b>交代はおまかせ</b><br><span class="small muted">残り交代 ${left}回</span></span><span class="sw"></span></button>
    <div class="eyebrow">${sel ? 'OUT：' + esc(S.players[sel].name) + ' → 入れる選手を選ぶ' : '下げる選手を選ぶ'}</div>
    ${sel ? `<ul class="list">${bench.map(id => { const p = S.players[id]; return `<li><button class="prow" data-act="mIn" data-id="${id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${Math.round(p.cond)}%</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></span></button></li>`; }).join('') || '<li class="empty">控えがいません</li>'}</ul><button class="btn ghost block" data-act="mOut" data-id="">選び直す</button>`
      : `<ul class="list">${onp.map(s => { const p = S.players[s.pid]; const pm = M.pm[s.pid]; return `<li><button class="prow" data-act="mOut" data-id="${s.pid}" ${left <= 0 ? 'disabled' : ''}><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.ROLE[s.role].jp}・体力 ${Math.round(sd.cond[s.pid] || 0)}%</span></span><span class="rt"><span class="rating ${ratingCls(pm.rt)}">${pm.rt.toFixed(1)}</span></span></button></li>`; }).join('')}</ul>`}`,
    '<button class="btn primary block" data-act="closeSheet">試合に戻る</button>');
}

/* ---------- actions ---------- */
function go() {
  if (S.fired) return sheetFired();
  if (S.seasonEnd) return sheetSeasonEnd();
  const mf = E.myFixtureToday(S); if (mf) return sheetPrematch(mf.id);
  const st = E.advance(S);
  persist(false);
  render();
  if (st.stop === 'match') sheetPrematch(st.fid);
  else if (st.stop === 'inbox') { const it = S.inbox[0]; UI.tab = 'home'; render(); window.scrollTo(0, 0); toast(it && it.type === 'scout' ? 'スカウトが戻りました' : '移籍オファーが届きました'); }
  else if (st.stop === 'note') toast(st.text);
  else if (st.stop === 'seasonEnd') { persist(true); render(); sheetSeasonEnd(); }
  else if (st.stop === 'fired') { persist(true); render(); sheetFired(); }
}
const ACT = {
  toSelect() { UI.screen = 'select'; render(); window.scrollTo(0, 0); },
  toTitle() { UI.screen = 'title'; render(); },
  pickClub(d) { sheetClub(d.id); },
  startClub(d) {
    const nm = (document.getElementById('mgr-name') || {}).value || '';
    S = E.newGame(DATA, d.id, nm.trim() || 'あなた', TODAY);
    UI.tab = 'home'; closeSheet(); persist(true); render(); window.scrollTo(0, 0);
    toast(`${S.clubs[S.my].short}の監督に就任しました`);
  },
  continue() { const st = pickSave(loadLocal(), Cloud.cand); if (!st) return toast('セーブデータが読み込めません'); S = E.migrate(st, DATA); UI.tab = 'home'; render(); if (Cloud.cand === st) saveLocal(); },
  go() { go(); },
  tab(d) { UI.tab = d.tab; if (d.tab === 'league') UI.lg.round = null; render(); window.scrollTo(0, 0); },
  closeSheet() { closeSheet(); },
  player(d) { sheetPlayer(Number(d.id)); },
  sqPos(d) { UI.sq.pos = d.k; render(); },
  sqSort(d) { UI.sq.sort = d.k; render(); },
  sqView(d) { UI.sq.view = d.k; render(); window.scrollTo(0, 0); },
  devFilter(d) { UI.sq.dev = d.k; render(); },
  devReset() { for (const p of E.squad(S, S.my)) { p.tf = 'auto'; p.ti = 'norm'; } persist(false); render(); toast('全員のメニューをおまかせ・通常に戻しました（ポジション習得は継続）'); },
  train(d) { sheetTrain(Number(d.id)); },
  setTf(d) { const p = S.players[d.id]; p.tf = d.k; persist(false); refreshSheet(); render(); },
  setTi(d) { const p = S.players[d.id]; p.ti = d.k; persist(false); refreshSheet(); render(); },
  setLearn(d) { const p = S.players[d.id]; if (!d.k) p.learn = null; else if (!p.learn || p.learn.pos !== d.k) p.learn = { pos: d.k }; persist(false); refreshSheet(); render(); },
  form(d) { reslot(d.k); persist(false); render(); },
  ment(d) { S.clubs[S.my].tac.ment = d.k; persist(false); render(); },
  ctr() { const t = S.clubs[S.my].tac; t.ctr = !t.ctr; persist(false); render(); },
  press(d) { S.clubs[S.my].tac.press = d.k; persist(false); render(); },
  autoSubs() { S.settings.autoSubs = !S.settings.autoSubs; persist(false); if (sheetState && sheetState.type === 'msub') refreshSheet(); else render(); },
  autoXI() { E.autoLineup(S, S.my); persist(false); render(); toast('ベストメンバーを組みました'); },
  benchPick(d) { sheetBench(Number(d.id)); },
  benchIn(d) {
    const outId = sheetState && sheetState.id; const o = S.players[outId], p = S.players[d.id];
    if (E.benchSwap(S, outId, Number(d.id))) { persist(false); closeSheet(); render(); toast(o ? `${p.short}をベンチに入れました（${o.short}はベンチ外）` : `${p.short}をベンチに入れました`); }
  },
  benchOut(d) { const p = S.players[d.id]; if (E.benchRemove(S, Number(d.id))) { persist(false); closeSheet(); render(); toast(`${p.short}をベンチから外しました`); } },
  benchAuto() { const c = S.clubs[S.my]; c.tac.benchManual = false; E.autoBench(S, S.my, true); persist(false); render(); toast('ベンチをおまかせで組み直しました'); },
  slot(d) { sheetSlot(Number(d.i)); },
  assign(d) {
    const c = S.clubs[S.my]; const i = Number(d.i), pid = Number(d.id); const xi = c.tac.xi; const j = xi.indexOf(pid);
    if (j === i) { closeSheet(); return; }
    if (j >= 0) { const t = xi[i]; xi[i] = xi[j]; xi[j] = t; }
    else {
      const old = xi[i]; const bi = c.tac.bench.indexOf(pid);
      xi[i] = pid;
      if (bi >= 0) { if (old && E.available(S.players[old])) c.tac.bench[bi] = old; else c.tac.bench.splice(bi, 1); }
    }
    E.validateLineup(S, S.my); persist(false); closeSheet(); render();
  },
  lgView(d) { UI.lg.view = d.k; render(); },
  cupPick(d) { UI.lg.cup = d.k; render(); },
  presets() { UI.preset = {}; sheetPresets(); },
  presetSave(d) {
    const i = d.i != null ? Number(d.i) : null;
    const name = i == null ? ((document.getElementById('pr-new') || {}).value || '') : '';
    const r = E.savePreset(S, i, name);
    if (r < 0) return toast('保存枠がいっぱいです');
    UI.preset = {}; persist(false); refreshSheet(); render();
    toast(i == null ? `「${S.clubs[S.my].presets[r].name}」を保存しました` : `「${S.clubs[S.my].presets[r].name}」を今の戦術で上書きしました`);
  },
  presetLoad(d) {
    const i = Number(d.i); const pr = S.clubs[S.my].presets[i];
    const st = E.loadPreset(S, i); if (!st) return;
    persist(false); closeSheet(); UI.tab = 'tactics'; render(); window.scrollTo(0, 0);
    const notes = [st.out.length ? `出場できない選手が${st.out.length}人います` : '', st.gone.length ? `移籍した${st.gone.length}人の枠は空きです` : ''].filter(Boolean);
    toast(`「${pr.name}」を読み込みました` + (notes.length ? `。${notes.join('、')}` : ''));
  },
  presetEdit(d) { UI.preset = { edit: Number(d.i) }; refreshSheet(); const el = document.getElementById('pr-name'); if (el) el.focus(); },
  presetRename(d) { E.renamePreset(S, Number(d.i), (document.getElementById('pr-name') || {}).value || ''); UI.preset = {}; persist(false); refreshSheet(); },
  presetDel(d) {
    const i = Number(d.i);
    if (!UI.preset || UI.preset.del !== i) { UI.preset = { del: i }; return refreshSheet(); }
    const nm = S.clubs[S.my].presets[i].name; E.deletePreset(S, i); UI.preset = {}; persist(false); refreshSheet(); render(); toast(`「${nm}」を削除しました`);
  },
  scout(d) { const r = E.sendScout(S, d.k); toast(r.msg); if (r.ok) { persist(false); render(); } },
  round(d) { UI.lg.round = Math.max(1, Math.min(38, (UI.lg.round || curRound()) + Number(d.d))); render(); },
  fxDetail(d) { sheetFixture(Number(d.id)); },
  clView(d) { UI.cl.view = d.k; render(); window.scrollTo(0, 0); },
  mkPos(d) { UI.mk.pos = d.k; render(); },
  mkFA() { UI.mk.fa = !UI.mk.fa; render(); },
  upgrade(d) { const r = E.upgrade(S, d.k); toast(r.msg); if (r.ok) { persist(true); render(); } },
  training(d) { S.training = d.k; persist(false); render(); },
  toggleList(d) { const p = S.players[d.id]; p.listed = !p.listed; persist(false); toast(p.listed ? (E.inWindow(S.date) ? '放出リストに載せました。オファーを待ちます' : '放出リストに載せました。移籍期間に入るとオファーが届きます') : '放出リストから外しました'); refreshSheet(); render(); },
  bid(d) { const r = E.bid(S, Number(d.id), Number(d.m)); toast(r.msg); if (r.ok) { persist(true); closeSheet(); render(); } },
  sign(d) { const r = E.bid(S, Number(d.id), 1); toast(r.msg); if (r.ok) { persist(true); closeSheet(); render(); } },
  offerYes(d) { const r = E.acceptOffer(S, Number(d.id)); toast(r.ok ? '移籍が成立しました' : r.msg); persist(true); render(); },
  offerNo(d) { E.rejectOffer(S, Number(d.id)); toast('オファーを断りました'); persist(false); render(); },
  toTactics() { closeSheet(); UI.tab = 'tactics'; render(); window.scrollTo(0, 0); },
  kickoff(d) { startMatch(Number(d.id), false); },
  quick(d) { startMatch(Number(d.id), true); },
  nextSeason() {
    // my retiring players get a farewell pop-up first (one per player), then the season rolls over
    const ret = S.seasonEnd ? E.decideRetirements(S).filter(r => S.players[r.id]) : [];
    if (ret.length && !S.seasonEnd.retSeen) { persist(false); return sheetRetire(0); }
    ACT.rollNow();
  },
  retNext(d) { const i = Number(d.i); const ret = S.seasonEnd.ret.filter(r => S.players[r.id]); if (i < ret.length) return sheetRetire(i); S.seasonEnd.retSeen = true; ACT.rollNow(); },
  rollNow() { E.rollover(S); persist(true); closeSheet(); UI.tab = 'home'; UI.lg.round = null; render(); window.scrollTo(0, 0); if (S.fired) setTimeout(sheetFired, 260); else toast(`${E.seasonLabel(S.season)}シーズンへ`); },
  job(d) { E.takeJob(S, d.id); persist(true); closeSheet(); UI.tab = 'home'; render(); toast(`${S.clubs[S.my].short}の監督に就任しました`); },
  askReset() { sheetReset(); },
  exportOpen() { sheetExport(); },
  importOpen() { sheetImport(); },
  copyCode() {
    const ta = document.getElementById('exp-code'); const msg = document.getElementById('exp-msg');
    const fallback = () => { if (ta) { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); } if (msg) msg.textContent = '自動でコピーできませんでした。選択された文字を長押ししてコピーしてください。'; };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => { if (msg) msg.textContent = 'コピーしました。'; toast('コピーしました'); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  },
  doImport() {
    const ta = document.getElementById('imp-code'); const msg = document.getElementById('imp-msg');
    const st = readCode(ta && ta.value);
    if (!st) { if (msg) msg.textContent = 'コードを読み取れませんでした。最初から最後まで全部貼り付けられているか確認してください。'; return; }
    S = E.migrate(st, DATA); persist(true); closeSheet(); UI.tab = 'home'; UI.screen = 'title'; render(); window.scrollTo(0, 0);
    toast(`${S.clubs[S.my].short}（${fmtDate(S.date)}）のセーブを復元しました`);
  },
  doReset() { try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ } cloudWipe(); Cloud.cand = null; S = null; UI.screen = 'title'; closeSheet(); render(); },
  // match
  mSpeed() { MATCH.speed = MATCH.speed === 1 ? 2 : MATCH.speed === 2 ? 4 : 1; S.settings.speed = MATCH.speed; renderMatchCtl(); tickLoop(); },
  mPause() { MATCH.paused = !MATCH.paused; renderMatchCtl(); tickLoop(); },
  m2nd() { MATCH.ht = false; feedAdd({ m: 46, t: 'ko', text: '後半キックオフ' }); renderMatchCtl(); tickLoop(); },
  mSkip() { clearTimeout(MATCH.timer); MATCH.evq = []; MATCH.hold = false; E.simulateFull(S, MATCH.M); MATCH.ht = false; finishLive(); },
  mResult() { finishLive(); },
  mClose() { closeMatch(); },
  mTac() { if (!MATCH.paused && !MATCH.ht) { MATCH.paused = true; MATCH.resumeOnClose = true; clearTimeout(MATCH.timer); } MATCH.sel = null; sheetMatchTactics(); },
  mMent(d) { E.setMentality(MATCH.M, MATCH.k, d.k); refreshSheet(); },
  mCtr() { const sd = MATCH.M[MATCH.k]; E.setCounter(MATCH.M, MATCH.k, !sd.ctr); refreshSheet(); },
  mOut(d) { MATCH.sel = d.id ? Number(d.id) : null; refreshSheet(); },
  mIn(d) { const ok = E.doSub(S, MATCH.M, MATCH.k, MATCH.sel, Number(d.id)); if (ok) { const ev = MATCH.M.ev[MATCH.M.ev.length - 1]; feedAdd(ev); if (MATCH.viz) MATCH.viz.sync(); toast('交代しました'); } MATCH.sel = null; refreshSheet(); renderMatchCtl(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault();
  try { fn(el.dataset, el); } catch (err) { console.error(err); toast('エラーが発生しました: ' + (err && err.message)); }
});
scrimEl.addEventListener('click', () => closeSheet());
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'mk-q') { UI.mk.q = e.target.value; const l = document.getElementById('mk-list'); if (l) l.innerHTML = marketRows(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetState) closeSheet(); });

/* ---------- boot ---------- */
function start(hot) {
  if (hot && hot.save) { const st = deserialize(hot.save); if (st) { S = E.migrate(st, DATA); if (hot.ui) UI = Object.assign(UI, hot.ui); } }
  render();
  cloudInit();
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: S ? serialize(S) : null, ui: { tab: UI.tab, sq: UI.sq, lg: UI.lg, cl: UI.cl, mk: UI.mk, screen: UI.screen } })); } catch (e) { /* optional */ }
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start(hot && hot.data || {});
})();
