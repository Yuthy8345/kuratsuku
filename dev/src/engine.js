/* SIDELINE engine — pure game logic (no DOM) */
(function (root) {
'use strict';

/* ---------- utilities ---------- */
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = arr => arr[Math.floor(R() * arr.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function wpick(items, wfn) {
  let tot = 0; const ws = items.map(it => { const w = Math.max(0, wfn(it)); tot += w; return w; });
  if (tot <= 0) return items[0];
  let x = R() * tot;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}
function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- dates (ISO yyyy-mm-dd, UTC math) ---------- */
const D = {
  parse(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); },
  fmt(t) { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); },
  add(s, n) { return D.fmt(D.parse(s) + n * 86400000); },
  diff(a, b) { return Math.round((D.parse(a) - D.parse(b)) / 86400000); },
  dow(s) { return new Date(D.parse(s)).getUTCDay(); },
  md(s) { return s.slice(5); },
  y(s) { return Number(s.slice(0, 4)); },
  m(s) { return Number(s.slice(5, 7)); },
  d(s) { return Number(s.slice(8, 10)); },
};
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function jdate(s, withDow) { return D.m(s) + '/' + D.d(s) + (withDow ? '(' + WD[D.dow(s)] + ')' : ''); }

/* ---------- static tables ---------- */
const FORMATIONS = {
  '4-4-2':   [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['LM',13,54],['CM',37,49],['CM',63,49],['RM',87,54],['ST',37,80],['ST',63,80]],
  '4-3-3':   [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['DM',50,41],['CM',28,55],['CM',72,55],['LW',15,76],['ST',50,82],['RW',85,76]],
  '4-2-3-1': [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['DM',35,42],['DM',65,42],['WAM',15,66],['AM',50,63],['WAM',85,66],['ST',50,84]],
  '3-4-2-1': [['GK',50,7],['CB',25,24],['CB',50,20],['CB',75,24],['WB',10,50],['CM',37,46],['CM',63,46],['WB',90,50],['AM',32,68],['AM',68,68],['ST',50,84]],
  '3-5-2':   [['GK',50,7],['CB',25,24],['CB',50,20],['CB',75,24],['WB',10,52],['CM',30,52],['DM',50,41],['CM',70,52],['WB',90,52],['ST',37,80],['ST',63,80]],
};
const ROLE = { // cat, weights attack / midfield / defence, label
  GK:  { cat: 'GK', a: 0,    m: 0,    d: 0,    jp: 'GK' },
  CB:  { cat: 'DF', a: 0.05, m: 0.1,  d: 1.0,  jp: 'CB' },
  LB:  { cat: 'DF', a: 0.2,  m: 0.25, d: 0.8,  jp: 'LSB' },
  RB:  { cat: 'DF', a: 0.2,  m: 0.25, d: 0.8,  jp: 'RSB' },
  WB:  { cat: 'MF', a: 0.35, m: 0.35, d: 0.55, jp: 'WB', alt: 'DF' },
  DM:  { cat: 'MF', a: 0.15, m: 0.8,  d: 0.5,  jp: 'DMF' },
  CM:  { cat: 'MF', a: 0.35, m: 1.0,  d: 0.3,  jp: 'CMF' },
  LM:  { cat: 'MF', a: 0.55, m: 0.7,  d: 0.25, jp: 'LMF' },
  RM:  { cat: 'MF', a: 0.55, m: 0.7,  d: 0.25, jp: 'RMF' },
  AM:  { cat: 'MF', a: 0.8,  m: 0.7,  d: 0.1,  jp: 'OMF', alt: 'FW' },
  WAM: { cat: 'MF', a: 0.75, m: 0.5,  d: 0.15, jp: 'WG', alt: 'FW' },
  LW:  { cat: 'FW', a: 0.9,  m: 0.35, d: 0.1,  jp: 'LWG', alt: 'MF' },
  RW:  { cat: 'FW', a: 0.9,  m: 0.35, d: 0.1,  jp: 'RWG', alt: 'MF' },
  ST:  { cat: 'FW', a: 1.0,  m: 0.2,  d: 0.05, jp: 'CF' },
};
const MENTALITY = { def: { own: 0.86, opp: 0.88, jp: '守備的' }, bal: { own: 1, opp: 1, jp: 'バランス' }, att: { own: 1.14, opp: 1.1, jp: '攻撃的' } };
const PRESS = { low: { mid: -1.5, drain: -3, jp: '低' }, mid: { mid: 0, drain: 0, jp: '中' }, high: { mid: 1.8, drain: 5, jp: '高' } };
const TRAINING = {
  bal: { jp: 'バランス', grow: 1.0, rec: 0 },
  hard: { jp: 'ハード', grow: 1.35, rec: -2 },
  tact: { jp: '戦術理解', grow: 0.8, rec: 0, team: 1 },
  rest: { jp: 'コンディション重視', grow: 0.6, rec: 3 },
};
const FACILITY = {
  train: { jp: '練習場', desc: '選手の成長スピードが上がる' },
  youth: { jp: 'ユース', desc: '昇格してくる若手の質と人数が上がる' },
  stadium: { jp: 'スタジアム設備', desc: '観客動員と入場料収入が増える' },
  medical: { jp: 'メディカル', desc: '疲労回復が早まり、ケガが減る' },
};
// J2 clubs (for promotion). Squads are generated (fictional names).
const J2 = [
  { id: 'sapporo', name: '北海道コンサドーレ札幌', short: '札幌', c1: '#C8102E', c2: '#111111', abbr: 'SAP', stadium: '大和ハウス プレミストドーム', cap: 38000, tier: 3, fan: 4, area: '北海道' , pres: 1.68, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'yokohamafc', name: '横浜FC', short: '横浜FC', c1: '#2BA6DE', c2: '#F2F2F2', abbr: 'YFC', stadium: 'ニッパツ三ツ沢球技場', cap: 15000, tier: 2, fan: 2, area: '神奈川' , pres: 1.42, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'shonan', name: '湘南ベルマーレ', short: '湘南', c1: '#7AB800', c2: '#1F4E9C', abbr: 'SHO', stadium: 'レモンガススタジアム平塚', cap: 15000, tier: 2, fan: 3, area: '神奈川' , pres: 2.29, titles: {j1: 0, lc: 1, ec: 3, acl: 0} },
  { id: 'niigata', name: 'アルビレックス新潟', short: '新潟', c1: '#F26B00', c2: '#1F3C88', abbr: 'NII', stadium: 'デンカビッグスワンスタジアム', cap: 41000, tier: 3, fan: 4, area: '新潟' , pres: 1.77, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'iwata', name: 'ジュビロ磐田', short: '磐田', c1: '#6DB6E6', c2: '#F2F2F2', abbr: 'IWA', stadium: 'ヤマハスタジアム', cap: 15000, tier: 3, fan: 3, area: '静岡' , pres: 3.34, titles: {j1: 3, lc: 2, ec: 2, acl: 1} },
  { id: 'tosu', name: 'サガン鳥栖', short: '鳥栖', c1: '#5BA6DE', c2: '#E7489B', abbr: 'TOS', stadium: '駅前不動産スタジアム', cap: 24000, tier: 2, fan: 2, area: '佐賀' , pres: 1.68, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'omiya', name: 'RB大宮アルディージャ', short: '大宮', c1: '#F37021', c2: '#14224A', abbr: 'OMI', stadium: 'NACK5スタジアム大宮', cap: 15000, tier: 3, fan: 3, area: '埼玉' , pres: 1.65, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'sendai', name: 'ベガルタ仙台', short: '仙台', c1: '#F5C400', c2: '#1B2E5A', abbr: 'SEN', stadium: 'ユアテックスタジアム仙台', cap: 19000, tier: 2, fan: 3, area: '宮城' , pres: 1.7, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'tokushima', name: '徳島ヴォルティス', short: '徳島', c1: '#1B3A8C', c2: '#78BE20', abbr: 'TOK', stadium: '鳴門・大塚スポーツパークポカリスエットスタジアム', cap: 17000, tier: 2, fan: 2, area: '徳島' , pres: 1.27, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'oita', name: '大分トリニータ', short: '大分', c1: '#1D3C9C', c2: '#F2C400', abbr: 'OIT', stadium: 'クラサスドーム大分', cap: 31000, tier: 2, fan: 2, area: '大分' , pres: 1.83, titles: {j1: 0, lc: 1, ec: 0, acl: 0} },
  { id: 'kofu', name: 'ヴァンフォーレ甲府', short: '甲府', c1: '#1D4E9C', c2: '#B5162B', abbr: 'KOF', stadium: 'JITリサイクルインクスタジアム', cap: 15000, tier: 2, fan: 2, area: '山梨' , pres: 1.85, titles: {j1: 0, lc: 0, ec: 1, acl: 0} },
  { id: 'yamagata', name: 'モンテディオ山形', short: '山形', c1: '#1D3F8C', c2: '#F2F2F2', abbr: 'YAM', stadium: 'NDソフトスタジアム山形', cap: 20000, tier: 2, fan: 2, area: '山形' , pres: 1.38, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'iwaki', name: 'いわきFC', short: 'いわき', c1: '#C8102E', c2: '#1B2A4A', abbr: 'IWK', stadium: 'ハワイアンズスタジアムいわき', cap: 5000, tier: 1, fan: 1, area: '福島' , pres: 1, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
  { id: 'imabari', name: 'FC今治', short: '今治', c1: '#1B2A4A', c2: '#F2C400', abbr: 'IMA', stadium: 'アシックス里山スタジアム', cap: 5000, tier: 1, fan: 1, area: '愛媛' , pres: 1, titles: {j1: 0, lc: 0, ec: 0, acl: 0} },
];

/* ---------- fictional name pools (generated players only) ---------- */
const FAM = '佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 中川 松田 竹内 小野 田村 中山 和田 石田 森田 上田 柴田 酒井 工藤 横山 宮崎 宮本 内田 高木 安藤 島田 谷口 大野 高田 丸山 今井 河野 藤本 村田 武田 上野 杉山 増田 小山 大塚 平野 菅原 久保 松井 千葉 岩崎 桜井 木下 野口 松尾 菊地 野村 新井 早瀬 立花 有村 芦田 宇野 片桐'.split(' ');
const GIV = '翔 蓮 大翔 陽翔 湊 悠真 颯太 陸 蒼 樹 大和 悠斗 陽太 海斗 颯 隼 拓海 健太 優斗 翼 航 匠 智也 亮 大輝 涼 和真 瑛太 奏太 晴 晃 光 誠 駿 慶 将 一輝 遼 雄大 健人 怜 春樹 直人 康平 圭 大地 宗一郎 柊 律 琉生 瑛士 隆之介 恭平 泰河 凌 碧 響 朔 啓太 伸也'.split(' ');
const FOR_F = 'ガブリエウ ルーカス ペドロ ラファエウ ヴィトール ジョアン カイオ ブルーノ ディエゴ レアンドロ マルコス エリク フェリペ イゴール ヘナン ダニエウ'.split(' ');
const FOR_L = 'シウバ サントス ソウザ オリヴェイラ ペレイラ アウメイダ フェヘイラ ロドリゲス コスタ カルヴァーリョ ゴメス マルチンス アラウージョ バホス メンデス'.split(' ');

/* ---------- derived player numbers ---------- */
function age(p, date) {
  const [y, m, d] = p.birth.split('-').map(Number);
  let a = D.y(date) - y;
  if (D.m(date) < m || (D.m(date) === m && D.d(date) < d)) a--;
  return a;
}
function ovr(p) { return Math.round(p.ovr); }
function value(p, date) { // 万円
  const o = p.ovr, a = age(p, date);
  let v = 30 * Math.pow(Math.max(0, o - 50), 2);
  const potB = Math.max(0, p.pot - o);
  if (a <= 21) v *= 1.3 + potB * 0.05; else if (a <= 24) v *= 1.15 + potB * 0.03;
  else if (a >= 33) v *= 0.3; else if (a >= 30) v *= 0.6;
  return Math.max(300, Math.round(v / 100) * 100);
}
function wage(p) { return Math.max(400, Math.round(6 * Math.pow(Math.max(0, p.ovr - 45), 2) / 10) * 10); } // 年俸 万円
const FANBASE = [0, 8000, 13000, 19000, 25000, 34000];
function money(v) { // 万円 -> label
  const s = v < 0 ? '-' : ''; v = Math.abs(v);
  if (v >= 10000) return s + (v / 10000).toFixed(v >= 100000 ? 1 : 2).replace(/\.?0+$/, '') + '億円';
  return s + Math.round(v).toLocaleString('ja-JP') + '万円';
}
/* ---------- attributes & development ---------- */
// 0 シュート 1 パス 2 ドリブル 3 守備 4 スピード 5 パワー 6 スタミナ 7 判断力 8 セービング
const ATTR = ['シュート', 'パス', 'ドリブル', '守備', 'スピード', 'パワー', 'スタミナ', '判断力', 'セービング'];
const ATTR_SHOW = { GK: [8, 7, 1, 4, 5, 6], DF: [3, 5, 4, 7, 1, 6, 2, 0], MF: [1, 7, 2, 6, 3, 0, 4, 5], FW: [0, 2, 4, 5, 7, 1, 6, 3] };
// overall = weighted attributes, by registered position
const AW = {
  FW: [0.30, 0.08, 0.15, 0.02, 0.15, 0.10, 0.05, 0.15, 0],
  MF: [0.08, 0.25, 0.15, 0.10, 0.05, 0.05, 0.12, 0.20, 0],
  DF: [0.02, 0.10, 0.03, 0.32, 0.12, 0.15, 0.08, 0.18, 0],
  GK: [0, 0.07, 0, 0, 0.05, 0.08, 0, 0.20, 0.60],
};
const AW_SQ = {}; for (const k in AW) AW_SQ[k] = AW[k].reduce((a, w) => a + w * w, 0);
// how well the attribute profile fits each role on the pitch
const RW = {
  GK: [0, 0.1, 0, 0, 0.05, 0.05, 0, 0.2, 0.6],
  CB: [0, 0.1, 0, 0.35, 0.1, 0.25, 0, 0.2, 0],
  LB: [0, 0.15, 0.1, 0.25, 0.2, 0, 0.15, 0.15, 0], RB: [0, 0.15, 0.1, 0.25, 0.2, 0, 0.15, 0.15, 0],
  WB: [0, 0.15, 0.15, 0.15, 0.2, 0, 0.2, 0.15, 0],
  DM: [0, 0.25, 0, 0.3, 0, 0.1, 0.1, 0.25, 0],
  CM: [0.1, 0.3, 0.1, 0.1, 0, 0, 0.15, 0.25, 0],
  LM: [0.1, 0.2, 0.2, 0.05, 0.2, 0, 0.15, 0.1, 0], RM: [0.1, 0.2, 0.2, 0.05, 0.2, 0, 0.15, 0.1, 0],
  AM: [0.2, 0.25, 0.25, 0, 0.1, 0, 0, 0.2, 0],
  WAM: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0], LW: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0], RW: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0],
  ST: [0.4, 0, 0.1, 0, 0.15, 0.15, 0, 0.2, 0],
};
const ATTR_BIAS = {
  FW: [7, -3, 3, -18, 3, 1, -2, 0, -45],
  MF: [-3, 5, 2, -4, -1, -3, 3, 3, -45],
  DF: [-15, -2, -8, 7, -1, 4, 0, 3, -45],
  GK: [-35, -10, -25, -30, -12, -2, -10, 2, 4],
};
// individual training menus: share of the focused part of the training load per attribute
const FOCUS = {
  auto:  { jp: 'おまかせ', sub: 'ポジションに合わせて満遍なく', v: null },
  shoot: { jp: 'シュート', sub: 'シュート・ドリブル', v: { 0: 0.7, 2: 0.3 } },
  pass:  { jp: 'パス', sub: 'パス・判断力', v: { 1: 0.7, 7: 0.3 } },
  drib:  { jp: 'ドリブル', sub: 'ドリブル・スピード', v: { 2: 0.65, 4: 0.35 } },
  def:   { jp: '守備', sub: '守備・判断力', v: { 3: 0.7, 7: 0.3 } },
  phys:  { jp: 'フィジカル', sub: 'パワー・スタミナ・スピード', v: { 5: 0.4, 6: 0.35, 4: 0.25 } },
  mind:  { jp: '判断力', sub: '判断力・パス', v: { 7: 0.65, 1: 0.35 } },
  gk:    { jp: 'セービング', sub: 'セービング・判断力', v: { 8: 0.75, 7: 0.25 }, gk: true },
};
const INTENS = {
  light: { jp: '軽め', g: 0.6, rec: 2, inj: 0 },
  norm:  { jp: '通常', g: 1.0, rec: 0, inj: 0 },
  hard:  { jp: 'ハード', g: 1.4, rec: -2, inj: 0.0011 },
};
function calcOvr(p) { const w = AW[p.pos]; let s0 = 0; for (let i = 0; i < 9; i++) s0 += w[i] * p.at[i]; return s0; }
function roleScore(p, role) { const w = RW[role]; let s0 = 0; for (let i = 0; i < 9; i++) s0 += w[i] * p.at[i]; return s0; }
function initAttrs(p) {
  let h = hash(p.name + p.birth + p.pos);
  const bias = ATTR_BIAS[p.pos];
  const v = bias.map(b => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return p.ovr + b + ((h % 13) - 6); });
  // a signature strength and a weakness, so players of the same level differ
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; const up = h % 8; h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0; const dn = h % 8;
  if (p.pos !== 'GK') { v[up] += 5; if (dn !== up) v[dn] -= 4; }
  const w = AW[p.pos]; let ws = 0; for (let i = 0; i < 9; i++) ws += w[i] * v[i];
  const shift = p.ovr - ws;
  p.at = v.map(x => Math.round(clamp(x + shift, 20, 96) * 10) / 10);
  p.ovr = calcOvr(p);
  p.at0 = p.at.slice(); p.ovr0 = p.ovr;
  if (!p.tf) p.tf = 'auto';
  if (!p.ti) p.ti = 'norm';
}
function attrs(p) { if (!p.at) initAttrs(p); return p.at.map(x => Math.round(x)); }
function migrate(S, DATA) {
  for (const p of Object.values(S.players)) if (!p.at) initAttrs(p);
  // data corrections (e.g. verified birthdates) flow into existing saves
  if (DATA && DATA.players) for (const d of DATA.players) { const q = S.players[d.id]; if (q && q.name === d.name && q.birth !== d.birth) q.birth = d.birth; }
  const src = {}; if (DATA && DATA.clubs) for (const c of DATA.clubs) src[c.id] = c; for (const c of J2) src[c.id] = src[c.id] || c;
  let added = false;
  // v4 prestige (all-time titles + a bonus for the last 15 seasons). Keep whatever a club gained or lost in-game.
  if ((S.presV || 1) < 4) {
    const base = PRES_BASE[S.presV || 1] || PRES_BASE[1];
    for (const c of Object.values(S.clubs)) {
      if (c.pres == null || !src[c.id] || base[c.id] == null) continue;
      const gain = c.pres - base[c.id];
      c.pres = clamp(Math.round((src[c.id].pres + gain) * 100) / 100, 1, 5);
      const t = Object.assign({ j1: 0, lc: 0, ec: 0, acl: 0 }, src[c.id].titles || {});
      t.j1 = Math.max(t.j1, (c.titles && c.titles.j1) || 0);
      c.titles = t; added = true;
    }
  }
  S.presV = 4;
  for (const c of Object.values(S.clubs)) if (c.pres == null && src[c.id]) { c.pres = src[c.id].pres || 2; c.titles = Object.assign({ j1: 0, lc: 0, ec: 0, acl: 0 }, src[c.id].titles || {}); c.o10 = !!src[c.id].o10; added = true; }
  if (added) setExpectations(S, { keepTargets: S.fixtures.some(f => f.played && (f.h === S.my || f.a === S.my)) });
  S.v = Math.max(S.v || 1, 2);
  return S;
}
function bestRoles(p, n) {
  const seen = new Set(); const out = [];
  for (const r of Object.keys(RW)) {
    const key = ROLE[r].jp; if (seen.has(key)) continue; seen.add(key);
    out.push({ role: r, jp: key, v: effective(p, r, 100) - clamp((p.form - 6.5) * 1.2, -2, 2) });
  }
  return out.sort((a, b) => b.v - a.v).slice(0, n || 3);
}
// growth for one week; dry=true returns the expected change without touching the player
function devWeek(S, p, dry) {
  const c = S.clubs[p.club]; if (!c) return null;
  const a = age(p, S.date); const isMy = p.club === S.my;
  const tf = isMy ? (p.tf || 'auto') : 'auto';
  const it = INTENS[isMy ? (p.ti || 'norm') : 'norm'];
  const at = p.at.slice();
  const gap = p.pot - p.ovr;
  let g = 0;
  if (gap > 0) {
    const k = a <= 19 ? 0.055 : a <= 22 ? 0.045 : a <= 25 ? 0.03 : 0.015;
    const playing = p.st.mins > 0 ? Math.min(1.3, 0.75 + p.st.mins / 2000) : 0.75;
    g = gap * k / 4.33 * (1 + (c.fac.train - 2) * 0.12) * (isMy ? TRAINING[S.training].grow : 1) * it.g * playing;
    if (p.learn) g *= 0.75;
  }
  const w = AW[p.pos]; const f = FOCUS[tf] && FOCUS[tf].v;
  const d = w.map((wi, i) => f ? 0.4 * wi + 0.6 * (f[i] || 0) : wi);
  const T = g / AW_SQ[p.pos];
  for (let i = 0; i < 9; i++) {
    if (!d[i]) continue;
    const cap = p.pot + 10;
    const mult = clamp((cap - at[i]) / 12, 0.05, 1);
    at[i] = Math.min(97, at[i] + T * d[i] * mult);
  }
  // ageing: legs go first, the head keeps improving for a while
  if (a >= 30) {
    const r1 = dry ? 1 : 0.5 + R(), r2 = dry ? 1 : 0.5 + R();
    for (const i of [4, 5, 6]) at[i] -= (a - 29) * 0.025 * r1;
    for (const i of [0, 1, 2, 3, 8]) at[i] -= (a - 29) * 0.008 * r2;
  }
  if (a >= 24 && a <= 33 && at[7] < p.pot + 6) at[7] += 0.012;
  for (let i = 0; i < 9; i++) at[i] = clamp(at[i], 15, 97);
  const before = p.ovr;
  const nOvr = calcOvr({ pos: p.pos, at });
  if (dry) return { dOvr: nOvr - before, dAt: at.map((x, i) => x - p.at[i]) };
  p.at = at.map(x => Math.round(x * 100) / 100);
  p.ovr = clamp(calcOvr(p), 30, 95);
  if (p.ovr > p.pot) p.pot = Math.ceil(p.ovr);
  // position retraining
  if (p.learn) {
    p.learn.prog += (5 + p.at[7] / 30) * (a <= 24 ? 1.3 : a <= 29 ? 1 : 0.7) * it.g;
    if (p.learn.prog >= 100) {
      p.pos2 = (p.pos2 || []).concat(p.learn.pos);
      if (isMy) news(S, `${p.name}が${p.learn.pos}を習得。${p.learn.pos}でも違和感なくプレーできる。`, 'grow');
      p.learn = null;
    }
  }
  return null;
}
function weekly(S) {
  for (const p of Object.values(S.players)) { if (!S.clubs[p.club] || !p.at) continue; devWeek(S, p, false); }
}
function devPreview(S, p) { // expected change over ~4 weeks with the current menu
  const r = devWeek(S, p, true); if (!r) return null;
  return { dOvr: r.dOvr * 4.33, dAt: r.dAt.map(x => x * 4.33) };
}

