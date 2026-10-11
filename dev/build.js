// Builds two outputs from src/:
//   dist/touchline.html  — the Claude artifact page (body-only, the host adds <head>)
//   pwa/                 — the home-screen web app for GitHub Pages (full document + manifest + service worker)
const fs = require('fs'), path = require('path');
const d = __dirname;
let tpl = fs.readFileSync(path.join(d, 'src/template.html'), 'utf8');
const data = fs.readFileSync(path.join(d, 'data.json'), 'utf8');
const eng = fs.readFileSync(path.join(d, 'src/engine.js'), 'utf8');
const app = fs.readFileSync(path.join(d, 'src/app.js'), 'utf8');
const m2d = fs.readFileSync(path.join(d, 'src/match2d.js'), 'utf8');
if (/<\/script/i.test(data + eng + app + m2d)) throw new Error('script close tag inside inline code');
function fill(html) {
  for (const [k, v] of [['/*DATA*/', data], ['/*ENGINE*/', eng], ['/*M2D*/', m2d], ['/*APP*/', app]]) { const i = html.indexOf(k); if (i < 0) throw new Error(k); html = html.slice(0, i) + v + html.slice(i + k.length); }
  return html;
}
// ---- artifact
const art = fill(tpl);
fs.mkdirSync(path.join(d, 'dist'), { recursive: true });
fs.writeFileSync(path.join(d, 'dist/touchline.html'), art);
// ---- PWA
const cut = tpl.indexOf('<div id="root"></div>');
const headPart = tpl.slice(0, cut);
let bodyPart = tpl.slice(cut).replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js"></script>', '<script src="lz-string.min.js"></script>');
if (bodyPart.includes('cdnjs')) throw new Error('cdn script left in PWA build');
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const pwa = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#EEF1EA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A1310" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="クラつく">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="片手で遊べるJ1クラブ経営シミュレーション（非商用のファンメイドゲーム）">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="favicon-32.png">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%}
img{max-width:100%}[hidden]{display:none!important}
body::before{content:"";position:fixed;left:0;right:0;top:0;height:env(safe-area-inset-top,0px);background:var(--bg,#EEF1EA);z-index:40}
</style>
${headPart.trim()}
</head>
<body>
${fill(bodyPart).trim()}
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
</body>
</html>
`;
// inside the kuratsuku repo the site lives at the repo root; in a scratch copy it goes to ./pwa
const P = fs.existsSync(path.join(d, '..', '.git')) ? path.join(d, '..') : path.join(d, 'pwa');
fs.mkdirSync(P, { recursive: true });
fs.writeFileSync(path.join(P, 'index.html'), pwa);
fs.writeFileSync(path.join(P, 'manifest.webmanifest'), JSON.stringify({
  name: 'クラつく', short_name: 'クラつく', description: '片手で遊べるJ1クラブ経営シミュレーション', lang: 'ja',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#0A1310', theme_color: '#0A1310',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));
fs.writeFileSync(path.join(P, 'sw.js'), `// クラつく service worker — version ${version}
const CACHE = 'kuratsuku-${version}';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'lz-string.min.js', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon-32.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('kuratsuku-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the game itself: always try the network first so fixes show up right away; fall back to the cached copy offline
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')))) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; }).catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin) { e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }))); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => { const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; })));
  }
});
`);
fs.writeFileSync(path.join(P, '.nojekyll'), '');
fs.writeFileSync(path.join(P, 'README.md'), `# クラつく

片手で遊べるJ1クラブ経営シミュレーション（Webアプリ）。

- 遊ぶ: https://yuthy8345.github.io/kuratsuku/
- iPhone: Safariで開き、共有ボタン →「ホーム画面に追加」
- Android: Chromeで開き、メニュー →「ホーム画面に追加」／「アプリをインストール」

選手と在籍クラブはJリーグ公式サイトの2026/27シーズン登録選手をもとにしています。能力値は独自の推定です。クラブのエンブレムは使用していません。非商用のファンメイドゲームです。

同梱ライブラリ: lz-string 1.5.0（MIT License, Pieroxy）
`);
console.log('built artifact', (art.length / 1024).toFixed(0) + 'KB', '| pwa index', (pwa.length / 1024).toFixed(0) + 'KB', 'version', version);
