// Club magnets (EMB in app.js, .k-* in template.html): every J1/J2 club has an entry, every pattern has its CSS,
// the colours are valid, and no two clubs share the same pattern + colours. usage: node dev/test/magnets.js
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const app = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const eng = fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8');
const D = require('../data.json');
const m = app.match(/const EMB = (\{[\s\S]*?\n\});/);
if (!m) throw new Error('EMB not found in app.js');
const EMB = Function('return ' + m[1])();
const j1 = D.clubs.map(c => c.id);
const j2 = [...eng.matchAll(/\{ id: '(\w+)', name: '[^']*', short: '[^']*', c1:/g)].map(x => x[1]);
let bad = 0; const fail = s => { bad++; console.log('NG ' + s); };
for (const id of [...j1, ...j2]) if (!EMB[id]) fail(`${id} has no magnet`);
const seen = {};
for (const [id, e] of Object.entries(EMB)) {
  const [pat, ...cols] = e;
  if (pat !== 'so' && !new RegExp(`\\.k-${pat}(::after)? \\{`).test(css)) fail(`${id}: no CSS for .k-${pat}`);
  for (const c of cols) if (c != null && !/^#[0-9A-F]{6}$/i.test(c)) fail(`${id}: bad colour ${c}`);
  if (['tr', 'cs'].includes(pat) && !e[3]) fail(`${id}: ${pat} needs a third colour`);
  const key = [pat, e[1], e[2], e[3] || ''].join(' ').toUpperCase();
  if (seen[key]) fail(`${id} looks the same as ${seen[key]}`); seen[key] = id;
}
// the 2026-10-14 asks: 横浜FM is the tricolore, and 横浜FM / 水戸 / 福岡 are no longer the same blue magnet
if (EMB.yokohamafm[0] !== 'tr' || EMB.yokohamafm.slice(1, 4).join() !== '#0B3B8C,#FFFFFF,#D7101F') fail('横浜FM is not blue / white / red');
const look = id => EMB[id][0] + EMB[id][2];
if (new Set(['yokohamafm', 'mito', 'fukuoka'].map(look)).size !== 3) fail('横浜FM・水戸・福岡 still look alike');
console.log(`${Object.keys(EMB).length} magnets (J1 ${j1.length} + J2 ${j2.length}), ${new Set(Object.values(EMB).map(e => e[0])).size} patterns`);
console.log(bad ? `${bad} problem(s)` : 'magnets ok');
process.exit(bad ? 1 : 0);