/* ---------- game creation ---------- */
function seasonForDate(todayISO, dataStartYear) {
  // J.League (from 2026/27) runs August -> June. A date from July onward belongs to the season starting that year.
  const y = D.y(todayISO), m = D.m(todayISO);
  const sy = m >= 7 ? y : y - 1;
  return { computed: sy, used: dataStartYear, note: sy !== dataStartYear };
}
function seasonLabel(y) { return y + '/' + String((y + 1) % 100).padStart(2, '0'); }

function newGame(DATA, clubId, managerName, todayISO) {
  const sy = D.y(DATA.start);
  const S = {
    v: 1, created: todayISO, startedFrom: todayISO,
    season: sy, date: DATA.start, my: clubId, manager: managerName || '監督',
    clubs: {}, players: {}, order: [], nextPid: 100000,
    fixtures: [], news: [], inbox: [], history: [], records: [],
    board: 60, settings: { autoSubs: true, speed: 1 }, training: 'bal',
    fired: null, seasonEnd: null, lastResult: null, nextInboxId: 1, tick: 0,
  };
  for (const c of DATA.clubs) addClub(S, c);
  for (const p of DATA.players) {
    S.players[p.id] = { ...p, cond: 100, form: 6.5, inj: 0, sus: 0, ycAcc: 0, listed: false, st: blankStats(), hist: [], joined: DATA.start };
    initAttrs(S.players[p.id]);
  }
  S.v = 2; S.presV = 4;
  for (const id of S.order) autoLineup(S, id);
  S.fixtures = genFixtures(S.order, DATA.round1, sy);
  ensureFreeAgents(S);
  setSponsors(S);
  setExpectations(S);
  news(S, `${S.clubs[clubId].name}の監督に就任。${seasonLabel(sy)}シーズンが始まる。`, 'big');
  news(S, `クラブの目標は「${S.clubs[clubId].target.jp}」。`, 'board');
  return S;
}
function blankStats() { return { apps: 0, g: 0, a: 0, yc: 0, rc: 0, rt: 0, mins: 0 }; }
function addClub(S, c) {
  const startFunds = [0, 30000, 50000, 80000, 120000, 180000][c.tier];
  S.clubs[c.id] = {
    id: c.id, name: c.name, short: c.short, abbr: c.abbr, c1: c.c1, c2: c.c2, stadium: c.stadium, cap: c.cap,
    coach: c.coach || '', tier: c.tier, fan: c.fan, area: c.area,
    pres: c.pres || 2, titles: Object.assign({ j1: 0, lc: 0, ec: 0, acl: 0 }, c.titles || {}), o10: !!c.o10,
    funds: startFunds, fac: { train: 2, youth: 2, stadium: 2, medical: 2 },
    tac: { form: '4-4-2', ment: 'bal', press: 'mid', xi: [], bench: [] },
    fin: { gate: 0, spon: 0, wages: 0, trans: 0, prize: 0, fac: 0 },
  };
  if (!S.order.includes(c.id)) S.order.push(c.id);
}
function squad(S, cid) { return Object.values(S.players).filter(p => p.club === cid); }
function strength(S, cid) {
  const top = squad(S, cid).map(p => p.ovr).sort((a, b) => b - a).slice(0, 14);
  return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
}
// チーム力 = 選手の実力 + クラブの格（経験・勝負強さ・サポーターの後押し）
const PRES_POWER = 0.8, PRES_MATCH = 0.25;
// prestige before the J.League-era-only recalculation (used to migrate saves)
// prestige values of earlier versions, so saves keep whatever a club gained or lost in-game
const PRES_BASE = { 1: {"chiba":2.78,"cosaka":2.51,"fctokyo":2.51,"fukuoka":1.98,"gosaka":3.51,"hiroshima":3.38,"kashima":5,"kashiwa":2.77,"kawasakif":3.86,"kobe":3.22,"kyoto":1.9,"machida":1.73,"mito":1,"nagasaki":1.19,"nagoya":3.01,"okayama":1.19,"shimizu":2.46,"tokyov":3.39,"urawa":4.05,"yokohamafm":3.98,"sapporo":2.0,"yokohamafc":1.5,"shonan":2.4,"niigata":2.0,"iwata":3.6,"tosu":1.8,"omiya":1.8,"sendai":2.0,"tokushima":1.4,"oita":2.0,"kofu":1.8,"yamagata":1.5,"iwaki":1.0,"imabari":1.0}, 2: {"chiba":2.29,"cosaka":2.35,"fctokyo":2.51,"fukuoka":1.98,"gosaka":3.48,"hiroshima":3.28,"kashima":5,"kashiwa":2.68,"kawasakif":3.86,"kobe":3.22,"kyoto":1.92,"machida":1.73,"mito":1,"nagasaki":1.19,"nagoya":3.01,"okayama":1.19,"shimizu":2.46,"tokyov":3.09,"urawa":3.95,"yokohamafm":3.83,"sapporo":1.69,"yokohamafc":1.43,"shonan":2.19,"niigata":1.79,"iwata":3.34,"tosu":1.69,"omiya":1.66,"sendai":1.71,"tokushima":1.27,"oita":1.84,"kofu":1.86,"yamagata":1.38,"iwaki":1,"imabari":1}, 3: {"chiba":2.91,"cosaka":2.5,"fctokyo":2.55,"fukuoka":1.96,"gosaka":3.68,"hiroshima":3.47,"kashima":5,"kashiwa":2.89,"kawasakif":3.46,"kobe":2.97,"kyoto":1.98,"machida":1.65,"mito":1,"nagasaki":1.2,"nagoya":3.06,"okayama":1.2,"shimizu":2.56,"tokyov":3.55,"urawa":3.95,"yokohamafm":3.96,"sapporo":1.73,"yokohamafc":1.45,"shonan":2.33,"niigata":1.84,"iwata":3.53,"tosu":1.73,"omiya":1.7,"sendai":1.76,"tokushima":1.29,"oita":1.89,"kofu":1.82,"yamagata":1.41,"iwaki":1,"imabari":1} };
function power(S, cid) { const c = S.clubs[cid]; return strength(S, cid) + ((c.pres || 2) - 3) * PRES_POWER; }
function presStars(v) { return Math.max(1, Math.min(5, Math.round(v || 1))); }
function presLabel(v) { return v >= 4.5 ? '名門' : v >= 3.5 ? '強豪' : v >= 2.5 ? '中堅' : v >= 1.6 ? '新興' : '挑戦者'; }
function setSponsors(S) {
  for (const cid of S.order) {
    const c = S.clubs[cid]; if (c.spon) continue;
    const w = squad(S, cid).reduce((a, p) => a + wage(p), 0);
    c.spon = Math.round((w * 0.6 + c.tier * 5000) / 12 / 10) * 10;
  }
}
function setExpectations(S, opts) {
  const pw = Object.fromEntries(S.order.map(cid => [cid, power(S, cid)]));
  const ranked = [...S.order].sort((a, b) => pw[b] - pw[a]);
  ranked.forEach((cid, i) => { S.clubs[cid].pred = i + 1; });
  // the board of a bigger club asks for more than the squad alone would suggest
  const exp = [...S.order].sort((a, b) => (pw[b] + ((S.clubs[b].pres || 2) - 3) * 0.9) - (pw[a] + ((S.clubs[a].pres || 2) - 3) * 0.9));
  if (opts && opts.keepTargets) return; // mid-season: only the forecast moves
  exp.forEach((cid, i) => {
    const r = i + 1; let t;
    if (r <= 3) t = { pos: 3, jp: '優勝争い（3位以内）' };
    else if (r <= 7) t = { pos: 7, jp: '上位進出（7位以内）' };
    else if (r <= 13) t = { pos: 13, jp: '中位確保（13位以内）' };
    else t = { pos: 17, jp: 'J1残留（17位以内）' };
    S.clubs[cid].target = t;
  });
}

