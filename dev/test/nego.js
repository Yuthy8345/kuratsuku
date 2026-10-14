// 移籍交渉 (2026-10-14): the club's asking price (要求額) comes down when I offer a little less, goes up when I offer far
// too little, patience 3 a day (then today's ask is final), the player decides after the clubs agree, a negotiation
// lasts until the window ends; offers for my players: 増額を求める once (raise or walk away).
// Also measures what a player costs (× market price) by how you negotiate, against the old 4 buttons.
const E = require('../src/engine.js');
const DATA = require('../data.json');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const S0 = E.newGame(DATA, 'yokohamafm', 'テスト', '2026-08-07');
S0.clubs[S0.my].funds = 1e8;
const fresh = () => { const S = clone(S0); return S; };
const nextDay = S => { S.date = new Date(Date.parse(S.date) + 864e5).toISOString().slice(0, 10); };
// a top-6 player of a J1 club who is happy to come (so the player's own decision never gets in the way)
const willing = S => E.marketList(S, { where: 'j' }).filter(p => S.order.includes(p.club) && E.squad(S, p.club).length > 22 && E.negoWill(S, p).r === 0 && E.negoInfo(S, p).role === '主力');

/* ---------- opening ---------- */
{
  const S = fresh(); const p = willing(S)[0];
  ok(!!p, `a willing top player: ${p && p.name}（${p && S.clubs[p.club].short}）`);
  const info = E.negoInfo(S, p), pr = E.price(S, p);
  const r = E.negoStart(S, p.id); const n = r.n;
  ok(r.ok && n.pat === 3 && !n.fin && n.log.length === 0, 'negotiation opens with patience 3');
  const floor = pr * info.k * n.nz;
  ok(n.ask >= floor * 1.07 && n.ask <= floor * 1.25, `opening ask ${E.money(n.ask)} = bottom line × ${(n.ask / floor).toFixed(2)} (1.08〜1.24)`);
  ok(info.role === '主力' && info.k >= 1.0 && info.k <= 1.35, `role and multiplier: ${info.role} ×${info.k.toFixed(2)} [${info.tags.map(t => t.t).join('・')}]`);
  ok(E.negoStart(S, p.id).n === n, 'opening again continues the same negotiation');
  ok(!E.shortEntry(S, p.id), 'opening alone does not put him on the shortlist');

  // a little below the bottom line: the club comes part of the way, never below the floor, patience −1
  const ask0 = n.ask; const x = Math.round(floor * 0.95 / 100) * 100;
  let o = E.negoOffer(S, p.id, x);
  ok(!o.ok && o.kind === 'counter' && n.pat === 2, `offer ${E.money(x)} → counter ${E.money(n.ask)} (${o.msg})`);
  ok(n.ask < ask0 && n.ask >= floor && n.ask > x, 'the new ask is between my offer and the old ask, not below the floor');
  const se = E.shortEntry(S, p.id); ok(se && se.res === 'club' && se.guide === n.ask && se.fee === x, 'shortlist: my offer and the asking price');
  // far too low: −2, the ask goes up 5% → patience gone, today's ask is final
  const a1 = n.ask; o = E.negoOffer(S, p.id, Math.round(floor * 0.5 / 100) * 100);
  ok(o.kind === 'low' && n.pat === 0 && n.fin && n.ask > a1 && n.ask <= Math.round(n.ask0 * 1.15 / 100) * 100, `lowball → ask up ${E.money(a1)} → ${E.money(n.ask)}, patience 0, final (${o.msg})`);
  o = E.negoOffer(S, p.id, n.ask - 1000);
  ok(o.kind === 'final' && n.log.length === 4, `below the final ask: refused without a new round (${o.msg})`);
  // next day: patience back, the ask stays
  const a2 = n.ask; nextDay(S); const m = E.negoOf(S, p.id);
  ok(m.pat === 3 && !m.fin && m.ask === a2, 'next day: patience 3 again, same asking price');
  // at or above the bottom line: agreed at my offer
  const fl = E.price(S, p) * E.negoInfo(S, p).k * m.nz; const y = Math.ceil(fl / 100) * 100 + 100;
  const funds = S.clubs[S.my].funds;
  o = E.negoOffer(S, p.id, y);
  ok(o.ok && p.club === S.my && S.clubs[S.my].funds === funds - y && !E.negoOf(S, p.id) && !E.shortEntry(S, p.id), `offer ${E.money(y)} ≥ bottom line → signed for that (${o.msg})`);
}

