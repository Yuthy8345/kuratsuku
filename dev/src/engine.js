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
  '4-4-2':   [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['LM',13,54],['CM',37,49],['CM',63,49],['RM',87,54],['ST',37,80],['SS',63,80]],
  '4-3-3':   [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['DM',50,41],['CM',28,55],['CM',72,55],['LW',15,76],['ST',50,82],['RW',85,76]],
  '4-2-3-1': [['GK',50,7],['LB',13,27],['CB',37,22],['CB',63,22],['RB',87,27],['DM',35,42],['DM',65,42],['LAM',15,66],['AM',50,63],['RAM',85,66],['ST',50,84]],
  '3-4-2-1': [['GK',50,7],['CB',25,24],['CB',50,20],['CB',75,24],['WB',10,50],['CM',37,46],['CM',63,46],['WB',90,50],['AM',32,68],['AM',68,68],['ST',50,84]],
  '3-5-2':   [['GK',50,7],['CB',25,24],['CB',50,20],['CB',75,24],['WB',10,52],['CM',30,52],['DM',50,41],['CM',70,52],['WB',90,52],['ST',37,80],['SS',63,80]],
};
// slot roles. a/m/d: weight in attack / midfield / defence. dp: the detailed position the slot asks for, dp2: a near one that also works
const ROLE = {
  GK:  { cat: 'GK', a: 0,    m: 0,    d: 0,    jp: 'GK',  dp: 'GK' },
  CB:  { cat: 'DF', a: 0.05, m: 0.1,  d: 1.0,  jp: 'CB',  dp: 'CB' },
  LB:  { cat: 'DF', a: 0.2,  m: 0.25, d: 0.8,  jp: 'LSB', dp: 'SB' },
  RB:  { cat: 'DF', a: 0.2,  m: 0.25, d: 0.8,  jp: 'RSB', dp: 'SB' },
  WB:  { cat: 'MF', a: 0.35, m: 0.35, d: 0.55, jp: 'WB',  dp: 'SB',  dp2: 'SH' },
  DM:  { cat: 'MF', a: 0.15, m: 0.8,  d: 0.5,  jp: 'DMF', dp: 'DMF', dp2: 'CMF' },
  CM:  { cat: 'MF', a: 0.35, m: 1.0,  d: 0.3,  jp: 'CMF', dp: 'CMF', dp2: 'DMF' },
  LM:  { cat: 'MF', a: 0.55, m: 0.7,  d: 0.25, jp: 'LSH', dp: 'SH',  dp2: 'WG' },
  RM:  { cat: 'MF', a: 0.55, m: 0.7,  d: 0.25, jp: 'RSH', dp: 'SH',  dp2: 'WG' },
  AM:  { cat: 'MF', a: 0.8,  m: 0.7,  d: 0.1,  jp: 'OMF', dp: 'OMF', dp2: 'ST' },
  LAM: { cat: 'MF', a: 0.75, m: 0.5,  d: 0.15, jp: 'LSH', dp: 'SH',  dp2: 'WG' },
  RAM: { cat: 'MF', a: 0.75, m: 0.5,  d: 0.15, jp: 'RSH', dp: 'SH',  dp2: 'WG' },
  WAM: { cat: 'MF', a: 0.75, m: 0.5,  d: 0.15, jp: 'SH',  dp: 'SH',  dp2: 'WG' }, // old 4-2-3-1 wide slot (kept for old saves)
  LW:  { cat: 'FW', a: 0.9,  m: 0.35, d: 0.1,  jp: 'LWG', dp: 'WG',  dp2: 'SH' },
  RW:  { cat: 'FW', a: 0.9,  m: 0.35, d: 0.1,  jp: 'RWG', dp: 'WG',  dp2: 'SH' },
  ST:  { cat: 'FW', a: 1.0,  m: 0.2,  d: 0.05, jp: 'CF',  dp: 'CF',  dp2: 'ST' },
  SS:  { cat: 'FW', a: 0.9,  m: 0.35, d: 0.05, jp: 'ST',  dp: 'ST',  dp2: 'CF' },
};
// detailed positions. A player has one 本職 (p.pp, aptitude 100); the others start from DP_SIM and grow by training (p.ap)
const DPOS = ['GK', 'CB', 'SB', 'DMF', 'CMF', 'OMF', 'SH', 'CF', 'ST', 'WG'];
const DP_CAT = { GK: 'GK', CB: 'DF', SB: 'DF', DMF: 'MF', CMF: 'MF', OMF: 'MF', SH: 'MF', CF: 'FW', ST: 'FW', WG: 'FW' };
const DP_JP = { GK: 'ゴールキーパー', CB: 'センターバック', SB: 'サイドバック', DMF: '守備的MF', CMF: 'セントラルMF', OMF: '攻撃的MF', SH: 'サイドハーフ', CF: 'センターフォワード', ST: 'セカンドトップ', WG: 'ウイング' };
const DP_SIM = {
  CB:  { SB: 55, DMF: 60, CMF: 35, OMF: 15, SH: 25, CF: 20, ST: 10, WG: 10 },
  SB:  { CB: 50, DMF: 45, CMF: 40, OMF: 30, SH: 70, CF: 15, ST: 20, WG: 50 },
  DMF: { CB: 60, SB: 45, CMF: 80, OMF: 50, SH: 35, CF: 15, ST: 25, WG: 20 },
  CMF: { CB: 35, SB: 40, DMF: 75, OMF: 75, SH: 55, CF: 25, ST: 45, WG: 35 },
  OMF: { CB: 15, SB: 25, DMF: 45, CMF: 70, SH: 65, CF: 45, ST: 80, WG: 60 },
  SH:  { CB: 15, SB: 60, DMF: 30, CMF: 50, OMF: 65, CF: 30, ST: 55, WG: 80 },
  CF:  { CB: 20, SB: 15, DMF: 15, CMF: 25, OMF: 45, SH: 35, ST: 75, WG: 50 },
  ST:  { CB: 10, SB: 20, DMF: 25, CMF: 45, OMF: 80, SH: 55, CF: 75, WG: 65 },
  WG:  { CB: 10, SB: 45, DMF: 20, CMF: 35, OMF: 60, SH: 80, CF: 50, ST: 65 },
};
const DP_ROLE = { GK: 'GK', CB: 'CB', SB: 'LB', DMF: 'DM', CMF: 'CM', OMF: 'AM', SH: 'LM', CF: 'ST', ST: 'SS', WG: 'LW' }; // a typical slot per position
const DP_GEN = { GK: { GK: 1 }, DF: { CB: 5, SB: 4 }, MF: { DMF: 3, CMF: 3, OMF: 2, SH: 3 }, FW: { CF: 3, ST: 1.5, WG: 2 } };
const DP2_GAP = 15;      // a near position (dp2) counts as this much less aptitude
const LEARN_MAX = 95;    // training stops here (本職 = 100)
const PLAY_MAX = 85;     // match experience alone takes a position this far
// own: my chance rate, opp: the opponent's chance rate when I play this way,
// sq: how much of a stronger opponent's attacking edge a deep block takes away, q: finishing of my chances
// posture (守備的 / バランス / 攻撃的) and, separately, whether the side plays on the counter (tac.ctr)
const MENTALITY = {
  def: { own: 0.88, opp: 0.86, sq: 0.5, jp: '守備的', sub: '引いて守る。格上ほど効く' },
  bal: { own: 1, opp: 1, jp: 'バランス', sub: '' },
  att: { own: 1.14, opp: 1.1, jp: '攻撃的', sub: '押し込む。打ち合いになりやすい' },
};
const PRESS = { low: { mid: -1.5, drain: -3, jp: '低' }, mid: { mid: 0, drain: 0, jp: '中' }, high: { mid: 1.8, drain: 5, jp: '高' } };
const TRAINING = {
  bal: { jp: 'バランス', grow: 1.0, rec: 0 },
  hard: { jp: 'ハード', grow: 1.35, rec: -2 },
  tact: { jp: '戦術理解', grow: 0.8, rec: 0, team: 1 },
  rest: { jp: 'コンディション重視', grow: 0.6, rec: 3 },
  youth: { jp: '若手育成', grow: 1.0, rec: 0, young: 1.4, rest: 0.85 },  // 23歳以下 x1.4, the others x0.85
};
// growth tuning: young players (23 or under) grow with playing time far more than before, and their ceiling itself
// rises when they play (開花): about +2 potential a season for a 21-or-under regular (scaled by how well they play; only with
// 25%+ of the minutes), +6 in a career. Other clubs' youngsters bloom at 40% of that (they don't plan minutes around them),
// which keeps the league from filling up with stars over the seasons.
// 2026-10-13 balance: the ceiling (最大 = p.pot) of everyone but the 転生 players stops at potMax (90) unless the player
// carries his own p.cap (a rare talent: 91〜95, or 三井寺 93). Real players (data, !p.gen) aged 20〜29 close the gap to
// their ceiling faster (realK, by age) so they keep up with the academy.
const GROW = { youngBase: 0.9, youngPlay: 1.3, oldBase: 0.8, oldPlay: 0.45, gMax: 0.08, bloom21: 0.045, bloom23: 0.02, bloomMin: 0.25, bloomMax: 3, bloomAI: 0.4, potMax: 90,
  realK: [[19, 0.06], [22, 0.07], [29, 0.08]] };