/* ---------- fixtures ---------- */
const H2_OFFSETS = [0, 7, 14, 21, 28, 35, 49, 56, 63, 71, 75, 79, 84, 91, 98, 105, 109, 113];
function seasonDates(sy) {
  // first half: 20 Saturdays from the Saturday on/after Aug 7
  let d = sy + '-08-07'; while (D.dow(d) !== 6) d = D.add(d, 1);
  const first = []; for (let i = 0; i < 20; i++) first.push(D.add(d, 7 * i));
  let f = (sy + 1) + '-02-10'; while (D.dow(f) !== 6) f = D.add(f, 1);
  const second = H2_OFFSETS.map(o => D.add(f, o));
  return first.concat(second);
}
function genFixtures(order, round1, sy) {
  const n = order.length; const arr = new Array(n);
  if (round1 && round1.length === n / 2 && round1.every(p => order.includes(p[0]) && order.includes(p[1]))) {
    round1.forEach((p, k) => { arr[k] = p[0]; arr[n - 1 - k] = p[1]; });
  } else {
    const sh = [...order].sort(() => R() - 0.5); sh.forEach((c, i) => arr[i] = c);
  }
  const fixed = arr[0]; let rot = arr.slice(1);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const list = [fixed, ...rot]; const ms = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      const homeFirst = i === 0 ? r % 2 === 0 : r % 2 === 0;
      ms.push(homeFirst ? [a, b] : [b, a]);
    }
    rounds.push(ms);
    rot.unshift(rot.pop());
  }
  const all = rounds.concat(rounds.map(ms => ms.map(([h, a]) => [a, h])));
  const dates = seasonDates(sy);
  const fx = []; let id = 1;
  all.forEach((ms, r) => ms.forEach(([h, a]) => {
    let date = dates[r];
    if (r === 0 && round1 && h === round1[0][0] && a === round1[0][1] && sy === 2026) date = '2026-08-07';
    fx.push({ id: id++, r: r + 1, date, h, a, hg: null, ag: null, played: false });
  }));
  return fx;
}

