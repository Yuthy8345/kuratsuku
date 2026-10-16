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
// board look: green chalkboard (default) or a magnetic whiteboard; a per-device preference
const BOARD_KEY = 'kuratsuku.board';
function getBoard() { try { return localStorage.getItem(BOARD_KEY) === 'white' ? 'white' : 'chalk'; } catch (e) { return 'chalk'; } }
function applyBoard() {
  const white = getBoard() === 'white';
  if (white) document.documentElement.setAttribute('data-board', 'white'); else document.documentElement.removeAttribute('data-board');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', white ? '#F3F5F6' : '#163428');
}
function setBoard(k) { try { localStorage.setItem(BOARD_KEY, k === 'white' ? 'white' : 'chalk'); } catch (e) { /* storage blocked: only this session */ } applyBoard(); }
applyBoard();
/* iOS home-screen apps (iOS 26/27, WebKit bug 301994): at launch the viewport can come out short by the status-bar height
   (59-62px), and nothing is drawn below it. iOS uses the right height whenever the page is taller than the screen, and
   falls back to the short one when the page gets short again. So in a home-screen app the title is always laid out in
   the page at the real screen height + 1px (html.ios-app, --apph), never switched back and forth (that loop flickered).
   The gap is only measured for このゲームについて. */
const IOS_APP = navigator.standalone === true;
let appPortrait = null;
function setAppHeight() {
  if (!IOS_APP) return;
  const portrait = innerHeight >= innerWidth;
  if (portrait === appPortrait) return;  // only on rotation: the height must not follow the (buggy) viewport
  appPortrait = portrait;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  document.documentElement.style.setProperty('--apph', full + 'px');
}
if (IOS_APP) { document.documentElement.classList.add('ios-app'); setAppHeight(); addEventListener('resize', setAppHeight, { passive: true }); }
const vgapProbe = document.createElement('div');
vgapProbe.setAttribute('aria-hidden', 'true');
vgapProbe.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none';
let vgapNow = 0, vgapSeen = 0;  // measured only (shown in このゲームについて)
function measureViewportGap() {
  if (!IOS_APP) return;
  if (!vgapProbe.isConnected) document.body.appendChild(vgapProbe);
  const h = vgapProbe.getBoundingClientRect().height, portrait = innerHeight >= innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  vgapNow = Math.max(0, Math.round(full - h));
  if (vgapNow && !vgapSeen) vgapSeen = vgapNow;
}
measureViewportGap();
let UI = { screen: 'title', tab: 'home', sq: { pos: 'ALL', sort: 'pos' }, lg: { view: 'table', round: null, cup: 'ec' }, cl: { view: 'main' }, mk: { pos: '', q: '', fa: false, view: 'find' } };
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
/* saved tactics go into a new game (2026-10-14): from the game being replaced, or, after the save was deleted, from the
   copy kept on this device when it was deleted */