// a rare talent: his ceiling may pass 90 (p.cap 91〜95). Chance per academy graduate / per ユースの逸材.
const RARE = { youth: 0.012, gem: 0.12, cap: [91, 95] };
// the most he can ever reach (the 転生 players: the legend's own ceiling, 100+)
function potCap(p) { return p.cap || GROW.potMax; }
function attrMax(p) { return potCap(p) > 95 ? potCap(p) + 15 : 97; }
function ovrMax(p) { return potCap(p) > 95 ? potCap(p) + 5 : 95; }
const FACILITY = {
  train: { jp: '練習場', desc: '選手の成長スピードが上がる' },
  youth: { jp: 'ユース', desc: '昇格してくる若手の質と人数が上がる' },
  stadium: { jp: 'スタジアム設備', desc: '観客動員と入場料収入が増える' },
  medical: { jp: 'メディカル', desc: '疲労回復が早まり、ケガが減る' },
  scout: { jp: 'スカウト網', desc: 'スカウトが見つける若手の伸びしろが大きくなる' },
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
  WAM: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0], LAM: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0], RAM: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0],
  LW: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0], RW: [0.2, 0.15, 0.3, 0, 0.25, 0, 0, 0.1, 0],
  ST: [0.4, 0, 0.1, 0, 0.15, 0.15, 0, 0.2, 0],
  SS: [0.3, 0.15, 0.2, 0, 0.1, 0.05, 0, 0.2, 0],
};
const ATTR_BIAS = {
  FW: [7, -3, 3, -18, 3, 1, -2, 0, -45],
  MF: [-3, 5, 2, -4, -1, -3, 3, 3, -45],
  DF: [-15, -2, -8, 7, -1, 4, 0, 3, -45],
  GK: [-35, -10, -25, -30, -12, -2, -10, 2, 4],
};
// detailed position flavour on top of the category (new games only; existing attributes are kept)
const DP_BIAS = {
  CB:  [0, -2, -4, 3, -3, 5, 0, 1, 0],
  SB:  [0, 1, 2, -2, 4, -4, 3, -1, 0],
  DMF: [-3, 1, -3, 4, -2, 2, 1, 2, 0],
  CMF: [0, 2, 0, 0, -1, -1, 2, 1, 0],
  OMF: [2, 2, 3, -5, 0, -3, -2, 2, 0],
  SH:  [0, 0, 3, -3, 4, -3, 2, -1, 0],
  CF:  [3, -3, -2, 0, -1, 5, -1, 1, 0],
  ST:  [1, 2, 3, 0, 1, -3, 0, 1, 0],
  WG:  [-1, 0, 5, -2, 5, -4, 1, -2, 0],
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
// playing styles from the data (p.sty): how the same overall rating is split. Order as ATTR.
const STYLE = {
  tech: [2, 8, 7, -4, 0, -9, -6, 7, 0],     // 技術・視野で勝負、球際とフィジカルはこれから
  phys: [-2, -4, -3, 4, 2, 7, 5, -3, 0],    // 体の強さと走力
  speed: [2, -3, 3, -3, 9, -2, 2, -4, 0],   // スピード
};
function applyStyle(p) {  // tilt the attributes by the style, keeping the overall rating
  const sv = STYLE[p.sty]; if (!sv || !p.at) return;
  const v = p.at.map((x, i) => x + sv[i]);
  const w = AW[p.pos]; let ws = 0; for (let i = 0; i < 9; i++) ws += w[i] * v[i];
  const shift = calcOvr(p) - ws;
  p.at = v.map(x => Math.round(clamp(x + shift, 20, 96) * 10) / 10);
}
function initAttrs(p) {
  let h = hash(p.name + p.birth + p.pos);
  const db = DP_BIAS[p.pp] || null;
  const sv = STYLE[p.sty] || null;
  const bias = ATTR_BIAS[p.pos].map((b, i) => b + (db && DP_CAT[p.pp] === p.pos ? db[i] : 0) + (sv ? sv[i] : 0));
  const v = bias.map(b => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return p.ovr + b + ((h % 13) - 6); });
  // a signature strength and a weakness, so players of the same level differ
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; const up = h % 8; h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0; const dn = h % 8;
  if (p.pos !== 'GK') { v[up] += 5; if (dn !== up) v[dn] -= 4; }
  const w = AW[p.pos]; let ws = 0; for (let i = 0; i < 9; i++) ws += w[i] * v[i];
  const shift = p.ovr - ws;
  p.at = v.map(x => Math.round(clamp(x + shift, 20, 96) * 10) / 10);
  p.ovr = calcOvr(p);
  p.at0 = p.at.slice(); p.ovr0 = p.ovr; p.pot0 = p.pot;
  if (!p.tf) p.tf = 'auto';
  if (!p.ti) p.ti = 'norm';
}
function attrs(p) { if (!p.at) initAttrs(p); return p.at.map(x => Math.round(x)); }
/* ---------- detailed positions ---------- */
function ppOf(p) {
  if (p.pp && DP_CAT[p.pp]) return p.pp;
  if (p.pos === 'GK') return (p.pp = 'GK');
  if (!p.at) initAttrs(p);
  let best = null, bv = -1e9; // best fit inside the registered category
  for (const dp of DPOS) if (DP_CAT[dp] === p.pos) { const v = roleScore(p, DP_ROLE[dp]); if (v > bv) { bv = v; best = dp; } }
  return (p.pp = best);
}
// aptitude 0..100 for a detailed position (本職 = 100)
function apt(p, dp) {
  const pp = ppOf(p);
  if (dp === pp) return 100;
  if (dp === 'GK' || pp === 'GK') return 0;
  return Math.max(DP_SIM[pp][dp] || 0, (p.ap && p.ap[dp]) || 0);
}
function roleApt(p, role) {
  const R0 = ROLE[role]; let a = apt(p, R0.dp);
  if (R0.dp2) a = Math.max(a, apt(p, R0.dp2) - DP2_GAP);
  return a;
}
function aptPen(a) { return a >= 100 ? 0 : -14 * Math.pow((100 - a) / 100, 1.2); }
function genPP(pos) { const w = DP_GEN[pos] || DP_GEN.MF; return wpick(Object.keys(w), k => w[k]); }
// weekly aptitude gain while retraining
function learnRate(S, p) {
  const a = age(p, S.date); const it = INTENS[p.club === S.my ? (p.ti || 'norm') : 'norm'];
  return (5 + p.at[7] / 30) * (a <= 24 ? 1.3 : a <= 29 ? 1 : 0.7) * it.g * 0.55;
}
function learnWeeks(S, p, dp) { const cur = apt(p, dp); return cur >= LEARN_MAX ? 0 : Math.ceil((LEARN_MAX - cur) / learnRate(S, p)); }
function migrate(S, DATA) {
  for (const p of Object.values(S.players)) if (!p.at) initAttrs(p);
  // data corrections (e.g. verified birthdates) flow into existing saves
  if (DATA && DATA.players) for (const d of DATA.players) { const q = S.players[d.id]; if (q && q.name === d.name && q.birth !== d.birth) q.birth = d.birth; }
  // rating corrections by data revision (d.fix = {r, d, dr}: r = the latest revision that touched him, d = added to the
  // rating in revision dr (r when missing); the potential is raised to the data's). Growth since then is kept.
  if (DATA && DATA.players && (S.dataRev || 1) < (DATA.rev || 1)) {
    const from = S.dataRev || 1; let n = 0;
    for (const d of DATA.players) {
      const q = S.players[d.id]; if (!q || q.name !== d.name || !d.fix || d.fix.r <= from) continue;
      if (!q.at) initAttrs(q);
      if (d.cap) q.cap = d.cap;
      const k = (d.fix.dr || d.fix.r) > from ? d.fix.d || 0 : 0;
      if (k) {
        q.at = q.at.map(x => Math.round(clamp(x + k, 15, 97) * 100) / 100); q.ovr = clamp(calcOvr(q), 30, 95);
        if (q.at0) q.at0 = q.at0.map(x => Math.round(clamp(x + k, 15, 97) * 100) / 100);
        if (q.ovr0 != null) q.ovr0 += k;
      }
      const pb = q.pot; q.pot = Math.max(q.pot, d.pot, Math.ceil(q.ovr));
      if (q.pot0 != null) q.pot0 += q.pot - pb;  // a data correction is not 開花
      if (d.sty && q.sty !== d.sty) { q.sty = d.sty; applyStyle(q); }
      n++;
    }
    S.dataRev = DATA.rev;
    if (n) for (const cid of S.order) if (cid !== S.my && S.clubs[cid]) autoLineup(S, cid);
  }
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
  // v3: detailed positions. 本職 from the data; old category retraining (pos2 / learn) becomes aptitude
  if ((S.v || 1) < 3) {
    // other clubs switch to the shape they really play (the manager's own club keeps its tactics)
    for (const cid of S.order) { const c = S.clubs[cid]; if (cid !== S.my && src[cid] && FORMATIONS[src[cid].form] && c.tac.form === '4-4-2') c.tac.form = src[cid].form; }
    const dm = {}; if (DATA && DATA.players) for (const d of DATA.players) dm[d.id] = d;
    for (const p of Object.values(S.players)) {
      const d = dm[p.id];
      if (!p.pp && d && d.name === p.name && d.pp) { p.pp = d.pp; if (d.ap) p.ap = Object.assign({}, d.ap); }
      if (!p.pp && p.gen && p.pos !== 'GK') p.pp = genPP(p.pos);
      ppOf(p);
      if (p.pos2 && p.pos2.length) {
        p.ap = p.ap || {};
        for (const cat of p.pos2) for (const dp of DPOS) if (DP_CAT[dp] === cat && dp !== p.pp) p.ap[dp] = Math.max(p.ap[dp] || 0, 92);
      }
      delete p.pos2;
      if (p.learn && !DP_CAT[p.learn.pos]) {
        const cat = p.learn.pos; let best = null, bv = -1;
        for (const dp of DPOS) if (DP_CAT[dp] === cat && apt(p, dp) > bv) { bv = apt(p, dp); best = dp; }
        if (best && best !== p.pp) {
          p.ap = p.ap || {};
          p.ap[best] = Math.round((bv + (LEARN_MAX - bv) * clamp((p.learn.prog || 0) / 100, 0, 1)) * 10) / 10;
          p.learn = { pos: best };
        } else p.learn = null;
      }
    }
    for (const cid of S.order) if (cid !== S.my && S.clubs[cid]) autoLineup(S, cid);
  }
  // v4: cups (天皇杯・Lカップ), J2 clubs keep their own ids, scouting facility
  if ((S.v || 1) < 4) {
    for (const p of Object.values(S.players)) if (typeof p.club === 'string' && p.club.startsWith('J2:')) p.club = p.club.slice(3);
    for (const c of Object.values(S.clubs)) if (c.fac && c.fac.scout == null) c.fac.scout = 1;
    if (!S.cups && !S.seasonEnd) { setupCups(S); news(S, '今季から天皇杯とLカップが開催される。組み合わせはリーグ画面の「カップ戦」から。', 'big'); }
    for (const f of todaysFixtures(S)) hypeMatch(S, f);
  }
  // v5: カウンター is a separate switch (old 'ctr' posture = 守備的 + カウンター)
  if ((S.v || 1) < 5) for (const c of Object.values(S.clubs)) {
    if (c.tac && c.tac.ment === 'ctr') { c.tac.ment = 'def'; c.tac.ctr = true; }
    for (const pr of c.presets || []) if (pr.ment === 'ctr') { pr.ment = 'def'; pr.ctr = true; }
  }
  // v6: shortlist of players I bid on (seeded from the bids already made)
  if ((S.v || 1) < 6 && !S.shortlist) {
    S.shortlist = [];
    for (const [pid, b] of Object.entries(S._bids || {})) {
      const p = S.players[pid]; if (!p || p.club === S.my) continue;
      S.shortlist.push({ pid: p.id, since: b.date, last: b.date, n: 1, club: p.club, res: b.refused ? 'player' : 'club' });
    }
  }
  // v7: growth chart (one point a month) starts now for my squad and my loanees
  if ((S.v || 1) < 7) for (const p of Object.values(S.players)) {
    if (p.pot0 == null) p.pot0 = p.pot;  // 開花 is measured from here
    if (p.at && (p.club === S.my || (p.loan && p.loan.from === S.my))) track(S, p);
  }
  // v8 (2026-10-13 balance): every club remembers its academy level (c.base); a 転生 player gets the legend's 100+ ceiling;
  // everyone else's ceiling stops at 90 (p.cap: 三井寺 93). Nobody loses what he can already do — the ceiling only
  // stops at his current rating when that is higher.
  if ((S.v || 1) < 8) {
    for (const c of Object.values(S.clubs)) if (c.base == null) c.base = (src[c.id] && src[c.id].base) || (63 + (c.tier || 2));
    for (const p of Object.values(S.players)) {
      const L = p.reborn && legendOf(p.reborn);
      if (L) { p.cap = L.pot; const pb = p.pot; p.pot = Math.max(p.pot, L.pot); if (p.pot0 != null) p.pot0 += p.pot - pb; continue; }
      if (p.pot > potCap(p)) { p.pot = Math.max(potCap(p), Math.ceil(p.ovr)); if (p.pot0 != null && p.pot0 > p.pot) p.pot0 = p.pot; }
    }
  }
  S.v = Math.max(S.v || 1, 8);
  return S;
}
// how good the player is in each detailed position (rested, form left out)
function posValues(p) {
  return DPOS.filter(dp => (dp === 'GK') === (p.pos === 'GK')).map(dp => {
    const role = DP_ROLE[dp], a = apt(p, dp);
    const fit = p.at ? clamp((roleScore(p, role) - p.ovr) * 0.4, -2.5, 2.5) : 0;
    return { dp, jp: dp, role, apt: a, v: p.ovr + aptPen(a) + fit };
  });
}
function bestRoles(p, n) { return posValues(p).sort((a, b) => b.v - a.v).slice(0, n || 3); }
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
    const rb = p.reborn ? REBORN.grow : null;
    const k = rb ? (rb.k.find(x => a <= x[0]) || [0, rb.kOld])[1]
      : !p.gen ? (GROW.realK.find(x => a <= x[0]) || [0, 0.015])[1]
      : a <= 19 ? 0.055 : a <= 22 ? 0.045 : a <= 25 ? 0.03 : 0.015;
    // playing time: regulars grow faster, young regulars much faster (a 転生 player grows well even from the bench)
    const sh = shareFor(S, p);
    const playing = sh == null ? 1 : rb ? rb.base + sh * rb.play : a <= 23 ? GROW.youngBase + sh * GROW.youngPlay : GROW.oldBase + sh * GROW.oldPlay;
    const tr = isMy ? TRAINING[S.training] || TRAINING.bal : TRAINING.bal;
    const trg = tr.young ? (a <= 23 ? tr.young : tr.rest) : tr.grow;
    const fac = p.loan ? 2 : c.fac.train;  // on loan: an average J2 training ground
    // a big gap (a 16-year-old prodigy) closes over a few seasons rather than in one: the base rate is capped,
    // and playing time, the team menu and the intensity still multiply on top
    g = Math.min(gap * k / 4.33 * (1 + (fac - 2) * 0.12), rb ? rb.gMax : GROW.gMax) * playing * trg * it.g;
    if (p.learn) g *= 0.75;
  }
  // 開花: playing young players raise their own ceiling (how much depends on minutes and how well they play)
  if (!dry && a <= 23) {
    const sh = shareFor(S, p);
    if (sh != null && sh >= GROW.bloomMin) {
      const apps = p.st.apps || 0, avg = apps ? p.st.rt / apps : 6.5;
      const perf = apps >= 3 ? clamp(1 + (avg - 6.5) * 0.6, 0.5, 1.6) : 1;
      const add = sh * (a <= 21 ? GROW.bloom21 : GROW.bloom23) * perf * (isMy || p.loan ? 1 : GROW.bloomAI);
      const room = Math.min(potCap(p) - p.pot, GROW.bloomMax - (p.bloom || 0));
      if (room > 0) { const x = Math.min(add, room); p.pot += x; p.bloom = (p.bloom || 0) + x; }
    }
  }
  const w = AW[p.pos]; const f = FOCUS[tf] && FOCUS[tf].v;
  const d = w.map((wi, i) => f ? 0.4 * wi + 0.6 * (f[i] || 0) : wi);
  const T = g / AW_SQ[p.pos];
  const aMax = attrMax(p);
  for (let i = 0; i < 9; i++) {
    if (!d[i]) continue;
    const cap = p.pot + 10;
    const mult = clamp((cap - at[i]) / 12, 0.05, 1);
    at[i] = Math.min(aMax, at[i] + T * d[i] * mult);
  }
  // ageing: legs go first, the head keeps improving for a while
  if (a >= 30) {
    const r1 = dry ? 1 : 0.5 + R(), r2 = dry ? 1 : 0.5 + R();
    for (const i of [4, 5, 6]) at[i] -= (a - 29) * 0.025 * r1;
    for (const i of [0, 1, 2, 3, 8]) at[i] -= (a - 29) * 0.008 * r2;
  }
  if (a >= 24 && a <= 33 && at[7] < p.pot + 6) at[7] += 0.012;
  for (let i = 0; i < 9; i++) at[i] = clamp(at[i], 15, aMax);
  const before = p.ovr;
  const nOvr = calcOvr({ pos: p.pos, at });
  if (dry) return { dOvr: nOvr - before, dAt: at.map((x, i) => x - p.at[i]) };
  p.at = at.map(x => Math.round(x * 100) / 100);
  p.ovr = clamp(calcOvr(p), 30, ovrMax(p));
  if (p.ovr > p.pot) p.pot = Math.ceil(p.ovr);
  // position retraining: aptitude in the chosen position climbs toward LEARN_MAX
  if (p.learn) {
    const dp = p.learn.pos;
    if (!DP_CAT[dp] || dp === ppOf(p) || dp === 'GK' || p.pos === 'GK') p.learn = null;
    else {
      const nv = Math.min(LEARN_MAX, apt(p, dp) + learnRate(S, p));
      p.ap = p.ap || {}; p.ap[dp] = Math.round(nv * 10) / 10;
      if (nv >= LEARN_MAX) {
        if (isMy) news(S, `${p.name}が${dp}（${DP_JP[dp]}）を習得。${dp}でも本職に近いプレーができる。`, 'grow');
        p.learn = null;
      }
    }
  }
  return null;
}
const r1 = x => Math.round(x * 10) / 10;
// one point a month for the growth chart: [YYYY-MM, ovr, pot] (4 years kept)
function track(S, p) {
  const m = S.date.slice(0, 7), pt = [m, r1(p.ovr), r1(p.pot)];
  p.trk = p.trk || [];
  if (p.trk.length && p.trk[p.trk.length - 1][0] === m) p.trk[p.trk.length - 1] = pt; else p.trk.push(pt);
  if (p.trk.length > 48) p.trk.splice(0, p.trk.length - 48);
}
// what-if growth: play `weeks` weeks with `share` of the minutes (at my club, or on loan at `loanTo`); returns {ovr, pot}
function growthOutlook(S, p, share, weeks, loanTo) {
  const q = JSON.parse(JSON.stringify(p)); const S2 = Object.create(S); let d = Date.parse(S.date);
  if (loanTo) { q.club = loanTo; q.loan = { share, from: S.my }; } else q._share = share;
  const mine = p.club === S.my || (p.loan && p.loan.from === S.my) || !!loanTo;
  for (let w = 0; w < weeks; w++) {
    S2.date = new Date(d).toISOString().slice(0, 10); d += 7 * 864e5;
    const r = devWeek(S2, q, true); if (!r) break;
    q.at = q.at.map((x, i) => x + r.dAt[i]); q.ovr = calcOvr(q);
    const a = age(q, S2.date);
    if (a <= 23 && share >= GROW.bloomMin) { const add = share * (a <= 21 ? GROW.bloom21 : GROW.bloom23) * (mine ? 1 : GROW.bloomAI); const room = Math.min(potCap(q) - q.pot, GROW.bloomMax - (q.bloom || 0)); if (room > 0) { q.pot += Math.min(add, room); q.bloom = (q.bloom || 0) + Math.min(add, room); } }
    if (q.ovr > q.pot) q.pot = q.ovr;
  }
  return { ovr: q.ovr, pot: q.pot };
}
// weeks left in this season (to the end of May)
function weeksLeft(S) { return Math.max(0, Math.round((Date.parse((S.season + 1) + '-05-31') - Date.parse(S.date)) / (7 * 864e5))); }
// about how many years until he reaches `target` with `share` of the minutes (null: not within 5 years)
function yearsTo(S, p, share, target) {
  if (p.ovr >= target) return 0;
  const q = JSON.parse(JSON.stringify(p)); const S2 = Object.create(S); let d = Date.parse(S.date);
  q._share = share;
  for (let w = 1; w <= 260; w++) {
    S2.date = new Date(d).toISOString().slice(0, 10); d += 7 * 864e5;
    const r = devWeek(S2, q, true); if (!r) return null;
    q.at = q.at.map((x, i) => x + r.dAt[i]); q.ovr = calcOvr(q);
    const a = age(q, S2.date);
    if (a <= 23 && share >= GROW.bloomMin) { const add = share * (a <= 21 ? GROW.bloom21 : GROW.bloom23); const room = Math.min(potCap(q) - q.pot, GROW.bloomMax - (q.bloom || 0)); if (room > 0) { q.pot += Math.min(add, room); q.bloom = (q.bloom || 0) + Math.min(add, room); } }
    if (q.ovr >= target) return Math.round(w / 52 * 2) / 2 || 0.5;
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
    board: 60, settings: { autoSubs: true, subRate: 'mid', speed: 1 }, training: 'bal', dataRev: DATA.rev || 1,
    fired: null, seasonEnd: null, lastResult: null, nextInboxId: 1, tick: 0,
  };
  for (const c of DATA.clubs) addClub(S, c);
  for (const p of DATA.players) {
    S.players[p.id] = { ...p, cond: 100, form: 6.5, inj: 0, sus: 0, ycAcc: 0, listed: false, st: blankStats(), hist: [], joined: DATA.start };
    delete S.players[p.id].fix;
    initAttrs(S.players[p.id]);
  }
  S.v = 8; S.presV = 4;
  for (const p of squad(S, clubId)) track(S, p);
  for (const id of S.order) autoLineup(S, id);
  S.fixtures = genFixtures(S.order, DATA.round1, sy);
  setupCups(S);
  for (const f of todaysFixtures(S)) hypeMatch(S, f);
  ensureFreeAgents(S);
  setSponsors(S);
  setExpectations(S);
  news(S, `${S.clubs[clubId].name}の監督に就任。${seasonLabel(sy)}シーズンが始まる。`, 'big');
  news(S, `クラブの目標は「${S.clubs[clubId].target.jp}」。`, 'board');
  return S;
}
function blankStats() { return { apps: 0, g: 0, a: 0, yc: 0, rc: 0, rt: 0, mins: 0 }; }
function addClub(S, c, guest) {
  const startFunds = [0, 30000, 50000, 80000, 120000, 180000][c.tier];
  S.clubs[c.id] = {
    id: c.id, name: c.name, short: c.short, abbr: c.abbr, c1: c.c1, c2: c.c2, stadium: c.stadium, cap: c.cap,
    coach: c.coach || '', tier: c.tier, fan: c.fan, area: c.area, base: c.base || (63 + (c.tier || 2)),
    pres: c.pres || 2, titles: Object.assign({ j1: 0, lc: 0, ec: 0, acl: 0 }, c.titles || {}), o10: !!c.o10,
    funds: startFunds, fac: { train: 2, youth: 2, stadium: 2, medical: 2, scout: 1 },
    tac: { form: FORMATIONS[c.form] ? c.form : '4-4-2', ment: 'bal', press: 'mid', xi: [], bench: [] },
    fin: { gate: 0, spon: 0, wages: 0, trans: 0, prize: 0, fac: 0 },
  };
  if (!guest && !S.order.includes(c.id)) S.order.push(c.id);
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
  const gkSlot = ROLE[role].dp === 'GK';
  if (gkSlot || p.pos === 'GK') return gkSlot === (p.pos === 'GK') ? 0 : -35;
  return aptPen(roleApt(p, role));
}
function available(p) { return p.inj <= 0 && p.sus <= 0; }
function effective(p, role, cond) {
  const c = cond == null ? p.cond : cond;
  const formAdj = clamp((p.form - 6.5) * 1.2, -2, 2);
  const fit = p.at ? clamp((roleScore(p, role) - p.ovr) * 0.4, -2.5, 2.5) : 0;
  return p.ovr + posPenalty(p, role) + fit - Math.max(0, 100 - c) * 0.12 + formAdj + (p.hot ? p.hot.b : 0);
}
function autoLineup(S, cid, opts) {
  const c = S.clubs[cid];
  const slots = FORMATIONS[c.tac.form];
  const opp = opts && opts.opp;
  const pool = squad(S, cid).filter(p => available(p) && !(opp && p.loan && p.loan.from === opp));  // loanees sit out against their parent club
  const used = new Set(); const xi = new Array(11).fill(null);
  const restCond = opts && opts.rotate ? 82 : 72;
  // order: GK, ST/W, CB/FB, MF
  const orderIdx = slots.map((s, i) => i).sort((a, b) => {
    const pr = r => ({ GK: 0, ST: 1, SS: 1, LW: 2, RW: 2, CB: 3, LB: 4, RB: 4, DM: 5, AM: 6, LAM: 6, RAM: 6, WAM: 6, WB: 7, CM: 8, LM: 9, RM: 9 })[slots[r][0]];
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
  // the greedy pass can put a star in the wrong slot; swap pairs / bring in reserves while the XI gets better
  const val = (p, i) => { let v = effective(p, slots[i][0]); if (p.cond < restCond) v -= (restCond - p.cond) * 0.4; return v; };
  for (let round = 0; round < 4; round++) {
    let better = false;
    for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) {
      const a = S.players[xi[i]], b = S.players[xi[j]]; if (!a || !b) continue;
      if (val(a, j) + val(b, i) > val(a, i) + val(b, j) + 0.01) { xi[i] = b.id; xi[j] = a.id; better = true; }
    }
    for (let i = 0; i < 11; i++) {
      const cur = S.players[xi[i]]; if (!cur) continue;
      for (const p of pool) if (!used.has(p.id) && val(p, i) > val(S.players[xi[i]], i) + 0.01) { used.delete(xi[i]); xi[i] = p.id; used.add(p.id); better = true; }
    }
    if (!better) break;
  }
  c.tac.xi = xi;
  c.tac.benchManual = false;
  autoBench(S, cid, true);
}
const BENCH_SIZE = 9;
// force=true rebuilds the whole bench; otherwise a manager-picked bench is kept and only topped up
function autoBench(S, cid, force) {
  const c = S.clubs[cid];
  const rest = squad(S, cid).filter(p => available(p) && !c.tac.xi.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
  let bench = [];
  if (c.tac.benchManual && !force) {
    bench = (c.tac.bench || []).filter(id => rest.some(p => p.id === id)).slice(0, BENCH_SIZE);
    if (!bench.some(id => S.players[id].pos === 'GK')) { const gk = rest.find(p => p.pos === 'GK' && !bench.includes(p.id)); if (gk) bench.length >= BENCH_SIZE ? bench[bench.length - 1] = gk.id : bench.push(gk.id); }
    for (const p of rest) { if (bench.length >= BENCH_SIZE) break; if (!bench.includes(p.id) && p.pos !== 'GK') bench.push(p.id); }
  } else {
    const gk = rest.find(p => p.pos === 'GK'); if (gk) bench.push(gk.id);
    for (const p of rest) { if (bench.length >= BENCH_SIZE) break; if (p.pos === 'GK') continue; bench.push(p.id); }
  }
  c.tac.bench = bench;
}
// manager swaps one bench player (outId) for a reserve or starter (inId)
function benchSwap(S, outId, inId) {
  const c = S.clubs[S.my]; const p = S.players[inId];
  if (!p || p.club !== S.my || !available(p)) return false;
  const bi = c.tac.bench.indexOf(outId);
  const xi = c.tac.xi.indexOf(inId);
  if (xi >= 0) { c.tac.xi[xi] = outId >= 0 && bi >= 0 ? outId : null; }
  if (bi >= 0) c.tac.bench[bi] = inId; else if (!c.tac.bench.includes(inId)) c.tac.bench.push(inId);
  c.tac.bench = c.tac.bench.filter((id, i, a) => a.indexOf(id) === i && !c.tac.xi.includes(id));
  c.tac.benchManual = true;
  validateLineup(S, S.my);
  return true;
}
function clubRating(S, cid) {
  const c = S.clubs[cid];
  const can = id => id && S.players[id] && available(S.players[id]);
  const slots = FORMATIONS[c.tac.form].map((s0, i) => ({ role: s0[0], pid: can(c.tac.xi[i]) ? c.tac.xi[i] : null }));
  const cond = {}; for (const s0 of slots) if (s0.pid) cond[s0.pid] = S.players[s0.pid].cond;
  return teamRating(S, { slots, cond, press: c.tac.press, tactBonus: cid === S.my && S.training === 'tact' ? 1 : 0, pres: c.pres || 2 });
}
// what the manager has to sort out before kickoff: empty slots and players who can't play (injured / suspended)
function lineupIssues(S, cid) {
  const c = S.clubs[cid]; const xi = [], bench = [];
  const why = p => p.inj > 0 ? 'inj' : 'sus';
  FORMATIONS[c.tac.form].forEach((s0, i) => {
    const id = c.tac.xi[i]; const p = id && S.players[id];
    if (!p || p.club !== cid) xi.push({ i, role: s0[0], pid: null, why: 'empty' });
    else if (!available(p)) xi.push({ i, role: s0[0], pid: id, why: why(p) });
  });
  for (const id of c.tac.bench) { const p = S.players[id]; if (p && p.club === cid && !available(p)) bench.push({ pid: id, why: why(p) }); }
  // an empty slot only blocks kickoff while someone fit is left to put there
  const spare = squad(S, cid).some(p => available(p) && !c.tac.xi.includes(p.id));
  const block = xi.some(x => x.why !== 'empty' || spare) || bench.length > 0;
  return { xi, bench, block };
}
// AI clubs: drop anyone who can't play and fill the gaps. The manager's own club is never changed behind his back:
// only players who left the club are taken out; injured / suspended players stay where he put them until he swaps them.
function validateLineup(S, cid, opts) {
  const c = S.clubs[cid];
  const inClub = id => id && S.players[id] && S.players[id].club === cid;
  const ok = id => inClub(id) && available(S.players[id]);
  if (cid === S.my && !(opts && opts.fill)) {
    const xi = FORMATIONS[c.tac.form].map((s0, i) => inClub(c.tac.xi[i]) ? c.tac.xi[i] : null);
    const changed = xi.some((id, i) => id !== c.tac.xi[i]) || xi.length !== c.tac.xi.length;
    c.tac.xi = xi;
    c.tac.bench = c.tac.bench.filter((id, k, a) => inClub(id) && !xi.includes(id) && a.indexOf(id) === k);
    return changed;
  }
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
  if (cid !== S.my) autoBench(S, cid);
  return changed;
}
// saved tactics (formation, game plan, XI and bench), up to PRESET_MAX per club
const PRESET_MAX = 5;
function savePreset(S, idx, name) {
  const c = S.clubs[S.my]; c.presets = c.presets || [];
  const ment = MENTALITY[c.tac.ment] ? c.tac.ment : 'bal';
  const pr = { name: (name || '').trim().slice(0, 16) || `${c.tac.form}・${mentLabel({ ment, ctr: c.tac.ctr })}`, form: c.tac.form, ment, ctr: !!c.tac.ctr, press: c.tac.press, xi: c.tac.xi.slice(), bench: c.tac.bench.slice(), d: S.date };
  if (idx != null && c.presets[idx]) { if (!(name || '').trim()) pr.name = c.presets[idx].name; c.presets[idx] = pr; return idx; }
  if (c.presets.length >= PRESET_MAX) return -1;
  c.presets.push(pr); return c.presets.length - 1;
}
// load exactly what was saved: injured / suspended players stay in the team (the manager swaps them himself);
// only players who have left the club leave an empty place
function loadPreset(S, idx) {
  const c = S.clubs[S.my]; const pr = c.presets && c.presets[idx]; if (!pr) return null;
  const inClub = id => id && S.players[id] && S.players[id].club === S.my;
  c.tac.form = FORMATIONS[pr.form] ? pr.form : c.tac.form;
  c.tac.ment = MENTALITY[pr.ment] ? pr.ment : pr.ment === 'ctr' ? 'def' : 'bal';
  c.tac.ctr = !!pr.ctr || pr.ment === 'ctr';
  c.tac.press = PRESS[pr.press] ? pr.press : 'mid';
  c.tac.xi = FORMATIONS[c.tac.form].map((s0, i) => inClub(pr.xi[i]) ? pr.xi[i] : null);
  c.tac.bench = pr.bench.filter((id, k, a) => inClub(id) && !c.tac.xi.includes(id) && a.indexOf(id) === k);
  c.tac.benchManual = true;
  validateLineup(S, S.my);
  return presetStatus(S, pr);
}
function presetStatus(S, pr) {
  const out = [], gone = [];
  for (const id of pr.xi.concat(pr.bench)) {
    if (!id) continue; const p = S.players[id];
    if (!p || p.club !== S.my) gone.push(id); else if (!available(p)) out.push(id);
  }
  return { out, gone };
}
function renamePreset(S, idx, name) { const c = S.clubs[S.my]; if (c.presets && c.presets[idx] && (name || '').trim()) c.presets[idx].name = name.trim().slice(0, 16); }
function deletePreset(S, idx) { const c = S.clubs[S.my]; if (c.presets) c.presets.splice(idx, 1); }
// manager takes a player off the bench without a replacement
function benchRemove(S, pid) {
  const c = S.clubs[S.my]; if (!c.tac.bench.includes(pid)) return false;
  c.tac.bench = c.tac.bench.filter(id => id !== pid); c.tac.benchManual = true;
  return true;
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
  // the UI doesn't let the manager kick off with a player who can't play; if it ever happens, patch the XI for this match
  if (cid === S.my && c.tac.xi.some(id => !id || !available(S.players[id])) && lineupIssues(S, cid).block) validateLineup(S, cid, { fill: true });
  const slots = FORMATIONS[c.tac.form].map((s, i) => ({ role: s[0], x: s[1], y: s[2], pid: c.tac.xi[i] || null }));
  const cond = {};
  for (const s of slots) if (s.pid) cond[s.pid] = S.players[s.pid].cond;
  const tactBonus = cid === S.my && S.training === 'tact' ? 1 : 0;
  return { cid, form: c.tac.form, ment: MENTALITY[c.tac.ment] ? c.tac.ment : 'bal', ctr: !!c.tac.ctr, press: c.tac.press, slots, bench: c.tac.bench.filter(id => S.players[id] && S.players[id].club === cid && available(S.players[id])), subs: 0, subLog: [], cond, tactBonus, sent: [], pres: c.pres || 2, fan: c.fan || 2 };
}
function createMatch(S, fx) {
  const M = {
    fid: fx.id, min: 0, half: 1, done: false, h: sideFor(S, fx.h), a: sideFor(S, fx.a), hg: 0, ag: 0,
    ev: [], st: { h: { sh: 0, ot: 0, pos: 0, fo: 0 }, a: { sh: 0, ot: 0, pos: 0, fo: 0 } },
    pm: {}, mom: 0, ball: { x: 50, y: 50, side: 'h' }, userSide: fx.h === S.my ? 'h' : fx.a === S.my ? 'a' : null,
    lg: leagueAvg(S), cup: fx.cup || null, neutral: !!fx.neutral,
  };
  for (const k of ['h', 'a']) for (const s of M[k].slots) if (s.pid) M.pm[s.pid] = { side: k, role: s.role, rt: 6.0, g: 0, a: 0, yc: 0, rc: 0, on: 0, off: null, inj: 0 };
  M.ev.push({ m: 0, t: 'ko', text: `キックオフ　${S.clubs[fx.h].short} vs ${S.clubs[fx.a].short}` + (fx.cup ? `（${fxLabel(fx)}）` : '') });
  // players on fire for this match
  const hy = hypeMatch(S, fx); M.hot = {};
  for (const h of hy.hot) { const p = S.players[h.pid]; if (!p || !p.hot) continue; M.hot[h.pid] = h.why; if (M.pm[h.pid] || M[h.side].bench.includes(h.pid)) M.ev.push({ m: 0, t: 'hot', side: h.side, pid: h.pid, text: `【覚醒】${p.name}が燃えている！（${h.why}）` }); }
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
    const r = teamRating(S, sd);
    // a player on fire lifts the whole side
    if (sd.slots.some(s => s.pid && S.players[s.pid] && S.players[s.pid].hot)) { r.att += HYPE.team; r.mid += HYPE.team * 0.6; }
    return r;
  };
  const rh = live(H), ra = live(A);
  const pH = 1 / (1 + Math.exp(-((rh.mid - ra.mid) + 1.0) / 8));
  M.st.h.pos += pH; M.st.a.pos += 1 - pH; M.pH = pH;
  const ms = MENTALITY, lg = M.lg;
  const base = 0.109;
  const rate = (r, o, p, own, opp) => {
    const oM = ms[own.ment] || ms.bal, pM = ms[opp.ment] || ms.bal;
    let adv = (r.att - lg.att) - (o.def - lg.def);
    if (adv > 0 && pM.sq) adv *= 1 - pM.sq; // a deep block blunts a stronger attack
    let v = base * (1 + (p - 0.5) * 0.4) * Math.exp(adv / 44) * Math.pow(r.attV / 4.1, 0.35) * Math.pow(o.defV / 4.6, -0.35) * oM.own * pM.opp;
    if (own.ctr) v *= opp.ment === 'att' ? 1.05 : 0.85; // fewer, quicker attacks (plenty when the other side pours forward)
    return v;
  };
  const lateBoost = (M.min > 80 ? 1.08 : 1);
  // 終盤、リードされている／追いつきたい名門は粘る
  const grit = (sd, own, opp) => M.min >= 75 && own <= opp ? 1 + ((sd.pres || 2) - 3) * 0.04 : 1;
  const rH = rate(rh, ra, pH, H, A) * lateBoost * (M.neutral ? 1 : 1.05 + (H.fan || 2) * 0.01) * grit(H, M.hg, M.ag);
  const rA = rate(ra, rh, 1 - pH, A, H) * lateBoost * (M.neutral ? 1 : 0.95) * grit(A, M.ag, M.hg);
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
  // AI (and auto) substitutions; my side follows the chosen frequency (交代の頻度), AI clubs the old pattern
  for (const k of ['h', 'a']) {
    const auto = M.userSide !== k || S.settings.autoSubs;
    const rate = M.userSide === k ? subRate(S) : SUB_RATE.ai;
    if (auto && rate.mins.includes(M.min)) aiSubs(S, M, k, push, rate);
  }
  if (M.min === 45) { push({ t: 'ht', text: `前半終了　${M.hg} - ${M.ag}` }); M.half = 2; }
  if (M.min >= 90 + (M.extra || 0)) {
    if (M.extra == null) { M.extra = ri(2, 5); }
    else {
      M.done = true;
      if (M.cup && M.hg === M.ag) { shootout(S, M); push({ t: 'pk', text: `PK戦 ${M.pk[0]}-${M.pk[1]}　${S.clubs[(M.pk[0] > M.pk[1] ? M.h : M.a).cid].short}が勝ち抜け` }); }
      push({ t: 'ft', text: `試合終了　${S.clubs[M.h.cid].short} ${M.hg} - ${M.ag} ${S.clubs[M.a.cid].short}` + (M.pk ? `（PK ${M.pk[0]}-${M.pk[1]}）` : '') });
    }
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
  const sh = wpick(shooters, s => (ROLE[s.role].a * 3 + 0.15) * Math.pow(S.players[s.pid].ovr / 70, 3) * (S.players[s.pid].hot ? 2.2 : 1));
  const P = S.players[sh.pid];
  const atk = P.at ? P.at[0] : P.ovr;
  M.st[k].sh++;
  M.ball = { x: sh.x, y: 85, side: k };
  const shotSkill = (effective(P, sh.role, sd.cond[sh.pid]) * 0.5 + atk * 0.5);
  const q = 0.112 * Math.exp((shotSkill - o.gk) / 40) * (sd.ctr ? counterQ(k === 'h' ? 1 - (M.pH == null ? 0.5 : M.pH) : (M.pH == null ? 0.5 : M.pH)) : 1);
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
  M.pm[inPid] = { side: k, role: slot.role, rt: 6.0, g: 0, a: 0, yc: 0, rc: 0, on: M.min, off: null, inj: 0 };
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
// how readily the bench is used. mins: when to look; two: from which minute two changes at a time; cond: before 'late', change a
// player only when his condition is at or under this (in-match condition only falls to ~85 by full time, so 'late' is what
// mostly sets the timing); tol: how much worse the sub may be; max: changes it makes by itself (injuries not counted).
// My side follows S.settings.subRate; AI clubs keep the old pattern ('ai') so the league balance does not move.
const SUB_RATE = {
  low: { jp: '少なめ', sub: '終盤に1〜2人だけ。先発を長く使う', mins: [70, 80], two: 99, cond: 70, late: 70, tol: 4, max: 2 },
  mid: { jp: 'ふつう', sub: '60分ごろから順に3〜4人', mins: [60, 70, 78], two: 78, cond: 78, late: 60, tol: 6, max: 4 },
  high: { jp: '多め', sub: '早めに動いて5人とも使う。新しい脚で押し切る', mins: [55, 63, 71, 79], two: 55, cond: 85, late: 55, tol: 15, max: 5 },
  ai: { mins: [58, 66, 74, 82], two: 74, cond: 72, late: 80, tol: 4, max: 5 },
};
function subRate(S) { return SUB_RATE[S.settings && S.settings.subRate] || SUB_RATE.mid; }
function aiSubs(S, M, k, push, rate) {
  const R0 = rate || SUB_RATE.ai;
  const sd = M[k];
  const made = () => sd.subLog.filter(([o]) => !(M.pm[o] && M.pm[o].inj)).length;  // injury changes don't count
  if (sd.subs >= 5 || made() >= R0.max) return;
  const cands = onPitch(sd).filter(s => s.role !== 'GK').map(s => ({ s, c: sd.cond[s.pid], rt: M.pm[s.pid].rt }))
    .sort((x, y) => (x.c + x.rt * 4) - (y.c + y.rt * 4));
  const n = M.min >= R0.two ? 2 : 1;
  for (let i = 0; i < n && i < cands.length; i++) {
    if (made() >= R0.max) return;
    const { s, c } = cands[i];
    if (c > R0.cond && M.min < R0.late) continue;
    const inn = bestSubFor(S, M, k, s);
    if (!inn) return;
    if (effective(S.players[inn], s.role) < effective(S.players[s.pid], s.role, c) - R0.tol) continue;
    doSub(S, M, k, s.pid, inn, push);
  }
}
function setMentality(M, k, ment) { M[k].ment = ment; }
function setCounter(M, k, on) { M[k].ctr = !!on; }
function mentLabel(t) { return ((MENTALITY[t.ment] || MENTALITY.bal).jp) + (t.ctr ? '＋カウンター' : ''); }
// counters work when the other side has the ball and space behind; against a side that sits deep there is little to hit
function counterQ(oppShare) { return clamp(1.15 + (oppShare - 0.5) * 1.5, 0.9, 1.6); }

function simulateFull(S, M) { while (!M.done) stepMatch(S, M); return M; }

/* ---------- apply results ---------- */
function finishMatch(S, M) {
  const fx = S.fixtures.find(f => f.id === M.fid);
  fx.hg = M.hg; fx.ag = M.ag; fx.played = true;
  if (M.pk) fx.pk = M.pk;
  fx.sc = M.ev.filter(e => e.t === 'goal' || e.t === 'red').map(e => [e.m, e.side, e.t === 'goal' ? 'g' : 'r', e.pid]);
  const cup = !!fx.cup;
  // in a cup tie the shootout decides who goes through
  const hw = cup ? cupWinner(fx) === fx.h : null;
  const res = { h: cup ? (hw ? 'W' : 'L') : M.hg > M.ag ? 'W' : M.hg < M.ag ? 'L' : 'D' };
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
    if (cup) { p.cs = p.cs || { apps: 0, g: 0, a: 0 }; p.cs.apps++; p.cs.g += pm.g; p.cs.a += pm.a; p.st.mins += Math.max(1, mins); } // cup games: own record, but the minutes still help growth
    else { p.st.apps++; p.st.g += pm.g; p.st.a += pm.a; p.st.mins += Math.max(1, mins); p.st.rt += rt; }
    if (p.hot) delete p.hot;
    // playing out of position slowly gets a player used to it
    const dp = pm.role && ROLE[pm.role] ? ROLE[pm.role].dp : null;
    if (dp && dp !== 'GK' && p.pos !== 'GK' && mins >= 45 && dp !== ppOf(p)) { const cur = apt(p, dp); if (cur < PLAY_MAX) { p.ap = p.ap || {}; p.ap[dp] = Math.round(Math.min(PLAY_MAX, cur + 0.6) * 10) / 10; } }
    p.form = p.form * 0.6 + rt * 0.4;
    p.cond = Math.round(sd.cond[pidS] != null ? sd.cond[pidS] : p.cond - 10);
    if (pm.yc && !pm.rc && !cup) { p.st.yc++; p.ycAcc++; if (p.ycAcc >= 4) { p.sus = 1; p.ycAcc = 0; if (p.club === S.my) news(S, `${p.name}は累積警告で次節出場停止。`, 'warn'); } }
    if (pm.rc) { p.st.rc++; p.sus = Math.max(p.sus, pm.yc >= 2 ? 1 : 2); if (p.club === S.my) news(S, `${p.name}は退場処分で出場停止（${p.sus}試合）。`, 'warn'); }
    if (pm.inj) { p.inj = pm.inj; if (p.club === S.my) news(S, `${p.name}が負傷。全治およそ${pm.inj}日の見込み。`, 'warn'); }
  }
  // finances: gate for home club (a final at 国立 is shared)
  const hc = S.clubs[fx.h];
  let att = attendance(S, fx.h, fx.a);
  if (cup) att = fx.neutral ? Math.round(NATIONAL.cap * (0.75 + R() * 0.2)) : Math.round(att * (fx.cr >= CUPS[fx.cup].rounds.length - 2 ? 0.9 : 0.55));
  fx.att = att;
  const gate = Math.round(att * (0.2 + hc.fac.stadium * 0.01));
  if (fx.neutral) { for (const id of [fx.h, fx.a]) { S.clubs[id].funds += Math.round(gate / 2); S.clubs[id].fin.gate += Math.round(gate / 2); } }
  else { hc.funds += gate; hc.fin.gate += gate; }
  // board
  if (M.userSide) {
    const k = M.userSide, opp = k === 'h' ? fx.a : fx.h;
    const myS = strength(S, S.my), opS = strength(S, opp) - (k === 'h' ? 1 : -1);
    const expPts = clamp(1.35 + (myS - opS) * 0.18, 0.4, 2.4);
    const pts = res[k] === 'W' ? 3 : res[k] === 'D' ? 1 : 0;
    const B = boardLv(S), b0 = S.board;
    S.board = clamp(Math.round(S.board + (pts - expPts) * B.match * (cup ? 0.5 : 1)), 0, 100);
    const pk = M.pk ? `（PK ${M.pk[0]}-${M.pk[1]}）` : '';
    S.lastResult = { fid: fx.id, res: res[k], text: `${S.clubs[fx.h].short} ${M.hg}-${M.ag} ${S.clubs[fx.a].short}${pk}` };
    const potm = Object.entries(M.pm).filter(([, pm]) => pm.side === k).sort((a, b) => b[1].final - a[1].final)[0];
    const giant = res[k] === 'W' && power(S, opp) - power(S, S.my) >= 4 ? '　ジャイアントキリング！' : '';
    news(S, `${fxLabel(fx)}　${S.clubs[fx.h].short} ${M.hg}-${M.ag} ${S.clubs[fx.a].short}${pk}（${res[k] === 'W' ? (cup ? '勝ち抜け' : '勝利') : res[k] === 'D' ? '引き分け' : '敗戦'}）${giant}` + (potm ? `　チーム最高評価：${S.players[potm[0]].name}（${potm[1].final.toFixed(1)}）` : ''), res[k] === 'W' ? 'win' : res[k] === 'L' ? 'loss' : 'draw');
    // warnings on the way down (once each until it recovers)
    const lv = B.warn.filter(w => S.board <= w).length;
    if (S.board > B.warn[0] + 10) S.boardWarn = 0;
    if (lv > (S.boardWarn || 0) && S.board < b0) {
      S.boardWarn = lv;
      news(S, lv >= 2 ? `フロントの信頼が${S.board}まで下がった。このまま負けが込むと解任もありうる。` : `フロントが成績を不安視している（信頼 ${S.board}）。`, 'warn');
      S._stopNote = lv >= 2 ? 'フロントの信頼が危険水域です' : 'フロントが成績を不安視しています';
    }
  }
  M.applied = true;
  return fx;
}
function attendance(S, hid, aid) {
  const c = S.clubs[hid], o = S.clubs[aid];
  const t = table(S); const row = t.find(r => r.id === hid); const pos = t.indexOf(row) + 1;
  let f = 1 + (o.fan >= 4 ? 0.08 : 0) + (c.fac.stadium - 2) * 0.05 + (row && row.p > 3 ? (10 - pos) * 0.012 : 0) + (c.hype || 0);
  if (hid === S.my && Object.values(S.players).some(p => p.reborn && p.club === hid)) f += 0.05;  // a reborn legend draws the fans
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
function seasonOver(S) { return S.fixtures.every(f => f.played) && cupsDone(S); }

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
    if (p.hot && p.hot.d !== S.date) delete p.hot;
    let rec = 6 + med * 0.6 + (mine ? TRAINING[S.training].rec + it.rec : 0);
    if (age(p, S.date) >= 31) rec -= 1;
    p.cond = Math.min(100, p.cond + rec);
    if (mine && it.inj && p.inj <= 0 && R() < it.inj * (1.15 - med * 0.06)) { p.inj = ri(3, 14); news(S, `${p.name}がハードトレーニング中に負傷。全治およそ${p.inj}日。`, 'warn'); }
    if (p.inj > 0) { p.inj--; if (p.inj === 0 && p.club === S.my) news(S, `${p.name}が負傷から復帰。`, 'info'); }
  }
  for (const it of S.inbox) if (!it.done && it.exp && S.date > it.exp) { it.done = true; it.result = 'expired'; scoutExpire(S, it); }
  scoutReturns(S);
  if (D.dow(S.date) === 1) weekly(S);
  if (D.d(S.date) === 1) monthly(S);
  if (isIn) transferDay(S);
  // board patience
  { const B = boardLv(S);
    if (S.board <= B.fireMid && S.fixtures.filter(f => f.played && !f.cup && (f.h === S.my || f.a === S.my)).length >= B.fireAfter) {
      const t = table(S), pos = t.findIndex(r => r.id === S.my) + 1;
      if (pos > t.length - B.zone) fire(S, '成績不振による解任');
    } }
  matchdayPrep(S);
}
// the morning of a matchday: cup draws, who is on fire, and the other clubs' team sheets and game plans
function matchdayPrep(S) {
  progressCups(S);
  const today = todaysFixtures(S);
  for (const f of today) hypeMatch(S, f);
  for (const f of today) for (const [cid, opp] of [[f.h, f.a], [f.a, f.h]]) {
    if (cid === S.my || !S.clubs[cid]) continue;
    autoLineup(S, cid, { rotate: true, opp });
    const plan = aiMentality(S, cid, opp); S.clubs[cid].tac.ment = plan.ment; S.clubs[cid].tac.ctr = plan.ctr;
  }
  if (today.some(f => f.h === S.my || f.a === S.my)) validateLineup(S, S.my);
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
  // growth chart points + 若手の成長レポート (my young players and the ones out on loan; last month = previous chart point)
  const rows = [];
  for (const p of mine.concat(myLoans(S).filter(p => p.at))) {
    const prev = p.trk && p.trk.length ? p.trk[p.trk.length - 1] : null;
    track(S, p);
    if (prev && prev[0] !== S.date.slice(0, 7) && age(p, S.date) <= LOAN.maxAge) { const sh = shareFor(S, p); rows.push({ pid: p.id, a: prev[1], b: r1(p.ovr), pa: prev[2], pb: r1(p.pot), sh: sh == null ? null : Math.round(sh * 100) / 100, loan: p.loan ? p.loan.to : null }); }
  }
  S.inbox = S.inbox.filter(x => x.type !== 'youth');
  if (rows.length) {
    rows.sort((x, y) => (y.b - y.a) - (x.b - x.a) || (y.pb - y.pa) - (x.pb - x.pa) || y.b - x.b);
    S.inbox.unshift({ id: S.nextInboxId++, type: 'youth', m: D.m(S.date) === 1 ? 12 : D.m(S.date) - 1, rows, d: S.date, seen: true, done: false });
  }
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
    const top = squad(S, S.my).filter(p => !p.listed && !p.retire && !p.reborn && available(p)).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
    const p = pick(top); if (p && !p.keep && !S.inbox.some(x => x.type === 'offer' && x.pid === p.id && !x.done)) makeOffer(S, p, 1.05 + R() * 0.35);  // 放出不可: the club says no up front
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
  if (p.reborn) { S.board = clamp(S.board - 10, 0, 100); news(S, `転生した${p.name}を手放したことに、サポーターから落胆の声が上がっている。`, 'warn'); }
  return { ok: true };
}
// 放出リスト (p.listed) and 放出不可 (p.keep) are exclusive. 放出不可 = no unsolicited bids, pending offers are declined.
function setListed(S, pid, on) {
  const p = S.players[pid]; if (!p || p.club !== S.my) return { ok: false };
  const wasKeep = !!p.keep;
  p.listed = !!on; if (on) delete p.keep;
  return { ok: true, wasKeep: on && wasKeep };
}
function setKeep(S, pid, on) {
  const p = S.players[pid]; if (!p || p.club !== S.my) return { ok: false, n: 0 };
  const wasListed = !!p.listed; let n = 0;
  if (!on) { delete p.keep; return { ok: true, n }; }
  p.keep = true; p.listed = false;
  for (const it of S.inbox) if (it.type === 'offer' && it.pid === pid && !it.done) { it.done = true; it.result = 'rejected'; n++; }
  return { ok: true, n, wasListed };
}
function rejectOffer(S, iid) { const it = S.inbox.find(x => x.id === iid); if (it) { it.done = true; it.result = 'rejected'; } }
function moveP(S, p, toCid, fee) {
  const from = S.clubs[p.club], to = S.clubs[toCid];
  if (from) { from.funds += fee; from.fin.trans += fee; from.tac.xi = from.tac.xi.map(x => x === p.id ? null : x); from.tac.bench = from.tac.bench.filter(x => x !== p.id); }
  if (to) { to.funds -= fee; to.fin.trans -= fee; }
  const oldClub = p.club;
  if (S.clubs[oldClub]) p.prev = oldClub; // for 古巣対決
  p.club = toCid; p.listed = false; delete p.keep; p.joined = S.date; p.cond = Math.min(p.cond, 90);
  if (toCid === S.my) { unshort(S, p.id); delete p.trk; track(S, p); }  // signed: off the shortlist, growth chart starts
  else if (oldClub === S.my) delete p.trk;
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
  const targets = Object.values(S.players).filter(p => p.club !== buyer && p.club !== S.my && !p.loan && S.clubs[p.club] && p.pos === pos && p.ovr > bar && p.ovr < bar + 6 && squad(S, p.club).length > 24);
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
  return Object.values(S.players).filter(p => p.club !== S.my && !p.retire && !p.loan && (S.clubs[p.club] || p.club === 'FA'))
    .filter(p => !f.pos || p.pos === f.pos)
    .filter(p => !f.q || p.name.replace(/\s/g, '').includes(f.q.replace(/\s/g, '')) || (S.clubs[p.club] && S.clubs[p.club].short.includes(f.q)))
    .sort((a, b) => b.ovr - a.ovr);
}
// Try to buy. mult: offer as multiple of value. Returns {ok, msg}
function bid(S, pid, mult) {
  const p = S.players[pid]; if (!p) return { ok: false, msg: '選手が見つかりません' };
  if (p.retire) return { ok: false, msg: `${p.name}は今季限りでの引退が決まっています` };
  if (p.loan) return { ok: false, msg: `${p.name}は期限付き移籍中の選手です` };
  const my = S.clubs[S.my];
  if (p.club === 'FA') {
    if (squad(S, S.my).length >= 40) { noteBid(S, p, 0, 'full'); return { ok: false, msg: '登録上限（40人）に達しています' }; }
    const sign = Math.round(wage(p) * 0.5 / 10) * 10;
    if (my.funds < sign) { noteBid(S, p, sign, 'funds'); return { ok: false, msg: '契約金を払う資金が足りません' }; }
    my.funds -= sign; my.fin.trans -= sign;
    moveP(S, p, S.my, 0);
    news(S, `フリーの${p.name}と契約（契約金 ${money(sign)}）。`, 'transfer');
    return { ok: true, msg: `${p.name}と契約しました` };
  }
  if (!inWindow(S.date)) return { ok: false, msg: `移籍期間外です（次は${jdate(nextWindowStart(S.date))}から）` };
  const v = value(p, S.date); const fee = Math.round(v * mult / 100) * 100;
  if (squad(S, S.my).length >= 40) { noteBid(S, p, fee, 'full'); return { ok: false, msg: '登録上限（40人）に達しています' }; }
  if (my.funds < fee) { noteBid(S, p, fee, 'funds'); return { ok: false, msg: `資金が足りません（必要 ${money(fee)}）` }; }
  const seller = S.clubs[p.club];
  const rank = squad(S, p.club).sort((a, b) => b.ovr - a.ovr).findIndex(x => x.id === p.id);
  const demand = rank < 6 ? 1.35 : rank < 14 ? 1.12 : 0.92;
  if (squad(S, p.club).length <= 22) { noteBid(S, p, fee, 'thin'); return { ok: false, msg: `${seller.short}は選手層が薄く、放出を拒否しました` }; }
  S._bids = S._bids || {};
  const we = windowEnd(S.date);
  const prev = S._bids[pid];
  if (prev && prev.until >= S.date && prev.refused) return { ok: false, msg: `${p.name}は今回の移籍期間中は移籍しない意向です` };
  if (prev && prev.date === S.date) return { ok: false, msg: '同じ日に同じ選手へ再オファーはできません' };
  S._bids[pid] = { date: S.date, until: we };
  if (mult < demand * (0.94 + R() * 0.08)) { const guide = Math.round(v * demand / 100) * 100; noteBid(S, p, fee, 'club', guide); return { ok: false, msg: `${seller.short}がオファーを拒否（目安：${money(guide)}前後）` }; }
  // player willingness
  const myLvl = strength(S, S.my), theirLvl = strength(S, p.club);
  // players are drawn to bigger, more storied clubs
  const reluct = (theirLvl - myLvl) * 0.06 + (p.ovr - myLvl - 4) * 0.04 + ((S.clubs[p.club].pres || 2) - (my.pres || 2)) * 0.1;
  if (R() < clamp(reluct, 0, 0.75)) { S._bids[pid].refused = true; noteBid(S, p, fee, 'player'); return { ok: false, msg: `クラブ間で合意したが、${p.name}本人が移籍を断った（今期間中は交渉不可）` }; }
  const fromName = seller.short;
  moveP(S, p, S.my, fee);
  news(S, `${p.name}（${fromName}）を獲得！ 移籍金 ${money(fee)}。`, 'transfer');
  return { ok: true, msg: `${p.name}を獲得しました` };
}
/* ---------- 転生選手: a legend of the club I manage comes back as a 16-year-old ----------
   From my 2nd season at a club, at the start of each season: REBORN.base, more after a season that met the target
   (met) and for each title (title), certain once `pity` draws in a row have missed. Each legend once per save.
   Names are made up in the style of the real ones (中村俊輔 → 外町俊之輔); the pop-up tells who he was through the
   number, the era and the epithet. Retired players only (deceased: only on request, e.g. yfm4). num: the number he made his own (null if none). */
// grow: how a 転生 player develops — his ceiling is the legend's (100〜108), the weekly base rate is capped higher than a
// normal prodigy's (gMax) and he grows well even from the bench (base + share × play), so a few seasons make him a star
const REBORN = { base: 0.25, met: 0.15, title: 0.2, pity: 2, ovr: [62, 66],
  grow: { k: [[19, 0.06], [22, 0.055], [26, 0.045]], kOld: 0.02, gMax: 0.13, base: 1.0, play: 0.6 } };
const LEGENDS = {
  yokohamafm: [
    { id: 'yfm1', name: '外町 俊之輔', pp: 'OMF', sty: 'tech', num: 25, era: '1997–2016', epi: 'ハマの左足', line: '左足ひとつで試合を変えた。フリーキックの名手にしてファンタジスタ。', pot: 108 },
    { id: 'yfm4', name: '梅田 直輝', pp: 'CB', sty: 'phys', num: 3, era: '1995–2010', epi: 'トリコロールの闘将', line: '誰よりも熱く、誰よりも勝利を求めた。マリノスの背番号3。', pot: 105 },
    { id: 'yfm2', name: '奥澤 佑仁', pp: 'CB', sty: 'phys', num: 22, era: '2002–2018', epi: '不屈のボンバー', line: '空中戦で負けない。長く最終ラインに立ち続けた柱。', pot: 105 },
    { id: 'yfm3', name: '井野 正己', pp: 'CB', sty: '', num: 4, era: '1990–1999', epi: 'アジアの壁', line: '読みと統率で守備をまとめ上げたリベロ。', pot: 104 },
  ],
  kashima: [
    { id: 'ksm1', name: '大笠原 満夫', pp: 'CMF', sty: 'tech', num: 40, era: '1998–2018', epi: '常勝の背番号40', line: '黙々とタイトルを積み上げた、中盤の主。', pot: 106 },
    { id: 'ksm2', name: '春田 豊', pp: 'CB', sty: 'phys', num: 3, era: '1993–2003', epi: '空中戦の鬼', line: 'ヘディングで跳ね返し続けた闘将。', pot: 103 },
    { id: 'ksm3', name: '桜沢 敦史', pp: 'ST', sty: 'speed', num: 13, era: '1996–2007', epi: '動き出しの天才', line: 'ひと呼吸早い動き出しで、何度も裏を取ったストライカー。', pot: 104 },
  ],
  urawa: [
    { id: 'urw1', name: '福山 正弘', pp: 'CF', sty: '', num: 9, era: '1989–2002', epi: 'ミスターレッズ', line: '苦しい時代も赤いユニフォームでゴールを奪い続けた。', pot: 103 },
    { id: 'urw2', name: '大野 伸三', pp: 'OMF', sty: 'tech', num: null, era: '1998–2007', epi: '天才ゲームメーカー', line: 'ボールが足に吸い付くようなタッチで観客を魅了した。', pot: 108 },
  ],
  kawasakif: [
    { id: 'kwf1', name: '仲村 憲豪', pp: 'CMF', sty: 'tech', num: 14, era: '2003–2020', epi: '等々力のバンディエラ', line: 'クラブ一筋。パス一本で試合を動かした司令塔。', pot: 107 },
    { id: 'kwf2', name: '小久保 嘉仁', pp: 'CF', sty: '', num: 13, era: '2013–2016', epi: '三年連続の得点王', line: 'ゴール前の嗅覚と強烈なシュートで、得点王を取り続けた。', pot: 106 },
  ],
  gosaka: [
    { id: 'gos1', name: '近藤 保之', pp: 'DMF', sty: 'tech', num: 7, era: '2001–2020', epi: 'コロコロの司令塔', line: '慌てず、急がず。冷静なパスとPKで黄金期を支えた。', pot: 107 },
    { id: 'gos2', name: '三川 孝弘', pp: 'OMF', sty: 'tech', num: 10, era: '1999–2016', epi: '魔法のスルーパス', line: '誰も見えていない道筋にパスを通した、ガンバの10番。', pot: 104 },
  ],
  hiroshima: [
    { id: 'hir1', name: '加藤 寿仁', pp: 'CF', sty: '', num: 11, era: '2005–2016', epi: 'ゴールの匂いを嗅ぐ男', line: 'わずかなスキを逃さず、ゴールを積み重ねたストライカー。', pot: 105 },
    { id: 'hir2', name: '林崎 和之', pp: 'DMF', sty: 'tech', num: 8, era: '1999–2018', epi: '紫の舵取り', line: 'クラブ一筋。中盤の底からタイトルへ導いた。', pot: 103 },
  ],
  kashiwa: [
    { id: 'ksw1', name: '小谷 秀一', pp: 'DMF', sty: '', num: 7, era: '2003–2021', epi: '柏の主将', line: 'クラブ一筋。誰よりも走り、チームをまとめ続けた。', pot: 102 },
    { id: 'ksw2', name: '南嶋 秀明', pp: 'CF', sty: 'phys', num: null, era: '1997–2010', epi: '日立台のストライカー', line: '体を張ってゴールに向かい、スタジアムを沸かせた。', pot: 101 },
  ],
  fctokyo: [
    { id: 'fct1', name: '石山 直弘', pp: 'WG', sty: 'speed', num: 18, era: '2002–2017', epi: '青赤の快速ウイング', line: 'サイドを駆け上がる速さで、何度もスタジアムを揺らした。', pot: 104 },
  ],
  tokyov: [
    { id: 'tkv1', name: 'ラミレス 瑠威', pp: 'OMF', sty: 'tech', num: 10, era: '1977–1998', epi: '緑のカリスマ', line: '技術と気迫でクラブを日本一に導いた司令塔。', pot: 107 },
    { id: 'tkv2', name: '南澤 剛', pp: 'CMF', sty: 'phys', num: null, era: '1991–2002', epi: '中盤のダイナモ', line: '90分走り続け、ボールを奪い続けた。', pot: 102 },
  ],
  nagoya: [
    { id: 'ngy1', name: '楢原 正豪', pp: 'GK', sty: '', num: 1, era: '1999–2018', epi: '鉄壁の守護神', line: '20年近くゴールマウスを守り、リーグ優勝をもたらした。', pot: 106 },
    { id: 'ngy2', name: 'ドラゴ ストイコフ', pp: 'OMF', sty: 'tech', num: 10, era: '1994–2001', epi: '名古屋の妖精', line: '魔法のようなボールタッチで、見る者を魅了した。', pot: 108, nat: 'SRB' },
  ],
  cosaka: [
    { id: 'cos1', name: '林島 寛明', pp: 'OMF', sty: '', num: 8, era: '1991–2008', epi: 'ミスターセレッソ', line: 'クラブ一筋。背番号8の系譜はここから始まった。', pot: 104 },
    { id: 'cos2', name: '東澤 明則', pp: 'CF', sty: 'phys', num: null, era: '1995–2011', epi: '桜の大砲', line: '高さと強さで前線に君臨したストライカー。', pot: 102 },
  ],
  kobe: [
    { id: 'kob1', name: 'アンドレア イニエスト', pp: 'OMF', sty: 'tech', num: 8, era: '2018–2023', epi: '魔法の8番', line: '世界の頂点を知る技術で、神戸に初タイトルをもたらした。', pot: 108, nat: 'ESP' },
  ],
  shimizu: [
    { id: 'shm1', name: '澤上 正明', pp: 'OMF', sty: 'tech', num: 10, era: '1992–2005', epi: 'ミスターエスパルス', line: 'クラブ一筋。正確なキックでオレンジの攻撃を操った。', pot: 104 },
  ],
  chiba: [
    { id: 'chb1', name: '巻 誠二郎', pp: 'CF', sty: 'phys', num: null, era: '2003–2010', epi: '泥臭きストライカー', line: '体を投げ出してゴールを奪う、ひたむきなフォワード。', pot: 102 },
    { id: 'chb2', name: '加藤 勇斗', pp: 'DMF', sty: 'phys', num: null, era: '2000–2019', epi: 'ジェフの闘将', line: '中盤で戦い続け、苦しい時代のチームを支えた。', pot: 101 },
  ],
  fukuoka: [
    { id: 'fuk1', name: '山上 芳樹', pp: 'CF', sty: 'speed', num: null, era: '1990年代', epi: '博多の点取り屋', line: 'クラブの草創期に、スピードでゴールを量産した。', pot: 102 },
  ],
  kyoto: [
    { id: 'kyo1', name: '松山 大介', pp: 'SH', sty: 'tech', num: null, era: '2000–2004', epi: '古都の魔術師', line: '変幻自在のドリブルで、クラブに初のタイトルをもたらした。', pot: 105 },
  ],
  machida: [
    { id: 'mcd1', name: '李 漢才', pp: 'CMF', sty: '', num: null, era: '2014–2020', epi: '町田の主将', line: 'キャプテンとしてチームをJ2へ押し上げた。', pot: 100 },
  ],
  mito: [
    { id: 'mit1', name: '本宮 幸治', pp: 'GK', sty: '', num: null, era: '1999–2024', epi: '水戸の守護神', line: '26年ゴールを守り、J2最多出場を積み上げた。', pot: 102 },
  ],
  nagasaki: [
    { id: 'ngs1', name: '前川 悠介', pp: 'DMF', sty: '', num: null, era: '2010年代', epi: 'クラブの心臓', line: '最古参として、地域リーグからJ1までの道のりを支えた。', pot: 100 },
  ],
  okayama: [
    { id: 'oky1', name: '喜川 康太', pp: 'DMF', sty: '', num: null, era: '2010年代', epi: '岡山の背骨', line: '長く中盤に立ち、J2を戦い抜いた。', pot: 100 },
  ],
  iwata: [
    { id: 'iwt1', name: '名浜 浩之', pp: 'OMF', sty: 'tech', num: 10, era: '1995–2008', epi: 'サックスブルーの司令塔', line: '左足のパスで黄金期の攻撃を組み立てた。', pot: 106 },
    { id: 'iwt2', name: '中川 雅志', pp: 'CF', sty: '', num: 9, era: '1994–2009', epi: '炎のストライカー', line: '最後まで諦めない姿勢で、ゴールを奪い続けた。', pot: 104 },
  ],
  shonan: [
    { id: 'shn1', name: '外田 英斗', pp: 'OMF', sty: 'tech', num: null, era: '1995–1998', epi: '湘南の天才', line: '10代で頭角を現し、世界へ羽ばたいた。', pot: 108 },
  ],
  oita: [
    { id: 'oit1', name: '低松 大輝', pp: 'CF', sty: 'phys', num: null, era: '2000年代', epi: 'トリニータの大黒柱', line: '高さと強さで前線を支え続けた。', pot: 101 },
  ],
};
function legendOf(id) { for (const ls of Object.values(LEGENDS)) { const l = ls.find(x => x.id === id); if (l) return l; } return null; }
function rebornCheck(S, se) {
  const st = S.reborn || (S.reborn = { used: [], wait: 0, club: S.my });
  if (st.club !== S.my) { st.club = S.my; st.wait = 0; }
  if (tenure(S) < 1) return null;  // the 2nd season at this club at the earliest
  const pool = (LEGENDS[S.my] || []).filter(l => !st.used.includes(l.id));
  if (!pool.length) return null;
  const titles = se ? (se.verdict === 'champion' ? 1 : 0) + ['ec', 'lc'].filter(k => se.cups && se.cups[k] && se.cups[k].champ === S.my).length : 0;
  let chance = REBORN.base + (se && (se.verdict === 'met' || se.verdict === 'champion') ? REBORN.met : 0) + titles * REBORN.title;
  if (st.wait >= REBORN.pity) chance = 1;
  if (R() >= chance) { st.wait++; return null; }
  st.wait = 0;
  return makeReborn(S, wpick(pool, l => l === pool[0] ? 2 : 1));
}
function makeReborn(S, L) {
  const pos = DP_CAT[L.pp] || 'MF';
  const p = genPlayer(S, S.my, { age: 16, foreign: !!L.nat, pos, pp: L.pp, ovr: ri(REBORN.ovr[0], REBORN.ovr[1]), pot: L.pot, cap: L.pot, sty: L.sty });
  const parts = L.name.split(' ');
  p.name = L.name; p.short = L.nat ? parts[parts.length - 1] : parts[0]; p.nat = L.nat || 'JPN';
  initAttrs(p);
  p.reborn = L.id;
  S.reborn.used.push(L.id);
  if (L.num && !squad(S, S.my).some(q => q.id !== p.id && q.num === L.num)) p.num = L.num;
  S.reborn.show = p.id;  // the pop-up is still to be seen
  track(S, p);
  news(S, `転生――「${L.epi}」の魂を継ぐ${L.name}（16歳・${L.pp}）がユースからトップ昇格。${L.num ? `伝説の背番号${L.num}を知る人は、その姿に息をのんだ。` : ''}`, 'big');
  return p;
}
// hand him the legend's number (the player wearing it takes his)
function rebornNum(S, pid) {
  const p = S.players[pid]; const L = p && legendOf(p.reborn);
  if (!p || !L || !L.num || p.club !== S.my || p.num === L.num) return { ok: false, msg: '背番号を変えられません' };
  const q = squad(S, S.my).find(x => x.id !== p.id && x.num === L.num);
  if (q) q.num = p.num;
  p.num = L.num;
  news(S, `${p.name}に背番号${L.num}を託した。${q ? `（${q.name}は${q.num}番へ）` : ''}`, 'info');
  return { ok: true, msg: `${p.name}が背番号${L.num}を背負う` };
}
/* ---------- loans (期限付き移籍): a young player goes to a J2 club until the end of the season ----------
   He belongs to the loan club meanwhile (p.club = loan club, p.loan = {from, to, since, share, ovr0, pot0}), so he is off my
   squad, lineups, wages and registration. He grows as if he got p.loan.share of the minutes there (shareFor) and comes back in
   rollover with his J2 record. Only in a transfer window, only 23 or under, at most LOAN.max at once. */
const LOAN = { maxAge: 23, max: 6 };
// ユースの逸材: chance per season (mine: base + lv × ユースLv → Lv1 11% … Lv5 31%; other clubs 4%), potential GEM.pot
// + 0〜4 + lv × 0.6 (Lv2 80〜84, Lv5 82〜86), a rare one (RARE.gem) beyond 90
const GEM = { base: 0.06, lv: 0.05, ai: 0.04, pot: 79 };
/* academy graduates (18) are rated against the club's own level from the data (c.base: the academy's standing), not
   against the current squad — that fed back season after season (a strong squad → stronger graduates → a stronger
   squad) until my club ran away with the league. pot = base + pot + lv × lvP + 0〜spread (+ 0〜tailAdd now and then),
   capped at 90 unless a rare talent (RARE.youth). Other clubs count as Lv2. */
const INTAKE = { ovr: -13, lvO: 0.8, pot: -3, lvP: 1.2, spread: 7, tail: 0.1, tailAdd: 6, ref: 69, pull: 0.5 };
// the academy's standing: the club's level from the data, pulled halfway to the league's usual level (ref)
function clubBase(S, cid) { const c = S.clubs[cid]; const b = c.base || (63 + (c.tier || 2)); return INTAKE.ref + (b - INTAKE.ref) * INTAKE.pull; }
// a rare talent's ceiling (91〜95) and where his potential starts (just below it)
function rareRoll(p) { if (R() >= p) return null; const cap = ri(RARE.cap[0], RARE.cap[1]); return { cap, pot: ri(Math.max(86, cap - 5), cap) }; }
function intakePot(S, cid, lv) {
  const r = rareRoll(RARE.youth); if (r) return r;
  return { pot: Math.min(GROW.potMax, Math.round(clubBase(S, cid) + INTAKE.pot + lv * INTAKE.lvP + R() * INTAKE.spread + (R() < INTAKE.tail ? R() * INTAKE.tailAdd : 0))) };
}
function gemPot(lv) {
  const r = rareRoll(RARE.gem); if (r) return r;
  return { pot: Math.min(GROW.potMax, Math.round(GEM.pot + ri(0, 4) + lv * 0.6)) };
}
function myLoans(S) { return Object.values(S.players).filter(p => p.loan && p.loan.from === S.my); }
function loanClubs(S) { return Object.keys(S.clubs).filter(cid => !S.order.includes(cid) && J2.some(j => j.id === cid)); }
function loanShare(S, p, cid) { const lv = strength(S, cid); return clamp(0.62 + (p.ovr - (lv - 7)) * 0.06, 0.2, 0.95); }
function loanCan(S, p) {
  if (!p || p.club !== S.my) return { ok: false, msg: '自クラブの選手ではありません' };
  if (age(p, S.date) > LOAN.maxAge) return { ok: false, msg: `期限付き移籍に出せるのは${LOAN.maxAge}歳以下の選手です` };
  if (p.retire) return { ok: false, msg: '引退が決まっている選手です' };
  if (!inWindow(S.date)) return { ok: false, msg: `移籍期間外です（次は${jdate(nextWindowStart(S.date))}から）` };
  if (myLoans(S).length >= LOAN.max) return { ok: false, msg: `期限付き移籍に出せるのは同時に${LOAN.max}人までです` };
  return { ok: true };
}
// three J2 clubs to choose from: how much he would play there
function loanOptions(S, pid) {
  const p = S.players[pid]; if (!p) return [];
  const all = loanClubs(S).map(cid => ({ cid, share: loanShare(S, p, cid) })).sort((a, b) => b.share - a.share);
  if (all.length <= 3) return all;
  const pickAt = f => all[Math.min(all.length - 1, Math.round(f * (all.length - 1)))];
  const out = []; for (const f of [0, 0.5, 1]) { const o = pickAt(f); if (!out.includes(o)) out.push(o); }
  return out;
}
function loanOut(S, pid, cid) {
  const p = S.players[pid]; const can = loanCan(S, p); if (!can.ok) return can;
  if (!loanClubs(S).includes(cid)) return { ok: false, msg: '貸し出し先が見つかりません' };
  const from = S.clubs[S.my];
  from.tac.xi = from.tac.xi.map(x => x === p.id ? null : x); from.tac.bench = from.tac.bench.filter(x => x !== p.id);
  p.loan = { from: S.my, to: cid, since: S.date, share: Math.round(loanShare(S, p, cid) * 100) / 100, ovr0: Math.round(p.ovr * 10) / 10, pot0: Math.round(p.pot * 10) / 10 };
  p.club = cid; p.listed = false;
  unshort(S, p.id);
  news(S, `${p.name}が${S.clubs[cid].name}（J2）へ期限付き移籍（シーズン終了まで）。`, 'transfer');
  return { ok: true, msg: `${p.name}を${S.clubs[cid].short}へ期限付き移籍に出しました` };
}
// at the end of the season: his record at the loan club (the J2 season is not simulated match by match)
function loanSeason(S, p) {
  const L = p.loan, wks = Math.max(1, (Date.parse(S.date) - Date.parse(L.since)) / (7 * 864e5)), part = clamp(wks / 44, 0.2, 1);
  const apps = Math.round(42 * part * clamp(L.share + (R() - 0.5) * 0.15, 0.05, 1));
  const gpa = { FW: 0.32, MF: 0.1, DF: 0.03, GK: 0 }[p.pos] * Math.pow(p.ovr / 66, 3);
  let g = 0; for (let i = 0; i < apps; i++) if (R() < gpa) g++;
  const a = Math.round(apps * ({ FW: 0.08, MF: 0.12, DF: 0.05, GK: 0 }[p.pos]) * (0.6 + R() * 0.8));
  p.st = Object.assign(blankStats(), { apps, g, a, mins: Math.round(apps * 80), rt: Math.round(apps * (6.2 + (p.ovr - 62) * 0.04) * 100) / 100 });
}
function loanReturn(S, p) {
  const L = p.loan, club = S.clubs[L.to];
  const used = new Set(squad(S, L.from).map(x => x.num)); if (used.has(p.num)) { let n = 13; while (used.has(n)) n++; p.num = n; }
  p.club = L.from; delete p.loan;
  if (L.from === S.my) news(S, `${p.name}がレンタル先の${club ? club.short : 'J2'}から復帰（${p.hist[0] && p.hist[0].apps != null ? `J2で${p.hist[0].apps}試合${p.hist[0].g}得点・` : ''}能力 ${Math.round(L.ovr0)}→${Math.round(p.ovr)}）。`, 'grow');
}

/* shortlist: the players I bid on, newest bid first. Signing a player (moveP) takes him off; so does retiring. */
function noteBid(S, p, fee, res, guide) {
  S.shortlist = S.shortlist || [];
  let e = S.shortlist.find(x => x.pid === p.id);
  if (!e) { e = { pid: p.id, since: S.date, n: 0 }; S.shortlist.push(e); }
  e.last = S.date; e.n++; e.fee = fee; e.res = res; e.club = p.club;
  if (guide) e.guide = guide; else delete e.guide;
}
function unshort(S, pid) { if (S.shortlist) S.shortlist = S.shortlist.filter(x => x.pid !== pid); }
function shortlist(S) {
  S.shortlist = (S.shortlist || []).filter(x => { const p = S.players[x.pid]; return p && p.club !== S.my && (S.clubs[p.club] || p.club === 'FA'); });
  return S.shortlist.slice().sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : b.n - a.n));
}
function shortEntry(S, pid) { return (S.shortlist || []).find(x => x.pid === pid) || null; }
// can I bid on him again right now? (player refusals last until the end of that window)
function bidBlock(S, pid) {
  const b = (S._bids || {})[pid];
  if (b && b.refused && b.until >= S.date) return { why: 'player', until: b.until };
  if (b && b.date === S.date) return { why: 'today' };
  return null;
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
  const pot = Math.max(ov, Math.min(o.cap || GROW.potMax, o.pot != null ? o.pot : ov + (a <= 19 ? ri(6, 16) : a <= 22 ? ri(3, 9) : ri(0, 3))));
  const used = new Set(squad(S, cid).map(x => x.num));
  let num = o.num || ri(2, 49); while (used.has(num)) num++;
  const parts = name.split(' ');
  const p = { id: S.nextPid++, club: cid, pos, pp: o.pp || (pos === 'GK' ? 'GK' : genPP(pos)), num, name, short: foreign ? parts[1] : parts[0], birth, nat: foreign ? 'BRA' : 'JPN', ovr: ov, pot, cond: 100, form: 6.5, inj: 0, sus: 0, ycAcc: 0, listed: false, st: blankStats(), hist: [], joined: S.date, gen: true };
  if (o.sty && STYLE[o.sty]) p.sty = o.sty;
  if (o.cap && o.cap > GROW.potMax) p.cap = o.cap;
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
  S.my = cid; S.fired = null; S.board = 55; S.boardWarn = 0;
  S.inbox = S.inbox.filter(x => x.done);
  for (const p of Object.values(S.players)) { if (p.club === from) { p.listed = false; delete p.keep; } if (p.club === from || (p.loan && p.loan.from === from)) delete p.trk; if (p.club === cid) track(S, p); }
  autoLineup(S, cid);
  if (S.clubs[from]) autoLineup(S, from);
  setExpectations(S);
  news(S, `${S.clubs[cid].name}の新監督に就任。目標は「${S.clubs[cid].target.jp}」。`, 'big');
}