/* ---------- table ---------- */
function table(S) {
  const t = {}; for (const id of S.order) t[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  for (const f of S.fixtures) {
    if (!f.played || !t[f.h] || !t[f.a]) continue;
    const H = t[f.h], A = t[f.a];
    H.p++; A.p++; H.gf += f.hg; H.ga += f.ag; A.gf += f.ag; A.ga += f.hg;
    if (f.hg > f.ag) { H.w++; A.l++; H.pts += 3; H.form.push('W'); A.form.push('L'); }
    else if (f.hg < f.ag) { A.w++; H.l++; A.pts += 3; H.form.push('L'); A.form.push('W'); }
    else { H.d++; A.d++; H.pts++; A.pts++; H.form.push('D'); A.form.push('D'); }
  }
  return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id));
}
function position(S, cid) { return table(S).findIndex(r => r.id === cid) + 1; }

/* ---------- lineups ---------- */
function posPenalty(p, role) {
  const R0 = ROLE[role];
  if (R0.cat === 'GK') return p.pos === 'GK' ? 0 : -35;
  if (p.pos === 'GK') return -35;
  if (p.pos === R0.cat) return 0;
  let base;
  if (R0.alt && p.pos === R0.alt) base = -3;
  else if ((p.pos === 'DF' && R0.cat === 'FW') || (p.pos === 'FW' && R0.cat === 'DF')) base = -14;
  else base = -7;
  if (p.pos2 && p.pos2.includes(R0.cat)) return Math.max(base, -1);
  if (p.learn && p.learn.pos === R0.cat) return base + (-1 - base) * Math.min(1, p.learn.prog / 100) * 0.6;
  return base;
}
function available(p) { return p.inj <= 0 && p.sus <= 0; }
function effective(p, role, cond) {
  const c = cond == null ? p.cond : cond;
  const formAdj = clamp((p.form - 6.5) * 1.2, -2, 2);
  const fit = p.at ? clamp((roleScore(p, role) - p.ovr) * 0.4, -2.5, 2.5) : 0;
  return p.ovr + posPenalty(p, role) + fit - Math.max(0, 100 - c) * 0.12 + formAdj;
}
function autoLineup(S, cid, opts) {
  const c = S.clubs[cid];
  const slots = FORMATIONS[c.tac.form];
  const pool = squad(S, cid).filter(available);
  const used = new Set(); const xi = new Array(11).fill(null);
  const restCond = opts && opts.rotate ? 82 : 72;
  // order: GK, ST/W, CB/FB, MF
  const orderIdx = slots.map((s, i) => i).sort((a, b) => {
    const pr = r => ({ GK: 0, ST: 1, LW: 2, RW: 2, CB: 3, LB: 4, RB: 4, DM: 5, AM: 6, WAM: 6, WB: 7, CM: 8, LM: 9, RM: 9 })[slots[r][0]];
    return pr(a) - pr(b);
  });
  for (const i of orderIdx) {
    const role = slots[i][0];
    let best = null, bv = -1e9;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      let v = effective(p, role);
      if (p.cond < restCond) v -= (restCond - p.cond) * 0.4;
      if (v > bv) { bv = v; best = p; }
    }
    if (best) { xi[i] = best.id; used.add(best.id); }
  }
  c.tac.xi = xi;
  autoBench(S, cid);
}
function autoBench(S, cid) {
  const c = S.clubs[cid];
  const rest = squad(S, cid).filter(p => available(p) && !c.tac.xi.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
  const bench = [];
  const gk = rest.find(p => p.pos === 'GK'); if (gk) bench.push(gk.id);
  for (const p of rest) { if (bench.length >= 9) break; if (p.pos === 'GK') continue; bench.push(p.id); }
  c.tac.bench = bench;
}
function clubRating(S, cid) {
  const c = S.clubs[cid];
  const slots = FORMATIONS[c.tac.form].map((s0, i) => ({ role: s0[0], pid: c.tac.xi[i] && S.players[c.tac.xi[i]] ? c.tac.xi[i] : null }));
  const cond = {}; for (const s0 of slots) if (s0.pid) cond[s0.pid] = S.players[s0.pid].cond;
  return teamRating(S, { slots, cond, press: c.tac.press, tactBonus: cid === S.my && S.training === 'tact' ? 1 : 0, pres: c.pres || 2 });
}
function validateLineup(S, cid) {
  const c = S.clubs[cid];
  const ok = id => id && S.players[id] && S.players[id].club === cid && available(S.players[id]);
  let changed = false;
  c.tac.xi = c.tac.xi.map(id => { if (ok(id)) return id; changed = true; return null; });
  c.tac.bench = c.tac.bench.filter(id => ok(id) && !c.tac.xi.includes(id));
  if (c.tac.xi.some(x => !x)) {
    const slots = FORMATIONS[c.tac.form];
    const pool = squad(S, cid).filter(p => available(p) && !c.tac.xi.includes(p.id));
    c.tac.xi.forEach((id, i) => {
      if (id) return;
      let best = null, bv = -1e9;
      for (const p of pool) { if (c.tac.xi.includes(p.id)) continue; const v = effective(p, slots[i][0]); if (v > bv) { bv = v; best = p; } }
      if (best) { c.tac.xi[i] = best.id; c.tac.bench = c.tac.bench.filter(b => b !== best.id); }
    });
    changed = true;
  }
  autoBench(S, cid);
  return changed;
}

/* ---------- team strength ---------- */
function teamRating(S, side) {
  // side: {form, ment, press, slots:[{role, pid}], cond:{pid:val}}
  let a = 0, aw = 0, m = 0, mw = 0, d = 0, dw = 0, gk = 45;
  for (const s of side.slots) {
    const R0 = ROLE[s.role];
    if (s.role === 'GK') { if (s.pid) gk = effective(S.players[s.pid], 'GK', side.cond[s.pid]); continue; }
    const e = s.pid ? effective(S.players[s.pid], s.role, side.cond[s.pid]) : 38;
    a += e * R0.a; aw += R0.a; m += e * R0.m; mw += R0.m; d += e * R0.d; dw += R0.d;
  }
  const P = PRESS[side.press];
  const pb = side.pres != null ? (side.pres - 3) * PRES_MATCH : 0;
  return { att: a / aw + pb, attV: aw, mid: m / mw + P.mid + (side.tactBonus || 0) + pb, def: (d / dw) * 0.75 + gk * 0.25 + pb, defV: dw, gk };
}

/* ---------- match engine ---------- */
let _lgKey = null, _lg = null;
function leagueAvg(S) {
  const key = S.date + '|' + S.season + '|' + S.order.length;
  if (_lgKey === key && _lg) return _lg;
  let a = 0, m = 0, d = 0, n = 0;
  for (const cid of S.order) {
    const c = S.clubs[cid];
    const slots = FORMATIONS[c.tac.form].map((s0, i) => ({ role: s0[0], pid: c.tac.xi[i] && S.players[c.tac.xi[i]] ? c.tac.xi[i] : null }));
    const cond = {}; for (const s0 of slots) if (s0.pid) cond[s0.pid] = 100;
    const r = teamRating(S, { slots, cond, press: 'mid', pres: c.pres || 2 });
    a += r.att; m += r.mid; d += r.def; n++;
  }
  _lgKey = key; _lg = { att: a / n, mid: m / n, def: d / n };
  return _lg;
}
function sideFor(S, cid) {
  const c = S.clubs[cid];
  validateLineup(S, cid);
  const slots = FORMATIONS[c.tac.form].map((s, i) => ({ role: s[0], x: s[1], y: s[2], pid: c.tac.xi[i] || null }));
  const cond = {};
  for (const s of slots) if (s.pid) cond[s.pid] = S.players[s.pid].cond;
  const tactBonus = cid === S.my && S.training === 'tact' ? 1 : 0;
  return { cid, form: c.tac.form, ment: c.tac.ment, press: c.tac.press, slots, bench: [...c.tac.bench], subs: 0, subLog: [], cond, tactBonus, sent: [], pres: c.pres || 2, fan: c.fan || 2 };
}
function createMatch(S, fx) {
  const M = {
    fid: fx.id, min: 0, half: 1, done: false, h: sideFor(S, fx.h), a: sideFor(S, fx.a), hg: 0, ag: 0,
    ev: [], st: { h: { sh: 0, ot: 0, pos: 0, fo: 0 }, a: { sh: 0, ot: 0, pos: 0, fo: 0 } },
    pm: {}, mom: 0, ball: { x: 50, y: 50, side: 'h' }, userSide: fx.h === S.my ? 'h' : fx.a === S.my ? 'a' : null,
    lg: leagueAvg(S),
  };
  for (const k of ['h', 'a']) for (const s of M[k].slots) if (s.pid) M.pm[s.pid] = { side: k, rt: 6.0, g: 0, a: 0, yc: 0, rc: 0, on: 0, off: null, inj: 0 };
  M.ev.push({ m: 0, t: 'ko', text: `キックオフ　${S.clubs[fx.h].short} vs ${S.clubs[fx.a].short}` });
  return M;
}
function onPitch(side) { return side.slots.filter(s => s.pid && !side.sent.includes(s.pid)); }
function pname(S, pid) { return S.players[pid] ? S.players[pid].name : '?'; }

function stepMatch(S, M) {
  if (M.done) return [];
  const out = [];
  const push = e => { e.m = M.min; M.ev.push(e); out.push(e); };
  M.min++;
  const H = M.h, A = M.a;
  // live ratings (recomputed with current cond and red cards)
  const live = side => {
    const sd = { ...side, slots: side.slots.map(s => ({ ...s, pid: side.sent.includes(s.pid) ? null : s.pid })) };
    return teamRating(S, sd);
  };
  const rh = live(H), ra = live(A);
  const pH = 1 / (1 + Math.exp(-((rh.mid - ra.mid) + 1.0) / 7));
  M.st.h.pos += pH; M.st.a.pos += 1 - pH;
  const ms = MENTALITY, lg = M.lg;
  const base = 0.101;
  const rate = (r, o, p, ownM, oppM) => base * (1 + (p - 0.5) * 0.4) * Math.exp(((r.att - lg.att) - (o.def - lg.def)) / 37) * Math.pow(r.attV / 4.1, 0.35) * Math.pow(o.defV / 4.6, -0.35) * ms[ownM].own * ms[oppM].opp;
  const lateBoost = (M.min > 80 ? 1.08 : 1);
  // 終盤、リードされている／追いつきたい名門は粘る
  const grit = (sd, own, opp) => M.min >= 75 && own <= opp ? 1 + ((sd.pres || 2) - 3) * 0.04 : 1;
  const rH = rate(rh, ra, pH, H.ment, A.ment) * lateBoost * (1.03 + (H.fan || 2) * 0.01) * grit(H, M.hg, M.ag);
  const rA = rate(ra, rh, 1 - pH, A.ment, H.ment) * lateBoost * 0.97 * grit(A, M.ag, M.hg);
  // condition drain
  for (const sd of [H, A]) {
    const drain = 0.19 + PRESS[sd.press].drain * 0.012;
    for (const s of sd.slots) if (s.pid && sd.cond[s.pid] != null) { const st = S.players[s.pid].at ? S.players[s.pid].at[6] : 65; sd.cond[s.pid] = Math.max(20, sd.cond[s.pid] - drain * (1.32 - st / 200)); }
  }
  M.mom = M.mom * 0.85 + (pH - 0.5) * 0.6;
  M.ball.side = R() < pH ? 'h' : 'a';
  let chanceH = R() < rH, chanceA = R() < rA;
  if (chanceH && chanceA) { if (R() < 0.5) chanceH = false; else chanceA = false; }
  if (chanceH) chance(S, M, 'h', rh, ra, push);
  if (chanceA) chance(S, M, 'a', ra, rh, push);
  // fouls & cards
  for (const k of ['h', 'a']) {
    const sd = M[k];
    if (R() < 0.13) M.st[k].fo++;
    if (R() < 0.021 * (sd.press === 'high' ? 1.25 : 1)) {
      const pl = wpick(onPitch(sd).filter(s => s.role !== 'GK'), s => ROLE[s.role].d + 0.3);
      if (pl) {
        const pm = M.pm[pl.pid];
        if (pm.yc >= 1) { pm.yc++; pm.rc = 1; sd.sent.push(pl.pid); pm.rt -= 1.5; push({ t: 'red', side: k, pid: pl.pid, text: `${pname(S, pl.pid)}に2枚目のイエロー、退場` }); }
        else { pm.yc = 1; pm.rt -= 0.3; push({ t: 'yc', side: k, pid: pl.pid, text: `${pname(S, pl.pid)}にイエローカード` }); }
      }
    } else if (R() < 0.0005) {
      const pl = pick(onPitch(sd).filter(s => s.role !== 'GK'));
      if (pl) { M.pm[pl.pid].rc = 1; M.pm[pl.pid].rt -= 2; sd.sent.push(pl.pid); push({ t: 'red', side: k, pid: pl.pid, text: `${pname(S, pl.pid)}に一発レッド！退場` }); }
    }
    // injury
    const med = S.clubs[sd.cid].fac.medical;
    if (R() < 0.0021 * (1.15 - med * 0.06)) {
      const pl = pick(onPitch(sd));
      if (pl && !M.pm[pl.pid].inj) {
        const days = wpick([[3, 6], [7, 14], [15, 30], [31, 75]], r => [55, 28, 12, 5][[3, 7, 15, 31].indexOf(r[0])]);
        M.pm[pl.pid].inj = ri(days[0], days[1]);
        push({ t: 'inj', side: k, pid: pl.pid, text: `${pname(S, pl.pid)}が痛んでいる…プレー続行は難しそうだ` });
        forceSub(S, M, k, pl.pid, push);
      }
    }
  }
  // AI (and auto) substitutions
  for (const k of ['h', 'a']) {
    const auto = M.userSide !== k || S.settings.autoSubs;
    if (auto && [58, 66, 74, 82].includes(M.min)) aiSubs(S, M, k, push);
  }
  if (M.min === 45) { push({ t: 'ht', text: `前半終了　${M.hg} - ${M.ag}` }); M.half = 2; }
  if (M.min >= 90 + (M.extra || 0)) {
    if (M.extra == null) { M.extra = ri(2, 5); }
    else { M.done = true; push({ t: 'ft', text: `試合終了　${S.clubs[M.h.cid].short} ${M.hg} - ${M.ag} ${S.clubs[M.a.cid].short}` }); }
  }
  // ambient build-up text (for live view)
  if (!out.length && R() < 0.05) {
    const k = M.ball.side; const sd = M[k];
    const pl = pick(onPitch(sd).filter(s => s.role !== 'GK'));
    if (pl) push({ t: 'play', side: k, text: pick([`${pname(S, pl.pid)}がボールを運ぶ`, `${S.clubs[sd.cid].short}が押し込む時間帯`, `${pname(S, pl.pid)}が中盤で前を向いた`, `${S.clubs[sd.cid].short}、サイドから崩しにかかる`, `${pname(S, pl.pid)}のクロスは跳ね返される`]) });
  }
  return out;
}
function chance(S, M, k, r, o, push) {
  const sd = M[k], opp = M[k === 'h' ? 'a' : 'h'];
  const shooters = onPitch(sd).filter(s => s.role !== 'GK');
  if (!shooters.length) return;
  const sh = wpick(shooters, s => (ROLE[s.role].a * 3 + 0.15) * Math.pow(S.players[s.pid].ovr / 70, 3));
  const P = S.players[sh.pid];
  const atk = P.at ? P.at[0] : P.ovr;
  M.st[k].sh++;
  M.ball = { x: sh.x, y: 85, side: k };
  const shotSkill = (effective(P, sh.role, sd.cond[sh.pid]) * 0.5 + atk * 0.5);
  const q = 0.112 * Math.exp((shotSkill - o.gk) / 30);
  const onT = R() < 0.36 + (shotSkill - 65) * 0.006;
  const gkPid = (onPitch(opp).find(s => s.role === 'GK') || {}).pid;
  if (onT) M.st[k].ot++;
  if (onT && R() < q / 0.36) {
    if (k === 'h') M.hg++; else M.ag++;
    const pm = M.pm[sh.pid]; pm.g++; pm.rt += 1.1;
    let ast = null;
    if (R() < 0.72) {
      const as = shooters.filter(s => s.pid !== sh.pid);
      if (as.length) { ast = wpick(as, s => ROLE[s.role].m + ROLE[s.role].a + 0.1); M.pm[ast.pid].a++; M.pm[ast.pid].rt += 0.6; }
    }
    for (const s of onPitch(sd)) M.pm[s.pid].rt += 0.08;
    for (const s of onPitch(opp)) if (ROLE[s.role].d >= 0.5 || s.role === 'GK') M.pm[s.pid].rt -= 0.22;
    push({ t: 'goal', side: k, pid: sh.pid, ast: ast && ast.pid, text: `ゴール！ ${P.name}` + (ast ? `（アシスト：${pname(S, ast.pid)}）` : ''), score: `${M.hg}-${M.ag}` });
  } else if (onT) {
    if (gkPid) M.pm[gkPid].rt += 0.15;
    M.pm[sh.pid].rt += 0.05;
    push({ t: 'save', side: k, pid: sh.pid, text: pick([`${P.name}のシュート！ GK${gkPid ? S.players[gkPid].short : ''}が止める`, `${P.name}が狙うもセーブされる`, `${P.name}のミドルはGK正面`]) });
  } else {
    M.pm[sh.pid].rt -= 0.05;
    push({ t: 'miss', side: k, pid: sh.pid, text: pick([`${P.name}のシュートは枠の外`, `${P.name}のヘディングはわずかに上`, `${P.name}、決定機を逃す`, `${P.name}のシュートはDFがブロック`]) });
  }
}
function benchOptions(S, M, k) {
  const sd = M[k];
  return sd.bench.filter(id => S.players[id] && !M.pm[id]);
}
function doSub(S, M, k, outPid, inPid, push) {
  const sd = M[k];
  if (sd.subs >= 5) return false;
  const slot = sd.slots.find(s => s.pid === outPid);
  if (!slot || sd.sent.includes(outPid)) return false;
  slot.pid = inPid; sd.subs++;
  sd.cond[inPid] = S.players[inPid].cond;
  M.pm[outPid].off = M.min;
  M.pm[inPid] = { side: k, rt: 6.0, g: 0, a: 0, yc: 0, rc: 0, on: M.min, off: null, inj: 0 };
  sd.bench = sd.bench.filter(b => b !== inPid);
  sd.subLog.push([outPid, inPid]);
  const ev = { t: 'sub', side: k, text: `交代　${S.players[outPid].short} → ${S.players[inPid].short}`, m: M.min };
  if (push) push(ev); else M.ev.push(ev);
  return true;
}
function bestSubFor(S, M, k, slot) {
  let best = null, bv = -1e9;
  for (const id of benchOptions(S, M, k)) { const v = effective(S.players[id], slot.role); if (v > bv) { bv = v; best = id; } }
  return best;
}
function forceSub(S, M, k, pid, push) {
  const sd = M[k]; const slot = sd.slots.find(s => s.pid === pid);
  if (!slot) return;
  const inn = bestSubFor(S, M, k, slot);
  if (inn && sd.subs < 5) doSub(S, M, k, pid, inn, push);
  else { sd.sent.push(pid); }
}
function aiSubs(S, M, k, push) {
  const sd = M[k];
  if (sd.subs >= 5) return;
  const cands = onPitch(sd).filter(s => s.role !== 'GK').map(s => ({ s, c: sd.cond[s.pid], rt: M.pm[s.pid].rt }))
    .sort((x, y) => (x.c + x.rt * 4) - (y.c + y.rt * 4));
  const n = M.min >= 74 ? 2 : 1;
  for (let i = 0; i < n && i < cands.length; i++) {
    const { s, c } = cands[i];
    if (c > 72 && M.min < 80) continue;
    const inn = bestSubFor(S, M, k, s);
    if (!inn) return;
    if (effective(S.players[inn], s.role) < effective(S.players[s.pid], s.role, c) - 4) continue;
    doSub(S, M, k, s.pid, inn, push);
  }
}
function setMentality(M, k, ment) { M[k].ment = ment; }

function simulateFull(S, M) { while (!M.done) stepMatch(S, M); return M; }

/* ---------- apply results ---------- */
function finishMatch(S, M) {
  const fx = S.fixtures.find(f => f.id === M.fid);
  fx.hg = M.hg; fx.ag = M.ag; fx.played = true;
  fx.sc = M.ev.filter(e => e.t === 'goal' || e.t === 'red').map(e => [e.m, e.side, e.t === 'goal' ? 'g' : 'r', e.pid]);
  const res = { h: M.hg > M.ag ? 'W' : M.hg < M.ag ? 'L' : 'D' };
  res.a = res.h === 'W' ? 'L' : res.h === 'L' ? 'W' : 'D';
  // serve existing suspensions (suspended players were not in this match)
  for (const cid of [fx.h, fx.a]) for (const p of squad(S, cid)) if (p.sus > 0 && !M.pm[p.id]) p.sus--;
  // player updates
  for (const [pidS, pm] of Object.entries(M.pm)) {
    const p = S.players[pidS]; if (!p) continue;
    const k = pm.side, sd = M[k];
    const mins = (pm.off != null ? pm.off : Math.min(90, M.min)) - pm.on;
    let rt = pm.rt + (res[k] === 'W' ? 0.3 : res[k] === 'L' ? -0.25 : 0) + (R() * 0.8 - 0.4);
    const conceded = k === 'h' ? M.ag : M.hg;
    if (p.pos === 'GK' || p.pos === 'DF') rt += conceded === 0 ? 0.4 : -0.1 * conceded;
    rt = clamp(Math.round(rt * 10) / 10, 3.5, 10);
    pm.final = rt;
    p.st.apps++; p.st.g += pm.g; p.st.a += pm.a; p.st.mins += Math.max(1, mins); p.st.rt += rt;
    p.form = p.form * 0.6 + rt * 0.4;
    p.cond = Math.round(sd.cond[pidS] != null ? sd.cond[pidS] : p.cond - 10);
    if (pm.yc && !pm.rc) { p.st.yc++; p.ycAcc++; if (p.ycAcc >= 4) { p.sus = 1; p.ycAcc = 0; if (p.club === S.my) news(S, `${p.name}は累積警告で次節出場停止。`, 'warn'); } }
    if (pm.rc) { p.st.rc++; p.sus = Math.max(p.sus, pm.yc >= 2 ? 1 : 2); if (p.club === S.my) news(S, `${p.name}は退場処分で出場停止（${p.sus}試合）。`, 'warn'); }
    if (pm.inj) { p.inj = pm.inj; if (p.club === S.my) news(S, `${p.name}が負傷。全治およそ${pm.inj}日の見込み。`, 'warn'); }
  }
  // finances: gate for home club
  const hc = S.clubs[fx.h];
  const att = attendance(S, fx.h, fx.a);
  fx.att = att;
  const gate = Math.round(att * (0.2 + hc.fac.stadium * 0.01));
  hc.funds += gate; hc.fin.gate += gate;
  // board
  if (M.userSide) {
    const k = M.userSide, opp = k === 'h' ? fx.a : fx.h;
    const myS = strength(S, S.my), opS = strength(S, opp) - (k === 'h' ? 1 : -1);
    const expPts = clamp(1.35 + (myS - opS) * 0.18, 0.4, 2.4);
    const pts = res[k] === 'W' ? 3 : res[k] === 'D' ? 1 : 0;
    S.board = clamp(Math.round(S.board + (pts - expPts) * 3.2), 0, 100);
    const mg = k === 'h' ? M.hg : M.ag, og = k === 'h' ? M.ag : M.hg;
    S.lastResult = { fid: fx.id, res: res[k], text: `${S.clubs[fx.h].short} ${M.hg}-${M.ag} ${S.clubs[fx.a].short}` };
    const potm = Object.entries(M.pm).filter(([, pm]) => pm.side === k).sort((a, b) => b[1].final - a[1].final)[0];
    news(S, `第${fx.r}節　${S.clubs[fx.h].short} ${M.hg}-${M.ag} ${S.clubs[fx.a].short}（${res[k] === 'W' ? '勝利' : res[k] === 'D' ? '引き分け' : '敗戦'}）` + (potm ? `　チーム最高評価：${S.players[potm[0]].name}（${potm[1].final.toFixed(1)}）` : ''), res[k] === 'W' ? 'win' : res[k] === 'L' ? 'loss' : 'draw');
    void mg; void og;
  }
  M.applied = true;
  return fx;
}
function attendance(S, hid, aid) {
  const c = S.clubs[hid], o = S.clubs[aid];
  const t = table(S); const row = t.find(r => r.id === hid); const pos = t.indexOf(row) + 1;
  let f = 1 + (o.fan >= 4 ? 0.08 : 0) + (c.fac.stadium - 2) * 0.05 + (row && row.p > 3 ? (10 - pos) * 0.012 : 0) + (c.hype || 0);
  f += R() * 0.12 - 0.06;
  return Math.round(clamp(FANBASE[c.fan] * f, 3000, c.cap * 0.97));
}

/* ---------- news & inbox ---------- */
function news(S, text, type) { S.news.unshift({ d: S.date, text, type: type || 'info' }); if (S.news.length > 120) S.news.length = 120; }

/* ---------- daily loop ---------- */
function todaysFixtures(S) { return S.fixtures.filter(f => f.date === S.date && !f.played); }
function myFixtureToday(S) { return todaysFixtures(S).find(f => f.h === S.my || f.a === S.my); }
function nextMyFixture(S) { return S.fixtures.filter(f => !f.played && (f.h === S.my || f.a === S.my)).sort((a, b) => a.date.localeCompare(b.date) || a.r - b.r)[0]; }
function inWindow(date) {
  const md = date.slice(5);
  return (md >= '06-07' && md <= '08-28') || md >= '12-20' || md <= '02-26';
}
function windowEnd(date) {
  const y = D.y(date), md = date.slice(5);
  if (md >= '06-07' && md <= '08-28') return y + '-08-28';
  if (md >= '12-20') return (y + 1) + '-02-26';
  if (md <= '02-26') return y + '-02-26';
  return null;
}
function nextWindowStart(date) {
  const y = D.y(date), md = date.slice(5);
  if (md < '06-07' && md > '02-26') return y + '-06-07';
  return y + '-12-20';
}
function simAIToday(S) {
  for (const f of todaysFixtures(S)) {
    if (f.h === S.my || f.a === S.my) continue;
    const M = createMatch(S, f); simulateFull(S, M); finishMatch(S, M);
  }
}
function seasonOver(S) { return S.fixtures.every(f => f.played); }

// Advance until something needs the manager. Returns a stop descriptor.
function advance(S, maxDays) {
  maxDays = maxDays || 400;
  for (let i = 0; i < maxDays; i++) {
    if (S.fired) return { stop: 'fired' };
    if (S.seasonEnd) return { stop: 'seasonEnd' };
    const mf = myFixtureToday(S);
    if (mf) { simAIToday(S); return { stop: 'match', fid: mf.id }; }
    simAIToday(S);
    if (seasonOver(S) && !S.seasonEnd && S.fixtures.length) { endSeason(S); return { stop: 'seasonEnd' }; }
    const before = S.inbox.filter(x => !x.seen).length;
    nextDay(S);
    if (S.fired) return { stop: 'fired' };
    if (S.inbox.filter(x => !x.seen).length > before) return { stop: 'inbox' };
    if (S._stopNote) { const n = S._stopNote; S._stopNote = null; return { stop: 'note', text: n }; }
  }
  return { stop: 'limit' };
}
function nextDay(S) {
  const prev = S.date;
  S.date = D.add(S.date, 1); S.tick++;
  const wasIn = inWindow(prev), isIn = inWindow(S.date);
  if (!wasIn && isIn) { news(S, `移籍期間がオープン（〜${jdate(windowEnd(S.date))}）。`, 'transfer'); S._stopNote = '移籍期間がオープンしました'; }
  if (wasIn && !isIn) { news(S, '移籍期間が終了。', 'transfer'); for (const p of Object.values(S.players)) if (p.listed && p.club === S.my) p.listed = false; }
  // recovery
  for (const p of Object.values(S.players)) {
    const c = S.clubs[p.club]; if (!c) continue;
    const med = c.fac.medical;
    const mine = p.club === S.my;
    const it = INTENS[mine ? (p.ti || 'norm') : 'norm'];
    let rec = 6 + med * 0.6 + (mine ? TRAINING[S.training].rec + it.rec : 0);
    if (age(p, S.date) >= 31) rec -= 1;
    p.cond = Math.min(100, p.cond + rec);
    if (mine && it.inj && p.inj <= 0 && R() < it.inj * (1.15 - med * 0.06)) { p.inj = ri(3, 14); news(S, `${p.name}がハードトレーニング中に負傷。全治およそ${p.inj}日。`, 'warn'); }
    if (p.inj > 0) { p.inj--; if (p.inj === 0 && p.club === S.my) news(S, `${p.name}が負傷から復帰。`, 'info'); }
  }
  for (const it of S.inbox) if (!it.done && it.exp && S.date > it.exp) { it.done = true; it.result = 'expired'; }
  if (D.dow(S.date) === 1) weekly(S);
  if (D.d(S.date) === 1) monthly(S);
  if (isIn) transferDay(S);
  // board patience
  if (S.board <= 8 && S.fixtures.filter(f => f.played && (f.h === S.my || f.a === S.my)).length >= 10) fire(S, '成績不振による解任');
  // AI lineups refresh (cheap): before each matchday
  for (const cid of S.order) if (cid !== S.my && S.fixtures.some(f => f.date === S.date && !f.played && (f.h === cid || f.a === cid))) autoLineup(S, cid, { rotate: true });
  if (S.fixtures.some(f => f.date === S.date && !f.played && (f.h === S.my || f.a === S.my))) validateLineup(S, S.my);
}
function monthly(S) {
  // wages & sponsors for every club
  for (const cid of S.order) {
    const c = S.clubs[cid];
    const w = Math.round(squad(S, cid).reduce((a, p) => a + wage(p), 0) / 12);
    const sp = c.spon || 5000;
    c.funds += sp - w; c.fin.wages += w; c.fin.spon += sp;
  }
  // development report for my club (change since last month)
  const mine = squad(S, S.my).filter(p => p.at);
  const shown = p => ({ p, a: Math.round(p.ovrM != null ? p.ovrM : p.ovr), b: Math.round(p.ovr) });
  const ups = mine.map(shown).filter(x => x.b > x.a).sort((x, y) => (y.b - y.a) - (x.b - x.a) || y.b - x.b).slice(0, 4);
  if (ups.length) news(S, `育成レポート：` + ups.map(x => `${x.p.name} ${x.a}→${x.b}`).join('、'), 'grow');
  const downs = mine.map(shown).filter(x => x.b < x.a).sort((x, y) => (x.b - x.a) - (y.b - y.a)).slice(0, 3);
  if (downs.length) news(S, `衰えが見える：` + downs.map(x => `${x.p.name} ${x.a}→${x.b}`).join('、'), 'warn');
  for (const p of mine) p.ovrM = p.ovr;
  const my = S.clubs[S.my];
  news(S, `${D.m(S.date)}月の収支：スポンサー収入 ${money(my.spon || 0)}／人件費 ${money(Math.round(squad(S, S.my).reduce((a, p) => a + wage(p), 0) / 12))}`, 'money');
  if (my.funds < 0) { S.board = clamp(S.board - 6, 0, 100); news(S, '資金がマイナスになっている。フロントは財政を懸念している。', 'warn'); }
}

/* ---------- transfers ---------- */
function squadNeedsPos(S, cid, pos) { return squad(S, cid).filter(p => p.pos === pos).length; }
function transferDay(S) {
  // offers for listed players
  for (const p of Object.values(S.players)) {
    if (p.club !== S.my || !p.listed) continue;
    if (S.inbox.some(x => x.type === 'offer' && x.pid === p.id && !x.done)) continue;
    if (R() < 0.13) makeOffer(S, p, 0.72 + R() * 0.33);
  }
  // occasional unsolicited bids for my best players
  if (R() < 0.012) {
    const top = squad(S, S.my).filter(p => !p.listed && available(p)).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
    const p = pick(top); if (p && !S.inbox.some(x => x.type === 'offer' && x.pid === p.id && !x.done)) makeOffer(S, p, 1.05 + R() * 0.35);
  }
  // AI <-> AI moves
  if (R() < 0.05) aiTransfer(S);
}
function makeOffer(S, p, mult) {
  const v = value(p, S.date);
  const buyers = S.order.filter(c => c !== S.my && S.clubs[c].funds > v * mult && squad(S, c).length < 38 && strength(S, c) < p.ovr + 6);
  if (!buyers.length) return;
  const from = pick(buyers);
  const fee = Math.round(v * mult / 100) * 100;
  S.inbox.unshift({ id: S.nextInboxId++, type: 'offer', pid: p.id, from, fee, d: S.date, exp: D.add(S.date, 5), seen: false, done: false });
}
function acceptOffer(S, iid) {
  const it = S.inbox.find(x => x.id === iid); if (!it || it.done) return { ok: false, msg: 'このオファーは無効です' };
  const p = S.players[it.pid];
  if (!p || p.club !== S.my) { it.done = true; return { ok: false, msg: '選手はすでにクラブにいません' }; }
  if (squad(S, S.my).length <= 18) return { ok: false, msg: '登録選手が少なすぎるため売却できません（最低18人）' };
  moveP(S, p, it.from, it.fee);
  it.done = true; it.result = 'accepted';
  news(S, `${p.name}が${S.clubs[it.from].name}へ完全移籍（移籍金 ${money(it.fee)}）。`, 'transfer');
  return { ok: true };
}
function rejectOffer(S, iid) { const it = S.inbox.find(x => x.id === iid); if (it) { it.done = true; it.result = 'rejected'; } }
function moveP(S, p, toCid, fee) {
  const from = S.clubs[p.club], to = S.clubs[toCid];
  if (from) { from.funds += fee; from.fin.trans += fee; from.tac.xi = from.tac.xi.map(x => x === p.id ? null : x); from.tac.bench = from.tac.bench.filter(x => x !== p.id); }
  if (to) { to.funds -= fee; to.fin.trans -= fee; }
  const oldClub = p.club;
  p.club = toCid; p.listed = false; p.joined = S.date; p.cond = Math.min(p.cond, 90);
  // shirt number
  const used = new Set(squad(S, toCid).filter(x => x.id !== p.id).map(x => x.num));
  if (used.has(p.num)) { let n = 13; while (used.has(n)) n++; p.num = n; }
  if (oldClub && oldClub !== S.my && S.clubs[oldClub]) validateLineup(S, oldClub);
  if (toCid !== S.my && S.clubs[toCid]) autoLineup(S, toCid);
}
function aiTransfer(S) {
  const ai = S.order.filter(c => c !== S.my);
  const buyer = wpick(ai, c => S.clubs[c].tier + (S.clubs[c].pres || 2));
  const bc = S.clubs[buyer];
  const pos = pick(['DF', 'MF', 'FW', 'FW', 'MF']);
  const bs = squad(S, buyer).filter(p => p.pos === pos).map(p => p.ovr).sort((a, b) => b - a);
  const bar = bs[1] || 60;
  const targets = Object.values(S.players).filter(p => p.club !== buyer && p.club !== S.my && S.clubs[p.club] && p.pos === pos && p.ovr > bar && p.ovr < bar + 6 && squad(S, p.club).length > 24);
  if (!targets.length) return;
  const t = pick(targets);
  const fee = Math.round(value(t, S.date) * (0.9 + R() * 0.3) / 100) * 100;
  if (bc.funds < fee * 1.4) return;
  const fromName = S.clubs[t.club].short;
  moveP(S, t, buyer, fee);
  news(S, `【移籍】${t.name}（${fromName}）が${bc.short}へ。移籍金 ${money(fee)}。`, 'transfer');
}
function marketList(S, filter) {
  const f = filter || {};
  return Object.values(S.players).filter(p => p.club !== S.my && (S.clubs[p.club] || p.club === 'FA'))
    .filter(p => !f.pos || p.pos === f.pos)
    .filter(p => !f.q || p.name.replace(/\s/g, '').includes(f.q.replace(/\s/g, '')) || (S.clubs[p.club] && S.clubs[p.club].short.includes(f.q)))
    .sort((a, b) => b.ovr - a.ovr);
}
// Try to buy. mult: offer as multiple of value. Returns {ok, msg}
function bid(S, pid, mult) {
  const p = S.players[pid]; if (!p) return { ok: false, msg: '選手が見つかりません' };
  const my = S.clubs[S.my];
  if (p.club === 'FA') {
    if (squad(S, S.my).length >= 40) return { ok: false, msg: '登録上限（40人）に達しています' };
    const sign = Math.round(wage(p) * 0.5 / 10) * 10;
    if (my.funds < sign) return { ok: false, msg: '契約金を払う資金が足りません' };
    my.funds -= sign; my.fin.trans -= sign;
    moveP(S, p, S.my, 0);
    news(S, `フリーの${p.name}と契約（契約金 ${money(sign)}）。`, 'transfer');
    return { ok: true, msg: `${p.name}と契約しました` };
  }
  if (!inWindow(S.date)) return { ok: false, msg: `移籍期間外です（次は${jdate(nextWindowStart(S.date))}から）` };
  if (squad(S, S.my).length >= 40) return { ok: false, msg: '登録上限（40人）に達しています' };
  const v = value(p, S.date); const fee = Math.round(v * mult / 100) * 100;
  if (my.funds < fee) return { ok: false, msg: `資金が足りません（必要 ${money(fee)}）` };
  const seller = S.clubs[p.club];
  const rank = squad(S, p.club).sort((a, b) => b.ovr - a.ovr).findIndex(x => x.id === p.id);
  const demand = rank < 6 ? 1.35 : rank < 14 ? 1.12 : 0.92;
  if (squad(S, p.club).length <= 22) return { ok: false, msg: `${seller.short}は選手層が薄く、放出を拒否しました` };
  S._bids = S._bids || {};
  const we = windowEnd(S.date);
  const prev = S._bids[pid];
  if (prev && prev.until >= S.date && prev.refused) return { ok: false, msg: `${p.name}は今回の移籍期間中は移籍しない意向です` };
  if (prev && prev.date === S.date) return { ok: false, msg: '同じ日に同じ選手へ再オファーはできません' };
  S._bids[pid] = { date: S.date, until: we };
  if (mult < demand * (0.94 + R() * 0.08)) return { ok: false, msg: `${seller.short}がオファーを拒否（目安：${money(Math.round(v * demand / 100) * 100)}前後）` };
  // player willingness
  const myLvl = strength(S, S.my), theirLvl = strength(S, p.club);
  // players are drawn to bigger, more storied clubs
  const reluct = (theirLvl - myLvl) * 0.06 + (p.ovr - myLvl - 4) * 0.04 + ((S.clubs[p.club].pres || 2) - (my.pres || 2)) * 0.1;
  if (R() < clamp(reluct, 0, 0.75)) { S._bids[pid].refused = true; return { ok: false, msg: `クラブ間で合意したが、${p.name}本人が移籍を断った（今期間中は交渉不可）` }; }
  const fromName = seller.short;
  moveP(S, p, S.my, fee);
  news(S, `${p.name}（${fromName}）を獲得！ 移籍金 ${money(fee)}。`, 'transfer');
  return { ok: true, msg: `${p.name}を獲得しました` };
}
function genPlayer(S, cid, opts) {
  const o = opts || {};
  const foreign = o.foreign != null ? o.foreign : R() < 0.1;
  const name = foreign ? pick(FOR_F) + ' ' + pick(FOR_L) : pick(FAM) + ' ' + pick(GIV);
  const a = o.age || ri(19, 31);
  const by = D.y(S.date) - a - (D.m(S.date) < 6 ? 1 : 0);
  const birth = by + '-' + String(ri(1, 12)).padStart(2, '0') + '-' + String(ri(1, 28)).padStart(2, '0');
  const pos = o.pos || wpick(['GK', 'DF', 'MF', 'FW'], x => ({ GK: 1.2, DF: 3, MF: 3.4, FW: 2 })[x]);
  const ov = o.ovr != null ? o.ovr : 60;
  const pot = Math.max(ov, o.pot != null ? o.pot : ov + (a <= 19 ? ri(6, 16) : a <= 22 ? ri(3, 9) : ri(0, 3)));
  const used = new Set(squad(S, cid).map(x => x.num));
  let num = o.num || ri(2, 49); while (used.has(num)) num++;
  const parts = name.split(' ');
  const p = { id: S.nextPid++, club: cid, pos, num, name, short: foreign ? parts[1] : parts[0], birth, nat: foreign ? 'BRA' : 'JPN', ovr: ov, pot, cond: 100, form: 6.5, inj: 0, sus: 0, ycAcc: 0, listed: false, st: blankStats(), hist: [], joined: S.date, gen: true };
  initAttrs(p);
  S.players[p.id] = p;
  return p;
}
function ensureFreeAgents(S) {
  const fa = Object.values(S.players).filter(p => p.club === 'FA');
  for (let i = fa.length; i < 14; i++) {
    const a = ri(23, 34);
    genPlayer(S, 'FA', { age: a, ovr: ri(56, 66) - (a > 31 ? 0 : 1), pot: undefined });
  }
}

/* ---------- facilities ---------- */
function facCost(lvl) { return Math.round(4000 * Math.pow(lvl, 1.6) / 100) * 100; }
function upgrade(S, key) {
  const c = S.clubs[S.my]; const lv = c.fac[key];
  if (lv >= 5) return { ok: false, msg: 'すでに最大レベルです' };
  const cost = facCost(lv);
  if (c.funds < cost) return { ok: false, msg: `資金が足りません（${money(cost)}）` };
  c.funds -= cost; c.fin.fac += cost; c.fac[key] = lv + 1;
  news(S, `${FACILITY[key].jp}をLv${lv + 1}に強化（${money(cost)}）。`, 'money');
  return { ok: true, msg: `${FACILITY[key].jp}がLv${lv + 1}になりました` };
}

/* ---------- firing & offers ---------- */
function fire(S, reason) {
  if (S.fired) return;
  const cands = S.order.filter(c => c !== S.my).sort((a, b) => strength(S, a) - strength(S, b)).slice(0, 10);
  const offers = [];
  while (offers.length < 3 && cands.length) { const c = cands.splice(Math.floor(R() * cands.length), 1)[0]; offers.push(c); }
  S.fired = { reason, from: S.my, offers };
  news(S, `${S.clubs[S.my].name}の監督を解任された（${reason}）。`, 'big');
}
function takeJob(S, cid) {
  const from = S.my;
  S.my = cid; S.fired = null; S.board = 55;
  S.inbox = S.inbox.filter(x => x.done);
  for (const p of Object.values(S.players)) if (p.club === from) p.listed = false;
  autoLineup(S, cid);
  if (S.clubs[from]) autoLineup(S, from);
  setExpectations(S);
  news(S, `${S.clubs[cid].name}の新監督に就任。目標は「${S.clubs[cid].target.jp}」。`, 'big');
}

/* ---------- season end & rollover ---------- */
const PRIZE = [30000, 12000, 6000, 3000, 2000, 1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0, 0, 0]; // 万円
function endSeason(S) {
  const t = table(S);
  const myPos = t.findIndex(r => r.id === S.my) + 1;
  const champ = t[0].id;
  const rel = t.slice(-3).map(r => r.id);
  t.forEach((r, i) => { const c = S.clubs[r.id]; const pz = PRIZE[i] || 0; c.funds += pz; c.fin.prize += pz; });
  // クラブの格: titles raise it, relegation lowers it
  const presBefore = S.clubs[S.my].pres || 2;
  t.forEach((r, i) => {
    const c = S.clubs[r.id]; const n = t.length;
    const dp = i === 0 ? 0.3 : i <= 2 ? 0.12 : i <= 6 ? 0.04 : i >= n - 3 ? -0.35 : 0;
    c.pres = clamp(Math.round(((c.pres || 2) + dp) * 100) / 100, 1, 5);
    if (i === 0) { c.titles = c.titles || { j1: 0, lc: 0, ec: 0, acl: 0 }; c.titles.j1++; c.spon = Math.round((c.spon || 5000) * 1.08 / 10) * 10; }
    else if (i <= 2) c.spon = Math.round((c.spon || 5000) * 1.03 / 10) * 10;
  });
  const presAfter = S.clubs[S.my].pres;
  if (presStars(presAfter) > presStars(presBefore)) news(S, `クラブの格が上がった（${'★'.repeat(presStars(presAfter))}）。選手が集まりやすくなる。`, 'big');
  else if (presStars(presAfter) < presStars(presBefore)) news(S, `クラブの格が下がった（${'★'.repeat(presStars(presAfter))}）。`, 'warn');
  const scorers = Object.values(S.players).filter(p => p.st.g > 0).sort((a, b) => b.st.g - a.st.g).slice(0, 5).map(p => ({ id: p.id, name: p.name, club: p.club, g: p.st.g }));
  const target = S.clubs[S.my].target;
  let verdict;
  if (rel.includes(S.my)) verdict = 'relegated';
  else if (myPos <= target.pos) verdict = myPos === 1 ? 'champion' : 'met';
  else if (myPos <= target.pos + 3) verdict = 'near';
  else verdict = 'missed';
  if (verdict === 'champion' || verdict === 'met') S.board = clamp(S.board + 20, 0, 100);
  else if (verdict === 'near') S.board = clamp(S.board - 5, 0, 100);
  else if (verdict === 'missed') S.board = clamp(S.board - 25, 0, 100);
  S.seasonEnd = { label: seasonLabel(S.season), champ, myPos, rel, scorers, verdict, prize: PRIZE[myPos - 1] || 0, pts: t[myPos - 1].pts, target: target.jp };
  S.history.unshift({ season: seasonLabel(S.season), club: S.my, pos: myPos, pts: t[myPos - 1].pts, champ, verdict });
  news(S, `${seasonLabel(S.season)}シーズン終了。優勝は${S.clubs[champ].name}。${S.clubs[S.my].short}は${myPos}位。`, 'big');
}
function rollover(S) {
  const se = S.seasonEnd; if (!se) return;
  const myRelegated = se.rel.includes(S.my);
  const fireMe = myRelegated || S.board < 15;
  // retirements
  const newDate = (S.season + 1) + '-06-08';
  for (const p of Object.values(S.players)) {
    if (!S.clubs[p.club] && p.club !== 'FA') continue;
    const a = age(p, newDate);
    if (a >= 35) {
      const pr = 0.3 + (a - 35) * 0.17 + (p.ovr < 64 ? 0.2 : 0);
      if (R() < pr) { if (p.club === S.my) news(S, `${p.name}が現役引退を発表。`, 'info'); p.club = 'RET'; }
    }
  }
  // season stats archive
  for (const p of Object.values(S.players)) {
    if (p.st.apps || p.club === S.my) p.hist.unshift({ s: seasonLabel(S.season), c: p.club, ovr: Math.round(p.ovr), ...p.st });
    if (p.at) { p.at0 = p.at.slice(); p.ovr0 = p.ovr; }
    if (p.hist.length > 8) p.hist.length = 8;
    p.st = blankStats(); p.ycAcc = 0; p.sus = 0;
  }
  // relegation / promotion
  const promoted = [];
  const pool = J2.filter(c => !S.clubs[c.id] || !S.order.includes(c.id));
  for (const rid of se.rel) {
    S.order = S.order.filter(c => c !== rid);
    for (const p of Object.values(S.players)) if (p.club === rid) p.club = 'J2:' + rid;
  }
  // relegated clubs' rosters are parked under "J2:<id>" (kept so they can return later)
  while (promoted.length < se.rel.length && pool.length) {
    const c = pool.splice(Math.floor(R() * pool.length), 1)[0];
    promoted.push(c.id);
    if (S.clubs[c.id] && Object.values(S.players).some(p => p.club === 'J2:' + c.id)) {
      S.order.push(c.id);
      for (const p of Object.values(S.players)) if (p.club === 'J2:' + c.id) p.club = c.id;
    } else {
      addClub(S, { ...c, coach: '' });
      const base = 64 + c.tier;
      const plan = [['GK', 3], ['DF', 9], ['MF', 10], ['FW', 6]];
      let n = 1;
      for (const [pos, k] of plan) for (let i = 0; i < k; i++) {
        const a = ri(19, 33);
        genPlayer(S, c.id, { pos, age: a, ovr: Math.round(base + (i < 2 ? 3 : i < 5 ? 1 : -2) + R() * 4 - 2 - (a < 21 ? 5 : 0)), num: n++, foreign: i === 0 && pos !== 'GK' && R() < 0.6 });
      }
    }
  }
  // youth intake
  for (const cid of S.order) {
    const c = S.clubs[cid];
    const k = cid === S.my ? 2 + Math.floor(c.fac.youth / 2) : 2;
    const base = Math.round(strength(S, cid));
    for (let i = 0; i < k; i++) {
      const pr = genPlayer(S, cid, { age: 18, foreign: false, ovr: base - 15 + (cid === S.my ? c.fac.youth : 2) + ri(-2, 2), pot: base - 4 + ri(0, 8) + (cid === S.my ? c.fac.youth * 2 : 3) });
      if (cid === S.my) news(S, `ユースから${pr.name}（${pr.pos}）がトップ昇格。`, 'grow');
    }
  }
  // trim oversized AI squads (release weakest veterans to free agency)
  for (const cid of S.order) {
    if (cid === S.my) continue;
    const sq = squad(S, cid).sort((a, b) => a.ovr - b.ovr);
    while (sq.length > 36) { const p = sq.shift(); p.club = 'FA'; }
  }
  // remove retired players entirely to keep the save small
  for (const [id, p] of Object.entries(S.players)) if (p.club === 'RET') delete S.players[id];
  // new season
  S.season += 1;
  S.date = newDate;
  for (const cid of S.order) { const c = S.clubs[cid]; c.fin = { gate: 0, spon: 0, wages: 0, trans: 0, prize: 0, fac: 0 }; }
  for (const p of Object.values(S.players)) p.cond = 100;
  S.fixtures = genFixtures(S.order, null, S.season);
  S.inbox = S.inbox.filter(x => !x.done).slice(0, 20);
  S.seasonEnd = null;
  ensureFreeAgents(S);
  for (const cid of S.order) autoLineup(S, cid);
  setSponsors(S);
  setExpectations(S);
  if (promoted.length) news(S, `J2から${promoted.map(c => S.clubs[c].short).join('・')}が昇格。`, 'info');
  news(S, `${seasonLabel(S.season)}シーズンへ。開幕は${jdate(S.fixtures[0].date)}。`, 'big');
  if (fireMe) fire(S, myRelegated ? 'J2降格の責任' : '目標未達');
  else news(S, `新シーズンの目標は「${S.clubs[S.my].target.jp}」。`, 'board');
}

/* ---------- export ---------- */
const API = {
  D, jdate, FORMATIONS, ROLE, MENTALITY, PRESS, TRAINING, FACILITY, ATTR, ATTR_SHOW, FOCUS, INTENS,
  calcOvr, roleScore, bestRoles, devPreview, migrate, weekly, power, presStars, presLabel,
  newGame, seasonForDate, seasonLabel, squad, strength, table, position, age, ovr, value, wage, money, attrs,
  autoLineup, autoBench, clubRating, validateLineup, effective, posPenalty, available, teamRating,
  createMatch, stepMatch, simulateFull, finishMatch, doSub, benchOptions, onPitch, setMentality, bestSubFor,
  advance, nextDay, simAIToday, myFixtureToday, nextMyFixture, todaysFixtures, inWindow, windowEnd, nextWindowStart,
  acceptOffer, rejectOffer, bid, marketList, ensureFreeAgents, upgrade, facCost, takeJob, rollover, endSeason, news, fire,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
