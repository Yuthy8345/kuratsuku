// Uniforms (UNI in app.js, 2026-10-16): every J1/J2 club has a 1st and a 2nd kit, the colours are valid, the number reads on
// the body, no two clubs wear the same 1st, and in every pairing of the 34 clubs the two sides end up in different colours
// (the away side changes into its 2nd when the 1st kits clash). usage: node dev/test/uniform.js
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const app = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const eng = fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8');
const D = require('../data.json');
const w2 = app.match(/const W2 = '(#[0-9A-F]{6})';/i);
const m = app.match(/const UNI = (\{[\s\S]*?\n\});/);
if (!w2 || !m) throw new Error('UNI not found in app.js');
const UNI = Function('W2', 'return ' + m[1])(w2[1]);
const j1 = D.clubs.map(c => c.id);
const j2 = [...eng.matchAll(/\{ id: '(\w+)', name: '[^']*', short: '[^']*', c1:/g)].map(x => x[1]);
let bad = 0; const fail = s => { bad++; console.log('NG ' + s); };
const rgb = h => [0, 2, 4].map(i => parseInt(h.slice(1 + i, 3 + i), 16));
const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dist = (a, b) => rgb(a).reduce((s, v, i) => s + Math.abs(v - rgb(b)[i]), 0); // the clash rule in app.js (kitClash)
for (const id of [...j1, ...j2]) if (!UNI[id]) fail(`${id} has no uniform`);
const seen = {};
for (const [id, kits] of Object.entries(UNI)) {
  if (kits.length !== 2) { fail(`${id}: needs a 1st and a 2nd`); continue; }
  kits.forEach((k, i) => {
    const [pat, b, pc, t1, t2, n] = k, tag = `${id} ${i ? '2nd' : '1st'}`;
    if (!['so', 'st', 'pn'].includes(pat)) fail(`${tag}: unknown pattern ${pat}`);
    for (const c of [b, pc, t1, t2, n]) if (c != null && !/^#[0-9A-F]{6}$/i.test(c)) fail(`${tag}: bad colour ${c}`);
    if (pat !== 'so' && !pc) fail(`${tag}: ${pat} needs a pattern colour`);
    if (!t1) fail(`${tag}: no trim`);
    // the number on the body (stripes get a dark outline in the app, so only plain kits are held to it)
    if (pat === 'so' && contrast(b, n) < 2.2) fail(`${tag}: the number ${n} doesn't read on ${b} (${contrast(b, n).toFixed(2)})`);
  });
  if (dist(kits[0][1], kits[1][1]) < 140) fail(`${id}: the 2nd is too close to the 1st`);
  const key = kits[0].slice(0, 5).join(' ').toUpperCase();
  if (seen[key]) fail(`${id} wears the same 1st as ${seen[key]}`); seen[key] = id;
}
// every pairing: the home 1st against the away side's kit after the clash rule
const all = [...j1, ...j2]; let swaps = 0, pairs = 0;
for (const h of all) for (const a of all) {
  if (h === a) continue; pairs++;
  const hb = UNI[h][0][1], clash = dist(hb, UNI[a][0][1]) < 140, ab = UNI[a][clash ? 1 : 0][1];
  if (clash) swaps++;
  if (dist(hb, ab) < 140) fail(`${h} vs ${a}: still alike after the change (${hb} / ${ab})`);
}
// the 2026-10-16 ask: 横浜FM is blue with white and red
const fm = UNI.yokohamafm[0];
if (fm[0] !== 'so' || !/^#1/.test(fm[1]) || fm[3] !== '#FFFFFF' || fm[4] !== '#D7192F') fail('横浜FM is not blue with white and red');
console.log(`${Object.keys(UNI).length} clubs (J1 ${j1.length} + J2 ${j2.length}), patterns ${[...new Set(Object.values(UNI).map(k => k[0][0]))].join('/')}, the away side changes in ${swaps} of ${pairs} pairings`);
console.log(bad ? `${bad} problem(s)` : 'uniforms ok');
process.exit(bad ? 1 : 0);