/* ---------- special matches: derbies, six-pointers, revenge, cup ties ---------- */
// In a big game one player may catch fire for that match only (more often for the underdog).
// how often players catch fire and by how much. k: chance per unit of big-game weight (times the underdog factor), cap: its
// ceiling; maxN/more/decay: after the first, each extra player catches fire with more*under*decay^(i-1); upTag: weight added
// when the opponent is 4+ stronger (格上挑戦); floor: weight every match has at least; former: chance per former-club
// player; boost: ovr added for that match; team: attack lift for the side while a hot player is on (midfield 0.6x). Pattern D「お祭り」with a +10 boost (was k .25 cap .75, one player, +12).
const HYPE = { k: 0.45, cap: 0.9, maxN: 3, more: 0.5, decay: 0.6, upTag: 0.6, floor: 0.3, former: 0.3, boost: 10, team: 1.5 };
// named fixtures (as the clubs / J.League / media bill them), then same prefecture, then same region, then two Original 10 clubs
const RIVALRY = [
  ['kawasakif', 'fctokyo', '多摩川クラシコ'], ['tokyov', 'machida', '東京クラシック'], ['yokohamafm', 'tokyov', 'Jリーグ開幕カード', 0.8],
  ['gosaka', 'cosaka', '大阪ダービー'], ['yokohamafm', 'yokohamafc', '横浜ダービー'], ['urawa', 'omiya', 'さいたまダービー'],
  ['chiba', 'kashiwa', '千葉ダービー'], ['kashima', 'mito', '茨城ダービー'], ['shimizu', 'iwata', '静岡ダービー'], ['sendai', 'yamagata', 'みちのくダービー'],
];
const REGION = { fukuoka: '九州', nagasaki: '九州', tosu: '九州', oita: '九州', gosaka: '関西', cosaka: '関西', kobe: '関西', kyoto: '関西', nagoya: '東海', shimizu: '東海', iwata: '東海' };
function rivalryInfo(S, a, b) {
  for (const [x, y, n, w] of RIVALRY) if ((a === x && b === y) || (a === y && b === x)) return { name: n, w: w || 1 };
  const A = S.clubs[a], B = S.clubs[b];
  if (A && B && A.area && A.area === B.area) return { name: A.area + 'ダービー', w: 1 };
  if (REGION[a] && REGION[a] === REGION[b]) return { name: REGION[a] + 'ダービー', w: 0.8 };
  if (A && B && A.o10 && B.o10) return { name: 'オリジナル10対決', w: 0.5 };
  return null;
}
function rivalry(S, a, b) { const r = rivalryInfo(S, a, b); return r ? r.name : null; }
function bigGame(p) { return !!p.reborn || hash(p.name + '|' + p.birth) % 9 === 0; } // 大舞台に強い（1割ほど）
function formerClubs(p) {
  const s = new Set((p.hist || []).map(h => h.c).filter(c => c && c !== p.club));
  if (p.prev && p.prev !== p.club) s.add(p.prev);
  return s;
}
function lastMeeting(S, a, b) {
  return S.fixtures.filter(f => f.played && ((f.h === a && f.a === b) || (f.h === b && f.a === a))).sort((x, y) => y.date.localeCompare(x.date))[0];
}
function matchStory(S, f) {
  const tags = [];
  const riv = rivalryInfo(S, f.h, f.a); if (riv) tags.push({ k: 'derby', jp: riv.name, w: riv.w });
  if (f.cup) {
    const last = CUPS[f.cup].rounds.length - 1;
    tags.push({ k: 'cup', jp: fxLabel(f), w: f.cr === last ? 1.2 : f.cr === last - 1 ? 0.8 : 0.4 });
  } else if (f.r >= 10) {
    const t = table(S); const n = t.length;
    const ph = t.findIndex(r => r.id === f.h) + 1, pa = t.findIndex(r => r.id === f.a) + 1;
    if (ph && pa && Math.abs(ph - pa) <= 3) {
      if (Math.max(ph, pa) <= 5) tags.push({ k: 'top', jp: '上位対決', w: 0.8 });
      else if (Math.min(ph, pa) > n - 6) tags.push({ k: 'low', jp: '残留争いの直接対決', w: 0.8 });
    }
  }
  return tags;
}
// decided once per fixture on its morning; hot players get p.hot for that day
function hypeMatch(S, f) {
  if (f.hype) return f.hype;
  const tags = matchStory(S, f);
  const hy = { tags: tags.map(t => t.jp), hot: [] };
  const W0 = tags.reduce((a, t) => a + t.w, 0);
  for (const [cid, opp] of [[f.h, f.a], [f.a, f.h]]) {
    if (!S.clubs[cid] || !S.clubs[opp]) continue;
    const gap = power(S, opp) - power(S, cid);
    const under = clamp(1 + gap / 6, 0.4, 2.2);
    const lm = lastMeeting(S, cid, opp);
    const lost = !!lm && (lm.h === cid ? lm.ag - lm.hg : lm.hg - lm.ag) >= 3;
    if (lost) hy.rev = (hy.rev || []).concat(cid);
    const up = HYPE.upTag && gap >= 4;
    const W = Math.max(HYPE.floor, W0 + (lost ? 0.8 : 0) + (f.cup && gap >= 3 ? 0.6 : 0) + (up ? HYPE.upTag : 0));
    const pool = squad(S, cid).filter(p => available(p) && !p.retire);
    const picked = new Set();
    for (const p of pool) if (formerClubs(p).has(opp) && R() < HYPE.former * under) picked.add(p);
    if (W > 0 && R() < clamp(HYPE.k * W * under, 0, HYPE.cap)) {
      const top = pool.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 18);
      const wt = q => (bigGame(q) ? 4 : 1) * (q.pos === 'FW' ? 1.6 : q.pos === 'MF' ? 1.3 : q.pos === 'GK' ? 0.5 : 1) * Math.pow(q.ovr / 70, 2);
      for (let i = 0; i < HYPE.maxN; i++) {
        if (i > 0 && !(R() < clamp(HYPE.more * under * Math.pow(HYPE.decay, i - 1), 0, 0.9))) break;
        const left = top.filter(q => !picked.has(q));
        const p = left.length ? wpick(left, wt) : null;
        if (p) picked.add(p);
      }
    }
    for (const p of picked) {
      const why = formerClubs(p).has(opp) ? '古巣対決' : lost ? 'リベンジに燃える' : tags.length ? tags[0].jp : up ? '格上相手に燃える' : W0 > 0 ? '大一番' : '気合十分';
      p.hot = { d: f.date, b: HYPE.boost, why };
      hy.hot.push({ pid: p.id, side: cid === f.h ? 'h' : 'a', why });
    }
  }
  f.hype = hy;
  return hy;
}
// the side's mood for this match (AI clubs): sit deep against a much stronger side, go for it against a weak one
function aiMentality(S, cid, opp) {
  const gap = power(S, opp) - power(S, cid);
  if (gap >= 3) { const x = R(); return x < 0.5 ? { ment: 'def', ctr: true } : x < 0.75 ? { ment: 'def', ctr: false } : { ment: 'bal', ctr: true }; }
  if (gap <= -4) return { ment: R() < 0.2 ? 'att' : 'bal', ctr: false };
  return { ment: 'bal', ctr: gap >= 1.5 && R() < 0.3 };
}

