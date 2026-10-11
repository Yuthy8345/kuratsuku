/* クラつく — 2D match view. Visual only: the result comes from Engine.stepMatch;
   this layer plays it out with every player moving on his own. */
(function (root) {
'use strict';
const PW = 105, PH = 68, CX = 52.5, CY = 34, POST = 3.66;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const SHOTS = { goal: 1, save: 1, miss: 1 };

function create(S, M, hooks) {
  const V = {
    S, M, hooks: hooks || {}, t: 0, players: [], byPid: {},
    ball: { x: CX, y: CY, z: 0, vx: 0, vy: 0, owner: null, fl: null },
    poss: 'h', hint: 0.5, shot: null, freeze: 0, decideT: 0.8, celebrate: null, banner: null, lateral: 0,
  };
  syncRoster(V, true);
  kickoff(V, 'h', true);
  return {
    V,
    step: dt => step(V, dt),
    draw: (ctx, w, h, col) => draw(V, ctx, w, h, col),
    sync: () => syncRoster(V, false),
    hint: p => { V.hint = p; },
    shoot: e => startShot(V, e),
    busy: () => !!V.shot || !!V.celebrate,
    instant: e => instant(V, e),
    restart: side => kickoff(V, side, true),
    foul: e => foul(V, e),
  };
}

/* ---------- geometry ---------- */
const dirOf = side => side === 'h' ? 1 : -1;
const frameX = (side, x) => side === 'h' ? x : PW - x;          // distance from own goal line
const fromFrame = (side, along, across) => side === 'h' ? { x: along, y: across } : { x: PW - along, y: PH - across };
const goalX = side => side === 'h' ? PW : 0;                     // goal this side attacks
const other = side => side === 'h' ? 'a' : 'h';

/* ---------- roster ---------- */
function syncRoster(V, init) {
  const { S, M } = V;
  const seen = new Set();
  for (const side of ['h', 'a']) {
    const sd = M[side];
    sd.slots.forEach((s, i) => {
      const key = side + i;
      if (!s.pid || sd.sent.includes(s.pid)) return;
      seen.add(key);
      let p = V.players.find(q => q.key === key);
      const pl = S.players[s.pid];
      const spd = pl && pl.at ? pl.at[4] : 65;
      const along = s.role === 'GK' ? 3 : PW * (0.11 + (s.y - 15) / 85 * 0.6);
      const across = s.x / 100 * PH;
      if (!p) {
        const pos = fromFrame(side, along, across);
        p = { key, side, slot: i, role: s.role, gk: s.role === 'GK', bA: along, bY: across, x: pos.x, y: pos.y, vx: 0, vy: 0, tx: pos.x, ty: pos.y,
              run: { a: 0, y: 0, t: 0 }, seed: Math.random() };
        V.players.push(p);
      }
      p.pid = s.pid; p.role = s.role; p.gk = s.role === 'GK';
      p.num = pl ? pl.num : ''; p.name = pl ? pl.short : '';
      const cond = sd.cond[s.pid] != null ? sd.cond[s.pid] : 100;
      p.vmax = (5.6 + spd / 100 * 3.6) * (0.78 + cond / 100 * 0.22);
    });
  }
  // players who left the pitch (red card / injury without a sub)
  V.players = V.players.filter(p => seen.has(p.key));
  if (V.ball.owner && !V.players.includes(V.ball.owner)) V.ball.owner = null;
  V.byPid = {}; for (const p of V.players) V.byPid[p.pid] = p;
  void init;
}

/* ---------- set pieces ---------- */
function kickoff(V, side, teleport) {
  const b = V.ball;
  for (const p of V.players) {
    // everyone in his own half, compact
    const along = p.gk ? 3 : clamp(p.bA * 0.72, 8, 49);
    const pos = fromFrame(p.side, along, p.bY);
    if (teleport) { p.x = pos.x; p.y = pos.y; p.vx = p.vy = 0; }
    p.tx = pos.x; p.ty = pos.y;
  }
  const team = V.players.filter(p => p.side === side && !p.gk);
  const st = team.slice().sort((a, b2) => b2.bA - a.bA)[0];
  b.x = CX; b.y = CY; b.z = 0; b.fl = null;
  if (st) { st.x = CX - dirOf(side) * 0.8; st.y = CY; b.owner = st; }
  V.poss = side; V.freeze = 0.9; V.decideT = 0.3; V.kickoffPass = true;
}
function foul(V, e) {
  // a whistle: play stops for a moment and the other side takes a free kick
  const b = V.ball;
  const victimSide = other(e.side);
  const taker = nearest(V.players.filter(p => p.side === victimSide && !p.gk), b);
  if (!taker) return;
  b.fl = null; b.z = 0; b.owner = taker; taker.x = b.x - dirOf(victimSide) * 0.6; taker.y = b.y;
  V.poss = victimSide; V.freeze = 0.8; V.decideT = 0.4;
}

/* ---------- helpers ---------- */
function nearest(list, pt, exclude) {
  let best = null, bd = 1e9;
  for (const p of list) { if (p === exclude) continue; const d = hyp(p.x - pt.x, p.y - pt.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function teamOf(V, side, withGk) { return V.players.filter(p => p.side === side && (withGk || !p.gk)); }
function gkOf(V, side) { return V.players.find(p => p.side === side && p.gk); }
function openness(V, p) { const o = nearest(teamOf(V, other(p.side), true), p); return o ? hyp(o.x - p.x, o.y - p.y) : 20; }

/* ---------- targets ---------- */
function shapeTarget(V, p, inPoss) {
  const b = V.ball; const bxf = frameX(p.side, b.x); const byf = p.side === 'h' ? b.y : PH - b.y;
  const ment = V.M[p.side].ment; const ms = (ment === 'att' ? 5 : ment === 'def' ? -5 : 0) + (V.M[p.side].ctr ? -3 : 0);
  let along, across;
  if (inPoss) {
    along = p.bA + 9 + (bxf - CX) * 0.42 + ms;
    across = CY + (p.bY - CY) * 1.12 + (byf - CY) * 0.14;
  } else {
    along = p.bA - 5 + (bxf - CX) * 0.5 + ms * 0.6;
    across = CY + (p.bY - CY) * 0.74 + (byf - CY) * 0.32;
  }
  along = clamp(along, 7, 97); across = clamp(across, 2.5, PH - 2.5);
  return fromFrame(p.side, along, across);
}
function updateTargets(V, dt) {
  const b = V.ball; const att = V.poss; const def = other(att);
  const carrier = b.owner;
  const ballPt = b.fl ? { x: b.fl.x1, y: b.fl.y1 } : b;
  // defenders: closest presses, second covers, rest hold shape and pick up runners
  const defs = teamOf(V, def, false).slice().sort((p, q) => hyp(p.x - ballPt.x, p.y - ballPt.y) - hyp(q.x - ballPt.x, q.y - ballPt.y));
  const attackers = teamOf(V, att, false);
  defs.forEach((p, i) => {
    const base = shapeTarget(V, p, false);
    if (i === 0) { p.tx = ballPt.x; p.ty = ballPt.y; p.sprint = true; }
    else if (i === 1) {
      const gx = goalX(att) === PW ? PW : 0;
      p.tx = ballPt.x + (gx - ballPt.x) * 0.18; p.ty = ballPt.y + (CY - ballPt.y) * 0.25; p.sprint = true;
    } else {
      const m = nearest(attackers, base);
      if (m && hyp(m.x - base.x, m.y - base.y) < 14) {
        const gx = goalX(att);
        p.tx = base.x * 0.5 + (m.x + (gx - m.x) * 0.06) * 0.5; p.ty = base.y * 0.5 + m.y * 0.5;
      } else { p.tx = base.x; p.ty = base.y; }
      p.sprint = false;
    }
  });
  // attackers off the ball: hold width, make runs, one man comes short to help
  const helper = carrier ? nearest(attackers.filter(p => p !== carrier), carrier) : null;
  for (const p of attackers) {
    if (p === carrier) continue;
    if (b.fl && b.fl.to === p) { p.tx = b.fl.x1; p.ty = b.fl.y1; p.sprint = true; continue; }
    if (V.shot && V.shot.p === p && !V.shot.fired) { // the shooter attacks the box
      const s = fromFrame(att, V.shot.boxA, V.shot.boxY); p.tx = s.x; p.ty = s.y; p.sprint = true; continue;
    }
    p.run.t -= dt;
    if (p.run.t <= 0) {
      const fwd = p.role === 'ST' || p.role === 'SS' || p.role === 'LW' || p.role === 'RW' || p.role === 'AM' || p.role === 'LAM' || p.role === 'RAM' || p.role === 'WAM';
      const mid = p.role === 'CM' || p.role === 'DM' || p.role === 'LM' || p.role === 'RM' || p.role === 'WB';
      p.run = { a: fwd ? rnd(-2, 12) : mid ? rnd(-4, 7) : rnd(-3, 3), y: fwd ? rnd(-7, 7) : rnd(-4, 4), t: rnd(1.2, 3.2) };
    }
    const base = shapeTarget(V, p, true);
    const d = dirOf(att);
    let tx = base.x + d * p.run.a, ty = base.y + p.run.y;
    if (p === helper && carrier) { // offer a short option
      const ang = Math.atan2(p.y - carrier.y, p.x - carrier.x);
      tx = carrier.x + Math.cos(ang) * 11; ty = carrier.y + Math.sin(ang) * 11;
    }
    p.tx = clamp(tx, 1, PW - 1); p.ty = clamp(ty, 1, PH - 1); p.sprint = p.run.a > 6;
  }
  // goalkeepers
  for (const side of ['h', 'a']) {
    const g = gkOf(V, side); if (!g || g === carrier) continue;
    if (V.shot && V.shot.fired && V.shot.gkSide === side) { g.tx = V.shot.saveX; g.ty = V.shot.saveY; g.sprint = true; g.dive = true; continue; }
    const gx = side === 'h' ? 0 : PW; const dist = Math.abs(ballPt.x - gx);
    g.tx = gx + dirOf(side) * (dist < 30 ? 2.2 : 4.5); g.ty = CY + (ballPt.y - CY) * (dist < 30 ? 0.32 : 0.18); g.sprint = false; g.dive = false;
  }
}

/* ---------- carrier decisions ---------- */
function decide(V) {
  const b = V.ball; const c = b.owner; if (!c) return;
  const side = c.side, opp = other(side);
  const along = frameX(side, c.x);
  // kickoff: tap it back
  if (V.kickoffPass) { V.kickoffPass = false; const mate = teamOf(V, side).filter(p => p !== c).sort((p, q) => hyp(p.x - c.x, p.y - c.y) - hyp(q.x - c.x, q.y - c.y))[0]; if (mate) pass(V, c, mate); return; }
  // a scripted chance for this side
  if (V.shot && !V.shot.fired) {
    if (V.shot.side !== side) { loseBall(V, c, true); return; }
    const sh = V.shot.p;
    if (c === sh) {
      if (along > 74 || V.shot.waited > 3.2) { fireShot(V); return; }
      V.decideT = 0.25; return;   // keep driving at goal
    }
    if (c.gk) { const t = teamOf(V, side).sort((p, q) => openness(V, q) - openness(V, p))[0]; if (t) pass(V, c, t); return; }
    if (frameX(side, sh.x) > along - 4 || V.shot.waited > 1.6) { pass(V, c, sh, true); return; }
    V.decideT = 0.3; return;
  }
  if (V.shot && V.shot.fired) return;
  // possession share from the engine decides how often the ball is lost
  const share = side === 'h' ? V.hint : 1 - V.hint;
  if (!c.gk && Math.random() < 0.04 + 0.17 * (1 - share)) { loseBall(V, c, false); return; }
  // pass or carry
  const mates = teamOf(V, side, false).filter(p => p !== c);
  if (c.gk) { const t = mates.sort((p, q) => openness(V, q) - openness(V, p))[0]; if (t) pass(V, c, t); return; }
  if (Math.random() < 0.62 && mates.length) {
    const d = dirOf(side);
    const scored = mates.map(m => {
      const dist = hyp(m.x - c.x, m.y - c.y);
      const fwd = (m.x - c.x) * d;
      return { m, w: Math.max(0.05, 1 + fwd / 14 + openness(V, m) / 8 - Math.max(0, dist - 22) / 10 - (frameX(side, m.x) > 97 ? 2 : 0)) };
    });
    let tot = scored.reduce((a, s) => a + s.w, 0), r = Math.random() * tot, pick = scored[0].m;
    for (const s of scored) { r -= s.w; if (r <= 0) { pick = s.m; break; } }
    pass(V, c, pick);
  } else {
    V.lateral = rnd(-6, 6); V.decideT = rnd(0.6, 1.3);
  }
}
function pass(V, from, to, through) {
  const b = V.ball;
  const d = hyp(to.x - from.x, to.y - from.y);
  const lofted = d > 26 && Math.random() < 0.7;
  const speed = lofted ? 22 : 17;
  const dur = clamp(d / speed, 0.25, 2.2);
  let x1 = to.x + to.vx * dur * 0.8, y1 = to.y + to.vy * dur * 0.8;
  if (through) { x1 += dirOf(to.side) * 4; }
  x1 = clamp(x1, 1, PW - 1); y1 = clamp(y1, 1, PH - 1);
  b.owner = null;
  b.fl = { x0: b.x, y0: b.y, x1, y1, t: 0, dur, peak: lofted ? clamp(d / 9, 2, 6) : 0.15, to, kind: 'pass' };
  V.decideT = 0.5;
}
function loseBall(V, c, forced) {
  const opp = other(c.side);
  const presser = nearest(teamOf(V, opp, false), c);
  if (!presser) return;
  const d = hyp(presser.x - c.x, presser.y - c.y);
  if (d < 5 || forced && d < 9) { // tackle
    V.ball.owner = presser; V.poss = opp; V.freeze = 0.25; V.decideT = rnd(0.4, 0.9);
    presser.x += (c.x - presser.x) * 0.6; presser.y += (c.y - presser.y) * 0.6;
  } else { // misplaced pass picked off
    const mate = nearest(teamOf(V, c.side, false), presser, c) || presser;
    pass(V, c, mate);
    V.ball.fl.to = presser; V.ball.fl.x1 = presser.x + (mate.x - presser.x) * 0.25; V.ball.fl.y1 = presser.y + (mate.y - presser.y) * 0.25; V.ball.fl.dur *= 0.7;
  }
}

/* ---------- shots ---------- */
function startShot(V, e) {
  const side = e.side; const p = V.byPid[e.pid] || nearest(teamOf(V, side, false), { x: goalX(side), y: CY });
  if (!p) { if (V.hooks.resolved) V.hooks.resolved(e); if (V.hooks.done) V.hooks.done(e); return; }
  V.shot = { e, side, p, fired: false, waited: 0, boxA: rnd(80, 92), boxY: CY + rnd(-12, 12), gkSide: other(side), saveX: 0, saveY: CY, life: 0 };
  // give the move a start: if the other team has it, win it back quickly
  if (V.ball.owner && V.ball.owner.side !== side) V.decideT = Math.min(V.decideT, 0.3);
  if (!V.ball.owner && !V.ball.fl) { V.ball.owner = nearest(teamOf(V, side, false), V.ball); V.poss = side; }
}
function fireShot(V) {
  const sh = V.shot, b = V.ball, p = sh.p, e = sh.e;
  const gx = goalX(sh.side), d = dirOf(sh.side);
  let x1, y1, peak, dur;
  const dist = hyp(gx - p.x, CY - p.y);
  dur = clamp(dist / 27, 0.35, 1.2);
  if (e.t === 'goal') { x1 = gx + d * 1.4; y1 = CY + rnd(-POST + 0.5, POST - 0.5); peak = rnd(0.4, 2.2); }
  else if (e.t === 'save') { x1 = gx - d * rnd(0.6, 1.6); y1 = CY + rnd(-POST + 0.6, POST - 0.6); peak = rnd(0.4, 1.8); sh.saveX = x1; sh.saveY = y1; }
  else { const over = Math.random() < 0.35; x1 = gx + d * 3; y1 = over ? CY + rnd(-POST, POST) : CY + (Math.random() < 0.5 ? -1 : 1) * rnd(POST + 1, POST + 7); peak = over ? rnd(3.5, 5) : rnd(0.5, 2); }
  b.owner = null;
  b.fl = { x0: b.x, y0: b.y, x1, y1, t: 0, dur, peak, to: null, kind: 'shot' };
  sh.fired = true;
}
function shotLanded(V) {
  const sh = V.shot, e = sh.e, b = V.ball, H = V.hooks;
  if (H.resolved) H.resolved(e);
  if (e.t === 'goal') {
    b.vx = dirOf(sh.side) * 2; b.vy = 0; b.owner = null; b.fl = null;
    V.celebrate = { side: sh.side, p: sh.p, t: 0, e };
    V.banner = { text: 'GOAL', t: 0, side: sh.side };
    V.shot = null;
  } else if (e.t === 'save') {
    const g = gkOf(V, sh.gkSide);
    b.fl = null; b.owner = g || null; V.poss = sh.gkSide; V.freeze = 0.7; V.decideT = 0.8;
    if (g) { g.x = b.x; g.y = b.y; }
    V.shot = null; if (H.done) H.done(e);
  } else {
    // out for a goal kick
    const g = gkOf(V, sh.gkSide);
    V.shot = null;
    b.fl = null; b.vx = b.vy = 0;
    V.goalKick = { side: sh.gkSide, t: 0.9, g };
    if (H.done) H.done(e);
  }
}
function instant(V, e) {
  // ×4 speed: no build-up, just reset after a goal
  if (e.t === 'goal') kickoff(V, other(e.side), true);
  else if (e.t === 'save' || e.t === 'miss') { const g = gkOf(V, other(e.side)); if (g) { V.ball.fl = null; V.ball.owner = g; V.poss = g.side; V.ball.x = g.x; V.ball.y = g.y; } }
}

/* ---------- simulation step ---------- */
function step(V, dt) {
  V.t += dt;
  const b = V.ball;
  if (V.banner) { V.banner.t += dt; if (V.banner.t > 2.2) V.banner = null; }
  // goal celebration, then restart
  if (V.celebrate) {
    const c = V.celebrate; c.t += dt;
    for (const p of V.players) {
      if (p.side === c.side && !p.gk) { p.tx = c.p.x + Math.sin(p.seed * 9) * 3; p.ty = c.p.y + Math.cos(p.seed * 9) * 3; p.sprint = true; }
      else { p.tx = p.x; p.ty = p.y; p.sprint = false; }
    }
    moveAll(V, dt);
    b.x += b.vx * dt; b.vx *= 0.9;
    if (c.t > 1.7) { V.celebrate = null; kickoff(V, other(c.side), true); if (V.hooks.done) V.hooks.done(c.e); }
    return;
  }
  if (V.goalKick) {
    const gk = V.goalKick; gk.t -= dt;
    if (gk.t <= 0) {
      const g = gk.g || gkOf(V, gk.side);
      const spot = fromFrame(gk.side, 5.5, CY + rnd(-8, 8));
      b.x = spot.x; b.y = spot.y; b.z = 0; V.goalKick = null;
      if (g) { g.x = spot.x - dirOf(gk.side) * 0.8; g.y = spot.y; b.owner = g; V.poss = gk.side; V.decideT = 0.6; V.freeze = 0.4; }
    }
  }
  if (V.freeze > 0) { V.freeze -= dt; }
  updateTargets(V, dt);
  if (V.shot && !V.shot.fired) {
    V.shot.waited += (b.owner && b.owner.side === V.shot.side) ? dt : 0; V.shot.life += dt;
    if (V.shot.life > 7) { // fail-safe: never stall the match
      if (!b.owner || b.owner.side !== V.shot.side) { b.fl = null; b.owner = V.shot.p; V.poss = V.shot.side; }
      if (b.owner !== V.shot.p) pass(V, b.owner, V.shot.p, true); else fireShot(V);
    }
  }
  // carrier
  const c = b.owner;
  if (c && V.freeze <= 0) {
    const d = dirOf(c.side);
    const opp = nearest(teamOf(V, other(c.side), true), c);
    let tx = c.x + d * 9, ty = c.y + V.lateral * 0.5 + (CY - c.y) * 0.08;
    if (opp && hyp(opp.x - c.x, opp.y - c.y) < 6) ty += (c.y > opp.y ? 1 : -1) * 4;   // shimmy past the presser
    if (V.shot && V.shot.p === c && !V.shot.fired) { const s = fromFrame(c.side, V.shot.boxA, V.shot.boxY); tx = s.x; ty = s.y; }
    c.tx = clamp(tx, 2, PW - 2); c.ty = clamp(ty, 2, PH - 2); c.sprint = !!(V.shot && V.shot.p === c);
    V.decideT -= dt;
    if (V.decideT <= 0) { V.decideT = rnd(0.7, 1.4); decide(V); }
  } else if (c) { c.tx = c.x; c.ty = c.y; }
  moveAll(V, dt);
  // ball
  if (b.fl) {
    const f = b.fl; f.t += dt; const u = Math.min(1, f.t / f.dur);
    b.x = f.x0 + (f.x1 - f.x0) * u; b.y = f.y0 + (f.y1 - f.y0) * u; b.z = 4 * f.peak * u * (1 - u);
    if (f.kind === 'pass' && f.to && u > 0.55 && hyp(f.to.x - b.x, f.to.y - b.y) < 1.4) { b.fl = null; b.owner = f.to; }
    if (b.fl && u >= 1) {
      if (f.kind === 'shot') { b.fl = null; shotLanded(V); }
      else { b.fl = null; const r = f.to && hyp(f.to.x - b.x, f.to.y - b.y) < 4 ? f.to : nearest(V.players, b); b.owner = r; }
      if (b.owner) { V.poss = b.owner.side; V.decideT = Math.min(V.decideT, rnd(0.4, 1.0)); }
    }
  } else if (b.owner) {
    const o = b.owner; const sp = hyp(o.vx, o.vy) || 1;
    b.x = o.x + (o.vx / sp) * 0.8 * (sp > 0.3 ? 1 : 0) + (sp <= 0.3 ? dirOf(o.side) * 0.7 : 0);
    b.y = o.y + (o.vy / sp) * 0.8 * (sp > 0.3 ? 1 : 0); b.z = 0;
    V.poss = o.side;
  } else if (!V.goalKick) {
    // loose ball: the closest player of each side goes for it
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.96; b.vy *= 0.96;
    const n = nearest(V.players.filter(p => !p.gk), b);
    if (n) { n.tx = b.x; n.ty = b.y; n.sprint = true; if (hyp(n.x - b.x, n.y - b.y) < 1.2) { b.owner = n; V.poss = n.side; V.decideT = 0.6; } }
  }
}
function moveAll(V, dt) {
  for (const p of V.players) {
    const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
    const vmax = p.vmax * (p.dive ? 1.5 : p.sprint ? 1 : 0.62);
    const want = Math.min(vmax, d * 1.8);
    const wx = d > 0.01 ? dx / d * want : 0, wy = d > 0.01 ? dy / d * want : 0;
    const acc = 9 * dt;
    p.vx += clamp(wx - p.vx, -acc, acc); p.vy += clamp(wy - p.vy, -acc, acc);
    p.x = clamp(p.x + p.vx * dt, -1, PW + 1); p.y = clamp(p.y + p.vy * dt, -1, PH + 1);
  }
  // keep players from stacking on top of each other
  const ps = V.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], c = ps[j]; const dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
    if (d > 0.01 && d < 1.3) { const k = (1.3 - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
  }
}

/* ---------- drawing ---------- */
function draw(V, ctx, W, H, col) {
  const pad = H * 0.06; const ph = H - pad * 2; const pw = ph * PW / PH;
  const ox = (W - pw) / 2, oy = pad;
  const X = x => ox + x / PW * pw, Y = y => oy + y / PH * ph, L = m => m / PW * pw;
  // grass
  ctx.fillStyle = col.g2; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? col.g1 : col.g2; ctx.fillRect(X(i * PW / 14), oy - pad, pw / 14 + 1, ph + pad * 2); }
  // lines
  ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1, W / 420);
  ctx.strokeRect(X(0), Y(0), pw, ph);
  ctx.beginPath(); ctx.moveTo(X(CX), Y(0)); ctx.lineTo(X(CX), Y(PH)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(CX), Y(CY), L(9.15), 0, Math.PI * 2); ctx.stroke();
  for (const s of [0, 1]) {
    const gx = s ? PW : 0, dd = s ? -1 : 1;
    ctx.strokeRect(Math.min(X(gx), X(gx + dd * 16.5)), Y(CY - 20.16), L(16.5), Y(CY + 20.16) - Y(CY - 20.16));
    ctx.strokeRect(Math.min(X(gx), X(gx + dd * 5.5)), Y(CY - 9.16), L(5.5), Y(CY + 9.16) - Y(CY - 9.16));
    ctx.beginPath(); ctx.arc(X(gx + dd * 11), Y(CY), L(9.15), s ? Math.PI * 0.705 : -Math.PI * 0.295, s ? Math.PI * 1.295 : Math.PI * 0.295); ctx.stroke();
    // goal
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(Math.min(X(gx), X(gx - dd * 1.8)), Y(CY - POST), L(1.8), Y(CY + POST) - Y(CY - POST));
    ctx.strokeRect(Math.min(X(gx), X(gx - dd * 1.8)), Y(CY - POST), L(1.8), Y(CY + POST) - Y(CY - POST));
  }
  // players
  const r = Math.max(4, ph * 0.026);
  const b = V.ball;
  for (const p of V.players) {
    ctx.beginPath(); ctx.ellipse(X(p.x), Y(p.y) + r * 0.75, r * 0.95, r * 0.4, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
  }
  const hot = (V.M && V.M.hot) || {};
  for (const p of V.players) {
    const k = p.side === 'h' ? col.home : col.away;
    if (p.pid && hot[p.pid]) { // a player on fire glows
      const g = ctx.createRadialGradient(X(p.x), Y(p.y), r * 0.6, X(p.x), Y(p.y), r * 2.3);
      g.addColorStop(0, 'rgba(255,170,40,.75)'); g.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r * 2.3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2);
    ctx.fillStyle = p.gk ? k.gk : k.c1; ctx.fill();
    ctx.lineWidth = Math.max(1.2, r * 0.28); ctx.strokeStyle = p.gk ? '#111' : k.c2; ctx.stroke();
    if (r >= 7) { ctx.fillStyle = p.gk ? '#111' : k.txt; ctx.font = `700 ${Math.round(r * 0.95)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.num), X(p.x), Y(p.y) + 0.5); }
  }
  // carrier highlight + name
  const o = b.owner || (b.fl && b.fl.to);
  if (b.owner) { ctx.beginPath(); ctx.arc(X(b.owner.x), Y(b.owner.y), r * 1.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke(); }
  if (o && o.name) {
    ctx.font = `700 ${Math.round(Math.max(10, r * 1.15))}px "Zen Kaku Gothic New", system-ui, sans-serif`;
    const tw = ctx.measureText(o.name).width + r * 1.2; const lx = clamp(X(o.x), tw / 2 + 2, W - tw / 2 - 2), ly = Y(o.y) - r * 2.6;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; roundRect(ctx, lx - tw / 2, ly - r * 0.85, tw, r * 1.7, r * 0.5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.name, lx, ly + 0.5);
  }
  // ball
  ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y) + r * 0.3, r * 0.5, r * 0.22, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(X(b.x), Y(b.y) - L(b.z) * 1.2, r * (0.48 + b.z * 0.03), 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
  // GOAL banner
  if (V.banner) {
    const t = V.banner.t; const a = t < 0.2 ? t / 0.2 : t > 1.8 ? Math.max(0, (2.2 - t) / 0.4) : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H * 0.36, W, H * 0.28);
    ctx.fillStyle = col.led; ctx.font = `400 ${Math.round(H * 0.2)}px "DotGothic16", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GOAL', W / 2, H * 0.5 + 1); ctx.restore();
  }
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const API = { create, SHOTS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Match2D = API;
})(typeof window !== 'undefined' ? window : globalThis);