/* ---------- agree at the asking price, money, window, player refusal ---------- */
{
  const S = fresh(); const p = willing(S)[1];
  const n = E.negoStart(S, p.id).n; const ask = n.ask;
  S.clubs[S.my].funds = ask - 100;
  let o = E.negoAgree(S, p.id);
  ok(o.kind === 'funds' && n.pat === 3, `not enough money: refused, no patience used (${o.msg})`);
  S.clubs[S.my].funds = 1e8; o = E.negoAgree(S, p.id);
  ok(o.ok && p.club === S.my, `agree at the asking price ${E.money(ask)}`);
  // an offer above the ask is the ask
  const q = willing(S)[2]; const nq = E.negoStart(S, q.id).n; const f0 = S.clubs[S.my].funds;
  o = E.negoOffer(S, q.id, nq.ask * 2); ok(o.ok && S.clubs[S.my].funds === f0 - nq.ask, 'offering more than the ask pays the ask');
  // the window closes: negotiations end, none can start
  const r = willing(S)[3]; E.negoStart(S, r.id);
  while (E.inWindow(S.date)) E.nextDay(S);
  ok(!S.nego && !E.negoOf(S, r.id) && !E.negoStart(S, r.id).ok, 'window closed: negotiations gone, none can start');
  // a new manager job ends the old club's negotiations
  const T = fresh(); const t = willing(T)[0]; E.negoStart(T, t.id); E.takeJob(T, 'kashima');
  ok(!T.nego, 'taking another job ends the negotiations');
  // a thin squad will not sell
  const U = fresh(); const thinClub = U.order.find(c => c !== U.my); const sq = E.squad(U, thinClub).sort((a, b) => a.ovr - b.ovr);
  sq.slice(0, sq.length - 22).forEach(x => { x.club = 'FA'; });
  const th = E.squad(U, thinClub)[0]; const rt = E.negoStart(U, th.id);
  ok(!rt.ok && E.shortEntry(U, th.id).res === 'thin', `thin squad: ${rt.msg}`);
  // the player says no after the clubs agree → blocked for the rest of the window (an overseas star in his prime)
  let refused = 0, signed = 0, msg = '';
  for (let i = 0; i < 40; i++) {
    const V = fresh(); const kubo = Object.values(V.players).find(x => x.name === '久保 建英');
    const w = E.negoWill(V, kubo); if (i === 0) ok(w.jp === '消極的' && w.lv === 0, `久保 建英: 本人 ${w.jp} (${w.r.toFixed(2)})`);
    E.negoStart(V, kubo.id); const res = E.negoAgree(V, kubo.id);
    if (res.ok) signed++; else if (res.kind === 'player') { refused++; msg = res.msg; if (refused === 1) ok(E.bidBlock(V, kubo.id) && !E.negoStart(V, kubo.id).ok && E.shortEntry(V, kubo.id).res === 'player', 'refused: no talks until the window ends'); }
  }
  ok(refused >= 30, `久保 says no ${refused}/40 (${msg})`);
  // free agents: signed as before
  const W = fresh(); const fa = Object.values(W.players).find(x => x.club === 'FA' && !x.retire);
  ok(fa && E.bid(W, fa.id, 1).ok && fa.club === W.my, 'free agent: signed for the signing fee');
}

/* ---------- what it costs by how you negotiate (× market price), against the old buttons ---------- */
{
  const S = fresh(); S.clubs[S.my].funds = 1e9;
  const tierOf = p => { if (S.clubs[p.club].ab) return 'ab'; const r = E.squad(S, p.club).sort((a, b) => b.ovr - a.ovr).findIndex(x => x.id === p.id); return r < 6 ? 'top' : r < 14 ? 'mid' : 'low'; };
  const pool = E.marketList(S, {}).filter(p => p.club !== 'FA' && (S.clubs[p.club].ab || (S.order.includes(p.club) && E.squad(S, p.club).length > 22)));
  const strats = { now: null, ask: () => [], once: a => [a * 0.85], patient: a => [a * 0.8, 'mid', 'mid'], greedy: a => [a * 0.6, 'mid', 'mid'] };
  const old = { top: 1.35, mid: 1.12, low: 0.92 }; const B = [0.9, 1.0, 1.2, 1.5];
  const sum = {};
  const reps = Number(process.argv[2] || 6);
  for (const p of pool) {
    const t = tierOf(p), home = p.club, pr = E.price(S, p), a = E.age(p, S.date);
    const dem = t === 'ab' ? 1.1 + (p.ovr >= 80 ? 0.2 : p.ovr >= 75 ? 0.1 : 0) + (a <= 23 ? 0.1 : 0) : old[t];
    for (const [name, st] of Object.entries(strats)) for (let k = 0; k < reps; k++) {
      let paid;
      if (!st) { const th = dem * (0.94 + Math.random() * 0.08); paid = B.find(m => m >= th) || 1.5; }
      else {
        delete S.nego; delete S._bids; S.shortlist = [];
        const n = E.negoStart(S, p.id).n; let last = null;
        for (const step of st(n.ask)) {
          const cur = E.negoOf(S, p.id); if (!cur || cur.fin) break;
          last = Math.round((step === 'mid' ? (last + cur.ask) / 2 : step) / 100) * 100;
          const r = E.negoOffer(S, p.id, last); if (r.kind === 'deal' || r.kind === 'player') { paid = last / pr; break; }
        }
        if (paid == null) { const ask = E.negoOf(S, p.id).ask; E.negoAgree(S, p.id); paid = ask / pr; }
        if (p.club !== home) { S.clubs[S.my].funds += paid * pr; p.club = home; }
      }
      const key = t + '|' + name; (sum[key] = sum[key] || []).push(paid);
    }
  }
  const avg = k => { const a = sum[k]; return a.reduce((x, y) => x + y, 0) / a.length; };
  const L = { now: '今のボタン', ask: '要求額ですぐ合意', once: '1回値切る', patient: 'じっくり3回', greedy: '強気(6割から)' };
  for (const t of ['top', 'mid', 'low', 'ab']) console.log(`     ${{ top: '主力', mid: '準主力', low: '控え', ab: '海外組' }[t]}: ` + Object.keys(strats).map(s => `${L[s]} ${avg(t + '|' + s).toFixed(2)}`).join(' | '));
  for (const t of ['top', 'mid', 'ab']) ok(avg(t + '|ask') < avg(t + '|now') && avg(t + '|once') < avg(t + '|ask') && avg(t + '|patient') < avg(t + '|once') && avg(t + '|greedy') > avg(t + '|patient'),
    `${t}: agreeing at once < old buttons, haggling saves more, a lowball costs more than patience`);
  ok(avg('top|ask') <= 1.40 && avg('top|patient') >= 1.1, `top players: ${avg('top|ask').toFixed(2)} at once, ${avg('top|patient').toFixed(2)} with patience (old 1.50)`);
}

