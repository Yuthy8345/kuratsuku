# puts 案A〜C side by side for the chat: the board on the left, the card under the board and the player sheet's new block on the right
# usage: python3 compose.py [chalk|white] [w]  → out/pick-<variant>-<board>.png
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont
HERE = pathlib.Path(__file__).resolve().parent; OUT = HERE / 'out'
board = sys.argv[1] if len(sys.argv) > 1 else 'chalk'; vw = sys.argv[2] if len(sys.argv) > 2 else '393'
BG = (22, 52, 40) if board == 'chalk' else (243, 245, 246); INK = (242, 239, 228) if board == 'chalk' else (24, 35, 58); MUT = (169, 188, 175) if board == 'chalk' else (90, 102, 120)
F = lambda s, w='Bold': ImageFont.truetype(f'/usr/share/fonts/opentype/noto/NotoSansCJK-{w}.ttc', s)
TITLE = {
  'A': ('案A　チョークの線', '線の太さ＝連携の強さ、黄色＝コンボ。下に連携の平均とコンボの札。選手シートは「相性のいい選手」の一覧'),
  'B': ('案B　数字のマグネット', '線に連携の数字。コンボは朱色の印。選手シートはその選手から全員への線の「連携マップ」'),
  'C': ('案C　切り替えて見る', '「連携を見る」で線の色（青→白→黄→桃）と各選手の輪。コンボはチョークのリスト。選手シートは ◎○△'),
}
for v in 'ABC':
  tag = f'{v}-{board}-{vw}'
  b = Image.open(OUT / f'{tag}-board.png'); c = Image.open(OUT / f'{tag}-card.png'); s = Image.open(OUT / f'{tag}-sheet.png')
  pad, gap, head = 36, 36, 150
  W = pad * 2 + b.width + gap + max(c.width, s.width)
  H = head + max(b.height, c.height + gap + 50 + s.height) + pad
  im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
  t, sub = TITLE[v]
  d.text((pad, 26), t, font=F(48), fill=INK); d.text((pad, 92), sub, font=F(26, 'Regular'), fill=MUT)
  im.paste(b, (pad, head))
  x2 = pad + b.width + gap
  im.paste(c, (x2, head))
  d.text((x2, head + c.height + gap - 6), '選手シート（ポジションの上に入る）', font=F(24, 'Regular'), fill=MUT)
  im.paste(s, (x2, head + c.height + gap + 40))
  im.save(OUT / f'pick-{v}-{board}.png'); print(v, im.size)
