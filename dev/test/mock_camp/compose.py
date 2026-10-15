# 案A〜C を並べた画像（チャットで見せる用）: pick-<案>.png（iPhone 16 黒板: シートを開いたとき・シート全体・レポート全体）と
# pick-se-white.png（iPhone SE ホワイトボード: ホームの秘書・各案のシートとレポートを開いたとき）
# usage: python3 compose.py  → out/pick-*.png（shoot.py all chalk と shoot.py all white 375 667 のあと）
import pathlib
from PIL import Image, ImageDraw, ImageFont
HERE = pathlib.Path(__file__).resolve().parent; OUT = HERE / 'out'
F = lambda s, w='Bold': ImageFont.truetype(f'/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc', s)
BG, INK, MUT = (22, 52, 40), (242, 239, 228), (169, 188, 175)
TITLE = {
  'A': ('案A　九州の地図ボード', '作戦ボードに九州と沖縄の地図。行き先はマグネットで、タップすると下に効き目のカード。レポートは作戦ボードの振り返り（10日間・連携の線・伸びた選手・できごと）'),
  'B': ('案B　キャンプのしおり', 'スポンサー契約と同じ紙をマグネットで留めた5枚のしおり。選ぶと朱印「決定」。レポートは紙の「キャンプ報告書」（朱印「完了」・あきのメモ）'),
  'C': ('案C　チョークの比較表', 'ボードにチョークで5つの行き先を ◎○△ で比べ、選んだ行を黄色で丸。レポートは転生・優勝と同じ系統の派手なポップアップ（照明・MVP）'),
}
def label(d, x, y, t): d.text((x, y), t, font=F(30, 'Regular'), fill=MUT)
for v in 'ABC':
  a = Image.open(OUT / f'{v}-sheet-chalk-393-1.png'); s = Image.open(OUT / f'{v}-sheet-chalk-393-full.png'); r = Image.open(OUT / f'{v}-report-chalk-393-full.png')
  pad, gap, head = 40, 40, 190
  W = pad * 2 + a.width + s.width + r.width + gap * 2
  H = head + 50 + max(a.height, s.height, r.height) + pad
  im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
  t, sub = TITLE[v]
  d.text((pad, 28), t, font=F(56), fill=INK); d.text((pad, 110), sub, font=F(28, 'Regular'), fill=MUT)
  x = pad
  for img, lb in [(a, '行き先を選ぶシート（開いたとき）'), (s, 'シート（下まで）'), (r, 'キャンプ・レポート（下まで）')]:
    label(d, x, head, lb); im.paste(img, (x, head + 50)); x += img.width + gap
  im.save(OUT / f'pick-{v}.png'); print(v, im.size)
# iPhone SE, whiteboard
names = [('home-white-375', 'ホーム（1/4）'), ('A-sheet-white-375-1', '案A シート'), ('B-sheet-white-375-1', '案B シート'), ('C-sheet-white-375-1', '案C シート'), ('A-report-white-375-1', '案A レポート'), ('B-report-white-375-1', '案B レポート'), ('C-report-white-375-1', '案C レポート')]
ims = [Image.open(OUT / f'{n}.png') for n, _ in names]
pad, gap, head = 40, 30, 120
W = pad * 2 + sum(i.width for i in ims) + gap * (len(ims) - 1); H = head + 50 + ims[0].height + pad
im = Image.new('RGB', (W, H), (243, 245, 246)); d = ImageDraw.Draw(im)
d.text((pad, 24), 'iPhone SE・ホワイトボード（開いたとき）', font=F(52), fill=(24, 35, 58))
x = pad
for img, (n, lb) in zip(ims, names):
  d.text((x, head), lb, font=F(30, 'Regular'), fill=(90, 102, 120)); im.paste(img, (x, head + 50)); x += img.width + gap
im.save(OUT / 'pick-se-white.png'); print('se', im.size)