/* ---------- the sheet's first suggestion (90% of the opening ask) is usually, not always, enough ---------- */
{
  const S = fresh(); const p = willing(S)[0]; let enough = 0;
  for (let i = 0; i < 2000; i++) { delete S.nego; const n = E.negoStart(S, p.id).n; if (n.ask * 0.9 >= E.price(S, p) * E.negoInfo(S, p).k * n.nz) enough++; }
  ok(enough > 1400 && enough < 1900, `90% of the asking price is enough ${(enough / 20).toFixed(0)}% of the time`);
}

/* ---------- 増額を求める (offers for my players) ---------- */
{
  const S = fresh(); const star = E.squad(S, S.my).sort((a, b) => b.ovr - a.ovr)[0];
  const mk = (listed, extra) => { star.listed = listed; S.inbox = S.inbox.filter(x => x.type !== 'offer'); S.inbox.unshift({ id: S.nextInboxId++, type: 'offer', pid: star.id, from: S.order.find(c => c !== S.my), fee: 100000, d: S.date, exp: S.date, seen: true, done: false, ...extra }); return S.inbox[0]; };
  // offers made by the game carry top/walk
  let made = null; for (let i = 0; i < 4000 && !made; i++) { E.transferDay(S); made = S.inbox.find(x => x.type === 'offer' && x.pid === star.id); }
  const anyMade = made || S.inbox.find(x => x.type === 'offer');
  ok(anyMade && anyMade.top >= anyMade.fee * 1.07 && anyMade.top <= anyMade.fee * 1.31 && (anyMade.walk === 0.3 || anyMade.walk === 0.18), `new offers know how far the buyer would go (${E.money(anyMade.fee)} → up to ${E.money(anyMade.top)}, walks ${anyMade.walk})`);
  // raise once: either more money (up to top) or they walk
  let up = 0, walked = 0, gain = 0;
  for (let i = 0; i < 2000; i++) {
    const it = mk(false, { top: 120000, walk: 0.18 });
    const r = E.raiseOffer(S, it.id);
    if (r.ok) { up++; gain += it.fee / 100000 - 1; if (it.fee <= 100000 || it.fee > 120000 || !it.raised || it.fee0 !== 100000) { ok(false, 'raise within (fee, top]'); break; } }
    else if (r.walked) { walked++; if (!it.done || it.result !== 'withdrawn') { ok(false, 'walked away = withdrawn'); break; } }
  }
  { const it = mk(false, { top: 120000, walk: 0 }); E.raiseOffer(S, it.id); const again = E.raiseOffer(S, it.id); ok(!again.ok && !again.walked && it.raised && !it.done, `only once: ${again.msg}`); }
  ok(Math.abs(walked / 2000 - 0.18) < 0.03, `unsolicited bid: walks away ${(walked / 20).toFixed(1)}% (18%), raises ${(gain / up * 100).toFixed(1)}% on average`);
  walked = 0; for (let i = 0; i < 2000; i++) { const it = mk(true, {}); const r = E.raiseOffer(S, it.id); if (r.walked) walked++; }
  ok(Math.abs(walked / 2000 - 0.3) < 0.03, `old offer for a listed player (no top/walk saved): walks away ${(walked / 20).toFixed(1)}% (30%)`);
  const it = mk(false, { top: 130000, walk: 0 }); E.raiseOffer(S, it.id); const f = it.fee; const funds = S.clubs[S.my].funds;
  ok(E.acceptOffer(S, it.id).ok && S.clubs[S.my].funds === funds + f, `accepting after the raise pays the raised fee (${E.money(f)})`);
}
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