const TAC_KEY = 'kuratsuku.tactics';
function tacLibSave(list) { try { localStorage.setItem(TAC_KEY, JSON.stringify(list || [])); } catch (e) { /* storage blocked */ } }
function tacLibLoad() { try { const v = JSON.parse(localStorage.getItem(TAC_KEY) || 'null'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function carryPresets() { const src = S || pickSave(loadLocal(), Cloud.cand); return src ? E.presetsOf(src) : tacLibLoad(); }
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
// club magnets: no real crests — the club's colours and one simple pattern each (.k-* in template.html), so that clubs in the
// same colour still look different (2026-10-14). [pattern, colour 1, colour 2, colour 3, ring]; 'so' = plain colour 1 with a
// colour-2 ring (the old look). Clubs not listed (海外組) keep the plain look in their kit colours.
const EMB = {
  // J1
  kashima:    ['hp', '#A6192E', '#14234B', null, '#14234B'],
  yokohamafm: ['tr', '#0B3B8C', '#FFFFFF', '#D7101F', '#FFFFFF'],
  kashiwa:    ['so', '#F2CC0C', '#1A1A1A'],
  kawasakif:  ['so', '#3BA2E0', '#111111'],
  urawa:      ['so', '#D7000F', '#111111'],
  machida:    ['so', '#0A3D91', '#C9A227'],
  tokyov:     ['so', '#00843D', '#F3F3F3'],
  fctokyo:    ['hf', '#123E8C', '#C8102E', null, '#0B1E44'],
  mito:       ['tf', '#1D4FA0', '#FFFFFF', null, '#FFFFFF'],
  chiba:      ['sh', '#F7D117', '#00753A', null, '#00753A'],
  shimizu:    ['pn', '#F28A00', '#123A7A', null, '#123A7A'],
  nagoya:     ['bd', '#D6271C', '#F2A900', null, '#F2A900'],
  kyoto:      ['sh', '#6B2A8F', '#D7262E', null, '#E8E3EE'],
  gosaka:     ['st', '#0A4AA6', '#111111', null, '#111111'],
  cosaka:     ['so', '#E2187A', '#1B2A4A'],
  kobe:       ['cs', '#8E1B2E', '#FFFFFF', '#111111', '#111111'],
  okayama:    ['cd', '#8C1D3A', '#F2F2F2', null, '#F2F2F2'],
  hiroshima:  ['pn', '#5A2D91', '#FFFFFF', null, '#FFFFFF'],
  fukuoka:    ['hp', '#0D2C6C', '#B8BEC9', null, '#B8BEC9'],
  nagasaki:   ['v', '#0F4C9C', '#F39800', null, '#F39800'],
  // J2
  sapporo:    ['st', '#C8102E', '#111111', null, '#111111'],
  yokohamafc: ['dh', '#2BA6DE', '#FFFFFF', null, '#1D4FA0'],
  shonan:     ['hf', '#7AB800', '#1F4E9C', null, '#FFFFFF'],
  niigata:    ['so', '#F26B00', '#1F3C88'],
  iwata:      ['ub', '#6DB6E6', '#1D3F8C', null, '#FFFFFF'],
  tosu:       ['hf', '#5BA6DE', '#E7489B', null, '#FFFFFF'],
  omiya:      ['qt', '#F37021', '#14224A', null, '#14224A'],
  sendai:     ['bd', '#F5C400', '#1B2E5A', null, '#1B2E5A'],
  tokushima:  ['sh', '#1B3A8C', '#78BE20', null, '#FFFFFF'],
  oita:       ['cd', '#1D3C9C', '#F2C400', null, '#F2C400'],
  kofu:       ['di', '#1D4E9C', '#A3203A', null, '#F2F2F2'],
  yamagata:   ['pn', '#1D3F8C', '#F2C400', null, '#F2C400'],
  iwaki:      ['sh', '#C8102E', '#1B2A4A', null, '#1B2A4A'],
  imabari:    ['cs', '#1B2A4A', '#F2C400', '#FFFFFF', '#F2C400'],
};
function kitVars(cid, c) {
  const e = EMB[cid];
  if (!e) return { cls: '', st: c ? `--c1:${c.c1};--c2:${c.c2}` : '' };
  return { cls: e[0] === 'so' ? '' : ' k-' + e[0], st: `--c1:${e[1]};--c2:${e[2]}${e[3] ? ';--c3:' + e[3] : ''}${e[4] ? ';--r:' + e[4] : ''}` };
}
function kitTag(cid, c, size, base) { const v = kitVars(cid, c); return `<span class="${base || 'kit'}${size ? ' ' + size : ''}${v.cls}" style="${v.st}" aria-hidden="true"></span>`; }
// uniforms (2026-10-16): what the players wear — the club magnet above is the crest. Each club's 1st/2nd kit is the features
// that run through its recent kits (base colour, recurring pattern, the trim colours), not a copy of one season's design.
// [pattern, base, pattern colour, trim 1 (ring/collar/cuffs), trim 2 (inner line), number]; patterns: so plain, st stripes,
// pn pinstripes. Sources: HANDOFF.md §4 (2026-10-16). Clubs not listed (海外組) wear their data colours c1 (2nd: c2).
const W2 = '#F5F5F0';
const UNI = {
  // J1
  kashima:    [['so', '#A6192E', null, '#14234B', '#C9A227', '#FFFFFF'], ['so', W2, null, '#A6192E', '#14234B', '#A6192E']],
  mito:       [['so', '#1D4FA0', null, '#FFFFFF', '#14306B', '#FFFFFF'], ['so', W2, null, '#1D4FA0', '#14306B', '#1D4FA0']],
  urawa:      [['so', '#D7000F', null, '#111111', '#FFFFFF', '#FFFFFF'], ['so', W2, null, '#111111', '#D7000F', '#111111']],
  chiba:      [['so', '#F7D117', null, '#00753A', '#D7262E', '#00753A'], ['so', W2, null, '#00753A', '#F7D117', '#00753A']],
  kashiwa:    [['so', '#F2CC0C', null, '#1A1A1A', null, '#1A1A1A'], ['so', W2, null, '#1A1A1A', '#F2CC0C', '#1A1A1A']],
  fctokyo:    [['st', '#123E8C', '#C8102E', '#0B1E44', null, '#FFFFFF'], ['so', W2, null, '#0B1E44', '#C8102E', '#0B1E44']],
  tokyov:     [['so', '#00843D', null, '#C9A227', '#FFFFFF', '#FFFFFF'], ['so', W2, null, '#00843D', '#C9A227', '#00843D']],
  machida:    [['so', '#0A3D91', null, '#C9A227', null, '#FFFFFF'], ['so', W2, null, '#C9A227', '#0A3D91', '#0A3D91']],
  kawasakif:  [['pn', '#2C9BDB', '#111111', '#111111', null, '#FFFFFF'], ['so', W2, null, '#111111', '#2C9BDB', '#111111']],
  yokohamafm: [['so', '#1446A0', null, '#FFFFFF', '#D7192F', '#FFFFFF'], ['so', W2, null, '#1446A0', '#D7192F', '#1446A0']],
  shimizu:    [['so', '#F28A00', null, '#123A7A', null, '#123A7A'], ['so', W2, null, '#F28A00', '#123A7A', '#123A7A']],
  nagoya:     [['so', '#D6271C', null, '#F2A900', null, '#FFFFFF'], ['so', W2, null, '#D6271C', '#F2A900', '#D6271C']],
  kyoto:      [['so', '#6B2A8F', null, '#111111', '#FFFFFF', '#FFFFFF'], ['so', W2, null, '#6B2A8F', null, '#6B2A8F']],
  gosaka:     [['st', '#0A4AA6', '#111111', '#111111', null, '#FFFFFF'], ['so', W2, null, '#111111', '#0A4AA6', '#111111']],
  cosaka:     [['so', '#E2187A', null, '#1B2A4A', null, '#FFFFFF'], ['so', W2, null, '#E2187A', '#1B2A4A', '#E2187A']],
  kobe:       [['pn', '#8E1B2E', '#6A1020', '#C9A227', '#111111', '#FFFFFF'], ['so', W2, null, '#1B2A4A', '#C9A227', '#1B2A4A']],
  okayama:    [['so', '#9E1B32', null, '#FFFFFF', '#1B2A4A', '#FFFFFF'], ['so', W2, null, '#1B2A4A', '#9E1B32', '#1B2A4A']],
  hiroshima:  [['so', '#5A2D91', null, '#FFFFFF', null, '#FFFFFF'], ['so', W2, null, '#5A2D91', null, '#5A2D91']],
  fukuoka:    [['st', '#0D2C6C', '#1F4FA0', '#FFFFFF', null, '#FFFFFF'], ['so', W2, null, '#0D2C6C', null, '#0D2C6C']],
  nagasaki:   [['so', '#0F4C9C', null, '#F39800', null, '#FFFFFF'], ['so', W2, null, '#0F4C9C', '#F39800', '#0F4C9C']],
  // J2
  sapporo:    [['st', '#C8102E', '#111111', '#111111', null, '#FFFFFF'], ['so', W2, null, '#C8102E', '#111111', '#C8102E']],
  yokohamafc: [['so', '#2BA6DE', null, '#FFFFFF', '#1B2E5A', '#FFFFFF'], ['so', W2, null, '#2BA6DE', '#1B2E5A', '#1B2E5A']],
  shonan:     [['so', '#7AB800', null, '#2B8FD6', null, '#123A7A'], ['so', W2, null, '#7AB800', '#2B8FD6', '#123A7A']],
  niigata:    [['so', '#F26B00', null, '#1F3C88', null, '#FFFFFF'], ['so', W2, null, '#F26B00', '#1F3C88', '#1F3C88']],
  iwata:      [['so', '#6DB6E6', null, '#1D3F8C', '#C9A227', '#1D3F8C'], ['so', W2, null, '#6DB6E6', '#1D3F8C', '#1D3F8C']],
  tosu:       [['so', '#5BA6DE', null, '#E7489B', null, '#FFFFFF'], ['so', W2, null, '#5BA6DE', '#E7489B', '#2F6FAE']],
  omiya:      [['so', '#F37021', null, '#14224A', null, '#14224A'], ['so', W2, null, '#F37021', '#14224A', '#14224A']],
  sendai:     [['so', '#F5C400', null, '#1B2E5A', '#FFFFFF', '#1B2E5A'], ['so', W2, null, '#1B2E5A', '#F5C400', '#1B2E5A']],
  tokushima:  [['so', '#1B3A8C', null, '#4FA3DC', null, '#FFFFFF'], ['so', W2, null, '#1B3A8C', '#4FA3DC', '#1B3A8C']],
  oita:       [['so', '#1D3C9C', null, '#F2C400', '#14254F', '#FFFFFF'], ['so', W2, null, '#1D3C9C', '#F2C400', '#1D3C9C']],
  kofu:       [['so', '#1D4E9C', null, '#14306B', '#FFFFFF', '#FFFFFF'], ['so', W2, null, '#1D4E9C', '#14306B', '#1D4E9C']],
  yamagata:   [['st', '#1D3F8C', '#FFFFFF', '#14254F', null, '#FFFFFF'], ['so', W2, null, '#1D3F8C', '#14254F', '#1D3F8C']],
  iwaki:      [['so', '#C8102E', null, '#1B2A4A', '#FFFFFF', '#FFFFFF'], ['so', W2, null, '#1B2A4A', '#C8102E', '#1B2A4A']],
  imabari:    [['so', '#1D4FA0', null, '#F2C400', '#4FA3DC', '#FFFFFF'], ['so', W2, null, '#1D4FA0', '#F2C400', '#1D4FA0']],
};
const uniClub = cid => (S && S.clubs[cid]) || (PREVIEW && PREVIEW.clubs[cid]) || null;
// the kit a club wears: alt = the 2nd kit
function uniOf(cid, alt) {
  const e = UNI[cid];
  if (e) { const k = e[alt ? 1 : 0]; return { p: k[0], b: k[1], pc: k[2], t1: k[3], t2: k[4], n: k[5] }; }
  const c = uniClub(cid) || { c1: '#888888', c2: '#DDDDDD' };
  const b = alt ? c.c2 : c.c1, t = alt ? c.c1 : c.c2;
  return { p: 'so', b, pc: null, t1: t, t2: null, n: lum(b) > 0.6 ? '#141414' : '#FFFFFF' };
}
// the body of a round magnet (CSS background, left to right)
function uniBg(u) {
  if (u.p === 'st') return `linear-gradient(90deg, ${u.b} 0 20%, ${u.pc} 20% 40%, ${u.b} 40% 60%, ${u.pc} 60% 80%, ${u.b} 80%)`;
  if (u.p === 'pn') return `linear-gradient(90deg, ${u.b} 0 26%, ${u.pc} 26% 31%, ${u.b} 31% 69%, ${u.pc} 69% 74%, ${u.b} 74%)`;
  return u.b;
}
// CSS variables for a player magnet: --k1 base, --k2 ring, --k3 inner line, --kt number, --kp body
function uniVars(cid, alt) { const u = uniOf(cid, alt); return `--k1:${u.b};--k2:${u.t1};--k3:${u.t2 || u.t1};--kt:${u.n};--kp:${uniBg(u)}`; }
const uniPat = cid => uniOf(cid).p !== 'so' ? ' pat' : '';
// a shirt (140×128), front or back: the body with its pattern, cuffs and collar in the trim colours; num on the chest
const SH_BODY = 'M43.4,0 L23.8,6.4 L0,34.6 L15.4,57.6 L32.2,48.6 L32.2,128 L107.8,128 L107.8,48.6 L124.6,57.6 L140,34.6 L116.2,6.4 L96.6,0 L84,9 L70,11.5 L56,9 Z';
let shN = 0;
// a player magnet on a board or the bench is the shirt itself (2026-10-16 案B); a player who can't play wears grey
const OUT_KIT = { p: 'so', b: '#5A5F5C', pc: null, t1: '#474B49', t2: null, n: '#FFFFFF' };
const tokShirt = (cid, num, cls, out) => `<span class="shirt uni-b ${cls}">${uniSvg(out ? OUT_KIT : uniOf(cid), { num })}</span>`;
function uniSvg(u, o) {
  o = o || {}; const id = 'sh' + (++shN);
  const pat = u.p === 'st' ? Array.from({ length: 5 }, (_, i) => `<rect x="${19 + i * 22}" y="0" width="11" height="128" fill="${u.pc}"/>`).join('')
    : u.p === 'pn' ? Array.from({ length: 6 }, (_, i) => `<rect x="${17 + i * 21}" y="0" width="3.2" height="128" fill="${u.pc}"/>`).join('') : '';
  const cuff = (c, w) => `<path d="M0,34.6 L15.4,57.6 L20.2,52.5 L4.8,29.5 Z" fill="${c}"/><path d="M140,34.6 L124.6,57.6 L119.8,52.5 L135.2,29.5 Z" fill="${c}"/>${w ? `<path d="M3.2,32.4 L18.5,55" stroke="${w}" stroke-width="1.8" fill="none"/><path d="M136.8,32.4 L121.5,55" stroke="${w}" stroke-width="1.8" fill="none"/>` : ''}`;
  const collar = o.back ? `<path d="M44,1.5 Q70,15 96,1.5" stroke="${u.t1}" stroke-width="6" fill="none"/>`
    : `<path d="M46,1 L70,24 L94,1" stroke="${u.t1}" stroke-width="6.5" fill="none" stroke-linejoin="round"/>${u.t2 ? `<path d="M52,3.5 L70,20.5 L88,3.5" stroke="${u.t2}" stroke-width="2" fill="none" stroke-linejoin="round"/>` : ''}`;
  const num = o.num != null ? `<text x="70" y="${o.back ? 86 : 84}" text-anchor="middle" style="font-family:${o.font || 'var(--f-body),system-ui,sans-serif;font-weight:900'}" font-size="${String(o.num).length > 1 ? 50 : 56}" fill="${u.n}"${u.p !== 'so' ? ' stroke="rgba(0,0,0,.55)" stroke-width="5" paint-order="stroke"' : ''}>${o.num}</text>` : '';
  // the champions' shirt: a gold star on the chest
  const star = o.star ? '<path d="M70,50 l7.6,15.4 17,2.5 -12.3,12 2.9,16.9 -15.2,-8 -15.2,8 2.9,-16.9 -12.3,-12 17,-2.5z" fill="#F3CF7A" stroke="#B8862B" stroke-width="2.5" stroke-linejoin="round"/>' : '';
  return `<svg class="${o.cls || 'uni'}" viewBox="0 0 140 128" aria-hidden="true"><defs><clipPath id="${id}"><path d="${SH_BODY}"/></clipPath></defs><g clip-path="url(#${id})"><rect width="140" height="128" fill="${u.b}"/>${pat}${cuff(u.t1, u.t2)}${collar}</g><path d="${SH_BODY}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/>${star}${num}</svg>`;
}
function kit(cid, size) { const c = S && S.clubs[cid] || (PREVIEW && PREVIEW.clubs[cid]); if (!c) return '<span class="kit"></span>'; return kitTag(cid, c, size); }
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
// title: the manager's tactics board — 11 of ours (blue) against 11 of theirs (yellow)
/* Title: the tactics board. Coordinates are in the 362x816 design board and scale with the screen.
   Opponent (yellow 4-4-2) attacks down, my team (blue 4-2-3-1) attacks up; logo and buttons sit in front of a dimmed board. */
const TB_W = 362, TB_H = 816;
const TB_OPP = [[181, 48, 1], [54, 146, 2], [134, 136, 3], [228, 136, 4], [308, 146, 5], [58, 242, 7], [140, 232, 8], [222, 232, 6], [304, 242, 11], [148, 346, 9], [222, 334, 10]];
const TB_OWN = [[181, 462, 9], [58, 530, 11], [181, 520, 10], [304, 530, 7], [134, 598, 6], [228, 598, 8], [46, 664, 5], [128, 690, 4], [234, 690, 3], [316, 664, 2], [181, 774, 1]];
const TB_PITCH = '<rect x="20" y="20" width="322" height="776" rx="3"/><path d="M20 408H342M83 20V118H279V20M133 20V54H229V20M148 118A46 46 0 0 0 214 118M83 796V698H279V796M133 796V762H229V796M148 698A46 46 0 0 1 214 698M157 20V11H205V20M157 796V805H205V796M20 28A8 8 0 0 0 28 20M334 20A8 8 0 0 0 342 28M20 788A8 8 0 0 1 28 796M334 796A8 8 0 0 1 342 788"/>';
const TB_ARROWS = '<path class="w ds" d="M142.8 583.4L171.2 536.3"/><path class="w" d="M171.7 547.1L171.2 536.3L161.4 540.9"/><path class="w" d="M66 515C80 478 98 440 124 410"/><path class="w" d="M122.6 420.7L124 410L113.6 412.9"/><path class="w" d="M186 445Q196 416 200 386"/><path class="w" d="M204.8 395.7L200 386L192.9 394.1"/><path class="w" d="M304 512L306.1 509.3L306.9 506.4L302.8 502.7L301.7 499.5L306.4 497.2L311.1 494.9L309.9 491.7L305.2 487.9L304 484.7L308.7 482.4L313.4 480.1L312.3 476.9L307.5 473.1L306.4 469.8L311.1 467.6L315.8 465.3L314.6 462L309.9 458.3L308.7 455L313.4 452.7L318.1 450.5L317 447.2L312.2 443.4L311.1 440.2L315.8 437.9L317.9 435.2L318 424"/><path class="w" d="M322.5 433.8L318 424L310.7 431.9"/><path class="w" d="M38 646C28 604 26 544 30 488"/><path class="w" d="M35.3 497.4L30 488L23.4 496.5"/><path class="y pr" d="M152 363L164 408"/><path class="y pr" d="M155.9 400.8L164 408L167.5 397.8"/><path class="y pr" d="M154.1 394.1L162.2 401.2L165.7 391"/><path class="y" d="M230 350C248 382 260 422 254 458"/><path class="y" d="M249.6 448.1L254 458L261.4 450.1"/><path class="y" d="M192 284L254 290"/><path class="y" d="M244.5 295.1L254 290L245.6 283.2"/><ellipse class="y zone" cx="74" cy="330" rx="40" ry="24" transform="rotate(-8 74 330)"/><path class="y" d="M304 260L302.2 262.9L301.6 265.8L305.9 269.2L307.3 272.3L302.8 275L298.4 277.6L299.8 280.7L304.8 284.1L306.2 287.2L301.7 289.9L297.2 292.6L298.6 295.7L302.9 299L301.7 302L300 312"/><path class="y" d="M294.7 302.6L300 312L306.7 303.5"/>';
function viewTitle() {
  const save = pickSave(loadLocal(), Cloud.cand);
  const sc = save && save.clubs[save.my];
  const pc = v => +(v * 100).toFixed(2) + '%';
  const mag = cls => ([x, y, n]) => `<span class="mag ${cls}" style="left:${pc(x / TB_W)};top:${pc(y / TB_H)}">${n}</span>`;
  const cont = save ? `<button class="plate yellow" data-act="continue">${kitTag(save.my, sc, '', 'mag-dot')}<span><b>つづきから</b><small>${esc(sc.name)}　${E.seasonLabel(save.season)}・${jd(save.date)}${save === Cloud.cand ? '・クラウド' : ''}</small></span></button>` : '';
  const fresh = `<button class="plate ${save ? 'chalk' : 'yellow'}" data-act="toSelect"><span class="newmag" aria-hidden="true">NEW</span><b>新しく始める</b></button>`;
  return `<div class="tb-wrap"><main class="tboard">
    <div class="tb-pitch" aria-hidden="true">
      <svg class="tb-lines" viewBox="0 0 ${TB_W} ${TB_H}" preserveAspectRatio="none">${TB_PITCH}</svg><span class="tb-circle"></span>
      <svg class="tb-arrows" viewBox="0 0 ${TB_W} ${TB_H}" preserveAspectRatio="none">${TB_ARROWS}</svg>
      ${TB_OPP.map(mag('opp')).join('')}${TB_OWN.map(mag('own')).join('')}
    </div>
    <div class="tb-dim" aria-hidden="true"></div>
    <div class="tb-logo"><h1>クラつく</h1><svg viewBox="0 0 230 22" aria-hidden="true"><path d="M6 14 C 60 4, 140 4, 224 10" fill="none" stroke="#F2C230" stroke-width="5" stroke-linecap="round"></path><path d="M30 19 C 90 12, 150 12, 200 16" fill="none" stroke="#F2C230" stroke-width="2.5" stroke-linecap="round" opacity=".7"></path></svg></div>
    <div class="tb-menu">${cont}${fresh}<div class="tb-links"><button type="button" data-act="importOpen">引き継ぎコードで復元</button><button type="button" class="about" data-act="aboutOpen">このゲームについて</button></div></div>
  </main></div>`;
}
function sheetAbout() {
  measureViewportGap();
  const se = E.seasonForDate(TODAY, 2026);
  sheetState = { type: 'about' };
  openSheet(`<div class="eyebrow">このゲームについて</div><h2>クラつく</h2>
    <p class="small" style="margin:0">Jリーグのクラブを率いる、片手で遊べるクラブ経営シミュレーションです。</p>
    <dl class="kv"><dt>開始日</dt><dd>${fmtLong(TODAY)}</dd><dt>対象シーズン</dt><dd>2026/27（開幕 2026年8月7日）</dd></dl>
    <p class="fine">${se.note ? `今日の日付からは${E.seasonLabel(se.computed)}シーズンにあたりますが、収録データは2026/27シーズン版のため、2026/27の開幕から始まります。` : '開始日が含まれる2026/27シーズンの開幕（8月7日）からスタートします。'}</p>
    <p class="fine">画面 ${screen.width}×${screen.height}・表示 ${innerWidth}×${innerHeight}${navigator.standalone ? '・ホーム画面アプリ' : ''}・起動時のずれ ${vgapSeen}px（いま ${vgapNow}px）</p>
    <p class="fine">選手と在籍クラブはJリーグ公式サイトの2026/27シーズン登録選手（2026年9月時点）をもとにしています。能力値は独自の推定です。クラブのエンブレムは使用していません。非商用のファンメイドゲームです。</p>`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function kitFor(st, cid) { return kitTag(cid, st.clubs[cid], 'lg'); }
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
      return `<li><button class="crow" data-act="pickClub" data-id="${id}">${kitTag(id, c, 'lg')}<span><b>${esc(c.name)}</b><span>${esc(c.area)}・資金 ${E.money(c.funds)}</span></span><span style="display:grid;justify-items:end;gap:2px"><span class="stars" aria-label="チーム力">${stars(c.pred)}</span><span class="small muted">格：${E.presLabel(c.pres)}</span></span></button></li>`;
    }).join('')}</ul>
  </div>
  <div class="title-actions"><button class="btn ghost block" data-act="toTitle">戻る</button></div></div>`;
}
function sheetClub(id) {
  const P = PREVIEW, c = P.clubs[id];
  const top = E.squad(P, id).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  sheetState = { type: 'club', id };
  openSheet(`<div class="row">${kitTag(id, c, 'lg')}<div><div class="eyebrow">${esc(c.area)}</div><h2>${esc(c.name)}</h2></div></div>
    <dl class="kv"><dt>ホーム</dt><dd>${esc(c.stadium)}</dd><dt>収容</dt><dd>${c.cap.toLocaleString('ja-JP')}人</dd><dt>資金</dt><dd>${E.money(c.funds)}</dd><dt>スポンサー収入</dt><dd>月 ${E.money(c.spon)}</dd><dt>チーム力</dt><dd><span class="stars">${stars(c.pred)}</span>（${c.pred}番手）</dd><dt>クラブの格</dt><dd>${presBadge(c)} ${E.presLabel(c.pres)}</dd><dt>クラブの目標</dt><dd>${esc(c.target.jp)}</dd></dl>
    <p class="fine" style="margin:-6px 0 0">${titlesText(c)}${c.o10 ? '・Jリーグ創設メンバー' : ''}</p>
    <div><div class="eyebrow" style="margin-bottom:6px">主力選手</div><ul class="list">${top.map(p => `<li><div class="prow" style="grid-template-columns:30px 1fr auto">${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, P.date)}歳 ${natChip(p)}</span></span><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></div></li>`).join('')}</ul></div>`,
    `<button class="btn primary block" data-act="nameClub" data-id="${id}">${esc(c.short)}で始める</button><button class="btn ghost block" data-act="closeSheet">ほかのクラブを見る</button>`);
}
// after picking a club: the manager's name, on a nameplate under the club's magnet (empty = 「あなた」)
function sheetName(id, keep) {
  const c = PREVIEW.clubs[id];
  sheetState = { type: 'name', id };
  const kt = lum(c.c1) > 0.6 ? '#141414' : '#ffffff';
  openSheet(`<div class="mgr-card" style="--k1:${c.c1};--k2:${c.c2};--kt:${kt}">
      <div class="eyebrow">新監督の就任</div>
      <div class="mgr-club">${kitTag(id, c, 'lg')}<b>${esc(c.name)}</b></div>
      <label class="mgr-plate" for="mgr-name"><span class="mgr-plate-k">監督</span><input id="mgr-name" maxlength="12" placeholder="あなた" autocomplete="off" enterkeyhint="done" value="${esc(keep || '')}" aria-label="監督名"></label>
      <p class="fine" style="margin:0">あなたの名前を入れてください（12文字まで）。空欄のままなら「あなた」で始まります。</p>
      ${(() => { const n = carryPresets().length; return n ? `<p class="fine" style="margin:0">保存した戦術（${n}件）は新しいゲームでも使えます。</p>` : ''; })()}
    </div>`,
    `<button class="btn primary block" data-act="startClub" data-id="${id}">${esc(c.short)}の監督に就任する</button><button class="btn ghost block" data-act="pickClub" data-id="${id}">戻る</button>`);
  // the keyboard's done key only closes the keyboard (starting is the button's job)
  const inp = document.getElementById('mgr-name');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); inp.blur(); } });
}

/* ---------- main shell ---------- */
function render() {
  if (!S) { root.innerHTML = UI.screen === 'select' ? viewSelect() : viewTitle(); return; }
  const views = { home: viewHome, squad: viewSquad, tactics: viewTactics, league: viewLeague, club: viewClub };
  if (S.clubs[S.my] && !S.fired) E.validateLineup(S, S.my);
  const si = secItems(); const home = UI.tab === 'home';
  root.innerHTML = `<div class="app${si.n ? ' has-sec' : ''}${si.n && home ? ' has-sec-home' : ''}">${header()}<main class="view" id="view">${views[UI.tab]()}</main></div>${dock(home && si.n ? secBand(si) : '')}${si.n && !home ? secFloat(si) : ''}`;
  secPlace();
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
function dock(band) {
  const g = goState();
  const unseen = S.inbox.some(x => x.type === 'offer' && !x.done && !x.seen);
  const fix = !S.fired && S.clubs[S.my] && E.lineupIssues(S, S.my).block;
  const tabs = [['home', 'ホーム'], ['squad', '選手'], ['tactics', '戦術'], ['league', 'リーグ'], ['club', 'クラブ']];
  return `<nav class="dock" aria-label="メイン操作"><div class="dock-in">${band || ''}
    <button class="go" data-act="go"><b>${g.label}</b><span class="row"><small>${g.sub}</small><span class="arrow" aria-hidden="true">▶</span></span></button>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" data-act="tab" data-tab="${k}" ${UI.tab === k ? 'aria-current="page"' : ''}>${ICON[k]}<span>${l}</span>${(k === 'home' && unseen) || (k === 'tactics' && fix) ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>
  </div></nav>`;
}

/* ---------- home ---------- */
// one side of the match ticket; the opponent's side opens their club sheet
function tside(cid, lab) {
  const inner = `${kit(cid, 'lg')}<b>${esc(S.clubs[cid].short)}</b><small>${lab}</small>`;
  return cid === S.my ? `<div class="tside me">${inner}</div>` : `<button class="tside" data-act="team" data-id="${cid}" aria-label="${esc(S.clubs[cid].name)}の情報">${inner}</button>`;
}
function ticket(f) {
  const H = S.clubs[f.h], A = S.clubs[f.a];
  const t = E.table(S); const opp = f.h === S.my ? f.a : f.h;
  const of = (t.find(r => r.id === opp) || { form: [] }).form.slice(-5);
  const rk = id => { if (!inJ1(id)) return 'J2'; const r = rankOf(id); return r === '—' ? '開幕前' : r + '位'; };
  const story = storyChips(f);
  return `<section class="ticket ${f.cup ? 'cup' : ''}" aria-label="次の試合">
    <div class="ticket-top"><span>${E.fxEn(f)}</span><span>${jdw(f.date)}${f.date === S.date ? ' TODAY' : ''}</span></div>
    <div class="ticket-mid">
      ${tside(f.h, `${rk(f.h)}・${f.neutral ? '国立' : 'HOME'}`)}
      <div class="tvs">VS</div>
      ${tside(f.a, `${rk(f.a)}・${f.neutral ? '国立' : 'AWAY'}`)}
    </div>
    ${story ? `<div class="ticket-story">${story}</div>` : ''}
    <div class="ticket-perf"></div>
    <div class="ticket-foot"><span>${E.fxLabel(f)}・${esc(venueOf(f))}</span>${inJ1(opp) ? `<span class="row">相手の直近 <span class="formline">${formChips(of)}</span></span>` : ''}</div>
    <button class="ticket-scout" data-act="team" data-id="${opp}"><span>${esc(S.clubs[opp].short)}を詳しく見る</span><small>順位・戦い方・注目選手</small><span class="arrow" aria-hidden="true">›</span></button>
  </section>`;
}
function offerCard(it) {
  const p = S.players[it.pid]; if (!p) return '';
  const v = E.value(p, S.date); const ab = S.clubs[it.from] && S.clubs[it.from].ab;
  return `<article class="card" style="display:grid;gap:10px">
    <div class="row">${kit(it.from)}<div style="min-width:0"><b>${esc(S.clubs[it.from].name)}</b>${ab ? ` <span class="chip abchip">${esc(ab.lg.includes(COUNTRY[ab.cc] || '?') ? ab.lg : `${COUNTRY[ab.cc] || ab.cc}・${ab.lg}`)}</span>` : ''}<div class="small muted">${jd(it.d)}着・${jd(it.exp)}まで有効</div></div></div>
    ${it.euro ? `<p class="small" style="margin:0">${esc(p.name)}は代表での活躍で欧州から注目されている。<b>本人は海外挑戦を望んでいる。</b>断ると、しばらくは欧州からオファーが来ない。</p>` : ''}
    <div>${esc(p.name)}（${p.pos}・${E.ovr(p)}）に <b>${E.money(it.fee)}</b> を提示。${it.raised ? `<span class="chip ok" style="margin-right:6px">増額（+${E.money(it.fee - it.fee0)}）</span>` : ''}<span class="small muted">市場価値 ${E.money(v)}</span></div>
    <div class="grid2"><button class="btn ghost" data-act="offerNo" data-id="${it.id}">断る</button><button class="btn primary" data-act="offerYes" data-id="${it.id}">受ける</button></div>
    ${it.raised ? '' : `<button class="btn ghost block" data-act="offerUp" data-id="${it.id}">増額を求める</button><p class="fine">1回だけ。上乗せしてくるか、手を引くかのどちらか。${it.euro ? '欧州のクラブは手を引くことが少ない。' : (it.walk != null ? it.walk >= E.OFFER_UP.walk.listed : p.listed) ? '放出リストを見て来たオファーなので、手を引かれやすい。' : '向こうから来たオファーなので、応じてもらいやすい。'}</p>`}
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
  const nc = ntCard(); if (nc) out.push(nc);
  out.push(campCard());
  const offers = S.inbox.filter(x => x.type === 'offer' && !x.done);
  if (offers.length) { out.push(`<h3 class="sec-h">移籍オファー<small>${offers.length}件</small></h3>`); offers.forEach(o => { out.push(offerCard(o)); o.seen = true; }); }
  if (S.lastResult) {
    const f = S.fixtures.find(x => x.id === S.lastResult.fid);
    if (f && f.played) out.push(`<button class="card" data-act="fxDetail" data-id="${f.id}" style="text-align:left;display:grid;gap:4px"><div class="eyebrow">前の試合の結果</div><div class="row"><span class="res res-${S.lastResult.res}">${{ W: '勝', D: '分', L: '敗' }[S.lastResult.res]}</span><b>${esc(S.clubs[f.h].short)} ${f.hg} - ${f.ag} ${esc(S.clubs[f.a].short)}${pkText(f)}</b><span class="spacer"></span><span class="small muted">${E.fxLabel(f)}</span></div></button>`);
  }
  out.push(sponCard('home'));
  // board + mini table
  const c = S.clubs[S.my];
  const t = E.table(S); const me = t.findIndex(r => r.id === S.my);
  const lo = Math.max(0, Math.min(me - 2, t.length - 5)); const mini = t.slice(lo, lo + 5);
  out.push(`<section class="card" style="display:grid;gap:10px">
    <div class="row"><div class="eyebrow">フロントの信頼</div><span class="spacer"></span><b class="tnum">${S.board}</b></div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.board}"><i style="left:${S.board}%"></i></div>
    <div class="small muted">目標：${esc(c.target.jp)}　／　開幕前予想 ${c.pred}位</div>
    ${boardAlert()}
  </section>`);
  out.push(`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th style="text-align:left">クラブ</th><th>試</th><th>差</th><th>勝点</th></tr></thead><tbody>${mini.map(r => { const i = t.indexOf(r) + 1; return `<tr class="${r.id === S.my ? 'me' : ''}" data-act="team" data-id="${r.id}" tabindex="0" role="button" aria-label="${esc(S.clubs[r.id].name)}の情報"><td>${r.p ? i : '—'}</td><td class="club"><div>${kit(r.id, 'sm')}${esc(S.clubs[r.id].short)}</div></td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`; }).join('')}</tbody></table></div>`);
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
    if (p.keep) chips.push('<span class="chip ok">放出不可</span>');
  }
  const sp = subPos(p); if (sp.length) chips.push(`<span class="chip">+${sp.slice(0, 3).join('/')}</span>`);
  if (p.inj > 0) chips.push(`<span class="chip warn">負傷 ${p.inj}日</span>`);
  if (p.away) chips.push(`<span class="chip ntchip">${esc(E.ntName(p.away.cc))}（〜${jd(p.away.to)}）</span>`);
  else if (E.recentNt(p, S.date)) chips.push(`<span class="chip ntchip lite">${esc(E.ntName(p.nt.cc))}</span>`);
  chips.push(susChip(p));
  if (p.hot) chips.push('<span class="chip fire">燃えている</span>');
  if (p.reborn) chips.push('<span class="chip rbchip">転生</span>');
  if (ctx === 'market' && E.shortEntry(S, p.id)) chips.push(`<span class="chip acc">${E.negoOf(S, p.id) ? '交渉中' : '入札済み'}</span>`);
  const lead = ctx === 'market' ? (S.clubs[p.club] ? kit(p.club) : '<span class="chip">FA</span>') : `<span class="no">${p.num}</span>`;
  const abc = ctx === 'market' && E.abroadOf(S, p);
  const sub = ctx === 'market' ? `${S.clubs[p.club] ? esc(S.clubs[p.club].short) : 'フリー'}・${a}歳・${E.money(E.price(S, p))}${abc ? ` <span class="chip abchip">${esc(abc.lg)}</span>` : ''}` : `${a}歳`;
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
// can he play his club's next match? (a ban only counts in the competition it was given in: league, 天皇杯, Lカップ)
const avail = p => E.available(p, E.nextComp(S, p.club));
// every ban he has, e.g. 出場停止（リーグ） / 出場停止（リーグ・天皇杯）
const susChip = p => { const l = E.susList(p); return l.length ? `<span class="chip warn">出場停止（${[...new Set(l.map(([k]) => E.COMP_JP[k]))].join('・')}）</span>` : ''; };
// fit for the next match but banned in another competition, e.g. リーグは出場停止 before a cup tie
const susElse = p => E.susList(p, E.nextComp(S, p.club)).map(([k]) => `<span class="chip">${E.COMP_JP[k]}は出場停止</span>`).join('');
// why a player can't play his club's next match, e.g. 出場停止（リーグであと1試合） / 負傷（あと5日）; a straight red waits for the committee
const outText = p => { if (p.inj > 0) return `負傷（あと${p.inj}日）`; if (p.away) return `${E.ntName(p.away.cc)}に参加中（〜${jd(p.away.to)}）`; const k = E.nextComp(S, p.club); return `出場停止（${E.COMP_JP[k]}であと${E.susIn(p, k)}試合${E.banPending(p) ? '・試合数は規律委員会で検討中' : ''}）`; };
const outShort = p => p.inj > 0 ? '負傷' : p.away ? '代表' : '出場停止';
function issueLines(iss) {
  const c = S.clubs[S.my]; const F = E.FORMATIONS[c.tac.form];
  const emp = iss.xi.filter(x => !x.pid).map(x => E.ROLE[F[x.i][0]].jp);
  const lines = iss.xi.filter(x => x.pid).map(x => `${E.ROLE[F[x.i][0]].jp}：${S.players[x.pid].name}が${outText(S.players[x.pid])}`);
  // several empty places (e.g. tactics saved at another club) make one line
  if (emp.length === 1) lines.unshift(`${emp[0]}が空いています`);
  else if (emp.length > 1) lines.unshift(`先発の${emp.length}枠が空いています（${emp.join('・')}）`);
  return lines.concat(iss.bench.map(x => `ベンチ：${S.players[x.pid].name}が${outText(S.players[x.pid])}`));
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
const TEAM_TRAIN_DESC = { bal: '成長と回復のバランス型。', hard: '全員がよく伸びる代わりに疲れが抜けにくい。', tact: '連携が深まり試合で中盤がやや有利に。成長は控えめ。', rest: '疲労回復を最優先。成長はゆっくり。', youth: '23歳以下の成長が約1.4倍。それ以外の選手は少し伸びにくくなる。' };
// whole-number change; with soft=true a small move that doesn't change the shown number reads as 微増/微減
function dlt(x, soft) {
  const v = Math.round(x);
  if (!v) { if (soft && x >= 0.15) return '<span class="dlt up">微増</span>'; if (soft && x <= -0.15) return '<span class="dlt dn">微減</span>'; return '<span class="dlt">±0</span>'; }
  return `<span class="dlt ${v > 0 ? 'up' : 'dn'}">${v > 0 ? '+' : ''}${v}</span>`;
}
const shownDiff = (now, then) => Math.round(now) - Math.round(then);
function attrRows(p, withDelta) {
  const at = p.at || E.attrs(p); const idx = E.ATTR_SHOW[p.pos];
  return `<div style="display:grid;gap:7px">${idx.map(i => { const v = Math.round(at[i]); const d = withDelta && p.at0 ? shownDiff(at[i], p.at0[i]) : 0; return `<div class="attr"><span>${E.ATTR[i]}</span><span class="bar"><i class="${v >= 70 ? '' : v >= 55 ? 'mid' : 'low'}" style="width:${Math.min(100, v)}%"></i></span><b>${v}</b>${withDelta ? dlt(d) : ''}</div>`; }).join('')}</div>`;
}
function rolesLine(p) { return E.bestRoles(p, 3).map(r => `<span class="chip">${r.jp} <b style="color:var(--ink)">${Math.round(r.v)}</b></span>`).join(''); }
function devRow(p) {
  const a = E.age(p, S.date); const F = E.FOCUS[p.tf || 'auto']; const I = E.INTENS[p.ti || 'norm'];
  const chips = [`${a}歳`, `<span class="chip ${p.tf && p.tf !== 'auto' ? 'acc' : ''}">${F.jp}</span>`];
  if (p.ti && p.ti !== 'norm') chips.push(`<span class="chip ${p.ti === 'hard' ? 'warn' : ''}">${I.jp}</span>`);
  if (p.learn) chips.push(`<span class="chip ok">${p.learn.pos}習得中 ${Math.floor(E.apt(p, p.learn.pos))}</span>`);
  if (bloomed(p)) chips.push('<span class="chip ok">開花</span>');
  if (p.gem && a <= 19) chips.push('<span class="chip acc">逸材</span>');
  if (p.reborn) chips.push('<span class="chip rbchip">転生</span>');
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
    <ul class="list">${list.map(devRow).join('') || '<li class="empty">該当する選手がいません</li>'}</ul>
    ${loanSection()}`;
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
    ${loanSection()}
    ${sub}`;
}
// フロントの厳しさ (how patient the board is)
function boardLvCtl() {
  const cur = E.BOARD_LV[S.settings.boardLv] ? S.settings.boardLv : 'mid';
  return `<div class="ctlrow"><label>フロントの厳しさ</label><div class="seg">${Object.entries(E.BOARD_LV).map(([k, b]) => `<button data-act="boardLv" data-k="${k}" aria-pressed="${cur === k}">${b.jp}</button>`).join('')}</div><span class="fine">${E.BOARD_LV[cur].sub}</span></div>`;
}
function boardAlert() {
  const B = E.boardLv(S);
  if (S.fired || S.board > B.warn[0]) return '';
  return `<div class="small" style="color:var(--loss);font-weight:700">${S.board <= B.warn[1] ? '解任の危機。ここから巻き返さないと解任されるおそれがあります。' : 'フロントが成績を不安視しています。'}</div>`;
}
// 交代の頻度 (only while 交代はおまかせ is on)
function subRateCtl() {
  if (!S.settings.autoSubs) return '';
  const cur = E.SUB_RATE[S.settings.subRate] ? S.settings.subRate : 'mid';
  return `<div class="ctlrow"><label>交代の頻度</label><div class="seg">${['low', 'mid', 'high'].map(k => `<button data-act="subRate" data-k="${k}" aria-pressed="${cur === k}">${E.SUB_RATE[k].jp}</button>`).join('')}</div><span class="fine">${E.SUB_RATE[cur].sub}</span></div>`;
}
// 逃げ切りはおまかせ (S.settings.closeOut): on the tactics sheet, and during a match with what it is doing now
function closeOutToggle(sd) {
  const stopped = !!(sd && S.settings.closeOut && sd.closeOff);  // the manager changed the plan himself during this match
  const on = !!S.settings.closeOut && !stopped;
  const sub = stopped ? '作戦を自分で変えたので、この試合はおまかせを止めています。オンにすると再開します。'
    : on && sd && sd.close ? 'いま逃げ切り中（守備的・ライン低い・時間を使う）。追いつかれたら元の作戦に戻します。'
    : `${E.CLOSE.from}分以降にリードしたら、守備的・ライン低い・時間を使うに切り替えます。追いつかれたら元の作戦に戻します。`;
  return `<button class="toggle" role="switch" aria-checked="${on}" data-act="closeOut"${stopped ? ' data-re="1"' : ''}><span><b>逃げ切りはおまかせ</b><br><span class="small muted">${sub}</span></span><span class="sw"></span></button>`;
}
function sheetPlayer(id, back) {
  const p = S.players[id]; if (!p) return;
  sheetState = { type: 'player', id, back: back || null };
  const mine = p.club === S.my; const club = S.clubs[p.club];
  const lent = !!(p.loan && p.loan.from === S.my);  // out on loan from my club
  const a = E.age(p, S.date); const v = E.value(p, S.date); const abc = E.abroadOf(S, p);
  const avgR = p.st.apps ? (p.st.rt / p.st.apps).toFixed(2) : '—';
  const status = [];
  if (p.inj > 0) status.push(`<span class="chip warn">負傷中（あと${p.inj}日）</span>`);
  if (p.away) status.push(`<span class="chip ntchip">${esc(E.ntName(p.away.cc))}に参加中（〜${jd(p.away.to)}）</span>`);
  { const l = E.susList(p); if (l.length) status.push(`<span class="chip warn" style="white-space:normal">出場停止（${l.map(([k, n]) => `${E.COMP_JP[k]} あと${n}試合`).join('・')}${E.banPending(p) ? '・規律委員会で検討中' : ''}）</span>`); }
  if (p.listed) status.push('<span class="chip acc">放出リスト登録中</span>');
  if (p.keep && mine) status.push('<span class="chip ok">放出不可（オファーはすべて断る）</span>');
  if (p.retire) status.push('<span class="chip">今季限りで引退</span>');
  if (lent) status.push('<span class="chip acc">期限付き移籍中（シーズン終了まで）</span>');
  if (p.gem && a <= 19) status.push('<span class="chip acc">ユースの逸材</span>');
  const leg = p.reborn && E.legendOf(p.reborn);
  if (leg) status.push(`<span class="chip rbchip">転生</span>`);
  if ((mine || lent) && bloomed(p)) status.push(`<span class="chip ok">開花（伸びしろ ${Math.round(p.pot0)}→${Math.round(p.pot)}）</span>`);
  if (p.hot) status.push(`<span class="chip fire">燃えている（${esc(p.hot.why)}）</span>`);
  if (E.bigGame(p)) status.push('<span class="chip">大舞台に強い</span>');
  if (p.found && p.club === 'FA') status.push('<span class="chip acc">スカウト推薦</span>');
  if (E.abroadOf(S, p)) status.push(`<span class="chip abchip">海外組・${esc(COUNTRY[E.abroadOf(S, p).cc] || E.abroadOf(S, p).cc)}</span>`);
  if (mine && p.abFrom) status.push(`<span class="chip abchip">${esc(p.abFrom.name)}から加入（${esc(p.abFrom.s)}）</span>`);
  const se = !mine && E.shortEntry(S, p.id);
  if (se) status.push('<span class="chip acc">ショートリスト</span>');
  const hist = p.hist && p.hist.length ? `<div><div class="eyebrow" style="margin-bottom:6px">過去の成績</div><ul class="list">${p.hist.map(h => `<li><div class="row" style="padding:9px 12px;font-size:13px"><b>${h.s}</b><span class="muted">${esc(S.clubs[h.c] ? S.clubs[h.c].short : '')}</span><span class="spacer"></span><span class="tnum">${h.apps}試合 ${h.g}得点 ${h.a}A</span></div></li>`).join('')}</ul></div>` : '';
  let foot;
  if (lent) {
    foot = `<div class="small muted">シーズンが終わると${esc(S.clubs[S.my].short)}に戻ってきます。</div><button class="btn ghost block" data-act="closeSheet">閉じる</button>`;
  } else if (mine) {
    foot = `<button class="btn primary block" data-act="train" data-id="${p.id}">トレーニングを設定</button>${p.retire
      ? '<div class="grid2"><button class="btn ghost" disabled>引退が決まっています</button><button class="btn ghost" data-act="closeSheet">閉じる</button></div>'
      : `<div class="grid2"><button class="btn ghost" data-act="toggleList" data-id="${p.id}">${p.listed ? '放出リストから外す' : '放出リストに載せる'}</button><button class="btn ghost" data-act="toggleKeep" data-id="${p.id}">${p.keep ? '放出不可を解除' : '放出不可にする'}</button></div><button class="btn ghost block" data-act="closeSheet">閉じる</button>`}`;
  } else if (p.club === 'FA') {
    const sign = Math.round(E.wage(p) * 0.5 / 10) * 10;
    foot = `${se ? `<div class="small muted">${shortStatus(se, p)}</div>` : ''}<button class="btn primary block" data-act="sign" data-id="${p.id}">契約する（契約金 ${E.money(sign)}）</button>${shortFoot(se, p)}`;
  } else {
    const open = E.inWindow(S.date);
    const blk = E.bidBlock(S, p.id);
    const ng = open && E.negoOf(S, p.id);
    const last = se ? `<div class="small muted">${shortStatus(se, p)}</div>` : '';
    foot = !open ? `${last}<div class="small muted">移籍期間外です。次の移籍期間は ${jd(E.nextWindowStart(S.date))} から。</div>${shortFoot(se, p)}`
      : blk && blk.why === 'player' ? `${last}${shortFoot(se, p)}`
      : `${last}<div class="small muted">移籍金の交渉（${club ? esc(club.short) : ''}・〜${jd(E.windowEnd(S.date))}）${abc ? '<br>海外クラブは移籍金が高く、本人がJリーグ復帰に前向きとは限りません' : ''}</div><button class="btn primary block" data-act="nego" data-id="${p.id}">${ng ? `交渉を続ける（要求額 ${E.money(ng.ask)}）` : '交渉する'}</button>${shortFoot(se, p)}`;
  }
  if (back && back.type === 'team' && S.clubs[back.id]) foot = `<button class="btn ghost block" data-act="playerBack">← ${esc(S.clubs[back.id].short)}の情報に戻る</button>` + foot;
  const numTag = mine && !p.retire ? `<button class="numbtn" data-act="numSheet" data-id="${p.id}" aria-label="背番号${p.num}を変更"><b>${p.num}</b><span>変更</span></button>` : '';
  openSheet(`<div class="row">${posTag(p)}${numTag}<span class="small muted">${numTag ? '' : `#${p.num}・`}${club ? esc(club.name) : 'フリー'}${abc ? `（${esc(abc.lg)}）` : ''}${lent ? `（${esc(S.clubs[S.my].short)}から期限付き移籍）` : ''}・${a}歳 ${natChip(p)}</span></div>
    <h2>${esc(p.name)}</h2>
    ${status.length ? `<div class="row wrap">${status.join('')}</div>` : ''}
    <div class="bigovr"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span><dl class="kv" style="flex:1"><dt>伸びしろ</dt><dd><span class="stars">${potStars(p)}</span>${mine || lent ? `（最大 ${Math.round(p.pot)}）` : p.found ? `（見立て ${Math.round(p.pot) - 3}〜${Math.round(p.pot) + 3}）` : ''}</dd><dt>市場価値</dt><dd>${E.money(v)}</dd>${abc ? `<dt>移籍金の相場</dt><dd>${E.money(E.price(S, p))}</dd>` : ''}<dt>年俸</dt><dd>${E.money(E.wage(p))}</dd></dl></div>
    ${leg ? `<div class="rb-line"><span class="chip rbchip">転生</span><span>「${esc(leg.epi)}」の魂を継ぐ。${leg.num ? `かつての背番号${leg.num}` : 'クラブのレジェンド'}（${esc(leg.era)}）。${esc(leg.line)}</span></div>` : ''}
    ${attrRows(p, mine || lent)}
    ${mine || lent ? growthBlock(p, lent) : ''}
    ${linkBlock(p)}
    <div><div class="eyebrow" style="margin-bottom:6px">ポジション</div><div class="small" style="margin-bottom:8px">本職 <b>${dpOf(p)}</b>（${E.DP_JP[dpOf(p)]}）${p.learn ? `・<span class="muted">${p.learn.pos}を習得中</span>` : ''}</div>${p.pos === 'GK' ? '' : aptGrid(p, false)}
      <div class="row wrap" style="margin-top:8px"><span class="small muted">実力の目安</span>${rolesLine(p)}</div></div>
    <div><div class="eyebrow" style="margin-bottom:6px">今季の成績</div><div class="statgrid"><div><small>出場</small><b>${p.st.apps}</b></div><div><small>得点</small><b>${p.st.g}</b></div><div><small>アシスト</small><b>${p.st.a}</b></div><div><small>平均評価</small><b>${avgR}</b></div><div><small>警告</small><b>${p.st.yc}</b></div></div>${lent ? '<div class="small muted" style="margin-top:6px">J2での成績はシーズン終了時にまとめて記録されます。</div>' : ''}${p.cs && p.cs.apps ? `<div class="small muted" style="margin-top:6px">カップ戦 ${p.cs.apps}試合 ${p.cs.g}得点 ${p.cs.a}アシスト</div>` : ''}</div>
    ${ntBlock(p)}
    ${mine ? `<div class="row small muted">コンディション ${Math.round(p.cond)}%<span class="spacer"></span><span style="display:block;width:120px">${condBar(p.cond)}</span></div>` : ''}
    ${hist}`, foot);
}

const pct = x => Math.round(x * 100);
const bloomed = p => p.pot0 != null && Math.round(p.pot) > Math.round(p.pot0);
// share of the minutes so far; before the club's 3rd game, a guess from the lineup (est)
function paceOf(p) {
  const sh = E.shareFor(S, p); if (sh != null) return { v: sh, est: false };
  const c = S.clubs[S.my]; return { v: c.tac.xi.includes(p.id) ? 0.85 : c.tac.bench.includes(p.id) ? 0.2 : 0.03, est: true };
}
const yearsText = y => y == null ? '5年以上' : y <= 0.5 ? '約半年' : `約${y}年`;
// monthly growth chart (p.trk + this month): overall (solid), ceiling (dashed), 主力級 line (dotted)
function growthChart(p, target) {
  const m = S.date.slice(0, 7), pts = (p.trk || []).slice(), now = [m, p.ovr, p.pot];
  if (pts.length && pts[pts.length - 1][0] === m) pts[pts.length - 1] = now; else pts.push(now);
  if (pts.length < 2) return '';
  const W = 300, H = 116, L = 4, RW = 54, T = 9, B = 20;
  const vals = pts.flatMap(x => [x[1], x[2]]).concat(target ? [target] : []);
  let lo = Math.floor(Math.min(...vals) - 2), hi = Math.ceil(Math.max(...vals) + 2);
  if (hi - lo < 12) { lo = Math.floor((hi + lo) / 2 - 6); hi = lo + 12; }
  const X = i => L + i * (W - L - RW) / (pts.length - 1), Y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  const path = k => pts.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x[k]).toFixed(1)}`).join('');
  const oneYear = pts[0][0].slice(0, 4) === m.slice(0, 4);
  const mlab = s => { const [y, mm] = s.split('-').map(Number); return oneYear ? `${mm}月` : `${String(y).slice(2)}年${mm}月`; };
  const xe = X(pts.length - 1), last = pts[pts.length - 1];
  // right-hand labels, pushed apart so they never overlap
  const labs = [{ y: Y(last[1]), t: Math.round(last[1]), c: 'gc-v' }, { y: Y(last[2]), t: `最大${Math.round(last[2])}`, c: 'gc-pl' }];
  if (target) labs.push({ y: Y(target), t: `主力級${target}`, c: 'gc-tl' });
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 12);
  const over = labs[labs.length - 1].y - (H - B); if (over > 0) labs.forEach(l => { l.y -= over; });
  return `<svg class="gchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="総合力の推移 ${Math.round(pts[0][1])}から${Math.round(last[1])}">
    <line class="gc-ax" x1="${L}" x2="${xe}" y1="${H - B + 2}" y2="${H - B + 2}"/>
    ${target ? `<line class="gc-tg" x1="${L}" x2="${xe}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}"/>` : ''}
    <path class="gc-pot" d="${path(2)}"/><path class="gc-ovr" d="${path(1)}"/>
    <circle class="gc-dot" cx="${xe.toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3.6"/>
    ${labs.map(l => `<text class="${l.c}" x="${(xe + 7).toFixed(1)}" y="${(l.y + 4).toFixed(1)}">${l.t}</text>`).join('')}
    <text class="gc-x" x="${L}" y="${H - 5}">${mlab(pts[0][0])}</text><text class="gc-x" x="${xe.toFixed(1)}" y="${H - 5}" text-anchor="end">${mlab(m)}</text>
  </svg>`;
}
// 成長の記録: chart, how long until he is a regular, and (young players) the loan option
function growthBlock(p, lent) {
  const a = E.age(p, S.date), young = a <= E.LOAN.maxAge;
  const target = Math.round(E.strength(S, S.my));
  let eta = '';
  if (young && p.ovr >= target) eta = `<p class="small" style="margin:0">すでに主力級です（チームの上位14人の平均 ${target}）。</p>`;
  else if (young) {
    const pc = paceOf(p), cur = pc.v;
    const yC = E.yearsTo(S, p, cur, target), yR = cur < 0.8 ? E.yearsTo(S, p, 0.85, target) : null;
    eta = `<p class="small" style="margin:0">主力級（${target}）まで：${lent ? 'レンタル先' : '今'}の出場ペース（${pc.est ? '見込み ' : ''}${pct(cur)}%）なら<b>${yearsText(yC)}</b>${cur < 0.8 ? `・主力で使えば<b>${yearsText(yR)}</b>` : ''}</p>`;
  }
  const loanBtn = young && !lent && !p.retire ? `<button class="btn ghost block" data-act="loanSheet" data-id="${p.id}">期限付き移籍（J2）を検討する</button>` : '';
  const legend = `<div class="gc-leg small muted"><span><i class="l-ovr"></i>総合力</span><span><i class="l-pot"></i>伸びしろ</span><span><i class="l-tg"></i>主力級</span></div>`;
  const chart = growthChart(p, target);
  return `<div style="display:grid;gap:8px"><div class="eyebrow">成長の記録</div>${chart ? chart + legend : '<p class="fine" style="margin:0">成長の記録は毎月1日に付けています。来月からグラフになります。</p>'}${eta}
    ${young ? '<p class="fine" style="margin:0">23歳以下は試合に出るほど伸び、よく出てよく活躍すると伸びしろそのものが広がります（開花）。</p>' : ''}${loanBtn}</div>`;
}
// 背番号の変更: a board of 1〜99 with who wears each number. Open in the off-season and the winter window only.
function sheetNum(id, sel) {
  const p = S.players[id]; if (!p || p.club !== S.my) return;
  sheetState = { type: 'num', id, sel: sel || null };
  const open = E.numOpen(S);
  const who = {}; for (const q of E.squad(S, S.my)) who[q.num] = q;
  const leg = p.reborn && E.legendOf(p.reborn);
  const cell = n => {
    const q = who[n]; const own = q && q.id === p.id;
    const cls = `numcell${own ? ' own' : q ? ' taken' : ''}${leg && leg.num === n ? ' legend' : ''}`;
    return `<button class="${cls}" data-act="numPick" data-id="${p.id}" data-n="${n}" aria-pressed="${sel === n}" ${!open || own ? 'disabled' : ''} aria-label="${n}番${q ? `（${esc(q.name)}）` : '（空き）'}"><b>${n}</b><small>${q ? esc(q.short) : ''}</small></button>`;
  };
  const tgt = sel && who[sel];
  openSheet(`<div class="row">${posTag(p)}<span class="small muted">${esc(p.name)}・${E.age(p, S.date)}歳</span></div>
    <h2>背番号の変更</h2>
    <div class="numnow"><span class="numnow-mag${uniPat(S.my)}" style="${uniVars(S.my)}">${p.num}</span>${sel ? `<span class="numnow-arrow" aria-hidden="true">→</span><span class="numnow-mag new" style="--k1:${S.clubs[S.my].c1};--k2:${S.clubs[S.my].c2};--kt:${lum(S.clubs[S.my].c1) > 0.6 ? '#141414' : '#ffffff'}">${sel}</span>` : ''}
      <span class="small" style="flex:1;min-width:0">${!open ? `今は変更できません。${E.numNext(S)}変更できます。` : sel ? (tgt ? `${esc(tgt.name)}の${sel}番と入れ替えます（${esc(tgt.short)}は${p.num}番へ）。` : `空いている${sel}番に変えます。`) : '新しい番号をタップしてください。'}</span></div>
    <p class="fine" style="margin:0">変更できるのはオフシーズン（シーズン総括〜開幕前）と冬の移籍期間（12/20〜2/26）です。ほかの選手が着けている番号を選ぶと、その選手と番号を入れ替えます。${leg && leg.num ? `金色の${leg.num}は「${esc(leg.epi)}」の番号です。` : ''}</p>
    <div class="numgrid${open ? '' : ' closed'}">${Array.from({ length: E.NUM_MAX }, (_, i) => cell(i + 1)).join('')}</div>`,
    `${sel && open ? `<button class="btn primary block" data-act="numSet" data-id="${p.id}" data-n="${sel}">背番号${sel}にする</button>` : ''}<button class="btn ghost block" data-act="player" data-id="${p.id}">戻る</button>`);
}
// 期限付き移籍: three J2 clubs with how much he would play and where he would be at the end of the season
function sheetLoan(id) {
  const p = S.players[id]; if (!p || p.club !== S.my) return;
  sheetState = { type: 'loan', id };
  const can = E.loanCan(S, p), wk = E.weeksLeft(S);
  const pc = paceOf(p), cur = pc.v;
  const stay = E.growthOutlook(S, p, cur, wk), reg = E.growthOutlook(S, p, 0.85, wk);
  const potTxt = g => Math.round(g.pot) > Math.round(p.pot) ? `<div class="small" style="color:var(--win)">伸びしろ ${Math.round(p.pot)}→${Math.round(g.pot)}</div>` : '';
  const opt = o => {
    const c = S.clubs[o.cid], g = E.growthOutlook(S, p, o.share, wk, o.cid);
    return `<li><div class="row" style="padding:12px;gap:10px;align-items:center">${kit(o.cid)}<div style="flex:1;min-width:0"><b>${esc(c.name)}</b><div class="small muted">J2・出場機会 約${pct(o.share)}%</div></div>
      <div style="text-align:right;white-space:nowrap"><span class="small muted">シーズン終了時</span><br><span class="ovr ${oc(g.ovr)}">${Math.round(g.ovr)}</span>${dlt(g.ovr - p.ovr, true)}${potTxt(g)}</div></div>
      <div style="padding:0 12px 12px"><button class="btn ${o === best ? 'primary' : ''} block" data-act="loanGo" data-id="${p.id}" data-k="${o.cid}" ${can.ok ? '' : 'disabled'}>${esc(c.short)}へ出す</button></div></li>`;
  };
  const opts = E.loanOptions(S, p.id); const best = opts[0];
  openSheet(`<div class="row">${posTag(p)}<span class="small muted">#${p.num}・${E.age(p, S.date)}歳・総合力 ${E.ovr(p)}（最大 ${Math.round(p.pot)}）</span></div>
    <h2>期限付き移籍（J2）</h2>
    <p class="small" style="margin:0">${esc(p.name)}をシーズン終了まで（あと約${wk}週）J2のクラブへ貸し出します。期間中はこちらの試合には出られず、年俸は貸し出し先が負担します。</p>
    <dl class="kv"><dt>残った場合</dt><dd>出場機会 ${pc.est ? '見込み ' : ''}${pct(cur)}% → シーズン終了時 <b>${Math.round(stay.ovr)}</b>${dlt(stay.ovr - p.ovr, true)}</dd><dt>主力で使った場合</dt><dd>出場機会 85% → <b>${Math.round(reg.ovr)}</b>${dlt(reg.ovr - p.ovr, true)}</dd></dl>
    ${can.ok ? '' : `<p class="small" style="margin:0;color:var(--loss)">${esc(can.msg)}</p>`}
    <ul class="list">${opts.map(opt).join('') || '<li class="empty">貸し出し先が見つかりません</li>'}</ul>
    <p class="fine" style="margin:0">出場機会は選手の実力と貸し出し先の層の厚さで決まります。期限付き移籍に出せるのは${E.LOAN.maxAge}歳以下、同時に${E.LOAN.max}人まで（いま${E.myLoans(S).length}人）。</p>`,
    `<div class="grid2"><button class="btn ghost" data-act="player" data-id="${p.id}">戻る</button><button class="btn ghost" data-act="closeSheet">閉じる</button></div>`);
}
function loanRow(p) {
  const L = p.loan, c = S.clubs[L.to];
  return `<li><button class="prow" data-act="player" data-id="${p.id}">${kit(L.to)}${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${c ? esc(c.short) : 'J2'}・${E.age(p, S.date)}歳・出場機会 約${pct(L.share)}%${bloomed(p) ? '<span class="chip ok">開花</span>' : ''}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${dlt(shownDiff(p.ovr, L.ovr0))}</span></button></li>`;
}
function loanSection() {
  const ls = E.myLoans(S); if (!ls.length) return '';
  return `<h3 class="sec-h">期限付き移籍中<small>${ls.length}人・シーズン終了まで</small></h3><ul class="list">${ls.sort((a, b) => b.ovr - a.ovr).map(loanRow).join('')}</ul>`;
}
// 若手の成長レポート (monthly): 23 and under + players out on loan, change since last month
/* 代表 (2026-10-14): from the day the squads are named until everyone is back — my players (nation, 初選出, 活躍枠, where
   they are), Japan's matches (an Asian Cup: the ones played and the next) and who from J1 is in the Japan squad */
const ym = d => d ? `${E.D.y(d)}年${E.D.m(d)}月` : '';
function ntCard() {
  const now = E.ntNow(S); if (!now || !now.cur) return '';
  const C = now.ev, log = (S.nt && S.nt.log) || [];
  for (const it of S.inbox) if (it.type === 'nt' && it.k === C.k) it.seen = true;
  const ac = C.kind === 'ac';
  const mine = [];
  for (const [cc, ids] of Object.entries(C.sq)) for (const id of ids) { const p = S.players[id]; if (p && p.club === S.my) mine.push({ p, cc }); }
  const stat = ({ p }) => {
    const a = C.ap[p.id], done = a && a.n ? `${a.n}試合${a.g ? `${a.g}得点` : '出場'}` : '';
    if (p.away) return `${done ? done + '・' : ''}〜${jd(p.away.to)}`;
    return C.dep ? `${done || '出場なし'}・帰国` : `${jd(C.from)}合流`;
  };
  const rows = mine.map(x => {
    const L = log.find(l => l.k === C.k && l.pid === x.p.id);
    return `<li><button class="ntrow" data-act="player" data-id="${x.p.id}">${posTag(x.p)}<span class="nm"><b>${esc(x.p.name)}</b><span class="chips"><span class="chip ntchip">${esc(E.ntName(x.cc))}</span>${L && L.first ? '<span class="chip acc">初選出</span>' : ''}${C.kat.includes(x.p.id) ? '<span class="chip ok">活躍枠</span>' : ''}</span><span class="st">${stat(x)}</span></span></button></li>`;
  }).join('');
  const jg = C.games.filter(g => g.cc === 'JPN');
  const shown = ac ? jg.filter((g, i) => g.played || i === 0 || jg[i - 1].played) : jg;
  // scorers once each, 上田×2 for more than one
  const who = g => [...new Set(g.sc || [])].map(id => S.players[id]).filter(Boolean).map(p => { const n = g.sc.filter(x => x === p.id).length; return esc(p.short) + (S.order.includes(p.club) ? `（${esc(S.clubs[p.club].short)}）` : '') + (n > 1 ? `×${n}` : ''); }).join('・');
  const games = shown.map(g => `<li><div class="fx"><span class="h">日本</span><span class="sc ${g.played ? '' : 'pending'}">${g.played ? `${g.hg}-${g.ag}${g.pk ? `<small>PK${g.pk[0]}-${g.pk[1]}</small>` : ''}` : 'vs'}</span><span class="a">${esc(E.natJp(g.opp))}</span></div><div class="fx-note">${jdw(g.d)}・${g.stage ? esc(g.stage) : g.home > 0 ? '国内' : '国外'}${g.played && who(g) ? '・得点 ' + who(g) : ''}</div></li>`).join('');
  const j1 = C.sq.JPN.map(id => S.players[id]).filter(p => p && S.order.includes(p.club));
  // an Asian Cup: the tournament's own dates (the players join the camp a few days earlier, C.from)
  const st = ac ? `${C.ac.y}-01-07` : C.from;   // the Asian Cup opens on 1/7 (acSim plays from that day)
  const note = ac ? `冬の中断期間中の大会（代表は${jd(C.from)}に合流）。敗退すると選手は戻ってくる。戻った選手は疲れが残る。`
    : `${jd(C.from)}〜${jd(C.to)}はリーグ戦が中断。この間のカップ戦に代表の選手は出られない。戻った選手は疲れが残る。`;
  return `<section class="card" style="display:grid;gap:10px">
    <div class="row"><div class="eyebrow">${ac ? `アジアカップ${C.ac.y}` : '代表ウィーク'}</div><span class="spacer"></span><span class="small muted">${jd(st)}〜${jd(C.to)}</span></div>
    ${mine.length ? `<ul class="list">${rows}</ul>` : `<p class="small muted" style="margin:0">${esc(S.clubs[S.my].short)}から選ばれた選手はいない。</p>`}
    <div><div class="eyebrow" style="margin-bottom:6px">日本代表の試合</div><ul class="list">${games}</ul></div>
    <p class="fine" style="margin:0">日本代表 ${C.sq.JPN.length}人のうち、Jリーグから${j1.length}人：${j1.map(p => `${esc(p.short)}（${esc(S.clubs[p.club].short)}）${C.kat.includes(p.id) ? '※活躍枠' : ''}`).join('、') || 'なし'}。${note}</p>
  </section>`;
}
// a player's national-team record (player sheet)
function ntBlock(p) {
  const n = p.nt; if (!n || !n.calls) return '';
  return `<div><div class="eyebrow" style="margin-bottom:6px">代表</div><div class="row wrap"><span class="chip ntchip">${esc(E.ntName(n.cc))}</span><b class="tnum">${n.caps}試合 ${n.g}得点</b><span class="small muted">招集${n.calls}回・初選出 ${ym(n.first)}${n.ac ? `・アジアカップ優勝${n.ac > 1 ? n.ac + '回' : ''}` : ''}</span></div></div>`;
}
// records: my club's internationals (players called while at the club) and Japan's last matches
function ntRecords() {
  const N = S.nt || {}; const by = {};
  for (const l of (N.log || []).filter(l => l.club === S.my)) { const x = by[l.pid] || (by[l.pid] = { pid: l.pid, name: l.name, cc: l.cc, n: 0 }); x.n++; }
  const list = Object.values(by).sort((a, b) => b.n - a.n), res = (N.res || []).slice(0, 8);
  return `<h3 class="sec-h">代表</h3>${list.length ? `<ul class="list">${list.map(x => { const p = S.players[x.pid]; return `<li><div style="display:grid;gap:4px;padding:9px 12px"><div class="row"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</b><span class="spacer"></span><span class="chip ntchip">${esc(E.ntName(x.cc))}</span></div><span class="small muted tnum">招集${x.n}回${p && p.nt ? `・通算${p.nt.caps}試合${p.nt.g}得点` : ''}${p && p.club !== S.my ? '・移籍' : ''}</span></div></li>`; }).join('')}</ul>` : '<p class="empty">まだクラブから代表に選ばれた選手はいません。クラブで活躍すると、代表ウィークの前に選ばれることがあります。</p>'}
    ${res.length ? `<div class="eyebrow" style="margin:10px 0 6px">日本代表の最近の試合</div><ul class="list">${res.map(r => `<li><div class="fx"><span class="h">日本</span><span class="sc">${r.hg}-${r.ag}${r.pk ? `<small>PK${r.pk[0]}-${r.pk[1]}</small>` : ''}</span><span class="a">${esc(E.natJp(r.opp))}</span></div><div class="fx-note">${E.D.y(r.d)}/${jdw(r.d)}・${r.stage ? 'アジアカップ ' + esc(r.stage) : '国際親善試合'}</div></li>`).join('')}</ul>` : ''}`;
}
// 若手の成長レポート (the month's development of my young players and those out on loan): opened from the secretary's
// summary of the month (before 2026-10-15 a card on the home screen)
function youthItem() {
  const it = S.inbox.find(x => x.type === 'youth'); if (!it) return null;
  const rows = it.rows.filter(r => { const p = S.players[r.pid]; return p && (p.club === S.my || (p.loan && p.loan.from === S.my)); });
  return rows.length ? { it, rows } : null;
}
function sheetYouth(back) {
  const y = youthItem(); if (!y) return;
  sheetState = { type: 'youth', back };
  openSheet(`<div class="eyebrow">若手の成長レポート・${y.it.m}月</div><h2>先月からの変化</h2>
    <ul class="list">${y.rows.map(r => { const p = S.players[r.pid]; const bl = Math.round(r.pb) > Math.round(r.pa);
      const where = r.loan ? `${S.clubs[r.loan] ? esc(S.clubs[r.loan].short) : 'J2'}へレンタル中` : `出場機会 ${r.sh == null ? '—' : pct(r.sh) + '%'}`;
      return `<li><button class="prow" data-act="player" data-id="${p.id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, S.date)}歳・${where}${bl ? `<span class="chip ok">伸びしろ ${Math.round(r.pa)}→${Math.round(r.pb)}</span>` : ''}${p.gem ? '<span class="chip acc">逸材</span>' : ''}</span></span><span class="rt"><span class="ovr ${oc(r.b)}">${Math.round(r.b)}</span>${dlt(r.b - r.a, true)}</span></button></li>`; }).join('')}</ul>
    <p class="fine" style="margin:0">23歳以下と期限付き移籍中の選手の、先月からの変化です。試合に出ている選手ほど伸びます。</p>`,
    back === 'sec' ? '<button class="btn ghost block" data-act="secOpen">秘書の連絡に戻る</button>' : '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- 秘書 (2026-10-15): the secretary magnet above the dock, her sheet, and her lines in the pre-match sheet and on
   the tactics screen. Everything she says comes from secItems(): the players who can't play (E.secFix), the ones back
   (E.secReturns) and the notes (E.secNotes, drawn by SEC_VIEW[kind]; later work adds its own kinds there). She only
   changes the team when the manager taps 入れ替える / おすすめどおりに入れ替える / 戻す. */
const secNm = () => E.secName(S);
const secWho = () => `${E.SEC.role} ${secNm()}`;
let secUid = 0;
// the secretary's magnet: a portrait (navy suit, bob) drawn here, nobody in particular
function akiMag(cls, badge) {
  const u = 'ak' + (++secUid);
  return `<span class="aki ${cls || ''}" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><clipPath id="c${u}"><circle cx="50" cy="50" r="44"/></clipPath><radialGradient id="g${u}" cx="34%" cy="24%" r="58%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <circle cx="50" cy="50" r="48" fill="#1E2942"/><circle cx="50" cy="50" r="45.5" fill="#C9A752"/>
    <g clip-path="url(#c${u})"><rect width="100" height="100" fill="#EEE5D6"/>
      <path d="M26 47 C24 26 36 15 50 15 C64 15 76 26 74 47 L76 67 C71 72 63 71 59 66 L41 66 C37 71 29 72 24 67 Z" fill="#2A2232"/>
      <path d="M44 60 L56 60 L57.5 75 L42.5 75 Z" fill="#E9C3AB"/>
      <path d="M10 100 C13 84 26 76 41 73 L50 88 L59 73 C74 76 87 84 90 100 Z" fill="#1E2942"/>
      <path d="M41 73 L50 88 L59 73 L55.5 71.5 L50 81 L44.5 71.5 Z" fill="#FFFFFF"/>
      <path d="M41 73 L46 80 L44 82 L38 75 Z M59 73 L54 80 L56 82 L62 75 Z" fill="#2B3858"/>
      <ellipse cx="50" cy="45" rx="14.5" ry="17.5" fill="#F6DCC9"/>
      <path d="M33.5 43 C33 28 43 21 52 21.5 C62 22 68 30 66.8 41 C62 33 55 30.5 47 32.5 C41 34 37 38 33.5 43 Z" fill="#2A2232"/>
      <ellipse cx="44" cy="46.6" rx="1.9" ry="2.4" fill="#2A2232"/><ellipse cx="56" cy="46.6" rx="1.9" ry="2.4" fill="#2A2232"/>
      <path d="M40.6 44.6 Q44 42.4 47.2 44.2 M52.8 44.2 Q56 42.4 59.4 44.6" stroke="#2A2232" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <circle cx="41.5" cy="52" r="2.6" fill="#EE9C96" opacity=".5"/><circle cx="58.5" cy="52" r="2.6" fill="#EE9C96" opacity=".5"/>
      <path d="M46.6 55.4 Q50 57.8 53.4 55.4" stroke="#C4505A" stroke-width="1.9" fill="none" stroke-linecap="round"/>
    </g><circle cx="50" cy="50" r="44" fill="url(#g${u})"/></svg>${badge ? `<i class="aki-badge">${badge}</i>` : ''}</span>`;
}
const outWhy = { inj: 'ケガから', sus: '出場停止明けで', nt: '代表から' };
// notes: what the bubble says and what the sheet shows, by kind
const SEC_VIEW = {
  hello: {
    bubble: () => `はじめまして。${E.SEC.role}の${secNm()}です ›`,
    title: () => 'はじめまして',
    body: n => `<p class="small" style="margin:0">${n.data.old ? '今日から' : ''}${esc(S.clubs[S.my].short)}の${E.SEC.role}を担当する${esc(secNm())}です。試合に出られない選手が出たら代わりを用意して、その選手が戻ってきたらお知らせします。月のはじめには順位やお金のこともまとめますね。メンバーは、監督が「入れ替える」を押すまで変えません。</p>
      <p class="fine" style="margin:0">名前は上の「名前を変える」から変えられます（クラブ → 経営からも）。</p>`,
    done: 'わかりました',
  },
  month: {
    bubble: n => `${n.data.m}月になりました。今月のまとめです ›`,
    title: n => `${n.data.m}月のまとめ`,
    body: n => {
      const d = n.data; const f = d.big && S.fixtures.find(x => x.id === d.big.fid);
      const opp = f ? (f.h === S.my ? f.a : f.h) : null;
      const top = (d.top || []).map(t => S.players[t.pid] ? `${esc(S.players[t.pid].short)} ${t.a}→${t.b}` : '').filter(Boolean);
      const y = youthItem();
      return `<dl class="kv sec-kv"><dt>順位</dt><dd>${d.rank == null ? '開幕前' : d.rank === 1 ? '首位' : `${d.rank}位（首位 ${esc(S.clubs[d.lead] ? S.clubs[d.lead].short : '')}と勝点${d.gap}差）`}</dd>
        <dt>次の大一番</dt><dd>${f && S.clubs[opp] ? `${jdw(f.date)} ${esc(S.clubs[opp].short)}戦・${esc(d.big.tag)}${f.played ? '（終了）' : ''}` : 'この1か月はありません'}</dd>
        <dt>資金</dt><dd>${E.money(d.funds)}${d.delta == null ? '' : `（先月から ${d.delta >= 0 ? '+' : ''}${E.money(d.delta)}）`}</dd>
        <dt>若手</dt><dd>${top.length ? `${top.join('、')}${d.youth > top.length ? ` ほか${d.youth - top.length}人` : ''}が成長` : '先月から目立った変化はありません'}</dd>
        ${d.fans != null ? `<dt>サポーター</dt><dd>${ppl(d.fans)}人${d.fd ? `（先月から ${sgn(d.fd)}）` : ''}</dd>` : ''}
        ${d.job ? `<dt>工事</dt><dd>${htJobName(d.job)} ${d.job.to <= S.date ? `完成（${jd(d.job.to)}）` : `${d.job.pct}%（${jd(d.job.to)} 完成予定）`}</dd>` : ''}
        ${d.sp ? `<dt>スポンサー</dt><dd>${[d.sp.done ? `達成${d.sp.done}` : '', d.sp.n - d.sp.done - d.sp.fail ? `進行中${d.sp.n - d.sp.done - d.sp.fail}` : '', d.sp.fail ? `届かず${d.sp.fail}` : ''].filter(Boolean).join('・')}${d.sp.got ? `（ボーナス ${E.money(d.sp.got)}）` : ''}</dd>` : ''}</dl>
        ${y ? '<button class="btn ghost block" data-act="youthOpen" style="min-height:40px">若手の成長レポート</button>' : ''}`;
    },
  },
};
// スポンサー契約 (2026-10-15): the offers, her pick at kick-off, a condition met or missed
const spDeal = x => ({ k: x.k, n: x.n });
Object.assign(SEC_VIEW, {
  spon: {
    bubble: n => n.data.auto ? `スポンサーは、おすすめの${(S.spon && S.spon.deals || []).length}社と契約しました ›` : `今季のスポンサー候補が${E.sponPending(S) ? S.spon.offer.length : 5}社来ています ›`,
    title: n => n.data.auto ? 'スポンサーと契約しました' : 'スポンサー候補',
    body: n => {
      if (!n.data.auto) return E.sponPending(S) ? `<p class="small" style="margin:0">今季のスポンサー候補が${S.spon.offer.length}社来ています。ユニフォームの胸・背中・袖に3社まで選べます。選ばないまま開幕戦を迎えると、おすすめの3社と契約します。</p><button class="btn primary block" data-act="sponOpen" style="min-height:44px">スポンサーを選ぶ</button>` : '<p class="small" style="margin:0">今季のスポンサーは決まっています。</p>';
      const ds = (S.spon && S.spon.s === n.data.s ? S.spon.deals : []).slice().sort((a, b) => a.slot - b.slot);
      return `<p class="small" style="margin:0">開幕戦までに選ばれなかったので、達成しやすい3社と契約しておきました。</p><ul class="sp-res">${ds.map(d => `<li>${spTag(d.slot)}${spLogo(d, true)}<span class="t"><b>${esc(E.sponShort(d))}</b><small>${esc(d.co)}</small></span></li>`).join('')}</ul>`;
    },
    done: 'わかりました',
  },
  sponHit: {
    bubble: n => `${n.data.co}との約束を達成！ ボーナス${E.money(n.data.got)}が入りました ›`,
    title: () => 'スポンサーとの約束を達成',
    body: n => `<p class="small" style="margin:0">${esc(n.data.co)}との約束「${esc(E.sponShort(spDeal(n.data)))}」を達成しました。ボーナス <b>${E.money(n.data.got)}</b> が入りました。</p>`,
    done: 'わかりました',
  },
  sponMiss: {
    bubble: n => `${n.data.co}との約束「${E.sponShort(spDeal(n.data))}」には届きませんでした ›`,
    title: () => 'スポンサーとの約束',
    body: n => `<p class="small" style="margin:0">${esc(n.data.co)}との約束「${esc(E.sponShort(spDeal(n.data)))}」は、今季はもう届きません。保証の額はそのまま入ります。</p>`,
    done: 'わかりました',
  },
});
// ホームタウン (2026-10-15): a building done (she stops the days), and once for an old save the new screen
Object.assign(SEC_VIEW, {
  built: {
    bubble: n => n.data.k === 'exp' ? `スタジアムの増築が完成。${(n.data.cap || 0).toLocaleString('ja-JP')}席になりました ›` : `${E.TOWN.b[n.data.k].jp}が完成しました ›`,
    title: n => n.data.k === 'exp' ? `スタジアム増築 ${n.data.step}期が完成` : `${E.TOWN.b[n.data.k].jp}が完成`,
    body: n => { const k = n.data.k, B = E.TOWN.b[k];
      return `<div class="ht-done"><span class="ht-mag built lg">${htIc(k)}</span><div class="t"><b>${k === 'exp' ? `収容 ${(n.data.cap || 0).toLocaleString('ja-JP')}席` : esc(B.jp)}</b><small>維持費 月${E.money(B.up)}（来月から）</small></div></div>
        ${htChips(k)}<p class="small" style="margin:0">${k === 'exp' ? '席が増えたので、満員で入れなかったサポーターも入れます。' : ''}${B.fan ? `完成を聞いて、サポーターが${Math.round(B.fan * 100)}%増えました。` : ''}</p>
        <button class="btn primary block" data-act="htGo" style="min-height:44px">ホームタウンを見る</button>`; },
    done: 'わかりました',
  },
  town: {
    bubble: () => 'クラブに「ホームタウン」ができました ›',
    title: () => 'ホームタウン',
    body: n => { const d = n.data, mv = (d.moved || []).map(k => E.TOWN.b[k].jp);
      return `<p class="small" style="margin:0">クラブ → ホームタウンで、スタジアムの増築やクラブハウス・選手寮などを建てられるようになりました。いまのサポーターは${ppl(d.fans)}人です。</p>
        ${d.lv >= 3 && mv.length ? `<p class="small" style="margin:0">これまでのスタジアム設備（Lv${d.lv}）は、${mv.map(esc).join('・')}になりました。</p>` : ''}
        <p class="small" style="margin:0">建物と施設（始めのLvより上の分）には維持費がかかります。${d.up ? `来月から月${E.money(d.up)}です。` : 'いまはかかっていません。'}</p>
        <button class="btn primary block" data-act="htGo" style="min-height:44px">ホームタウンを見る</button>`; },
    done: 'わかりました',
  },
});
// キャンプ (2026-10-16): her question on 1/4 (it stops the days)
Object.assign(SEC_VIEW, {
  camp: {
    bubble: () => E.campPending(S) ? '夏のキャンプの行き先を決めましょう ›' : 'キャンプの行き先は決まっています ›',
    title: () => '夏のキャンプ',
    body: () => { const C = E.campOf(S);
      return E.campPending(S) ? `<p class="small" style="margin:0">${jdw(C.from)}〜${jdw(C.to)}の${E.CAMP.len}日間、開幕前の夏のキャンプに行きます。行き先を決めてください。決めないままだと${E.CAMP.d[E.CAMP.std].jp}（標準）にします。</p><button class="btn primary block" data-act="campOpen" style="min-height:44px">行き先を選ぶ</button>` : '<p class="small" style="margin:0">キャンプの行き先は決まっています。</p>'; },
    done: 'わかりました',
  },
});
const secView = n => SEC_VIEW[n.k] || { bubble: () => `${E.SEC.role}からのお知らせ ›`, title: () => 'お知らせ', body: x => `<p class="small" style="margin:0">${esc(x.data.text || '')}</p>`, done: 'わかりました' };
// what she has to say now, most pressing first
function secItems() {
  if (!S || S.fired || !S.clubs[S.my]) return { fix: null, back: [], notes: [], n: 0, unseen: [] };
  const fix = E.secFix(S); const back = E.secReturns(S); const notes = E.secNotes(S).filter(x => SEC_VIEW[x.k] || x.data.text);
  const unseen = notes.filter(x => !x.seen);
  return { fix: fix.items.length ? fix : null, back, notes, unseen, n: (fix.items.length ? fix.items.length : 0) + back.length + unseen.length };
}
const secOutN = fix => fix.items.filter(x => x.out).length;
function secFixLine(fix) {
  const n = secOutN(fix), e = fix.items.length - n;
  return n ? `次の試合に出られない選手が${n}人います。代わりを用意しました` : `先発の${e}枠が空いています。入る選手を用意しました`;
}
const pairs = fix => fix.items.slice(0, 4).map(it => `${it.out ? esc(S.players[it.out].short) : (E.ROLE[it.role] ? E.ROLE[it.role].jp : '') + 'の空き'}→${it.cand ? esc(S.players[it.cand].short) : 'なし'}`).join('、') + (fix.items.length > 4 ? ` ほか${fix.items.length - 4}人` : '');
const backLine = m => { const p = S.players[m.out]; return `${esc(p.short)}が${outWhy[m.why] || ''}戻りました。${m.k === 'xi' ? `${E.ROLE[m.role].jp}に` : 'ベンチに'}戻しますか？`; };
const backSub = m => { const q = S.players[m.sub]; return m.k === 'xi' ? `代わりに先発していた${esc(q.short)}は${S.clubs[S.my].tac.bench.includes(m.out) || (m.fill && S.clubs[S.my].tac.bench.includes(m.fill)) || S.clubs[S.my].tac.bench.length < E.BENCH_SIZE ? 'ベンチへ' : 'ベンチ外へ'}` : `代わりに入っていた${esc(q.short)}はベンチ外へ`; };
// home: her line as a band on top of the dock (the page scrolls under it like under the dock, nothing floats over it)
function secBand(si) {
  let say;
  if (si.fix) say = `<button class="sec-bub" data-act="secOpen"><b>${secFixLine(si.fix)} ›</b><small>${esc(secWho())}</small></button>`;
  else if (si.back.length) { const m = si.back[0]; say = `<div class="sec-bub"><button class="sec-bub-t" data-act="secOpen"><b>${backLine(m)}</b><small>${backSub(m)}</small></button><button class="btn primary sec-bub-do" data-act="secBack" data-id="${m.out}">戻す</button></div>`; }
  else { const n = si.unseen[0]; say = `<button class="sec-bub" data-act="${n && n.k === 'spon' && E.sponPending(S) ? 'sponOpen' : n && n.k === 'camp' && E.campPending(S) ? 'campOpen' : 'secOpen'}"><b>${n ? esc(secView(n).bubble(n)) : `${esc(secWho())}からの連絡 ›`}</b><small>${esc(secWho())}${si.unseen.length > 1 ? `・ほか${si.unseen.length - 1}件` : ''}</small></button>`; }
  return `<div class="sec-band" id="sec-float"><button class="sec-mag" data-act="secOpen" aria-label="${esc(secWho())}の連絡（${si.n}件）">${akiMag('md', si.n)}</button>${say}</div>`;
}
// other tabs: just the magnet and a count, put beside the switch bar by secPlace (the bar gets shorter, so the magnet
// covers nothing); a screen without a switch bar has it just above the dock
function secFloat(si) {
  return `<div class="sec-float" id="sec-float"><button class="sec-mag" data-act="secOpen" aria-label="${esc(secWho())}の連絡（${si.n}件）">${akiMag('md', si.n)}</button></div>`;
}
function secPlace() {
  const fl = document.getElementById('sec-float'); if (!fl || fl.classList.contains('sec-band')) return;
  const sn = document.querySelector('#view > .subnav');
  if (sn) { sn.classList.add('with-sec'); fl.classList.add('in-bar'); sn.appendChild(fl); return; }
  const dock = document.querySelector('.dock');
  fl.style.bottom = ((dock ? dock.offsetHeight : 124) + 8) + 'px';
}
function secMagLine(fix) { return `<div class="sec-line">${akiMag('sm')}<p><b>${secFixLine(fix)}。</b><span class="small">（${pairs(fix)}）</span></p></div>`; }
const SEC_MAG = (p, out) => `<span class="sec-pm${out ? ' out' : ''}${uniPat(S.my)}" style="${uniVars(S.my)}">${p ? p.num : '+'}</span>`;
function secFixRows(fix) {
  const F = E.FORMATIONS[S.clubs[S.my].tac.form];
  return `<ul class="sec-list">${fix.items.map(it => {
    const o = it.out && S.players[it.out], n = it.cand && S.players[it.cand], fl = it.fill && S.players[it.fill];
    const where = it.k === 'xi' ? E.ROLE[F[it.i][0]].jp : 'ベンチ';
    const top = o ? `${SEC_MAG(o, true)}<span class="sec-tx"><b>${where}　${esc(o.name)}</b><small>${outText(o)}</small></span>` : `${SEC_MAG(null, true)}<span class="sec-tx"><b>${where}　空き</b><small>先発の枠が空いています</small></span>`;
    // the stand-in's line breaks only between its pieces (ベンチから・適性100・総合力73)
    const sub = n ? [it.from === 'bench' ? 'ベンチから' : '', it.k === 'xi' ? `適性${it.apt}` : dpOf(n), `総合力${E.ovr(n)}`].filter(Boolean).map(x => `<span>${x}</span>`).join('・') : '';
    const bot = n ? `<span class="sec-ar" aria-hidden="true">↳</span>${SEC_MAG(n)}<span class="sec-tx"><b>${esc(n.name)}</b><small class="wrap">${sub}</small></span><button class="btn ghost sec-do" data-act="secOne" data-id="${it.id}">入れ替える</button>`
      : `<span class="sec-ar" aria-hidden="true">↳</span><span class="sec-tx"><small>代わりに出られる選手がいません</small></span>${o ? `<button class="btn ghost sec-do" data-act="secOne" data-id="${it.id}">外す</button>` : ''}`;
    return `<li class="sec-row"><div class="sec-ln">${top}</div><div class="sec-ln">${bot}</div>${fl ? `<div class="sec-fill">ベンチの空きには ${esc(fl.name)}（${dpOf(fl)}・${E.ovr(fl)}）</div>` : ''}</li>`;
  }).join('')}</ul>`;
}
// the secretary's sheet: who can't play (with a stand-in each), who is back, her notes. back: 'pre' (fid) returns to the
// pre-match sheet
function sheetSec(back, fid) {
  sheetState = { type: 'sec', back, fid };
  const si = secItems(); const c = S.clubs[S.my];
  const nf = E.nextMyFixture(S); const f = (fid && S.fixtures.find(x => x.id === fid)) || nf;
  const opp = f ? S.clubs[f.h === S.my ? f.a : f.h] : null;
  const out = [];
  const noteSec = n => { const v = secView(n); return `<section class="sec-sec"><h4>${esc(v.title(n))}<small>${jd(n.d)}</small></h4>${v.body(n)}${v.done ? `<button class="btn ghost block" data-act="secDone" data-id="${n.id}" style="min-height:40px">${v.done}</button>` : ''}</section>`; };
  const top = si.notes.filter(n => !n.seen && n.k === 'built');   // a building done stops the day: it comes first
  for (const n of top) out.push(noteSec(n));
  if (si.fix) out.push(`<section class="sec-sec"><h4>${f && opp ? `${jdw(f.date)} ${esc(opp.short)}戦（${E.fxLabel(f)}）` : '次の試合'}に出られない選手</h4>${secFixRows(si.fix)}<p class="fine" style="margin:0">押すまでメンバーは変わりません。候補は同じ役割でいちばん力を出せる選手です。</p></section>`);
  for (const m of si.back) out.push(`<section class="sec-sec"><h4>戻ってきた選手</h4><p class="small" style="margin:0"><b>${backLine(m)}</b><br><span class="muted">${backSub(m)}。</span></p><div class="grid2"><button class="btn ghost" data-act="secKeep" data-id="${m.out}">このまま</button><button class="btn primary" data-act="secBack" data-id="${m.out}">戻す</button></div></section>`);
  for (const n of si.notes) if (!top.includes(n)) out.push(noteSec(n));
  E.secSeen(S); persist(false);
  openSheet(`<div class="sec-head">${akiMag('md')}<div style="min-width:0;flex:1"><div class="eyebrow">${E.SEC.role}からの連絡</div><b class="sec-name">${esc(secWho())}</b></div><button class="btn ghost sec-rename" data-act="secName">名前を変える</button></div>
    ${out.join('') || `<p class="empty">いまはお知らせはありません。${esc(c.short)}の様子を見ておきますね。</p>`}`,
    (si.fix ? `<button class="btn primary block" data-act="secAll" style="min-height:54px;font-size:16px">おすすめどおりに入れ替える</button>` : '')
    + (back === 'pre' && fid ? `<button class="btn ghost block" data-act="secPre" data-id="${fid}">試合前に戻る</button>` : '<button class="btn ghost block" data-act="closeSheet">閉じる</button>'));
  render();
}
function sheetSecName(back) {
  sheetState = { type: 'secName', back };
  openSheet(`<div class="mgr-card" style="--k1:#1E2942;--k2:#C9A752;--kt:#F2EFE4">
      <div class="eyebrow">${E.SEC.role}の名前</div>
      <div class="mgr-club">${akiMag('lg')}<b>${esc(S.clubs[S.my].short)}の${E.SEC.role}</b></div>
      <label class="mgr-plate" for="sec-name"><span class="mgr-plate-k">${E.SEC.role}</span><input id="sec-name" maxlength="${E.SEC.max}" placeholder="${esc(E.SEC.name)}" autocomplete="off" enterkeyhint="done" value="${esc(secNm())}" aria-label="${E.SEC.role}の名前"></label>
      <p class="fine" style="margin:0">${E.SEC.max}文字まで。空欄なら「${esc(E.SEC.name)}」になります。</p>
    </div>`,
    `<button class="btn primary block" data-act="secNameSave">この名前にする</button><button class="btn ghost block" data-act="${back === 'club' ? 'closeSheet' : 'secOpen'}">戻る</button>`);
  const inp = document.getElementById('sec-name');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); inp.blur(); } });
}
// クラブ → 経営: who she is and where to rename her
function secCard() {
  return `<section class="card sec-card"><div class="row" style="gap:12px">${akiMag('md')}<div style="min-width:0;flex:1"><div class="eyebrow">クラブスタッフ</div><b class="sec-name">${esc(secWho())}</b></div><button class="btn ghost sec-rename" data-act="secName" data-back="club">名前を変える</button></div>
    <p class="fine" style="margin:0">試合に出られない選手の代わり、戻ってきた選手、月のはじめのまとめを知らせます。メンバーは、監督が押すまで変わりません。</p>
    <button class="btn ghost block" data-act="secOpen">連絡を見る</button></section>`;
}

/* ---------- スポンサー契約 (2026-10-15, ユーザーの選んだ案A＋B) ----------
   The offers are contracts on paper pinned to the board; tapping one signs it into the next free place on the kit (胸 → 背中
   → 袖, the seal shows where), 「場所」 moves it, tapping again takes it out. The secretary's three are filled in to start
   with. The kit is drawn in the club's colours and pattern (EMB). Progress: sponCard (home and クラブ → 経営). */
const spF = s => E.SPON.slot[s].f;
const spSlotJp = s => E.SPON.slot[s].jp;
const spSeal = s => ['胸', '背', '袖'][s];
const spLogo = (d, sm) => `<span class="sp-logo${sm ? ' sm' : ''}" style="--lc:${d.col}" aria-hidden="true">${esc(d.mk)}</span>`;
const spDots = lv => `<span class="sp-lv" role="img" aria-label="難しさ ${lv}">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>`;
const spM = v => E.money(v).replace('円', '');
// a condition breaks only between its phrases (リーグ戦で｜勝点61以上), never inside a word
const spCond = d => esc(E.sponText(d)).replace(/(で|を)/g, '$1<wbr>').replace(/ /g, '<wbr>');
// the kit: the front carries the chest and the sleeve, the back the back; by = [chest, back, sleeve] (a contract or null)
function spKit(back, by, mini) {
  const slot = (k, s) => { const d = by[s]; if (!d && mini) return ''; return `<span class="sp-slot ${k}${d ? '' : ' empty'}">${d ? (k === 'sleeve' ? esc(d.mk) : `<span class="sp-lg">${esc(d.br || d.co)}</span><span class="sp-mk">${esc(d.mk)}</span>`) : spSlotJp(s)}</span>`; };
  return `<span class="sp-kit${mini ? ' mini' : ''}" aria-hidden="true"><span class="sp-body">${uniSvg(uniOf(S.my), { back, cls: 'sp-shirt' })}${back ? slot('back', 1) : slot('chest', 0) + slot('sleeve', 2)}</span>${mini ? '' : `<span class="cap">${back ? '背中' : '胸・袖'}</span>`}</span>`;
}
const spTag = s => { const c = S.clubs[S.my]; return `<span class="sp-tag" style="--k1:${c.c1};--kt:${lum(c.c1) > 0.6 ? '#141414' : '#ffffff'}">${spSlotJp(s)}</span>`; };
// the pick (slot order), kept while the sheet is open; starts as the secretary's three
function spPick() {
  const ids = new Set(S.spon.offer.map(x => x.id));
  if (!UI.spk || UI.spk.s !== S.season || UI.spk.pick.some(id => id != null && !ids.has(id))) { const r = E.sponRec(S); UI.spk = { s: S.season, pick: [0, 1, 2].map(i => r[i] != null ? r[i] : null) }; }
  return UI.spk.pick;
}
function sheetSpon(back, fid) {
  if (!E.sponPending(S)) { if (back === 'pre' && fid) return sheetPrematch(fid); closeSheet(); render(); return; }
  sheetState = { type: 'spon', back, fid };
  E.sponLook(S); const nt = E.secNotes(S).find(n => n.k === 'spon'); if (nt) nt.seen = true;
  const sp = S.spon, c = S.clubs[S.my], pick = spPick();
  const by = pick.map(id => id == null ? null : sp.offer.find(x => x.id === id));
  const n = by.filter(Boolean).length;
  const base = Math.round(c.spon * E.SPON.base) * sp.months;
  const G = by.reduce((a, d, s) => a + (d ? Math.round(d.g * spF(s)) : 0), 0), B = by.reduce((a, d, s) => a + (d ? Math.round(d.b * spF(s)) : 0), 0);
  const cards = sp.offer.map(d => {
    const s = pick.indexOf(d.id), f = s < 0 ? 1 : spF(s);
    return `<div class="sp-paper${s >= 0 ? ' on' : ''}" style="--lc:${d.col}">
      <button class="sp-main" data-act="spTap" data-id="${d.id}" aria-pressed="${s >= 0}" aria-label="${esc(d.co)}：${esc(E.sponText(d))}">
        <span class="h">${spLogo(d)}<b>${esc(d.co)}</b>${spDots(d.lv)}</span>
        <span class="cond">${spCond(d)}</span>
        <span class="money"><span>保証<b>${spM(Math.round(d.g * f))}</b></span><span>達成ボーナス<b class="bn">${spM(Math.round(d.b * f))}</b></span></span>
      </button>
      ${s >= 0 ? `<span class="sp-seal">${spSeal(s)}<small>契約</small></span><div class="sp-mv">場所 ${[0, 1, 2].map(k => `<button data-act="spSlot" data-id="${d.id}" data-s="${k}" aria-pressed="${k === s}">${spSlotJp(k)}</button>`).join('')}</div>` : '<span class="tap">タップで契約</span>'}
    </div>`;
  }).join('');
  openSheet(`<div class="sec-head">${akiMag('md')}<div style="min-width:0;flex:1"><div class="eyebrow">${E.SEC.role}からの連絡</div><b class="sec-name">${esc(secWho())}</b></div></div>
    <div class="sp-top"><p class="small" style="margin:0">${E.seasonLabel(S.season)}のスポンサー候補が${sp.offer.length}社。ユニフォームの<b>胸・背中・袖</b>に1社ずつ、3社まで選べます（胸は1.2倍、袖は0.8倍）。保証は毎月、ボーナスは条件を達成した日に入ります。</p>
    <div class="sp-kits">${spKit(false, by)}${spKit(true, by)}</div></div>
    <div class="row"><span class="eyebrow">${E.seasonLabel(S.season)} スポンサー候補</span><span class="spacer"></span><span class="sp-cnt">契約 ${n} / ${E.SPON.max}社</span></div>
    ${cards}
    <p class="fine" style="margin:4px 0 0">${secNm()}のおすすめ（達成しやすい3社）を入れてあります。もう一度タップすると外れます。●の数は難しさで、難しい約束ほどボーナスが大きくなります。選ばないまま開幕戦を迎えると、おすすめの3社と契約します。</p>`,
    `<div class="sp-sum"><span>基本スポンサー<b>${spM(base)}</b></span><span>保証 計<b>${spM(G)}</b></span><span>ボーナス 最大<b>${spM(B)}</b></span></div>
    <button class="btn primary block" data-act="spSign" style="min-height:54px;font-size:16px" ${n ? '' : 'disabled'}>${n ? `この${n}社と契約する` : '1社以上選んでください'}</button>
    ${back === 'pre' && fid ? `<button class="btn ghost block" data-act="secPre" data-id="${fid}">試合前に戻る</button>` : '<button class="btn ghost block" data-act="closeSheet">あとで決める</button>'}`);
  render();
}
// what a contract shows: the count, what's left, and how the bar looks
function spLine(d, st) {
  const r = E.sponNow(S, d, st), left = d.n - r.now;
  let num = r.now == null ? '—' : `${r.now} / ${d.n}`, note = '', warn = false;
  switch (d.k) {
    case 'pts': note = `あと${left}`; break;
    case 'gf': note = `あと${left}点`; break;
    case 'cs': note = `あと${left}試合`; break;
    case 'u23': note = `あと${left}回`; break;
    case 'yo': note = `あと${left}人`; break;
    case 'hl': num = `${r.now}敗`; note = left <= 0 ? 'もう負けられない' : `あと${left}敗まで`; warn = left <= 1; break;
    case 'rank': num = r.now == null ? '—' : `${r.now}位`; note = r.now == null ? '開幕前' : r.now <= d.n ? 'いまは圏内' : `${d.n}位まであと${r.now - d.n}`; warn = r.now != null && r.now > d.n; break;
    case 'att': num = r.now == null ? '—' : `${r.now.toLocaleString('ja-JP')}人`; note = r.now == null ? 'ホーム開幕前' : `目標 ${d.n.toLocaleString('ja-JP')}人`; warn = r.now != null && r.now < d.n; break;
    case 'cup': { const x = ['ec', 'lc'].map(k => E.cupResult(S, k, S.my)); num = ''; note = x.includes('勝ち残り') ? '勝ち残り' : '敗退'; break; }
  }
  if (r.st === 'done') note = '達成'; else if (r.st === 'fail') note = '届かず';
  return { r, num, note, cls: r.st === 'done' ? 'done' : r.st === 'fail' ? 'fail' : warn ? 'warn' : '' };
}
// the season's contracts (home and クラブ → 経営); club: also says how the money comes in
function sponCard(where) {
  const sp = S.spon; if (!sp || sp.s !== S.season || S.fired) return '';
  const c = S.clubs[S.my];
  if (sp.old) return where === 'club' ? `<section class="card" style="display:grid;gap:6px"><div class="eyebrow">スポンサー契約</div><p class="small" style="margin:0">今季はこれまでどおりの固定のスポンサー収入です。来季からはシーズン前に${esc(secNm())}がスポンサー候補を持ってきます。</p></section>` : '';
  if (E.sponPending(S)) return `<section class="card sp-home"><div class="sp-head"><div style="flex:1;min-width:0"><div class="eyebrow">スポンサー契約</div><b>候補が${sp.offer.length}社来ています</b><div class="small muted" style="margin-top:2px">胸・背中・袖に3社まで。選ばないまま開幕戦を迎えると、${esc(secNm())}のおすすめの3社と契約します。</div></div>${spKit(false, [null, null, null], true)}</div><button class="btn primary block" data-act="sponOpen">スポンサーを選ぶ</button></section>`;
  const deals = sp.deals.slice().sort((a, b) => a.slot - b.slot); if (!deals.length) return '';
  const st = E.sponStat(S), by = [0, 1, 2].map(s => deals.find(d => d.slot === s) || null);
  const got = deals.reduce((a, d) => a + d.got, 0), open = deals.filter(d => d.st === 'run').reduce((a, d) => a + Math.round(d.b * spF(d.slot)), 0);
  const mo = E.sponMonth(S);
  return `<section class="card sp-home"><div class="sp-head"><div style="flex:1;min-width:0"><div class="eyebrow">ユニフォームのスポンサー</div><div class="small muted" style="margin-top:2px">${got ? `ボーナス 獲得 ${spM(got)}` : 'ボーナスはまだ'}${open ? `／あと最大 ${spM(open)}` : ''}</div></div>${spKit(false, by, true)}</div>
    ${deals.map(d => { const L = spLine(d, st); return `<div class="sp-row ${L.r.st === 'fail' ? 'fail' : ''}"><div class="h">${spTag(d.slot)}${spLogo(d, true)}<b>${esc(E.sponShort(d))}</b>${L.r.st === 'done' ? '' : `<span class="n">${L.num}</span>`}</div>
      <div class="sp-bar ${L.cls}"><i style="width:${L.r.st === 'fail' ? 100 : L.r.pct}%"></i></div><div class="sub"><span>${esc(d.co)}・ボーナス ${spM(Math.round(d.b * spF(d.slot)))}</span><span class="${L.cls === 'warn' || L.cls === 'fail' ? 'w' : ''}">${L.note}</span></div>${L.r.st === 'done' ? '<span class="sp-mini-seal">達成</span>' : ''}</div>`; }).join('')}
    <p class="fine" style="margin:0">基本スポンサー 月${spM(mo.base)}・保証 月${spM(mo.guar)}${where === 'club' ? `（保証は受け取り済み ${spM(deals.reduce((a, d) => a + d.paid, 0))}／${spM(deals.reduce((a, d) => a + Math.round(d.g * spF(d.slot)), 0))}）` : ''}。ボーナスは条件を達成した日に入ります。</p></section>`;
}
// the season review
function sponReview(sp) {
  if (!sp || !sp.deals || !sp.deals.length) return '';
  return `<div><div class="eyebrow" style="margin-bottom:6px">スポンサー契約</div><ul class="sp-res">${sp.deals.slice().sort((a, b) => a.slot - b.slot).map(d => `<li>${spTag(d.slot)}${spLogo(d, true)}<span class="t"><b>${esc(E.sponShort(d))}</b><small>${esc(d.co)}</small></span><span class="chip ${d.st === 'done' ? 'ok' : ''}">${d.st === 'done' ? `達成 +${spM(d.got)}` : '届かず'}</span></li>`).join('')}</ul>
    <p class="fine" style="margin:6px 0 0">保証 計${spM(sp.guar)}・ボーナス 計${spM(sp.bonus)}。次のシーズンへ進むと、${esc(secNm())}が新しいスポンサー候補を持ってきます。</p></div>`;
}
// the pre-match sheet, when the season starts without a choice
function spPreLine(fid) {
  return `<div class="sec-line" style="margin-top:0">${akiMag('sm')}<p><b>スポンサーがまだ決まっていません。</b><span class="small">このままキックオフすると、おすすめの3社と契約します。</span></p></div><button class="btn ghost block" data-act="sponOpen" data-back="pre" data-fid="${fid}">スポンサーを選ぶ</button>`;
}

/* ---------- ホームタウン (2026-10-15, 作業5, ユーザーの選んだ案A＝作戦ボードの街の地図) ----------
   クラブ → ホームタウン: the supporters and the stadium on top, then the town drawn on the board in chalk — the club's four
   facilities in a dashed box at the top (blue magnets with their level), the river and the railway, the stadium in the
   middle with its capacity (a little bigger with each stand added), the buildings as magnets: built = white with a yellow
   rim and a name tag, not yet = a dashed chalk circle with its name and cost, under construction = yellow-and-black
   stripes with the % — then the works, the season's supporters and home crowds (chart) and the money. A magnet opens
   sheetTown (cost, months, upkeep, effects; build / upgrade). Her note when a building is done (SEC_VIEW.built) and, once,
   for an old save (SEC_VIEW.town). The map is drawn on a 361×432 board (HT_POS), x in % so it fits every width. */
const HT_IC = {
  exp: '<path d="M4 20V9l8-4 8 4v11"/><path d="M4 13h16M8 20v-4h8v4"/><path d="M17 3v3M15.5 4.5h3"/>',
  crane: '<path d="M6 21V4h1.5L19 7"/><path d="M6 7h13M16 7v5"/><path d="M14.5 12h3v2h-3z"/><path d="M3 21h8"/>',
  roof: '<rect x="4" y="5" width="16" height="10" rx="1.5"/><path d="M9 19h6M12 15v4"/><path d="M8 9l2.5 2.5L16 8"/>',
  food: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 8c0-1.5 1-1.5 1-3M13 8c0-1.5 1-1.5 1-3"/>',
  shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  sclub: '<path d="M5 21V4"/><path d="M5 5h12l-2.5 3.5L17 12H5"/>',
  house: '<path d="M4 11l8-6 8 6"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  dorm: '<path d="M3 19V7M3 13h18v6M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10.5" r="1.8"/>',
  indoor: '<path d="M3 19a9 9 0 0 1 18 0z"/><path d="M8 19v-3h8v3"/><path d="M12 10v3"/>',
  train: '<path d="M4 20h16"/><path d="M6 20V9h12v11"/><path d="M6 9l6-4 6 4"/><circle cx="12" cy="14" r="2"/>',
  youth: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  medical: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  scout: '<circle cx="7" cy="15" r="3.5"/><circle cx="17" cy="15" r="3.5"/><path d="M10.5 15h3M7 11.5l2-6h1.5M17 11.5l-2-6h-1.5"/>',
  crowd: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.2 14.6A4.4 4.4 0 0 1 21 18.8"/>',
};
const htIc = (k, cls) => `<svg class="${cls || 'ht-ic'}" viewBox="0 0 24 24" aria-hidden="true">${HT_IC[k] || ''}</svg>`;
// people: 15098 → 1万5,098, 20000 → 2万
const ppl = n => { n = Math.round(n || 0); const r = n % 10000; return n >= 10000 ? `${Math.floor(n / 10000)}万${r ? r.toLocaleString('ja-JP') : ''}` : n.toLocaleString('ja-JP'); };
const yen = man => `${Math.round(man * 10000).toLocaleString('ja-JP')}円`;
const sgn = n => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('ja-JP')}`;
const HT_FAC = ['train', 'youth', 'medical', 'scout'];
const HT_SHORT = { exp: '増築', roof: '屋根・ビジョン', food: 'グルメ', shop: 'ショップ', sclub: 'サポーターズ', house: 'クラブハウス', dorm: '選手寮', indoor: '室内練習場' };
const HT_POS = { stad: [158, 202], exp: [262, 146], train: [52, 60], youth: [134, 60], medical: [216, 60], scout: [298, 60], shop: [40, 170], food: [40, 258], roof: [312, 196], house: [52, 330], dorm: [134, 330], indoor: [216, 330], sclub: [298, 330] };
const HT_DESC = {
  exp: 'スタンドを5,000席増やします。満員で入れなかったサポーターが入れるようになり、入場料が増えます。工事中のホーム戦は、席が減るので観客が1割少なくなります。',
  roof: 'スタンドを覆う屋根と大型ビジョン。雨の日も観やすく、試合の熱気が伝わるスタジアムに。観客が増え、1人あたりの売上も上がります。',
  food: 'スタジアムの名物グルメ。試合の日の楽しみが増えて観客が少し増え、1人あたりの売上が上がります。',
  shop: 'ユニフォームやグッズの売店。1人あたりの売上が上がります。',
  sclub: 'サポーターの集まり。勝ったときに増えやすく、負けても離れにくくなります。',
  house: '練習の合間に体を休める場所。選手のコンディションが毎日少し早く戻り、移籍の交渉で「行ってもいい」と思われやすくなります。',
  dorm: '若手が暮らす寮。21歳以下の選手が少し早く伸び、ユースから上がってくる選手の伸びしろが少し大きくなります。',
  indoor: '天気に左右されない練習場。試合と練習でのケガが減ります。',
};
// what a building does, as chips
function htFx(k) {
  const b = E.TOWN.b[k], pc = x => `${Math.round(x * 100)}%`, out = [];
  if (k === 'exp') out.push(`+${b.seats.toLocaleString('ja-JP')}席`);
  if (b.att) out.push(`観客 +${pc(b.att)}`);
  if (b.per) out.push(`1人あたり +${Math.round(b.per * 10000)}円`);
  if (b.tgt) out.push(`サポーター +${pc(b.tgt)}`);
  if (b.gain) out.push(`増え方 ×${b.gain}`, `減り方 ×${b.loss}`);
  if (b.rec) out.push(`コンディションの戻り +${b.rec}/日`);
  if (b.will) out.push(`移籍の意思 +${pc(b.will)}`);
  if (b.young) out.push(`${b.age}歳以下の成長 ×${b.young}`, `ユース昇格 伸びしろ +${b.pot}`);
  if (b.inj) out.push(`ケガ −${pc(1 - b.inj)}`);
  return out;
}
const htChips = k => `<div class="ht-fx">${htFx(k).map(x => `<span class="chip acc">${x}</span>`).join('')}</div>`;
const htJobName = j => j.k === 'exp' ? `スタジアム増築 ${j.step || ''}期` : E.TOWN.b[j.k].jp;
const htPct = j => Math.round(100 * Math.min(1, Math.max(0, E.D.diff(S.date, j.from) / Math.max(1, E.D.diff(j.to, j.from)))));
// the supporters (line) and the home crowds (bars, a full house in yellow) of this season, with the capacity (dashed)
function htChart(I) {
  const c = S.clubs[S.my];
  const a = `${S.season}-07-15`, z = `${S.season + 1}-05-31`, span = E.D.diff(z, a);
  const W = 320, H = 112, L = 30, B = 16, X = d => L + (W - L - 4) * Math.min(1, Math.max(0, E.D.diff(d, a) / span));
  const pts = I.hist.filter(r => r[0] >= `${S.season}-06-01`).map(r => ({ d: r[0] < a ? a : r[0], f: r[1], cap: r[2] || c.cap }));
  if (!pts.length || pts[pts.length - 1].d < S.date) pts.push({ d: S.date < a ? a : S.date, f: I.fans, cap: I.cap });
  const vals = pts.map(p => p.f).concat(pts.map(p => p.cap), I.games.map(g => g.att));
  const lo = Math.max(0, Math.floor(Math.min(...vals) * 0.8 / 1000) * 1000), hi = Math.ceil(Math.max(...vals) * 1.06 / 1000) * 1000;
  const Y = v => (H - B) - (H - B - 6) * (v - lo) / Math.max(1, hi - lo);
  const bars = I.games.map(g => { const x = X(g.d); return `<rect class="g${g.att >= c.cap * 0.95 ? ' full' : g.cup ? ' cup' : ''}" x="${(x - 3).toFixed(1)}" y="${Y(g.att).toFixed(1)}" width="6" height="${Math.max(1, Y(lo) - Y(g.att)).toFixed(1)}" rx="1"/>`; }).join('');
  let cap = `M${X(pts[0].d).toFixed(1)} ${Y(pts[0].cap).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) cap += ` H${X(pts[i].d).toFixed(1)} V${Y(pts[i].cap).toFixed(1)}`;
  cap += ` H${X(z).toFixed(1)}`;
  const line = pts.map(p => `${X(p.d).toFixed(1)},${Y(p.f).toFixed(1)}`).join(' '), last = pts[pts.length - 1];
  const md = (m, d) => `${m >= 7 ? S.season : S.season + 1}-${String(m).padStart(2, '0')}-${d}`;
  const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5].map(m => { const x = X(md(m, '01')).toFixed(1); return `<line class="tk" x1="${x}" x2="${x}" y1="${H - B}" y2="${H - B + 3}"/><text x="${X(md(m, '16')).toFixed(1)}" y="${H - 3}" text-anchor="middle">${m}月</text>`; }).join('');
  const k = v => `${(v / 10000).toFixed(v % 10000 ? 1 : 0)}万`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="今季のサポーターとホームの観客">
    <line class="ax" x1="${L}" x2="${W - 4}" y1="${H - B}" y2="${H - B}"/>${months}
    <text x="${L - 4}" y="${Y(hi) + 4}" text-anchor="end">${k(hi)}</text><text x="${L - 4}" y="${Y(lo)}" text-anchor="end">${k(lo)}</text>
    ${bars}<path class="cp" d="${cap}"/><polyline class="fl" points="${line}"/><circle class="fd" cx="${X(last.d).toFixed(1)}" cy="${Y(last.f).toFixed(1)}" r="3.2"/></svg>`;
}
function viewTown() {
  const c = S.clubs[S.my], I = E.townInfo(S), T = c.town || { b: {}, exp: 0, job: null }, job = I.job;
  const pct = job ? htPct(job) : 0;
  const d0 = I.fans0 != null ? I.fans - I.fans0 : null;
  const over = Math.round((I.fans - I.cap) / 100) * 100;
  const note = over >= 500 ? `満員の試合は、席が取れないサポーターがおよそ${ppl(over)}人。`
    : I.full != null && I.full >= 0.9 ? 'ほぼ満員。サポーターが増えたら増築の出番です。'
    : I.att != null ? `まだ席に余裕があります（平均で約${ppl(Math.round((I.cap - I.att) / 100) * 100)}席の空き）。` : '今季のホーム戦はまだありません。';
  const x = px => `${(px / 361 * 100).toFixed(2)}%`;
  const tok = (k, st, label, sub, aria) => { const [px_, py] = HT_POS[k]; return `<button class="ht-tok ${st}" style="left:${x(px_)};top:${py}px" data-act="htOpen" data-k="${k}" aria-label="${esc(aria)}"><span class="ht-mag ${st}">${htIc(st === 'job' ? 'crane' : k)}${st === 'fac' ? `<em>Lv${sub}</em>` : ''}</span><span class="lbl">${label}</span>${st === 'empty' && sub ? `<span class="pr">${sub}</span>` : ''}</button>`; };
  const oku = v => E.money(v).replace('円', '');
  const facs = HT_FAC.map(k => tok(k, 'fac', E.FACILITY[k].jp, c.fac[k], `${E.FACILITY[k].jp} Lv${c.fac[k]}`)).join('');
  const blds = ['shop', 'food', 'roof', 'house', 'dorm', 'indoor', 'sclub'].map(k => {
    const B = E.TOWN.b[k];
    if (job && job.k === k) return tok(k, 'job', `工事中 ${pct}%`, null, `${B.jp}（工事中 ${pct}%）`);
    if (E.built(c, k)) return tok(k, 'built', HT_SHORT[k], null, `${B.jp}（完成）`);
    return tok(k, 'empty', HT_SHORT[k], oku(B.cost), `${B.jp}（${E.money(B.cost)}）`);
  }).join('');
  const nx = E.townNext(c, 'exp');
  const expTok = job && job.k === 'exp' ? tok('exp', 'job', `増築 ${job.step}期 ${pct}%`, null, `スタジアム増築 ${job.step}期（工事中 ${pct}%）`)
    : nx ? tok('exp', 'empty', `増築 ${nx.step}期`, oku(nx.cost), `スタジアム増築 ${nx.step}期（${E.money(nx.cost)}）`) : '';
  const n = T.exp || 0;
  const stad = `<button class="ht-stad${job && job.k === 'exp' ? ' works' : ''}" style="left:${x(HT_POS.stad[0])};top:${HT_POS.stad[1]}px;--n:${n}" data-act="htOpen" data-k="exp" aria-label="${esc(c.stadium || 'スタジアム')}（収容 ${I.cap.toLocaleString('ja-JP')}席）">
    <span class="c">${Array.from({ length: n }, (_, i) => `<span class="st" style="--i:${n - i}"></span>`).join('')}<span class="ring"></span><span class="bowl"></span><span class="cap">${I.cap.toLocaleString('ja-JP')}席</span></span></button>`;
  const rails = Array.from({ length: 26 }, (_, i) => { const xx = i * 15; const y = 286 - xx * 0.021; return `<path class="rail" d="M${xx} ${y - 5} L ${xx + 1} ${y + 5}"/>`; }).join('');
  const board = `<div class="ht-board">
    <svg class="map" viewBox="0 0 361 432" preserveAspectRatio="none" aria-hidden="true">
      <defs><filter id="ht-chalk"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs>
      <g filter="url(#ht-chalk)">
        <rect class="zone" x="8" y="12" width="345" height="94" rx="10"/>
        <path class="ch" d="M-5 122 C 40 106, 80 134, 130 118 S 210 102, 250 116 S 320 130, 370 110"/>
        <path class="ch" d="M-5 133 C 40 117, 80 145, 130 129 S 210 113, 250 127 S 320 141, 370 121"/>
        <path class="rail" d="M-5 283 L 370 275"/><path class="rail" d="M-5 289 L 370 281"/>${rails}
        <path class="ch thin" d="M95 400 L 102 300 L 92 140"/><path class="ch thin" d="M361 240 L 270 240 L 250 300"/><path class="ch thin" d="M258 400 L 262 300"/>
      </g>
    </svg>
    <span class="ht-lab" style="left:${x(18)};top:18px">クラブの施設</span><span class="ht-lab" style="right:${x(22)};top:140px">川</span><span class="ht-lab" style="right:${x(14)};top:292px">駅 →</span>
    ${stad}${expTok}${facs}${blds}
  </div>`;
  const jobCard = job ? `<section class="card ht-job">
      <div class="row"><div class="eyebrow">工事中</div><span class="spacer"></span><span class="chip acc">あと${job.left}日</span></div>
      <div class="ht-job-t"><b>${htJobName(job)}</b>${job.k === 'exp' ? `<span class="small muted">+${E.TOWN.b.exp.seats.toLocaleString('ja-JP')}席 → ${(I.cap + E.TOWN.b.exp.seats).toLocaleString('ja-JP')}席</span>` : ''}</div>
      <div class="ht-prog" role="img" aria-label="進み具合 ${pct}%"><i style="width:${pct}%"></i></div>
      <div class="small muted">${jd(job.to)} 完成予定${job.k === 'exp' ? '・工事中のホーム戦は観客 −10%' : ''}</div></section>` : '';
  const hg = I.games.filter(g => !g.cup), fullN = hg.filter(g => g.att >= I.cap * 0.95).length;
  const chart = `<section class="card ht-chart"><div class="row"><div class="eyebrow">サポーターと観客</div><span class="spacer"></span><span class="small muted">${E.seasonLabel(S.season)}</span></div>
      ${htChart(I)}
      <div class="ht-leg"><span><i></i>サポーター</span><span><i class="g"></i>ホームの観客</span><span><i class="f"></i>満員</span><span><i class="c"></i>収容</span></div>
      <p class="fine" style="margin:0">${hg.length ? `リーグのホーム戦 ${hg.length}試合・平均 ${ppl(I.att)}人${fullN ? `・満員 ${fullN}試合` : ''}。` : 'ホーム戦が始まると、試合ごとの観客がここに並びます。'}サポーターは勝つと増え、負けが続くと減ります。毎月、クラブの格や建物で決まる人数（いまは約${ppl(Math.round(I.target / 100) * 100)}人）へ少しずつ戻ります。</p></section>`;
  const upB = I.upkeep - I.upF;
  const money = `<section class="card" style="display:grid;gap:6px"><dl class="kv"><dt>観客1人あたり</dt><dd>${yen(I.per)}</dd>${I.att != null ? `<dt>1試合の入場料</dt><dd>平均 ${E.money(Math.round(I.att * I.per))}</dd>` : ''}<dt>維持費</dt><dd>月${E.money(I.upkeep)}</dd></dl>
      <p class="fine" style="margin:0">維持費は 建物 月${E.money(upB)}・施設 月${E.money(I.upF)}（施設は始めのLvより上の分）。建物は完成の翌月からかかります。マグネットをタップすると、費用・工期・効果を見て建てられます。工事は1つずつです。</p></section>`;
  return `<section class="card ht-top">
      <div class="ht-stats">
        <div><small>サポーター</small><b>${ppl(I.fans)}<span>人</span></b>${d0 ? `<i class="${d0 > 0 ? 'up' : 'dn'}">今季 ${sgn(d0)}</i>` : '<i>&nbsp;</i>'}</div>
        <div><small>スタジアム</small><b>${ppl(I.cap)}<span>席</span></b><i>${I.att != null ? `平均 ${ppl(I.att)}人・${Math.round(I.full * 100)}%` : esc(c.stadium || '')}</i></div>
      </div>
      <p class="ht-note">${note}</p></section>
    ${board}${jobCard}${chart}${money}`;
}
// クラブ → 経営: the facilities and the buildings, in one line, and the way to ホームタウン
function townLink() {
  const c = S.clubs[S.my], I = E.townInfo(S), j = I.job;
  const nb = I.b.filter(b => b.k !== 'exp' && b.built).length;
  return `<section class="card ht-link"><div class="row" style="gap:12px"><span class="ht-mag built sm">${htIc('exp')}</span><div style="flex:1;min-width:0"><b>ホームタウン</b>
    <div class="small muted">${HT_FAC.map(k => `${E.FACILITY[k].jp} Lv${c.fac[k]}`).join('・')}</div>
    <div class="small muted">収容 ${c.cap.toLocaleString('ja-JP')}席・建物 ${nb}/7${j ? `・工事中 ${htJobName(j)} ${htPct(j)}%` : ''}</div></div></div>
    <button class="btn block" data-act="clView" data-k="town">施設の強化・建物はホームタウンへ</button></section>`;
}
// a magnet: build it (cost, months, upkeep, effects), or a facility to upgrade
function sheetTown(k) {
  sheetState = { type: 'town', k };
  const c = S.clubs[S.my], close = '<button class="btn ghost block" data-act="closeSheet">閉じる</button>';
  if (HT_FAC.includes(k)) {
    const F = E.FACILITY[k], lv = c.fac[k], cost = E.facCost(lv), u = E.TOWN.facUp[k], st = E.TOWN.facStart[k];
    const btn = lv >= 5 ? '' : c.funds < cost ? `<button class="btn primary block" disabled>資金が足りません（${E.money(cost)}）</button>` : `<button class="btn primary block" data-act="htUp" data-k="${k}" style="min-height:52px">Lv${lv + 1}に強化する（${E.money(cost)}）</button>`;
    openSheet(`<div class="ht-sh-head"><span class="ht-mag fac lg">${htIc(k)}<em>Lv${lv}</em></span><div class="t"><div class="eyebrow">クラブの施設</div><b class="t2">${esc(F.jp)}</b><span class="stars">${'■'.repeat(lv)}${'□'.repeat(5 - lv)}</span></div></div>
      ${lv < 5 ? `<div class="ht-kv"><div><small>Lv${lv + 1}への費用</small><b>${E.money(cost).replace('円', '')}</b></div><div><small>工期</small><b>すぐ</b></div><div><small>維持費</small><b>月+${u}万</b></div></div>` : '<div class="row"><span class="chip ok">最大レベル</span></div>'}
      <p class="small" style="margin:0">${esc(F.desc)}。</p>
      <p class="fine" style="margin:0">維持費は Lv${st}より上のLv1つにつき月${u}万円（いまは月${Math.max(0, lv - st) * u}万円）。${k === 'train' ? '練習方針と選手ごとのトレーニングは「選手 → 育成」で設定します。' : k === 'scout' ? 'スカウトの派遣は「クラブ → 経営」から。' : ''}</p>`,
      btn + close);
    return;
  }
  const B = E.TOWN.b[k], T = c.town || { b: {}, exp: 0, job: null }, job = T.job, mine = job && job.k === k;
  const nx = E.townNext(c, k), done = k !== 'exp' && E.built(c, k), I = E.townInfo(S);
  const step = mine ? job.step : nx ? nx.step : T.exp;
  const title = k === 'exp' ? `スタジアム増築${step ? ` ${step}期` : ''}` : B.jp;
  const st = mine ? 'job' : done ? 'built' : 'empty';
  const eb = mine ? '工事中' : done ? `完成（${jd(T.b[k])}）` : k === 'exp' && !nx ? 'スタジアム' : '建てる';
  let kv;
  if (mine) kv = `<div><small>完成予定</small><b>${jd(job.to)}</b></div><div><small>進み具合</small><b>${htPct(job)}%</b></div><div><small>維持費</small><b>月${B.up}万</b></div>`;
  else if (done) kv = `<div><small>完成</small><b>${jd(T.b[k])}</b></div><div><small>維持費</small><b>月${B.up}万</b></div><div><small>効果</small><b>発揮中</b></div>`;
  else if (nx) kv = `<div><small>費用</small><b>${E.money(nx.cost).replace('円', '')}</b></div><div><small>工期</small><b>${nx.mo}か月</b></div><div><small>維持費</small><b>月${nx.up}万</b></div>`;
  else kv = `<div><small>収容</small><b>${ppl(c.cap)}</b></div><div><small>増築</small><b>${T.exp || 0}期</b></div><div><small>維持費</small><b>月${(T.exp || 0) * B.up}万</b></div>`;
  const stadLine = k === 'exp' ? `<p class="small" style="margin:0">${esc(c.stadium || 'スタジアム')}：いま${c.cap.toLocaleString('ja-JP')}席${I.att != null ? `・今季の平均 ${I.att.toLocaleString('ja-JP')}人（${Math.round(I.full * 100)}%）` : ''}。${I.fans - c.cap >= 500 ? `満員の試合は約${ppl(Math.round((I.fans - c.cap) / 100) * 100)}人が入れません。` : ''}${(r => r > 0 ? `増築はこのあと${r}期まで（最大${B.capMax.toLocaleString('ja-JP')}席）。` : mine ? 'これが最後の増築です。' : 'これ以上は増築できません。')(nx ? B.cost.length - (T.exp || 0) - (mine ? 1 : 0) : 0)}</p>` : '';
  let foot = '';
  if (!mine && !done && nx) {
    const can = E.townCan(S, k);
    const fin = E.addMonths(S.date, nx.mo);
    foot = can.ok ? `<button class="btn primary block" data-act="htBuild" data-k="${k}" style="min-height:54px;font-size:16px">建てる（${E.money(nx.cost)}・${jd(fin)}完成）</button>`
      : can.busy ? `<button class="btn primary block" disabled>${jd(job.to)} の完成後に建てられます</button>`
      : `<button class="btn primary block" disabled>資金が足りません（あと${E.money(nx.cost - c.funds)}）</button>`;
  }
  const busy = job && !mine && !done && nx ? `<div class="card ht-busy"><span class="small">工事は1つずつ。いまは<b>${htJobName(job)}</b>の工事中（${jd(job.to)} 完成予定）</span></div>` : '';
  openSheet(`<div class="ht-sh-head"><span class="ht-mag ${st} lg">${htIc(mine ? 'crane' : k)}</span><div class="t"><div class="eyebrow">${eb}</div><b class="t2">${title}</b></div></div>
    <div class="ht-kv">${kv}</div>
    ${htChips(k)}
    <p class="small" style="margin:0">${HT_DESC[k]}${B.fan ? `完成したときにサポーターが${Math.round(B.fan * 100)}%増えます。` : ''}</p>
    ${stadLine}${busy}
    ${!mine && !done && nx ? '<p class="fine" style="margin:0">費用は着工のときに全額。維持費は完成の翌月から毎月かかります。</p>' : ''}`,
    foot + close);
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
    <div class="bigovr"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span><dl class="kv" style="flex:1"><dt>今季の増減</dt><dd>${dlt(shownDiff(p.ovr, p.ovr0 != null ? p.ovr0 : p.ovr))}</dd><dt>伸びしろ</dt><dd><span class="stars">${potStars(p)}</span>（最大 ${Math.round(p.pot)}）</dd><dt>1か月の見込み</dt><dd>${pv ? dlt(pv.dOvr, true) : '—'}</dd><dt>出場機会</dt><dd>${(() => { const sh = E.playShare(S, p); return sh == null ? '—' : Math.round(sh * 100) + '%'; })()}</dd></dl></div>
    ${top.length ? `<p class="fine" style="margin:-4px 0 0">このメニューだと1か月で ${top.map(x => `${E.ATTR[x.i]} ${x.d > 0 ? '+' : ''}${x.d}`).join('、')} ほど。</p>` : pv && pv.dAt.some(d => d >= 0.15) ? '<p class="fine" style="margin:-4px 0 0">1か月では目に見える変化は小さく、少しずつ伸びていきます。</p>' : ''}
    ${note ? `<p class="fine" style="margin:-4px 0 0">${note}</p>` : ''}
    <p class="fine" style="margin:-4px 0 0">出場機会はクラブの試合時間のうち出ていた割合。試合に出るほど成長が速く、23歳以下は特に伸びます。</p>
    <div class="ctlrow"><label>個別メニュー</label><div class="menu">${menus.map(([k, f]) => `<button data-act="setTf" data-id="${p.id}" data-k="${k}" aria-pressed="${tf === k}"><b>${f.jp}</b><span>${(p.pos === 'GK' && f.gksub) || f.sub}</span></button>`).join('')}</div></div>
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
    const style = `left:${s[1]}%;top:${88 - (s[2] - 7) * 1.04}%;${uniVars(S.my)}`;
    if (!p) return `<button class="tok empty" style="${style}" data-act="slot" data-i="${i}"><span class="shirt">+</span><span class="lbl">${E.ROLE[s[0]].jp}</span></button>`;
    if (!avail(p)) return `<button class="tok out" style="${style}" data-act="slot" data-i="${i}" aria-label="${E.ROLE[s[0]].jp} ${esc(p.name)} ${outShort(p)}">${tokShirt(S.my, p.num, '', true)}<span class="lbl">${esc(p.short)}</span><span class="ov">${outShort(p)}</span></button>`;
    const warn = E.posPenalty(p, s[0]) <= -1.5 || p.cond < 70;
    return `<button class="tok ${p.hot ? 'hot' : ''}" style="${style}" data-act="slot" data-i="${i}" aria-label="${E.ROLE[s[0]].jp} ${esc(p.name)}${p.hot ? ' 燃えている' : ''}">${tokShirt(S.my, p.num, warn ? 'warn' : '')}<span class="lbl">${esc(p.short)}</span><span class="ov">${E.ROLE[s[0]].jp}・${E.ovr(p)}</span></button>`;
  }).join('');
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  const iss = E.lineupIssues(S, S.my);
  // 連携: the XI that can play (an empty slot or a player who's out breaks his lines)
  const LK = E.linkEval(S, S.my, c.tac.form, F.map((s, i) => { const p = S.players[c.tac.xi[i]]; return p && p.club === S.my && avail(p) ? p.id : null; }), { near: true });
  const empty = iss.spare && iss.xi.some(x => x.why === 'empty');
  const sfx = iss.block ? E.secFix(S) : null;
  const banner = iss.block ? `<div class="card alert"><div class="eyebrow">試合の前に入れ替えが必要です</div><ul>${issueLines(iss).map(t => `<li>${esc(t)}</li>`).join('')}</ul>${sfx.items.length ? secMagLine(sfx) + '<button class="btn primary block" data-act="secAll" style="margin-top:8px">おすすめどおりに入れ替える</button>' : ''}<p class="fine" style="margin:6px 0 0">押すまでメンバーは変わりません。<button class="linkish" data-act="secOpen">1人ずつ選ぶ</button>か、選手やベンチの行をタップして自分で入れ替えることもできます。${empty ? '空いた枠だけなら、下のボタンでおまかせで埋められます。' : ''}</p>${empty ? '<button class="btn block" data-act="fillEmpty" style="margin-top:8px">空いた枠をおまかせで埋める</button>' : ''}</div>` : '';
  return `${banner}<div class="trate"><div><small>攻撃</small><b>${Math.round(r.att)}</b></div><div><small>中盤</small><b>${Math.round(r.mid)}</b></div><div><small>守備</small><b>${Math.round(r.def)}</b></div></div>
    ${formSelect(c)}
    <p class="fine" style="margin:-6px 0 0">${esc(E.FORM_DESC[c.tac.form] || '')}</p>
    <div class="pitch">${PITCH_SVG}${lkLines(F, c.tac.xi, LK)}${toks}</div>
    <p class="fine" style="margin:-4px 0 0">選手をタップすると入れ替えられます。「!」は適性が低いポジションか疲れている選手、「×」はケガや出場停止で次の試合に出られない選手です（出場停止はリーグ・天皇杯・Lカップそれぞれの試合で消化）。</p>
    ${linkCard(LK)}
    ${planCard(c)}
    <button class="btn ghost block" data-act="presets">戦術の保存・読み込み<span class="small muted">　${(S.presets || []).length}/${E.PRESET_MAX}</span></button>
    <h3 class="sec-h">ベンチ（${c.tac.bench.length}/${E.BENCH_SIZE}人）<small>自動では入れ替わりません</small></h3>
    <p class="fine" style="margin:-6px 0 0">選手をタップすると、ベンチ外の選手と入れ替えられます。</p>
    <div class="bgrid" role="list" aria-label="ベンチ">${c.tac.bench.map(id => benchTile(S.players[id], c)).join('')}${Array.from({ length: Math.max(0, E.BENCH_SIZE - c.tac.bench.length) }, () => `<button class="btile addrow" role="listitem" data-act="benchPick" data-id="0" aria-label="ベンチに加える"><span class="bt-mag">+</span><b class="bt-name">ベンチに加える</b><span class="bt-meta">空き枠</span></button>`).join('')}</div>
    <button class="btn ghost block" data-act="benchAuto">ベンチをおまかせで組み直す</button>
    <div class="subnav"><button class="btn primary block" data-act="autoXI">おまかせでベストメンバーを組む</button></div>`;
}
// formation: the current one on a plate; the others in a pull-down (a native select over the plate), 3-back → 4-back →
// 5-back and in number order within each
const FORM_GROUPS = [3, 4, 5].map(n => [`${n}バック`, Object.keys(E.FORMATIONS).filter(f => f[0] === String(n)).sort()]).filter(g => g[1].length);
function formSelect(c) {
  const f = c.tac.form, grp = (FORM_GROUPS.find(g => g[1].includes(f)) || [''])[0];
  return `<label class="formsel">
    <span class="pc-head"><span class="eyebrow">フォーメーション</span><span class="pc-edit">変更<span aria-hidden="true">▾</span></span></span>
    <span class="fs-now"><b>${f}</b><small>${grp}</small></span>
    <select data-chg="form" aria-label="フォーメーション（今は${f}）">${FORM_GROUPS.map(([g, fs]) => `<optgroup label="${g}">${fs.map(k => `<option value="${k}"${k === f ? ' selected' : ''}>${k}</option>`).join('')}</optgroup>`).join('')}</select>
  </label>`;
}
/* ---------- 連携とコンボ (2026-10-15, the user's 案A: chalk lines on the board, the card under it) ---------- */
// the board's lines: thickness = how well the two know each other (〜39 dotted, 40〜, 70〜, 90〜), yellow = in a combo.
// The board is 4:5.1, so a 100 × 127.5 viewBox keeps the slots' % positions (top = 88 − (y − 7) × 1.04) undistorted.
// a chalk line between slots i and j of formation F (the 100 × 127.5 board). WebKit (iPhone's Safari) draws no dotted
// line (〜39) that is exactly level (4-4-2's two CMF, a front two): one like that, or exactly upright, is tilted by 0.05
// (a fifth of a pixel). Found in WebKitGTK (dev/test/webkit.py), 2026-10-17
function lkXY(F, i, j) {
  const at = k => [F[k][1], (88 - (F[k][2] - 7) * 1.04) * 1.275];
  let [x1, y1] = at(i), [x2, y2] = at(j);
  if (Math.abs(x1 - x2) < 0.05) x2 = x1 + 0.05;
  if (Math.abs(y1 - y2) < 0.05) y2 = y1 + 0.05;
  return `x1="${x1}" y1="${y1.toFixed(2)}" x2="${x2}" y2="${y2.toFixed(2)}"`;
}
// the filtered group of chalk lines starts with an empty box the size of the board: WebKit cut the chalk filter's picture
// to the lines' own extent, and the rightmost upright line (RSB–RSH at x 87 in 4-4-2, 4-1-4-1 and 4-4-1-1) fell outside it
// and vanished, solid or dotted, whoever played there (2026-10-17, the user's screenshots; reproduced in WebKitGTK,
// dev/test/webkit.py). The box makes the extent the whole board. Chromium showed both all along.
const LK_BOX = '<rect class="lk-box" x="0" y="0" width="100" height="127.5" fill="none"/>';
function lkLines(F, xi, L) {
  const key = (i, j) => Math.min(i, j) * 32 + Math.max(i, j);
  const hot = new Set(); for (const it of L.combos) for (const [i, j] of it.lines || []) hot.add(key(i, j));
  const tier = v => v >= 90 ? 't4' : v >= 70 ? 't3' : v >= 40 ? 't2' : 't1';
  const ln = (i, j, cls) => `<line class="${cls}" ${lkXY(F, i, j)}/>`;
  let glow = '', out = '';
  const drawn = new Set();
  for (const [i, j, v] of L.pairs) { const h = hot.has(key(i, j)); drawn.add(key(i, j)); if (h) glow += ln(i, j, 'glow'); out += ln(i, j, tier(v) + (h ? ' cb' : '')); }
  // a combo between players who aren't neighbours (鉄壁 with the outer centre-backs of a back three)
  for (const it of L.combos) for (const [i, j] of it.lines || []) if (!drawn.has(key(i, j))) { drawn.add(key(i, j)); glow += ln(i, j, 'glow'); out += ln(i, j, tier(E.linkOf(S, S.my, xi[i], xi[j])) + ' cb'); }
  if (!out) return '';
  return `<svg class="lk-lines" viewBox="0 0 100 127.5" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="lk-chalk" filterUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="137.5"><feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale=".5"/></filter></defs><g filter="url(#lk-chalk)">${LK_BOX}${glow}${out}</g></svg>`;
}
const LK_IC = {
  hot: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v7M15 12v7"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  wings: '<path d="M2 12h7M15 12h7M5 9l-3 3 3 3M19 9l3 3-3 3"/><circle cx="12" cy="12" r="2.2"/>',
  mentor: '<circle cx="8" cy="6.5" r="3"/><path d="M3 21v-4a5 5 0 0 1 10 0v4"/><circle cx="17.5" cy="11" r="2.2"/><path d="M14 21v-3a3.5 3.5 0 0 1 7 0v3"/>',
  yo: '<path d="M12 21V11"/><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
  local: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  nat: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  legend: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const lkIc = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${LK_IC[k] || ''}</svg>`;
// what a combo adds: 「攻撃 +0.5」「全体 +0.3」
const lkFx = it => it.all ? `全体 +${it.all}` : [['att', '攻撃'], ['mid', '中盤'], ['def', '守備']].filter(([k]) => it[k]).map(([k, l]) => `${l} +${it[k]}`).join('・');
// who makes it: 「クルークス → 遠野・91」
function lkWho(it) {
  const nm = id => esc(S.players[id] ? S.players[id].short : '?'), w = it.who || [];
  if (it.k === 'hot' || it.k === 'mentor') return `${nm(w[0])} → ${nm(w[1])}・${Math.floor(it.val)}`;
  if (it.k === 'wall' || it.k === 'heart') return `${w.map(nm).join('・')}・${Math.floor(it.val)}`;
  if (it.k === 'wings') return `${nm(w[0])}・${nm(w[1])} ／ ${nm(w[2])}・${nm(w[3])}`;
  if (it.k === 'legend') return `${nm(w[0])}・背番号${it.num}`;
  // 生え抜き・地元: say what they share (「神奈川生まれ　諏訪間・喜田・山根」)
  const pre = it.k === 'yo' ? 'ユース出身　' : it.k === 'local' ? `${esc(S.clubs[S.my].area || '')}生まれ　` : '';
  return pre + (w.length > 4 ? `${w.slice(0, 3).map(nm).join('・')} ほか${w.length - 3}人` : w.map(nm).join('・'));
}
// 連携 shown as a whole number is rounded down, so 74.7 of 75 reads 74 (not a 75 that doesn't count yet)
const lkProg = it => ['yo', 'local', 'nat'].includes(it.k) ? `${it.val}人／${it.need}人` : it.k === 'legend' ? 'まだ' : `${Math.floor(it.val)}／${it.need}`;
function linkCard(L) {
  const leg = (cls, t) => `<span><svg viewBox="0 0 24 8" aria-hidden="true"><line class="${cls}" x1="2" y1="4" x2="22" y2="4.05"/></svg>${t}</span>`;
  const plates = L.combos.map(it => `<div class="lk-plate"><span class="ic">${lkIc(it.k)}</span><span class="nm"><b>${esc(it.jp)}</b><small>${lkWho(it)}</small></span><span class="lk-fx">${lkFx(it)}</span></div>`).join('');
  const over = L.over.length ? `<p class="fine" style="margin:0">ほかに${L.over.map(it => `「${esc(it.jp)}」`).join('')}も条件を満たしています（同時に${E.LINK.combos}つまで、強いものから）。</p>` : '';
  const near = L.near.slice(0, 3).map(it => `<div class="lk-wrow"><span><b>${esc(it.jp)}</b>${esc(it.cond)}</span><span class="pg"><span class="lk-bar"><i style="width:${Math.min(100, Math.floor(it.val / it.need * 100))}%"></i></span><span>${lkProg(it)}</span></span></div>`).join('');
  return `<section class="card lk-card">
    <div class="lk-head"><span class="eyebrow">連携（隣り合う${L.n}組）</span><span class="lk-sum">平均<b>${Math.round(L.avg)}</b><span class="lk-plus">チーム力 +${L.bonus.toFixed(1)}</span></span></div>
    <div class="lk-leg">${leg('t1', '〜39')}${leg('t2', '40〜')}${leg('t3', '70〜')}${leg('cb', 'コンボ')}</div>
    <div class="lk-head"><span class="eyebrow">コンボ ${L.combos.length}/${E.LINK.combos}</span><span class="small muted">先発のときに発動</span></div>
    ${plates || '<p class="fine" style="margin:0">まだありません。一緒に出るほど連携が上がり、条件を満たすと発動します。</p>'}${over}
    ${near ? `<div class="lk-wait">${near}</div>` : ''}
  </section>`;
}
// the player sheet: his best partners at his club (bar = 連携, minutes together, the combo they make in the XI)
function linkBlock(p) {
  const c = S.clubs[p.club]; if (!c || !c.tac || p.loan) return '';
  const ps = E.linkPartners(S, p).slice(0, 5);
  if (!ps.length) return p.club === S.my ? '<div><div class="eyebrow" style="margin-bottom:6px">相性のいい選手（連携）</div><p class="fine" style="margin:0">まだ一緒にピッチに立った選手がいません。試合に出るほど連携が上がります。</p></div>' : '';
  const L = E.linkEval(S, p.club, c.tac.form, c.tac.xi);
  const tags = q => L.combos.filter(it => ['hot', 'heart', 'wall', 'wings', 'mentor'].includes(it.k) && (it.who || []).includes(p.id) && it.who.includes(q)).map(it => `<span class="lk-tag">${esc(it.jp)}</span>`).join('');
  // yellow = the two make a combo in the XI now (as on the board), not just a high number
  const rows = ps.map(x => { const q = S.players[x.pid], tg = tags(q.id); return `<button class="lk-prow" data-act="player" data-id="${q.id}"><span class="lk-mag${uniPat(c.id)}" style="${uniVars(c.id)}">${q.num}</span><span class="nm"><b>${esc(q.short)}${tg}</b><span>${dpOf(q)}・一緒に約${(Math.round(x.m / 10) * 10).toLocaleString('ja-JP')}分</span></span><span class="lk-cbar${tg ? ' hi' : ''}"><i style="width:${Math.floor(x.v)}%"></i></span><span class="v">${Math.floor(x.v)}</span></button>`; }).join('');
  return `<div><div class="eyebrow" style="margin-bottom:6px">相性のいい選手（連携）</div><div class="lk-pl">${rows}</div><p class="fine" style="margin:8px 0 0">一緒にピッチに立つほど上がり、離れていると少しずつ下がります。</p></div>`;
}
// 戦術 (posture, counter, press, the extra instructions, substitutions): a summary plate on the tactics screen; the
// controls live in their own sheet so the board and the bench come one after the other
function planCard(c) {
  const t = c.tac, x = E.tacLabel(t);
  const subs = S.settings.autoSubs ? `おまかせ（${(E.SUB_RATE[S.settings.subRate] || E.SUB_RATE.mid).jp}）` : '自分で選ぶ';
  return `<button class="plancard" data-act="plan" aria-label="戦術を変更">
    <span class="pc-head"><span class="eyebrow">戦術</span><span class="pc-edit">変更<span aria-hidden="true">›</span></span></span>
    <dl class="pc-kv"><dt>攻撃の姿勢</dt><dd>${esc(E.mentLabel(t))}</dd><dt>プレス</dt><dd>${esc((E.PRESS[t.press] || E.PRESS.mid).jp)}</dd><dt>詳しい指示</dt><dd>${x ? esc(x) : '標準'}</dd>${S.settings.closeOut ? '<dt>逃げ切り</dt><dd>おまかせ</dd>' : ''}<dt>交代</dt><dd>${subs}</dd></dl>
  </button>`;
}
function sheetPlan() {
  const c = S.clubs[S.my];
  sheetState = { type: 'plan' };
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  openSheet(`<div class="eyebrow">${esc(c.short)}・${c.tac.form}</div><h2>戦術</h2>
    <div class="ctlrow"><label>攻撃の姿勢</label>${seg('ment', c.tac.ment, MENT_OPTS)}<span class="fine">${MENT_DESC[c.tac.ment] || ''}</span></div>
    <button class="toggle" role="switch" aria-checked="${!!c.tac.ctr}" data-act="ctr"><span><b>カウンターを狙う</b><br><span class="small muted">${CTR_DESC}</span></span><span class="sw"></span></button>
    <div class="ctlrow"><label>プレスの強度（高いほど中盤で優位、ただし消耗）</label>${seg('press', c.tac.press, [['low', '低'], ['mid', '中'], ['high', '高']])}</div>
    ${tacXBlock(E.tacX(c.tac), 't', nextOpp())}
    ${closeOutToggle(null)}
    <button class="toggle" role="switch" aria-checked="${!!S.settings.autoSubs}" data-act="autoSubs"><span><b>交代はおまかせ</b><br><span class="small muted">オフにすると試合中に自分で交代を選びます</span></span><span class="sw"></span></button>
    ${subRateCtl()}
    <p class="fine" style="margin:0">変えた内容はすぐに反映されます。試合中も「采配」から変えられます。</p>`,
    '<button class="btn primary block" data-act="closeSheet">閉じる</button>');
}
// the bench as magnets on the board, three to a row: number magnet in the club's colours, name, position, age, rating,
// condition; × = can't play (injury / suspension), ! = tired
function benchTile(p, c) {
  const out = !avail(p), tired = !out && p.cond < 70;
  const st = out ? `<span class="chip warn">${p.inj > 0 ? `負傷 ${p.inj}日` : '出場停止'}</span>` : p.hot ? '<span class="chip fire">燃えている</span>' : '';
  return `<button class="btile${out ? ' out' : ''}${p.hot ? ' hot' : ''}" role="listitem" data-act="benchPick" data-id="${p.id}" aria-label="ベンチ ${esc(p.name)} ${dpOf(p)} 能力${E.ovr(p)}${out ? ' ' + outShort(p) : ''}">
    <span class="bt-ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${p.reborn ? '<span class="bt-rb">転生</span>' : ''}
    <span class="bt-mag uni-b${tired ? ' warn' : ''}">${uniSvg(out ? OUT_KIT : uniOf(c.id), { num: p.num })}</span>
    <b class="bt-name">${esc(p.name)}</b>
    <span class="bt-meta">${posTag(p)}${E.age(p, S.date)}歳</span>
    ${st ? `<span class="bt-st">${st}</span>` : condBar(p.cond)}
  </button>`;
}
function sheetBench(outId) {
  const c = S.clubs[S.my]; const o = S.players[outId];
  sheetState = { type: 'bench', id: outId || 0 };
  const reserves = E.squad(S, S.my).filter(p => !c.tac.xi.includes(p.id) && !c.tac.bench.includes(p.id))
    .sort((a, b) => (avail(b) - avail(a)) || (POS_ORD[a.pos] - POS_ORD[b.pos]) || b.ovr - a.ovr);
  const row = p => {
    const av = avail(p);
    const st = !av ? (p.inj > 0 ? `<span class="chip warn">負傷 ${p.inj}日</span>` : '<span class="chip warn">出場停止</span>') : susElse(p);
    return `<li><button class="prow" data-act="benchIn" data-id="${p.id}" ${av ? '' : 'disabled style="opacity:.5"'}><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, S.date)}歳・${Math.round(p.cond)}% ${st}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span>${condBar(p.cond)}</span></button></li>`;
  };
  const head = o ? `<div class="eyebrow">ベンチの入れ替え</div><h2>${esc(o.name)}（${dpOf(o)}・${E.ovr(o)}）と入れ替える選手</h2>${avail(o) ? '' : `<p class="small" style="color:var(--loss);margin:0">${esc(o.short)}は${outText(o)}のため、この試合には出られません。</p>`}`
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
    .sort((a, b) => (avail(b.p) - avail(a.p)) || b.e - a.e);
  const cur = c.tac.xi[i];
  openSheet(`<div class="eyebrow">ポジション</div><h2>${E.ROLE[role].jp} に起用する選手</h2>
    <p class="fine">右の数字はこの位置での実力（能力・適性・疲労・調子を反映）。適性は本職=100。</p>
    <ul class="list">${cands.map(({ p, e }) => {
      const j = c.tac.xi.indexOf(p.id); const av = avail(p);
      const st = !av ? (p.inj > 0 ? `<span class="chip warn">負傷 ${p.inj}日</span>` : '<span class="chip warn">出場停止</span>') : j >= 0 ? `<span class="chip ok">${E.ROLE[E.FORMATIONS[c.tac.form][j][0]].jp}で先発</span>` : c.tac.bench.includes(p.id) ? '<span class="chip">ベンチ</span>' : '';
      const st2 = av ? susElse(p) : '';
      return `<li><button class="prow" data-act="assign" data-i="${i}" data-id="${p.id}" ${av ? '' : 'disabled'} style="${p.id === cur ? 'background:color-mix(in srgb,var(--accent-bg) 14%,transparent)' : ''}${av ? '' : ';opacity:.5'}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>能力 ${E.ovr(p)}・適性 ${Math.round(E.roleApt(p, role))}・${Math.round(p.cond)}% ${p.hot ? '<span class="chip fire">燃えている</span>' : ''}${st}${st2}</span></span><span class="rt"><span class="ovr ${oc(e)}">${Math.round(e)}</span></span></button></li>`;
    }).join('')}</ul>`, '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- league ---------- */
function curRound() { const nx = S.fixtures.filter(f => !f.cup && !f.played && (f.h === S.my || f.a === S.my)).sort((a, b) => a.date.localeCompare(b.date))[0]; return nx ? nx.r : 38; }
// a cup: my status, then every round (ties, results, dates)
function cupFxRow(f, note) {
  const w = f.played ? E.cupWinner(f) : null;
  return `<li><button class="fx ${f.h === S.my || f.a === S.my ? 'me' : ''}" style="width:100%" data-act="fxDetail" data-id="${f.id}"><span class="h ${w === f.h ? 'win' : ''}">${esc(S.clubs[f.h].short)}${inJ1(f.h) ? '' : '<small>J2</small>'}${kit(f.h, 'sm')}</span><span class="sc ${f.played ? '' : 'pending'}">${f.played ? `${f.hg}-${f.ag}${f.pk ? `<small>PK${f.pk[0]}-${f.pk[1]}</small>` : ''}` : jd(f.date)}</span><span class="a ${w === f.a ? 'win' : ''}">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}${inJ1(f.a) ? '' : '<small>J2</small>'}</span></button>${note ? `<div class="fx-note">${note}</div>` : ''}</li>`;
}
function cupView() {
  const key = UI.lg.cup || 'ec'; const cu = S.cups && S.cups[key];
  const seg = `<div class="seg">${Object.entries(E.CUPS).map(([k, x]) => `<button data-act="cupPick" data-k="${k}" aria-pressed="${key === k}">${x.jp}</button>`).join('')}</div>`;
  if (!cu) return seg + '<p class="fine">今季のカップ戦は開催されていません。次のシーズンから始まります。</p>';
  if (key === 'lc' && E.lcNew(cu)) return seg + lcView(cu);
  const C = E.cupNames(S, key);
  const my = E.cupResult(S, key, S.my);
  const last = C.rounds.length - 1;
  const head = `<section class="card cuphead"><div class="row"><div class="eyebrow">${S.cups.season}/${String((S.cups.season + 1) % 100).padStart(2, '0')} ${C.jp}</div><span class="spacer"></span>${cu.champ ? `<span class="chip ok">優勝 ${esc(S.clubs[cu.champ].short)}</span>` : `<span class="chip">${esc(C.rounds[cu.r])}</span>`}</div>
    <div class="row"><b>${esc(S.clubs[S.my].short)}</b><span class="chip ${my === '優勝' ? 'ok' : my === '勝ち残り' ? 'acc' : ''}">${esc(my || '—')}</span></div>
    <p class="fine" style="margin:0">${key === 'ec' ? 'J1の20クラブとJ2の12クラブによるトーナメント。' : 'J1の20クラブによるトーナメント。下位8クラブが1回戦から、残りはラウンド16から登場。'}一発勝負で、90分で決着がつかなければPK戦。決勝は国立競技場。優勝賞金 ${E.money(E.CUP_PRIZE.win)}。</p></section>`;
  const rounds = C.rounds.map((rn, i) => {
    const fx = S.fixtures.filter(f => f.cup === key && f.cr === i);
    const date = cu.dates[i];
    const list = fx.length ? `<ul class="list">${fx.map(f => cupFxRow(f)).join('')}</ul>` : `<p class="fine" style="margin:0">組み合わせは前のラウンドが終わってから決まります。</p>`;
    const seeds = key === 'lc' && i === 1 && cu.bye && !fx.length ? `<div class="row wrap">${cu.bye.map(id => `<span class="chip">${kit(id, 'sm')}${esc(S.clubs[id].short)}</span>`).join('')}</div><p class="fine" style="margin:0">シードの${cu.bye.length}クラブは、ここから登場します。</p>` : '';
    return `<h3 class="sec-h">${esc(rn)}<small>${jdw(date)}${i === last ? '・国立' : ''}</small></h3>${seeds}${list}`;
  }).join('');
  return seg + head + rounds;
}
/* Lカップ (2026/27〜, as the real ルヴァンカップ): the プライムラウンド (two-legged quarter- and semi-finals, the final at 国立)
   and the 1stラウンド by group (four groups of J1 and J2 clubs; last season's 3rd〜6th start in the 4回戦) */
function lcView(cu) {
  const C = E.CUPS.lc, d = cu.dates, my = E.cupResult(S, 'lc', S.my);
  const chipsOf = ids => `<div class="row wrap">${ids.map(id => `<span class="chip">${kit(id, 'sm')}${esc(S.clubs[id].short)}</span>`).join('')}</div>`;
  const head = `<section class="card cuphead"><div class="row"><div class="eyebrow">${S.cups.season}/${String((S.cups.season + 1) % 100).padStart(2, '0')} ${C.jp}</div><span class="spacer"></span>${cu.champ ? `<span class="chip ok">優勝 ${esc(S.clubs[cu.champ].short)}</span>` : `<span class="chip">${esc(C.rounds[cu.r])}</span>`}</div>
    <div class="row"><b>${esc(S.clubs[S.my].short)}</b><span class="chip ${my === '優勝' ? 'ok' : my === '勝ち残り' ? 'acc' : ''}">${esc(my || '—')}</span></div>
    <p class="fine" style="margin:0">J1とJ2のクラブによる大会。<b>1stラウンド</b>は4つのグループに分かれた一発勝負で、下のリーグのクラブがホーム。前季3〜6位のクラブは4回戦から登場。<b>プライムラウンド</b>は1stラウンドを勝ち抜いた6クラブと前季1・2位の8クラブ。準々決勝・準決勝はホーム＆アウェイ（2試合の合計得点、同点なら第2戦のあとにPK戦）、決勝は国立競技場。優勝賞金 ${E.money(E.CUP_PRIZE.win)}。</p></section>`;
  const fx = r => S.fixtures.filter(f => f.cup === 'lc' && f.st && f.cr === r);
  // the プライムラウンド: ties with both legs, then the final
  const ties = r => {
    const list = fx(r).filter(f => f.leg === 1);
    if (!list.length) return '<p class="fine" style="margin:0">組み合わせは前のラウンドが終わってから決まります。</p>';
    return `<ul class="list">${list.map(f1 => {
      const f2 = S.fixtures.find(x => x.tie === f1.tie && x.leg === 2);
      const agg = E.tieAgg(S, f1), w = f2 && f2.played ? E.cupWinner(f2) : null;
      const note = f2 && f2.played ? `2試合合計 ${esc(S.clubs[f1.h].short)} ${agg[f1.h] || 0}-${agg[f1.a] || 0} ${esc(S.clubs[f1.a].short)}${f2.pk ? '（PK戦）' : ''}・<b>${esc(S.clubs[w].short)}</b>が勝ち抜け` : '';
      return cupFxRow(f1, `第1戦・${jdw(f1.date)}`) + (f2 ? cupFxRow(f2, `第2戦・${jdw(f2.date)}${note ? '・' + note : ''}`) : '');
    }).join('')}</ul>`;
  };
  const fin = fx(5)[0];
  const prime = `<h3 class="sec-h">準々決勝<small>${jdw(d.qf[0])}・${jdw(d.qf[1])}</small></h3>${!fx(3).length && cu.prime ? chipsOf(cu.prime) + '<p class="fine" style="margin:0">前季1・2位の2クラブは、ここから登場します。</p>' : ''}${ties(3)}
    <h3 class="sec-h">準決勝<small>${jdw(d.sf[0])}・${jdw(d.sf[1])}</small></h3>${ties(4)}
    <h3 class="sec-h">決勝<small>${jdw(d.f)}・国立</small></h3>${fin ? `<ul class="list">${cupFxRow(fin)}</ul>` : '<p class="fine" style="margin:0">準決勝が終わると決まります。</p>'}
    <p class="fine" style="margin:0">決勝の日付は実際の日程が未発表のため仮のものです。</p>`;
  // the 1stラウンド by group (the 4回戦 of last season's 3rd〜6th apart)
  const rn = f => `${C.rounds[f.cr]}・${jdw(f.date)}`;
  const groups = cu.groups.map((g, gi) => {
    const list = S.fixtures.filter(f => f.cup === 'lc' && f.st === 1 && f.grp === gi).sort((a, b) => a.cr - b.cr || a.date.localeCompare(b.date));
    const win = cu.r > 2 ? g.find(id => cu.alive.includes(id) || cu.champ === id || (cu.out[id] != null && cu.out[id] >= 3)) : null;
    return `<div class="eyebrow" style="margin:10px 0 6px">グループ${'ABCD'[gi]}${win ? `　勝者 ${esc(S.clubs[win].short)}` : ''}</div>${list.length ? `<ul class="list">${list.map(f => cupFxRow(f, rn(f))).join('')}</ul>` : chipsOf(g)}`;
  }).join('');
  const afc = S.fixtures.filter(f => f.cup === 'lc' && f.grp === 'afc');
  const first = `<h3 class="sec-h">2回戦〜4回戦<small>${jdw(d.r[0])}・${jdw(d.r[1])}・${jdw(d.r[2])}</small></h3>${groups}
    <div class="eyebrow" style="margin:10px 0 6px">4回戦から（前季3〜6位）</div><ul class="list">${afc.map(f => cupFxRow(f, rn(f))).join('')}</ul>`;
  const stage = (t, body) => `<h3 class="sec-h" style="font-size:16px">${t}</h3>${body}`;
  return head + (cu.r >= 3 ? stage('プライムラウンド', prime) + stage('1stラウンド', first) : stage('1stラウンド', first) + stage('プライムラウンド', prime));
}
function viewLeague() {
  const v = UI.lg.view; let body = '';
  if (v === 'table') {
    const t = E.table(S); const n = t.length;
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th style="text-align:left">クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得失</th><th>勝点</th></tr></thead><tbody>${t.map((r, i) => {
      const z = i === 0 ? 'z-champ' : i < 3 ? 'z-top' : i >= n - 3 ? 'z-rel' : '';
      return `<tr class="${z} ${r.id === S.my ? 'me' : ''}" data-act="team" data-id="${r.id}" tabindex="0" role="button" aria-label="${esc(S.clubs[r.id].name)}の情報"><td>${i + 1}</td><td class="club"><div>${kit(r.id, 'sm')}${esc(S.clubs[r.id].short)}</div></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="legend"><span><i style="background:var(--accent-bg)"></i>優勝</span><span><i style="background:var(--zone-top)"></i>上位</span><span><i style="background:var(--loss)"></i>J2降格</span><span class="spacer"></span><span>クラブをタップで詳しい情報</span></div>`;
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
/* 他チーム情報 (2026-10-13): a club's sheet — standing, strength next to mine, how they play (shape and likely XI on a
   board), our meetings this season, who to watch, and the whole squad. Opened from the tables, the home ticket, the
   pre-match sheet and match details. back = the sheet to return to ({type:'pre', id}). */
function sheetTeam(cid, tab, back) {
  const c = S.clubs[cid]; if (!c) return;
  tab = tab === 'squad' ? 'squad' : 'info';
  sheetState = { type: 'team', id: cid, tab, back: back || null };
  const t = E.table(S); const ri = t.findIndex(r => r.id === cid); const row = ri >= 0 ? t[ri] : null;
  const j1 = inJ1(cid);
  const head = `<div class="team-head">${kitTag(cid, c, 'lg')}<div style="min-width:0"><div class="eyebrow">${esc(c.area || '')}・${j1 ? 'J1' : c.ab ? esc(c.ab.lg) : 'J2'}${c.coach ? `・監督 ${esc(c.coach)}` : ''}</div><h2>${esc(c.name)}</h2></div></div>`;
  const tabs = `<div class="seg" role="tablist">${[['info', '概要'], ['squad', `選手（${E.squad(S, cid).length}人）`]].map(([k, l]) => `<button data-act="teamTab" data-k="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'squad') {
    const ps = E.squad(S, cid).sort((a, b) => (POS_ORD[a.pos] - POS_ORD[b.pos]) || (DP_ORD(a) - DP_ORD(b)) || b.ovr - a.ovr);
    const xi = new Set(c.tac.xi);
    body = `<ul class="list">${ps.map(p => `<li><button class="prow" data-act="teamPlayer" data-id="${p.id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.age(p, S.date)}歳 ${natChip(p)}${xi.has(p.id) ? '<span class="chip ok">主力</span>' : ''}${p.inj > 0 ? '<span class="chip warn">負傷</span>' : ''}${p.st.g ? `<span class="chip">${p.st.g}得点</span>` : ''}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></span></button></li>`).join('')}</ul>
      <p class="fine" style="margin:0">選手をタップすると詳しい情報（と移籍金の提示）が見られます。「主力」は直近の試合の先発です。</p>`;
  } else {
    const parts = [];
    if (row) {
      const gd = row.gf - row.ga;
      parts.push(`<div class="team-rank"><div><small>順位</small><b>${row.p ? `${ri + 1}<i>位</i>` : '—'}</b></div><div><small>勝点</small><b>${row.pts}</b></div><div><small>勝-分-敗</small><b class="rec">${row.w}-${row.d}-${row.l}</b></div><div><small>得失点</small><b>${gd > 0 ? '+' : ''}${gd}</b></div></div>
        <div class="row small muted">直近の結果 <span class="formline">${formChips(row.form.slice(-5))}</span><span class="spacer"></span>開幕前予想 ${c.pred || '—'}位</div>`);
    } else parts.push(`<p class="small muted" style="margin:0">${c.ab ? `${esc(c.ab.lg)}のクラブ` : 'J2のクラブ'}です。${S.cups && S.cups.ec && S.cups.ec.alive.includes(cid) ? '天皇杯を勝ち残っています。' : ''}</p>`);
    if (cid !== S.my && !c.ab) {
      const me = E.clubRating(S, S.my), op = E.clubRating(S, cid);
      const bar = (lab, a, b) => { const mx = Math.max(a, b, 1); return `<div class="cmp"><b class="l">${a.toFixed(0)}</b><span class="bar bl"><i style="width:${Math.max(8, 100 - (mx - a) * 9)}%;background:var(--accent-bg)"></i></span><span class="lab">${lab}</span><span class="bar"><i style="width:${Math.max(8, 100 - (mx - b) * 9)}%;background:var(--muted)"></i></span><b>${b.toFixed(0)}</b></div>`; };
      const gap = E.power(S, cid) - E.power(S, S.my);
      parts.push(`<div style="display:grid;gap:8px"><div class="row small"><b>${esc(S.clubs[S.my].short)}</b><span class="spacer"></span><span class="muted">チーム力の比較</span><span class="spacer"></span><b>${esc(c.short)}</b></div>${bar('攻撃', me.att, op.att)}${bar('中盤', me.mid, op.mid)}${bar('守備', me.def, op.def)}
        <p class="fine" style="margin:0">${gap >= 3 ? '格上の相手。守備的な戦い方やカウンターが有効です。' : gap <= -3 ? '格下の相手。主導権を握って押し込みたい。' : '力は互角。'}クラブの格 ${presBadge(c)} ${E.presLabel(c.pres)}</p></div>`);
    }
    if (!c.ab && c.tac.xi.some(Boolean)) {
      const F = E.FORMATIONS[c.tac.form];
      const toks = F.map((s, i) => { const p = S.players[c.tac.xi[i]]; if (!p) return ''; return `<button class="tok" style="left:${s[1]}%;top:${88 - (s[2] - 7) * 1.04}%;${uniVars(cid)}" data-act="teamPlayer" data-id="${p.id}" aria-label="${E.ROLE[s[0]].jp} ${esc(p.name)}">${tokShirt(cid, p.num, '')}<span class="lbl">${esc(p.short)}</span><span class="ov">${E.ROLE[s[0]].jp}・${E.ovr(p)}</span></button>`; }).join('');
      const plan = [E.mentLabel(c.tac), E.tacLabel(c.tac)].filter(Boolean).join('・');
      parts.push(`<div style="display:grid;gap:8px"><div class="row"><div class="eyebrow">戦い方</div><span class="spacer"></span><b class="small">${c.tac.form}${cid !== S.my && j1 ? `・${esc(plan)}` : ''}</b></div>
        <div class="pitch team-pitch">${PITCH_SVG}${toks}</div>
        <p class="fine" style="margin:0">${esc(E.FORM_DESC[c.tac.form] || '')}${cid !== S.my ? '並びは直近の先発。試合ごとの戦い方は当日の朝に決まります（試合前の画面で確認できます）。' : ''}</p></div>`);
    }
    // our meetings this season
    if (cid !== S.my) {
      const fx = S.fixtures.filter(f => (f.h === cid && f.a === S.my) || (f.a === cid && f.h === S.my)).sort((a, b) => a.date.localeCompare(b.date));
      if (fx.length) parts.push(`<div><div class="eyebrow" style="margin-bottom:6px">今季の対戦</div><ul class="list">${fx.map(f => { const w = f.played ? (f.cup ? E.cupWinner(f) : f.hg > f.ag ? f.h : f.hg < f.ag ? f.a : null) : null; const r = !f.played ? '' : w === S.my ? '<span class="res res-W">勝</span>' : w ? '<span class="res res-L">敗</span>' : '<span class="res res-D">分</span>'; return `<li><button class="fx ${f.played ? '' : 'next'}" style="width:100%" data-act="fxDetail" data-id="${f.id}"><span class="h">${esc(S.clubs[f.h].short)}${kit(f.h, 'sm')}</span><span class="sc ${f.played ? '' : 'pending'}">${f.played ? `${f.hg}-${f.ag}${f.pk ? `<small>PK${f.pk[0]}-${f.pk[1]}</small>` : ''}` : jd(f.date)}</span><span class="a">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}${r}</span></button><div class="fx-note">${E.fxLabel(f)}・${f.played ? '' : jdw(f.date) + '・'}${esc(venueOf(f))}</div></li>`; }).join('')}</ul></div>`);
    }
    // who to watch: top scorers this season and the best players
    const sq = E.squad(S, cid);
    const scorers = sq.filter(p => p.st.g > 0).sort((a, b) => b.st.g - a.st.g || b.st.a - a.st.a).slice(0, 3);
    const best = sq.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5);
    const prow2 = (p, note) => `<li><button class="prow" data-act="teamPlayer" data-id="${p.id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${note}${p.hot ? '<span class="chip fire">燃えている</span>' : ''}${p.inj > 0 ? `<span class="chip warn">負傷 ${p.inj}日</span>` : ''}${susChip(p)}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></span></button></li>`;
    if (scorers.length) parts.push(`<div><div class="eyebrow" style="margin-bottom:6px">得点源</div><ul class="list">${scorers.map(p => prow2(p, `${p.st.g}得点 ${p.st.a}アシスト・${p.st.apps}試合`)).join('')}</ul></div>`);
    parts.push(`<div><div class="eyebrow" style="margin-bottom:6px">主力選手</div><ul class="list">${best.map(p => prow2(p, `${E.age(p, S.date)}歳 ${natChip(p)}`)).join('')}</ul></div>`);
    if (!c.ab) parts.push(`<dl class="kv"><dt>ホーム</dt><dd>${esc(c.stadium || '—')}</dd><dt>タイトル</dt><dd>${titlesText(c)}${c.o10 ? '・Jリーグ創設メンバー' : ''}</dd></dl>`);
    body = parts.join('');
  }
  const backBtn = back && back.type === 'pre' ? `<button class="btn ghost" data-act="teamBack">試合前の画面に戻る</button>` : '';
  openSheet(`${head}${tabs}${body}`, backBtn ? `<div class="grid2">${backBtn}<button class="btn ghost" data-act="closeSheet">閉じる</button></div>` : '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function sheetFixture(id) {
  const f = S.fixtures.find(x => x.id === id); if (!f) return;
  sheetState = { type: 'fx', id };
  const H = S.clubs[f.h], A = S.clubs[f.a];
  const goals = (f.sc || []).filter(e => e[2] === 'g');
  const line = side => goals.filter(e => e[1] === side).map(e => `<div>${e[0] > 90 ? '90+' + (e[0] - 90) : e[0]}' ${esc(S.players[e[3]] ? S.players[e[3]].name : '—')}</div>`).join('') || '<div class="muted">—</div>';
  openSheet(`<div class="eyebrow">${E.fxLabel(f)}・${jdw(f.date)}</div>
    <div class="sb" style="margin:0"><div class="team"><button class="teamlink" data-act="team" data-id="${f.h}">${esc(H.short)}</button><span class="kitline" style="background:${uniBar(matchKits(f.h, f.a).h)}"></span></div><div><div class="score">${f.played ? `${f.hg}-${f.ag}` : 'vs'}</div><div class="clock">${f.played ? (f.pk ? `PK ${f.pk[0]}-${f.pk[1]}` : f.agg ? `合計 ${f.agg[0]}-${f.agg[1]}` : 'FULL TIME') : jd(f.date)}</div></div><div class="team"><button class="teamlink" data-act="team" data-id="${f.a}">${esc(A.short)}</button><span class="kitline" style="background:${uniBar(matchKits(f.h, f.a).a)}"></span></div></div>
    ${f.played ? `<div class="scorers"><div>${line('h')}</div><div>${line('a')}</div></div><dl class="kv"><dt>会場</dt><dd>${esc(venueOf(f))}</dd><dt>入場者数</dt><dd>${(f.att || 0).toLocaleString('ja-JP')}人</dd></dl>` : `<dl class="kv"><dt>会場</dt><dd>${esc(venueOf(f))}</dd></dl>`}`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}

/* ---------- club ---------- */
function viewClub() {
  const v = UI.cl.view; let body = '';
  const c = S.clubs[S.my];
  if (v === 'main') {
    const fin = c.fin; const inc = fin.gate + fin.spon + (fin.dist || 0) + fin.prize + Math.max(0, fin.trans); const exp = fin.wages + fin.fac + (fin.up || 0) + (fin.camp || 0) + Math.max(0, -fin.trans);
    const wages = E.squad(S, S.my).reduce((a, p) => a + E.wage(p), 0);
    body = `<section class="card" style="display:grid;gap:10px">
        <div class="row"><div class="eyebrow">フロントの信頼</div><span class="spacer"></span><b class="tnum">${S.board} / 100</b></div>
        <div class="meter"><i style="left:${S.board}%"></i></div>
        <dl class="kv"><dt>今季の目標</dt><dd>${esc(c.target.jp)}</dd><dt>開幕前の予想</dt><dd>${c.pred}位</dd><dt>現在</dt><dd>${rankOf(S.my)}${rankOf(S.my) === '—' ? '' : '位'}</dd></dl>
        <p class="fine">試合ごとに、戦力から見込まれる勝点を上回れば上がり、下回れば下がります。シーズン終了時は目標の順位との差で増減します。信頼が尽きると解任、J2降格でも解任です。</p>
        ${boardLvCtl()}
      </section>
      ${secCard()}
      <section class="card" style="display:grid;gap:8px">
        <div class="row"><div class="eyebrow">クラブの格</div><span class="spacer"></span>${presBadge(c)}<b>${E.presLabel(c.pres)}</b></div>
        <div class="small">${titlesText(c)}${c.o10 ? '・Jリーグ創設メンバー' : ''}</div>
        <p class="fine">格が高いほど試合終盤に粘り強く、選手も移籍に応じやすくなります。その分フロントの期待も高くなります。リーグ優勝や上位で上がり、降格で下がります。直近15年（2011年以降）のタイトルは上乗せして評価しています。天皇杯とアジアのタイトルは前身チーム時代を含みます。</p>
      </section>
      ${sponCard('club')}
      <section class="card" style="display:grid;gap:10px">
        <div class="row"><div class="eyebrow">資金</div><span class="spacer"></span><b style="font-family:var(--f-display);font-weight:400;font-size:22px" class="${c.funds < 0 ? 'o-low' : ''}">${E.money(c.funds)}</b></div>
        <dl class="kv"><dt>入場料収入</dt><dd>${E.money(fin.gate)}</dd><dt>スポンサー収入</dt><dd>${E.money(fin.spon)}</dd><dt>配分金（Jリーグ）</dt><dd>${E.money(fin.dist || 0)}</dd><dt>賞金</dt><dd>${E.money(fin.prize)}</dd><dt>移籍収支</dt><dd>${fin.trans >= 0 ? '+' : ''}${E.money(fin.trans)}</dd><dt>人件費</dt><dd>-${E.money(fin.wages)}</dd><dt>施設・建設</dt><dd>-${E.money(fin.fac)}</dd><dt>維持費</dt><dd>-${E.money(fin.up || 0)}</dd>${fin.camp ? `<dt>キャンプ</dt><dd>-${E.money(fin.camp)}</dd>` : ''}</dl>
        <div class="small muted">今季の収支 ${inc - exp >= 0 ? '+' : ''}${E.money(inc - exp)}　／　年俸総額 ${E.money(wages)}・月のスポンサー収入 ${(m => E.money(m.base + m.guar))(E.sponMonth(S))}・月の維持費 ${E.money(E.townUpkeep(c))}</div>
      </section>
      <h3 class="sec-h">施設とスタジアム</h3>
      ${townLink()}
      <h3 class="sec-h">スカウト<small>若手の発掘</small></h3>
      ${S.scout ? `<section class="card"><div class="row"><span class="chip acc">派遣中</span><b>${esc(E.SCOUT[S.scout.key].jp)}</b><span class="spacer"></span><span class="small muted">${jd(S.scout.back)}ごろ戻る</span></div></section>`
        : `<ul class="list">${Object.entries(E.SCOUT).map(([k, x]) => `<li><div class="row" style="padding:12px;gap:12px"><div style="flex:1;min-width:0"><b>${esc(x.jp)}</b><div class="small muted">${esc(x.sub)}・${x.days}日</div></div><button class="btn" data-act="scout" data-k="${k}" ${c.funds < x.cost ? 'disabled' : ''}>派遣<br><span class="small">${E.money(x.cost)}</span></button></div></li>`).join('')}</ul>`}
      <p class="fine">スカウトは有望な若手を3人見つけてきます。フリーの選手なので契約金だけで獲得できます。スカウト網のレベルが高いほど伸びしろの大きい選手が見つかります。レポートは30日で期限切れになり、残った選手はほかのクラブへ行きます。</p>
      <h3 class="sec-h">ボードの見た目</h3>
      <div class="seg" role="group" aria-label="ボードの見た目">${[['chalk', '黒板（緑）'], ['white', 'ホワイトボード']].map(([k, l]) => `<button data-act="board" data-k="${k}" aria-pressed="${getBoard() === k}">${l}</button>`).join('')}</div>
      <h3 class="sec-h">データ</h3>
      <section class="card" style="display:grid;gap:8px"><dl class="kv"><dt>この端末</dt><dd>${UI.localOk === false ? '保存できません' : '自動保存中'}</dd><dt>クラウド</dt><dd class="phr">${Cloud.status === 'on' ? (Cloud.err ? '保存に失敗（' + esc(Cloud.err) + '）' : Cloud.last ? '保存済み ' + new Date(Cloud.last).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '有効（試合後に保存）') : Cloud.status === 'checking' ? '確認中' : 'なし（引き継ぎコードで<wbr>保管できます）'}</dd><dt>監督</dt><dd>${esc(S.manager)}</dd></dl>
      <div class="grid2"><button class="btn" data-act="exportOpen">コードを作る</button><button class="btn" data-act="importOpen">コードで復元</button></div>
      <p class="fine phr" style="margin:0">引き継ぎコードは、<wbr>別の端末や<wbr>ホーム画面版の<wbr>アプリに<wbr>セーブを<wbr>移すときに<wbr>使います。</p>
      <button class="btn danger block" data-act="askReset">はじめからやり直す</button></section>`;
  } else if (v === 'town') {
    body = viewTown();
  } else if (v === 'market') {
    const open = E.inWindow(S.date);
    const sl = E.shortlist(S);
    const mv = UI.mk.view === 'short' ? 'short' : 'find';
    body = `<section class="card" style="display:grid;gap:6px"><div class="row"><div class="eyebrow">移籍期間</div><span class="spacer"></span>${open ? `<span class="chip ok">オープン〜${jd(E.windowEnd(S.date))}</span>` : `<span class="chip">クローズ（次は${jd(E.nextWindowStart(S.date))}〜）</span>`}</div><div class="small muted">資金 ${E.money(c.funds)}・登録 ${E.squad(S, S.my).length}/40人。フリーの選手はいつでも契約できます。</div></section>
      <div class="seg" role="group" aria-label="移籍市場">${[['find', '選手を探す'], ['short', `ショートリスト${sl.length ? ` ${sl.length}` : ''}`]].map(([k, l]) => `<button data-act="mkView" data-k="${k}" aria-pressed="${mv === k}">${l}</button>`).join('')}</div>`;
    if (mv === 'short') body += sl.length
      ? `<ul class="list">${sl.map(shortRow).join('')}</ul><p class="fine">入札した選手が自動で入ります。獲得するとリストから外れます。選手をタップすると、もう一度入札したりリストから外したりできます。</p>`
      : '<p class="empty">まだ入札した選手はいません。「選手を探す」から選手を選んで移籍金を提示すると、ここにまとまります。</p>';
    else body += `
      <input class="input" id="mk-q" type="search" placeholder="選手名・クラブで検索" value="${esc(UI.mk.q)}" autocomplete="off">
      <div class="seg">${[['', '全員'], ['GK', 'GK'], ['DF', 'DF'], ['MF', 'MF'], ['FW', 'FW']].map(([k, l]) => `<button data-act="mkPos" data-k="${k}" aria-pressed="${UI.mk.pos === k}">${l}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="所属">${[['all', 'すべて'], ['j', 'Jリーグ'], ['ab', '海外組'], ['fa', 'フリー']].map(([k, l]) => `<button data-act="mkWhere" data-k="${k}" aria-pressed="${mkWhere() === k}">${l}</button>`).join('')}</div>
      ${MK_NOTE[mkWhere()] ? `<p class="fine" style="margin:-4px 0 0">${MK_NOTE[mkWhere()]}</p>` : ''}
      <ul class="list" id="mk-list">${marketRows()}</ul>`;
  } else {
    const h = S.history;
    body = `<h3 class="sec-h">監督としての歩み</h3>${h.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>季</th><th style="text-align:left">クラブ</th><th>順位</th><th>勝点</th><th style="text-align:left">優勝</th></tr></thead><tbody>${h.map(r => `<tr><td>${r.season.slice(2)}</td><td class="club"><div>${kit(r.club, 'sm')}${esc(S.clubs[r.club].short)}</div></td><td>${r.pos}</td><td>${r.pts}</td><td class="club"><div>${esc(S.clubs[r.champ].short)}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">最初のシーズンを戦っているところです。</p>'}
      ${h.some(r => r.ec || r.lc) ? `<h3 class="sec-h">カップ戦</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>季</th><th style="text-align:left">天皇杯</th><th style="text-align:left">Lカップ</th></tr></thead><tbody>${h.filter(r => r.ec || r.lc).map(r => `<tr><td>${r.season.slice(2)}</td><td style="text-align:left">${esc(r.ec || '—')}</td><td style="text-align:left">${esc(r.lc || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <h3 class="sec-h">今季のクラブ記録</h3>${clubRecords()}${ntRecords()}`;
  }
  return `${body}<div class="subnav"><div class="seg fit">${[['main', '経営'], ['town', 'ホームタウン'], ['market', '移籍市場'], ['records', '記録']].map(([k, l]) => `<button data-act="clView" data-k="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div></div>`;
}
/* 移籍交渉 (2026-10-14): the club's asking price (要求額), their situation, their patience (3 magnets), what was said,
   my offer (− / ＋ and three quick amounts), then 提示 or agree at the asking price. */
function ngStepOf(pr) { const t = pr * 0.05; return [10000, 5000, 3000, 2000, 1000, 500, 300, 200, 100].find(x => x <= t) || 100; }
const ngRound = (v, step) => Math.max(step, Math.round(v / step) * step);
// what my offer starts at: 90% of the asking price, after a counter halfway between my last offer and the new ask
function ngSuggest(n, step) {
  const mine = n.log.filter(x => x[0] === 'me'); const lastMe = mine.length ? mine[mine.length - 1][1] : null;
  const v = lastMe != null && n.log.length && n.log[n.log.length - 1][0] === 'club' ? (lastMe + n.ask) / 2 : n.ask * 0.9;
  return Math.min(n.ask, ngRound(v, step));
}
function ngLog(n, club) {
  const rows = n.log.slice(-6).map(([who, fee, d, kind]) => {
    const when = d !== S.date ? `<small>${jd(d)}</small>` : '';
    return who === 'me' ? `<li><span class="who">あなた</span><span>${E.money(fee)}を提示${when}</span></li>`
      : `<li><span class="who">${esc(club.short)}</span><span>${kind === 'low' ? `「話にならない」要求額 ${E.money(fee)}` : `「${E.money(fee)}なら応じる」`}${when}</span></li>`;
  });
  return rows.length ? `<ul class="ng-log">${rows.join('')}</ul>` : '<p class="fine">まだ提示していません。</p>';
}
function sheetNego(id, back) {
  const p = S.players[id]; if (!p) return closeSheet();
  const n = E.negoOf(S, id); if (!n) return sheetPlayer(id, back);
  sheetState = { type: 'nego', id, back: back || null };
  const club = S.clubs[p.club], pr = E.price(S, p), info = E.negoInfo(S, p), will = E.negoWill(S, p), step = ngStepOf(pr);
  if (!UI.ng || UI.ng.pid !== id) UI.ng = { pid: id, fee: ngSuggest(n, step) };
  const fee = UI.ng.fee = Math.min(n.ask, Math.max(step, UI.ng.fee));
  const chips = [info.role ? `<span class="chip">${info.role}</span>` : '', ...info.tags.map(t => `<span class="chip ${t.d > 0 ? 'acc' : 'ok'}">${esc(t.t)}</span>`),
    `<span class="chip ${['warn', '', 'ok'][will.lv]}">本人：${will.jp}</span>`].join('');
  const pat = Array.from({ length: E.NEGO.pat }, (_, i) => `<i class="${i < n.pat ? '' : 'off'}"></i>`).join('');
  const atAsk = fee >= n.ask;
  const body = `<div class="row">${kit(p.club, 'lg')}<div style="min-width:0"><div class="eyebrow">移籍交渉・${esc(club.name)}・〜${jd(n.until)}</div><h2>${esc(p.name)}</h2></div></div>
    <div class="card ng-card">
      <div class="ng-ask"><div><span class="eyebrow">${esc(club.short)}の要求額</span>${n.ask < n.ask0 ? `<s>${E.money(n.ask0)}</s>` : n.ask > n.ask0 ? `<small>最初 ${E.money(n.ask0)}</small>` : ''}</div><b>${E.money(n.ask)}</b></div>
      <dl class="kv"><dt>相場（市場価値）</dt><dd>${E.money(pr)}</dd><dt>使える資金</dt><dd>${E.money(S.clubs[S.my].funds)}</dd><dt>相手の我慢</dt><dd><span class="ng-pat" role="img" aria-label="我慢 ${n.pat}/${E.NEGO.pat}">${pat}</span></dd></dl>
      <div class="row wrap">${chips}</div>
    </div>
    <div><div class="eyebrow" style="margin-bottom:6px">やりとり</div>${ngLog(n, club)}</div>
    ${n.fin ? `<p class="ng-fin">今日はこれ以上下がらない（最終提示 ${E.money(n.ask)}）。合意するか、明日あらためて交渉できます。</p>`
      : `<div class="ng-step"><button class="btn" data-act="ngStep" data-d="-1" aria-label="${E.money(step)}下げる" ${fee <= step ? 'disabled' : ''}>−</button><div class="amt"><b>${E.money(fee)}</b><span>あなたの提示（相場の${(fee / pr).toFixed(2)}倍）</span></div><button class="btn" data-act="ngStep" data-d="1" aria-label="${E.money(step)}上げる" ${atAsk ? 'disabled' : ''}>＋</button></div>
      <div class="ng-quick">${[['v', '相場'], ['90', '要求額の90%'], ['95', '要求額の95%']].map(([k, l]) => `<button class="btn ghost" data-act="ngSet" data-k="${k}">${l}</button>`).join('')}</div>
      <p class="fine">要求額より低い額を出すと、相手は歩み寄るか据え置く。低すぎると我慢が2つ減り、要求額が上がる。我慢がなくなると、その日の要求額が最終提示（翌日に戻る）。</p>`}`;
  const nav = `<div class="grid2"><button class="btn ghost" data-act="ngBack" data-id="${id}">← 選手の情報</button><button class="btn ghost" data-act="closeSheet">閉じる</button></div>`;
  const foot = n.fin || atAsk ? `<button class="btn primary block" data-act="ngAgree" data-id="${id}">${E.money(n.ask)}で合意する</button>${nav}`
    : `<div class="grid2"><button class="btn ghost" data-act="ngAgree" data-id="${id}">${E.money(n.ask)}で合意</button><button class="btn primary" data-act="ngOffer" data-id="${id}">${E.money(fee)}を提示</button></div>${nav}`;
  openSheet(body, foot);
}
/* shortlist (players I bid on) */
function shortStatus(e, p, row) {  // row: the list shows the guide fee as a chip, so leave it out of the line
  const blk = E.bidBlock(S, p.id);
  const cl = S.clubs[e.club] ? S.clubs[e.club].short : 'クラブ';
  const res = e.res === 'club' ? (row || !e.guide ? `${esc(cl)}と交渉中` : `${esc(cl)}の要求額 ${E.money(e.guide)}`)
    : e.res === 'player' ? (blk && blk.why === 'player' ? `本人が移籍を断った（${jd(blk.until)}まで交渉不可）` : '本人が移籍を断った（今は再交渉できます）')
    : e.res === 'thin' ? `${esc(cl)}が放出を拒否（選手層が薄い）`
    : e.res === 'funds' ? '資金が足りず提示できなかった'
    : e.res === 'full' ? '登録上限（40人）で提示できなかった' : '';
  return `前回 ${jd(e.last)}${e.fee ? `・${E.money(e.fee)}` : ''}${e.n > 1 ? `・${e.n}回目` : ''}：${res}`;
}
function shortFoot(e, p) {
  return e ? `<div class="grid2"><button class="btn ghost" data-act="unshort" data-id="${p.id}">リストから外す</button><button class="btn ghost" data-act="closeSheet">閉じる</button></div>`
    : '<button class="btn ghost block" data-act="closeSheet">閉じる</button>';
}
function shortRow(e) {
  const p = S.players[e.pid]; const a = E.age(p, S.date);
  const club = S.clubs[p.club];
  const blk = E.bidBlock(S, p.id);
  const moved = e.club && e.club !== p.club ? `<span class="chip">${club ? esc(club.short) + 'へ移籍' : 'フリーに'}</span>` : '';
  const state = p.retire ? '<span class="chip">今季限りで引退</span>'
    : blk && blk.why === 'player' ? `<span class="chip warn">交渉不可〜${jd(blk.until)}</span>`
    : e.res === 'club' && e.guide ? `<span class="chip acc">要求額 ${E.money(e.guide)}</span>` : '';
  const lead = club ? kit(p.club) : '<span class="chip">FA</span>';
  return `<li><button class="prow" data-act="player" data-id="${p.id}">${lead}${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${club ? esc(club.short) : 'フリー'}・${a}歳・${E.money(E.value(p, S.date))} ${state}${moved}</span><span class="sl-last">${shortStatus(e, p, true)}</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></span></button></li>`;
}
const COUNTRY = { ENG: 'イングランド', ESP: 'スペイン', GER: 'ドイツ', FRA: 'フランス', ITA: 'イタリア', NED: 'オランダ', POR: 'ポルトガル', BEL: 'ベルギー', AUT: 'オーストリア', SCO: 'スコットランド', DEN: 'デンマーク', SUI: 'スイス', POL: 'ポーランド', SVK: 'スロバキア', SRB: 'セルビア', USA: 'アメリカ', CAN: 'カナダ' };
// which market: all / J.League / overseas Japanese players / free agents (old UI state: the 'free agents only' switch)
const mkWhere = () => UI.mk.where || (UI.mk.fa ? 'fa' : 'all');
const MK_NOTE = {
  ab: 'ヨーロッパとアメリカでプレーする日本人選手。移籍期間中に獲得できます。移籍金は高く、とくに若手や大きなリーグの主力はJリーグ復帰に慎重です。ベテランほど前向き。',
  fa: '移籍金なし・契約金のみ（架空の選手です）。いつでも契約できます。',
};
function marketRows() {
  let list = E.marketList(S, { pos: UI.mk.pos, q: UI.mk.q.trim(), where: mkWhere() });
  const n = list.length, lim = mkWhere() === 'ab' ? 120 : 60; list = list.slice(0, lim);
  return list.map(p => prow(p, 'market')).join('') + (n > lim ? `<li class="empty">ほか${n - lim}人。検索で絞り込めます。</li>` : '') || '<li class="empty">見つかりませんでした</li>';
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
  const iss = E.lineupIssues(S, S.my, E.compOf(f));
  c.tac.xi.forEach((id, i) => { const p = S.players[id]; if (!p || !avail(p)) return; if (p.cond < 70) warn.push(`${p.name}が疲れています（${Math.round(p.cond)}%）`); if (E.posPenalty(p, F[i][0]) <= -1.5) warn.push(`${p.name}は${E.ROLE[F[i][0]].jp}の適性が低め（${Math.round(E.roleApt(p, F[i][0]))}）`); });
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
    ${E.sponPending(S) ? spPreLine(fid) : ''}
    <div class="plans small"><div><b>${esc(c.short)}</b> ${c.tac.form}・${esc(E.mentLabel(c.tac))}${E.tacLabel(c.tac) ? '・' + esc(E.tacLabel(c.tac)) : ''}</div><div><b>${esc(o.short)}</b> ${o.tac.form}${o.tac.ment !== 'bal' || o.tac.ctr ? '・' + esc(E.mentLabel(o.tac)) : ''}${E.tacLabel(o.tac) ? '・' + esc(E.tacLabel(o.tac)) : ''}</div></div>
    ${preAtt(f)}
    <div style="display:grid;gap:8px">${row('攻撃', me.att, op.att)}${row('中盤', me.mid, op.mid)}${row('守備', me.def, op.def)}</div>
    ${preLink(me.link, op.link, o)}
    <button class="btn ghost block" data-act="team" data-id="${opp}" data-back="pre" data-fid="${fid}">${esc(o.short)}を詳しく見る</button>
    ${gap >= 3 && c.tac.ment !== 'def' && !c.tac.ctr ? '<p class="fine" style="margin:0">格上が相手です。「守備的」や「カウンターを狙う」で戦うと勝機が増えます（戦術画面）。</p>' : ''}
    ${fire}
    <div><div class="eyebrow" style="margin-bottom:6px">警戒する選手</div><div class="row wrap">${keys.map(p => `<span class="chip">${posTag(p, 'width:26px;height:16px;font-size:9px')}${esc(p.name)} ${E.ovr(p)}</span>`).join('')}</div></div>
    ${iss.block ? `<div class="card alert"><div class="eyebrow">このままでは試合に進めません</div><ul>${issueLines(iss).map(t => `<li>${esc(t)}</li>`).join('')}</ul>${(() => { const fx = E.secFix(S, E.compOf(f)); return fx.items.length ? secMagLine(fx) : ''; })()}<p class="fine" style="margin:6px 0 0">押すまでメンバーは変わりません。</p></div>` : ''}
    ${warn.length ? `<div class="card" style="padding:10px 12px"><div class="eyebrow" style="color:var(--loss)">メンバーの注意点</div><ul style="margin:6px 0 0;padding-left:18px;font-size:13px">${warn.slice(0, 5).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : iss.block ? '' : '<p class="fine">メンバーに問題はありません。</p>'}`,
    iss.block ? `<button class="btn primary block" data-act="secAll" style="min-height:54px;font-size:16px">おすすめどおりに入れ替える</button><div class="grid3"><button class="btn ghost" data-act="secOpen" data-back="pre" data-fid="${fid}">1人ずつ選ぶ</button><button class="btn ghost" data-act="toTactics">戦術画面へ</button><button class="btn ghost" data-act="closeSheet">閉じる</button></div>`
      : `<button class="btn primary block" data-act="kickoff" data-id="${fid}" style="min-height:54px;font-size:16px">キックオフ</button><div class="grid2"><button class="btn ghost" data-act="toTactics">戦術を調整</button><button class="btn ghost" data-act="quick" data-id="${fid}">結果だけ見る</button></div>`);
}
// 連携 and the combos for this match (both sides; the numbers above already include them)
function preLink(a, b, o) {
  if (!a || !b) return '';
  const cs = L => L.combos.length ? L.combos.map(it => esc(it.jp)).join('・') : 'なし';
  return `<div class="pre-lk"><span class="ic">${lkIc('link')}</span><span>連携 <b>${Math.round(a.avg)}</b>・コンボ <b>${cs(a)}</b><small>${esc(o.short)}：連携 ${Math.round(b.avg)}・コンボ ${cs(b)}</small></span></div>`;
}
// the crowd to expect (pre-match): at home with the ground's seats, away at theirs, the final at 国立
function preAtt(f) {
  const a = E.attEst(S, f); if (!a) return '';
  const where = f.neutral ? '国立競技場' : f.h === S.my ? 'ホーム' : `${esc(S.clubs[f.h].short)}のスタジアム`;
  return `<div class="pre-att">${htIc('crowd')}<span>観客の見込み <b>約${ppl(a.n)}人</b><small>${a.full ? '満員' : `${where} ${a.cap.toLocaleString('ja-JP')}席`}${a.works && f.h === S.my ? '・増築の工事中' : ''}</small></span></div>`;
}
const VERDICT = { champion: 'リーグ優勝！', met: '目標達成', near: 'あと一歩', missed: '目標未達', relegated: 'J2降格' };
function sheetSeasonEnd() {
  const se = S.seasonEnd; if (!se) return;
  sheetState = { type: 'season' };
  openSheet(`<div class="led"><div class="ln"><span>${se.label} FINAL</span><span>${esc(S.clubs[S.my].abbr || '')}</span></div><div class="ln"><span class="big">${se.myPos}位</span><span class="big">${se.pts}pt</span></div><div class="ln"><span>${VERDICT[se.verdict]}</span><span>目標 ${esc(se.target.replace(/（.*）/, ''))}</span></div></div>
    <dl class="kv"><dt>優勝</dt><dd>${esc(S.clubs[se.champ].name)}</dd><dt>J2降格</dt><dd>${se.rel.map(id => esc(S.clubs[id].short)).join('・')}</dd><dt>順位賞金</dt><dd>${E.money(se.prize)}</dd><dt>フロントの信頼</dt><dd>${S.board}</dd></dl>
    ${se.cups ? `<dl class="kv">${Object.entries(se.cups).map(([k, x]) => `<dt>${E.CUPS[k].jp}</dt><dd>${x.champ ? `優勝 ${esc(S.clubs[x.champ].short)}` : '—'}　<span class="muted">${esc(S.clubs[S.my].short)}：${esc(x.my || '—')}</span></dd>`).join('')}</dl>` : ''}
    ${sponReview(se.spon)}
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
  const cid = S.clubs[r.club] ? r.club : S.my, c = S.clubs[cid];
  const lines = FAREWELL[r.pos] || FAREWELL.MF;
  const msg = r.g >= 20 ? `${S.clubs[S.my].short}で${r.g}ゴール。${lines[0]}` : r.apps >= 60 ? `${S.clubs[S.my].short}で${r.apps}試合に出場。${lines[0]}` : lines[r.id % 2];
  const left = ret.length - i - 1;
  openSheet(`<div class="farewell" style="${uniVars(cid)}">
      <div class="fw-lights" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      <div class="fw-head"><span>${esc(se.label)}</span><span>${ret.length > 1 ? `${i + 1} / ${ret.length}` : 'FAREWELL'}</span></div>
      <div class="fw-shirt" aria-label="背番号${r.num}">${uniSvg(uniOf(cid), { num: r.num, font: 'var(--f-led)' })}</div>
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
// 転生: a legend of the club comes back as a 16-year-old. His old number re-ignites, the magnet snaps on, the seal lands.
const STY_JP = { tech: '技術型', phys: 'フィジカル型', speed: 'スピード型' };
function sheetReborn(id, again) {
  const p = S.players[id != null ? id : S.reborn && S.reborn.show]; const L = p && E.legendOf(p.reborn);
  if (!p || !L) { if (S.reborn) delete S.reborn.show; return; }
  sheetState = { type: 'reborn', id: p.id };
  const c = S.clubs[S.my];
  const ghost = L.num || p.num;
  const holder = L.num && p.num !== L.num ? E.squad(S, S.my).find(q => q.id !== p.id && q.num === L.num) : null;
  const sparks = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 61 + 7) % 100}%;animation-delay:${((i * 37) % 40) / 10}s;animation-duration:${3.2 + (i % 5) * 0.5}s"></i>`).join('');
  openSheet(`<div class="reborn${again ? ' again' : ''}" style="${uniVars(S.my)}">
      <div class="rb-rays" aria-hidden="true"></div><div class="rb-sparks" aria-hidden="true">${sparks}</div>
      <div class="rb-head"><span>REBORN</span><span>${esc(E.seasonLabel(S.season))}</span></div>
      <div class="rb-stage">
        <div class="rb-ghost" aria-hidden="true">${ghost}</div>
        <span class="rb-ring" aria-hidden="true"></span>
        <div class="rb-mag" aria-label="背番号${p.num}">${uniSvg(uniOf(S.my), { num: p.num, font: 'var(--f-display)' })}</div>
        <div class="rb-seal" aria-label="転生">転生</div>
      </div>
      <div class="rb-epi">「${esc(L.epi)}」の魂を継ぐ者</div>
      <h2 class="rb-name">${esc(p.name)}</h2>
      <div class="rb-sub">${E.age(p, S.date)}歳・${L.pp}${STY_JP[L.sty] ? '・' + STY_JP[L.sty] : ''}・${esc(c.short)} ユース</div>
      <div class="rb-past">
        <div class="rb-past-h"><span>${esc(L.era)}</span></div>
        <b>${L.num ? `伝説の背番号${L.num}` : `${esc(c.short)}のレジェンド`}</b>
        <p>${esc(L.line)}</p>
      </div>
      <div class="rb-stats"><div><small>総合力</small><b>${E.ovr(p)}</b></div><div><small>伸びしろ</small><b class="rb-stars">${potStars(p)}</b></div><div><small>特徴</small><b class="rb-trait">大舞台に強い</b></div></div>
      <p class="rb-note">${holder ? `背番号${L.num}はいま${esc(holder.name)}が着けている。` : L.num && p.num === L.num ? `伝説の背番号${L.num}が、ふたたびピッチに帰ってくる。` : 'その魂を受け継ぐ少年が、ユースから現れた。'}</p>
    </div>`,
    holder ? `<button class="btn primary block rb-go" data-act="rebornNum" data-id="${p.id}">背番号${L.num}を託す<small>${esc(holder.short)}は${p.num}番へ</small></button><button class="btn ghost block" data-act="rebornDone">いまの番号で迎え入れる</button>`
      : `<button class="btn primary block rb-go" data-act="rebornDone">チームに迎え入れる</button>`);
  const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = 0;
}
/* 優勝のお祝い (2026-10-13): the league title the moment it is certain, a cup the moment the final is won. A night stadium:
   gold rays, confetti in the club's colours, the trophy rises (a silver plate for the league, a gold cup for the cups),
   the club's magnet snaps on and 「優勝」 is stamped. Queue: S.cele (one pop-up each). */
const TROPHY = {
  j1: '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="ceS" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d9dee4"/><stop offset="1" stop-color="#8d96a1"/></radialGradient><linearGradient id="ceR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#7b8590"/></linearGradient></defs><circle cx="60" cy="60" r="56" fill="url(#ceR)"/><circle cx="60" cy="60" r="49" fill="url(#ceS)"/><circle cx="60" cy="60" r="41" fill="none" stroke="#9aa3ad" stroke-width="1.4"/><circle cx="60" cy="60" r="33" fill="none" stroke="#b3bac2" stroke-width="1" stroke-dasharray="2 3"/><path d="M60 38l6.1 12.4 13.7 2-9.9 9.6 2.3 13.6L60 69.2l-12.2 6.4 2.3-13.6-9.9-9.6 13.7-2z" fill="#f3cf7a" stroke="#b8862b" stroke-width="1.2"/><path d="M27 34a40 40 0 0 1 22-14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>',
  cup: '<svg viewBox="0 0 120 130" aria-hidden="true"><defs><linearGradient id="ceG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a6a12"/><stop offset=".3" stop-color="#ffe6a3"/><stop offset=".55" stop-color="#f3c45a"/><stop offset="1" stop-color="#8a5c0e"/></linearGradient><linearGradient id="ceB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#1a120a"/></linearGradient></defs><path d="M30 14h60v8c0 26-12 44-30 48-18-4-30-22-30-48z" fill="url(#ceG)"/><path d="M30 22c-14 0-20 8-18 18 2 11 12 18 22 19" fill="none" stroke="url(#ceG)" stroke-width="6" stroke-linecap="round"/><path d="M90 22c14 0 20 8 18 18-2 11-12 18-22 19" fill="none" stroke="url(#ceG)" stroke-width="6" stroke-linecap="round"/><rect x="54" y="70" width="12" height="18" fill="url(#ceG)"/><path d="M40 88h40l6 10H34z" fill="url(#ceG)"/><rect x="30" y="98" width="60" height="22" rx="3" fill="url(#ceB)"/><rect x="40" y="104" width="40" height="9" rx="2" fill="#d9b25a" opacity=".85"/><path d="M42 20c0 18 6 32 14 40" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/><ellipse cx="60" cy="15" rx="30" ry="4" fill="#fff2c4" opacity=".7"/></svg>',
};
function sheetCele() {
  const ce = S.cele && S.cele[0]; if (!ce) return;
  sheetState = { type: 'cele' };
  const c = S.clubs[S.my], u = uniOf(S.my);
  const league = ce.k === 'j1';
  const title = league ? 'J1リーグ' : E.CUPS[ce.k].jp;
  // confetti in the kit's colours (body, stripes, trim) and gold
  const kc = [...new Set([u.b, u.pc, u.t1, u.t2].filter(Boolean))];
  const colors = [kc[0], kc[1] || '#ffffff', '#f3cf7a', kc[2] || '#ffffff', kc[0], '#f3cf7a'];
  const conf = Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 37 + 11) % 100}%;background:${colors[i % colors.length]};animation-delay:${((i * 53) % 30) / 10 + 0.6}s;animation-duration:${3.4 + (i % 7) * 0.45}s;--r:${(i * 47) % 360}deg;--dx:${((i * 29) % 60) - 30}px"></i>`).join('');
  const opp = !league && S.clubs[ce.opp];
  const line = league
    ? (ce.left ? `${E.D.m(ce.d)}月${E.D.d(ce.d)}日、残り${ce.left}試合を残して優勝が決まった。` : '最後まで続いた争いを制し、頂点に立った。')
    : `決勝で${opp ? esc(opp.name) : ''}を${ce.my}-${ce.op}${ce.pk ? `（PK ${ce.pk[0]}-${ce.pk[1]}）` : ''}で下した。`;
  const stats = league
    ? `<div><small>勝点</small><b>${ce.pts}</b></div><div class="rec"><small>勝-分-敗</small><b class="sm">${ce.w}-${ce.dr}-${ce.l}</b></div><div><small>得失点</small><b>${ce.gf - ce.ga > 0 ? '+' : ''}${ce.gf - ce.ga}</b></div><div><small>2位と</small><b>${ce.gap}<i>差</i></b></div>`
    : `<div class="wide"><small>決勝・${esc(ce.venue || '')}</small><b class="sm">${esc(c.short)} ${ce.my}-${ce.op} ${opp ? esc(opp.short) : ''}${ce.pk ? `<i>PK ${ce.pk[0]}-${ce.pk[1]}</i>` : ''}</b></div>`;
  const goals = !league && ce.goals && ce.goals.length ? `<p class="ce-goals">得点　${ce.goals.map(g => `${esc(g.name)} ${g.m > 90 ? '90+' + (g.m - 90) : g.m}'`).join('、')}</p>` : '';
  const star = league && ce.top ? `<p class="ce-goals">チーム得点王　${esc(ce.top.name)}（${ce.top.g}得点）</p>` : '';
  const more = S.cele.length > 1;
  openSheet(`<div class="cele ${league ? 'ce-league' : 'ce-cup'}" style="${uniVars(S.my)}">
      <div class="ce-rays" aria-hidden="true"></div><div class="ce-conf" aria-hidden="true">${conf}</div>
      <div class="ce-head"><span>CHAMPIONS</span><span>${esc(E.seasonLabel(ce.season))}</span></div>
      <div class="ce-stage">
        <div class="ce-trophy">${league ? TROPHY.j1 : TROPHY.cup}</div>
        <div class="ce-mag" aria-hidden="true">${uniSvg(u, { star: true })}</div>
      </div>
      <div class="ce-title"><span>${title}</span><b>優勝</b></div>
      <h2 class="ce-club">${esc(c.name)}</h2>
      <p class="ce-line">${line}</p>
      <div class="ce-stats">${stats}</div>
      ${goals}${star}
      <div class="ce-foot"><span>クラブ${ce.n}度目の${league ? 'リーグ優勝' : title + '制覇'}</span><span>監督 ${esc(ce.mgr || S.manager)}</span></div>
    </div>`,
    `<button class="btn primary block ce-go" data-act="celeDone">${more ? '次へ' : '優勝を祝う'}</button>`);
  const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = 0;
}
const MENT_OPTS = [['def', '守備的'], ['bal', 'バランス'], ['att', '攻撃的']];
const MENT_DESC = {
  def: '引いて守る。失点は減るが得点も減る。格上が相手ほど効果が大きい。',
  bal: '攻守のバランスを取る標準の戦い方。',
  att: '前に出て押し込む。得点も失点も増えやすい。格下相手に。',
};
const CTR_DESC = 'ボールを奪ったら素早く攻める。チャンスは減るが決まりやすい。相手がボールを持つほど、攻めてくるほど効く。「守備的」と組み合わせるのが定番。';
const LINE_OPTS = [['low', '低い'], ['mid', '標準'], ['high', '高い']];
const BUILD_OPTS = [['long', 'ロングボール'], ['mix', '標準'], ['short', 'ポゼッション']];
const WIDTH_OPTS = [['wide', 'サイド'], ['mix', '標準'], ['center', '中央']];
// the extra instructions (守備ライン・組み立て・攻め方・マンマーク・時間を使う). scope t = tactics screen, m = during a match.
// ace: the player a man-marker would follow (next opponent / the opponent on the pitch now)
function tacXBlock(x, scope, ace) {
  const seg = (key, cur, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-act="tacx" data-s="${scope}" data-key="${key}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
  const tg = (key, on, title, sub) => `<button class="toggle" role="switch" aria-checked="${!!on}" data-act="tacx" data-s="${scope}" data-key="${key}" data-k="${on ? '' : '1'}"><span><b>${title}</b><br><span class="small muted">${sub}</span></span><span class="sw"></span></button>`;
  return `<section class="card tacx"><div class="eyebrow">詳しい指示</div>
    <div class="ctlrow"><label>守備ライン</label>${seg('line', x.line, LINE_OPTS)}<span class="fine">${E.LINE[x.line].sub}</span></div>
    <div class="ctlrow"><label>組み立て</label>${seg('build', x.build, BUILD_OPTS)}<span class="fine">${E.BUILD[x.build].sub}</span></div>
    <div class="ctlrow"><label>攻め方</label>${seg('width', x.width, WIDTH_OPTS)}<span class="fine">${E.WIDTH[x.width].sub}</span></div>
    ${tg('mark', x.mark, '相手のエースをマンマーク', `いちばん危険なアタッカーに1人をつけて自由を奪う${ace ? `（${esc(ace)}）` : ''}。そのぶん中盤が手薄になる。`)}
    ${tg('kill', x.kill, 'リードしたら時間を使う', '70分以降にリードしていれば、テンポを落として逃げ切る。追加点も狙いにくくなる。')}
  </section>`;
}
// the next opponent's most dangerous attacker (for the man-marking note)
function nextOpp() {
  const nx = E.nextMyFixture(S); if (!nx) return '';
  const opp = nx.h === S.my ? nx.a : nx.h; const c = S.clubs[opp]; if (!c) return '';
  const F = E.FORMATIONS[c.tac.form]; let best = null, bv = -1;
  c.tac.xi.forEach((id, i) => { const p = S.players[id]; if (!p || !F[i] || F[i][0] === 'GK') return; const v = (E.ROLE[F[i][0]].a * 3 + 0.15) * Math.pow(p.ovr / 70, 3); if (v > bv) { bv = v; best = p; } });
  return best ? `次の${c.short}なら${best.name}` : '';
}
// saved tactics: load / overwrite / rename / delete, and save the current one
// the real date a tactic was saved (older ones only know the date in the game)
function realDate(ms) { const d = new Date(ms); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
function sheetPresets() {
  const c = S.clubs[S.my]; const list = S.presets || (S.presets = []);
  sheetState = { type: 'presets' };
  const ui = UI.preset || (UI.preset = {});
  const row = (pr, i) => {
    const st = E.presetStatus(S, pr);
    const sus = st.out.filter(id => S.players[id].inj <= 0).length, inj = st.out.length - sus;
    const chips = [sus ? `<span class="chip warn">出場停止 ${sus}</span>` : '', inj ? `<span class="chip warn">負傷 ${inj}</span>` : '', st.gone.length ? `<span class="chip">いない選手 ${st.gone.length}</span>` : ''].join('');
    const when = pr.at ? `${realDate(pr.at)} 保存` : `ゲーム内 ${E.D.y(pr.d)}/${jd(pr.d)} 保存`;
    const head = ui.edit === i
      ? `<div class="row" style="gap:8px"><input class="input" id="pr-name" maxlength="16" value="${esc(pr.name)}" autocomplete="off" style="flex:1"><button class="btn" data-act="presetRename" data-i="${i}">決定</button></div>`
      : `<div class="row"><b>${esc(pr.name)}</b><span class="spacer"></span><span class="small muted pr-when">${when}</span></div>`;
    const club = pr.cn ? `<div class="pr-club">${kitTag(pr.club, { c1: pr.k1, c2: pr.k2 }, 'sm')}<span>${esc(pr.cn)}</span>${st.other ? '<small>（ほかのクラブ）</small>' : ''}</div>` : '';
    return `<li><div class="preset">${head}${club}
      <div class="small muted">${pr.form}・${esc(E.mentLabel(pr))}・プレス${esc((E.PRESS[pr.press] || E.PRESS.mid).jp)}${E.tacLabel(pr) ? '・' + esc(E.tacLabel(pr)) : ''}</div>
      ${chips ? `<div class="row wrap">${chips}</div>` : ''}
      <div class="preset-act"><button class="btn primary" data-act="presetLoad" data-i="${i}">読み込む</button><button class="btn ghost" data-act="presetSave" data-i="${i}">上書き</button><button class="btn ghost" data-act="presetEdit" data-i="${i}">名前</button><button class="btn ghost ${ui.del === i ? 'danger' : ''}" data-act="presetDel" data-i="${i}">${ui.del === i ? '本当に削除' : '削除'}</button></div>
    </div></li>`;
  };
  const full = list.length >= E.PRESET_MAX;
  openSheet(`<div class="eyebrow">戦術の保存・読み込み</div><h2>保存した戦術<small class="muted" style="font-size:14px">　${list.length}/${E.PRESET_MAX}</small></h2>
    ${list.length ? `<ul class="list">${list.map(row).join('')}</ul>` : '<p class="fine">まだ保存した戦術はありません。</p>'}
    <section class="card" style="display:grid;gap:8px"><div class="eyebrow">今の戦術を保存</div>
      <div class="small muted">${c.tac.form}・${esc(E.mentLabel(c.tac))}・プレス${esc(E.PRESS[c.tac.press].jp)}${E.tacLabel(c.tac) ? '・' + esc(E.tacLabel(c.tac)) : ''}・先発とベンチ ${c.tac.xi.filter(Boolean).length + c.tac.bench.length}人</div>
      ${full ? '<p class="fine" style="margin:0">保存枠がいっぱいです。上の「上書き」で入れ替えてください。</p>' : `<div class="row" style="gap:8px"><input class="input" id="pr-new" maxlength="16" placeholder="名前（例：格上用カウンター）" autocomplete="off" style="flex:1"><button class="btn primary" data-act="presetSave">保存</button></div>`}
    </section>
    <p class="fine">読み込むと、保存したときのフォーメーション・進め方・プレス・先発・ベンチをそのまま反映します。ケガや出場停止の選手もそのまま入るので、試合の前に自分で入れ替えてください。チームにいない選手（移籍した選手や、ほかのクラブ・前のゲームで保存したときの選手）の枠は空きになります。</p>
    <p class="fine" style="margin-top:-6px">保存した戦術は、クラブを移っても、新しくゲームを始めても引き継がれます。</p>`,
    '<button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function sheetFired() {
  const F = S.fired; if (!F) return;
  sheetState = { type: 'fired' };
  openSheet(`<div class="eyebrow">解任</div><h2>${esc(S.clubs[F.from].name)}を去ることに</h2><p class="fine">${esc(F.reason)}。ほかのクラブから監督就任のオファーが届いています。</p>
    <ul class="list">${F.offers.map(cid => { const c = S.clubs[cid]; return `<li><button class="crow" data-act="job" data-id="${cid}">${kitTag(cid, c, 'lg')}<span><b>${esc(c.name)}</b><span>資金 ${E.money(c.funds)}・${E.position(S, cid)}位</span></span><span class="chip acc">就任</span></button></li>`; }).join('')}</ul>`,
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
    <p class="fine phr">「コピー」を押して、<wbr>移したい先の<wbr>アプリで<wbr>「コードで復元」に<wbr>貼り付けてください。${E.seasonLabel(S.season)}・<wbr>${esc(S.clubs[S.my].short)}・<wbr>${fmtDate(S.date)}時点の<wbr>セーブです<wbr>（${Math.round(code.length / 1024)}KB）。</p>
    <textarea id="exp-code" class="input" readonly style="height:120px;padding:10px;font-size:11px;font-family:ui-monospace,monospace;word-break:break-all">${esc(code)}</textarea>
    <p class="fine" id="exp-msg" style="margin:0"></p>`,
    '<button class="btn primary block" data-act="copyCode">コピー</button><button class="btn ghost block" data-act="closeSheet">閉じる</button>');
}
function sheetImport() {
  sheetState = { type: 'import' };
  openSheet(`<div class="eyebrow">引き継ぎコード</div><h2>コードで復元</h2>
    <p class="fine phr">「コードを作る」<wbr>（クラブ → 経営 の「データ」）で<wbr>コピーした<wbr>コードを<wbr>貼り付けてください。${S ? '<b>今のセーブは<wbr>上書きされます。</b>' : ''}</p>
    <textarea id="imp-code" class="input" placeholder="KTK1. から始まるコード" style="height:140px;padding:10px;font-size:12px;font-family:ui-monospace,monospace;word-break:break-all" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <p class="fine" id="imp-msg" style="margin:0"></p>`,
    '<button class="btn primary block" data-act="doImport">復元する</button><button class="btn ghost block" data-act="closeSheet">やめる</button>');
}
function sheetReset() {
  sheetState = { type: 'reset' };
  const n = (S && S.presets || []).length;
  openSheet(`<h2>セーブデータを消しますか？</h2><p class="fine">この端末とクラウドのセーブを消して、タイトル画面に戻ります。元には戻せません。${n ? `保存した戦術（${n}件）はこの端末に残り、次に始めるゲームでも使えます。` : ''}</p>`,
    '<button class="btn danger block" data-act="doReset">消して最初から</button><button class="btn ghost block" data-act="closeSheet">やめる</button>');
}

/* ---------- scroll lock (background must not move while a sheet or the match is up) ---------- */
let lockCount = 0, lockY = 0;
function lockScroll() {
  if (lockCount++) return;
  lockY = window.scrollY || 0;
  const b = document.body.style;
  b.position = 'fixed'; b.top = -lockY + 'px'; b.left = '0'; b.right = '0'; b.width = '100%';
  if (!IOS_APP) b.overflow = 'hidden';  // home-screen app: the page must stay taller than the screen (see html.ios-app)
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
  // a celebration closed by tapping outside counts as seen (the next one, if any, comes up)
  if (sheetState && sheetState.type === 'cele' && S && S.cele && S.cele.length) { S.cele.shift(); persist(false); if (S.cele.length) setTimeout(sheetCele, 300); }
  if (sheetState && sheetState.type === 'campRep' && S) { E.campSeen(S); persist(false); }   // the camp report closed by tapping outside
  sheetEl.classList.remove('on'); scrimEl.classList.remove('on'); sheetState = null;
  if (sheetOpen) { sheetOpen = false; unlockScroll(); }
  setTimeout(() => { if (!sheetEl.classList.contains('on')) { sheetEl.hidden = true; scrimEl.hidden = true; sheetEl.innerHTML = ''; } }, 230);
  if (MATCH && MATCH.resumeOnClose) { MATCH.resumeOnClose = false; MATCH.paused = false; tickLoop(); renderMatchCtl(); }
}
// a tactics setting changed: redraw the screen behind and, if it is open, the 戦術 sheet
function planRefresh() { render(); if (sheetState && sheetState.type === 'plan') refreshSheet(); }
function refreshSheet() {
  if (!sheetState) return;
  const s = sheetState;
  if (s.type === 'nego') return sheetNego(s.id, s.back);
  if (s.type === 'presets') return sheetPresets();
  if (s.type === 'reborn') return sheetReborn(s.id, true);
  if (s.type === 'loan') return S.players[s.id] && S.players[s.id].club === S.my ? sheetLoan(s.id) : sheetPlayer(s.id);
  if (s.type === 'num') return sheetNum(s.id, s.sel);
  if (s.type === 'plan') return sheetPlan();
  if (s.type === 'sec') return sheetSec(s.back, s.fid);
  if (s.type === 'spon') return sheetSpon(s.back, s.fid);
  if (s.type === 'camp') return sheetCamp();
  if (s.type === 'campRep') return sheetCampRep();
  if (s.type === 'youth') return sheetYouth(s.back);
  if (s.type === 'town') return sheetTown(s.k);
  if (s.type === 'team') return sheetTeam(s.id, s.tab, s.back);
  if (s.type === 'cele') return sheetCele();
  if (s.type === 'player') sheetPlayer(s.id, s.back); else if (s.type === 'train') sheetTrain(s.id); else if (s.type === 'bench') sheetBench(s.id); else if (s.type === 'slot') sheetSlot(s.i); else if (s.type === 'pre') sheetPrematch(s.id); else if (s.type === 'msub') sheetMatchTactics();
}
// after an offer: signed → close; the player said no → back to his sheet; otherwise stay with the next suggestion
function ngResult(id, r) {
  toast(r.msg);
  const back = sheetState && sheetState.back;
  if (r.ok) { persist(true); closeSheet(); render(); return; }
  persist(r.kind === 'player');
  if (r.kind === 'player' || !E.negoOf(S, id)) { sheetPlayer(id, back); render(); return; }
  const n = E.negoOf(S, id); UI.ng = { pid: id, fee: ngSuggest(n, ngStepOf(E.price(S, S.players[id]))) };
  refreshSheet(); render();
}
let toastT = null;
// spaces become no-break spaces so a name (山田 太郎) stays on one line
function toast(msg) { toastEl.textContent = String(msg).replace(/(\S) (?=\S)/g, '$1\u00a0'); toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); }

/* ---------- match ---------- */
const SPEEDS = { 1: 430, 2: 170, 4: 50 };   // real ms per match minute
const VIS_SPEED = { 1: 1.7, 2: 2.6, 4: 3.6 }; // how fast the 2D players move relative to real time
const SHOT_EV = { goal: 1, save: 1, miss: 1 };
function startMatch(fid, quick) {
  closeSheet();
  const fx = S.fixtures.find(f => f.id === fid); if (!fx || fx.played) return;
  E.validateLineup(S, S.my);
  if (E.lineupIssues(S, S.my, E.compOf(fx)).block) return sheetPrematch(fid);
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
  const { M } = MATCH; const H = S.clubs[M.h.cid], A = S.clubs[M.a.cid], KT = matchKits(M.h.cid, M.a.cid);
  let el = document.getElementById('mlayer');
  if (!el) { el = document.createElement('div'); el.id = 'mlayer'; el.className = 'match'; document.body.appendChild(el); }
  el.innerHTML = `<div class="match-in">
    <div class="sb" id="sb"><div class="team"><span>${esc(H.short)}</span><span class="kitline" style="background:${uniBar(KT.h)}"></span></div><div><div class="score" id="sb-score">0-0</div><div class="clock" id="sb-clock">KICK OFF</div></div><div class="team"><span>${esc(A.short)}</span><span class="kitline" style="background:${uniBar(KT.a)}"></span></div></div>
    <div id="mbody" style="display:flex;flex-direction:column;flex:1;min-height:0">
      <div class="pitch2d"><canvas id="cv" aria-label="試合の2Dビュー"></canvas></div>
      <div class="possbar"><span id="ph">50%</span><span class="pb"><i id="pbh" style="width:50%;background:${uniBar(KT.h)}"></i><i id="pba" style="width:50%;background:${uniBar(KT.a)}"></i></span><span id="pa">50%</span></div>
      <ol class="feed" id="feed" aria-live="polite"></ol>
    </div>
    <div class="mctl" id="mctl"></div>
  </div>`;
  if (!MATCH.locked) { MATCH.locked = true; lockScroll(); }
  renderMatchCtl();
}
// the kits in a match: the home club in its 1st, the away club in its 1st unless the colours clash, then its 2nd
function kitClash(hid, aid) {
  const d = (a, b) => { const x = a.replace('#', ''), y = b.replace('#', ''); let s = 0; for (let i = 0; i < 3; i++) s += Math.abs(parseInt(x.substr(i * 2, 2), 16) - parseInt(y.substr(i * 2, 2), 16)); return s; };
  return d(uniOf(hid).b, uniOf(aid).b) < 140;
}
function matchKits(hid, aid) { return { h: uniOf(hid), a: uniOf(aid, kitClash(hid, aid)) }; }
// a kit as one colour (score bar, possession, event dots): a white 2nd shows its trim
const uniBar = u => lum(u.b) > 0.85 ? u.t1 : u.b;
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
  li.className = e.t === 'goal' ? 'goal' : e.t === 'red' ? 'red' : e.t === 'hot' ? 'hot' : e.t === 'pk' ? 'goal' : e.t === 'tac' ? 'tac' : e.t === 'combo' ? 'combo' : sys ? 'sys' : '';
  const c = e.side ? matchKits(M.h.cid, M.a.cid)[e.side] : null;
  li.innerHTML = `<time>${e.m > 90 ? '90+' + (e.m - 90) : e.m}'</time><i class="pip" style="${c ? 'background:' + uniBar(c) : ''}"></i><span>${e.t === 'goal' ? '<b class="evb">GOAL</b>' : e.t === 'yc' ? '<i class="cardi y"></i>' : e.t === 'red' ? '<i class="cardi r"></i>' : ''}${esc(e.text)}</span>`;
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
    const K = matchKits(M.h.cid, M.a.cid);
    const side = u => ({ c1: u.b, c2: u.t1, c3: u.t2, pat: u.p, pc: u.pc, txt: u.n });
    MATCH.col = { g1: cs.getPropertyValue('--pitch').trim() || '#2E6A45', g2: cs.getPropertyValue('--pitch2').trim() || '#2A6140', line: cs.getPropertyValue('--pitch-line').trim() || 'rgba(255,255,255,.6)', led: cs.getPropertyValue('--led').trim() || '#F5B43C',
      home: { ...side(K.h), gk: '#F28C28' }, away: { ...side(K.a), gk: '#B455E0' } };
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
  const agg = M.agg0 ? [M.hg + M.agg0[0], M.ag + M.agg0[1]] : null, ko = fx.cup && fx.leg !== 1;
  const res = M.pk ? ((M.pk[0] > M.pk[1]) === (k === 'h') ? 'W' : 'L') : agg ? ((agg[0] > agg[1]) === (k === 'h') ? 'W' : 'L') : M.hg === M.ag ? 'D' : ((M.hg > M.ag) === (k === 'h') ? 'W' : 'L');
  const aggT = agg ? `<small class="muted">（2試合合計 ${k === 'h' ? agg[0] : agg[1]}-${k === 'h' ? agg[1] : agg[0]}）</small>` : '';
  const body = document.getElementById('mbody');
  body.innerHTML = `<div class="result">
    <div class="row"><span class="res res-${res}">${{ W: '勝', D: '分', L: '敗' }[res]}</span><b>${ko ? { W: '勝ち抜け！', L: '敗退' }[res] : { W: '勝利！', D: '引き分け', L: '敗戦' }[res]}${M.pk ? `<small class="muted">（PK ${M.pk[0]}-${M.pk[1]}）</small>` : ''}${aggT}</b><span class="spacer"></span><span class="small muted">${E.fxLabel(fx)}・観客 ${(fx.att || 0).toLocaleString('ja-JP')}人</span></div>
    ${M.town ? resTown(M.town) : ''}
    <div class="scorers"><div>${goals('h')}</div><div>${goals('a')}</div></div>
    <div>${stl('支配率', Math.round(M.st.h.pos / tot * 100) + '%', Math.round(M.st.a.pos / tot * 100) + '%')}${stl('シュート', M.st.h.sh, M.st.a.sh)}${stl('枠内', M.st.h.ot, M.st.a.ot)}${stl('ファウル', M.st.h.fo, M.st.a.fo)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">${esc(S.clubs[S.my].short)}の採点</div><ul class="list">${mine.map(([id, pm]) => { const p = S.players[id]; return `<li><div class="row" style="padding:8px 12px">${posTag(p)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)} ${pm.g ? `<b class="evb">G${pm.g > 1 ? '×' + pm.g : ''}</b>` : ''}${pm.a ? `<b class="evb a">A${pm.a > 1 ? '×' + pm.a : ''}</b>` : ''}${pm.rc ? '<i class="cardi r"></i>' : pm.yc ? '<i class="cardi y"></i>' : ''}${pm.inj ? '<span class="chip warn">負傷</span>' : ''}</span><span class="small muted">${pm.on ? pm.on + "'〜" : ''}</span><span class="rating ${ratingCls(pm.final)}">${(pm.final || 6).toFixed(1)}</span></div></li>`; }).join('')}</ul></div>
    ${others.length ? `<div><div class="eyebrow" style="margin-bottom:6px">他会場</div><ul class="list">${others.map(f => `<li><div class="fx"><span class="h">${esc(S.clubs[f.h].short)}${kit(f.h, 'sm')}</span><span class="sc">${f.hg}-${f.ag}${f.pk ? `<small>PK${f.pk[0]}-${f.pk[1]}</small>` : ''}</span><span class="a">${kit(f.a, 'sm')}${esc(S.clubs[f.a].short)}</span></div></li>`).join('')}</ul></div>` : ''}
  </div>`;
  renderMatchCtl();
}
// under the result: a full house, my gate, my supporters (before → after)
function resTown(t) {
  const d = (t.f1 || 0) - (t.f0 || 0);
  return `<div class="res-town">${t.home && t.att >= t.cap * 0.95 ? '<span class="chip acc">満員</span>' : ''}${t.gate ? `<span>入場料 +${E.money(t.gate)}</span>` : ''}<span>サポーター ${ppl(t.f1)}人<b class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">（${sgn(d)}）</b></span></div>`;
}
function closeMatch() {
  if (MATCH) { clearTimeout(MATCH.timer); cancelAnimationFrame(MATCH.raf); }
  const wasLocked = MATCH && MATCH.locked;
  MATCH = null;
  const el = document.getElementById('mlayer'); if (el) el.remove();
  if (wasLocked) unlockScroll();
  UI.tab = 'home'; render(); window.scrollTo(0, 0);
  if (S && S.cele && S.cele.length) setTimeout(sheetCele, 320);
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
    ${(() => { const ace = E.markTarget(S, M, k === 'h' ? 'a' : 'h'); return tacXBlock(E.tacX(sd), 'm', ace && S.players[ace] ? S.players[ace].name : ''); })()}
    ${closeOutToggle(sd)}
    <button class="toggle" role="switch" aria-checked="${!!S.settings.autoSubs}" data-act="autoSubs"><span><b>交代はおまかせ</b><br><span class="small muted">残り交代 ${left}回</span></span><span class="sw"></span></button>
    ${subRateCtl()}
    <div class="eyebrow">${sel ? 'OUT：' + esc(S.players[sel].name) + ' → 入れる選手を選ぶ' : '下げる選手を選ぶ'}</div>
    ${sel ? `<ul class="list">${bench.map(id => { const p = S.players[id]; return `<li><button class="prow" data-act="mIn" data-id="${id}"><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${Math.round(p.cond)}%</span></span><span class="rt"><span class="ovr ${oc(p.ovr)}">${E.ovr(p)}</span></span></button></li>`; }).join('') || '<li class="empty">控えがいません</li>'}</ul><button class="btn ghost block" data-act="mOut" data-id="">選び直す</button>`
      : `<ul class="list">${onp.map(s => { const p = S.players[s.pid]; const pm = M.pm[s.pid]; return `<li><button class="prow" data-act="mOut" data-id="${s.pid}" ${left <= 0 ? 'disabled' : ''}><span class="no">${p.num}</span>${posTag(p)}<span class="nm"><b>${esc(p.name)}</b><span>${E.ROLE[s.role].jp}・体力 ${Math.round(sd.cond[s.pid] || 0)}%</span></span><span class="rt"><span class="rating ${ratingCls(pm.rt)}">${pm.rt.toFixed(1)}</span></span></button></li>`; }).join('')}</ul>`}`,
    '<button class="btn primary block" data-act="closeSheet">試合に戻る</button>');
}

/* ---------- キャンプ (2026-10-16, 作業7, ユーザーの選んだ案A＝作戦ボードの地図) ----------
   Three weeks before the summer camp (2027/28: 6/21 for 7/12〜25) her question opens a sheet with a chalk map on the
   board, each region in its own dashed frame (北海道, 九州, 沖縄; scales differ): the destinations are magnets (海外 with a
   dotted flight line off the board, 行かない is the club's own magnet), the chosen one gets a yellow chalk ring and its
   card underneath (cost, 14 days, 成長・連携・調子・ケガ as dots and words, a line). Her suggestion and who can't come
   follow. At the end, the camp report: the 14 days in two rows (practice matches, who joined, knocks), the XI's chalk
   lines after the camp (yellow = past 70 at the camp), new combos and the nearest ones, who grew, what happened, the
   practice matches and how the team goes into the opening. Home: a card from her question until the opening. */
const CP_COL = { hok: '#2F6FB0', miya: '#2E8B57', oki: '#1C8FB5', abr: '#D99A1E', none: '#7F868C' };
const CP_CH = { hok: '北', miya: '宮', oki: '沖', abr: '海' };
const CP_TXT = {
  hok: { tag: '標準', dots: [2, 2, 3, 0], injT: 'ほとんどない', line: '夏でも涼しく、練習の質を保てる。J1でいちばん多くのクラブが選ぶので練習試合の相手も多い。ほかのクラブもここと同じだけのキャンプをします。' },
  miya: { dots: [2, 2, 2, 1], injT: '少ない', line: '施設が整っていて、費用がいちばん安い。負傷中の選手も連れて行き、リハビリが2倍の速さで進む。' },
  oki: { dots: [2, 3, 2, 2], injT: '少し多い', line: '多くのクラブが集まり、練習試合がいちばん多い。暑さで調子の上がり方は控えめ。新しいポジションを試す「できごと」も起きやすい。' },
  abr: { dots: [3, 2, 0, 3], injT: '多い', line: '欧州のクラブと練習試合。若手がいちばん伸び、アピールする若手も出やすい。費用が大きく、長旅の疲れが開幕まで残る。' },
  none: { dots: [0, 0, 0, 0], injT: 'なし', line: 'クラブハウスで調整。お金はかからないが、ほかのクラブより一歩遅れる。' },
};
// 北海道, 九州 and 沖縄 in chalk, each in its own frame on the 360×300 board (lon/lat → the frame; the scales differ)
const CP_HK = [[141.94, 45.52], [142.5, 45.0], [143.4, 44.35], [144.25, 44.0], [144.9, 44.15], [145.33, 44.34], [145.15, 43.95], [145.3, 43.6], [145.82, 43.38], [145.25, 43.15], [144.4, 42.98], [143.7, 42.62], [143.25, 41.93], [142.6, 42.25], [141.6, 42.62], [140.97, 42.32], [140.75, 42.55], [140.37, 42.5], [140.28, 42.25], [140.58, 42.1], [140.82, 42.0], [141.15, 41.82], [140.75, 41.75], [140.45, 41.6], [140.22, 41.42], [140.08, 41.8], [139.85, 42.15], [139.8, 42.5], [140.35, 43.3], [140.95, 43.2], [141.35, 43.2], [141.65, 43.85], [141.75, 44.45], [141.68, 45.0]];
const CP_KY = [[130.96, 33.96], [131.03, 33.86], [131.17, 33.63], [131.43, 33.57], [131.66, 33.66], [131.74, 33.47], [131.6, 33.3], [131.86, 33.27], [131.86, 33.06], [132.06, 32.93], [131.88, 32.8], [131.72, 32.58], [131.63, 32.42], [131.5, 32.12], [131.47, 31.92], [131.4, 31.6], [131.33, 31.37], [131.06, 31.42], [130.95, 31.23], [130.8, 31.08], [130.66, 30.99], [130.7, 31.25], [130.78, 31.45], [130.75, 31.68], [130.57, 31.6], [130.55, 31.4], [130.65, 31.22], [130.52, 31.17], [130.3, 31.25], [130.18, 31.4], [130.28, 31.7], [130.2, 31.98], [130.38, 32.17], [130.55, 32.45], [130.62, 32.65], [130.55, 32.8], [130.5, 32.95], [130.42, 33.05], [130.3, 33.15], [130.2, 33.05], [130.25, 32.88], [130.37, 32.77], [130.3, 32.6], [130.15, 32.62], [130.1, 32.78], [130.0, 32.86], [129.85, 32.72], [129.8, 32.58], [129.73, 32.8], [129.65, 33.0], [129.7, 33.15], [129.6, 33.3], [129.88, 33.43], [130.18, 33.58], [130.38, 33.62], [130.5, 33.85], [130.75, 33.92]];
const CP_OK = [[127.68, 26.08], [127.67, 26.21], [127.71, 26.44], [127.86, 26.52], [127.86, 26.68], [127.97, 26.62], [128.12, 26.75], [128.26, 26.87], [128.33, 26.75], [128.25, 26.62], [128.05, 26.5], [127.98, 26.32], [127.82, 26.17]];
const cpHx = lon => 264 + (lon - 142.8) * 22.5, cpHy = lat => 80 - (lat - 43.47) * 30;     // 北海道: top right
const cpKx = lon => 91 + (lon - 130.85) * 35.3, cpKy = lat => 214 - (lat - 32.49) * 42;     // 九州: bottom left
const cpOx = lon => 227 + (lon - 128.0) * 103, cpOy = lat => 238 - (lat - 26.47) * 115;     // 沖縄: bottom middle
const CP_FRAME = [['北海道', 180, 8, 172, 146], ['九州', 10, 150, 164, 142], ['沖縄', 184, 176, 88, 116]];
// a closed Catmull-Rom curve through the points: drawn by hand rather than ruled
function cpPath(pts, fx, fy) {
  const q = pts.map(([a, b]) => [fx(a), fy(b)]), n = q.length, f = v => v.toFixed(1);
  let d = `M${f(q[0][0])} ${f(q[0][1])}`;
  for (let i = 0; i < n; i++) { const p0 = q[(i - 1 + n) % n], p1 = q[i], p2 = q[(i + 1) % n], p3 = q[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`; }
  return d + ' Z';
}
const CP_POS = { hok: [cpHx(142.75), cpHy(43.4)], miya: [cpKx(131.42), cpKy(31.91)], oki: [cpOx(127.98), cpOy(26.58)], abr: [66, 46], none: [320, 232] };
let cpMapSvg = null;
function cpMap() {
  if (!cpMapSvg) {
    const [ax, ay] = CP_POS.abr;
    cpMapSvg = `<svg viewBox="0 0 360 300" class="cpA-svg" aria-hidden="true"><defs><filter id="cp-chalk"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs>
      <g filter="url(#cp-chalk)">${CP_FRAME.map(([, x, y, w, h]) => `<rect class="cpA-inset" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`).join('')}<path class="cpA-land" d="${cpPath(CP_HK, cpHx, cpHy)}"/><path class="cpA-land" d="${cpPath(CP_KY, cpKx, cpKy)}"/><path class="cpA-land" d="${cpPath(CP_OK, cpOx, cpOy)}"/><path class="cpA-air" d="M ${ax - 22} ${ay - 6} C ${ax - 40} ${ay - 18}, ${ax - 52} ${ay - 30}, -4 ${ay - 40}"/></g></svg>`;
  }
  return cpMapSvg;
}
const cpPct = (x, y) => `left:${(x / 360 * 100).toFixed(2)}%;top:${(y / 300 * 100).toFixed(2)}%`;
const cpMoney = v => v ? E.money(v).replace(/円$/, '') : '0円';
const cpDots = (n, warn) => `<span class="cp-dots${warn ? ' warn' : ''}" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
function cpMeters(k) {
  const T = E.CAMP.d[k], X = CP_TXT[k];
  const fm = T.form ? `開幕時 ${T.form > 0 ? '+' : '−'}${Math.abs(T.form)}` : '±0';
  const rows = [['成長', T.wk ? `${T.wk}週間分` : 'なし'], ['連携', T.pm ? `練習試合${T.pm}試合分` : 'なし'], ['調子', fm], ['ケガ', X.injT]];
  return `<div class="cp-meters">${rows.map(([l, t], i) => `<div><span class="l">${l}</span>${cpDots(X.dots[i], i === 3 || (i === 2 && T.form < 0))}<small>${t}</small></div>`).join('')}</div>`;
}
const cpMag = (k, cls) => k === 'none' ? kit(S.my, 'lg') : `<span class="cpA-mag${cls ? ' ' + cls : ''}" style="--dc:${CP_COL[k]}">${CP_CH[k]}</span>`;
// the first league match after the break (for the lines that count down to it)
function cpRestart(C) { return S.fixtures.find(f => !f.cup && f.date === C.re && (f.h === S.my || f.a === S.my)); }
const cpPeriod = C => `${jdw(C.from)}〜${jdw(C.to)}`;
function cpRecLine(r) {
  const p = r.pid && S.players[r.pid];
  const jp = E.CAMP.d[r.k].jp;
  if (r.why === 'rehab' && p) return `<b>おすすめは${jp}です。</b>${esc(p.short)}のリハビリが進み、開幕に間に合います。`;
  if (r.why === 'link') return `<b>おすすめは${jp}です。</b>連携の平均がまだ${r.v}なので、練習試合で深めましょう。`;
  if (r.why === 'young') return `<b>おすすめは${jp}です。</b>若い先発が${r.n}人いて、資金にも余裕があります。`;
  return `<b>おすすめは${jp}です。</b>いつもどおりの準備で十分だと思います。`;
}
function cpAbsent(C) {
  const out = E.campAbsent(S); if (!out.length) return '';
  const row = x => { const p = S.players[x.pid]; if (!p) return '';
    const t = x.why === 'nt' ? `${/^ac/.test(((S.nt || {}).cur || {}).k || '') ? 'アジアカップ' : '代表'}に参加中（${esc(E.natJp(x.cc))}代表）。戻ったら途中から合流` : x.why === 'inj' ? `負傷中（キャンプインの日にあと${x.left}日）。${E.CAMP.d[E.CAMP.keys.find(k => E.CAMP.d[k].rehab)].jp}なら連れて行き、リハビリが2倍の速さに` : `${esc(S.clubs[x.to] ? S.clubs[x.to].short : 'J2')}へ期限付き移籍中`;
    return `<div class="cp-abs">${SEC_MAG(p, x.why === 'inj')}<span><b>${esc(p.name)}</b><small>${t}</small></span></div>`; };
  return `<section class="sec-sec"><h4>キャンプに来られない選手</h4>${out.map(row).join('')}</section>`;
}
function sheetCamp() {
  const C = E.campOf(S); if (C.skip || C.st || !C.from) { closeSheet(); render(); return; }
  sheetState = { type: 'camp' };
  const nt = E.secNotes(S).find(n => n.k === 'camp'); if (nt) nt.seen = true;
  const rec = E.campRec(S);
  if (!UI.cmp || UI.cmp.s !== S.season || !E.CAMP.d[UI.cmp.k]) UI.cmp = { s: S.season, k: C.dest || rec.k };
  const k = UI.cmp.k, T = E.CAMP.d[k], c = S.clubs[S.my], f = cpRestart(C), opp = f && S.clubs[f.h === S.my ? f.a : f.h];
  const decided = C.dest && !C.auto;
  const tok = x => { const [px, py] = CP_POS[x], X = E.CAMP.d[x], on = x === k;
    return `<button class="cpA-tok${on ? ' on' : ''}" style="${cpPct(px, py)}" data-act="campSel" data-k="${x}" aria-pressed="${on}" aria-label="${X.jp}${X.cost ? '・' + E.money(X.cost) : ''}">${cpMag(x)}<span class="cpA-lbl"><b>${X.jp}${X.sub ? `<small>（${X.sub}）</small>` : ''}</b><small>${X.cost ? cpMoney(X.cost) : 'クラブで調整'}</small></span></button>`; };
  const [kx, ky] = CP_POS[k];
  const ring = k === 'none' ? '' : `<svg class="cpA-ringw" viewBox="0 0 360 300" aria-hidden="true"><path class="cpA-ring" d="M ${kx - 30} ${ky - 2} C ${kx - 30} ${ky - 30}, ${kx + 30} ${ky - 30}, ${kx + 30} ${ky - 2} S ${kx - 20} ${ky + 30}, ${kx - 32} ${ky - 8}" filter="url(#cp-chalk)"/></svg>`;
  const map = `<div class="cpA-map">${cpMap()}${ring}${CP_FRAME.map(([t, x, y]) => `<span class="cpA-note" style="${cpPct(x + 6, y + 3)}">${t}</span>`).join('')}<span class="cpA-note faint" style="${cpPct(16, 122)}">縮尺はそれぞれ別</span>${E.CAMP.keys.map(tok).join('')}</div>`;
  const card = `<section class="card cpA-pick"><div class="cpA-ph">${cpMag(k, 'sm')}<div style="flex:1;min-width:0"><b class="nm">${k === 'none' ? '今年は行かない' : `${T.jp}キャンプ`}${CP_TXT[k].tag ? `<span class="chip acc">${CP_TXT[k].tag}</span>` : ''}</b><small>${k === 'none' ? `${cpPeriod(C)}はクラブで調整` : `${cpPeriod(C)}・${E.CAMP.len}日間`}</small></div><b class="cost">${T.cost ? E.money(T.cost) : '0円'}</b></div>
    ${cpMeters(k)}<p class="small" style="margin:0">${CP_TXT[k].line}</p></section>`;
  const intro = decided ? `<p class="small" style="margin:0">夏のキャンプは<b>${E.CAMP.d[C.dest].jp}</b>${C.dest === 'none' ? '（行かない）' : ''}に決まっています。${jd(C.from)}のキャンプインまでなら変えられます。</p>`
    : `<p class="small" style="margin:0">開幕前の夏のキャンプの行き先を決めましょう。<b>${cpPeriod(C)}の${E.CAMP.len}日間</b>で、開幕（${f && opp ? `${jd(f.date)} ${esc(opp.short)}戦` : jd(C.re)}）の${D_GAP(C)}日前に戻ります。</p>`;
  const short = T.cost > c.funds;
  const foot = (k === C.dest && decided ? `<button class="btn primary block" style="min-height:54px;font-size:16px" disabled>${k === 'none' ? '行かないことに決まっています' : `${T.jp}に決まっています`}</button>`
      : `<button class="btn primary block" style="min-height:54px;font-size:16px" data-act="campPick" data-k="${k}" ${short ? 'disabled' : ''}>${short ? `資金が足りません（あと${E.money(T.cost - c.funds)}）` : k === 'none' ? '今年は行かない' : `${T.jp}に${decided ? '変更する' : '決める'}（${E.money(T.cost)}）`}</button>`)
    + `<button class="btn ghost block" data-act="closeSheet">${decided ? '閉じる' : 'あとで決める'}</button>`;
  openSheet(`<div class="sec-head">${akiMag('md')}<div style="min-width:0;flex:1"><div class="eyebrow">${E.SEC.role}からの連絡</div><b class="sec-name">${esc(secWho())}</b></div></div>
    ${intro}${map}${card}<div class="cp-rec">${akiMag('sm')}<p>${cpRecLine(rec)}</p></div>${cpAbsent(C)}
    <p class="fine" style="margin:0">決めないまま${jd(C.from)}になると、${E.CAMP.d[E.CAMP.std].jp}（標準）にします。費用はキャンプインの日に払います。ほかのクラブも${E.CAMP.d[E.CAMP.std].jp}と同じだけのキャンプをします。</p>`, foot);
  render();
}
const D_GAP = C => E.D.diff(C.re, C.to);
// the camp report
const CP_IC = {
  pot: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  pos: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/></svg>',
  inj: '<svg viewBox="0 0 24 24"><path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/></svg>',
  lk: '<svg viewBox="0 0 24 24"><path d="M9 15l6-6M8 11l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2"/></svg>',
  mentor: '<svg viewBox="0 0 24 24"><circle cx="8" cy="6.5" r="3"/><path d="M3 21v-4a5 5 0 0 1 10 0v4"/><circle cx="17.5" cy="11" r="2.2"/><path d="M14 21v-3a3.5 3.5 0 0 1 7 0v3"/></svg>',
  join: '<svg viewBox="0 0 24 24"><path d="M4 12h13M12 6l6 6-6 6"/></svg>',
  ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z"/></svg>',
};
const CP_POT = ['紅白戦でアピール', '練習試合でゴール', 'コーチ陣の評価が急上昇'];
function cpEv(e, r) {
  const p = S.players[e.pid], q = e.q && S.players[e.q]; if (!p) return '';
  const nm = x => esc(x.short);
  let t = '', fx = '';
  if (e.k === 'inj') { t = `${nm(p)}　練習中に負傷`; fx = `全治${e.n}日（${jd(e.back)}に復帰）`; }
  else if (e.k === 'join') { const n = E.D.diff(r.to, e.d) + 1; t = `${nm(p)}　${e.why === 'nt' ? '代表から戻って合流' : e.why === 'inj' ? 'ケガが治って合流' : '新しく加わって合流'}`; fx = `${n}日間`; }
  else if (e.k === 'pot') { t = `${nm(p)}　${CP_POT[e.t || 0]}`; fx = `伸びしろ ${e.a} → ${e.b}`; }
  else if (e.k === 'pos') { t = `${nm(p)}　${e.dp}の練習で手応え`; fx = `${e.dp}の適性 ${e.a} → ${e.b}`; }
  else if (e.k === 'lk' && q) { t = `${nm(p)}・${nm(q)}　息が合ってきた`; fx = `連携 ${e.a} → ${e.b}`; }
  else if (e.k === 'mentor' && q) { t = `${nm(p)}が${nm(q)}に付きっきりで指導`; fx = `連携 ${e.a} → ${e.b}`; }
  else return '';
  return `<div class="r ev-${e.k}"><span class="ic">${CP_IC[e.k]}</span><span class="t"><small>${jdw(e.d)}</small><b>${t}</b><em>${fx}</em></span></div>`;
}
function sheetCampRep() {
  const C = S.camp, r = C && C.rep; if (!r) return;
  sheetState = { type: 'campRep' };
  const T = E.CAMP.d[r.k], c = S.clubs[S.my];
  const days = Array.from({ length: E.CAMP.len }, (_, i) => E.D.add(r.from, i));
  const pmD = new Set(r.pm.map(m => m.d));
  const cal = `<div class="cp-cal">${days.map(d => { const w = E.D.dow(d), ev = r.ev.filter(e => e.d === d && (e.k === 'inj' || e.k === 'join'));
    return `<div class="${w === 6 ? 'sat' : w === 0 ? 'sun' : ''}"><b>${jd(d)}</b><small>${'日月火水木金土'[w]}</small><span class="ics">${pmD.has(d) ? `<i class="ball">${CP_IC.ball}</i>` : ''}${[...new Set(ev.map(e => e.k))].map(k => `<i class="${k}">${CP_IC[k]}</i>`).join('')}</span></div>`; }).join('')}</div>
    <div class="cp-calleg"><span><i class="ball">${CP_IC.ball}</i>練習試合</span><span><i class="join">${CP_IC.join}</i>合流</span><span><i class="inj">${CP_IC.inj}</i>ケガ</span></div>`;
  // the board: the XI at the end of the camp, its chalk lines after it (yellow = past 70 at the camp)
  const F = E.FORMATIONS[r.form] || [], topY = y => 88 - (y - 7) * 1.04;
  const idx = new Map(r.xi.map((id, i) => [id, i]));
  const tier = v => v >= 90 ? 't4' : v >= 70 ? 't3' : v >= 40 ? 't2' : 't1';
  let lines = '', up = 0;
  for (const [a, b, v0, v1] of r.lk) {
    const i = idx.get(a), j = idx.get(b); if (i == null || j == null || !F[i] || !F[j]) continue;
    const hi = v1 >= 70 && v0 < 70; if (hi) up++;
    const xy = lkXY(F, i, j);
    lines += (hi ? `<line class="glow" ${xy}/>` : '') + `<line class="${tier(v1)}${hi ? ' cb' : ''}" ${xy}/>`;
  }
  const toks = r.xi.map((id, i) => { const p = S.players[id]; if (!p || !F[i]) return ''; return `<div class="tok" style="left:${F[i][1]}%;top:${topY(F[i][2])}%">${tokShirt(S.my, p.num, '')}<span class="lbl">${esc(p.short)}</span></div>`; }).join('');
  const board = `<div class="pitch cp-pitch">${PITCH_SVG}<svg class="lk-lines" viewBox="0 0 100 127.5" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="cp-lk" filterUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="137.5"><feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale=".5"/></filter></defs><g filter="url(#cp-lk)">${LK_BOX}${lines}</g></svg>${toks}</div>`;
  const plates = r.cb.map(it => `<div class="lk-plate"><span class="ic">${lkIc(it.k)}</span><span class="nm"><b>${esc(it.jp)}</b><small>${lkWho(it)}</small></span><span class="lk-fx">${lkFx(it)}</span></div>`).join('');
  const near = r.near.map(it => `<div class="lk-wrow"><span><b>${esc(it.jp)}</b>${esc(it.cond)}</span><span class="pg"><span class="lk-bar"><i style="width:${Math.min(100, Math.floor(it.val / it.need * 100))}%"></i></span><span>${lkProg(it)}</span></span></div>`).join('');
  const growRows = r.grow.map(g => { const p = S.players[g.pid]; if (!p) return ''; return `<div class="r">${SEC_MAG(p)}<span class="n"><b>${esc(p.name)}</b><small>${E.age(p, S.date)}歳・${dpOf(p)}</small></span><span class="v">${g.a.toFixed(1)}<i>→</i>${g.b.toFixed(1)}</span><b class="d">+${(g.b - g.a).toFixed(1)}</b></div>`; }).join('');
  const ev = r.ev.map(e => cpEv(e, r)).filter(Boolean).join('');
  const w = r.pm.filter(m => m.gf > m.ga).length, l = r.pm.filter(m => m.gf < m.ga).length, dr = r.pm.length - w - l;
  const pm = r.pm.map(m => { const res = m.gf > m.ga ? ['w', '勝'] : m.gf < m.ga ? ['l', '負'] : ['d', '分'];
    return `<div class="r"><small>${jd(m.d)}</small><span>${m.cid && S.clubs[m.cid] ? esc(S.clubs[m.cid].short) : '大学選抜'}</span><b>${m.gf}-${m.ga}</b><i class="${res[0]}">${res[1]}</i></div>`; }).join('');
  const f = S.fixtures.find(x => !x.cup && x.date === r.re && (x.h === S.my || x.a === S.my)), opp = f && S.clubs[f.h === S.my ? f.a : f.h];
  const left = E.D.diff(r.re, S.date);
  const back = r.fm > 0 ? `調子が上がって戻ってきました（開幕から数試合 <b>調子 +${r.fm}</b>）。` : r.fm < 0 ? `長旅の疲れが少し残っています（開幕から数試合 <b>調子 −${-r.fm}</b>）。` : '';
  const none = r.none.length ? `<p class="fine" style="margin:0">参加できなかった選手: ${r.none.map(x => S.players[x.pid] ? esc(S.players[x.pid].short) : '').filter(Boolean).join('・')}</p>` : '';
  openSheet(`<div class="cpA-rh"><div class="eyebrow">キャンプ・レポート</div><h2>${T.jp}キャンプ${T.sub ? `<small>（${T.sub}）</small>` : ''}</h2><div class="small muted">${jdw(r.from)}〜${jdw(r.to)}・${E.CAMP.len}日間・参加${r.n}人・費用${E.money(r.cost)}</div>${r.auto ? `<p class="fine" style="margin:4px 0 0">行き先が決まらなかったので、標準の${E.CAMP.d[E.CAMP.std].jp}に行きました。</p>` : ''}</div>
    ${cal}
    <section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">連携</span><span class="lk-sum">平均 ${Math.floor(r.avg0)} → <b>${Math.floor(r.avg1)}</b><span class="lk-plus">+${Math.max(0, Math.floor(r.avg1) - Math.floor(r.avg0))}</span></span></div>
      ${board}<p class="fine" style="margin:0">${up ? `黄色の線は、キャンプで70を超えた組（${up}組）。` : ''}先発の組に練習試合${T.pm}試合分。${r.cb.length ? `<b>キャンプで新しく組めるようになったコンボ</b>が${r.cb.length}つ。` : ''}</p>${plates}${near}</section>
    <section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">伸びた選手</span><span class="lk-sum">チーム全体で <b>+${r.gsum.toFixed(1)}</b></span></div><div class="cp-grow">${growRows}</div></section>
    ${ev ? `<section class="card cpA-sec"><div class="eyebrow">できごと</div><div class="cp-ev">${ev}</div></section>` : ''}
    ${pm ? `<section class="card cpA-sec"><div class="lk-head"><span class="eyebrow">練習試合</span><span class="lk-sum">${w}勝${dr}分${l}敗</span></div><div class="cp-pmt">${pm}</div></section>` : ''}
    <section class="card cpA-sec cpA-go"><div class="eyebrow">開幕に向けて</div><p class="small" style="margin:0">${back}${f && opp ? `開幕は ${jdw(f.date)} ${esc(opp.short)}戦${left > 0 ? `、あと${left}日です` : ''}。` : ''}</p>${none}</section>`,
    '<button class="btn primary block" style="min-height:54px;font-size:16px" data-act="campRepDone">わかりました</button>');
  const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = 0;
}
// home: from her question until the first match after the break
function campCard() {
  if (!S || S.fired || S.seasonEnd) return '';
  const C = E.campOf(S); if (C.skip || !C.from || S.date < C.ask || S.date > C.re) return '';
  if (C.club && C.club !== S.my) return '';
  const T = C.dest && E.CAMP.d[C.dest];
  if (!C.st) {
    if (!C.dest) return `<section class="card cp-home"><div class="cp-hh"><span class="cpA-mag sm" style="--dc:#5F6B66">？</span><div style="flex:1;min-width:0"><div class="eyebrow">夏のキャンプ</div><b>行き先がまだ決まっていません</b><div class="small muted">${cpPeriod(C)}。決めないと${E.CAMP.d[E.CAMP.std].jp}（標準）になります</div></div></div><button class="btn primary block" data-act="campOpen">行き先を選ぶ</button></section>`;
    return `<section class="card cp-home"><div class="cp-hh">${cpMag(C.dest, 'sm')}<div style="flex:1;min-width:0"><div class="eyebrow">夏のキャンプ</div><b>${C.dest === 'none' ? '今年は行かない' : `${T.jp}キャンプ`}</b><div class="small muted">${cpPeriod(C)}${T.cost ? `・${E.money(T.cost)}` : ''}</div></div><button class="btn ghost" data-act="campOpen" style="min-height:40px">変更</button></div></section>`;
  }
  if (C.st === 'run') { const n = E.D.diff(S.date, C.from) + 1;
    return `<section class="card cp-home"><div class="cp-hh">${cpMag(C.dest, 'sm')}<div style="flex:1;min-width:0"><div class="eyebrow">夏のキャンプ</div><b>${C.dest === 'none' ? 'クラブで調整中' : `${T.jp}キャンプ中`}</b><div class="small muted">${n}日目／${E.CAMP.len}日・${jd(C.to)}まで</div></div></div><div class="cp-prog"><i style="width:${n / E.CAMP.len * 100}%"></i></div></section>`; }
  if (!C.rep || C.rep.k === 'none') return '';
  return `<section class="card cp-home"><div class="cp-hh">${cpMag(C.rep.k, 'sm')}<div style="flex:1;min-width:0"><div class="eyebrow">夏のキャンプ</div><b>${E.CAMP.d[C.rep.k].jp}キャンプ 終了</b><div class="small muted">チーム全体で +${C.rep.gsum.toFixed(1)}・連携の平均 ${Math.floor(C.rep.avg0)} → ${Math.floor(C.rep.avg1)}</div></div></div><button class="btn ghost block" data-act="campRep">キャンプ・レポートを見る</button></section>`;
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
  else if (st.stop === 'inbox') { const it = S.inbox.find(x => x.type !== 'youth'); UI.tab = 'home'; render(); window.scrollTo(0, 0); toast(it && it.type === 'scout' ? 'スカウトが戻りました' : it && it.type === 'nt' ? '代表メンバーが発表されました' : '移籍オファーが届きました'); }
  else if (st.stop === 'note') { if (/フロント/.test(st.text)) { UI.tab = 'home'; render(); window.scrollTo(0, 0); } toast(st.text); }
  else if (st.stop === 'sec') { UI.tab = 'home'; render(); window.scrollTo(0, 0); if (E.sponPending(S) && E.secNotes(S).some(n => n.k === 'spon' && !n.seen)) sheetSpon(); else if (E.campPending(S) && E.secNotes(S).some(n => n.k === 'camp' && !n.seen)) sheetCamp(); else sheetSec(); }
  else if (st.stop === 'camp') { persist(true); UI.tab = 'home'; render(); window.scrollTo(0, 0); sheetCampRep(); }
  else if (st.stop === 'cele') { persist(true); UI.tab = 'home'; render(); window.scrollTo(0, 0); sheetCele(); }
  else if (st.stop === 'seasonEnd') { persist(true); render(); sheetSeasonEnd(); }
  else if (st.stop === 'fired') { persist(true); render(); sheetFired(); }
}
const ACT = {
  toSelect() { UI.screen = 'select'; render(); window.scrollTo(0, 0); },
  aboutOpen() { sheetAbout(); },
  board(d) { setBoard(d.k); render(); },
  toTitle() { UI.screen = 'title'; render(); },
  pickClub(d) { sheetClub(d.id); },
  nameClub(d) { sheetName(d.id); },
  startClub(d) {
    const nm = (document.getElementById('mgr-name') || {}).value || '';
    const carry = carryPresets();
    S = E.newGame(DATA, d.id, nm.trim() || 'あなた', TODAY);
    S.presets = carry;
    UI.tab = 'home'; closeSheet(); persist(true); render(); window.scrollTo(0, 0);
    toast(`${S.clubs[S.my].short}の監督に就任しました`);
  },
  continue() { const st = pickSave(loadLocal(), Cloud.cand); if (!st) return toast('セーブデータが読み込めません'); S = E.migrate(st, DATA); UI.tab = 'home'; render(); if (Cloud.cand === st) saveLocal(); if (!S.fired && S.cele && S.cele.length) setTimeout(sheetCele, 320); else if (!S.fired && S.reborn && S.reborn.show) setTimeout(() => sheetReborn(), 320); },
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
  plan() { sheetPlan(); },
  ment(d) { S.clubs[S.my].tac.ment = d.k; persist(false); planRefresh(); },
  ctr() { const t = S.clubs[S.my].tac; t.ctr = !t.ctr; persist(false); planRefresh(); },
  press(d) { S.clubs[S.my].tac.press = d.k; persist(false); planRefresh(); },
  // 逃げ切りはおまかせ; during a match, tapping it while it is on but stopped (the manager changed the plan) restarts it
  closeOut(d) {
    const restart = d.re === '1';
    E.setCloseOut(S, restart ? true : !S.settings.closeOut, MATCH ? MATCH.M : null, MATCH ? MATCH.k : null);
    persist(false); if (sheetState && sheetState.type === 'msub') refreshSheet(); else planRefresh();
  },
  autoSubs() { S.settings.autoSubs = !S.settings.autoSubs; persist(false); if (sheetState && sheetState.type === 'msub') refreshSheet(); else planRefresh(); },
  boardLv(d) { S.settings.boardLv = d.k; persist(false); render(); },
  subRate(d) { S.settings.subRate = d.k; persist(false); if (sheetState && sheetState.type === 'msub') refreshSheet(); else planRefresh(); },
  autoXI() { E.autoLineup(S, S.my); persist(false); render(); toast('ベストメンバーを組みました'); },
  benchPick(d) { sheetBench(Number(d.id)); },
  benchIn(d) {
    const outId = sheetState && sheetState.id; const o = S.players[outId], p = S.players[d.id]; const c0 = S.clubs[S.my];
    if (o && !avail(o) && c0.tac.bench.includes(outId)) E.secTook(S, outId, Number(d.id), 'bench');
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
      if (bi >= 0) { if (old && avail(S.players[old])) c.tac.bench[bi] = old; else c.tac.bench.splice(bi, 1); }
      if (old) E.secTook(S, old, pid, 'xi');
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
    toast(i == null ? `「${S.presets[r].name}」を保存しました` : `「${S.presets[r].name}」を今の戦術で上書きしました`);
  },
  presetLoad(d) {
    const i = Number(d.i); const pr = S.presets[i];
    const st = E.loadPreset(S, i); if (!st) return;
    persist(false); closeSheet(); UI.tab = 'tactics'; render(); window.scrollTo(0, 0);
    const notes = [st.out.length ? `出場できない選手が${st.out.length}人います` : '', st.empty ? `先発の${st.empty}枠が空いています` : st.gone.length ? `いない選手${st.gone.length}人の枠は空きです` : ''].filter(Boolean);
    toast(`「${pr.name}」を読み込みました` + (notes.length ? `。${notes.join('、')}` : ''));
  },
  fillEmpty() {
    const r = E.fillEmpty(S); persist(false); render();
    toast(r.xi || r.bench ? `空いた枠を埋めました（先発${r.xi}人・ベンチ${r.bench}人）` : '入れられる選手がいません');
  },
  presetEdit(d) { UI.preset = { edit: Number(d.i) }; refreshSheet(); const el = document.getElementById('pr-name'); if (el) el.focus(); },
  presetRename(d) { E.renamePreset(S, Number(d.i), (document.getElementById('pr-name') || {}).value || ''); UI.preset = {}; persist(false); refreshSheet(); },
  presetDel(d) {
    const i = Number(d.i);
    if (!UI.preset || UI.preset.del !== i) { UI.preset = { del: i }; return refreshSheet(); }
    const nm = S.presets[i].name; E.deletePreset(S, i); UI.preset = {}; persist(false); refreshSheet(); render(); toast(`「${nm}」を削除しました`);
  },
  scout(d) { const r = E.sendScout(S, d.k); toast(r.msg); if (r.ok) { persist(false); render(); } },
  round(d) { UI.lg.round = Math.max(1, Math.min(38, (UI.lg.round || curRound()) + Number(d.d))); render(); },
  fxDetail(d) { sheetFixture(Number(d.id)); },
  clView(d) { UI.cl.view = d.k; render(); window.scrollTo(0, 0); },
  mkPos(d) { UI.mk.pos = d.k; render(); },
  mkWhere(d) { UI.mk.where = d.k; UI.mk.fa = false; render(); },
  mkView(d) { UI.mk.view = d.k; render(); },
  rebornNum(d) { const r = E.rebornNum(S, Number(d.id)); toast(r.msg); persist(false); if (r.ok) refreshSheet(); render(); },
  rebornDone() { if (S.reborn) delete S.reborn.show; persist(false); closeSheet(); render(); },
  celeDone() { if (S.cele) S.cele.shift(); persist(false); if (S.cele && S.cele.length) sheetCele(); else { sheetState = null; closeSheet(); } render(); },
  numSheet(d) { sheetNum(Number(d.id)); },
  team(d) { sheetTeam(d.id, 'info', d.back === 'pre' ? { type: 'pre', id: Number(d.fid) } : null); },
  teamTab(d) { const st = sheetState || {}; sheetTeam(st.id, d.k, st.back); },
  teamPlayer(d) { const st = sheetState || {}; sheetPlayer(Number(d.id), { type: 'team', id: st.id, tab: st.tab, back: st.back }); },
  teamBack() { const st = sheetState || {}; if (st.back && st.back.type === 'pre') sheetPrematch(st.back.id); else closeSheet(); },
  playerBack() { const b = sheetState && sheetState.back; if (b && b.type === 'team') sheetTeam(b.id, b.tab, b.back); else closeSheet(); },
  numPick(d) { sheetNum(Number(d.id), Number(d.n)); },
  numSet(d) { const r = E.setNum(S, Number(d.id), Number(d.n)); toast(r.msg); if (r.ok) { persist(false); sheetPlayer(Number(d.id)); render(); } else sheetNum(Number(d.id)); },
  loanSheet(d) { sheetLoan(Number(d.id)); },
  loanGo(d) { const r = E.loanOut(S, Number(d.id), d.k); toast(r.msg); if (r.ok) { persist(true); sheetPlayer(Number(d.id)); render(); } else refreshSheet(); },
  secOpen(d) {
    const sub = sheetState && ['youth', 'secName'].includes(sheetState.type);
    const b = d.back ? { back: d.back, fid: d.fid ? Number(d.fid) : null } : sub ? (UI.secBack || {}) : {};
    UI.secBack = b; sheetSec(b.back, b.fid);
  },
  secAll() {
    const st = sheetState; const pre = st && st.type === 'pre' ? st.id : st && st.type === 'sec' && st.back === 'pre' ? st.fid : null;
    const fx = pre && S.fixtures.find(x => x.id === pre);
    const done = E.secSwapAll(S, fx ? E.compOf(fx) : undefined); persist(false);
    toast(done.length ? `${secNm()}：${done.length}人を入れ替えました` : '入れ替えられる選手がいません');
    if (pre) sheetPrematch(pre); else if (st && st.type === 'sec') sheetSec(st.back, st.fid); else render();
  },
  secOne(d) {
    const st = sheetState || {}; const pre = st.type === 'sec' && st.back === 'pre' ? st.fid : null;
    const fx = pre && S.fixtures.find(x => x.id === pre); const comp = fx ? E.compOf(fx) : undefined;
    const it = E.secSwap(S, d.id, comp); persist(false);
    if (it) toast(it.cand ? `${S.players[it.cand].short}を${it.k === 'xi' ? E.ROLE[it.role].jp + 'に' : 'ベンチに'}入れました` : `${S.players[it.out].short}を外しました`);
    if (pre && !E.secFix(S, comp).items.length) sheetPrematch(pre); else sheetSec(st.back, st.fid);
  },
  secBack(d) {
    const r = E.secRestore(S, Number(d.id)); persist(false);
    if (r) toast(`${S.players[r.out].short}を戻しました（${S.players[r.sub].short}は${r.to === 'bench' ? 'ベンチへ' : 'ベンチ外へ'}）`);
    if (sheetState && sheetState.type === 'sec') refreshSheet(); else render();
  },
  secKeep(d) { E.secKeep(S, Number(d.id)); persist(false); if (sheetState && sheetState.type === 'sec') refreshSheet(); else render(); },
  secDone(d) { E.secDone(S, Number(d.id)); persist(false); refreshSheet(); render(); },
  secName(d) { sheetSecName(d.back); },
  secNameSave() {
    const n = E.setSecName(S, (document.getElementById('sec-name') || {}).value || ''); persist(false);
    toast(`${E.SEC.role}の名前を「${n}」にしました`);
    if (sheetState && sheetState.back === 'club') { closeSheet(); render(); } else { const b = UI.secBack || {}; sheetSec(b.back, b.fid); }
  },
  secPre(d) { sheetPrematch(Number(d.id)); },
  sponOpen(d) { sheetSpon(d.back, d.fid ? Number(d.fid) : null); },
  campOpen() { sheetCamp(); },
  campSel(d) { if (UI.cmp) UI.cmp.k = d.k; refreshSheet(); },
  campPick(d) { const r = E.campPick(S, d.k); toast(r.msg); if (!r.ok) return; persist(false); closeSheet(); render(); },
  campRep() { sheetCampRep(); },
  campRepDone() { E.campSeen(S); persist(false); closeSheet(); render(); },
  // tap a contract: in (the next free place: 胸 → 背中 → 袖) or out
  spTap(d) {
    const pick = spPick(), id = Number(d.id), s = pick.indexOf(id);
    if (s >= 0) pick[s] = null;
    else { const f = pick.indexOf(null); if (f < 0) return toast('3社まで。外してから選んでください'); pick[f] = id; }
    refreshSheet();
  },
  // move a contract to another place (whoever was there takes its place)
  spSlot(d) {
    const pick = spPick(), id = Number(d.id), to = Number(d.s), s = pick.indexOf(id); if (s < 0 || s === to) return;
    [pick[s], pick[to]] = [pick[to], pick[s]]; refreshSheet();
  },
  spSign() {
    const st = sheetState || {}; const pick = spPick(); const n = pick.filter(x => x != null).length;
    if (!n || !E.sponPick(S, pick)) return;
    UI.spk = null; persist(true);
    toast(`スポンサー${n}社と契約しました`);
    if (st.back === 'pre' && st.fid) sheetPrematch(st.fid);
    else {
      closeSheet(); render();
      // her camp question came the same day (2026-10-16: after a new job the sponsor sheet opens first) → the map next
      if (E.campPending(S) && E.secNotes(S).some(x => x.k === 'camp' && !x.seen)) setTimeout(() => { if (!sheetState) sheetCamp(); }, 320);
    }
  },
  youthOpen() { sheetYouth('sec'); },
  youthDone(d) { const it = S.inbox.find(x => x.id === Number(d.id)); if (it) it.done = true; persist(false); render(); },
  unshort(d) { const p = S.players[d.id]; E.unshort(S, Number(d.id)); persist(false); toast(`${p ? p.name : '選手'}をショートリストから外しました`); refreshSheet(); render(); },
  upgrade(d) { const r = E.upgrade(S, d.k); toast(r.msg); if (r.ok) { persist(true); render(); } },
  // ホームタウン: a magnet's sheet, building (the sheet closes so the works show on the map), a facility's next level
  htOpen(d) { sheetTown(d.k); },
  htBuild(d) { const r = E.townBuild(S, d.k); toast(r.msg); if (r.ok) { persist(true); closeSheet(); render(); } else refreshSheet(); },
  htUp(d) { const r = E.upgrade(S, d.k); toast(r.msg); if (r.ok) persist(true); refreshSheet(); render(); },
  htGo() { closeSheet(); UI.tab = 'club'; UI.cl.view = 'town'; render(); window.scrollTo(0, 0); },
  training(d) { S.training = d.k; persist(false); render(); },
  toggleList(d) { const p = S.players[d.id]; const r = E.setListed(S, p.id, !p.listed); if (!r.ok) return; persist(false); toast(p.listed ? `${r.wasKeep ? '放出不可を解除し、' : ''}${E.inWindow(S.date) ? '放出リストに載せました。オファーを待ちます' : '放出リストに載せました。移籍期間に入るとオファーが届きます'}` : '放出リストから外しました'); refreshSheet(); render(); },
  toggleKeep(d) { const p = S.players[d.id]; const r = E.setKeep(S, p.id, !p.keep); if (!r.ok) return; persist(false); toast(p.keep ? `${r.wasListed ? '放出リストから外し、' : ''}放出不可にしました。他クラブのオファーは断ります${r.n ? '（届いていたオファーも断りました）' : ''}` : '放出不可を解除しました'); refreshSheet(); render(); },
  nego(d) {
    const id = Number(d.id), back = sheetState && sheetState.type === 'player' ? sheetState.back : null;
    const r = E.negoStart(S, id); persist(false);
    if (!r.ok) { toast(r.msg); refreshSheet(); render(); return; }
    UI.ng = null; sheetNego(id, back); render();
  },
  ngStep(d) { const s = sheetState; const p = S.players[s.id]; const step = ngStepOf(E.price(S, p)); UI.ng.fee = ngRound(UI.ng.fee + Number(d.d) * step, step); refreshSheet(); },
  ngSet(d) {
    const s = sheetState; const p = S.players[s.id]; const n = E.negoOf(S, s.id); if (!n) return refreshSheet();
    const pr = E.price(S, p), step = ngStepOf(pr);
    UI.ng.fee = ngRound(d.k === 'v' ? pr : n.ask * Number(d.k) / 100, step); refreshSheet();
  },
  ngOffer(d) { ngResult(Number(d.id), E.negoOffer(S, Number(d.id), UI.ng ? UI.ng.fee : 0)); },
  ngAgree(d) { ngResult(Number(d.id), E.negoAgree(S, Number(d.id))); },
  ngBack(d) { sheetPlayer(Number(d.id), sheetState && sheetState.back); },
  offerUp(d) { const r = E.raiseOffer(S, Number(d.id)); toast(r.msg); persist(true); render(); },
  sign(d) { const r = E.bid(S, Number(d.id), 1); toast(r.msg); if (r.ok) { persist(true); closeSheet(); render(); } else { persist(false); refreshSheet(); render(); } },
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
  rollNow() { E.rollover(S); persist(true); closeSheet(); UI.tab = 'home'; UI.lg.round = null; render(); window.scrollTo(0, 0); if (S.fired) setTimeout(sheetFired, 260); else if (S.reborn && S.reborn.show) setTimeout(() => sheetReborn(), 320); else toast(`${E.seasonLabel(S.season)}シーズンへ`); },
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
  doReset() { tacLibSave(carryPresets()); try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ } cloudWipe(); Cloud.cand = null; S = null; UI.screen = 'title'; closeSheet(); render(); },
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
  // 詳しい指示 (守備ライン・組み立て・攻め方・マンマーク・時間を使う): on the tactics screen or during a match
  tacx(d) {
    const v = d.key === 'mark' || d.key === 'kill' ? !!d.k : d.k;
    if (d.s === 'm') { if (MATCH) E.setTac(MATCH.M, MATCH.k, d.key, v); refreshSheet(); return; }
    const t = S.clubs[S.my].tac; if (d.key === 'mark' || d.key === 'kill') t[d.key] = v; else if ((d.key === 'line' && E.LINE[v]) || (d.key === 'build' && E.BUILD[v]) || (d.key === 'width' && E.WIDTH[v])) t[d.key] = v;
    persist(false); planRefresh();
  },
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
// pull-downs (native selects): data-chg names the action, the chosen value comes as k
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || !el.dataset.chg) return;
  const fn = ACT[el.dataset.chg]; if (!fn) return;
  try { fn({ k: el.value }, el); } catch (err) { console.error(err); toast('エラーが発生しました: ' + (err && err.message)); }
});
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'mk-q') { UI.mk.q = e.target.value; const l = document.getElementById('mk-list'); if (l) l.innerHTML = marketRows(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheetState) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});

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