/* ---------- cups: 天皇杯 and Lカップ (single matches, PK if level after 90 minutes) ---------- */
const CUPS = {
  ec: { jp: '天皇杯', en: "EMPEROR'S CUP", rounds: ['2回戦', '3回戦', '準々決勝', '準決勝', '決勝'], enr: ['R2', 'R3', 'QF', 'SF', 'FINAL'] },
  lc: { jp: 'Lカップ', en: 'L CUP', rounds: ['1回戦', 'ラウンド16', '準々決勝', '準決勝', '決勝'], enr: ['R1', 'R16', 'QF', 'SF', 'FINAL'] },
};
const CUP_PRIZE = { win: 15000, final: 5000, sf: 2000, qf: 1000 }; // 万円
const NATIONAL = { stadium: '国立競技場', cap: 67750 };
function fxLabel(f) { return f.cup ? `${CUPS[f.cup].jp} ${CUPS[f.cup].rounds[f.cr]}` : `第${f.r}節`; }
function nthDow(y, m, n, dow) { // n-th weekday of a month (n = -1: the last one)
  if (n > 0) { let d = `${y}-${String(m).padStart(2, '0')}-01`; while (D.dow(d) !== dow) d = D.add(d, 1); return D.add(d, 7 * (n - 1)); }
  let d = D.add(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
  while (D.dow(d) !== dow) d = D.add(d, -1);
  return d;
}
function cupDefaultDates(sy, key) {
  if (key === 'ec') return [nthDow(sy, 9, 3, 3), nthDow(sy, 10, 2, 3), nthDow(sy, 11, 3, 3), nthDow(sy, 12, 4, 3), `${sy + 1}-01-01`];
  return [nthDow(sy, 9, 1, 3), nthDow(sy, 9, -1, 3), nthDow(sy, 10, -1, 3), nthDow(sy, 11, -1, 3), nthDow(sy + 1, 1, 2, 6)];
}
// round dates for this season: the usual midweeks, pushed later if they have already passed (a save started mid-season)
function cupSchedule(S) {
  const busy = new Set(S.fixtures.filter(f => !f.cup).map(f => f.date));
  const taken = new Set(); const out = {};
  for (const key of ['lc', 'ec']) {
    const want = cupDefaultDates(S.season, key); const dates = [];
    let prev = D.add(S.date, 2);
    for (const w of want) {
      let d = w > prev ? w : null;
      if (!d) { d = D.add(prev, 5); while (D.dow(d) !== 3) d = D.add(d, 1); }
      while (busy.has(d) || taken.has(d)) d = D.add(d, 7);
      dates.push(d); taken.add(d); prev = D.add(d, 6);
    }
    out[key] = dates;
  }
  return out;
}
function genSquad(S, cid, base, plan) {
  const used = new Set(squad(S, cid).map(p => p.num)); let n = 1;
  for (const [pos, k] of plan) for (let i = 0; i < k; i++) {
    while (used.has(n)) n++;
    const a = ri(19, 33);
    genPlayer(S, cid, { pos, age: a, ovr: Math.round(base + (i < 2 ? 3 : i < 5 ? 1 : -2) + R() * 4 - 2 - (a < 21 ? 5 : 0)), num: n, foreign: i === 0 && pos !== 'GK' && R() < 0.6 });
    used.add(n);
  }
}
const PLAN_FULL = [['GK', 3], ['DF', 9], ['MF', 10], ['FW', 6]];
const PLAN_CUP = [['GK', 2], ['DF', 7], ['MF', 8], ['FW', 5]];
// clubs from below J1 that enter the 天皇杯 (J2 clubs; relegated clubs keep their players)
function cupGuests(S, n) {
  const ids = J2.map(c => c.id).filter(id => !S.order.includes(id));
  for (const id of Object.keys(S.clubs)) if (!S.order.includes(id) && !ids.includes(id)) ids.push(id);
  const pr = id => (S.clubs[id] ? S.clubs[id].pres : (J2.find(c => c.id === id) || {}).pres) || 1.5;
  const key = Object.fromEntries(ids.map(id => [id, pr(id) + R() * 1.2]));
  const pickd = ids.sort((a, b) => key[b] - key[a]).slice(0, n);
  for (const id of pickd) {
    if (!S.clubs[id]) { const c = J2.find(x => x.id === id); addClub(S, { ...c, coach: '' }, true); }
    if (squad(S, id).length < 18) genSquad(S, id, 62 + (S.clubs[id].tier || 2), PLAN_CUP);
    autoLineup(S, id);
  }
  return pickd;
}
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function setupCups(S) {
  const dates = cupSchedule(S);
  S.nextFid = Math.max(S.nextFid || 0, ...S.fixtures.map(f => f.id)) + 1;
  const guests = cupGuests(S, 12);
  S.cups = {
    season: S.season,
    ec: { r: 0, dates: dates.ec, alive: S.order.concat(guests), guests, out: {}, champ: null, runner: null },
    lc: { r: 0, dates: dates.lc, alive: [...S.order], out: {}, champ: null, runner: null },
  };
  drawCupRound(S, 'ec'); drawCupRound(S, 'lc');
}
function drawCupRound(S, key) {
  const cu = S.cups[key]; const r = cu.r; const last = CUPS[key].rounds.length - 1;
  let pairs = [], rest = [];
  const pairUp = arr => { const out = []; for (let i = 0; i + 1 < arr.length; i += 2) out.push([arr[i], arr[i + 1]]); if (arr.length % 2) rest.push(arr[arr.length - 1]); return out; };
  if (key === 'lc' && r === 0 && cu.alive.length > 16) {
    // the 8 weakest J1 clubs play a first round; the rest come in at the last 16
    const ranked = cu.alive.slice().sort((a, b) => power(S, b) - power(S, a));
    const k = (cu.alive.length - 16) * 2;
    cu.bye = ranked.slice(0, ranked.length - k);
    pairs = pairUp(shuffle(ranked.slice(ranked.length - k)));
  } else if (key === 'ec' && r === 0) {
    // clubs from below are drawn against J1 sides first
    const g = shuffle(cu.alive.filter(c => !S.order.includes(c))), j = shuffle(cu.alive.filter(c => S.order.includes(c)));
    while (g.length && j.length) pairs.push([g.pop(), j.pop()]);
    pairs = pairs.concat(pairUp(g.concat(j)));
  } else pairs = pairUp(shuffle(cu.alive));
  cu.carry = rest;
  const final = r === last;
  for (const [x, y] of pairs) {
    const [h, a] = power(S, x) <= power(S, y) ? [x, y] : [y, x]; // the smaller club hosts; the final is at 国立
    S.fixtures.push({ id: S.nextFid++, cup: key, cr: r, date: cu.dates[r], h, a, hg: null, ag: null, played: false, neutral: final || undefined });
    if (h === S.my || a === S.my) {
      const opp = h === S.my ? a : h;
      news(S, `${CUPS[key].jp} ${CUPS[key].rounds[r]}の相手は${S.clubs[opp].name}（${jdate(cu.dates[r], true)}・${final ? '国立' : h === S.my ? 'ホーム' : 'アウェイ'}）。`, 'info');
    }
  }
}
function cupWinner(f) { return f.hg > f.ag ? f.h : f.hg < f.ag ? f.a : f.pk ? (f.pk[0] > f.pk[1] ? f.h : f.a) : f.h; }
// after a round is complete: pay out, then draw the next round (or crown the winner)
function progressCups(S) {
  if (!S.cups) return;
  for (const key of ['lc', 'ec']) {
    const cu = S.cups[key]; if (!cu || cu.champ) continue;
    const cur = S.fixtures.filter(f => f.cup === key && f.cr === cu.r);
    if (!cur.length || !cur.every(f => f.played)) continue;
    const last = CUPS[key].rounds.length - 1; const name = CUPS[key].jp;
    const win = [];
    for (const f of cur) {
      const w = cupWinner(f), l = w === f.h ? f.a : f.h;
      win.push(w); cu.out[l] = cu.r;
      const pz = cu.r === last ? CUP_PRIZE.final : cu.r === last - 1 ? CUP_PRIZE.sf : cu.r === last - 2 ? CUP_PRIZE.qf : 0;
      if (pz && S.clubs[l]) { S.clubs[l].funds += pz; S.clubs[l].fin.prize += pz; }
      if (l === S.my && cu.r < last) news(S, `${name}は${CUPS[key].rounds[cu.r]}で敗退。${pz ? `賞金 ${money(pz)}。` : ''}`, 'loss');
    }
    if (cu.r === last) {
      const champ = win[0]; const f = cur[0];
      cu.champ = champ; cu.runner = f.h === champ ? f.a : f.h;
      const c = S.clubs[champ];
      c.funds += CUP_PRIZE.win; c.fin.prize += CUP_PRIZE.win;
      c.titles = Object.assign({ j1: 0, lc: 0, ec: 0, acl: 0 }, c.titles || {}); c.titles[key]++;
      c.pres = clamp(Math.round(((c.pres || 2) + 0.12) * 100) / 100, 1, 5);
      if (champ === S.my) { S.board = clamp(S.board + 12, 0, 100); news(S, `${name}優勝！ ${S.clubs[cu.runner].short}を破ってタイトルを獲得。賞金 ${money(CUP_PRIZE.win)}。`, 'big'); }
      else news(S, `${name}は${c.name}が優勝（決勝で${S.clubs[cu.runner].short}を下す）。`, cu.runner === S.my ? 'loss' : 'info');
      continue;
    }
    cu.alive = win.concat(key === 'lc' && cu.r === 0 ? cu.bye || [] : []).concat(cu.carry || []);
    cu.r++;
    drawCupRound(S, key);
  }
}
function cupsDone(S) { return !S.cups || ['ec', 'lc'].every(k => !S.cups[k] || S.cups[k].champ); }
// how far a club got: 'champ' | 'runner' | round index it went out in | null (still in / not entered)
function cupResult(S, key, cid) {
  const cu = S.cups && S.cups[key]; if (!cu) return null;
  if (cu.champ === cid) return '優勝';
  if (cu.runner === cid) return '準優勝';
  if (cu.out[cid] != null) return CUPS[key].rounds[cu.out[cid]] + '敗退';
  if (cu.alive.includes(cid) || (cu.bye || []).includes(cid)) return '勝ち残り';
  return '不参加';
}
// PK shootout: best finishers first, the keeper's saving matters
function shootout(S, M) {
  const kickers = k => onPitch(M[k]).filter(s => s.role !== 'GK').map(s => S.players[s.pid]).sort((a, b) => (b.at ? b.at[0] + b.at[7] : b.ovr * 2) - (a.at ? a.at[0] + a.at[7] : a.ovr * 2));
  const keeper = k => { const g = onPitch(M[k]).find(s => s.role === 'GK'); return g ? S.players[g.pid] : null; };
  const tk = { h: kickers('h'), a: kickers('a') }, gk = { h: keeper('h'), a: keeper('a') };
  const sc = { h: 0, a: 0 }, n = { h: 0, a: 0 };
  const kick = k => {
    const o = k === 'h' ? 'a' : 'h'; const list = tk[k]; const p = list.length ? list[n[k] % list.length] : null; n[k]++;
    const sk = p ? (p.at ? p.at[0] * 0.6 + p.at[7] * 0.4 : p.ovr) : 50;
    const g = gk[o] ? (gk[o].at ? gk[o].at[8] : gk[o].ovr) : 40;
    if (R() < clamp(0.75 + (sk - 65) * 0.004 - (g - 65) * 0.004 + (p && p.hot ? 0.05 : 0), 0.55, 0.92)) sc[k]++;
  };
  for (let i = 0; i < 5; i++) for (const k of ['h', 'a']) {
    kick(k);
    if (sc.h > sc.a + (5 - n.a) || sc.a > sc.h + (5 - n.h)) { i = 5; break; }
  }
  while (sc.h === sc.a && n.h < 30) { kick('h'); kick('a'); }
  M.pk = [sc.h, sc.a];
}

/* ---------- scouting: send a scout, get young prospects to sign as free agents ---------- */
const SCOUT = {
  dom: { jp: '国内の高校・大学', sub: '17〜21歳。時間はかかるが伸びしろ十分', cost: 300, days: 14, age: [17, 21], ovr: [50, 58], pot: [70, 80] },
  low: { jp: 'J2・J3', sub: '20〜24歳。すぐ戦力になりやすい', cost: 600, days: 14, age: [20, 24], ovr: [60, 66], pot: [68, 76] },
  sa: { jp: '南米', sub: '18〜22歳。当たれば大物', cost: 1500, days: 21, age: [18, 22], ovr: [56, 64], pot: [72, 84], foreign: true },
};
function sendScout(S, key) {
  const sc = SCOUT[key]; const c = S.clubs[S.my];
  if (!sc) return { ok: false, msg: '派遣先が不明です' };
  if (S.scout) return { ok: false, msg: 'スカウトはまだ戻っていません' };
  if (c.funds < sc.cost) return { ok: false, msg: '資金が足りません' };
  c.funds -= sc.cost; c.fin.fac += sc.cost;
  S.scout = { key, back: D.add(S.date, sc.days) };
  news(S, `スカウトを${sc.jp}へ派遣（${money(sc.cost)}）。${jdate(S.scout.back)}ごろ戻る予定。`, 'info');
  return { ok: true, msg: `スカウトを${sc.jp}へ派遣しました` };
}
function scoutReturns(S) {
  if (!S.scout || S.date < S.scout.back) return;
  const sc = SCOUT[S.scout.key]; const lv = (S.clubs[S.my].fac.scout || 1);
  const pids = [];
  for (let i = 0; i < 3; i++) {
    const a = ri(sc.age[0], sc.age[1]);
    const ovr = ri(sc.ovr[0], sc.ovr[1]) + (lv >= 4 ? 1 : 0);
    const pot = Math.min(90, ri(sc.pot[0], sc.pot[1]) + (lv - 1) * 2);
    const pos = wpick(['GK', 'DF', 'MF', 'FW'], x => ({ GK: 0.5, DF: 3, MF: 3.5, FW: 3 })[x]);
    const p = genPlayer(S, 'FA', { age: a, ovr, pot, pos, foreign: !!sc.foreign });
    p.found = { by: S.my, d: S.date, at: S.scout.key };
    pids.push(p.id);
  }
  S.inbox.unshift({ id: S.nextInboxId++, type: 'scout', pids, at: S.scout.key, d: S.date, exp: D.add(S.date, 30), seen: false, done: false });
  news(S, `スカウトが${sc.jp}から戻った。有望な若手を${pids.length}人リストアップ。`, 'grow');
  S.scout = null;
}
// players the scout found and nobody signed go elsewhere when the report expires
function scoutExpire(S, it) {
  if (it.type !== 'scout') return;
  for (const id of it.pids) { const p = S.players[id]; if (p && p.club === 'FA') delete S.players[id]; }
}
// games a club has played this season (league + cups), for playing-time growth
let _cgKey = null, _cg = null;
function clubGames(S, cid) {
  const key = S.date + '|' + S.season;
  if (_cgKey !== key) { _cg = {}; for (const f of S.fixtures) if (f.played) { _cg[f.h] = (_cg[f.h] || 0) + 1; _cg[f.a] = (_cg[f.a] || 0) + 1; } _cgKey = key; }
  return _cg[cid] || 0;
}
// share of the club's minutes this season (0..1)
// growth uses this: a loaned player's share is what he gets at the loan club (p.loan.share)
function shareFor(S, p) { return p._share != null ? p._share : p.loan ? p.loan.share : playShare(S, p); }  // _share: what-if (growthOutlook)
function playShare(S, p) { const gp = clubGames(S, p.club); return gp < 3 ? null : clamp(p.st.mins / (90 * gp), 0, 1); }

/* ---------- season end & rollover ---------- */
const PRIZE = [30000, 12000, 6000, 3000, 2000, 1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0, 0, 0]; // 万円
/* フロントの信頼 (board), three levels of patience (S.settings.boardLv, ふつう when unset):
   match   — after every league match: (points − what the squad should get) × match (cups half)
   met/near/perPos/missMax — at the end of the season by the target: met +met, within nearBand +near, further off −perPos a place
             (at most missMax; perPos 0 = a flat −missMax)
   keep    — a new season starts from 55 + (board − 55) × keep (the slate is partly wiped)
   fireEnd/grace — fired at the end of the season below fireEnd, except in the first `grace` seasons at a club (relegation always)
   fireMid/fireAfter/zone — fired mid-season at fireMid or below after fireAfter league games, if in the bottom `zone`
             places of the table
   warn    — a warning in the news (and a stop) when it falls to these */
const BOARD_LV = {
  easy: { jp: 'やさしい', sub: '目標に届かなくても続けやすい。解任はほぼJ2降格のときだけ。', match: 1.4, met: 20, near: 0, nearBand: 3, perPos: 3, missMax: 12, keep: 0.5, fireEnd: 5, grace: 1, fireMid: 5, fireAfter: 19, zone: 3, warn: [25, 12] },
  mid: { jp: 'ふつう', sub: '就任1年目は猶予あり。目標を大きく下回るシーズンが続くか、降格圏で信頼が尽きると解任。', match: 1.6, met: 20, near: 0, nearBand: 3, perPos: 4, missMax: 16, keep: 0.6, fireEnd: 10, grace: 1, fireMid: 8, fireAfter: 15, zone: 4, warn: [30, 16] },
  hard: { jp: 'きびしい', sub: '1試合ごとの評価が大きく、目標未達ならすぐ解任もある（以前のルール）。', match: 3.2, met: 20, near: -5, nearBand: 3, perPos: 0, missMax: 25, keep: 1, fireEnd: 15, grace: 0, fireMid: 8, fireAfter: 10, zone: 99, warn: [30, 16] },
};
const BOARD = BOARD_LV.mid;  // overridable in tests (hard = the rules before 2026-10-12)
function boardLv(S) { const k = S.settings && S.settings.boardLv; return k && BOARD_LV[k] ? BOARD_LV[k] : BOARD; }
// seasons in a row at this club (the season just finished included)
function tenure(S) { let n = 0; for (const h of S.history) { if (h.club !== S.my) break; n++; } return n; }
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
  const B = boardLv(S);
  if (rel.includes(S.my)) verdict = 'relegated';
  else if (myPos <= target.pos) verdict = myPos === 1 ? 'champion' : 'met';
  else if (myPos <= target.pos + B.nearBand) verdict = 'near';
  else verdict = 'missed';
  if (verdict === 'champion' || verdict === 'met') S.board = clamp(S.board + B.met, 0, 100);
  else if (verdict === 'near') S.board = clamp(S.board + B.near, 0, 100);
  else if (verdict === 'missed') S.board = clamp(S.board - (B.perPos ? Math.min(B.missMax, B.perPos * (myPos - target.pos)) : B.missMax), 0, 100);
  const cups = S.cups ? Object.fromEntries(['ec', 'lc'].filter(k => S.cups[k]).map(k => [k, { champ: S.cups[k].champ, runner: S.cups[k].runner, my: cupResult(S, k, S.my) }])) : null;
  S.seasonEnd = { label: seasonLabel(S.season), champ, myPos, rel, scorers, verdict, prize: PRIZE[myPos - 1] || 0, pts: t[myPos - 1].pts, target: target.jp, cups };
  S.history.unshift({ season: seasonLabel(S.season), club: S.my, pos: myPos, pts: t[myPos - 1].pts, champ, verdict, ec: cups && cups.ec ? cups.ec.my : null, lc: cups && cups.lc ? cups.lc.my : null });
  decideRetirements(S);
  news(S, `${seasonLabel(S.season)}シーズン終了。優勝は${S.clubs[champ].name}。${S.clubs[S.my].short}は${myPos}位。`, 'big');
}
// Retirements are settled when the season ends, so the manager can see his own players off before the next season.
// Each of my retiring players gets a card (what he did for the club) for the farewell pop-up.
function retireCard(S, p) {
  const rows = (p.hist || []).filter(h => h.c === p.club).concat([{ s: seasonLabel(S.season), ovr: Math.round(p.ovr), ...p.st }]);
  const sum = k => rows.reduce((t, r) => t + (r[k] || 0), 0);
  return {
    id: p.id, name: p.name, short: p.short, num: p.num, pp: ppOf(p), pos: p.pos, nat: p.nat, club: p.club,
    age: age(p, (S.season + 1) + '-06-08'), seasons: rows.length, apps: sum('apps'), g: sum('g'), a: sum('a'),
    peak: Math.max(...rows.map(r => r.ovr || 0), Math.round(p.ovr), Math.round(p.ovr0 || 0)),
    best: rows.reduce((b, r) => (r.apps || 0) && (!b || (r.g || 0) > b.g || ((r.g || 0) === b.g && (r.apps || 0) > b.apps)) ? { s: r.s, apps: r.apps || 0, g: r.g || 0 } : b, null),
    rows: rows.map(r => ({ s: r.s, apps: r.apps || 0, g: r.g || 0, a: r.a || 0 })),
  };
}
function decideRetirements(S) {
  const se = S.seasonEnd; if (!se || se.retDone) return se ? se.ret || [] : [];
  const newDate = (S.season + 1) + '-06-08';
  const mine = [];
  for (const p of Object.values(S.players)) {
    if (!S.clubs[p.club] && p.club !== 'FA') continue;
    const a = age(p, newDate);
    if (a >= 35) {
      const pr = 0.3 + (a - 35) * 0.17 + (p.ovr < 64 ? 0.2 : 0);
      if (R() < pr) { p.retire = true; p.listed = false; if (p.club === S.my) mine.push(p); }
    }
  }
  se.ret = mine.sort((a, b) => b.ovr - a.ovr).map(p => retireCard(S, p));
  se.retDone = true;
  S.inbox = S.inbox.filter(x => !(x.type === 'offer' && !x.done && S.players[x.pid] && S.players[x.pid].retire));
  return se.ret;
}
function rollover(S) {
  const se = S.seasonEnd; if (!se) return;
  const myRelegated = se.rel.includes(S.my);
  const B = boardLv(S);
  const fireMe = myRelegated || (S.board < B.fireEnd && tenure(S) > B.grace);
  const newDate = (S.season + 1) + '-06-08';
  // retirements (decided at the end of the season)
  decideRetirements(S);
  for (const p of Object.values(S.players)) if (p.retire) { if (p.club === S.my) news(S, `${p.name}が現役引退。お疲れさまでした。`, 'info'); p.club = 'RET'; }
  // players out on loan: their season at the loan club goes into the record, then they come back
  const back = Object.values(S.players).filter(p => p.loan);
  for (const p of back) loanSeason(S, p);
  // season stats archive
  for (const p of Object.values(S.players)) {
    if (p.st.apps || p.club === S.my) p.hist.unshift({ s: seasonLabel(S.season), c: p.club, ovr: Math.round(p.ovr), ...p.st });
    if (p.at) { p.at0 = p.at.slice(); p.ovr0 = p.ovr; p.pot0 = p.pot; }
    if (p.hist.length > 8) p.hist.length = 8;
    p.st = blankStats(); p.ycAcc = 0; p.sus = 0; delete p.cs; delete p.hot;
  }
  for (const p of back) if (S.players[p.id] && p.loan) loanReturn(S, p);
  // relegation / promotion
  const promoted = [];
  const pool = J2.filter(c => !S.clubs[c.id] || !S.order.includes(c.id));
  // relegated clubs drop out of the league but keep their players (they play in J2 and can come back or enter the 天皇杯)
  for (const rid of se.rel) S.order = S.order.filter(c => c !== rid);
  while (promoted.length < se.rel.length && pool.length) {
    const c = pool.splice(Math.floor(R() * pool.length), 1)[0];
    promoted.push(c.id);
    if (!S.clubs[c.id]) addClub(S, { ...c, coach: '' });
    else if (!S.order.includes(c.id)) S.order.push(c.id);
    const have = squad(S, c.id).length;
    if (have < 26) genSquad(S, c.id, 64 + (S.clubs[c.id].tier || 2), have ? [['GK', Math.max(0, 3 - squad(S, c.id).filter(p => p.pos === 'GK').length)], ['DF', 3], ['MF', 3], ['FW', 2]] : PLAN_FULL);
  }
  // youth intake
  for (const cid of S.order) {
    const c = S.clubs[cid];
    const k = cid === S.my ? 2 + Math.floor(c.fac.youth / 2) : 2;
    const base = clubBase(S, cid), lv = cid === S.my ? c.fac.youth : 2;
    for (let i = 0; i < k; i++) {
      const pt = intakePot(S, cid, lv);
      const pr = genPlayer(S, cid, { age: 18, foreign: false, ovr: Math.round(base + INTAKE.ovr + lv * INTAKE.lvO) + ri(-2, 2), pot: pt.pot, cap: pt.cap });
      if (cid === S.my) { news(S, `ユースから${pr.name}（${pr.pos}）がトップ昇格。`, 'grow'); track(S, pr); }
    }
    // ユースの逸材: now and then a 16-17-year-old with a huge ceiling (a better academy finds them more often)
    const gemP = cid === S.my ? GEM.base + GEM.lv * c.fac.youth : GEM.ai;
    if (R() < gemP) {
      const pt = gemPot(lv);
      const pr = genPlayer(S, cid, { age: 16, foreign: false, pos: wpick(['DF', 'MF', 'FW'], x => ({ DF: 2.6, MF: 3.4, FW: 2.6 })[x]), ovr: base - 10 + Math.round(lv / 2) + ri(-2, 2), pot: pt.pot, cap: pt.cap, sty: pick(['tech', 'tech', 'speed', 'phys', '']) });
      pr.gem = true;
      if (cid === S.my) { news(S, `ユースの逸材、${pr.name}（${age(pr, S.date)}歳・${pr.pos}）がトップ昇格。早くから注目されてきた才能だ。`, 'big'); track(S, pr); }
    }
  }
  // 転生: a legend of my club may come back
  if (!fireMe) rebornCheck(S, se);
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
  for (const cid of S.order) if (cid !== S.my) autoLineup(S, cid);
  setupCups(S);
  validateLineup(S, S.my); // the manager's XI stays as he left it (players who left are taken out)
  setSponsors(S);
  setExpectations(S);
  if (promoted.length) news(S, `J2から${promoted.map(c => S.clubs[c].short).join('・')}が昇格。`, 'info');
  news(S, `${seasonLabel(S.season)}シーズンへ。開幕は${jdate(S.fixtures[0].date)}。`, 'big');
  if (!fireMe) { S.board = clamp(Math.round(55 + (S.board - 55) * B.keep), 0, 100); S.boardWarn = 0; }
  if (fireMe) fire(S, myRelegated ? 'J2降格の責任' : '目標未達');
  else news(S, `新シーズンの目標は「${S.clubs[S.my].target.jp}」。`, 'board');
}

/* ---------- export ---------- */
const API = {
  D, jdate, FORMATIONS, ROLE, DPOS, DP_CAT, DP_JP, LEARN_MAX, PLAY_MAX, ppOf, apt, roleApt, posValues, learnRate, learnWeeks, MENTALITY, PRESS, TRAINING, FACILITY, ATTR, ATTR_SHOW, FOCUS, INTENS,
  calcOvr, roleScore, bestRoles, devPreview, migrate, weekly, power, presStars, presLabel,
  newGame, seasonForDate, seasonLabel, squad, strength, table, position, age, ovr, value, wage, money, attrs,
  autoLineup, autoBench, benchSwap, benchRemove, lineupIssues, BENCH_SIZE, PRESET_MAX, savePreset, loadPreset, presetStatus, renamePreset, deletePreset, clubRating, validateLineup, effective, posPenalty, available, teamRating,
  createMatch, stepMatch, simulateFull, finishMatch, doSub, benchOptions, onPitch, setMentality, bestSubFor, setCounter, mentLabel,
  advance, nextDay, simAIToday, myFixtureToday, nextMyFixture, todaysFixtures, inWindow, windowEnd, nextWindowStart,
  acceptOffer, rejectOffer, setListed, setKeep, transferDay, bid, decideRetirements, shortlist, shortEntry, unshort, bidBlock,
  BOARD, BOARD_LV, boardLv, tenure, CUPS, CUP_PRIZE, NATIONAL, fxLabel, cupResult, cupWinner, hypeMatch, HYPE, SUB_RATE, subRate, STYLE, GROW, RARE, INTAKE, potCap, clubBase, devWeek, shareFor, LOAN, GEM, REBORN, LEGENDS, legendOf, rebornCheck, makeReborn, rebornNum, myLoans, loanCan, loanOptions, loanOut, growthOutlook, weeksLeft, yearsTo, bigGame, rivalry, SCOUT, sendScout, playShare, marketList, ensureFreeAgents, upgrade, facCost, takeJob, rollover, endSeason, news, fire,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
